# TikFlow — ISP Management & Billing Platform

## Context

TikFlow is a multi-tenant SaaS for ISPs (initially Bangladesh) that automates MikroTik-based subscriber management and billing. ISPs today juggle manual Excel-based billing, hand-toggle PPP secrets on MikroTik, and chase customers for payments. This causes revenue leakage, late disconnections, customer disputes, and burned-out support staff.

TikFlow replaces that with: automated invoice generation, automated PPPoE/Hotspot enable/disable based on payment status, local mobile-money collection (bKash / Nagad / Rocket), reseller hierarchies, ticketing, an operations dashboard, basic AI-assisted operations, and a subscriber-facing PWA.

Confirmed product decisions:

- **Deployment**: Cloud SaaS (we host; ISPs connect their routers).
- **Tenancy**: Shared PostgreSQL DB; `tenant_id` on every table + Postgres Row-Level Security.
- **MikroTik link**: Direct RouterOS API (8728/8729) + REST fallback for v7, jobs through a worker queue.
- **Payments MVP**: bKash, Nagad, Rocket / DBBL.
- **API framework**: Express 5 (team-familiar) + Zod + pino + helmet.
- **Build approach**: end-to-end implementation with Claude Code, so the repo is optimized for AI-assisted execution (deterministic conventions, small PR slices, every phase ships tested/deployed code).
- **Language scope**: English UI in MVP. `next-intl` scaffolding + locale-aware DB fields (`full_name_bn`, `notification_templates.locale`, etc.) are in place from Phase 0 so Bangla translations land cleanly in Phase 14 — no schema/UI rewrite.
- **AI scope in MVP**: basic set only — AI reply drafting (Phase 7) and churn / payment-risk signals (Phase 9). Advanced (IVR, predictive maintenance) deferred to Phase 13.
- **Hotspot scope**: MikroTik-native Hotspot + voucher batches in Phase 11. No external RADIUS server.
- **Compliance**: Bangladesh DPA only; data hosted in a Singapore region for latency. No multi-region commitment in v1.
- **Product bar**: must beat Splynx, Sonar, Visp, ispCare, RouterMx, MikroBill on UX, automation depth, and local-payment ergonomics.

---

## 1. High-Level Architecture

```
                   ┌────────────────────────────┐
  Browser / PWA ──▶│  Next.js 15 (App Router)   │  ── SSR + RSC + tRPC BFF
                   │  - Admin Panel             │
                   │  - Reseller Portal         │
                   │  - Subscriber Self-Care PWA│
                   │  - Field-Tech PWA          │
                   └─────────────┬──────────────┘
                                 │ tRPC / REST (JWT + tenant claim)
                   ┌─────────────▼──────────────┐
                   │  API Gateway (Express 5)   │
                   │  - Auth, RBAC, RLS context │
                   │  - OpenAPI for webhooks    │
                   └──┬──────┬────────┬─────────┘
                      │      │        │
        ┌─────────────▼┐  ┌──▼────┐ ┌─▼──────────────┐
        │ PostgreSQL 16│  │ Redis │ │  Object Store  │
        │ (RLS, primary│  │ Queue │ │  (S3 / R2)     │
        │ + read replica)│ Cache │ │  receipts, NID │
        └──────────────┘  └───┬───┘ └────────────────┘
                              │ BullMQ
       ┌──────────────┬───────┴────────┬──────────────┬────────────┐
       │              │                │              │            │
 ┌─────▼─────┐ ┌──────▼──────┐ ┌───────▼──────┐ ┌─────▼─────┐ ┌────▼────┐
 │  Billing  │ │  MikroTik   │ │ Notification │ │  AI /     │ │ Webhook │
 │  Engine   │ │  Worker     │ │ Worker       │ │  Insights │ │ Dispatch│
 │ (cron)    │ │ RouterOS    │ │ SMS/Email/WA │ │ (nightly) │ │  HMAC   │
 └───────────┘ └──────┬──────┘ └──────────────┘ └───────────┘ └─────────┘
                      │ TCP 8728 / 8729 / REST
               ┌──────▼────────┐
               │  ISP MikroTik │  (per tenant, many routers)
               └───────────────┘

  Payment Webhooks (bKash / Nagad / Rocket) ──▶  API Gateway  ──▶  Payment Worker
```

### Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend / BFF | Next.js 15 (App Router, RSC) + TypeScript strict + Tailwind + shadcn/ui + Tremor | One framework for admin, reseller, self-care, field-tech |
| API style | tRPC for in-app calls; REST + OpenAPI 3.1 for webhooks & public API | Type safety inside, ecosystem outside |
| Backend services | Node.js 22 + Express 5 + Zod + pino + pino-http + helmet + cors | Mature, ubiquitous; team already familiar |
| API validation | Zod + `@asteasolutions/zod-to-openapi` | Auto-publish OpenAPI, no runtime drift |
| DB | PostgreSQL 16 with RLS, `pgcrypto`, `pg_partman`, `pg_stat_statements`, `pg_trgm` | RLS is the multi-tenant guardrail |
| ORM | Prisma | Type-safe, mature |
| Queue | BullMQ on Redis | Retries, delayed jobs, cron, rate limiting |
| Cache / pubsub | Redis | Session, rate limit, idempotency keys, SSE fan-out |
| Real-time | Server-Sent Events | Simpler than WS, sufficient for dashboards |
| Object storage | S3-compatible (Cloudflare R2 or AWS S3) | Cheap egress on R2 |
| Auth | Auth.js credentials + TOTP MFA; phone-OTP for subscribers; JWT for service-to-service | Standard, multi-provider ready |
| i18n | `next-intl` — scaffolding from day 1, English-only translations in MVP, Bangla pack in Phase 14 | Avoids retrofit cost |
| Charts | Tremor + Recharts | Beautiful, dashboard-grade |
| PDF | `@react-pdf/renderer` (invoices, receipts); Noto Sans Bengali font registered ready for Phase 14 | Server-side, future-proof |
| Email | React Email + Resend / Amazon SES | Templated, testable |
| Observability | OpenTelemetry → Grafana Tempo + Loki + Prometheus; Sentry | Full traces incl. RouterOS calls |
| Feature flags | OpenFeature + GrowthBook self-hosted | Safe rollouts per tenant |
| Infra | Docker on Linux VPS (Hetzner / DO, Singapore region) via Coolify | Pragmatic cost for BD market |
| CI/CD | GitHub Actions | lint, typecheck, unit, integration, e2e, security |
| Secrets | Doppler or AWS Secrets Manager; KMS-encrypted router creds in DB | Router passwords are crown jewels |

### Multi-tenancy enforcement

1. JWT carries `tenant_id` claim signed by API gateway.
2. Middleware opens a per-request DB transaction and runs `SET LOCAL app.current_tenant = $1`.
3. Every table has `tenant_id uuid not null` + RLS policy `tenant_id = current_setting('app.current_tenant')::uuid`.
4. App-layer Prisma extension also injects `where: { tenantId }` as belt-and-braces.
5. A "platform" role bypasses RLS via a separate DB role used only by support tooling.

### Repository layout (monorepo)

```
/apps
  /web              Next.js (admin, reseller, self-care PWA, field-tech PWA, marketing)
  /api              Express 5 gateway (tRPC + REST + webhooks)
  /worker-billing   BullMQ workers: invoice, dunning, suspend
  /worker-mikrotik  BullMQ workers: RouterOS API jobs + state sync
  /worker-notify    SMS/Email/WhatsApp dispatcher
  /worker-ai        Nightly jobs: churn, payment-risk, NPS sentiment
/packages
  /db               Prisma schema, migrations, seed
  /mikrotik         RouterOS client (typed wrapper over node-routeros)
  /payments         bKash / Nagad / Rocket adapters (common interface)
  /sms              SMS provider adapters (SSL Wireless, MIM, Twilio)
  /auth             Shared auth utilities, RBAC enforcement
  /ui               shadcn-based component library + Tremor wrappers
  /config           ESLint, tsconfig, Tailwind preset
  /contracts        Zod schemas shared by web + api
  /i18n             Translation bundles (en for MVP; bn added Phase 14)
/CLAUDE.md          Repo-wide conventions for Claude Code (see §8)
```

---

## 2. Database Schema (PostgreSQL 16)

All tables include `id uuid pk default gen_random_uuid()`, `tenant_id uuid not null`, `created_at`, `updated_at`, soft-delete `deleted_at`. RLS enabled on every table except `tenants`, `platform_users`, `audit_logs_global`.

Locale-aware fields (`*_bn`, `notification_templates.locale`) are created from day 1 but stay empty until Phase 14.

### 2.1 Identity & tenancy
- **tenants** — id, name, slug, country, currency (default BDT), timezone (Asia/Dhaka), plan (`trial|standard|pro`), status, billing_email, kyc_status, settings jsonb, branding jsonb (logo URL, primary color, invoice header).
- **tenant_subscriptions** — TikFlow's own billing of ISPs.
- **users** — tenant_id, email, phone, password_hash (argon2id), mfa_secret, mfa_enabled, status, last_login_at, failed_login_count, locked_until, password_changed_at.
- **roles** — tenant_id, name (`owner|admin|billing|noc|support|collector|reseller|field_tech`), is_system.
- **permissions** — code, description.
- **role_permissions** / **user_roles**.
- **api_keys** — tenant_id, label, hashed_key, scopes, last_used_at, expires_at.
- **sessions** — user_id, jti, ip, ua, expires_at, revoked_at.

