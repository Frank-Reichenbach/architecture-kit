// MCP server of the Claude Code plugin: starts the LikeC4 MCP server for the repository's architecture
// workspace, using the LikeC4 version installed (and pinned) there. No dependencies of its own.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { findWorkspace } from '../lib/workspace.mjs'

// The plugin manifest passes the project root; the working directory of plugin MCP servers isn't specified.
const projectDir = [process.env.ARCHITECTURE_KIT_PROJECT_DIR, process.env.CLAUDE_PROJECT_DIR]
  .find(dir => dir && !dir.includes('${')) ?? process.cwd()
const workspace = findWorkspace(projectDir)
const likec4 = workspace && path.join(workspace, 'node_modules', 'likec4', 'bin', 'likec4.mjs')

if (!workspace) {
  console.error('architecture-kit: no .architecture-kit/ workspace in this repository. Run /architecture-kit:init to create one.')
  process.exit(1)
}
if (!existsSync(likec4)) {
  console.error(`architecture-kit: dependencies missing in ${workspace}. Run \`npm install\` there.`)
  process.exit(1)
}

const child = spawn(process.execPath, [likec4, 'mcp', '--stdio', workspace], { stdio: 'inherit' })
child.on('exit', code => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
