"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateNameSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword:     z.string().min(8, "Password must be at least 8 characters"),
});

// ─── Update display name ──────────────────────────────────────────────────────

export async function updateMyName(
  input: unknown
): Promise<ApiResponse<{ name: string }>> {
  try {
    const session = await requireAuth();
    const parsed  = updateNameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
    }

    const updated = await db.user.update({
      where:  { id: session.user.id },
      data:   { name: parsed.data.name },
      select: { name: true },
    });

    revalidatePath("/", "layout");
    return { success: true, data: { name: updated.name ?? "" } };
  } catch (err) {
    console.error("[updateMyName]", err);
    return { success: false, error: "Failed to update name" };
  }
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changeMyPassword(
  input: unknown
): Promise<ApiResponse<null>> {
  try {
    const session = await requireAuth();
    const parsed  = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
    if (!user.passwordHash) {
      return { success: false, error: "No password set for this account" };
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return { success: false, error: "Current password is incorrect" };
    }

    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: session.user.id },
      data:  { passwordHash: hash },
    });

    return { success: true, data: null };
  } catch (err) {
    console.error("[changeMyPassword]", err);
    return { success: false, error: "Failed to change password" };
  }
}
