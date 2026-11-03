import Fastify from "fastify";
const app=Fastify();
const MAX_REQUESTS=2;
const WINDOW_MS=60000;

const counts:Record<string, number>={};  //how many req each ip make
const startTimes:Record<string, number>={}; //when each ip's minute started

app.addHook("onRequest",async(request,reply)=>{
    const ip=request.ip;
    const now=Date.now();
     if (!startTimes[ip] || now - startTimes[ip] > WINDOW_MS) {
    startTimes[ip] = now;
    counts[ip] = 0;
  }

  counts[ip] = counts[ip] + 1;

  // too many: block them
  if (counts[ip] > MAX_REQUESTS) {
    return reply.code(429).send({ error: "Too many requests" });
  }
});




app.get("/",async()=>{   //handler 
    return{message:"hello"};
});
app.listen({port:3000},(err)=>{
    if (err) {
        console.error(err);
        process.exit(1);

    }
    console.log("running on http://localhost:3000");
});
