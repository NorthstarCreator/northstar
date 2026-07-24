const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dashboardDir = path.join(__dirname, "../../dashboard/sandbox/dashboard");
const appSource = fs.readFileSync(path.join(dashboardDir, "app.js"), "utf8");
const clientSource = fs.readFileSync(path.join(dashboardDir, "tiktok-sandbox-client.js"), "utf8");

async function testReadOnlyInitializationNeverPostsSync() {
  const requests = [];
  const context = {
    window: { NORTHSTAR_CONFIG: { apiOrigin: "https://sandbox-api.example.test" } },
    fetch: async (url, options) => {
      requests.push({ url, method: options.method, credentials: options.credentials });
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

  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: "https://sandbox-api.example.test/session", method: "GET" },
    { url: "https://sandbox-api.example.test/tiktok/me", method: "GET" },
    { url: "https://sandbox-api.example.test/tiktok/videos", method: "GET" }
  ]);
  assert.ok(requests.every((request) => request.credentials === "include"));
  assert.equal(requests.some((request) => request.url.endsWith("/tiktok/sync")), false);
}

async function testExplicitSyncIsTheOnlyPostPath() {
  const requests = [];
  const context = {
    window: { NORTHSTAR_CONFIG: { apiOrigin: "https://sandbox-api.example.test" } },
    fetch: async (url, options) => {
      requests.push({ url, method: options.method });
      return { ok: true, json: async () => ({ connected: true, csrfToken: "fixture-csrf", videos: [] }) };
    }
  };
  vm.runInNewContext(clientSource, context);
  await context.window.NORTHSTAR_TIKTOK_CLIENT.sync();
  assert.equal(requests.filter((request) => request.url.endsWith("/tiktok/sync") && request.method === "POST").length, 1);

  assert.match(appSource, /if \(session\.connected\) await loadLiveTikTok\(\);/);
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
  assert.match(appSource, /if \(state\.live\.loading \|\| state\.live\.initializing\) return "Loading profile";/);
}

(async () => {
  await testReadOnlyInitializationNeverPostsSync();
  await testExplicitSyncIsTheOnlyPostPath();
  testSyncPendingControlsBothButtonsAndDoubleClicks();
  console.log("Dashboard sync behavior tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
