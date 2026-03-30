import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = 30;
    const search = url.searchParams.get("search")?.trim() || "";
    const product_type = url.searchParams.get("product_type") || "";
    const date_from = url.searchParams.get("date_from") || "";
    const date_to = url.searchParams.get("date_to") || "";

    let query = supabaseAdmin
      .from("visualizations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `product_title.ilike.%${search}%,product_handle.ilike.%${search}%,utm_source.ilike.%${search}%,utm_campaign.ilike.%${search}%`
      );
    }

    if (product_type) {
      query = query.ilike("product_type", product_type);
    }

    if (date_from) {
      query = query.gte("created_at", `${date_from}T00:00:00`);
    }
    if (date_to) {
      query = query.lte("created_at", `${date_to}T23:59:59`);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with product image from products table
    const rows = data || [];
    const productIds = [...new Set(rows.map((r) => String(r.product_id)).filter(Boolean))];
    let productImageMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("product_id, image_url")
        .in("product_id", productIds);
      if (products) {
        productImageMap = Object.fromEntries(
          products.map((p) => [p.product_id, p.image_url])
        );
      }
    }
    const enriched = rows.map((r) => ({
      ...r,
      product_image_url: productImageMap[String(r.product_id)] || null,
    }));

    // Get distinct product types for filter dropdown
    const { data: typesData } = await supabaseAdmin
      .from("visualizations")
      .select("product_type")
      .not("product_type", "is", null)
      .order("product_type");

    const product_types = [
      ...new Set((typesData || []).map((r) => r.product_type as string)),
    ];

    return NextResponse.json({
      visualizations: enriched,
      total: count || 0,
      page,
      pageSize,
      product_types,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
