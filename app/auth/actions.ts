"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | { notice: string };

const credentials = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

// Email + password (Supabase-native — no third-party provider, no external billing).
// On success the session cookie is set and we redirect to the dashboard; a first-time
// operator's tenant is provisioned by the handle_new_user trigger. If the project has
// email confirmation ON, signUp returns no session → we ask them to confirm.
export async function passwordAuth(
  mode: "signin" | "signup",
  input: { email: string; password: string; name?: string },
): Promise<AuthResult> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { email, password } = parsed.data;
  const supabase = await createClient();

  if (mode === "signup") {
    const name = input.name?.trim();
    if (!name) return { error: "Enter your name or business name." };
    // Stored in raw_user_meta_data → the handle_new_user trigger writes it to tenants.name.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return { error: error.message };
    if (!data.session) return { notice: "Check your email to confirm your account." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Wrong email or password." };
  }

  redirect("/dashboard");
}

// Send a password-reset email. The link lands on /auth/confirm (verifyOtp type=recovery), which
// establishes a recovery session and forwards to /reset-password. We always report success so the
// form never reveals whether an account exists for that email.
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const parsed = z.email("Enter a valid email address.").safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  return { notice: "If an account exists for that email, we've sent a password reset link." };
}

// Set a new password for a user in a recovery session (after clicking the reset link).
export async function updatePassword(password: string): Promise<AuthResult> {
  const parsed = z.string().min(8, "Password must be at least 8 characters.").safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
