"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { slugify, suffixSlug } from "@/lib/slug";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import {
  blockInput,
  propertyInput,
  roomTypeInput,
  type BlockInput,
  type PropertyInput,
  type RoomTypeInput,
} from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Resolve the current tenant. Returns a discriminated result: on failure it IS an
// ActionResult, so callers can `if (!t.ok) return t;`.
async function authedTenant(): Promise<
  { ok: true; tenantId: string } | { ok: false; error: string }
> {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };
  return { ok: true, tenantId: tenant.id as string };
}

export async function createProperty(input: PropertyInput): Promise<ActionResult> {
  const parsed = propertyInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const t = await authedTenant();
  if (!t.ok) return t;

  const { name, slug, area, address, description, dot_accredited } = parsed.data;
  const base = slug && slug.length > 0 ? slug : slugify(name);
  if (!base) return { ok: false, error: "Add a name we can turn into a link." };

  const supabase = await createClient();
  const values = {
    tenant_id: t.tenantId,
    name,
    area: area || null,
    address: address || null,
    description: description || null,
    dot_accredited,
  };

  // Slug is globally unique (public URL, P9). An operator can't see other tenants'
  // slugs under RLS (P2), so rely on the DB unique constraint: insert, and on a
  // 23505 collision append a suffix and retry.
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : suffixSlug(base, attempt + 1);
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...values, slug: candidate })
      .select("id")
      .single();
    if (!error) {
      createdId = data.id as string;
      break;
    }
    if (error.code !== "23505") return { ok: false, error: error.message };
  }
  if (!createdId) {
    return { ok: false, error: "Couldn't make a unique link — try a different name." };
  }

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  redirect(`/properties/${createdId}`);
}

export async function updateProperty(id: string, input: PropertyInput): Promise<ActionResult> {
  const parsed = propertyInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const t = await authedTenant();
  if (!t.ok) return t;

  const { name, area, address, description, dot_accredited } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      name,
      area: area || null,
      address: address || null,
      description: description || null,
      dot_accredited,
    })
    .eq("id", id); // RLS scopes to the operator's own row
  if (error) return { ok: false, error: error.message };

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  return { ok: true };
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const t = await authedTenant();
  if (!t.ok) return t;
  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  redirect("/properties");
}

export async function createRoomType(
  propertyId: string,
  input: RoomTypeInput,
): Promise<ActionResult> {
  const parsed = roomTypeInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const t = await authedTenant();
  if (!t.ok) return t;

  const supabase = await createClient();
  // tenant_id + property_id; the composite FK rejects a property the operator
  // doesn't own, and RLS with-check rejects a foreign tenant_id.
  const { error } = await supabase.from("room_types").insert({
    tenant_id: t.tenantId,
    property_id: propertyId,
    ...parsed.data,
    description: parsed.data.description || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function updateRoomType(
  id: string,
  propertyId: string,
  input: RoomTypeInput,
): Promise<ActionResult> {
  const parsed = roomTypeInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const t = await authedTenant();
  if (!t.ok) return t;

  const supabase = await createClient();
  const { error } = await supabase
    .from("room_types")
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteRoomType(id: string, propertyId: string): Promise<ActionResult> {
  const t = await authedTenant();
  if (!t.ok) return t;
  const supabase = await createClient();
  const { error } = await supabase.from("room_types").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

// --- Availability blocks (F1.2) ---

export async function createBlock(
  propertyId: string,
  roomTypeId: string,
  input: BlockInput,
): Promise<ActionResult> {
  const parsed = blockInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const t = await authedTenant();
  if (!t.ok) return t;

  const supabase = await createClient();
  // Composite FK (room_type_id, tenant_id) rejects a room the operator doesn't own.
  const { error } = await supabase.from("availability_blocks").insert({
    tenant_id: t.tenantId,
    room_type_id: roomTypeId,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason: parsed.data.reason || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/properties/${propertyId}/calendar`);
  return { ok: true };
}

export async function deleteBlock(id: string, propertyId: string): Promise<ActionResult> {
  const t = await authedTenant();
  if (!t.ok) return t;
  const supabase = await createClient();
  const { error } = await supabase.from("availability_blocks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/properties/${propertyId}/calendar`);
  return { ok: true };
}
