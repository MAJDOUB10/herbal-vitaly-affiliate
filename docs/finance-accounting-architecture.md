# Herbal Vitaly — Company-wide Finance & Accounting Integration

**Status:** Technical blueprint + safe, read-only admin workspace. **Not** a completed ERP deployment, an approved accounting system, or an Egyptian tax-compliant production ledger.

## 1. Objective and system boundaries

Operate one reliable financial view of Herbal Vitaly in EGP, covering:

- Shopify sales, customers, discounts, returns, refunds, receivables, and credit notes.
- Supplier master data, purchase orders, supplier invoices, accounts payable, and purchases.
- Operating expenses by department/cost center (Meta Ads, delivery, marketing, payroll, rent, services).
- Product inventory, lot/expiry data where applicable, product valuation and COGS.
- Bank, cash, COD/Bosta clearing, Paymob settlements, fees, and reconciliation.
- Affiliate commission accrual, approval, clawbacks, payouts, and evidence.
- Double-entry journals, trial balance, P&L, balance sheet, cash-flow and aging reports.
- Egypt-specific tax configuration and ETA e-Invoice/e-Receipt integration.

**Source of truth separation:**

- **Shopify** is the commercial order and customer source, not the statutory ledger.
- **Bosta** supplies courier/delivery/collection signals and remittance evidence.
- **Refferq (Neon/PostgreSQL)** is the affiliate attribution and commission *operational* source.
- **Accounting ERP** is the financial posting source of truth.
- External integration gateway stores idempotent source IDs, posting states, failures,
  mapping versions and immutable reconciliation audit trails.

## 2. Recommended open-source engine

