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
 *  - mixed    : anything else (e.g. real market but a demo quadrant)
 */
export type DashboardCategory = 'demo' | 'presales' | 'real' | 'mixed'

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
const isTrue = (field: string) => ({ $eq: [field, true] })

function classify(modules: ModuleState[]): DashboardCategory {
  const demoCount = modules.filter(m => m.demo).length
  if (demoCount === 0) return 'real'
  if (demoCount === modules.length) return 'demo'
  const market = modules.find(m => m.key === 'market')
  if (market?.demo && demoCount === 1) return 'presales'
  return 'mixed'
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
          hasB2b: anyOf('$b2bSurveyData', '$b2bSurveyCompressed', '$b2bSurveyS3Key'),
          hasB2c: anyOf('$b2cSurveyData', '$b2cSurveyCompressed', '$b2cSurveyS3Key'),
          hasQuadrant: anyOf('$quadrantData', '$quadrantCompressed', '$quadrantS3Key'),
          hasCustomerData: {
            $or: [
              { $in: ['$intelligenceType', ['customer', 'both']] },
              has('$rawIntelligenceData'),
            ],
          },
          hasDistributorData: {
            $or: [
              { $in: ['$intelligenceType', ['distributor', 'both']] },
              has('$distributorRawIntelligenceData'),
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
      category: classify(modules),
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

  const emptyCounts = (): Record<DashboardCategory, number> => ({
    demo: 0,
    presales: 0,
    real: 0,
    mixed: 0,
  })
  const totals = emptyCounts()

  const stats = [...byOwner.entries()]
    .map(([ownerId, dashboards]) => {
      const counts = emptyCounts()
      for (const d of dashboards) {
        counts[d.category]++
        totals[d.category]++
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
