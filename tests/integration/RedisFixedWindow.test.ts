import { describe, it, expect, beforeAll, afterAll } from "vitest";
import redis from "../../src/config/client.js";
import { connectRedis } from "../../src/config/client.js";
import { RedisFixedWindow } from "../../src/limiters/redis/RedisFixedWindow.js";

describe("RedisFixedWindow", () => {
    const limiter = new RedisFixedWindow(2, 60000);

    beforeAll(async () => {
        await connectRedis();
        await redis.del("rate:test-user");
    });

    afterAll(async () => {
        await redis.del("rate:test-user");
        await redis.quit();
    });

    it("allows requests within the limit", async () => {
        const first = await limiter.check("test-user");
        const second = await limiter.check("test-user");

        expect(first.allowed).toBe(true);
        expect(second.allowed).toBe(true);
    });

    it("rejects requests after the limit", async () => {
        const third = await limiter.check("test-user");

        expect(third.allowed).toBe(false);
        expect(third.remaining).toBe(0);
    });
    it("remaining count decreases correctly", async () => {
        await redis.del("rate:fixed:remaining-user");
        const first = await limiter.check("remaining-user");
        const second = await limiter.check("remaining-user");

        expect(first.remaining).toBe(1);
        expect(second.remaining).toBe(0);

    });
    it("keeps different users separately", async () => {
        await redis.del("rate:fixed:user-a");
        await redis.del("rate:fixed:user-b");

        await limiter.check("user-a");
        await limiter.check("user-a");

        const result = await limiter.check("user-b");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);

    });
    it("returns a future reset timestamp", async () => {
        const result = await limiter.check("reset-user");

        expect(result.resetAt).toBeGreaterThan(Date.now());
    });
    it("returns retry time when limit is exceeded", async () => {
        await redis.del("rate:fixed:retry-user");

        await limiter.check("retry-user");
        await limiter.check("retry-user");

        const rejected = await limiter.check("retry-user");

        expect(rejected.retryAfterMs).toBeGreaterThan(0);
    });
    it("resets the counter after the window expires", async () => {
        const shortLimiter = new RedisFixedWindow(2, 200);

        await redis.del("rate:fixed:expiry-user");

        await shortLimiter.check("expiry-user");
        await shortLimiter.check("expiry-user");

        const rejected = await shortLimiter.check("expiry-user");
        expect(rejected.allowed).toBe(false);

        await new Promise(resolve => setTimeout(resolve, 250));

        const afterExpiry = await shortLimiter.check("expiry-user");

        expect(afterExpiry.allowed).toBe(true);
        expect(afterExpiry.remaining).toBe(1);
    });
    it("handles concurrent requests without exceeding the limit", async () => {
        const concurrentLimiter = new RedisFixedWindow(5, 60000);

        await redis.del("rate:fixed:concurrent-user");

        const results = await Promise.all(
            Array.from({ length: 10 }, () =>
                concurrentLimiter.check("concurrent-user")
            )
        );

        const allowed = results.filter(result => result.allowed);
        const rejected = results.filter(result => !result.allowed);

        expect(allowed).toHaveLength(5);
        expect(rejected).toHaveLength(5);
    });
});

