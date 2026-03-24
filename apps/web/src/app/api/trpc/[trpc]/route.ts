import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@trip/api";
import { auth } from "@/lib/auth";
import { db, users } from "@trip/db";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await auth.api.getSession({ headers: req.headers });

      // Better Auth returns a slim user type; fetch full user record from DB
      const fullUser = session?.user?.id
        ? await db.query.users.findFirst({ where: eq(users.id, session.user.id) }) ?? null
        : null;

      return {
        db,
        session: session?.session ?? null,
        user: fullUser,
      };
    },
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`tRPC error on ${path ?? "<unknown>"}:`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };

