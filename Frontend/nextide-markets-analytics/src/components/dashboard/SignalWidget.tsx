'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, ShieldAlert, Clock } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { useLivePrice } from '@/src/lib/useLivePrice';
import type { PredictionSignal } from '@/src/types';

interface SignalWidgetProps {
    signal: PredictionSignal;
    predictedClose: number;
    predictedConfidence: number;
    predictedTargetDate: string;
    prevCloseOverride?: number;
}

const ACTION_CONFIG = {
    STRONG_BUY: {
        label: 'STRONG BUY',
        color: 'text-[var(--color-success)]',
        bg: 'bg-[var(--color-success-bg)]',
        border: 'border-[var(--color-success)]',
        icon: Zap,
        variant: 'success' as const,
        glow: 'shadow-[0_0_40px_-5px_rgba(16,185,129,0.55)]',
    },
    BUY: {
        label: 'BUY',
        color: 'text-[var(--color-success)]',
        bg: 'bg-[var(--color-success-bg)]',
        border: 'border-[var(--color-success)]',
        icon: TrendingUp,
        variant: 'success' as const,
        glow: 'shadow-[0_0_24px_-5px_rgba(16,185,129,0.4)]',
    },
    HOLD: {
        label: 'HOLD',
        color: 'text-[var(--color-warning)]',
        bg: 'bg-[var(--color-warning-bg)]',
        border: 'border-[var(--color-warning)]',
        icon: Minus,
        variant: 'warning' as const,
        glow: '',
    },
    SELL: {
        label: 'SELL',
        color: 'text-[var(--color-danger)]',
        bg: 'bg-[var(--color-danger-bg)]',
        border: 'border-[var(--color-danger)]',
        icon: TrendingDown,
        variant: 'danger' as const,
        glow: 'shadow-[0_0_24px_-5px_rgba(239,68,68,0.4)]',
    },
    STRONG_SELL: {
        label: 'STRONG SELL',
        color: 'text-[var(--color-danger)]',
        bg: 'bg-[var(--color-danger-bg)]',
        border: 'border-[var(--color-danger)]',
        icon: ShieldAlert,
        variant: 'danger' as const,
        glow: 'shadow-[0_0_40px_-5px_rgba(239,68,68,0.55)]',
    },
};

const STRENGTH_LABEL = {
    LOW_CONFIDENCE: 'Low confidence',
    MODERATE: 'Moderate conviction',
    STRONG: 'High conviction',
};

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
    if (from == null || to == null) return <span className="text-[var(--text-muted)] text-xs">—</span>;
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

