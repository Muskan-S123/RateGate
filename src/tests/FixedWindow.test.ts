import { describe, it, expect } from "vitest";
import { FixedWindowLimiter } from "../limiters/FixedWindow";

describe("FixedWindowLimiter", () => {
  it("blocks the 3rd request", () => {   //test 1 limit is 2 req more than 2 will be block
    const limiter = new FixedWindowLimiter(2, 60000);

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("keeps different keys independent", () => {  //test 2 checks the key b is unaffected each key has its own counter
    const limiter = new FixedWindowLimiter(2, 60000);

    limiter.check("a");
    limiter.check("a");
    limiter.check("a"); // "a" is now blocked

    expect(limiter.check("b").allowed).toBe(true);
  });

  it("allows requests again after the window passes", () => {  //test 3 for the reseting after the window expires
    let time = 0;
    const limiter = new FixedWindowLimiter(2, 60000, () => time);

    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    time = 61000;

    // TODO
    expect(limiter.check("a").allowed).toBe(true);

  });

  it("rejects invalid maximum requests", () => {  //test 4
    expect(() => new FixedWindowLimiter(0, 60000)).toThrow();

    expect(() => new FixedWindowLimiter(-2, 60000)).toThrow();
  });

  it("rejects invalid window duration", () => {  //test 5
    expect(() => new FixedWindowLimiter(5, 0)).toThrow();

    expect(() => new FixedWindowLimiter(5, -1000)).toThrow();
  });

  it("returns the max",()=>{   // test 6 
    const limiter=new FixedWindowLimiter(5,60000);
    const result=limiter.check("a");
    expect(result.limit).toBe(5);
  });

  it("returns the correct remaining requests", () => {
    const limiter = new FixedWindowLimiter(3, 60000);

    expect(limiter.check("a").remaining).toBe(2);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").remaining).toBe(0);
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("returns the correct reset timestamp", () => {
    const limiter = new FixedWindowLimiter(3, 60000, () => 1000);

    const result = limiter.check("a");

    expect(result.resetAt).toBe(61000);
  });

  it("returns retry time when blocked", () => {
    let time = 1000;
    const limiter = new FixedWindowLimiter(2, 60000, () => time);

    limiter.check("a");
    limiter.check("a");

    const result = limiter.check("a");

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60000);

    time = 11000;

    expect(limiter.check("a").retryAfterMs).toBe(50000);
  });

  it("removes expired entries during cleanup", () => {
    let time = 0;
    const limiter = new FixedWindowLimiter(2, 60000, () => time);

    limiter.check("a");

    time = 61000;
    limiter.cleanup();

    expect(limiter.check("a").remaining).toBe(1);
  });
});