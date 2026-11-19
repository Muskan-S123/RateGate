import {createClient} from "redis";
const redis=createClient({
    url:"redis://localhost:6379",
    socket:{
        reconnectStrategy:false //prevents multiple attempts when redis isnot running
    }

});
redis.on("error",(err)=>{

    console.error("Redis error:", err);

});
export async function connectRedis(){
    await redis.connect();
    
}
export default redis;