"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import type { Department, Branch } from "@prisma/client";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const deptSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, underscores, hyphens"),
});

const branchSchema = z.object({
  name:   z.string().min(2).max(100),
  code:   z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, underscores, hyphens"),
  region: z.string().min(2).max(100),
});

// ─── Department CRUD ──────────────────────────────────────────────────────────

export type DepartmentWithCount = Department & { _count: { users: number } };

export async function listDepartments(): Promise<ApiResponse<DepartmentWithCount[]>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const depts = await db.department.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return { success: true, data: depts };
  } catch (err) {
    return handleError("listDepartments", err);
  }
}

export async function createDepartment(input: unknown): Promise<ApiResponse<Department>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed = deptSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const existing = await db.department.findUnique({ where: { code: parsed.data.code } });
    if (existing) return { success: false, error: "Department code already exists" };

    const dept = await db.department.create({ data: parsed.data });
    return { success: true, data: dept };
  } catch (err) {
    return handleError("createDepartment", err);
  }
}

export async function updateDepartment(input: unknown): Promise<ApiResponse<Department>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed = deptSchema.extend({ id: z.string().cuid() }).safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { id, ...data } = parsed.data;
    const existing = await db.department.findFirst({ where: { code: data.code, NOT: { id } } });
    if (existing) return { success: false, error: "Department code already in use" };

    const dept = await db.department.update({ where: { id }, data });
    return { success: true, data: dept };
  } catch (err) {
    return handleError("updateDepartment", err);
  }
}

export async function deleteDepartment(id: string): Promise<ApiResponse<null>> {
  try {
    await requireRole("SUPER_ADMIN");
    const dept = await db.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!dept) return { success: false, error: "Not found" };
    if (dept._count.users > 0) return { success: false, error: "Cannot delete — department has users" };

    await db.department.delete({ where: { id } });
    return { success: true, data: null };
  } catch (err) {
    return handleError("deleteDepartment", err);
  }
}

// ─── Branch CRUD ──────────────────────────────────────────────────────────────

export type BranchWithCount = Branch & { _count: { users: number } };

export async function listBranches(): Promise<ApiResponse<BranchWithCount[]>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");
    const branches = await db.branch.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return { success: true, data: branches };
  } catch (err) {
    return handleError("listBranches", err);
  }
}

export async function createBranch(input: unknown): Promise<ApiResponse<Branch>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed = branchSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const existing = await db.branch.findUnique({ where: { code: parsed.data.code } });
    if (existing) return { success: false, error: "Branch code already exists" };

    const branch = await db.branch.create({ data: parsed.data });
    return { success: true, data: branch };
  } catch (err) {
    return handleError("createBranch", err);
  }
}

export async function updateBranch(input: unknown): Promise<ApiResponse<Branch>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed = branchSchema.extend({ id: z.string().cuid() }).safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { id, ...data } = parsed.data;
    const existing = await db.branch.findFirst({ where: { code: data.code, NOT: { id } } });
    if (existing) return { success: false, error: "Branch code already in use" };

    const branch = await db.branch.update({ where: { id }, data });
    return { success: true, data: branch };
  } catch (err) {
    return handleError("updateBranch", err);
  }
}

export async function deleteBranch(id: string): Promise<ApiResponse<null>> {
  try {
    await requireRole("SUPER_ADMIN");
    const branch = await db.branch.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!branch) return { success: false, error: "Not found" };
    if (branch._count.users > 0) return { success: false, error: "Cannot delete — branch has users" };

    await db.branch.delete({ where: { id } });
    return { success: true, data: null };
  } catch (err) {
    return handleError("deleteBranch", err);
  }
}

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(ctx: string, err: unknown): ApiResponse<never> {
  if (err instanceof Error) {
    if (err.message === "Unauthorized") return { success: false, error: "You must be logged in" };
    if (err.message === "Forbidden")    return { success: false, error: "Insufficient permissions" };
  }
  console.error(`[${ctx}]`, err);
  return { success: false, error: "An unexpected error occurred" };
}
