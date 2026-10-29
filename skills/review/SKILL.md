---
description: Render this repository's architecture diagrams (.architecture-kit/) and review them visually before handing them over.
argument-hint: "[view ids, default: all]"
disable-model-invocation: true
---

# Render and review the architecture diagrams

Views to review (empty = all): $ARGUMENTS

1. Read `${CLAUDE_PLUGIN_ROOT}/guide/modelling.md`. If `.architecture-kit/` doesn't exist, tell the user to run
   `/architecture-kit:init` and stop.
2. Run `architecture-kit render` from the repository root (with `-f <viewId>` per requested view). If the check
   fails, fix the model first and run it again.
3. Read the render log: every D2 view prints its chosen layout and height:width ratio. Note any view far from
   2:3 / 3:2. That's acceptable when no layout fits, but mention it.
4. Open every rendered image of the requested views with the Read tool and check:
   - labels are readable and nothing overlaps
   - there are no `[...]` merged labels
   - nothing is missing or unexpectedly present compared with the view's description
   - no lines run through boxes, and twins look identical
   - the picture says what the view's title and description promise
5. Fix problems in the model or the view definition, re-render the affected views, and look again.
6. End with the guide's **final message**, plus what you changed and anything you couldn't fix.
