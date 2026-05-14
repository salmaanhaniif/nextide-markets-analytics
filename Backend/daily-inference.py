"""
Daily inference pipeline — runs at 00:05 UTC via GitHub Actions cron.
Produces latest_prediction.json (XGBoost) and latest_prediction_lstm.json (LSTM).
Both files are consumed by FastAPI main.py via the ?model= query param.
"""
import json
import math
import joblib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent / "data_pipeline" / ".env")

from data_pipeline.fetcher import fetch_latest_crypto_data, fetch_historical_fng
from data_pipeline.feature_engineering import engineer_features
from data_pipeline.preprocessor import prepare_inference_input, prepare_lstm_inference_input
from data_pipeline.sentiment_analysis import get_live_nlp_sentiment

BASE_PATH   = Path(__file__).resolve().parent
MODELS_PATH = BASE_PATH / "models"
DATA_PATH   = BASE_PATH / "data"
DATA_PATH.mkdir(exist_ok=True)

HISTORY_FILE      = DATA_PATH / "prediction_history.json"
HISTORY_LSTM_FILE = DATA_PATH / "prediction_history_lstm.json"
LATEST_FILE       = BASE_PATH / "latest_prediction.json"
LATEST_LSTM_FILE  = BASE_PATH / "latest_prediction_lstm.json"

MIN_CONFIDENCE_Y1 = 0.60
SIGNAL_THRESHOLD  = 0.008

DRIFT_WINDOW = 14
DRIFT_WATCH  = 0.50
DRIFT_ALERT  = 0.48

FNG_LABELS = {
    (-1.0, -0.6): "Extreme Fear",
    (-0.6, -0.2): "Fear",
    (-0.2,  0.2): "Neutral",
    ( 0.2,  0.6): "Greed",
    ( 0.6,  1.01): "Extreme Greed",
}

# Static feature importance proxy for LSTM (no feature_importances_ available)
LSTM_KEY_DRIVERS = [
    {"feature": "technical_sequence", "importance": 0.620, "label": "Technical Sequence (Conv-LSTM)"},
    {"feature": "fng_score",          "importance": 0.148, "label": "Fear & Greed Score"},
    {"feature": "nlp_sentiment_score","importance": 0.112, "label": "News Sentiment (NLP)"},
    {"feature": "fng_7d_avg",         "importance": 0.074, "label": "Sentiment 7-Day Avg"},
    {"feature": "fng_momentum",       "importance": 0.046, "label": "Sentiment Momentum"},
]


def _fng_label(score: float) -> str:
    for (lo, hi), label in FNG_LABELS.items():
        if lo <= score < hi:
            return label
    return "Unknown"


def _load_artifact(name: str):
    return joblib.load(MODELS_PATH / name)


def _confidence_score(pred_log_return: float, volatility_30: float) -> float:
    if volatility_30 <= 0:
        return 0.5
    z = abs(pred_log_return) / volatility_30
    return round(min(0.90, 0.50 + z * 0.15), 4)


def _generate_signal(pred_log_return: float, confidence: float,
                     fng_score: float, nlp_score: float) -> dict:
    if confidence < MIN_CONFIDENCE_Y1:
        return {
            "action": "HOLD",
            "strength": "LOW_CONFIDENCE",
            "reasoning": f"Model confidence {confidence:.0%} below threshold — waiting for clearer signal",
        }
    sentiment_avg = (fng_score + nlp_score) / 2.0
    pct = pred_log_return * 100
    if pred_log_return > SIGNAL_THRESHOLD and sentiment_avg > 0.1:
        return {"action": "STRONG_BUY",  "strength": "STRONG",
                "reasoning": f"Model predicts +{pct:.1f}% with bullish sentiment"}
    elif pred_log_return > SIGNAL_THRESHOLD:
        return {"action": "BUY",         "strength": "MODERATE",
                "reasoning": f"Model predicts +{pct:.1f}%"}
    elif pred_log_return < -SIGNAL_THRESHOLD and sentiment_avg < -0.1:
        return {"action": "STRONG_SELL", "strength": "STRONG",
                "reasoning": f"Model predicts {pct:.1f}% with bearish sentiment"}
    elif pred_log_return < -SIGNAL_THRESHOLD:
        return {"action": "SELL",        "strength": "MODERATE",
                "reasoning": f"Model predicts {pct:.1f}%"}
    else:
        return {"action": "HOLD",        "strength": "MODERATE",
                "reasoning": f"Predicted move {pct:.1f}% within noise range"}


