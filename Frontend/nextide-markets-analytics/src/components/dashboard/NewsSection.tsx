'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Clock, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import { fetchNews } from '@/src/lib/api';
import type { NewsHeadline } from '@/src/types';

function timeAgo(published: string): string {
    if (!published) return '';
    const ms = Date.now() - new Date(published).getTime();
    if (isNaN(ms)) return '';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export function NewsSection() {
    const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await fetchNews();
            setHeadlines(data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Newspaper className="w-4 h-4 text-[var(--text-muted)]" />
                            Latest Bitcoin Headlines
                        </CardTitle>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                            Sourced from CoinDesk RSS · used for NLP sentiment scoring
                        </p>
                    </div>
                    {!loading && (
                        <button
                            onClick={load}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-elevated)] transition-colors"
                            aria-label="Refresh headlines"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {loading && (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-12 bg-[var(--background-elevated)] rounded-lg animate-pulse" />
                        ))}
                    </div>
                )}

                {!loading && error && (
                    <p className="text-sm text-[var(--text-muted)] text-center py-6">
                        Could not load headlines. <button onClick={load} className="text-[var(--color-primary)] underline">Retry</button>
                    </p>
                )}

                {!loading && !error && headlines.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)] text-center py-6">No headlines available right now.</p>
                )}

                {!loading && !error && headlines.length > 0 && (
                    <ul className="divide-y divide-[var(--border-color)]">
                        {headlines.map((h, i) => (
                            <li key={i} className="py-3 flex items-start justify-between gap-3 group">
                                <div className="flex-1 min-w-0">
                                    <a
                                        href={h.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[var(--text-primary)] hover:text-[var(--color-primary)] transition-colors leading-snug line-clamp-2 flex items-start gap-1"
                                    >
                                        {h.title}
                                        <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                                    </a>
                                    {h.published && (
                                        <span className="flex items-center gap-1 mt-1 text-[11px] text-[var(--text-muted)]">
                                            <Clock className="w-3 h-3" />
                                            {timeAgo(h.published)}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
