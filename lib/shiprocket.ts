const SR_BASE = 'https://apiv2.shiprocket.in/v1/external'
const SR_EMAIL = process.env.SHIPROCKET_EMAIL!
const SR_PASSWORD = process.env.SHIPROCKET_PASSWORD!

// ---- Auth ----

async function getToken(): Promise<string> {
  const res = await fetch(`${SR_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SR_EMAIL, password: SR_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Shiprocket auth failed: ${res.status}`)
  const json = await res.json()
  if (!json.token) throw new Error('Shiprocket auth: no token in response')
  return json.token
}

// ---- Types ----

export interface ShiprocketOrderRow {
  // join key
  order_name: string          // '#2082' — matches orders.order_name
  // customer
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_city: string | null
  customer_pincode: string | null
  customer_state: string | null
  customer_address: string | null
  // shipment
  sr_order_id: number | null
  sr_status: string | null
  payment_method: string | null
  awb_code: string | null
  courier_name: string | null
  etd: string | null          // ISO string or null
}

export interface ShiprocketOrderInput {
  order_name: string           // e.g. '#M-001' — # will be stripped for Shiprocket's order_id
  order_date: string           // ISO string
  pickup_location: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_address?: string
  customer_city: string
  customer_pincode: string
  customer_state: string
  payment_method: 'Prepaid' | 'COD'
  shipping_charges: number
  subtotal_price: number
  total_discount: number
  note?: string
  line_items: Array<{
    name: string
    product_type: string       // mapped to Shiprocket's sku field
    units: number
    selling_price: number
    discount: number
  }>
  weight: number
  length: number
  breadth: number
  height: number
}

export interface ShiprocketPushResult {
  success: boolean
  sr_order_id?: number
  shipment_id?: number
  status?: string
  error?: string
}

// ---- Fetch all pages ----

export async function fetchShiprocketOrders(): Promise<ShiprocketOrderRow[]> {
  const token = await getToken()
  const headers = { Authorization: `Bearer ${token}` }

  // Filter by updated_at for last N days (default 7).
  // Shiprocket constraints: both params required together, max window 30 days, max lookback 30 days.
  const daysBack = 7
  // updated_to must be tomorrow — Shiprocket treats the date as 00:00:00,
  // so today's orders are excluded if updated_to = today.
  const updated_to = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const updated_from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const rows: ShiprocketOrderRow[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await fetch(
      `${SR_BASE}/orders?per_page=100&page=${page}&updated_from=${updated_from}&updated_to=${updated_to}`,
      { headers }
    )
    if (!res.ok) throw new Error(`Shiprocket orders fetch failed: ${res.status}`)
    const json = await res.json()

    totalPages = json.meta?.pagination?.total_pages ?? 1

    for (const o of json.data ?? []) {
      const shipment = o.shipments?.[0] ?? null
      const awb = shipment?.awb || null
      const courier = shipment?.courier || null
      const etdRaw = shipment?.etd
      const etd =
        etdRaw && etdRaw !== '0000-00-00 00:00:00'
          ? new Date(etdRaw).toISOString()
          : null

      rows.push({
        order_name: `#${o.channel_order_id}`,
        customer_name: o.customer_name || null,
        customer_email: o.customer_email || null,
        customer_phone: o.customer_phone || null,
        customer_city: o.customer_city || null,
        customer_pincode: o.customer_pincode ? String(o.customer_pincode) : null,
        customer_state: o.customer_state || null,
        customer_address: [
          (o.customer_address || '').trim(),
          (o.customer_address_2 || '').trim().replace(/^,\s*/, ''),
          (o.customer_pincode || '').trim(),
        ].filter(Boolean).join(', ') || null,
        sr_order_id: o.id ?? null,
        sr_status: o.status || null,
        payment_method: o.payment_method || null,
        awb_code: awb,
        courier_name: courier,
        etd,
      })
    }

    page++
  } while (page <= totalPages)

  return rows
}

// ---- Push order to Shiprocket ----

export async function pushOrderToShiprocket(input: ShiprocketOrderInput): Promise<ShiprocketPushResult> {
  const token = await getToken()

  // Strip leading # from order_name → Shiprocket's order_id (echoed back as channel_order_id for sync join)
  const srOrderId = input.order_name.startsWith('#') ? input.order_name.slice(1) : input.order_name

  // Split name into first / last
  const nameParts = input.customer_name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')

  // Format date as 'YYYY-MM-DD HH:MM'
  const orderDate = new Date(input.order_date).toISOString().replace('T', ' ').slice(0, 16)

  const payload = {
    order_id: srOrderId,
    order_date: orderDate,
    pickup_location: input.pickup_location,
    comment: input.note ?? '',
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: input.customer_address ?? '',
    billing_city: input.customer_city,
    billing_pincode: input.customer_pincode,
    billing_state: input.customer_state,
    billing_country: 'India',
    billing_email: input.customer_email ?? '',
    billing_phone: input.customer_phone,
    shipping_is_billing: true,
    order_items: input.line_items.map((item) => ({
      name: item.name,
      sku: item.product_type || 'N/A',
      units: item.units,
      selling_price: item.selling_price,
      discount: item.discount,
      tax: 0,
    })),
    payment_method: input.payment_method,
    shipping_charges: input.shipping_charges,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: input.total_discount,
    sub_total: input.subtotal_price,
    length: input.length,
    breadth: input.breadth,
    height: input.height,
    weight: input.weight,
  }

  const res = await fetch(`${SR_BASE}/orders/create/adhoc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const json = await res.json()

  if (!res.ok) {
    console.error(`[Shiprocket] /orders/create/adhoc ${res.status}:`, JSON.stringify(json))
    return {
      success: false,
      error: json.message ?? `Shiprocket push failed: ${res.status}`,
    }
  }

  return {
    success: true,
    sr_order_id: json.order_id,
    shipment_id: json.shipment_id,
    status: json.status,
  }
}
