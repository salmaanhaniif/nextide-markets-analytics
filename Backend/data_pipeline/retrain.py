"""
Weekly retraining pipeline — incremental data expansion.

Each run adds WEEKLY_INCREMENT days of new Binance candles on top of
whatever was fetched in the previous run. The number of days used is
persisted in model_metadata.json so the window grows automatically.

First run:  fetches INITIAL_TRAINING_DAYS candles.
Nth   run:  fetches (previous training_days + WEEKLY_INCREMENT) candles.
"""
import os
import json
import shutil
import joblib
import numpy as np
import xgboost as xgb
from datetime import datetime
from pathlib import Path
from sklearn.decomposition import PCA
from sklearn.preprocessing import MinMaxScaler

from data_pipeline.fetcher import fetch_latest_crypto_data, fetch_historical_fng
from data_pipeline.feature_engineering import engineer_features, TECH_FEATURES, SENTIMENT_FEATURES
from data_pipeline.preprocessor import build_sequences

BASE_PATH   = Path(__file__).resolve().parent.parent
MODELS_PATH = BASE_PATH / "models"

TARGET_COLS  = ["target_y1", "target_y7", "target_y30"]
SEQUENCE_LEN = 30
TRAIN_RATIO  = 0.80
N_PCA        = 11

INITIAL_TRAINING_DAYS = 1000   # ~2.7 years; used on the very first run
WEEKLY_INCREMENT      = 7      # candles added per retrain cycle
FNG_API_MAX           = 2500   # alternative.me caps at ~2500 days of history


def _directional_accuracy(preds: np.ndarray, actuals: np.ndarray) -> float:
    return float((np.sign(preds) == np.sign(actuals)).mean())


def _load_meta() -> dict:
    meta_path = MODELS_PATH / "model_metadata.json"
    if meta_path.exists():
        with open(meta_path) as f:
            return json.load(f)
    return {}


