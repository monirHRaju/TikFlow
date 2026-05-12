# TikFlow — ISP Management & Billing Platform

## Context

TikFlow is a multi-tenant SaaS for ISPs (initially Bangladesh / South-Asia market) that automates MikroTik-based subscriber management and billing. ISPs today juggle manual Excel-based billing, hand-toggle PPP secrets on MikroTik, and chase customers for payments. This causes revenue leakage, late disconnections, customer disputes, and burned-out support staff.

The platform replaces that with: automated invoice generation, automated PPPoE/Hotspot enable/disable based on payment status, local mobile-money collection (bKash / Nagad / Rocket), reseller hierarchies, ticketing, and an operations dashboard.

Confirmed product decisions:

- **Deployment**: Cloud SaaS (we host; ISPs connect their routers).
- **Tenancy**: Shared PostgreSQL DB; `tenant_id` on every table + Postgres Row-Level Security.
- **MikroTik link**: Direct RouterOS API (8728/8729) + REST fallback for RouterOS v7, jobs run through a worker queue.
- **Payments MVP**: bKash, Nagad, Rocket / DBBL.

---

## 1. High-Level Architecture

```
                   ┌────────────────────────────┐
  Browser / PWA ──▶│  Next.js 15 (App Router)   │  ── SSR pages + tRPC/REST BFF
                   │  - Admin Panel             │
                   │  - Reseller Portal         │
                   │  - Subscriber Self-Care    │
                   └─────────────┬──────────────┘
                                 │ tRPC / REST (JWT + tenant claim)
                   ┌─────────────▼──────────────┐
                   │  API Gateway (Fastify)     │
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
              ┌───────────────┼──────────────────────────┐
              │               │                          │
     ┌────────▼────────┐ ┌────▼─────────┐ ┌──────────────▼──────┐
     │ Billing Engine  │ │ MikroTik     │ │ Notification Worker │
     │ (cron-driven)   │ │ Worker       │ │ SMS / Email / WA    │
     │ - invoice gen   │ │ - RouterOS   │ │ - templated, queued │
     │ - dunning       │ │   API jobs   │ │ - DLR tracking      │
     │ - auto-suspend  │ │ - state sync │ │                     │
     └─────────────────┘ └──────┬───────┘ └─────────────────────┘
                                │ TCP 8728 / 8729 / REST
                         ┌──────▼────────┐
                         │  ISP MikroTik │  (per tenant, many routers)
                         └───────────────┘

  Payment Webhooks (bKash / Nagad / Rocket) ──▶  API Gateway  ──▶  Payment Worker
```

### Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend / BFF | Next.js 15 (App Router, RSC) + TypeScript + Tailwind + shadcn/ui | One framework for admin, reseller, self-care |
| API style | tRPC for in-app calls; REST + OpenAPI for webhooks & public API | Type safety inside, ecosystem outside |
| Backend services | Node.js 22 + Fastify | Lightweight, same language across stack |
| DB | PostgreSQL 16 with RLS, `pgcrypto`, `pg_partman` | RLS is the multi-tenant guardrail |
| ORM | Prisma — schema-first, migrations | Type-safe, mature |
| Queue | BullMQ on Redis | Retries, delayed jobs, cron, rate limiting |
| Cache | Redis | Session, rate limit, idempotency keys |
| Object storage | S3-compatible (Cloudflare R2 or AWS S3) | Cheap egress on R2 |
| Auth | Auth.js (NextAuth) with credentials + TOTP MFA; JWT for service-to-service | Standard, multi-provider ready |
| Observability | OpenTelemetry → Grafana Tempo + Loki + Prometheus; Sentry | Full traces incl. RouterOS calls |
| Infra | Docker on Linux VPS (Hetzner / DO) via Coolify; AWS ECS at scale | Pragmatic cost for BD market |
| CI/CD | GitHub Actions | lint, typecheck, unit, integration, e2e |
| Secrets | Doppler or AWS Secrets Manager; KMS-encrypted router creds in DB | Router passwords are crown jewels |

### Multi-tenancy enforcement

1. JWT carries `tenant_id` claim signed by API gateway.
2. Middleware opens a per-request DB transaction and runs `SET LOCAL app.current_tenant = $1`.
3. Every table has `tenant_id uuid not null` + RLS policy `tenant_id = current_setting('app.current_tenant')::uuid`.
4. App-layer Prisma extension also injects `where: { tenantId }` as a belt-and-braces defense.
5. A "platform" role bypasses RLS via a separate DB role used only by support tooling.

