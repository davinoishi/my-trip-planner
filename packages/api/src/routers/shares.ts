import { z } from "zod";
import { eq, and, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { participants, accountShares, trips, users } from "@trip/db";
import { TRPCError } from "@trpc/server";
import { nanoid } from "../utils/id";
import { resolveTripAccess } from "../lib/access";

const roleSchema = z.enum(["viewer", "editor"]);

// ── Helpers ────────────────────────────────────────────────────────────────────

async function assertTripOwner(db: any, tripId: string, userId: string) {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
  if (trip.ownerId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return trip;
}

/** Look up a user by email (for resolving pending → active). */
async function findUserByEmail(db: any, email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

// ── Router ─────────────────────────────────────────────────────────────────────

export const sharesRouter = router({

  // ── Account-level sharing ────────────────────────────────────────────────────

  /** List everyone the current user has shared their account with. */
  accountList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.accountShares.findMany({
      where: eq(accountShares.ownerId, ctx.user.id),
      orderBy: (t: any, { asc }: any) => [asc(t.createdAt)],
    });
  }),

  /** Share your entire account (all trips) with someone by email. */
  accountAdd: protectedProcedure
    .input(z.object({ email: z.string().email(), role: roleSchema.default("viewer") }))
    .mutation(async ({ ctx, input }) => {
      // Prevent sharing with yourself
      if (input.email.toLowerCase() === ctx.user.email.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot share with yourself." });
      }

      // Resolve userId if the person already has an account
      const existingUser = await findUserByEmail(ctx.db, input.email);

      const existing = await ctx.db.query.accountShares.findFirst({
        where: and(
          eq(accountShares.ownerId, ctx.user.id),
          eq(accountShares.sharedWithEmail, input.email)
        ),
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Already sharing with this email." });
      }

      const [share] = await ctx.db
        .insert(accountShares)
        .values({
          id: nanoid(),
          ownerId: ctx.user.id,
          sharedWithEmail: input.email,
          sharedWithUserId: existingUser?.id ?? null,
          role: input.role,
        })
        .returning();
      return share!;
    }),

  /** Update permission for an account-level share. */
  accountUpdate: protectedProcedure
    .input(z.object({ shareId: z.string(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(accountShares)
        .set({ role: input.role, updatedAt: new Date() })
        .where(
          and(eq(accountShares.id, input.shareId), eq(accountShares.ownerId, ctx.user.id))
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Revoke an account-level share. */
  accountRemove: protectedProcedure
    .input(z.object({ shareId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(accountShares)
        .where(
          and(eq(accountShares.id, input.shareId), eq(accountShares.ownerId, ctx.user.id))
        )
        .returning();
      if (!result.length) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  // ── Trip-level sharing (People tab) ─────────────────────────────────────────

  /**
   * List everyone with access to a trip.
   * Returns direct participants + account-share holders (deduplicated).
   * Also indicates whether their access comes from an account share or a direct invite.
   */
  tripList: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      // Only the owner can see the full People list
      if (trip.ownerId !== ctx.user.id) {
        const access = await resolveTripAccess(ctx.db, input.tripId, ctx.user.id, ctx.user.email);
        if (!access.canRead) throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Direct trip participants (excludes owner row if it exists)
      const directParticipants = await ctx.db.query.participants.findMany({
        where: eq(participants.tripId, input.tripId),
        orderBy: (t: any, { asc }: any) => [asc(t.invitedAt)],
      });

      // Account-level shares for this trip's owner
      const acctShares = await ctx.db.query.accountShares.findMany({
        where: eq(accountShares.ownerId, trip.ownerId),
      });

      // Merge: direct participants take precedence
      const directEmails = new Set(directParticipants.map((p: any) => p.email.toLowerCase()));

      const acctOnlyShares = acctShares
        .filter((s: any) => !directEmails.has(s.sharedWithEmail.toLowerCase()))
        .map((s: any) => ({
          id: s.id,
          email: s.sharedWithEmail,
          userId: s.sharedWithUserId,
          role: s.role,
          isGoingOnTrip: 0,
          isPending: !s.sharedWithUserId,
          source: "account" as const,
          invitedAt: s.createdAt,
        }));

      const directMapped = directParticipants.map((p: any) => ({
        id: p.id,
        email: p.email,
        userId: p.userId,
        role: p.role,
        isGoingOnTrip: p.isGoingOnTrip,
        isPending: !p.userId,
        source: "trip" as const,
        invitedAt: p.invitedAt,
      }));

      return [...directMapped, ...acctOnlyShares];
    }),

  /** Add a person directly to a specific trip (or override an account-level share). */
  tripAdd: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        email: z.string().email(),
        role: roleSchema.default("viewer"),
        isGoingOnTrip: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTripOwner(ctx.db, input.tripId, ctx.user.id);

      if (input.email.toLowerCase() === ctx.user.email.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot add yourself as a participant." });
      }

      const existing = await ctx.db.query.participants.findFirst({
        where: and(
          eq(participants.tripId, input.tripId),
          eq(participants.email, input.email)
        ),
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "This person already has access to this trip." });
      }

      const existingUser = await findUserByEmail(ctx.db, input.email);

      const [participant] = await ctx.db
        .insert(participants)
        .values({
          id: nanoid(),
          tripId: input.tripId,
          email: input.email,
          userId: existingUser?.id ?? null,
          role: input.role,
          isGoingOnTrip: input.isGoingOnTrip ? 1 : 0,
          acceptedAt: existingUser ? new Date() : null,
        })
        .returning();
      return participant!;
    }),

  /** Update role or isGoingOnTrip for a trip participant. */
  tripUpdate: protectedProcedure
    .input(
      z.object({
        participantId: z.string(),
        tripId: z.string(),
        role: roleSchema.optional(),
        isGoingOnTrip: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertTripOwner(ctx.db, input.tripId, ctx.user.id);

      const updates: Record<string, unknown> = {};
      if (input.role !== undefined) updates.role = input.role;
      if (input.isGoingOnTrip !== undefined) updates.isGoingOnTrip = input.isGoingOnTrip ? 1 : 0;

      const [updated] = await ctx.db
        .update(participants)
        .set(updates)
        .where(
          and(eq(participants.id, input.participantId), eq(participants.tripId, input.tripId))
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /** Remove a person from a trip. */
  tripRemove: protectedProcedure
    .input(z.object({ participantId: z.string(), tripId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTripOwner(ctx.db, input.tripId, ctx.user.id);
      const result = await ctx.db
        .delete(participants)
        .where(
          and(eq(participants.id, input.participantId), eq(participants.tripId, input.tripId))
        )
        .returning();
      if (!result.length) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  /** What access does the current user have on a trip? Used by the UI to gate edit controls. */
  myAccess: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      return resolveTripAccess(ctx.db, input.tripId, ctx.user.id, ctx.user.email);
    }),
});
