

import { describe, it, expect } from "vitest";
import { SlidingWindowCounterLimiter } from "../limiters/SlidingWindow.js";

describe("SlidingWindowCounterLimiter", () => {
    let currentTime = 0;

    const createLimiter = (limit = 5, windowMs = 60_000) => {
        currentTime = 0;

        return new SlidingWindowCounterLimiter(
            limit,
            windowMs,
            () => currentTime
        );
    };

    it("allows the first request", async () => {
        const limiter = createLimiter();

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    it("allows requests until the limit is reached", async () => {
        const limiter = createLimiter(3);

        await limiter.check("user1");
        await limiter.check("user1");

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it("rejects requests after the limit is reached", async () => {
        const limiter = createLimiter(2);

        await limiter.check("user1");
        await limiter.check("user1");

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it("calculates the weighted previous window count", async () => {
        const limiter = createLimiter(10);

        for (let i = 0; i < 8; i++) {
            await limiter.check("user1");
        }

        currentTime = 75_000;

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3);
    });

    it("moves the current count into the previous count after one window", async () => {
        const limiter = createLimiter(5);

        await limiter.check("user1");
        await limiter.check("user1");

        currentTime = 60_000;

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("resets old counts when multiple windows have passed", async () => {
        const limiter = createLimiter(3);

        await limiter.check("user1");
        await limiter.check("user1");
        await limiter.check("user1");

        currentTime = 180_000;

        const result = await limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("keeps different users independent", async () => {
        const limiter = createLimiter(2);

        await limiter.check("user1");
        await limiter.check("user1");

        const result = await limiter.check("user2");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it("rejects an invalid limit", () => {
        expect(() => createLimiter(0)).toThrow();
    });

    it("rejects an invalid window duration", () => {
        expect(
            () => new SlidingWindowCounterLimiter(5, 0, () => currentTime)
        ).toThrow();
    });

    it("returns the current window reset time", async () => {
        const limiter = createLimiter(5);

        currentTime = 10_000;

        const result = await limiter.check("user1");

        expect(result.resetAt).toBe(60_000);
    });
});
