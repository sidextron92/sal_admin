import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import ExcelJS from 'exceljs'
import { fetchPrimaryLocationId, pushInventoryToShopify } from '@/lib/shopify'

export const dynamic = 'force-dynamic'

// Column indices (1-based) — must stay in sync with download route
// A=1 variant_id, B=2 product_title, C=3 image, D=4 status,
// E=5 current_cost, F=6 current_sale, G=7 current_virtual,
// H=8 current_physical, I=9 current_total,
// J=10 updatedCostPrice, K=11 updatedVirtualInventory, L=12 updatedPhysicalInventory,
// M=13 totalInventory (formula), N=14 remarks, O=15 validationError (formula — not read on upload)
const C_VARIANT_ID   = 1
const C_UPDATED_COST = 10
const C_UPDATED_VIRT = 11
const C_UPDATED_PHYS = 12
const C_REMARKS      = 14

function cellValue(row: ExcelJS.Row, col: number): string {
  const cell = row.getCell(col)
  const v = cell.value
  if (v === null || v === undefined) return ''
  // Formula cells: read .result, which may be a primitive or an error object
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as ExcelJS.CellFormulaValue).result
    // Error objects (e.g. { error: '#VALUE!' }) → treat as empty
    if (r === null || r === undefined || typeof r === 'object') return ''
    return String(r).trim()
  }
  // Shared string or plain value
  if (typeof v === 'object') return ''
  return String(v).trim()
}

function toFloat(s: string): number | null {
  if (s === '') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function toInt(s: string): number | null {
  if (s === '') return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

interface RowResult {
  row:       number
  variantId: string
  status:    'updated' | 'skipped' | 'error'
  reason?:   string
  costUpdated?:      boolean
  inventoryUpdated?: boolean
}

// Tracks variants whose inventory was updated so we can bulk-push to Shopify
interface InventoryUpdatedRow {
  variantId:    string
  new_quantity: number
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(arrayBuffer)

    const ws = wb.getWorksheet('Inventory Bulk Update')
    if (!ws) return NextResponse.json({ error: 'Sheet "Inventory Bulk Update" not found. Please use the downloaded template.' }, { status: 400 })

    const results: RowResult[] = []
    const inventoryUpdatedRows: InventoryUpdatedRow[] = []
    let updatedRows = 0, updatedCost = 0, updatedInventory = 0, skipped = 0, errors = 0

    // Skip header row (row 1)
    ws.eachRow({ includeEmpty: false }, async () => {}) // warm up iterator

    const rows: ExcelJS.Row[] = []
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return // skip header
      rows.push(row)
    })

    for (const row of rows) {
      const rowNum    = row.number
      const variantId = cellValue(row, C_VARIANT_ID)
      if (!variantId) { skipped++; continue }

      // Note: validationError formula column (O) is intentionally not read here.
      // Google Sheets re-exports formula results as error objects that ExcelJS
      // cannot reliably parse. All validation is done server-side below.

      const rawCost  = cellValue(row, C_UPDATED_COST)
      const rawVirt  = cellValue(row, C_UPDATED_VIRT)
      const rawPhys  = cellValue(row, C_UPDATED_PHYS)
      const remarks  = cellValue(row, C_REMARKS).slice(0, 500) || null

      const hasCost  = rawCost !== ''
      const hasVirt  = rawVirt !== ''
      const hasPhys  = rawPhys !== ''
      const hasInventory = hasVirt || hasPhys

      // Skip rows with no updates at all
      if (!hasCost && !hasInventory) { skipped++; continue }

      // Server-side validation (belt-and-suspenders, catches tampered files)
      const serverErrors: string[] = []

      let cost: number | null = null
      if (hasCost) {
        cost = toFloat(rawCost)
        if (cost === null)  serverErrors.push('updatedCostPrice is not a valid number')
        else if (cost < 0)  serverErrors.push('updatedCostPrice cannot be negative')
      }

      let virt: number | null = null
      let phys: number | null = null
      if (hasInventory) {
        if (!hasVirt || !hasPhys) {
          serverErrors.push('Both updatedVirtualInventory and updatedPhysicalInventory are required together')
        } else {
          virt = toInt(rawVirt)
          phys = toInt(rawPhys)
          if (virt === null || virt < 0)           serverErrors.push('updatedVirtualInventory must be a non-negative integer')
          else if (parseFloat(rawVirt) !== virt)   serverErrors.push('updatedVirtualInventory must be a whole number')
          if (phys === null || phys < 0)           serverErrors.push('updatedPhysicalInventory must be a non-negative integer')
          else if (parseFloat(rawPhys) !== phys)   serverErrors.push('updatedPhysicalInventory must be a whole number')
        }
      }

      if (serverErrors.length > 0) {
        errors++
        results.push({ row: rowNum, variantId, status: 'error', reason: serverErrors.join('; ') })
        continue
      }

      // Apply updates
      const update: Record<string, unknown> = { inventory_changed_by: 'bulk_upload' }
      let didCost = false, didInventory = false

      if (hasCost && cost !== null) {
        update.cost = cost
        didCost = true
      }
      if (hasInventory && virt !== null && phys !== null) {
        update.virtual_inventory  = virt
        update.physical_inventory = phys
        update.inventory_remark   = remarks
        didInventory = true
      }

      const { error: dbError } = await supabaseAdmin
        .from('product_variants')
        .update(update)
        .eq('variant_id', variantId)

      if (dbError) {
        errors++
        results.push({ row: rowNum, variantId, status: 'error', reason: dbError.message })
        continue
      }

      updatedRows++
      if (didCost) updatedCost++
      if (didInventory) {
        updatedInventory++
        // Track for Shopify push — new total = virtual + physical
        inventoryUpdatedRows.push({ variantId, new_quantity: virt! + phys! })
      }
      results.push({ row: rowNum, variantId, status: 'updated', costUpdated: didCost, inventoryUpdated: didInventory })
    }

    // Push inventory changes to Shopify in bulk
    let shopify_push: { success: boolean; pushed: number; errors: string[] } | null = null

    if (inventoryUpdatedRows.length > 0) {
      try {
        // Fetch inventory_item_id for all updated variants in one query
        const variantIds = inventoryUpdatedRows.map((r) => r.variantId)
        const { data: variants } = await supabaseAdmin
          .from('product_variants')
          .select('variant_id, inventory_item_id')
          .in('variant_id', variantIds)

        const itemIdMap = new Map(
          (variants ?? [])
            .filter((v) => v.inventory_item_id)
            .map((v) => [v.variant_id, v.inventory_item_id as string]),
        )

        const pushItems = inventoryUpdatedRows
          .filter((r) => itemIdMap.has(r.variantId))
          .map((r) => ({ inventory_item_id: itemIdMap.get(r.variantId)!, quantity: r.new_quantity }))

        if (pushItems.length > 0) {
          const locationId = await fetchPrimaryLocationId()
          shopify_push = await pushInventoryToShopify(pushItems, locationId)
        } else {
          shopify_push = { success: true, pushed: 0, errors: ['No variants had inventory_item_id — run a product sync first'] }
        }
      } catch (shopifyErr) {
        shopify_push = {
          success: false,
          pushed: 0,
          errors: [shopifyErr instanceof Error ? shopifyErr.message : String(shopifyErr)],
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows:        rows.length,
        updated_rows:      updatedRows,
        updated_cost:      updatedCost,
        updated_inventory: updatedInventory,
        skipped,
        errors,
      },
      shopify_push,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
