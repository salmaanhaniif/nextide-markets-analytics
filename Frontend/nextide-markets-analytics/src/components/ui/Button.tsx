import React from 'react';
import { cn } from '@/src/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

export function Button({
    variant = 'primary',
    size = 'md',
    className,
    children,
    ...props
}: ButtonProps) {
    const baseStyles = 'rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white',
        secondary: 'bg-[var(--background-elevated)] hover:bg-[var(--border-color-light)] text-[var(--text-primary)]',
        success: 'bg-[var(--color-success)] hover:opacity-90 text-white',
        danger: 'bg-[var(--color-danger)] hover:opacity-90 text-white',
        ghost: 'bg-transparent hover:bg-[var(--background-elevated)] text-[var(--text-primary)]',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            {...props}
        >
            {children}
        </button>
    );
}
