import {readFileSync} from "node:fs";
import redis from "../../config/client.js";
import { type RateLimiter, type RateLimiterResult } from "../../core/types.js";
const TOKEN_BUCKET_SCRIPT=readFileSync(
    new URL("./scripts/TokenBucket.lua",import.meta.url),
    "utf-8"
);
   

export class RedisTokenBucket implements RateLimiter{
    constructor(
        private capacity:number,
        private refilllrate:number

    ){}
    async check(key: string): Promise<RateLimiterResult> {  
        const rediskey=`rate:token:${key}`;
        const result=await redis.eval(TOKEN_BUCKET_SCRIPT, { //execute 
            keys:[rediskey],
            arguments:[
                String(this.capacity),
                String(this.refilllrate)
            ]

        });
        if (!Array.isArray(result) || result.length !== 3) {
            throw new Error("Invalid Redis Token Bucket response");
        }

        const [allowed, remaining, retryAfterMs] = result as [number, number, number];
        const isAllowed=allowed===1; //lua gives 0 and 1 but our RatelimiterResult interface expects a boolean so convert it
        return{
            allowed:isAllowed,
            limit:this.capacity,
            remaining,
            resetAt:Date.now()+retryAfterMs,
            retryAfterMs


        };



        
    }

}