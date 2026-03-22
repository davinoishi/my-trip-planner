"use client";

import { createTRPCReact } from "@trpc/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  loggerLink,
} from "@trpc/client";
import type { AppRouter } from "@trip/api";

export const trpc = createTRPCReact<AppRouter>();

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
