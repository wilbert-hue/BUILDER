/**
 * Trade tables — workbook sheets carried onto the dashboard as their own tabs,
 * shown exactly as the sheet lays them out.
 *
 * Some studies ship a trade database alongside the market model: an import and
 * an export sheet, partner country by partner country. There is nothing to
 * model in them — the sheet *is* the deliverable — so they are stored as the
 * grid they already are and rendered verbatim, rather than being folded into
 * the geography/segment matrix the market charts read.
 *
 * A table carries two header rows because that is how the sheets are written:
 * a band ("Trade Value (USD Mn)") spanning the year columns beneath it, and the
 * key columns standing alone through both rows.
 */

export interface TradeColumnGroup {
  /** Band label, or the key column's own name when it spans both header rows. */
  label: string
  /** How many leaf columns sit under this band. */
  span: number
}

export interface TradeTable {
  /** Stable slug, used in the tab id. */
  id: string
  /** Tab label — the sheet name as the workbook writes it. */
  label: string
  /** The sheet's own banner line, shown above the grid. */
  title?: string | null
  /** Header row 1. A span of 1 whose leaf label is empty is a key column. */
  groups: TradeColumnGroup[]
  /** Header row 2, one entry per leaf column; empty for key columns. */
  columns: string[]
  rows: (string | number | null)[][]
  /** Optional line under the grid (source, caveat). */
  note?: string | null
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

/** Total leaf columns a table's bands cover. */
export function tradeColumnCount(table: TradeTable): number {
  return table.groups.reduce((n, g) => n + (g.span > 0 ? g.span : 0), 0)
}

/**
 * Accept a stored trade table, or reject it. Anything whose bands do not line
 * up with its leaf columns would render as a broken grid, so it is dropped
 * rather than shown half-formed.
 */
function reviveTable(raw: unknown, index: number): TradeTable | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : ''
  if (!label) return null

  const groups = Array.isArray(r.groups)
    ? r.groups
        .map((g) => {
          if (!g || typeof g !== 'object') return null
          const gr = g as Record<string, unknown>
          const span = Number(gr.span)
          if (!Number.isFinite(span) || span < 1) return null
          return { label: typeof gr.label === 'string' ? gr.label : '', span: Math.floor(span) }
        })
        .filter((g): g is TradeColumnGroup => g !== null)
    : []
  if (!groups.length) return null

  const columns = Array.isArray(r.columns) ? r.columns.map((c) => (c == null ? '' : String(c))) : []
  const total = groups.reduce((n, g) => n + g.span, 0)
  if (columns.length !== total) return null

  const rows = Array.isArray(r.rows)
    ? r.rows
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) =>
          Array.from({ length: total }, (_, i) => {
            const v = row[i]
            if (v == null || v === '') return ''
            return typeof v === 'number' ? v : String(v)
          })
        )
    : []
  if (!rows.length) return null

  const id = typeof r.id === 'string' && r.id.trim() ? slug(r.id) : slug(label) || `table-${index + 1}`

  return {
    id,
    label,
    title: typeof r.title === 'string' ? r.title : null,
    groups,
    columns,
    rows,
    note: typeof r.note === 'string' ? r.note : null,
  }
}

/** Parse the stored `tradeTables` field; null when there is nothing usable. */
export function parseTradeTables(raw: unknown): TradeTable[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const out: TradeTable[] = []
  raw.forEach((item, i) => {
    const table = reviveTable(item, i)
    if (!table) return
    // Tab ids address the tables, so a duplicate would make one unreachable.
    let id = table.id
    let n = 2
    while (seen.has(id)) id = `${table.id}-${n++}`
    seen.add(id)
    out.push({ ...table, id })
  })
  return out.length ? out : null
}
