---
name: Mobile artifact registration failure
description: createArtifact fails if artifacts/<slug>/ already exists — recover by backing up, deleting, re-running, restoring
---

# Mobile Artifact Registration

If `createArtifact` returns `"artifacts/<slug>/ already exists"`:

1. Back up custom files: `cp -r artifacts/<slug>/app /tmp/backup && cp -r artifacts/<slug>/context /tmp/backup && cp artifacts/<slug>/constants/colors.ts /tmp/backup && cp artifacts/<slug>/app.json /tmp/backup`
2. Back up the generated icon: `cp artifacts/<slug>/assets/images/icon.png /tmp/icon_backup.png`
3. Delete the directory: `rm -rf artifacts/<slug>/`
4. Re-run `createArtifact` — this will scaffold fresh files AND register the artifact + workflow
5. Restore: copy backed-up files back over the scaffold
6. Re-read all scaffold files you plan to edit (write tool requires prior read)
7. Apply your edits (colors.ts, _layout.tsx, app.json, tabs layout)

**Why:** The scaffold was created in a previous interrupted task without completing registration. `createArtifact` checks for directory existence before registering.

**How to apply:** Any time `createArtifact` returns a slug-exists error for an expo or react-vite artifact.
