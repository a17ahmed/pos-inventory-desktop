import React, { useEffect, useRef, useState } from 'react';
import { subscribeLoading } from '../../services/loadingBar';

// A thin accent bar under the top bar while the app talks to the server (any request).
// - waits 150 ms before appearing, so quick answers never flicker
// - creeps forward while waiting (fast first, then slower — never reaches the end by itself)
// - runs to 100 % and fades when the last request finishes
// State that the timers read lives in refs, so a request ending at the very moment the bar
// appears can't leave it stuck on screen.

const SHOW_AFTER = 150;

export function TopLoadingBar() {
    const [progress, setProgress] = useState(0); // 0..100
    const [visible, setVisible] = useState(false);
    const t = useRef({ busy: false, visible: false, show: null, trickle: null, hide: null, reset: null });

    useEffect(() => {
        const s = t.current;
        const stopTimers = () => {
            clearTimeout(s.show);
            clearInterval(s.trickle);
            clearTimeout(s.hide);
            clearTimeout(s.reset);
        };
        const start = () => {
            clearTimeout(s.hide);
            clearTimeout(s.reset);
            if (s.visible) {
                // already showing (a new request while finishing) — keep creeping
                if (!s.trickle) s.trickle = setInterval(creep, 200);
                return;
            }
            clearTimeout(s.show);
            s.show = setTimeout(() => {
                if (!s.busy) return; // finished meanwhile — never show
                s.visible = true;
                setVisible(true);
                setProgress(8);
                clearInterval(s.trickle);
                s.trickle = setInterval(creep, 200);
            }, SHOW_AFTER);
        };
        const finish = () => {
            clearTimeout(s.show);
            clearInterval(s.trickle);
            s.trickle = null;
            if (!s.visible) return;
            setProgress(100);
            s.hide = setTimeout(() => {
                s.visible = false;
                setVisible(false);
            }, 260);
            s.reset = setTimeout(() => {
                if (!s.visible) setProgress(0);
            }, 560);
        };
        // big steps early, tiny steps later: 8 → ~60 quickly, then crawls toward 92
        const creep = () => setProgress((p) => (p >= 92 ? p : p + Math.max(0.4, (92 - p) * 0.07)));

        const unsubscribe = subscribeLoading((n) => {
            const busy = n > 0;
            if (busy === s.busy) return;
            s.busy = busy;
            if (busy) start();
            else finish();
        });
        return () => {
            unsubscribe();
            stopTimers();
        };
    }, []);

    return (
        <div aria-hidden={!visible} className="pointer-events-none absolute inset-x-0 top-0 z-[60] h-0.5 overflow-hidden print:hidden">
            <div
                className="h-full bg-primary shadow-[0_0_8px_var(--primary)] origin-left"
                style={{
                    width: `${progress}%`,
                    opacity: visible ? 1 : 0,
                    transition: `width ${progress === 100 ? 180 : 220}ms ease-out, opacity 260ms ease ${progress === 100 ? '120ms' : '0ms'}`,
                }}
            />
            {visible ? (
                <span className="sr-only" role="status">
                    Loading…
                </span>
            ) : null}
        </div>
    );
}

export default TopLoadingBar;
