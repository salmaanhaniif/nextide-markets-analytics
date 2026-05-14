"""
NexTide Analytics Backend
Complete self-contained ML inference server for Bitcoin price prediction.

Runs inference pipeline, serves predictions, history, and real-time news.
No external dependencies — all models and data served from backend.
"""
import json
import time
import asyncio
import feedparser
import logging
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent / "data_pipeline" / ".env")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NexTide Analytics API",
    description="Bitcoin ML prediction & decision support system. Self-contained backend.",
    version="2.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_PATH = Path(__file__).resolve().parent
DATA_PATH = BASE_PATH / "data"
LATEST_FILE = DATA_PATH / "latest_prediction.json"
LATEST_LSTM_FILE = DATA_PATH / "latest_prediction_lstm.json"
HISTORY_FILE = DATA_PATH / "prediction_history.json"
HISTORY_LSTM_FILE = DATA_PATH / "prediction_history_lstm.json"


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
    """Health check endpoint. Returns API status and data availability."""
    return {
        "status": "online",
        "service": "NexTide Analytics Backend",
        "version": "2.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_status": {
            "latest_xgboost": LATEST_FILE.exists(),
            "latest_lstm": LATEST_LSTM_FILE.exists(),
            "history_xgboost": HISTORY_FILE.exists(),
            "history_lstm": HISTORY_LSTM_FILE.exists(),
        },
        "models_available": {
            "xgboost": True,  # Always available (shipped with repo)
            "lstm": True,
        },
    }


