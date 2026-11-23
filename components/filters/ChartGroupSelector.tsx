'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import { CHART_GROUPS, tradeChartGroups, tradeTableIdOf, type ChartGroupId } from '@/lib/chart-groups'
import { BarChart3, Target, Trophy, Users, Building2, DollarSign, Factory, ShoppingCart, Grid2x2, ListTree, Ship } from 'lucide-react'
import { customerModuleLabel, distributorShortLabel } from '@/lib/module-labels'
import { CHART_VIEW_BAR, chartGroupColor, readableOn, tintOf } from '@/lib/chart-group-colors'

// Icon mapping for each chart group
const iconMap: Record<string, any> = {
  taxonomy: ListTree,
  'market-analysis': BarChart3,
  'coherent-opportunity': Target,
  'competitive-intelligence': Trophy,
  'customer-intelligence': Users,
  'distributor-intelligence': Building2,
  'pricing-analysis': DollarSign,
  'b2b-survey': Factory,
  'b2c-survey': ShoppingCart,
  'coherent-quadrant': Grid2x2,
}

interface ChartGroupSelectorProps {
  /**
   * "vertical"   — the sidebar list (default).
   * "horizontal" — a full-width strip above the dashboard, used when a buyer
   *                survey is loaded so views are switched from the top.
   */
  orientation?: 'vertical' | 'horizontal'
}

