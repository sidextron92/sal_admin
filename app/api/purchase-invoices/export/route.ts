import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface InvoiceRow {
  invoice_number: string
  invoice_date: string
  vendor_name: string
  vendor_gst: string | null
  total_amount: number
  total_gst: number
  payment_date: string | null
  payment_status: string
  notes: string | null
  created_at: string
}

/** Wrap a field in double quotes and escape internal double quotes. */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvRow(row: InvoiceRow): string {
  return [
    csvField(row.invoice_number),
    csvField(row.invoice_date),
    csvField(row.vendor_name),
    csvField(row.vendor_gst),
    csvField(row.total_amount),
    csvField(row.total_gst),
    csvField(row.payment_date),
    csvField(row.payment_status),
    csvField(row.notes),
    csvField(row.created_at),
  ].join(',')
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const search = (searchParams.get('search') ?? '').trim()
  const vendor = (searchParams.get('vendor') ?? '').trim()
  const paymentStatus = (searchParams.get('payment_status') ?? '').trim().toUpperCase()
  const dateFrom = (searchParams.get('date_from') ?? '').trim()
  const dateTo = (searchParams.get('date_to') ?? '').trim()

  try {
    let query = supabaseAdmin
      .from('purchase_invoices')
      .select(
        'invoice_number, invoice_date, vendor_name, vendor_gst, total_amount, total_gst, payment_date, payment_status, notes, created_at'
      )
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`vendor_name.ilike.%${search}%,invoice_number.ilike.%${search}%`)
    }
    if (vendor) {
      query = query.eq('vendor_name', vendor)
    }
    if (paymentStatus === 'PAID' || paymentStatus === 'UNPAID') {
      query = query.eq('payment_status', paymentStatus)
    }
    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('invoice_date', dateTo)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as InvoiceRow[]

    const header =
      'Invoice Number,Invoice Date,Vendor Name,Vendor GST,Total Amount,Total GST,Payment Date,Payment Status,Notes,Created At'
    const lines = [header, ...rows.map(buildCsvRow)]
    const csv = lines.join('\r\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="maeri_purchase_invoices.csv"',
      },
    })
  } catch (err) {
    console.error('[GET /api/purchase-invoices/export]', err)
    return NextResponse.json(
      { error: 'Failed to export purchase invoices', details: err },
      { status: 500 }
    )
  }
}
