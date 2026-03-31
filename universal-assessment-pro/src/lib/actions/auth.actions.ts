"use server";

import { signIn, signOut } from "@/lib/auth";
import { loginSchema, magicLinkSchema } from "@/lib/validations/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/redis";

export type AuthActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Only allow relative paths to prevent open-redirect attacks */
function safeCallbackUrl(raw: string | null): string {
  if (!raw) return "/";
  try {
    // If it parses as an absolute URL → reject
    const u = new URL(raw, "http://x");
    if (u.origin !== "http://x") return "/";
  } catch {
    // Invalid URL → use as-is (relative path)
  }
  // Must start with /
  return raw.startsWith("/") ? raw : "/";
}

async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  return (
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Credentials Login ────────────────────────────────────────────────────────

export async function loginWithCredentials(
  formData: FormData
): Promise<AuthActionResult> {
  const raw = {
    email:    formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Rate limit: 10 attempts per 15 min per email
  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(
    `login:${parsed.data.email}:${ip}`,
    10,
    15 * 60
  );
  if (!allowed) {
    return {
      success: false,
      error: "Too many login attempts. Please wait 15 minutes and try again.",
    };
  }

  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl") as string | null);

  try {
    await signIn("credentials", {
      email:      parsed.data.email,
      password:   parsed.data.password,
      redirectTo: callbackUrl,
    });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password." };
        case "AccessDenied":
          return { success: false, error: "Your account is disabled. Contact your HR manager." };
        default:
          return { success: false, error: "Authentication failed. Please try again." };
      }
    }
    throw err; // Next.js redirect — re-throw
  }
}

// ─── Magic Link ───────────────────────────────────────────────────────────────

export async function sendMagicLink(
  formData: FormData
): Promise<AuthActionResult> {
  const raw = { email: formData.get("email") };

  const parsed = magicLinkSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  // Rate limit: 5 magic-link requests per 15 min per email
  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(
    `magic:${parsed.data.email}:${ip}`,
    5,
    15 * 60
  );
  if (!allowed) {
    return {
      success: false,
      error: "Too many requests. Please wait 15 minutes.",
    };
  }

  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl") as string | null);

  try {
    await signIn("nodemailer", {
      email:      parsed.data.email,
      redirectTo: callbackUrl,
      redirect:   false,
    });
    return { success: true, message: "Check your email for the sign-in link." };
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "AccessDenied") {
        return { success: false, error: "Only @universalbank.uz email addresses are allowed." };
      }
      return { success: false, error: "Failed to send magic link. Please try again." };
    }
    throw err;
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function logOut(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
