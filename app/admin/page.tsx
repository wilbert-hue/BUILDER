'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Category = 'demo' | 'presales' | 'real' | 'mixed'
type ModuleKey = 'market' | 'customer' | 'distributor' | 'pricing' | 'b2b' | 'b2c' | 'quadrant'

interface Dashboard {
  id: string
  name: string
  createdAt: string | null
  currency: string
  category: Category
  modules: { key: ModuleKey; demo: boolean }[]
}

interface UserStat {
  email: string
  ownerId: string | null
  count: number
  counts: Record<Category, number>
  lastCreated: string | null
  dashboards: Dashboard[]
}

interface StatsResponse {
  stats: UserStat[]
  totals: Record<Category, number>
  totalDashboards: number
  totalUsers: number
}

const CATEGORY: Record<
  Category,
  { label: string; desc: string; dot: string; text: string; chip: string; bar: string; ring: string }
> = {
  real: {
    label: 'Real',
    desc: 'All modules use real data',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    chip: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
    bar: 'bg-emerald-400',
    ring: 'ring-emerald-400/60',
  },
  presales: {
    label: 'Pre-Sales',
    desc: 'Demo market analysis, all other modules real',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    chip: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
    bar: 'bg-sky-400',
    ring: 'ring-sky-400/60',
  },
  demo: {
    label: 'Demo',
    desc: 'Every module uses demo data',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    chip: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
    bar: 'bg-amber-400',
    ring: 'ring-amber-400/60',
  },
  mixed: {
    label: 'Mixed',
    desc: 'Other combinations of demo and real modules',
    dot: 'bg-slate-400',
    text: 'text-slate-300',
    chip: 'bg-slate-500/10 text-slate-300 ring-slate-500/30',
    bar: 'bg-slate-500',
    ring: 'ring-slate-400/60',
  },
}

const MAIN: Category[] = ['real', 'presales', 'demo']

