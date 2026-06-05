"""
Alternative crypto data fetchers for when Binance is blocked.
Supports: Yahoo Finance, CoinGecko, Kraken, Coinbase
"""
import requests
import pandas as pd
from datetime import datetime, timedelta

START_DATE = '2017-01-01'

# ============================================================================
# 1. COINGECKO (Free, no API key needed, good uptime)
# ============================================================================

def fetch_latest_crypto_data_coingecko(symbol='bitcoin', vs_currency='usd', days=250):
    """
    Fetch OHLCV from CoinGecko (free tier: 10-50 calls/min).
    Returns same format as original Binance fetcher.
    
    Args:
        symbol: coin id (e.g., 'bitcoin', 'ethereum')
        vs_currency: quote currency (default 'usd')
        days: number of days to fetch (max 365 on free tier)
    """
    url = f"https://api.coingecko.com/api/v3/coins/{symbol}/ohlc"
    params = {
        "vs_currency": vs_currency,
        "days": min(days, 365),  # Free tier limit
    }
    
    print(f"  Fetching from CoinGecko...")
    res = requests.get(url, params=params, timeout=15)
    res.raise_for_status()
    
    data = res.json()
    
    # CoinGecko returns: [[timestamp_ms, open, high, low, close], ...]
    # No volume in OHLC endpoint, need separate call
    df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms').dt.normalize()
    df = df.set_index('timestamp')
    
    # Fetch volume separately
    volume_url = f"https://api.coingecko.com/api/v3/coins/{symbol}/market_chart"
    volume_params = {"vs_currency": vs_currency, "days": min(days, 365)}
    vol_res = requests.get(volume_url, params=volume_params, timeout=15)
    vol_res.raise_for_status()
    vol_data = vol_res.json()['total_volumes']
    
    df_vol = pd.DataFrame(vol_data, columns=['timestamp', 'volume'])
    df_vol['timestamp'] = pd.to_datetime(df_vol['timestamp'], unit='ms').dt.normalize()
    df_vol = df_vol.set_index('timestamp')
    
    # Merge
    df = df.join(df_vol, how='left')
    df['volume'] = df['volume'].fillna(0)
    
    # Drop today's incomplete candle
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    df = df[df.index < today]
    
    return df[['open', 'high', 'low', 'close', 'volume']].astype(float)


# ============================================================================
# 2. KRAKEN (Reliable, no API key for public data)
# ============================================================================

def fetch_latest_crypto_data_kraken(pair='XBTUSD', interval=1440, limit=250):
    """
    Fetch OHLCV from Kraken (no rate limit on public endpoints).
    
    Args:
        pair: trading pair (e.g., 'XBTUSD' for BTC/USD, 'XXBTZUSD' also works)
        interval: candle interval in minutes (1440 = 1 day)
        limit: number of candles (max 720)
    """
    url = "https://api.kraken.com/0/public/OHLC"
    params = {
        "pair": pair,
        "interval": interval,  # 1440 minutes = 1 day
    }
    
    print(f"  Fetching from Kraken...")
    res = requests.get(url, params=params, timeout=15)
    res.raise_for_status()
    
    data = res.json()
    
    if data.get('error'):
        raise Exception(f"Kraken API error: {data['error']}")
    
    # Kraken returns: {pair_name: [[time, open, high, low, close, vwap, volume, count], ...]}
    pair_key = list(data['result'].keys())[0]  # Get actual pair name from response
    ohlcv = data['result'][pair_key]
    
    df = pd.DataFrame(ohlcv, columns=[
        'timestamp', 'open', 'high', 'low', 'close', 'vwap', 'volume', 'count'
    ])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s').dt.normalize()
    df = df.set_index('timestamp')
    df = df[['open', 'high', 'low', 'close', 'volume']].astype(float)
    
    # Get last N candles
    df = df.tail(limit)
    
    # Drop today's incomplete candle
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    df = df[df.index < today]
    
    return df


# ============================================================================
# 3. COINBASE (Reliable, no API key for public market data)
# ============================================================================

