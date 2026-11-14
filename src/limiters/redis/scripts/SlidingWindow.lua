local time=redis.call("TIME")
local seconds=tonumber(time[1])
local microseconds=tonumber(time[2])
local now=seconds*1000+math.floor(microseconds/1000)

local key=KEYS[1]
local limit=tonumber(ARGV[1])
local windowMs=tonumber(ARGV[2])

if limit==nil or windowMs==nil or limit<=0 or windowMs<=0 then
    return redis.error_reply("invalid args")
end
if limit%1 ~=0 then
    return redis.error_reply("limit must be an integer")
end

local currentwindowstart=math.floor(now/windowMs)*windowMs
local bucket =redis.call(
    "HMGET",
    key,
    "previouscount",
    "currentcount",
    "windowstart"
)
local previouscount=tonumber(bucket[1]) or 0
local currentcount=tonumber(bucket[2]) or 0 
local windowstart=tonumber(bucket[3]) or currentwindowstart
if currentwindowstart > windowstart then
    local windowspassed = math.floor(
        (currentwindowstart - windowstart) / windowMs
    )

    previouscount = windowspassed == 1 and currentcount or 0
    currentcount = 0
    windowstart = currentwindowstart
end
local elapsedtime=math.max(0,now-windowstart)
local weight=(windowMs-elapsedtime)/windowMs
local estimatedcount=previouscount*weight+currentcount
local allowed=estimatedcount<limit 
if allowed then 
    currentcount=currentcount+1
end
local remaining=math.max(0, math.floor(limit-estimatedcount-(allowed and 1 or 0))) --how many req user can make after currentrequest
local resetAt=windowstart+windowMs
local retryAfterMs=0
if not allowed then
    retryAfterMs=math.max(0,resetAt-now)
end
redis.call("HSET",key,
    "previouscount",previouscount,
    "currentcount", currentcount,
    "windowstart",windowstart
    
)
redis.call("PEXPIRE", key, windowMs * 2)

return{
    allowed and 1 or 0,
    remaining,
    resetAt,
    retryAfterMs
}