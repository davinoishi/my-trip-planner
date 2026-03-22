import { router } from "./trpc";
import { usersRouter } from "./routers/users";
import { tripsRouter } from "./routers/trips";
import { itineraryItemsRouter } from "./routers/itinerary-items";

export const appRouter = router({
  users: usersRouter,
  trips: tripsRouter,
  itineraryItems: itineraryItemsRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, protectedProcedure } from "./trpc";
export type { Context } from "./context";