### Repository layout (monorepo)

```
/apps
  /web              Next.js (admin, reseller, self-care, marketing)
  /api              Fastify gateway (tRPC + REST + webhooks)
  /worker-billing   BullMQ workers: invoice, dunning, suspend
  /worker-mikrotik  BullMQ workers: RouterOS API jobs + state sync
  /worker-notify    SMS/Email/WA dispatcher
/packages
  /db               Prisma schema, migrations, seed
  /mikrotik         RouterOS client (typed wrapper over node-routeros)
  /payments         bKash / Nagad / Rocket adapters (common interface)
  /sms              SMS provider adapters (SSL Wireless, MIM, Twilio)
  /auth             Shared auth utilities, RBAC enforcement
  /ui               shadcn-based component library
  /config           ESLint, tsconfig, Tailwind preset
  /contracts        Zod schemas shared by web + api
```

---

## 2. Database Schema (PostgreSQL 16)

All tables include `id uuid pk default gen_random_uuid()`, `tenant_id uuid not null`, `created_at`, `updated_at`, soft-delete `deleted_at`. RLS enabled on every table except `tenants`, `platform_users`, `audit_logs_global`.

### 2.1 Identity & tenancy

- **tenants** — id, name, slug, country, currency (default BDT), timezone (Asia/Dhaka), plan (`trial|standard|pro`), status, billing_email, kyc_status, settings jsonb.
- **tenant_subscriptions** — TikFlow's own billing of ISPs (plan, price, period, status).
- **users** — tenant_id, email, phone, password_hash, mfa_secret, status, last_login_at.
- **roles** — tenant_id, name (`owner|admin|billing|noc|support|collector|reseller`), is_system.
- **permissions** — code (`subscriber.create`, `invoice.void`, `router.write`, …), description.
- **role_permissions** — role_id, permission_id.
- **user_roles** — user_id, role_id.
- **api_keys** — tenant_id, label, hashed_key, scopes, last_used_at, expires_at.
- **sessions** — user_id, jti, ip, ua, expires_at, revoked_at.

### 2.2 Network & territory

- **zones** — tenant_id, name, parent_id (tree), code. e.g. district → upazila → para.
- **pop_sites** — zone_id, name, address, lat/lng.
- **routers** — tenant_id, pop_site_id, name, host, api_port, username, **password_encrypted** (KMS envelope), routeros_version, identity, model, status (`online|offline|unreachable`), last_seen_at, fingerprint.
- **ip_pools** — tenant_id, router_id, name, cidr, gateway, type (`pppoe|hotspot|static`), usage_count.
- **ip_allocations** — pool_id, subscription_id, ip_address, mac_address, allocated_at, released_at. Unique on `(pool_id, ip_address) where released_at is null`.

### 2.3 Catalog

- **service_plans** — tenant_id, name, code, type (`pppoe|hotspot|static`), upload_kbps, download_kbps, burst_limit, burst_threshold, burst_time, validity_days, price, vat_pct, queue_profile_name, mikrotik_pppoe_profile, is_active.
- **promo_codes** — tenant_id, code, type (`percent|flat`), value, max_redemptions, valid_from/to.

### 2.4 Subscribers & subscriptions

- **subscribers** — tenant_id, code (auto, e.g. `T-000123`), full_name, father_name, nid_number, phone, alt_phone, email, address, zone_id, lat/lng, installation_date, status (`active|inactive|suspended|terminated`), connection_type (`pppoe|hotspot|static`), reseller_id, assigned_collector_id, notes, kyc_docs jsonb (S3 keys), created_by.
- **subscriptions** — subscriber_id, plan_id, router_id, ip_pool_id, status (`active|grace|suspended|terminated`), pppoe_username (unique per router), pppoe_password_encrypted, hotspot_username, mac_address, static_ip, queue_name, mikrotik_secret_id, activated_at, paid_until, next_invoice_at, auto_renew, suspend_on_due.
- **subscription_changes** — immutable audit of plan / status / IP changes.

### 2.5 Billing (double-entry)

