import { z } from "zod";
import { eq, and, inArray, sql, ilike, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { tags, itemTags, itineraryItems, trips } from "@trip/db";
import { TRPCError } from "@trpc/server";
import { nanoid } from "../utils/id";
import { assertAccess } from "../lib/access";

/** Verify the item belongs to a trip the user can write to. */
async function assertItemAccess(
  db: any,
  itemId: string,
  userId: string,
  userEmail: string
) {
  const row = await db
    .select({ tripId: itineraryItems.tripId })
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);
  if (!row.length) throw new TRPCError({ code: "NOT_FOUND" });
  await assertAccess(db, row[0].tripId, userId, userEmail, true);
}

const PRESET_TAGS = [
  "Business Class",
  "Premium Economy",
  "Economy",
  "Mileage/Points Ticket",
  "Beach",
  "Snorkel",
  "Ski",
  "Art",
  "Recommend",
  "History",
  "Nature",
  "Shopping",
  "City",
  "Sporting Event",
];

async function ensurePresets(db: any) {
  for (const name of PRESET_TAGS) {
    await db
      .insert(tags)
      .values({ id: nanoid(), name, isPreset: 1 })
      .onConflictDoNothing();
  }
}

export const tagsRouter = router({
  /** Return all tags (ensuring presets exist), sorted by isPreset desc, name asc. */
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensurePresets(ctx.db);
    return ctx.db
      .select()
      .from(tags)
      .orderBy(sql`${tags.isPreset} desc, ${tags.name} asc`);
  }),

  /** Create a new custom tag (or return existing if name already taken). */
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.tags.findFirst({
        where: eq(tags.name, input.name),
      });
      if (existing) return existing;

      const [created] = await ctx.db
        .insert(tags)
        .values({ id: nanoid(), name: input.name, isPreset: 0 })
        .returning();
      return created!;
    }),

  /** Replace all tags for an item. */
  setItemTags: protectedProcedure
    .input(z.object({ itemId: z.string(), tagIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await assertItemAccess(ctx.db, input.itemId, ctx.user.id, ctx.user.email);
      await ctx.db.delete(itemTags).where(eq(itemTags.itemId, input.itemId));
      if (input.tagIds.length > 0) {
        await ctx.db.insert(itemTags).values(
          input.tagIds.map((tagId) => ({ itemId: input.itemId, tagId }))
        );
      }
      return { success: true };
    }),

  /** Get tags for a specific item. */
  getItemTags: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertItemAccess(ctx.db, input.itemId, ctx.user.id, ctx.user.email);
      const rows = await ctx.db
        .select({ id: tags.id, name: tags.name })
        .from(itemTags)
        .innerJoin(tags, eq(tags.id, itemTags.tagId))
        .where(eq(itemTags.itemId, input.itemId));
      return rows;
    }),

  /** Search itinerary items by text query and/or tag IDs. */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, tagIds } = input;
      const hasQuery = query && query.trim().length > 0;
      const hasTagIds = tagIds && tagIds.length > 0;

      if (!hasQuery && !hasTagIds) return [];

      // Build WHERE conditions
      const conditions: any[] = [
        // Must belong to a trip owned by the current user
        eq(trips.ownerId, ctx.user.id),
      ];

      if (hasQuery) {
        const term = `%${query.trim()}%`;
        conditions.push(
          or(
            ilike(itineraryItems.title, term),
            ilike(itineraryItems.notes, term),
            ilike(sql`cast(${itineraryItems.details} as text)`, term)
          )
        );
      }

      if (hasTagIds) {
        conditions.push(
          inArray(
            itineraryItems.id,
            ctx.db
              .select({ itemId: itemTags.itemId })
              .from(itemTags)
              .where(inArray(itemTags.tagId, tagIds))
          )
        );
      }

      const rows = await ctx.db
        .select({
          itemId: itineraryItems.id,
          itemTitle: itineraryItems.title,
          itemType: itineraryItems.type,
          tripId: trips.id,
          tripName: trips.name,
          tripStartDate: trips.startDate,
          dayIndex: itineraryItems.dayIndex,
        })
        .from(itineraryItems)
        .innerJoin(trips, eq(trips.id, itineraryItems.tripId))
        .where(and(...conditions))
        .limit(50);

      // Fetch tags for each item
      const itemIds = rows.map((r) => r.itemId);
      let tagsByItem = new Map<string, { id: string; name: string }[]>();

      if (itemIds.length > 0) {
        const tagRows = await ctx.db
          .select({
            itemId: itemTags.itemId,
            tagId: tags.id,
            tagName: tags.name,
          })
          .from(itemTags)
          .innerJoin(tags, eq(tags.id, itemTags.tagId))
          .where(inArray(itemTags.itemId, itemIds));

        for (const tr of tagRows) {
          if (!tagsByItem.has(tr.itemId)) tagsByItem.set(tr.itemId, []);
          tagsByItem.get(tr.itemId)!.push({ id: tr.tagId, name: tr.tagName });
        }
      }

      return rows.map((r) => ({
        itemId: r.itemId,
        itemTitle: r.itemTitle,
        itemType: r.itemType,
        tags: tagsByItem.get(r.itemId) ?? [],
        tripId: r.tripId,
        tripName: r.tripName,
        tripStartDate: r.tripStartDate,
        dayIndex: r.dayIndex,
      }));
    }),
});

