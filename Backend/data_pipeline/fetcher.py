import ccxt
import requests
import pandas as pd


START_DATE = '2017-01-01'  # Matches research notebook training window


_BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
_KLINES_COLS    = ['timestamp', 'open', 'high', 'low', 'close', 'volume',
                   'close_time', 'quote_vol', 'trades', 'taker_buy_base',
                   'taker_buy_quote', 'ignore']


def _fetch_klines(symbol: str, interval: str, **params) -> list:
    """Single page of klines from Binance REST — no ccxt market-info overhead."""
    r = requests.get(_BINANCE_KLINES,
                     params={"symbol": symbol, "interval": interval, **params},
                     timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_latest_crypto_data(symbol='BTC/USDT', timeframe='1d', limit=250):
    """
    Fetch latest OHLCV candles from Binance REST API (no ccxt market-load).

    For inference (limit < 1000):
      - Fetches last N candles only (rolling window)
      - Default limit=250: enough for SMA200 (200 candles) + SEQUENCE_LEN (30) + buffer
      - After feature engineering drops NaN: ~200-230 valid rows -> can build 30-day sequence

    For training/retraining (limit >= 1000):
      - Paginates from START_DATE='2017-01-01' onwards (absolute, not rolling)
      - Ensures consistent training data window across retraining cycles
    """
    binance_symbol = symbol.replace('/', '')  # BTC/USDT -> BTCUSDT

    if limit >= 1000:
        # Training/retraining: paginate from START_DATE onwards
        since_ms = int(pd.Timestamp(START_DATE + 'T00:00:00Z').timestamp() * 1000)
        all_rows = []
        while True:
            batch = _fetch_klines(binance_symbol, timeframe, startTime=since_ms, limit=1000)
            if not batch:
                break
            all_rows.extend(batch)
            since_ms = batch[-1][0] + 1
        rows = all_rows
    else:
        rows = _fetch_klines(binance_symbol, timeframe, limit=limit)

    df = pd.DataFrame(rows, columns=_KLINES_COLS)
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms').dt.normalize()
    df = df.set_index('timestamp')[['open', 'high', 'low', 'close', 'volume']].astype(float)

    # Drop today's incomplete candle — it hasn't closed yet (closes at 00:00 UTC next day)
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    df = df[df.index < today]

    return df


def fetch_latest_fng() -> float:
    """Fetch today's Fear & Greed score, normalized to [-1, 1]."""
    url = "https://api.alternative.me/fng/?limit=1"
    try:
        data = requests.get(url, timeout=10).json()['data'][0]
        return (int(data['value']) / 50.0) - 1.0
    except Exception as e:
        print(f"fetch_latest_fng failed: {e}")
        return 0.0


def fetch_historical_fng(limit: int = 65) -> pd.DataFrame:
    """
    Fetch historical Fear & Greed scores as a DataFrame indexed by date.
    Returns DataFrame with column 'fng_score' normalized to [-1, 1].
    Fetch limit=65 to cover 30d rolling avg warmup over a 30-day sequence.
    """
    url = f"https://api.alternative.me/fng/?limit={limit}"
    try:
        data = requests.get(url, timeout=15).json()['data']
        records = []
        for entry in data:
            ts = pd.to_datetime(int(entry['timestamp']), unit='s').normalize()
            score = (int(entry['value']) / 50.0) - 1.0
            records.append({'date': ts, 'fng_score': score})

        df = pd.DataFrame(records).set_index('date').sort_index()
        return df
    except Exception as e:
        print(f"fetch_historical_fng failed: {e}")
        return pd.DataFrame(columns=['fng_score'])
