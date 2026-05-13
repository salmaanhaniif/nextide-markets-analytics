'use client';

import React from 'react';
import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import type { ChartDataPoint } from '@/src/types';

type Horizon = 'y1' | 'y7' | 'y30';

const HORIZON_TABS: { key: Horizon; label: string; subtitle: string }[] = [
    { key: 'y1', label: 'Daily',   subtitle: '1-day prediction range' },
    { key: 'y7', label: 'Weekly',  subtitle: '7-day prediction range' },
    { key: 'y30', label: 'Monthly', subtitle: '30-day prediction range' },
];

interface PriceChartProps {
    data: ChartDataPoint[];
    currentPrice: number;
    selectedHorizon: Horizon;
    onHorizonChange: (h: Horizon) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    // Pull range values from payload for a combined label
    const low  = payload.find((p: any) => p.dataKey === 'range_low')?.value;
    const high = payload.find((p: any) => p.dataKey === 'range_high')?.value;

    return (
        <div className="bg-[var(--background-surface)] border border-[var(--border-color)] rounded-lg p-3 shadow-lg min-w-[180px]">
            <p className="text-[var(--text-primary)] font-semibold mb-2 text-xs">{label}</p>
            {payload.map((entry: any, i: number) => {
                // Skip the erase area (range_low)
                if (entry.dataKey === 'range_low') return null;
                // Combine both range values into one row
                if (entry.dataKey === 'range_high') {
                    if (low == null || high == null) return null;
                    return (
                        <p key={i} style={{ color: '#8B5CF6' }} className="text-sm">
                            Range: ${Number(low).toLocaleString('en-US', { maximumFractionDigits: 0 })} – ${Number(high).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </p>
                    );
                }
                if (entry.value == null) return null;
                return (
                    <p key={i} style={{ color: entry.color }} className="text-sm">
                        {entry.name}: ${Number(entry.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                );
            })}
        </div>
    );
};

export function PriceChart({ data, currentPrice, selectedHorizon, onHorizonChange }: PriceChartProps) {
    // Y-axis domain is derived only from actual + predicted prices so movements fill the chart.
    // The range band (range_low / range_high) uses baseValue={yMin} to avoid forcing 0 into the domain.
    const pricePts = data.flatMap((d) =>
        [d.actual, d.predicted].filter((v): v is number => v != null),
    );
    const yMin = pricePts.length ? Math.floor((Math.min(...pricePts) * 0.992) / 1000) * 1000 : 0;
    const yMax = pricePts.length ? Math.ceil((Math.max(...pricePts) * 1.008) / 1000) * 1000 : 1;

    const activeTab = HORIZON_TABS.find((t) => t.key === selectedHorizon)!;

    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <CardTitle>Price Trend & Prediction</CardTitle>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                            Historical prices with {activeTab.subtitle}
                        </p>
                    </div>
                    <div className="flex gap-1 bg-[var(--background-elevated)] rounded-lg p-1 self-start">
                        {HORIZON_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => onHorizonChange(tab.key)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                                    selectedHorizon === tab.key
                                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={420}>
                    <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="var(--text-secondary)"
                            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                            tickLine={false}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                            domain={[yMin, yMax]}
                            allowDataOverflow={false}
                            width={55}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }}
                            iconType="line"
                            formatter={(value) => (value === '_range_erase' ? null : value)}
                        />
                        <ReferenceLine
                            y={currentPrice}
                            stroke="var(--text-muted)"
                            strokeDasharray="6 4"
                            label={{ value: 'Now', fill: 'var(--text-muted)', fontSize: 11, position: 'right' }}
                        />

                        {/*
                         * Prediction band: range_high fills from yMin → range_high (light purple).
                         * range_low then covers yMin → range_low with the background colour,
                         * leaving only the band between range_low and range_high visible.
                         * baseValue={yMin} prevents Recharts from anchoring the fill at 0,
                         * which would otherwise force the Y-axis domain to include 0.
                         */}
                        <Area
                            type="monotone"
                            dataKey="range_high"
                            stroke="none"
                            fill="#8B5CF6"
                            fillOpacity={0.18}
                            baseValue={yMin}
                            legendType="none"
                            name="Prediction Range"
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="range_low"
                            stroke="none"
                            fill="var(--background-main)"
                            fillOpacity={1}
                            baseValue={yMin}
                            legendType="none"
                            name="_range_erase"
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                        />

                        <Line
                            type="monotone"
                            dataKey="actual"
                            stroke="var(--color-chart-line)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--color-chart-line)' }}
                            name="Actual Price"
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="predicted"
                            stroke="var(--color-chart-predicted)"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--color-chart-predicted)' }}
                            name="Predicted Price"
                            connectNulls
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
