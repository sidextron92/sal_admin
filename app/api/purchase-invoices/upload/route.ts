import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Sanitize a filename: keep alphanumerics, dots, hyphens, underscores. Replace everything else with underscores. */
function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_+/g, '_')
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 })
  }

  // --- Type validation ---
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `File type not allowed. Accepted: PDF, JPEG, PNG, WEBP. Received: ${file.type}`,
      },
      { status: 400 }
    )
  }

  // --- Size validation ---
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds 10 MB limit (received ${(file.size / 1024 / 1024).toFixed(2)} MB)` },
      { status: 400 }
    )
  }

  // --- Build storage path ---
  const sanitizedName = sanitizeFilename(file.name)
  const filePath = `invoices/${Date.now()}-${sanitizedName}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[POST /api/purchase-invoices/upload] storage upload failed', uploadError)
      return NextResponse.json(
        { error: 'File upload failed', details: uploadError.message },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('documents').getPublicUrl(filePath)

    return NextResponse.json({ success: true, url: publicUrl, path: filePath })
  } catch (err) {
    console.error('[POST /api/purchase-invoices/upload]', err)
    return NextResponse.json(
      { error: 'Failed to process file upload', details: err },
      { status: 500 }
    )
  }
}
