'use client';

import { TrendingUp, Activity, BarChart2, Zap, Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';

interface FeatureGroup {
    label: string;
    color: string;
    bg: string;
    icon: React.ComponentType<{ className?: string }>;
    features: string[];
}

const GROUPS: FeatureGroup[] = [
    {
        label: 'Momentum',
        color: 'text-[var(--color-primary)]',
        bg: 'bg-blue-500/10',
        icon: TrendingUp,
        features: [
            'RSI (7-day)', 'RSI (14-day)', 'RSI (21-day)',
            'MACD', 'MACD Signal', 'MACD Histogram',
            'Stochastic %K', 'Stochastic %D', 'Williams %R',
        ],
    },
    {
        label: 'Volatility & Bands',
        color: 'text-[var(--color-warning)]',
        bg: 'bg-yellow-500/10',
        icon: Activity,
        features: [
            'Bollinger Band Position', 'Bollinger Band Width',
            'ATR %', '7-Day Volatility', '30-Day Volatility',
        ],
    },
    {
        label: 'Volume',
        color: 'text-[var(--color-success)]',
        bg: 'bg-green-500/10',
        icon: BarChart2,
        features: ['Volume Ratio', 'Volume Momentum'],
    },
    {
        label: 'Bitcoin Cycle',
        color: 'text-[#8B5CF6]',
        bg: 'bg-purple-500/10',
        icon: Cpu,
        features: [
            'Days Since Last Halving', 'Days to Next Halving',
            'Halving Cycle Phase', 'Month Seasonality', 'Day-of-Week Seasonality',
        ],
    },
    {
        label: 'Sentiment',
        color: 'text-[var(--color-danger)]',
        bg: 'bg-red-500/10',
        icon: Zap,
        features: [
            'Fear & Greed Score', 'Fear & Greed 7-Day Avg',
            'Fear & Greed 30-Day Avg', 'F&G Momentum', 'NLP News Sentiment',
        ],
    },
];

export function ModelFeaturesSection() {
    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <CardTitle>Model Input Features</CardTitle>
                <p className="text-[var(--text-secondary)] text-sm mt-1">
                    34 technical indicators compressed via PCA (→ 11 dimensions) · 5 sentiment inputs · 30-day lookback window
                </p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {GROUPS.map((group) => {
                        const Icon = group.icon;
                        return (
                            <div
                                key={group.label}
                                className="rounded-lg border border-[var(--border-color)] p-4"
                            >
                                <div className={`flex items-center gap-2 mb-3 ${group.color}`}>
                                    <Icon className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        {group.label}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.features.map((f) => (
                                        <span
                                            key={f}
                                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${group.bg} text-[var(--text-secondary)]`}
                                        >
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-4 text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Technical features are pre-processed and reduced via Principal Component Analysis (PCA) before being fed into the model.
                    Sentiment features are used directly. Each input window covers the past 30 days (480 values total).
                </p>
            </CardContent>
        </Card>
    );
}
