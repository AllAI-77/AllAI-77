/**
 * Redis client — fault-tolerant.
 *
 * If Redis is unavailable (REDIS_URL not set, or connection refused), ALL
 * operations silently fall back to no-ops / null returns so the application
 * continues working. Resume state is always persisted in the DB as well
 * (attempt.resumeState JSON), so exams can still be resumed without Redis.
 */

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
};

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Redis] REDIS_URL not set — running without Redis (DB-only fallback)");
    }
    return null;
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout:       3_000,
    lazyConnect:          true,
    enableOfflineQueue:   false,
  });
  client.on("error", () => {
    // Suppress noisy per-call errors; failures are handled per-operation
  });
  return client;
}

const redisClient: Redis | null =
  process.env.NODE_ENV !== "production"
    ? (globalForRedis.redis !== undefined
        ? globalForRedis.redis
        : (globalForRedis.redis = createRedisClient()))
    : createRedisClient();

// ─── Safe wrappers ─────────────────────────────────────────────────────────────

async function safeGet(key: string): Promise<string | null> {
  if (!redisClient) return null;
  try { return await redisClient.get(key); } catch { return null; }
}

async function safeSetex(key: string, ttl: number, value: string): Promise<void> {
  if (!redisClient) return;
  try { await redisClient.setex(key, ttl, value); } catch { /* DB has it */ }
}

async function safeDel(key: string): Promise<void> {
  if (!redisClient) return;
  try { await redisClient.del(key); } catch { /* ignore */ }
}

async function safeIncr(key: string): Promise<number | null> {
  if (!redisClient) return null;
  try { return await redisClient.incr(key); } catch { return null; }
}

async function safeExpire(key: string, ttl: number): Promise<void> {
  if (!redisClient) return;
  try { await redisClient.expire(key, ttl); } catch { /* ignore */ }
}

// ─── Resume state ─────────────────────────────────────────────────────────────

export interface ResumeState {
  currentQuestionIndex: number;
  timeRemaining:        number;
  questionOrder:        string[];
  responses:            Record<string, string | null>;
  flagged:              string[];
}

export async function saveResumeState(
  attemptId: string,
  state: ResumeState
): Promise<void> {
  await safeSetex(`resume:${attemptId}`, 60 * 60 * 4, JSON.stringify(state));
}

export async function getResumeState(attemptId: string): Promise<ResumeState | null> {
  const data = await safeGet(`resume:${attemptId}`);
  if (!data) return null;
  try { return JSON.parse(data) as ResumeState; } catch { return null; }
}

export async function clearResumeState(attemptId: string): Promise<void> {
  await safeDel(`resume:${attemptId}`);
}

// ─── Rate limiting (allows request when Redis unavailable) ────────────────────

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await safeIncr(`ratelimit:${key}`);
  if (current === null) return { allowed: true, remaining: maxAttempts };
  if (current === 1) await safeExpire(`ratelimit:${key}`, windowSeconds);
  return {
    allowed:   current <= maxAttempts,
    remaining: Math.max(0, maxAttempts - current),
  };
}

// Raw client (may be null)
export const redis = redisClient;