const MODULE_LABEL: Record<ModuleKey, string> = {
  market: 'Market',
  customer: 'Customer',
  distributor: 'Distributor',
  pricing: 'Pricing',
  b2b: 'VoC B2B',
  b2c: 'VoC B2C',
  quadrant: 'Quadrant',
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const initials = (email: string) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z.]/g, '')
  const parts = base.split('.').filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) { setError('Access denied — admin only.'); setLoading(false); return }
      if (!res.ok) throw new Error('Failed to load stats')
      setData(await res.json())
    } catch {
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStats() }, [])

  const unknownRow = data?.stats.find(r => !r.ownerId)

  const deleteUnknown = async () => {
    const count = unknownRow?.count ?? 0
    if (!window.confirm(
      `Permanently delete ${count} ownerless dashboard${count !== 1 ? 's' : ''}? This cannot be undone.`
    )) return
    setDeleting(true)
    setDeleteMsg(null)
    try {
      const res = await fetch('/api/admin/cleanup', { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Delete failed')
      setDeleteMsg(`Deleted ${body.deletedCount} ownerless dashboard${body.deletedCount !== 1 ? 's' : ''}.`)
      await loadStats()
    } catch (e: any) {
      setDeleteMsg(`Error: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.stats
      .filter(r => !q || r.email.toLowerCase().includes(q))
      .map(r => ({ ...r, shown: filter === 'all' ? r.count : r.counts[filter] }))
      .filter(r => filter === 'all' || r.shown > 0)
      .sort((a, b) => b.shown - a.shown)
  }, [data, filter, query])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <span className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-sky-400 animate-spin" />
          Loading analytics…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg font-semibold mb-2">{error}</div>
          <button onClick={() => router.push('/')} className="text-sm text-slate-400 hover:text-white underline">
            Go home
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const total = data.totalDashboards || 1
  const pct = (n: number) => Math.round((n / total) * 100)
  const visibleCats: Category[] = data.totals.mixed > 0 ? [...MAIN, 'mixed'] : MAIN

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_70%)]" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#070b14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center font-bold text-sm shadow-lg shadow-sky-500/20">
              A
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight leading-none">Admin Console</h1>
              <p className="text-xs text-slate-500 mt-1">Dashboard usage analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); loadStats() }}
              className="text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.03] px-3 py-1.5 rounded-lg transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                router.push('/login')
              }}
              className="text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.03] px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-6">
        {/* KPI row */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`text-left rounded-2xl p-5 border bg-gradient-to-b from-white/[0.06] to-white/[0.02] transition-all ${
              filter === 'all' ? 'border-white/25 ring-1 ring-white/20' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Total Dashboards</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{data.totalDashboards.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-xs text-slate-500">{data.totalUsers} active users</p>
          </button>
          {MAIN.map(c => (
            <button
              key={c}
              onClick={() => setFilter(filter === c ? 'all' : c)}
              className={`text-left rounded-2xl p-5 border bg-gradient-to-b from-white/[0.05] to-white/[0.01] transition-all ${
                filter === c ? `border-transparent ring-1 ${CATEGORY[c].ring}` : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${CATEGORY[c].dot}`} />
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  {CATEGORY[c].label} Dashboards
                </p>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-3xl font-semibold tabular-nums">{data.totals[c].toLocaleString('en-IN')}</p>
                <span className={`text-xs font-medium ${CATEGORY[c].text}`}>{pct(data.totals[c])}%</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 truncate">{CATEGORY[c].desc}</p>
            </button>
          ))}
          <div className="rounded-2xl p-5 border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Mix</p>
            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
              {visibleCats.map(c => (
                <div key={c} className={CATEGORY[c].bar} style={{ width: `${(data.totals[c] / total) * 100}%` }} />
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {visibleCats.map(c => (
                <div key={c} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY[c].dot}`} />
                    {CATEGORY[c].label}
                  </span>
                  <span className="tabular-nums text-slate-300">{data.totals[c]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ownerless */}
        {unknownRow && (
          <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">Ownerless dashboards found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {unknownRow.count} dashboards have no linked user account (created before auth was added).
                </p>
              </div>
            </div>
            <button
              onClick={deleteUnknown}
              disabled={deleting}
              className="ml-4 shrink-0 text-xs font-medium px-4 py-2 rounded-lg bg-red-500/90 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete all unknown'}
            </button>
          </div>
        )}
        {deleteMsg && <p className="text-sm text-emerald-400 text-center">{deleteMsg}</p>}

        {/* User table */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="flex flex-col gap-4 px-6 py-5 border-b border-white/5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Dashboards by User</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {filter === 'all' ? 'All categories' : `${CATEGORY[filter].label} only`} · {rows.length} users
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                {(['all', ...visibleCats] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      filter === c ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c === 'all' ? 'All' : CATEGORY[c].label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search user…"
                className="w-52 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.1em] text-slate-500 border-b border-white/5">
                  <th className="px-6 py-3 text-left font-medium">User</th>
                  {visibleCats.map(c => (
                    <th key={c} className="px-4 py-3 text-center font-medium">{CATEGORY[c].label}</th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium w-48">Breakdown</th>
                  <th className="px-4 py-3 text-left font-medium">Last Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const key = row.ownerId ?? '__unknown'
                  const open = expanded.has(key)
                  const list = filter === 'all' ? row.dashboards : row.dashboards.filter(d => d.category === filter)
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggleExpand(key)}
                        className={`cursor-pointer border-b border-white/5 transition-colors ${open ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                              row.ownerId ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-slate-100' : 'bg-red-500/15 text-red-300'
                            }`}>
                              {row.ownerId ? initials(row.email) : '?'}
                            </div>
                            <span className="font-medium text-slate-200 truncate max-w-[280px]">{row.email}</span>
                          </div>
                        </td>
                        {visibleCats.map(c => (
                          <td key={c} className="px-4 py-4 text-center tabular-nums">
                            <span className={row.counts[c] ? CATEGORY[c].text : 'text-slate-600'}>{row.counts[c]}</span>
                          </td>
                        ))}
                        <td className="px-4 py-4 text-center tabular-nums font-semibold text-white">{row.count}</td>
                        <td className="px-4 py-4">
                          <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-white/5">
                            {visibleCats.map(c => (
                              <div key={c} className={CATEGORY[c].bar} style={{ width: `${(row.counts[c] / row.count) * 100}%` }} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-400 whitespace-nowrap">{formatDate(row.lastCreated)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-block text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-black/20">
                          <td colSpan={visibleCats.length + 5} className="px-6 py-4">
                            <div className="max-h-96 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
                              {list.map(d => (
                                <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs hover:bg-white/[0.02]">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${CATEGORY[d.category].chip}`}>
                                      {CATEGORY[d.category].label}
                                    </span>
                                    <a
                                      href={`/shared/${d.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="truncate font-medium text-slate-200 hover:text-sky-300"
                                    >
                                      {d.name || '(untitled)'}
                                    </a>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-3">
                                    <div className="hidden lg:flex flex-wrap gap-1">
                                      {d.modules.map(m => (
                                        <span
                                          key={m.key}
                                          title={m.demo ? 'Demo data' : 'Real data'}
                                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                                            m.demo ? 'bg-amber-500/10 text-amber-300/90' : 'bg-emerald-500/10 text-emerald-300/90'
                                          }`}
                                        >
                                          {MODULE_LABEL[m.key]}
                                        </span>
                                      ))}
                                    </div>
                                    {d.currency && <span className="text-slate-500 w-8">{d.currency}</span>}
                                    <span className="text-slate-400 w-24 text-right">{formatDate(d.createdAt)}</span>
                                  </div>
                                </div>
                              ))}
                              {list.length === 0 && (
                                <div className="px-4 py-6 text-center text-slate-500 text-xs">No dashboards in this category.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={visibleCats.length + 5} className="px-6 py-12 text-center text-slate-500">
                      No dashboards match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-[11px] text-slate-600 text-center">
          Module tags: <span className="text-emerald-400/80">green = real data</span> ·{' '}
          <span className="text-amber-400/80">amber = demo data</span>
        </p>
      </main>
    </div>
  )
}
