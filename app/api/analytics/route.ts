import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const dateFromParam = searchParams.get("date_from");
  const dateToParam = searchParams.get("date_to");

  let date_from: string;
  let date_to: string;

  if (dateFromParam && dateToParam) {
    date_from = dateFromParam;
    date_to = dateToParam;
  } else {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    date_to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    date_from = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
  }

  const [summaryRes, locationsCityRes, locationsStateRes, variantsAllRes, variantsOrganicRes, variantsInorganicRes, channelRes] =
    await Promise.all([
      supabaseAdmin.rpc("get_analytics_summary", { p_date_from: date_from, p_date_to: date_to }),
      supabaseAdmin.rpc("get_analytics_top_locations", { p_date_from: date_from, p_date_to: date_to, p_mode: "city" }),
      supabaseAdmin.rpc("get_analytics_top_locations", { p_date_from: date_from, p_date_to: date_to, p_mode: "state" }),
      supabaseAdmin.rpc("get_analytics_top_variants", { p_date_from: date_from, p_date_to: date_to, p_organic: "all" }),
      supabaseAdmin.rpc("get_analytics_top_variants", { p_date_from: date_from, p_date_to: date_to, p_organic: "organic" }),
      supabaseAdmin.rpc("get_analytics_top_variants", { p_date_from: date_from, p_date_to: date_to, p_organic: "inorganic" }),
      supabaseAdmin.rpc("get_analytics_channel_split", { p_date_from: date_from, p_date_to: date_to }),
    ]);

  for (const [label, res] of [
    ["summary", summaryRes],
    ["locations_city", locationsCityRes],
    ["locations_state", locationsStateRes],
    ["variants_all", variantsAllRes],
    ["variants_organic", variantsOrganicRes],
    ["variants_inorganic", variantsInorganicRes],
    ["channel_split", channelRes],
  ] as [string, { error: { message: string } | null }][]) {
    if (res.error) {
      return NextResponse.json({ error: `${label}: ${res.error.message}` }, { status: 500 });
    }
  }

  const summaryRows = (summaryRes.data ?? []) as {
    period: string; order_count: number; gmv: number;
    rto_count: number; rto_rate_pct: number; cod_count: number; prepaid_count: number;
  }[];

  const toSummaryObj = (row: typeof summaryRows[0] | undefined) => ({
    order_count: Number(row?.order_count ?? 0),
    gmv: Number(row?.gmv ?? 0),
    rto_count: Number(row?.rto_count ?? 0),
    rto_rate_pct: Number(row?.rto_rate_pct ?? 0),
    cod_count: Number(row?.cod_count ?? 0),
    prepaid_count: Number(row?.prepaid_count ?? 0),
  });

  const current = toSummaryObj(summaryRows.find((r) => r.period === "current"));
  const prev = toSummaryObj(summaryRows.find((r) => r.period === "previous"));

  const mapLocation = (r: { location: string; order_count: number; gmv: number }) => ({
    location: r.location,
    order_count: Number(r.order_count),
    gmv: Number(r.gmv),
  });

  const mapVariant = (r: { variant_label: string; qty_sold: number; gmv: number }) => ({
    variant_label: r.variant_label,
    qty_sold: Number(r.qty_sold),
    gmv: Number(r.gmv),
  });

  const mapChannel = (r: { channel: string; order_count: number; gmv: number }) => ({
    channel: r.channel,
    order_count: Number(r.order_count),
    gmv: Number(r.gmv),
  });

  return NextResponse.json({
    summary: { current, prev },
    locations: {
      by_city: (locationsCityRes.data ?? []).map(mapLocation),
      by_state: (locationsStateRes.data ?? []).map(mapLocation),
    },
    variants: {
      all: (variantsAllRes.data ?? []).map(mapVariant),
      organic: (variantsOrganicRes.data ?? []).map(mapVariant),
      inorganic: (variantsInorganicRes.data ?? []).map(mapVariant),
    },
    channel_split: (channelRes.data ?? []).map(mapChannel),
    meta: { date_from, date_to },
  });
}
