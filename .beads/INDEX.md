# Bead Index

This file is the human-readable discovery point for repo-local bead folders.

## Naming Convention

- Folder: `.beads/BEAD-XXXX/`
- Examples: `BEAD-OPS-001`, `BEAD-AUTH-002`, `BEAD-VK-003`
- Use uppercase bead ids in folders and lowercase bead ids in branch names.

Branch/worktree convention:

```text
branch: codex/<bead-id-lowercase>-<slug>
worktree: ../sovetydoma-<BEAD-ID>
```

Example:

```text
.beads/BEAD-VK-001/
codex/bead-vk-001-vk-autopost
../sovetydoma-BEAD-VK-001
```

## Status Legend

- `todo`: ready to start.
- `running`: active work.
- `blocked`: waiting on a named blocker.
- `review`: ready for review.
- `done`: verified and complete.
- `cancelled`: intentionally abandoned.

## List Active Beads

```bash
node scripts/beads/list-active.mjs
```

Manual fallback:

```bash
Get-ChildItem .beads -Directory -Filter 'BEAD-*'
```

## Create A New Bead

Use the helper:

```bash
node scripts/beads/create-bead.mjs BEAD-OPS-001 "Admin cockpit"
```

Or copy templates manually:

```text
.beads/TEMPLATES/spec.md      -> .beads/BEAD-XXXX/spec.md
.beads/TEMPLATES/status.json  -> .beads/BEAD-XXXX/status.json
.beads/TEMPLATES/result.md    -> .beads/BEAD-XXXX/result.md
.beads/TEMPLATES/review.md    -> .beads/BEAD-XXXX/review.md
.beads/TEMPLATES/handoff.md   -> .beads/BEAD-XXXX/handoff.md
```

Then edit every placeholder before work starts.

## Close A Bead

1. Ensure `spec.md` verification requirements passed.
2. Write `result.md`.
3. Update `handoff.md`.
4. Set `status.json.status` to `done`.
5. Set `status.json.updatedAt` to the current timestamp.

Do not close a bead with missing verification.

## Reopen A Bead

1. Set `status.json.status` to `running` or `blocked`.
2. Add the reason in `review.md`.
3. Update `handoff.md` with the next action.
4. Set `status.json.updatedAt` to the current timestamp.

## Current Beads

Add real bead folders below when they exist:

```text
BEAD-ID        status    title
BEAD-OPS-DA6   running   VK/FB 12-category autopost — complete group/page maps
```
