/**
 * Shopify Product Scraper (TypeScript port of scrape_products.py)
 * Works with any Shopify store — collection mode or all-products mode.
 */

const PAGE_LIMIT = 250;
const DELAY_MS = 500;

const SCRAPER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScrapedProductRow {
  product_title: string;
  product_type: string;
  tags: string;
  variant_title: string;
  price: number | null;
  compare_at_price: number | null;
  sku: string;
  available: boolean | null;
  description: string;
  image_urls: string;
  product_url: string;
}

export interface ParsedShopifyUrl {
  baseUrl: string;
  collection: string;
  mode: "collection" | "all";
}

// ── URL parser ───────────────────────────────────────────────────────────────

export function parseShopifyUrl(url: string): ParsedShopifyUrl {
  const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
  const baseUrl = `${parsed.protocol}//${parsed.hostname}`;
  const parts = parsed.pathname.split("/").filter(Boolean);

  const colIndex = parts.indexOf("collections");
  if (colIndex !== -1 && parts[colIndex + 1]) {
    return { baseUrl, collection: parts[colIndex + 1], mode: "collection" };
  }

  const storeName = parsed.hostname.replace(/^www\./, "").replace(/\./g, "-");
  return { baseUrl, collection: storeName, mode: "all" };
}

// ── HTML cleaner ─────────────────────────────────────────────────────────────

function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Paginated fetcher ─────────────────────────────────────────────────────────

async function fetchPage(endpoint: string, page: number): Promise<unknown[]> {
  const url = `${endpoint}?limit=${PAGE_LIMIT}&page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": SCRAPER_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const data = (await res.json()) as { products?: unknown[] };
  return data.products ?? [];
}

async function fetchPaginated(
  endpoint: string,
  onPage: (page: number, total: number) => void
): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 1;

  while (true) {
    const batch = await fetchPage(endpoint, page);
    if (!batch.length) break;

    all.push(...batch);
    onPage(page, all.length);

    if (batch.length < PAGE_LIMIT) break;
    page++;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  return all;
}

// ── Product fetcher ──────────────────────────────────────────────────────────

export async function fetchShopifyProducts(
  baseUrl: string,
  mode: "collection" | "all",
  collection: string,
  onPage: (page: number, total: number) => void
): Promise<unknown[]> {
  if (mode === "all") {
    return fetchPaginated(`${baseUrl}/products.json`, onPage);
  }

  // Collection mode — fall back to all-products if empty
  const products = await fetchPaginated(
    `${baseUrl}/collections/${collection}/products.json`,
    onPage
  );

  if (products.length === 0) {
    return fetchPaginated(`${baseUrl}/products.json`, onPage);
  }

  return products;
}

// ── Row extractor ────────────────────────────────────────────────────────────

export function extractRows(
  products: unknown[],
  baseUrl: string
): ScrapedProductRow[] {
  const rows: ScrapedProductRow[] = [];

  for (const product of products as Record<string, unknown>[]) {
    const title = String(product.title ?? "").trim();
    const description = cleanHtml(String(product.body_html ?? ""));
    const productUrl = `${baseUrl}/products/${product.handle ?? ""}`;
    const productType = String(product.product_type ?? "").trim();

    let tags = product.tags ?? "";
    if (Array.isArray(tags)) tags = (tags as string[]).join(", ");
    tags = String(tags).trim();

    const images = (product.images as Record<string, unknown>[]) ?? [];
    const allImageUrls = images
      .map((img) => img.src as string)
      .filter(Boolean)
      .join(" | ");

    const variants = (product.variants as Record<string, unknown>[]) ?? [];

    if (!variants.length) {
      rows.push({
        product_title: title,
        product_type: productType,
        tags,
        variant_title: "",
        price: null,
        compare_at_price: null,
        sku: "",
        available: null,
        description,
        image_urls: allImageUrls,
        product_url: productUrl,
      });
      continue;
    }

    for (const variant of variants) {
      const variantTitle = String(variant.title ?? "").trim();
      const price = variant.price ? parseFloat(String(variant.price)) : null;
      const compareAtPrice = variant.compare_at_price
        ? parseFloat(String(variant.compare_at_price))
        : null;
      const sku = String(variant.sku ?? "").trim();
      const available =
        variant.available != null ? Boolean(variant.available) : null;

      // Prefer variant-specific image, fall back to all product images
      const variantImageId = variant.image_id;
      let rowImages = allImageUrls;
      if (variantImageId) {
        const variantImg = images.find((img) => img.id === variantImageId);
        if (variantImg?.src) rowImages = variantImg.src as string;
      }

      rows.push({
        product_title: title,
        product_type: productType,
        tags,
        variant_title:
          variantTitle === "Default Title" ? "" : variantTitle,
        price,
        compare_at_price: compareAtPrice,
        sku,
        available,
        description,
        image_urls: rowImages,
        product_url: productUrl,
      });
    }
  }

  return rows;
}
