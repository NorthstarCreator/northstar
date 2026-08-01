const { createHash } = require("node:crypto");
const { exactAccountId } = require("./revenue-provider-contract");
const { PROVIDER } = require("./providers/tiktok-shop-affiliate-creator");

const LEDGER_TYPES = Object.freeze([
  "estimated_commission", "final_commission", "refund", "reversal", "settlement"
]);

class AffiliateCreatorLedgerError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorLedgerError";
    this.code = code;
  }
}

function text(value, code, maximum = 200) {
  const result = String(value || "").trim();
  if (!result || result.length > maximum) throw new AffiliateCreatorLedgerError(code);
  return result;
}

function exactKeys(value) {
  const allowed = [
    "creatorAccountId", "operation", "providerRecordId", "eventType",
    "effectiveAt", "currency", "amountMinor", "reversesFingerprint"
  ];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AffiliateCreatorLedgerError("invalid_ledger_entry");
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new AffiliateCreatorLedgerError("invalid_ledger_entry");
  }
}

function ledgerFingerprint(input) {
  const identity = [
    exactAccountId(input.creatorAccountId),
    PROVIDER,
    text(input.operation, "invalid_operation", 100),
    text(input.providerRecordId, "invalid_provider_record_id"),
    text(input.eventType, "invalid_event_type", 100),
    text(input.effectiveAt, "invalid_effective_at", 40),
    text(input.currency, "invalid_currency", 3).toUpperCase(),
    String(input.amountMinor)
  ];
  if (!LEDGER_TYPES.includes(input.eventType)) throw new AffiliateCreatorLedgerError("invalid_event_type");
  if (!Number.isSafeInteger(input.amountMinor)) throw new AffiliateCreatorLedgerError("invalid_amount_minor");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(input.effectiveAt) || Number.isNaN(Date.parse(input.effectiveAt))) {
    throw new AffiliateCreatorLedgerError("invalid_effective_at");
  }
  if (!/^[A-Z]{3}$/.test(identity[6])) throw new AffiliateCreatorLedgerError("invalid_currency");
  return `affiliate-ledger:v1:${createHash("sha256").update(identity.join("|")).digest("hex")}`;
}

function createLedgerEntry(input) {
  exactKeys(input);
  const fingerprint = ledgerFingerprint(input);
  const reversesFingerprint = input.reversesFingerprint || null;
  if (reversesFingerprint && !/^affiliate-ledger:v1:[0-9a-f]{64}$/.test(reversesFingerprint)) {
    throw new AffiliateCreatorLedgerError("invalid_reversal_fingerprint");
  }
  return Object.freeze({
    creatorAccountId: exactAccountId(input.creatorAccountId),
    provider: PROVIDER,
    operation: input.operation,
    providerRecordId: input.providerRecordId,
    eventType: input.eventType,
    effectiveAt: new Date(input.effectiveAt).toISOString(),
    currency: input.currency.toUpperCase(),
    amountMinor: input.amountMinor,
    fingerprint,
    reversesFingerprint
  });
}

function deduplicateLedgerEntries(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const normalized = createLedgerEntry(entry);
    if (!seen.has(normalized.fingerprint)) seen.set(normalized.fingerprint, normalized);
  }
  return Object.freeze([...seen.values()]);
}

module.exports = {
  LEDGER_TYPES,
  AffiliateCreatorLedgerError,
  ledgerFingerprint,
  createLedgerEntry,
  deduplicateLedgerEntries
};
