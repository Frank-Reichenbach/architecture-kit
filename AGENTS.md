# Architecture as code (agent instructions)

This repo holds architecture **models** (LikeC4 DSL, one project per folder in `model/`, with a shared
specification in `model/shared/`) from which all diagrams are rendered. The owner reviews only the rendered
images in `renders/<project>/`; Claude writes and queries the models.

- Before touching `model/`, use the `architecture-diagrams` skill. It has the conventions, DSL gotchas and recipes.
- Query relationships and context through the `likec4` MCP server rather than guessing from pictures.
- Loop: edit `.c4` → `npm run check` → `npm run render` → Read the changed `renders/<project>/*` → fix → commit model and renders together.
- Rendering: deployment/network views go through D2 (`scripts/d2.mjs`, `.png`); everything else through LikeC4 (`.jpg`).
- Never edit `renders/` by hand. Never add a diagram that isn't backed by model elements and relationships.
- `model/trailhead/` is a fictional example; real architectures get their own project.
- `docs/chats/` has the original research chat behind the choice of tools.
