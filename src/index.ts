import Fastify from "fastify";
import { FixedWindowLimiter } from "../limiters/FixedWindowLimiter";

const app = Fastify();
const limiter = new FixedWindowLimiter(2, 60000);

app.addHook("onRequest", async (request, reply) => {
  const result = limiter.check(request.ip);
  if (!result.allowed) {
    return reply.code(429).send({ error: "Too many requests" });
  }
});

app.get("/", async () => ({ message: "hello" }));

app.listen({ port: 3000 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("running on http://localhost:3000");
});