def fetch_latest_crypto_data_coinbase(product_id='BTC-USD', granularity=86400, limit=250):
    """
    Fetch OHLCV from Coinbase Pro/Advanced API (free, no auth for public data).
    
    Args:
        product_id: trading pair (e.g., 'BTC-USD', 'ETH-USD')
        granularity: candle size in seconds (86400 = 1 day)
        limit: number of candles (max 300)
    """
    url = f"https://api.exchange.coinbase.com/products/{product_id}/candles"
    
    # Coinbase needs explicit time range (max 300 candles per request)
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=limit)
    
    params = {
        "granularity": granularity,
        "start": start_time.isoformat(),
        "end": end_time.isoformat(),
    }
    
    print(f"  Fetching from Coinbase...")
    res = requests.get(url, params=params, timeout=15)
    res.raise_for_status()
    
    data = res.json()
    
    # Coinbase returns: [[time, low, high, open, close, volume], ...] (reverse order!)
    df = pd.DataFrame(data, columns=['timestamp', 'low', 'high', 'open', 'close', 'volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s').dt.normalize()
    df = df.set_index('timestamp').sort_index()  # Sort ascending
    df = df[['open', 'high', 'low', 'close', 'volume']].astype(float)
    
    # Drop today's incomplete candle
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    df = df[df.index < today]
    
    return df


# ============================================================================
# 4. YAHOO FINANCE (via yfinance — works even when exchange APIs are blocked)
# ============================================================================

def fetch_latest_crypto_data_yfinance(ticker='BTC-USD', limit=250):
    """
    Fetch OHLCV from Yahoo Finance via yfinance.
    Reliable fallback when exchange APIs are geo-blocked.
    """
    import yfinance as yf

    print(f"  Fetching from Yahoo Finance ({ticker})...")
    df = yf.download(ticker, period=f"{limit + 5}d", interval='1d',
                     progress=False, auto_adjust=True)
    if df.empty:
        raise Exception("yfinance returned empty DataFrame")

    # Flatten MultiIndex columns if present (yfinance >= 0.2 quirk)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df[['Open', 'High', 'Low', 'Close', 'Volume']].rename(columns=str.lower)

    # Strip timezone and drop today's (potentially incomplete) candle
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    today = pd.Timestamp.utcnow().normalize().tz_localize(None)
    df = df[df.index < today]

    return df.tail(limit)


# ============================================================================
# UNIFIED INTERFACE (Auto-fallback)
# ============================================================================

def fetch_latest_crypto_data(limit=250, preferred_source='yfinance'):
    """
    Unified fetcher with automatic fallback between sources.
    Order: Yahoo Finance -> Kraken -> Coinbase -> CoinGecko
    """
    sources = {
        'yfinance':  lambda: fetch_latest_crypto_data_yfinance(ticker='BTC-USD', limit=limit),
        'kraken':    lambda: fetch_latest_crypto_data_kraken(pair='XBTUSD', limit=min(limit, 720)),
        'coinbase':  lambda: fetch_latest_crypto_data_coinbase(product_id='BTC-USD', limit=min(limit, 300)),
        'coingecko': lambda: fetch_latest_crypto_data_coingecko(symbol='bitcoin', days=min(limit, 365)),
    }

    order = [preferred_source] + [s for s in sources if s != preferred_source]

    for source in order:
        try:
            print(f"  Trying {source.upper()}...")
            df = sources[source]()
            if df is None or df.empty:
                raise Exception("empty result")
            print(f"  {source.upper()} OK: {len(df)} candles")
            return df
        except Exception as e:
            print(f"  {source.upper()} failed: {e}")
            continue

    raise Exception("All data sources failed!")


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

if __name__ == "__main__":
    print("\n=== Testing Kraken ===")
    df_kraken = fetch_latest_crypto_data_kraken(limit=10)
    print(df_kraken.tail())
    
    print("\n=== Testing Coinbase ===")
    df_coinbase = fetch_latest_crypto_data_coinbase(limit=10)
    print(df_coinbase.tail())
    
    print("\n=== Testing CoinGecko ===")
    df_coingecko = fetch_latest_crypto_data_coingecko(days=10)
    print(df_coingecko.tail())
    
    print("\n=== Testing Unified (with fallback) ===")
    df_unified = fetch_latest_crypto_data(limit=10, preferred_source='kraken')
    print(df_unified.tail())
