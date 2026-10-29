// Converts a computed LikeC4 deployment view into D2 source.
// LikeC4 stays the model; D2 (ELK layout) draws deployment/network views because it handles nested
// infrastructure (server → NIC/VM → interfaces → node → pods) and cross-host links much better than
// LikeC4's own Graphviz layout. Labels show technology and addressing metadata (VLAN, CIDR, IP).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// LikeC4 theme colors → D2 colors. `fill`/`stroke`/`font` for leaf nodes, `tint` for containers.
const PALETTE = {
  primary: { fill: '#3b82f6', stroke: '#1d4ed8', font: '#ffffff', tint: '#eff6ff', dark: '#1e3a8a' },
  secondary: { fill: '#0ea5e9', stroke: '#0369a1', font: '#ffffff', tint: '#f0f9ff', dark: '#075985' },
  muted: { fill: '#64748b', stroke: '#475569', font: '#ffffff', tint: '#f8fafc', dark: '#334155' },
  gray: { fill: '#737373', stroke: '#525252', font: '#ffffff', tint: '#f5f5f5', dark: '#404040' },
  green: { fill: '#16a34a', stroke: '#15803d', font: '#ffffff', tint: '#f0fdf4', dark: '#14532d' },
  amber: { fill: '#d97706', stroke: '#b45309', font: '#ffffff', tint: '#fffbeb', dark: '#78350f' },
  indigo: { fill: '#6366f1', stroke: '#4338ca', font: '#ffffff', tint: '#eef2ff', dark: '#312e81' },
  red: { fill: '#dc2626', stroke: '#b91c1c', font: '#ffffff', tint: '#fef2f2', dark: '#7f1d1d' },
}
const colorOf = name => PALETTE[name] ?? PALETTE.primary

const SHAPES = {
  storage: 'cylinder',
  cylinder: 'cylinder',
  queue: 'queue',
  person: 'person',
  bucket: 'stored_data',
  document: 'page',
  agent: 'hexagon',
}

const ARROWHEADS = {
  normal: { shape: 'triangle' },
  onormal: { shape: 'triangle', filled: false },
  diamond: { shape: 'diamond' },
  odiamond: { shape: 'diamond', filled: false },
  crow: { shape: 'cf-many' },
  vee: { shape: 'arrow' },
  open: { shape: 'arrow' },
}

const DIRECTIONS = { TB: 'down', BT: 'up', LR: 'right', RL: 'left' }

// Metadata keys shown under a node title, in this order
const ADDRESSING = [
  ['vlan', v => `VLAN ${v}`],
  ['cidr', v => v],
  ['ip', v => v],
  ['wan_ip', v => `WAN ${v}`],
  ['listen_port', v => `:${v}`],
]

// D2 keys: a view may skip hierarchy levels (e.g. show an interface directly inside its server when the
// VM is not in the view), so D2 paths follow the *view* hierarchy, not the model id. Each node gets one
// flat, unique key derived from its full id; its D2 path is the chain of keys of its view ancestors.
const D2_RESERVED = new Set([
  'label', 'style', 'shape', 'icon', 'near', 'class', 'classes', 'direction', 'width', 'height',
  'link', 'tooltip', 'constraint', 'vars', 'source-arrowhead', 'target-arrowhead', 'grid-rows',
  'grid-columns', 'top', 'left', 'filled', 'layers', 'scenarios', 'steps', '_',
])
const d2Key = id => {
  const key = id.replaceAll('.', '__')
  return D2_RESERVED.has(key) ? `${key}_` : key
}
const q = text => JSON.stringify(text)

