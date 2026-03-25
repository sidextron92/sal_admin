import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PATCH /api/competition-brands/[id] — update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const updates: Record<string, string> = {};

  if (body.company_name !== undefined) updates.company_name = body.company_name.trim();
  if (body.shop_url !== undefined) updates.shop_url = body.shop_url.trim();

  if (!updates.company_name && body.company_name !== undefined)
    return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
  if (!updates.shop_url && body.shop_url !== undefined)
    return NextResponse.json({ error: "shop_url cannot be empty" }, { status: 400 });

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("competition_brands")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, brand: data });
}

// DELETE /api/competition-brands/[id] — delete
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("competition_brands")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
