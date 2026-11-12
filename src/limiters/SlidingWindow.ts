import { type RateLimiter, type RateLimiterResult } from "./types.js";

interface windowcounter {
    previouscount: number;
    currentcount: number;
    windowstart: number;
}
export class SlidingWindowCounterLimiter implements RateLimiter {
    private store = new Map<string, windowcounter>();

    constructor(
        private limit: number,
        private windowsMs: number,
        private now: () => number = Date.now

    ) {
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new Error("limit must be a positive Integer");
        }
        if (!Number.isFinite(windowsMs) || windowsMs <= 0) {
            throw new Error("windowMs must be positive");
        }
    }
    async check(key: string): Promise<RateLimiterResult> {
        const now = this.now();
        const currentwindowstart = Math.floor(now / this.windowsMs) * this.windowsMs;
        let entry = this.store.get(key);// entry means data stored for one particular user
        if (!entry) {
            entry = {
                previouscount: 0,
                currentcount: 0,
                windowstart: currentwindowstart

            };
            this.store.set(key, entry);

        }
        //window transition case
        if (currentwindowstart > entry.windowstart) {
            const windowspassed = Math.floor((currentwindowstart - entry.windowstart) / this.windowsMs);
            entry.previouscount = windowspassed === 1 ? entry.currentcount : 0;
            entry.currentcount = 0;
            entry.windowstart = currentwindowstart;

        }
        const elapsedtime = Math.max(0,now - entry.windowstart);
        const weight = (this.windowsMs - elapsedtime) / this.windowsMs;
        const estimatedcount = entry.previouscount * weight + entry.currentcount;
        const allowed = estimatedcount < this.limit;
        if (allowed) {
            entry.currentcount++;
        }
        const remaining = Math.max(
            0,
            Math.floor(this.limit - estimatedcount - (allowed ? 1 : 0))
        );

        const resetAt = entry.windowstart + this.windowsMs;

        const retryAfterMs = allowed
            ? 0
            : Math.max(0, resetAt - now);

        return {
            allowed,
            limit: this.limit,
            remaining,
            resetAt,
            retryAfterMs
        };

    }
}