---
name: init
description: Set up architecture-as-code (architecture-kit) in the current repository by creating the architecture/ workspace. Use when the user wants to start documenting or drawing the architecture of a repository that has no architecture/ folder yet.
---

# Set up architecture/ in this repository

1. Check that `architecture/` doesn't exist yet. If it does, stop and use the `architecture` skill instead.
2. Check the prerequisites and tell the user what's missing (don't install system software yourself):
   - Node.js 20 or later: `node --version`
   - D2: `d2 --version` (macOS: `brew install d2`). Without it, network views fall back to a weaker
     rendering. Continue anyway.
3. From the repository root run:

   ```bash
   architecture-kit init --name <kebab-case-name> --title "<Human readable title>"
   ```

   This creates `architecture/` (package.json pinning the kit version, LikeC4 config, a starter model,
   README, .gitignore), runs `npm install`, and downloads the headless browser used for rendering
   (`architecture-kit setup`). Pass `--no-install` to only scaffold.
4. Replace the starter system in `architecture/model/overview.c4` with what the user describes, following the
   `architecture` skill. Then run `architecture-kit render` and look at the images.
5. Tell the user:
   - the review index is `architecture/renders/README.md`
   - `architecture/node_modules/` and `.cache/` are git-ignored; model and renders belong in git
   - on another machine: `cd architecture && npm install && npx architecture-kit setup`
