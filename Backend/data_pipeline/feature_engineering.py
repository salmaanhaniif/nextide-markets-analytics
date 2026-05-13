import numpy as np
import pandas as pd
import pandas_ta as ta

HALVING_DATES = [
    pd.Timestamp('2012-11-28'),
    pd.Timestamp('2016-07-09'),
    pd.Timestamp('2020-05-11'),
    pd.Timestamp('2024-04-20'),
    pd.Timestamp('2028-03-28'),  # estimated next halving (~4-year cycle)
]

TECH_FEATURES = [
    'log_return', 'high_low_ratio', 'open_close_ratio', 'body_size',
    'upper_shadow', 'lower_shadow',
    'rsi_7', 'rsi_14', 'rsi_21', 'macd', 'macd_signal', 'macd_hist',
    'stoch_k', 'stoch_d', 'willr',
    'price_to_ema21', 'price_to_ema50', 'price_to_sma200', 'ema7_ema21_ratio',
    'bb_pct_b', 'bb_width', 'atr_pct', 'volatility_7', 'volatility_30',
    'vol_ratio', 'vol_momentum',
    'days_since_last_halving', 'days_to_next_halving',
    'halving_cycle_phase', 'post_halving_180d',
    'month_sin', 'month_cos', 'dow_sin', 'dow_cos',
]

SENTIMENT_FEATURES = [
    'fng_score', 'fng_7d_avg', 'fng_30d_avg', 'fng_momentum',
    'nlp_sentiment_score',
]


def engineer_features(df: pd.DataFrame, fng_df: pd.DataFrame, nlp_score: float = 0.0) -> pd.DataFrame:
    """
    Port exact feature engineering from research notebook.
    df: OHLCV DataFrame indexed by date (needs 200+ rows for SMA200 warmup)
    fng_df: DataFrame with 'fng_score' column indexed by date
    nlp_score: live NLP sentiment score [-1, 1], 0.0 for historical/training
    """
    data = df.copy()

    # 1. PRICE-BASED
    data['log_return']       = np.log(data['close'] / data['close'].shift(1))
    data['high_low_ratio']   = data['high'] / data['low']
    data['open_close_ratio'] = data['open'] / data['close']
    data['body_size']        = abs(data['close'] - data['open']) / data['open']
    data['upper_shadow']     = (data['high'] - np.maximum(data['close'], data['open'])) / data['open']
    data['lower_shadow']     = (np.minimum(data['close'], data['open']) - data['low']) / data['open']

    # 2. MOMENTUM
    data['rsi_7']  = ta.rsi(data['close'], length=7)
    data['rsi_14'] = ta.rsi(data['close'], length=14)
    data['rsi_21'] = ta.rsi(data['close'], length=21)

    macd_result = ta.macd(data['close'], fast=12, slow=26, signal=9)
    data['macd']        = macd_result['MACD_12_26_9']
    data['macd_signal'] = macd_result['MACDs_12_26_9']
    data['macd_hist']   = macd_result['MACDh_12_26_9']

    stoch = ta.stoch(data['high'], data['low'], data['close'], k=14, d=3)
    data['stoch_k'] = stoch['STOCHk_14_3_3']
    data['stoch_d'] = stoch['STOCHd_14_3_3']

    data['willr'] = ta.willr(data['high'], data['low'], data['close'], length=14)

    # 3. TREND
    data['ema_7']   = ta.ema(data['close'], length=7)
    data['ema_21']  = ta.ema(data['close'], length=21)
    data['ema_50']  = ta.ema(data['close'], length=50)
    data['sma_200'] = ta.sma(data['close'], length=200)

    data['price_to_ema21']   = data['close'] / data['ema_21']
    data['price_to_ema50']   = data['close'] / data['ema_50']
    data['price_to_sma200']  = data['close'] / data['sma_200']
    data['ema7_ema21_ratio'] = data['ema_7'] / data['ema_21']

    # 4. VOLATILITY
    bbands = ta.bbands(data['close'], length=20, std=2)
    bb_cols      = bbands.columns.tolist()
    bb_upper_col = [c for c in bb_cols if c.startswith('BBU')][0]
    bb_lower_col = [c for c in bb_cols if c.startswith('BBL')][0]
    bb_mid_col   = [c for c in bb_cols if c.startswith('BBM')][0]
    bb_pct_col   = [c for c in bb_cols if c.startswith('BBP')][0]

    data['bb_upper'] = bbands[bb_upper_col]
    data['bb_lower'] = bbands[bb_lower_col]
    data['bb_mid']   = bbands[bb_mid_col]
    data['bb_pct_b'] = bbands[bb_pct_col]
    data['bb_width'] = (data['bb_upper'] - data['bb_lower']) / data['bb_mid']

    data['atr_14'] = ta.atr(data['high'], data['low'], data['close'], length=14)
    data['atr_pct'] = data['atr_14'] / data['close']

    data['volatility_7']  = data['log_return'].rolling(7).std()
    data['volatility_30'] = data['log_return'].rolling(30).std()

    # 5. VOLUME
    data['vol_ma_21']    = data['volume'].rolling(21).mean()
    data['vol_ratio']    = data['volume'] / data['vol_ma_21']
    data['vol_momentum'] = data['volume'] / data['volume'].shift(7) - 1

    # 6. HALVING CYCLE
    data['days_since_last_halving'] = np.nan
    data['days_to_next_halving']    = np.nan

    for idx in data.index:
        past    = [h for h in HALVING_DATES if h <= idx]
        future  = [h for h in HALVING_DATES if h > idx]
        if past:
            data.loc[idx, 'days_since_last_halving'] = (idx - max(past)).days
        if future:
            data.loc[idx, 'days_to_next_halving'] = (min(future) - idx).days

    halving_period = 4 * 365
    data['halving_cycle_phase'] = (data['days_since_last_halving'] % halving_period) / halving_period
    data['post_halving_180d'] = (
        (data['days_since_last_halving'] >= 0) &
        (data['days_since_last_halving'] <= 180)
    ).astype(int)

    # 7. CALENDAR
    data['month_sin'] = np.sin(2 * np.pi * data.index.month / 12)
    data['month_cos'] = np.cos(2 * np.pi * data.index.month / 12)
    data['dow_sin']   = np.sin(2 * np.pi * data.index.dayofweek / 7)
    data['dow_cos']   = np.cos(2 * np.pi * data.index.dayofweek / 7)

    # 8. SENTIMENT (F&G)
    data = data.join(fng_df[['fng_score']], how='left')
    fng_mean = data['fng_score'].median()
    data['fng_score'] = data['fng_score'].bfill().fillna(fng_mean)

    data['fng_7d_avg']   = data['fng_score'].rolling(7).mean()
    data['fng_30d_avg']  = data['fng_score'].rolling(30).mean()
    data['fng_momentum'] = data['fng_score'] - data['fng_7d_avg']

    # NLP score — 0.0 for historical training, real value injected at inference
    data['nlp_sentiment_score'] = float(nlp_score)

    data.dropna(inplace=True)
    return data
