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

## Model Training

Models are trained on BTC/USDT daily OHLCV data from 2017-01-01 onwards, using an 80/20 train-test split.
See [Research-Modelling notebooks](Research-Modelling/) for training methodology and evaluation details.

Weekly retraining (Sundays 02:00 UTC) expands the training window with new data, ensuring models adapt to market evolution while preserving historical context from 2017.

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
- Zero infrastructure cost (GitHub Actions + Vercel)
- No database needed (JSON in git = version control + audit log)
- No API server runtime overhead (data served via CDN)
- Fully automated (cron-driven, no manual deployment)
- Scalable (CDN handles traffic spikes)

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
├── Backend/                         # Production ML inference & API
│   ├── main.py                      # FastAPI server (optional backend)
│   ├── daily-inference.py           # Daily inference pipeline (entry point)
│   ├── fetch_news.py                # News fetcher from RSS feeds
│   ├── data_pipeline/
│   │   ├── fetcher.py               # OHLCV + FNG data fetching (2017-01-01 onwards)
│   │   ├── feature_engineering.py   # 30+ technical indicators + PCA
│   │   ├── preprocessor.py          # Inference input preparation
│   │   ├── sentiment_analysis.py    # LLM-based NLP sentiment (Gemini/Groq fallback)
│   │   └── retrain.py               # Weekly model retraining (Sunday 02:00 UTC)
│   ├── data/
│   │   ├── prediction_history.json           # XGBoost history (95+ days)
│   │   ├── prediction_history_lstm.json      # LSTM history (95+ days)
│   │   └── news.json                        # Latest news headlines
│   ├── models/
│   │   ├── xgb_model_target_y1.pkl          # XGBoost 1-day model
│   │   ├── xgb_model_target_y7.pkl          # XGBoost 7-day model
│   │   ├── xgb_model_target_y30.pkl         # XGBoost 30-day model
│   │   ├── feature_scaler.pkl               # MinMaxScaler for features
│   │   ├── pca_transformer.pkl              # PCA (11 components)
│   │   ├── target_scaler_target_y*.pkl      # Target value scalers
│   │   ├── model_metadata.json              # Training metadata (start_date, row counts)
│   |   ├── latest_prediction.json               # Latest XGBoost prediction (daily)
│   |   └── latest_prediction_lstm.json          # Latest LSTM prediction (daily)
│   ├── requirements.txt                     # FastAPI + all inference deps
│   ├── requirements-inference.txt           # Daily inference deps
│   ├── requirements-retrain.txt             # Weekly retrain deps
│   └── .env.example                        # Environment template
│
├── Frontend/                        # Next.js dashboard (Vercel)
│   └── nextide-markets-analytics/
│       ├── app/
│       │   ├── page.tsx             # Main dashboard
│       │   ├── layout.tsx           # Root layout
│       │   └── globals.css          # Dark theme + design tokens
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/              # Button, Card, Badge, Loading, ErrorMessage
│       │   │   └── dashboard/       # SignalWidget, PriceChart, SentimentGauge, FeatureInsights, etc.
│       │   ├── contexts/
│       │   │   └── ModelContext.tsx # XGBoost/LSTM model switcher
│       │   ├── lib/
│       │   │   ├── api.ts           # GitHub raw CDN fetching
│       │   │   ├── mockData.ts      # Fallback demo data
│       │   │   └── utils.ts         # Formatting, calculations
│       │   └── types/
│       │       └── index.ts         # TypeScript contracts (matches Backend API)
│       └── package.json
│
├── Research-Modelling/             # Jupyter notebooks (training & analysis)
│   └── bitcoin_research_notebook.ipynb   # Main research notebook (2017 start date)
└── README.md                    # This file
```


**Data Pipeline:**
- `fetcher.py` - Uses fixed `START_DATE='2017-01-01'` (not rolling window)
- `retrain.py` - Direct overwrites (no `_prev` backups), tracks `start_date` metadata

demo data
- `complete_history.py` - Align LSTM history with XGBoost

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

## Data Sources & APIs

### Frontend Data Flow

Frontend reads predictions from **GitHub's raw CDN** (no backend required):

```
GitHub Actions (automated)
  ├─ Daily 00:10 UTC: daily-inference.py → latest_prediction.json
  ├─ Daily 03:00 UTC: fetch_news.py → data/news.json
  └─ Weekly Sun 02:00 UTC: retrain.py → models/*.pkl
       ↓
GitHub Repository (auto-updated with latest files)
       ↓
GitHub raw CDN (global edge cache)
       ↓
Frontend (Vercel) reads via HTTPS
  ├─ /Backend/latest_prediction.json
  ├─ /Backend/latest_prediction_lstm.json
  ├─ /Backend/data/prediction_history.json
  ├─ /Backend/data/prediction_history_lstm.json
  └─ /Backend/data/news.json
```

### Optional: FastAPI Backend

A self-contained FastAPI server can optionally be deployed to serve the same data:

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `GET /api/predict/daily?model=xgboost\|lstm` | Latest prediction |
| `GET /api/history?days=90&model=xgboost\|lstm` | History (1-365 days) |
| `GET /api/backtest/30d?model=xgboost\|lstm` | 30-day backtest metrics |
| `GET /api/news?limit=8` | Live news from RSS (cached 15 min) |
| `GET /api/status` | Backend status & data freshness |

**Why optional?**
- Frontend works without it (reads from GitHub raw CDN)
- No database needed (data stored in git)

---

## Local Development

### Backend (FastAPI)

```bash
cd Backend
pip install -r requirements.txt
python daily-inference.py          # Run inference once
uvicorn main:app --reload          # Start API at http://localhost:8000

```

**Environment variables (.env in Backend/)**

```env
GEMINI_API_KEY=your_key_here       # Google Gemini (primary sentiment)
GROQ_API_KEY=your_key_here         # Groq API (fallback sentiment)
```

### Frontend (Next.js)

```bash
cd Frontend/nextide-markets-analytics
npm install
npm run dev                         # Start at http://localhost:3000
```

**Environment variables (.env.local)**

```env
# Optional: use mock data offline
NEXT_PUBLIC_USE_MOCK_DATA=true
```

### GitHub Actions Secrets

Required for automated workflows:

| Secret | Description | Source |
|--------|-------------|--------|
| `GEMINI_API_KEY` | Google Gemini API key | https://ai.google.dev/ |
| `GROQ_API_KEY` | Groq API key (fallback) | https://console.groq.com/ |
| `GITHUB_TOKEN` | Auto-generated (no action needed) | GitHub |

---

## License

MIT
