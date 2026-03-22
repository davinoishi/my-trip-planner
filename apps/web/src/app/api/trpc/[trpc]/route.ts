import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@trip/api";
import { auth } from "@/lib/auth";
import { db } from "@trip/db";
import type { NextRequest } from "next/server";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await auth.api.getSession({ headers: req.headers });
      return {
        db,
        session: session?.session ?? null,
        user: session?.user ?? null,
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
