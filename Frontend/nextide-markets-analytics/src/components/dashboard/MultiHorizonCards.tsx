'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import type { HorizonPrediction } from '@/src/types';

interface MultiHorizonCardsProps {
    y1: HorizonPrediction;
    y7: HorizonPrediction;
    y30: HorizonPrediction;
    currentPrice: number;
}

interface HorizonCardProps {
    label: string;
    horizon: HorizonPrediction;
    currentPrice: number;
}

function HorizonCard({ label, horizon, currentPrice }: HorizonCardProps) {
    const isUp = horizon.direction === 'UP';
    const priceChange = horizon.predicted_price - currentPrice;
    const Icon = isUp ? TrendingUp : TrendingDown;

    return (
        <Card className="animate-slide-up">
            <CardContent>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                            {label}
                        </span>
                    </div>
                    <Badge variant={isUp ? 'success' : 'danger'} size="sm">
                        <Icon className="w-3 h-3 mr-1" />
                        {isUp ? '+' : ''}{horizon.price_change_pct.toFixed(2)}%
                    </Badge>
                </div>

                <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                    ${horizon.predicted_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className={cn('text-sm font-semibold mb-3', isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
                    {priceChange >= 0 ? '+' : ''}${priceChange.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                        <span>Confidence</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                            {(horizon.confidence * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-[var(--background-elevated)] rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700', isUp ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]')}
                            style={{ width: `${horizon.confidence * 100}%` }}
                        />
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--border-color)] grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                    <div>
                        <span className="block text-[var(--text-muted)]">Range Low</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                            ${horizon.range_low.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="block text-[var(--text-muted)]">Range High</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                            ${horizon.range_high.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>

                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                    Target: {horizon.target_date}
                </p>
            </CardContent>
        </Card>
    );
}

export function MultiHorizonCards({ y1, y7, y30, currentPrice }: MultiHorizonCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HorizonCard label="1-Day Target" horizon={y1} currentPrice={currentPrice} />
            <HorizonCard label="7-Day Target" horizon={y7} currentPrice={currentPrice} />
            <HorizonCard label="30-Day Target" horizon={y30} currentPrice={currentPrice} />
        </div>
    );
}