def _extract_key_drivers(model, n_pca: int, n_sent: int, seq_len: int = 30) -> list:
    importance = model.feature_importances_
    n_model    = len(importance)

    sentiment_labels = {
        "fng_score": "Fear & Greed Score",
        "fng_7d_avg": "Sentiment 7-Day Avg",
        "fng_30d_avg": "Sentiment 30-Day Avg",
        "fng_momentum": "Sentiment Momentum",
        "nlp_sentiment_score": "News Sentiment (NLP)",
    }
    pc_names   = [f"PC_{i}" for i in range(n_pca)]
    sent_names = list(sentiment_labels.keys())[:n_sent]
    base_names = pc_names + sent_names
    feat_names = (base_names if n_model == len(base_names)
                  else [f"{f}_t{t}" for t in range(seq_len) for f in base_names])[:n_model]

    agg: dict = {}
    for name, imp in zip(feat_names, importance):
        base = name.split("_t")[0] if "_t" in name else name
        agg[base] = agg.get(base, 0.0) + float(imp)

    drivers  = []
    pc_total = 0.0
    for k, v in sorted(agg.items(), key=lambda x: -x[1]):
        if k.startswith("PC_"):
            pc_total += v
        else:
            label = sentiment_labels.get(k, k.replace("_", " ").title())
            drivers.append({"feature": k, "importance": round(v, 5), "label": label})

    drivers.insert(0, {"feature": "pca_components", "importance": round(pc_total, 5),
                        "label": "Technical Pattern (PCA)"})
    return sorted(drivers, key=lambda x: -x["importance"])[:5]


def _check_model_health(history_file: Path = HISTORY_FILE) -> dict:
    if not history_file.exists():
        return {"rolling_da_14d": None, "status": "unknown"}
    with open(history_file) as f:
        history = json.load(f)
    recent = [e for e in history if e.get("actual_direction_y1") is not None][-DRIFT_WINDOW:]
    if len(recent) < DRIFT_WINDOW:
        return {"rolling_da_14d": None, "status": "insufficient_data"}
    correct    = sum(1 for e in recent
                     if e["predictions"]["y1"]["direction"] == e["actual_direction_y1"])
    rolling_da = correct / len(recent)
    status     = "alert" if rolling_da < DRIFT_ALERT else "watch" if rolling_da < DRIFT_WATCH else "good"
    return {"rolling_da_14d": round(rolling_da, 4), "status": status}


def _load_history(path: Path = HISTORY_FILE) -> list:
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return []


def _save_history(history: list, new_entry: dict, path: Path = HISTORY_FILE) -> None:
    new_date = new_entry["meta"]["data_as_of"]
    # Drop any existing entries for the same date (idempotent re-runs)
    history = [e for e in history if e["meta"]["data_as_of"] != new_date]
    history.append(new_entry)
    history = history[-365:]
    with open(path, "w") as f:
        json.dump(history, f, indent=2)


