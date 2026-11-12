import redis from "../redis/client.js";
import { type RateLimiter, type RateLimiterResult } from "./types.js";

export class RedisFixedWindow implements RateLimiter{
    constructor(
        private max:number,
        private windowsMs:number

    ){}
    async check(key:string): Promise<RateLimiterResult>{
        
        const rediskey=`rate:${key}`;
        const currentcount=await redis.incr(rediskey);
        if(currentcount===1){
            await redis.expire(
                rediskey,
                Math.ceil(this.windowsMs/1000)
            );
        }
        const ttl=await redis.ttl(rediskey);
        const allowed=currentcount<=this.max;
        const remaining=Math.max(0, this.max-currentcount);
        const resetAt=Date.now()+ttl*1000;
        const retryAfterMs=allowed?0:ttl*1000;

        return{
            allowed,
            limit:this.max,
            remaining,
            resetAt,
            retryAfterMs

        };

    }

}
