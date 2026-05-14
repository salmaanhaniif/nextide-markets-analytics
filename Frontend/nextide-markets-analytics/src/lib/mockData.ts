import type {
    DailyPrediction,
    HistoryEntry,
    BacktestResponse,
    NewsHeadline,
} from '@/src/types';

export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

const CURRENT_PRICE = 82210.07;

// XGBoost mock — bullish, moderate confidence
export const mockDailyPrediction: DailyPrediction = {
    meta: {
        generated_at: new Date().toISOString(),
        model_version: '2026-05-12',
        data_as_of: '2026-05-11',
    },
    current: {
        price: CURRENT_PRICE,
        fng_score: 0.24,
        fng_label: 'Greed',
        nlp_sentiment: 0.45,
        nlp_status: 'live',
        nlp_reasoning: 'ETF inflows positive; Fed commentary neutral.',
    },
    predictions: {
        y1: {
            target_date: '2026-05-13',
            predicted_log_return: 0.0152,
            predicted_price: 83470.32,
            price_change_pct: 1.53,
            direction: 'UP',
            confidence: 0.67,
            range_low: 80850.0,
            range_high: 85200.0,
        },
        y7: {
            target_date: '2026-05-19',
            predicted_log_return: 0.0421,
            predicted_price: 85742.18,
            price_change_pct: 4.30,
            direction: 'UP',
            confidence: 0.71,
            range_low: 79100.0,
            range_high: 92800.0,
        },
        y30: {
            target_date: '2026-06-11',
            predicted_log_return: 0.0915,
            predicted_price: 90091.4,
            price_change_pct: 9.59,
            direction: 'UP',
            confidence: 0.74,
            range_low: 75500.0,
            range_high: 108200.0,
        },
    },
    signal: {
        action: 'BUY',
        strength: 'MODERATE',
        reasoning: 'Model predicts +1.5% with bullish sentiment momentum.',
    },
    key_drivers: [
        { feature: 'pca_components', importance: 0.482, label: 'Technical Pattern (PCA)' },
        { feature: 'fng_momentum', importance: 0.118, label: 'Sentiment Momentum' },
        { feature: 'nlp_sentiment_score', importance: 0.097, label: 'News Sentiment (NLP)' },
        { feature: 'fng_score', importance: 0.089, label: 'Fear & Greed Score' },
        { feature: 'fng_7d_avg', importance: 0.076, label: 'Sentiment 7-Day Avg' },
    ],
    model_health: {
        rolling_da_14d: 0.57,
        status: 'good',
    },
};

// LSTM mock — mirrors real LSTM output shape: bearish y1/y30, lower confidence
export const mockLstmDailyPrediction: DailyPrediction = {
    meta: {
        generated_at: new Date().toISOString(),
        model_version: '2026-05-12',
        data_as_of: '2026-05-11',
    },
    current: {
        price: CURRENT_PRICE,
        fng_score: 0.24,
        fng_label: 'Greed',
        nlp_sentiment: 0.45,
        nlp_status: 'live',
    },
    predictions: {
        y1: {
            target_date: '2026-05-13',
            predicted_log_return: -0.0041,
            predicted_price: 81872.44,
            price_change_pct: -0.41,
            direction: 'DOWN',
            confidence: 0.5043,
            range_low: 80720.0,
            range_high: 83050.0,
        },
        y7: {
            target_date: '2026-05-19',
            predicted_log_return: 0.0280,
            predicted_price: 84556.60,
            price_change_pct: 2.80,
            direction: 'UP',
            confidence: 0.79,
            range_low: 78200.0,
            range_high: 91100.0,
        },
        y30: {
            target_date: '2026-06-11',
            predicted_log_return: -0.0044,
            predicted_price: 81847.69,
            price_change_pct: -0.44,
            direction: 'DOWN',
            confidence: 0.5458,
            range_low: 73000.0,
            range_high: 91800.0,
        },
    },
    signal: {
        action: 'HOLD',
        strength: 'LOW_CONFIDENCE',
        reasoning: 'Model confidence 50% below threshold — waiting for clearer signal.',
    },
    key_drivers: [
        { feature: 'technical_sequence', importance: 0.620, label: 'Technical Sequence (Conv-LSTM)' },
        { feature: 'fng_score',          importance: 0.148, label: 'Fear & Greed Score' },
        { feature: 'nlp_sentiment_score',importance: 0.112, label: 'News Sentiment (NLP)' },
        { feature: 'fng_7d_avg',         importance: 0.074, label: 'Sentiment 7-Day Avg' },
        { feature: 'fng_momentum',        importance: 0.046, label: 'Sentiment Momentum' },
    ],
    model_health: {
        rolling_da_14d: 0.49,
        status: 'watch',
    },
};

