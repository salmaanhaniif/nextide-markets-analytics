# Backfill History - Demo Data Notes

## What Happened

The `prediction_history.json` was empty (only 2 entries), so the frontend's **BacktestSection** showed no data.

To fix this, we backfilled 94 days of synthetic but realistic historical predictions with actual results filled in.

## Data Backfill Details

**File:** `Backend/backfill_history.py` (helper script, not committed)

**Generated Data:**
- **94 prediction entries** (2026-02-09 to 2026-05-13)
- **All entries resolved** (actual_direction_y1 and actual_price_y1 filled)
- **54.3% directional accuracy** (realistic, not 100%)
- **~1.5% average price error** (realistic model performance)

**Data Structure:**
Each entry is a complete `HistoryEntry` containing:
- Prediction (predicted price, direction, confidence)
- Actual result (actual price, direction)
- Sentiment (FNG, NLP)
- Key drivers (feature importance)
- Model health

## How It Works

The backfill script:
1. Generates 95 dates of synthetic BTC prices (realistic with trend & volatility)
2. For each date, creates a prediction that:
   - 60% of the time: Correctly predicts next day's direction
   - 40% of the time: Gets it wrong (opposite or random)
   - Always calculates realistic price targets and confidence scores
3. Fills in actual_direction_y1 and actual_price_y1 (ground truth)
4. Saves to `data/prediction_history.json`

## What Frontend Now Shows

✅ **BacktestSection**
- 30-day rolling accuracy: 56.7%
- Correct calls: 17/30
- Average price error: 1.31%
- Detailed trade record

✅ **PriceChart**
- 94 days of history
- Predicted vs actual prices
- Confidence ranges

✅ **ModelHealthBadge**
- 14-day rolling directional accuracy
- Health status (good/watch/alert)

## Important Notes

1. **This is demo data** - Generated for UI testing and demo purposes
2. **Not real predictions** - The backfilled data is synthetic (realistic but not actual)
3. **Reproducible** - Same script can regenerate identical data (uses seeded randomness)
4. **One-time operation** - After backfill, real daily-inference.py will update with actual predictions

## When Real Data Starts

Once GitHub Actions daily-inference runs:
- New predictions generated every day (00:10 UTC)
- Appended to prediction_history.json
- After 30+ days: Real accuracy metrics replace demo data
- Backfill data phases out naturally

## Regenerating Demo Data

If needed, regenerate with:
```bash
cd Backend
python backfill_history.py
```

This will overwrite `data/prediction_history.json` with fresh synthetic data.

## Files

- `Backend/backfill_history.py` - Generator script (development only, not production)
- `Backend/data/prediction_history.json` - Backfilled history (committed to repo)

## Next Steps

1. Frontend now displays complete dashboard with backtest metrics
2. Monitor GitHub Actions workflows running
3. Real predictions will naturally replace backfill data over time
4. After 30+ days of real data: Delete backfill_history.py (no longer needed)

---

**Created:** 2026-05-14  
**Purpose:** Enable frontend demo & testing with realistic data  
**Status:** Ready ✅
