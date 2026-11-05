export interface RateLimiterResult{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;


}
export interface RateLimiter {
  check(key: string): RateLimiterResult;
}