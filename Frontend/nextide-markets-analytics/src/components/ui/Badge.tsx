import React from 'react';
import { cn } from '@/src/lib/utils';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function Badge({ children, variant = 'neutral', size = 'md', className }: BadgeProps) {
    const baseStyles = 'inline-flex items-center justify-center rounded-full font-semibold';

    const variants = {
        success: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]',
        danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger)]',
        warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]',
        info: 'bg-blue-500/10 text-blue-400 border border-blue-500',
        neutral: 'bg-[var(--background-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)]',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
    };

    return (
        <span className={cn(baseStyles, variants[variant], sizes[size], className)}>
            {children}
        </span>
    );
}
