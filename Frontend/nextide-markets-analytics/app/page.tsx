'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { SignalWidget } from '@/src/components/dashboard/SignalWidget';
import { MultiHorizonCards } from '@/src/components/dashboard/MultiHorizonCards';
import { PriceChart } from '@/src/components/dashboard/PriceChart';
import { SentimentGauge } from '@/src/components/dashboard/SentimentGauge';
import { FeatureInsights } from '@/src/components/dashboard/FeatureInsights';
import { BacktestSection } from '@/src/components/dashboard/BacktestSection';
import { ModelFeaturesSection } from '@/src/components/dashboard/ModelFeaturesSection';
import { NewsSection } from '@/src/components/dashboard/NewsSection';
import { ModelHealthBadge } from '@/src/components/dashboard/ModelHealthBadge';
import { Button } from '@/src/components/ui/Button';
import { LoadingSkeleton } from '@/src/components/ui/Loading';
import { ErrorMessage } from '@/src/components/ui/ErrorMessage';
import { fetchDailyPrediction, fetchHistory, fetchBacktest } from '@/src/lib/api';
import { useModel } from '@/src/contexts/ModelContext';
import type {
    DailyPrediction,
    HistoryEntry,
    BacktestResponse,
    ChartDataPoint,
    HorizonPrediction,
    PredictionSignal,
    SignalAction,
    SignalStrength,
} from '@/src/types';

type Horizon = 'y1' | 'y7' | 'y30';

