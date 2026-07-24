const LIVE_IMPORT_CUTOFF = "2025-10-01";
const LIVE_IMPORT_CUTOFF_ISO = `${LIVE_IMPORT_CUTOFF}T00:00:00.000Z`;
const LIVE_IMPORT_CUTOFF_MS = Date.parse(LIVE_IMPORT_CUTOFF_ISO);

function parsePlatformTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const timestamp = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isOnOrAfterLiveImportCutoff(item = {}) {
  const value = item.create_time || item.publish_date || item.published_at || item.date;
  const timestamp = parsePlatformTimestamp(value);
  return timestamp !== null && timestamp >= LIVE_IMPORT_CUTOFF_MS;
}

function assertOnOrAfterLiveImportCutoff(item = {}) {
  if (!isOnOrAfterLiveImportCutoff(item)) {
    const error = new Error("Record is before the NorthStar live import cutoff.");
    error.code = "before_live_import_cutoff";
    throw error;
  }
}

function toUtcIso(value) {
  const timestamp = parsePlatformTimestamp(value);
  if (timestamp === null) return null;
  return new Date(timestamp).toISOString();
}

module.exports = {
  LIVE_IMPORT_CUTOFF,
  LIVE_IMPORT_CUTOFF_ISO,
  LIVE_IMPORT_CUTOFF_MS,
  parsePlatformTimestamp,
  isOnOrAfterLiveImportCutoff,
  assertOnOrAfterLiveImportCutoff,
  toUtcIso
};
