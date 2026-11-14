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