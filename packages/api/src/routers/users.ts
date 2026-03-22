import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { users } from "@trip/db";

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
});
