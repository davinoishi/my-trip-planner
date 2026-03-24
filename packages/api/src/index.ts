import { router } from "./trpc";
import { usersRouter } from "./routers/users";
import { tripsRouter } from "./routers/trips";
import { itineraryItemsRouter } from "./routers/itinerary-items";
import { documentsRouter } from "./routers/documents";
import { importsRouter } from "./routers/imports";
import { packingListRouter } from "./routers/packing-list";
import { tagsRouter } from "./routers/tags";
import { sharesRouter } from "./routers/shares";

export const appRouter = router({
  users: usersRouter,
  trips: tripsRouter,
  itineraryItems: itineraryItemsRouter,
  documents: documentsRouter,
  imports: importsRouter,
  packingList: packingListRouter,
  tags: tagsRouter,
  shares: sharesRouter,
});

export type AppRouter = typeof appRouter;
export { router, publicProcedure, protectedProcedure } from "./trpc";
export type { Context } from "./context";

