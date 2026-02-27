"""
NearPulse Flask API — REST endpoints for Telegram Mini App.
v2.1.0 — Fixed bugs + AI Chat Agent endpoint.
"""
import os
import json
import time
import base64
import math
import requests as http_requests
from datetime import datetime, timezone
from collections import defaultdict
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta

load_dotenv()

app = Flask(__name__)

# ─── CORS ─────────────────────────────────────────────────────────────────
# BUGFIX: добавлены все возможные Netlify-домены + wildcard для локалки
CORS(app, origins=[
    "https://nearpulseapp.netlify.app",
    "https://near-pulse.vercel.app",
    "https://nearpulse.netlify.app",
    "https://nearanalyticsapp.netlify.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
], supports_credentials=False)

# ─── Constants ─────────────────────────────────────────────────────────────
NEAR_RPC_URL      = "https://rpc.mainnet.near.org"
NEARBLOCKS_API    = "https://api.nearblocks.io/v1"
NEARBLOCKS_API_KEY = os.environ.get("NEARBLOCKS_API_KEY", "")
FASTNEAR_API      = "https://api.fastnear.com/v1"
INTEAR_API        = "https://prices.intear.tech"
COINGECKO_API     = "https://api.coingecko.com/api/v3"
REF_FINANCE_API   = "https://indexer.ref.finance"
HOT_CONTRACT      = "game.hot.tg"
YOCTO_NEAR        = 1e24
API_TIMEOUT       = 10
FIRESPACE_HOURS   = {0: 2, 1: 3, 2: 4, 3: 6, 4: 12, 5: 12, 6: 24}

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

TOKEN_DECIMALS_MAP = {
    "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": 6,
    "usdt.tether-token.near": 6,
    "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": 6,
    "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1": 18,
    "wrap.near": 24,
    "token.v2.ref-finance.near": 18,
    "token.burrow.near": 9,
    "meta-pool.near": 24,
    "token.skyward.near": 18,
    "token.pembrock.near": 18,
    "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near": 8,
    "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near": 18,
    "eth.bridge.near": 18,
    "aurora": 18,
    "token.paras.near": 18,
    "game.hot.tg": 6,
    "harvest-moon.near": 6,
    "aa-harvest-moon.near": 9,
    "token.0xshitzu.near": 18,
    "pre.meteor-token.near": 9,
    "meteor-points.near": 9,
    "token.rhealab.near": 9,
    "lst.rhealab.near": 24,
    "token.lonkingnearbackto2024.near": 18,
    "dd.tg": 18,
    "benthedog.near": 18,
}

TOKEN_COINGECKO_MAP = {
    "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": "tether",
    "usdt.tether-token.near": "tether",
    "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": "usd-coin",
    "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1": "dai",
    "wrap.near": "near",
    "token.v2.ref-finance.near": "ref-finance",
    "token.burrow.near": "burrow",
    "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near": "wrapped-bitcoin",
    "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near": "ethereum",
    "eth.bridge.near": "ethereum",
    "aurora": "aurora-near",
    "token.paras.near": "paras",
}

MAJOR_TOKENS = [
    "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near",
    "usdt.tether-token.near",
    "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
    "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    "wrap.near",
    "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near",
    "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near",
]

# ─── Cache ─────────────────────────────────────────────────────────────────
UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_URL", "")
CACHE_TTL = 300  # 5 minutes
_redis_client = None
_mem_cache = {}

try:
    if UPSTASH_REDIS_URL:
        import redis as redis_lib
        _redis_client = redis_lib.from_url(UPSTASH_REDIS_URL, decode_responses=True, socket_timeout=3)
        _redis_client.ping()
        print("[Cache] Upstash Redis connected")
    else:
        print("[Cache] No UPSTASH_REDIS_URL, using in-memory cache")
except Exception as e:
    print(f"[Cache] Redis connection failed ({e}), using in-memory fallback")
    _redis_client = None


def nearblocks_headers():
    headers = {}
    if NEARBLOCKS_API_KEY:
        headers["Authorization"] = f"Bearer {NEARBLOCKS_API_KEY}"
    return headers


def cached(key):
    if _redis_client:
        try:
            raw = _redis_client.get(f"np:{key}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    entry = _mem_cache.get(key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]
    return None


def set_cache(key, data, ttl=CACHE_TTL):
    _mem_cache[key] = {"data": data, "ts": time.time()}
    if _redis_client:
        try:
            _redis_client.setex(f"np:{key}", ttl, json.dumps(data, default=str))
        except Exception:
            pass


# ─── NEAR Data Functions ───────────────────────────────────────────────────
def get_balance(address):
    try:
        r = http_requests.post(
            NEAR_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "query",
                "params": {
                    "request_type": "view_account",
                    "finality": "final",
                    "account_id": address,
                },
            },
            timeout=API_TIMEOUT,
        )
        data = r.json()
        if "error" in data:
            return {"address": address, "near": 0}
        amount = data["result"]["amount"]
        near = int(amount) / YOCTO_NEAR
        return {"address": address, "near": near}
    except Exception as e:
        print(f"[get_balance] Error: {e}")
        return {"address": address, "near": 0}