- **invoices** — tenant_id, subscriber_id, subscription_id, number (per-tenant sequence), issued_at, due_at, period_start, period_end, subtotal, vat, discount, total, paid_amount, balance, status (`draft|issued|partial|paid|void|written_off`), pdf_s3_key. Partitioned monthly by `issued_at`.
- **invoice_items** — invoice_id, description, quantity, unit_price, amount, tax_pct, plan_id.
- **payments** — tenant_id, subscriber_id, invoice_id (nullable for advances), amount, currency, method (`bkash|nagad|rocket|cash|bank|adjustment`), reference, provider_txn_id, collector_id, status (`pending|success|failed|refunded`), received_at, idempotency_key unique.
- **payment_attempts** — provider request/response log (raw payloads, redacted).
- **ledger_accounts** — tenant_id, code, name, type (`asset|liability|income|expense|equity`).
- **ledger_entries** — tenant_id, txn_id, account_id, debit, credit, ref_type, ref_id, posted_at. Sum-zero invariant enforced via trigger.
- **adjustments** — credit notes, write-offs, refunds.
- **expenses** — ISP back-office: salary, fiber, rent.

### 2.6 MikroTik orchestration

- **mikrotik_jobs** — tenant_id, router_id, type (`create_secret|update_secret|disable|enable|delete|sync_queues|disconnect_session`), payload jsonb, status (`queued|running|success|failed|dead`), attempts, last_error, scheduled_for, finished_at, idempotency_key.
- **router_snapshots** — periodic export of `/ppp/secret`, `/ip/firewall/address-list`, `/queue/simple` for drift detection.
- **active_sessions** — mirror of `/ppp/active` for live status display (refreshed every 30s).

### 2.7 Tickets & comms

- **tickets** — tenant_id, subscriber_id, subject, description, priority, status, assigned_to, sla_due_at.
- **ticket_messages** — internal/external, attachments.
- **notifications** — tenant_id, channel (`sms|email|whatsapp|push`), template_code, recipient, payload, status, sent_at, provider_msg_id, cost.
- **notification_templates** — tenant_id (nullable = system), code, channel, subject, body (mustache), variables.

### 2.8 Resellers

- **resellers** — tenant_id, name, parent_id, commission_pct, wallet_balance, status.
- **reseller_transactions** — reseller_id, type (`recharge|commission|payout|adjustment`), amount, ref_type, ref_id.

### 2.9 Audit & platform

- **audit_logs** — tenant_id, actor_user_id, action, entity_type, entity_id, diff jsonb, ip, ua, at. Append-only.
- **webhook_endpoints** — tenant_id, url, secret, events[].
- **webhook_deliveries** — endpoint_id, event, payload, status, attempt_count.

### 2.10 Critical indexes & constraints

- `subscribers (tenant_id, code)` unique; `(tenant_id, phone)` index.
- `subscriptions (router_id, pppoe_username)` unique.
- `invoices (tenant_id, subscriber_id, period_start)` unique (no double-billing).
- `payments (tenant_id, idempotency_key)` unique.
- `mikrotik_jobs (status, scheduled_for)` partial index for the queue picker.
- Foreign keys all `on delete restrict`; cascades only inside aggregate boundaries (invoice → items, ticket → messages).

---

## 3. Key Flows

### 3.1 Subscriber onboarding
1. Admin creates subscriber → picks plan + router + IP pool.
2. App generates PPPoE credentials, writes `subscriptions` row.
3. Enqueues `mikrotik_jobs(type=create_secret)`.
4. Worker calls RouterOS API: `/ppp/secret/add` with profile name from plan.
5. On success, saves `mikrotik_secret_id`; on failure, marks subscription `pending`, alerts NOC.
6. First proforma invoice generated; subscriber gets SMS with credentials + dues.

### 3.2 Monthly billing cron (per tenant, 02:00 local)
1. Find subscriptions where `next_invoice_at <= today`.
2. Generate invoice for next period; post ledger entries (`A/R Dr`, `Sales Cr`, `VAT Cr`).
3. Advance `next_invoice_at` by `plan.validity_days`.
4. Render PDF, upload to S3.
5. Queue notification (SMS "Bill BDT 800 due 10 May").

### 3.3 Auto-suspend / restore
- Daily 09:00: subscriptions with `paid_until < today AND suspend_on_due = true` → enqueue `mikrotik_jobs(type=disable)` + disconnect active session.
- On payment received, mark invoice paid → if subscription was suspended, enqueue `enable` job and advance `paid_until` by plan validity.

