/**
 * GET /api/health
 * Public health check endpoint for load balancers / monitoring.
 * Returns 200 when the database is reachable, 503 otherwise.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  // Check DB
  let dbOk = false;
  let dbMs = 0;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
    dbMs = Date.now() - start;
  } catch {
    dbMs = Date.now() - start;
  }

  // Check Redis (optional)
  let redisOk: boolean | null = null;
  let redisMs = 0;
  if (redis) {
    const t = Date.now();
    try {
      await redis.ping();
      redisOk = true;
    } catch {
      redisOk = false;
    }
    redisMs = Date.now() - t;
  }

  const status = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status:    dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: { ok: dbOk, ms: dbMs },
        redis:    redis ? { ok: redisOk, ms: redisMs } : { ok: null, ms: 0, note: "not configured" },
      },
      version: process.env.npm_package_version ?? "1.0.0",
    },
    { status }
  );
}
