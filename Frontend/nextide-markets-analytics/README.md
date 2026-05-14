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

## 📡 Data Sources

The frontend reads data directly from **GitHub's raw CDN**:

- **Predictions**: `raw.githubusercontent.com/.../Backend/latest_prediction.json`
- **History**: `raw.githubusercontent.com/.../Backend/data/prediction_history.json`
- **News**: `raw.githubusercontent.com/.../Backend/data/news.json`

**No backend API required** — the dashboard is fully functional without a server. Data is refreshed automatically by GitHub Actions workflows.

Optional: A FastAPI fallback server can be enabled if you want to serve data from a custom backend, but it's not necessary for the core dashboard functionality.

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

### GitHub Raw CDN Timeout
To adjust the GitHub CDN request timeout, edit `src/lib/api.ts`:

```typescript
const githubClient = axios.create({ 
  timeout: 15000 // Change to your desired timeout in ms
});
```

## 🐛 Troubleshooting

### Data Not Loading
- Check that you have internet access (GitHub raw CDN requires it)
- Verify the GitHub repository is public
- Check browser console for CORS or network errors
- If GitHub is unreachable, set `NEXT_PUBLIC_USE_MOCK_DATA=true` to use fallback mock data

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
