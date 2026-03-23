const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN!
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? '2025-07'

const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`

// Single query: order header + marketing journey + line items
// $query supports Shopify filter syntax e.g. "updated_at:>=2026-03-10"
const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          customer { id }
          totalPriceSet { shopMoney { amount currencyCode } }
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalTaxSet { shopMoney { amount currencyCode } }
          displayFinancialStatus
          displayFulfillmentStatus
          confirmed
          cancelledAt
          cancelReason
          tags
          note
          customAttributes { key value }
          customerJourneySummary {
            customerOrderIndex
            daysToConversion
            firstVisit {
              landingPage
              referrerUrl
              source
              marketingEvent { channel type }
              utmParameters { campaign content medium source term }
            }
            lastVisit {
              landingPage
              referrerUrl
              source
              marketingEvent { channel type }
              utmParameters { campaign content medium source term }
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet { shopMoney { amount currencyCode } }
                discountedUnitPriceSet { shopMoney { amount currencyCode } }
                totalDiscountSet { shopMoney { amount currencyCode } }
                discountAllocations { allocatedAmountSet { shopMoney { amount } } }
                product { id title handle vendor productType }
                variant { id title sku }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

async function gqlFetch(query: string, variables: Record<string, unknown>) {
  const res = await fetch(SHOPIFY_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new Error(`Shopify HTTP error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`)
  }

  return json
}

// ---- Types ----

export interface ShopifyOrder {
  order_id: string
  order_name: string
  created_at: string
  updated_at: string
  customer_id: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_email: string | null
  customer_phone: string | null
  total_price: number
  subtotal_price: number
  total_tax: number
  currency: string
  financial_status: string
  fulfillment_status: string
  confirmed: boolean
  cancelled_at: string | null
  cancel_reason: string | null
  tags: string
  note: string
  customer_order_index: number | null
  days_to_conversion: number | null
  first_landing_page: string
  first_referrer: string
  first_source: string
  first_marketing_channel: string
  first_marketing_type: string
  first_utm_campaign: string
  first_utm_content: string
  first_utm_medium: string
  first_utm_source: string
  first_utm_term: string
  last_landing_page: string
  last_referrer: string
  last_source: string
  last_marketing_channel: string
  last_marketing_type: string
  last_utm_campaign: string
  last_utm_content: string
  last_utm_medium: string
  last_utm_source: string
  last_utm_term: string
  line_items_count: number
}

export interface ShopifyLineItem {
  line_item_id: string
  order_id: string
  title: string
  quantity: number
  original_unit_price: number
  discounted_unit_price: number
  total_discount: number
  currency: string
  line_total: number
  line_total_discounted: number
  product_id: string | null
  product_title: string
  product_handle: string
  vendor: string
  product_type: string
  variant_id: string | null
  variant_title: string
  sku: string
}

export interface FetchOrdersResult {
  orders: ShopifyOrder[]
  lineItems: ShopifyLineItem[]
}

// ---- Products ----

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          tags
          status
          totalInventory
          totalVariants
          publishedAt
          createdAt
          updatedAt
          images(first: 1) {
            edges { node { url } }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                inventoryItem { id }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

const LOCATIONS_QUERY = `
  query {
    locations(first: 1) {
      edges { node { id name } }
    }
  }
`

const INVENTORY_SET_MUTATION = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { createdAt reason }
      userErrors { field message }
    }
  }
`

export interface ShopifyProduct {
  product_id: string
  title: string
  handle: string
  vendor: string
  product_type: string
  tags: string
  status: string
  total_inventory: number
  total_variants: number
  image_url: string
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ShopifyVariant {
  variant_id: string
  product_id: string
  title: string
  price: number
  sku: string
  inventory_quantity: number
  inventory_item_id: string
}

export interface FetchProductsResult {
  products: ShopifyProduct[]
  variants: ShopifyVariant[]
}

export interface InventoryPushItem {
  inventory_item_id: string
  quantity: number
}

export interface InventoryPushResult {
  success: boolean
  pushed: number
  errors: string[]
}

// Returns the primary Shopify location ID (numeric, stripped from GID).
// Reads SHOPIFY_LOCATION_ID env var first to avoid an extra API call.
export async function fetchPrimaryLocationId(): Promise<string> {
  const envId = process.env.SHOPIFY_LOCATION_ID
  if (envId) return envId

  const data = await gqlFetch(LOCATIONS_QUERY, {})
  const loc = (data as any).data.locations.edges[0]?.node
  if (!loc) throw new Error('No Shopify locations found')
  return loc.id.split('/').pop()
}

// Pushes absolute inventory quantities to Shopify for the given inventory items.
// Batches at 250 items per mutation call (Shopify limit).
export async function pushInventoryToShopify(
  items: InventoryPushItem[],
  locationId: string,
): Promise<InventoryPushResult> {
  if (items.length === 0) return { success: true, pushed: 0, errors: [] }

  const BATCH = 250
  const allErrors: string[] = []
  let totalPushed = 0

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    const quantities = batch.map((item) => ({
      inventoryItemId: `gid://shopify/InventoryItem/${item.inventory_item_id}`,
      locationId: `gid://shopify/Location/${locationId}`,
      quantity: item.quantity,
    }))

    const data = await gqlFetch(INVENTORY_SET_MUTATION, {
      input: { name: 'available', reason: 'correction', ignoreCompareQuantity: true, quantities },
    })

    const userErrors: { message: string }[] =
      (data as any).data?.inventorySetQuantities?.userErrors ?? []

    if (userErrors.length > 0) {
      allErrors.push(...userErrors.map((e) => e.message))
    } else {
      totalPushed += batch.length
    }
  }

