---
description: Set up architecture-as-code (architecture-kit) in this repository by creating the .architecture-kit/ workspace.
argument-hint: "[name] [title]"
disable-model-invocation: true
---

# Set up .architecture-kit/ in this repository

Arguments (optional name and title): $ARGUMENTS

1. Read `${CLAUDE_PLUGIN_ROOT}/guide/modelling.md`.
2. If `.architecture-kit/` already exists in the repository root, don't create it again: tell the user it
   exists, run `architecture-kit check`, and continue with step 6.
3. Check the prerequisites and tell the user what's missing (don't install system software yourself):
   - Node.js 20 or later: `node --version`
   - D2: `d2 --version` (macOS: `brew install d2`). Without it, network views fall back to a weaker
     rendering. Continue anyway.
4. From the repository root run:

   ```bash
   architecture-kit init --name <kebab-case-name> --title "<Human readable title>"
   ```

   Use the arguments if given; otherwise derive both from the repository. This creates `.architecture-kit/`
   (package.json pinning the kit version, LikeC4 config, a starter model, README, .gitignore), runs
   `npm install`, and downloads the headless browser used for rendering.
5. Run `architecture-kit render` and look at `.architecture-kit/renders/index.jpg`.
6. End with the guide's **final message**. Also tell the user:
   - to restart Claude Code (or run `/reload-plugins`) so the model-query MCP server finds the new workspace
   - that `node_modules/` and `.cache/` inside `.architecture-kit/` are git-ignored; model and renders belong
     in git
   - on another machine: `cd .architecture-kit && npm install && npx architecture-kit setup`
   - that the next step is `/architecture-kit:architecture <describe the architecture>`
