import { NextRequest, NextResponse } from "next/server";

const ENDPOINT_MAP: Record<string, string> = {
  "shopify-orders": "/api/sync/shopify",
  "shopify-products": "/api/sync/products",
  shiprocket: "/api/sync/shiprocket",
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "";
  const endpoint = ENDPOINT_MAP[type];

  if (!endpoint) {
    return NextResponse.json(
      { error: "Invalid type. Use: shopify-orders, shopify-products, shiprocket" },
      { status: 400 }
    );
  }

  const origin = new URL(req.url).origin;

  try {
    const res = await fetch(`${origin}${endpoint}`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json({ type, ...data });
  } catch (err) {
    return NextResponse.json(
      { error: "Sync failed", detail: String(err) },
      { status: 500 }
    );
  }
}
