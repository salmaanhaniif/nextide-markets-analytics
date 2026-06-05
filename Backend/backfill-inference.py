"""
Backfill inference for missing dates.
Fetches historical OHLCV data and generates predictions for specified dates.

"""
import json
import math
import sys
import joblib
import importlib.util
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent / "data_pipeline" / ".env")

from data_pipeline.feature_engineering import engineer_features
from data_pipeline.preprocessor import prepare_inference_input, prepare_lstm_inference_input
from data_pipeline.sentiment_analysis import get_live_nlp_sentiment
from data_pipeline.fetcher import fetch_historical_fng

# Import daily_inference dynamically (file has hyphen in name)
spec = importlib.util.spec_from_file_location("daily_inference", Path(__file__).parent / "daily-inference.py")
daily_inference = importlib.util.module_from_spec(spec)
sys.modules["daily_inference"] = daily_inference
spec.loader.exec_module(daily_inference)

from daily_inference import (
    _load_artifact, _confidence_score, _generate_signal, _extract_key_drivers,
    _check_model_health, _build_result, _load_history, _save_history,
    _fng_label, HISTORY_FILE, HISTORY_LSTM_FILE, LATEST_FILE, LATEST_LSTM_FILE,
    MODELS_PATH, DATA_PATH, LSTM_KEY_DRIVERS
)

BASE_PATH = Path(__file__).resolve().parent
MODELS_PATH = BASE_PATH / "models"
DATA_PATH = BASE_PATH / "data"

def fetch_historical_ohlcv(date_str: str = None, limit: int = 250) -> pd.DataFrame:
    """Fetch historical OHLCV via Yahoo Finance up to and including date_str."""
    end_date = (datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    start_date = (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=limit + 10)).strftime("%Y-%m-%d")
    df = yf.download("BTC-USD", start=start_date, end=end_date, interval="1d",
                     progress=False, auto_adjust=True)
    if df.empty:
        print(f"  [!] No data for {date_str}")
        return pd.DataFrame()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["Open", "High", "Low", "Close", "Volume"]].rename(columns=str.lower)
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df.index = df.index.normalize()
    return df.tail(limit)


