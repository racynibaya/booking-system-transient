import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

// NOTE: In this Next.js the `middleware` file convention is deprecated and
// renamed to `proxy` (see node_modules/next/dist/docs/.../proxy.md). This file
// MUST be named proxy.ts and export `proxy` — a `middleware`-named function will
// silently never run, so the Supabase session cookie would never refresh.
//
// This is the @supabase/ssr session-refresh pattern adapted to proxy: it reads
// the cookies off the request, calls getUser() to refresh an expiring token, and
// writes the rotated cookie onto the response. Do NOT add code between
// createServerClient and getUser().
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session if expired — required for Server Components to read it.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on page routes only. Exclude ALL Next internals (_next/*) — not just
  // _next/static|_next/image: in this Next, proxy also runs on _next/webpack-hmr
  // (the dev HMR WebSocket), and intercepting it breaks the dev client runtime so
  // client components never hydrate (forms fall back to native submits). Page RSC
  // navigations still go through proxy (they hit the route path, not _next/), so
  // session refresh is unaffected.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
