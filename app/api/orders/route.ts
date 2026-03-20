import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const search = (searchParams.get('search') ?? '').trim()
  const status = searchParams.get('status') ?? ''       // sr_status
  const delay = searchParams.get('delay') ?? ''         // pickup_delay | delivery_delay
  const from = (page - 1) * PAGE_SIZE

  try {
    let query = supabaseAdmin
      .from('orders')
      .select(
        `order_id, order_name, created_at,
         customer_name, customer_email, customer_phone, customer_city, customer_state,
         total_price, currency, financial_status, fulfillment_status,
         sr_status, payment_method, awb_code, courier_name, etd, cancelled_at,
         customer_order_index, shipping_status,
         order_line_items ( title, quantity, discounted_unit_price, variant_title )`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (search) {
      query = query.or(
        `order_name.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      )
    }
    if (delay === 'pickup_delay') {
      const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      query = query
        .lt('created_at', cutoff)
        .or('sr_status.eq.NEW,sr_status.is.null')
        .is('cancelled_at', null)
    } else if (delay === 'delivery_delay') {
      const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
      query = query
        .lt('created_at', cutoff)
        .or('sr_status.ilike.PICKED UP%,sr_status.ilike.IN TRANSIT%,sr_status.ilike.UNDELIVERED%')
        .not('sr_status', 'ilike', 'RTO%')
        .neq('sr_status', 'CANCELED')
        .is('cancelled_at', null)
    } else if (status) {
      // Support prefix match for IN TRANSIT variants
      if (status === 'IN TRANSIT') {
        query = query.ilike('sr_status', 'IN TRANSIT%')
      } else {
        query = query.eq('sr_status', status)
      }
    }

    const { data, count, error } = await query
    if (error) throw error

    return NextResponse.json({ orders: data, total: count ?? 0, page, pageSize: PAGE_SIZE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