  return {
    success: allErrors.length === 0,
    pushed: totalPushed,
    errors: allErrors,
  }
}

// Fetches ALL products with full pagination (no date filter — full catalog sync).
export async function fetchProducts(): Promise<FetchProductsResult> {
  const products: ShopifyProduct[] = []
  const variants: ShopifyVariant[] = []
  let after: string | null = null

  do {
    const data = await gqlFetch(PRODUCTS_QUERY, { first: 250, after })
    const conn = (data as any).data.products

    for (const edge of conn.edges) {
      const p = edge.node
      const productId = p.id.split('/').pop()

      products.push({
        product_id: productId,
        title: p.title,
        handle: p.handle,
        vendor: p.vendor ?? '',
        product_type: p.productType ?? '',
        tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
        status: p.status,
        total_inventory: p.totalInventory ?? 0,
        total_variants: p.totalVariants ?? 0,
        image_url: p.images.edges[0]?.node.url ?? '',
        published_at: p.publishedAt ?? null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      })

      for (const ve of p.variants.edges) {
        const v = ve.node
        variants.push({
          variant_id: v.id.split('/').pop(),
          product_id: productId,
          title: v.title,
          price: parseFloat(v.price),
          sku: v.sku ?? '',
          inventory_quantity: v.inventoryQuantity ?? 0,
          inventory_item_id: v.inventoryItem?.id.split('/').pop() ?? '',
        })
      }
    }

    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null
  } while (after)

  return { products, variants }
}

// ---- Fetch & parse ----

// Fetch orders updated in the last N days (default 7).
// Pass daysBack=0 to skip the date filter and fetch the latest `limit` orders.
export async function fetchOrders(limit = 250, daysBack = 7): Promise<FetchOrdersResult> {
  let query: string | null = null
  if (daysBack > 0) {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10) // YYYY-MM-DD
    query = `updated_at:>=${since}`
  }
  const data = await gqlFetch(ORDERS_QUERY, { first: limit, after: null, query })
  return parseOrders(data)
}

// Parse customAttributes array into a key→value map
function parseCustomAttrs(attrs: { key: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { key, value } of attrs ?? []) {
    map[key] = value
  }
  return map
}

