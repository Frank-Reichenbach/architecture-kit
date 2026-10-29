// `architecture-kit init`: scaffolds .architecture-kit/ in a target repository.
// Must not import likec4 or other dependencies: it runs before anything is installed.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_DIR } from './workspace.mjs'

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const KIT_VERSION = JSON.parse(readFileSync(path.join(kitRoot, 'package.json'), 'utf8')).version
export const DEFAULT_KIT_SOURCE = `github:Frank-Reichenbach/architecture-kit#v${KIT_VERSION}`

const toId = text => text.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^[A-Z]/, c => c.toLowerCase())
const json = value => JSON.stringify(value, null, 2) + '\n'

/**
 * @param repoDir   target repository root
 * @param options   { name, title, kitSource, install, log }
 * @returns the created workspace directory
 */
export function init(repoDir, { name, title, kitSource = DEFAULT_KIT_SOURCE, install = true, log = console.log } = {}) {
  const workspace = path.join(repoDir, DEFAULT_DIR)
  if (existsSync(path.join(workspace, 'likec4.config.json'))) {
    throw new Error(`${workspace} is already initialized`)
  }
  name ??= path.basename(path.resolve(repoDir)).toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  title ??= name
  const systemId = toId(name) || 'system'

  mkdirSync(path.join(workspace, 'model'), { recursive: true })
  writeFileSync(path.join(workspace, 'package.json'), json({
    name: `${name}-architecture`,
    private: true,
    description: `Architecture model of ${title} (architecture-kit)`,
    scripts: {
      check: 'architecture-kit check',
      render: 'architecture-kit render',
      serve: 'architecture-kit serve',
    },
    devDependencies: { 'architecture-kit': kitSource },
  }))
  writeFileSync(path.join(workspace, '.gitignore'), 'node_modules/\n.cache/\n')
  writeFileSync(path.join(workspace, 'likec4.config.json'), json({
    $schema: './node_modules/likec4/config/schema.json',
    name,
    title,
    // The shared specification ships with architecture-kit. node_modules is excluded except for the kit.
    include: { paths: ['node_modules/architecture-kit/spec'] },
    exclude: ['node_modules/!(architecture-kit)/**', '**/node_modules/*/node_modules/**', 'renders/**', '.cache/**'],
  }))
  writeFileSync(path.join(workspace, 'model', 'overview.c4'), `// Architecture model of ${title}.
// Element, deployment and relationship kinds come from node_modules/architecture-kit/spec/specification.c4.

model {

  ${systemId} = system '${title}' {
    description 'Describe what ${title} does and for whom.'
  }
}

views {

  view index {
    title 'Overview'
    description 'Who uses ${title} and what it depends on.'
    include *
  }
}
`)
  writeFileSync(path.join(workspace, 'README.md'), `# Architecture

Architecture as code with [architecture-kit](https://github.com/Frank-Reichenbach/architecture-kit).

- **Review:** [\`renders/README.md\`](renders/README.md) lists every diagram.
- **Model:** \`model/**/*.c4\` (LikeC4 DSL). Diagrams are generated from it; never edit \`renders/\` by hand.

| Command (in this folder) | What it does |
|---|---|
| \`npm install && npx architecture-kit setup\` | First time on a machine |
| \`npm run check\` | Validate the model |
| \`npm run render\` | Check, then render all views into \`renders/\` |
| \`npm run serve\` | Interactive diagram browser |
`)
  log(`Created ${path.relative(process.cwd(), workspace) || '.'}/ (project '${name}', kit ${kitSource})`)

  if (install) {
    log('Installing dependencies (npm install) ...')
    execFileSync('npm', ['install', '--no-fund', '--no-audit'], { cwd: workspace, stdio: 'inherit' })
    execFileSync(process.execPath, [path.join(workspace, 'node_modules', 'architecture-kit', 'bin', 'architecture-kit'), 'setup'], {
      cwd: workspace,
      stdio: 'inherit',
    })
  }
  return workspace
}
