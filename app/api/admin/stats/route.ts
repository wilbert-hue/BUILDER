import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getMongoClient } from '@/lib/mongodb'
import { getMongoDatabaseName, getMongoCollectionName } from '@/lib/mongo-config'

/**
 * Dashboard categories, derived from the module flags each dashboard already
 * stores, so every dashboard ever saved is classified without a migration.
 *
 *  - demo     : every module on the dashboard is demo
 *  - presales : market analysis is demo, every other module is real
 *  - real     : no module is demo
 *
 * Any other demo/real combination (e.g. real market but a demo quadrant) is
 * also counted as presales, but flagged `partial: true` so it can be told
 * apart from a strict pre-sales dashboard later.
 */
export type DashboardCategory = 'demo' | 'presales' | 'real'

export type ModuleKey =
  | 'market'
  | 'customer'
  | 'distributor'
  | 'pricing'
  | 'b2b'
  | 'b2c'
  | 'quadrant'

export interface ModuleState {
  key: ModuleKey
  demo: boolean
}

/** True when the field holds a value (any non-null, non-missing type). */
const has = (field: string) => ({
  $not: [{ $in: [{ $type: field }, ['missing', 'null']] }],
})
const anyOf = (...fields: string[]) => ({ $or: fields.map(has) })
/** True when `field` is an array with at least one element (mirrors the viewer's `?.length` checks). */
const nonEmpty = (field: string) => ({
  $gt: [{ $size: { $cond: [{ $isArray: field }, field, []] } }, 0],
})
const isTrue = (field: string) => ({ $eq: [field, true] })

function classify(modules: ModuleState[]): { category: DashboardCategory; partial: boolean } {
  const demoCount = modules.filter(m => m.demo).length
  if (demoCount === 0) return { category: 'real', partial: false }
  if (demoCount === modules.length) return { category: 'demo', partial: false }
  const market = modules.find(m => m.key === 'market')
  const strict = !!market?.demo && demoCount === 1
  return { category: 'presales', partial: !strict }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await checkAdminAccess(user.uid)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await getMongoClient()
  const db = client.db(getMongoDatabaseName())
  const collection = db.collection(getMongoCollectionName())
  const usersCollection = db.collection('users')

  // Project only lightweight flags — never the heavy payloads themselves.
  const docs = await collection
    .aggregate([
      {
        $project: {
          ownerId: 1,
          name: 1,
          createdAt: 1,
          currency: 1,
          intelligenceType: 1,
          showDemoNote: 1,
          showDemoQuadrant: 1,
          showDemoB2bSurvey: 1,
          showDemoB2cSurvey: 1,
          staticCustomerProp1: 1,
          staticDistributorProp1: 1,
          hasMarket: anyOf('$data', '$dataCompressed', '$dataS3Key'),
          hasPricing: anyOf('$pricingAnalysisData', '$pricingAnalysisCompressed', '$pricingAnalysisS3Key'),
          // Same rules the dashboard viewer uses to decide whether a module
          // shows. Offloaded (compressed / S3) payloads can't be inspected
          // here, so their presence alone counts.
          hasB2b: {
            $or: [nonEmpty('$b2bSurveyData.segments'), has('$b2bSurveyCompressed'), has('$b2bSurveyS3Key')],
          },
          hasB2c: {
            $or: [nonEmpty('$b2cSurveyData.segments'), has('$b2cSurveyCompressed'), has('$b2cSurveyS3Key')],
          },
          hasQuadrant: {
            $or: [
              nonEmpty('$quadrantData.charted'),
              nonEmpty('$quadrantData.others'),
              has('$quadrantCompressed'),
              has('$quadrantS3Key'),
            ],
          },
          hasCustomerData: {
            $or: [
              nonEmpty('$rawIntelligenceData.rows'),
              nonEmpty('$proposition2Data.rows'),
              nonEmpty('$proposition3Data.rows'),
            ],
          },
          hasDistributorData: {
            $or: [
              nonEmpty('$distributorRawIntelligenceData.rows'),
              nonEmpty('$distributorProposition2Data.rows'),
              nonEmpty('$distributorProposition3Data.rows'),
            ],
          },
          isStaticCustomer: isTrue('$staticCustomerProp1'),
          isStaticDistributor: isTrue('$staticDistributorProp1'),
        },
      },
    ])
    .toArray()

  type Row = {
    id: string
    name: string
    createdAt: string | null
    currency: string
    category: DashboardCategory
    /** Pre-sales that is not strictly "only market analysis is demo". */
    partial: boolean
    modules: ModuleState[]
  }

  const byOwner = new Map<string | null, Row[]>()

  for (const d of docs as any[]) {
    const modules: ModuleState[] = []

    if (d.hasMarket || d.showDemoNote) {
      modules.push({ key: 'market', demo: d.showDemoNote === true })
    }
    // The locked template replaces any uploaded rows, so it wins.
    if (d.isStaticCustomer) modules.push({ key: 'customer', demo: true })
    else if (d.hasCustomerData) modules.push({ key: 'customer', demo: false })

    if (d.isStaticDistributor) modules.push({ key: 'distributor', demo: true })
    else if (d.hasDistributorData) modules.push({ key: 'distributor', demo: false })

    if (d.hasPricing) modules.push({ key: 'pricing', demo: false })

    // An uploaded report always takes precedence over the generated demo.
    if (d.hasB2b) modules.push({ key: 'b2b', demo: false })
    else if (d.showDemoB2bSurvey === true) modules.push({ key: 'b2b', demo: true })

    if (d.hasB2c) modules.push({ key: 'b2c', demo: false })
    else if (d.showDemoB2cSurvey === true) modules.push({ key: 'b2c', demo: true })

    if (d.hasQuadrant) modules.push({ key: 'quadrant', demo: false })
    else if (d.showDemoQuadrant === true) modules.push({ key: 'quadrant', demo: true })

    const row: Row = {
      id: String(d._id),
      name: d.name ?? '',
      createdAt: d.createdAt ?? null,
      currency: d.currency ?? '',
      ...classify(modules),
      modules,
    }
    const owner = d.ownerId ?? null
    if (!byOwner.has(owner)) byOwner.set(owner, [])
    byOwner.get(owner)!.push(row)
  }

  const ownerIds = [...byOwner.keys()].filter(Boolean)
  const userDocs = ownerIds.length
    ? await usersCollection.find({ _id: { $in: ownerIds } as any }).toArray()
    : []
  const emailById = new Map(userDocs.map((u: any) => [u._id, u.email]))

  const emptyCounts = () => ({ demo: 0, presales: 0, real: 0, presalesPartial: 0 })
  const totals = emptyCounts()

  const stats = [...byOwner.entries()]
    .map(([ownerId, dashboards]) => {
      const counts = emptyCounts()
      for (const d of dashboards) {
        counts[d.category]++
        totals[d.category]++
        if (d.partial) {
          counts.presalesPartial++
          totals.presalesPartial++
        }
      }
      dashboards.sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      )
      return {
        email: (ownerId && emailById.get(ownerId)) ?? ownerId ?? '(unknown)',
        ownerId,
        count: dashboards.length,
        counts,
        lastCreated: dashboards[0]?.createdAt ?? null,
        dashboards,
      }
    })
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    stats,
    totals,
    totalDashboards: docs.length,
    totalUsers: stats.filter(s => s.ownerId).length,
  })
}
