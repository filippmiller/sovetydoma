# Repo Bead Workflow

This repo uses `.beads/` for task folders that future agents can read, update,
review, and close without relying on chat history. The existing `bd` data under
`.beads/` may still exist; this document defines the repo-local folder contract.

## Bead Folder Contract

One bead is one folder:

```text
.beads/BEAD-XXXX/
  spec.md
  status.json
  result.md
  review.md
  handoff.md
```

Required files:

- `spec.md`: objective, scope, constraints, relevant files/modules, verification requirements, final report requirements.
- `status.json`: machine-readable status. It must include `beadId`, `title`, `status`, `priority`, `branch`, `worktree`, `owner`, `createdAt`, `updatedAt`, `dependsOn`, `blockedBy`, and `summary`.
- `result.md`: agent execution result: what changed, verification run, remaining gaps, risks/follow-ups.
- `review.md`: reviewer findings, required fixes, approval/reopen notes.
- `handoff.md`: short operational context for the next agent.

Allowed `status` values:

- `todo`: defined but not started.
- `running`: someone is actively working it.
- `blocked`: work cannot continue without a named blocker.
- `review`: implementation is ready for review, but not closed.
- `done`: verification passed and no required work remains.
- `cancelled`: intentionally abandoned.

## Branch And Worktree Rules

Use one branch and one sibling worktree for every substantial bead.

Naming convention:

- branch: `codex/<bead-id-lowercase>-<slug>`
- worktree: sibling directory `../sovetydoma-<BEAD-ID>`

Example:

```text
bead: .beads/BEAD-OPS-001/
branch: codex/bead-ops-001-admin-cockpit
worktree: ../sovetydoma-BEAD-OPS-001
```

Operating rules:

- Do not work in the main checkout for substantial beads unless the user explicitly says so.
- Create/switch to the bead branch before editing code.
- Update `status.json` to `running` when work starts.
- Keep `status.json.updatedAt` current when status changes.
- Write `result.md` before asking for review or marking done.
- Do not mark `done` unless verification passed.
- If blocked, set `status` to `blocked` and write the blocker in `blockedBy`, `result.md`, and `handoff.md`.
- Reviewers may reopen by changing `status` from `review` or `done` back to `running` or `blocked`.

## Agent Workflow

1. Open `.beads/INDEX.md` and choose a bead.
2. Read the bead `spec.md`, `status.json`, and `handoff.md`.
3. Create or enter the bead worktree and branch.
4. Set `status.json.status` to `running`.
5. Do the work inside the bead branch/worktree.
6. Run the verification listed in `spec.md`.
7. Write `result.md` with exact changes, verification, gaps, and risks.
8. Set status:
   - `review` when work is ready but needs human/agent review.
   - `done` only when verification passed and the bead is complete.
   - `blocked` when there is a concrete blocker.
9. Update `handoff.md` with current state and next action.

## Meaning Of Done, Review, Blocked

- `done`: all scoped work is complete, verification passed, and no required follow-up remains for this bead.
- `review`: implementation is complete enough to inspect, but approval or fixes may still be needed.
- `blocked`: the agent cannot make meaningful progress without external input, credentials, an unavailable service, or a decision.

## Result Requirements

Every `result.md` must include:

- Files changed.
- Behavioral changes.
- Verification commands and outcomes.
- Remaining gaps.
- Risks and follow-ups.
- Commit/deploy references if applicable.

## Templates And Helpers

Templates live in `.beads/TEMPLATES/`.

Optional helpers:

```bash
node scripts/beads/list-active.mjs
node scripts/beads/validate-status.mjs
node scripts/beads/create-bead.mjs BEAD-OPS-001 "Admin cockpit"
```