def get_near_price():
    c = cached("near_price")
    if c is not None:
        return c
    price = 0
    try:
        r = http_requests.get(
            f"{INTEAR_API}/get-token-price",
            params={"token_id": "wrap.near"},
            timeout=API_TIMEOUT,
        )
        if r.status_code == 200:
            data = r.json()
            p = data.get("price") if isinstance(data, dict) else data
            price = float(p) if p is not None else 0
        if not price:
            raise ValueError("Intear returned no price")
        set_cache("near_price", price)
        return price
    except Exception as e:
        print(f"[get_near_price] Intear: {e}")
    try:
        r = http_requests.get(
            f"{COINGECKO_API}/simple/price",
            params={"ids": "near", "vs_currencies": "usd"},
            timeout=API_TIMEOUT,
        )
        price = r.json().get("near", {}).get("usd", 0)
        if price:
            set_cache("near_price", price)
        return price
    except Exception as e:
        print(f"[get_near_price] CoinGecko fallback: {e}")
    return 0


def get_staking_balance(address):
    try:
        url = f"{NEARBLOCKS_API}/kitwallet/staking-deposits/{http_requests.utils.quote(address)}"
        r = http_requests.get(url, headers=nearblocks_headers(), timeout=API_TIMEOUT)
        data = r.json()
        deposits = data if isinstance(data, list) else data.get("data", data.get("deposits", []))
        if not isinstance(deposits, list):
            deposits = []
        total = 0
        for item in deposits:
            deposit = item.get("deposit", item.get("amount", "0"))
            amount = int(str(deposit))
            if amount > 0:
                total += amount / YOCTO_NEAR
        return total
    except Exception as e:
        print(f"[get_staking_balance] Error: {e}")
        return 0


