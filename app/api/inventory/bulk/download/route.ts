import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

// Column layout (1-based):
// A=1  variant_id
// B=2  product_title
// C=3  image            (=IMAGE formula, locked)
// D=4  status           (locked)
// E=5  current_cost_price
// F=6  current_sale_price
// G=7  current_virtual_inventory
// H=8  current_physical_inventory
// I=9  current_total_inventory
// J=10 updatedCostPrice          ← EDITABLE
// K=11 updatedVirtualInventory   ← EDITABLE
// L=12 updatedPhysicalInventory  ← EDITABLE
// M=13 totalInventory            (formula, locked)
// N=14 updateInventoryRemarks    ← EDITABLE
// O=15 validationError           (formula, locked)

const LOCKED_COL_MAX = 9   // cols 1–9 are locked info
const EDITABLE_COLS  = new Set([10, 11, 12, 14])
const FORMULA_COLS   = new Set([3, 13, 15])

const LOCKED_BG  = 'FFE8E8E8'
const EDITABLE_BG = 'FFFFFFCC'
const ERROR_BG   = 'FFFFDDDD'
const HEADER_BG  = 'FFD57282'
const HEADER_FG  = 'FFFFFFFF'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        variant_id, price, cost,
        inventory_quantity, virtual_inventory, physical_inventory,
        products!inner ( title, status, image_url )
      `)
      .eq('products.status', 'ACTIVE')
      .order('products(title)', { ascending: true })

    if (error) throw error

    const variants = data ?? []

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Maeri Control Centre'
    wb.created = new Date()

    const ws = wb.addWorksheet('Inventory Bulk Update', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    ws.columns = [
      { key: 'variant_id',         width: 26 },  // A
      { key: 'product_title',      width: 38 },  // B
      { key: 'image',              width: 16 },  // C
      { key: 'status',             width: 12 },  // D
      { key: 'current_cost',       width: 20 },  // E
      { key: 'current_sale',       width: 20 },  // F
      { key: 'current_virtual',    width: 22 },  // G
      { key: 'current_physical',   width: 22 },  // H
      { key: 'current_total',      width: 20 },  // I
      { key: 'updated_cost',       width: 22 },  // J
      { key: 'updated_virtual',    width: 26 },  // K
      { key: 'updated_physical',   width: 26 },  // L
      { key: 'total_inventory',    width: 18 },  // M
      { key: 'remarks',            width: 40 },  // N
      { key: 'validation_error',   width: 54 },  // O
    ]

    // ── Header row ──────────────────────────────────────────────────────
    const HEADERS = [
      'variant_id',
      'product_title',
      'image',
      'status',
      'current_cost_price',
      'current_sale_price',
      'current_virtual_inventory',
      'current_physical_inventory',
      'current_total_inventory',
      'updatedCostPrice',
      'updatedVirtualInventory',
      'updatedPhysicalInventory',
      'totalInventory',
      'updateInventoryRemarks',
      'validationError',
    ]

    const headerRow = ws.addRow(HEADERS)
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
      cell.font       = { bold: true, color: { argb: HEADER_FG }, size: 10 }
      cell.alignment  = { vertical: 'middle', horizontal: 'center' }
      cell.border     = { bottom: { style: 'thin', color: { argb: 'FFCE5A56' } } }
      cell.protection = { locked: true }
    })

    // ── Data rows ────────────────────────────────────────────────────────
    variants.forEach((v, i) => {
      const rowNum = i + 2
      const p = v.products as unknown as { title: string; status: string; image_url: string | null }

      const dataRow = ws.addRow([
        v.variant_id,   // A
        p.title,        // B
        null,           // C — image formula set below
        p.status,       // D
        v.cost,         // E
        v.price,        // F
        v.virtual_inventory,   // G
        v.physical_inventory,  // H
        v.inventory_quantity,  // I
        null,           // J — updatedCostPrice
        null,           // K — updatedVirtualInventory
        null,           // L — updatedPhysicalInventory
        null,           // M — totalInventory formula
        null,           // N — remarks
        null,           // O — validationError formula
      ])
      dataRow.height = 40  // taller rows so images are visible

      // Style cells
      dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.alignment = { vertical: 'middle', wrapText: false }

        if (colNum <= LOCKED_COL_MAX || FORMULA_COLS.has(colNum)) {
          cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum === 15 ? ERROR_BG : LOCKED_BG } }
          cell.font       = { size: 10, color: { argb: colNum === 15 ? 'FFCC0000' : 'FF444444' } }
          cell.protection = { locked: true }
        } else if (EDITABLE_COLS.has(colNum)) {
          cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: EDITABLE_BG } }
          cell.font       = { size: 10 }
          cell.protection = { locked: false }
        }
      })

      // Number formats
      ws.getCell(rowNum, 5).numFmt  = '#,##0.00'  // current_cost
      ws.getCell(rowNum, 6).numFmt  = '#,##0.00'  // current_sale
      ws.getCell(rowNum, 10).numFmt = '#,##0.00'  // updated_cost

      // ── C: IMAGE formula ──────────────────────────────────────────────
      if (p.image_url) {
        ws.getCell(rowNum, 3).value = {
          formula: `IMAGE("${p.image_url}")`,
        }
      }

      // ── M: totalInventory formula ─────────────────────────────────────
      const cellK = `K${rowNum}`
      const cellL = `L${rowNum}`
      ws.getCell(rowNum, 13).value = {
        formula: `IF(AND(${cellK}="",${cellL}=""),"",IFERROR(${cellK}+${cellL},""))`,
      }

      // ── O: validationError formula ────────────────────────────────────
      const J = `J${rowNum}`
      const K = `K${rowNum}`
      const L = `L${rowNum}`

      const e1 = `IF(AND(${J}<>"",NOT(ISNUMBER(${J}))),"Cost must be a number. ","")`
      const e2 = `IF(AND(${J}<>"",ISNUMBER(${J}),${J}<0),"Cost cannot be negative. ","")`
      const e3 = `IF(AND(${K}<>"",NOT(ISNUMBER(${K}))),"Virtual must be a number. ","")`
      const e4 = `IF(AND(${K}<>"",ISNUMBER(${K}),${K}<0),"Virtual cannot be negative. ","")`
      const e5 = `IF(AND(${K}<>"",ISNUMBER(${K}),${K}>=0,IFERROR(INT(${K}),${K})<>${K}),"Virtual must be whole number. ","")`
      const e6 = `IF(AND(${L}<>"",NOT(ISNUMBER(${L}))),"Physical must be a number. ","")`
      const e7 = `IF(AND(${L}<>"",ISNUMBER(${L}),${L}<0),"Physical cannot be negative. ","")`
      const e8 = `IF(AND(${L}<>"",ISNUMBER(${L}),${L}>=0,IFERROR(INT(${L}),${L})<>${L}),"Physical must be whole number. ","")`
      const e9 = `IF(AND(${K}<>"",${L}=""),"Physical required when Virtual is set. ",IF(AND(${L}<>"",${K}=""),"Virtual required when Physical is set. ",""))`

      ws.getCell(rowNum, 15).value = {
        formula: `CONCATENATE(${e1},${e2},${e3},${e4},${e5},${e6},${e7},${e8},${e9})`,
      }
    })

    // ── AutoFilter on header row ─────────────────────────────────────────
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: HEADERS.length },
    }

    // ── Sheet protection — allow filters, block structural changes ───────
    await ws.protect('maeri_bulk', {
      selectLockedCells:   true,
      selectUnlockedCells: true,
      formatCells:   false,
      formatColumns: false,
      formatRows:    false,
      insertColumns: false,
      insertRows:    false,
      deleteColumns: false,
      deleteRows:    false,
      sort:          true,   // allow sort so filter dropdowns work
      autoFilter:    true,   // allow filter
    })

    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="maeri_inventory_bulk_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
