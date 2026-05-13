# Crypto MLOps Dashboard - Frontend

A modern, responsive Next.js dashboard for visualizing Bitcoin price predictions powered by AI/ML models. This application provides real-time trading signals, market sentiment analysis, and interactive price charts.

## 🚀 Features

- **AI Trading Signals**: Real-time BUY/SELL/HOLD recommendations with confidence scores
- **Price Predictions**: 24-hour Bitcoin price forecasts using XGBoost models
- **Market Sentiment**: Fear & Greed Index and NLP sentiment analysis visualization
- **Feature Insights**: Understand which factors are driving the AI's predictions
- **Interactive Charts**: Historical price trends with predicted values using Recharts
- **Dark Theme**: Eye-friendly dark mode optimized for traders
- **Auto-Refresh**: Automatic data updates every 5 minutes
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **State Management**: React Hooks

## 📁 Project Structure

```
crypto-nextide-analytics/
├── app/
│   ├── layout.tsx          # Root layout with header and footer
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles and color palette
├── src/
│   ├── components/
│   │   ├── ui/             # Reusable UI components
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Loading.tsx
│   │   │   └── ErrorMessage.tsx
│   │   └── dashboard/      # Dashboard-specific components
│   │       ├── SignalWidget.tsx
│   │       ├── PriceChart.tsx
│   │       ├── SentimentGauge.tsx
│   │       └── FeatureInsights.tsx
│   ├── lib/
│   │   ├── api.ts          # API client functions
│   │   └── utils.ts        # Utility functions
│   └── types/
│       └── index.ts        # TypeScript type definitions
├── public/                 # Static assets
├── .env.local             # Environment variables
└── package.json           # Dependencies and scripts
```

## 🎨 Color Palette

The dashboard uses a carefully selected dark theme optimized for financial data visualization:

- **Background**: `#0F172A` (Dark slate)
- **Surface**: `#1E293B` (Elevated dark)
- **Primary**: `#3B82F6` (Electric blue)
- **Success/Bullish**: `#10B981` (Neon green)
- **Danger/Bearish**: `#EF4444` (Neon red)
- **Warning/Hold**: `#F59E0B` (Amber)
- **Text Primary**: `#F8FAFC` (Off-white)
- **Text Secondary**: `#94A3B8` (Muted gray)

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:8000` (or configure in `.env.local`)

### Installation

1. **Clone the repository** (if not already done):
   ```bash
   cd Frontend/crypto-nextide-analytics
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and set your API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

## 📡 API Integration

The frontend expects the following API endpoints from the backend:

### GET `/api/predict/daily`
Returns the daily prediction with AI signal.

**Response:**
```json
{
  "predicted_price": 45000.50,
  "ai_signal": "BUY",
  "confidence": 0.85,
  "current_price": 43500.00,
  "timestamp": "2026-05-11T10:30:00Z",
  "market_sentiment": {
    "fear_and_greed_index": 65,
    "nlp_sentiment_score": 0.45,
    "sentiment_label": "Greed",
    "news_summary": "Market shows positive momentum..."
  },
  "feature_importance": [
    {
      "feature_name": "Trading Volume",
      "importance_score": 0.35,
      "impact": "positive",
      "description": "High trading volume indicates strong market interest"
    }
  ]
}
```

### GET `/api/historical?days=30`
Returns historical price data for charts.

**Response:**
```json
[
  {
    "date": "2026-05-10",
    "actual_price": 43500.00,
    "predicted_price": 43450.00,
    "volume": 1234567890
  }
]
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

## 🎯 Component Overview

### SignalWidget
Displays the main AI trading signal (BUY/SELL/HOLD) with confidence score and price comparison.

### PriceChart
Interactive line chart showing historical prices and predictions using Recharts library.

### SentimentGauge
Visualizes market sentiment with Fear & Greed Index gauge and NLP sentiment score.

### FeatureInsights
Shows the top 5 features influencing the AI model's prediction with importance scores.

## 🔧 Configuration

### Auto-Refresh Interval
By default, the dashboard refreshes data every 5 minutes. To change this, modify the interval in `app/page.tsx`:

```typescript
// Change 5 * 60 * 1000 to your desired interval in milliseconds
const interval = setInterval(() => {
  loadData();
}, 5 * 60 * 1000); // 5 minutes
```

### API Timeout
To adjust the API timeout, edit `src/lib/api.ts`:

```typescript
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Change to your desired timeout in ms
});
```

## 🐛 Troubleshooting

### API Connection Issues
- Ensure the backend is running on the correct port
- Check `.env.local` has the correct `NEXT_PUBLIC_API_URL`
- Verify CORS is enabled on the backend

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

### Chart Not Rendering
- Ensure historical data is being returned from the API
- Check browser console for errors
- Verify data format matches the expected TypeScript types

## 📝 Development Tips

### Adding New Components
1. Create component in appropriate directory (`ui/` or `dashboard/`)
2. Use TypeScript for type safety
3. Follow the existing naming conventions
4. Import and use in `app/page.tsx`

### Styling Guidelines
- Use CSS variables defined in `globals.css` for colors
- Follow Tailwind CSS utility-first approach
- Maintain consistent spacing and sizing
- Test responsiveness on multiple screen sizes

### Type Safety
All API responses should have corresponding TypeScript interfaces in `src/types/index.ts`.

## 📄 License

This project is part of the Bitcoin MLOps Dashboard system.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support

For issues or questions, please open an issue in the repository.

---

**⚠️ Disclaimer**: This dashboard provides AI-generated predictions for informational purposes only. Cryptocurrency trading involves substantial risk. Always conduct your own research before making investment decisions.
