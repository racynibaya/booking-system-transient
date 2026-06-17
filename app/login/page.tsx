"use client";

import { Waves } from "lucide-react";
import { useActionState } from "react";

import { sendMagicLink, type LoginState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div>
        <span className="flex size-9 items-center justify-center rounded-md bg-ink text-canvas">
          <Waves className="size-5" />
        </span>
        <h1 className="mt-5 text-display-lg text-ink">Operator sign in</h1>
        <p className="mt-2 text-body-md text-muted">
          We&apos;ll email you a magic link — no password needed.
        </p>
      </div>

      {state.status === "sent" ? (
        <p className="rounded-md border border-hairline bg-surface-soft p-4 text-body-sm text-ink">
          Check your email for the sign-in link.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-caption text-muted">Email</span>
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          {state.status === "error" && <p className="text-body-sm text-error">{state.message}</p>}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      )}
    </main>
  );
}
