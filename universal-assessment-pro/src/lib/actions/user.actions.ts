"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ListUsersParams,
} from "@/lib/validations/user";
import type { ApiResponse } from "@/types";
import type { User } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

// ─── Create user ──────────────────────────────────────────────────────────────

export async function createUser(
  input: CreateUserInput
): Promise<ApiResponse<SafeUser>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed  = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { password, ...userData } = parsed.data;

    const existing = await db.user.findUnique({ where: { email: userData.email } });
    if (existing) return { success: false, error: "A user with this email already exists" };

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const user = await db.user.create({
      data: {
        ...userData,
        departmentId: userData.departmentId ?? undefined,
        branchId:     userData.branchId     ?? undefined,
        passwordHash: passwordHash ?? undefined,
      },
    });

    await audit({
      userId:     session.user.id,
      action:     "USER_CREATED",
      entityType: "User",
      entityId:   user.id,
      newValues:  { email: user.email, role: user.role },
    });

    const { passwordHash: _ph, ...safeUser } = user;
    return { success: true, data: safeUser };
  } catch (err) {
    return handleError("createUser", err);
  }
}

// ─── Update user ──────────────────────────────────────────────────────────────

export async function updateUser(
  input: UpdateUserInput
): Promise<ApiResponse<SafeUser>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed  = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { id, ...data } = parsed.data;

    // HR_MANAGER cannot change SUPER_ADMIN roles
    if (session.user.role === "HR_MANAGER" && data.role === "SUPER_ADMIN") {
      return { success: false, error: "HR Managers cannot assign Super Admin role" };
    }

    const old = await db.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
    if (!old) return { success: false, error: "User not found" };

    const user = await db.user.update({
      where: { id },
      data: {
        ...data,
        departmentId: data.departmentId ?? undefined,
        branchId:     data.branchId     ?? undefined,
      },
    });

    await audit({
      userId:     session.user.id,
      action:     "USER_UPDATED",
      entityType: "User",
      entityId:   id,
      oldValues:  { role: old.role, isActive: old.isActive },
      newValues:  { role: user.role, isActive: user.isActive },
    });

    const { passwordHash: _ph, ...safeUser } = user;
    return { success: true, data: safeUser };
  } catch (err) {
    return handleError("updateUser", err);
  }
}

// ─── Activate / Deactivate ────────────────────────────────────────────────────

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<ApiResponse<{ id: string; isActive: boolean }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");

    if (id === session.user.id) {
      return { success: false, error: "You cannot deactivate your own account" };
    }

    const user = await db.user.update({
      where:  { id },
      data:   { isActive },
      select: { id: true, isActive: true },
    });

    await audit({
      userId:     session.user.id,
      action:     isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId:   id,
    });

    return { success: true, data: user };
  } catch (err) {
    return handleError("setUserActive", err);
  }
}

// ─── Reset password ───────────────────────────────────────────────────────────

export async function resetUserPassword(
  id: string,
  newPassword: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");

    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id }, data: { passwordHash: hash } });

    await audit({
      userId:     session.user.id,
      action:     "USER_PASSWORD_RESET",
      entityType: "User",
      entityId:   id,
    });

    return { success: true, data: { id } };
  } catch (err) {
    return handleError("resetUserPassword", err);
  }
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getUser(
  id: string
): Promise<ApiResponse<SafeUser & { department: { name: string } | null; branch: { name: string } | null }>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");

    const user = await db.user.findUnique({
      where:   { id },
      include: {
        department: { select: { name: true } },
        branch:     { select: { name: true } },
      },
    });
    if (!user) return { success: false, error: "User not found" };

    const { passwordHash: _ph, ...safeUser } = user;
    return { success: true, data: safeUser };
  } catch (err) {
    return handleError("getUser", err);
  }
}

// ─── List (paginated) ─────────────────────────────────────────────────────────

export type UsersPage = {
  users: SafeUser[];
  total: number;
  pages: number;
};

export async function listUsers(
  params: Partial<ListUsersParams> = {}
): Promise<ApiResponse<UsersPage>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");

    const parsed = listUsersSchema.parse(params);
    const { page, limit, search, role, departmentId, branchId, isActive } = parsed;

    const where = {
      ...(role         !== undefined && { role }),
      ...(departmentId !== undefined && { departmentId }),
      ...(branchId     !== undefined && { branchId }),
      ...(isActive     !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name:  { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id:           true,
          email:        true,
          emailVerified: true,
          name:         true,
          avatar:       true,
          role:         true,
          isActive:     true,
          departmentId: true,
          branchId:     true,
          createdAt:    true,
          updatedAt:    true,
        },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
      db.user.count({ where }),
    ]);

    return {
      success: true,
      data: { users: users as SafeUser[], total, pages: Math.ceil(total / limit) },
    };
  } catch (err) {
    return handleError("listUsers", err);
  }
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export type DashboardStats = {
  totalUsers:    number;
  activeUsers:   number;
  totalExams:    number;
  activeExams:   number;
  totalAttempts: number;
  passRate:      number;
  avgScore:      number;
};

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  try {
    await requireRole("SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER");

    const [
      totalUsers,
      activeUsers,
      totalExams,
      activeExams,
      totalAttempts,
      completedAttempts,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.exam.count(),
      db.exam.count({ where: { isActive: true } }),
      db.examAttempt.count(),
      db.examAttempt.findMany({
        where:  { status: "COMPLETED" },
        select: { score: true, passed: true },
      }),
    ]);

    const passed   = completedAttempts.filter((a) => a.passed).length;
    const scores   = completedAttempts.map((a) => a.score ?? 0);
    const passRate = completedAttempts.length
      ? Math.round((passed / completedAttempts.length) * 100)
      : 0;
    const avgScore = scores.length
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;

    return {
      success: true,
      data: { totalUsers, activeUsers, totalExams, activeExams, totalAttempts, passRate, avgScore },
    };
  } catch (err) {
    return handleError("getDashboardStats", err);
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
