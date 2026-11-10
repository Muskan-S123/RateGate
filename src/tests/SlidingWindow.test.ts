
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

    it("allows the first request", () => {
        const limiter = createLimiter();

        const result = limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    it("allows requests until the limit is reached", () => {
        const limiter = createLimiter(3);

        limiter.check("user1");
        limiter.check("user1");

        const result = limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
    });

    it("rejects requests after the limit is reached", () => {
        const limiter = createLimiter(2);

        limiter.check("user1");
        limiter.check("user1");

        const result = limiter.check("user1");

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it("calculates the weighted previous window count", () => {
        const limiter = createLimiter(10);

        // Add 8 requests in the previous window.
        for (let i = 0; i < 8; i++) {
            limiter.check("user1");
        }

        // Move to 15 seconds into the next window.
        currentTime = 75_000;

        const result = limiter.check("user1");

        // Previous count = 8
        // Weight = (60 - 15) / 60 = 0.75
        // Estimated previous count = 8 * 0.75 = 6
        // One new request is allowed.
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3);
    });

    it("moves the current count into the previous count after one window", () => {
        const limiter = createLimiter(5);

        limiter.check("user1");
        limiter.check("user1");

        currentTime = 60_000;

        const result = limiter.check("user1");

        // Previous count = 2, weight = 1.
        // Estimated count before this request = 2.
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("resets old counts when multiple windows have passed", () => {
        const limiter = createLimiter(3);

        limiter.check("user1");
        limiter.check("user1");
        limiter.check("user1");

        currentTime = 180_000;

        const result = limiter.check("user1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("keeps different users independent", () => {
        const limiter = createLimiter(2);

        limiter.check("user1");
        limiter.check("user1");

        const result = limiter.check("user2");

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

    it("returns the current window reset time", () => {
        const limiter = createLimiter(5);

        currentTime = 10_000;

        const result = limiter.check("user1");

        expect(result.resetAt).toBe(60_000);
    });
});
