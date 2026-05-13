'use client';

import { useState, useEffect, useCallback } from 'react';

export interface LivePriceData {
    livePrice: number | null;
    prevClose: number | null;
    loading: boolean;
    lastUpdated: Date | null;
    error: boolean;
}

const TICKER_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';
const KLINES_URL = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=2';

export function useLivePrice(): LivePriceData {
    const [livePrice, setLivePrice] = useState<number | null>(null);
    const [prevClose, setPrevClose] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState(false);

    const fetchPrevClose = useCallback(async () => {
        try {
            const res = await fetch(KLINES_URL);
            // klines row: [openTime, open, high, low, close, volume, ...]
            const rows: [number, string, string, string, string, ...unknown[]][] = await res.json();
            if (Array.isArray(rows) && rows[0]?.[4]) {
                setPrevClose(parseFloat(rows[0][4]));
            }
        } catch {
            // non-critical — caller falls back to history price
        }
    }, []);

    const fetchLive = useCallback(async () => {
        try {
            const res = await fetch(TICKER_URL);
            const json: { price: string } = await res.json();
            setLivePrice(parseFloat(json.price));
            setLastUpdated(new Date());
            setError(false);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPrevClose();
        fetchLive();
        const interval = setInterval(fetchLive, 10_000);
        return () => clearInterval(interval);
    }, [fetchPrevClose, fetchLive]);

    return { livePrice, prevClose, loading, lastUpdated, error };
}
