import { z } from "zod";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { users } from "@trip/db";

function generateCalendarToken(): string {
  return randomBytes(32).toString("base64url");
}

export const usersRouter = router({
  /**
   * Returns the current authenticated user's profile.
   * Used to verify the full auth → API → DB stack is working.
   */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  updateMe: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        preferredTimezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id))
        .returning();
      return updated;
    }),

  /** Returns the user's calendar feed token, generating one lazily if needed. */
  getCalendarToken: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.calendarToken) {
      return { token: ctx.user.calendarToken };
    }
    const token = generateCalendarToken();
    const [updated] = await ctx.db
      .update(users)
      .set({ calendarToken: token, updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .returning();
    return { token: updated!.calendarToken! };
  }),

  /** Generates a new calendar token, invalidating the previous feed URL. */
  resetCalendarToken: protectedProcedure.mutation(async ({ ctx }) => {
    const token = generateCalendarToken();
    const [updated] = await ctx.db
      .update(users)
      .set({ calendarToken: token, updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .returning();
    return { token: updated!.calendarToken! };
  }),
});

