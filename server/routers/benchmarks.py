"""基准指数路由：代理东方财富行情接口，拉取各宽基指数的月度收益率。

基准行情属于公开数据，本路由不要求登录，仅做后端代理以规避浏览器跨域限制。
月度收益率 = 当月收盘 / 上月收盘 - 1；只回填「已收盘的已过去月份」，当前进行中的月份不填。
"""
import json
import time
import urllib.request
from urllib.error import URLError

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["benchmarks"])

# 指数 secid 映射（东方财富：1=上交所 0=深交所 100=美股）
BENCH_SECIDS = {
    "csi300": "1.000300",   # 沪深300
    "csi500": "1.000905",   # 中证500
    "gem": "0.399006",      # 创业板指
    "bond": "1.000012",     # 中证全债
    "nasdaq": "100.NDX",    # 纳斯达克100（综合指数接口不稳，用100替代）
}

_CACHE: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 3600

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _fetch_klines(secid: str) -> list[tuple[str, float]]:
    """抓取某指数月K线，返回 [(yyyy-MM, 收盘), ...]，按时间升序。"""
    url = (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        f"?secid={secid}&fields1=f1,f2,f3&fields2=f51,f53"
        "&klt=103&fqt=0&beg=0&end=20500101&lmt=24"
    )
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    last_err: Exception | None = None
    # 轻量重试：公网免费接口偶发频率限制(429)或网络抖动
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            break
        except (URLError, json.JSONDecodeError) as e:
            last_err = e
            time.sleep(1)
    else:
        raise RuntimeError(f"无法获取行情: {last_err}")

    kl = (data.get("data") or {}).get("klines") or []
    out: list[tuple[str, float]] = []
    for row in kl:
        parts = row.split(",")
        if len(parts) < 2:
            continue
        try:
            out.append((parts[0], float(parts[1])))
        except ValueError:
            continue
    return out


def _monthly_rates(klines: list[tuple[str, float]]) -> dict[str, float]:
    """由月线计算「完整月」的月度收益率（%）。

    月线最后一条通常是当前进行中的月份（未收盘），予以丢弃；
    只保留前面真正收盘的完整月，避免填入不准确的当月盘中值。
    """
    rates: dict[str, float] = {}
    for i in range(1, len(klines) - 1):
        ym, close = klines[i]
        prev_close = klines[i - 1][1]
        if prev_close > 0:
            rates[ym] = round((close / prev_close - 1) * 100, 2)
    return rates


@router.get("/benchmarks/sync")
def sync_benchmarks():
    """拉取全部预设基准指数最近完整月的月度收益率。

    返回：{ updated: "YYYY-MM-DD", data: { csi300: {"2026-01": -1.43, ...}, ... } }
    data[key] 里只含到上月为止的完整月，当前月与未来月不在其中（留给用户手动填）。
    """
    cached = _CACHE.get("all")
    if cached and time.time() - cached[1] < _CACHE_TTL:
        return cached[0]

    data: dict[str, dict[str, float]] = {}
    for key, secid in BENCH_SECIDS.items():
        try:
            kl = _fetch_klines(secid)
            data[key] = _monthly_rates(kl)
        except Exception:
            # 单个指数失败不影响其他指数，返回空映射
            data[key] = {}

    result = {"updated": time.strftime("%Y-%m-%d"), "data": data}
    _CACHE["all"] = (result, time.time())
    return result
