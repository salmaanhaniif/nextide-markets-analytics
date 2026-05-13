import React from 'react';

export function Loading() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-primary)] border-t-transparent"></div>
                <p className="mt-4 text-[var(--text-secondary)]">Loading dashboard...</p>
            </div>
        </div>
    );
}

export function LoadingSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-8 bg-[var(--background-surface)] rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="h-64 bg-[var(--background-surface)] rounded"></div>
                <div className="h-64 bg-[var(--background-surface)] rounded"></div>
            </div>
            <div className="h-96 bg-[var(--background-surface)] rounded mb-6"></div>
            <div className="h-64 bg-[var(--background-surface)] rounded"></div>
        </div>
    );
}