### 2.2 Network & territory
- **zones** — tree (district → upazila → para).
- **pop_sites** — zone_id, address, lat/lng.
- **routers** — tenant_id, pop_site_id, host, api_port, username, **password_encrypted** (KMS envelope), routeros_version, identity, model, status, last_seen_at, fingerprint, snmp_community_encrypted.
- **ip_pools** — router_id, cidr, gateway, type (`pppoe|hotspot|static`), usage_count.
- **ip_allocations** — pool_id, subscription_id, ip_address, mac_address, allocated_at, released_at.

### 2.3 Inventory & network assets
- **inventory_items** — type (`ont|onu|router|switch|splitter|cable_drum|nic|antenna`), serial, mac, vendor, model, status, assignments, purchased_at, warranty_until, cost.
- **inventory_movements** — item_id, from_location, to_location, moved_by, reason, at.

### 2.4 Catalog
- **service_plans** — name, code, type, upload_kbps, download_kbps, burst_*, validity_days, price, vat_pct, queue_profile_name, mikrotik_pppoe_profile, fup_limit_gb, fup_throttle_kbps, is_active.
- **promo_codes** — code, type, value, max_redemptions, valid_from/to.

### 2.5 Subscribers & subscriptions
- **subscribers** — code (auto), full_name, full_name_bn (empty in MVP), father_name, nid_number_encrypted, phone, alt_phone, email, address, address_bn, zone_id, lat/lng, installation_date, status, connection_type, reseller_id, assigned_collector_id, notes, kyc_docs jsonb (S3 keys), created_by.
- **subscriptions** — subscriber_id, plan_id, router_id, ip_pool_id, status, pppoe_username (unique per router), pppoe_password_encrypted, hotspot_username, mac_address, static_ip, queue_name, mikrotik_secret_id, activated_at, paid_until, next_invoice_at, auto_renew, suspend_on_due.
- **subscription_changes** — immutable audit.
- **subscriber_devices** — push tokens for the self-care PWA.

### 2.6 Billing (double-entry)
- **invoices** — number (per-tenant sequence), issued_at, due_at, period_start, period_end, subtotal, vat, discount, total, paid_amount, balance, status, pdf_s3_key. Partitioned monthly by `issued_at`.
- **invoice_items** — invoice_id, description, quantity, unit_price, amount, tax_pct, plan_id.
- **payments** — subscriber_id, invoice_id, amount, currency, method (`bkash|nagad|rocket|cash|bank|adjustment`), reference, provider_txn_id, collector_id, status, received_at, idempotency_key unique.
- **payment_attempts** — provider request/response log, redacted.
- **ledger_accounts** — code, name, type (`asset|liability|income|expense|equity`).
- **ledger_entries** — txn_id, account_id, debit, credit, ref_type, ref_id, posted_at. Sum-zero invariant enforced by trigger.
- **adjustments** — credit notes, write-offs, refunds.
- **expenses** — back-office: salary, fiber, rent.

### 2.7 MikroTik orchestration & telemetry
- **mikrotik_jobs** — router_id, type, payload jsonb, status, attempts, last_error, scheduled_for, finished_at, idempotency_key.
- **router_snapshots** — periodic export for drift detection.
- **active_sessions** — `/ppp/active` mirror.
- **bandwidth_samples** — subscription_id, ts, rx_bytes, tx_bytes. Partitioned daily.

### 2.8 Tickets & comms
- **tickets** — subscriber_id, subject, description, priority, status, category, assigned_to, sla_due_at, satisfaction_rating.
- **ticket_messages** — internal/external, attachments.
- **notifications** — channel (`sms|email|whatsapp|push|in_app`), template_code, recipient, payload, status, sent_at, provider_msg_id, cost.
- **notification_templates** — code, channel, locale (`en` / `bn`), subject, body (mustache), variables.
- **conversation_threads** + **conversation_messages** — two-way SMS/WhatsApp inbox per subscriber.

### 2.9 Captive portal & vouchers
- **vouchers** — code, plan_id, status (`unused|active|expired`), validity_minutes, data_cap_mb, batch_id, sold_to_subscriber_id, activated_at.
- **voucher_batches** — prefix, qty, generated_at, sold_to_reseller_id.

### 2.10 Resellers
- **resellers** — name, parent_id, commission_pct, wallet_balance, status.
- **reseller_transactions** — type (`recharge|commission|payout|adjustment`), amount, ref_type, ref_id.

### 2.11 AI / insights
- **ai_signals** — kind (`churn_risk|payment_risk|router_anomaly|bandwidth_anomaly|nps_negative`), entity_type, entity_id, score 0–1, features jsonb, generated_at, acknowledged_at.
- **ai_suggestions** — kind (`reply_draft|next_action|root_cause`), context jsonb, suggestion, used_at.

