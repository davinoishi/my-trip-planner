import type { DB } from "@trip/db";
import type { User } from "@trip/db";

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface Context {
  db: DB;
  session: Session | null;
  user: User | null;
}

export type ProtectedContext = Context & {
  session: Session;
  user: User;
};

