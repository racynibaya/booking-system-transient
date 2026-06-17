import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

// Magic-link landing. Handles both flows so the cloud project works without
// customizing the email template:
//   - token_hash + type  (custom "{{ .TokenHash }}" template)  -> verifyOtp
//   - code               (default "{{ .ConfirmationURL }}")    -> exchangeCodeForSession
//
// MUST use next/navigation `redirect()` (not NextResponse.redirect): the session
// cookies set by verifyOtp/exchange go through the cookies() store, and only
// redirect() flushes them onto the redirect response. NextResponse.redirect drops
// them, leaving the user unauthenticated on the next request.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/login?error=auth");
}
