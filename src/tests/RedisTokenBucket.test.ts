import { describe, it, expect, beforeAll, afterAll } from "vitest";
import redis, { connectRedis } from "../redis/client.js";
import { RedisTokenBucket } from "../limiters/RedisTokenBucket.js";
describe("RedisTokenBucket", () => {
    const limiter = new RedisTokenBucket(3, 1);
    const testKeys = [
        "test-user-1",
        "test-user-2",
        "test-user-3",
        "test-user-4",
        "test-user-5"
    ];
    beforeAll(async () => {
        await connectRedis();


    });
    afterAll(async () => {
        await redis.del(testKeys.map(key => `rate:token:${key}`));
        await redis.quit();

    });
    it("allows request while bucket has tokens", async () => {
        const result = await limiter.check("test-user-1");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);

    });
    it("consumes one token per request", async () => {
        await limiter.check("test-user-2");
        const result = await limiter.check("test-user-2");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it("rejects requests when bucket is empty", async () => {
        await limiter.check("test-user-3");
        await limiter.check("test-user-3");
        await limiter.check("test-user-3");

        const result = await limiter.check("test-user-3");

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("keeps different users independent", async () => {
        await limiter.check("test-user-4");
        await limiter.check("test-user-4");
        await limiter.check("test-user-4");

        const result = await limiter.check("test-user-5");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });
    //token refill
    it("refill tokens as time passes", async () => {
        const key = "test-refill";
        const testLimiter = new RedisTokenBucket(1, 10);
        await testLimiter.check(key);
        await new Promise(resolve => setTimeout(resolve, 300));
        const result = await testLimiter.check(key);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);

    });

    //capacity never exceeded
    it("cannot exceeds bucket capacity", async () => {

        const key = "test-capacity";
        const testLimiter = new RedisTokenBucket(3, 10);
        await testLimiter.check(key);
        await testLimiter.check(key);
        await testLimiter.check(key);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = await testLimiter.check(key);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);

    });
    //retryAfterMs
    it("returns correct retry time when bucket is empty",async()=>{
        const key="retryAfterMs";
        const testLimiter=new RedisTokenBucket(1,2);
        await testLimiter.check(key);
        const result=await testLimiter.check(key);
        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeLessThanOrEqual(500);
    });
    //concurrency
    it("concurrent requests should not overconsume tokens",async()=>{
        const key="test-concurrent";
        const testLimiter=new RedisTokenBucket(3,1);
        const results=await Promise.all(
            Array.from({length:10},()=>testLimiter.check(key))
        );
        const allowed=results.filter(result=>result.allowed);
        const rejected=results.filter(result=> !result.allowed);
        expect(allowed.length).toBe(3);
        expect(rejected.length).toBe(7);

    });


});
