import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  parseShopifyUrl,
  fetchShopifyProducts,
  extractRows,
} from "@/lib/shopify-scraper";

// ── SSE helpers ───────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sseEvent(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ── Scrape one brand ──────────────────────────────────────────────────────────

async function scrapeBrand(
  brandId: number,
  send: (data: object) => void
): Promise<void> {
  // 1. Fetch brand record
  const { data: brand, error: brandErr } = await supabaseAdmin
    .from("competition_brands")
    .select("id, company_name, shop_url")
    .eq("id", brandId)
    .single();

  if (brandErr || !brand) {
    send({ brandId, type: "error", message: "Brand not found" });
    return;
  }

  send({ brandId, type: "start", companyName: brand.company_name });

  try {
    // 2. Parse URL and fetch products
    const { baseUrl, collection, mode } = parseShopifyUrl(brand.shop_url);

    const products = await fetchShopifyProducts(
      baseUrl,
      mode,
      collection,
      (page, total) => {
        send({ brandId, type: "page", page, total });
      }
    );

    if (!products.length) {
      send({ brandId, type: "error", message: "No products found at this URL" });
      return;
    }

    // 3. Extract rows
    const rows = extractRows(products, baseUrl);
    send({ brandId, type: "processing", count: rows.length });

    // 4. DELETE existing rows for this brand
    const { error: deleteErr } = await supabaseAdmin
      .from("competition_products")
      .delete()
      .eq("competition_brand_id", brandId);

    if (deleteErr) throw new Error(`Delete failed: ${deleteErr.message}`);

    // 5. INSERT fresh rows in batches of 500
    const scrapedAt = new Date().toISOString();
    const insertRows = rows.map((row) => ({
      ...row,
      competition_brand_id: brandId,
      company_name: brand.company_name,
      scraped_at: scrapedAt,
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      const batch = insertRows.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabaseAdmin
        .from("competition_products")
        .insert(batch);
      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
    }

    send({ brandId, type: "done", count: insertRows.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    send({ brandId, type: "error", message });
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { brandIds } = (await req.json()) as { brandIds: number[] };

  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    return new Response(JSON.stringify({ error: "brandIds is required" }), {
      status: 400,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(sseEvent(data));
        } catch {
          // client disconnected
        }
      };

      // Scrape all selected brands in parallel
      await Promise.all(brandIds.map((id) => scrapeBrand(id, send)));

      send({ type: "complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
