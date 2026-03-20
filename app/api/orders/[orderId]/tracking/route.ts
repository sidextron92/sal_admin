import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const { data, error } = await supabaseAdmin
    .from('order_tracking_logs')
    .select(
      `id, system_status, partner_status, awb_no, event_timestamp, received_at,
       shipping_partners ( name, slug )`
    )
    .eq('order_id', orderId)
    .order('received_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const logs = (data ?? []).map((row) => ({
    id:             row.id,
    system_status:  row.system_status,
    partner_status: row.partner_status,
    awb_no:         row.awb_no,
    event_timestamp: row.event_timestamp,
    received_at:    row.received_at,
    partner_name:   (row.shipping_partners as unknown as { name: string } | null)?.name ?? null,
  }))

  return NextResponse.json({ logs })
}
