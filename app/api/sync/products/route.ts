import { NextResponse } from 'next/server'
import { fetchProducts } from '@/lib/shopify'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const startedAt = Date.now()

  try {
    const { products, variants } = await fetchProducts()

    if (products.length === 0) {
      return NextResponse.json({ success: true, message: 'No products found', products: 0, variants: 0 })
    }

    // Upsert products
    const { error: productsError } = await supabaseAdmin
      .from('products')
      .upsert(
        products.map((p) => ({ ...p, synced_at: new Date().toISOString() })),
        { onConflict: 'product_id' }
      )
    if (productsError) throw new Error(`Products upsert failed: ${productsError.message}`)

    // Upsert variants in batches of 500
    const BATCH = 500
    for (let i = 0; i < variants.length; i += BATCH) {
      const batch = variants.slice(i, i + BATCH)
      const { error: variantsError } = await supabaseAdmin
        .from('product_variants')
        .upsert(
          batch.map((v) => ({ ...v, synced_at: new Date().toISOString() })),
          { onConflict: 'variant_id' }
        )
      if (variantsError) throw new Error(`Variants upsert failed (batch ${i}): ${variantsError.message}`)
    }

    const durationMs = Date.now() - startedAt

    try {
      await supabaseAdmin.from('sync_log').insert({
        orders_upserted: products.length,
        items_upserted: variants.length,
        status: 'success',
        duration_ms: durationMs,
        platform: 'shopify',
        type: 'inventory',
      })
    } catch {}

    return NextResponse.json({
      success: true,
      products: products.length,
      variants: variants.length,
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
        platform: 'shopify',
        type: 'inventory',
      })
    } catch {}
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