### 3.4 Payment via bKash (Tokenized Checkout)
1. Self-care / collector app calls `POST /payments/initiate` → server creates `payment_attempts` row with idempotency key, calls bKash `create` API.
2. User completes on bKash; bKash calls our webhook `/webhooks/bkash`.
3. Worker verifies signature, looks up txn by idempotency key, posts `payments` row, allocates to oldest open invoice (FIFO), creates ledger entries.
4. Triggers restore flow if subscription was suspended.
5. Nagad and Rocket follow the same adapter contract in `/packages/payments`.

### 3.5 Drift detection
- Every 15 min `worker-mikrotik` pulls `/ppp/secret` from each router, diffs against `subscriptions` and `mikrotik_jobs(success)`. Discrepancies create `tickets(type=drift)` for NOC.

---

## 4. Roadmap

Sized for a small team (2–3 engineers). Each phase ends with a deployable increment. Calendar assumes ~2-week sprints.

### Phase 0 — Foundation (Sprints 1–2)
- Monorepo (pnpm + Turborepo), TS strict, ESLint, Prettier.
- CI: lint / typecheck / unit / Prisma migrate-check / Playwright smoke.
- Docker Compose dev stack (Postgres 16, Redis, MailHog, MinIO).
- Next.js + Fastify scaffolds talking via tRPC.
- Prisma + first migration: `tenants`, `users`, `roles`, RLS skeleton with a Prisma middleware that issues `SET LOCAL`.
- Auth.js with credentials + TOTP MFA.
- Sentry + OpenTelemetry wired.
- **Exit**: a user can sign up a tenant, log in, see an empty dashboard.

### Phase 1 — Tenant, RBAC, Settings (Sprint 3)
- Tenant settings (timezone, currency, fiscal year, invoice prefix, branding).
- Role + permission management UI.
- API keys, audit log viewer.
- **Exit**: tenant owner can invite users with scoped roles.

### Phase 2 — Subscriber Management (Sprints 4–5)
- Zones / pop_sites tree.
- Service plans CRUD (with MikroTik profile mapping fields, but no RouterOS push yet).
- Subscriber CRUD, KYC upload to S3, bulk CSV import.
- Search, filters, saved views.
- **Exit**: ops can manage subscriber records offline (without router automation).

### Phase 3 — MikroTik Connector (Sprints 6–7)
- `@tikflow/mikrotik` package wrapping `node-routeros` with typed methods (secret add/update/remove, queue add/update, hotspot user, address-list, active-session list).
- Encrypted router credential storage (envelope encryption via KMS or libsodium).
- `worker-mikrotik` with BullMQ; retries with exponential backoff; circuit breaker per router.
- "Test connection" UI action.
- Subscriber create → enqueues `create_secret` job; status reflected on subscription card.
- Periodic active-session sync; live "online/offline" badge.
- **Exit**: creating a subscriber in TikFlow makes them connect on the real MikroTik.

### Phase 4 — Billing Engine (Sprints 8–9)
- Invoice schema + double-entry ledger (with sum-zero trigger).
- Cron-driven invoice generation; PDF via `@react-pdf/renderer`.
- Pro-rata first-month logic + plan-change pro-ration.
- Manual payment entry (cash) by collector with idempotency.
- Dunning rules engine (grace days, reminder schedule).
- Auto-suspend / restore job pipeline (Phase 3 + Phase 4 integration).
- **Exit**: end-to-end "month closes → bills generate → unpaid customers auto-disconnect on day N".

### Phase 5 — Local Payments (Sprints 10–11)
- `@tikflow/payments` common interface (`initiate`, `verify`, `refund`, `webhookHandle`).
- bKash Tokenized Checkout adapter (sandbox → prod).
- Nagad adapter.
- Rocket / DBBL adapter.
- Subscriber self-care portal (`/portal`) — login by phone+OTP, view bill, pay, download receipt.
- Webhook receiver with signature verification + idempotency.
- **Exit**: subscriber pays from phone, line auto-restores within seconds.

### Phase 6 — Notifications (Sprint 12)
- SMS adapter pack (SSL Wireless, MIM, Twilio); template system; per-tenant sender ID config.
- Email via SES/Resend.
- WhatsApp Cloud API (optional).
- Triggered notifications: bill issued, payment received, suspension warning, suspended, restored, ticket updates.
- DLR / delivery-cost tracking.
- **Exit**: every billing event reaches the customer in their preferred channel.

