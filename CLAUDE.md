# CLAUDE.md

Project-wide conventions for Claude Code (and humans). Treat this file as authoritative when generating or reviewing code in this repo. The product spec lives in `Plan.md`; this file is about **how we build it**.

---

## 1. What this repo is

TikFlow is a multi-tenant SaaS for ISPs that automates MikroTik-based subscriber management and billing. See `Plan.md` for product context, architecture, schema, and 16-phase roadmap.

Current phase: **Phase 0 — Foundation, Design System, Security Baseline**.

---

## 2. Tech stack (pinned versions)

| Layer | Tool | Version |
|---|---|---|
| Runtime | Node.js | 22 LTS (`.nvmrc`) |
| Package manager | pnpm | 9.12.x |
| Monorepo orchestrator | Turborepo | 2.3+ |
| Language | TypeScript | 5.6+ (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Linter | ESLint | 9 (flat config) |
| Formatter | Prettier | 3.3+ |
| Web framework | Next.js | 15 (App Router, RSC) |
| API framework | Express | 5 |
| Validation | Zod | latest |
| ORM | Prisma | latest |
| DB | PostgreSQL | 16 (RLS-enforced) |
| Queue | BullMQ on Redis | latest |
| UI | shadcn/ui + Tremor + Tailwind | latest |
| Logger | pino | latest |
| Auth | Auth.js (NextAuth) | latest |
| i18n | next-intl | latest |
| Test | Vitest + Playwright + testcontainers | latest |

Always use the version installed in `package.json`. Do not introduce new framework-level dependencies without updating this file.

---

## 3. Repository layout

```
/apps                  Application surfaces (none yet — added in PR-0.3+)
  /web                 Next.js 15 — admin panel, reseller portal, self-care PWA, field-tech PWA
  /api                 Express 5 gateway — tRPC + REST + webhooks
  /worker-billing      BullMQ workers — invoice, dunning, suspend
  /worker-mikrotik     BullMQ workers — RouterOS API jobs + state sync
  /worker-notify       SMS / email / WhatsApp dispatcher
  /worker-ai           Nightly jobs — churn, payment-risk, NPS sentiment

/packages              Shared libraries
  /config              ESLint, tsconfig, Tailwind preset (this PR)
  /db                  Prisma schema, migrations, seed (PR-0.2)
  /mikrotik            Typed RouterOS client (Phase 3)
  /payments            bKash / Nagad / Rocket adapters (Phase 6)
  /sms                 SMS provider adapters (Phase 4)
  /auth                Shared auth utilities, RBAC (PR-0.5)
  /ui                  shadcn primitives + Tremor wrappers (PR-0.4)
  /contracts           Zod schemas shared by web + api (PR-0.3)
  /i18n                Translation bundles — `en` MVP, `bn` in Phase 14

/infra                 Local dev infra (docker-compose) and ops scripts
/docs                  Engineering docs (threat model, runbooks)
/.github/workflows     CI / security pipelines (PR-0.6)
```

Folders are added by the PR that introduces their first file. Don't create empty placeholder dirs.

---

## 4. Daily commands

```bash
# First-time setup
nvm use                  # Node 22
corepack enable
pnpm install
pnpm infra:up            # Postgres + Redis + MailHog + MinIO + ClamAV in Docker

# Development
pnpm dev                 # All apps in watch mode (via Turbo)
pnpm --filter @tikflow/web dev      # Just one app

# Quality gates (mirror CI)
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format:check

# Database (after PR-0.2 lands)
pnpm db:generate         # Prisma client
pnpm db:migrate          # Apply migrations
pnpm db:seed             # Seed dev data

# Infra
pnpm infra:up
pnpm infra:down
pnpm infra:reset         # Wipe volumes + recreate
pnpm infra:logs
```

Local service URLs:

| Service | URL |
|---|---|
| Postgres | `postgres://tikflow:tikflow@localhost:5432/tikflow` |
| Redis | `redis://localhost:6379` |
| MailHog UI | http://localhost:8025 |
| MinIO Console | http://localhost:9001 (user: `tikflow`, pass: `tikflow-minio-dev`) |
| MinIO S3 API | http://localhost:9000 |
| ClamAV | tcp://localhost:3310 |

---

## 5. How to add a new feature

Every feature goes through this pipeline. Skipping a step is a review-blocker.

1. **DB migration** — add/alter tables in `packages/db/prisma/schema.prisma`. Every new table gets `tenant_id`, `created_at`, `updated_at`, `deleted_at`, **and an RLS policy** in the same migration.
2. **Prisma model regen** — `pnpm db:generate`.
3. **Zod contract** — define request/response schemas in `packages/contracts`. They are the single source of truth for both server validation and client types.
4. **tRPC procedure or REST route** — in `apps/api`. Always inside a tenant-scoped middleware (`SET LOCAL app.current_tenant`). Always rate-limited.
5. **React Query hook** — in `apps/web/lib/hooks` (auto-typed via tRPC).
6. **UI** — page or component using `@tikflow/ui` primitives only (no raw shadcn imports in feature code).
7. **i18n** — every user-visible string goes in `packages/i18n/en.json` from day 1. No hard-coded strings — pseudo-locale CI gate will fail.
8. **Tests** — unit (Vitest) for pure logic, integration (testcontainers) for DB code, Playwright e2e for user flows. **RLS test** mandatory for every new tenant-scoped table.
9. **Docs** — update `CLAUDE.md` if conventions changed; update `docs/` runbook if operational behavior changed.

---

## 6. Forbidden patterns

These will fail review (and most will fail CI):

- `any`, `as any`, `@ts-ignore`, `@ts-expect-error` without an inline justification comment explaining why.
- Raw SQL outside `packages/db`. Inside `packages/db` use Prisma's `Prisma.sql` tagged template — never string concatenation.
- `dangerouslySetInnerHTML`. Sanitize via DOMPurify if absolutely required and document why.
- `new Date()` math for billing/scheduling. Use `date-fns-tz` with the tenant's timezone.
- Hard-coded user-visible strings. Use `next-intl` translations.
- Logging PII. Pino's `redact` paths cover `password`, `token`, `nid`, `pppoeSecret`, etc. — extend the list, don't bypass it.
- Direct `process.env` reads outside a single `env.ts` per app (validated by Zod at boot).
- Cross-tenant queries that don't include `tenantId`. The Prisma extension enforces this; don't disable it.
- Committing secrets, `.env`, private keys, or anything not in `.env.example`.
- Adding a new top-level dependency without justifying in the PR description.

---

## 7. Tenant safety rule (the one that matters most)

Every query that touches tenant data must:

1. Run inside the `tenantContext` middleware, which opens a transaction and runs `SET LOCAL app.current_tenant = $tenantId`.
2. Use the Prisma client extension that auto-injects `where: { tenantId }`.
3. Be covered by an **RLS test** that:
   - Inserts data as Tenant A.
   - Switches the session to Tenant B.
   - Asserts Tenant B sees zero rows even with a forged `where: { tenantId: <A> }`.

If you add a tenant-scoped table without an RLS policy, the migration check in CI will fail.

---

## 8. PR conventions

- One logical change per PR. Target diff: ≤ 400 lines (excluding lockfiles, generated files, test fixtures).
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`.
- Commit body explains **why**, not what — the diff already shows the what.
- A PR isn't done until: types ✅, tests ✅, lint ✅, prettier ✅, axe (a11y) ✅, audit ✅, deployed to staging.
- For phase-scoped PRs, prefix with phase: `feat(p0): bootstrap monorepo`.

---

## 9. Definition of Done (per PR)

- [ ] No new `any` / `@ts-ignore` (or justified inline)
- [ ] Tests added or updated; all green locally + CI
- [ ] Strings extracted to `en` translation bundle
- [ ] `axe-core` passes in Playwright (no serious/critical)
- [ ] No new high/critical from `pnpm audit`
- [ ] No secrets in diff
- [ ] `CLAUDE.md` or relevant `docs/` updated if conventions changed
- [ ] Migrations include RLS policy + RLS test (if new tenant-scoped table)
- [ ] Deployed to staging and smoke-tested

---

## 10. Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Foundation, Design System, Security Baseline | **In progress** | PR-0.1 monorepo+infra ✅, PR-0.2 db+RLS ✅, PR-0.3 Express API ✅, PR-0.4 web+ui+i18n ✅, PR-0.5 Auth.js ✅, PR-0.6 CI remaining |
| 1 — Tenant, RBAC, Settings, Onboarding | not started | |
| 2 — Subscribers, Zones, Plans, Inventory | not started | |
| 3 — MikroTik Connector | not started | |
| 4 — Notifications | not started | |
| 5 — Billing Engine | not started | |
| 6 — Payments + Self-Care PWA | not started | |
| 7 — Support + AI Reply Drafting | not started | |
| 8 — Resellers | not started | |
| 9 — Analytics + AI Insights | not started | |
| 10 — Field-Tech + Network Map | not started | |
| 11 — Hotspot / Vouchers | not started | |
| 12 — Public API + Webhooks | not started | |
| 13 — Advanced AI | not started | |
| 14 — Bangla Localization | not started | |
| 15 — Hardening + GA | not started | |

Update this table at the end of each phase.
