# architecture-kit (instructions for developing the kit)

This repository is both a Claude Code plugin marketplace/plugin and the npm package that target repositories
install into `.architecture-kit/node_modules`. Read `README.md` for the user-facing picture.

| Path | What |
|---|---|
| `.claude-plugin/` | `plugin.json` (plugin manifest, MCP server) and `marketplace.json` (plugin source `./`) |
| `skills/` | `architecture`, `init`, `review`: user-invoked only (`disable-model-invocation: true`) |
| `guide/modelling.md` | Shared instructions all skills read; ends with the mandatory final message to the user |
| `hooks/hooks.json`, `plugin-scripts/` | Lint hook after `.c4` edits; MCP launcher. Dependency-free; they use the kit installed in the target workspace |
| `bin/architecture-kit` | CLI launcher (npm bin and plugin `bin/` on PATH). Delegates to the workspace's pinned kit; `init` and `help` run without dependencies |
| `lib/` | `cli`, `init` (dependency-free), `workspace` (dependency-free), `check` (lint), `render`, `d2` (generator + layout rules) |
| `spec/specification.c4` | Shared LikeC4 specification, included by every target workspace |
| `examples/k8s-cluster/` | Reference model + renders; also the test fixture |
| `docs/notes/` | Background notes (aspect ratio) |
| `test/` | `npm test` (node:test) |

Rules:
- Keep `bin/`, `lib/init.mjs`, `lib/workspace.mjs` and `plugin-scripts/` free of npm dependencies.
- Behaviour changes to the lint or renderer need a test in `test/` and a re-render of the example
  (`node bin/architecture-kit render --dir examples/k8s-cluster`); look at the images.
- Keep `guide/modelling.md` in sync with the specification, the lint rules and the layout rules.
- Skills stay `disable-model-invocation: true` and end with the guide's final message (tests enforce both).
- `package.json`, `package-lock.json` and `.claude-plugin/plugin.json` carry the same version; releases are tags
  `v<version>`.
- `claude plugin validate .` must pass.
