import { z } from "zod";
import { Role } from "@prisma/client";

// ─── Create user (HR / Admin) ─────────────────────────────────────────────────

export const createUserSchema = z.object({
  email:        z.string().email("Invalid email").endsWith(
    "@universalbank.uz",
    "Only @universalbank.uz addresses are allowed"
  ),
  name:         z.string().min(2, "Name must be at least 2 characters").max(100),
  role:         z.nativeEnum(Role).default(Role.EMPLOYEE),
  departmentId: z.string().cuid().nullish(),
  branchId:     z.string().cuid().nullish(),
  password:     z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .optional(),
});

// ─── Update user ──────────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  id:           z.string().cuid("Invalid user ID"),
  name:         z.string().min(2).max(100).optional(),
  role:         z.nativeEnum(Role).optional(),
  departmentId: z.string().cuid().nullish(),
  branchId:     z.string().cuid().nullish(),
  isActive:     z.boolean().optional(),
});

// ─── List params ──────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  page:         z.number().int().min(1).default(1),
  limit:        z.number().int().min(1).max(100).default(20),
  search:       z.string().max(200).optional(),
  role:         z.nativeEnum(Role).optional(),
  departmentId: z.string().cuid().optional(),
  branchId:     z.string().cuid().optional(),
  isActive:     z.boolean().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersParams = z.infer<typeof listUsersSchema>;
