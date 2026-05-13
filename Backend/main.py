import json
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="NexTide Analytics API",
    description="Bitcoin ML prediction & decision support system.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_PATH = Path(__file__).resolve().parent
LATEST_FILE = BASE_PATH / "latest_prediction.json"
LATEST_LSTM_FILE = BASE_PATH / "latest_prediction_lstm.json"
HISTORY_FILE = BASE_PATH / "data" / "prediction_history.json"
HISTORY_LSTM_FILE = BASE_PATH / "data" / "prediction_history_lstm.json"


def _read_json(path: Path) -> dict | list:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{path.name} not found.")
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading {path.name}: {e}")


def _history_file(model: str) -> Path:
    return HISTORY_LSTM_FILE if model == "lstm" else HISTORY_FILE


@app.get("/")
def health_check():
    return {
        "status": "NexTide Analytics API running",
        "latest_prediction_available": LATEST_FILE.exists(),
        "lstm_prediction_available": LATEST_LSTM_FILE.exists(),
        "utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@app.get("/api/predict/daily")
def get_daily_prediction(model: str = Query(default="xgboost")):
    """Latest prediction. model=xgboost (default) | lstm"""
    if model == "lstm":
        if not LATEST_LSTM_FILE.exists():
            raise HTTPException(status_code=503, detail="LSTM prediction not yet generated. Run daily-inference.py first.")
        return _read_json(LATEST_LSTM_FILE)
    return _read_json(LATEST_FILE)


@app.get("/api/history")
def get_prediction_history(
    days:  int = Query(default=90, ge=1, le=365),
    model: str = Query(default="xgboost"),
):
    """Historical predictions. model=xgboost | lstm"""
    path = _history_file(model)
    if not path.exists():
        return []   # LSTM history starts empty — return empty list, not 404
    history = _read_json(path)
    if not isinstance(history, list):
        raise HTTPException(status_code=500, detail="History file malformed.")
    return history[-days:]


@app.get("/api/backtest/30d")
def get_backtest_30d(model: str = Query(default="xgboost")):
    """30-day backtest performance metrics. model=xgboost | lstm"""
    path = _history_file(model)
    if not path.exists():
        return {"error": "No history available for this model yet.", "period_days": 0,
                "directional_accuracy": None, "correct_calls": 0, "total_calls": 0,
                "avg_price_error_pct": None, "records": []}

    history = _read_json(path)
    if not isinstance(history, list):
        raise HTTPException(status_code=500, detail="History file malformed.")

    resolved = [
        e for e in history[-60:]
        if e.get("actual_direction_y1") is not None
    ][-30:]

    if not resolved:
        return {"error": "Not enough resolved predictions for backtest.", "period_days": 0,
                "directional_accuracy": None, "correct_calls": 0, "total_calls": 0,
                "avg_price_error_pct": None, "records": []}

    total   = len(resolved)
    correct = sum(
        1 for e in resolved
        if e.get("predictions", {}).get("y1", {}).get("direction") == e["actual_direction_y1"]
    )

    price_errors = []
    for e in resolved:
        pred_price   = e.get("predictions", {}).get("y1", {}).get("predicted_price")
        actual_price = e.get("actual_price_y1")
        if pred_price and actual_price:
            price_errors.append(abs(pred_price - actual_price) / actual_price * 100)

    return {
        "period_days":          total,
        "directional_accuracy": round(correct / total, 4),
        "correct_calls":        correct,
        "total_calls":          total,
        "avg_price_error_pct":  round(sum(price_errors) / len(price_errors), 4) if price_errors else None,
        "records":              resolved,
    }


@app.get("/api/news")
def get_news_headlines():
    """Latest Bitcoin news headlines (mock data)."""
    return [
        {"title": "Bitcoin Surges Past $82K as Spot ETF Inflows Hit Monthly Record", "link": "#", "published": "Mon, 11 May 2026 08:30:00 +0000"},
        {"title": "Fed Chair Powell Signals Cautious Rate Outlook; Crypto Markets Rally", "link": "#", "published": "Mon, 11 May 2026 07:15:00 +0000"},
        {"title": "MicroStrategy Adds 2,500 BTC to Treasury, Total Holdings Near 220K", "link": "#", "published": "Mon, 11 May 2026 06:00:00 +0000"},
    ]
