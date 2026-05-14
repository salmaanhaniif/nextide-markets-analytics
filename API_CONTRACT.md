# Frontend ↔ Backend API Contract

Complete specification of what frontend requests and what backend must return.

## Overview

Frontend (Next.js on Vercel) calls backend API endpoints to get:
1. Latest predictions (XGBoost or LSTM)
2. Historical predictions (for charts & backtest)
3. Real-time news headlines
4. System status & health

All responses are JSON. Backend must return exact structure or frontend will crash.

---

## Endpoint: `/api/predict/daily`

**Frontend Call:**
```typescript
fetchDailyPrediction(model: 'xgboost' | 'lstm'): Promise<DailyPrediction>
```

**Request:**
```
GET /api/predict/daily?model=xgboost
GET /api/predict/daily?model=lstm
```

**Response:** `DailyPrediction`

```json
{
  "meta": {
    "generated_at": "2026-05-14T07:39:24Z",
    "model_version": "2026-05-12",
    "model_id": "xgboost",
    "data_as_of": "2026-05-14"
  },
  "current": {
    "price": 79933.24,
    "fng_score": -0.32,
    "fng_label": "Fear",
    "nlp_sentiment": -0.475,
    "nlp_status": "fallback_7d_avg",
    "nlp_reasoning": "..."  // optional
  },
  "predictions": {
    "y1": {
      "target_date": "2026-05-15",
      "predicted_log_return": 0.001005,
      "predicted_price": 80013.59,
      "price_change_pct": 0.1005,
      "direction": "UP",
      "confidence": 0.5104,
      "range_low": 78857.61,
      "range_high": 81186.51
    },
    "y7": { /* same structure */ },
    "y30": { /* same structure */ }
  },
  "signal": {
    "action": "HOLD|BUY|STRONG_BUY|SELL|STRONG_SELL",
    "strength": "LOW_CONFIDENCE|MODERATE|STRONG",
    "reasoning": "Model confidence 51% below threshold..."
  },
  "key_drivers": [
    {
      "feature": "pca_components",
      "importance": 0.25,
      "label": "Technical Pattern (PCA)"
    },
    // ... 4 more drivers
  ],
  "model_health": {
    "rolling_da_14d": 0.52,
    "status": "good|watch|alert|insufficient_data"
  }
}
```