### 2.12 Audit & platform
- **audit_logs** — actor_user_id, action, entity_type, entity_id, diff jsonb, ip, ua, at. Append-only via trigger.
- **webhook_endpoints** — url, secret, events[].
- **webhook_deliveries** — endpoint_id, event, payload, status, attempt_count.
- **security_events** — kind (`login_fail|mfa_fail|password_reset|impossible_travel|api_key_used|export`), severity, ip, ua, payload, at.

### 2.13 Critical indexes & constraints
- `subscribers (tenant_id, code)` unique; `(tenant_id, phone)` index; `(tenant_id, full_name) gin trgm` and `(tenant_id, full_name_bn) gin trgm` for fuzzy search.
- `subscriptions (router_id, pppoe_username)` unique.
- `invoices (tenant_id, subscriber_id, period_start)` unique (no double-billing).
- `payments (tenant_id, idempotency_key)` unique.
- `mikrotik_jobs (status, scheduled_for)` partial index for queue picker.
- `bandwidth_samples` partitioned monthly, retention 90 days raw / 2 years aggregated.
- Foreign keys all `on delete restrict`; cascades only inside aggregate boundaries.

---

## 3. Key Flows

### 3.1 Subscriber onboarding
1. Admin creates subscriber → picks plan + router + IP pool.
2. App generates PPPoE credentials, writes `subscriptions` row.
3. Enqueues `mikrotik_jobs(type=create_secret)`.
4. Worker calls `/ppp/secret/add` with profile from plan.
5. On success saves `mikrotik_secret_id`; on failure marks `pending`, alerts NOC.
6. First proforma invoice generated; subscriber gets SMS (English) with credentials + dues + self-care link.

### 3.2 Monthly billing cron (per tenant, 02:00 local)
1. Find subscriptions where `next_invoice_at <= today`.
2. Generate invoice for next period; post ledger entries (A/R Dr, Sales Cr, VAT Cr).
3. Advance `next_invoice_at` by `plan.validity_days`. Render PDF, upload to S3.
4. Queue SMS + in-app notification.

### 3.3 Auto-suspend / restore
- Daily 09:00: `paid_until < today AND suspend_on_due = true` → enqueue `disable` + disconnect active session. Reminder sequence fired D-3, D-1, D+0.
- On payment → mark invoice paid → if suspended, enqueue `enable` and advance `paid_until`.

### 3.4 Payment via bKash (Tokenized Checkout)
1. Self-care app `POST /payments/initiate` → server stores `payment_attempts` with idempotency key, calls bKash `create`.
2. User completes on bKash; webhook hits `/webhooks/bkash`.
3. Worker verifies signature, posts `payments` row, FIFO-allocates to oldest open invoice, writes ledger.
4. Triggers restore flow if subscription was suspended.
5. Nagad and Rocket follow the same adapter contract in `/packages/payments`.

### 3.5 Drift detection
- Every 15 min `worker-mikrotik` pulls `/ppp/secret` + `/queue/simple`, diffs against DB; discrepancies create `tickets(category=drift)` for NOC.

### 3.6 AI nightly pass
- `worker-ai` runs feature extraction over last 30 days; produces `ai_signals` for churn risk and payment risk. Surfaces in dashboard with "Why?" explainability panel.

---

## 4. Competitive Positioning & Differentiators

Reference competitors: **Splynx, Sonar, Visp, Powercode, ispCare, RouterMx, MikroBill, FXBilling, Bill48**.

| Axis | Market today | TikFlow target |
|---|---|---|
| UI/UX | 2010s-era Bootstrap admin themes | shadcn/ui + Tremor, mobile-first, dark mode, command palette (⌘K), keyboard shortcuts |
| Local payments | Manual reconciliation common | One-tap bKash/Nagad/Rocket with auto-reconnect within 30 s |
| Self-care | Often missing or read-only | Installable PWA: pay, view usage graphs, raise ticket, change plan, refer-a-friend |
| Automation | Cron + manual fix-ups | Drift detection, auto-suspend/restore, AI dunning |
| AI | Absent | Churn risk scoring, AI-drafted ticket replies, NPS sentiment |
| Field ops | Paper / WhatsApp | Field-tech PWA: route, install checklist, signal logs, photo + signature, offline-first |
| Reseller layer | Single-level | Multi-level with wallet, commission, sub-branding |
| Inventory | External spreadsheet | Built-in (ONU, router, splitter) with QR-code tagging |
| Captive portal | Separate product | Bundled hotspot + voucher batches with print-ready PDFs |
| Reporting | Static CSVs | Live dashboards (Tremor) + scheduled exports + saved views |
| Compliance | Ignored | Bangladesh DPA: data export, right-to-erasure, PII encryption, audit log |
| Language | English-only or broken Bangla | English MVP with schema/i18n ready for Bangla; Bangla customer surface (SMS, invoice PDF, self-care PWA) shipped Phase 14 |
| Pricing | Per-subscriber, opaque | Transparent tiered + per-subscriber, free <100 subscribers trial |

