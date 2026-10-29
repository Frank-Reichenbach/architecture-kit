---
name: architecture
description: Model, change, query or review the architecture of this repository (software, infrastructure, servers, VMs, Kubernetes, networks) as a LikeC4 model in architecture/ and render diagrams for human review. Use whenever a task touches architecture/**/*.c4, asks for an architecture or network diagram, asks how parts of the system relate (dependencies, data flows, which host/VLAN/IP), or asks to render or review diagrams.
---

# Architecture as code (architecture-kit)

The architecture of this repository is **one semantic model** in `architecture/` (LikeC4 DSL). Diagrams are
*views* on that model. The human reviews only the rendered images in `architecture/renders/`. You write and
query the model. Never draw a diagram that isn't backed by model elements and relationships.

If `architecture/` doesn't exist yet, follow the `init` skill of this plugin first.

## Tools

- **CLI** `architecture-kit` (on PATH through the plugin; also `npm run check|render` inside `architecture/`):
  - `architecture-kit check` validates the syntax plus the semantic lint. It must report 0 errors.
  - `architecture-kit render [-f <viewId glob>]` checks, then renders into `architecture/renders/` and
    writes `renders/README.md`. A full render deletes images of removed views.
  - `architecture-kit serve` starts the interactive browser for the human, only on request.
- **Hook:** after every edit of a `.c4` file the plugin runs the check. Errors come back to you; fix them before
  doing anything else.
- **MCP server `likec4`** (this plugin) queries the model:
  - `search-element` finds elements by id, title, kind, tag or metadata
  - `read-element` returns description, metadata, all relationships, views and deployed instances
  - `read-deployment` returns a deployment node or instance with its metadata (VLAN, IPs)
  - `find-relationship-paths` shows how A reaches B. **The default depth is 3**; pass `maxDepth: 5` for
    end-to-end flows.
  - `query-incomers-graph` / `query-outgoers-graph` give recursive dependencies, for impact analysis
  - `query-by-metadata`, `query-by-tags`, `read-view`

  Query the model rather than guessing from images or re-reading every file.

## Workflow

1. **Understand first.** Query the model before changing it. Reuse existing elements; never create a second
   element for something that exists.
2. **Change the model**, not just a view: elements and relationships go in `model { }` / `deployment { }`;
   views only select and style them.
3. **Check** (the hook does it automatically after edits; run `architecture-kit check` after bigger changes).
4. **Render** (`architecture-kit render`, or `-f <viewId>` while iterating).
5. **Look at every image you changed** with the Read tool. Check that labels are readable, there are no `[...]`
   merged labels, nothing is unexpectedly missing or present, there's no edge spaghetti, and twins look
   identical. Fix and re-render.
6. Report the image paths to the human (`architecture/renders/<view>.png|jpg`, index in
   `architecture/renders/README.md`). Commit model and renders together if the human wants commits.

## Files

| Path | Content |
|---|---|
| `architecture/likec4.config.json` | Project name and title; includes the shared specification from the kit |
| `architecture/model/**/*.c4` | The model, split by topic (`overview.c4`, `deployment.c4`, `views.c4`, ...) |
| `architecture/node_modules/architecture-kit/spec/specification.c4` | Shared vocabulary: element, deployment and relationship kinds, tags. **Read it** before modelling. Don't edit it; project-specific kinds go in an extra `specification { }` block in `architecture/model/` |
| `architecture/renders/` | Generated images and index. Never edit by hand |
| `${CLAUDE_PLUGIN_ROOT}/examples/k8s-cluster/` | A complete reference model with renders: 2 servers → VMs → k8s nodes, WireGuard tunnel |

More than one LikeC4 project in a repo: create a sub-folder with its own `likec4.config.json` (the same
`include`/`exclude` as the root config, with paths adjusted). Renders then go to `renders/<project>/`.

## Modelling conventions

- **Kinds** (see the specification): `actor`, `system`, `external`, `webapp`, `mobileapp`, `service`,
  `database`, `queue`, `bucket`, `component`. Deployment: `environment`, `site`, `internet`, `network`
  (= one VLAN/subnet), `firewall`, `switch`, `accesspoint`, `server` (physical), `vm`, `cluster`, `k8snode`,
  `nic` (physical or virtual interface), `device`.
- **Relationship kinds**: none = synchronous call (caller → callee); `async` = message via a queue
  (publisher → queue → consumer); `netlink` = physical/L2 link, cable, bridge, "carries"; `vpn` = tunnel
  between two interfaces; `overlay` = traffic *inside* a tunnel/overlay (its technology must name the
  tunnel, e.g. `'TCP 2380 via wg0'`).
