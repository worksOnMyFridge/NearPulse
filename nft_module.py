"""
NearPulse — NFT модуль v2.
Стратегия: только NearBlocks API (уже проиндексировано) + FastNEAR для контрактов.
Никаких прямых RPC вызовов для токенов — они ненадёжны и медленны.

Endpoints:
  GET /api/nfts/<account>                          → список коллекций
  GET /api/nft-tokens/<account>?page=1&per_page=24 → все NFT с медиа, пагинация
  GET /api/nft-meta/<account>/<contract>           → метаданные контракта
"""
import os, json, time, base64
import requests as http_requests
from flask import jsonify, request

NEARBLOCKS_API = "https://api.nearblocks.io/v1"
FASTNEAR_API   = "https://api.fastnear.com/v1"
NEAR_RPC_URL   = "https://rpc.mainnet.near.org"
API_TIMEOUT    = 10
NFT_CACHE_TTL  = 600
META_CACHE_TTL = 3600

_mem_cache = {}

def _cached(key, ttl=NFT_CACHE_TTL):
    e = _mem_cache.get(key)
    if e and time.time() - e["ts"] < ttl:
        return e["data"]
    return None

def _set_cache(key, data, ttl=NFT_CACHE_TTL):
    _mem_cache[key] = {"data": data, "ts": time.time(), "ttl": ttl}

def _nb_headers():
    key = os.environ.get("NEARBLOCKS_API_KEY", "")
    return {"Authorization": f"Bearer {key}"} if key else {}

IPFS_GATEWAY = "https://ipfs.near.social/ipfs/"

def normalize_media(media, base_uri=None):
    if not media:
        return None
    if media.startswith("http"):
        return media
    if media.startswith("data:"):
        return media[:2000] if len(media) > 2000 else media
    if media.startswith("Qm") or media.startswith("bafy") or media.startswith("bafk"):
        return f"{IPFS_GATEWAY}{media}"
    if media.startswith("/ipfs/"):
        return f"https://ipfs.near.social{media}"
    if base_uri:
        sep = "" if base_uri.endswith("/") else "/"
        return f"{base_uri}{sep}{media}"
    return f"{IPFS_GATEWAY}{media}"

def _contract_display_name(contract_id):
    parts = contract_id.split(".")
    name = parts[0] if parts else contract_id
    if "mintbase" in contract_id:
        return f"Mintbase · {name[:10]}"
    if "paras" in contract_id:
        return "Paras"
    return name[:24].replace("-", " ").title()


def fetch_nft_contracts(account_id):
    key = f"nft_contracts:{account_id}"
    cached = _cached(key, NFT_CACHE_TTL)
    if cached is not None:
        return cached
    result = []
    try:
        r = http_requests.get(f"{FASTNEAR_API}/account/{account_id}/nft", timeout=API_TIMEOUT)
        if r.status_code == 200:
            data = r.json()
            tokens = data.get("tokens", data) if isinstance(data, dict) else data
            if isinstance(tokens, dict):
                for contract_id, token_ids in tokens.items():
                    ids = token_ids if isinstance(token_ids, list) else []
                    result.append({"contract": contract_id, "count": len(ids)})
            elif isinstance(tokens, list):
                for item in tokens:
                    if isinstance(item, dict):
                        result.append({
                            "contract": item.get("contract_id", item.get("contract", "")),
                            "count": item.get("count", 0),
                        })
                    elif isinstance(item, str):
                        result.append({"contract": item, "count": 0})
    except Exception as e:
        print(f"[NFT contracts] error: {e}")
        try:
            r = http_requests.get(
                f"{NEARBLOCKS_API}/account/{account_id}/inventory",
                headers=_nb_headers(), timeout=API_TIMEOUT
            )
            if r.status_code == 200:
                for item in r.json().get("inventory", {}).get("nfts", []):
                    result.append({"contract": item.get("contract", ""), "count": item.get("quantity", 0)})
        except Exception as e2:
            print(f"[NFT contracts fallback] error: {e2}")
    _set_cache(key, result, NFT_CACHE_TTL)
    return result


