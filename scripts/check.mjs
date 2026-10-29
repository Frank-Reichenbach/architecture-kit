// Semantic checks on top of `likec4 validate`.
// LikeC4 only checks syntax and references; these rules keep the model complete and
// trustworthy enough that an agent (or a person) can rely on it without looking at pictures.
// Every LikeC4 project in the workspace (each folder with a likec4.config.json) is checked separately.
//
// Usage: node scripts/check.mjs [workspace]   (default: ./model)
// Exit code 1 if any error is found; warnings never fail.

import { LikeC4 } from 'likec4'
import path from 'node:path'

const workspace = path.resolve(process.argv[2] ?? 'model')
const likec4 = await LikeC4.fromWorkspace(workspace, { logger: false })

if (likec4.hasErrors()) {
  for (const e of likec4.getErrors()) {
    console.error(`ERROR  ${path.relative(process.cwd(), e.sourceFsPath)}:${e.line + 1}  ${e.message}`)
  }
  console.error('\nModel has syntax/reference errors. Run `npx likec4 validate model` for details.')
  process.exit(1)
}

const isEmpty = text => !text || text.isEmpty
const relName = r => `${r.source.id} -> ${r.target.id}${r.title ? ` '${r.title}'` : ''}`

// ───────────── IPv4 helpers ─────────────

const ipToInt = ip => {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return parts.reduce((acc, p) => acc * 256 + p, 0)
}
// '10.0.0.0/24' → network range; with host: true, '10.0.0.5/24' (an interface address) is accepted too
const parseCidr = (cidr, { host = false } = {}) => {
  const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(cidr ?? '')
  if (!m) return null
  const addr = ipToInt(m[1])
  const bits = Number(m[2])
  if (addr === null || bits > 32) return null
  const size = 2 ** (32 - bits)
  if (!host && addr % size !== 0) return null
  const first = addr - (addr % size)
  return { addr, first, last: first + size - 1 }
}
const contains = (range, ip) => ip !== null && ip >= range.first && ip <= range.last

// ───────────── Rules for one project ─────────────

async function checkProject(project) {
  const model = await likec4.computedModel(project)
  const errors = []
  const warnings = []
  const error = (where, msg) => errors.push(`${where}: ${msg}`)
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`)

  // Logical model

  for (const el of model.elements()) {
    if (isEmpty(el.description)) error(`element ${el.id}`, 'has no description')
    if ([...el.views()].length === 0) error(`element ${el.id}`, 'is not shown in any view')
  }

  for (const rel of model.relationships()) {
    if (!rel.title) error(`relationship ${relName(rel)}`, 'has no title')
    if (!rel.technology) warn(`relationship ${relName(rel)}`, 'has no technology')
    if (rel.kind === 'async' && rel.source.kind !== 'queue' && rel.target.kind !== 'queue') {
      error(`relationship ${relName(rel)}`, 'is async but neither end is a queue')
    }
  }

  // Dynamic views: every step must be backed by a model relationship (either direction)

  const related = (a, b) =>
    [...model.relationships()].some(r =>
      (r.source.id === a && r.target.id === b) || (r.source.id === b && r.target.id === a))

  for (const view of model.views()) {
    if (!view.isDynamicView()) continue
    for (const edge of view.edges()) {
      const step = `${edge.source.id} -> ${edge.target.id} '${edge.label ?? ''}'`
      if ((edge.$edge.relations ?? []).length === 0 && !related(edge.source.id, edge.target.id)) {
        error(`view ${view.id}`, `step ${step} has no matching relationship in the model`)
      }
    }
  }

  // Deployment model

  const deployment = model.deployment

  for (const node of deployment.nodes()) {
    if (isEmpty(node.description)) error(`deployment node ${node.id}`, 'has no description')
  }

  for (const rel of deployment.relationships()) {
    if (!rel.title) error(`relationship ${relName(rel)}`, 'has no title')
    if (rel.kind === 'overlay' && !rel.technology) {
      error(`relationship ${relName(rel)}`, 'is overlay traffic but has no technology (say which tunnel/overlay carries it)')
    }
  }

  // Network zones: vlan, cidr, gateway; hosts inside their subnet; no overlaps, unique VLAN per site

  const zones = []
  for (const zone of deployment.nodesOfKind('network')) {
    const meta = zone.metadata ?? {}
    const where = `network ${zone.id}`
    for (const key of ['vlan', 'cidr', 'gateway']) {
      if (!meta[key]) error(where, `missing metadata '${key}'`)
    }
    const range = parseCidr(meta.cidr)
    if (meta.cidr && !range) error(where, `invalid cidr '${meta.cidr}'`)
    if (range && meta.gateway && !contains(range, ipToInt(meta.gateway))) {
      error(where, `gateway ${meta.gateway} is outside ${meta.cidr}`)
    }
    if (range) zones.push({ zone, range, meta })

    for (const host of zone.descendants()) {
      const ip = host.metadata?.ip
      if (range && ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !contains(range, ipToInt(ip))) {
        error(`${host.isDeploymentNode() ? 'deployment node' : 'instance'} ${host.id}`, `ip ${ip} is outside ${zone.id} (${meta.cidr})`)
      }
    }
  }

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i]
      const b = zones[j]
      if (a.range.first <= b.range.last && b.range.first <= a.range.last) {
        error(`network ${a.zone.id}`, `subnet ${a.meta.cidr} overlaps ${b.zone.id} (${b.meta.cidr})`)
      }
      if (a.meta.vlan && a.meta.vlan === b.meta.vlan && a.zone.parent?.id === b.zone.parent?.id) {
        error(`network ${a.zone.id}`, `VLAN ${a.meta.vlan} is also used by ${b.zone.id} on the same site`)
      }
    }
  }

  // Interfaces: ip as address/prefix, unique addresses, both tunnel ends in the same subnet

  const nicAddr = new Map()
  for (const nic of deployment.nodesOfKind('nic')) {
    const ip = nic.metadata?.ip
    if (!ip) continue
    const parsed = parseCidr(ip, { host: true })
    if (!parsed) {
      error(`nic ${nic.id}`, `ip '${ip}' must be address/prefix, e.g. 10.0.0.5/24`)
      continue
    }
    const clash = [...nicAddr].find(([, other]) => other.addr === parsed.addr)
    if (clash) error(`nic ${nic.id}`, `ip ${ip} is also used by ${clash[0]}`)
    nicAddr.set(nic.id, parsed)
  }

  for (const rel of deployment.relationships()) {
    if (rel.kind !== 'vpn') continue
    const a = nicAddr.get(rel.source.id)
    const b = nicAddr.get(rel.target.id)
    if (a && b && a.first !== b.first) {
      error(`relationship ${relName(rel)}`, 'tunnel endpoints are not in the same subnet')
    }
  }

  const stats = [
    `${[...model.elements()].length} elements`,
    `${[...model.relationships()].length} relationships`,
    `${[...deployment.nodes()].length} deployment nodes`,
    `${[...model.views()].length} views`,
  ].join(', ')
  return { errors, warnings, stats }
}

// ───────────── Report ─────────────

let failed = false
for (const project of likec4.projects()) {
  const { errors, warnings, stats } = await checkProject(project)
  for (const w of warnings) console.log(`warn   [${project}] ${w}`)
  for (const e of errors) console.log(`ERROR  [${project}] ${e}`)
  console.log(`${errors.length ? '✗' : '✓'} ${project}: ${errors.length} errors, ${warnings.length} warnings (${stats})`)
  failed ||= errors.length > 0
}

await likec4.dispose()
process.exit(failed ? 1 : 0)