- **Every element and deployment node has a `description`**, every relationship has a title. Add
  `technology` to relationships (protocol/port) and elements (product).
- **Declare relationships between the most specific elements** (containers, not systems). LikeC4 derives
  higher-level edges itself. A relationship to a *system* doesn't appear in deployment views.
- **Deployment views inherit logical relationships only between instances on the same node.** Traffic
  between instances on different hosts must be declared in `deployment { }`, usually as `-[overlay]->`.
- **Addressing metadata** (shown in rendered labels, checked by the lint):
  - `network`: `vlan`, `cidr`, `gateway`. Subnets mustn't overlap, VLANs are unique per site, and the
    gateway and host IPs must sit inside the subnet.
  - hosts: `ip`
  - `nic`: `ip` as address/prefix (`10.10.0.1/24`). Addresses are unique, and both ends of a `vpn` must be
    in the same subnet. Optional `listen_port`.
  - firewalls: `wan_ip`
- **Tags**: `#pii`, `#critical`, `#planned`, `#deprecated`. Views can filter or style by tag.
- **Ids** are lowerCamelCase and stable. Titles are for humans.
- **Unknown values**: use placeholders from documentation ranges (203.0.113.0/24, 198.51.100.0/24, 10.x)
  and say so in a comment at the top of the file.

## How diagrams are rendered

- Deployment views (infrastructure, networks) → D2 with ELK layout → `.png`. All other views → LikeC4 → `.jpg`.
- The D2 renderer applies these layout rules automatically:
  1. **Twins**: top-level nodes with identical structure (e.g. two servers built the same way) go side by
     side with identical internal layout; other top-level nodes (e.g. the internet) go in a row above. Model
     twins identically (same kinds, same nesting, same internal relationships) or they won't line up.
  2. **Through the tunnel**: overlay traffic between hosts joined by a `vpn` tunnel is drawn via each side's
     tunnel interface, and the tunnel label lists what it carries. Show public traffic along its path
     (internet → NIC → eth0 → service), not as a direct client → service edge.
  3. **Aspect ratio, a rule of thumb**: about 2:3 or 3:2 (5:8 / golden ratio is fine too). The renderer tries
     alternatives and keeps the closest. Readability beats ratio. The render log shows the chosen layout
     and ratio.

## DSL gotchas (verified with LikeC4 1.59)

- Tags must be the **first** line inside an element body: `orders = service 'Orders' { #critical ... }`.
- `link` is a keyword, so it can't be a kind name.
- From another file, nested elements need their full name: `shop.eventBus`.
- `include -> x` only adds relationships to elements already in the view; use `include x, * -> x, x -> *`.
- `a.b.*.*` and a bare `**` are invalid. Use `a.b.**`, list the levels, and include the parent itself when its
  links matter (`wan, wan.**`).
- In deployment views, `x -> *` matches top-level nodes only. Name targets explicitly.
- Filter edges by kind: `exclude * -> * where kind is not netlink and kind is not vpn`. A later
  `include a -> b` re-adds specific edges.
- Bidirectional kinded relationship: `a -[overlay]<-> b`.
- Two relationships with different titles between the same pair of boxes merge into `[...]`. Remove the
  redundancy or show inner elements.
- Dynamic views: every step must match a model relationship in either direction (lint). Use `A <- B` for
  replies and `parallel { }` for fan-out. They render as sequence diagrams.
- Icons: `icon tech:postgresql`, `icon bootstrap:wifi`, `aws:`, `azure:`, `gcp:`. Check that an icon exists
  with `npx likec4 list-icons | grep <name>` inside `architecture/`.

## Recipes

**Servers / VMs / Kubernetes**: `server` > `nic` (physical) + `vm` > `nic` (eth0, wg0, ...) + `k8snode` >
`instanceOf` the logical components. Cable with `-[netlink]->` (internet → physical NIC → eth0 → tunnel
interface). The tunnel is `-[vpn]->` between the tunnel interfaces. Cross-node traffic is `-[overlay]->`
between instances. See the example in `${CLAUDE_PLUGIN_ROOT}/examples/k8s-cluster/model/`.

**New system**: a top-level element (`system` / `external`), its containers in `extend <system> { }`,
relationships between containers, and `view <system>Containers of <system> { include * }`.

**New network zone**: `name = network 'Title' { description ... metadata { vlan, cidr, gateway } }` inside the
site, with hosts in it, cabled with `-[netlink]->`, and included in a network view.

**New scenario**: `dynamic view <id> { title, description, steps }`. If a step has no relationship yet,
decide whether the model is missing it or the step is wrong.