def _resolve_unresolved(history: list, df_ohlcv) -> int:
    """Back-fill actual_direction_y1 / actual_price_y1 for entries whose target_date
    has fully closed (strictly before today UTC) and whose candle is in df_ohlcv."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    close_by_date = {
        ts.strftime("%Y-%m-%d"): float(close)
        for ts, close in zip(df_ohlcv.index, df_ohlcv["close"])
    }
    resolved = 0
    for entry in history:
        if entry.get("actual_direction_y1") is not None:
            continue
        target_date = entry["predictions"]["y1"]["target_date"]
        if target_date >= today_str:  # candle still open or in the future
            continue
        if target_date not in close_by_date:
            continue
        actual_close = close_by_date[target_date]
        entry_price  = entry["current"]["price"]
        entry["actual_direction_y1"] = "UP" if actual_close > entry_price else "DOWN"
        entry["actual_price_y1"]     = round(actual_close, 2)
        resolved += 1
    return resolved


# ── XGBoost inference ─────────────────────────────────────────────────────────

def _run_xgboost(processed_df, current_close, volatility_30,
                 fng_today, nlp_score, nlp_status, data_as_of, meta):
    print("[4a/5] Running XGBoost inference (y1 / y7 / y30)...")
    xgb_input  = prepare_inference_input(processed_df, seq_len=30)  # (1, 480)
    predictions = {}

    for target, horizon_days, label in [
        ("target_y1",  1,  "y1"),
        ("target_y7",  7,  "y7"),
        ("target_y30", 30, "y30"),
    ]:
        model    = _load_artifact(f"xgb_model_{target}.pkl")
        t_scaler = _load_artifact(f"target_scaler_{target}.pkl")

        pred_log_return = float(
            t_scaler.inverse_transform(model.predict(xgb_input).reshape(-1, 1))[0][0])
        pred_price    = current_close * math.exp(pred_log_return)
        direction     = "UP" if pred_log_return > 0 else "DOWN"
        sigma_horizon = volatility_30 * math.sqrt(horizon_days)
        confidence    = _confidence_score(pred_log_return, volatility_30)
        target_date   = (datetime.now(timezone.utc) + timedelta(days=horizon_days)).strftime("%Y-%m-%d")

        predictions[label] = {
            "target_date":          target_date,
            "predicted_log_return": round(pred_log_return, 6),
            "predicted_price":      round(pred_price, 2),
            "price_change_pct":     round(pred_log_return * 100, 4),
            "direction":            direction,
            "confidence":           confidence,
            "range_low":            round(current_close * math.exp(pred_log_return - sigma_horizon), 2),
            "range_high":           round(current_close * math.exp(pred_log_return + sigma_horizon), 2),
        }

    y1_return = predictions["y1"]["predicted_log_return"]
    y1_conf   = predictions["y1"]["confidence"]
    signal    = _generate_signal(y1_return, y1_conf, fng_today, nlp_score)

    y1_model    = _load_artifact("xgb_model_target_y1.pkl")
    n_pca       = meta["config"]["n_pca_components"]
    n_sent      = len(meta["features"]["sentiment_features"])
    key_drivers = _extract_key_drivers(y1_model, n_pca, n_sent)

    return predictions, signal, key_drivers


# ── LSTM inference ─────────────────────────────────────────────────────────────

def _run_lstm(processed_df, current_close, volatility_30,
              fng_today, nlp_score, nlp_status, data_as_of, meta):
    print("[4b/5] Running LSTM inference (y1 / y7 / y30)...")
    try:
        from tensorflow.keras.models import load_model  # type: ignore
    except ImportError:
        raise RuntimeError("TensorFlow is not installed — cannot run LSTM inference.")

    lstm_input  = prepare_lstm_inference_input(processed_df, seq_len=30)  # (1, 30, 16)
    predictions = {}

    for target, horizon_days, label in [
        ("target_y1",  1,  "y1"),
        ("target_y7",  7,  "y7"),
        ("target_y30", 30, "y30"),
    ]:
        model    = load_model(str(MODELS_PATH / f"lstm_{target}.keras"), compile=False)
        t_scaler = _load_artifact(f"target_scaler_{target}.pkl")

        pred_scaled     = model.predict(lstm_input, verbose=0)
        pred_log_return = float(t_scaler.inverse_transform(pred_scaled.reshape(-1, 1))[0][0])
        pred_price    = current_close * math.exp(pred_log_return)
        direction     = "UP" if pred_log_return > 0 else "DOWN"
        sigma_horizon = volatility_30 * math.sqrt(horizon_days)
        confidence    = _confidence_score(pred_log_return, volatility_30)
        target_date   = (datetime.now(timezone.utc) + timedelta(days=horizon_days)).strftime("%Y-%m-%d")

        predictions[label] = {
            "target_date":          target_date,
            "predicted_log_return": round(pred_log_return, 6),
            "predicted_price":      round(pred_price, 2),
            "price_change_pct":     round(pred_log_return * 100, 4),
            "direction":            direction,
            "confidence":           confidence,
            "range_low":            round(current_close * math.exp(pred_log_return - sigma_horizon), 2),
            "range_high":           round(current_close * math.exp(pred_log_return + sigma_horizon), 2),
        }

    y1_return = predictions["y1"]["predicted_log_return"]
    y1_conf   = predictions["y1"]["confidence"]
    signal    = _generate_signal(y1_return, y1_conf, fng_today, nlp_score)

    return predictions, signal, LSTM_KEY_DRIVERS


# ── Assemble result payload ────────────────────────────────────────────────────

def _build_result(model_id: str, predictions, signal, key_drivers,
                  current_close, fng_today, nlp_score, nlp_status,
                  data_as_of, meta, model_health):
    now_utc = datetime.now(timezone.utc)
    return {
        "meta": {
            "generated_at":  now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "model_version": meta.get("created_at", "unknown")[:10],
            "model_id":      model_id,
            "data_as_of":    data_as_of,
        },
        "current": {
            "price":         current_close,
            "fng_score":     round(fng_today, 4),
            "fng_label":     _fng_label(fng_today),
            "nlp_sentiment": round(nlp_score, 4),
            "nlp_status":    nlp_status,
        },
        "predictions":  predictions,
        "signal":       signal,
        "key_drivers":  key_drivers,
        "model_health": model_health,
    }


# ── Main entry point ──────────────────────────────────────────────────────────

def run_daily_inference():
    print("=" * 60)
    print("NexTide Analytics — Daily Inference Pipeline")
    print(f"UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── 1. Ingest ──────────────────────────────────────────────────────────────
    print("\n[1/5] Fetching market data...")
    df_ohlcv = fetch_latest_crypto_data(limit=250)
    fng_df   = fetch_historical_fng(limit=65)

    print("[2/5] Fetching NLP sentiment...")
    nlp_score, nlp_status = get_live_nlp_sentiment()

    # ── 2. Feature Engineering ────────────────────────────────────────────────
    print("[3/5] Engineering features...")
    processed_df = engineer_features(df_ohlcv, fng_df, nlp_score=nlp_score)

    current_close = float(processed_df['close'].iloc[-1])
    volatility_30 = float(processed_df['volatility_30'].iloc[-1])
    fng_today     = float(processed_df['fng_score'].iloc[-1])
    data_as_of    = processed_df.index[-1].strftime("%Y-%m-%d")

    with open(MODELS_PATH / "model_metadata.json") as mf:
        meta = json.load(mf)

    model_health = _check_model_health()

    common_kwargs = dict(
        current_close=current_close, volatility_30=volatility_30,
        fng_today=fng_today, nlp_score=nlp_score, nlp_status=nlp_status,
        data_as_of=data_as_of, meta=meta,
    )

    # ── 3. XGBoost inference ───────────────────────────────────────────────────
    xgb_preds, xgb_signal, xgb_drivers = _run_xgboost(processed_df, **common_kwargs)
    xgb_result = _build_result("xgboost", xgb_preds, xgb_signal, xgb_drivers,
                               current_close, fng_today, nlp_score, nlp_status,
                               data_as_of, meta, model_health)

    # ── 4. LSTM inference (non-fatal if TF unavailable) ───────────────────────
    lstm_result = None
    try:
        lstm_preds, lstm_signal, lstm_drivers = _run_lstm(processed_df, **common_kwargs)
        lstm_result = _build_result("lstm", lstm_preds, lstm_signal, lstm_drivers,
                                    current_close, fng_today, nlp_score, nlp_status,
                                    data_as_of, meta, model_health)
    except Exception as e:
        print(f"  [LSTM] Inference skipped: {e}")

    # ── 5. Persist ─────────────────────────────────────────────────────────────
    print("[5/5] Saving results...")

    with open(LATEST_FILE, "w") as f:
        json.dump(xgb_result, f, indent=2)
    print(f"  latest_prediction.json written (XGBoost).")

    if lstm_result:
        with open(LATEST_LSTM_FILE, "w") as f:
            json.dump(lstm_result, f, indent=2)
        print(f"  latest_prediction_lstm.json written (LSTM).")

    # Append XGBoost result to history, resolving any prior unresolved entries first
    xgb_entry = {**xgb_result, "actual_direction_y1": None, "actual_price_y1": None}
    xgb_history = _load_history(HISTORY_FILE)
    xgb_resolved = _resolve_unresolved(xgb_history, df_ohlcv)
    if xgb_resolved:
        print(f"  Resolved {xgb_resolved} prior XGBoost entry(ies) with actual outcomes.")
    _save_history(xgb_history, xgb_entry, HISTORY_FILE)
    print(f"  prediction_history.json updated ({len(xgb_history)+1} entries).")

    # Append LSTM result to its own history, resolving prior entries first
    if lstm_result:
        lstm_entry = {**lstm_result, "actual_direction_y1": None, "actual_price_y1": None}
        lstm_history = _load_history(HISTORY_LSTM_FILE)
        lstm_resolved = _resolve_unresolved(lstm_history, df_ohlcv)
        if lstm_resolved:
            print(f"  Resolved {lstm_resolved} prior LSTM entry(ies) with actual outcomes.")
        _save_history(lstm_history, lstm_entry, HISTORY_LSTM_FILE)
        print(f"  prediction_history_lstm.json updated ({len(lstm_history)+1} entries).")

    print(f"\n  XGBoost signal: {xgb_signal['action']} ({xgb_signal['strength']})")
    print(f"  XGBoost y1: {xgb_preds['y1']['price_change_pct']:+.2f}% -> "
          f"${xgb_preds['y1']['predicted_price']:,.2f} "
          f"(conf {xgb_preds['y1']['confidence']:.0%})")
    if lstm_result:
        print(f"  LSTM signal:    {lstm_result['signal']['action']} ({lstm_result['signal']['strength']})")
        print(f"  LSTM y1: {lstm_preds['y1']['price_change_pct']:+.2f}% -> "
              f"${lstm_preds['y1']['predicted_price']:,.2f} "
              f"(conf {lstm_preds['y1']['confidence']:.0%})")
    print(f"  Model health: {model_health['status']}")
    print("Done.")


if __name__ == "__main__":
    run_daily_inference()
