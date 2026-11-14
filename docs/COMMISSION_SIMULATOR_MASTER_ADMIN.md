# Herbal Vitaly — Master Partner / Admin commission simulator

## Placement
- Master account: `/affiliate/team` and `/affiliate/team/commissions`.
- Admin account: `/admin/partner-networks` (already linked from the Admin sidebar).

## Calculation
- Default eligible sale: 1,000 EGP.
- Total Herbal Vitaly commission budget: **20% of eligible sales**.
- Example slider: sub-partner **4% of sales** (40 EGP), Master **16% of sales** (160 EGP); total 200 EGP.
- The existing stored `teamShareBps` means the fraction of the 20% pool allocated to a sub-partner, **not a rate on sales**. The simulator converts between the two. For example `teamShareBps = 2000` gives 20% of the 20% pool, or 4% of the sale.
- Reuses `splitTeamCommissionPiasters` and integer Egyptian piastres. No floating-point payout arithmetic.
- Rate selection slider spans 0% to 20% of eligible sales (0 to 100% of the pool); a saved rate updates `teamShareBps` for future settlements only.

## Permissions / safeguards
- Master account can configure only its direct sub-partners through the existing `/api/affiliate/team` PATCH (authenticatedMaster).
- Admin can select an authorized Master network and configure only a child belonging to that Master; changes are logged to AuditLog.
- No commissions are approved, credited, transferred, or paid from this simulator.
- No historical snapshots, payout ledgers or COD reconciliation states are changed.
- A simulated result is an illustrative **standard 20% budget**, not a guarantee that any specific order's actual pool equals 20%.
- COD payable amounts still require delivery, carrier collection, merchant reconciliation, refund review and approved settlement.
- No Prisma migration needed for this view; `teamShareBps` already exists.

## QA checklist
1. Open both Master pages and Admin Partner Networks in authenticated sessions.
2. Check 1,000 EGP / 4% result (40 + 160 = 200 EGP).
3. Check 0% and 20% slider extremes and fractional Egyptian piastre inputs.
4. Select a real sub-partner and verify its saved rate is loaded into the simulator.
5. Save a changed rate as Master / Admin; verify the displayed rate reloads and an AuditLog record exists.
6. Confirm an ordinary affiliate cannot call the Master team API and a Master cannot edit a partner from another team.
7. Confirm a non-admin cannot access admin rate changes.
8. Verify commission history, COD statuses and payout balances are unchanged.

Run `npm run verify` and `npm run build` on the preview branch before merging to production.
