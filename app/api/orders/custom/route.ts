import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { pushInventoryToShopify, fetchPrimaryLocationId } from '@/lib/shopify'
import { pushOrderToShiprocket, type ShiprocketPushResult } from '@/lib/shiprocket'

export const dynamic = 'force-dynamic'

interface LineItemInput {
  variant_id: string
  product_id: string
  product_title: string
  product_handle: string
  vendor: string
  product_type: string
  variant_title: string
  sku: string
  quantity: number
  original_unit_price: number
  discount_percent: number
}

interface RequestBody {
  channel: 'Offline' | 'Amazon'
  amazon_order_id?: string
  order_name: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_city: string
  customer_pincode: string
  customer_state: string
  customer_address?: string
  payment_method: 'Prepaid' | 'COD'
  fulfillment_status: 'FULFILLED' | 'UNFULFILLED'
  note?: string
  shipping_charges: number
  weight: number
  length: number
  breadth: number
  height: number
  line_items: LineItemInput[]
}

export async function POST(req: NextRequest) {
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // --- Validation ---
  if (!body.order_name?.trim()) {
    return NextResponse.json({ error: 'order_name is required' }, { status: 400 })
  }
  if (!body.customer_name?.trim()) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  }
  if (!body.customer_phone?.trim()) {
    return NextResponse.json({ error: 'customer_phone is required' }, { status: 400 })
  }
  if (!body.customer_city?.trim()) {
    return NextResponse.json({ error: 'customer_city is required' }, { status: 400 })
  }
  if (!body.customer_pincode?.trim() || !/^\d{6}$/.test(body.customer_pincode.trim())) {
    return NextResponse.json({ error: 'customer_pincode must be a 6-digit number' }, { status: 400 })
  }
  if (!body.customer_state?.trim()) {
    return NextResponse.json({ error: 'customer_state is required' }, { status: 400 })
  }
  if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
    return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
  }
  if (typeof body.shipping_charges !== 'number' || body.shipping_charges < 0) {
    return NextResponse.json({ error: 'shipping_charges must be >= 0' }, { status: 400 })
  }
  if (body.channel === 'Amazon' && !body.amazon_order_id?.trim()) {
    return NextResponse.json({ error: 'amazon_order_id is required for Amazon orders' }, { status: 400 })
  }
  if (typeof body.weight !== 'number' || body.weight <= 0) {
    return NextResponse.json({ error: 'weight must be > 0' }, { status: 400 })
  }


  for (let i = 0; i < body.line_items.length; i++) {
    const item = body.line_items[i]
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return NextResponse.json({ error: `line_items[${i}]: quantity must be >= 1` }, { status: 400 })
    }
    if (typeof item.discount_percent !== 'number' || item.discount_percent < 0 || item.discount_percent > 100) {
      return NextResponse.json({ error: `line_items[${i}]: discount_percent must be 0-100` }, { status: 400 })
    }
  }

  try {
    // --- Normalize order_name — always ensure # prefix ---
    const order_name = body.order_name.trim().startsWith('#')
      ? body.order_name.trim()
      : `#${body.order_name.trim()}`

    // --- ID Generation ---
    const suffix = Math.random().toString(36).slice(2, 7)
    const order_id = body.channel === 'Amazon'
      ? `AMZ-${Date.now()}-${suffix}`
      : `OFFLINE-${Date.now()}-${suffix}`

    // --- Financial Calculations ---
    const computedItems = body.line_items.map((item) => {
      const discounted_unit_price = item.original_unit_price * (1 - item.discount_percent / 100)
      const line_total = item.original_unit_price * item.quantity
      const line_total_discounted = discounted_unit_price * item.quantity
      const total_discount = (item.original_unit_price - discounted_unit_price) * item.quantity
      return { ...item, discounted_unit_price, line_total, line_total_discounted, total_discount }
    })

    const subtotal_price = computedItems.reduce((sum, c) => sum + c.line_total_discounted, 0)
    const total_price = subtotal_price + body.shipping_charges

    // --- Insert Order ---
    const now = new Date().toISOString()

    const orderRow = {
      order_id,
      order_name,
      created_at: now,
      updated_at: now,
      customer_id: null,
      total_price,
      subtotal_price,
      total_tax: 0,
      currency: 'INR',
      financial_status: body.payment_method === 'Prepaid' ? 'PAID' : 'PENDING',
      fulfillment_status: body.fulfillment_status,
      confirmed: true,
      cancelled_at: null,
      cancel_reason: null,
      tags: body.channel,
      sales_channel: body.channel,
      note: body.channel === 'Amazon' && body.amazon_order_id
        ? `[AMZ: ${body.amazon_order_id}]${body.note ? ' ' + body.note : ''}`
        : (body.note ?? null),
      line_items_count: body.line_items.length,
      sr_status: 'NEW',
      payment_method: body.payment_method === 'COD' ? 'cod' : 'prepaid',
      customer_name: body.customer_name,
      customer_email: body.customer_email ?? null,
      customer_phone: body.customer_phone,
      customer_city: body.customer_city,
      customer_pincode: body.customer_pincode,
      customer_state: body.customer_state,
      customer_address: body.customer_address ?? null,
      synced_at: now,
    }

    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderRow)

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // --- Insert Line Items ---
    const lineItemRows = computedItems.map((item, i) => ({
      line_item_id: `${order_id}-item-${i}`,
      order_id,
      title: item.variant_title
        ? `${item.product_title} - ${item.variant_title}`
        : item.product_title,
      quantity: item.quantity,
      original_unit_price: item.original_unit_price,
      discounted_unit_price: item.discounted_unit_price,
      total_discount: item.total_discount,
      currency: 'INR',
      line_total: item.line_total,
      line_total_discounted: item.line_total_discounted,
      product_id: item.product_id,
      product_title: item.product_title,
      product_handle: item.product_handle,
      vendor: item.vendor,
      product_type: item.product_type,
      variant_id: item.variant_id,
      variant_title: item.variant_title,
      sku: item.sku,
      synced_at: now,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_line_items')
      .insert(lineItemRows)

    if (itemsError) {
      // Roll back the order row to avoid orphaned order with no line items
      await supabaseAdmin.from('orders').delete().eq('order_id', order_id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // --- Inventory Deduction ---
    const inventoryItems: { inventory_item_id: string; quantity: number }[] = []
    const inventoryWarnings: string[] = []

    for (const item of computedItems) {
      const { data: variant } = await supabaseAdmin
        .from('product_variants')
        .select('physical_inventory, virtual_inventory, inventory_item_id')
        .eq('variant_id', item.variant_id)
        .single()

      if (!variant || !variant.inventory_item_id) {
        console.warn(`Skipping inventory deduction for variant ${item.variant_id}: no inventory_item_id`)
        continue
      }

      const physical = variant.physical_inventory ?? 0
      const virtual = variant.virtual_inventory ?? 0
      const qty = item.quantity

      const totalAvailable = physical + virtual
      if (qty > totalAvailable) {
        inventoryWarnings.push(
          `${item.product_title} (${item.variant_title}): ordered ${qty}, only ${totalAvailable} in stock`
        )
      }

      const new_physical = Math.max(0, physical - qty)
      const drained = physical - new_physical
      const remaining = qty - drained
      const new_virtual = Math.max(0, virtual - remaining)

      await supabaseAdmin
        .from('product_variants')
        .update({
          virtual_inventory: new_virtual,
          physical_inventory: new_physical,
          inventory_remark: `Order ${order_id}`,
          inventory_changed_by: 'order',
        })
        .eq('variant_id', item.variant_id)

      inventoryItems.push({
        inventory_item_id: variant.inventory_item_id,
        quantity: new_virtual + new_physical,
      })
    }

    // --- Shopify Write-back ---
    let shopify_push: { success: boolean; pushed: number; errors: string[] } = {
      success: true, pushed: 0, errors: [],
    }

    if (inventoryItems.length > 0) {
      try {
        const locationId = await fetchPrimaryLocationId()
        shopify_push = await pushInventoryToShopify(inventoryItems, locationId)
      } catch (err) {
        shopify_push = {
          success: false,
          pushed: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        }
      }
    }

    // --- Shiprocket Push ---
    const totalDiscount = computedItems.reduce((sum, c) => sum + c.total_discount, 0)

    let shiprocket_push: ShiprocketPushResult = { success: false, error: 'not attempted' }
    console.log(`[Shiprocket] Pushing order ${order_name} (${order_id}) to Shiprocket...`)
    try {
      shiprocket_push = await pushOrderToShiprocket({
        order_name,
        order_date: now,
        pickup_location: 'Delhi Warehouse EOK',
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        customer_email: body.customer_email,
        customer_address: body.customer_address,
        customer_city: body.customer_city,
        customer_pincode: body.customer_pincode,
        customer_state: body.customer_state,
        payment_method: body.payment_method,
        shipping_charges: body.shipping_charges,
        subtotal_price,
        total_discount: totalDiscount,
        note: body.channel === 'Amazon' && body.amazon_order_id
          ? `[AMZ: ${body.amazon_order_id}]${body.note ? ' ' + body.note : ''}`
          : body.note,
        line_items: computedItems.map((item) => ({
          name: item.variant_title
            ? `${item.product_title} - ${item.variant_title}`
            : item.product_title,
          product_type: item.product_type,
          units: item.quantity,
          selling_price: item.discounted_unit_price,
          discount: item.total_discount,
        })),
        weight: body.weight,
        length: body.length,
        breadth: body.breadth,
        height: body.height,
      })

      if (shiprocket_push.success && shiprocket_push.sr_order_id) {
        console.log(`[Shiprocket] ✓ Order pushed — sr_order_id: ${shiprocket_push.sr_order_id}, status: ${shiprocket_push.status}`)
        await supabaseAdmin
          .from('orders')
          .update({ sr_order_id: shiprocket_push.sr_order_id, sr_status: shiprocket_push.status ?? 'NEW' })
          .eq('order_id', order_id)
      } else {
        console.error(`[Shiprocket] ✗ Push failed for ${order_name}:`, shiprocket_push.error)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[Shiprocket] ✗ Exception pushing ${order_name}:`, errMsg)
      shiprocket_push = { success: false, error: errMsg }
    }

    return NextResponse.json({ success: true, order_id, shopify_push, shiprocket_push, inventory_warnings: inventoryWarnings })
  } catch (err) {
    console.error('Custom order creation failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
