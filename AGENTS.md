# Architecture as code (agent instructions)

This repo holds an architecture **model** (LikeC4 DSL in `model/`) from which all diagrams are rendered.
The owner reviews only the rendered images in `renders/`; Claude writes and queries the model.

- Before touching `model/`, use the `architecture-diagrams` skill. It has the conventions, DSL gotchas and recipes.
- Query relationships and context through the `likec4` MCP server rather than guessing from pictures.
- Loop: edit `.c4` → `npm run check` → `npm run render` → Read the changed `renders/*.jpg` → fix → commit model and renders together.
- Never edit `renders/` by hand. Never add a diagram that isn't backed by model elements and relationships.
- `docs/chats/` has the original research chat behind the choice of tools.
