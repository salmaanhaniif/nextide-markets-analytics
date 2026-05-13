'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ModelHealth } from '@/src/types';

interface ModelHealthBadgeProps {
    health: ModelHealth;
}

const STATUS_CONFIG = {
    good: {
        label: 'Model Healthy',
        icon: CheckCircle2,
        color: 'text-[var(--color-success)]',
        bg: 'bg-[var(--color-success-bg)]',
        border: 'border-[var(--color-success)]/30',
    },
    watch: {
        label: 'Model Watch',
        icon: AlertTriangle,
        color: 'text-[var(--color-warning)]',
        bg: 'bg-[var(--color-warning-bg)]',
        border: 'border-[var(--color-warning)]/30',
    },
    alert: {
        label: 'Model Alert',
        icon: AlertCircle,
        color: 'text-[var(--color-danger)]',
        bg: 'bg-[var(--color-danger-bg)]',
        border: 'border-[var(--color-danger)]/30',
    },
    insufficient_data: {
        label: 'Insufficient Data',
        icon: HelpCircle,
        color: 'text-[var(--text-muted)]',
        bg: 'bg-[var(--background-elevated)]',
        border: 'border-[var(--border-color)]',
    },
    unknown: {
        label: 'Status Unknown',
        icon: HelpCircle,
        color: 'text-[var(--text-muted)]',
        bg: 'bg-[var(--background-elevated)]',
        border: 'border-[var(--border-color)]',
    },
};

export function ModelHealthBadge({ health }: ModelHealthBadgeProps) {
    const config = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.unknown;
    const Icon = config.icon;

    return (
        <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold', config.bg, config.border, config.color)}>
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
            {health.rolling_da_14d != null && (
                <span className="text-[var(--text-muted)] font-normal">
                    {(health.rolling_da_14d * 100).toFixed(0)}% DA-14d
                </span>
            )}
        </div>
    );
}
