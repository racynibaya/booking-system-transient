import { createClient } from "@supabase/supabase-js";

// Local-dev service client for the E2E setup. Mirrors `supabase status` for the local stack;
// override via env when pointing the watch run at a different local project. SERVICE ROLE — used
// ONLY to *discover* a real seeded listing + its operator login, never inside the flow under test.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.E2E_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
// get_public_listing is granted to anon (not service_role), so the resolve-check runs as anon —
// exactly the role the public page uses.
const ANON_KEY =
  process.env.E2E_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const OPERATOR_PASSWORD = "password123"; // shared by every seeded operator (see seed.sql)

export function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
export function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type BookableListing = {
  slug: string;
  roomTypeId: string;
  roomName: string;
  capacity: number;
  propertyId: string;
  propertyName: string;
  area: string | null;
  operatorEmail: string;
  operatorPassword: string;
};

// Create a guest booking hold straight through the public RPC (anon, exactly like the booking card),
// so operator-side flows have a real row to act on without re-driving the whole guest UI on screen.
// Caller supplies the dates (use randomFutureStay so independent scenarios don't collide).
export async function createHoldViaRpc(input: {
  roomTypeId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
}): Promise<string> {
  const anon = anonClient();
  const { data, error } = await anon.rpc("create_booking_hold", {
    p_room_type_id: input.roomTypeId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_num_guests: 1,
    p_guest_name: input.guestName,
    p_hold_minutes: 15,
  });
  if (error) throw new Error(`create_booking_hold failed: ${error.message}`);
  const booking = data as { id: string } | null;
  if (!booking?.id) throw new Error("create_booking_hold returned no booking");
  return booking.id;
}

// Read back the cancellation_reason a test wrote, by the unique guest name it used. Service role
// — a verification read of the row the flow under test just mutated (F2.1).
export async function readCancellationReason(guestName: string): Promise<string | null> {
  const admin = serviceClient();
  const { data, error } = await admin
    .from("bookings")
    .select("cancellation_reason")
    .eq("guest_name", guestName)
    .maybeSingle();
  if (error) throw new Error(`Could not read cancellation_reason: ${error.message}`);
  return (data?.cancellation_reason as string | null) ?? null;
}

// Pick a real, publicly-bookable seeded listing and the operator who owns it. A property is
// publicly visible only when its tenant is `approved` AND gcash_changed_at IS NULL (see seed.sql /
// get_public_listing). We read that join with the service role, then resolve the owning operator's
// email through the auth admin API — every seeded operator shares the password below.
export async function pickBookableListing(): Promise<BookableListing> {
  const admin = serviceClient();
  const anon = anonClient();

  const { data, error } = await admin
    .from("properties")
    .select(
      "id, name, slug, area, tenants!inner(user_id, verification_status, is_admin, gcash_changed_at), room_types(id, name, capacity, quantity)",
    )
    .eq("tenants.verification_status", "approved")
    .eq("tenants.is_admin", false) // get_public_listing hides admin tenants → their /[slug] 404s
    .is("tenants.gcash_changed_at", null)
    .limit(100);

  if (error) throw new Error(`Could not query seeded listings: ${error.message}`);

  type Row = {
    id: string;
    name: string;
    slug: string;
    area: string | null;
    tenants: { user_id: string } | { user_id: string }[];
    room_types: { id: string; name: string; capacity: number; quantity: number }[];
  };

  // Shuffle so independent scenarios tend to land on different listings — keeps repeat runs (which
  // leave confirmed bookings behind) from selling out one deterministic room.
  const candidates = [...((data as Row[] | null) ?? [])];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Walk candidates (each: approved, non-admin, has a bookable room) and confirm the slug actually
  // RESOLVES through the same RPC the public page uses — so we never hand the test a 404 page.
  for (const p of candidates) {
    if (!p.room_types?.some((r) => r.quantity >= 1)) continue;

    const { data: listing } = await anon.rpc("get_public_listing", { p_slug: p.slug });
    const resolved = listing as { property?: unknown; room_types?: unknown[] } | null;
    if (!resolved?.property || !(resolved.room_types?.length ?? 0)) continue;

    const room = p.room_types.find((r) => r.quantity >= 1)!;
    const tenant = Array.isArray(p.tenants) ? p.tenants[0] : p.tenants;
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(tenant.user_id);
    if (userErr || !userRes?.user?.email) continue;

    return {
      slug: p.slug,
      roomTypeId: room.id,
      roomName: room.name,
      capacity: room.capacity,
      propertyId: p.id,
      propertyName: p.name,
      area: p.area,
      operatorEmail: userRes.user.email,
      operatorPassword: OPERATOR_PASSWORD,
    };
  }

  throw new Error(
    "No publicly-resolvable seeded listing found. Run `npm run db:reset` to load the local seed first.",
  );
}

// Find a publicly-resolvable listing that has a seeded availability block on a future date — a
// guaranteed sold-out day (a block closes the whole room_type, see unitsAvailableOn). Returns the
// room to select and the exact date the calendar must show as disabled.
export async function pickSoldOutDate(): Promise<{
  slug: string;
  roomTypeId: string;
  roomName: string;
  date: string; // YYYY-MM-DD, the blocked (sold-out) day
}> {
  const admin = serviceClient();
  const anon = anonClient();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data, error } = await admin
    .from("availability_blocks")
    .select("start_date, room_types!inner(id, name, properties!inner(slug))")
    .gte("start_date", todayStr)
    .order("start_date", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not query availability blocks: ${error.message}`);

  type Block = {
    start_date: string;
    room_types: { id: string; name: string; properties: { slug: string } };
  };

  // PostgREST types embeds as arrays; this block→room_type→property chain is many-to-one, so each is
  // an object at runtime. Cast through unknown to assert the real shape.
  for (const b of (data as unknown as Block[] | null) ?? []) {
    const rt = b.room_types;
    const slug = rt?.properties?.slug;
    if (!slug) continue;
    const { data: listing } = await anon.rpc("get_public_listing", { p_slug: slug });
    const resolved = listing as { property?: unknown; room_types?: { id: string }[] } | null;
    if (!resolved?.property) continue;
    if (!resolved.room_types?.some((r) => r.id === rt.id)) continue;
    return { slug, roomTypeId: rt.id, roomName: rt.name, date: b.start_date };
  }
  throw new Error(
    "No publicly-resolvable seeded availability block found. Run `npm run db:reset`.",
  );
}

// A seeded operator whose tenant is NOT yet approved — the right starting state for the
// verification flow (they still need to submit / get reviewed). Seed mix: pending / changes_requested.
export async function pickUnverifiedOperator(): Promise<{
  email: string;
  password: string;
  status: string;
}> {
  const admin = serviceClient();
  const { data, error } = await admin
    .from("tenants")
    .select("user_id, verification_status, is_admin")
    .in("verification_status", ["pending", "changes_requested"])
    .eq("is_admin", false)
    .limit(20);
  if (error) throw new Error(`Could not query unverified operators: ${error.message}`);

  for (const t of (data as { user_id: string; verification_status: string }[] | null) ?? []) {
    const { data: userRes } = await admin.auth.admin.getUserById(t.user_id);
    if (userRes?.user?.email) {
      return {
        email: userRes.user.email,
        password: OPERATOR_PASSWORD,
        status: t.verification_status,
      };
    }
  }
  throw new Error("No unverified seeded operator found. Run `npm run db:reset`.");
}

// A minimal valid 1×1 PNG — enough for the guest's "payment receipt" upload. The booking card
// runs it through canvas compression before upload, so it must decode as a real image.
export const RECEIPT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
