(function () {
  const SYNC_HISTORY_KEY = "northstar.v01.syncHistory";
  const POLARIS_HISTORY_KEY = "northstar.v01.polarisHistory";

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function writeSync(record) {
    const history = readJson(SYNC_HISTORY_KEY, []);
    const next = [...history, record].slice(-120);
    localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(next));
    localStorage.setItem(POLARIS_HISTORY_KEY, JSON.stringify(next));
    return next;
  }

  function readSyncHistory() {
    return readJson(SYNC_HISTORY_KEY, []);
  }

  window.NorthstarPolaris = window.NorthstarPolaris || {};
  window.NorthstarPolaris.syncHistory = { SYNC_HISTORY_KEY, POLARIS_HISTORY_KEY, readJson, writeSync, readSyncHistory };
})();
