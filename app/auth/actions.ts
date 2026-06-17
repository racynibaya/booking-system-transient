"use server";

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
  input: { email: string; password: string },
): Promise<AuthResult> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { email, password } = parsed.data;
  const supabase = await createClient();

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) return { notice: "Check your email to confirm your account." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Wrong email or password." };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
