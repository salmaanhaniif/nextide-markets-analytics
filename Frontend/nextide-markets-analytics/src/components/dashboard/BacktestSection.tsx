'use client';

import React from 'react';
import { CheckCircle, XCircle, BarChart2 } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import type { BacktestResponse } from '@/src/types';

interface BacktestSectionProps {
    backtest: BacktestResponse;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const correct = payload[0]?.payload?.correct;
    return (
        <div className="bg-[var(--background-surface)] border border-[var(--border-color)] rounded-lg p-3 shadow-lg text-xs">
            <p className="text-[var(--text-primary)] font-semibold mb-1">{label}</p>
            <p style={{ color: correct ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {correct ? '✓ Correct' : '✗ Wrong'}
            </p>
        </div>
    );
};

export function BacktestSection({ backtest }: BacktestSectionProps) {
    const { directional_accuracy, correct_calls, total_calls, avg_price_error_pct, records } = backtest;

    const daVariant = directional_accuracy >= 0.60 ? 'success' : directional_accuracy >= 0.50 ? 'warning' : 'danger';

    const chartData = records
        .filter((r) => r.actual_direction_y1 != null)
        .slice(-30)
        .map((r) => ({
            date: r.meta.data_as_of.slice(5),
            correct: r.predictions.y1.direction === r.actual_direction_y1,
            value: 1,
        }));

    const statItems = [
        {
            label: 'Directional Accuracy',
            value: `${(directional_accuracy * 100).toFixed(1)}%`,
            sub: `${correct_calls} / ${total_calls} calls`,
            variant: daVariant,
        },
        {
            label: 'Avg Price Error',
            value: avg_price_error_pct != null ? `${avg_price_error_pct.toFixed(2)}%` : 'N/A',
            sub: 'Mean absolute error',
            variant: 'neutral' as const,
        },
        {
            label: 'Period',
            value: `${total_calls}d`,
            sub: 'Resolved predictions',
            variant: 'neutral' as const,
        },
    ];

    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-[var(--color-primary)]" />
                    <CardTitle>Model Backtest</CardTitle>
                </div>
                <p className="text-[var(--text-secondary)] text-sm mt-1">
                    Historical prediction performance on resolved calls
                </p>
            </CardHeader>
            <CardContent>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {statItems.map((item) => (
                        <div
                            key={item.label}
                            className="p-4 bg-[var(--background-elevated)] rounded-lg"
                        >
                            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                                {item.label}
                            </p>
                            <div className="flex items-end gap-2">
                                <span
                                    className={cn(
                                        'text-2xl font-bold',
                                        item.variant === 'success'
                                            ? 'text-[var(--color-success)]'
                                            : item.variant === 'warning'
                                            ? 'text-[var(--color-warning)]'
                                            : item.variant === 'danger'
                                            ? 'text-[var(--color-danger)]'
                                            : 'text-[var(--text-primary)]',
                                    )}
                                >
                                    {item.value}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Bar chart — each bar is 1 day, green = correct, red = wrong */}
                {chartData.length > 0 && (
                    <div>
                        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                            Direction accuracy — last {chartData.length} resolved predictions
                        </p>
                        <ResponsiveContainer width="100%" height={100}>
                            <BarChart data={chartData} barCategoryGap="10%" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={4}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={false} />
                                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                    {chartData.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={entry.correct ? 'var(--color-success)' : 'var(--color-danger)'}
                                            fillOpacity={0.8}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="flex items-center gap-4 mt-2 justify-end text-xs text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-[var(--color-success)]" /> Correct
                            </span>
                            <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-[var(--color-danger)]" /> Wrong
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
