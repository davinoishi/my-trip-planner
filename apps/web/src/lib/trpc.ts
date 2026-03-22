"use client";

import { createTRPCReact } from "@trpc/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  loggerLink,
} from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@trip/api";

export const trpc = createTRPCReact<AppRouter>();

// Inferred output types (dates serialized to strings by tRPC)
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function makeTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/trpc`,
      }),
    ],
  });
}
