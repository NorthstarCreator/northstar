const assert = require("node:assert/strict");
const fixture = require("./fixtures/tiktok-shop-affiliate-creator.synthetic");
const {
  ledgerFingerprint,
  createLedgerEntry,
  deduplicateLedgerEntries
} = require("../lib/tiktok-shop-affiliate-creator-ledger");

function entry(overrides = {}) {
  return {
    creatorAccountId: fixture.ACCOUNT_A,
    operation: "search_creator_affiliate_orders",
    providerRecordId: "synthetic-order-1",
    eventType: "estimated_commission",
    effectiveAt: "2024-02-01T18:00:00.000Z",
    currency: "USD",
    amountMinor: 125,
    ...overrides
  };
}

function testDeterministicScopedFingerprint() {
  const first = ledgerFingerprint(entry());
  assert.equal(first, ledgerFingerprint(entry()));
  assert.notEqual(first, ledgerFingerprint(entry({ creatorAccountId: fixture.ACCOUNT_B })));
  assert.notEqual(first, ledgerFingerprint(entry({ eventType: "final_commission" })));
  assert.notEqual(first, ledgerFingerprint(entry({ operation: "get_live_core_stats" })));
  assert.match(first, /^affiliate-ledger:v1:[0-9a-f]{64}$/);
  assert.equal(first.includes("synthetic-order-1"), false);
}

function testImmutableSignedLedgerEventsAndDeduplication() {
  const estimated = createLedgerEntry(entry());
  const refundInput = entry({
    providerRecordId: "synthetic-refund-1",
    eventType: "refund",
    amountMinor: -25
  });
  const refund = createLedgerEntry(refundInput);
  assert.equal(Object.isFrozen(estimated), true);
  assert.equal(refund.amountMinor, -25);
  const deduped = deduplicateLedgerEntries([entry(), entry(), refundInput]);
  assert.equal(deduped.length, 2);
  assert.equal(Object.isFrozen(deduped), true);
}

function testUnknownRevenueCannotBecomeLedgerZero() {
  assert.throws(() => createLedgerEntry(entry({ amountMinor: null })), { code: "invalid_amount_minor" });
  assert.throws(() => createLedgerEntry(entry({ currency: null })), { code: "invalid_currency" });
  assert.throws(() => createLedgerEntry(entry({ eventType: "sale" })), { code: "invalid_event_type" });
  assert.throws(() => createLedgerEntry(entry({ creatorAccountId: "All Accounts" })), { code: "exact_account_required" });
  assert.throws(() => createLedgerEntry({ ...entry(), accessToken: "synthetic-prohibited" }), { code: "invalid_ledger_entry" });
  assert.throws(() => createLedgerEntry(entry({ reversesFingerprint: "synthetic-invalid" })), { code: "invalid_reversal_fingerprint" });
}

[
  testDeterministicScopedFingerprint,
  testImmutableSignedLedgerEventsAndDeduplication,
  testUnknownRevenueCannotBecomeLedgerZero
].forEach((test) => test());

console.log("TikTok Shop Affiliate Creator ledger tests passed.");
