"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { passwordAuth } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignin = mode === "signin";

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    // On success this redirects server-side; only error/notice come back.
    const res = await passwordAuth(mode, { email, password });
    setPending(false);
    if ("error" in res) setError(res.error);
    else setNotice(res.notice);
  }

  function toggleMode() {
    setMode(isSignin ? "signup" : "signin");
    setError(null);
    setNotice(null);
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
          <h1 className="text-display-lg text-ink">
            {isSignin ? "Operator sign in" : "Create your account"}
          </h1>
          <p className="mt-2 text-body-md text-muted">
            {isSignin
              ? "Sign in to manage your bookings."
              : "Set up your operator account — takes a minute."}
          </p>

          <form onSubmit={onPasswordSubmit} className="mt-6 flex flex-col gap-4">
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
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignin ? "current-password" : "new-password"}
                placeholder="At least 8 characters"
              />
            </Field>

            {error && <p className="text-body-sm text-error">{error}</p>}
            {notice && (
              <p className="rounded-md border border-hairline bg-surface-soft p-3 text-body-sm text-ink">
                {notice}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "…" : isSignin ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-body-sm text-muted">
            {isSignin ? "New to Tuloy? " : "Already have an account? "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-ink underline transition-colors hover:text-muted"
            >
              {isSignin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </Card>

        <p className="mt-6 text-center text-caption-sm text-muted-soft">
          Built for San Juan, La Union operators.
        </p>
      </div>
    </main>
  );
}
