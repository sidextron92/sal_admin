import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_FUNCTIONS = [
  'MARKETING',
  'EMPLOYEE',
  'LOGISTIC',
  'PACKAGING',
  'SOFTWARE',
  'PAYMENT_GATEWAY',
  'MISCELLANEOUS',
] as const

interface PatchBody {
  function_name?: string
  type?: string | null
  particulars?: string
  expense_date?: string
  base_amount?: number
  tax_amount?: number
  remarks?: string | null
  is_recurring?: boolean
}

function isValidDate(s: string): boolean {
  const d = new Date(s)
  return !isNaN(d.getTime())
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const id = parseInt(idParam)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // --- Validation of provided fields ---
  if (
    body.function_name !== undefined &&
    !(VALID_FUNCTIONS as readonly string[]).includes(body.function_name)
  ) {
    return NextResponse.json(
      {
        error: `function_name must be one of: ${VALID_FUNCTIONS.join(', ')}`,
      },
      { status: 400 }
    )
  }
  if (body.particulars !== undefined && !body.particulars.trim()) {
    return NextResponse.json({ error: 'particulars cannot be empty' }, { status: 400 })
  }
  if (body.expense_date !== undefined && !isValidDate(body.expense_date)) {
    return NextResponse.json({ error: 'expense_date must be a valid ISO date' }, { status: 400 })
  }
  if (
    body.base_amount !== undefined &&
    (typeof body.base_amount !== 'number' || body.base_amount < 0)
  ) {
    return NextResponse.json({ error: 'base_amount must be a number >= 0' }, { status: 400 })
  }
  if (
    body.tax_amount !== undefined &&
    (typeof body.tax_amount !== 'number' || body.tax_amount < 0)
  ) {
    return NextResponse.json({ error: 'tax_amount must be a number >= 0' }, { status: 400 })
  }
  if (body.is_recurring !== undefined && typeof body.is_recurring !== 'boolean') {
    return NextResponse.json({ error: 'is_recurring must be a boolean' }, { status: 400 })
  }

  // Build update payload — only include fields present in body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.function_name !== undefined) updates.function_name = body.function_name
  if (body.type !== undefined) updates.type = body.type?.trim() || null
  if (body.particulars !== undefined) updates.particulars = body.particulars.trim()
  if (body.expense_date !== undefined) updates.expense_date = body.expense_date
  if (body.base_amount !== undefined) updates.base_amount = body.base_amount
  if (body.tax_amount !== undefined) updates.tax_amount = body.tax_amount
  if (body.remarks !== undefined) updates.remarks = body.remarks?.trim() || null
  if (body.is_recurring !== undefined) updates.is_recurring = body.is_recurring

  try {
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // PGRST116: no rows returned — record not found
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ success: true, expense: data })
  } catch (err) {
    console.error('[PATCH /api/expenses/[id]]', err)
    return NextResponse.json({ error: 'Failed to update expense', details: err }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const id = parseInt(idParam)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 })
  }

  try {
    // Check existence first so we can return a proper 404
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError?.code === 'PGRST116' || !existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    if (fetchError) throw fetchError

    const { error: deleteError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/expenses/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete expense', details: err }, { status: 500 })
  }
}
