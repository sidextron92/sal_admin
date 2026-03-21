import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface PatchBody {
  invoice_number?: string
  invoice_date?: string
  vendor_name?: string
  vendor_gst?: string | null
  total_amount?: number
  total_gst?: number
  payment_date?: string | null
  document_url?: string | null
  document_path?: string | null
  notes?: string | null
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
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // --- Validation of provided fields ---
  if (body.invoice_number !== undefined && !body.invoice_number.trim()) {
    return NextResponse.json({ error: 'invoice_number cannot be empty' }, { status: 400 })
  }
  if (body.invoice_date !== undefined && !isValidDate(body.invoice_date)) {
    return NextResponse.json(
      { error: 'invoice_date must be a valid ISO date' },
      { status: 400 }
    )
  }
  if (body.vendor_name !== undefined && !body.vendor_name.trim()) {
    return NextResponse.json({ error: 'vendor_name cannot be empty' }, { status: 400 })
  }
  if (
    body.total_amount !== undefined &&
    (typeof body.total_amount !== 'number' || body.total_amount < 0)
  ) {
    return NextResponse.json(
      { error: 'total_amount must be a number >= 0' },
      { status: 400 }
    )
  }
  if (
    body.total_gst !== undefined &&
    (typeof body.total_gst !== 'number' || body.total_gst < 0)
  ) {
    return NextResponse.json({ error: 'total_gst must be a number >= 0' }, { status: 400 })
  }
  if (body.payment_date !== undefined && body.payment_date !== null) {
    if (!isValidDate(body.payment_date)) {
      return NextResponse.json(
        { error: 'payment_date must be a valid ISO date' },
        { status: 400 }
      )
    }
  }

  // Build update payload — only include fields present in body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.invoice_number !== undefined) updates.invoice_number = body.invoice_number.trim()
  if (body.invoice_date !== undefined) updates.invoice_date = body.invoice_date
  if (body.vendor_name !== undefined) updates.vendor_name = body.vendor_name.trim()
  if (body.vendor_gst !== undefined) updates.vendor_gst = body.vendor_gst?.trim() || null
  if (body.total_amount !== undefined) updates.total_amount = body.total_amount
  if (body.total_gst !== undefined) updates.total_gst = body.total_gst
  // payment_date drives the generated payment_status column — null = UNPAID, date = PAID
  if ('payment_date' in body) updates.payment_date = body.payment_date ?? null
  if (body.document_url !== undefined) updates.document_url = body.document_url?.trim() || null
  if (body.document_path !== undefined) updates.document_path = body.document_path?.trim() || null
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null

  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ success: true, invoice: data })
  } catch (err) {
    console.error('[PATCH /api/purchase-invoices/[id]]', err)
    return NextResponse.json(
      { error: 'Failed to update purchase invoice', details: err },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params
  const id = parseInt(idParam)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 })
  }

  try {
    // Fetch first — need document_path for storage cleanup + 404 guard
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('purchase_invoices')
      .select('id, document_path')
      .eq('id', id)
      .single()

    if (fetchError?.code === 'PGRST116' || !existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (fetchError) throw fetchError

    // Delete from storage if a file is attached
    if (existing.document_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .remove([existing.document_path])

      if (storageError) {
        // Non-fatal: log but proceed with DB delete
        console.error('[DELETE /api/purchase-invoices/[id]] storage removal failed', storageError)
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('purchase_invoices')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/purchase-invoices/[id]]', err)
    return NextResponse.json(
      { error: 'Failed to delete purchase invoice', details: err },
      { status: 500 }
    )
  }
}
