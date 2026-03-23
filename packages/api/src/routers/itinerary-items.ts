import { z } from "zod";
import { eq, and, asc, inArray, sql, getTableColumns } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { itineraryItems, tags, itemTags } from "@trip/db";
import {
  createItineraryItemSchema,
  updateItineraryItemSchema,
  reorderItemsSchema,
} from "@trip/shared";
import { TRPCError } from "@trpc/server";
import { nanoid } from "../utils/id";
import { assertAccess } from "../lib/access";

// ── Router ─────────────────────────────────────────────────────────────────────
export const itineraryItemsRouter = router({
  /** Get all items for a trip, sorted by dayIndex then sortOrder. */
  list: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertAccess(ctx.db, input.tripId, ctx.user.id, ctx.user.email);
      const rows = await ctx.db
        .select({
          ...getTableColumns(itineraryItems),
          tags: sql<{ id: string; name: string }[]>`
            COALESCE(
              (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
               FROM item_tags it2
               JOIN tags t ON t.id = it2.tag_id
               WHERE it2.item_id = ${itineraryItems.id}),
              '[]'::json
            )
          `.as("tags"),
        })
        .from(itineraryItems)
        .where(eq(itineraryItems.tripId, input.tripId))
        .orderBy(
          asc(itineraryItems.dayIndex),
          asc(itineraryItems.sortOrder),
          asc(itineraryItems.createdAt)
        );
      return rows;
    }),

  /** Create a new itinerary item. */
  create: protectedProcedure
    .input(createItineraryItemSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAccess(ctx.db, input.tripId, ctx.user.id, ctx.user.email, true);

      // Auto sort order: append after existing items on the same day
      const dayItems = await ctx.db
        .select({ sortOrder: itineraryItems.sortOrder })
        .from(itineraryItems)
        .where(
          and(
            eq(itineraryItems.tripId, input.tripId),
            eq(itineraryItems.dayIndex, input.dayIndex)
          )
        )
        .orderBy(asc(itineraryItems.sortOrder));

      const maxSort = dayItems.length > 0
        ? Math.max(...dayItems.map((i: { sortOrder: number }) => i.sortOrder))
        : -1;

      const [item] = await ctx.db
        .insert(itineraryItems)
        .values({
          id: nanoid(),
          tripId: input.tripId,
          type: input.type,
          title: input.title,
          notes: input.notes ?? null,
          dayIndex: input.dayIndex,
          sortOrder: input.sortOrder ?? maxSort + 1,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          details: input.details ?? {},
          source: "manual",
          isDraft: 0,
          version: 1,
        })
        .returning();
      return item!;
    }),

  /** Update an item — uses version for optimistic locking. */
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateItineraryItemSchema }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.id),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAccess(ctx.db, item.tripId, ctx.user.id, ctx.user.email, true);

      if (item.version !== input.data.version) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Item was modified by another request — please refresh.",
        });
      }

      const { version: _v, ...rest } = input.data;
      const [updated] = await ctx.db
        .update(itineraryItems)
        .set({
          ...rest,
          version: item.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(itineraryItems.id, input.id))
        .returning();
      return updated!;
    }),

  /** Delete an item. */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.itineraryItems.findFirst({
        where: eq(itineraryItems.id, input.id),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAccess(ctx.db, item.tripId, ctx.user.id, ctx.user.email, true);

      await ctx.db
        .delete(itineraryItems)
        .where(eq(itineraryItems.id, input.id));
      return { success: true };
    }),

  /** Bulk-update dayIndex + sortOrder for drag-and-drop reordering. */
  reorder: protectedProcedure
    .input(reorderItemsSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAccess(ctx.db, input.tripId, ctx.user.id, ctx.user.email, true);

      // Verify all items belong to this trip
      const ids = input.items.map((i) => i.id);
      const existing = await ctx.db
        .select({ id: itineraryItems.id, tripId: itineraryItems.tripId })
        .from(itineraryItems)
        .where(inArray(itineraryItems.id, ids));

      const allBelong = existing.every(
        (e: { id: string; tripId: string }) => e.tripId === input.tripId
      );
      if (!allBelong) throw new TRPCError({ code: "FORBIDDEN" });

      // Update each item's position
      await Promise.all(
        input.items.map((item) =>
          ctx.db
            .update(itineraryItems)
            .set({
              dayIndex: item.dayIndex,
              sortOrder: item.sortOrder,
              updatedAt: new Date(),
            })
            .where(eq(itineraryItems.id, item.id))
        )
      );

      return { success: true };
    }),
});
