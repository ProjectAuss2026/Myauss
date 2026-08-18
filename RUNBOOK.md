# AUSS Operations Runbook

Operational companion to `DEPLOYMENT.md`. Covers deploy, rollback, secret
rotation (satisfies **KAN-118**), backups, and access. Written for the next
tech officer — aim: productive in one afternoon.

> Platform: **Railway** (one project, `production` environment only for now —
> pre-launch, prod doubles as staging; a real `staging` env is planned
> post-expo, see KAN-110). One always-on API service (Express serves SPA +
> `/api`) + one managed Postgres. Deploys are auto on merge, gated by CI.

---

## 1. Environments & URLs

| Env | Branch | URL | Stripe | Email |
| --- | --- | --- | --- | --- |
| production | `main` | `https://auss-backend-production.up.railway.app` | not yet set (proof-upload covers payments) | Brevo HTTPS API — sender `uoastrengthsociety@gmail.com` |

---

## 2. Deploy

**Normal path (no manual steps):**
1. Feature branch → PR → `dev`. CI (tests, frontend build, npm audit, gitleaks,
   CodeQL) must be green. Merge → **staging auto-deploys**.
2. Verify on staging (see `DEPLOYMENT.md` §5 smoke list).
3. Open `dev → main` PR → 1 approval + green CI → merge → **production
   auto-deploys**. `prisma migrate deploy` runs on boot; Railway keeps the old
   deployment until `/healthz` passes on the new one.

**Migrations:** additive/forward-only. Never edit an applied migration. Enum
value renames use `ALTER TYPE ... RENAME VALUE` (see migration
`20260715000000_rename_membership_need_review_to_in_review`).

**Known gotcha — "SKIPPED" auto-deploy (watch paths):** Railway occasionally
marks a push-triggered deploy as SKIPPED (its watch-path matching). Symptoms:
the deployment list shows the new commit with status SKIPPED and prod still
serves the old bundle. Two fixes:

1. **Dashboard:** service → Settings → deploy section → **clear Watch Paths
   completely (leave the field EMPTY)**. Empty = deploy on ANY change.
   ⚠️ Do NOT put `/` or `/**` — both are literal filters and neither matches
   everything (`/` missed nested files, `/**` missed root-level files —
   confirmed empirically 2026-08-15). This has drifted at least three times.
2. **Manual deploy via API** (works without the dashboard):
   ```bash
   TOKEN=$(grep '^RAILWAY_API_TOKEN=' .env.railway | cut -d= -f2)
   curl -s -X POST https://backboard.railway.com/graphql/v2 \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"query":"mutation { serviceInstanceDeployV2(serviceId: \"1aa4b859-1800-4e99-a843-988df71ea274\", environmentId: \"2cf6b63f-feff-4231-8724-1d62a1ee609a\", commitSha: \"<FULL_SHA>\") }"}'
   ```
   Notes: `deploymentRedeploy` fails on SKIPPED deployments ("no snapshot");
   use `serviceInstanceDeployV2` with the commit SHA instead. Watch-path
   config is not exposed in the GraphQL API — dashboard only.

---

## 3. Rollback

- **App:** Railway dashboard → service → Deployments → previous good build →
  **Redeploy**. One click.
- **Migration:** forward-only — do **not** hand-edit the DB. If a migration is
  bad, ship a new additive migration that corrects it, or restore from backup
  (§5) if data is corrupted. Test the fix on staging first.

---

## 4. Secret rotation (KAN-86 / KAN-118) — pre-prod gate

Run this **at production cutover** (Option B: dev keeps its local `.env`; prod
secrets live only in Railway's secret manager, never a repo `.env`).

**Rotate, in order:**
1. **Gmail app password** — revoke old at <https://myaccount.google.com/apppasswords>, create new, set `SMTP_PASS` in Railway prod.
2. **`JWT_SECRET`** — `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`. (Rotating invalidates all sessions — expected.)
3. **`STUDENT_ID_PEPPER`** — new long random. ⚠️ changing this re-hashes student IDs; only set once before first real data, or plan a migration.
4. **`EXEC_CODE`** — new value (or confirm the mechanism is removed).
5. **Postgres password** — rotate on the Railway DB; update `DATABASE_URL` reference.
6. **Stripe** — swap to **live** keys + create the prod webhook endpoint (`/api/payments/webhook`) and set its signing secret.
7. **`SENTRY_DSN`** — prod project DSN.

**After rotating:** redeploy, run the §5 smoke test, confirm old creds are dead.
Audit git history once: `git log --all --full-history -- .env` (expected empty —
`.env` is gitignored and was never committed). If any secret is ever found in
history, scrub with `git filter-repo` **and rotate again** (history rewrites
don't recall already-cloned secrets).

---

## 5. Backups & restore

- **Enable Railway Postgres backups** on the prod DB.
- **Weekly `pg_dump`** via a scheduled GitHub Action to private storage — the DB
  holds payment-proof + (now) activity-image PII; losing it is worst-case.
- **Test a restore once** into a scratch DB so the procedure is known-good.
- Prune old dumps in line with the committee's PII retention policy.

---

## 6. Monitoring

- **Sentry** (already integrated) — separate staging/prod projects.
- **UptimeRobot** (free) on `/healthz`, alert the committee channel.
- **Railway logs** — structured pino, secrets redacted (KAN-99). Never log raw
  `process.env`; the `check:logging` CI guard enforces this.

---

## 7. Access (own via club accounts, never personal)

| Service | Owner account | Who has access |
| --- | --- | --- |
| Railway | club | ≥2 committee members |
| Stripe | club | treasurer + tech officer |
| Gmail / SMTP | club | tech officer |
| Sentry | club | tech officer |
| GitHub `ProjectAuss2026` | org | committee |

Keep this table current at every committee handover.
