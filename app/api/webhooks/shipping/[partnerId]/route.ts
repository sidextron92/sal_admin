import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Parse Shiprocket's "DD MM YYYY HH:MM:SS" format → ISO string
function extractShiprocket(body: Record<string, unknown>) {
  let event_timestamp: string | null = null
  if (body.current_timestamp) {
    const parts = (body.current_timestamp as string).split(' ')
    // e.g. "23 05 2023 11:43:52" → "2023-05-23T11:43:52Z"
    if (parts.length >= 4) {
      const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${parts[3]}Z`
      const d = new Date(iso)
      if (!isNaN(d.getTime())) event_timestamp = d.toISOString()
    }
  }
  return {
    awb_no:         (body.awb as string) ?? null,
    partner_status: (body.current_status as string) ?? null,
    event_timestamp,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await params
  const partnerIdNum = parseInt(partnerId, 10)
  if (isNaN(partnerIdNum)) {
    return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 })
  }

  // 1. Look up partner
  const { data: partner, error: partnerErr } = await supabaseAdmin
    .from('shipping_partners')
    .select('id, slug, status, webhook_secret')
    .eq('id', partnerIdNum)
    .single()

  if (partnerErr || !partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  }
  if (partner.status !== 'active') {
    return NextResponse.json({ error: 'Partner inactive' }, { status: 404 })
  }

  // 2. Verify auth token if partner has a webhook_secret configured
  if (partner.webhook_secret) {
    const token = req.headers.get('x-api-key')
    if (token !== partner.webhook_secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // 3. Parse body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. Extract fields (Shiprocket extractor — extend per-partner as needed)
  const { awb_no, partner_status, event_timestamp } = extractShiprocket(body)

  // 5. Look up system_status mapping (case-insensitive — Shiprocket sends UPPERCASE
  //    but mapper may have Title Case entries e.g. "In Transit" vs "IN TRANSIT")
  let system_status: string | null = null
  if (partner_status) {
    const { data: mapping } = await supabaseAdmin
      .from('status_mapper')
      .select('system_status')
      .eq('shipping_partner_id', partnerIdNum)
      .ilike('partner_status', partner_status)
      .maybeSingle()
    system_status = mapping?.system_status ?? null
  }

  // 6. Find matching order by AWB
  let order_id: string | null = null
  if (awb_no) {
    const { data: orderRow } = await supabaseAdmin
      .from('orders')
      .select('order_id')
      .eq('awb_code', awb_no)
      .single()
    order_id = orderRow?.order_id ?? null
  }

  // 7. Insert tracking log (always — even for orphan events)
  await supabaseAdmin.from('order_tracking_logs').insert({
    order_id,
    shipping_partner_id: partnerIdNum,
    awb_no,
    system_status,
    partner_status,
    partner_payload: body,
    event_timestamp,
  })

  // 8. Update orders.shipping_status if order found and status mapped
  if (order_id && system_status) {
    await supabaseAdmin
      .from('orders')
      .update({ shipping_status: system_status, shipping_partner_id: partnerIdNum })
      .eq('order_id', order_id)
  }

  // Always return 200 — Shiprocket retries on non-2xx
  return NextResponse.json({ received: true })
}
