// Converts a computed LikeC4 deployment view into D2 source.
// LikeC4 stays the model; D2 (ELK layout) draws deployment/network views because it handles nested
// infrastructure (server → NIC/VM → interfaces → node → pods) and cross-host links much better than
// LikeC4's own Graphviz layout. Labels show technology and addressing metadata (VLAN, CIDR, IP).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

/**
 * @param view     computed LikeC4 deployment view (LikeC4Model view)
 * @param iconDir  directory for generated icon SVGs
 * @returns D2 source text
 */
export async function deploymentViewToD2(view, iconDir) {
  const out = []
  const direction = DIRECTIONS[view.$view.autoLayout?.direction] ?? 'down'
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
    const shape = !isContainer && SHAPES[node.shape]
    if (shape) out.push(`${pad}  shape: ${shape}`)
    const style = isContainer
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

  for (const root of view.roots()) await emitNode(root, 0, null)
  out.push('')

  for (const edge of view.edges()) {
    const e = edge.$edge
    const source = d2Path.get(e.source)
    const target = d2Path.get(e.target)
    if (!source || !target) continue
    if (source.startsWith(`${target}.`) || target.startsWith(`${source}.`)) continue // D2 can't connect to own ancestor
    const c = colorOf(e.color ?? 'gray')
    const head = e.head ?? 'normal'
    const tail = e.tail ?? 'none'
    const connector = head !== 'none' && tail !== 'none' ? '<->' : head !== 'none' ? '->' : tail !== 'none' ? '<-' : '--'
    const label = [e.label, e.technology ? `[${e.technology}]` : ''].filter(Boolean).join('\n')
    const dash = e.line === 'solid' ? 0 : e.line === 'dotted' ? 2 : 5
    const width = e.kind === 'vpn' ? 3 : 2
    out.push(`${source} ${connector} ${target}: ${q(label)} {`)
    out.push(`  style: {stroke: ${q(c.stroke)}; stroke-width: ${width}; stroke-dash: ${dash}; font-color: ${q(c.dark)}; italic: false}`)
    for (const [end, kind] of [['target-arrowhead', head], ['source-arrowhead', tail]]) {
      const a = ARROWHEADS[kind]
      if (!a) continue
      out.push(`  ${end}.shape: ${a.shape}`)
      if (a.filled === false) out.push(`  ${end}.style.filled: false`)
    }
    out.push('}')
  }
  return out.join('\n') + '\n'
}
