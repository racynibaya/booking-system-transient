"use client";

import { Waves } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { sendMagicLink, type LoginState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* soft on-brand glow (pale Rausch), like the landing hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-primary-disabled),transparent)] opacity-60"
      />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-ink text-canvas">
            <Waves className="size-4" />
          </span>
          <span className="text-display-sm font-semibold text-ink">Tuloy</span>
        </Link>

        <Card elevated className="mt-5 p-6">
          <h1 className="text-display-lg text-ink">Operator sign in</h1>
          <p className="mt-2 text-body-md text-muted">
            We&apos;ll email you a magic link — no password needed.
          </p>

          {state.status === "sent" ? (
            <p className="mt-6 rounded-md border border-hairline bg-surface-soft p-4 text-body-sm text-ink">
              Check your email for the sign-in link.
            </p>
          ) : (
            <form action={formAction} className="mt-6 flex flex-col gap-4">
              <Field label="Email" error={state.status === "error" ? state.message : undefined}>
                <Input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-caption-sm text-muted-soft">
          Built for San Juan, La Union operators.
        </p>
      </div>
    </main>
  );
}
