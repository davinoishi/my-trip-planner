import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { emailImports, itineraryItems, trips } from "@trip/db";
import { TRPCError } from "@trpc/server";

export const importsRouter = router({
  /**
   * List all unmatched email imports for the current user
   * (emails that were parsed but couldn't be matched to a trip).
   */
  listUnmatched: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(emailImports)
      .where(
        and(
          eq(emailImports.userId, ctx.user.id),
          eq(emailImports.status, "unmatched")
        )
      )
      .orderBy(desc(emailImports.receivedAt));
  }),

  /**
   * List draft itinerary items (isDraft=1, source=imap_poll) for a trip.
   */
  listDrafts: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the user owns or is a participant of the trip
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
      });
      if (!trip || trip.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db
        .select()
        .from(itineraryItems)
        .where(
          and(
            eq(itineraryItems.tripId, input.tripId),
            eq(itineraryItems.isDraft, 1)
          )
        )
        .orderBy(desc(itineraryItems.createdAt));
    }),

  /**
   * Approve a draft item — clears isDraft flag so it appears in the main timeline.
   */
  approveDraft: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, item.tripId),
      });
      if (!trip || trip.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [updated] = await ctx.db
        .update(itineraryItems)
        .set({ isDraft: 0, updatedAt: new Date() })
        .where(eq(itineraryItems.id, input.itemId))
        .returning();
      return updated!;
    }),

  /**
   * Reject a draft — deletes the item.
   */
  rejectDraft: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.itemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, item.tripId),
      });
      if (!trip || trip.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .delete(itineraryItems)
        .where(eq(itineraryItems.id, input.itemId));

      // Also mark the email import as rejected if linked
      await ctx.db
        .update(emailImports)
        .set({ status: "rejected" })
        .where(eq(emailImports.itemId, input.itemId));

      return { success: true };
    }),

  /**
   * Assign an unmatched email import to a trip and create a draft item.
   */
  assignUnmatched: protectedProcedure
    .input(z.object({ importId: z.string(), tripId: z.string(), dayIndex: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const emailImport = await ctx.db.query.emailImports.findFirst({
        where: and(
          eq(emailImports.id, input.importId),
          eq(emailImports.userId, ctx.user.id)
        ),
      });
      if (!emailImport) throw new TRPCError({ code: "NOT_FOUND" });

      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
      });
      if (!trip || trip.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const parsed = emailImport.parsedData as any;

      const { nanoid } = await import("../utils/id");
      const [item] = await ctx.db
        .insert(itineraryItems)
        .values({
          id: nanoid(),
          tripId: input.tripId,
          type: parsed?.type ?? "note",
          title: parsed?.title ?? emailImport.subject,
          notes: null,
          dayIndex: input.dayIndex,
          sortOrder: 0,
          source: "imap_poll",
          confidenceScore: emailImport.confidenceScore,
          startTime: parsed?.startTime ?? null,
          endTime: parsed?.endTime ?? null,
          details: parsed?.details ?? {},
          isDraft: 1,
          version: 1,
        })
        .returning();

      await ctx.db
        .update(emailImports)
        .set({ status: "matched", tripId: input.tripId, itemId: item!.id })
        .where(eq(emailImports.id, input.importId));

      return item!;
    }),
});

