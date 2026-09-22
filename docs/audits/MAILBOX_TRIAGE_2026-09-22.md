# Mailbox / current-state audit — 2026-09-22

Documentation-only operational handoff.

## Current state
The scheduled content factory on `master` has failed repeatedly across many runs. Latest inspected run: 35714751748.

Root cause is explicit and reproducible:
- Anthropic API returns HTTP 400;
- message: **credit balance is too low**;
- factory classifies it as `PROVIDER_BALANCE_EXHAUSTED provider=anthropic`;
- workflow exits with documented code **42**.

The workflow itself is behaving fail-closed as designed. This is primarily an operator/billing condition, not evidence of a product-code defect.

## Required action
1. Restore provider capacity/credits for the configured Anthropic relay, OR make an explicit product/ops decision to configure another approved provider.
2. Do **not** silently add an unapproved fallback just to turn CI green.
3. After provider capacity is restored, manually dispatch one content-factory run and confirm one category generates and publication gates complete.
4. If balance is intentionally not being restored, pause/disable the noisy schedule explicitly and document why; do not leave a known-red cron emailing indefinitely.

## Definition of done
- scheduled workflow no longer produces repeated red runs;
- provider decision is documented;
- a post-fix run proves generation + downstream publication behavior;
- no silent quality/provider downgrade was introduced.
