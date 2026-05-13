// API data contracts — must match Backend/main.py response shapes.

export type SignalAction =
    | 'STRONG_BUY'
    | 'BUY'
    | 'HOLD'
    | 'SELL'
    | 'STRONG_SELL';

export type SignalStrength = 'LOW_CONFIDENCE' | 'MODERATE' | 'STRONG';

export type NlpStatus = 'live' | 'fallback_7d_avg' | 'unavailable';

export type ModelHealthStatus = 'good' | 'watch' | 'alert' | 'insufficient_data' | 'unknown';

export type FngLabel =
    | 'Extreme Fear'
    | 'Fear'
    | 'Neutral'
    | 'Greed'
    | 'Extreme Greed'
    | 'Unknown';

export interface PredictionMeta {
    generated_at: string;
    model_version: string;
    data_as_of: string;
}

export interface PredictionCurrent {
    price: number;
    fng_score: number;
    fng_label: FngLabel;
    nlp_sentiment: number;
    nlp_status: NlpStatus;
    nlp_reasoning?: string;
}

export interface HorizonPrediction {
    target_date: string;
    predicted_log_return: number;
    predicted_price: number;
    price_change_pct: number;
    direction: 'UP' | 'DOWN';
    confidence: number; // 0..1
    range_low: number;
    range_high: number;
}

export interface PredictionSignal {
    action: SignalAction;
    strength: SignalStrength;
    reasoning: string;
}

export interface KeyDriver {
    feature: string;
    importance: number;
    label: string;
}

export interface ModelHealth {
    rolling_da_14d: number | null;
    status: ModelHealthStatus;
}

export interface DailyPrediction {
    meta: PredictionMeta;
    current: PredictionCurrent;
    predictions: {
        y1: HorizonPrediction;
        y7: HorizonPrediction;
        y30: HorizonPrediction;
    };
    signal: PredictionSignal;
    key_drivers: KeyDriver[];
    model_health: ModelHealth;
}

// History — entries are full DailyPrediction snapshots with ground truth filled retroactively.
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

// Chart point used by PriceChart.
export interface ChartDataPoint {
    date: string;
    actual?: number;
    predicted?: number;
    range_low?: number;
    range_high?: number;
}

// News headline from /api/news (CoinDesk RSS).
export interface NewsHeadline {
    title: string;
    link: string;
    published: string; // RFC-2822 or ISO string from RSS feed
}
