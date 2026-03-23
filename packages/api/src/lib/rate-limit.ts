/**
 * Sliding-window rate limiter backed by Redis.
 *
 * Uses a sorted set per key. Each request adds the current timestamp as a
 * member. Old entries (outside the window) are pruned on every check.
 * Falls back to allowing the request if Redis is unavailable — we prefer
 * a brief outage window over blocking legitimate users.
 */
import Redis from "ioredis";

let _client: Redis | null = null;

function getClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    _client.on("error", () => {
      // Swallow — we fall back gracefully
    });
  }
  return _client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check and record a request for `key`.
 *
 * @param key      Unique identifier (e.g. "upload:user_abc123")
 * @param limit    Max requests allowed in the window
 * @param windowSec Window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const client = getClient();
  if (!client) {
    // Redis not configured — allow everything (local dev without Redis)
    return { allowed: true, remaining: limit, resetInSeconds: windowSec };
  }

  try {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const redisKey = `rl:${key}`;

    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs);   // prune old
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);   // record this request
    pipeline.zcard(redisKey);                                   // count in window
    pipeline.expire(redisKey, windowSec + 1);                  // TTL cleanup

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining, resetInSeconds: windowSec };
  } catch {
    // Redis error — fail open
    return { allowed: true, remaining: limit, resetInSeconds: windowSec };
  }
}
