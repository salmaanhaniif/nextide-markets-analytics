import ccxt
import requests
import pandas as pd


START_DATE = '2017-01-01'  # Matches research notebook training window


def fetch_latest_crypto_data(symbol='BTC/USDT', timeframe='1d', limit=250):
    """
    Fetch latest OHLCV candles from Binance.

    For inference (limit < 1000):
      - Fetches last N candles only (rolling window)
      - Default limit=250: enough for SMA200 (200 candles) + SEQUENCE_LEN (30) + buffer
      - After feature engineering drops NaN: ~200-230 valid rows -> can build 30-day sequence

    For training/retraining (limit >= 1000):
      - Fetches from START_DATE='2017-01-01' onwards (absolute, not rolling)
      - Ensures consistent training data window across retraining cycles
    """
    exchange = ccxt.binanceus()

    if limit >= 1000:
        # Training/retraining: fetch from START_DATE onwards
        since_ms = exchange.parse8601(START_DATE + 'T00:00:00Z')
        all_ohlcv = []
        while True:
            batch = exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since_ms, limit=1000)
            if not batch:
                break
            all_ohlcv.extend(batch)
            since_ms = batch[-1][0] + 1
        ohlcv = all_ohlcv
    else:
        # Inference: just get latest N candles
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)

    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms').dt.normalize()
    df.set_index('timestamp', inplace=True)

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
