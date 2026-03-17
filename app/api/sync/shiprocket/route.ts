import { NextResponse } from 'next/server'
import { fetchShiprocketOrders } from '@/lib/shiprocket'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const startedAt = Date.now()

  try {
    const rows = await fetchShiprocketOrders()

    if (rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No orders found', updated: 0 })
    }

    // Update each order by matching order_name
    let updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const { order_name, ...fields } = row
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ ...fields, synced_at: new Date().toISOString() })
        .eq('order_name', order_name)

      if (error) {
        errors.push(`${order_name}: ${error.message}`)
      } else {
        updated++
      }
    }

    const durationMs = Date.now() - startedAt

    if (errors.length > 0 && updated === 0) {
      throw new Error(errors.slice(0, 3).join('; '))
    }

    try {
      await supabaseAdmin.from('sync_log').insert({
        orders_upserted: updated,
        status: 'success',
        duration_ms: durationMs,
        platform: 'shiprocket',
        type: 'orders',
      })
    } catch {}

    return NextResponse.json({
      success: true,
      fetched: rows.length,
      updated,
      duration_ms: durationMs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - startedAt
    try {
      await supabaseAdmin.from('sync_log').insert({
        status: 'error',
        error_message: message,
        duration_ms: durationMs,
        platform: 'shiprocket',
        type: 'orders',
      })
    } catch {}
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
