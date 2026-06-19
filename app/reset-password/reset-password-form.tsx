"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    // On success this redirects server-side to /dashboard; only an error comes back.
    const res = await updatePassword(password);
    setPending(false);
    if ("error" in res) setError(res.error);
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
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
          <h1 className="text-display-lg text-ink">Set a new password</h1>
          <p className="mt-2 text-body-md text-muted">Choose a new password for your account.</p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <Field label="New password">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </Field>

            {error && <p className="text-body-sm text-error">{error}</p>}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
