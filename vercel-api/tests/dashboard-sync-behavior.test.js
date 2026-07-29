const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dashboardDir = path.join(__dirname, "../../dashboard/sandbox/dashboard");
const appSource = fs.readFileSync(path.join(dashboardDir, "app.js"), "utf8");
const clientSource = fs.readFileSync(path.join(dashboardDir, "northstar-live-client.js"), "utf8");

async function testReadOnlyInitializationNeverPostsSync() {
  const requests = [];
  const context = {
    window: { NORTHSTAR_CONFIG: { apiOrigin: "https://sandbox-api.example.test" } },
    URLSearchParams,
    fetch: async (url, options) => {
      requests.push({ url, method: options.method, credentials: options.credentials, cache: options.cache });
      return {
        ok: true,
        json: async () => url.endsWith("/session")
          ? { connected: true, csrfToken: "fixture-csrf" }
          : { connected: true, profile: {}, videos: [] }
      };
    }
  };
  vm.runInNewContext(clientSource, context);

  await context.window.NORTHSTAR_TIKTOK_CLIENT.bootstrapSession();
  await context.window.NORTHSTAR_TIKTOK_CLIENT.me();
  await context.window.NORTHSTAR_TIKTOK_CLIENT.videos();
  await context.window.NORTHSTAR_TIKTOK_CLIENT.revenueSourceStatus();

  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: "https://sandbox-api.example.test/session", method: "GET" },
    { url: "https://sandbox-api.example.test/tiktok/me", method: "GET" },
    { url: "https://sandbox-api.example.test/tiktok/videos", method: "GET" },
    { url: "https://sandbox-api.example.test/revenue/source-status", method: "GET" }
  ]);
  assert.ok(requests.every((request) => request.credentials === "include"));
  assert.ok(requests.every((request) => request.cache === "no-store"));
  assert.equal(requests.some((request) => request.url.endsWith("/tiktok/sync")), false);
  assert.equal(requests.some((request) => request.method !== "GET"), false);
}

async function testExplicitSyncIsTheOnlyPostPath() {
  const requests = [];
  const context = {
    window: { NORTHSTAR_CONFIG: { apiOrigin: "https://sandbox-api.example.test" } },
    URLSearchParams,
    fetch: async (url, options) => {
      requests.push({ url, method: options.method });
      return { ok: true, json: async () => ({ connected: true, csrfToken: "fixture-csrf", videos: [] }) };
    }
  };
  vm.runInNewContext(clientSource, context);
  await context.window.NORTHSTAR_TIKTOK_CLIENT.sync();
  assert.equal(requests.filter((request) => request.url.endsWith("/tiktok/sync") && request.method === "POST").length, 1);

  assert.match(appSource, /if \(session\.connected\) \{[\s\S]*await loadLiveTikTok\(\);/);
  assert.match(appSource, /if \(action\.dataset\.action === "sync-tiktok"\)[\s\S]*loadLiveTikTok\(\{ preferSync: true \}\)/);
  assert.equal((appSource.match(/client\.sync\(\)/g) || []).length, 1);
}

function testSyncPendingControlsBothButtonsAndDoubleClicks() {
  assert.match(appSource, /syncPending: false/);
  assert.match(appSource, /if \(preferSync && state\.live\.syncPending\) return;/);
  assert.match(appSource, /if \(preferSync\) state\.live\.syncPending = true;/);
  assert.match(appSource, /if \(preferSync\) state\.live\.syncPending = false;/);
  assert.equal((appSource.match(/state\.live\.syncPending \? "Syncing\.\.\." : "Sync Now"/g) || []).length, 2);
  assert.equal((appSource.match(/!state\.live\.syncPending/g) || []).length, 2);
  assert.doesNotMatch(appSource, /state\.live\.loading \? "Syncing\.\.\."/);
  assert.match(appSource, /if \(state\.live\.syncPending\) return "Syncing";/);
  assert.match(appSource, /state\.live\.phase === "refreshing"/);
  assert.match(appSource, /Refreshing live data/);
}

function testLatestReadSelectionUsesGenerationAndSelectionKey() {
  assert.match(appSource, /readRequestGeneration: 0/);
  assert.match(appSource, /queuedReadRequest: null/);
  assert.match(appSource, /generation: \+\+state\.live\.readRequestGeneration/);
  assert.match(appSource, /selectionKey: currentLiveSelectionKey\(\)/);
  assert.match(appSource, /request\.generation === state\.live\.readRequestGeneration/);
  assert.match(appSource, /request\.selectionKey === currentLiveSelectionKey\(\)/);
  assert.match(appSource, /if \(!preferSync && !isCurrentLiveRead\(readRequest\)\) return false;/);
  assert.match(appSource, /state\.live\.queuedReadRequest = readRequest/);
  assert.match(appSource, /queuedRequest\.selectionKey === currentLiveSelectionKey\(\)/);
}

function testDemoRequiresExplicitDisconnectedSession() {
  assert.match(appSource, /function enterExplicitDemoMode\(session = null\)/);
  assert.match(appSource, /if \(session\.connected\) \{[\s\S]*await loadLiveTikTok\(\);[\s\S]*\} else \{[\s\S]*enterExplicitDemoMode\(session\.session \|\| null\)/);
  assert.match(appSource, /shouldHideDataUntilConnectionResolves/);
  assert.match(appSource, /Checking live connection/);
  assert.doesNotMatch(appSource, /catch \(error\) \{[\s\S]{0,300}phase = "demo"/);
}

(async () => {
  await testReadOnlyInitializationNeverPostsSync();
  await testExplicitSyncIsTheOnlyPostPath();
  testSyncPendingControlsBothButtonsAndDoubleClicks();
  testLatestReadSelectionUsesGenerationAndSelectionKey();
  testDemoRequiresExplicitDisconnectedSession();
  console.log("Dashboard sync behavior tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
