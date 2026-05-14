"""
Backfill prediction_history.json dengan historical predictions yang sudah matured.
Ini untuk demo/testing agar backtest punya data untuk ditampilkan.

Generates 60+ days of synthetic but realistic predictions dengan actual results filled in.
"""
import json
import numpy as np
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_PATH = Path(__file__).resolve().parent
HISTORY_FILE = BASE_PATH / "data" / "prediction_history.json"

# Generate 90+ days of synthetic but realistic BTC prices
def generate_price_history(days=95):
    """Generate realistic BTC price history with trend and volatility."""
    prices = {}
    base_price = 60000.0
    current_date = datetime.fromisoformat("2026-02-09")

    for i in range(days):
        # Add trend + noise
        daily_change = np.random.normal(0.002, 0.015)  # ~0.2% daily with volatility
        base_price *= (1 + daily_change)

        date_str = current_date.strftime("%Y-%m-%d")
        prices[date_str] = round(base_price, 2)
        current_date += timedelta(days=1)

    return prices

HISTORICAL_PRICES = generate_price_history()

def generate_prediction(data_as_of: str, current_price: float, next_price: float):
    """Generate a DailyPrediction snapshot for a past date."""
    data_dt = datetime.fromisoformat(data_as_of)

    # Simulate model's prediction (not perfect, ~55-60% accurate)
    np.random.seed(hash(data_as_of) % 2**32)  # Reproducible but unique per date

    actual_log_return = np.log(next_price / current_price)
    actual_direction = "UP" if actual_log_return > 0 else "DOWN"

    # Model prediction: sometimes wrong for realism
    # 60% of time: correct direction, 40% time: random or opposite
    rand_val = np.random.random()
    if rand_val < 0.6:
        # Correct direction, with small error
        pred_bias = np.random.normal(0, 0.0015)
        pred_log_return = actual_log_return + pred_bias
    else:
        # Wrong direction or random
        pred_log_return = -actual_log_return * np.random.uniform(0.5, 1.5)

    pred_direction = "UP" if pred_log_return > 0 else "DOWN"
    pred_price = current_price * np.exp(pred_log_return)

    # Confidence: random 45-75%
    confidence = 0.45 + np.random.random() * 0.30

    # Fear & Greed: cyclical
    day_of_year = data_dt.timetuple().tm_yday
    fng_score = 0.3 * np.sin(2 * np.pi * day_of_year / 365) - 0.2 * np.random.random()
    fng_score = max(-1.0, min(1.0, fng_score))

    # NLP sentiment: correlated with actual
    nlp_sentiment = 0.5 * actual_log_return + np.random.normal(0, 0.2)
    nlp_sentiment = max(-1.0, min(1.0, nlp_sentiment))

    # FNG label mapping
    if fng_score < -0.6:
        fng_label = "Extreme Fear"
    elif fng_score < -0.2:
        fng_label = "Fear"
    elif fng_score < 0.2:
        fng_label = "Neutral"
    elif fng_score < 0.6:
        fng_label = "Greed"
    else:
        fng_label = "Extreme Greed"

    target_y1 = (data_dt + timedelta(days=1)).strftime("%Y-%m-%d")

    # Price change %
    price_change_pct = pred_log_return * 100

    # Confidence range (±2% from prediction)
    range_low = pred_price * 0.98
    range_high = pred_price * 1.02

    return {
        "meta": {
            "generated_at": f"{data_as_of}T09:00:00Z",
            "model_version": "2026-05-12",
            "model_id": "xgboost",
            "data_as_of": data_as_of,
        },
        "current": {
            "price": current_price,
            "fng_score": fng_score,
            "fng_label": fng_label,
            "nlp_sentiment": nlp_sentiment,
            "nlp_status": "fallback_7d_avg",
        },
        "predictions": {
            "y1": {
                "target_date": target_y1,
                "predicted_log_return": pred_log_return,
                "predicted_price": pred_price,
                "price_change_pct": price_change_pct,
                "direction": pred_direction,
                "confidence": confidence,
                "range_low": range_low,
                "range_high": range_high,
            },
            "y7": {
                "target_date": (data_dt + timedelta(days=7)).strftime("%Y-%m-%d"),
                "predicted_log_return": pred_log_return * 3.5,
                "predicted_price": current_price * np.exp(pred_log_return * 3.5),
                "price_change_pct": pred_log_return * 350,
                "direction": "UP" if pred_log_return * 3.5 > 0 else "DOWN",
                "confidence": max(0.4, confidence - 0.1),
                "range_low": current_price * np.exp(pred_log_return * 3.5) * 0.95,
                "range_high": current_price * np.exp(pred_log_return * 3.5) * 1.05,
            },
            "y30": {
                "target_date": (data_dt + timedelta(days=30)).strftime("%Y-%m-%d"),
                "predicted_log_return": pred_log_return * 12,
                "predicted_price": current_price * np.exp(pred_log_return * 12),
                "price_change_pct": pred_log_return * 1200,
                "direction": "UP" if pred_log_return * 12 > 0 else "DOWN",
                "confidence": max(0.35, confidence - 0.15),
                "range_low": current_price * np.exp(pred_log_return * 12) * 0.90,
                "range_high": current_price * np.exp(pred_log_return * 12) * 1.10,
            },
        },
        "signal": {
            "action": "BUY" if confidence > 0.65 and pred_direction == "UP" else "SELL" if confidence > 0.65 and pred_direction == "DOWN" else "HOLD",
            "strength": "STRONG" if confidence > 0.70 else "MODERATE" if confidence > 0.55 else "LOW_CONFIDENCE",
            "reasoning": f"Model projects {price_change_pct:+.1f}% with {confidence*100:.0f}% confidence",
        },
        "key_drivers": [
            {"feature": "pca_components", "importance": 0.28, "label": "Technical Pattern (PCA)"},
            {"feature": "fng_score", "importance": 0.22, "label": "Fear & Greed Score"},
            {"feature": "fng_7d_avg", "importance": 0.18, "label": "Sentiment 7-Day Avg"},
            {"feature": "fng_momentum", "importance": 0.16, "label": "Sentiment Momentum"},
            {"feature": "volatility", "importance": 0.16, "label": "Price Volatility"},
        ],
        "model_health": {
            "rolling_da_14d": 0.52,
            "status": "good",
        },
        # ↓ ACTUAL VALUES (filled in after target_date passes)
        "actual_direction_y1": actual_direction,
        "actual_price_y1": next_price,
    }


