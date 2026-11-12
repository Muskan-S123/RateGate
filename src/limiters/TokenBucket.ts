import {type RateLimiter, type RateLimiterResult} from "./types.js";
interface Bucket{
    tokens:number;
    lastrefill:number;
}
export class TokenBucketLimiter implements RateLimiter{
     private store=new Map<string, Bucket>();
    constructor(
        private capacity:number,
        private refillrate:number,
        private now:()=>number=Date.now


    ){
        if(!Number.isInteger(capacity)||capacity<=0){  //validate constructor input
            throw new Error("Capacity must be positive value");
        }
        if(!Number.isFinite(refillrate)||refillrate<=0){
            throw new Error("refillrate must be positive")
        }
    }
    async check(key:string): Promise<RateLimiterResult>{
        const now=this.now();       
        let bucket=this.store.get(key);   //find and get a bucket if bucket is missing create one
        if(!bucket){ 
            bucket={
                tokens: this.capacity,
                lastrefill: now 

            };
            this.store.set(key,bucket); 


        }
        const elapsedtime=Math.max(0,now-bucket.lastrefill);   ///calculate elapsed time and prevent negative timestamps
        const refillrateperMs=this.refillrate/1000;  //convert refillrate from token per second to millisecond
        const newtokens=elapsedtime*refillrateperMs;  //calculate how many tokens generated during elapsed time
        bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedtime * refillrateperMs);  //add new tokens to bucket
        bucket.lastrefill=Math.max(bucket.lastrefill,now);  //we added Math.max to prevent timestamp from moving backward 
        const allowed=bucket.tokens>=1;
        if(allowed){
            
            bucket.tokens=bucket.tokens-1;

        }
        const retryAfterMs=allowed?0:Math.ceil((1-bucket.tokens)/refillrateperMs);
        return{
            allowed,
            limit: this.capacity,
            remaining:Math.floor(bucket.tokens),
            resetAt:now+retryAfterMs,  //timestamp of winow reset
            retryAfterMs
        };
        
        


    } //cleanup are doing explicitly need to implement in redis
    cleanup(): void {
    const now = this.now();
    const refillRatePerMs = this.refillrate / 1000;

    for (const [key, b] of this.store) {
        const elapsed = Math.max(0, now - b.lastrefill);

        const timeToFull =
            (this.capacity - b.tokens) / refillRatePerMs;

        if (elapsed >= timeToFull) {
            this.store.delete(key);
        }
    }
}

 



}
   