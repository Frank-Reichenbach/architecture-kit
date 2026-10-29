# architecture-kit (agent instructions for developing the kit)

This repo is both a Claude Code plugin marketplace/plugin and the npm package that target repositories install
into `architecture/node_modules`. Read `README.md` for the user-facing picture.

| Path | What |
|---|---|
| `.claude-plugin/` | `plugin.json` (plugin manifest, MCP server) and `marketplace.json` (plugin source `./`) |
| `skills/` | Plugin skills: `architecture` (main), `init`, `review`. They are the agent's instructions in target repos |
| `hooks/hooks.json`, `plugin-scripts/` | Lint hook after `.c4` edits; MCP launcher. Dependency-free, they delegate to the kit installed in the target workspace |
| `bin/architecture-kit` | CLI launcher (npm bin and plugin `bin/` on PATH). `init` and `help` run without dependencies |
| `lib/` | `cli`, `init` (dependency-free), `workspace`, `check` (lint), `render`, `d2` (generator + layout rules) |
| `spec/specification.c4` | Shared LikeC4 specification, included by every target workspace |
| `examples/k8s-cluster/` | Reference model + renders; also the test fixture |
| `test/` | `npm test` (node:test) |

Rules:
- Keep `bin/`, `lib/init.mjs`, `lib/workspace.mjs` and `plugin-scripts/` free of npm dependencies.
- Behaviour changes to the lint or renderer need a test in `test/` and a re-render of the example
  (`node bin/architecture-kit render --dir examples/k8s-cluster`); look at the images.
- Keep `skills/architecture/SKILL.md` in sync with the specification, the lint rules and the layout rules.
- Versions: `package.json` and `.claude-plugin/plugin.json` carry the same version; releases are tags `v<version>`.
- `claude plugin validate .` must pass.
