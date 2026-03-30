import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ─── Helper: Exam resume state ───────────────────────────────────────────────

export async function saveResumeState(
  attemptId: string,
  state: {
    currentQuestionIndex: number;
    timeRemaining: number;
    questionOrder: string[];
    responses: Record<string, string | null>;
    flagged: string[];
  }
): Promise<void> {
  await redis.setex(
    `resume:${attemptId}`,
    60 * 60 * 4, // 4 hours TTL
    JSON.stringify(state)
  );
}

export async function getResumeState(attemptId: string) {
  const data = await redis.get(`resume:${attemptId}`);
  if (!data) return null;
  return JSON.parse(data) as {
    currentQuestionIndex: number;
    timeRemaining: number;
    questionOrder: string[];
    responses: Record<string, string | null>;
    flagged: string[];
  };
}

export async function clearResumeState(attemptId: string): Promise<void> {
  await redis.del(`resume:${attemptId}`);
}

// ─── Helper: Rate limiting ────────────────────────────────────────────────────

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `ratelimit:${key}`;
  const current = await redis.incr(redisKey);
  if (current === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  const remaining = Math.max(0, maxAttempts - current);
  return { allowed: current <= maxAttempts, remaining };
}
