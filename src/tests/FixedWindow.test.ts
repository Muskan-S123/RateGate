
import { describe, it, expect } from "vitest";
import { FixedWindowLimiter } from "../limiters/FixedWindow.js";

describe("FixedWindowLimiter", () => {
  it("blocks the 3rd request", async () => {
    const limiter = new FixedWindowLimiter(2, 60000);

    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(false);
  });

  it("keeps different keys independent", async () => {
    const limiter = new FixedWindowLimiter(2, 60000);

    await limiter.check("a");
    await limiter.check("a");
    await limiter.check("a");

    expect((await limiter.check("b")).allowed).toBe(true);
  });

  it("allows requests again after the window passes", async () => {
    let time = 0;
    const limiter = new FixedWindowLimiter(2, 60000, () => time);

    await limiter.check("a");
    await limiter.check("a");
    expect((await limiter.check("a")).allowed).toBe(false);

    time = 61000;

    expect((await limiter.check("a")).allowed).toBe(true);
  });

  it("rejects invalid maximum requests", () => {
    expect(() => new FixedWindowLimiter(0, 60000)).toThrow();
    expect(() => new FixedWindowLimiter(-2, 60000)).toThrow();
  });

  it("rejects invalid window duration", () => {
    expect(() => new FixedWindowLimiter(5, 0)).toThrow();
    expect(() => new FixedWindowLimiter(5, -1000)).toThrow();
  });

  it("returns the max", async () => {
    const limiter = new FixedWindowLimiter(5, 60000);
    const result = await limiter.check("a");

    expect(result.limit).toBe(5);
  });

  it("returns the correct remaining requests", async () => {
    const limiter = new FixedWindowLimiter(3, 60000);

    expect((await limiter.check("a")).remaining).toBe(2);
    expect((await limiter.check("a")).remaining).toBe(1);
    expect((await limiter.check("a")).remaining).toBe(0);
    expect((await limiter.check("a")).remaining).toBe(0);
  });

  it("returns the correct reset timestamp", async () => {
    const limiter = new FixedWindowLimiter(3, 60000, () => 1000);

    const result = await limiter.check("a");

    expect(result.resetAt).toBe(61000);
  });

  it("returns retry time when blocked", async () => {
    let time = 1000;
    const limiter = new FixedWindowLimiter(2, 60000, () => time);

    await limiter.check("a");
    await limiter.check("a");

    const result = await limiter.check("a");

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60000);

    time = 11000;

    expect((await limiter.check("a")).retryAfterMs).toBe(50000);
  });

  it("removes expired entries during cleanup", async () => {
    let time = 0;
    const limiter = new FixedWindowLimiter(2, 60000, () => time);

    await limiter.check("a");

    time = 61000;
    limiter.cleanup();

    expect((await limiter.check("a")).remaining).toBe(1);
  });
});
