import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchPrimaryLocationId, pushInventoryToShopify } from '@/lib/shopify'

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

  // Push updated total to Shopify. DB trigger sets inventory_quantity = virtual + physical.
  // We compute it directly here to avoid an extra SELECT.
  const new_quantity = virtual_inventory + physical_inventory

  let shopify_push: { success: boolean; pushed: number; errors: string[] } | null = null

  try {
    // Fetch inventory_item_id for this variant
    const { data: variant } = await supabaseAdmin
      .from('product_variants')
      .select('inventory_item_id')
      .eq('variant_id', variantId)
      .single()

    if (variant?.inventory_item_id) {
      const locationId = await fetchPrimaryLocationId()
      shopify_push = await pushInventoryToShopify(
        [{ inventory_item_id: variant.inventory_item_id, quantity: new_quantity }],
        locationId,
      )
    }
  } catch (shopifyErr) {
    // Shopify push failure is non-fatal — local DB is already updated
    shopify_push = {
      success: false,
      pushed: 0,
      errors: [shopifyErr instanceof Error ? shopifyErr.message : String(shopifyErr)],
    }
  }

  return NextResponse.json({ success: true, shopify_push })
}
