import { requireUser } from "@/lib/supabase/dal";

import { ResetPasswordForm } from "./reset-password-form";

// Reached via the reset link: /auth/confirm verifies the recovery token, sets a session, and
// forwards here. requireUser() redirects to /login if there's no session (e.g. an expired link),
// so only someone in a valid recovery session sees the form.
export default async function ResetPasswordPage() {
  await requireUser();
  return <ResetPasswordForm />;
}
