import json
import time
import asyncio
import feedparser
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


RSS_SOURCES = [
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://bitcoinmagazine.com/feed",
]

_news_cache: dict = {"data": [], "expires": 0.0}
_NEWS_TTL = 15 * 60  # 15 minutes


def _fetch_rss(limit: int) -> list[dict]:
    headlines = []
    for url in RSS_SOURCES:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                headlines.append({
                    "title":     entry.get("title", "").strip(),
                    "link":      entry.get("link", ""),
                    "published": entry.get("published", entry.get("updated", "")),
                })
        except Exception:
            continue
    return headlines[:limit]


@app.get("/api/news")
async def get_news_headlines(limit: int = Query(default=8, ge=1, le=20)):
    """Latest Bitcoin news headlines from RSS feeds (cached 15 min)."""
    now = time.time()
    if _news_cache["expires"] > now and _news_cache["data"]:
        return _news_cache["data"]

    loop = asyncio.get_event_loop()
    headlines = await loop.run_in_executor(None, _fetch_rss, limit)

    if headlines:
        _news_cache["data"] = headlines
        _news_cache["expires"] = now + _NEWS_TTL

    return headlines
