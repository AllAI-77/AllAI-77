/**
 * POST /api/import/users
 * Accepts an Excel (.xlsx) or CSV file and bulk-creates employee accounts.
 * Required columns: name, email, (optional) department, branch, role
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { sendWelcomeEmail } from "@/lib/email";
import type { Role } from "@prisma/client";

const ALLOWED_ROLES: Set<string> = new Set([
  "SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER", "CONTENT_CREATOR", "EMPLOYEE",
]);

function randomPassword(length = 10): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const sendEmails = formData.get("sendEmails") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Only .xlsx, .xls, or .csv files are accepted" },
        { status: 400 }
      );
    }

    const buffer    = Buffer.from(await file.arrayBuffer());
    const workbook  = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found" }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Maximum 500 rows per import" }, { status: 400 });
    }

    const results = {
      created:  0,
      skipped:  0,
      errors:   [] as Array<{ row: number; email: string; reason: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      const email = String(row["email"] ?? row["Email"] ?? "").trim().toLowerCase();
      const name  = String(row["name"]  ?? row["Name"]  ?? "").trim();

      if (!email) {
        results.errors.push({ row: rowNum, email: "-", reason: "Missing email" });
        continue;
      }
      if (!email.endsWith("@universalbank.uz")) {
        results.errors.push({ row: rowNum, email, reason: "Email must end with @universalbank.uz" });
        continue;
      }
      if (!name) {
        results.errors.push({ row: rowNum, email, reason: "Missing name" });
        continue;
      }

      const rawRole  = String(row["role"] ?? row["Role"] ?? "EMPLOYEE").trim().toUpperCase();
      const role: Role = ALLOWED_ROLES.has(rawRole) ? rawRole as Role : "EMPLOYEE";

      // Check duplicate
      const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        results.skipped++;
        continue;
      }

      const tempPassword = randomPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      await db.user.create({
        data: { email, name, role, passwordHash, isActive: true },
      });

      if (sendEmails) {
        try {
          await sendWelcomeEmail({ to: email, name, temporaryPassword: tempPassword });
        } catch {
          // Non-fatal — account still created
        }
      }

      results.created++;
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: rows.length,
    });
  } catch (err) {
    console.error("[import-users]", err);
    return NextResponse.json(
      { error: "Failed to process import" },
      { status: 500 }
    );
  }
}
