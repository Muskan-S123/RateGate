export const LIMIT=2;
export const WINDOW_MS=60000;
import { FixedWindowLimiter } from "../../src/limiters/memory/FixedWindow.js";
import { SlidingWindowCounterLimiter } from "../../src/limiters/memory/SlidingWindow.js";
import { TokenBucketLimiter } from "../../src/limiters/memory/TokenBucket.js";

import { RedisFixedWindow } from "../../src/limiters/redis/RedisFixedWindow.js";
import { RedisTokenBucket } from "../../src/limiters/redis/RedisTokenBucket.js";
import { RedisSlidingWindow } from "../../src/limiters/redis/RedisSlidingWindow.js";
import redis from "../../src/config/client.js";

import { type RateLimiter } from "../../src/core/types.js";

export interface Clock{
    now():number;//to return time
    advance(ms:number):void; //to moves time forward it doesnot return any value so we used void
}
//implement FakeCLock class
export class FakeClock implements Clock {
    private currenttime=0;
    now():number{
        return this.currenttime;
    }
    advance(ms: number):void{
        this.currenttime=this.currenttime+ms;

    }

}
export interface LimiterFactory{   //structure every 6 algo should follow this contract
    name: string //name of algo
    supportsTimeTravel?:boolean;
    make():{  //creates setup for all algos
        limiter:RateLimiter;
        advance?:(ms: number)=>void;
        teardown():Promise<void>|void; //cleanup after testing
 
    };
}

//FixedWindow factory implement
export const FixedWindowFactory: LimiterFactory={
    name:"FixedWindow",
    supportsTimeTravel:true,
    make(){
        const clock=new FakeClock();
        const limiter=new FixedWindowLimiter(LIMIT, WINDOW_MS, ()=>clock.now());//limit, windowMs,now

        return {
            limiter,
            advance:(ms)=>clock.advance(ms),
            teardown:()=>limiter.cleanup()
        };
    }


};
export const TokenBucketFactory: LimiterFactory={
    name:"TokenBucket",
    supportsTimeTravel:true,
    make(){
        const clock=new FakeClock();
        const limiter=new TokenBucketLimiter(2, 1, ()=>clock.now());//capacity, refillrate,now
        return{
            limiter,
            advance:(ms)=>clock.advance(ms),
            teardown:()=>{}

        };
    }


};
export const SlidingWindowFactory:LimiterFactory={
    name:"SlidingWindow",
    supportsTimeTravel:true,
    make(){
        const clock=new FakeClock();
        const limiter=new SlidingWindowCounterLimiter(2, 60000, ()=>clock.now());//limit, windowMs, now
        return{
            limiter,
            advance:(ms)=>clock.advance(ms),
            teardown:()=>{}

        };
    }

};

//redis implementation
let ContractRunId=0;  //counter shared across all CreateRedisFactory(), everytime factory creates a new setup it increases the ccounter
function CreateRedisFactory(
    name:string,
    prefix:string,  //prefix i used eg: rate:"TokenBucket"
    createLimiter:()=>RateLimiter //function which creates limiter
):LimiterFactory{
    return{
        name,
        make(){
            //create unique namespace
            const namespace=`contract:${Date.now()}:${++ContractRunId}`;
            const keys=new Set<string>();  //track the keys, set stores uniue svalue and stores key only once coz one users can call multiple times
            const ActualLimiter=createLimiter();
            const limiter:RateLimiter={
                check(key:string){
                    const namespacedkey=`${namespace}:${key}`;
                    keys.add(`${prefix}${namespacedkey}`);
                    return ActualLimiter.check(namespacedkey); //forwards the request to the actual redis implementtion

                }

            };
            return{
                limiter,
                teardown:async()=>{
                    if(keys.size>0){
                        await redis.del([...keys]);
                    }
                }

            };
        }
    }

}
export const RedisFixedWindowFactory = CreateRedisFactory(
    "RedisFixedWindow",
    "rate:fixed:",
    () => new RedisFixedWindow(2, 60000)
);

export const RedisTokenBucketFactory = CreateRedisFactory(
    "RedisTokenBucket",
    "rate:token:",
    () => new RedisTokenBucket(2, 1)
);

export const RedisSlidingWindowFactory = CreateRedisFactory(
    "RedisSlidingWindow",
    "rate:sliding:",
    () => new RedisSlidingWindow(2, 60000)
);

