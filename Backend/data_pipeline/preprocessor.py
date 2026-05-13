import numpy as np
import pandas as pd
import joblib
import os
from sklearn.preprocessing import MinMaxScaler
from sklearn.decomposition import PCA

from data_pipeline.feature_engineering import TECH_FEATURES, SENTIMENT_FEATURES

BASE_PATH   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_PATH = os.path.join(BASE_PATH, 'models')

SEQUENCE_LEN = 30


def apply_scaling_and_pca_training(tech_df: pd.DataFrame, sentiment_df: pd.DataFrame, n_components: int = 11):
    """
    Fit scaler + PCA on training data, save artifacts.
    Used by retrain.py only — never called at inference.
    Returns (X_combined, pca) where X_combined = (n, n_pca + n_sentiment).
    """
    f_scaler = MinMaxScaler(feature_range=(0, 1))
    pca      = PCA(n_components=n_components, random_state=42)

    tech_scaled  = f_scaler.fit_transform(tech_df[TECH_FEATURES])
    tech_pca     = pca.fit_transform(tech_scaled)

    X_combined = np.hstack([tech_pca, sentiment_df[SENTIMENT_FEATURES].values])

    joblib.dump(f_scaler, os.path.join(MODELS_PATH, 'feature_scaler.pkl'))
    joblib.dump(pca,      os.path.join(MODELS_PATH, 'pca_transformer.pkl'))

    return X_combined, pca


def prepare_inference_input(processed_df: pd.DataFrame, seq_len: int = SEQUENCE_LEN) -> np.ndarray:
    """
    Build the (1, seq_len * (n_pca + n_sentiment)) input matrix for XGBoost inference.
    processed_df must contain TECH_FEATURES + SENTIMENT_FEATURES columns.
    Uses pre-fitted scaler and PCA from Backend/models/.
    """
    f_scaler = joblib.load(os.path.join(MODELS_PATH, 'feature_scaler.pkl'))
    pca      = joblib.load(os.path.join(MODELS_PATH, 'pca_transformer.pkl'))

    # Scale tech features (transform only, never fit)
    tech_scaled = f_scaler.transform(processed_df[TECH_FEATURES])
    tech_pca    = pca.transform(tech_scaled)

    # Sentiment features are already in [-1, 1] — no scaling needed
    sentiment = processed_df[SENTIMENT_FEATURES].values

    # Combined per-timestep features
    X_full = np.hstack([tech_pca, sentiment])  # (n, n_pca + n_sentiment)

    # Take last seq_len rows as the inference window
    if len(X_full) < seq_len:
        raise ValueError(f"Need at least {seq_len} rows, got {len(X_full)}")

    sequence = X_full[-seq_len:]  # (30, 16)
    return sequence.reshape(1, -1)  # (1, 480)


def prepare_lstm_inference_input(processed_df: pd.DataFrame, seq_len: int = SEQUENCE_LEN) -> np.ndarray:
    """
    Build (1, seq_len, features) input tensor for LSTM/Conv-LSTM inference.
    Same pipeline as prepare_inference_input but keeps the time dimension intact.
    """
    f_scaler = joblib.load(os.path.join(MODELS_PATH, 'feature_scaler.pkl'))
    pca      = joblib.load(os.path.join(MODELS_PATH, 'pca_transformer.pkl'))

    tech_scaled = f_scaler.transform(processed_df[TECH_FEATURES])
    tech_pca    = pca.transform(tech_scaled)
    sentiment   = processed_df[SENTIMENT_FEATURES].values
    X_full      = np.hstack([tech_pca, sentiment])  # (n, n_pca + n_sentiment)

    if len(X_full) < seq_len:
        raise ValueError(f"Need at least {seq_len} rows, got {len(X_full)}")

    sequence = X_full[-seq_len:]            # (30, 16)
    return sequence.reshape(1, seq_len, -1) # (1, 30, 16)


def build_sequences(X_combined: np.ndarray, y_dict: dict, seq_len: int = SEQUENCE_LEN):
    """
    Build sliding-window sequences for XGBoost training.
    X_combined: (n, features), y_dict: {target_name: (n,1) scaled array}
    Returns X_flat (n-seq_len, seq_len*features) and y_dict of same shape.
    """
    n = len(X_combined)
    X_seq = np.array([X_combined[i:i+seq_len] for i in range(n - seq_len)])
    X_flat = X_seq.reshape(len(X_seq), -1)
    y_out  = {k: v[seq_len:] for k, v in y_dict.items()}
    return X_flat, y_out
