
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import redis, { connectRedis } from "../../src/config/client.js";
import { RedisSlidingWindow } from "../../src/limiters/redis/RedisSlidingWindow.js";

describe("RedisSlidingWindow", () => {
    const limiter = new RedisSlidingWindow(3, 60_000);

    const testKeys = [
        "sliding-user-1",
        "sliding-user-2",
        "sliding-user-3",
        "sliding-user-4",
        "sliding-weighted",
        "sliding-expired",
        "sliding-concurrent"
    ];

    beforeAll(async () => {
        await connectRedis();
    });

    afterAll(async () => {
        await redis.del(
            testKeys.map(key => `rate:sliding:${key}`)
        );
        await redis.quit();
    });

    // 1. Basic request allowance
    it("allows requests while under the limit", async () => {
        const result = await limiter.check("sliding-user-1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
        expect(result.limit).toBe(3);
    });

    // 2. Counts each request
    it("consumes one request per allowed call", async () => {
        await limiter.check("sliding-user-2");
        const result = await limiter.check("sliding-user-2");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    // 3. Rejects requests after reaching the limit
    it("rejects requests after reaching the limit", async () => {
        await limiter.check("sliding-user-3");
        await limiter.check("sliding-user-3");
        await limiter.check("sliding-user-3");

        const result = await limiter.check("sliding-user-3");

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    // 4. Keeps different users independent
    it("keeps different users independent", async () => {
        await limiter.check("sliding-user-4");
        await limiter.check("sliding-user-4");
        await limiter.check("sliding-user-4");

        const result = await limiter.check("sliding-user-1");

        expect(result.allowed).toBe(true);
    });

    // Helper: wait until a particular position in a window
    async function waitUntilPhase(
        windowMs: number,
        targetPhase: number
    ) {
        const now = Date.now();
        const windowStart = Math.floor(now / windowMs) * windowMs;

        let target = windowStart + targetPhase;

        if (target <= now + 100) {
            target += windowMs;
        }

        await new Promise(resolve =>
            setTimeout(resolve, target - Date.now())
        );
    }

    // Helper: wait until a particular timestamp
    async function waitUntilTimestamp(target: number) {
        const delay = target - Date.now();

        if (delay > 0) {
            await new Promise(resolve =>
                setTimeout(resolve, delay)
            );
        }
    }

    // 5. Tests weighted previous-window count
    it("weights the previous window count", async () => {
        const windowMs = 10_000;
        const testLimiter = new RedisSlidingWindow(5, windowMs);
        const key = "sliding-weighted";

        // Start near the end of a window
        await waitUntilPhase(windowMs, 8_000);

        const previousWindowStart =
            Math.floor(Date.now() / windowMs) * windowMs;

        // Consume all 5 requests in the previous window
        for (let i = 0; i < 5; i++) {
            const result = await testLimiter.check(key);
            expect(result.allowed).toBe(true);
        }

        // Move into the next window
        await waitUntilTimestamp(previousWindowStart + windowMs + 100);

        const result = await testLimiter.check(key);

        // Previous count is weighted down, so the request is allowed
        expect(result.allowed).toBe(true);
    });

    // 6. Discards previous count after more than one window
    it("discards expired previous-window counts", async () => {
        const windowMs = 1_000;
        const testLimiter = new RedisSlidingWindow(3, windowMs);
        const key = "sliding-expired";

        await waitUntilPhase(windowMs, 100);

        const windowStart =
            Math.floor(Date.now() / windowMs) * windowMs;

        await testLimiter.check(key);
        await testLimiter.check(key);
        await testLimiter.check(key);

        // Skip two complete window boundaries
        await waitUntilTimestamp(windowStart + 2 * windowMs + 50);

        const result = await testLimiter.check(key);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    // 7. Returns correct retry time
    it("returns retry time when the limit is reached", async () => {
        const key = "sliding-retry";
        const testLimiter = new RedisSlidingWindow(1, 60_000);

        await testLimiter.check(key);

        const result = await testLimiter.check(key);

        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    });

    // 8. Handles concurrent requests atomically
    it("does not exceed the limit under concurrent requests", async () => {
        const key = "sliding-concurrent";
        const testLimiter = new RedisSlidingWindow(3, 60_000);

        const results = await Promise.all(
            Array.from(
                { length: 10 },
                () => testLimiter.check(key)
            )
        );

        const allowed = results.filter(result => result.allowed);
        const rejected = results.filter(result => !result.allowed);

        expect(allowed.length).toBe(3);
        expect(rejected.length).toBe(7);
    });
});
