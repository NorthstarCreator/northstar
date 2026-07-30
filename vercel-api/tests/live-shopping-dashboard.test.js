const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dashboardDir = path.join(__dirname, "../../dashboard/sandbox/dashboard");
const appSource = fs.readFileSync(path.join(dashboardDir, "app.js"), "utf8");
const mockSource = fs.readFileSync(path.join(dashboardDir, "mock-data.js"), "utf8");
const vercelConfig = fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8");

assert.match(appSource, /\["live-shopping", "LIVE"\]/);
assert.match(appSource, /function renderLiveShopping\(\)/);
for (const label of [
  "LIVE sessions", "GMV", "Orders", "Units", "Estimated commission",
  "Final commission", "Refunds", "Sales per hour", "Sessions & Replays",
  "Featured Products", "Manual", "Imported", "TikTok API", "Unavailable"
]) {
  assert.match(appSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}
assert.match(appSource, /LIVE gifts are a distinct revenue category/);
assert.match(appSource, /All Accounts is a calculated view only/);
assert.match(appSource, /Data Portability Full Archive is excluded/);
assert.match(appSource, /No API call or ingestion path exists/);
assert.doesNotMatch(mockSource, /liveShoppingSessions|liveAffiliateMetrics|liveProductRelationships/);
assert.doesNotMatch(vercelConfig, /live-shopping|live\/shopping/i);

for (const prohibited of [
  "direct messages", "phone numbers", "email addresses", "login IPs",
  "payment details", "searches", "watch history", "customer-service conversations",
  "shopper activity"
]) {
  assert.doesNotMatch(appSource, new RegExp(prohibited, "i"));
}

function response(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

function createElement(id) {
  return {
    id,
    innerHTML: "",
    textContent: "",
    className: "",
    value: "",
    hidden: false,
    dataset: {},
    addEventListener() {},
    setAttribute() {},
    focus() {},
    querySelector(selector) {
      if (id === "dateMenu" && selector === ".date-options") return createElement("dateOptions");
      return null;
    }
  };
}

async function flushPromises(times = 12) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function testRuntimeNavigationAndEmptyStates() {
  const indexSource = fs.readFileSync(path.join(dashboardDir, "index.html"), "utf8");
  const scripts = [...indexSource.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  const ids = [
    "sidebarNav", "pageTitle", "content", "accountButton", "accountMenu", "accountAvatar",
    "accountLabel", "dateButton", "dateMenu", "dateLabel", "customDatePanel", "customStart",
    "customEnd", "syncStrip", "modalRoot", "addAccountButton"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement(id)]));
  const listeners = {};
  const requests = [];
  const document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    }
  };
  const window = { location: { search: "", href: "https://northstar-dashboard-sandbox.vercel.app/" } };
  window.window = window;
  const context = vm.createContext({
    window,
    document,
    console,
    Intl,
    Date,
    URL,
    URLSearchParams,
    navigator: {},
    alert() {},
    setTimeout,
    clearTimeout,
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (new URL(url).pathname === "/session") {
        return response({ connected: false, csrfToken: null, session: null });
      }
      throw new Error(`Unexpected LIVE Shopping request: ${url}`);
    }
  });
  scripts.forEach((script) => {
    vm.runInContext(fs.readFileSync(path.join(dashboardDir, script), "utf8"), context, { filename: script });
  });
  await flushPromises();

  const click = (selector, dataset) => listeners.click({
    target: {
      closest(requested) {
        return requested === selector ? { dataset } : null;
      }
    }
  });
  click("[data-page]", { page: "live-shopping" });
  assert.equal(elements.pageTitle.textContent, "LIVE");
  assert.match(elements.content.innerHTML, /All Accounts is a calculated view only/);
  assert.match(elements.content.innerHTML, /No LIVE Shopping data is being collected/);
  assert.match(elements.content.innerHTML, /No LIVE sessions are available/);
  assert.match(elements.content.innerHTML, /No products are linked to a LIVE session/);
  assert.match(elements.content.innerHTML, /TikTok API/);
  assert.match(elements.content.innerHTML, /Unavailable/);
  assert.match(elements.content.innerHTML, /LIVE gifts are a distinct revenue category/);
  assert.doesNotMatch(elements.content.innerHTML, /data-action="(?:sync|connect|import|upload)-/);

  click("[data-action]", { action: "account", id: "raised-right" });
  assert.match(elements.content.innerHTML, /Prepared for Raised Right; no LIVE Shopping records have been added/);
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ["/session"]);
  assert.equal(requests[0].options.credentials, "include");
  assert.equal(requests[0].options.cache, "no-store");
}

(async () => {
  await testRuntimeNavigationAndEmptyStates();
  console.log("LIVE Shopping dashboard tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
