# NexTide Markets Analytics

A full-stack MLOps decision-support system that forecasts daily Bitcoin price movements using Machine Learning and real-time NLP sentiment analysis, delivering automated trading signals through a live web dashboard.

**[Live App](https://nextide-markets-analytics.vercel.app/)** · **[Research Paper](https://informatika.stei.itb.ac.id/~rinaldi.munir/AljabarGeometri/2024-2025/Makalah/Makalah-IF2123-Algeo-2024%20(34).pdf)**

---

## Overview

NexTide is a **fully serverless MLOps system** with no database or persistent backend required. GitHub Actions runs three automated workflows:

1. **Daily Inference** (00:10 UTC) — Fetch OHLCV + FNG, engineer features, run XGBoost/Conv-LSTM models, analyze sentiment
2. **Daily News Fetch** (03:00 UTC) — Scrape Bitcoin news from RSS feeds
3. **Weekly Retraining** (Sundays 02:00 UTC) — Retrain models on expanded data windows

All outputs are committed as JSON files to the repository. The Next.js frontend reads these files directly from GitHub's raw CDN — no API server required.

```
GitHub Actions (automated cron jobs)
  ├─ 00:10 UTC: daily-inference.py → latest_prediction.json + prediction_history.json
  ├─ 03:00 UTC: fetch_news.py → data/news.json
  └─ Sunday 02:00 UTC: retrain.py → models/*.pkl + model_metadata.json
       ↓
  GitHub Repository (JSON data storage + version control)
       ↓
  GitHub raw CDN (global edge cache)
       ↓
  Frontend (Vercel) reads via HTTPS GET requests
```

---

## Features

- **Multi-horizon predictions** — 1-day, 7-day, and 30-day Bitcoin price forecasts
- **Dual model support** — XGBoost and Conv-LSTM, switchable in the UI
- **Trading signals** — STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL with confidence scoring
- **NLP sentiment** — Live news sentiment via Gemini/Groq LLMs with fallback
- **Fear & Greed Index** — Integrated from Alternative.me API
- **Prediction band** — Visual confidence range on the price chart
- **Model health monitoring** — 14-day rolling directional accuracy badge
- **Backtest view** — 30-day historical accuracy metrics
- **Auto-refresh** — Dashboard updates every 5 minutes

---

## Model Performance

Models trained on BTC/USDT daily OHLCV data from 2017-01-01, using an 80/20 train-test split.

| Model | Horizon | RMSE | MAE | Directional Accuracy |
|-------|---------|------|-----|----------------------|
| XGBoost | 1-day | 0.0251 | 0.0171 | 52.2% |
| XGBoost | 7-day | 0.0750 | 0.0531 | 58.9% |
| XGBoost | 30-day | 0.1470 | 0.1160 | 61.5% |
| Conv-LSTM | 1-day | 0.0359 | 0.0265 | 49.0% |
| Conv-LSTM | 7-day | 0.1256 | 0.0997 | 42.6% |
| Conv-LSTM | 30-day | 0.1715 | 0.1425 | 52.4% |

*RMSE and MAE are on log-return scale.*

---

## Tech Stack

**ML Pipeline (GitHub Actions)**
- Python 3.12
- XGBoost · TensorFlow/Keras (Conv-LSTM)
- scikit-learn (PCA, preprocessing)
- CCXT (market data) · Pandas / NumPy
- Gemini API · Groq API (NLP sentiment)
- feedparser (RSS news feed parsing)

**Frontend**
- Next.js 15 (App Router) · TypeScript
- Tailwind CSS 4 · Recharts
- Axios · Lucide React

**Infrastructure**
- **GitHub Actions** — free compute (daily inference + weekly retrain)
- **GitHub Repository** — JSON data storage + version control
- **GitHub raw CDN** — global edge cache for data files
- **Vercel** — frontend hosting (free tier supported)
- **Railway** *(optional)* — FastAPI fallback server for non-public repos

**Why Serverless?**
- ✅ Zero infrastructure cost (GitHub Actions + Vercel free tier)
- ✅ No database needed (JSON in git = version control + audit log)
- ✅ No API server runtime overhead (data served via CDN)
- ✅ Fully automated (cron-driven, no manual deployment)
- ✅ Scalable (CDN handles traffic spikes)

---

## Project Structure

```
Bitcoin-MLOps-dashboard/
├── .github/
│   └── workflows/
│       ├── daily-inference.yml      # Cron: 00:10 UTC — run XGBoost/LSTM inference
│       ├── daily-news.yml           # Cron: 03:00 UTC — fetch Bitcoin news from RSS
│       └── weekly-retrain.yml       # Cron: Sun 02:00 UTC — retrain models on expanded data
│
├── Backend/
│   ├── daily-inference.py           # Main inference pipeline (entry point)
│   ├── fetch_news.py                # News fetcher from RSS feeds (entry point)
│   ├── main.py                      # FastAPI server (optional, serves static JSON)
│   ├── latest_prediction.json       # Latest XGBoost prediction (auto-updated daily)
│   ├── latest_prediction_lstm.json  # Latest Conv-LSTM prediction (auto-updated daily)
│   ├── data/
│   │   ├── prediction_history.json      # XGBoost prediction log (rolling 365 days)
│   │   ├── prediction_history_lstm.json # Conv-LSTM prediction log (rolling 365 days)
│   │   └── news.json                    # Latest Bitcoin news headlines (auto-updated daily)
│   ├── models/
│   │   ├── xgb_model_target_y1.pkl      # XGBoost model — 1-day target
│   │   ├── xgb_model_target_y7.pkl      # XGBoost model — 7-day target
│   │   ├── xgb_model_target_y30.pkl     # XGBoost model — 30-day target
│   │   ├── lstm_target_y1.keras         # Conv-LSTM model — 1-day target
│   │   ├── lstm_target_y7.keras         # Conv-LSTM model — 7-day target
│   │   ├── lstm_target_y30.keras        # Conv-LSTM model — 30-day target
│   │   └── model_metadata.json          # Training config, metrics, days expanded
│   ├── data_pipeline/
│   │   ├── __init__.py                  # Package marker (for python -m imports)
│   │   ├── fetcher.py                   # OHLCV + FNG data ingestion
│   │   ├── feature_engineering.py       # Technical indicators + PCA
│   │   ├── preprocessor.py              # Inference input preparation
│   │   ├── sentiment_analysis.py        # LLM-based NLP sentiment (Gemini/Groq)
│   │   └── retrain.py                   # Model retraining script (weekly)
│   ├── requirements.txt                 # FastAPI dependencies
│   ├── requirements-inference.txt       # Inference dependencies (daily + retrain)
│   └── requirements-retrain.txt         # Lightweight retrain-only deps (no TensorFlow)
│
└── Frontend/
    └── nextide-markets-analytics/
        ├── app/
        │   ├── layout.tsx               # Root layout
        │   ├── page.tsx                 # Dashboard page (data fetching + chart logic)
        │   └── globals.css              # Design tokens + dark theme
        ├── src/
        │   ├── components/
        │   │   ├── ui/                  # Reusable: Card, Button, Badge, Loading
        │   │   └── dashboard/           # SignalWidget, PriceChart, SentimentGauge, etc.
        │   ├── contexts/
        │   │   └── ModelContext.tsx     # XGBoost / LSTM model switcher state
        │   ├── lib/
        │   │   ├── api.ts               # Data fetching (reads from GitHub raw CDN)
        │   │   ├── mockData.ts          # Fallback mock data
        │   │   └── utils.ts
        │   └── types/
        │       └── index.ts             # Shared TypeScript contracts
        └── next.config.ts
```

---

## Automated Workflows

Three GitHub Actions workflows run on schedule:

### 1. Daily Inference (00:10 UTC)
Runs `daily-inference.py`:
- Fetch 250 daily candles (BTC/USDT via CCXT)
- Fetch 65-day Fear & Greed Index history
- Engineer 30+ features: RSI, MACD, Bollinger Bands, log-returns, halving proximity, volatility regime, PCA components, FNG momentum
- Get live NLP sentiment from Gemini (fallback: Groq → 7-day history average → neutral)
- Run XGBoost inference (y1 / y7 / y30 targets)
- Run Conv-LSTM inference (y1 / y7 / y30 targets, non-fatal if TensorFlow unavailable)
- **Resolve prior unresolved entries** — backfill actual direction/price for yesterday's prediction
- Update `latest_prediction.json`, `latest_prediction_lstm.json`
- Append to `prediction_history.json` and `prediction_history_lstm.json` (with deduplication)
- Commit and push to `main`

### 2. Daily News Fetch (03:00 UTC)
Runs `fetch_news.py`:
- Fetch latest headlines from CoinTelegraph, CoinDesk, Bitcoin Magazine RSS feeds
- Save to `data/news.json`
- Commit and push to `main`

### 3. Weekly Retraining (Sundays 02:00 UTC)
Runs `retrain.py`:
- Expand training window incrementally: `training_days += 7` each week
- Fetch OHLCV data for new window (starting at 1000 days, capped at FNG API limit ~2500 days)
- Engineer features on full window
- Train new XGBoost models (y1 / y7 / y30)
- Compare new DA vs. old DA, **replace only if better**
- Update model artifacts + `model_metadata.json`
- Commit and push to `main`

All outputs are read by the frontend directly from GitHub's raw CDN — **no redeploy or API server restart needed**.

---

## Data Sources

The frontend reads all data directly from GitHub's raw CDN:

| Data | Source | Refresh |
|------|--------|---------|
| Latest predictions | `https://raw.githubusercontent.com/.../main/Backend/latest_prediction.json` | Daily 00:10 UTC |
| Prediction history | `https://raw.githubusercontent.com/.../main/Backend/data/prediction_history.json` | Daily 00:10 UTC |
| News headlines | `https://raw.githubusercontent.com/.../main/Backend/data/news.json` | Daily 03:00 UTC |
| Models | Git repository | Weekly Sun 02:00 UTC |

**FastAPI Server (Optional)**

A lightweight FastAPI server on Railway can optionally serve these same files (useful for non-public repos or additional filtering). Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/predict/daily?model=xgboost` | Latest prediction (xgboost \| lstm) |
| GET | `/api/history?days=90&model=xgboost` | Prediction history (1–365 days) |
| GET | `/api/backtest/30d?model=xgboost` | 30-day backtest metrics |
| GET | `/api/news` | Latest news headlines (real-time RSS, 15-min cache) |

**The FastAPI server is completely optional** — the dashboard is fully functional without it.

---

## Local Development

**Backend**
```bash
cd Backend
pip install -r requirements.txt
python daily-inference.py          # run inference once
uvicorn main:app --reload          # start API server at localhost:8000
```

**Frontend**
```bash
cd Frontend/nextide-markets-analytics
npm install
npm run dev                        # start dev server at localhost:3000
```

**Environment variables (frontend - optional)**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_USE_MOCK_DATA` | Set `true` to use mock data instead of GitHub raw (useful for offline dev) |

**GitHub Actions secrets required**

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (primary NLP sentiment) |
| `GROQ_API_KEY` | Groq API key (fallback NLP sentiment) |

---

## License

MIT
