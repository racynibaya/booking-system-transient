import { env } from "@/env";

/**
 * Dev-only visual marker so you always know which environment and database the app
 * is talking to. Renders nothing in production, so end users never see it.
 */
export function EnvBadge() {
  if (env.NODE_ENV === "production") return null;

  const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host;

  return (
    <div className="fixed bottom-2 left-2 z-50 rounded bg-amber-500 px-2 py-1 font-mono text-xs font-semibold text-black shadow-md select-none">
      {env.NODE_ENV} · {host}
    </div>
  );
}
