import {readFileSync} from "node:fs";
import redis from "../../config/client.js";
import { type RateLimiter, type RateLimiterResult } from "../../core/types.js";
const FIXED_WINDOW_SCRIPT=readFileSync(
    new URL("./scripts/FixedWindow.lua", import.meta.url),
    "utf-8"
);
export class RedisFixedWindow implements RateLimiter{
    constructor(
        private max:number,
        private windowsMs:number

    ){
        if (!Number.isInteger(this.max) || this.max <= 0) {
            throw new Error("limit must be a positive Integer");
        }

        if (!Number.isFinite(this.windowsMs) || this.windowsMs <= 0) {
            throw new Error("windowMs must be positive");
        }
    }
    async check(key:string): Promise<RateLimiterResult>{
        
        const rediskey=`rate:fixed:${key}`;
        const result=await redis.eval(FIXED_WINDOW_SCRIPT,{
            keys:[rediskey],
            arguments:[
                String(this.max),
                String(this.windowsMs)
            ]

        });
        const [allowed, remaining, resetAt, retryAfterMs]=result as [number, number, number, number];

        return{
            allowed:allowed===1,
            limit:this.max,
            remaining,
            resetAt,
            retryAfterMs

        };

    }

}