**Error Cases:**
- 503 if data not yet generated (GitHub Actions hasn't run)
- 500 if file malformed

**Frontend Usage:**
- Displays in SignalWidget (action, confidence, price target)
- Generates trading signal text
- Shows key drivers in FeatureInsights
- Displays current sentiment in SentimentGauge
- Shows model health badge

---

## Endpoint: `/api/history`

**Frontend Call:**
```typescript
fetchHistory(days: number, model: 'xgboost' | 'lstm'): Promise<HistoryEntry[]>
```

**Request:**
```
GET /api/history?days=90&model=xgboost
GET /api/history?days=365&model=lstm
```

**Response:** `HistoryEntry[]`

Array of DailyPrediction snapshots (same structure as above) with additional fields:

```json
[
  {
    "meta": { ... },
    "current": { ... },
    "predictions": { ... },
    "signal": { ... },
    "key_drivers": [ ... ],
    "model_health": { ... },
    // ↓ HISTORY SPECIFIC ↓
    "actual_direction_y1": "UP" | "DOWN" | null,
    "actual_price_y1": 80234.56 | null
  },
  // ... more entries
]
```

**Important:**
- Array is newest-last (oldest first, newest at end)
- `actual_direction_y1` and `actual_price_y1` are **null while target_date hasn't passed**
- After target_date passes, daily inference fills them in
- Frontend uses this for chart data and backtest metrics

**Frontend Usage:**
- Chart data (price, predicted, confidence range)
- Backtest calculation (directional accuracy)
- Historical trend analysis

---

## Endpoint: `/api/backtest/30d`

**Frontend Call:**
```typescript
fetchBacktest(model: 'xgboost' | 'lstm'): Promise<BacktestResponse>
```

**Request:**
```
GET /api/backtest/30d?model=xgboost
GET /api/backtest/30d?model=lstm
```

**Response:** `BacktestResponse`

```json
{
  "period_days": 30,
  "directional_accuracy": 0.5833,
  "correct_calls": 7,
  "total_calls": 12,
  "avg_price_error_pct": 2.34,
  "records": [
    {
      "meta": { "data_as_of": "2026-04-14" },
      "current": { "price": 67234.45 },
      "predictions": { "y1": { "predicted_price": 67890.23, "direction": "UP" } },
      "actual_direction_y1": "UP",
      "actual_price_y1": 68234.56,
      // ... rest of DailyPrediction fields
    },
    // ... more resolved entries
  ]
}
```

**Important:**
- Only includes entries where `actual_direction_y1` is NOT null (resolved predictions)
- If < 30 resolved entries, returns fewer with accurate `period_days`
- If no resolved entries, returns empty with status message

**Frontend Usage:**
- BacktestSection (shows accuracy metrics)
- Model health assessment
- Confidence in model performance

---

## Endpoint: `/api/news`

**Frontend Call:**
```typescript
fetchNews(): Promise<NewsHeadline[]>
```

**Request:**
```
GET /api/news?limit=8
```

**Response:** `NewsHeadline[]`

```json
[
  {
    "title": "Bitcoin Surges on Fed Comments",
    "link": "https://cointelegraph.com/...",
    "published": "Mon, 13 May 2026 14:32:15 GMT"
  },
  {
    "title": "Crypto Market Shows Signs of Recovery",
    "link": "https://coindesk.com/...",
    "published": "2026-05-13T14:32:15Z"
  }
  // ... more headlines
]
```

**Important:**
- Live fetched from RSS (not stored in git)
- Cached 15 minutes to avoid hammering feeds
- `published` field may be RFC-2822 or ISO (from RSS feeds)
- If RSS fails, returns empty array gracefully

**Frontend Usage:**
- NewsSection (displays latest headlines)
- Links open in new tab
- Sentiment context for market analysis

---

## Endpoint: `/api/status`

**Frontend Call:** (Optional, not used in current dashboard)
```typescript
fetch('/api/status').then(r => r.json())
```

**Request:**
```
GET /api/status
```

**Response:**
```json
{
  "timestamp": "2026-05-14T16:45:23.123456Z",
  "status": "operational",
  "data_freshness": {
    "latest_prediction_age_hours": 2.5,
    "latest_lstm_age_hours": 2.5,
    "history_xgboost_records": 145,
    "history_lstm_records": 32,
    "news_cache_expires_in_seconds": 412
  },
  "file_sizes_kb": {
    "latest_prediction": 4.2,
    "history_xgboost": 187.3,
    "history_lstm": 45.6
  },
  "pipeline_info": {
    "daily_inference_time_utc": "00:10 UTC (daily)",
    "weekly_retrain_time_utc": "02:00 UTC (Sundays)",
    "news_fetch_time_utc": "03:00 UTC (daily)"
  },
  "recommendation": "Data is fresh. All systems operational."
}
```

**Frontend Usage:**
- Debugging data freshness
- System status checks
- Verifying pipeline execution

---

## Endpoint: `/api/inference/run` (Admin)

**Frontend Call:** (Not called by frontend, admin only)
```
POST /api/inference/run
```

**Response:**
```json
{
  "status": "inference_triggered",
  "data_fetched": {
    "ohlcv_rows": 250,
    "fng_rows": 65,
    "nlp_sentiment": -0.35
  },
  "note": "Run daily-inference.py to complete the pipeline",
  "timestamp": "2026-05-14T16:45:23.123456Z"
}
```

**Usage:** Manual trigger for testing/debugging (requires API keys)

---

## Type Definitions (from Frontend)

```typescript
// TypeScript types in Frontend/src/types/index.ts

export type SignalAction = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
export type SignalStrength = 'LOW_CONFIDENCE' | 'MODERATE' | 'STRONG';
export type NlpStatus = 'live' | 'fallback_7d_avg' | 'unavailable';
export type ModelHealthStatus = 'good' | 'watch' | 'alert' | 'insufficient_data';
export type FngLabel = 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';

export interface DailyPrediction {
  meta: {
    generated_at: string;        // ISO 8601
    model_version: string;       // Date or version identifier
    data_as_of: string;          // YYYY-MM-DD
  };
  current: {
    price: number;               // Current BTC price
    fng_score: number;           // -1.0 to 1.0 (Extreme Fear to Extreme Greed)
    fng_label: FngLabel;
    nlp_sentiment: number;       // -1.0 to 1.0
    nlp_status: NlpStatus;
    nlp_reasoning?: string;      // Optional explanation
  };
  predictions: {
    y1: HorizonPrediction;
    y7: HorizonPrediction;
    y30: HorizonPrediction;
  };
  signal: {
    action: SignalAction;
    strength: SignalStrength;
    reasoning: string;
  };
  key_drivers: Array<{
    feature: string;
    importance: number;          // 0 to 1
    label: string;
  }>;
  model_health: {
    rolling_da_14d: number | null;
    status: ModelHealthStatus;
  };
}

export interface HistoryEntry extends DailyPrediction {
  actual_direction_y1: 'UP' | 'DOWN' | null;
  actual_price_y1: number | null;
}

export interface BacktestResponse {
  period_days: number;
  directional_accuracy: number;
  correct_calls: number;
  total_calls: number;
  avg_price_error_pct: number | null;
  records: HistoryEntry[];
}

export interface NewsHeadline {
  title: string;
  link: string;
  published: string;
}
```

---

## Data Flow

```
Backend (Railway)
  ├─ latest_prediction.json (from daily-inference.py)
  ├─ latest_prediction_lstm.json
  ├─ data/prediction_history.json
  ├─ data/prediction_history_lstm.json
  └─ data/news.json (from fetch_news.py)
       ↓
  FastAPI endpoints:
    /api/predict/daily ──→ reads JSON file
    /api/history ────────→ reads JSON, slices N days
    /api/backtest/30d ───→ reads JSON, computes metrics
    /api/news ──────────→ fetches live RSS (cached)
       ↓
Frontend (Vercel)
  ├─ fetchDailyPrediction() ──→ SignalWidget, FeatureInsights, etc.
  ├─ fetchHistory(365) ───────→ PriceChart, BacktestSection
  ├─ fetchBacktest() ────────→ BacktestSection, ModelHealthBadge
  └─ fetchNews() ─────────────→ NewsSection
```

---

## Data Freshness

| Endpoint | Source | Updated | Lag |
|----------|--------|---------|-----|
| `/api/predict/daily` | GitHub Actions (00:10 UTC) | Daily | 0-24 hours |
| `/api/history` | GitHub Actions (00:10 UTC) | Daily | 0-24 hours |
| `/api/backtest/30d` | GitHub Actions (00:10 UTC) | Daily | 0-24 hours |
| `/api/news` | Live RSS fetch | Live | 0-15 min cache |

---

## Error Handling

**Frontend expects:**
- 200 OK: Data is fresh and available
- 503 Service Unavailable: Data not yet generated (use mock data fallback)
- 500 Internal Server Error: File is malformed (use mock data fallback)

**Frontend behavior:**
- Retries once on 503
- Falls back to mock data if API fails
- Shows loading skeleton while fetching

---

## Testing

To verify backend matches frontend expectations:

```bash
# Test latest prediction
curl http://localhost:8000/api/predict/daily?model=xgboost | jq .

# Test 30-day history
curl http://localhost:8000/api/history?days=30&model=xgboost | jq 'length'

# Test backtest
curl http://localhost:8000/api/backtest/30d?model=xgboost | jq '.directional_accuracy'

# Test news
curl http://localhost:8000/api/news?limit=5 | jq '.[0].title'

# Test status
curl http://localhost:8000/api/status | jq '.status'
```

All responses should match the structures above.

---

**Last Updated:** 2026-05-14  
**Status:** Production Ready ✅  
**Frontend Compatibility:** 100%
