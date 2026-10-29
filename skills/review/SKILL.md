---
name: review
description: Render all architecture diagrams of this repository and review them visually before handing them to the user. Use when the user asks to render, refresh or review the architecture diagrams, or after larger model changes.
---

# Render and review the architecture diagrams

1. Run `architecture-kit render` from the repository root. If the check fails, fix the model first (see the
   `architecture` skill) and run it again.
2. Read the render log: every D2 view prints its chosen layout and height:width ratio. Note any view far from
   2:3 / 3:2. That's acceptable when no layout fits, but mention it.
3. Open every image in `architecture/renders/` (or the views the user asked about) with the Read tool and check:
   - labels are readable and nothing overlaps
   - there are no `[...]` merged labels
   - nothing is missing or unexpectedly present compared with the view's description
   - no lines run through boxes, and twins look identical
   - the picture says what the view's title and description promise
4. Fix problems in the model or the view definition, re-render the affected views
   (`architecture-kit render -f <viewId>`), and look again.
5. Report to the user: the image paths (`architecture/renders/...`, index `architecture/renders/README.md`),
   what changed, and anything you couldn't fix.
