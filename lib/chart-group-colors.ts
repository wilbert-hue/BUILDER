/**
 * A colour per Chart View section.
 *
 * Every section used to share one green, so the strip read as a single block
 * and only the selected item stood out. Giving each its own colour makes the
 * strip a legend: a reader learns where Customer Intelligence sits by its
 * colour rather than by reading every label.
 *
 * The ramp is the house palette, running light green to deep blue. Sections
 * are placed along it in reading order, so neighbours never share a shade.
 */

/** The palette, light to dark. */
export const CHART_PALETTE = [
  '#D9ED92',
  '#B5E48C',
  '#99D98C',
  '#76C893',
  '#52B69A',
  '#34A0A4',
  '#168AAD',
  '#1A759F',
  '#1E6091',
  '#184E77',
] as const

const GROUP_COLORS: Record<string, string> = {
  taxonomy: '#D9ED92',
  'market-analysis': '#99D98C',
  'coherent-opportunity': '#76C893',
  'customer-intelligence': '#52B69A',
  'distributor-intelligence': '#34A0A4',
  'competitive-intelligence': '#168AAD',
  'pricing-analysis': '#1A759F',
  'b2b-survey': '#1E6091',
  'b2c-survey': '#1A759F',
  'coherent-quadrant': '#184E77',
}

/**
 * The colour for a section. A dashboard's own trade sheets are not in the
 * fixed list, so they walk the palette's darker half by position.
 */
export function chartGroupColor(id: string, index = 0): string {
  return GROUP_COLORS[id] ?? CHART_PALETTE[5 + (index % 5)]
}

/** Perceived lightness of a hex colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Text that stays readable on a given fill. The palette runs from a pale
 * yellow-green to navy, so half of it needs dark type and half light.
 */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.6 ? '#154360' : '#FFFFFF'
}

/** The same colour as a faint wash, for a section that is not selected. */
export function tintOf(hex: string, alpha = '1F'): string {
  return `${hex}${alpha}`
}

/**
 * The band drawn behind the bar under the pointer.
 *
 * Recharts paints that band mid-grey by default, and on a horizontal bar chart
 * it covers the whole row — the bar included — so the colour the reader came to
 * read turns grey exactly when they point at it. A faint wash of the house
 * green marks the row without hiding what is on it.
 */
export const HOVER_BAND = { fill: 'rgba(82, 182, 154, 0.14)' }
