import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params;

  const { data, error } = await supabaseAdmin
    .from("inventory_logs")
    .select(
      "variant_id, product_id, variant_title, product_title, prev_virtual, new_virtual, delta_virtual, prev_physical, new_physical, delta_physical, prev_total, new_total, delta_total, remarks, changed_by, changed_at"
    )
    .eq("variant_id", variantId)
    .order("changed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
