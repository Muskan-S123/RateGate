

import { describe, it, expect } from "vitest";
import { TokenBucketLimiter } from "../limiters/TokenBucket.js";

describe("TokenBucketLimiter", () => {
    let currentTime = 1000;

    const createLimiter = (capacity = 3, refillRate = 1) => {
        currentTime = 1000;

        return new TokenBucketLimiter(
            capacity,
            refillRate,
            () => currentTime
        );
    };

    it("allows the first request because bucket starts full", async () => {
        const limiter = createLimiter(3, 1);

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("consumes one token per allowed request", async () => {
        const limiter = createLimiter(3, 1);

        await limiter.check("user1");
        await limiter.check("user1");

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it("rejects requests when bucket is empty", async () => {
        const limiter = createLimiter(2, 1);

        await limiter.check("user1");
        await limiter.check("user1");

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBe(1000);
    });

    it("refills tokens as time passes", async () => {
        const limiter = createLimiter(3, 1);

        await limiter.check("user1");
        await limiter.check("user1");
        await limiter.check("user1");

        currentTime += 1000;

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it("does not exceed bucket capacity", async () => {
        const limiter = createLimiter(3, 1);

        currentTime += 10000;

        const result = await limiter.check("user1");

        expect(result.remaining).toBe(2);
    });

    it("keeps different users independent", async () => {
        const limiter = createLimiter(2, 1);

        await limiter.check("user1");
        await limiter.check("user1");

        const result = await limiter.check("user2");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it("calculates retry time correctly", async () => {
        const limiter = createLimiter(1, 2);

        await limiter.check("user1");

        const result = await limiter.check("user1");

        expect(result.retryAfterMs).toBe(500);
    });

    it("rejects invalid capacity", () => {
        expect(() => new TokenBucketLimiter(0, 1)).toThrow();
        expect(() => new TokenBucketLimiter(-1, 1)).toThrow();
        expect(() => new TokenBucketLimiter(1.5, 1)).toThrow();
    });

    it("rejects invalid refill rate", () => {
        expect(() => new TokenBucketLimiter(3, 0)).toThrow();
        expect(() => new TokenBucketLimiter(3, -1)).toThrow();
        expect(() => new TokenBucketLimiter(3, Infinity)).toThrow();
    });

    it("does not move last refill time backwards", async () => {
        const limiter = createLimiter(2, 1);

        await limiter.check("user1");

        currentTime -= 500;

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });
});

describe("TokenBucketLimiter cleanup", () => {
    it("does not delete a partially filled bucket prematurely", async () => {
        let currentTime = 1000;
        const limiter = new TokenBucketLimiter(
            3, 1, () => currentTime
        );

        await limiter.check("user1");
        await limiter.check("user1");

        currentTime += 500;
        limiter.cleanup();

        const result = await limiter.check("user1");

        expect(result.remaining).toBe(0);
    });

    it("deletes a bucket after it has refilled completely", async () => {
        let currentTime = 1000;
        const limiter = new TokenBucketLimiter(
            3, 1, () => currentTime
        );

        await limiter.check("user1");
        await limiter.check("user1");
        await limiter.check("user1");

        currentTime += 3000;
        limiter.cleanup();

        const result = await limiter.check("user1");

        expect(result.remaining).toBe(2);
    });
});
