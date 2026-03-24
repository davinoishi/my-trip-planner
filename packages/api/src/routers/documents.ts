import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { documents, trips, participants } from "@trip/db";
import { TRPCError } from "@trpc/server";
import { deleteFile, getPresignedDownloadUrl } from "../lib/storage";

async function assertTripAccess(
  ctx: { db: any; user: { id: string; email: string } },
  tripId: string,
  requireEdit = false
) {
  const trip = await ctx.db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
  if (trip.ownerId === ctx.user.id) return trip;

  const participant = await ctx.db.query.participants.findFirst({
    where: and(
      eq(participants.tripId, tripId),
      eq(participants.email, ctx.user.email)
    ),
  });
  if (!participant) throw new TRPCError({ code: "FORBIDDEN" });
  if (requireEdit && participant.role === "viewer")
    throw new TRPCError({ code: "FORBIDDEN" });
  return trip;
}

export const documentsRouter = router({
  /** List all documents for a trip, optionally filtered by itinerary item. */
  list: protectedProcedure
    .input(z.object({ tripId: z.string(), itemId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertTripAccess(ctx, input.tripId);
      const rows = await ctx.db
        .select()
        .from(documents)
        .where(eq(documents.tripId, input.tripId));

      return input.itemId
        ? rows.filter(
            (d: { itemId: string | null }) =>
              d.itemId === input.itemId
          )
        : rows;
    }),

  /** Generate a short-lived presigned download URL (1 hour). */
  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripAccess(ctx, doc.tripId);

      const url = await getPresignedDownloadUrl(doc.storageKey);
      return { url };
    }),

  /** Delete a document — removes from MinIO and DB. */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripAccess(ctx, doc.tripId, true);

      // Only the uploader or trip owner can delete
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, doc.tripId),
      });
      if (doc.uploadedBy !== ctx.user.id && trip?.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await deleteFile(doc.storageKey);
      await ctx.db.delete(documents).where(eq(documents.id, input.id));
      return { success: true };
    }),

  /** Attach or detach a document from an itinerary item. */
  setItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        itemId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTripAccess(ctx, doc.tripId, true);

      const [updated] = await ctx.db
        .update(documents)
        .set({ itemId: input.itemId })
        .where(eq(documents.id, input.id))
        .returning();
      return updated!;
    }),
});

