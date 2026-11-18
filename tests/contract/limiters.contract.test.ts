import { RateLimiterContract } from "./RateLimiterContract.js";
import { FixedWindowFactory, TokenBucketFactory, SlidingWindowFactory } from "./factories.js";
RateLimiterContract(FixedWindowFactory);
RateLimiterContract(TokenBucketFactory);
RateLimiterContract(SlidingWindowFactory);