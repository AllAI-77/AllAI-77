"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import type { Category } from "@prisma/client";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  name:        z.string().min(2).max(100),
  slug:        z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  description: z.string().max(500).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#003DA5"),
  icon:        z.string().max(50).optional(),
  parentId:    z.string().cuid().nullish(),
});

const updateCategorySchema = createCategorySchema.extend({
  id: z.string().cuid(),
});

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCategory(
  input: unknown
): Promise<ApiResponse<Category>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed  = createCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const existing = await db.category.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return { success: false, error: "A category with this slug already exists" };

    const category = await db.category.create({ data: parsed.data });

    await audit({
      userId:     session.user.id,
      action:     "CATEGORY_CREATED",
      entityType: "Category",
      entityId:   category.id,
      newValues:  { name: category.name, slug: category.slug },
    });

    return { success: true, data: category };
  } catch (err) {
    return handleError("createCategory", err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCategory(
  input: unknown
): Promise<ApiResponse<Category>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");
    const parsed  = updateCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { id, ...data } = parsed.data;
    const old = await db.category.findUnique({ where: { id } });
    if (!old) return { success: false, error: "Category not found" };

    const category = await db.category.update({ where: { id }, data });

    await audit({
      userId:     session.user.id,
      action:     "CATEGORY_UPDATED",
      entityType: "Category",
      entityId:   id,
      oldValues:  { name: old.name, slug: old.slug, isActive: old.isActive },
      newValues:  { name: category.name, slug: category.slug, isActive: category.isActive },
    });

    return { success: true, data: category };
  } catch (err) {
    return handleError("updateCategory", err);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCategory(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireRole("SUPER_ADMIN", "HR_MANAGER");

    const questionCount = await db.question.count({ where: { categoryId: id } });
    if (questionCount > 0) {
      return {
        success: false,
        error:   `Cannot delete: ${questionCount} question(s) belong to this category`,
      };
    }

    await db.category.delete({ where: { id } });

    await audit({
      userId:     session.user.id,
      action:     "CATEGORY_DELETED",
      entityType: "Category",
      entityId:   id,
    });

    return { success: true, data: { id } };
  } catch (err) {
    return handleError("deleteCategory", err);
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export type CategoryWithChildren = Category & {
  children: Category[];
  _count: { questions: number };
};

export async function listCategories(
  includeInactive = false
): Promise<ApiResponse<CategoryWithChildren[]>> {
  try {
    const categories = await db.category.findMany({
      where:   includeInactive ? undefined : { isActive: true, parentId: null },
      include: {
        children: { where: includeInactive ? undefined : { isActive: true } },
        _count:   { select: { questions: true } },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: categories };
  } catch (err) {
    return handleError("listCategories", err);
  }
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getCategory(
  id: string
): Promise<ApiResponse<CategoryWithChildren>> {
  try {
    const category = await db.category.findUnique({
      where:   { id },
      include: {
        children: true,
        _count:   { select: { questions: true } },
      },
    });

    if (!category) return { success: false, error: "Category not found" };
    return { success: true, data: category };
  } catch (err) {
    return handleError("getCategory", err);
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
