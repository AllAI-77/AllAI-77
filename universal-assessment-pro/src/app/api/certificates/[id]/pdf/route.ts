/**
 * GET /api/certificates/:attemptId/pdf
 * Streams a PDF certificate for a completed, passed exam attempt.
 * Accessible by the certificate owner or admins.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { CertificatePDF } from "@/components/pdf/CertificatePDF";
import { createElement } from "react";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: attemptId } = await params;

    const certificate = await db.certificate.findFirst({
      where: { attemptId },
      include: {
        attempt: {
          include: {
            exam: { select: { title: true, passingScore: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    const isAdmin = ["SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER"].includes(session.user.role);
    if (!isAdmin && certificate.attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const element = createElement(CertificatePDF, {
      recipientName:    certificate.attempt.user.name ?? certificate.attempt.user.email,
      examTitle:        certificate.attempt.exam.title,
      score:            certificate.attempt.score ?? 0,
      issuedAt:         certificate.issuedAt,
      verificationCode: certificate.verificationCode,
      qrData:           certificate.qrCodeData ?? "",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certificate.verificationCode}.pdf"`,
        "Cache-Control":       "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[pdf-certificate]", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
