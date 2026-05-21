'use client';

import { useState, useEffect, useCallback } from 'react';

export interface LivePriceData {
    livePrice: number | null;
    prevClose: number | null;
    loading: boolean;
    lastUpdated: Date | null;
    error: boolean;
    source: 'public-api';
}

const BINANCE_24H_API = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';

export function useLivePrice(): LivePriceData {
    const [livePrice, setLivePrice] = useState<number | null>(null);
    const [prevClose, setPrevClose] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState(false);
    const [source, setSource] = useState<'public-api'>('public-api');

    const fetchLive = useCallback(async () => {
        try {
            setLoading(true);

            const res = await fetch(BINANCE_24H_API, {
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json();
            const current = parseFloat(json.lastPrice);
            const changePercent = parseFloat(json.priceChangePercent) || 0;

            if (isNaN(current)) throw new Error('Invalid price data');

            const prevClose = current - (current * changePercent / 100);

            setLivePrice(current);
            setPrevClose(prevClose);
            setLastUpdated(new Date());
            setError(false);
            setSource('public-api');

            console.log('[useLivePrice] Fetched:', { live_price: current, prev_close: prevClose });
        } catch (err) {
            console.error('fetchLive error:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLive();
        const interval = setInterval(fetchLive, 10_000);
        return () => clearInterval(interval);
    }, [fetchLive]);

    return { livePrice, prevClose, loading, lastUpdated, error, source };
}
