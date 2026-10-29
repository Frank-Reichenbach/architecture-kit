// Locating the architecture workspace and its LikeC4 projects.
// Convention: a target repository keeps its architecture in `.architecture-kit/` (override with
// ARCHITECTURE_KIT_DIR). Every folder below it that holds a likec4.config.json is one LikeC4 project.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_DIR = '.architecture-kit'
const SKIP = new Set(['node_modules', 'renders', '.cache', '.git'])

/** The architecture workspace for `cwd`: $ARCHITECTURE_KIT_DIR, ./.architecture-kit, or cwd if it is one. */
export function findWorkspace(cwd = process.cwd()) {
  const candidates = [
    process.env.ARCHITECTURE_KIT_DIR && path.resolve(cwd, process.env.ARCHITECTURE_KIT_DIR),
    path.join(cwd, DEFAULT_DIR),
    cwd,
  ].filter(Boolean)
  return candidates.find(dir => existsSync(path.join(dir, 'likec4.config.json'))) ?? null
}

/** All LikeC4 projects below the workspace: [{ name, title, dir }] */
export function findProjects(workspace) {
  const projects = []
  const walk = dir => {
    const config = path.join(dir, 'likec4.config.json')
    if (existsSync(config)) {
      const { name, title } = JSON.parse(readFileSync(config, 'utf8'))
      projects.push({ name, title: title ?? name, dir })
    }
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry) || entry.startsWith('.')) continue
      const sub = path.join(dir, entry)
      if (statSync(sub).isDirectory()) walk(sub)
    }
  }
  walk(workspace)
  return projects
}
