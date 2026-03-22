import { router } from "./trpc.js";
import { usersRouter } from "./routers/users.js";
import { tripsRouter } from "./routers/trips.js";

export const appRouter = router({
  users: usersRouter,
  trips: tripsRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, protectedProcedure } from "./trpc.js";
export type { Context } from "./context.js";