def _save_meta(meta: dict) -> None:
    MODELS_PATH.mkdir(parents=True, exist_ok=True)
    with open(MODELS_PATH / "model_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)


def run_retraining():
    print("=" * 60)
    print("NexTide Analytics — Weekly Retraining (incremental)")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── 0. Determine how many days to fetch ──────────────────────
    meta      = _load_meta()
    prev_days = meta.get("training_days", INITIAL_TRAINING_DAYS)
    fetch_days = prev_days + WEEKLY_INCREMENT

    print(f"\n[1/5] Fetching data — prev: {prev_days} days  →  new: {fetch_days} days (+{WEEKLY_INCREMENT})")

    # ── 1. Fetch historical data ──────────────────────────────────
    df_ohlcv = fetch_latest_crypto_data(limit=fetch_days)
    fng_df   = fetch_historical_fng(limit=min(fetch_days, FNG_API_MAX))

    print(f"      OHLCV rows: {len(df_ohlcv)}  |  FnG rows: {len(fng_df)}")

    # ── 2. Feature engineering ────────────────────────────────────
    print("[2/5] Engineering features...")
    processed_df = engineer_features(df_ohlcv, fng_df, nlp_score=0.0)

    # Synthetic NLP proxy for historical data (blueprint Section 4.3 Option B)
    log_ret_3d = processed_df['log_return'].rolling(3).mean().fillna(0)
    noise      = np.random.normal(0, 0.15, len(processed_df))
    processed_df['nlp_sentiment_score'] = np.clip(
        log_ret_3d * 8 + processed_df['fng_momentum'].fillna(0) * 0.3 + noise,
        -1.0, 1.0,
    )
    processed_df.dropna(inplace=True)
    print(f"      Processed rows after dropna: {len(processed_df)}")

    # ── 3. Train / test split (chronological) ────────────────────
    split_idx = int(len(processed_df) * TRAIN_RATIO)
    train_df  = processed_df.iloc[:split_idx]
    test_df   = processed_df.iloc[split_idx:]
    print(f"      Train: {len(train_df)} rows  |  Test: {len(test_df)} rows")

    # ── 4. Scale tech features + PCA ─────────────────────────────
    print("[3/5] Scaling and PCA...")
    f_scaler = MinMaxScaler(feature_range=(0, 1))
    pca_obj  = PCA(n_components=N_PCA, random_state=42)

    train_tech_scaled = f_scaler.fit_transform(train_df[TECH_FEATURES])
    test_tech_scaled  = f_scaler.transform(test_df[TECH_FEATURES])

    train_pca = pca_obj.fit_transform(train_tech_scaled)
    test_pca  = pca_obj.transform(test_tech_scaled)

    X_train_full = np.hstack([train_pca, train_df[SENTIMENT_FEATURES].values])
    X_test_full  = np.hstack([test_pca,  test_df[SENTIMENT_FEATURES].values])

    # ── 5. Build sequences + target scalers ──────────────────────
    target_scalers       = {}
    train_targets_scaled = {}
    test_targets_scaled  = {}

    for target in TARGET_COLS:
        scaler = MinMaxScaler(feature_range=(0, 1))
        train_targets_scaled[target] = scaler.fit_transform(train_df[[target]])
        test_targets_scaled[target]  = scaler.transform(test_df[[target]])
        target_scalers[target]       = scaler

    X_train_flat, y_train = build_sequences(X_train_full, train_targets_scaled, SEQUENCE_LEN)
    X_test_flat,  y_test  = build_sequences(X_test_full,  test_targets_scaled,  SEQUENCE_LEN)

    # ── 6. Load existing models for comparison ───────────────────
    print("[4/5] Training new models and comparing vs existing...")
    existing_da = {}
    for target in TARGET_COLS:
        model_path  = MODELS_PATH / f"xgb_model_{target}.pkl"
        scaler_path = MODELS_PATH / f"target_scaler_{target}.pkl"
        if model_path.exists() and scaler_path.exists():
            old_model   = joblib.load(model_path)
            old_scaler  = joblib.load(scaler_path)
            old_preds   = old_scaler.inverse_transform(
                old_model.predict(X_test_flat).reshape(-1, 1)).ravel()
            old_actuals = target_scalers[target].inverse_transform(
                y_test[target].reshape(-1, 1)).ravel()
            existing_da[target] = _directional_accuracy(old_preds, old_actuals)
        else:
            existing_da[target] = 0.0

    # ── 7. Train new models ───────────────────────────────────────
    new_models = {}
    for target in TARGET_COLS:
        print(f"   Training {target}...")
        model = xgb.XGBRegressor(
            objective='reg:squarederror',
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train_flat, y_train[target].ravel())
        new_models[target] = model

    # ── 8. Evaluate + replace only if better ─────────────────────
    print("[5/5] Evaluating and saving...")
    replaced = []
    for target in TARGET_COLS:
        model  = new_models[target]
        scaler = target_scalers[target]

        preds   = scaler.inverse_transform(
            model.predict(X_test_flat).reshape(-1, 1)).ravel()
        actuals = scaler.inverse_transform(
            y_test[target].reshape(-1, 1)).ravel()
        new_da  = _directional_accuracy(preds, actuals)
        old_da  = existing_da[target]

        print(f"   {target}: new DA={new_da:.2%}  vs  old DA={old_da:.2%}", end="  ")

        if new_da >= old_da:
            old_path = MODELS_PATH / f"xgb_model_{target}.pkl"
            if old_path.exists():
                shutil.copy(old_path, MODELS_PATH / f"xgb_model_{target}_prev.pkl")
            joblib.dump(model,  MODELS_PATH / f"xgb_model_{target}.pkl")
            joblib.dump(scaler, MODELS_PATH / f"target_scaler_{target}.pkl")
            replaced.append(target)
            print("→ REPLACED")
        else:
            print("→ kept old")

    # Always update shared artifacts (scaler + PCA reflect the new data window)
    joblib.dump(f_scaler, MODELS_PATH / "feature_scaler.pkl")
    joblib.dump(pca_obj,  MODELS_PATH / "pca_transformer.pkl")

    # ── 9. Persist metadata ───────────────────────────────────────
    meta["last_retrained"]  = datetime.now().isoformat()
    meta["training_days"]   = fetch_days          # grow by WEEKLY_INCREMENT each run
    meta["ohlcv_rows_used"] = len(df_ohlcv)
    meta["processed_rows"]  = len(processed_df)
    meta["models_replaced"] = replaced
    _save_meta(meta)

    print(f"\nRetraining complete. training_days: {prev_days} → {fetch_days}")
    print(f"Replaced models: {replaced if replaced else 'none (old models were better)'}")


if __name__ == "__main__":
    run_retraining()
