"""
NearPulse — NFT модуль с пагинацией и ленивой загрузкой метаданных.

Принцип работы:
1. FastNEAR отдаёт ВСЕ контракты + токены одним запросом → кэш на 15 мин
2. /api/nfts/<account> возвращает только список контрактов (без картинок) → мгновенно
3. /api/nft-meta/<account>/<contract> — метаданные одного контракта → lazy, по требованию
4. /api/nfts/<account>?page=1&per_page=20 — пагинация токенов

Так 300 NFT не вызывают 300 RPC запросов при загрузке.
"""
import os
import json
import time
import requests as http_requests
from flask import jsonify, request

FASTNEAR_API   = "https://api.fastnear.com/v1"
NEARBLOCKS_API = "https://api.nearblocks.io/v1"
NEAR_RPC_URL   = "https://rpc.mainnet.near.org"
NFT_CACHE_TTL  = 900  # 15 минут — NFT меняются редко
META_CACHE_TTL = 3600 # 1 час — метаданные контракта стабильны
API_TIMEOUT    = 8


# ─── Используй тот же cache из api.py ─────────────────────────────────────
# Этот файл подключается к api.py через import, поэтому cached/set_cache
# берутся оттуда. Здесь они продублированы для автономного использования.

_mem_cache = {}

def _cached(key, cache_dict=None):
    d = cache_dict if cache_dict is not None else _mem_cache
    entry = d.get(key)
    if entry and time.time() - entry["ts"] < entry.get("ttl", NFT_CACHE_TTL):
        return entry["data"]
    return None

def _set_cache(key, data, ttl=NFT_CACHE_TTL, cache_dict=None):
    d = cache_dict if cache_dict is not None else _mem_cache
    d[key] = {"data": data, "ts": time.time(), "ttl": ttl}


# ─── Шаг 1: получить ВСЕ NFT контракты одним запросом (FastNEAR) ──────────
def fetch_nft_contracts(account_id):
    """
    Возвращает список контрактов с кол-вом токенов.
    Один HTTP-запрос, без индивидуальных RPC вызовов.
    """
    cache_key = f"nft_contracts:{account_id}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    result = []
    try:
        # FastNEAR: один запрос → все NFT контракты
        r = http_requests.get(
            f"{FASTNEAR_API}/account/{account_id}/nft",
            timeout=API_TIMEOUT,
        )
        if r.status_code == 200:
            data = r.json()
            # FastNEAR возвращает { "contract_id": [token_ids...] } или список
            tokens = data.get("tokens", data) if isinstance(data, dict) else data

            if isinstance(tokens, dict):
                for contract_id, token_ids in tokens.items():
                    ids = token_ids if isinstance(token_ids, list) else []
                    result.append({
                        "contract": contract_id,
                        "count": len(ids),
                        "tokenIds": ids[:5],  # Только первые 5 для превью
                    })
            elif isinstance(tokens, list):
                for item in tokens:
                    if isinstance(item, dict):
                        result.append({
                            "contract": item.get("contract_id", item.get("contract", "")),
                            "count": item.get("count", 0),
                            "tokenIds": item.get("token_ids", [])[:5],
                        })
                    elif isinstance(item, str):
                        result.append({"contract": item, "count": 0, "tokenIds": []})
        else:
            print(f"[FastNEAR NFT] status {r.status_code}, trying NearBlocks fallback")
            result = _fetch_nft_contracts_nearblocks(account_id)

    except Exception as e:
        print(f"[fetch_nft_contracts] FastNEAR error: {e}, trying NearBlocks")
        result = _fetch_nft_contracts_nearblocks(account_id)

    _set_cache(cache_key, result, ttl=NFT_CACHE_TTL)
    return result


def _fetch_nft_contracts_nearblocks(account_id):
    """Fallback: NearBlocks inventory (без индивидуальных RPC)."""
    try:
        nearblocks_key = os.environ.get("NEARBLOCKS_API_KEY", "")
        headers = {"Authorization": f"Bearer {nearblocks_key}"} if nearblocks_key else {}
        r = http_requests.get(
            f"{NEARBLOCKS_API}/account/{account_id}/inventory",
            headers=headers,
            timeout=API_TIMEOUT,
        )
        if r.status_code != 200:
            return []
        nfts = r.json().get("inventory", {}).get("nfts", [])
        result = []
        for item in nfts:
            result.append({
                "contract": item.get("contract", ""),
                "count": item.get("quantity", item.get("count", 0)),
                "tokenIds": [],  # NearBlocks не даёт token_ids в inventory
            })
        return result
    except Exception as e:
        print(f"[_fetch_nft_contracts_nearblocks] Error: {e}")
        return []