const HORIZON_LABEL: Record<Horizon, string> = {
    y1: '1-Day',
    y7: '7-Day',
    y30: '30-Day',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekStart(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // back to Monday
    return d.toISOString().slice(0, 10);
}

function aggregateByWeek(entries: HistoryEntry[]): HistoryEntry[] {
    const map = new Map<string, HistoryEntry>();
    for (const e of entries) map.set(getWeekStart(e.meta.data_as_of), e);
    return Array.from(map.values());
}

function aggregateByMonth(entries: HistoryEntry[]): HistoryEntry[] {
    const map = new Map<string, HistoryEntry>();
    for (const e of entries) map.set(e.meta.data_as_of.slice(0, 7), e);
    return Array.from(map.values());
}

function fmtWeek(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function fmtMonth(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function buildChartData(
    history: HistoryEntry[],
    prediction: DailyPrediction,
    horizon: Horizon,
): ChartDataPoint[] {
    let entries: HistoryEntry[];
    let fmt: (d: string) => string;

    if (horizon === 'y1') {
        entries = history.slice(-30);
        fmt = (d) => d;
    } else if (horizon === 'y7') {
        entries = aggregateByWeek(history).slice(-26);
        fmt = fmtWeek;
    } else {
        entries = aggregateByMonth(history).slice(-12);
        fmt = fmtMonth;
    }

    const points: ChartDataPoint[] = entries.map((entry) => ({
        date: fmt(entry.meta.data_as_of),
        actual: entry.current.price,
        predicted: entry.predictions[horizon].predicted_price,
        range_low: entry.predictions[horizon].range_low,
        range_high: entry.predictions[horizon].range_high,
    }));

    // Don't show today's actual price on the chart—the day hasn't closed yet (closes at 00:00 UTC).
    // We'll only show it once it's in the history after the day closes.

    const h = prediction.predictions[horizon];
    points.push({
        date: fmt(h.target_date),
        predicted: h.predicted_price,
        range_low: h.range_low,
        range_high: h.range_high,
    });
    return points;
}

function deriveHorizonSignal(horizon: HorizonPrediction, horizonKey: Horizon): PredictionSignal {
    const isUp = horizon.direction === 'UP';
    const conf = horizon.confidence;
    let action: SignalAction;
    if (conf >= 0.6) {
        action = isUp ? (conf >= 0.75 ? 'STRONG_BUY' : 'BUY') : (conf >= 0.75 ? 'STRONG_SELL' : 'SELL');
    } else {
        action = 'HOLD';
    }
    const strength: SignalStrength = conf >= 0.75 ? 'STRONG' : conf >= 0.6 ? 'MODERATE' : 'LOW_CONFIDENCE';
    const pct = (isUp ? '+' : '') + horizon.price_change_pct.toFixed(2) + '%';
    const reasoning = `${HORIZON_LABEL[horizonKey]} outlook: model projects ${pct} to ${horizon.target_date} with ${(conf * 100).toFixed(0)}% confidence.`;
    return { action, strength, reasoning };
}

export default function DashboardPage() {
    const { selectedModel } = useModel();

    const [prediction, setPrediction] = useState<DailyPrediction | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selectedHorizon, setSelectedHorizon] = useState<Horizon>('y1');

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [pred, hist, bt] = await Promise.all([
                fetchDailyPrediction(selectedModel),
                fetchHistory(365, selectedModel),
                fetchBacktest(selectedModel),
            ]);
            setPrediction(pred);
            setHistory(hist);
            setBacktest(bt);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedModel]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Reload whenever the active model changes
    useEffect(() => {
        setLoading(true);
        setPrediction(null);
        loadData();
    }, [selectedModel, loadData]);

    // Auto-refresh every 24 hours (data only updates once daily at 00:10 UTC)
    useEffect(() => {
        const interval = setInterval(loadData, 24 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [loadData]);

    const chartData = useMemo(
        () => (prediction && history.length ? buildChartData(history, prediction, selectedHorizon) : []),
        [history, prediction, selectedHorizon],
    );

    const activeSignal = useMemo<PredictionSignal | null>(() => {
        if (!prediction) return null;
        return selectedHorizon === 'y1'
            ? prediction.signal
            : deriveHorizonSignal(prediction.predictions[selectedHorizon], selectedHorizon);
    }, [prediction, selectedHorizon]);

    if (loading) return <LoadingSkeleton />;
    if (error || !prediction || !activeSignal) return <ErrorMessage message={error ?? 'No data available'} onRetry={handleRefresh} />;

    const { current, predictions, key_drivers, model_health } = prediction;

    return (
        <div className="space-y-6">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--text-primary)]">
                        Bitcoin Prediction Dashboard
                    </h2>
                    <p className="text-[var(--text-secondary)] mt-1 text-sm">
                        Data as of {prediction.meta.data_as_of} · {selectedModel.toUpperCase()} v{prediction.meta.model_version}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <ModelHealthBadge health={model_health} />
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        variant="secondary"
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing…' : lastUpdated
                            ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Refresh'}
                    </Button>
                </div>
            </div>

            {/* Signal + live price ticker — Binance feed, 10 s interval */}
            <SignalWidget
                signal={activeSignal}
                predictedClose={predictions.y1.predicted_price}
                predictedConfidence={predictions.y1.confidence}
                predictedTargetDate={predictions.y1.target_date}
                prevCloseOverride={history.length > 0 ? history[history.length - 1].current.price : undefined}
            />

            {/* Price chart — full width, with horizon filter */}
            <PriceChart
                data={chartData}
                currentPrice={current.price}
                selectedHorizon={selectedHorizon}
                onHorizonChange={setSelectedHorizon}
            />

            {/* Multi-horizon prediction cards */}
            <MultiHorizonCards
                y1={predictions.y1}
                y7={predictions.y7}
                y30={predictions.y30}
                currentPrice={current.price}
            />

            {/* Sentiment + Feature grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SentimentGauge current={current} />
                <FeatureInsights drivers={key_drivers} />
            </div>

            {/* Backtest section */}
            {backtest && <BacktestSection backtest={backtest} />}

            {/* Model input features */}
            <ModelFeaturesSection />

            {/* News headlines */}
            <NewsSection />

            {/* Disclaimer */}
            <div className="p-4 bg-[var(--background-surface)] border border-[var(--border-color)] rounded-lg">
                <p className="text-xs text-[var(--text-secondary)] text-center leading-relaxed">
                    <span className="font-semibold text-[var(--color-warning)]">Disclaimer:</span>{' '}
                    This dashboard provides AI-generated predictions for informational purposes only.
                    Cryptocurrency trading involves substantial risk. Always conduct your own research
                    and consult a financial advisor before making investment decisions.
                </p>
            </div>
        </div>
    );
}
