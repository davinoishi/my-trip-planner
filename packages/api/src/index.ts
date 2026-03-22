import { router } from "./trpc";
import { usersRouter } from "./routers/users";
import { tripsRouter } from "./routers/trips";

export const appRouter = router({
  users: usersRouter,
  trips: tripsRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, protectedProcedure } from "./trpc";
export type { Context } from "./context";
