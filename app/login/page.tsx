"use client";

import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { passwordAuth, requestPasswordReset } from "@/app/auth/actions";
import { Stagger, StaggerItem } from "@/components/motion";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tos, setTos] = useState(false);
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
      : await passwordAuth(mode, { email, password, name, tosAccepted: tos });
    setPending(false);
    if ("error" in res) setError(res.error);
    else setNotice(res.notice);
  }

  return (
    // Same hero treatment as the marketplace home: a sea-glass depth wash + drifting aurora + film
    // grain, so the auth card sits on the app's living atmosphere instead of flat canvas.
    <main className="grain relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="surface-mesh absolute inset-0 -z-10" />
      <div aria-hidden className="hero-aurora -z-10 animate-aurora-drift" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-linear-to-b from-transparent to-canvas" />

      <div className="relative w-full max-w-sm">
        <Stagger className="flex flex-col items-center text-center">
          <StaggerItem>
            <Link href="/" className="inline-flex">
              <Image
                src="/logo/tuloy-logo.svg"
                alt="Tuloy"
                width={59}
                height={32}
                priority
                className="h-8 w-auto"
              />
            </Link>
          </StaggerItem>
          <StaggerItem>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas/80 px-4 py-1.5 text-caption text-muted shadow-e1 backdrop-blur">
              <ShieldCheck className="size-3.5 text-primary" /> Every host verified by Tuloy
            </span>
          </StaggerItem>
        </Stagger>

        <Card elevation={2} className="mt-6 p-6">
          <h1 className="font-display text-display-xl text-ink">{COPY[mode].title}</h1>
          <p className="mt-2 text-body-md text-muted">{COPY[mode].sub}</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {mode === "signup" && (
              <Field label="Your name">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Juan Dela Cruz or your business name"
                />
              </Field>
            )}
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

            {mode === "signup" && (
              <label className="flex items-start gap-2.5 text-body-sm text-muted">
                <input
                  type="checkbox"
                  checked={tos}
                  onChange={(e) => setTos(e.target.checked)}
                  required
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  I agree to Tuloy&rsquo;s{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-primary underline underline-offset-2 hover:text-primary-active"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-primary underline underline-offset-2 hover:text-primary-active"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}

            {error && <p className="text-body-sm text-error">{error}</p>}
            {notice && (
              <p className="rounded-md border border-hairline bg-surface-soft p-3 text-body-sm text-ink">
                {notice}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending || (mode === "signup" && !tos)}
              className="w-full"
            >
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
