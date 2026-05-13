'use client';

import { Coins } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface NavAsset {
    symbol: string;
    name: string;
    abbr: string;
    available: boolean;
}

const CRYPTO: NavAsset[] = [
    { symbol: 'BTC', name: 'Bitcoin',  abbr: '₿', available: true  },
    { symbol: 'ETH', name: 'Ethereum', abbr: 'Ξ', available: false },
];

function AssetTab({ asset, isActive }: { asset: NavAsset; isActive: boolean }) {
    return (
        <button
            disabled={!asset.available}
            title={!asset.available ? `${asset.name} — coming in a future release` : asset.name}
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : asset.available
                        ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-elevated)] cursor-pointer'
                        : 'text-[var(--text-muted)] cursor-not-allowed opacity-50',
            )}
        >
            <span className="font-bold text-sm leading-none">{asset.abbr}</span>
            <span className="hidden md:inline text-xs">{asset.name}</span>
            {!asset.available && (
                <span className="hidden sm:inline text-[9px] font-bold tracking-wider bg-[var(--background-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
                    SOON
                </span>
            )}
        </button>
    );
}

export function AssetNav() {
    return (
        <nav aria-label="Crypto asset selector" className="border-t border-[var(--border-color)]">
            <div className="w-full max-w-7xl mx-auto px-6 py-2">
                <div className="flex items-center gap-2 overflow-x-auto">
                    <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold select-none mr-1">
                        <Coins className="w-3 h-3" />
                        <span>Crypto</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {CRYPTO.map((asset) => (
                            <AssetTab key={asset.symbol} asset={asset} isActive={asset.symbol === 'BTC'} />
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}
