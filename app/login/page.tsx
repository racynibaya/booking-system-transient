"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { passwordAuth, requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type Mode = "signin" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  signin: { title: "Operator sign in", sub: "Sign in to manage your bookings.", cta: "Sign in" },
  signup: {
    title: "Create your account",
    sub: "Set up your operator account — takes a minute.",
    cta: "Create account",
  },
  forgot: {
    title: "Reset your password",
    sub: "Enter your email and we'll send you a reset link.",
    cta: "Send reset link",
  },
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignin = mode === "signin";
  const isForgot = mode === "forgot";

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    // signin/signup redirect server-side on success; only error/notice come back.
    const res = isForgot
      ? await requestPasswordReset(email)
      : await passwordAuth(mode, { email, password });
    setPending(false);
    if ("error" in res) setError(res.error);
    else setNotice(res.notice);
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* soft on-brand glow (pale Rausch), like the landing hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-primary-disabled),transparent)] opacity-60"
      />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={59}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <Card elevated className="mt-5 p-6">
          <h1 className="text-display-lg text-ink">{COPY[mode].title}</h1>
          <p className="mt-2 text-body-md text-muted">{COPY[mode].sub}</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>

            {!isForgot && (
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={isSignin ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                />
              </Field>
            )}

            {isSignin && (
              <button
                type="button"
                onClick={() => switchTo("forgot")}
                className="-mt-2 self-end text-body-sm text-muted underline transition-colors hover:text-ink"
              >
                Forgot password?
              </button>
            )}

            {error && <p className="text-body-sm text-error">{error}</p>}
            {notice && (
              <p className="rounded-md border border-hairline bg-surface-soft p-3 text-body-sm text-ink">
                {notice}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "…" : COPY[mode].cta}
            </Button>
          </form>

          <p className="mt-4 text-center text-body-sm text-muted">
            {isForgot ? (
              <button
                type="button"
                onClick={() => switchTo("signin")}
                className="text-ink underline transition-colors hover:text-muted"
              >
                Back to sign in
              </button>
            ) : (
              <>
                {isSignin ? "New to Tuloy? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => switchTo(isSignin ? "signup" : "signin")}
                  className="text-ink underline transition-colors hover:text-muted"
                >
                  {isSignin ? "Create an account" : "Sign in"}
                </button>
              </>
            )}
          </p>
        </Card>

        <p className="mt-6 text-center text-caption-sm text-muted-soft">
          Built for San Juan, La Union operators.
        </p>
      </div>
    </main>
  );
}
