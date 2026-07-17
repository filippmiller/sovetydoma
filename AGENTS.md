# Agent instructions — SovetyDoma (1001sovet.ru)

This file defines the agent protocol. It is NOT the source of operational truth.

## Canonical Project Passport / AgentLog Protocol

This repository uses `bd` / beads as the canonical operational memory for the project.

The canonical passport epic is:

**`sovetydoma-cxl`** — Canonical Project Passport / AgentLog

Agent instruction files are not the canonical source of operational truth. They define the protocol. Current operational facts must live in the passport epic and its child beads.

### Start of every session

Before making decisions about deploys, hosting, domains, DNS, email, payments, database, storage, search, queues, auth, integrations, migrations, release process, or project rules, every agent must:

1. Run/read `bd prime`.
2. Read the root passport epic: `bd show sovetydoma-cxl`.
3. Read the relevant child beads for the task.
4. Check whether any existing canonical child already covers the topic before creating a new one.
5. Treat information outside beads as non-canonical until verified.

### During work

If the agent discovers a durable project fact, changes infrastructure, changes env vars, changes providers, changes deploy procedures, changes architecture rules, or finds stale/conflicting information, the agent must update the relevant passport child bead.

### End of every session

Before handoff, the agent must:

1. Update relevant passport child beads with confirmed durable changes.
2. Mark outdated information as `SUPERSEDED YYYY-MM-DD`, not delete it.
3. Mark uncertain information as `UNVERIFIED / NEEDS VERIFICATION`.
4. Add a dated `SESSION CHANGELOG` entry.
5. Verify the bead after editing with `bd show <id>`.
6. Ensure no secret values were written.
7. Commit the `.beads/` changes with the rest of the session's work and push.

### Verification rule

Do not write a claim into `CURRENT TRUTH` unless it was verified by code, config, deployment evidence, provider/CLI output, git history, tests, health endpoints, or explicit owner instruction.

If verification is incomplete, write it under `OPEN QUESTIONS / NEEDS VERIFICATION`.

### No deletion rule

Do not delete canonical passport content, child beads, historical notes, old provider records, old deploy paths, or old assumptions. Preserve history and mark it superseded.

### Secrets rule

Never store API keys, passwords, OAuth secrets, private keys, tokens, or full secret-bearing connection strings in beads, docs, commits, logs, or handoff messages.

Store only variable names, secret locations, and rotation/verification procedures.

### Conflict rule

If beads, docs, code, deployment config, and chat history disagree, do not guess. Investigate, identify the current verified truth, update the relevant passport bead, and record the superseded information.

### Relationship to docs

Docs may explain procedures, but the passport beads must say which docs are current. If a doc becomes stale, mark it stale in the relevant passport bead.

## Hard project rules (protocol-level, verified — details in passport beads)

- **NO-REDEPLOY publishing**: publishing an article must NOT rebuild the site. Use the dynamic publish path. See bead `sovetydoma-0q8` and `docs/NO-REDEPLOY-PUBLISHING.md`.
- **Never build on the VPS** — it only serves prebuilt static files.
- **Worker secrets only via `wrangler secret bulk`** — PowerShell pipe into `secret put` corrupts values with a BOM.
- **Never pipe tsc/build output through head/tail** when the exit code matters.
- Do not deploy or mutate production unless the task requires it.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