---

## 5. Design System & UX Standards

- **Component library**: shadcn/ui base, Tremor for dashboards, custom wrappers in `/packages/ui`. No raw HTML primitives in feature code.
- **Design tokens**: Tailwind preset in `/packages/config` — colors, spacing, radii, shadows. Light + dark mode. Per-tenant accent color override.
- **Typography**: Inter (Latin). Noto Sans Bengali registered in PDF renderer + loaded conditionally; switches on once Bangla pack ships.
- **Layouts**: app shell with collapsible sidebar, top bar (tenant switcher, ⌘K palette, alerts, profile). Two reusable layouts: `dashboard` (KPI cards + charts) and `data` (table + filters + side-panel). Detail pages use a 2-column shell: primary left, contextual rail right (recent activity, AI hints, related entities).
- **Tables**: TanStack Table — column visibility, multi-sort, saved views, server-side pagination, bulk actions, CSV/Excel export, inline-edit for safe fields.
- **States**: every list/page/form has explicit empty / loading (skeleton) / error / success states.
- **Forms**: React Hook Form + Zod. Inline validation, optimistic submit, undo toast on destructive actions.
- **Real-time**: SSE for router status, active sessions, payment received toast.
- **Accessibility**: WCAG 2.1 AA — keyboard traversable, focus rings, ARIA labels, contrast ≥ 4.5:1. `axe-core` in Playwright CI.
- **Mobile-first**: every admin page works on 360 px phone. Self-care and field-tech apps are PWAs with installable manifest + Workbox service worker.
- **Performance budget**: FCP < 1.5 s on 4G; LCP < 2.5 s; INP < 200 ms. Lighthouse gate in CI.
- **i18n**: every user-visible string lives in translation bundles from day 1. Pseudo-locale gate in CI catches hard-coded strings.
- **Onboarding**: first-run wizard (timezone, currency, branding, first router, first plan, CSV subscriber import).

---

## 6. Security Baseline

Security is a Phase-0 commitment, not a Phase-15 cleanup.

### Application
- **AuthN**: Auth.js with argon2id; TOTP MFA mandatory for `owner` / `admin`; phone-OTP for subscribers; lockout after 5 failed attempts.
- **AuthZ**: RBAC + RLS + per-resource ABAC where needed.
- **Sessions**: short JWT (15 min) + rotating refresh token in httpOnly Secure SameSite=Strict cookie; revocable via `sessions`.
- **CSRF**: double-submit token on mutating REST; tRPC uses Origin check.
- **CORS**: explicit per-tenant allow-list.
- **Input validation**: Zod everywhere; no raw `req.body`.
- **SQL injection**: Prisma parameterized; raw SQL only via tagged templates in `/packages/db`.
- **Rate limiting**: per-IP + per-tenant + per-user via `rate-limiter-flexible`. Stricter buckets for `/auth`, `/payments`, `/webhooks`.
- **File uploads**: presigned PUT to S3, MIME sniff server-side, ClamAV scan.

### Data
- **At rest**: encrypted volumes + column-level envelope encryption (libsodium + KMS) for `nid_number`, `pppoe_password`, `router.password`, `snmp_community`, MFA secrets.
- **In transit**: TLS 1.3 only; HSTS preload; RouterOS API over TLS (8729) when supported.
- **Secrets**: Doppler/AWS SM injected at runtime.
- **Backups**: nightly base + WAL streaming, 30-day PITR; restore drill quarterly; encrypted offsite copies.
- **PII minimization**: NID hashed for lookup + encrypted for retrieval; never logged. Pino redact paths configured.

### Operational
- **Audit log** (append-only) + `security_events` for auth anomalies; SIEM-ready JSON export.
- **Dependency hygiene**: `pnpm audit` in CI; Renovate bot; Trivy on container images; weekly deep scan.
- **Code review**: every PR requires green CI + human approval.
- **Threat model**: STRIDE per major feature (auth, payments, MikroTik API, exports). Re-reviewed each phase.
- **Pen-test**: external pen-test before GA. RLS fuzz test in CI (random tenant_id forgery → assert denial).
- **Compliance**: Bangladesh PDPA — DSAR endpoint, data export, right-to-erasure, retention policies.

---

## 7. AI / Intelligence Layer

MVP keeps the basics, advanced lands later.