export function ChartGroupSelector({ orientation = 'vertical' }: ChartGroupSelectorProps = {}) {
  const {
    data,
    selectedChartGroup,
    setSelectedChartGroup,
    rawIntelligenceData,
    proposition2Data,
    proposition3Data,
    distributorRawIntelligenceData,
    distributorProposition2Data,
    distributorProposition3Data,
    customerIntelligenceData,
    distributorIntelligenceData,
    competitiveIntelligenceData,
    pricingAnalysisData,
    b2bSurveyData,
    b2cSurveyData,
    quadrantData,
    tradeTables,
    showDemoQuadrant,
    staticCustomerProp1,
    staticDistributorProp1,
    showDemoB2bSurvey,
    showDemoB2cSurvey,
    dashboardName,
    customerModuleLabel: customerLabelOverride,
  } = useDashboardStore()

  const hasMarketData = !!data

  const hasCustomerWorkbookRows = !!(
    rawIntelligenceData?.rows?.length ||
    proposition2Data?.rows?.length ||
    proposition3Data?.rows?.length
  )
  const hasDistributorWorkbookRows = !!(
    distributorRawIntelligenceData?.rows?.length ||
    distributorProposition2Data?.rows?.length ||
    distributorProposition3Data?.rows?.length
  )

  // A locked demo template stands in for a directory that has not arrived: it
  // is built from the market itself and needs no stored rows, so the module it
  // represents is present even though no workbook was uploaded.
  const hasCustomerIntelligenceData = !!(
    hasCustomerWorkbookRows ||
    customerIntelligenceData?.length ||
    staticCustomerProp1
  )

  const hasDistributorIntelligenceData = !!(
    hasDistributorWorkbookRows ||
    distributorIntelligenceData?.length ||
    staticDistributorProp1
  )

  // Check if competitive intelligence data exists
  const hasCompetitiveIntelligenceData = !!(
    competitiveIntelligenceData?.rows?.length
  )

  // Check if pricing analysis data exists
  const hasPricingAnalysisData = !!(
    pricingAnalysisData?.data?.value?.geography_segment_matrix?.length
  )

  // Buyer survey reports (uploaded as JSON in the builder)
  const hasB2bSurveyData = !!b2bSurveyData?.segments?.length || showDemoB2bSurvey
  const hasB2cSurveyData = !!b2cSurveyData?.segments?.length || showDemoB2cSurvey
  const hasQuadrantData =
    !!(quadrantData?.charted?.length || quadrantData?.others?.length) || showDemoQuadrant

  /** One group per trade sheet the dashboard carries, in the workbook's order. */
  const tradeGroups = tradeChartGroups(tradeTables)
  const tradeIds = new Set(tradeGroups.map((g) => g.id))

  // Auto-switch to a valid chart group if the currently selected one has no data
  useEffect(() => {
    const isCurrentGroupInvalid =
      (selectedChartGroup === 'taxonomy' && !hasMarketData) ||
      (selectedChartGroup === 'coherent-opportunity' && !hasMarketData) ||
      (selectedChartGroup === 'customer-intelligence' && !hasCustomerIntelligenceData) ||
      (selectedChartGroup === 'distributor-intelligence' && !hasDistributorIntelligenceData) ||
      (selectedChartGroup === 'competitive-intelligence' && !hasCompetitiveIntelligenceData) ||
      (selectedChartGroup === 'pricing-analysis' && !hasPricingAnalysisData) ||
      (selectedChartGroup === 'b2b-survey' && !hasB2bSurveyData) ||
      (selectedChartGroup === 'b2c-survey' && !hasB2cSurveyData) ||
      (selectedChartGroup === 'coherent-quadrant' && !hasQuadrantData) ||
      // A trade tab whose table this dashboard does not carry.
      (tradeTableIdOf(selectedChartGroup) !== null && !tradeIds.has(selectedChartGroup))

    if (isCurrentGroupInvalid) {
      // Switch to market-analysis as the default fallback
      setSelectedChartGroup('market-analysis')
    }
  }, [
    selectedChartGroup,
    hasMarketData,
    hasCustomerIntelligenceData,
    hasDistributorIntelligenceData,
    hasCompetitiveIntelligenceData,
    hasPricingAnalysisData,
    hasB2bSurveyData,
    hasB2cSurveyData,
    hasQuadrantData,
    tradeTables,
    setSelectedChartGroup
  ])

  // Groups whose backing dataset is actually present. Shared by both layouts so
  // visibility rules live in exactly one place.
  /** What a group is called here: two modules are named per dashboard. */
  const labelOf = (group: { id: string; label: string }) =>
    group.id === 'customer-intelligence'
      ? customerModuleLabel(customerLabelOverride)
      : group.id === 'distributor-intelligence'
        ? distributorShortLabel(dashboardName)
        : group.label

  const availableGroups = CHART_GROUPS.filter((group) => {
    // Taxonomy is the workbook's own segmentation, so it stands on market data alone.
    if (group.id === 'taxonomy') return hasMarketData
    // Market views need the value/volume workbook behind them.
    if (group.id === 'market-analysis') return hasMarketData
    // The matrix reads the value/volume workbook, so market data is all it
    // needs. A buyer survey used to hide it, on the grounds that the two
    // answered the same question twice; they are now shown side by side so a
    // reader can weigh the survey's findings against the modelled opportunity.
    if (group.id === 'coherent-opportunity') return hasMarketData
    if (group.id === 'customer-intelligence') return hasCustomerIntelligenceData
    if (group.id === 'distributor-intelligence') return hasDistributorIntelligenceData
    if (group.id === 'competitive-intelligence') return hasCompetitiveIntelligenceData
    if (group.id === 'pricing-analysis') return hasPricingAnalysisData
    if (group.id === 'b2b-survey') return hasB2bSurveyData
    if (group.id === 'b2c-survey') return hasB2cSurveyData
    if (group.id === 'coherent-quadrant') return hasQuadrantData
    return true
  })
    // The dashboard's own trade sheets, after the declared groups.
    .concat(tradeGroups)

  if (orientation === 'horizontal') {
    return (
      <div
        className="w-full rounded-lg shadow-sm border px-5 py-4"
        style={{ background: CHART_VIEW_BAR, borderColor: '#17496F' }}
      >
      {/*
        The heading sits above the sections rather than beside them, and the
        sections share one row: equal columns that shrink together, so a
        dashboard carrying every module still reads as a single line. Names too
        long for their column are clipped, with the full name on the tooltip.
      */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Chart View</h3>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${availableGroups.length}, minmax(0, 1fr))` }}
        >
          {availableGroups.map((group, i) => {
            const Icon = iconMap[group.id] || (tradeIds.has(group.id) ? Ship : BarChart3)
            const isSelected = selectedChartGroup === group.id
            // Each section keeps its colour whether or not it is selected:
            // filled when it is, a wash of the same colour when it is not.
            const color = chartGroupColor(group.id, i)
            return (
              <button
                key={group.id}
                onClick={() => setSelectedChartGroup(group.id)}
                className="flex w-full min-w-0 items-center justify-center gap-2 rounded-md px-2.5 py-2.5 transition-all duration-200"
                style={
                  isSelected
                    ? {
                        background: color,
                        color: readableOn(color),
                        // Both states carry a border, so selecting one does not
                        // resize it and shuffle the row.
                        border: `1px solid ${color}`,
                        boxShadow: '0 1px 3px rgba(5,30,50,0.35)',
                      }
                    : // Unselected sits on the blue bar, so it reads as a pale
                      // card with its own colour on it rather than a wash that
                      // the bar would swallow.
                      { background: '#FFFFFF', color: '#154360', border: `1px solid ${color}` }
                }
                title={group.description}
              >
                <Icon
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: isSelected ? readableOn(color) : color === '#D9ED92' ? '#7CA82B' : color }}
                />
                {/* A long module name is clipped rather than allowed to push
                    its neighbours out of the strip; the full name is the
                    button's tooltip. */}
                <span className="truncate text-sm font-medium">{labelOf(group)}</span>
              </button>
            )
          })}
        </div>
      </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <h3 className="text-xs font-semibold text-black mb-2">Chart View</h3>

      <div className="space-y-1">
        {availableGroups.map((group, i) => {
          const Icon = iconMap[group.id] || (tradeIds.has(group.id) ? Ship : BarChart3)
          const isSelected = selectedChartGroup === group.id
          // The sidebar carries the same colour per section as the strip, so a
          // reader who learns one layout knows the other.
          const color = chartGroupColor(group.id, i)

          return (
            <button
              key={group.id}
              onClick={() => setSelectedChartGroup(group.id)}
              className="w-full text-left px-2 py-1.5 rounded transition-all duration-200 flex items-center space-x-2"
              style={
                isSelected
                  ? { background: color, color: readableOn(color), boxShadow: '0 1px 3px rgba(15,61,92,0.25)' }
                  : { background: tintOf(color, '33'), color: '#154360' }
              }
              title={group.description}
            >
              <Icon
                className="w-3 h-3 flex-shrink-0"
                style={{ color: isSelected ? readableOn(color) : color === '#D9ED92' ? '#154360' : color }}
              />
              <span className="text-xs font-medium leading-tight">
                {group.label === 'Coherent Opportunity Matrix'
                  ? <span>Coherent Opportunity<br/>Matrix</span>
                  : group.id === 'distributor-intelligence'
                    ? <span>{distributorShortLabel(dashboardName)}</span>
                    : group.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100">
        <p className="text-[10px] text-black leading-tight">
          {availableGroups.find(g => g.id === selectedChartGroup)?.description || 'Select a view to see related charts'}
        </p>
      </div>
    </div>
  )
}
