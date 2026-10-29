# architecture-kit

Architecture as code for [Claude Code](https://claude.com/claude-code). Claude models your software,
infrastructure and networks as one semantic [LikeC4](https://likec4.dev) model inside your repository, keeps
it consistent with a lint, and renders diagrams for you to review. You read pictures; Claude works on and
queries the model.

![Example: two servers, VMs, Kubernetes nodes and a WireGuard tunnel](examples/k8s-cluster/renders/network.png)

*Rendered from [`examples/k8s-cluster/model/`](examples/k8s-cluster/model/). All views:
[`examples/k8s-cluster/renders/README.md`](examples/k8s-cluster/renders/README.md).*

## What you get

| Part | What it does |
|---|---|
| **Skill `architecture`** | Teaches Claude the modelling conventions, the element kinds, the DSL pitfalls, recipes (servers/VMs/Kubernetes, network zones, scenarios), and the edit → check → render → look-at-it loop |
| **Skills `init`, `review`** | `/architecture-kit:init` sets up `architecture/` in a repository; `/architecture-kit:review` renders and visually reviews all diagrams |
| **MCP server `likec4`** | Lets Claude query the model: dependencies, paths between elements, impact analysis, metadata such as VLANs and IPs |
| **Hook** | After every edit of a `.c4` file the model is checked; errors go straight back to Claude |
| **CLI `architecture-kit`** | `init`, `setup`, `check`, `render`, `serve`; on Claude's PATH through the plugin, and in `architecture/` via `npm run` |
| **Shared specification** | One vocabulary for all repos: element kinds (systems, services, databases, ...), infrastructure (servers, VMs, Kubernetes nodes, NICs, networks, firewalls), and relationship kinds (calls, async, links, VPN tunnels, in-tunnel traffic) |
| **Semantic lint** | Descriptions everywhere, every element in some view, scenarios match real relationships, valid and non-overlapping subnets/VLANs, interface addresses, tunnel ends in one subnet, ... |
| **Renderer** | LikeC4 draws landscapes, containers and sequences; D2 (ELK layout) draws infrastructure and network views with VLAN/subnet/IP labels, identical layouts for identical servers, traffic routed through tunnels, and a ratio of about 2:3 ([why](docs/notes/aspect-ratio.md)) |

## Requirements (once per machine)

| Software | Needed for | Install |
|---|---|---|
| Node.js ≥ 20 with npm | everything | [nodejs.org](https://nodejs.org) or your package manager |
| D2 | infrastructure and network diagrams (without it they fall back to a simpler rendering) | macOS: `brew install d2`, others: [d2lang.com](https://d2lang.com) |
| Claude Code | the agent side | [claude.com/claude-code](https://claude.com/claude-code) |
| Headless Chromium (~100 MB) | image export | installed automatically by `architecture-kit init` / `setup` |

LikeC4 and the rest are **not** installed globally. Each repository pins the kit version in
`architecture/package.json` and installs it into `architecture/node_modules`, so a repository keeps rendering
the same way until you update it.

## Install the plugin

In Claude Code:

```
/plugin install architecture-kit --marketplace Frank-Reichenbach/architecture-kit
```

Or in two steps (also works from the shell with `claude plugin ...`):

```
/plugin marketplace add Frank-Reichenbach/architecture-kit
/plugin install architecture-kit@architecture-kit
```

**Scope:** installed for your user (the default), the plugin is available in every repository. Its MCP server
then shows as *failed* in `/mcp` for repositories without an `architecture/` folder, which is harmless. To enable
it only where you use it, install with project scope from the repository root:
`claude plugin install architecture-kit@architecture-kit --scope project`. This records it in the repository's
`.claude/settings.json`.

## Use it in a repository

1. In the repository, ask Claude *"set up the architecture for this repo"*, or run `/architecture-kit:init`.
   This creates:

   ```
   architecture/
   ├── package.json         pins architecture-kit (github:Frank-Reichenbach/architecture-kit#v<version>)
   ├── likec4.config.json   project name/title, includes the kit's shared specification
   ├── model/overview.c4    starter model, replaced by your architecture
   ├── renders/             generated diagrams + README.md index (commit these)
   ├── README.md
   └── .gitignore           node_modules/, .cache/
   ```

2. Describe your architecture in plain language. For example: *"Two servers, one VM each, Kubernetes on both
   nodes, public ingress on the VMs' public IPs, cluster traffic through a WireGuard tunnel. Draw the network
   with hardware, NICs, VMs and nodes."*
3. Review `architecture/renders/README.md` and give feedback in plain language. Claude changes the model,
   re-renders, and checks the images itself before reporting back.

On another machine: `cd architecture && npm install && npx architecture-kit setup`.

### Commands (inside `architecture/`, or `architecture-kit <command>` from the repository root)

| Command | What it does |
|---|---|
| `npm run check` | Validate the model and run the lint |
| `npm run render` | Check, then render every view into `renders/` and write `renders/README.md` |
| `npx architecture-kit render -f <view glob>` | Render only matching views |
| `npm run serve` | Interactive diagram browser (http://localhost:5173) |

### Fewer permission prompts (optional)

Claude may not change its own permissions. To let it check, render and query without asking every time, add
this to the repository's `.claude/settings.json` (or `.claude/settings.local.json` for yourself only):

```json
{
  "permissions": {
    "allow": [
      "Bash(architecture-kit check*)",
      "Bash(architecture-kit render*)",
      "mcp__plugin_architecture-kit_likec4"
    ]
  }
}
```

### Updating

- **Plugin** (skills, hooks, launcher): `/plugin update architecture-kit`
- **Kit in a repository** (renderer, lint, specification): change the tag in `architecture/package.json`, then
  run `npm install` in `architecture/` and re-render.

## How it works

- **One model, many views.** Every element exists once, with a kind, a description, tags and metadata (VLAN,
  subnet, IP, ...). Every relationship has a direction, a title and a technology. Diagrams select parts of the
  model, so the same element looks the same everywhere.
- **Two renderers.** LikeC4's own renderer is good at C4 landscapes, containers and sequence diagrams.
  Infrastructure and network views go through [`lib/d2.mjs`](lib/d2.mjs), which converts the LikeC4 view to D2
  and applies three layout rules:
  1. *Twins*: identically built top-level nodes (e.g. two servers) are placed side by side with identical
     internal layout; everything else goes in a row above them.
  2. *Through the tunnel*: traffic between hosts joined by a VPN is drawn via each side's tunnel interface; the
     tunnel lists what it carries.
  3. *Aspect ratio*: alternatives are rendered and the one closest to 2:3 / 3:2 (or 5:8) wins; readability
     beats ratio.
- **Lint** ([`lib/check.mjs`](lib/check.mjs)) on top of LikeC4's syntax and reference checks.

## Develop the kit

```bash
npm install
npx architecture-kit setup          # headless browser for rendering tests
npm test                            # lint rules, layout rules, init, full render of the example
node bin/architecture-kit render --dir examples/k8s-cluster
claude --plugin-dir .               # try the plugin from this checkout
claude plugin validate .
```

Release: bump `version` in `package.json` and `.claude-plugin/plugin.json`, re-render the example, commit,
tag `v<version>`, push the tag. `architecture-kit init` pins new repositories to the kit's own version tag.

## Background

- [`docs/chats/open-source-architektursoftware.md`](docs/chats/open-source-architektursoftware.md): the research
  that led to LikeC4 and D2
- [`docs/notes/aspect-ratio.md`](docs/notes/aspect-ratio.md): why diagrams aim for about 2:3, and the golden ratio
