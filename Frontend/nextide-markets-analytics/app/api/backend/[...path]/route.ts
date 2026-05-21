import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

// Navigate from this file's location up to the project root, then into Backend/
// route.ts is at: Frontend/nextide-markets-analytics/app/api/backend/[...path]/route.ts
const BACKEND_ROOT = path.resolve(
    process.cwd(),  // Frontend/nextide-markets-analytics/ when running npm run dev
    '..', '..', 'Backend'
);

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    const { path: segments } = await params;
    const filePath = path.join(BACKEND_ROOT, ...segments);

    // Safety: ensure the resolved path stays inside Backend/
    if (!filePath.startsWith(BACKEND_ROOT)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const content = readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        return NextResponse.json(json, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (err) {
        return NextResponse.json(
            { error: 'File not found', detail: String(err), root: BACKEND_ROOT },
            { status: 404 }
        );
    }
}
