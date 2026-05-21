"""
LSTM retraining pipeline — mirrors the research notebook (Section 6B).

Architecture : Conv1D(64,k=3) -> Conv1D(32,k=5) -> LSTM(128) -> LSTM(64) -> Dense(32) -> Dense(1)
Loss         : Huber (robust to outliers vs MSE)
Optimizer    : Adam(lr=0.001) with ReduceLROnPlateau
Early stop   : patience=15 on val_loss, restore_best_weights=True

Target scaler: ONE shared MinMaxScaler fitted on the FULL y1 return distribution
               (all rows, not just 80% train) — saved as target_scaler.pkl.
               All three LSTM models (y1/y7/y30) are trained in this shared scale space,
               matching the original training setup that produced the deployed models.

Run:
    python -m data_pipeline.train_lstm
"""
import json
import joblib
import numpy as np
from datetime import datetime
from pathlib import Path

from sklearn.preprocessing import MinMaxScaler
from sklearn.decomposition import PCA

from data_pipeline.fetcher import fetch_latest_crypto_data, fetch_historical_fng, START_DATE
from data_pipeline.feature_engineering import engineer_features, TECH_FEATURES, SENTIMENT_FEATURES
from data_pipeline.preprocessor import build_lstm_sequences

BASE_PATH   = Path(__file__).resolve().parent.parent
MODELS_PATH = BASE_PATH / "models"

TARGET_COLS  = ["target_y1", "target_y7", "target_y30"]
SEQUENCE_LEN = 30
TRAIN_RATIO  = 0.80
N_PCA        = 11
FNG_API_MAX  = 5000


def _directional_accuracy(preds: np.ndarray, actuals: np.ndarray) -> float:
    return float((np.sign(preds) == np.sign(actuals)).mean())


def _build_lstm_model(input_shape):
    """Conv-LSTM architecture matching the research notebook."""
    from tensorflow.keras.models import Model
    from tensorflow.keras.layers import (
        Input, Conv1D, BatchNormalization, LSTM, Dropout, Dense
    )
    from tensorflow.keras.optimizers import Adam

    inp = Input(shape=input_shape)
    x   = Conv1D(64, kernel_size=3, padding='same', activation='relu')(inp)
    x   = BatchNormalization()(x)
    x   = Conv1D(32, kernel_size=5, padding='same', activation='relu')(x)
    x   = BatchNormalization()(x)
    x   = LSTM(128, return_sequences=True)(x)
    x   = Dropout(0.3)(x)
    x   = LSTM(64)(x)
    x   = Dropout(0.2)(x)
    x   = Dense(32, activation='relu')(x)
    out = Dense(1)(x)

    model = Model(inp, out)
    model.compile(optimizer=Adam(learning_rate=0.001), loss='huber', metrics=['mae'])
    return model


