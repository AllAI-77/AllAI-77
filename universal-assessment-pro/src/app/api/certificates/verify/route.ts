/**
 * GET /api/certificates/verify?code=XXXX
 * Public endpoint — no auth required.
 * Returns certificate metadata if the code is valid.
 */

import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ valid: false, error: "Missing code" }, { status: 400 });
    }

    const certificate = await db.certificate.findFirst({
      where: { verificationCode: code },
      include: {
        attempt: {
          include: {
            exam: { select: { title: true } },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json({ valid: false, error: "Certificate not found" }, { status: 404 });
    }

    return NextResponse.json({
      valid:         true,
      recipientName: certificate.attempt.user.name ?? certificate.attempt.user.email,
      examTitle:     certificate.attempt.exam.title,
      score:         certificate.attempt.score,
      issuedAt:      certificate.issuedAt,
      expiresAt:     certificate.expiresAt,
    });
  } catch (err) {
    console.error("[verify-certificate]", err);
    return NextResponse.json({ valid: false, error: "Verification failed" }, { status: 500 });
  }
}
