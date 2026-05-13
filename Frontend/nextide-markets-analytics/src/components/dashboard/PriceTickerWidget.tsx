'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useLivePrice } from '@/src/lib/useLivePrice';

function fmtPrice(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function PctChange({ from, to }: { from: number | null; to: number | null }) {
    if (from == null || to == null) return null;
    const pct = ((to - from) / from) * 100;
    const isUp = pct >= 0;
    const Icon = isUp ? TrendingUp : TrendingDown;
    const color = isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]';
    return (
        <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${color}`}>
            <Icon className="w-3 h-3 flex-shrink-0" />
            {isUp ? '+' : ''}{pct.toFixed(2)}%
        </span>
    );
}

interface Props {
    predictedClose: number;
    predictedConfidence: number;
    predictedTargetDate: string;
    prevCloseOverride?: number;
}

export function PriceTickerWidget({
    predictedClose,
    predictedConfidence,
    predictedTargetDate,
    prevCloseOverride,
}: Props) {
    const { livePrice, prevClose: binancePrevClose, loading, lastUpdated, error } = useLivePrice();

    // Use Binance klines prev-close; fall back to history close from backend
    const prevClose = binancePrevClose ?? prevCloseOverride ?? null;

    // Live UTC clock — initialized client-side only to avoid hydration mismatch
    const [utcNow, setUtcNow] = useState<Date | null>(null);
    useEffect(() => {
        setUtcNow(new Date());
        const t = setInterval(() => setUtcNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');
    const utcStr = utcNow
        ? `${pad(utcNow.getUTCHours())}:${pad(utcNow.getUTCMinutes())}:${pad(utcNow.getUTCSeconds())} UTC`
        : '—';
    const wibStr = utcNow
        ? `${pad((utcNow.getUTCHours() + 7) % 24)}:${pad(utcNow.getUTCMinutes())}:${pad(utcNow.getUTCSeconds())} WIB`
        : '—';

    // Format last-fetch time for the live cell
    const fetchedAt = lastUpdated
        ? `${pad(lastUpdated.getUTCHours())}:${pad(lastUpdated.getUTCMinutes())}:${pad(lastUpdated.getUTCSeconds())} UTC`
        : null;

    return (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--background-surface)] overflow-hidden animate-slide-up">
            {/* Three price columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">

                {/* Yesterday's Close */}
                <div className="px-6 py-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                        Yesterday's Close
                    </p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
                        {fmtPrice(prevClose)}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-2">
                        Daily candle · 00:00 UTC
                    </p>
                </div>

                {/* Live Price */}
                <div className="px-6 py-5 relative">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            Live Price · BTC/USDT
                        </p>
                        {/* Pulsing live indicator */}
                        <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-400' : 'bg-green-400'}`} />
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${error ? 'bg-red-500' : 'bg-green-500'}`} />
                        </span>
                    </div>
                    <p className={`text-3xl font-bold tabular-nums leading-none transition-colors ${
                        loading
                            ? 'text-[var(--text-muted)]'
                            : error
                                ? 'text-[var(--color-danger)]'
                                : 'text-[var(--color-primary)]'
                    }`}>
                        {loading ? '—' : error ? 'Error' : fmtPrice(livePrice)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <PctChange from={prevClose} to={livePrice} />
                        <span className="text-[11px] text-[var(--text-muted)]">
                            {error
                                ? 'Binance unreachable'
                                : fetchedAt
                                    ? `fetched ${fetchedAt}`
                                    : 'connecting…'}
                        </span>
                    </div>
                </div>

                {/* Today's Predicted Close */}
                <div className="px-6 py-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                        Predicted Close · {predictedTargetDate}
                    </p>
                    <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
                        {fmtPrice(predictedClose)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <PctChange from={prevClose} to={predictedClose} />
                        <span className="text-[11px] text-[var(--text-muted)]">
                            {(predictedConfidence * 100).toFixed(0)}% confidence
                        </span>
                    </div>
                </div>
            </div>

            {/* UTC / WIB time info bar */}
            <div className="px-6 py-2.5 border-t border-[var(--border-color)] bg-[var(--background-elevated)]/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span>
                        Prices in <strong className="text-[var(--text-secondary)]">UTC</strong>.
                        {' '}Bitcoin daily candle closes at{' '}
                        <strong className="text-[var(--text-secondary)]">00:00 UTC</strong>
                        {' '}={' '}
                        <strong className="text-[var(--text-secondary)]">07:00 WIB</strong>
                        {' '}(GMT+7). Live price updates every 10 s via Binance.
                    </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums font-mono">
                    {utcStr} · {wibStr}
                </span>
            </div>
        </div>
    );
}