def run_lstm_training():
    print("=" * 60)
    print("NexTide Analytics — LSTM Retraining")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── 1. Fetch data ─────────────────────────────────────────────
    print(f"\n[1/6] Fetching data from {START_DATE} onwards...")
    df_ohlcv = fetch_latest_crypto_data(limit=3000)
    fng_df   = fetch_historical_fng(limit=FNG_API_MAX)
    print(f"      OHLCV rows: {len(df_ohlcv)}  |  FnG rows: {len(fng_df)}")

    # ── 2. Feature engineering + target columns ───────────────────
    print("[2/6] Engineering features...")
    df_ohlcv['log_return'] = np.log(df_ohlcv['close'] / df_ohlcv['close'].shift(1))
    df_ohlcv['target_y1']  = df_ohlcv['log_return'].shift(-1)
    df_ohlcv['target_y7']  = df_ohlcv['log_return'].shift(-7).rolling(7).sum()
    df_ohlcv['target_y30'] = df_ohlcv['log_return'].shift(-30).rolling(30).sum()

    processed_df = engineer_features(df_ohlcv, fng_df, nlp_score=0.0)
    log_ret_3d   = processed_df['log_return'].rolling(3).mean().fillna(0)
    noise        = np.random.normal(0, 0.15, len(processed_df))
    processed_df['nlp_sentiment_score'] = np.clip(
        log_ret_3d * 8 + processed_df['fng_momentum'].fillna(0) * 0.3 + noise, -1.0, 1.0
    )
    processed_df.dropna(inplace=True)
    print(f"      Processed rows after dropna: {len(processed_df)}")

    # ── 3. Train / test split ─────────────────────────────────────
    split_idx = int(len(processed_df) * TRAIN_RATIO)
    train_df  = processed_df.iloc[:split_idx]
    test_df   = processed_df.iloc[split_idx:]
    print(f"      Train: {len(train_df)} rows  |  Test: {len(test_df)} rows")

    # ── 4. Feature scaling + PCA (load existing — keep in sync with XGBoost) ──
    print("[3/6] Loading feature scaler + PCA (shared with XGBoost)...")
    f_scaler = joblib.load(MODELS_PATH / "feature_scaler.pkl")
    pca_obj  = joblib.load(MODELS_PATH / "pca_transformer.pkl")

    train_tech_scaled = f_scaler.transform(train_df[TECH_FEATURES])
    test_tech_scaled  = f_scaler.transform(test_df[TECH_FEATURES])
    train_pca         = pca_obj.transform(train_tech_scaled)
    test_pca          = pca_obj.transform(test_tech_scaled)

    X_train_full = np.hstack([train_pca, train_df[SENTIMENT_FEATURES].values])
    X_test_full  = np.hstack([test_pca,  test_df[SENTIMENT_FEATURES].values])

    # ── 5. Shared target scaler (fitted on FULL y1 distribution) ──
    # LSTM uses one scaler for all horizons — match the original training setup.
    print("[4/6] Fitting shared target scaler on full y1 distribution...")
    t_scaler = MinMaxScaler(feature_range=(0, 1))
    t_scaler.fit(processed_df[['target_y1']])   # full dataset, not just train
    print(f"      Scaler range: [{t_scaler.data_min_[0]:.4f}, {t_scaler.data_max_[0]:.4f}]"
          f"  n_samples={t_scaler.n_samples_seen_}")

    # Scale targets for all three horizons with the SAME scaler.
    # Pass .values to avoid sklearn feature-name validation (fitted on 'target_y1',
    # but we also transform 'target_y7' / 'target_y30' in the same scale space).
    train_targets_scaled = {}
    test_targets_scaled  = {}
    for target in TARGET_COLS:
        train_targets_scaled[target] = t_scaler.transform(train_df[[target]].values)
        test_targets_scaled[target]  = t_scaler.transform(test_df[[target]].values)

    # ── 6. Build sequences ────────────────────────────────────────
    X_train_seq, y_train_seq = build_lstm_sequences(X_train_full, train_targets_scaled, SEQUENCE_LEN)
    X_test_seq,  y_test_seq  = build_lstm_sequences(X_test_full,  test_targets_scaled,  SEQUENCE_LEN)
    print(f"      Sequence shape: {X_train_seq.shape}  (samples, timesteps, features)")

    # ── 7. Train one LSTM per horizon, compare vs existing ────────
    print("[5/6] Training LSTM models (y1 / y7 / y30)...")
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

    input_shape = (X_train_seq.shape[1], X_train_seq.shape[2])
    callbacks   = [
        EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=0),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=7, min_lr=1e-6, verbose=0),
    ]

    existing_da = {}
    for target in TARGET_COLS:
        model_path = MODELS_PATH / f"lstm_{target}.keras"
        if model_path.exists():
            from tensorflow.keras.models import load_model
            old_model  = load_model(str(model_path), compile=False)
            old_preds  = t_scaler.inverse_transform(
                old_model.predict(X_test_seq, verbose=0).reshape(-1, 1)).ravel()
            old_actual = t_scaler.inverse_transform(
                y_test_seq[target].reshape(-1, 1)).ravel()
            existing_da[target] = _directional_accuracy(old_preds, old_actual)
        else:
            existing_da[target] = 0.0

    replaced = []
    for target in TARGET_COLS:
        print(f"\n   Training {target}...")
        model = _build_lstm_model(input_shape)
        model.fit(
            X_train_seq, y_train_seq[target].flatten(),
            epochs=100,
            batch_size=32,
            validation_split=0.15,
            callbacks=callbacks,
            verbose=0,
        )

        new_preds  = t_scaler.inverse_transform(
            model.predict(X_test_seq, verbose=0).reshape(-1, 1)).ravel()
        new_actual = t_scaler.inverse_transform(
            y_test_seq[target].reshape(-1, 1)).ravel()
        new_da  = _directional_accuracy(new_preds, new_actual)
        old_da  = existing_da[target]

        print(f"   {target}: new DA={new_da:.2%}  vs  old DA={old_da:.2%}", end="  ")

        if new_da >= old_da:
            model.save(str(MODELS_PATH / f"lstm_{target}.keras"))
            replaced.append(target)
            print("[REPLACED]")
        else:
            print("[kept old]")

    # ── 8. Save shared target scaler (only if any model was replaced) ──
    print("\n[6/6] Saving artifacts...")
    if replaced:
        joblib.dump(t_scaler, MODELS_PATH / "target_scaler.pkl")
        print("      target_scaler.pkl updated")
    else:
        print("      target_scaler.pkl unchanged (no models replaced)")

    print(f"\nLSTM retraining complete. Replaced: {replaced if replaced else 'none'}")
    print("=" * 60)


if __name__ == "__main__":
    run_lstm_training()
