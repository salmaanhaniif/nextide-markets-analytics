'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PanelLeftOpen, PanelLeftClose, Cpu, ChevronDown } from 'lucide-react';
import { AssetNav } from './AssetNav';
import { IndexSidebar } from './IndexSidebar';
import { useModel } from '@/src/contexts/ModelContext';
import type { ModelId } from '@/src/contexts/ModelContext';

const MODELS: { id: ModelId; label: string; badge: string; available: boolean }[] = [
    { id: 'xgboost', label: 'XGBoost', badge: 'BEST', available: true },
    { id: 'lstm',    label: 'LSTM',    badge: '',      available: true },
];

const SOON_MODELS = [
    { id: 'tft', label: 'TFT', badge: 'SOON' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [modelMenuOpen, setModelMenuOpen] = useState(false);
    const { selectedModel, setSelectedModel } = useModel();

    const activeModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

    return (
        <div className="min-h-screen bg-[var(--background-main)]">
            {/* Sticky header — z-50 sits above the drawer */}
            <header className="border-b border-[var(--border-color)] sticky top-0 z-50"
                style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(16px)', boxShadow: '0 2px 24px var(--shadow-color)' }}>
                <div className="w-full max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between gap-3">
                        {/* Left: sidebar toggle + logo */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSidebarOpen((v) => !v)}
                                aria-label="Toggle market indices panel"
                                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-elevated)] transition-colors"
                            >
                                {sidebarOpen
                                    ? <PanelLeftClose className="w-5 h-5" />
                                    : <PanelLeftOpen  className="w-5 h-5" />}
                            </button>
                            <div className="rounded-lg overflow-hidden w-10 h-10 flex-shrink-0">
                                <Image src="/icon.png" alt="NexTide icon" width={40} height={40} className="object-contain" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-[var(--text-primary)]">
                                    NexTide Analytics
                                </h1>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    AI-Powered Market Prediction &amp; Analysis
                                </p>
                            </div>
                        </div>

                        {/* Right: model selector */}
                        <div className="relative">
                            <button
                                onClick={() => setModelMenuOpen((v) => !v)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                                style={{ background: 'rgba(72, 58, 160, 0.25)' }}
                            >
                                <Cpu className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline font-medium">{activeModel.label}</span>
                                {activeModel.badge && (
                                    <span className="hidden sm:inline text-[10px] font-bold text-[var(--color-success)]">
                                        {activeModel.badge}
                                    </span>
                                )}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Click-outside backdrop */}
                            {modelMenuOpen && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setModelMenuOpen(false)}
                                />
                            )}

                            {modelMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-52 border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden"
                                    style={{ background: 'rgba(15, 15, 15, 0.97)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px var(--shadow-color)' }}>
                                    <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-color)]">
                                        Prediction Model
                                    </div>
                                    {MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                setSelectedModel(model.id);
                                                setModelMenuOpen(false);
                                            }}
                                            className={[
                                                'w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors',
                                                model.id === selectedModel
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'text-[var(--text-secondary)] hover:bg-[rgba(72,58,160,0.3)] hover:text-[var(--text-primary)]',
                                            ].join(' ')}
                                        >
                                            <span className="font-medium">{model.label}</span>
                                            {model.badge && (
                                                <span className="text-[10px] font-bold text-[var(--color-success)]">
                                                    {model.badge}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                    {SOON_MODELS.length > 0 && (
                                        <div className="border-t border-[var(--border-color)]">
                                            {SOON_MODELS.map((model) => (
                                                <div
                                                    key={model.id}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                                                >
                                                    <span className="font-medium">{model.label}</span>
                                                    <span className="text-[10px] font-bold text-[var(--text-muted)]">{model.badge}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <AssetNav />
            </header>

            {/* Backdrop — click outside to close */}
            <div
                onClick={() => setSidebarOpen(false)}
                className={[
                    'fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
                    sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                ].join(' ')}
            />

            {/* Collapsible indices drawer */}
            <IndexSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Page content */}
            <main className="w-full max-w-7xl mx-auto px-6 py-8">
                {children}
            </main>

            <footer className="border-t border-[var(--border-color)] mt-12" style={{ background: 'var(--background-secondary)' }}>
                <div className="w-full max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                        <p>© 2026 NexTide Analytics. Powered by XGBoost &amp; NLP.</p>
                        <p className="text-[var(--color-warning)]">Not financial advice.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