/** Renders a LikeC4 icon (e.g. 'tech:kubernetes') to an SVG file once; returns its path or null. */
async function iconFile(icon, color, iconDir) {
  if (!icon || icon === 'none' || !icon.includes(':')) return null
  const [pack, name] = icon.split(':')
  const file = path.join(iconDir, `${pack}-${name}-${color.replace('#', '')}.svg`)
  if (existsSync(file)) return file
  try {
    const mod = await import(`@likec4/icons/${pack}/${name}`)
    const svg = renderToStaticMarkup(createElement(mod.default, { width: 64, height: 64, color }))
    mkdirSync(iconDir, { recursive: true })
    writeFileSync(file, svg)
    return file
  } catch {
    return null
  }
}

function nodeLabel(node, isContainer) {
  const meta = node.deployment?.metadata ?? {}
  const addressing = ADDRESSING.filter(([k]) => meta[k]).map(([k, fmt]) => fmt(meta[k])).join(' · ')
  const redundant = t => node.title.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(node.title.toLowerCase())
  const tech = node.technology && node.technology !== 'any' && !redundant(node.technology) ? node.technology : ''
  if (isContainer) return [node.title, [tech, addressing].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')
  return [node.title, tech, addressing].filter(Boolean).join('\n')
}

// ───────────── Layout rules ─────────────
//
// 1. Twins: top-level nodes with identical structure (e.g. two servers built the same way) are placed side by
//    side in a D2 grid; all other top-level nodes go in a row above them. ELK lays out each grid cell on its
//    own, so identical content gets an identical layout.
// 2. Through the tunnel: D2 draws edges between grid cells as straight lines, so cross-host edges must be
//    rare. Overlay traffic between two hosts joined by a vpn tunnel is drawn from each endpoint to its local
//    tunnel interface; the tunnel edge lists what it carries. That is also how the traffic physically flows.
// 3. Aspect ratio: renderDeploymentView() renders alternatives and keeps the one closest to 2:3 (height:width):
//    with twins, side by side vs. stacked (ELK ignores `direction` inside grid cells); otherwise both directions.

const signature = node => `${node.kind}(${[...node.children()].map(signature).sort().join(',')})`

function findTwins(roots) {
  const groups = new Map()
  for (const r of roots) {
    if (!r.hasChildren()) continue
    const sig = signature(r)
    groups.set(sig, [...(groups.get(sig) ?? []), r])
  }
  return [...groups.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length)[0] ?? []
}

const plainEdge = edge => {
  const e = edge.$edge
  return {
    source: e.source, target: e.target, label: e.label ?? '', technology: e.technology ?? '',
    kind: e.kind, color: e.color, line: e.line, head: e.head ?? 'normal', tail: e.tail ?? 'none',
  }
}

/** Rule 2: replace overlay edges between tunnel-connected hosts by edges to the local tunnel interfaces. */
function routeThroughTunnels(view, edges) {
  const parentOf = new Map([...view.nodes()].map(n => [n.id, n.parent?.id ?? null]))
  const isInside = (id, ancestor) => {
    for (let p = parentOf.get(id); p; p = parentOf.get(p)) if (p === ancestor) return true
    return false
  }
  const tunnels = edges.filter(e => e.kind === 'vpn')
  const result = []
  const seen = new Set()
  for (const e of edges) {
    const tunnel = e.kind === 'overlay' && tunnels.find(t => {
      const [hostA, hostB] = [parentOf.get(t.source), parentOf.get(t.target)]
      return hostA && hostB && ((isInside(e.source, hostA) && isInside(e.target, hostB)) ||
        (isInside(e.source, hostB) && isInside(e.target, hostA)))
    })
    if (!tunnel) {
      result.push(e)
      continue
    }
    const sourceSide = isInside(e.source, parentOf.get(tunnel.source)) ? tunnel.source : tunnel.target
    const targetSide = sourceSide === tunnel.source ? tunnel.target : tunnel.source
    // Always written as (component, tunnel interface) so both hosts get identically directed edges and
    // therefore identical layouts; the real direction of the traffic moves into the arrowheads.
    const toTunnel = { ...e, source: e.source, target: sourceSide }
    const fromTunnel = { ...e, source: e.target, target: targetSide, head: e.tail, tail: e.head }
    for (const local of [toTunnel, fromTunnel]) {
      const key = `${local.source}|${local.target}|${local.label}|${local.head}|${local.tail}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(local)
    }
    tunnel.carries = [...new Set([...(tunnel.carries ?? []), e.label])]
  }
  return result
}

/**
 * @param view     computed LikeC4 deployment view (LikeC4Model view)
 * @param iconDir  directory for generated icon SVGs
 * @param options  { direction } overrides the view's autoLayout direction ('down' | 'right' | ...);
 *                 { twinsArrangement } 'columns' (twins side by side, default) or 'rows' (stacked)
 * @returns D2 source text
 */
export async function deploymentViewToD2(view, iconDir, { direction, twinsArrangement = 'columns' } = {}) {
  const out = []
  direction ??= DIRECTIONS[view.$view.autoLayout?.direction] ?? 'down'
  out.push(`# Generated from LikeC4 view '${view.id}' by scripts/d2.mjs. Do not edit.`, `direction: ${direction}`, '')

  const d2Path = new Map()
  const emitNode = async (node, indent, parentPath) => {
    const pad = '  '.repeat(indent)
    const children = [...node.children()]
    const isContainer = children.length > 0
    const c = colorOf(node.color)
    const key = d2Key(node.id)
    d2Path.set(node.id, parentPath ? `${parentPath}.${key}` : key)
    out.push(`${pad}${key}: ${q(nodeLabel(node, isContainer))} {`)
    const shape = !isContainer && (node.kind === 'internet' ? 'cloud' : SHAPES[node.shape])
    if (shape) out.push(`${pad}  shape: ${shape}`)
    const style = isContainer || shape === 'cloud'
      ? { fill: c.tint, stroke: c.stroke, 'font-color': c.dark, 'stroke-dash': node.kind === 'vm' || node.kind === 'internet' ? 4 : 0, 'border-radius': 6 }
      : { fill: c.fill, stroke: c.stroke, 'font-color': shape === 'person' ? c.dark : c.font, 'border-radius': 4, bold: true }
    if (node.style?.multiple && !isContainer) style.multiple = true
    out.push(`${pad}  style: {${Object.entries(style).map(([k, v]) => `${k}: ${typeof v === 'string' ? q(v) : v}`).join('; ')}}`)
    // Icons only on containers: D2 scales icons inside leaf boxes far too large.
    const icon = isContainer && (await iconFile(node.icon, c.stroke, iconDir))
    if (icon) out.push(`${pad}  icon: ${q(icon)}`)
    for (const child of children) await emitNode(child, indent + 1, d2Path.get(node.id))
    out.push(`${pad}}`)
  }

  // Rule 1: twins side by side, everything else in a row above
  const roots = [...view.roots()]
  const twins = findTwins(roots)
  const invisible = 'style: {fill: transparent; stroke-width: 0}'
  if (twins.length > 0) {
    const others = roots.filter(r => !twins.includes(r))
    out.push(`grid-rows: ${others.length > 0 ? 2 : 1}`, 'vertical-gap: 120', '')
    if (others.length === 1) {
      await emitNode(others[0], 0, null)
    } else if (others.length > 1) {
      out.push(`row_top: "" {`, `  grid-columns: ${others.length}`, '  horizontal-gap: 120', `  ${invisible}`)
      for (const r of others) await emitNode(r, 1, 'row_top')
      out.push('}')
    }
    const stacked = twinsArrangement === 'rows'
    out.push(`row_twins: "" {`, `  ${stacked ? 'grid-rows' : 'grid-columns'}: ${twins.length}`,
      `  ${stacked ? 'vertical-gap' : 'horizontal-gap'}: 260`, `  ${invisible}`)
    for (const r of twins) await emitNode(r, 1, 'row_twins')
    out.push('}')
  } else {
    for (const r of roots) await emitNode(r, 0, null)
  }
  out.push('')

  // Rule 2: overlay traffic through tunnels
  const edges = routeThroughTunnels(view, [...view.edges()].map(plainEdge))

  // ELK routes edges in input order, so twins only look identical if their edges arrive in the same order:
  // sort by the path relative to the twin that contains both ends.
  const twinPrefix = new Map()
  const subtree = n => [n, ...[...n.children()].flatMap(subtree)]
  for (const t of twins) for (const n of subtree(t)) twinPrefix.set(n.id, t.id)
  const relative = id => (twinPrefix.has(id) ? id.slice(twinPrefix.get(id).length) : id)
  const sortKey = e => `${relative(e.source)}|${relative(e.target)}|${e.label}|${e.source}`
  edges.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  for (const e of edges) {
    const source = d2Path.get(e.source)
    const target = d2Path.get(e.target)
    if (!source || !target) continue
    if (source.startsWith(`${target}.`) || target.startsWith(`${source}.`)) continue // D2 can't connect to own ancestor
    const c = colorOf(e.color ?? 'gray')
    const connector = e.head !== 'none' && e.tail !== 'none' ? '<->' : e.head !== 'none' ? '->' : e.tail !== 'none' ? '<-' : '--'
    const label = [e.label, e.technology ? `[${e.technology}]` : '', ...(e.carries ? ['carries:', ...e.carries] : [])]
      .filter(Boolean).join('\n')
    const dash = e.line === 'solid' ? 0 : e.line === 'dotted' ? 2 : 5
    const width = e.kind === 'vpn' ? 3 : 2
    out.push(`${source} ${connector} ${target}: ${q(label)} {`)
    out.push(`  style: {stroke: ${q(c.stroke)}; stroke-width: ${width}; stroke-dash: ${dash}; font-color: ${q(c.dark)}; italic: false}`)
    for (const [end, kind] of [['target-arrowhead', e.head], ['source-arrowhead', e.tail]]) {
      const a = ARROWHEADS[kind]
      if (!a) continue
      out.push(`  ${end}.shape: ${a.shape}`)
      if (a.filled === false) out.push(`  ${end}.style.filled: false`)
    }
    out.push('}')
  }
  return out.join('\n') + '\n'
}

const pngSize = file => {
  const header = readFileSync(file).subarray(16, 24)
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) }
}

/**
 * Rule 3: renders layout alternatives and keeps the image whose height:width is closest to 2:3.
 * The D2 sources and candidate images stay in workDir for inspection.
 * @returns {{ layout: string, ratio: number }}
 */
export async function renderDeploymentView(view, outPng, { workDir, iconDir }) {
  const own = DIRECTIONS[view.$view.autoLayout?.direction] ?? 'down'
  const other = { down: 'right', up: 'left', right: 'down', left: 'up' }[own]
  const options = findTwins([...view.roots()]).length > 0
    ? [{ twinsArrangement: 'columns' }, { twinsArrangement: 'rows' }]
    : [{ direction: own }, { direction: other }]
  mkdirSync(workDir, { recursive: true })
  const candidates = []
  for (const option of options) {
    const layout = option.twinsArrangement ? `twins in ${option.twinsArrangement}` : option.direction
    const name = `${view.id}.${layout.replaceAll(' ', '-')}`
    const d2File = path.join(workDir, `${name}.d2`)
    const png = path.join(workDir, `${name}.png`)
    writeFileSync(d2File, await deploymentViewToD2(view, iconDir, option))
    execFileSync('d2', ['--layout', 'elk', '--pad', '40', d2File, png], { stdio: 'ignore' })
    const { width, height } = pngSize(png)
    const ratio = height / width
    candidates.push({ layout, ratio, png, score: Math.abs(Math.log(ratio / (2 / 3))) })
  }
  const best = candidates.reduce((a, b) => (b.score < a.score ? b : a))
  copyFileSync(best.png, outPng)
  return { layout: best.layout, ratio: Math.round(best.ratio * 100) / 100 }
}
