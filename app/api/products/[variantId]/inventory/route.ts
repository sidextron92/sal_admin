import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params

  let body: { virtual_inventory: number; physical_inventory: number; remark?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const virtual_inventory  = Number(body.virtual_inventory)
  const physical_inventory = Number(body.physical_inventory)

  if (!Number.isInteger(virtual_inventory) || virtual_inventory < 0) {
    return NextResponse.json({ error: 'virtual_inventory must be a non-negative integer' }, { status: 400 })
  }
  if (!Number.isInteger(physical_inventory) || physical_inventory < 0) {
    return NextResponse.json({ error: 'physical_inventory must be a non-negative integer' }, { status: 400 })
  }

  const remark = (body.remark ?? '').trim().slice(0, 500) || null

  const { error } = await supabaseAdmin
    .from('product_variants')
    .update({
      virtual_inventory,
      physical_inventory,
      inventory_remark: remark,
      inventory_changed_by: 'admin',
    })
    .eq('variant_id', variantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