def backfill_date(date_str: str):
    """Generate predictions for a specific date."""
    print(f"\n{'='*60}\nBackfilling predictions for {date_str}\n{'='*60}")

    try:
        # Fetch historical data
        print(f"[1/5] Fetching historical OHLCV for {date_str}...")
        df_ohlcv = fetch_historical_ohlcv(date_str=date_str)
        if df_ohlcv.empty:
            print(f"  [E] No data available for {date_str}")
            return False

        # Get last 250 candles for proper feature engineering
        print(f"[2/5] Fetching FNG data...")
        fng_df = fetch_historical_fng(limit=65)

        # Get NLP sentiment (skip live API for backfill, use history fallback)
        print(f"[3/5] Getting NLP sentiment (using fallback for backfill)...")
        from data_pipeline.sentiment_analysis import _fallback_from_history
        nlp_score, nlp_status = _fallback_from_history()
        if nlp_status == "unavailable":
            nlp_score = 0.0  # Neutral default if no history

        # Feature engineering
        print(f"[4/5] Engineering features...")
        processed_df = engineer_features(df_ohlcv, fng_df, nlp_score=nlp_score)

        if processed_df.empty or len(processed_df) == 0:
            print(f"  [!] Processed dataframe is empty")
            return False

        current_close = float(processed_df['close'].iloc[-1])
        volatility_30 = float(processed_df['volatility_30'].iloc[-1])
        fng_today = float(processed_df['fng_score'].iloc[-1])
        data_as_of = date_str  # Use the backfill date

        with open(MODELS_PATH / "model_metadata.json") as mf:
            meta = json.load(mf)

        model_health = _check_model_health()

        common_kwargs = dict(
            current_close=current_close, volatility_30=volatility_30,
            fng_today=fng_today, nlp_score=nlp_score, nlp_status=nlp_status,
            data_as_of=data_as_of, meta=meta,
        )

        HORIZONS = [("target_y1", 1, "y1"), ("target_y7", 7, "y7"), ("target_y30", 30, "y30")]
        n_pca = meta["config"]["n_pca_components"]
        n_sent = len(meta["features"]["sentiment_features"])

        # XGBoost inference
        print(f"[5a/5] Running XGBoost inference...")
        xgb_input = prepare_inference_input(processed_df, seq_len=30)
        xgb_preds = {}
        xgb_model_y1 = None
        for target, horizon_days, label in HORIZONS:
            model = _load_artifact(f"xgb_model_{target}.pkl")
            t_scaler = _load_artifact(f"target_scaler_{target}.pkl")
            pred_log_return = float(t_scaler.inverse_transform(model.predict(xgb_input).reshape(-1, 1))[0][0])
            pred_price = current_close * math.exp(pred_log_return)
            direction = "UP" if pred_log_return > 0 else "DOWN"
            sigma_horizon = volatility_30 * math.sqrt(horizon_days)
            confidence = _confidence_score(pred_log_return, volatility_30)
            target_date = (datetime.strptime(data_as_of, "%Y-%m-%d") + timedelta(days=horizon_days)).strftime("%Y-%m-%d")
            xgb_preds[label] = {
                "target_date": target_date,
                "predicted_log_return": round(pred_log_return, 6),
                "predicted_price": round(pred_price, 2),
                "price_change_pct": round(pred_log_return * 100, 4),
                "direction": direction,
                "confidence": confidence,
                "range_low": round(current_close * math.exp(pred_log_return - sigma_horizon), 2),
                "range_high": round(current_close * math.exp(pred_log_return + sigma_horizon), 2),
            }
            if label == "y1":
                xgb_model_y1 = model

        xgb_signal = _generate_signal(xgb_preds["y1"]["predicted_log_return"], xgb_preds["y1"]["confidence"], fng_today, nlp_score)
        xgb_drivers = _extract_key_drivers(xgb_model_y1, n_pca, n_sent)
        xgb_result = _build_result("xgboost", xgb_preds, xgb_signal, xgb_drivers,
                                   current_close, fng_today, nlp_score, nlp_status,
                                   data_as_of, meta, model_health)
        xgb_history = _load_history(HISTORY_FILE)
        _save_history(xgb_history, {**xgb_result, "actual_direction_y1": None, "actual_price_y1": None}, HISTORY_FILE)
        print(f"  XGBoost y1: {xgb_preds['y1']['price_change_pct']:+.2f}% -> ${xgb_preds['y1']['predicted_price']:,.2f}")

        # LSTM inference
        print(f"[5b/5] Running LSTM inference...")
        try:
            # Lazy import TensorFlow to avoid slow startup
            import tensorflow as tf
            # Suppress TF warnings
            tf.compat.v1.logging.set_verbosity(tf.compat.v1.logging.ERROR)
            from tensorflow.keras.models import load_model as keras_load_model
            
            lstm_input = prepare_lstm_inference_input(processed_df, seq_len=30)
            # LSTM was trained with the shared target_scaler.pkl (not the per-target scalers)
            lstm_t_scaler = _load_artifact("target_scaler.pkl")
            lstm_preds = {}
            for target, horizon_days, label in HORIZONS:
                model = keras_load_model(str(MODELS_PATH / f"lstm_{target}.keras"), compile=False)
                t_scaler = lstm_t_scaler
                pred_scaled = model.predict(lstm_input, verbose=0)
                pred_log_return = float(t_scaler.inverse_transform(pred_scaled.reshape(-1, 1))[0][0])
                pred_price = current_close * math.exp(pred_log_return)
                direction = "UP" if pred_log_return > 0 else "DOWN"
                sigma_horizon = volatility_30 * math.sqrt(horizon_days)
                confidence = _confidence_score(pred_log_return, volatility_30)
                target_date = (datetime.strptime(data_as_of, "%Y-%m-%d") + timedelta(days=horizon_days)).strftime("%Y-%m-%d")
                lstm_preds[label] = {
                    "target_date": target_date,
                    "predicted_log_return": round(pred_log_return, 6),
                    "predicted_price": round(pred_price, 2),
                    "price_change_pct": round(pred_log_return * 100, 4),
                    "direction": direction,
                    "confidence": confidence,
                    "range_low": round(current_close * math.exp(pred_log_return - sigma_horizon), 2),
                    "range_high": round(current_close * math.exp(pred_log_return + sigma_horizon), 2),
                }
            lstm_signal = _generate_signal(lstm_preds["y1"]["predicted_log_return"], lstm_preds["y1"]["confidence"], fng_today, nlp_score)
            lstm_result = _build_result("lstm", lstm_preds, lstm_signal, LSTM_KEY_DRIVERS,
                                        current_close, fng_today, nlp_score, nlp_status,
                                        data_as_of, meta, model_health)
            lstm_history = _load_history(HISTORY_LSTM_FILE)
            _save_history(lstm_history, {**lstm_result, "actual_direction_y1": None, "actual_price_y1": None}, HISTORY_LSTM_FILE)
            print(f"  LSTM y1: {lstm_preds['y1']['price_change_pct']:+.2f}% -> ${lstm_preds['y1']['predicted_price']:,.2f}")
        except Exception as e:
            print(f"  [LSTM] Skipped: {e}")

        print(f"  [OK] Backfill complete for {date_str}")
        return True

    except Exception as e:
        print(f"  [E] Backfill failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python backfill-inference.py <start_date> [end_date]")
        print("Example: python backfill-inference.py 2026-05-15")
        print("Example: python backfill-inference.py 2026-05-15 2026-05-20")
        sys.exit(1)

    start_date_str = sys.argv[1]
    end_date_str = sys.argv[2] if len(sys.argv) > 2 else start_date_str

    # Parse dates
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
    except ValueError:
        print(" Invalid date format. Use YYYY-MM-DD")
        sys.exit(1)

    # Backfill range
    current = start_date
    success_count = 0
    while current <= end_date:
        if backfill_date(current.strftime("%Y-%m-%d")):
            success_count += 1
        current += timedelta(days=1)

    print(f"\n{'='*60}\nBackfill complete: {success_count}/{(end_date - start_date).days + 1} days succeeded\n{'='*60}")
