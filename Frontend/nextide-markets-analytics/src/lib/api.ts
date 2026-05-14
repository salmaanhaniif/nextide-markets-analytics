import axios from 'axios';
import type {
    DailyPrediction,
    HistoryEntry,
    BacktestResponse,
    NewsHeadline,
} from '@/src/types';
import {
    mockDailyPrediction,
    mockLstmDailyPrediction,
    mockHistory,
    mockLstmHistory,
    mockBacktest,
    mockLstmBacktest,
    mockNews,
    USE_MOCK_DATA,
} from './mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// GitHub raw base URL — data files are committed here by GitHub Actions daily
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/salmaanhaniif/nextide-markets-analytics/main/Backend';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

const githubClient = axios.create({ timeout: 15000 });

// Cache-bust GitHub CDN with daily granularity
function cacheBust() {
    return new Date().toISOString().slice(0, 10);
}

async function withFallback<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    if (USE_MOCK_DATA) {
        console.log(`[api] ${label}: using mock data`);
        return new Promise((resolve) => setTimeout(() => resolve(fallback), 300));
    }
    try {
        return await fn();
    } catch (err) {
        console.error(`[api] ${label} failed, falling back to mock:`, err);
        return fallback;
    }
}

function computeBacktest(history: HistoryEntry[], days: number = 30): BacktestResponse {
    const resolved = history
        .slice(-60)
        .filter(e => e.actual_direction_y1 !== null && e.actual_direction_y1 !== undefined)
        .slice(-days);

    if (!resolved.length) {
        return { period_days: 0, directional_accuracy: 0, correct_calls: 0, total_calls: 0, avg_price_error_pct: null, records: [] };
    }

    const total = resolved.length;
    const correct = resolved.filter(e => e.predictions.y1.direction === e.actual_direction_y1).length;
    const priceErrors = resolved
        .filter(e => e.predictions.y1.predicted_price && e.actual_price_y1)
        .map(e => Math.abs(e.predictions.y1.predicted_price - e.actual_price_y1!) / e.actual_price_y1! * 100);

    return {
        period_days: total,
        directional_accuracy: total > 0 ? Math.round((correct / total) * 10000) / 10000 : 0,
        correct_calls: correct,
        total_calls: total,
        avg_price_error_pct: priceErrors.length ? Math.round(priceErrors.reduce((a, b) => a + b) / priceErrors.length * 10000) / 10000 : null,
        records: resolved,
    };
}

export function fetchDailyPrediction(model: string = 'xgboost'): Promise<DailyPrediction> {
    const fallback = model === 'lstm' ? mockLstmDailyPrediction : mockDailyPrediction;
    const file = model === 'lstm' ? 'latest_prediction_lstm.json' : 'latest_prediction.json';
    return withFallback(
        `GitHub raw: ${file}`,
        async () => {
            const data = (await githubClient.get<DailyPrediction>(`${GITHUB_RAW_BASE}/${file}?t=${cacheBust()}`)).data;
            if (!data?.meta) throw new Error('Response shape mismatch (missing meta)');
            return data;
        },
        fallback,
    );
}

export function fetchHistory(days: number = 90, model: string = 'xgboost'): Promise<HistoryEntry[]> {
    const fallback = model === 'lstm' ? mockLstmHistory : mockHistory;
    const file = model === 'lstm' ? 'data/prediction_history_lstm.json' : 'data/prediction_history.json';
    return withFallback(
        `GitHub raw: ${file}`,
        async () => {
            const data = (await githubClient.get<HistoryEntry[]>(`${GITHUB_RAW_BASE}/${file}?t=${cacheBust()}`)).data;
            if (!Array.isArray(data)) throw new Error('History response is not an array');
            return data.slice(-days);
        },
        fallback,
    );
}

export function fetchBacktest(model: string = 'xgboost'): Promise<BacktestResponse> {
    const fallback = model === 'lstm' ? mockLstmBacktest : mockBacktest;
    const file = model === 'lstm' ? 'data/prediction_history_lstm.json' : 'data/prediction_history.json';
    return withFallback(
        `GitHub raw backtest: ${file}`,
        async () => {
            const data = (await githubClient.get<HistoryEntry[]>(`${GITHUB_RAW_BASE}/${file}?t=${cacheBust()}`)).data;
            if (!Array.isArray(data)) throw new Error('History response is not an array');
            return computeBacktest(data);
        },
        fallback,
    );
}

export function fetchNews(): Promise<NewsHeadline[]> {
    return withFallback(
        'GET /api/news',
        async () => (await apiClient.get<NewsHeadline[]>('/api/news')).data,
        mockNews,
    );
}

export async function checkApiHealth(): Promise<boolean> {
    try {
        const response = await apiClient.get('/');
        return response.status === 200;
    } catch {
        return false;
    }
}
