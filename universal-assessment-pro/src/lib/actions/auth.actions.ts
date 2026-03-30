"use server";

import { signIn, signOut } from "@/lib/auth";
import { loginSchema, magicLinkSchema } from "@/lib/validations/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export type AuthActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ─── Credentials Login ────────────────────────────────────────────────────────

export async function loginWithCredentials(
  formData: FormData
): Promise<AuthActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password." };
        case "AccessDenied":
          return {
            success: false,
            error: "Your account is disabled. Contact your HR manager.",
          };
        default:
          return { success: false, error: "Authentication failed. Please try again." };
      }
    }
    // Next.js redirect throws — re-throw to allow navigation
    throw err;
  }
}

// ─── Magic Link ───────────────────────────────────────────────────────────────

export async function sendMagicLink(
  formData: FormData
): Promise<AuthActionResult> {
  const raw = { email: formData.get("email") };

  const parsed = magicLinkSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid email",
    };
  }

  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("nodemailer", {
      email: parsed.data.email,
      redirectTo: callbackUrl,
      redirect: false,
    });
    return { success: true, message: "Check your email for the sign-in link." };
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "AccessDenied") {
        return {
          success: false,
          error:
            "Only @universalbank.uz email addresses are allowed.",
        };
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
