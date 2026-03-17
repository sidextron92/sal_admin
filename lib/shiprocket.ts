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
  customer_state: string | null
  // shipment
  sr_order_id: number | null
  sr_status: string | null
  payment_method: string | null
  awb_code: string | null
  courier_name: string | null
  etd: string | null          // ISO string or null
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
        customer_state: o.customer_state || null,
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