@app.post("/api/inference/run")
def trigger_inference():
    """
    Manually trigger daily inference pipeline.

    In production, this runs automatically via GitHub Actions (00:10 UTC daily).
    This endpoint allows manual triggering for testing or emergency reruns.

    Note: Requires Gemini/Groq API keys in environment.
    """
    try:
        from data_pipeline.fetcher import fetch_latest_crypto_data, fetch_historical_fng
        from data_pipeline.feature_engineering import engineer_features
        from data_pipeline.sentiment_analysis import get_live_nlp_sentiment

        logger.info("Manual inference trigger initiated")

        # Fetch latest data
        df_ohlcv = fetch_latest_crypto_data(limit=250)
        fng_df = fetch_historical_fng(limit=65)

        # Get live sentiment
        nlp_sentiment = get_live_nlp_sentiment()

        return {
            "status": "inference_triggered",
            "data_fetched": {
                "ohlcv_rows": len(df_ohlcv),
                "fng_rows": len(fng_df),
                "nlp_sentiment": nlp_sentiment,
            },
            "note": "Run daily-inference.py to complete the pipeline",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Inference trigger failed: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.get("/api/predict/daily")
def get_daily_prediction(model: str = Query(default="xgboost")) -> dict:
    """
    Latest Bitcoin price prediction (XGBoost or LSTM).

    Returns DailyPrediction with:
    - meta: generation timestamp, model version, data date
    - current: current price, Fear & Greed, NLP sentiment
    - predictions: y1/y7/y30 horizons with price targets, confidence, ranges
    - signal: trading signal (BUY/SELL/HOLD) with reasoning
    - key_drivers: top features influencing prediction
    - model_health: rolling directional accuracy, health status

    Query params:
    - model: "xgboost" (default) or "lstm"
    """
    if model == "lstm":
        if not LATEST_LSTM_FILE.exists():
            raise HTTPException(status_code=503, detail="LSTM prediction not yet generated. Run daily-inference.py first.")
        return _read_json(LATEST_LSTM_FILE)
    if not LATEST_FILE.exists():
        raise HTTPException(status_code=503, detail="XGBoost prediction not yet generated. GitHub Actions may not have run yet.")
    return _read_json(LATEST_FILE)


@app.get("/api/history")
def get_prediction_history(
    days:  int = Query(default=90, ge=1, le=365),
    model: str = Query(default="xgboost"),
) -> list:
    """
    Historical predictions (rolling N days).

    Each entry is a HistoryEntry snapshot with:
    - All fields from DailyPrediction (meta, current, predictions, signal, key_drivers, model_health)
    - actual_direction_y1: Resolved after target_date passes (null while pending)
    - actual_price_y1: Resolved after target_date passes (null while pending)

    Query params:
    - days: 1-365 (default 90)
    - model: "xgboost" (default) or "lstm"

    Note: LSTM history may be empty if inference hasn't run yet.
    """
    path = _history_file(model)
    if not path.exists():
        return []   # LSTM history starts empty — return empty list, not 404
    history = _read_json(path)
    if not isinstance(history, list):
        raise HTTPException(status_code=500, detail="History file malformed.")
    return history[-days:]


@app.get("/api/backtest/30d")
def get_backtest_30d(model: str = Query(default="xgboost")) -> dict:
    """
    30-day backtest performance metrics for resolved predictions.

    Returns BacktestResponse with:
    - period_days: Number of resolved predictions in backtest window
    - directional_accuracy: Fraction of correct direction calls (0..1)
    - correct_calls: Count of UP/DOWN predictions that matched actual
    - total_calls: Count of resolved predictions analyzed
    - avg_price_error_pct: Mean absolute % error of price targets
    - records: Full HistoryEntry snapshots for resolved predictions

    A prediction is "resolved" when its target_date has passed and
    actual_direction_y1 and actual_price_y1 have been filled in.

    Query params:
    - model: "xgboost" (default) or "lstm"

    Note: Need 30+ days of history to show meaningful metrics.
    """
    path = _history_file(model)
    if not path.exists():
        return {
            "error": "No history available for this model yet.",
            "period_days": 0,
            "directional_accuracy": None,
            "correct_calls": 0,
            "total_calls": 0,
            "avg_price_error_pct": None,
            "records": [],
        }

    history = _read_json(path)
    if not isinstance(history, list):
        raise HTTPException(status_code=500, detail="History file malformed.")

    # Get last 60 entries and filter to resolved predictions only
    resolved = [
        e for e in history[-60:]
        if e.get("actual_direction_y1") is not None
    ][-30:]

    if not resolved:
        return {
            "error": "Not enough resolved predictions for backtest.",
            "period_days": 0,
            "directional_accuracy": None,
            "correct_calls": 0,
            "total_calls": 0,
            "avg_price_error_pct": None,
            "records": [],
        }

    total = len(resolved)
    correct = sum(
        1 for e in resolved
        if e.get("predictions", {}).get("y1", {}).get("direction") == e["actual_direction_y1"]
    )

    price_errors = []
    for e in resolved:
        pred_price = e.get("predictions", {}).get("y1", {}).get("predicted_price")
        actual_price = e.get("actual_price_y1")
        if pred_price and actual_price:
            price_errors.append(abs(pred_price - actual_price) / actual_price * 100)

    return {
        "period_days": total,
        "directional_accuracy": round(correct / total, 4) if total > 0 else 0,
        "correct_calls": correct,
        "total_calls": total,
        "avg_price_error_pct": round(sum(price_errors) / len(price_errors), 4) if price_errors else None,
        "records": resolved,
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
async def get_news_headlines(limit: int = Query(default=8, ge=1, le=20)) -> list:
    """
    Latest Bitcoin news headlines from RSS feeds (live, not from git).

    Returns array of NewsHeadline with:
    - title: Headline text
    - link: Article URL
    - published: Publication date (RFC-2822 or ISO format from RSS)

    Query params:
    - limit: 1-20 headlines (default 8)

    Cache: 15 minutes (to avoid hammering RSS feeds)

    Sources:
    - CoinTelegraph
    - CoinDesk
    - Bitcoin Magazine
    """
    now = time.time()
    if _news_cache["expires"] > now and _news_cache["data"]:
        return _news_cache["data"]

    loop = asyncio.get_event_loop()
    headlines = await loop.run_in_executor(None, _fetch_rss, limit)

    if headlines:
        _news_cache["data"] = headlines
        _news_cache["expires"] = now + _NEWS_TTL

    return headlines


@app.get("/api/status")
def get_backend_status():
    """
    Detailed backend status including data freshness and pipeline status.

    Returns information about:
    - Data file timestamps (when predictions were last generated)
    - Number of historical records
    - Model availability
    - System uptime
    """
    def get_file_age_hours(path: Path) -> float:
        if not path.exists():
            return None
        age_seconds = (datetime.now(timezone.utc) - datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)).total_seconds()
        return round(age_seconds / 3600, 2)

    def get_file_size_kb(path: Path) -> float:
        if not path.exists():
            return None
        return round(path.stat().st_size / 1024, 2)

    # Count records in history
    def count_records(path: Path) -> int:
        if not path.exists():
            return 0
        try:
            with open(path) as f:
                return len(json.load(f))
        except:
            return 0

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "operational",
        "data_freshness": {
            "latest_prediction_age_hours": get_file_age_hours(LATEST_FILE),
            "latest_lstm_age_hours": get_file_age_hours(LATEST_LSTM_FILE),
            "history_xgboost_records": count_records(HISTORY_FILE),
            "history_lstm_records": count_records(HISTORY_LSTM_FILE),
            "news_cache_expires_in_seconds": max(0, int(_news_cache["expires"] - time.time())),
        },
        "file_sizes_kb": {
            "latest_prediction": get_file_size_kb(LATEST_FILE),
            "history_xgboost": get_file_size_kb(HISTORY_FILE),
            "history_lstm": get_file_size_kb(HISTORY_LSTM_FILE),
        },
        "pipeline_info": {
            "daily_inference_time_utc": "00:10 UTC (daily)",
            "weekly_retrain_time_utc": "02:00 UTC (Sundays)",
            "news_fetch_time_utc": "03:00 UTC (daily)",
        },
        "recommendation": "If data is > 24 hours old, check GitHub Actions workflow status",
    }
