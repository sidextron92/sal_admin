import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const search     = searchParams.get("search")?.trim() ?? "";
  const company    = searchParams.get("company_name")?.trim() ?? "";
  const category   = searchParams.get("product_type")?.trim() ?? "";
  const available  = searchParams.get("available") ?? "true";   // "true" | "false" | "all"
  const priceMin   = searchParams.get("price_min");
  const priceMax   = searchParams.get("price_max");
  const offset     = (page - 1) * PAGE_SIZE;

  // ── Main query ──────────────────────────────────────────────────────────────
  let query = supabaseAdmin
    .from("competition_products")
    .select(
      "id, competition_brand_id, company_name, product_title, product_type, tags, variant_title, price, compare_at_price, sku, available, description, image_urls, product_url, scraped_at",
      { count: "exact" }
    );

  if (search) {
    query = query.or(
      `product_title.ilike.%${search}%,variant_title.ilike.%${search}%,tags.ilike.%${search}%,sku.ilike.%${search}%`
    );
  }
  if (company)  query = query.eq("company_name", company);
  if (category) query = query.eq("product_type", category);
  if (available === "true")  query = query.eq("available", true);
  if (available === "false") query = query.eq("available", false);
  if (priceMin) query = query.gte("price", parseFloat(priceMin));
  if (priceMax) query = query.lte("price", parseFloat(priceMax));

  query = query
    .order("company_name", { ascending: true })
    .order("product_title", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Filter options (distinct values via RPCs) ───────────────────────────────
  const [brandsRes, typesRes] = await Promise.all([
    supabaseAdmin.rpc("get_competition_company_names"),
    supabaseAdmin.rpc("get_competition_product_types", { p_company_name: company || null }),
  ]);

  const companyNames = (brandsRes.data ?? []).map((r: { company_name: string }) => r.company_name);
  const productTypes = (typesRes.data ?? []).map((r: { product_type: string }) => r.product_type);

  return NextResponse.json({
    products: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    filter_options: { company_names: companyNames, product_types: productTypes },
  });
}