def fetch_all_nfts_paged(account_id, page=1, per_page=24):
    key = f"nft_all:{account_id}:p{page}:pp{per_page}"
    cached = _cached(key, NFT_CACHE_TTL)
    if cached is not None:
        return cached
    try:
        r = http_requests.get(
            f"{NEARBLOCKS_API}/account/{account_id}/inventory/nfts",
            params={"page": page, "per_page": per_page},
            headers=_nb_headers(),
            timeout=API_TIMEOUT,
        )
        if r.status_code != 200:
            return {"tokens": [], "hasMore": False, "total": 0, "error": f"HTTP {r.status_code}"}
        data = r.json()
        raw_tokens = data.get("nfts", data.get("tokens", []))
        total = data.get("total", len(raw_tokens))
        tokens = []
        for t in raw_tokens:
            nft_meta = t.get("nft", {}) or {}
            contract = t.get("contract_account_id") or t.get("contract") or nft_meta.get("contract", "")
            contract_meta = t.get("nft_meta") or t.get("contract_meta") or {}
            media = t.get("media") or nft_meta.get("media") or (t.get("metadata") or {}).get("media")
            base_uri = contract_meta.get("base_uri") or nft_meta.get("base_uri")
            icon = contract_meta.get("icon", "")
            tokens.append({
                "tokenId": t.get("token_id") or nft_meta.get("token_id", ""),
                "title": t.get("title") or nft_meta.get("title") or (t.get("metadata") or {}).get("title") or f"#{t.get('token_id','?')}",
                "media": normalize_media(media, base_uri),
                "contract": contract,
                "contractName": contract_meta.get("name") or _contract_display_name(contract),
                "contractIcon": icon[:5000] if icon and len(str(icon)) < 50000 else None,
            })
        result = {"tokens": tokens, "page": page, "perPage": per_page, "total": total, "hasMore": len(raw_tokens) == per_page}
        _set_cache(key, result, NFT_CACHE_TTL)
        return result
    except Exception as e:
        print(f"[fetch_all_nfts_paged] Error: {e}")
        return {"tokens": [], "hasMore": False, "total": 0, "error": str(e)}


def fetch_contract_meta(contract_id):
    key = f"nft_meta:{contract_id}"
    cached = _cached(key, META_CACHE_TTL)
    if cached is not None:
        return cached
    meta = {"name": _contract_display_name(contract_id), "symbol": None, "icon": None}
    try:
        args_b64 = base64.b64encode(b"{}").decode()
        r = http_requests.post(NEAR_RPC_URL, json={
            "jsonrpc": "2.0", "id": "meta", "method": "query",
            "params": {"request_type": "call_function", "finality": "final",
                       "account_id": contract_id, "method_name": "nft_metadata", "args_base64": args_b64},
        }, timeout=5)
        if r.status_code == 200:
            result_bytes = r.json().get("result", {}).get("result")
            if result_bytes:
                nft_meta = json.loads(bytes(result_bytes).decode("utf-8"))
                icon = nft_meta.get("icon", "")
                meta = {
                    "name": nft_meta.get("name") or _contract_display_name(contract_id),
                    "symbol": nft_meta.get("symbol"),
                    "icon": icon[:5000] if icon and len(icon) < 50000 else None,
                    "baseUri": nft_meta.get("base_uri"),
                }
    except Exception as e:
        print(f"[contract_meta] {contract_id}: {e}")
    _set_cache(key, meta, META_CACHE_TTL)
    return meta


def register_nft_routes(app, cached_fn=None, set_cache_fn=None):

    @app.route("/api/nfts/<account_id>")
    @app.route("/api/nft/<account_id>")
    def api_nft_contracts(account_id):
        page     = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 50)
        all_contracts = fetch_nft_contracts(account_id)
        total = len(all_contracts)
        start = (page - 1) * per_page
        page_data = all_contracts[start : start + per_page]
        return jsonify({
            "account": account_id,
            "nfts": page_data,
            "totalContracts": total,
            "totalNfts": sum(c.get("count", 0) for c in all_contracts),
            "page": page, "perPage": per_page,
            "totalPages": max(1, -(-total // per_page)),
            "hasMore": start + per_page < total,
        })

    @app.route("/api/nft-tokens/<account_id>")
    def api_nft_tokens_all(account_id):
        page     = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 24, type=int), 48)
        return jsonify(fetch_all_nfts_paged(account_id, page, per_page))

    @app.route("/api/nft-meta/<account_id>/<path:contract_id>")
    def api_nft_meta(account_id, contract_id):
        return jsonify({"contract": contract_id, **fetch_contract_meta(contract_id)})
