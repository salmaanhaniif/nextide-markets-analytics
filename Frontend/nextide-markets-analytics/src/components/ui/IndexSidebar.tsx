'use client';

import { X, BarChart2 } from 'lucide-react';

interface IndexSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const INDICES = [
    { symbol: 'SP500', name: 'S&P 500',        abbr: 'SP',  region: 'United States' },
    { symbol: 'IHSG',  name: 'Jakarta Comp.',   abbr: 'IDX', region: 'Indonesia'     },
] as const;

export function IndexSidebar({ isOpen, onClose }: IndexSidebarProps) {
    return (
        <aside
            aria-label="Market indices sidebar"
            className={[
                'fixed top-0 left-0 z-40 h-screen w-60',
                'border-r border-[var(--border-color)]',
                'transition-transform duration-300 ease-in-out',
                isOpen ? 'translate-x-0' : '-translate-x-full',
            ].join(' ')}
            style={{ background: 'rgba(15, 15, 15, 0.97)', backdropFilter: 'blur(12px)', boxShadow: '4px 0 24px var(--shadow-color)' }}
        >
            {/*
             * pt-[120px] clears the sticky header (brand row ~72px + nav row ~48px).
             * The header's z-50 visually overlaps this area anyway,
             * so the sidebar appears to slide out from below the header.
             */}
            <div className="pt-[136px] px-4 pb-6 flex flex-col h-full">
                {/* Drawer header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>Indices</span>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close indices panel"
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-elevated)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Index cards */}
                <div className="space-y-3">
                    {INDICES.map((index) => (
                        <button
                            key={index.symbol}
                            disabled
                            title={`${index.name} — coming in a future release`}
                            className="w-full flex flex-col items-start gap-1 px-3 py-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-left opacity-50 cursor-not-allowed"
                        >
                            <span className="text-2xl font-bold text-[var(--text-secondary)] leading-none">
                                {index.abbr}
                            </span>
                            <span className="text-xs font-semibold text-[var(--text-secondary)] mt-1">
                                {index.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                                {index.region}
                            </span>
                            <span className="mt-2 text-[9px] font-bold tracking-wider bg-[var(--accent-primary)] text-white px-2 py-0.5 rounded-full opacity-70">
                                SOON
                            </span>
                        </button>
                    ))}
                </div>

                <p className="mt-6 text-[10px] text-[var(--text-muted)] leading-relaxed">
                    Index predictions are planned for a future release.
                </p>
            </div>
        </aside>
    );
}
