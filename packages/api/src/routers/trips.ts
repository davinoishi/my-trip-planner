import { z } from "zod";
import { eq, and, desc, asc, or, exists } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { trips, participants, accountShares, itineraryItems } from "@trip/db";
import { createTripSchema, updateTripSchema } from "@trip/shared";
import { TRPCError } from "@trpc/server";
import { nanoid } from "../utils/id";
import { rateLimit } from "../lib/rate-limit";
import { writeAuditLog } from "../lib/audit";
import { resolveTripAccess, activatePendingShares } from "../lib/access";

export const tripsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Lazily activate any pending shares for this user on each list call
    void activatePendingShares(ctx.db, ctx.user.id, ctx.user.email);

    // All trips: owned + shared via direct participant entry + shared via account share
    const allTrips = await ctx.db
      .select()
      .from(trips)
      .where(
        or(
          eq(trips.ownerId, ctx.user.id),
          exists(
            ctx.db
              .select()
              .from(participants)
              .where(
                and(
                  eq(participants.tripId, trips.id),
                  or(
                    eq(participants.userId, ctx.user.id),
                    eq(participants.email, ctx.user.email)
                  )
                )
              )
          ),
          exists(
            ctx.db
              .select()
              .from(accountShares)
              .where(
                and(
                  eq(accountShares.ownerId, trips.ownerId),
                  or(
                    eq(accountShares.sharedWithUserId, ctx.user.id),
                    eq(accountShares.sharedWithEmail, ctx.user.email)
                  )
                )
              )
          )
        )
      )
      .orderBy(desc(trips.startDate));

    // Tag each trip with whether it's shared to this user (not owned)
    return allTrips.map((t) => ({
      ...t,
      isSharedToMe: t.ownerId !== ctx.user.id,
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const access = await resolveTripAccess(ctx.db, input.id, ctx.user.id, ctx.user.email);
      if (!access.canRead) throw new TRPCError({ code: "FORBIDDEN" });

      const trip = await ctx.db.query.trips.findFirst({ where: eq(trips.id, input.id) });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...trip, isSharedToMe: !access.isOwner, canWrite: access.canWrite };
    }),

  create: protectedProcedure
    .input(createTripSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 20 trips created per user per hour
      const rl = await rateLimit(`trips-create:${ctx.user.id}`, 20, 3600);
      if (!rl.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many trips created. Please try again later." });
      }

      const [trip] = await ctx.db
        .insert(trips)
        .values({
          id: nanoid(),
          ...input,
          timezone: input.timezone ?? "UTC",
          status: input.status ?? "planning",
          ownerId: ctx.user.id,
        })
        .returning();
      return trip!;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateTripSchema }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: and(eq(trips.id, input.id), eq(trips.ownerId, ctx.user.id)),
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(trips)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(trips.id, input.id))
        .returning();
      return updated!;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(trips)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(trips.id, input.id), eq(trips.ownerId, ctx.user.id)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      await writeAuditLog({
        userId: ctx.user.id,
        action: "trip.archive",
        resourceType: "trip",
        resourceId: input.id,
        metadata: { tripName: updated.name },
      });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(trips)
        .where(and(eq(trips.id, input.id), eq(trips.ownerId, ctx.user.id)))
        .returning();
      if (!result.length) throw new TRPCError({ code: "NOT_FOUND" });
      await writeAuditLog({
        userId: ctx.user.id,
        action: "trip.delete",
        resourceType: "trip",
        resourceId: input.id,
        metadata: { tripName: result[0]!.name },
      });
      return { success: true };
    }),

  // Deep-clones a trip and all its itinerary items
  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.db.query.trips.findFirst({
        where: and(eq(trips.id, input.id), eq(trips.ownerId, ctx.user.id)),
      });
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      const newTripId = nanoid();

      // Clone the trip
      const [newTrip] = await ctx.db
        .insert(trips)
        .values({
          ...original,
          id: newTripId,
          name: `${original.name} (Copy)`,
          status: "planning",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Clone all itinerary items (without documents)
      const items = await ctx.db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.tripId, input.id))
        .orderBy(asc(itineraryItems.dayIndex), asc(itineraryItems.sortOrder));

      if (items.length > 0) {
        await ctx.db.insert(itineraryItems).values(
          items.map((item) => ({
            ...item,
            id: nanoid(),
            tripId: newTripId,
            source: "manual" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        );
      }

      await writeAuditLog({
        userId: ctx.user.id,
        action: "trip.duplicate",
        resourceType: "trip",
        resourceId: newTripId,
        metadata: { originalTripId: input.id, originalTripName: original.name },
      });
      return newTrip!;
    }),

  // Merges all itinerary items from sourceId into targetId, then deletes sourceId
  merge: protectedProcedure
    .input(z.object({ targetId: z.string(), sourceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetId === input.sourceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge a trip with itself",
        });
      }

      const [target, source] = await Promise.all([
        ctx.db.query.trips.findFirst({
          where: and(eq(trips.id, input.targetId), eq(trips.ownerId, ctx.user.id)),
        }),
        ctx.db.query.trips.findFirst({
          where: and(eq(trips.id, input.sourceId), eq(trips.ownerId, ctx.user.id)),
        }),
      ]);

      if (!target || !source) throw new TRPCError({ code: "NOT_FOUND" });

      // Get current max sort order in target
      const targetItems = await ctx.db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.tripId, input.targetId));

      const maxSortOrder = targetItems.reduce(
        (max, item) => Math.max(max, item.sortOrder),
        0
      );

      // Re-assign source items to target with adjusted sort order
      const sourceItems = await ctx.db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.tripId, input.sourceId))
        .orderBy(asc(itineraryItems.dayIndex), asc(itineraryItems.sortOrder));

      if (sourceItems.length > 0) {
        await ctx.db.insert(itineraryItems).values(
          sourceItems.map((item, i) => ({
            ...item,
            id: nanoid(),
            tripId: input.targetId,
            sortOrder: maxSortOrder + i + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        );
      }

      // Delete the source trip (cascade deletes its now-orphaned items)
      await ctx.db
        .delete(trips)
        .where(eq(trips.id, input.sourceId));

      await writeAuditLog({
        userId: ctx.user.id,
        action: "trip.merge",
        resourceType: "trip",
        resourceId: input.targetId,
        metadata: {
          targetTripName: target.name,
          sourceTripId: input.sourceId,
          sourceTripName: source.name,
          itemsMerged: sourceItems.length,
        },
      });

      return target;
    }),
});
