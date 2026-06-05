'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface LivePriceData {
    livePrice: number | null;
    prevClose: number | null;
    loading: boolean;
    lastUpdated: Date | null;
    error: boolean;
    source: string;
}

export function useLivePrice(): LivePriceData {
    const [livePrice, setLivePrice] = useState<number | null>(null);
    const [prevClose, setPrevClose] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState(false);
    const [source, setSource] = useState<string>('');

    // After the first successful fetch we never set loading:true again —
    // keeps the displayed price stable between polls so RollingNumber stays mounted.
    const hasPriceRef = useRef(false);

    const fetchLive = useCallback(async () => {
        try {
            if (!hasPriceRef.current) setLoading(true);
            const res = await fetch('/api/live-price');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (!json.price || isNaN(json.price)) throw new Error('Invalid price');

            hasPriceRef.current = true;
            setLivePrice(json.price);
            setPrevClose(json.prev_close ?? json.price);
            setLastUpdated(new Date());
            setSource(json.source ?? 'proxy');
            setError(false);
        } catch (err) {
            console.error('[useLivePrice] fetch error:', err);
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