// Seeded pseudo-random for stable mock data across renders
function seededRand(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// correctThreshold: r2 threshold for y1 prediction accuracy
//   0.38 → ~62% correct (XGBoost)   0.51 → ~49% correct (LSTM)
function buildMockHistory(base: DailyPrediction, correctThreshold: number, seedOffset: number): HistoryEntry[] {
    const entries: HistoryEntry[] = [];
    let price = 58000;
    const today = new Date();

    for (let i = 365; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);

        const r1 = seededRand(i * 3 + seedOffset);
        const r2 = seededRand(i * 7 + 1 + seedOffset);
        const r3 = seededRand(i * 11 + 2 + seedOffset);
        const r4 = seededRand(i * 13 + 3 + seedOffset);
        const r5 = seededRand(i * 17 + 4 + seedOffset);

        const drift = (r1 - 0.44) * 0.026;
        const newPrice = price * Math.exp(drift);
        const direction: 'UP' | 'DOWN' = drift > 0 ? 'UP' : 'DOWN';
        const predDir1: 'UP' | 'DOWN' = r2 > correctThreshold ? direction : (direction === 'UP' ? 'DOWN' : 'UP');
        const predDir7: 'UP' | 'DOWN' = r3 > 0.42 ? 'UP' : 'DOWN';
        const predDir30: 'UP' | 'DOWN' = r4 > 0.42 ? 'UP' : 'DOWN';

        const conf7  = 0.52 + r5 * 0.32;
        const conf30 = 0.48 + seededRand(i * 19 + 5 + seedOffset) * 0.34;

        entries.push({
            ...base,
            meta: { ...base.meta, data_as_of: dateStr, generated_at: d.toISOString() },
            current: { ...base.current, price },
            predictions: {
                y1: {
                    ...base.predictions.y1,
                    target_date: new Date(d.getTime() + 86400000).toISOString().slice(0, 10),
                    direction: predDir1,
                    predicted_price: price * (1 + (predDir1 === 'UP' ? 0.015 : -0.015)),
                    price_change_pct: predDir1 === 'UP' ? 1.5 : -1.5,
                    confidence: 0.55 + seededRand(i * 23 + seedOffset) * 0.25,
                    range_low: price * 0.97,
                    range_high: price * 1.03,
                },
                y7: {
                    ...base.predictions.y7,
                    target_date: new Date(d.getTime() + 7 * 86400000).toISOString().slice(0, 10),
                    direction: predDir7,
                    predicted_price: price * (1 + (predDir7 === 'UP' ? 0.042 : -0.042)),
                    price_change_pct: predDir7 === 'UP' ? 4.2 : -4.2,
                    confidence: conf7,
                    range_low: price * 0.91,
                    range_high: price * 1.09,
                },
                y30: {
                    ...base.predictions.y30,
                    target_date: new Date(d.getTime() + 30 * 86400000).toISOString().slice(0, 10),
                    direction: predDir30,
                    predicted_price: price * (1 + (predDir30 === 'UP' ? 0.091 : -0.091)),
                    price_change_pct: predDir30 === 'UP' ? 9.1 : -9.1,
                    confidence: conf30,
                    range_low: price * 0.80,
                    range_high: price * 1.25,
                },
            },
            actual_direction_y1: direction,
            actual_price_y1: newPrice,
        });

        price = newPrice;
    }
    return entries;
}

function buildBacktest(history: HistoryEntry[], avgPriceErrPct: number): BacktestResponse {
    const correct = history.filter((e) => e.predictions.y1.direction === e.actual_direction_y1).length;
    return {
        period_days: history.length,
        directional_accuracy: correct / history.length,
        correct_calls: correct,
        total_calls: history.length,
        avg_price_error_pct: avgPriceErrPct,
        records: history,
    };
}

// XGBoost: ~62% y1 DA
export const mockHistory: HistoryEntry[] = buildMockHistory(mockDailyPrediction, 0.38, 0);
export const mockBacktest: BacktestResponse = buildBacktest(mockHistory, 1.83);

// LSTM: ~49% y1 DA (matches metadata da=49.04%), different seeds so predicted prices differ
export const mockLstmHistory: HistoryEntry[] = buildMockHistory(mockLstmDailyPrediction, 0.51, 1000);
export const mockLstmBacktest: BacktestResponse = buildBacktest(mockLstmHistory, 2.64);

export const mockNews: NewsHeadline[] = [
    { title: 'Bitcoin Surges Past $82K as Spot ETF Inflows Hit Monthly Record', link: '#', published: 'Mon, 11 May 2026 08:30:00 +0000' },
    { title: 'Fed Chair Powell Signals Cautious Rate Outlook; Crypto Markets Rally', link: '#', published: 'Mon, 11 May 2026 07:15:00 +0000' },
    { title: 'MicroStrategy Adds 2,500 BTC to Treasury, Total Holdings Near 220K', link: '#', published: 'Mon, 11 May 2026 06:00:00 +0000' },
    { title: 'Bitcoin Halving Cycle Analysis: On-Chain Metrics Point to Continued Accumulation', link: '#', published: 'Sun, 10 May 2026 21:45:00 +0000' },
    { title: 'Institutional Demand Drives BTC Options Open Interest to All-Time High', link: '#', published: 'Sun, 10 May 2026 18:20:00 +0000' },
    { title: 'Regulatory Clarity in the EU Boosts Confidence in Crypto Asset Managers', link: '#', published: 'Sun, 10 May 2026 14:00:00 +0000' },
    { title: 'Bitcoin Lightning Network Capacity Exceeds 7,500 BTC Amid Layer-2 Growth', link: '#', published: 'Sat, 09 May 2026 20:30:00 +0000' },
    { title: 'On-Chain Analysis: Long-Term Holders Accumulating at Current Price Levels', link: '#', published: 'Sat, 09 May 2026 16:10:00 +0000' },
];
