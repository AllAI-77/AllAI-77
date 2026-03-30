/**
 * GET /api/export/attempts?examId=...&from=...&to=...
 * Exports exam attempt results as an Excel (.xlsx) file.
 * Requires SUPER_ADMIN, HR_MANAGER, or BRANCH_MANAGER role.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const examId = searchParams.get("examId") ?? undefined;
    const from   = searchParams.get("from")   ?? undefined;
    const to     = searchParams.get("to")     ?? undefined;

    const attempts = await db.examAttempt.findMany({
      where: {
        ...(examId && { examId }),
        status: "COMPLETED",
        ...(from && { startedAt: { gte: new Date(from) } }),
        ...(to   && { completedAt: { lte: new Date(to) } }),
      },
      include: {
        user: { select: { name: true, email: true } },
        exam: { select: { title: true, passingScore: true } },
        certificate: { select: { verificationCode: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 5000,
    });

    const rows = attempts.map((a) => ({
      "Employee Name":     a.user.name ?? "",
      "Employee Email":    a.user.email,
      "Exam":              a.exam.title,
      "Score (%)":         a.score ?? "",
      "Passing Score (%)": a.exam.passingScore,
      "Result":            a.passed ? "PASS" : "FAIL",
      "Started At":        format(a.startedAt, "yyyy-MM-dd HH:mm"),
      "Completed At":      a.completedAt ? format(a.completedAt, "yyyy-MM-dd HH:mm") : "",
      "Tab Switches":      a.tabSwitchCount,
      "Certificate Code":  a.certificate?.verificationCode ?? "",
    }));

    const workbook  = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Column widths
    worksheet["!cols"] = [
      { wch: 22 }, { wch: 32 }, { wch: 36 }, { wch: 12 },
      { wch: 14 }, { wch: 8 },  { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Attempts");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `exam-results-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[export-attempts]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
