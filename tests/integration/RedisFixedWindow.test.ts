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
});