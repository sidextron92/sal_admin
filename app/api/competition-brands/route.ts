import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/competition-brands — list all with products_count + last_synced
export async function GET() {
  const { data, error } = await supabaseAdmin.rpc("get_competition_brands_with_stats");

  if (error) {
    // Fallback: plain select if RPC doesn't exist yet
    const { data: plain, error: plainErr } = await supabaseAdmin
      .from("competition_brands")
      .select("*")
      .order("created_at", { ascending: false });
    if (plainErr) return NextResponse.json({ error: plainErr.message }, { status: 500 });
    return NextResponse.json({ brands: plain });
  }

  return NextResponse.json({ brands: data });
}

// POST /api/competition-brands — create
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { company_name, shop_url } = body;

  if (!company_name?.trim()) return NextResponse.json({ error: "company_name is required" }, { status: 400 });
  if (!shop_url?.trim()) return NextResponse.json({ error: "shop_url is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("competition_brands")
    .insert({ company_name: company_name.trim(), shop_url: shop_url.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, brand: data }, { status: 201 });
}
