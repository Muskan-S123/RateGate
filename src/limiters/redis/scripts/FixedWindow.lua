local time=redis.call("TIME")
local seconds=tonumber(time[1])
local microseconds=tonumber(time[2])
local now=seconds*1000+math.floor(microseconds/1000)

local key=KEYS[1]
local max=tonumber(ARGV[1])
local windowsMs=tonumber(ARGV[2])

if max==nil or windowsMs==nil or max<=0 or windowsMs<=0 then
    return redis.error_reply("invalid args")
end
if max%1 ~=0 then
    return redis.error_reply("limit must be an integer")
end

local currentcount=redis.call("INCR",key)
if currentcount==1 then
    redis.call("PEXPIRE",key,windowsMs)
end
local ttl=redis.call("PTTL",key)
local allowed=0
if currentcount<=max then
    allowed=1
end
local remaining=math.max(0,max-currentcount)
local resetAt=now+ttl
local retryAfterMs=allowed==1 and 0 or ttl
return {allowed, remaining, resetAt, retryAfterMs}
