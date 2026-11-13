import { resourceUsage } from "node:process";
import redis from "../redis/client.js";
import { type RateLimiter, type RateLimiterResult } from "./types.js";
const TOKEN_BUCKET_SCRIPT=`
    local time=redis.call("TIME")

    local seconds=tonumber(time[1])
    local microseconds=tonumber(time[2])
    local now=seconds*1000+math.floor(microseconds/1000)

    local key=KEYS[1]
    local capacity=tonumber(ARGV[1])
    local refillrate=tonumber(ARGV[2])
    if capacity == nil or refillrate == nil or capacity <= 0 or refillrate <= 0 then
       return redis.error_reply("invalid args")
    end
    if capacity%1~=0 then
       return redis.error_reply("capacity must be an integer")
    end

    local bucket=redis.call("HMGET",key, "tokens", "lastrefill")
    local tokens=tonumber(bucket[1])
    local lastrefill=tonumber(bucket[2])
    if tokens==nil or lastrefill==nil then
       tokens=capacity
       lastrefill=now
    end
    local elapsedtime=math.max(0, now-lastrefill)
    local refillrateperMs=refillrate/1000
    tokens=math.min(capacity, tokens+elapsedtime*refillrateperMs)
    lastrefill=math.max(lastrefill,now)
    local allowed=0
    if tokens>=1 then
       tokens=tokens-1
       allowed=1
    end
    local remaining=math.floor(tokens)
    local retryAfterMs=0
    if allowed==0 then
       retryAfterMs=math.ceil((1-tokens)/refillrateperMs)
    end
    redis.call("HSET",key,"tokens",tokens,"lastrefill",lastrefill)
    local timetofull=(capacity-tokens)/refillrateperMs
    if timetofull>0 then 
       
        redis.call("PEXPIRE",key,math.ceil(timetofull))
    else
        redis.call("DEL",key)
    end


    return {allowed, remaining, retryAfterMs}
`;
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