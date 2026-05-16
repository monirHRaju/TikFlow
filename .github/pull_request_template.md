<!--
Conventional commit prefix in the title:
  feat | fix | docs | chore | refactor | test | perf
For phase-scoped PRs, prefix with phase, e.g. `feat(p0): bootstrap monorepo`.
Target diff size: <= 400 lines (excluding lockfiles, generated files, fixtures).
-->

## Summary

<!-- 1-3 sentences. What does this PR change, and *why*? The diff already shows the *what*. -->

## Phase / scope

<!-- e.g. Phase 0 — PR-0.6 — CI pipeline -->

## Checklist (Definition of Done)

- [ ] No new `any` / `@ts-ignore` (or justified inline)
- [ ] Tests added or updated; all green locally + in CI
- [ ] Strings extracted to `packages/i18n/messages/en.json`
- [ ] `axe-core` passes in Playwright (no serious/critical) — once Playwright lands
- [ ] No new high/critical from `pnpm audit`
- [ ] No secrets in diff (`.env*` not committed)
- [ ] `CLAUDE.md` or relevant `docs/` updated if conventions changed
- [ ] Migrations include RLS policy + RLS test (if new tenant-scoped table)
- [ ] Deployed to staging and smoke-tested

## Notes for reviewer

<!-- Anything tricky, deferred, or risky. Trade-offs you weighed. -->