| Feature | Approach | Phase |
|---|---|---|
| AI-drafted ticket replies | LLM call (Claude API) with redacted ticket history + KB; suggested reply for support to edit | Phase 7 (MVP) |
| Auto-categorize incoming SMS / WhatsApp | LLM classifier → routes to ticket queue, autofills `category` | Phase 7 (MVP) |
| Churn-risk score per subscriber | Nightly XGBoost on payment punctuality, ticket count, bandwidth drop-off | Phase 9 (MVP) |
| Payment-risk score per invoice | Same pipeline, threshold drives dunning aggressiveness | Phase 9 (MVP) |
| NPS sentiment | LLM over ticket satisfaction comments | Phase 9 (MVP) |
| Bandwidth/router anomaly detection | EWMA + seasonal baseline over `bandwidth_samples` | Phase 13 (post-MVP) |
| Voice/SMS Bangla TTS reminders | IVR via local provider | Phase 13 (post-MVP) |
| Predictive maintenance | Router telemetry trend models | Phase 13 (post-MVP) |

All AI features ship with: per-tenant feature flag, latency budgets, PII redaction before LLM calls, cost telemetry, "Why this suggestion?" panel.

---

## 8. Claude Code Workflow & Repo Conventions

Because this app is built end-to-end with Claude Code, the repo is structured for deterministic AI execution.