function parseOrders(data: Record<string, unknown>): FetchOrdersResult {
  const orders: ShopifyOrder[] = []
  const lineItems: ShopifyLineItem[] = []

  const edges = (data as any).data.orders.edges as any[]

  for (const edge of edges) {
    const o = edge.node

    const orderId = o.id.split('/').pop()
    const journey = o.customerJourneySummary
    const fv = journey?.firstVisit ?? null
    const lv = journey?.lastVisit ?? null

    // Fastrr checkout stores UTM params in customAttributes (note_attributes) rather than
    // firing Shopify's own journey pixel. Use these as fallback when journey visits are null.
    const ca = parseCustomAttrs(o.customAttributes ?? [])
    const caHasUtm = !!(ca.utm_source || ca.utm_medium || ca.utm_campaign)

    const order: ShopifyOrder = {
      order_id: orderId,
      order_name: o.name,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
      customer_id: o.customer ? o.customer.id.split('/').pop() : null,
      customer_first_name: null,
      customer_last_name: null,
      customer_email: null,
      customer_phone: null,
      total_price: parseFloat(o.totalPriceSet.shopMoney.amount),
      subtotal_price: parseFloat(o.subtotalPriceSet.shopMoney.amount),
      total_tax: parseFloat(o.totalTaxSet.shopMoney.amount),
      currency: o.totalPriceSet.shopMoney.currencyCode,
      financial_status: o.displayFinancialStatus,
      fulfillment_status: o.displayFulfillmentStatus,
      confirmed: o.confirmed,
      cancelled_at: o.cancelledAt ?? null,
      cancel_reason: o.cancelReason ?? null,
      tags: Array.isArray(o.tags) ? o.tags.join(', ') : '',
      note: o.note ?? '',
      customer_order_index: journey?.customerOrderIndex ?? null,
      days_to_conversion: journey?.daysToConversion ?? null,
      // first visit: use journey data; fall back to customAttributes if journey is null
      first_landing_page: fv?.landingPage ?? (caHasUtm ? (ca.landing_page_url ?? '') : ''),
      first_referrer: fv?.referrerUrl ?? '',
      first_source: fv?.source ?? (caHasUtm ? (ca.utm_source ?? '') : ''),
      first_marketing_channel: fv?.marketingEvent?.channel ?? '',
      first_marketing_type: fv?.marketingEvent?.type ?? '',
      first_utm_campaign: fv?.utmParameters?.campaign ?? (caHasUtm ? (ca.utm_campaign ?? '') : ''),
      first_utm_content: fv?.utmParameters?.content ?? (caHasUtm ? (ca.utm_content ?? '') : ''),
      first_utm_medium: fv?.utmParameters?.medium ?? (caHasUtm ? (ca.utm_medium ?? '') : ''),
      first_utm_source: fv?.utmParameters?.source ?? (caHasUtm ? (ca.utm_source ?? '') : ''),
      first_utm_term: fv?.utmParameters?.term ?? (caHasUtm ? (ca.utm_term ?? '') : ''),
      // last visit: use journey data; fall back to customAttributes (represents UTM at purchase)
      last_landing_page: lv?.landingPage ?? (caHasUtm ? (ca.landing_page_url ?? '') : ''),
      last_referrer: lv?.referrerUrl ?? '',
      last_source: lv?.source ?? (caHasUtm ? (ca.utm_source ?? '') : ''),
      last_marketing_channel: lv?.marketingEvent?.channel ?? '',
      last_marketing_type: lv?.marketingEvent?.type ?? '',
      last_utm_campaign: lv?.utmParameters?.campaign ?? (caHasUtm ? (ca.utm_campaign ?? '') : ''),
      last_utm_content: lv?.utmParameters?.content ?? (caHasUtm ? (ca.utm_content ?? '') : ''),
      last_utm_medium: lv?.utmParameters?.medium ?? (caHasUtm ? (ca.utm_medium ?? '') : ''),
      last_utm_source: lv?.utmParameters?.source ?? (caHasUtm ? (ca.utm_source ?? '') : ''),
      last_utm_term: lv?.utmParameters?.term ?? (caHasUtm ? (ca.utm_term ?? '') : ''),
      line_items_count: o.lineItems.edges.length,
    }

    orders.push(order)

    for (const itemEdge of o.lineItems.edges) {
      const i = itemEdge.node
      const originalPrice = parseFloat(i.originalUnitPriceSet.shopMoney.amount)

      // discountAllocations is the source of truth for all discount types.
      // totalDiscountSet misses order-level discount codes; discountedUnitPriceSet
      // also misses them. discountAllocations captures both product-level and
      // order-level code discounts, already proportionally allocated per line item.
      const allocatedDiscount = (i.discountAllocations as any[])
        .reduce((sum: number, da: any) => sum + parseFloat(da.allocatedAmountSet.shopMoney.amount), 0)
      const discountedPrice = allocatedDiscount > 0
        ? originalPrice - allocatedDiscount / i.quantity
        : parseFloat(i.discountedUnitPriceSet.shopMoney.amount)

      lineItems.push({
        line_item_id: i.id.split('/').pop(),
        order_id: orderId,
        title: i.title,
        quantity: i.quantity,
        original_unit_price: originalPrice,
        discounted_unit_price: discountedPrice,
        total_discount: allocatedDiscount,
        currency: i.originalUnitPriceSet.shopMoney.currencyCode,
        line_total: originalPrice * i.quantity,
        line_total_discounted: discountedPrice * i.quantity,
        product_id: i.product ? i.product.id.split('/').pop() : null,
        product_title: i.product?.title ?? '',
        product_handle: i.product?.handle ?? '',
        vendor: i.product?.vendor ?? '',
        product_type: i.product?.productType ?? '',
        variant_id: i.variant ? i.variant.id.split('/').pop() : null,
        variant_title: i.variant?.title ?? '',
        sku: i.variant?.sku ?? '',
      })
    }
  }

  return { orders, lineItems }
}