def backfill_history():
    """Generate 60+ days of historical predictions with actual results."""
    print("Backfilling prediction history...")

    dates = sorted(HISTORICAL_PRICES.keys())
    predictions = []

    # Generate prediction for each date (except the last, which is today)
    for i in range(len(dates) - 1):
        current_date = dates[i]
        next_date = dates[i + 1]

        current_price = HISTORICAL_PRICES[current_date]
        next_price = HISTORICAL_PRICES[next_date]

        pred = generate_prediction(current_date, current_price, next_price)
        predictions.append(pred)

        print(f"  {current_date}: {current_price:,.0f} -> {next_price:,.0f} ({pred['actual_direction_y1']})")

    # Save to file
    DATA_PATH = BASE_PATH / "data"
    DATA_PATH.mkdir(exist_ok=True)

    with open(HISTORY_FILE, "w") as f:
        json.dump(predictions, f, indent=2)

    # Count metrics
    resolved = [p for p in predictions if p.get("actual_direction_y1") is not None]
    correct = sum(
        1 for p in resolved
        if p["predictions"]["y1"]["direction"] == p["actual_direction_y1"]
    )

    print(f"\n[OK] Backfilled {len(predictions)} entries")
    print(f"[OK] All entries are resolved (actual_direction_y1 filled)")
    print(f"[OK] Directional accuracy Y1: {correct}/{len(resolved)} = {100*correct/len(resolved):.1f}%")
    print(f"[OK] Saved to {HISTORY_FILE}")


if __name__ == "__main__":
    backfill_history()
