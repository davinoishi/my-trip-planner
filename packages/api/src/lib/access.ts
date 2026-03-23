import { eq, and, or } from "drizzle-orm";
import { trips, participants, accountShares } from "@trip/db";
import { TRPCError } from "@trpc/server";

export interface AccessResult {
  canRead: boolean;
  canWrite: boolean;
  isOwner: boolean;
  /** True if the user is going on the trip (counts toward their stats) */
  isGoingOnTrip: boolean;
  /** The resolved role: "owner" | "editor" | "viewer" */
  role: "owner" | "editor" | "viewer" | null;
}

/**
 * Resolve what access the given user has to a trip.
 *
 * Priority:
 *   1. Trip owner → full access
 *   2. Direct participants entry (trip-level) → overrides account share
 *   3. Account-level share → all trips from that owner
 *   4. No match → no access
 */
export async function resolveTripAccess(
  db: any,
  tripId: string,
  userId: string,
  userEmail: string
): Promise<AccessResult> {
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });

  if (!trip) {
    return { canRead: false, canWrite: false, isOwner: false, isGoingOnTrip: false, role: null };
  }

  // 1. Owner
  if (trip.ownerId === userId) {
    return { canRead: true, canWrite: true, isOwner: true, isGoingOnTrip: true, role: "owner" };
  }

  // 2. Direct trip-level participant (takes precedence over account share)
  const participant = await db.query.participants.findFirst({
    where: and(
      eq(participants.tripId, tripId),
      or(
        eq(participants.userId, userId),
        eq(participants.email, userEmail)
      )
    ),
  });

  if (participant) {
    const canWrite = participant.role === "editor";
    return {
      canRead: true,
      canWrite,
      isOwner: false,
      isGoingOnTrip: participant.isGoingOnTrip === 1,
      role: participant.role as "editor" | "viewer",
    };
  }

  // 3. Account-level share from the trip's owner
  const accountShare = await db.query.accountShares.findFirst({
    where: and(
      eq(accountShares.ownerId, trip.ownerId),
      or(
        eq(accountShares.sharedWithUserId, userId),
        eq(accountShares.sharedWithEmail, userEmail)
      )
    ),
  });

  if (accountShare) {
    const canWrite = accountShare.role === "editor";
    return {
      canRead: true,
      canWrite,
      isOwner: false,
      isGoingOnTrip: false, // account shares don't auto-mark as going
      role: accountShare.role as "editor" | "viewer",
    };
  }

  return { canRead: false, canWrite: false, isOwner: false, isGoingOnTrip: false, role: null };
}

/** Throws FORBIDDEN/NOT_FOUND if access is denied. Returns the access result. */
export async function assertAccess(
  db: any,
  tripId: string,
  userId: string,
  userEmail: string,
  requireWrite = false
): Promise<AccessResult> {
  const access = await resolveTripAccess(db, tripId, userId, userEmail);
  if (!access.canRead) throw new TRPCError({ code: "FORBIDDEN" });
  if (requireWrite && !access.canWrite) throw new TRPCError({ code: "FORBIDDEN" });
  return access;
}

/**
 * Activate pending shares for a newly-signed-in user.
 * Finds any participants/accountShares with matching email but no userId, and links them.
 * Fire-and-forget safe — errors are swallowed.
 */
export async function activatePendingShares(
  db: any,
  userId: string,
  email: string
): Promise<void> {
  try {
    await Promise.all([
      db
        .update(participants)
        .set({ userId, acceptedAt: new Date() })
        .where(
          and(eq(participants.email, email), eq(participants.userId, null as any))
        ),
      db
        .update(accountShares)
        .set({ sharedWithUserId: userId })
        .where(
          and(
            eq(accountShares.sharedWithEmail, email),
            eq(accountShares.sharedWithUserId, null as any)
          )
        ),
    ]);
  } catch (err) {
    console.error("[access] activatePendingShares failed:", err);
  }
}
