'use client';

import React from 'react';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import type { PredictionCurrent } from '@/src/types';

interface SentimentGaugeProps {
    current: PredictionCurrent;
}

const NLP_STATUS_CONFIG = {
    live: { label: 'Live NLP', icon: Wifi, variant: 'success' as const },
    fallback_7d_avg: { label: '7d Avg Fallback', icon: Clock, variant: 'warning' as const },
    unavailable: { label: 'NLP Unavailable', icon: WifiOff, variant: 'danger' as const },
};

const FNG_COLOR = (score: number) => {
    if (score < 0.25) return 'var(--color-danger)';
    if (score < 0.45) return 'var(--color-warning)';
    if (score < 0.55) return 'var(--text-muted)';
    return 'var(--color-success)';
};

const FNG_VARIANT = (label: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (label.includes('Greed')) return 'success';
    if (label.includes('Fear')) return 'danger';
    return 'neutral';
};

export function SentimentGauge({ current }: SentimentGaugeProps) {
    const { fng_score, fng_label, nlp_sentiment, nlp_status, nlp_reasoning } = current;
    const nlpConfig = NLP_STATUS_CONFIG[nlp_status];
    const NlpIcon = nlpConfig.icon;

    const fngPct = fng_score * 100;
    const nlpPct = ((nlp_sentiment + 1) / 2) * 100;

    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Market Sentiment</CardTitle>
                    <Badge variant={FNG_VARIANT(fng_label)} size="md">
                        {fng_label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {/* Fear & Greed Gauge */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--text-secondary)] text-sm">Fear & Greed Index</span>
                        <span
                            className="font-bold text-2xl"
                            style={{ color: FNG_COLOR(fng_score) }}
                        >
                            {fngPct.toFixed(0)}
                        </span>
                    </div>
                    <div className="relative h-7 rounded-full overflow-hidden">
                        <div
                            className="absolute inset-0"
                            style={{
                                background:
                                    'linear-gradient(to right, #EF4444 0%, #F59E0B 25%, #64748B 50%, #10B981 75%, #10B981 100%)',
                            }}
                        />
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all duration-500"
                            style={{ left: `${Math.min(Math.max(fngPct, 1), 99)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-[var(--text-secondary)]">
                        <span>Extreme Fear</span>
                        <span>Neutral</span>
                        <span>Extreme Greed</span>
                    </div>
                </div>

                {/* NLP Sentiment */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[var(--text-secondary)] text-sm">NLP Sentiment</span>
                            <Badge variant={nlpConfig.variant} size="sm">
                                <NlpIcon className="w-3 h-3 mr-1" />
                                {nlpConfig.label}
                            </Badge>
                        </div>
                        <span
                            className="font-bold text-xl"
                            style={{ color: FNG_COLOR(nlpPct / 100) }}
                        >
                            {nlp_sentiment >= 0 ? '+' : ''}{nlp_sentiment.toFixed(2)}
                        </span>
                    </div>
                    <div className="h-2.5 bg-[var(--background-elevated)] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${nlpPct}%`,
                                backgroundColor: FNG_COLOR(nlpPct / 100),
                            }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-[var(--text-secondary)]">
                        <span>Negative (−1)</span>
                        <span>Neutral (0)</span>
                        <span>Positive (+1)</span>
                    </div>
                </div>

                {/* NLP Reasoning */}
                {nlp_reasoning && (
                    <div className={cn(
                        'p-3 rounded-lg border text-sm text-[var(--text-secondary)] leading-relaxed',
                        'bg-[var(--background-elevated)] border-[var(--border-color)]'
                    )}>
                        <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">NLP Signal</p>
                        {nlp_reasoning}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