### Phase 7 — Support / Tickets (Sprint 13)
- Ticketing UI with SLA timers.
- Subscriber portal can open tickets.
- Internal notes vs. customer-visible replies.
- Auto-create tickets for drift, payment disputes, router-offline events.
- **Exit**: support team works in-product instead of WhatsApp groups.

### Phase 8 — Reseller / Sub-dealer (Sprint 14)
- Reseller wallet + commission rules.
- Reseller portal: create/recharge their own subscribers, view commission ledger.
- Hierarchical pricing override.
- **Exit**: ISP can onboard area dealers who collect cash and recharge wallet.

### Phase 9 — Analytics & Reports (Sprint 15)
- Materialized views: MRR, churn, ARPU, collection efficiency, aging A/R.
- Per-router bandwidth & subscriber distribution.
- Tax reports (VAT), monthly P&L using ledger.
- Scheduled CSV/Excel email exports.
- **Exit**: owner has a one-page health dashboard.

### Phase 10 — Mobile Collector App (Sprints 16–17)
- React Native (Expo) app for field collectors.
- Offline-first cash collection; sync queue.
- Print Bluetooth receipt; QR-based subscriber lookup.
- **Exit**: door-to-door collectors close invoices without paper.

### Phase 11 — Public API, Webhooks, Marketplace (Sprint 18+)
- OpenAPI 3.1 spec for `subscribers`, `invoices`, `payments`, `routers`.
- Outbound webhooks with HMAC + retries.
- Zapier / Make integration; CRM sync.
- **Exit**: third parties build on TikFlow.

### Phase 12 — Hardening & Scale
- Read replica + PgBouncer.
- Partitioning: `invoices`, `audit_logs`, `notifications` by month with `pg_partman`.
- Per-tenant rate limits, abuse detection.
- SOC2-style controls: backups (PITR), DR drill, encrypted offsite snapshots.
- Pen-test pass on RouterOS credential storage and tenant isolation (RLS fuzzing).

---

## 5. Critical Files To Create (initial scaffolding)

When implementation starts, the first PRs should land:

- `package.json`, `pnpm-workspace.yaml`, `turbo.json` — monorepo root.
- `apps/web/` — Next.js 15 app skeleton.
- `apps/api/src/server.ts` — Fastify bootstrap with tRPC + Zod.
- `apps/api/src/middleware/tenant-context.ts` — sets `app.current_tenant` per request.
- `apps/worker-mikrotik/src/worker.ts` — BullMQ consumer with job handlers.
- `apps/worker-billing/src/jobs/generate-invoices.ts`.
- `packages/db/prisma/schema.prisma` — full schema from §2.
- `packages/db/prisma/migrations/0001_init.sql` — incl. RLS `enable row level security` + policies.
- `packages/mikrotik/src/client.ts` — typed RouterOS wrapper.
- `packages/payments/src/{bkash,nagad,rocket}.ts` — provider adapters behind a common `PaymentProvider` interface.
- `packages/auth/src/rbac.ts` — permission check helper.
- `infra/docker-compose.dev.yml` — Postgres, Redis, MinIO, MailHog.
- `.github/workflows/ci.yml` — lint, typecheck, prisma migrate, test, build.

---

## 6. Verification

Each phase carries explicit acceptance tests:

- **Unit**: Vitest for pure logic (billing math, pro-ration, RBAC).
- **Integration**: `@testcontainers/postgresql` + Redis; spin a real DB, run migrations, exercise tRPC routers; RLS tests assert tenant A cannot read tenant B's rows even with a forged `where`.
- **MikroTik**: a CHR (Cloud Hosted Router) container in CI; worker actually creates/disables secrets against it.
- **Payments**: provider sandboxes (bKash sandbox, Nagad UAT) hit via Playwright; webhook replay tests for idempotency.
- **E2E**: Playwright flows — sign-up tenant → add router → create subscriber → see them online → run billing cron → fail to pay → get suspended → pay via bKash sandbox → get restored, all inside a single CI job.
- **Load**: k6 scenario simulating 50k subscribers across 200 tenants billing on the 1st of the month; p95 invoice-gen latency budget.
- **Security**: weekly `npm audit` + Trivy on images; quarterly RLS fuzz test that randomly forges `tenant_id` and asserts denial.

The Phase 0 exit criterion is the first checkpoint: a tenant can sign up, log in, and the empty dashboard renders with full observability traces visible in Grafana.