export function SignalWidget({
    signal,
    predictedClose,
    predictedConfidence,
    predictedTargetDate,
    prevCloseOverride,
}: SignalWidgetProps) {
    const { livePrice, prevClose: binancePrevClose, loading, lastUpdated, error } = useLivePrice();
    const prevClose = binancePrevClose ?? prevCloseOverride ?? null;

    // Live UTC clock — client-only to avoid hydration mismatch
    const [utcNow, setUtcNow] = useState<Date | null>(null);
    useEffect(() => {
        setUtcNow(new Date());
        const t = setInterval(() => setUtcNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');
    const utcStr = utcNow ? `${pad(utcNow.getUTCHours())}:${pad(utcNow.getUTCMinutes())}:${pad(utcNow.getUTCSeconds())} UTC` : '—';
    const wibStr = utcNow ? `${pad((utcNow.getUTCHours() + 7) % 24)}:${pad(utcNow.getUTCMinutes())}:${pad(utcNow.getUTCSeconds())} WIB` : '—';
    const fetchedAt = lastUpdated
        ? `${pad(lastUpdated.getUTCHours())}:${pad(lastUpdated.getUTCMinutes())}:${pad(lastUpdated.getUTCSeconds())} UTC`
        : null;

    const config = ACTION_CONFIG[signal.action];
    const Icon = config.icon;
    const isGated = signal.strength === 'LOW_CONFIDENCE';
    const convictionPct = ({ LOW_CONFIDENCE: 25, MODERATE: 60, STRONG: 90 } as const)[signal.strength];

    return (
        <Card className={cn('border-2 animate-slide-up', config.border, config.glow)}>
            <CardContent>
                {/* Signal header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4">
                        <div className={cn('p-3 rounded-full', config.bg)}>
                            <Icon className={cn('w-9 h-9', config.color)} />
                        </div>
                        <div>
                            <h2 className={cn('text-4xl font-bold tracking-tight', config.color)}>
                                {config.label}
                            </h2>
                            <p className="text-[var(--text-secondary)] text-sm mt-1">
                                {STRENGTH_LABEL[signal.strength]}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                        <Badge variant={config.variant} size="lg">
                            {(predictedConfidence * 100).toFixed(0)}% Confidence
                        </Badge>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                            Model only signals when confidence &ge; 60%
                        </p>
                    </div>
                </div>

                {/* Conviction bar */}
                <div className="mb-5">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                        <span>Weak</span>
                        <span>Moderate</span>
                        <span>Strong</span>
                    </div>
                    <div className="h-2 bg-[var(--background-elevated)] rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700', config.bg)}
                            style={{
                                width: `${convictionPct}%`,
                                background: isGated
                                    ? 'var(--text-muted)'
                                    : `var(${config.variant === 'success' ? '--color-success' : config.variant === 'danger' ? '--color-danger' : '--color-warning'})`,
                            }}
                        />
                    </div>
                </div>

                <p className="text-sm text-[var(--text-primary)] mb-5 leading-relaxed">
                    {signal.reasoning}
                </p>

                {/* Price ticker */}
                <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">
                        {/* Yesterday's close */}
                        <div className="px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                                Yesterday's Close
                            </p>
                            <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
                                {fmtPrice(prevClose)}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                                00:00 UTC daily candle
                            </p>
                        </div>

                        {/* Live Binance price */}
                        <div className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                    Live · BTC/USDT
                                </p>
                                <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-400' : 'bg-green-400'}`} />
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-red-500' : 'bg-green-500'}`} />
                                </span>
                            </div>
                            <p style={{
                                color: loading ? 'var(--text-muted)' : error ? 'var(--color-danger)' : (livePrice != null && prevClose != null && livePrice > prevClose) ? 'var(--color-success)' : (livePrice != null && prevClose != null && livePrice < prevClose) ? 'var(--color-danger)' : 'var(--color-primary)',
                            }} className="text-xl font-bold tabular-nums leading-none">
                                {loading ? '—' : error ? 'Error' : fmtPrice(livePrice)}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <PctChange from={prevClose} to={livePrice} />
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    {error ? 'Binance unreachable' : fetchedAt ? `@ ${fetchedAt}` : 'connecting…'}
                                </span>
                            </div>
                        </div>

                        {/* Predicted close */}
                        <div className="px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                                Predicted Close · {predictedTargetDate}
                            </p>
                            <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
                                {fmtPrice(predictedClose)}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <PctChange from={prevClose} to={predictedClose} />
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    {(predictedConfidence * 100).toFixed(0)}% conf
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* UTC / WIB info */}
                    <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--background-elevated)]/30 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span>
                                Prices in <strong className="text-[var(--text-secondary)]">UTC</strong>.
                                {' '}Daily candle closes <strong className="text-[var(--text-secondary)]">00:00 UTC</strong>
                                {' '}= <strong className="text-[var(--text-secondary)]">07:00 WIB</strong> (GMT+7).
                                {' '}Live updates every 10 s via Binance.
                            </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums font-mono">
                            {utcStr} · {wibStr}
                        </span>
                    </div>
                </div>

                <p className="text-[10px] text-[var(--text-muted)] mt-4 text-center">
                    For informational purposes only. Not financial advice.
                </p>
            </CardContent>
        </Card>
    );
}
