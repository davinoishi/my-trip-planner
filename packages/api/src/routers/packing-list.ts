import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { trips, itineraryItems, packingItems } from "@trip/db";
import { TRPCError } from "@trpc/server";
import { nanoid } from "../utils/id";

// ── Climate inference ──────────────────────────────────────────────────────────

interface Climate {
  isTropical: boolean;
  isHot: boolean;
  isCool: boolean;
  isCold: boolean;
  isRainy: boolean;
}

function estimateClimate(lat: number | undefined, month: number): Climate {
  if (lat === undefined) {
    return { isTropical: false, isHot: false, isCool: true, isCold: false, isRainy: false };
  }
  const absLat = Math.abs(lat);
  const isNorth = lat >= 0;
  const isSummer = isNorth ? month >= 6 && month <= 8 : month === 12 || month <= 2;
  const isWinter = isNorth ? month === 12 || month <= 2 : month >= 6 && month <= 8;

  if (absLat < 25) {
    // Tropical — hot year-round, rainy season varies
    const isRainySeason = isNorth ? month >= 5 && month <= 10 : month >= 11 || month <= 4;
    return { isTropical: true, isHot: true, isCool: false, isCold: false, isRainy: isRainySeason };
  }
  if (absLat < 40) {
    // Subtropical
    return { isTropical: false, isHot: isSummer, isCool: isWinter, isCold: false, isRainy: false };
  }
  if (absLat < 58) {
    // Temperate
    return { isTropical: false, isHot: isSummer, isCool: !isSummer && !isWinter, isCold: isWinter, isRainy: !isWinter };
  }
  // High latitude
  return { isTropical: false, isHot: false, isCool: isSummer, isCold: !isSummer, isRainy: false };
}

// ── Packing list generation ────────────────────────────────────────────────────

interface GenContext {
  tripDays: number;
  tripMonth: number;
  hasFlights: boolean;
  hasHotel: boolean;
  hasCarRental: boolean;
  activityTitles: string[];
  isInternational: boolean;
  destinationLat?: number;
}

