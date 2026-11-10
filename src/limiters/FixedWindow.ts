//interface, header, cleanup still remaining
import {type RateLimiter, type RateLimiterResult} from "./types.js";
export class FixedWindowLimiter implements RateLimiter{
    private store = new Map<string,{  //"user:123"
        count:number,              //count : 4
        start:number               //start:160000
    }>();
    constructor(
        private max: number,
        private windowsMS: number,
        private now: () => number = Date.now

    ) {
        if(!Number.isInteger(max) || max<=0){
            throw new Error("Max requests must be positive integer");
        }
        if(!Number.isFinite(windowsMS) || windowsMS<=0){
            throw new Error("Window duration must be positive");
        }
    }
    check(key:string): RateLimiterResult{  //user:
        const now=this.now();
        let entry=this.store.get(key); //if key is never seen then entry is undefined ,if seen entry is {count, start}
        if(!entry||now-entry.start >= this.windowsMS){
            entry={count:0,start:now}
            this.store.set(key,entry);
        }
        entry.count++;
        const resetAt=entry.start+this.windowsMS;
        const allowed=entry.count<=this.max;

        return{
            allowed,
            limit: this.max,
            remaining:Math.max(0,this.max-entry.count),
            resetAt,  //timestamp of winow reset
            retryAfterMs: allowed?0:Math.max(0,resetAt-now)  //milliseconds remained until expiration (resetAt-now)

        };
    }
    cleanup(): void {
    const now = this.now();

    for (const [key, entry] of this.store.entries()) {
        if (now - entry.start >= this.windowsMS) {
            this.store.delete(key);
        }
    }
}
    
}  