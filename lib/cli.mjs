// Command line of architecture-kit. Loaded by bin/architecture-kit once dependencies are resolvable.

import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { check } from './check.mjs'
import { init, KIT_VERSION } from './init.mjs'
import { hasD2, likec4Bin, render } from './render.mjs'
import { findWorkspace } from './workspace.mjs'

export const USAGE = `architecture-kit ${KIT_VERSION}: architecture models (LikeC4) rendered for review

Usage: architecture-kit <command> [options]

Commands:
  init [--name <name>] [--title <title>] [--kit <npm source>] [--no-install]
                     create architecture/ in the current repository
  setup              install the headless browser for rendering, check that d2 is present
  check              validate the model and run the semantic lint
  render [-p <project>] [-f <view glob>]...
                     check, then render views into renders/ and write renders/README.md
  serve              interactive diagram browser (LikeC4 dev server)
  mcp                LikeC4 MCP server on stdio (used by the Claude Code plugin)
  version            print the version

Options:
  --dir <path>       architecture workspace (default: ./architecture, or the current folder)
`

function parse(argv) {
  const opts = { filters: [] }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir') opts.dir = argv[++i]
    else if (a === '-p' || a === '--project') opts.project = argv[++i]
    else if (a === '-f' || a === '--filter') opts.filters.push(argv[++i])
    else if (a === '--name') opts.name = argv[++i]
    else if (a === '--title') opts.title = argv[++i]
    else if (a === '--kit') opts.kitSource = argv[++i]
    else if (a === '--no-install') opts.install = false
    else rest.push(a)
  }
  return { opts, rest }
}

function workspaceOrExit(opts) {
  const ws = opts.dir ? path.resolve(opts.dir) : findWorkspace()
  if (!ws) {
    console.error('No architecture workspace found (architecture/likec4.config.json). Run `architecture-kit init` first.')
    process.exit(1)
  }
  return ws
}

export async function main(argv) {
  const [command, ...args] = argv
  const { opts } = parse(args)
  switch (command) {
    case 'init':
      init(process.cwd(), opts)
      return 0
    case 'setup': {
      const require = createRequire(import.meta.url)
      const playwrightCli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js')
      console.log('Installing headless Chromium for image export ...')
      execFileSync(process.execPath, [playwrightCli, 'install', '--only-shell', 'chromium'], { stdio: 'inherit' })
      console.log(hasD2()
        ? '✓ d2 found'
        : '! d2 not found: install it (macOS: brew install d2). Without it, network views fall back to LikeC4 rendering.')
      return 0
    }
    case 'check':
      return (await check(workspaceOrExit(opts))) ? 0 : 1
    case 'render':
      return (await render(workspaceOrExit(opts), opts)) ? 0 : 1
    case 'serve':
    case 'mcp': {
      const ws = workspaceOrExit(opts)
      const likec4Args = command === 'serve' ? ['start', ws] : ['mcp', '--stdio', ws]
      const child = spawn(process.execPath, [likec4Bin(), ...likec4Args], { stdio: 'inherit' })
      return await new Promise(resolve => child.on('exit', code => resolve(code ?? 0)))
    }
    case 'version':
    case '--version':
      console.log(KIT_VERSION)
      return 0
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE)
      return 0
    default:
      console.error(`Unknown command '${command}'.\n\n${USAGE}`)
      return 1
  }
}
