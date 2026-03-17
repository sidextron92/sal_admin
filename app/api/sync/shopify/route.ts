import { NextResponse } from 'next/server'
import { fetchOrders } from '@/lib/shopify'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds (Vercel hobby: 60s)

export async function POST() {
  const startedAt = Date.now()

  try {
    // 1. Fetch from Shopify
    const { orders, lineItems } = await fetchOrders(250)

    if (orders.length === 0) {
      return NextResponse.json({ success: true, message: 'No orders found', orders: 0, items: 0 })
    }

    // 2. Upsert orders (merge on primary key)
    const { error: ordersError } = await supabaseAdmin
      .from('orders')
      .upsert(
        orders.map((o) => ({ ...o, synced_at: new Date().toISOString() })),
        { onConflict: 'order_id' }
      )

    if (ordersError) throw new Error(`Orders upsert failed: ${ordersError.message}`)

    // 3. Upsert line items in batches of 500
    const BATCH = 500
    for (let i = 0; i < lineItems.length; i += BATCH) {
      const batch = lineItems.slice(i, i + BATCH)
      const { error: itemsError } = await supabaseAdmin
        .from('order_line_items')
        .upsert(
          batch.map((li) => ({ ...li, synced_at: new Date().toISOString() })),
          { onConflict: 'line_item_id' }
        )
      if (itemsError) throw new Error(`Line items upsert failed (batch ${i}): ${itemsError.message}`)
    }

    const durationMs = Date.now() - startedAt

    // 4. Log the sync run
    await supabaseAdmin.from('sync_log').insert({
      orders_upserted: orders.length,
      items_upserted: lineItems.length,
      status: 'success',
      duration_ms: durationMs,
      platform: 'shopify',
      type: 'orders',
    })

    return NextResponse.json({
      success: true,
      orders: orders.length,
      items: lineItems.length,
      duration_ms: durationMs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - startedAt

    // Log the failure
    try {
      await supabaseAdmin
        .from('sync_log')
        .insert({ status: 'error', error_message: message, duration_ms: durationMs, platform: 'shopify', type: 'orders' })
    } catch {} // don't throw if logging itself fails

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// GET: returns last sync logs, optionally filtered by platform and type
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  const type     = searchParams.get('type')

  let query = supabaseAdmin
    .from('sync_log')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(10)

  if (platform) query = query.eq('platform', platform)
  if (type)     query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data })
}
