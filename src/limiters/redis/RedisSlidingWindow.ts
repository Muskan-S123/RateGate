import { readFileSync } from "node:fs";
import redis from "../../config/client.js";
import { type RateLimiter, type RateLimiterResult } from "../../core/types.js";

const SLIDING_WINDOW_SCRIPT = readFileSync(
    new URL("./scripts/SlidingWindow.lua", import.meta.url),
    "utf-8"

)
export class RedisSlidingWindow implements RateLimiter {
    constructor(
        private limit: number,
        private windowMs: number

    ) {
        if (!Number.isInteger(this.limit) || this.limit <= 0) {
            throw new Error("limit must be a positive Integer");
        }

        if (!Number.isFinite(this.windowMs) || this.windowMs <= 0) {
            throw new Error("windowMs must be positive");
        }
    }
    async check(key: string): Promise<RateLimiterResult> {
        const rediskey = `rate:sliding:${key}`;

        const result = await redis.eval(SLIDING_WINDOW_SCRIPT, {
            keys: [rediskey],
            arguments: [
                String(this.limit),
                String(this.windowMs)
            ]
        });
        const [allowed, remaining, resetAt, retryAfterMs] = result as [number, number, number, number];
        return {
            allowed: allowed === 1,
            limit: this.limit,
            remaining,
            resetAt,
            retryAfterMs
        };


    }

}