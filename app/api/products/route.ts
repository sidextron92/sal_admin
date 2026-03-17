import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 40

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const search      = (searchParams.get('search') ?? '').trim()
  const lowStock    = searchParams.get('low_stock') === 'true'
  const stockStatus = searchParams.get('stock_status') ?? '' // 'in_stock' | 'out_of_stock'
  const from = (page - 1) * PAGE_SIZE

  try {
    let query = supabaseAdmin
      .from('products')
      .select(
        `product_id, title, handle, vendor, product_type, tags, status,
         total_inventory, total_variants, image_url, synced_at,
         product_variants ( variant_id, title, price, sku, inventory_quantity )`,
        { count: 'exact' }
      )
      .eq('status', 'ACTIVE')
      .order('title', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (search) {
      query = query.ilike('title', `%${search}%`)
    }
    if (lowStock) {
      query = query.lt('total_inventory', 5)
    }
    if (stockStatus === 'in_stock') {
      query = query.gt('total_inventory', 0)
    } else if (stockStatus === 'out_of_stock') {
      query = query.eq('total_inventory', 0)
    }

    const { data, count, error } = await query
    if (error) throw error

    return NextResponse.json({ products: data, total: count ?? 0, page, pageSize: PAGE_SIZE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
