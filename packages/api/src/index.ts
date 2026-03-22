import { router } from "./trpc";
import { usersRouter } from "./routers/users";
import { tripsRouter } from "./routers/trips";
import { itineraryItemsRouter } from "./routers/itinerary-items";
import { documentsRouter } from "./routers/documents";
import { importsRouter } from "./routers/imports";

export const appRouter = router({
  users: usersRouter,
  trips: tripsRouter,
  itineraryItems: itineraryItemsRouter,
  documents: documentsRouter,
  imports: importsRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, protectedProcedure } from "./trpc";
export type { Context } from "./context";
