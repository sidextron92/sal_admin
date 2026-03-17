import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params

  let body: { cost: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const cost = Number(body.cost)
  if (isNaN(cost) || cost < 0) {
    return NextResponse.json({ error: 'cost must be a non-negative number' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('product_variants')
    .update({ cost })
    .eq('variant_id', variantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