Preferred: [Bigcapital](https://github.com/bigcapitalhq/bigcapital) (AGPL-3.0) —
double-entry accounting, financial reporting, expenses, invoices and API support.

Bigcapital is **not** an npm package that can simply be imported into Refferq:
its server runs separately, with MariaDB, additional services and persistent hosting.
Deploy it with supported container infrastructure; do not claim that the Next.js/Vercel
project or Neon database hosts Bigcapital. Review the license before modifying or
distributing the accounting engine as part of a network-accessible service.

Alternative: [ERPNext](https://github.com/frappe/erpnext) if procurement, warehouse,
manufacturing and inventory operations are equally important from day one.
Its Frappe REST API supports application integrations, but it also requires separate
hosting and implementation. Avoid running two competing general ledgers.

### Architecture

```text
Shopify Orders / Products ----> |
Bosta COD / Settlement -------> |  Integration Gateway
Paymob / Banks / CSV ---------> |  (mapping, idempotency, reconciliation,
Affiliate Commissions --------> |   audit, exception queue, retry)
Supplier bills / Expenses ----> |
                                      |
                                      v
                              Accounting ERP API
                              (Bigcapital or ERPNext)
                                      |
                                      v
                           General Ledger / AR / AP
                           P&L / Balance Sheet / Cashflow
                                      |
                                      v
                            /admin/finance (Next.js)
```

Only server-side services may access ERP API keys. Network access should use HTTPS,
fixed allowlisted base URLs, short timeouts, least-privilege API credentials,
secret rotation and separate Preview/Production environments.

## 3. Required ledger and operational mappings

The following **illustrative** accounts require a local accountant's approval
before import; account numbering and classification must match the adopted chart.

| Account | Purpose |
|---|---|
| Bank and Cash | Verified bank balance and cash movements |
| Bosta/COD Clearing | Courier-collected amounts pending bank remittance |
| Payment Gateway Clearing | Paymob and other unsettled PSP receivables |
| Accounts Receivable | Issued customer invoices not yet settled |
| Inventory | Valued finished goods and inventory |
| Accounts Payable | Supplier invoices due |
| Tax Payable / Recoverable | Taxes per confirmed Egyptian category and documentary evidence |
| Affiliate Commissions Payable | Validated accrued commissions not yet paid |
| Product Sales | Recognized revenues with correct invoice/tax treatment |
| Sales Returns and Discounts | Credit notes and contra-revenue |
| Cost of Goods Sold | Inventory cost of products sold |
| Marketing, Logistics, Payroll, Admin | Expense categories and cost centers |

Never use the total of imported Shopify orders directly as GAAP/local-GAAP net
revenue. The invoicing/revenue recognition point requires agreement with accounting
policy and local law; discounts, VAT, freight, cancellations and returns must be
represented separately.

### COD state machine

```text
Shopify created -> Fulfilled -> Bosta delivered -> Courier collection evidenced
   -> Merchant remittance matched to bank -> Reconciled -> Eligible finance review
```

**Never** infer merchant cash receipt from delivered status, or from
`courierCollected: true`. Existing `merchantReconciled` is an operational
review flag, not independently verified bank posting. Match amount, reference,
fees, remittance batch and account statement before the ledger bank entry.

For a settled invoice, use mutually exclusive clearing and receivable moves, not
duplicate sales journal entries. Post Bosta fees separately based on statements.
Record refunds, chargebacks and returned goods using reversible/credit-note
posting rather than deleting a posted journal.

### Affiliate commissions

Accrual recognition policy and applicable deductions must be approved first.
Pending commissions do not create a payable balance by default. Only validated
eligibility and approved financial events may affect the commission payable
account. Approved payout and executed transfer are separate states, with a
payment reference and reversal/clawback rules.

## 4. Egypt tax and invoicing

- Base currency: EGP. Preserve original document currency and FX rate/valuation
  for foreign suppliers and international purchases.
- General Egyptian VAT rate is 14%, **but a product-specific tax matrix must
  be reviewed and signed off by the Egyptian accountant**. Do not hard-code
  14% on every Herbal Vitaly supplement; verify classification, exemptions
  and any schedule tax, as well as changes in effect during 2026.
- Configure tax codes effective by date and document type, and record tax on
  each invoice line with explicit handling of tax-inclusive/exclusive prices.
- Provide adapter for ETA e-Invoice (B2B) and e-Receipt (B2C) subject to
  company obligation and specific onboarding. Store authoritative ETA UUID,
  submission/validation state, signature, timestamps and rejection reason.
- Consult official ETA SDK: https://sdk.invoicing.eta.gov.eg/
- A qualified Egyptian accountant must validate VAT filing, withholding,
  invoicing, expenses, retention periods and the plan of accounts before
  enabling production posting.

## 5. Existing code and migration risks

Verified from this repository:

- `src/proxy.ts` authenticates admin routes with a signed session; routes
  must **also** check active admin role server-side.
- `HvCodOrder` tracks order totals, Bosta states and merchant COD reconciliation,
  but does not contain item costs, taxes or a full Shopify sales document.
- `Commission` and `Payout` reflect affiliate lifecycle, not posted GL entries.
- `Invoice` currently represents **affiliate payout invoices**; do not use it as
  general customer sales invoices. Create separate ERP invoice mappings.
- Legacy `Invoice`, `Coupon` and `Program` default some currencies to INR.
  Audit existing records and workflows before any migration to EGP.
- Existing invoice/commission posting guards protect production COD finances;
  keep them enabled. Do not reuse old invoice writes for the new ERP.
- Current `/admin/finance` reads only existing operational data and deliberately
  returns null for unconnected general-ledger financial statements.

Do not change existing production tables, tax rates, financial balances, webhook
routing, or commission approval automations without a migration plan and
reconciliation-tested staging approval.

## 6. Data contracts for future implementation

Suggested isolated integration entities in PostgreSQL:

- `AccountingConnection`: provider, encrypted secret reference, environment, state.
- `AccountingMapping`: source entity/type, source ID, remote ERP entity ID, mapping version.
- `AccountingEvent`: unique provider/event ID, payload hash, state, retry count, timestamps.
- `AccountingReconciliation`: payment reference, order ID, bank/batch proof, status, approver.
- `AccountingException`: actionable manual review queue, reason and resolution.
- `FinancialSyncRun`: checkpoints, counts, lag, reconciliation discrepancies.

Store monetary amounts as integer piasters for EGP operations, or a proper
fixed-point `Decimal` for FX/ledger calculations. Never use float money values.
Never auto-create a journal posting solely because a webhook was received.
Use immutable audit and distinct `observed`, `validated`, `posted` states.

## 7. Release sequence and acceptance

1. **Discovery and accounting setup**: confirm company accounting entity,
   chart of accounts, fiscal year, EGP, product tax classes, bank sources and
   historical opening balances with the accountant.
2. **ERP sandbox**: deploy Bigcapital or ERPNext outside Vercel; validate
   licensing, backups, restore, SSO or protected accountant identities and APIs.
3. **Master data and connectors**: sync Shopify products/customers and supplier
   records; build item tax, COGS, SKU and partner mapping.
4. **Sales and purchase books**: ingest historical invoices and supplier bills,
   expenses and payment clearing with idempotent APIs; reconcile totals.
5. **Posting**: enable double-entry only after balanced journal checks,
   tax review, permission segregation, audit logging and explicit approval.
6. **Financial reports**: P&L, balance sheet, aging, bank reconciliation,
   VAT report, cost-center/product margins, CSV/PDF export, time filters.
7. **ETA integration**: end-to-end testing on official ETA test environments,
   then production credentials after regulatory/business approval.

Minimum acceptance tests:

- Every posted transaction has equal debits and credits; posted entries cannot
  be silently edited/deleted. Corrections use reversal entries.
- Duplicate Shopify/Bosta webhooks never create duplicate invoices or journals.
- Refunded or cancelled orders do not inflate revenue or commissions.
- Bosta delivered without bank remittance does not increase bank cash.
- Merchant settlement net of fees reconciles to Bosta and bank evidence.
- Suppliers, inventory and purchases roll into correct AP/COGS accounts.
- Month-end balance sheet balances, and P&L ties to ledger accounts.
- Permissions: affiliate users cannot see company-wide financial data;
  accountant/controller have separate review/approval roles.
- Tax calculation is matched to the accountant-approved product tax matrix.
- Posting disabled by default in Production until all staging signoffs pass.

## 8. Deliverable in this initial pull request

- Admin-only `/admin/finance` screen, linked in sidebar.
- Admin-authenticated `/api/admin/finance/overview` (read-only).
- Verified operational Shopify/Bosta/affiliate metrics from Neon.
- Accounting KPIs explicitly unavailable until ERP is deployed.
- No new environment secrets, database migrations, financial writes or production deployment.

**Next engineering milestone:** provision the separate ERP sandbox, confirm its
supported API schema and build and test the connection and invoice mappings.
