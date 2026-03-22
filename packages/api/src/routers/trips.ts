import { z } from "zod";
import { eq, and, or, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { trips, participants } from "@trip/db";
import { createTripSchema, updateTripSchema } from "@trip/shared";
import { TRPCError } from "@trpc/server";
import { nanoid } from "../utils/id.js";

export const tripsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Return trips the user owns or participates in
    const owned = await ctx.db
      .select()
      .from(trips)
      .where(eq(trips.ownerId, ctx.user.id))
      .orderBy(desc(trips.startDate));

    return owned;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.id),
      });

      if (!trip) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check access: owner or participant
      if (trip.ownerId !== ctx.user.id) {
        const participant = await ctx.db.query.participants.findFirst({
          where: and(
            eq(participants.tripId, input.id),
            eq(participants.email, ctx.user.email)
          ),
        });
        if (!participant) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      return trip;
    }),

  create: protectedProcedure
    .input(createTripSchema)
    .mutation(async ({ ctx, input }) => {
      const [trip] = await ctx.db
        .insert(trips)
        .values({
          id: nanoid(),
          ...input,
          ownerId: ctx.user.id,
        })
        .returning();
      return trip;
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
      return updated;
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
      return { success: true };
    }),
});
