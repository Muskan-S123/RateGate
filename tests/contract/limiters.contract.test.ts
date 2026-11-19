import { afterAll } from "vitest";
import redis, { connectRedis } from "../../src/config/client.js";
import { RateLimiterContract } from "./RateLimiterContract.js";
import { FixedWindowFactory, TokenBucketFactory, SlidingWindowFactory } from "./factories.js";
import { RedisFixedWindowFactory, RedisTokenBucketFactory, RedisSlidingWindowFactory } from "./factories.js";

RateLimiterContract(FixedWindowFactory);
RateLimiterContract(TokenBucketFactory);
RateLimiterContract(SlidingWindowFactory);

let redisAvailable = false; //redis contracts only when redis avsailable
try {
    await connectRedis();
    redisAvailable=true;

} catch {
    console.warn("Redis unavailable skipping redis contract tests");

}
if (redisAvailable) {
    RateLimiterContract(RedisFixedWindowFactory);
    RateLimiterContract(RedisTokenBucketFactory);
    RateLimiterContract(RedisSlidingWindowFactory);

}
//close redis
afterAll(async()=>{
    if(redisAvailable && redis.isOpen){
        await redis.quit();
    }

});