function buildList(ctx: GenContext): { category: string; name: string }[] {
  const items: { category: string; name: string }[] = [];
  const add = (cat: string, name: string) => items.push({ category: cat, name });

  const climate = estimateClimate(ctx.destinationLat, ctx.tripMonth);
  const text = ctx.activityTitles.join(" ").toLowerCase();
  const hasBeach =
    climate.isHot ||
    climate.isTropical ||
    /beach|swim|snorkel|dive|pool|waterpark/.test(text);
  const hasFormal = /dinner|gala|formal|wedding|theatre|opera/.test(text);
  const hasHiking = /hik|trek|trail|mountain|climb/.test(text);
  const hasSki = /ski|snowboard/.test(text);
  const longFlight = ctx.hasFlights && ctx.tripDays >= 3;
  const days = Math.min(ctx.tripDays, 7); // cap clothing multiples at 7

  // ── Documents & IDs ─────────────────────────────────────────────────────────
  const D = "Documents & IDs";
  if (ctx.isInternational) add(D, "Passport");
  add(D, "Driver's license / ID");
  if (ctx.hasHotel) add(D, "Hotel confirmations");
  if (ctx.hasCarRental) {
    add(D, "Car rental confirmation");
    if (ctx.isInternational) add(D, "International driving permit");
  }

  // ── Money & Banking ──────────────────────────────────────────────────────────
  const M = "Money & Banking";
  add(M, "Credit / debit cards");
  add(M, "Local currency / cash");
  if (ctx.isInternational) add(M, "Travel wallet / money belt");

  // ── Clothing ─────────────────────────────────────────────────────────────────
  const C = "Clothing";
  add(C, `T-shirts / tops (×${days})`);
  add(C, `Underwear (×${days + 1})`);
  add(C, `Socks (×${days + 1})`);
  add(C, "Pajamas / sleepwear");

  if (climate.isCold) {
    add(C, "Heavy winter coat");
    add(C, "Warm sweaters / fleece (×2)");
    add(C, "Thermal base layers");
    add(C, "Winter hat");
    add(C, "Gloves");
    add(C, "Scarf");
    add(C, `Jeans / warm pants (×${Math.min(3, Math.ceil(days / 2))})`);
    if (hasSki) {
      add(C, "Ski jacket + ski pants");
      add(C, "Ski base layers");
      add(C, "Ski socks (×3)");
    }
  } else if (climate.isCool) {
    add(C, "Light jacket / sweater");
    add(C, `Jeans / pants (×${Math.min(3, Math.ceil(days / 2))})`);
  } else {
    add(C, `Shorts / light pants (×${Math.min(3, days)})`);
    if (climate.isCold || climate.isCool) {
      add(C, `Jeans / pants (×${Math.min(2, Math.ceil(days / 2))})`);
    }
  }

  if (hasBeach) {
    add(C, "Swimsuit (×2)");
    add(C, "Beach cover-up / sarong");
    add(C, "Sun hat / cap");
  }
  if (climate.isRainy || climate.isTropical) add(C, "Rain jacket / poncho");
  if (hasFormal) {
    add(C, "Formal outfit / dress clothes");
    add(C, "Belt");
  }
  if (hasHiking) {
    add(C, "Moisture-wicking shirts (×2)");
    add(C, "Hiking pants / shorts");
    add(C, "Hiking socks (×3)");
  }
  if (hasSki) {
    add(C, "Ski helmet");
    add(C, "Goggles");
  }

  // ── Footwear ─────────────────────────────────────────────────────────────────
  const F = "Footwear";
  add(F, "Comfortable walking shoes");
  if (climate.isHot || climate.isTropical || hasBeach) add(F, "Sandals / flip-flops");
  if (climate.isCold) add(F, "Waterproof winter boots");
  if (hasHiking) add(F, "Hiking boots");
  if (hasSki) add(F, "Ski boots");
  if (hasFormal) add(F, "Dress shoes");

  // ── Toiletries ───────────────────────────────────────────────────────────────
  const T = "Toiletries";
  add(T, "Toothbrush + toothpaste");
  add(T, "Shampoo + conditioner");
  add(T, "Body wash / soap");
  add(T, "Deodorant");
  add(T, "Razor / shaving kit");
  add(T, "Moisturizer");
  if (climate.isHot || climate.isTropical || hasBeach) add(T, "Sunscreen SPF 50+");
  if (climate.isTropical) add(T, "Insect repellent");
  add(T, "Lip balm");

  // ── Health & Medication ──────────────────────────────────────────────────────
  const H = "Health & Medication";
  add(H, "Prescription medications");
  add(H, "Non-prescription medications");
  add(H, "Hand sanitizer");
  if (climate.isTropical) add(H, "Stomach medication / probiotics");

  // ── Electronics ──────────────────────────────────────────────────────────────
  const E = "Electronics";
  add(E, "Phone + charging cable");
  add(E, "Portable power bank");
  add(E, "Earphones / earbuds");
  if (ctx.isInternational) add(E, "Universal power adapter");
  if (ctx.tripDays >= 5) add(E, "Laptop / tablet + charger");
  add(E, "Camera (optional)");

  // ── Travel Accessories ────────────────────────────────────────────────────────
  const A = "Travel Accessories";
  if (ctx.hasFlights) {
    add(A, "Luggage lock(s)");
    if (longFlight) {
      add(A, "Travel pillow");
      add(A, "Eye mask + earplugs");
      add(A, "Compression socks");
    }
  }
  add(A, "Reusable water bottle");
  add(A, "Day backpack / tote bag");
  if (climate.isRainy || climate.isTropical) add(A, "Compact umbrella");
  if (climate.isHot || climate.isTropical || hasBeach) add(A, "Sunglasses");
  if (hasBeach) add(A, "Beach bag");
  if (hasHiking) add(A, "Hiking day pack");
  add(A, "Snacks for the journey");
  if (ctx.tripDays >= 3) add(A, "Reusable shopping bag");

  return items;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function assertTripAccess(
  db: any,
  tripId: string,
  userId: string
): Promise<typeof trips.$inferSelect> {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
  if (trip.ownerId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return trip;
}

async function doGenerate(
  db: any,
  trip: typeof trips.$inferSelect,
  userId: string,
  destinationLat?: number
) {
  const items = await db
    .select()
    .from(itineraryItems)
    .where(and(eq(itineraryItems.tripId, trip.id), eq(itineraryItems.isDraft, 0)));

  const tripDays = Math.max(
    1,
    Math.round(
      (new Date(trip.endDate + "T00:00:00Z").getTime() -
        new Date(trip.startDate + "T00:00:00Z").getTime()) /
        86400000
    )
  );
  const tripMonth = new Date(trip.startDate + "T00:00:00Z").getUTCMonth() + 1;

  const ctx: GenContext = {
    tripDays,
    tripMonth,
    hasFlights: items.some((i: any) => i.type === "flight"),
    hasHotel: items.some((i: any) => i.type === "hotel"),
    hasCarRental: items.some((i: any) => i.type === "car_rental"),
    activityTitles: items.map((i: any) => i.title as string),
    isInternational: items.some((i: any) => i.type === "flight"), // treat any flight as potentially international
    destinationLat,
  };

  const generated = buildList(ctx);

  const rows = generated.map((g, i) => ({
    id: nanoid(),
    tripId: trip.id,
    userId,
    category: g.category,
    name: g.name,
    isChecked: 0,
    isCustom: 0,
    sortOrder: i,
  }));

  if (rows.length > 0) {
    await db.insert(packingItems).values(rows);
  }

  return db
    .select()
    .from(packingItems)
    .where(and(eq(packingItems.tripId, trip.id), eq(packingItems.userId, userId)));
}

// ── Router ─────────────────────────────────────────────────────────────────────

const generateInput = z.object({
  tripId: z.string(),
  destinationLat: z.number().optional(),
});

export const packingListRouter = router({
  /** Get this user's packing list for a trip. */
  list: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertTripAccess(ctx.db, input.tripId, ctx.user.id);
      return ctx.db
        .select()
        .from(packingItems)
        .where(
          and(
            eq(packingItems.tripId, input.tripId),
            eq(packingItems.userId, ctx.user.id)
          )
        );
    }),

  /** Generate the list if empty; otherwise return existing items. */
  generate: protectedProcedure
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      const trip = await assertTripAccess(ctx.db, input.tripId, ctx.user.id);
      const existing = await ctx.db
        .select()
        .from(packingItems)
        .where(
          and(
            eq(packingItems.tripId, input.tripId),
            eq(packingItems.userId, ctx.user.id)
          )
        );
      if (existing.length > 0) return existing;
      return doGenerate(ctx.db, trip, ctx.user.id, input.destinationLat);
    }),

  /** Clear auto-generated items and regenerate fresh; keeps custom items. */
  regenerate: protectedProcedure
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      const trip = await assertTripAccess(ctx.db, input.tripId, ctx.user.id);
      // Delete only non-custom items
      await ctx.db
        .delete(packingItems)
        .where(
          and(
            eq(packingItems.tripId, input.tripId),
            eq(packingItems.userId, ctx.user.id),
            eq(packingItems.isCustom, 0)
          )
        );
      return doGenerate(ctx.db, trip, ctx.user.id, input.destinationLat);
    }),

  /** Add a custom item. */
  addItem: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        category: z.string().min(1),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTripAccess(ctx.db, input.tripId, ctx.user.id);
      const [item] = await ctx.db
        .insert(packingItems)
        .values({
          id: nanoid(),
          tripId: input.tripId,
          userId: ctx.user.id,
          category: input.category,
          name: input.name,
          isChecked: 0,
          isCustom: 1,
          sortOrder: 999,
        })
        .returning();
      return item!;
    }),

  /** Toggle the checked state of an item. */
  toggleItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.packingItems.findFirst({
        where: and(
          eq(packingItems.id, input.id),
          eq(packingItems.userId, ctx.user.id)
        ),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const [updated] = await ctx.db
        .update(packingItems)
        .set({ isChecked: item.isChecked ? 0 : 1, updatedAt: new Date() })
        .where(eq(packingItems.id, input.id))
        .returning();
      return updated!;
    }),

  /** Delete an item. */
  deleteItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.packingItems.findFirst({
        where: and(
          eq(packingItems.id, input.id),
          eq(packingItems.userId, ctx.user.id)
        ),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.delete(packingItems).where(eq(packingItems.id, input.id));
    }),

  /** Uncheck all items (useful for re-packing). */
  clearChecked: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTripAccess(ctx.db, input.tripId, ctx.user.id);
      await ctx.db
        .update(packingItems)
        .set({ isChecked: 0, updatedAt: new Date() })
        .where(
          and(
            eq(packingItems.tripId, input.tripId),
            eq(packingItems.userId, ctx.user.id)
          )
        );
    }),
});