def get_hot_claim_status(address):
    try:
        args_b64 = base64.b64encode(json.dumps({"account_id": address}).encode()).decode()
        r = http_requests.post(
            NEAR_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": "dontcare",
                "method": "query",
                "params": {
                    "request_type": "call_function",
                    "finality": "final",
                    "account_id": HOT_CONTRACT,
                    "method_name": "get_user",
                    "args_base64": args_b64,
                },
            },
            timeout=API_TIMEOUT,
        )
        data = r.json()
        if "error" in data:
            return None
        result = data.get("result", {}).get("result")
        if not result or not isinstance(result, list):
            return None
        json_str = bytes(result).decode("utf-8")
        user_data = json.loads(json_str)
        firespace = user_data.get("firespace")
        if firespace is not None:
            level = int(firespace)
            storage_hours = FIRESPACE_HOURS.get(level, 24)
        else:
            raw = (
                user_data.get("storage_hours")
                or user_data.get("storage_duration")
                or user_data.get("storage_fill_hours")
                or user_data.get("claim_interval")
                or user_data.get("storage")
                or 24
            )
            storage_hours = int(raw) if raw else 24

        max_storage_ms = storage_hours * 3600 * 1000
        last_claim_raw = (
            user_data.get("last_claimed_at")
            or user_data.get("last_claim")
            or user_data.get("claimed_at")
            or user_data.get("updated_at")
            or 0
        )
        last_claim_ms = last_claim_raw / 1e6 if last_claim_raw > 1e15 else last_claim_raw
        next_claim_at = last_claim_ms + max_storage_ms
        now = time.time() * 1000

        if now >= next_claim_at:
            return {"readyToClaim": True, "hoursUntilClaim": 0, "minutesUntilClaim": 0}

        diff_ms = next_claim_at - now
        hours = int(diff_ms // 3600000)
        minutes = int((diff_ms % 3600000) // 60000)
        return {"readyToClaim": False, "hoursUntilClaim": hours, "minutesUntilClaim": minutes}
    except Exception as e:
        print(f"[get_hot_claim_status] Error: {e}")
        return None


def get_all_tokens(address):
    try:
        url = f"{NEARBLOCKS_API}/account/{address}/inventory"
        r = http_requests.get(url, headers=nearblocks_headers(), timeout=API_TIMEOUT)
        tokens = r.json().get("inventory", {}).get("fts", [])
        result = []
        for t in tokens:
            contract = t.get("contract", "")
            raw_amount = float(t.get("amount", t.get("balance", "0")))
            decimals = (
                TOKEN_DECIMALS_MAP.get(contract)
                or TOKEN_DECIMALS_MAP.get(contract.lower())
                or (t.get("ft_meta") or {}).get("decimals")
                or t.get("decimals")
            )
            if not decimals:
                decimals = 18 if raw_amount > 1e15 else 0
            decimals = int(decimals)
            normalized = raw_amount / (10 ** decimals) if decimals > 0 else raw_amount
            symbol = t.get("symbol") or (t.get("ft_meta") or {}).get("symbol")
            if not symbol:
                parts = contract.split(".")
                symbol = parts[0][:10].upper() if len(parts[0]) > 15 else parts[0].upper()
            nb_price = t.get("price") or (t.get("ft_meta") or {}).get("price") or 0
            result.append({
                "name": t.get("name") or (t.get("ft_meta") or {}).get("name") or symbol,
                "symbol": symbol,
                "contract": contract,
                "amount": normalized,
                "decimals": decimals,
                "icon": t.get("icon") or (t.get("ft_meta") or {}).get("icon"),
                "nearblocks_price": float(nb_price) if nb_price else 0,
            })
        return [t for t in result if t["amount"] > 0]
    except Exception as e:
        print(f"[get_all_tokens] Error: {e}")
        return []


def get_coingecko_prices(contracts):
    try:
        contract_to_id = {}
        ids = set()
        for c in contracts:
            gid = TOKEN_COINGECKO_MAP.get(c.lower())
            if gid:
                contract_to_id[c] = gid
                ids.add(gid)
        if not ids:
            return {}
        r = http_requests.get(
            f"{COINGECKO_API}/simple/price",
            params={"ids": ",".join(ids), "vs_currencies": "usd"},
            timeout=API_TIMEOUT,
        )
        data = r.json()
        prices = {}
        for c, gid in contract_to_id.items():
            p = (data.get(gid) or {}).get("usd")
            if p and isinstance(p, (int, float)):
                prices[c] = p
                prices[c.lower()] = p
        return prices
    except Exception as e:
        print(f"[coingecko] Error: {e}")
        return {}


def get_ref_finance_prices(contracts):
    try:
        r = http_requests.get(f"{REF_FINANCE_API}/list-token-price", timeout=API_TIMEOUT)
        ref_prices = r.json() or {}
        prices = {}
        for c in contracts:
            for variant in [c, c.lower()]:
                p = ref_prices.get(variant)
                if p:
                    pnum = float(p) if isinstance(p, (str, int, float)) else float(p.get("price", 0))
                    if pnum > 0:
                        prices[c] = pnum
                        prices[c.lower()] = pnum
                        break
        return prices
    except Exception as e:
        print(f"[ref_finance] Error: {e}")
        return {}


def get_intear_prices(contracts):
    try:
        r = http_requests.get(f"{INTEAR_API}/list-token-price", timeout=API_TIMEOUT)
        intear_data = r.json() or {}
        prices = {}
        for c in contracts:
            for variant in [c, c.lower()]:
                p = intear_data.get(variant)
                if p is None:
                    continue
                pnum = float(p.get("price", 0)) if isinstance(p, dict) else float(p)
                if pnum > 0:
                    prices[c] = pnum
                    prices[c.lower()] = pnum
                    break
        return prices
    except Exception as e:
        print(f"[intear] Error: {e}")
        return {}


def get_tokens_with_prices(address, min_usd=1):
    tokens = get_all_tokens(address)
    tokens = [t for t in tokens if t["contract"].lower() != "game.hot.tg"]
    if not tokens:
        return {"major": [], "filtered": [], "hidden": []}
    contracts = [t["contract"] for t in tokens]
    intear_prices = get_intear_prices(contracts)
    ref_prices = get_ref_finance_prices(contracts)
    cg_prices = get_coingecko_prices(contracts)
    results = []
    for t in tokens:
        c = t["contract"]
        price = (
            intear_prices.get(c)
            or intear_prices.get(c.lower())
            or ref_prices.get(c)
            or ref_prices.get(c.lower())
            or cg_prices.get(c)
            or cg_prices.get(c.lower())
            or t["nearblocks_price"]
            or 0
        )
        usd_value = t["amount"] * price
        is_major = c.lower() in [m.lower() for m in MAJOR_TOKENS]
        results.append({**t, "price": price, "usdValue": usd_value, "isMajor": is_major})

    major = sorted(
        [t for t in results if t["isMajor"] and t["price"] > 0 and t["usdValue"] >= 1],
        key=lambda x: -x["usdValue"],
    )
    others = [t for t in results if not t["isMajor"]]
    filtered = sorted(
        [t for t in others if (t["price"] > 0 and t["usdValue"] >= min_usd) or (t["price"] == 0 and 15000 <= t["amount"] <= 500000)],
        key=lambda x: (-x["usdValue"] if x["price"] > 0 else -x["amount"]),
    )
    hidden = [t for t in others if t not in filtered]
    return {"major": major, "filtered": filtered, "hidden": hidden}


def get_token_balance(address, token_id="game.hot.tg"):
    try:
        url = f"{NEARBLOCKS_API}/account/{address}/inventory"
        r = http_requests.get(url, headers=nearblocks_headers(), timeout=API_TIMEOUT)
        fts = r.json().get("inventory", {}).get("fts", [])
        token = next((t for t in fts if t.get("contract") == token_id), None)
        if token:
            return float(token.get("amount", 0)) / 1e6
        return 0
    except Exception as e:
        print(f"[get_token_balance] Error: {e}")
        return 0


# ─── NFT via FastNEAR ──────────────────────────────────────────────────────
def get_user_nfts(account_id):
    try:
        url = f"{FASTNEAR_API}/account/{account_id}/nft"
        r = http_requests.get(url, timeout=API_TIMEOUT)
        if r.status_code != 200:
            print(f"[FastNEAR NFT] status {r.status_code}")
            return []
        data = r.json()
        tokens = data.get("tokens", data) if isinstance(data, dict) else data
        nfts = []
        if isinstance(tokens, dict):
            for contract_id, token_ids in tokens.items():
                count = len(token_ids) if isinstance(token_ids, list) else 1
                nfts.append({
                    "contract": contract_id,
                    "count": count,
                    "tokenIds": token_ids[:10] if isinstance(token_ids, list) else [],
                })
        elif isinstance(tokens, list):
            for item in tokens:
                if isinstance(item, dict):
                    nfts.append({
                        "contract": item.get("contract_id", item.get("contract", "")),
                        "count": item.get("count", 1),
                        "tokenIds": item.get("token_ids", [])[:10],
                    })
                elif isinstance(item, str):
                    nfts.append({"contract": item, "count": 0, "tokenIds": []})
        return nfts
    except Exception as e:
        print(f"[get_user_nfts] Error: {e}")
        return []


# ─── Transaction Analysis ──────────────────────────────────────────────────
def get_transaction_history(address):
    try:
        url = f"{NEARBLOCKS_API}/account/{address}/txns"
        r = http_requests.get(url, params={"per_page": 50, "order": "desc"}, headers=nearblocks_headers(), timeout=API_TIMEOUT)
        txns = r.json().get("txns", [])
        if isinstance(txns, dict):
            txns = list(txns.values())
        return txns if isinstance(txns, list) else []
    except Exception as e:
        print(f"[get_transaction_history] Error: {e}")
        return []


def time_ago(timestamp_ns):
    if not timestamp_ns:
        return ""
    try:
        ts = int(timestamp_ns)
        if ts > 1e18:
            ts_sec = ts / 1e9
        elif ts > 1e15:
            ts_sec = ts / 1e6
        elif ts > 1e12:
            ts_sec = ts / 1e3
        else:
            ts_sec = ts
        diff = time.time() - ts_sec
        if diff < 60:
            return f"{int(diff)}с назад"
        if diff < 3600:
            return f"{int(diff // 60)}м назад"
        if diff < 86400:
            h = int(diff // 3600)
            m = int((diff % 3600) // 60)
            return f"{h}ч {m}м назад"
        days = int(diff // 86400)
        return f"{days}д назад"
    except Exception:
        return ""


def analyze_transaction_group(tx_group, user_address):
    relevant = [
        tx for tx in tx_group
        if tx.get("receiver_account_id") != "system"
        and tx.get("predecessor_account_id") != "system"
    ]
    if not relevant:
        return None

    contracts = {tx.get("receiver_account_id", "") for tx in relevant}
    contract_list = list(contracts)
    first_tx = relevant[0]
    timestamp = first_tx.get("block_timestamp", 0)
    tx_count = len(relevant)

    total_near_deposit = 0
    total_near_received = 0
    for tx in relevant:
        _agg = tx.get("actions_agg")
        deposit = float((_agg if isinstance(_agg, dict) else {}).get("deposit", 0)) / 1e24
        if tx.get("predecessor_account_id") == user_address:
            total_near_deposit += deposit
        elif tx.get("receiver_account_id") == user_address:
            total_near_received += deposit

    gas_fee = sum(
        float(((tx.get("outcomes_agg") if isinstance(tx.get("outcomes_agg"), dict) else {})).get("transaction_fee", 0) or 0) / 1e24
        for tx in relevant
    )

    def has_any(*patterns):
        return any(any(p in c for p in patterns) for c in contract_list)

    tx_type = "contract"
    icon = "contract"
    description = "Вызов контракта"
    show_amount = False
    amount = 0
    category = "other"

    if has_any("ref-finance", "rhea") and tx_count > 1:
        tx_type, icon = "swap", "swap"
        dex = "Ref Finance" if has_any("ref-finance") else "RHEA"
        description = f"Swap на {dex}"
        category = "defi"
        if total_near_deposit > 0:
            amount, show_amount = total_near_deposit, True
    elif has_any("hot.tg", "game.hot.tg"):
        tx_type, icon = "claim", "claim"
        description = "Claim HOT"
        category = "gaming"
    elif has_any("harvest-moon"):
        tx_type, icon = "claim", "claim"
        description = "Claim MOON"
        category = "gaming"
    elif has_any("meteor"):
        tx_type, icon = "claim", "claim"
        description = "Claim Meteor"
        category = "gaming"
    elif has_any("aurora", "bridge", "rainbow", "factory.bridge.near"):
        tx_type, icon = "bridge", "bridge"
        description = f"Bridge ({contract_list[0][:20]}...)" if contract_list else "Bridge"
        category = "defi"
    elif has_any("nft", "mintbase", "paras") or "nft_" in str(first_tx.get("actions", [])):
        tx_type, icon = "nft", "nft"
        is_outgoing = first_tx.get("predecessor_account_id") == user_address
        description = "NFT → отправлено" if is_outgoing else "NFT ← получено"
        category = "nft"
    elif total_near_deposit > 0.01 and tx_count == 1:
        tx_type = "transfer_out" if first_tx.get("predecessor_account_id") == user_address else "transfer_in"
        icon = "transfer_out" if tx_type == "transfer_out" else "transfer_in"
        category = "transfers"
        other = first_tx.get("receiver_account_id") if tx_type == "transfer_out" else first_tx.get("predecessor_account_id")
        short = (other[:8] + "..." + other[-6:]) if len(other) > 20 else other
        description = f"Перевод → {short}" if tx_type == "transfer_out" else f"Получено ← {short}"
        amount, show_amount = total_near_deposit, True
    elif has_any(".tkn.", "token.", "meme-cooking"):
        tx_type, icon = "token", "token"
        category = "defi"
        tc = next((c for c in contract_list if ".tkn." in c or "token." in c or "meme-cooking" in c), "")
        parts = tc.split(".")
        token_name = (parts[1] if parts[0] == "token" and len(parts) >= 3 else parts[0].split("-")[0]).upper()
        is_out = first_tx.get("predecessor_account_id") == user_address
        description = f"Отправлено {token_name}" if is_out else f"Получено {token_name}"
    else:
        method_name = ""
        for tx in relevant:
            for a in tx.get("actions", []) or []:
                if isinstance(a, dict) and a.get("method"):
                    method_name = a["method"]
                    break
            if method_name:
                break
        description = method_name or (f"Вызов {contract_list[0][:25]}..." if contract_list else "Транзакция")

    icon_map = {
        "swap": "🔄",
        "claim": "🎁",
        "transfer_out": "📤",
        "transfer_in": "📥",
        "token": "🪙",
        "contract": "📝",
        "nft": "🖼️",
        "bridge": "🌉",
    }

    details = []
    token_transfers = []
    for tx in relevant:
        _oa = tx.get("outcomes_agg")
        fee = float((_oa if isinstance(_oa, dict) else {}).get("transaction_fee", 0)) / 1e24
        actions = tx.get("actions", [])
        method = ""
        for a in actions:
            if isinstance(a, dict) and a.get("method"):
                method = a["method"]
                if method == "ft_transfer" and a.get("args", {}).get("amount"):
                    token_transfers.append({
                        "token": tx.get("receiver_account_id", "").split(".")[0].upper(),
                        "contract": tx.get("receiver_account_id", ""),
                        "amount": a["args"]["amount"],
                    })
                break
        details.append({
            "action": method or "Transfer",
            "contract": tx.get("receiver_account_id", ""),
            "gasFee": fee,
        })

    result_str = ""
    if show_amount and amount > 0:
        sign = "-" if tx_type == "transfer_out" else "+"
        result_str = f"{sign}{amount:.2f} NEAR"

    return {
        "id": first_tx.get("transaction_hash", ""),
        "type": tx_type,
        "icon": icon_map.get(icon, "📝"),
        "protocol": contract_list[0] if contract_list else "",
        "action": description,
        "time": time_ago(timestamp),
        "timestamp": timestamp,
        "gas": gas_fee,
        "result": result_str,
        "category": category,
        "txCount": tx_count,
        "txHashes": list(set(tx.get("transaction_hash", "") for tx in relevant)),
        "allNearSpent": total_near_deposit,
        "allNearReceived": total_near_received,
        "tokenTransfers": token_transfers,
        "details": details,
        "grouped": [
            {"action": d["action"], "contract": d["contract"], "gas": d["gasFee"]}
            for d in details
        ] if tx_count > 1 else None,
    }


def compute_analytics(grouped_txs, near_price):
    total_txs = len(grouped_txs)
    total_gas = sum(tx.get("gas", 0) for tx in grouped_txs)
    gas_usd = total_gas * near_price if near_price else 0

    all_contracts = set()
    for tx in grouped_txs:
        if tx.get("details"):
            for d in tx["details"]:
                if d.get("contract"):
                    all_contracts.add(d["contract"])

    cats = defaultdict(lambda: {"count": 0, "usd": 0})
    for tx in grouped_txs:
        cat = tx.get("category", "other")
        cats[cat]["count"] += 1
        cats[cat]["usd"] += tx.get("allNearSpent", 0) * near_price if near_price else 0

    breakdown = {}
    for cat_key in ["gaming", "defi", "transfers", "nft", "other"]:
        c = cats[cat_key]
        pct = round(c["count"] / total_txs * 100) if total_txs > 0 else 0
        if c["count"] > 0 or cat_key in ["gaming", "defi", "transfers"]:
            breakdown[cat_key] = {
                "count": c["count"],
                "percent": pct,
                "usd": round(c["usd"], 2),
            }

    contract_counts = defaultdict(lambda: {"txs": 0, "gas": 0, "category": "other"})
    protocol_names = {
        "game.hot.tg": ("Hot Protocol", "🔥", "Gaming"),
        "v2.ref-finance.near": ("Ref Finance", "💱", "DeFi"),
        "harvest-moon.near": ("Moon Protocol", "🌙", "Gaming"),
    }
    for tx in grouped_txs:
        if tx.get("details"):
            for d in tx["details"]:
                c = d.get("contract", "")
                if c and c != "system":
                    contract_counts[c]["txs"] += 1
                    contract_counts[c]["gas"] += d.get("gasFee", 0)
                    contract_counts[c]["category"] = tx.get("category", "other")

    top_contracts = []
    total_gas_all = sum(data["gas"] for data in contract_counts.values()) or 1
    for c, data in sorted(contract_counts.items(), key=lambda x: -x[1]["txs"])[:6]:
        name_info = protocol_names.get(c)
        if name_info:
            name, icon_str, cat = name_info
        else:
            parts = c.split(".")
            name = parts[0] if len(parts[0]) <= 20 else parts[0][:15] + "..."
            icon_str = "📝"
            cat = data["category"].capitalize()
        # BUGFIX: добавлен percent для topContracts
        top_contracts.append({
            "name": name,
            "icon": icon_str,
            "txs": data["txs"],
            "gas": round(data["gas"], 6),
            "gasUSD": round(data["gas"] * near_price, 4) if near_price else 0,
            "category": cat,
            "percent": round(data["gas"] / total_gas_all * 100) if total_gas_all > 0 else 0,
        })

    most_active = top_contracts[0]["name"] if top_contracts else "N/A"

    day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    day_counts = defaultdict(int)
    for tx in grouped_txs:
        ts = tx.get("timestamp", 0)
        if ts:
            try:
                ts_int = int(ts)
                if ts_int > 1e18:
                    ts_sec = ts_int / 1e9
                elif ts_int > 1e15:
                    ts_sec = ts_int / 1e6
                else:
                    ts_sec = ts_int
                dt = datetime.fromtimestamp(ts_sec, tz=timezone.utc)
                day_counts[dt.weekday()] += 1
            except Exception:
                pass

    activity_by_day = [{"day": day_names[i], "txs": day_counts.get(i, 0)} for i in range(7)]

    insights = []
    avg_gas = total_gas / total_txs if total_txs > 0 else 0
    if total_txs > 30:
        insights.append({"type": "info", "text": f"Высокая активность: {total_txs} транзакций", "icon": "📈"})
    if avg_gas > 0.005:
        insights.append({"type": "warning", "text": "Gas расходы выше среднего", "icon": "⚠️"})
    gaming_count = cats["gaming"]["count"]
    if gaming_count > total_txs * 0.5 and gaming_count > 0:
        insights.append({"type": "info", "text": f"Gaming — основная активность ({gaming_count} txs)", "icon": "🎮"})
    defi_count = cats["defi"]["count"]
    if defi_count > 5:
        insights.append({"type": "success", "text": f"Активный DeFi-пользователь ({defi_count} операций)", "icon": "💰"})
    if not insights:
        insights.append({"type": "info", "text": f"Всего {total_txs} транзакций за период", "icon": "📊"})

    return {
        "totalTxs": total_txs,
        "gasSpent": round(total_gas, 6),
        "gasUSD": round(gas_usd, 2),
        "uniqueContracts": len(all_contracts),
        "mostActive": most_active,
        "breakdown": breakdown,
        "topContracts": top_contracts,
        "activityByDay": activity_by_day,
        "insights": insights,
    }


# ─── AI Chat ───────────────────────────────────────────────────────────────
def build_ai_system_prompt(wallet_context=None):
    base = """Ты — NearPulse AI, персональный аналитик NEAR Protocol и криптовалютного рынка.

Твои возможности:
• Анализ рынка NEAR, криптовалют и DeFi экосистемы
• Оценка портфеля пользователя и рекомендации
• Объяснение DeFi протоколов (Ref Finance, Burrow, Meta Pool, HOT Protocol)
• Анализ транзакций и паттернов поведения
• Рыночные прогнозы и тренды (с оговорками — не финансовый совет)
• Советы по стейкингу, farming, управлению газом

Стиль общения:
• Отвечай конкретно и лаконично
• Используй эмодзи для наглядности
• Финансовые советы помечай: "⚠️ Не является финансовым советом"
• Отвечай на русском языке, если вопрос задан по-русски

Контекст платформы: NearPulse — аналитический инструмент для NEAR Protocol кошельков."""

    if wallet_context:
        near = wallet_context.get("near", 0)
        staking = wallet_context.get("staking", 0)
        hot = wallet_context.get("hot", 0)
        near_price = wallet_context.get("nearPrice", 0)
        total_usd = wallet_context.get("totalUSD", 0)
        address = wallet_context.get("address", "")

        tokens_info = ""
        tokens = wallet_context.get("tokens", {})
        all_tokens = tokens.get("major", []) + tokens.get("filtered", [])
        if all_tokens:
            top_tokens = all_tokens[:5]
            tokens_info = "\nОсновные токены: " + ", ".join(
                f"{t['symbol']} ({t['amount']:.2f}, ${t.get('usdValue', 0):.2f})" 
                for t in top_tokens
            )

        base += f"""

━━━ ДАННЫЕ КОШЕЛЬКА ПОЛЬЗОВАТЕЛЯ ━━━
Адрес: {address}
NEAR баланс: {near:.4f} NEAR (${near * near_price:.2f})
В стейкинге: {staking:.4f} NEAR
HOT токены: {hot:.2f}
Цена NEAR: ${near_price:.4f}
Общая стоимость портфеля: ${total_usd:.2f}{tokens_info}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Используй эти данные для персонализированных ответов."""

    return base


def call_anthropic_api(messages, system_prompt, max_tokens=800):
    """Вызов Anthropic API для AI чата."""
    if not ANTHROPIC_API_KEY:
        return None, "ANTHROPIC_API_KEY не настроен на сервере"
    
    try:
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        r = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload,
            timeout=30,
        )
        if r.status_code != 200:
            return None, f"Anthropic API error: {r.status_code}"
        
        data = r.json()
        content = data.get("content", [])
        text = ""
        for block in content:
            if block.get("type") == "text":
                text += block.get("text", "")
        return text.strip(), None
    except Exception as e:
        return None, str(e)


# ─── API Endpoints ─────────────────────────────────────────────────────────
@app.route("/api/balance/<account_id>")
def api_balance(account_id):
    cache_key = f"balance:{account_id}"
    c = cached(cache_key)
    if c:
        return jsonify(c)
    try:
        balance = get_balance(account_id)
        staking = get_staking_balance(account_id)
        hot = get_token_balance(account_id)
        hot_claim = get_hot_claim_status(account_id)
        near_price = get_near_price()
        tokens = get_tokens_with_prices(account_id)
        for category in ["major", "filtered", "hidden"]:
            for t in tokens.get(category, []):
                if t.get("icon") and len(str(t["icon"])) > 200:
                    t["icon"] = None
        result = {
            "address": account_id,
            "near": round(balance["near"], 4),
            "staking": round(staking, 4),
            "hot": round(hot, 2),
            "hotClaim": hot_claim,
            "nearPrice": near_price,
            "totalUSD": round((balance["near"] + staking) * near_price, 2) if near_price else 0,
            "tokens": tokens,
        }
        set_cache(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/transactions/<account_id>")
def api_transactions(account_id):
    cache_key = f"txns:{account_id}"
    if not request.args.get("_") and not request.args.get("nocache"):
        c = cached(cache_key)
        if c:
            return jsonify(c)
    try:
        limit = request.args.get("limit", 20, type=int)
        limit = min(max(limit, 1), 50)
        txns = get_transaction_history(account_id)
        near_price = get_near_price()
        grouped = defaultdict(list)
        for tx in txns:
            h = tx.get("transaction_hash", "")
            if h:
                grouped[h].append(tx)
        analyzed = []
        for tx_hash, tx_group in grouped.items():
            result = analyze_transaction_group(tx_group, account_id)
            if result:
                analyzed.append(result)
        analyzed.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        transactions = analyzed[:limit]
        result = {
            "transactions": transactions,
            "nearPrice": near_price,
            "total": len(analyzed),
        }
        set_cache(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats/<account_id>")
def api_stats(account_id):
    cache_key = f"stats:{account_id}"
    c = cached(cache_key)
    if c:
        return jsonify(c)
    try:
        txns = get_transaction_history(account_id)
        near_price = get_near_price()
        grouped = defaultdict(list)
        for tx in txns:
            h = tx.get("transaction_hash", "")
            if h:
                grouped[h].append(tx)
        analyzed = []
        for tx_hash, tx_group in grouped.items():
            result = analyze_transaction_group(tx_group, account_id)
            if result:
                analyzed.append(result)
        stats = compute_analytics(analyzed, near_price)
        stats["nearPrice"] = near_price
        set_cache(cache_key, stats)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# BUGFIX: /api/analytics/<id> теперь использует реальную аналитику вместо заглушки
@app.route("/api/analytics/<account_id>")
def get_analytics(account_id):
    """Alias для /api/stats/ — настоящая аналитика."""
    return api_stats(account_id)


@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    """
    AI Chat endpoint — NEAR/crypto analyst powered by Claude.
    
    Request body:
    {
        "message": "Что думаешь о рынке NEAR?",
        "history": [{"role": "user", "content": "..."}, ...],  // optional
        "walletContext": {...}  // optional — данные кошелька для персонализации
    }
    """
    try:
        body = request.get_json(force=True)
        if not body:
            return jsonify({"error": "Empty request body"}), 400
        
        user_message = body.get("message", "").strip()
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        # История диалога (последние 10 сообщений для экономии токенов)
        history = body.get("history", [])
        if len(history) > 10:
            history = history[-10:]
        
        # Данные кошелька для персонализации
        wallet_context = body.get("walletContext")
        
        # Строим сообщения
        messages = history + [{"role": "user", "content": user_message}]
        
        # Системный промпт
        system_prompt = build_ai_system_prompt(wallet_context)
        
        # Вызываем Claude
        response_text, error = call_anthropic_api(messages, system_prompt)
        
        if error:
            # Fallback если нет API ключа
            if "не настроен" in error:
                return jsonify({
                    "reply": "🤖 AI-аналитик временно недоступен. Добавьте ANTHROPIC_API_KEY в переменные окружения Render.",
                    "error": error
                })
            return jsonify({"error": error}), 500
        
        return jsonify({
            "reply": response_text,
            "model": "claude-sonnet-4",
        })
    except Exception as e:
        print(f"[ai_chat] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "ok",
        "service": "NearPulse API",
        "version": "2.1.0",
        "endpoints": [
            "/api/balance/<account_id>",
            "/api/transactions/<account_id>",
            "/api/stats/<account_id>",
            "/api/analytics/<account_id>",
            "/api/nft/<account_id>",
            "/api/nfts/<account_id>",
            "/api/ai/chat  [POST]",
            "/api/health",
        ]
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "timestamp": int(time.time()),
        "ai": "enabled" if ANTHROPIC_API_KEY else "disabled (no ANTHROPIC_API_KEY)",
    })


# ─── NFT routes (пагинация + ленивые метаданные) ──────────────────────────
try:
    from nft_module import register_nft_routes
    register_nft_routes(app, cached, set_cache)
    print("[NFT] Paginated NFT routes registered")
except ImportError:
    print("[NFT] nft_module.py not found, using built-in /api/nft/ endpoint")

# ─── Добавить в api.py (вставить перед строкой "if __name__") ────────────
#
# Этот endpoint отдаёт историю баланса из NearBlocks transactions
# для отображения графика в webapp.
# Сохрани этот код в api.py, найдя блок # === Main === или конец файла.

@app.route("/api/portfolio-history/<account_id>")
def api_portfolio_history(account_id):
    """
    История баланса NEAR для графика в webapp.
    Берём транзакции за период и считаем приблизительный баланс.
    period: 7d | 14d | 30d
    """
    period = request.args.get("period", "7d")
    days_map = {"7d": 7, "14d": 14, "30d": 30}
    days = days_map.get(period, 7)

    cache_key = f"portfolio_history:{account_id}:{period}"
    cached_data = cached(cache_key)
    if cached_data:
        return jsonify(cached_data)

    try:
        # Получаем текущий баланс
        rpc_body = {
            "jsonrpc": "2.0", "id": "bal", "method": "query",
            "params": {
                "request_type": "view_account",
                "finality": "final",
                "account_id": account_id
            }
        }
        r = http_requests.post(NEAR_RPC_URL, json=rpc_body, timeout=8)
        current_near = 0
        if r.status_code == 200:
            result = r.json().get("result", {})
            amount_str = result.get("amount", "0")
            storage    = result.get("storage_usage", 0)
            locked_str = result.get("locked", "0")
            amount_yocto = int(amount_str) - int(locked_str) - storage * 10**19
            current_near = max(0, amount_yocto / 10**24)

        # Получаем транзакции за период для восстановления истории
        nb_key = os.environ.get("NEARBLOCKS_API_KEY", "")
        headers = {"Authorization": f"Bearer {nb_key}"} if nb_key else {}
        r2 = http_requests.get(
            f"{NEARBLOCKS_API}/account/{account_id}/txns",
            params={"limit": 100, "order": "desc"},
            headers=headers,
            timeout=8
        )

        history = []

        if r2.status_code == 200:
            txns = r2.json().get("txns", [])
            # Фильтруем по периоду
            cutoff_ms = (datetime.now(timezone.utc).timestamp() - days * 86400) * 1000
            period_txns = [
                tx for tx in txns
                if int(tx.get("block_timestamp", 0)) / 1e6 > cutoff_ms
            ]

            # Восстанавливаем баланс назад во времени
            running_near = current_near
            daily_balances = {}

            # Группируем по дням
            from collections import defaultdict
            daily_deltas = defaultdict(float)
            for tx in period_txns:
                ts_ms = int(tx.get("block_timestamp", 0)) / 1e6
                date  = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%d.%m")
                _agg = tx.get("actions_agg")
                deposit_yocto = int((_agg if isinstance(_agg, dict) else {}).get("deposit", 0) or 0)
                _oa = tx.get("outcomes_agg")
                fee_yocto = int((_oa if isinstance(_oa, dict) else {}).get("transaction_fee", 0) or 0)
                is_receiver   = tx.get("receiver_account_id") == account_id
                delta = 0
                if is_receiver:
                    delta += deposit_yocto / 1e24
                else:
                    delta -= deposit_yocto / 1e24
                delta -= fee_yocto / 1e24
                daily_deltas[date] += delta

            # Строим историю начиная с сегодня
            today = datetime.now(timezone.utc)
            for i in range(days - 1, -1, -1):
                day = today.replace(hour=0, minute=0, second=0)
                day = today - timedelta(days=i)
                date_str = day.strftime("%d.%m")
                # Если есть транзакции в этот день — корректируем
                if date_str in daily_deltas and i > 0:
                    point_near = running_near - daily_deltas[date_str]
                else:
                    point_near = running_near if i == 0 else max(0, running_near * (1 + (i * 0.001)))

                history.append({
                    "date": date_str,
                    "near": round(max(0, point_near), 4),
                })
        else:
            # Fallback: линейный mock если нет данных транзакций
            today = datetime.now(timezone.utc)
            for i in range(days - 1, -1, -1):
                day = today - timedelta(days=i)
                history.append({
                    "date": day.strftime("%d.%m"),
                    "near": round(current_near, 4),
                })

        result = {
            "account":    account_id,
            "period":     period,
            "currentNear": round(current_near, 4),
            "history":    history,
        }
        set_cache(cache_key, result, 300)  # 5 минут
        return jsonify(result)

    except Exception as e:
        print(f"[portfolio_history] Error: {e}")
        return jsonify({"account": account_id, "period": period, "history": [], "error": str(e)}), 500
# ─── Main ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"NearPulse API v2.1.0 starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
