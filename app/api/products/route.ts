import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const search      = (searchParams.get('search') ?? '').trim()
  const lowStock    = searchParams.get('low_stock') === 'true'
  const stockStatus = searchParams.get('stock_status') ?? ''
  const from        = (page - 1) * PAGE_SIZE

  try {
    // Query variants as the primary table, join product info
    let query = supabaseAdmin
      .from('product_variants')
      .select(
        `variant_id, title, price, sku, inventory_quantity,
         cost, virtual_inventory, physical_inventory, inventory_remark,
         products!inner ( product_id, title, image_url, vendor, product_type, status )`,
        { count: 'exact' }
      )
      .eq('products.status', 'ACTIVE')
      .order('products(title)', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (search) {
      query = query.ilike('products.title', `%${search}%`)
    }
    if (lowStock) {
      query = query.lt('inventory_quantity', 5).gt('inventory_quantity', 0)
    }
    if (stockStatus === 'in_stock') {
      query = query.gt('inventory_quantity', 0)
    } else if (stockStatus === 'out_of_stock') {
      query = query.lte('inventory_quantity', 0)
    }

    const { data, count, error } = await query
    if (error) throw error

    return NextResponse.json({ variants: data, total: count ?? 0, page, pageSize: PAGE_SIZE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
