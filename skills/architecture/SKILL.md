---
description: Model, change, query or draw this repository's architecture (software, infrastructure, servers, VMs, Kubernetes, networks) in .architecture-kit/ and render diagrams for review.
argument-hint: "[what to model, change, ask or draw]"
disable-model-invocation: true
---

# architecture-kit

Request: $ARGUMENTS

1. Read the guide `${CLAUDE_PLUGIN_ROOT}/guide/modelling.md` completely before doing anything else, and follow it.
2. If `.architecture-kit/` doesn't exist in the repository root, set it up first, following the steps in
   `${CLAUDE_PLUGIN_ROOT}/skills/init/SKILL.md` (derive name and title from the repository), and skip that
   skill's final message.
3. Work on the request using the guide's workflow: understand → change the model → check → render → look at
   every changed image yourself → fix.
   - If the request is only a question about the architecture, answer it from the model (MCP queries or the
     `.c4` files) and change nothing unless asked.
   - If the request is empty, summarise what the model contains and which views exist.
4. End with the guide's **final message**: where the files are.
