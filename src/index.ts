import Fastify from "fastify";
import { connectRedis } from "./redis/client.js";
import { FixedWindowLimiter } from "./limiters/FixedWindow.js";

const app = Fastify();
const limiter = new FixedWindowLimiter(2, 60000);

app.addHook("onRequest", async (request, reply) => {
  const result = limiter.check(request.ip);
  if (!result.allowed) {
    return reply.code(429).send({ error: "Too many requests" });
  }
});

app.get("/", async () => ({ message: "hello" }));

async function start(){
  try{
    await connectRedis();
    await app.listen({port:3000});
    console.log("running on http://localhost:3000");

  }catch(err){
    console.log("Failed to start a server:", err);
    process.exit(1);

  }
}
start();