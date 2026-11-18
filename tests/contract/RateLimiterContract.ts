import { describe, it, expect, afterEach } from "vitest";
import { type LimiterFactory, LIMIT, WINDOW_MS } from "./factories.js";
export function RateLimiterContract(factory: LimiterFactory) {
    describe(`${factory.name} contract`, () => {
        let setup: ReturnType<LimiterFactory["make"]>|undefined;//for make method
        afterEach(async() => {
            await setup?.teardown();  //if setup exits use teardown if not then do nothing
            setup=undefined;

        });

        it("allows requests within limit", async () => {
           setup = factory.make();
           for(let i=0; i<LIMIT; i++){
            expect((await setup.limiter.check("user-1")).allowed).toBe(true);  
           }
        });

        it("rejects the requests after reaching the limit", async () => {
            setup = factory.make();
            for(let i=0; i<LIMIT;i++){
                await setup.limiter.check("user-1");
            }
            expect((await setup.limiter.check("user-1")).allowed).toBe(false);
          
        });

        it("returns configured limit", async () => {
            setup = factory.make();
            expect((await setup.limiter.check("user-1")).limit).toBe(LIMIT);

        });

        it("maintains independent limits for different users", async () => {
            setup = factory.make();

            for(let i=0;i<LIMIT;i++){
                await setup.limiter.check("user-1");
            }
            expect((await setup.limiter.check("user-1")).allowed).toBe(false);
            expect((await setup.limiter.check("user-2")).allowed).toBe(true);

        });

        it("never allows more than limits under concurrent requests", async()=>{
            setup=factory.make();
            const results=await Promise.all(
                Array.from({length:50}, ()=>setup!.limiter.check("user-1"))//builds array of 50

            );
            expect(results.filter((r)=> r.allowed).length).toBe(LIMIT);

        });

        if (factory.supportsTimeTravel) { //only inmemory implementation supportsTimeTravel
            it("allows requests again after the window passes", async () => {
                setup = factory.make();
                for(let i=0;i<LIMIT;i++){
                    await setup.limiter.check("user-1");
                }
                expect((await setup.limiter.check("user-1")).allowed).toBe(false);
                setup.advance!(2*WINDOW_MS); //advance time forwards
                expect((await setup.limiter.check("user-1")).allowed).toBe(true); //next req allowed
 
            });
        }

    });
}