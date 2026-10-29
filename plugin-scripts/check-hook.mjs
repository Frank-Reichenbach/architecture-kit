// PostToolUse hook of the Claude Code plugin: after Claude edits a .c4 file, run `architecture-kit check`
// on its workspace. On errors, exit code 2 feeds the lint output back to Claude so it fixes the model at once.
// No dependencies of its own; the check runs with the kit installed in the workspace.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const file = input.tool_input?.file_path
if (!file || !file.endsWith('.c4')) process.exit(0)

// Nearest folder above the file that holds both a LikeC4 config and an installed kit
let workspace = null
for (let dir = path.dirname(path.resolve(file)); dir !== path.dirname(dir); dir = path.dirname(dir)) {
  if (existsSync(path.join(dir, 'likec4.config.json')) && existsSync(path.join(dir, 'node_modules', 'architecture-kit'))) {
    workspace = dir
    break
  }
}
if (!workspace) process.exit(0)

const kit = path.join(workspace, 'node_modules', 'architecture-kit', 'bin', 'architecture-kit')
const result = spawnSync(process.execPath, [kit, 'check', '--dir', workspace], { encoding: 'utf8' })
if (result.status !== 0) {
  process.stderr.write(`architecture-kit check failed after editing ${path.relative(workspace, file)}:\n${result.stdout}${result.stderr}`)
  process.exit(2)
}
