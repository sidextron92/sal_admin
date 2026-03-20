import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

const VALID_FUNCTIONS = [
  'MARKETING',
  'EMPLOYEE',
  'LOGISTIC',
  'PACKAGING',
  'SOFTWARE',
  'PAYMENT_GATEWAY',
  'MISCELLANEOUS',
] as const

type FunctionName = (typeof VALID_FUNCTIONS)[number]

interface Expense {
  id: number
  function_name: FunctionName
  type: string | null
  particulars: string
  expense_date: string
  base_amount: number
  tax_amount: number
  total_amount: number
  remarks: string | null
  is_recurring: boolean
  created_at: string
  updated_at: string
}

interface PostBody {
  function_name: string
  type?: string
  particulars: string
  expense_date: string
  base_amount: number
  tax_amount?: number
  remarks?: string
  is_recurring: boolean
}

function isValidDate(s: string): boolean {
  const d = new Date(s)
  return !isNaN(d.getTime())
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const search = (searchParams.get('search') ?? '').trim()
  const functionFilter = (searchParams.get('function') ?? '').trim()
  const typeFilter = (searchParams.get('type') ?? '').trim()
  const dateFrom = (searchParams.get('date_from') ?? '').trim()
  const dateTo = (searchParams.get('date_to') ?? '').trim()
  const from = (page - 1) * PAGE_SIZE

  try {
    // --- List query ---
    let listQuery = supabaseAdmin
      .from('expenses')
      .select('*', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (search) {
      listQuery = listQuery.or(
        `particulars.ilike.%${search}%,remarks.ilike.%${search}%`
      )
    }
    if (functionFilter) {
      listQuery = listQuery.eq('function_name', functionFilter)
    }
    if (typeFilter) {
      listQuery = listQuery.ilike('type', `%${typeFilter}%`)
    }
    if (dateFrom) {
      listQuery = listQuery.gte('expense_date', dateFrom)
    }
    if (dateTo) {
      listQuery = listQuery.lte('expense_date', dateTo)
    }

    const { data: expenses, count, error: listError } = await listQuery
    if (listError) throw listError

    // --- Summary query (same filters, no pagination) ---
    let summaryQuery = supabaseAdmin
      .from('expenses')
      .select('function_name, base_amount, tax_amount, total_amount')

    if (search) {
      summaryQuery = summaryQuery.or(
        `particulars.ilike.%${search}%,remarks.ilike.%${search}%`
      )
    }
    if (functionFilter) {
      summaryQuery = summaryQuery.eq('function_name', functionFilter)
    }
    if (typeFilter) {
      summaryQuery = summaryQuery.ilike('type', `%${typeFilter}%`)
    }
    if (dateFrom) {
      summaryQuery = summaryQuery.gte('expense_date', dateFrom)
    }
    if (dateTo) {
      summaryQuery = summaryQuery.lte('expense_date', dateTo)
    }

    const { data: summaryRows, error: summaryError } = await summaryQuery
    if (summaryError) throw summaryError

    // Aggregate summary in-process
    let totalBase = 0
    let totalTax = 0
    let totalAmount = 0
    const byFunctionMap = new Map<string, { total_amount: number; count: number }>()

    for (const row of summaryRows ?? []) {
      totalBase += Number(row.base_amount)
      totalTax += Number(row.tax_amount)
      totalAmount += Number(row.total_amount)

      const fn = row.function_name as string
      const existing = byFunctionMap.get(fn) ?? { total_amount: 0, count: 0 }
      byFunctionMap.set(fn, {
        total_amount: existing.total_amount + Number(row.total_amount),
        count: existing.count + 1,
      })
    }

    const byFunction = Array.from(byFunctionMap.entries()).map(([function_name, agg]) => ({
      function_name,
      total_amount: Math.round(agg.total_amount * 100) / 100,
      count: agg.count,
    }))

    return NextResponse.json({
      expenses: expenses as Expense[],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      summary: {
        total_base: Math.round(totalBase * 100) / 100,
        total_tax: Math.round(totalTax * 100) / 100,
        total_amount: Math.round(totalAmount * 100) / 100,
        by_function: byFunction,
      },
    })
  } catch (err) {
    console.error('[GET /api/expenses]', err)
    return NextResponse.json({ error: 'Failed to fetch expenses', details: err }, { status: 500 })
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
  if (!body.function_name || !(VALID_FUNCTIONS as readonly string[]).includes(body.function_name)) {
    return NextResponse.json(
      {
        error: `function_name must be one of: ${VALID_FUNCTIONS.join(', ')}`,
      },
      { status: 400 }
    )
  }
  if (!body.particulars?.trim()) {
    return NextResponse.json({ error: 'particulars is required' }, { status: 400 })
  }
  if (!body.expense_date || !isValidDate(body.expense_date)) {
    return NextResponse.json({ error: 'expense_date must be a valid ISO date' }, { status: 400 })
  }
  if (typeof body.base_amount !== 'number' || body.base_amount < 0) {
    return NextResponse.json({ error: 'base_amount must be a number >= 0' }, { status: 400 })
  }
  const taxAmount = body.tax_amount ?? 0
  if (typeof taxAmount !== 'number' || taxAmount < 0) {
    return NextResponse.json({ error: 'tax_amount must be a number >= 0' }, { status: 400 })
  }
  if (typeof body.is_recurring !== 'boolean') {
    return NextResponse.json({ error: 'is_recurring must be a boolean' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert({
        function_name: body.function_name,
        type: body.type?.trim() || null,
        particulars: body.particulars.trim(),
        expense_date: body.expense_date,
        base_amount: body.base_amount,
        tax_amount: taxAmount,
        remarks: body.remarks?.trim() || null,
        is_recurring: body.is_recurring,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, expense: data as Expense }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/expenses]', err)
    return NextResponse.json({ error: 'Failed to create expense', details: err }, { status: 500 })
  }
}
