import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

// Column layout (1-based):
// A=1  variant_id
// B=2  product_title
// C=3  image            (=IMAGE formula, locked)
// D=4  subtitle         (locked)
// E=5  display_color    (locked)
// F=6  status           (locked)
// G=7  current_cost_price
// H=8  current_sale_price
// I=9  current_virtual_inventory
// J=10 current_physical_inventory
// K=11 current_total_inventory
// L=12 updatedCostPrice          ← EDITABLE
// M=13 updatedVirtualInventory   ← EDITABLE
// N=14 updatedPhysicalInventory  ← EDITABLE
// O=15 totalInventory            (formula, locked)
// P=16 updateInventoryRemarks    ← EDITABLE
// Q=17 validationError           (formula, locked)

const LOCKED_COL_MAX = 11  // cols 1–11 are locked info
const EDITABLE_COLS  = new Set([12, 13, 14, 16])
const FORMULA_COLS   = new Set([3, 15, 17])

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
        products!inner ( title, subtitle, display_color_name, status, image_url )
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
      { key: 'subtitle',           width: 38 },  // D
      { key: 'display_color',      width: 18 },  // E
      { key: 'status',             width: 12 },  // F
      { key: 'current_cost',       width: 20 },  // G
      { key: 'current_sale',       width: 20 },  // H
      { key: 'current_virtual',    width: 22 },  // I
      { key: 'current_physical',   width: 22 },  // J
      { key: 'current_total',      width: 20 },  // K
      { key: 'updated_cost',       width: 22 },  // L
      { key: 'updated_virtual',    width: 26 },  // M
      { key: 'updated_physical',   width: 26 },  // N
      { key: 'total_inventory',    width: 18 },  // O
      { key: 'remarks',            width: 40 },  // P
      { key: 'validation_error',   width: 54 },  // Q
    ]

    // ── Header row ──────────────────────────────────────────────────────
    const HEADERS = [
      'variant_id',
      'product_title',
      'image',
      'subtitle',
      'display_color_name',
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
      const p = v.products as unknown as { title: string; subtitle: string; display_color_name: string; status: string; image_url: string | null }

      const dataRow = ws.addRow([
        v.variant_id,   // A
        p.title,        // B
        null,           // C — image formula set below
        p.subtitle,     // D
        p.display_color_name, // E
        p.status,       // F
        v.cost,         // G
        v.price,        // H
        v.virtual_inventory,   // I
        v.physical_inventory,  // J
        v.inventory_quantity,  // K
        null,           // L — updatedCostPrice
        null,           // M — updatedVirtualInventory
        null,           // N — updatedPhysicalInventory
        null,           // O — totalInventory formula
        null,           // P — remarks
        null,           // Q — validationError formula
      ])
      dataRow.height = 40  // taller rows so images are visible

      // Style cells
      dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.alignment = { vertical: 'middle', wrapText: false }

        if (colNum <= LOCKED_COL_MAX || FORMULA_COLS.has(colNum)) {
          cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum === 17 ? ERROR_BG : LOCKED_BG } }
          cell.font       = { size: 10, color: { argb: colNum === 17 ? 'FFCC0000' : 'FF444444' } }
          cell.protection = { locked: true }
        } else if (EDITABLE_COLS.has(colNum)) {
          cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: EDITABLE_BG } }
          cell.font       = { size: 10 }
          cell.protection = { locked: false }
        }
      })

      // Number formats
      ws.getCell(rowNum, 7).numFmt  = '#,##0.00'  // current_cost
      ws.getCell(rowNum, 8).numFmt  = '#,##0.00'  // current_sale
      ws.getCell(rowNum, 12).numFmt = '#,##0.00'  // updated_cost

      // ── C: IMAGE formula ──────────────────────────────────────────────
      if (p.image_url) {
        ws.getCell(rowNum, 3).value = {
          formula: `IMAGE("${p.image_url}")`,
        }
      }

      // ── O: totalInventory formula ─────────────────────────────────────
      const cellM = `M${rowNum}`
      const cellN = `N${rowNum}`
      ws.getCell(rowNum, 15).value = {
        formula: `IF(AND(${cellM}="",${cellN}=""),"",IFERROR(${cellM}+${cellN},""))`,
      }

      // ── Q: validationError formula ────────────────────────────────────
      const L = `L${rowNum}`
      const M = `M${rowNum}`
      const N = `N${rowNum}`

      const e1 = `IF(AND(${L}<>"",NOT(ISNUMBER(${L}))),"Cost must be a number. ","")`
      const e2 = `IF(AND(${L}<>"",ISNUMBER(${L}),${L}<0),"Cost cannot be negative. ","")`
      const e3 = `IF(AND(${M}<>"",NOT(ISNUMBER(${M}))),"Virtual must be a number. ","")`
      const e4 = `IF(AND(${M}<>"",ISNUMBER(${M}),${M}<0),"Virtual cannot be negative. ","")`
      const e5 = `IF(AND(${M}<>"",ISNUMBER(${M}),${M}>=0,IFERROR(INT(${M}),${M})<>${M}),"Virtual must be whole number. ","")`
      const e6 = `IF(AND(${N}<>"",NOT(ISNUMBER(${N}))),"Physical must be a number. ","")`
      const e7 = `IF(AND(${N}<>"",ISNUMBER(${N}),${N}<0),"Physical cannot be negative. ","")`
      const e8 = `IF(AND(${N}<>"",ISNUMBER(${N}),${N}>=0,IFERROR(INT(${N}),${N})<>${N}),"Physical must be whole number. ","")`
      const e9 = `IF(AND(${M}<>"",${N}=""),"Physical required when Virtual is set. ",IF(AND(${N}<>"",${M}=""),"Virtual required when Physical is set. ",""))`

      ws.getCell(rowNum, 17).value = {
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
