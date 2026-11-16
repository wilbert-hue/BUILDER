'use client'

/**
 * A trade sheet, shown as the workbook writes it.
 *
 * Nothing here is modelled or re-derived: the banner, the two header rows with
 * their bands, and the body rows are the ones the sheet carries. The only
 * additions are reading aids — a partner filter and sticky headers — because
 * these grids run to several hundred rows.
 */

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { TradeTable } from '@/lib/trade-tables'

/** Key columns span both header rows; banded columns do not. */
function headerLayout(table: TradeTable) {
  const spanning: { label: string; index: number }[] = []
  const banded: { label: string; span: number; start: number }[] = []
  let col = 0
  for (const group of table.groups) {
    const isKey = group.span === 1 && !table.columns[col]
    if (isKey) spanning.push({ label: group.label, index: col })
    else banded.push({ label: group.label, span: group.span, start: col })
    col += group.span
  }
  return { spanning, banded }
}

const fmt = (v: string | number | null) => {
  if (v === null || v === '') return ''
  if (typeof v !== 'number') return v
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TradeDataView({ table }: { table: TradeTable }) {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return table.rows
    return table.rows.filter((row) => row.some((cell) => String(cell ?? '').toLowerCase().includes(q)))
  }, [table.rows, query])

  const { spanning, banded } = useMemo(() => headerLayout(table), [table])

  // Walk the groups in order so each header row is emitted left to right, with
  // the key columns reserved out of the second row they already cover.
  const keyColumns = new Set(spanning.map((s) => s.index))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-black">{table.label}</h2>
          {table.title && <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{table.title}</p>}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows…"
            className="w-56 rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm text-black placeholder:text-slate-400 focus:border-[#34A0A4] focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: '70vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              {table.groups.map((group, i) => {
                const start = table.groups.slice(0, i).reduce((n, g) => n + g.span, 0)
                const isKey = keyColumns.has(start) && group.span === 1
                return (
                  <th
                    key={i}
                    colSpan={isKey ? 1 : group.span}
                    rowSpan={isKey ? 2 : 1}
                    className="border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-700 whitespace-nowrap"
                  >
                    {group.label}
                  </th>
                )
              })}
            </tr>
            <tr className="bg-slate-50">
              {banded.flatMap((band) =>
                Array.from({ length: band.span }, (_, k) => (
                  <th
                    key={`${band.start}-${k}`}
                    className="border border-slate-200 px-3 py-1.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap"
                  >
                    {table.columns[band.start + k]}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r % 2 ? 'bg-slate-50/60' : 'bg-white'}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`border border-slate-200 px-3 py-1.5 whitespace-nowrap ${
                      keyColumns.has(c) ? 'text-left text-slate-800' : 'text-right tabular-nums text-slate-700'
                    }`}
                  >
                    {fmt(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        {rows.length.toLocaleString('en-US')} of {table.rows.length.toLocaleString('en-US')} rows
        {table.note ? ` — ${table.note}` : ''}
      </p>
    </div>
  )
}

export default TradeDataView
