import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ExpenseRow {
  id: number
  function_name: string
  type: string | null
  particulars: string
  expense_date: string
  base_amount: number
  tax_amount: number
  total_amount: number
  remarks: string | null
  is_recurring: boolean
  created_at: string
}

/** Wrap a field in double quotes and escape internal double quotes. */
function csvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If the value contains a comma, double quote, or newline — wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvRow(row: ExpenseRow): string {
  return [
    csvField(row.expense_date),
    csvField(row.function_name),
    csvField(row.type),
    csvField(row.particulars),
    csvField(row.base_amount),
    csvField(row.tax_amount),
    csvField(row.total_amount),
    csvField(row.remarks),
    csvField(row.is_recurring ? 'Yes' : 'No'),
    csvField(row.created_at),
  ].join(',')
}

export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select(
        'id, function_name, type, particulars, expense_date, base_amount, tax_amount, total_amount, remarks, is_recurring, created_at'
      )
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = (data ?? []) as ExpenseRow[]

    const header = 'Date,Function,Type,Particulars,Base Amount,Tax Amount,Total Amount,Remarks,Recurring,Created At'
    const lines = [header, ...rows.map(buildCsvRow)]
    const csv = lines.join('\r\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="maeri_expenses.csv"',
      },
    })
  } catch (err) {
    console.error('[GET /api/expenses/export]', err)
    return NextResponse.json({ error: 'Failed to export expenses', details: err }, { status: 500 })
  }
}
