"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  loginWithCredentials,
  sendMagicLink,
} from "@/lib/actions/auth.actions";
import {
  loginSchema,
  magicLinkSchema,
  type LoginFormValues,
  type MagicLinkFormValues,
} from "@/lib/validations/auth";

// ─── Animation variants ───────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

const tabContentVariants = {
  hidden: { opacity: 0, x: 8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.15 } },
};

// ─── Credentials form ─────────────────────────────────────────────────────────

function CredentialsForm({ callbackUrl }: { callbackUrl: string }) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  function onSubmit(data: LoginFormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", data.email);
      fd.append("password", data.password);
      fd.append("callbackUrl", callbackUrl);
      const result = await loginWithCredentials(fd);
      if (!result.success) {
        setServerError(result.error);
      }
      // On success, Next.js redirect is thrown — component unmounts
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          Corporate Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@universalbank.uz"
            className="pl-9"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-9"
            {...register("password")}
          />
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-[var(--brand-blue)] font-semibold hover:bg-[var(--brand-blue-dark)] text-white"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            Sign In
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Magic Link form ──────────────────────────────────────────────────────────

function MagicLinkForm({ callbackUrl }: { callbackUrl: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkFormValues>({
    resolver: zodResolver(magicLinkSchema),
  });

  function onSubmit(data: MagicLinkFormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", data.email);
      fd.append("callbackUrl", callbackUrl);
      const result = await sendMagicLink(fd);
      if (result.success) {
        setSentEmail(data.email);
        setSent(true);
      } else {
        setServerError(result.error);
      }
    });
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 py-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Check your inbox</p>
          <p className="mt-1 text-sm text-gray-500">
            We sent a sign-in link to{" "}
            <span className="font-medium text-[var(--brand-blue)]">{sentEmail}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-gray-400"
          onClick={() => setSent(false)}
        >
          Use a different email
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="magic-email" className="text-sm font-medium text-gray-700">
          Corporate Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="magic-email"
            type="email"
            autoComplete="email"
            placeholder="you@universalbank.uz"
            className="pl-9"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <p className="text-xs text-gray-400">
        We will send a secure one-time link to your corporate email. No password
        needed.
      </p>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-[var(--brand-blue)] font-semibold hover:bg-[var(--brand-blue-dark)] text-white"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending link…
          </>
        ) : (
          <>
            Send Magic Link
            <Mail className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const authError = searchParams.get("error");

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md"
    >
      {/* Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="border-b border-gray-100 bg-white px-8 pt-8 pb-6 text-center">
          {/* Logo mark */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-blue)] shadow-lg shadow-blue-900/30">
            <span className="text-2xl font-black tracking-tight text-white">U</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Universal Assessment Pro</h1>
          <p className="mt-1 text-sm text-gray-500">ATB Universalbank — Staff Portal</p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {/* Show auth error if redirected from NextAuth with ?error= */}
          {authError && (
            <Alert variant="destructive" className="mb-4 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {authError === "AccessDenied"
                  ? "Access denied. Only @universalbank.uz accounts are allowed."
                  : authError === "Verification"
                  ? "The sign-in link has expired or was already used."
                  : "Authentication error. Please try again."}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="credentials">
            <TabsList className="mb-6 w-full rounded-lg bg-gray-100">
              <TabsTrigger value="credentials" className="w-full text-sm">
                Password
              </TabsTrigger>
              <TabsTrigger value="magic" className="w-full text-sm">
                Magic Link
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <TabsContent value="credentials">
                <motion.div
                  key="credentials"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <CredentialsForm callbackUrl={callbackUrl} />
                </motion.div>
              </TabsContent>

              <TabsContent value="magic">
                <motion.div
                  key="magic"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <MagicLinkForm callbackUrl={callbackUrl} />
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-8 py-3 text-center text-xs text-gray-400">
          Having trouble? Contact{" "}
          <a
            href="mailto:it-support@universalbank.uz"
            className="text-[var(--brand-blue)] hover:underline"
          >
            IT Support
          </a>
        </div>
      </div>

      {/* Security badge */}
      <p className="mt-4 text-center text-xs text-white/50">
        🔒 Secured with end-to-end encryption · Internal use only
      </p>
    </motion.div>
  );
}
