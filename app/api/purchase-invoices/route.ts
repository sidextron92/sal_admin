import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

interface PurchaseInvoice {
  id: number
  invoice_number: string
  invoice_date: string
  vendor_name: string
  vendor_gst: string | null
  total_amount: number
  total_gst: number
  payment_date: string | null
  payment_status: 'PAID' | 'UNPAID'
  document_url: string | null
  document_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface PostBody {
  invoice_number: string
  invoice_date: string
  vendor_name: string
  vendor_gst?: string
  total_amount: number
  total_gst?: number
  payment_date?: string
  document_url?: string
  document_path?: string
  notes?: string
}

function isValidDate(s: string): boolean {
  const d = new Date(s)
  return !isNaN(d.getTime())
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const search = (searchParams.get('search') ?? '').trim()
  const vendor = (searchParams.get('vendor') ?? '').trim()
  const paymentStatus = (searchParams.get('payment_status') ?? '').trim().toUpperCase()
  const dateFrom = (searchParams.get('date_from') ?? '').trim()
  const dateTo = (searchParams.get('date_to') ?? '').trim()
  const from = (page - 1) * PAGE_SIZE

  try {
    // --- List query ---
    let listQuery = supabaseAdmin
      .from('purchase_invoices')
      .select('*', { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (search) {
      listQuery = listQuery.or(
        `vendor_name.ilike.%${search}%,invoice_number.ilike.%${search}%`
      )
    }
    if (vendor) {
      listQuery = listQuery.eq('vendor_name', vendor)
    }
    if (paymentStatus === 'PAID' || paymentStatus === 'UNPAID') {
      listQuery = listQuery.eq('payment_status', paymentStatus)
    }
    if (dateFrom) {
      listQuery = listQuery.gte('invoice_date', dateFrom)
    }
    if (dateTo) {
      listQuery = listQuery.lte('invoice_date', dateTo)
    }

    const { data: invoices, count, error: listError } = await listQuery
    if (listError) throw listError

    // --- Summary query (same filters, no pagination) ---
    let summaryQuery = supabaseAdmin
      .from('purchase_invoices')
      .select('total_amount, total_gst, payment_status')

    if (search) {
      summaryQuery = summaryQuery.or(
        `vendor_name.ilike.%${search}%,invoice_number.ilike.%${search}%`
      )
    }
    if (vendor) {
      summaryQuery = summaryQuery.eq('vendor_name', vendor)
    }
    if (paymentStatus === 'PAID' || paymentStatus === 'UNPAID') {
      summaryQuery = summaryQuery.eq('payment_status', paymentStatus)
    }
    if (dateFrom) {
      summaryQuery = summaryQuery.gte('invoice_date', dateFrom)
    }
    if (dateTo) {
      summaryQuery = summaryQuery.lte('invoice_date', dateTo)
    }

    const { data: summaryRows, error: summaryError } = await summaryQuery
    if (summaryError) throw summaryError

    let totalInvoicesAmount = 0
    let totalGstAmount = 0
    let paidCount = 0
    let unpaidCount = 0

    for (const row of summaryRows ?? []) {
      totalInvoicesAmount += Number(row.total_amount)
      totalGstAmount += Number(row.total_gst)
      if (row.payment_status === 'PAID') {
        paidCount++
      } else {
        unpaidCount++
      }
    }

    return NextResponse.json({
      invoices: invoices as PurchaseInvoice[],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      summary: {
        total_invoices_amount: Math.round(totalInvoicesAmount * 100) / 100,
        total_gst_amount: Math.round(totalGstAmount * 100) / 100,
        paid_count: paidCount,
        unpaid_count: unpaidCount,
      },
    })
  } catch (err) {
    console.error('[GET /api/purchase-invoices]', err)
    return NextResponse.json(
      { error: 'Failed to fetch purchase invoices', details: err },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  let body: PostBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // --- Validation ---
  if (!body.invoice_number?.trim()) {
    return NextResponse.json({ error: 'invoice_number is required' }, { status: 400 })
  }
  if (!body.invoice_date || !isValidDate(body.invoice_date)) {
    return NextResponse.json(
      { error: 'invoice_date must be a valid ISO date' },
      { status: 400 }
    )
  }
  if (!body.vendor_name?.trim()) {
    return NextResponse.json({ error: 'vendor_name is required' }, { status: 400 })
  }
  if (typeof body.total_amount !== 'number' || body.total_amount < 0) {
    return NextResponse.json(
      { error: 'total_amount must be a number >= 0' },
      { status: 400 }
    )
  }
  const totalGst = body.total_gst ?? 0
  if (typeof totalGst !== 'number' || totalGst < 0) {
    return NextResponse.json({ error: 'total_gst must be a number >= 0' }, { status: 400 })
  }
  if (body.payment_date != null && !isValidDate(body.payment_date)) {
    return NextResponse.json(
      { error: 'payment_date must be a valid ISO date' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_invoices')
      .insert({
        invoice_number: body.invoice_number.trim(),
        invoice_date: body.invoice_date,
        vendor_name: body.vendor_name.trim(),
        vendor_gst: body.vendor_gst?.trim() || null,
        total_amount: body.total_amount,
        total_gst: totalGst,
        payment_date: body.payment_date ?? null,
        document_url: body.document_url?.trim() || null,
        document_path: body.document_path?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { success: true, invoice: data as PurchaseInvoice },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/purchase-invoices]', err)
    return NextResponse.json(
      { error: 'Failed to create purchase invoice', details: err },
      { status: 500 }
    )
  }
}
