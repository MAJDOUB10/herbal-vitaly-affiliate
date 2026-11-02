# Bigcapital self-hosted setup — Herbal Vitaly (Staging)

**Status:** Ready-to-follow operations runbook. No server is provisioned by this file. No Bigcapital instance is currently deployed by this change.

## Provider decision

The current Refferq admin application runs on Vercel (Next.js/Prisma/Neon).
Do **not** attempt to run the official Bigcapital production Docker Compose
inside Vercel or in the Neon PostgreSQL database. Deploy Bigcapital independently
on a Docker-capable Linux VM with persistent storage, TLS and protected backups.

Suggested application host: a properly sized Docker VPS (managed provider possible
if all stateful dependencies are supported). Railway is one possibility but its
multi-service setup must be reviewed explicitly before provisioning.

Official upstream:
- https://github.com/bigcapitalhq/bigcapital
- https://github.com/bigcapitalhq/bigcapital/blob/develop/README.md
- https://github.com/bigcapitalhq/bigcapital/blob/develop/.env.example
- https://github.com/bigcapitalhq/bigcapital/blob/develop/docker-compose.prod.yml

**Important:** Upstream `main`, `develop`, and releases have materially different
Compose and environment configuration (including S3 Garage and analytics services).
Do not combine a Compose file from one revision with a different revision's
`.env.example`. Do not rely on `latest` tags for financial production workloads.

## 1. Hosting prerequisite

- Dedicated Linux server with adequate RAM/CPU for all services.
  Confirm resource needs by load testing; start with at least ~4 vCPU/8 GB RAM
  as a planning assumption, not a vendor guarantee.
- Storage with persistent volumes, tested database and document backups.
- Docker Engine and `docker compose` plugin, HTTPS reverse proxy and domain.
- A staging subdomain, e.g. `accounting-staging.herbalvitaly.com`, reserved
  for internal/accountant-only access. Create DNS only after hosting exists.
- Firewall: open only HTTPS through the proxy; keep MariaDB, Redis, S3 and
  internal service ports unreachable from the public Internet.
- Access control: VPN/SSO or other strong authentication, MFA, restricted admin
  accounts, offsite backups, monitoring, update/rollback procedures.

## 2. Get one audited Bigcapital revision

On the *target host* (not in Vercel or GitHub Actions):

```bash
set -euo pipefail
sudo mkdir -p /opt/herbal-vitaly/bigcapital
sudo chown "$USER":"$USER" /opt/herbal-vitaly/bigcapital
cd /opt/herbal-vitaly/bigcapital

# Explicitly choose a published upstream tag after reviewing its release notes.
# Example: BIGCAPITAL_REF=v0.25.42
: "${BIGCAPITAL_REF:?Select and export an audited upstream tag before continuing}"
git clone --depth 1 --branch "$BIGCAPITAL_REF" \
  https://github.com/bigcapitalhq/bigcapital.git source
cd source

# Copy the environment template from the SAME checkout/revision.
install -m 600 .env.example .env
echo "Edit the protected .env with unique generated secrets before starting."
```

Do not run internet-fetched `curl | bash` scripts without review. Examine the
checked-out `docker-compose.prod.yml` before launching and verify image versions.
If upstream does not provide a functional production Compose at the chosen tag,
stop and resolve compatibility before proceeding.

## 3. Environment secrets and installation

On the host, edit `source/.env` using an editor. Follow the exact template
from the chosen version and use strong random unique credentials for each
nonoptional secret: database user and root passwords, auth/JWT secret(s),
Garage S3 storage secrets where required, ClickHouse where included.

**Never** commit `.env`, database dumps, API keys, backups or service passwords
to GitHub; do not paste them into chat. Keep the secrets in your server's secure
secret store and make the local file readable only by the deployment account.

Set `BASE_URL` to the final HTTPS staging URL. Disable open public registration
after creating an approved accounting administrator; do not lock yourself out.
Configure the email sender and document storage only after verifying their needs.

Review and launch from that same checkout:

```bash
cd /opt/herbal-vitaly/bigcapital/source
docker compose --env-file .env -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.prod.yml up -d
docker compose --env-file .env -f docker-compose.prod.yml ps
```

Examine migration job exit status, application logs, the administrator login,
TLS chain, health behavior and backup/restore before onboarding real data.
Do not expose the staging system publicly without a firewall and TLS.

## 4. Configure the accounting organisation

- Organisation: Herbal Vitaly / the correct legally registered Egyptian entity.
- Base currency EGP; fiscal year and accounts validated by an Egyptian accountant.
- Suppliers, customers, taxes and products: import only after mappings approved.
- Open balances and inventory valuations: reconcile with signed opening statements.
- Restrict roles: owner, finance manager, accountant, read-only auditor.
- Establish tax code mapping for each supplement/product; do not blanket-apply
  Egyptian standard VAT to exempt/specially taxed products.
- Enable ETA e-Invoice/e-Receipt integration only after eligibility and schema
  testing and authorised credentials are available.

## 5. Connect Refferq only in Preview first

Create the integration API key from the Bigcapital self-hosted admin interface.
Its authentication mechanism and tenant organization headers vary across releases:
verify against the deployed version's OpenAPI/SDK and test with **read-only**
queries before building an adapter.

Configure these *only* in Vercel **Preview** environment variables (server-only):

- `BIGCAPITAL_BASE_URL=https://<your-internal-staging-host>`
- `BIGCAPITAL_API_KEY=<private-token>`

The current `GET /api/admin/finance/bigcapital/status` merely confirms whether
the two variables are present. It **does not** call the ERP, test the credentials
or authorize accounting writes.

After staging read-only connection is verified, implement explicit mapping for
Shopify invoices, Bosta remittances, payment provider settlements, supplier bills,
expenses and reconciled affiliate commissions. Preserve native accounting invoice,
posting, tax, refund, credit-note and reversal mechanics.

Do not switch `partner.herbalvitaly.com` Production or create any payment
movement until full ERP-to-Shopify/Bosta balance reconciliation and accountant
sign-off.

## 6. Tests for go-live

- Valid HTTPS endpoint and admin log-in with MFA or comparable controls.
- Successful backup and restore of MariaDB and document/S3 storage.
- Duplicate Shopify/Bosta webhooks do not double-post financial entries.
- Sales, taxes, discounts, refunds and reversals match source documents.
- COD delivered and COD collected do not equal merchant remitted/bank credited.
- Supplier bills and invoice payment status match account reconciliation.
- Posting is restricted and balanced, journals immutable/reversible, permissions verified.
- Statutory ledger financial reports independently approved by accountant.
