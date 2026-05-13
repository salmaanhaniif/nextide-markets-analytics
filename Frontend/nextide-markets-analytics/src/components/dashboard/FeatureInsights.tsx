'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import type { KeyDriver } from '@/src/types';

interface FeatureInsightsProps {
    drivers: KeyDriver[];
}

export function FeatureInsights({ drivers }: FeatureInsightsProps) {
    const sorted = [...drivers].sort((a, b) => b.importance - a.importance).slice(0, 5);
    const maxImportance = sorted[0]?.importance ?? 1;

    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CardTitle>Key Prediction Drivers</CardTitle>
                    <Info className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm mt-1">
                    Top features influencing today's model output
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sorted.map((driver, i) => (
                        <div key={driver.feature}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--text-muted)] w-4 text-right font-mono">
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                                        {driver.label}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-[var(--color-primary)]">
                                    {(driver.importance * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="ml-6 h-2 bg-[var(--background-elevated)] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 bg-[var(--color-primary)]"
                                    style={{
                                        width: `${(driver.importance / maxImportance) * 100}%`,
                                        opacity: 1 - i * 0.12,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Importance is the XGBoost feature gain — how much each feature reduces prediction error relative to others.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
