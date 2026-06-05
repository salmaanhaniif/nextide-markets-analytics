import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PriceResult {
    price: number;
    prev_close: number;
    change_pct: number;
    source: string;
}

async function tryYahooFinance(): Promise<PriceResult> {
    // v8 chart endpoint — same one yfinance Python uses internally
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1m&range=1d';
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('Yahoo Finance: no price in response');
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? price;
    return {
        price,
        prev_close: prevClose,
        change_pct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
        source: 'yahoo-finance',
    };
}

async function tryBlockchain(): Promise<PriceResult> {
    const res = await fetch('https://blockchain.info/ticker', {
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Blockchain.info HTTP ${res.status}`);
    const json = await res.json();
    const price = json?.USD?.last;
    if (!price) throw new Error('Blockchain.info: no USD price');
    return {
        price,
        prev_close: json?.USD?.buy ?? price,
        change_pct: 0,
        source: 'blockchain.info',
    };
}

async function tryCoinCap(): Promise<PriceResult> {
    const res = await fetch('https://api.coincap.io/v2/assets/bitcoin', {
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`CoinCap HTTP ${res.status}`);
    const json = await res.json();
    const price = parseFloat(json?.data?.priceUsd);
    if (isNaN(price)) throw new Error('CoinCap: invalid price');
    const changePct = parseFloat(json?.data?.changePercent24Hr ?? '0');
    return {
        price,
        prev_close: price / (1 + changePct / 100),
        change_pct: changePct,
        source: 'coincap',
    };
}

async function tryCoinGecko(): Promise<PriceResult> {
    const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const json = await res.json();
    const price = json?.bitcoin?.usd;
    if (!price) throw new Error('CoinGecko: no price');
    const changePct = json?.bitcoin?.usd_24h_change ?? 0;
    return {
        price,
        prev_close: price / (1 + changePct / 100),
        change_pct: changePct,
        source: 'coingecko',
    };
}

const SOURCES = [tryYahooFinance, tryBlockchain, tryCoinCap, tryCoinGecko];

export async function GET() {
    const errors: string[] = [];

    for (const source of SOURCES) {
        try {
            const data = await source();
            return NextResponse.json(
                { ...data, timestamp: new Date().toISOString() },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        } catch (err) {
            errors.push(String(err));
        }
    }

    return NextResponse.json(
        { error: 'All price sources failed', details: errors },
        { status: 503 },
    );
}