### Root-level `CLAUDE.md` (created in Phase 0)
- Tech-stack inventory + version pins.
- Folder-by-folder responsibility map.
- Commands: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm db:migrate`, `pnpm db:seed`.
- "How to add a new feature" recipe: DB migration → Prisma model → Zod contract → tRPC procedure → React Query hook → page → test.
- Forbidden patterns (no `any`, no raw SQL outside `/packages/db`, no `dangerouslySetInnerHTML`, no Date math without `date-fns-tz`).
- Per-tenant safety rule: every new query must include `tenantId` and a corresponding RLS test.

### PR slicing
- Each phase decomposed into PRs ≤ ~400 lines diff.
- Every PR: schema → backend → frontend → tests → docs.
- Phase exits only when CI is green and deployed to staging.

### Test-first
- Unit + integration test for every server module.
- Playwright e2e for every user-visible flow.
- RLS test for every new tenant-scoped table.

### Definition of Done (per PR)
- No `any`, no `@ts-ignore` without inline justification.
- Tests added/updated, green locally and in CI.
- Strings extracted to translation bundle (en at minimum).
- `axe` passes in Playwright.
- No new high/critical from `pnpm audit`, no secrets in diff.
- CLAUDE.md or feature README updated if conventions changed.

---

## 9. Roadmap

Sized for a Claude Code-driven build with the user as reviewer. Each phase ends with a deployable, demoable increment on staging.

### Phase 0 — Foundation, Design System, Security Baseline (Sprints 1–2)
- Monorepo (pnpm + Turborepo), TS strict, ESLint, Prettier, Husky pre-commit.
- Root `CLAUDE.md`.
- CI: lint / typecheck / unit / Prisma migrate-check / Playwright smoke / Trivy / `pnpm audit`.
- Docker Compose dev stack (Postgres 16, Redis, MailHog, MinIO, ClamAV).
- Next.js + Express 5 scaffolds talking via tRPC (`@trpc/server/adapters/express`).
- `/packages/ui` with shadcn baseline + Tremor wrappers + light/dark themes.
- Prisma + first migration: `tenants`, `users`, `roles`, `audit_logs`, `security_events`, RLS skeleton with Prisma middleware that issues `SET LOCAL`.
- Auth.js with credentials + TOTP MFA, account lockout, password policy.
- Rate limiting, helmet, CSRF token, CORS allow-list, pino redact, error boundary, Sentry + OTel.
- `next-intl` scaffolding (`en` only); pseudo-locale CI gate.
- **Exit**: tenant signs up → MFA enrolment → login → empty dashboard renders; observability traces visible in Grafana; CI green across all gates.

### Phase 1 — Tenant, RBAC, Settings, Onboarding Wizard (Sprint 3)
- Tenant settings (timezone, currency, fiscal year, invoice prefix, branding, accent color).
- Role + permission management UI.
- API keys with scopes + last-used.
- Audit log + security event viewers.
- First-run onboarding wizard.
- **Exit**: owner invites users with scoped roles, configures branding, completes wizard.

### Phase 2 — Subscribers, Zones, Plans, Inventory (Sprints 4–5)
- Zones / pop_sites tree with map view.
- Service plans CRUD (with MikroTik profile mapping fields — no RouterOS push yet).
- Subscriber CRUD, KYC upload to S3 + ClamAV, bulk CSV import with row-level error report.
- Inventory items + movements with QR code generation.
- Search (pg_trgm fuzzy), filters, saved views.
- **Exit**: ops can manage subscribers + inventory offline.

### Phase 3 — MikroTik Connector (Sprints 6–7)
- `@tikflow/mikrotik` package wrapping `node-routeros` with typed methods.
- Encrypted router credential storage (libsodium + KMS).
- `worker-mikrotik` with BullMQ; retries with exponential backoff; circuit breaker per router.
- "Test connection" UI; live router status badge (SSE).
- Subscriber create → enqueues `create_secret`; status on subscription card.
- Periodic active-session sync; bandwidth sampling into `bandwidth_samples`.
- Drift detection job + auto-ticket.
- **Exit**: creating a subscriber in TikFlow makes them connect on the real MikroTik; live online/offline badge.

### Phase 4 — Notifications (SMS / Email / In-App / WhatsApp) (Sprint 8)
- SMS adapter pack (SSL Wireless, MIM, Twilio); per-tenant sender ID; cost tracking.
- React Email + Resend/SES.
- WhatsApp Cloud API (optional toggle).
- In-app notification center + web push.
- Two-way conversation inbox.
- English templates with `locale` column ready for Bangla in Phase 14.
- **Exit**: any system event fans out to chosen channels with delivery receipt + cost.

### Phase 5 — Billing Engine (Sprints 9–10)
- Invoice schema + double-entry ledger + sum-zero trigger.
- Cron-driven invoice generation; PDF via `@react-pdf/renderer` (English template; Bengali font registered).
- Pro-rata first-month + plan-change pro-ration.
- Manual payment entry (cash) by collector with idempotency.
- Dunning rules engine (grace days, reminder schedule using Phase 4 notifications).
- Auto-suspend / restore pipeline.
- **Exit**: "month closes → bills generate → reminders fire → unpaid customers auto-disconnect on day N".

### Phase 6 — Payments + Subscriber Self-Care PWA (Sprints 11–12)
- `@tikflow/payments` common interface (`initiate`, `verify`, `refund`, `webhookHandle`).
- bKash Tokenized Checkout (sandbox → prod), Nagad, Rocket / DBBL adapters.
- Subscriber self-care PWA — phone-OTP login, view bills, pay, download receipt, view usage graph, raise ticket, change plan, refer-a-friend.
- Installable manifest + offline cache.
- Webhook receiver with signature verification + idempotency.
- **Exit**: subscriber pays from phone, line auto-restores within 30 seconds; PWA installs from Chrome / Safari.

### Phase 7 — Support / Tickets + AI Reply Drafting (Sprint 13)
- Ticketing UI with SLA timers.
- Subscriber portal can open tickets.
- Internal notes vs. customer-visible replies.
- Auto-create tickets for drift, payment disputes, router-offline events.
- AI reply drafting (Claude API) with PII redaction + "Why?" panel.
- Auto-categorize incoming SMS/WhatsApp.
- **Exit**: support team works in-product; AI cuts first-response time meaningfully.

### Phase 8 — Resellers / Sub-dealers (Sprint 14)
- Reseller wallet + commission rules.
- Reseller portal: create/recharge their subscribers, view commission ledger.
- Multi-level hierarchy, hierarchical pricing override.
- **Exit**: ISP onboards area dealers who collect cash and recharge wallet.

### Phase 9 — Analytics, AI Insights, NPS (Sprint 15)
- Materialized views: MRR, churn, ARPU, collection efficiency, aging A/R.
- Per-router bandwidth & subscriber distribution charts.
- Tax reports (VAT), monthly P&L using ledger.
- AI signals: churn risk, payment risk, NPS sentiment, with "Why?" panels.
- Scheduled CSV/Excel email exports.
- **Exit**: owner has a one-page health dashboard with AI-surfaced "things to look at today".

### Phase 10 — Field-Tech PWA + Network Map (Sprints 16–17)
- Field-tech PWA (offline-first via Workbox).
- Install/repair work orders, route, install checklist, photo + signature capture, signal level logs.
- Network map (Leaflet/MapLibre) with subscribers, pop sites, fiber paths.
- **Exit**: field crew works paperless; NOC sees the network spatially.

### Phase 11 — Hotspot, Captive Portal, Voucher System (Sprint 18)
- Captive portal templates per tenant.
- Voucher batches with printable PDFs and QR codes.
- Hotspot user lifecycle on MikroTik.
- **Exit**: ISP runs paid hotspots (cafés, schools) using TikFlow vouchers.

### Phase 12 — Public API, Webhooks, Marketplace (Sprint 19)
- OpenAPI 3.1 spec for `subscribers`, `invoices`, `payments`, `routers`, `tickets`.
- Outbound webhooks with HMAC + retries.
- Zapier / Make integration.
- **Exit**: third parties build on TikFlow.

### Phase 13 — Advanced AI: Anomaly Detection, Voice/IVR (Sprint 20)
- Bandwidth/router anomaly detection.
- Bangla TTS IVR payment reminders.
- Predictive maintenance based on router telemetry.
- **Exit**: collection cost per BDT drops measurably; NOC sees anomalies before customers call.

### Phase 14 — Bangla Localization (Sprint 21)
- Bangla translation pack for admin UI + reseller + self-care + field-tech.
- Bangla notification templates (SMS, email, WhatsApp, in-app, push).
- Bangla invoice PDF (Noto Sans Bengali turned on, currency words in Bangla).
- Per-subscriber `preferred_locale` (default `bn` for BD tenants).
- QA pass with native Bangla speaker; localized empty/error states.
- **Exit**: a BD ISP can run TikFlow 100% in Bangla end-to-end.

### Phase 15 — Hardening, Compliance, Pen-Test, GA (Sprints 22–23)
- Read replica + PgBouncer.
- Partitioning rollouts via `pg_partman`.
- Per-tenant rate limits, abuse detection.
- PITR drill, DR drill, encrypted offsite snapshots.
- External pen-test + remediation.
- Bangladesh PDPA DSAR endpoint, data export, right-to-erasure flows.
- Public launch.

---

## 10. Critical Files To Create (initial scaffolding — first PRs)

- `CLAUDE.md` — repo conventions (§8).
- `package.json`, `pnpm-workspace.yaml`, `turbo.json` — monorepo root.
- `apps/web/` — Next.js 15 app skeleton with theme provider + `next-intl`.
- `apps/api/src/server.ts` — Express 5 bootstrap: helmet, cors, pino-http, JSON body parser, tRPC adapter, Zod-validated REST routers, `/healthz`.
- `apps/api/src/middleware/{tenant-context,rate-limit,auth,audit}.ts`.
- `apps/worker-mikrotik/src/worker.ts` — BullMQ consumer with job handlers.
- `apps/worker-billing/src/jobs/generate-invoices.ts`.
- `apps/worker-notify/src/dispatchers/{sms,email,whatsapp}.ts`.
- `packages/db/prisma/schema.prisma` — full schema from §2.
- `packages/db/prisma/migrations/0001_init.sql` — RLS `enable row level security` + policies.
- `packages/mikrotik/src/client.ts` — typed RouterOS wrapper.
- `packages/payments/src/{bkash,nagad,rocket}.ts` — adapters behind a common `PaymentProvider` interface.
- `packages/auth/src/{rbac,mfa,password}.ts`.
- `packages/ui/src/` — shadcn primitives + Tremor wrappers + theme tokens.
- `packages/i18n/en.json` — translation bundle (`bn.json` added Phase 14).
- `infra/docker-compose.dev.yml` — Postgres, Redis, MinIO, MailHog, ClamAV.
- `.github/workflows/ci.yml` — lint, typecheck, prisma migrate, unit + integration + e2e, axe, Trivy, audit.
- `.github/workflows/security.yml` — weekly deep scans.
- `docs/threat-model.md` — STRIDE per major feature.

---

## 11. Verification

- **Unit**: Vitest — billing math, pro-ration, RBAC, encryption helpers.
- **Integration**: `@testcontainers/postgresql` + Redis; spin a real DB, run migrations, exercise tRPC routers; RLS tests assert tenant A cannot read tenant B's rows even with a forged `where`.
- **MikroTik**: a CHR (Cloud Hosted Router) container in CI; worker actually creates/disables secrets against it.
- **Payments**: bKash sandbox + Nagad UAT via Playwright; webhook replay tests for idempotency.
- **E2E**: Playwright flow — sign-up tenant → add router → create subscriber → see them online → run billing cron → fail to pay → get suspended → pay via bKash sandbox → get restored, in one CI job.
- **A11y**: `axe-core` integrated in Playwright; fail on serious/critical.
- **Load**: k6 simulating 50k subscribers across 200 tenants billing on the 1st; p95 invoice-gen latency budget.
- **Security**: weekly `pnpm audit` + Trivy on images; quarterly RLS fuzz test; pre-GA external pen-test.

Phase 0 exit = first checkpoint: a tenant can sign up, log in with MFA, see an empty dashboard, with full observability traces visible in Grafana, and CI green across all gates.

---

## 12. Pre-Phase-0 Readiness Checklist (need from the user)

Before writing the first line of code, please confirm or provide:

1. **Brand & domain** — is "TikFlow" final? Domain registered? Logo / primary color available?
2. **GitHub org / repo** — final repo home; branch-protection rules acceptable (require CI + 1 review).
3. **Hosting target** — Hetzner / DigitalOcean / AWS? Singapore region OK?
4. **Payment merchant accounts** — bKash, Nagad, Rocket onboarding starts now (multi-week lead time). Provide expected business name + NID + trade license.
5. **SMS sender ID** — which provider (SSL Wireless / MIM / other)? Sender ID approval is multi-week.
6. **Pricing tiers** — what will TikFlow itself charge ISPs? (Drives Phase 1 plan UI.)

Items 1–6 must be answered before Phase 0 kicks off. Items previously open (Bangla scope, AI scope, Hotspot/RADIUS scope, compliance footprint) are now decided and folded into the plan above.
