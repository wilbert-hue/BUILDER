/**
 * Chart Groups Configuration
 * Defines the grouping of charts for different analytical perspectives
 */

export type ChartGroupId =
  | 'taxonomy'
  | 'market-analysis'
  | 'coherent-opportunity'
  | 'competitive-intelligence'
  | 'customer-intelligence'
  | 'distributor-intelligence'
  | 'pricing-analysis'
  | 'b2b-survey'
  | 'b2c-survey'
  | 'coherent-quadrant'
  // Trade tables are data-driven: a dashboard declares its own, so their group
  // ids are minted from the table rather than listed here.
  | `trade:${string}`

export interface ChartGroup {
  id: ChartGroupId
  label: string
  description: string
  charts: string[] // Chart identifiers that belong to this group
  icon?: string
}

export const CHART_GROUPS: ChartGroup[] = [
  {
    id: 'taxonomy',
    label: 'Taxonomy',
    description: 'Segmentation and geographical scope of this dashboard',
    charts: ['taxonomy'],
    icon: '🗂️'
  },
  {
    id: 'market-analysis',
    label: 'Market Analysis',
    description: 'Core market metrics and trends',
    charts: ['grouped-bar', 'multi-line', 'heatmap', 'comparison-table', 'waterfall'],
    icon: '📊'
  },
  // The Coherent Opportunity Matrix was retired from the dashboards. Dropping
  // the group is what removes it: a chart is only ever shown when the selected
  // group lists it, so nothing reaches the bubble chart once no group does.
  // The chart and its filters are left in the codebase, unreferenced by any
  // group, so the view can be brought back by restoring this entry alone.
  {
    id: 'competitive-intelligence',
    label: 'Competitive Intelligence 2025',
    description: 'Competitor analysis and market share',
    charts: ['competitive-intelligence'], // This includes both Market Share and Competitive Dashboard
    icon: '🏆'
  },
  {
    id: 'customer-intelligence',
    label: 'Customer Intelligence',
    description: 'Verified customer database by proposition tier',
    charts: ['customer-intelligence'],
    icon: '👥'
  },
  {
    id: 'distributor-intelligence',
    label: 'Distributor Intelligence',
    description: 'Verified distributor database by proposition tier',
    charts: ['distributor-intelligence'],
    icon: '🏢'
  },
  {
    id: 'pricing-analysis',
    label: 'Pricing Analysis',
    description: 'Average selling price trends and analysis',
    charts: ['pricing-grouped-bar', 'pricing-multi-line', 'pricing-heatmap', 'pricing-comparison-table'],
    icon: '💰'
  },
  {
    id: 'b2b-survey',
    label: 'Voice of Customer - B2B',
    description: 'Verified B2B buyer survey findings',
    charts: ['b2b-survey'],
    icon: '🏭'
  },
  {
    id: 'b2c-survey',
    label: 'Voice of Customer - B2C',
    description: 'Verified B2C consumer survey findings',
    charts: ['b2c-survey'],
    icon: '🛒'
  },
  {
    id: 'coherent-quadrant',
    label: 'Vendor Intelligence (Coherent Quadrant)',
    description: 'Competitive positioning across product and business capability',
    charts: ['coherent-quadrant'],
    icon: '📐'
  }
]

/** The group id that shows a given trade table. */
export function tradeGroupId(tableId: string): ChartGroupId {
  return `trade:${tableId}`
}

/** The table id behind a trade group, or null for every other group. */
export function tradeTableIdOf(groupId: ChartGroupId): string | null {
  return groupId.startsWith('trade:') ? groupId.slice('trade:'.length) : null
}

/** The groups a dashboard's trade tables add, in the order the tables are given. */
export function tradeChartGroups(
  tables: { id: string; label: string }[] | null | undefined
): ChartGroup[] {
  return (tables ?? []).map((t) => ({
    id: tradeGroupId(t.id),
    label: t.label,
    description: `${t.label}, as recorded in the source workbook`,
    charts: [],
  }))
}

/** Dashboards open on the taxonomy: the scope of the report before its numbers. */
export const DEFAULT_CHART_GROUP: ChartGroupId = 'taxonomy'

/**
 * Get chart group by ID
 */
export function getChartGroup(id: ChartGroupId): ChartGroup | undefined {
  return CHART_GROUPS.find(group => group.id === id)
}

/**
 * Check if a chart belongs to a group
 */
export function isChartInGroup(chartId: string, groupId: ChartGroupId): boolean {
  const group = getChartGroup(groupId)
  return group ? group.charts.includes(chartId) : false
}

/**
 * Get all charts for a group
 */
export function getChartsForGroup(groupId: ChartGroupId): string[] {
  const group = getChartGroup(groupId)
  return group ? group.charts : []
}