# ─── Шаг 2: метаданные контракта (ленивая загрузка) ───────────────────────
def fetch_contract_meta(contract_id):
    """
    Получает метаданные NFT-контракта: имя, символ, иконку.
    Один RPC вызов на контракт, кэш 1 час.
    """
    cache_key = f"nft_meta:{contract_id}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    meta = {
        "name": _contract_display_name(contract_id),
        "symbol": None,
        "icon": None,
        "baseUri": None,
    }

    try:
        import base64
        r = http_requests.post(
            NEAR_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": "meta",
                "method": "query",
                "params": {
                    "request_type": "call_function",
                    "finality": "final",
                    "account_id": contract_id,
                    "method_name": "nft_metadata",
                    "args_base64": base64.b64encode(b"{}").decode(),
                },
            },
            timeout=5,  # Короткий таймаут — не блокируем
        )
        if r.status_code == 200:
            data = r.json()
            result_bytes = data.get("result", {}).get("result")
            if result_bytes:
                raw = bytes(result_bytes).decode("utf-8")
                nft_meta = json.loads(raw)
                name = nft_meta.get("name", "")
                icon = nft_meta.get("icon", "")
                # Обрезаем огромные base64 иконки (> 50KB) — они ломают ответ
                if icon and len(icon) > 51200:
                    icon = None
                meta = {
                    "name": name or _contract_display_name(contract_id),
                    "symbol": nft_meta.get("symbol"),
                    "icon": icon,
                    "baseUri": nft_meta.get("base_uri"),
                }
    except Exception as e:
        print(f"[fetch_contract_meta] {contract_id}: {e}")

    _set_cache(cache_key, meta, ttl=META_CACHE_TTL)
    return meta


def _contract_display_name(contract_id):
    """Красивое имя из контракта без RPC."""
    parts = contract_id.split(".")
    name = parts[0] if parts else contract_id
    # mintbase: "xxxxxxxxx.mintbase1.near" → берём первую часть
    if "mintbase" in contract_id:
        return f"Mintbase ({name[:12]})"
    if "paras" in contract_id:
        return f"Paras ({name[:12]})"
    return name[:20].replace("-", " ").title()


# ─── Шаг 3: токены внутри контракта с пагинацией ──────────────────────────
def fetch_nft_tokens_page(account_id, contract_id, page=1, per_page=12):
    """
    Возвращает токены одного контракта с пагинацией.
    Делает ОДИН RPC вызов с limit+offset, не 300.
    """
    cache_key = f"nft_tokens:{account_id}:{contract_id}:p{page}"
    cached = _cached(cache_key, _mem_cache)
    if cached is not None:
        return cached

    from_index = (page - 1) * per_page
    tokens = []

    try:
        import base64
        args = json.dumps({
            "account_id": account_id,
            "from_index": str(from_index),
            "limit": per_page,
        })
        r = http_requests.post(
            NEAR_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": "tokens",
                "method": "query",
                "params": {
                    "request_type": "call_function",
                    "finality": "final",
                    "account_id": contract_id,
                    "method_name": "nft_tokens_for_owner",
                    "args_base64": base64.b64encode(args.encode()).decode(),
                },
            },
            timeout=6,
        )
        if r.status_code == 200:
            data = r.json()
            result_bytes = data.get("result", {}).get("result")
            if result_bytes:
                raw = bytes(result_bytes).decode("utf-8")
                raw_tokens = json.loads(raw)
                for t in raw_tokens:
                    metadata = t.get("metadata", {}) or {}
                    media = metadata.get("media", "")
                    # Нормализуем URL медиа
                    if media and not media.startswith("http") and not media.startswith("data:"):
                        base_uri = None  # будет подставлен клиентом
                    tokens.append({
                        "tokenId": t.get("token_id", ""),
                        "title": metadata.get("title") or f"#{t.get('token_id', '?')}",
                        "description": (metadata.get("description") or "")[:100],
                        "media": media[:500] if media else None,  # Обрезаем длинные data:URI
                        "extra": metadata.get("extra"),
                    })
    except Exception as e:
        print(f"[fetch_nft_tokens_page] {contract_id} p{page}: {e}")

    result = {"tokens": tokens, "page": page, "perPage": per_page}
    _set_cache(cache_key, result, ttl=300)  # 5 мин для токенов
    return result


# ─── Flask endpoints (подключать в api.py) ────────────────────────────────

def register_nft_routes(app, cached_fn, set_cache_fn):
    """
    Регистрирует NFT endpoints в Flask приложении.
    cached_fn, set_cache_fn — функции кэша из api.py (Redis + in-memory).
    """

    @app.route("/api/nft/<account_id>")
    @app.route("/api/nfts/<account_id>")
    def api_nft(account_id):
        """
        Возвращает список NFT контрактов с кол-вом токенов.
        БЕЗ метаданных и картинок — только структура.
        Один HTTP-запрос к FastNEAR.
        """
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 50)

        # Берём все контракты из кэша или FastNEAR
        all_contracts = fetch_nft_contracts(account_id)

        total_contracts = len(all_contracts)
        total_nfts = sum(c.get("count", 0) for c in all_contracts)

        # Пагинация по контрактам
        start = (page - 1) * per_page
        end = start + per_page
        page_contracts = all_contracts[start:end]

        return jsonify({
            "account": account_id,
            "nfts": page_contracts,        # Только страница
            "totalContracts": total_contracts,
            "totalNfts": total_nfts,
            "page": page,
            "perPage": per_page,
            "totalPages": max(1, -(-total_contracts // per_page)),  # ceil division
            "hasMore": end < total_contracts,
        })

    @app.route("/api/nft-meta/<account_id>/<path:contract_id>")
    def api_nft_meta(account_id, contract_id):
        """
        Метаданные одного NFT контракта.
        Вызывается лениво — только когда карточка прокручена в viewport.
        """
        meta = fetch_contract_meta(contract_id)
        return jsonify({"contract": contract_id, **meta})

    @app.route("/api/nft-tokens/<account_id>/<path:contract_id>")
    def api_nft_tokens(account_id, contract_id):
        """
        Токены пользователя внутри конкретного контракта с пагинацией.
        Один RPC вызов с limit+offset.
        """
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 12, type=int), 24)

        result = fetch_nft_tokens_page(account_id, contract_id, page, per_page)
        return jsonify(result)
