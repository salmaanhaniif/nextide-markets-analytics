'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Build the digit reel strip for the slot-machine spin effect.
 * Starts at `prev`, counts up (or down) through 2 full loops of 0-9,
 * and always lands exactly on `curr`.
 *
 * Example  prev='3' curr='7' dir='up'  → ['3','4','5',...,'9','0','1','2','3','4','5','6','7']
 */
function buildStrip(prev: string, curr: string, dir: 'up' | 'down'): string[] {
    const p = parseInt(prev, 10);
    const c = parseInt(curr, 10);

    // Shortest natural distance in the chosen direction
    let dist = dir === 'up'
        ? (c - p + 10) % 10
        : (p - c + 10) % 10;
    if (dist === 0) dist = 10; // same digit → still do one full loop

    // 2 extra full loops (20 steps) for the slot-machine "spin" feel
    const totalSteps = dist + 20;

    const strip: string[] = [prev];
    let d = p;
    for (let i = 0; i < totalSteps; i++) {
        d = dir === 'up' ? (d + 1) % 10 : (d + 9) % 10;
        strip.push(String(d));
    }
    // strip[totalSteps] === curr by construction — no need to force it
    return strip;
}

// ── Single digit reel ─────────────────────────────────────────────────────────
function Digit({
    curr,
    prev,
    dir,
    animKey,
}: {
    curr: string;
    prev: string;
    dir: 'up' | 'down';
    animKey: number;
}) {
    const trackRef  = useRef<HTMLSpanElement>(null);
    // Keep latest strip in a ref so the layout-effect closure never goes stale
    const stripRef  = useRef<string[] | null>(null);

    const isAnimated = curr !== prev && /\d/.test(curr) && /\d/.test(prev);
    stripRef.current = isAnimated ? buildStrip(prev, curr, dir) : null;

    useLayoutEffect(() => {
        const el    = trackRef.current;
        const strip = stripRef.current;
        if (!el || !strip) return;

        // Measure one row's height from the overflow-hidden parent (px = no unit ambiguity)
        const rowH = el.parentElement?.offsetHeight ?? 0;
        if (rowH === 0) return;

        const endY = -(strip.length - 1) * rowH;

        // 1. Snap to top (prev digit) without transition
        el.style.transition = 'none';
        el.style.transform  = 'translateY(0px)';
        // 2. Force browser to register the start position before animating
        void el.offsetHeight;
        // 3. Spin down to curr with slot-machine deceleration curve
        el.style.transition = 'transform 0.85s cubic-bezier(0.15, 0.05, 0.25, 1)';
        el.style.transform  = `translateY(${endY}px)`;
    }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Non-digit or unchanged character — render as plain span, no animation
    if (!isAnimated) return <span>{curr}</span>;

    const strip = stripRef.current!;

    return (
        <span
            style={{
                display    : 'inline-block',
                overflow   : 'hidden',
                height     : '1lh',   // exactly one line-height tall → clips the reel
                verticalAlign: 'top',
            }}
        >
            <span
                ref={trackRef}
                style={{ display: 'flex', flexDirection: 'column' }}
            >
                {strip.map((ch, i) => (
                    <span
                        key={i}
                        style={{ display: 'block', height: '1lh', lineHeight: '1lh' }}
                    >
                        {ch}
                    </span>
                ))}
            </span>
        </span>
    );
}

// ── Public component ──────────────────────────────────────────────────────────
interface RollingNumberProps {
    /** Pre-formatted price string, e.g. "$63,832.64" */
    value: string | null;
    className?: string;
}

export function RollingNumber({ value, className = '' }: RollingNumberProps) {
    const [state, setState] = useState({
        curr   : value ?? '',
        prev   : value ?? '',
        dir    : 'up' as 'up' | 'down',
        animKey: 0,
    });

    useEffect(() => {
        if (!value) return;
        setState(s => {
            // s.curr is the displayed value from the previous render —
            // the only safe "prev" since refs update before setState callbacks run.
            if (value === s.curr) return s;
            const prevNum = parseFloat(s.curr.replace(/[^0-9.]/g, ''));
            const currNum = parseFloat(value.replace(/[^0-9.]/g, ''));
            const dir: 'up' | 'down' = currNum >= prevNum ? 'up' : 'down';
            return { curr: value, prev: s.curr, dir, animKey: s.animKey + 1 };
        });
    }, [value]);

    if (!value) return <span className={className}>—</span>;

    const { curr, prev, dir, animKey } = state;

    // Right-align by padding so character positions are stable across length changes
    const maxLen  = Math.max(curr.length, prev.length);
    const currPad = curr.padStart(maxLen);
    const prevPad = prev.padStart(maxLen);

    return (
        <span className={`inline-flex tabular-nums ${className}`}>
            {Array.from(currPad).map((c, i) => (
                <Digit
                    key={i}
                    curr={c}
                    prev={prevPad[i] ?? c}
                    dir={dir}
                    animKey={animKey}
                />
            ))}
        </span>
    );
}
