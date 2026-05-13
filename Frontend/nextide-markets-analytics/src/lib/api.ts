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

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

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

export function fetchDailyPrediction(model: string = 'xgboost'): Promise<DailyPrediction> {
    const fallback = model === 'lstm' ? mockLstmDailyPrediction : mockDailyPrediction;
    return withFallback(
        `GET /api/predict/daily?model=${model}`,
        async () => {
            const data = (await apiClient.get<DailyPrediction>('/api/predict/daily', { params: { model } })).data;
            if (!data?.meta) throw new Error('API response shape mismatch (missing meta) — falling back to mock');
            return data;
        },
        fallback,
    );
}

export function fetchHistory(days: number = 90, model: string = 'xgboost'): Promise<HistoryEntry[]> {
    const fallback = model === 'lstm' ? mockLstmHistory : mockHistory;
    return withFallback(
        `GET /api/history?days=${days}&model=${model}`,
        async () => (await apiClient.get<HistoryEntry[]>('/api/history', { params: { days, model } })).data,
        fallback,
    );
}

export function fetchBacktest(model: string = 'xgboost'): Promise<BacktestResponse> {
    const fallback = model === 'lstm' ? mockLstmBacktest : mockBacktest;
    return withFallback(
        `GET /api/backtest/30d?model=${model}`,
        async () => (await apiClient.get<BacktestResponse>('/api/backtest/30d', { params: { model } })).data,
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
