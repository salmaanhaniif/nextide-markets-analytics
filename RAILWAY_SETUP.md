# Railway Deployment Guide

Deploy NexTide Analytics Backend to Railway in 5 minutes.

## Prerequisites

- GitHub account with your repo
- Railway account (https://railway.app - free tier available)
- No credit card required for free tier

## Quick Start

### 1. Connect GitHub Repository

1. Go to https://railway.app
2. Sign in / Sign up (GitHub login recommended)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `nextide-markets-analytics` repository
5. Authorize Railway to access your repo

### 2. Configure Python Environment

Railway should auto-detect:
- **Python Version**: 3.12 (from `runtime.txt`)
- **Build Command**: `pip install -r Backend/requirements.txt`
- **Start Command**: `cd Backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

If not auto-detected, set in Railway dashboard:
```
Build: pip install -r Backend/requirements.txt
Start: cd Backend && uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 3. Set Environment Variables

In Railway Dashboard → Variables:

```
# Required for sentiment analysis (GitHub Actions only, not needed on Railway)
GEMINI_API_KEY=<your-key-if-using>
GROQ_API_KEY=<your-key-if-using>

# Python settings
PYTHONUNBUFFERED=1
```

**Note**: You don't need API keys on Railway unless you're running inference. The backend just serves pre-generated predictions from GitHub.

### 4. Deploy

Click "Deploy" button. Railway will:
1. ✅ Clone your repo
2. ✅ Install dependencies (30-60 seconds)
3. ✅ Start FastAPI server on random port
4. ✅ Assign public URL (e.g., `nextide-api.up.railway.app`)

Deployment should complete in 1-2 minutes.

## Verify Deployment

Test your deployed API:

```bash
# Health check
curl https://your-api.up.railway.app/

# Expected response:
# {
#   "status": "online",
#   "service": "NexTide Analytics Backend",
#   "version": "2.1.0",
#   ...
# }

# Get status
curl https://your-api.up.railway.app/api/status

# Get latest prediction
curl https://your-api.up.railway.app/api/predict/daily?model=xgboost

# Get documentation
https://your-api.up.railway.app/docs
```

## API Endpoints

All endpoints are available at `https://your-api.up.railway.app`:

### Core Endpoints
- `GET /` - Health check
- `GET /api/status` - Backend status & data freshness
- `GET /api/predict/daily` - Latest prediction (XGBoost or LSTM)
- `GET /api/history` - Prediction history (1-365 days)
- `GET /api/backtest/30d` - 30-day backtest metrics
- `GET /api/news` - Latest Bitcoin news (cached 15 min)

### Admin Endpoints (optional)
- `POST /api/inference/run` - Manually trigger inference (requires API keys set)

### API Docs
- `GET /docs` - Interactive Swagger UI
- `GET /openapi.json` - OpenAPI schema

## Data Synchronization

Railway deploys from git, so data stays in sync:

1. **GitHub Actions** runs daily (00:10 UTC):
   - Generates `Backend/latest_prediction.json`
   - Commits to main branch
   - Railway auto-redeploys with latest data

2. **Weekly Retrain** runs (Sunday 02:00 UTC):
   - Retrains models
   - Updates `Backend/models/*`
   - Commits to main branch
   - Railway auto-redeploys with new models

**No manual sync needed!** Railway watches main branch for changes.

## Performance & Costs

### Costs (Free Tier)
- **Compute**: 5 GB-hours/month free (~$0)
- **Network**: Unlimited egress free
- **Status**: Stays on free tier for this use case

Your deployment will stay on free tier because:
- ✅ Low traffic (not real-time data processing)
- ✅ No database needed (data stored in git)
- ✅ Minimal CPU usage (just serving static JSON files)
- ✅ RSS news cache keeps external API calls low

### Upgrade to Premium (Optional)
- $5/month for dedicated resources (if needed)
- Pay-as-you-go after free tier exhaustion
- Optional domain mapping (your-domain.com)

## Monitoring & Logs

### View Logs
In Railway Dashboard:
1. Select your project
2. Click "Deployments"
3. Click latest deployment
4. View "Logs" tab

Or use Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway logs
```

### Monitor Uptime
Check your API regularly:
```bash
# Add to your monitoring service
curl -f https://your-api.up.railway.app/ || alert "API down"
```

### Common Issues

**"Deploy failed - pip install error"**
- Check Backend/requirements.txt is correct
- Ensure no binary dependencies missing for Linux
- Check internet connectivity during build

**"Connection timeout"**
- Railway might be building (1-2 min normal)
- Check deployment logs
- Verify PORT environment variable is set

**"404 on /api/predict/daily"**
- GitHub Actions may not have run yet
- Check `Backend/latest_prediction.json` exists in repo
- Manually trigger GitHub Actions workflow

**"Stale data (> 24 hours old)"**
- Check GitHub Actions workflows status
- Verify `daily-inference.yml` workflow is enabled
- Check GEMINI_API_KEY / GROQ_API_KEY are valid

## Scaling

Railway automatically scales, but unlikely needed for this app:

- **Current usage**: ~10-50 MB disk, <50 MB RAM
- **Concurrent users**: Can handle 1000s simultaneously
- **Requests/sec**: Easily handles 100+ RPS on free tier

If you hit rate limits:
1. Upgrade to Railway Pro ($5/month)
2. Add caching layer (Cloudflare, 1 GB free)
3. Enable Railway's built-in Redis cache

## Update & Rollback

### Deploy Updates
Just push to main:
```bash
git add .
git commit -m "fix: update models"
git push origin main
```

Railway auto-detects changes and redeploys (2-5 min).

### Rollback to Previous Version
```bash
# In Railway Dashboard:
1. Click "Deployments" tab
2. Find previous working deployment
3. Click "Redeploy"
# Takes 1-2 minutes
```

Or via git:
```bash
git revert HEAD
git push origin main
# Railway auto-redeploys
```

## Custom Domain (Optional)

Railway includes free `your-project.up.railway.app` domain.

To use custom domain (e.g., `api.mysite.com`):
1. Railway Dashboard → "Settings" → "Domains"
2. Add custom domain
3. Update DNS to point to Railway
4. Enable HTTPS (automatic)

Cost: Same as deployment (free tier or premium).

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test API at /docs
3. ✅ Share URL with frontend team
4. ✅ Monitor logs for errors
5. (Optional) Add custom domain
6. (Optional) Upgrade to Railway Pro for production

## Support

- Railway Docs: https://docs.railway.app
- Railway Status: https://status.railway.app
- Discord Help: https://discord.gg/railway

---

**Deployment URL**: Will be shown in Railway Dashboard after deploy completes  
**Status**: Ready for production ✅  
**Last Updated**: 2026-05-14
