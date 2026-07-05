const pages = [
  { id: "executive", label: "Dashboard", icon: "NS" },
  { id: "workspaces", label: "Workspaces", icon: "WS" },
  { id: "products", label: "Products", icon: "PR" },
  { id: "videos", label: "Videos", icon: "VI" },
  { id: "hooks", label: "Hooks", icon: "HK" },
  { id: "samples", label: "Sample Pipeline", icon: "SP" },
  { id: "recommendations", label: "Opportunity Center", icon: "OC" },
  { id: "calendar", label: "Calendar", icon: "CA" },
  { id: "notes", label: "Knowledge Vault™", icon: "KV" },
  { id: "reports", label: "Reports", icon: "RP" },
  { id: "settings", label: "Settings", icon: "SE" }
];

const STORAGE_KEY = "northstar.v01.data";
const SAVED_AT_KEY = "northstar.v01.savedAt";
const BACKUP_VERSION = "Northstar Version 0.2 - Navigation + Product Lifecycle - July 2026";

let defaultDb = {};
let db = {};
let activePage = "executive";
let charts = [];
let selectedProductId = null;
let productFilters = { search: "", account: "All", category: "All", seasonality: "All", status: "All" };
let videoFilters = { search: "", account: "All", product: "All", category: "All", hookType: "All", salesOnly: false, highSaves: false, highShares: false };
let hookSearch = "";
let selectedReportMonth = "June 2026";
let lastSavedAt = localStorage.getItem(SAVED_AT_KEY) || "Never";

const content = document.querySelector("#content");
const pageTitle = document.querySelector("#pageTitle");
const nav = document.querySelector("#nav");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");

document.querySelector("#printButton").addEventListener("click", () => window.print());

function loadData() {
  defaultDb = clone(window.PROJECT_FLYWHEEL_DB || {});
  db = clone(defaultDb);
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      db = mergeDatabase(db, JSON.parse(saved));
    } catch (error) {
      showMessage("Saved data could not be loaded. Default data is showing.", "warn");
    }
  }
  normalizeDatabase();
  startApp();
}

function mergeDatabase(base, saved) {
  const incoming = saved.data || saved;
  return { ...base, ...incoming };
}

function startApp() {
  normalizeDatabase();
  renderNav();
  renderPage("executive");
  updateLastSavedDisplay();
}

function normalizeDatabase() {
  db.sampleRequests = db.sampleRequests || db["sample-requests"] || [];
  db.monthlyReports = db.monthlyReports || db["monthly-reports"] || [];
  db.accounts = db.accounts || [];
  db.products = db.products || [];
  db.videos = db.videos || [];
  db.hooks = db.hooks || [];
  db.audience = db.audience || [];
  db.seasons = db.seasons || {};
  db.notes = db.notes || { businessRules: [], recommendations: [], wins: [], seasonalAlerts: [] };
}

function saveData(message = "Changes saved locally") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  lastSavedAt = new Date().toLocaleString();
  localStorage.setItem(SAVED_AT_KEY, lastSavedAt);
  updateLastSavedDisplay();
  showMessage(message, "good");
}

function updateLastSavedDisplay() {
  const footer = document.querySelector(".sidebar-footer");
  if (!footer) return;
  footer.innerHTML = `<img class="footer-mark" src="assets/brand/northstar-mark.svg" alt="" aria-hidden="true"><span>Northstar Creator OS</span><strong>Version 0.1</strong><small>Day One Edition · July 2026</small><small>The Pulse Engine™ · Last Saved: ${lastSavedAt}</small>`;
}

function showMessage(message, tone = "good") {
  let toast = document.querySelector("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function showError(error) {
  content.innerHTML = `<div class="error">Northstar could not read the local operating system cache.<br>${escapeHtml(error.message)}</div>`;
}

function renderNav() {
  nav.innerHTML = pages.map((page) => `
    <button type="button" data-page="${page.id}" class="${page.id === activePage ? "active" : ""}">
      <span class="nav-icon">${page.icon}</span>
      <span>${page.label}</span>
    </button>
  `).join("");
  nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => renderPage(button.dataset.page)));
}

function renderPage(pageId) {
  activePage = pageId;
  document.body.classList.toggle("executive-home", pageId === "executive");
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  const page = pages.find((entry) => entry.id === pageId);
  pageTitle.textContent = page ? page.label : "Product Detail";

  if (pageId === "executive") renderExecutive();
  if (pageId === "workspaces") renderWorkspaces();
  if (pageId === "workspaces") renderWorkspaces();
  if (pageId === "products") renderProductsDatabase();
  if (pageId === "productDetail") renderProductDetail(selectedProductId);
  if (pageId === "videos") renderVideosDatabase();
  if (pageId === "raisedRight") renderAccount("raisedRight");
  if (pageId === "truthTunedTribe") renderAccount("truthTunedTribe");
  if (pageId === "vault") renderVault();
  if (pageId === "samples") renderSamples();
  if (pageId === "calendar") renderCalendar();
  if (pageId === "hooks") renderHooks();
  if (pageId === "audience") renderAudience();
  if (pageId === "reports") renderReports();
  if (pageId === "notes") renderNotes();
  if (pageId === "settings") renderSettings();
}

function products() { return db.products || []; }
function videos() { return db.videos || []; }
function accounts() { return db.accounts || []; }
function getAccount(id) { return accounts().find((account) => account.id === id) || {}; }
function getProduct(id) { return products().find((product) => product.id === id); }
function productVideos(productId) { return videos().filter((video) => video.productId === productId); }
function productTotals(list = products()) {
  return list.reduce((totals, product) => ({
    gmv: totals.gmv + Number(product.lifetimeGmv || 0),
    commission: totals.commission + Number(product.lifetimeCommission || 0),
    units: totals.units + Number(product.lifetimeUnits || 0),
    products: totals.products + 1
  }), { gmv: 0, commission: 0, units: 0, products: 0 });
}
function accountProducts(accountId) { return products().filter((product) => product.accountId === accountId); }
function categoryTotals(list) {
  return list.reduce((map, product) => {
    const category = product.categoryGroup || String(product.category || "Uncategorized").split("/")[0].trim();
    map[category] = (map[category] || 0) + Number(product.lifetimeGmv || 0);
    return map;
  }, {});
}

function renderExecutive() {
  const totals = productTotals();
  const topProducts = products().slice().sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0)).slice(0, 10);
  const topCategories = Object.entries(categoryTotals(products())).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const reportMonths = unique(db.monthlyReports.map((report) => report.month)).join(", ");

  content.innerHTML = `
    <div class="hero-strip">
      <div><span class="badge good">Northstar Version 0.1</span><h3>Intelligence Engine</h3><p>Northstar now scores products, ranks categories, detects timing, and turns your data into next actions.</p></div>
      <button class="icon-button" data-page="settings">Backups & Settings</button>
    </div>
    <div class="grid four">
      ${metric("Lifetime GMV", money.format(totals.gmv), `${number.format(totals.units)} units sold`, "")}
      ${metric("Lifetime Commission", money.format(totals.commission), `${Math.round((totals.commission / Math.max(totals.gmv, 1)) * 1000) / 10}% blended commission`, "")}
      ${metric("Products", number.format(totals.products), "Saved locally in your browser", "")}
      ${metric("Last Saved", lastSavedAt, "Persistent localStorage backup", "")}
    </div>
    <div class="grid two">${accounts().map(accountSummaryCard).join("")}</div>
    <div class="chart-grid">${chartCard("Top Products Across Both Accounts", "topProductsChart", "Products", "products")}${chartCard("Category Breakdown", "categoriesChart", "Northstar Vault", "vault")}</div>
    <div class="grid two">${listCard("Biggest Wins", db.notes.wins || [], "good")}${listCard("Key Decisions", db.notes.recommendations || [], "hot")}</div>
    ${tableCard("Top 10 Product Records", productRows(topProducts))}
  `;
  bindInternalButtons();
  makeBarChart("topProductsChart", topProducts.map((p) => shortName(p.name)), topProducts.map((p) => Number(p.lifetimeGmv || 0)), ["#2f6fd6", "#0f9f9a"]);
  makeDoughnutChart("categoriesChart", topCategories.map(([category]) => category), topCategories.map(([, total]) => total));
}

function renderProductsDatabase() {
  const filtered = filteredProducts();
  content.innerHTML = `
    <div class="section-title"><div><h3>Products</h3><p>Search, filter, click a product, or add a new local product.</p></div><span class="badge">${filtered.length} records</span></div>
    <details class="form-panel"><summary>Add Product</summary>${productForm()}</details>
    <div class="filter-bar">
      <input id="productSearch" type="search" placeholder="Search products, notes, hooks..." value="${escapeAttr(productFilters.search)}">
      ${select("productAccount", ["All", ...accounts().map((a) => a.name)], productFilters.account)}
      ${select("productCategory", ["All", ...unique(products().map((p) => p.categoryGroup))], productFilters.category)}
      ${select("productSeasonality", ["All", "Evergreen", "Seasonal"], productFilters.seasonality)}
      ${select("productStatus", ["All", "Double Down", "Watch", "Wait", "Retire"], productFilters.status)}
    </div>
    <div class="table-card database-table"><table>
      <thead><tr><th>Product</th><th>Account</th><th>Category</th><th>Season</th><th>GMV</th><th>Commission</th><th>Units</th><th>Sample</th><th>Status</th></tr></thead>
      <tbody>${filtered.map((product) => `<tr class="click-row" data-product-id="${product.id}"><td><strong>${product.name}</strong><span>${product.bestHook || "Add winning hook"}</span></td><td>${product.account}</td><td>${product.categoryGroup}</td><td>${product.evergreenSeasonal}</td><td>${money.format(product.lifetimeGmv || 0)}</td><td>${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td>${product.sampleStatus}</td><td><span class="badge ${statusClass(product.status)}">${product.status}</span></td></tr>`).join("")}</tbody>
    </table></div>
  `;
  bindProductFilters();
  document.querySelector("#addProductForm").addEventListener("submit", handleAddProduct);
  document.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", () => openProduct(row.dataset.productId)));
}

function productForm() {
  return `<form id="addProductForm" class="data-form">
    <label>Product name<input name="name" required placeholder="New product name"></label>
    <label>Account<select name="accountId">${accounts().map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label>
    <label>Category<input name="category" required placeholder="Home / Utility"></label>
    <label>Seasonality<input name="seasonality" value="Evergreen"></label>
    <label>Evergreen/Seasonal<select name="evergreenSeasonal"><option>Evergreen</option><option>Seasonal</option></select></label>
    <label>GMV<input name="lifetimeGmv" type="number" step="0.01" value="0"></label>
    <label>Commission<input name="lifetimeCommission" type="number" step="0.01" value="0"></label>
    <label>Units<input name="lifetimeUnits" type="number" step="1" value="0"></label>
    <label>First promoted<input name="firstPromotedDate" type="date"></label>
    <label>Last promoted<input name="lastPromotedDate" type="date"></label>
    <label>Sample status<select name="sampleStatus">${sampleStatusOptions().map((s) => `<option>${s}</option>`).join("")}</select></label>
    <label>Would promote again<select name="wouldPromoteAgain"><option>Yes</option><option selected>Maybe</option><option>No</option></select></label>
    <label>Status<select name="status"><option>Double Down</option><option selected>Watch</option><option>Wait</option><option>Retire</option></select></label>
    <label>Best hook<input name="bestHook" placeholder="Winning hook"></label>
    <label>Best CTA<input name="bestCta" placeholder="CTA"></label>
    <label class="wide">Notes<textarea name="notes" placeholder="Product notes"></textarea></label>
    <button class="icon-button" type="submit">Save Product</button>
  </form>`;
}

function handleAddProduct(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const account = getAccount(form.get("accountId"));
  const name = form.get("name").trim();
  const category = form.get("category").trim();
  const product = {
    id: uniqueId(`${form.get("accountId")}-${slug(name)}`),
    name,
    accountId: form.get("accountId"),
    account: account.name,
    category,
    categoryGroup: category.split("/")[0].trim(),
    seasonality: form.get("seasonality") || "Evergreen",
    evergreenSeasonal: form.get("evergreenSeasonal"),
    lifetimeGmv: Number(form.get("lifetimeGmv") || 0),
    lifetimeCommission: Number(form.get("lifetimeCommission") || 0),
    lifetimeUnits: Number(form.get("lifetimeUnits") || 0),
    monthlyPerformance: [{ month: selectedReportMonth || "July 2026", gmv: Number(form.get("lifetimeGmv") || 0), commission: Number(form.get("lifetimeCommission") || 0), units: Number(form.get("lifetimeUnits") || 0) }],
    firstPromotedDate: form.get("firstPromotedDate") || "",
    lastPromotedDate: form.get("lastPromotedDate") || "",
    sampleStatus: form.get("sampleStatus"),
    wouldPromoteAgain: form.get("wouldPromoteAgain"),
    status: form.get("status"),
    originalStatus: form.get("status"),
    notes: form.get("notes") || "",
    bestHook: form.get("bestHook") || "",
    bestCta: form.get("bestCta") || "",
    strategyNotes: form.get("notes") || "",
    similarTags: [category.split("/")[0].trim(), form.get("evergreenSeasonal"), form.get("accountId")]
  };
  db.products.push(product);
  saveData(`Product saved: ${product.name}`);
  renderProductsDatabase();
}

function bindProductFilters() {
  document.querySelector("#productSearch").addEventListener("input", (event) => { productFilters.search = event.target.value; renderProductsDatabase(); });
  document.querySelector("#productAccount").addEventListener("change", (event) => { productFilters.account = event.target.value; renderProductsDatabase(); });
  document.querySelector("#productCategory").addEventListener("change", (event) => { productFilters.category = event.target.value; renderProductsDatabase(); });
  document.querySelector("#productSeasonality").addEventListener("change", (event) => { productFilters.seasonality = event.target.value; renderProductsDatabase(); });
  document.querySelector("#productStatus").addEventListener("change", (event) => { productFilters.status = event.target.value; renderProductsDatabase(); });
}

function filteredProducts() {
  const search = productFilters.search.toLowerCase().trim();
  return products().filter((product) => {
    const haystack = [product.name, product.account, product.category, product.notes, product.bestHook, product.bestCta, product.status].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) &&
      (productFilters.account === "All" || product.account === productFilters.account) &&
      (productFilters.category === "All" || product.categoryGroup === productFilters.category) &&
      (productFilters.seasonality === "All" || product.evergreenSeasonal === productFilters.seasonality) &&
      (productFilters.status === "All" || product.status === productFilters.status);
  }).sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0));
}

function openProduct(productId) {
  selectedProductId = productId;
  activePage = "productDetail";
  pageTitle.textContent = "Product Detail";
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  renderProductDetail(productId);
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const relatedVideos = productVideos(product.id);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0)).slice(0, 6);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back to Products</button>
    <div class="detail-header">
      <div><span class="badge ${statusClass(product.status)}">${product.status}</span><h3>${product.name}</h3><p>${product.account} · ${product.category} · ${product.seasonality}</p></div>
      <div class="detail-actions">
        <button class="icon-button" id="addNoteButton">Add Note</button>
        <button class="icon-button" id="addVideoButton">Add Video</button>
        ${["Double Down", "Watch", "Wait", "Retire"].map((status) => `<button class="icon-button ${status === "Retire" ? "danger" : ""}" data-status="${status}">Mark as ${status}</button>`).join("")}
      </div>
    </div>
    <div class="grid four">
      ${metric("Lifetime GMV", money.format(product.lifetimeGmv || 0), "From monthly performance", "")}
      ${metric("Lifetime Commission", money.format(product.lifetimeCommission || 0), "Total commission tracked", "")}
      ${metric("Lifetime Units", number.format(product.lifetimeUnits || 0), "Units sold", "")}
      ${metric("Sample Status", product.sampleStatus, `Promote again: ${product.wouldPromoteAgain}`, "")}
    </div>
    <div class="grid two">
      <div class="card"><h3>Creative Record</h3><div class="field-list"><p><strong>Best hook:</strong> ${product.bestHook || "Add after testing."}</p><p><strong>Best CTA:</strong> ${product.bestCta || "Add after testing."}</p><p><strong>Strategy notes:</strong> ${product.strategyNotes || ""}</p><p><strong>Notes:</strong> ${formatNotes(product.notes)}</p><p><strong>Dates:</strong> ${product.firstPromotedDate || "TBD"} to ${product.lastPromotedDate || "TBD"}</p></div></div>
      ${chartCard("Monthly Performance", "productMonthlyChart", "Reports", "reports")}
    </div>
    <div class="grid two">${tableCard("Related Videos", videoRows(relatedVideos))}<div class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></div></div>
  `;
  bindInternalButtons();
  document.querySelector("#addNoteButton").addEventListener("click", () => {
    const note = prompt("Add a strategy note for this product:");
    if (note) {
      product.notes = [product.notes, `${new Date().toLocaleDateString()}: ${note}`].filter(Boolean).join("\n");
      product.strategyNotes = note;
      saveData(`Note saved for ${product.name}`);
      renderProductDetail(product.id);
    }
  });
  document.querySelector("#addVideoButton").addEventListener("click", () => { videoFilters.product = product.name; renderPage("videos"); });
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    product.status = button.dataset.status;
    saveData(`${product.name} marked as ${product.status}`);
    renderProductDetail(product.id);
  }));
  const monthly = product.monthlyPerformance || [];
  makeBarChart("productMonthlyChart", monthly.map((row) => row.month), monthly.map((row) => Number(row.gmv || 0)), ["#2f6fd6", "#0f9f9a"]);
}

function renderVideosDatabase() {
  const rows = filteredVideos();
  content.innerHTML = `
    <div class="section-title"><div><h3>Videos</h3><p>Video analytics connected to products, hooks, and sales.</p></div><span class="badge">${rows.length} videos</span></div>
    <details class="form-panel"><summary>Add Video</summary>${videoForm()}</details>
    <div class="filter-bar">
      <input id="videoSearch" type="search" placeholder="Search videos, hooks, CTA..." value="${escapeAttr(videoFilters.search)}">
      ${select("videoAccount", ["All", ...accounts().map((a) => a.name)], videoFilters.account)}
      ${select("videoProduct", ["All", ...unique(videos().map((v) => v.productName))], videoFilters.product)}
      ${select("videoCategory", ["All", ...unique(videos().map((v) => v.category))], videoFilters.category)}
      ${select("videoHookType", ["All", ...unique(videos().map((v) => v.hookType))], videoFilters.hookType)}
      <label class="check"><input id="salesOnly" type="checkbox" ${videoFilters.salesOnly ? "checked" : ""}> Sales &gt; 0</label>
      <label class="check"><input id="highSaves" type="checkbox" ${videoFilters.highSaves ? "checked" : ""}> High saves</label>
      <label class="check"><input id="highShares" type="checkbox" ${videoFilters.highShares ? "checked" : ""}> High shares</label>
    </div>
    <div class="table-card database-table"><table><thead><tr><th>Date</th><th>Account</th><th>Product</th><th>Hook</th><th>Views</th><th>Engagement</th><th>Watch</th><th>Sales</th><th>GMV</th><th>Commission</th></tr></thead><tbody>${videoRows(rows)}</tbody></table></div>
  `;
  document.querySelector("#addVideoForm").addEventListener("submit", handleAddVideo);
  bindVideoFilters();
}

function videoForm() {
  return `<form id="addVideoForm" class="data-form">
    <label>Date posted<input name="datePosted" type="date" required></label>
    <label>Product<select name="productId" required>${products().map((p) => `<option value="${p.id}" ${p.name === videoFilters.product ? "selected" : ""}>${p.name}</option>`).join("")}</select></label>
    <label>Hook type<input name="hookType" placeholder="Problem, Books, Seasonal"></label>
    <label>Hook<input name="hook" required placeholder="Opening line"></label>
    <label>CTA<input name="cta" placeholder="Call to action"></label>
    ${["views", "likes", "comments", "shares", "saves", "averageWatchTime", "completionRate", "sales", "gmv", "commission"].map((name) => `<label>${labelize(name)}<input name="${name}" type="number" step="0.01" value="0"></label>`).join("")}
    <label class="wide">Notes<textarea name="notes"></textarea></label>
    <button class="icon-button" type="submit">Save Video</button>
  </form>`;
}

function handleAddVideo(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const product = getProduct(form.get("productId"));
  const video = {
    id: uniqueId(`video-${form.get("datePosted") || new Date().toISOString().slice(0, 10)}`),
    datePosted: form.get("datePosted"),
    accountId: product.accountId,
    account: product.account,
    productId: product.id,
    productName: product.name,
    category: product.categoryGroup,
    hook: form.get("hook"),
    hookType: form.get("hookType") || product.categoryGroup,
    cta: form.get("cta") || "",
    views: Number(form.get("views") || 0), likes: Number(form.get("likes") || 0), comments: Number(form.get("comments") || 0), shares: Number(form.get("shares") || 0), saves: Number(form.get("saves") || 0),
    averageWatchTime: Number(form.get("averageWatchTime") || 0), completionRate: Number(form.get("completionRate") || 0), sales: Number(form.get("sales") || 0), gmv: Number(form.get("gmv") || 0), commission: Number(form.get("commission") || 0),
    notes: form.get("notes") || ""
  };
  db.videos.push(video);
  saveData(`Video saved for ${product.name}`);
  renderVideosDatabase();
}

function bindVideoFilters() {
  ["videoSearch", "videoAccount", "videoProduct", "videoCategory", "videoHookType"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener(id === "videoSearch" ? "input" : "change", (event) => {
      const key = { videoSearch: "search", videoAccount: "account", videoProduct: "product", videoCategory: "category", videoHookType: "hookType" }[id];
      videoFilters[key] = event.target.value;
      renderVideosDatabase();
    });
  });
  ["salesOnly", "highSaves", "highShares"].forEach((id) => document.querySelector(`#${id}`).addEventListener("change", (event) => { videoFilters[id] = event.target.checked; renderVideosDatabase(); }));
}

function filteredVideos() {
  const search = videoFilters.search.toLowerCase().trim();
  return videos().filter((video) => {
    const haystack = [video.productName, video.account, video.category, video.hook, video.cta, video.hookType].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) &&
      (videoFilters.account === "All" || video.account === videoFilters.account) &&
      (videoFilters.product === "All" || video.productName === videoFilters.product) &&
      (videoFilters.category === "All" || video.category === videoFilters.category) &&
      (videoFilters.hookType === "All" || video.hookType === videoFilters.hookType) &&
      (!videoFilters.salesOnly || Number(video.sales || 0) > 0) &&
      (!videoFilters.highSaves || Number(video.saves || 0) >= 400) &&
      (!videoFilters.highShares || Number(video.shares || 0) >= 300);
  }).sort((a, b) => Number(b.gmv || 0) - Number(a.gmv || 0));
}

function renderAccount(accountId) {
  const account = getAccount(accountId);
  const list = accountProducts(accountId).sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0));
  const totals = productTotals(list);
  const audience = db.audience.find((entry) => entry.accountId === accountId) || {};
  const categoryList = Object.entries(categoryTotals(list)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const seasonalSplit = splitSeasonality(list);
  content.innerHTML = `
    <div class="grid four">${metric("GMV", money.format(totals.gmv), `${number.format(totals.units)} units`, account.accent)}${metric("Commission", money.format(totals.commission), `${Math.round((totals.commission / Math.max(totals.gmv, 1)) * 1000) / 10}% of GMV`, account.accent)}${metric("PPS", Number(audience.pps || 0).toFixed(1), audience.tikTokClassification || account.label, account.accent)}${metric("Spotlight", audience.spotlightStatus || "Qualified for July", account.coreBuyerMindset, account.accent)}</div>
    <div class="grid three"><div class="card"><h3>Audience</h3><div class="progress-row">${progress("Male", audience.gender?.male || 0, account.accent)}${progress("Female", audience.gender?.female || 0, account.accent)}</div></div><div class="card"><h3>Age Mix</h3><div class="progress-row">${Object.entries(audience.age || {}).map(([label, value]) => progress(label, value, account.accent)).join("")}</div></div><div class="card"><h3>Strategy</h3><ul class="list"><li>${account.bestVideoStyle}</li><li>${account.seasonalWarning}</li></ul></div></div>
    <div class="chart-grid">${chartCard("Top Product GMV", `${accountId}TopChart`, "View Products", "products")}${chartCard("Category Breakdown", `${accountId}CategoryChart`, "View Vault", "vault")}</div>
    <div class="grid two"><div class="card"><h3>Seasonal vs Evergreen</h3><div class="progress-row">${progress("Evergreen", seasonalSplit.evergreen, account.accent)}${progress("Seasonal", seasonalSplit.seasonal, account.accent)}</div></div>${listCard("Account Rules", [account.coreBuyerMindset, account.notes], accountId === "raisedRight" ? "hot" : "good")}</div>
    ${tableCard(`${account.name} Products`, productRows(list.slice(0, 16)))}
  `;
  bindInternalButtons();
  makeBarChart(`${accountId}TopChart`, list.slice(0, 10).map((p) => shortName(p.name)), list.slice(0, 10).map((p) => Number(p.lifetimeGmv || 0)), account.accent === "redGold" ? ["#c9453f", "#d99a22"] : ["#2f6fd6", "#0f9f9a"]);
  makeDoughnutChart(`${accountId}CategoryChart`, categoryList.map(([category]) => category), categoryList.map(([, total]) => total));
}

function renderVault() {
  const hall = products().slice().sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0));
  content.innerHTML = `<div class="section-title"><div><h3>Northstar Vault: Hall of Fame</h3><p>Sorted by lifetime performance across the local workspace.</p></div></div><div class="product-grid">${hall.map(productCard).join("")}</div>`;
  document.querySelectorAll("[data-card-product]").forEach((card) => card.addEventListener("click", () => openProduct(card.dataset.cardProduct)));
}

function renderSamples() {
  const columns = sampleStatusOptions();
  content.innerHTML = `<div class="section-title"><div><h3>Sample Request Pipeline</h3><p>Change a card status and it saves locally.</p></div></div><div class="kanban">${columns.map((status) => `<section class="kanban-column"><h3>${status}</h3>${db.sampleRequests.filter((item) => item.status === status).map(sampleCard).join("") || `<p class="empty">No cards yet.</p>`}</section>`).join("")}</div>`;
  document.querySelectorAll("[data-sample-status]").forEach((selectEl) => selectEl.addEventListener("change", (event) => {
    const item = db.sampleRequests.find((sample) => sample.id === event.target.dataset.sampleStatus);
    if (!item) return;
    item.status = event.target.value;
    saveData(`${item.productName} moved to ${item.status}`);
    renderSamples();
  }));
}

function renderCalendar() {
  const seasons = db.seasons || {};
  content.innerHTML = `<div class="section-title"><div><h3>Coming Soon Calendar</h3><p>Seasonal planning connected to saved local data.</p></div></div><div class="grid four">${listCard("Current Month Opportunities", seasons.currentMonthOpportunities || [], "good")}${listCard("Next Month Sample Requests", seasons.nextMonthSampleRequests || [], "hot")}${listCard("Evergreen Products to Repost", (seasons.evergreenProductsToRepost || []).map((id) => getProduct(id)?.name).filter(Boolean), "")}${listCard("Seasonal Alerts", db.notes.seasonalAlerts || [], "warn")}</div><div class="grid three">${Object.entries(seasons.opportunitiesByMonth || {}).map(([month, items]) => `<div class="card calendar-card"><h3>${month}</h3><ul class="list">${items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`).join("")}</div>`;
}

function renderHooks() {
  const hooks = filteredHooks();
  content.innerHTML = `<div class="section-title"><div><h3>Hooks</h3><p>Searchable hook database with product and sales context.</p></div><span class="badge">${hooks.length} hooks</span></div><div class="filter-bar"><input id="hookSearch" type="search" placeholder="Search hooks..." value="${escapeAttr(hookSearch)}"></div><div class="hook-grid">${hooks.map((hook) => `<article class="card hook-card"><span class="badge">${hook.category}</span><h3>${hook.text}</h3><p>${hook.productUsed || "No product assigned yet"}</p><div class="mini-stats"><div class="mini-stat"><span>Account</span><strong>${hook.accountUsed || "TBD"}</strong></div><div class="mini-stat"><span>Sales</span><strong>${number.format(hook.salesGenerated || 0)}</strong></div></div><p class="placeholder">${hook.notes}</p></article>`).join("")}</div>`;
  document.querySelector("#hookSearch").addEventListener("input", (event) => { hookSearch = event.target.value; renderHooks(); });
}
function filteredHooks() { const search = hookSearch.toLowerCase().trim(); return db.hooks.filter((hook) => !search || [hook.text, hook.category, hook.accountUsed, hook.productUsed, hook.notes].join(" ").toLowerCase().includes(search)); }

function renderAudience() {
  content.innerHTML = `<div class="section-title"><div><h3>Audience Trends</h3><p>Monthly account demographics from saved local data.</p></div></div><div class="grid two">${db.audience.map((entry) => `<div class="card"><div class="section-title"><div><h3>${entry.account}</h3><p>${entry.month} · ${entry.tikTokClassification}</p></div><span class="badge good">PPS ${entry.pps}</span></div><div class="progress-row">${progress("Male", entry.gender.male, getAccount(entry.accountId).accent)}${progress("Female", entry.gender.female, getAccount(entry.accountId).accent)}${Object.entries(entry.age).map(([label, value]) => progress(label, value, getAccount(entry.accountId).accent)).join("")}</div><ul class="list"><li>${entry.spotlightStatus}</li><li>${entry.mostActiveTime}</li><li>${entry.monthOverMonth.gender}</li></ul></div>`).join("")}</div>`;
}

function renderReports() {
  const months = unique(db.monthlyReports.map((report) => report.month));
  if (!months.includes(selectedReportMonth) && months.length) selectedReportMonth = months[0];
  const reports = db.monthlyReports.filter((report) => report.month === selectedReportMonth);
  content.innerHTML = `<div class="section-title"><div><h3>Reports</h3><p>Add a report and it saves locally.</p></div>${select("reportMonth", months, selectedReportMonth)}</div><details class="form-panel"><summary>Add Monthly Report</summary>${monthlyReportForm()}</details><div class="grid two">${reports.map((report) => `<div class="card scorecard"><h3>${report.account}</h3>${scoreRow("Month", report.month)}${scoreRow("GMV", money.format(report.gmv || 0))}${scoreRow("Commission", money.format(report.commission || 0))}${scoreRow("Units sold", number.format(report.unitsSold || 0))}${scoreRow("Videos posted", report.videosPosted || "Add monthly total")}${scoreRow("Top product", report.topProduct)}${scoreRow("Top category", report.topCategory)}${scoreRow("Biggest win", report.biggestWin)}${scoreRow("Biggest flop", report.biggestFlop)}${scoreRow("Lessons learned", report.lessonsLearned)}${scoreRow("Test next month", report.whatToTestNextMonth)}</div>`).join("")}</div>`;
  document.querySelector("#reportMonth")?.addEventListener("change", (event) => { selectedReportMonth = event.target.value; renderReports(); });
  document.querySelector("#addReportForm").addEventListener("submit", handleAddReport);
}

function monthlyReportForm() {
  return `<form id="addReportForm" class="data-form"><label>Month<input name="month" required placeholder="July 2026"></label><label>Account<select name="accountId">${accounts().map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label>${["gmv", "commission", "unitsSold", "videosPosted"].map((n) => `<label>${labelize(n)}<input name="${n}" type="number" step="0.01" value="0"></label>`).join("")}<label>Top product<input name="topProduct"></label><label>Top category<input name="topCategory"></label><label class="wide">Biggest win<textarea name="biggestWin"></textarea></label><label class="wide">Biggest flop<textarea name="biggestFlop"></textarea></label><label class="wide">Lessons learned<textarea name="lessonsLearned"></textarea></label><label class="wide">What to test next month<textarea name="whatToTestNextMonth"></textarea></label><button class="icon-button" type="submit">Save Monthly Report</button></form>`;
}

function handleAddReport(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const account = getAccount(form.get("accountId"));
  const report = {
    id: uniqueId(`${slug(account.name)}-${slug(form.get("month"))}`),
    month: form.get("month"), account: account.name, accountId: account.id,
    gmv: Number(form.get("gmv") || 0), commission: Number(form.get("commission") || 0), unitsSold: Number(form.get("unitsSold") || 0), videosPosted: Number(form.get("videosPosted") || 0),
    topProduct: form.get("topProduct") || "", topCategory: form.get("topCategory") || "", biggestWin: form.get("biggestWin") || "", biggestFlop: form.get("biggestFlop") || "", lessonsLearned: form.get("lessonsLearned") || "", whatToTestNextMonth: form.get("whatToTestNextMonth") || ""
  };
  db.monthlyReports.push(report);
  selectedReportMonth = report.month;
  saveData(`Monthly report saved: ${report.month} ${report.account}`);
  renderReports();
}

function renderNotes() { content.innerHTML = `<div class="section-title"><div><h3>The Knowledge Vault™</h3><p>Business rules, operating reminders, and reusable creator intelligence.</p></div></div><div class="grid two">${listCard("Business Rules", db.notes.businessRules || [], "good")}${listCard("Creator Compass™ Notes", db.notes.recommendations || [], "hot")}</div>`; }

function renderSettings() {
  content.innerHTML = `<div class="section-title"><div><h3>Settings</h3><p>Backup, restore, or reset your local Northstar database.</p></div><span class="badge good">Last Saved: ${lastSavedAt}</span></div><div class="grid two"><div class="card settings-card"><h3>Backup & Restore</h3><p>Export a JSON backup before major edits. Import restores the full local workspace into this browser.</p><div class="settings-actions"><button id="exportBackup" class="icon-button">Export Backup</button><label class="import-button"><input id="importBackup" type="file" accept="application/json,.json">Import Backup</label></div></div><div class="card settings-card"><h3>Reset</h3><p>Reset clears localStorage and returns to the default data bundled in data/database.js.</p><button id="resetDefault" class="icon-button danger">Reset to Default Data</button></div></div><div class="card"><h3>Local Storage Status</h3><ul class="list"><li>Products: ${products().length}</li><li>Videos: ${videos().length}</li><li>Sample cards: ${db.sampleRequests.length}</li><li>Monthly reports: ${db.monthlyReports.length}</li><li>Last Saved: ${lastSavedAt}</li></ul></div>`;
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  document.querySelector("#importBackup").addEventListener("change", importBackup);
  document.querySelector("#resetDefault").addEventListener("click", resetDefaultData);
}

function exportBackup() {
  const backup = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), lastSavedAt, data: db };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `project-flywheel-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = mergeDatabase(clone(defaultDb), parsed);
      normalizeDatabase();
      saveData("Backup imported and saved locally");
      renderPage("settings");
    } catch (error) {
      showMessage("Import failed. Choose a valid Northstar JSON backup.", "warn");
    }
  };
  reader.readAsText(file);
}

function resetDefaultData() {
  if (!confirm("Reset Northstar to the default bundled data? This clears local saved changes in this browser.")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SAVED_AT_KEY);
  db = clone(defaultDb);
  normalizeDatabase();
  lastSavedAt = "Never";
  updateLastSavedDisplay();
  showMessage("Reset to default data", "warn");
  renderPage("settings");
}

function metric(label, value, note, accent) { return `<div class="metric-card ${accent || ""}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`; }
function accountSummaryCard(account) { const totals = productTotals(accountProducts(account.id)); return `<div class="card"><div class="section-title"><div><h3>${account.name}</h3><p>${account.label}</p></div><span class="badge good">${account.coreBuyerMindset}</span></div><div class="mini-stats"><div class="mini-stat"><span>GMV</span><strong>${money.format(totals.gmv)}</strong></div><div class="mini-stat"><span>Commission</span><strong>${money.format(totals.commission)}</strong></div><div class="mini-stat"><span>Units</span><strong>${number.format(totals.units)}</strong></div></div><ul class="list"><li>${account.bestVideoStyle}</li><li>${(account.bestCategories || []).join(", ")}</li></ul></div>`; }
function chartCard(title, id, detailLabel = "View Details", detailPage = "products") { return `<div class="chart-card"><div class="chart-card-header"><h3>${title}</h3></div><div class="chart-wrapper"><canvas id="${id}"></canvas></div><button class="chart-detail-link" type="button" data-page="${detailPage}">${detailLabel}</button></div>`; }
function listCard(title, items, badgeClass) { return `<div class="card"><h3>${title}</h3><ul class="list">${items.map((item) => `<li><span class="badge ${badgeClass}">Item</span> ${item}</li>`).join("")}</ul></div>`; }
function tableCard(title, rows) { return `<div class="table-card"><div class="section-title"><div><h3>${title}</h3></div></div><table><thead><tr><th>Product</th><th>Account</th><th>Category</th><th>GMV</th><th>Commission</th><th>Units</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No records yet.</td></tr>`}</tbody></table></div>`; }
function productRows(list) { return list.map((p) => `<tr class="click-row" data-product-id="${p.id}"><td><strong>${p.name}</strong><span>${p.seasonality}</span></td><td>${p.account}</td><td>${p.categoryGroup}</td><td>${money.format(p.lifetimeGmv || 0)}</td><td>${money.format(p.lifetimeCommission || 0)}</td><td>${number.format(p.lifetimeUnits || 0)}</td><td><span class="badge ${statusClass(p.status)}">${p.status}</span></td></tr>`).join(""); }
function videoRows(list) { return list.map((v) => `<tr><td>${v.datePosted}</td><td>${v.account}</td><td>${v.productName}</td><td><strong>${v.hook}</strong><span>${v.cta}</span></td><td>${number.format(v.views || 0)}</td><td>${number.format(v.likes || 0)} likes · ${number.format(v.saves || 0)} saves · ${number.format(v.shares || 0)} shares</td><td>${v.averageWatchTime || 0}s · ${v.completionRate || 0}%</td><td>${number.format(v.sales || 0)}</td><td>${money.format(v.gmv || 0)}</td><td>${money.format(v.commission || 0)}</td></tr>`).join("") || `<tr><td colspan="10">No videos yet.</td></tr>`; }
function productCard(product) { return `<article class="product-card" data-card-product="${product.id}"><div><h4>${product.name}</h4><div class="product-meta"><span class="badge">${product.account}</span><span class="badge ${statusClass(product.status)}">${product.status}</span></div></div><div class="mini-stats"><div class="mini-stat"><span>GMV</span><strong>${money.format(product.lifetimeGmv || 0)}</strong></div><div class="mini-stat"><span>Commission</span><strong>${money.format(product.lifetimeCommission || 0)}</strong></div><div class="mini-stat"><span>Units</span><strong>${number.format(product.lifetimeUnits || 0)}</strong></div></div><div class="product-meta"><span class="badge">${product.seasonality}</span><span class="badge">Again: ${product.wouldPromoteAgain}</span></div></article>`; }
function sampleCard(item) { return `<article class="sample-card"><div><h4>${item.productName}</h4><p>${item.account} · ${item.category}</p></div><div class="product-meta"><span class="badge ${priorityClass(item.priority)}">${item.priority}</span><span class="badge">${item.season}</span><span class="badge">${item.commissionPotential}</span></div><label class="sample-status">Status ${select(`sample-${item.id}`, sampleStatusOptions(), item.status).replace("<select", `<select data-sample-status="${item.id}"`)}</label><p>${item.notes}</p></article>`; }
function progress(label, value, accent) { return `<div><div class="progress-label"><span>${label}</span><strong>${value}%</strong></div><div class="bar ${accent || ""}"><span style="width:${Math.min(value, 100)}%"></span></div></div>`; }
function scoreRow(label, value) { return `<div class="scorecard-row"><span>${label}</span><strong>${value}</strong></div>`; }
function select(id, options, selected) { return `<select id="${id}">${options.map((option) => `<option value="${escapeAttr(option)}" ${option === selected ? "selected" : ""}>${option}</option>`).join("")}</select>`; }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function splitSeasonality(list) { const evergreen = list.filter((product) => product.evergreenSeasonal === "Evergreen").length; return { evergreen: Math.round((evergreen / Math.max(list.length, 1)) * 100), seasonal: Math.round(((list.length - evergreen) / Math.max(list.length, 1)) * 100) }; }
function statusClass(status) { const text = String(status || "").toLowerCase(); if (text.includes("double") || text.includes("selling")) return "good"; if (text.includes("wait") || text.includes("watch")) return "hot"; if (text.includes("retire")) return "warn"; return ""; }
function priorityClass(priority) { if (priority === "High") return "good"; if (priority === "Low") return "warn"; return "hot"; }
function bindInternalButtons() { document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => renderPage(button.dataset.page))); document.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", () => openProduct(row.dataset.productId))); document.querySelectorAll("[data-card-product]").forEach((card) => card.addEventListener("click", () => openProduct(card.dataset.cardProduct))); }
function makeBarChart(id, labels, values, colors) { const canvas = document.querySelector(`#${id}`); if (!canvas) return; if (!window.Chart) { canvas.replaceWith(chartFallback(labels, values)); return; } charts.push(new Chart(canvas, { type: "bar", data: { labels, datasets: [{ label: "GMV", data: values, borderRadius: 8, backgroundColor: values.map((_, i) => colors[i % colors.length]) }] }, options: chartOptions() })); }
function makeDoughnutChart(id, labels, values) { const canvas = document.querySelector(`#${id}`); if (!canvas) return; if (!window.Chart) { canvas.replaceWith(chartFallback(labels, values)); return; } charts.push(new Chart(canvas, { type: "doughnut", data: { labels, datasets: [{ data: values, borderWidth: 2, borderColor: "#fff", backgroundColor: ["#2f6fd6", "#0f9f9a", "#d99a22", "#c9453f", "#2f9e62", "#7c3aed", "#0f766e", "#db2777"] }] }, options: doughnutOptions() })); }
function chartOptions() { return { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#687386", boxWidth: 10, padding: 10 } } }, layout: { padding: { top: 2, right: 2, bottom: 0, left: 2 } }, scales: { x: { ticks: { color: "#687386", maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: "rgba(148,163,184,0.14)" } }, y: { ticks: { color: "#687386", callback: (value) => `$${value}`, maxTicksLimit: 5 }, grid: { color: "rgba(148,163,184,0.22)" } } } }; }
function doughnutOptions() { return { responsive: true, maintainAspectRatio: false, cutout: "58%", plugins: { legend: { position: "bottom", labels: { color: "#687386", boxWidth: 10, padding: 10 } } }, layout: { padding: { top: 0, right: 0, bottom: 0, left: 0 } } }; }
function chartFallback(labels, values) { const wrap = document.createElement("div"); wrap.className = "progress-row"; const max = Math.max(...values, 1); wrap.innerHTML = labels.map((label, index) => progress(label, Math.round((values[index] / max) * 100), "")).join(""); return wrap; }
function sampleStatusOptions() { return ["Request Now", "Requested", "Approved", "Shipped", "Delivered", "Filmed", "Posted", "Selling", "Watch", "Wait"]; }
function uniqueId(base) { let id = slug(base); let n = 2; const used = new Set([...products().map((p) => p.id), ...videos().map((v) => v.id), ...db.monthlyReports.map((r) => r.id)]); while (used.has(id)) id = `${slug(base)}-${n++}`; return id; }
function slug(value) { return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
function labelize(value) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()); }
function shortName(name) { return name.length > 28 ? `${name.slice(0, 27)}...` : name; }
function formatNotes(notes) { return escapeHtml(notes || "Add notes after testing.").replace(/\n/g, "<br>"); }
function clone(value) { return JSON.parse(JSON.stringify(value || {})); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }


/* Northstar Version 0.1 - Day One Edition - July 2026 */
function renderPage(pageId) {
  activePage = pageId;
  document.body.classList.toggle("executive-home", pageId === "executive");
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  const page = pages.find((entry) => entry.id === pageId);
  pageTitle.textContent = page ? page.label : "Product Detail";

  if (pageId === "executive") renderExecutive();
  if (pageId === "products") renderProductsDatabase();
  if (pageId === "productDetail") renderProductDetail(selectedProductId);
  if (pageId === "videos") renderVideosDatabase();
  if (pageId === "recommendations") renderRecommendations();
  if (pageId === "raisedRight") renderAccount("raisedRight");
  if (pageId === "truthTunedTribe") renderAccount("truthTunedTribe");
  if (pageId === "vault") renderVault();
  if (pageId === "samples") renderSamples();
  if (pageId === "calendar") renderCalendar();
  if (pageId === "hooks") renderHooks();
  if (pageId === "audience") renderAudience();
  if (pageId === "reports") renderReports();
  if (pageId === "notes") renderNotes();
  if (pageId === "settings") renderSettings();
}

function renderExecutive() {
  const briefing = todayBriefing();
  content.innerHTML = `
    <section class="today-hero">
      <div class="northstar-mark" aria-hidden="true">✦</div>
      <div>
        <p class="eyebrow">${briefing.greeting}</p>
        <h1>Today</h1>
        <p>${briefing.date}</p>
      </div>
      <div class="today-version"><strong>Northstar</strong><span>Version 0.1 · Day One Edition</span></div>
    </section>

    <section class="today-focus-card">
      <div>
        <span class="badge good">Today’s Focus</span>
        <h2>${briefing.focus.title}</h2>
        <p>${briefing.focus.note}</p>
      </div>
      <button class="icon-button" data-page="recommendations">Open Opportunity Center</button>
    </section>

    <section class="priority-grid">
      ${briefing.priorities.map(priorityCard).join("")}
    </section>

    <div class="today-layout">
      <section class="card product-spotlight">
        <div class="section-title"><div><h3>Product Spotlight</h3><p>The product most worth your attention.</p></div><span class="score-pill ${briefing.spotlight.score.tierClass}">${briefing.spotlight.score.score}</span></div>
        <h2>${briefing.spotlight.product.name}</h2>
        <div class="mini-stats">
          <div class="mini-stat"><span>Units</span><strong>${number.format(briefing.spotlight.product.lifetimeUnits || 0)}</strong></div>
          <div class="mini-stat"><span>Commission</span><strong>${money.format(briefing.spotlight.product.lifetimeCommission || 0)}</strong></div>
          <div class="mini-stat"><span>Timing</span><strong>${seasonIntelligence(briefing.spotlight.product)}</strong></div>
        </div>
        <p class="next-move"><strong>Recommendation:</strong> ${productNextMove(briefing.spotlight.product)}</p>
        <button class="chart-detail-link" data-product-id="${briefing.spotlight.product.id}">Open product detail</button>
      </section>

      <section class="card opportunity-panel">
        <div class="section-title"><div><h3>Opportunity Panel</h3><p>Products and categories to request next.</p></div></div>
        <div class="brief-list">${briefing.requests.map((item) => `<article><strong>${item.title}</strong><span>${item.note}</span></article>`).join("")}</div>
      </section>

      <section class="card knowledge-card">
        <div class="section-title"><div><h3>Knowledge Card</h3><p>One lesson to carry into today.</p></div></div>
        <blockquote>${briefing.lesson}</blockquote>
        <button class="chart-detail-link" data-page="notes">Open Knowledge Base</button>
      </section>

      <section class="card seasonal-card">
        <div class="section-title"><div><h3>Seasonal Reminder</h3><p>What is coming in the next 60 days.</p></div></div>
        <div class="brief-list">${briefing.seasonal.map((item) => `<article><strong>${item}</strong><span>Prepare samples, hooks, and posting angles.</span></article>`).join("")}</div>
      </section>
    </div>

    <div class="grid two">
      <section class="card pipeline-summary">
        <div class="section-title"><div><h3>Sample Pipeline Summary</h3><p>Where sample decisions stand today.</p></div><button class="chart-detail-link" data-page="samples">Manage Pipeline</button></div>
        <div class="pipeline-counts">${briefing.pipeline.map((row) => `<div><strong>${row.count}</strong><span>${row.status}</span></div>`).join("")}</div>
      </section>

      <section class="card account-health">
        <div class="section-title"><div><h3>Account Health</h3><p>Opportunity score by workspace.</p></div><button class="chart-detail-link" data-page="workspaces">Open Workspaces</button></div>
        <div class="health-grid">${briefing.health.map((account) => `<article><span>${account.icon}</span><div><strong>${account.name}</strong><p>${account.note}</p></div><b>${account.score}</b></article>`).join("")}</div>
      </section>
    </div>

    <section class="quick-actions card">
      <div class="section-title"><div><h3>Quick Actions</h3><p>Move the business forward without hunting through menus.</p></div></div>
      <div class="quick-action-grid">
        <button class="icon-button" data-page="products">Add Product</button>
        <button class="icon-button" data-page="videos">Add Video</button>
        <button class="icon-button" data-page="samples">Request Sample</button>
      <button class="icon-button" data-page="notes">Write Note</button>
      </div>
    </section>
  `;
  bindInternalButtons();
}

function todayBriefing() {
  const ranked = scoredProducts();
  const spotlight = ranked[0] || products()[0];
  const topCategory = categoryRankings()[0];
  const requestItems = requestOpportunities();
  const seasonal = seasonalNext60Days();
  const lesson = (db.monthlyReports || []).find((report) => report.lessonsLearned)?.lessonsLearned || (db.notes.businessRules || [])[0] || 'Build recurring content from proven winners.';
  return {
    greeting: greetingForNow(),
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    focus: {
      title: `Double Down on ${topCategory?.category || spotlight?.categoryGroup || 'your strongest category'}`,
      note: topCategory ? `${topCategory.category} is leading with ${money.format(topCategory.gmv)} GMV, ${number.format(topCategory.units)} units, and ${topCategory.products} tracked products.` : 'Northstar will generate a stronger focus as more products are added.'
    },
    priorities: todayPriorities(spotlight, requestItems, seasonal),
    spotlight: { product: spotlight, score: flywheelScore(spotlight) },
    requests: requestItems,
    lesson,
    seasonal,
    pipeline: sampleStatusOptions().map((status) => ({ status, count: (db.sampleRequests || []).filter((item) => item.status === status).length })).filter((row) => row.count > 0),
    health: accountHealth()
  };
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayPriorities(spotlight, requests, seasonal) {
  const repost = scoredProducts().find((product) => seasonIntelligence(product) === 'Evergreen' && product.id !== spotlight?.id) || spotlight;
  return [
    { label: 'Film', title: spotlight ? `Film ${shortName(spotlight.name)}` : 'Film the top product', note: spotlight ? productNextMove(spotlight) : 'Add product data to generate a filming priority.', page: 'products' },
    { label: 'Request', title: requests[0]?.title || 'Request next sample', note: requests[0]?.note || 'Use upcoming season and category strength to pick samples.', page: 'samples' },
    { label: 'Repost', title: repost ? `Repost ${shortName(repost.name)}` : 'Repost an evergreen winner', note: repost ? `${seasonIntelligence(repost)} · ${flywheelScore(repost).label}` : 'Evergreen winners belong in rotation.', page: 'products' },
    { label: 'Analyze', title: 'Review Opportunity Center', note: 'Check Double Down, Watch, Wait, and Retire lanes before posting.', page: 'recommendations' }
  ];
}

function priorityCard(item) {
  return `<article class="priority-card"><span>${item.label}</span><h3>${item.title}</h3><p>${item.note}</p><button class="chart-detail-link" data-page="${item.page}">Go</button></article>`;
}

function requestOpportunities() {
  const queue = (db.sampleRequests || []).filter((item) => item.status === 'Request Now').slice(0, 4).map((item) => ({ title: item.productName, note: `${item.category || 'Opportunity'} · ${item.priority || 'Medium'} priority` }));
  const categories = categoryRankings().slice(0, 3).map((row) => ({ title: `${row.category} adjacencies`, note: `${money.format(row.gmv)} GMV signal · request adjacent products` }));
  return [...queue, ...categories].slice(0, 5);
}

function seasonalNext60Days() {
  const next = db.seasons?.nextMonthSampleRequests || [];
  const timeline = db.seasons?.holidayPrepTimeline || {};
  const timelineItems = Object.values(timeline).flat().slice(0, 4);
  return unique([...next, ...timelineItems]).slice(0, 6);
}

function accountHealth() {
  return accounts().map((account) => {
    const list = accountProducts(account.id);
    const score = Math.round(list.reduce((sum, product) => sum + flywheelScore(product).score, 0) / Math.max(list.length, 1));
    const top = list.slice().sort((a, b) => flywheelScore(b).score - flywheelScore(a).score)[0];
    return {
      name: account.name,
      icon: account.id === 'raisedRight' ? '❤️' : '💙',
      score,
      note: top ? `Top move: ${shortName(top.name)}` : 'Add product records to score this workspace.'
    };
  });
}

function renderWorkspaces() {
  content.innerHTML = `
    <div class="section-title"><div><h3>Workspaces</h3><p>Choose the operating lane you want to guide.</p></div></div>
    <div class="workspace-grid">
      <button class="workspace-card raised" data-page="raisedRight"><span>❤️</span><h3>Raised Right</h3><p>Useful problem-solvers, practical proof, home, garden, patriotic, and outdoor decisions.</p><small>Open workspace</small></button>
      <button class="workspace-card tribe" data-page="truthTunedTribe"><span>💙</span><h3>Truth Tuned Tribe</h3><p>Knowledge, curiosity, wellness, books, education, and explainers.</p><small>Open workspace</small></button>
    </div>
  `;
  bindInternalButtons();
}

function renderProductsDatabase() {
  const filtered = filteredProducts().sort((a, b) => flywheelScore(b).score - flywheelScore(a).score);
  content.innerHTML = `
    <div class="section-title"><div><h3>Products</h3><p>Sorted by Northstar Score so the strongest opportunities rise first.</p></div><span class="badge">${filtered.length} records</span></div>
    <details class="form-panel"><summary>Add Product</summary>${productForm()}</details>
    <div class="filter-bar">
      <input id="productSearch" type="search" placeholder="Search products, notes, hooks..." value="${escapeAttr(productFilters.search)}">
      ${select("productAccount", ["All", ...accounts().map((a) => a.name)], productFilters.account)}
      ${select("productCategory", ["All", ...unique(products().map((p) => p.categoryGroup))], productFilters.category)}
      ${select("productSeasonality", ["All", "Evergreen", "Seasonal"], productFilters.seasonality)}
      ${select("productStatus", ["All", "Double Down", "Watch", "Wait", "Retire"], productFilters.status)}
    </div>
    <div class="table-card database-table"><table>
      <thead><tr><th>Score</th><th>Product</th><th>Account</th><th>Category</th><th>Timing</th><th>GMV</th><th>Commission</th><th>Units</th><th>Status</th></tr></thead>
      <tbody>${filtered.map(productIntelligenceRow).join("")}</tbody>
    </table></div>
  `;
  bindProductFilters();
  document.querySelector("#addProductForm").addEventListener("submit", handleAddProduct);
  document.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", () => openProduct(row.dataset.productId)));
}

function renderRecommendations() {
  const groups = recommendationGroups();
  const rankings = categoryRankings();
  content.innerHTML = `
    <div class="section-title"><div><h3>Opportunity Center</h3><p>Automatically sorted by Northstar Score, season timing, and audience fit.</p></div><span class="badge good">Decision Board</span></div>
    <div class="recommendation-grid">
      ${Object.entries(groups).map(([name, list]) => `<section class="recommendation-column"><h3>${name}</h3>${list.map(recommendationCard).join("") || `<p class="empty">No products in this lane.</p>`}</section>`).join("")}
    </div>
    <section class="card"><div class="section-title"><div><h3>Category Rankings</h3><p>Monthly category strength from all product records.</p></div></div>${categoryRankingTable(rankings)}</section>
  `;
  bindInternalButtons();
}

function renderVault() {
  const all = scoredProducts();
  const topCommission = products().slice().sort((a, b) => (b.lifetimeCommission || 0) - (a.lifetimeCommission || 0)).slice(0, 6);
  const topGmv = products().slice().sort((a, b) => (b.lifetimeGmv || 0) - (a.lifetimeGmv || 0)).slice(0, 6);
  const topUnits = products().slice().sort((a, b) => (b.lifetimeUnits || 0) - (a.lifetimeUnits || 0)).slice(0, 6);
  const topHooks = videos().slice().sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 6);
  content.innerHTML = `
    <div class="section-title"><div><h3>Hall of Fame</h3><p>All-time winners and reusable proof points.</p></div></div>
    <div class="grid two">
      <section class="card"><h3>All Time Winners</h3><div class="score-list">${all.slice(0, 6).map(scoreRowCard).join("")}</div></section>
      <section class="card"><h3>Top Categories</h3>${categoryRankingTable(categoryRankings().slice(0, 6))}</section>
      <section class="card"><h3>Top Commission</h3><div class="score-list">${topCommission.map(simpleWinnerRow).join("")}</div></section>
      <section class="card"><h3>Top GMV</h3><div class="score-list">${topGmv.map(simpleWinnerRow).join("")}</div></section>
      <section class="card"><h3>Top Units</h3><div class="score-list">${topUnits.map(simpleWinnerRow).join("")}</div></section>
      <section class="card"><h3>Top Hooks</h3><div class="score-list">${topHooks.map(hookWinnerRow).join("")}</div></section>
    </div>
  `;
  bindInternalButtons();
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const score = flywheelScore(product);
  const timeline = productTimeline(product);
  const relatedVideos = productVideos(product.id);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).sort((a, b) => flywheelScore(b).score - flywheelScore(a).score).slice(0, 6);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back to Products</button>
    <div class="detail-header intelligence-detail">
      <div><span class="badge ${statusClass(product.status)}">${product.status}</span><h3>${product.name}</h3><p>${product.account} · ${product.category} · ${seasonIntelligence(product)}</p></div>
      <div class="score-badge ${score.tierClass}"><strong>${score.score}</strong><span>${score.label}</span></div>
      <div class="detail-actions">
        <button class="icon-button" id="addNoteButton">Add Note</button>
        <button class="icon-button" id="addVideoButton">Add Video</button>
        ${["Double Down", "Watch", "Wait", "Retire"].map((status) => `<button class="icon-button ${status === "Retire" ? "danger" : ""}" data-status="${status}">Mark as ${status}</button>`).join("")}
      </div>
    </div>
    <div class="grid four">
      ${metric("Northstar Score", `${score.score} ${score.label}`, score.reason, "")}
      ${metric("Lifetime GMV", money.format(product.lifetimeGmv || 0), "Revenue signal", "")}
      ${metric("Commission", money.format(product.lifetimeCommission || 0), "Profit signal", "")}
      ${metric("Units", number.format(product.lifetimeUnits || 0), "Demand signal", "")}
    </div>
    <div class="grid two">
      <section class="card"><h3>Product Timeline</h3><div class="timeline">${timeline.map((item) => `<div class="timeline-item ${item.done ? "done" : ""}"><span></span><div><strong>${item.label}</strong><p>${item.value}</p></div></div>`).join("")}</div></section>
      <section class="card"><h3>Decision Notes</h3><div class="field-list"><p><strong>Best hook:</strong> ${product.bestHook || "Add after testing."}</p><p><strong>Best CTA:</strong> ${product.bestCta || "Add after testing."}</p><p><strong>Season:</strong> ${seasonIntelligence(product)}</p><p><strong>Next move:</strong> ${productNextMove(product)}</p><p><strong>Notes:</strong> ${formatNotes(product.notes)}</p></div></section>
    </div>
    <div class="grid two">${tableCard("Related Videos", videoRows(relatedVideos))}<div class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></div></div>
  `;
  bindInternalButtons();
  document.querySelector("#addNoteButton").addEventListener("click", () => {
    const note = prompt("Add a strategy note for this product:");
    if (note) {
      product.notes = [product.notes, `${new Date().toLocaleDateString()}: ${note}`].filter(Boolean).join("\n");
      product.strategyNotes = note;
      saveData(`Note saved for ${product.name}`);
      renderProductDetail(product.id);
    }
  });
  document.querySelector("#addVideoButton").addEventListener("click", () => { videoFilters.product = product.name; renderPage("videos"); });
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    product.status = button.dataset.status;
    saveData(`${product.name} marked as ${product.status}`);
    renderProductDetail(product.id);
  }));
}

function productRows(list) { return list.sort((a, b) => flywheelScore(b).score - flywheelScore(a).score).map(productIntelligenceRow).join(""); }
function productCard(product) { const score = flywheelScore(product); return `<article class="product-card" data-card-product="${product.id}"><div class="product-card-top"><h4>${product.name}</h4><div class="score-pill ${score.tierClass}">${score.score}</div></div><div class="product-meta"><span class="badge">${product.account}</span><span class="badge ${statusClass(product.status)}">${score.label}</span><span class="badge">${seasonIntelligence(product)}</span></div><div class="mini-stats"><div class="mini-stat"><span>GMV</span><strong>${money.format(product.lifetimeGmv || 0)}</strong></div><div class="mini-stat"><span>Commission</span><strong>${money.format(product.lifetimeCommission || 0)}</strong></div><div class="mini-stat"><span>Units</span><strong>${number.format(product.lifetimeUnits || 0)}</strong></div></div><p class="placeholder">${productNextMove(product)}</p></article>`; }

function productIntelligenceRow(product) {
  const score = flywheelScore(product);
  return `<tr class="click-row" data-product-id="${product.id}"><td><span class="score-pill ${score.tierClass}">${score.score}</span><span>${score.label}</span></td><td><strong>${product.name}</strong><span>${productNextMove(product)}</span></td><td>${product.account}</td><td>${product.categoryGroup}</td><td>${seasonIntelligence(product)}</td><td>${money.format(product.lifetimeGmv || 0)}</td><td>${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td><span class="badge ${statusClass(score.label)}">${score.label}</span></td></tr>`;
}

function executiveInsights() {
  const ranked = scoredProducts();
  const top = ranked[0];
  const categories = categoryRankings();
  const highestCommission = products().slice().sort((a, b) => (b.lifetimeCommission || 0) - (a.lifetimeCommission || 0))[0];
  const highestUnits = products().slice().sort((a, b) => (b.lifetimeUnits || 0) - (a.lifetimeUnits || 0))[0];
  const ending = products().filter((p) => seasonIntelligence(p) === "Ending Soon").sort((a, b) => (b.lifetimeGmv || 0) - (a.lifetimeGmv || 0))[0];
  const requestCategory = suggestedRequestCategory();
  return [
    { icon: "🏆", title: "Biggest Winner This Month", value: top?.name || "No product yet", note: top ? `${top.account} · Score ${flywheelScore(top).score}` : "Add product data to generate this." },
    { icon: "📈", title: "Fastest Growing Category", value: categories[0]?.category || "No category yet", note: categories[0] ? `${money.format(categories[0].gmv)} GMV · ${categories[0].units} units` : "Built from category rankings." },
    { icon: "💰", title: "Highest Commission Product", value: highestCommission?.name || "No product yet", note: highestCommission ? money.format(highestCommission.lifetimeCommission || 0) : "Commission leader appears here." },
    { icon: "⭐", title: "Highest Units Sold", value: highestUnits?.name || "No product yet", note: highestUnits ? `${number.format(highestUnits.lifetimeUnits || 0)} units` : "Unit leader appears here." },
    { icon: "🔥", title: "Product To Double Down On", value: top?.name || "No product yet", note: top ? productNextMove(top) : "Score-driven recommendation." },
    { icon: "⚠️", title: "Seasonal Product Nearing End", value: ending?.name || "No urgent seasonal risk", note: ending ? `${ending.seasonality} · plan replacement content` : "No Ending Soon products detected." },
    { icon: "💡", title: "Suggested Category To Request Next", value: requestCategory, note: "Based on category strength and upcoming season." }
  ];
}

function executiveActions() {
  const ranked = scoredProducts();
  const top = ranked[0];
  const ending = products().find((p) => seasonIntelligence(p) === "Ending Soon" && (p.lifetimeGmv || 0) > 50);
  const coming = products().find((p) => seasonIntelligence(p) === "Coming Soon");
  const water = products().find((p) => /water/i.test(p.name + p.category));
  return [
    top ? `Make another ${top.name} video` : "Add product data to generate a first action",
    coming ? `Request or film ${coming.categoryGroup} products before the season hits` : "Request next-month seasonal samples",
    ending ? `Replace ${ending.name} with a fresher seasonal angle` : "Check seasonal products for timing risk",
    water ? `Re-film ${water.name} with a proof-first hook` : `Request more ${suggestedRequestCategory()} products`
  ];
}

function scoredProducts() { return products().slice().sort((a, b) => flywheelScore(b).score - flywheelScore(a).score); }
function flywheelScore(product) {
  const maxUnits = Math.max(...products().map((p) => Number(p.lifetimeUnits || 0)), 1);
  const maxCommission = Math.max(...products().map((p) => Number(p.lifetimeCommission || 0)), 1);
  const maxGmv = Math.max(...products().map((p) => Number(p.lifetimeGmv || 0)), 1);
  const units = (Number(product.lifetimeUnits || 0) / maxUnits) * 30;
  const commission = (Number(product.lifetimeCommission || 0) / maxCommission) * 20;
  const gmv = (Number(product.lifetimeGmv || 0) / maxGmv) * 20;
  const season = seasonIntelligence(product);
  const evergreen = season === "Evergreen" ? 10 : season === "Coming Soon" ? 7 : 4;
  const timing = season === "Coming Soon" ? 10 : season === "Evergreen" ? 9 : season === "Seasonal" ? 6 : 3;
  const audience = audienceFit(product);
  const total = Math.round(units + commission + gmv + evergreen + timing + audience);
  const score = Math.max(0, Math.min(100, total));
  return { score, ...scoreLabel(score), reason: `${Math.round(units)} unit · ${Math.round(commission)} commission · ${Math.round(gmv)} GMV · ${audience} fit` };
}
function scoreLabel(score) {
  if (score >= 95) return { label: "Excellent", tierClass: "excellent" };
  if (score >= 84) return { label: "Strong", tierClass: "strong" };
  if (score >= 72) return { label: "Good", tierClass: "good-score" };
  if (score >= 40) return { label: "Watch", tierClass: "watch-score" };
  return { label: "Retire", tierClass: "retire-score" };
}
function audienceFit(product) {
  const account = getAccount(product.accountId);
  const category = String(product.categoryGroup || "").toLowerCase();
  const best = (account.bestCategories || []).join(" ").toLowerCase();
  if (best.includes(category)) return 10;
  if (/book|peptide|wellness|health/.test(category) && product.accountId === "truthTunedTribe") return 10;
  if (/garden|utility|home|patriotic|outdoor|water/.test(category) && product.accountId === "raisedRight") return 9;
  return 6;
}
function seasonIntelligence(product) {
  const text = `${product.evergreenSeasonal || ""} ${product.seasonality || ""} ${product.category || ""}`.toLowerCase();
  if (text.includes("evergreen")) return "Evergreen";
  const current = String(db.seasons?.currentMonth || new Date().toLocaleString("en-US", { month: "long" })).toLowerCase();
  if ((current === "july" || current === "august") && /(july 4|pool|spring|garden|summer)/.test(text)) return "Ending Soon";
  if (/(fall|football|halloween|christmas|holiday|gift|winter|tailgating)/.test(text)) return "Coming Soon";
  return "Seasonal";
}
function productNextMove(product) {
  const score = flywheelScore(product).score;
  const season = seasonIntelligence(product);
  if (score >= 84) return `Double down: film another ${product.categoryGroup} angle.`;
  if (season === "Coming Soon") return `Prepare ahead: request or film before demand peaks.`;
  if (season === "Ending Soon") return `Use soon or replace with next-season samples.`;
  if (score < 40) return `Retire unless a new hook proves demand.`;
  return `Watch: test one more hook before scaling.`;
}
function recommendationGroups() {
  return scoredProducts().reduce((groups, product) => {
    const score = flywheelScore(product).score;
    const lane = score >= 84 ? "DOUBLE DOWN" : score >= 60 ? "WATCH" : score >= 40 ? "WAIT" : "RETIRE";
    groups[lane].push(product);
    return groups;
  }, { "DOUBLE DOWN": [], WATCH: [], WAIT: [], RETIRE: [] });
}
function recommendationCard(product) { const score = flywheelScore(product); return `<article class="recommendation-card" data-card-product="${product.id}"><div><span class="score-pill ${score.tierClass}">${score.score}</span><strong>${product.name}</strong></div><p>${productNextMove(product)}</p><span class="badge">${seasonIntelligence(product)}</span></article>`; }
function categoryRankings() {
  const map = new Map();
  products().forEach((product) => {
    const category = product.categoryGroup || "Uncategorized";
    const row = map.get(category) || { category, gmv: 0, commission: 0, units: 0, products: 0 };
    row.gmv += Number(product.lifetimeGmv || 0);
    row.commission += Number(product.lifetimeCommission || 0);
    row.units += Number(product.lifetimeUnits || 0);
    row.products += 1;
    map.set(category, row);
  });
  return [...map.values()].sort((a, b) => b.gmv + b.commission * 2 + b.units - (a.gmv + a.commission * 2 + a.units));
}
function categoryRankingTable(rows) { return `<div class="ranking-table"><table><thead><tr><th>Category</th><th>GMV</th><th>Commission</th><th>Units</th><th>Products</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${row.category}</strong></td><td>${money.format(row.gmv)}</td><td>${money.format(row.commission)}</td><td>${number.format(row.units)}</td><td>${row.products}</td></tr>`).join("")}</tbody></table></div>`; }
function suggestedRequestCategory() {
  const next = db.seasons?.nextMonthSampleRequests || [];
  const strong = categoryRankings()[0]?.category || "wellness";
  const seasonal = next.find((item) => /football|halloween|immune|fall|tailgating/i.test(item));
  return seasonal || `${strong} adjacencies`;
}
function insightCard(item) { return `<article class="insight-card"><span class="insight-icon">${item.icon}</span><div><h4>${item.title}</h4><strong>${item.value}</strong><p>${item.note}</p></div></article>`; }
function scoreRowCard(product) { const score = flywheelScore(product); return `<button class="score-row" data-product-id="${product.id}"><span class="score-pill ${score.tierClass}">${score.score}</span><div><strong>${product.name}</strong><p>${score.label} · ${product.account} · ${seasonIntelligence(product)}</p></div></button>`; }
function simpleWinnerRow(product) { return `<button class="score-row" data-product-id="${product.id}"><span class="score-pill">${number.format(product.lifetimeUnits || 0)}</span><div><strong>${product.name}</strong><p>${money.format(product.lifetimeGmv || 0)} GMV · ${money.format(product.lifetimeCommission || 0)} commission</p></div></button>`; }
function hookWinnerRow(video) { return `<div class="score-row"><span class="score-pill hot">${number.format(video.sales || 0)}</span><div><strong>${video.hook}</strong><p>${video.productName} · ${money.format(video.gmv || 0)} GMV</p></div></div>`; }
function productTimeline(product) {
  const sample = String(product.sampleStatus || "");
  const related = productVideos(product.id);
  const saleVideos = related.filter((video) => Number(video.sales || 0) > 0).sort((a, b) => a.datePosted.localeCompare(b.datePosted));
  const posted = related.slice().sort((a, b) => a.datePosted.localeCompare(b.datePosted));
  const filmedDone = /Filmed|Posted|Selling/i.test(sample) || related.length > 0;
  return [
    { label: "Requested", value: sample || "No sample record", done: !!sample },
    { label: "Received", value: /Delivered|Filmed|Posted|Selling/i.test(sample) ? sample : "Not confirmed", done: /Delivered|Filmed|Posted|Selling/i.test(sample) },
    { label: "Filmed", value: filmedDone ? "Creative exists or sample marked filmed" : "Not filmed yet", done: filmedDone },
    { label: "Posted", value: posted[0]?.datePosted || product.firstPromotedDate || "Not posted yet", done: related.length > 0 || !!product.firstPromotedDate },
    { label: "First Sale", value: saleVideos[0]?.datePosted || (Number(product.lifetimeUnits || 0) > 0 ? product.firstPromotedDate || "June 2026" : "No sale yet"), done: Number(product.lifetimeUnits || 0) > 0 },
    { label: "Latest Sale", value: saleVideos.at(-1)?.datePosted || product.lastPromotedDate || "No latest sale", done: Number(product.lifetimeUnits || 0) > 0 },
    { label: "Lifetime Status", value: `${flywheelScore(product).label} · ${seasonIntelligence(product)}`, done: true }
  ];
}


/* Northstar Sprint 2 - The Pulse Engine™ */
const PULSE_SNAPSHOTS_KEY = "northstar.v01.pulseSnapshots";
const DECISION_LOG_KEY = "northstar.v01.decisionLog";
let pulseState = { current: null, previous: null, comparison: null, snapshots: [], log: [] };

function loadData() {
  defaultDb = clone(window.PROJECT_FLYWHEEL_DB || {});
  db = clone(defaultDb);
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      db = mergeDatabase(db, JSON.parse(saved));
    } catch (error) {
      showMessage("Saved data could not be loaded. Default data is showing.", "warn");
    }
  }
  normalizeDatabase();
  initializePulseEngine("app-open");
  startApp();
}

function saveData(message = "Changes saved locally") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  lastSavedAt = new Date().toLocaleString();
  localStorage.setItem(SAVED_AT_KEY, lastSavedAt);
  initializePulseEngine("local-save");
  updateLastSavedDisplay();
  showMessage(message, "good");
}

function renderExecutive() {
  initializePulseEngine("view-pulse");
  const pulse = buildPulseBriefing();
  content.innerHTML = `
    <section class="pulse-hero">
      <div class="pulse-mark ${pulse.hasMajorChanges ? "pulse-once" : ""}" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">${greetingForNow()} Jennifer</p>
        <h1>NORTHSTAR</h1>
        <h2>Creator Operating System</h2>
        <p>One place to guide every creator decision.</p>
        <p><strong>The Morning Brief™</strong> · <strong>NORTHSTAR PULSE</strong> · <strong>The Pulse Engine™</strong> analyzed your latest creator data. Here is what changed.</p>
      </div>
      <div class="pulse-meta"><strong>${pulse.reviewDate}</strong><span>The Mark™ · The Spark™</span><span>${pulse.snapshotLabel}</span></div>
    </section>

    <section class="pulse-strip ${pulse.hasMajorChanges ? "" : "quiet"}">
      ${pulse.changes.length ? pulse.changes.map(changeAlert).join("") : `<article class="pulse-alert blue"><span>→</span><div><strong>No major changes detected since your last review.</strong><p>Northstar will surface movement when product, category, sample, or recommendation data changes.</p></div></article>`}
    </section>

    <div class="grid two">
      <section class="card recommendation-brief primary">
        <span class="badge good">The Creator Compass™ · Today's Top Recommendation</span>
        <h2>${pulse.topRecommendation.title}</h2>
        <div class="confidence"><strong>${pulse.topRecommendation.confidence}%</strong><span>The Confidence Engine™</span></div>
        <p><strong>Reason:</strong> ${pulse.topRecommendation.reason}</p>
        <button class="icon-button" data-page="products">Act on this</button>
      </section>
      <section class="card recommendation-brief secondary">
        <span class="badge hot">Second Recommendation</span>
        <h2>${pulse.secondRecommendation.title}</h2>
        <div class="confidence"><strong>${pulse.secondRecommendation.confidence}%</strong><span>The Confidence Engine™</span></div>
        <p><strong>Reason:</strong> ${pulse.secondRecommendation.reason}</p>
        <button class="icon-button" data-page="samples">Review samples</button>
      </section>
    </div>

    <section class="movement-grid">
      ${movementPanel("Top Gainers", pulse.movement.gainers, "green")}
      ${movementPanel("Top Decliners", pulse.movement.decliners, "red")}
      ${movementPanel("New Sellers", pulse.movement.newSellers, "blue")}
      ${movementPanel("Products Cooling", pulse.movement.cooling, "gold")}
      ${movementPanel("Dormant Products", pulse.movement.dormant, "red")}
    </section>

    <div class="grid two">
      <section class="card category-movement-card">
        <div class="section-title"><div><h3>Category Movement</h3><p>Direction compared with the previous snapshot.</p></div></div>
        <div class="category-movement">${pulse.categoryMovement.map(categoryMovementRow).join("")}</div>
      </section>
      <section class="card compare-card">
        <div class="section-title"><div><h3>Compare Snapshots</h3><p>Choose a review window.</p></div></div>
        <div class="compare-options">
          ${["Previous snapshot", "7 days", "30 days"].map((label) => `<button class="compare-button ${label === pulse.compareMode ? "active" : ""}" data-compare="${label}">${label}</button>`).join("")}
        </div>
        <p>${pulse.compareSummary}</p>
      </section>
    </div>

    <div class="grid two">
      <section class="card pulse-history-card">
        <div class="section-title"><div><h3>Pulse History</h3><p>Major changes only.</p></div></div>
        <div class="pulse-timeline">${pulse.history.map(historyItem).join("") || `<p class="empty">No prior movement yet.</p>`}</div>
      </section>
      <section class="card decision-log-card">
        <div class="section-title"><div><h3>Decision Log</h3><p>Recommendations preserved locally.</p></div></div>
        <div class="decision-log">${pulse.decisionLog.map(decisionLogRow).join("")}</div>
      </section>
    </div>
  `;
  bindInternalButtons();
  document.querySelectorAll("[data-compare]").forEach((button) => button.addEventListener("click", () => {
    localStorage.setItem("northstar.v01.compareMode", button.dataset.compare);
    renderExecutive();
  }));
  document.querySelectorAll("[data-decision-status]").forEach((selectEl) => selectEl.addEventListener("change", (event) => updateDecisionStatus(event.target.dataset.decisionStatus, event.target.value)));
}

function initializePulseEngine(reason = "snapshot") {
  const snapshots = readJson(PULSE_SNAPSHOTS_KEY, []);
  const current = createPulseSnapshot(reason);
  const latest = snapshots.at(-1);
  let nextSnapshots = snapshots;
  if (!latest || latest.fingerprint !== current.fingerprint) {
    nextSnapshots = [...snapshots, current].slice(-80);
    localStorage.setItem(PULSE_SNAPSHOTS_KEY, JSON.stringify(nextSnapshots));
  }
  pulseState.snapshots = nextSnapshots;
  pulseState.current = nextSnapshots.at(-1) || current;
  pulseState.previous = nextSnapshots.length > 1 ? nextSnapshots.at(-2) : null;
  pulseState.comparison = comparePulseSnapshots(pulseState.previous, pulseState.current);
  pulseState.log = readJson(DECISION_LOG_KEY, []);
}

function createPulseSnapshot(reason) {
  const productData = products().map((product) => ({
    id: product.id,
    name: product.name,
    account: product.account,
    category: product.categoryGroup || product.category,
    units: Number(product.lifetimeUnits || 0),
    gmv: Number(product.lifetimeGmv || 0),
    commission: Number(product.lifetimeCommission || 0),
    status: product.status,
    season: seasonIntelligence(product),
    score: flywheelScore(product).score
  }));
  const categories = categoryRankings().map((row) => ({ ...row }));
  const sampleCounts = Object.fromEntries(sampleStatusOptions().map((status) => [status, (db.sampleRequests || []).filter((item) => item.status === status).length]));
  const payload = { products: productData, categories, sampleCounts };
  return {
    id: `snap-${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    label: new Date().toLocaleString(),
    ...payload,
    fingerprint: stableFingerprint(payload)
  };
}

function comparePulseSnapshots(previous, current) {
  if (!previous || !current) return { productChanges: [], categoryChanges: [], sampleChanges: [], hasMajorChanges: false };
  const previousProducts = new Map(previous.products.map((product) => [product.id, product]));
  const productChanges = current.products.map((product) => {
    const before = previousProducts.get(product.id) || { units: 0, gmv: 0, commission: 0, score: 0 };
    return {
      ...product,
      previousUnits: before.units || 0,
      deltaUnits: product.units - (before.units || 0),
      deltaGmv: product.gmv - (before.gmv || 0),
      deltaCommission: product.commission - (before.commission || 0),
      deltaScore: product.score - (before.score || 0),
      isNewSeller: (before.units || 0) === 0 && product.units > 0
    };
  });
  const previousCategories = new Map(previous.categories.map((category) => [category.category, category]));
  const categoryChanges = current.categories.map((category) => {
    const before = previousCategories.get(category.category) || { units: 0, gmv: 0, commission: 0, products: 0 };
    return { ...category, deltaUnits: category.units - before.units, deltaGmv: category.gmv - before.gmv, deltaCommission: category.commission - before.commission };
  });
  const sampleChanges = Object.entries(current.sampleCounts).map(([status, count]) => ({ status, count, delta: count - (previous.sampleCounts?.[status] || 0) }));
  const hasMajorChanges = productChanges.some((change) => Math.abs(change.deltaUnits) >= 1 || Math.abs(change.deltaGmv) >= 25 || change.isNewSeller) || categoryChanges.some((change) => Math.abs(change.deltaGmv) >= 50) || sampleChanges.some((change) => change.delta !== 0);
  return { productChanges, categoryChanges, sampleChanges, hasMajorChanges };
}

function buildPulseBriefing() {
  const compareMode = localStorage.getItem("northstar.v01.compareMode") || "Previous snapshot";
  const comparison = comparisonForMode(compareMode);
  const movement = pulseMovement(comparison);
  const categoryMovement = pulseCategoryMovement(comparison);
  const topRecommendation = pulseTopRecommendation(movement, categoryMovement);
  const secondRecommendation = pulseSecondRecommendation();
  ensureDecisionLogged(topRecommendation);
  ensureDecisionLogged(secondRecommendation);
  pulseState.log = readJson(DECISION_LOG_KEY, []);
  return {
    reviewDate: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    snapshotLabel: pulseState.previous ? `Compared with ${new Date(pulseState.previous.createdAt).toLocaleString()}` : 'Baseline snapshot created',
    hasMajorChanges: comparison.hasMajorChanges,
    changes: pulseAlerts(movement, categoryMovement, comparison),
    topRecommendation,
    secondRecommendation,
    movement,
    categoryMovement,
    compareMode,
    compareSummary: compareSummary(comparison, compareMode),
    history: pulseHistory(),
    decisionLog: pulseState.log.slice(-8).reverse()
  };
}

function comparisonForMode(mode) {
  const current = pulseState.current;
  if (!current) return pulseState.comparison;
  if (mode === "Previous snapshot") return pulseState.comparison;
  const days = mode === "7 days" ? 7 : 30;
  const cutoff = Date.now() - days * 86400000;
  const candidate = pulseState.snapshots.filter((snapshot) => new Date(snapshot.createdAt).getTime() <= cutoff).at(-1) || pulseState.snapshots[0] || null;
  return comparePulseSnapshots(candidate, current);
}

function pulseMovement(comparison) {
  const changes = comparison.productChanges || [];
  return {
    gainers: changes.filter((change) => change.deltaUnits > 0 || change.deltaGmv > 0).sort((a, b) => b.deltaUnits - a.deltaUnits || b.deltaGmv - a.deltaGmv).slice(0, 5),
    decliners: changes.filter((change) => change.deltaUnits < 0 || change.deltaGmv < 0).sort((a, b) => a.deltaUnits - b.deltaUnits || a.deltaGmv - b.deltaGmv).slice(0, 5),
    newSellers: changes.filter((change) => change.isNewSeller).sort((a, b) => b.units - a.units).slice(0, 5),
    cooling: changes.filter((change) => change.deltaScore < 0 || change.deltaUnits < 0).sort((a, b) => a.deltaScore - b.deltaScore).slice(0, 5),
    dormant: changes.filter((change) => change.units === 0 || ((change.deltaUnits || 0) === 0 && change.units <= 1)).sort((a, b) => a.units - b.units).slice(0, 5)
  };
}

function pulseCategoryMovement(comparison) {
  const rows = comparison.categoryChanges?.length ? comparison.categoryChanges : categoryRankings().map((row) => ({ ...row, deltaGmv: 0, deltaUnits: 0 }));
  return rows.slice().sort((a, b) => Math.abs(b.deltaGmv) - Math.abs(a.deltaGmv) || b.gmv - a.gmv).slice(0, 8);
}

function pulseAlerts(movement, categoryMovement, comparison) {
  const alerts = [];
  movement.gainers.slice(0, 3).forEach((item) => alerts.push({ type: 'green', icon: '⬆', title: `${item.name} gained ${formatDelta(item.deltaUnits, 'sale')}`, note: `${money.format(Math.max(item.deltaGmv, 0))} added GMV since comparison.` }));
  movement.decliners.slice(0, 2).forEach((item) => alerts.push({ type: 'red', icon: '⬇', title: `${item.name} slowed`, note: `${formatDelta(item.deltaUnits, 'sale')} versus previous snapshot.` }));
  movement.newSellers.slice(0, 2).forEach((item) => alerts.push({ type: 'blue', icon: '🔥', title: `${item.name} became a new seller`, note: `${item.units} total units now tracked.` }));
  categoryMovement.filter((row) => row.deltaGmv > 0).slice(0, 2).forEach((row) => alerts.push({ type: 'gold', icon: '⭐', title: `${row.category} category is accelerating`, note: `${money.format(row.deltaGmv)} added GMV.` }));
  const request = suggestedRequestCategory();
  if (request) alerts.push({ type: 'gold', icon: '📦', title: `${request} should now be requested`, note: 'Seasonal or category opportunity window is open.' });
  return alerts.slice(0, 6);
}

function pulseTopRecommendation(movement, categoryMovement) {
  const top = movement.gainers[0] ? getProduct(movement.gainers[0].id) : scoredProducts()[0];
  const category = categoryMovement.find((row) => row.deltaGmv > 0)?.category || top?.categoryGroup || 'top product';
  const confidence = recommendationConfidence(top, movement.gainers[0]);
  return {
    id: `rec-${slug(top?.id || category)}-film`,
    title: top ? `Film another ${shortName(top.name)} video.` : `Double down on ${category}.`,
    confidence,
    reason: movement.gainers[0] ? `Strong movement over the selected comparison window.` : `Highest current Northstar Score with available data.`,
    type: 'Opportunity'
  };
}

function pulseSecondRecommendation() {
  const seasonal = seasonalNext60Days()[0] || suggestedRequestCategory();
  return {
    id: `rec-${slug(seasonal || 'seasonal-samples')}`,
    title: `Request ${seasonal || 'next-season'} samples.`,
    confidence: 82,
    reason: 'Seasonal opportunity window has opened or is approaching within the next 60 days.',
    type: 'Important'
  };
}

function recommendationConfidence(product, movement) {
  if (!product) return 60;
  const score = flywheelScore(product).score;
  const movementBoost = movement ? Math.min(14, Math.max(0, (movement.deltaUnits || 0) * 4 + (movement.deltaGmv || 0) / 100)) : 0;
  return Math.max(50, Math.min(98, Math.round(score * 0.82 + movementBoost + 10)));
}

function ensureDecisionLogged(recommendation) {
  const log = readJson(DECISION_LOG_KEY, []);
  const today = new Date().toISOString().slice(0, 10);
  const exists = log.some((item) => item.date === today && item.recommended === recommendation.title);
  if (!exists) {
    log.push({ id: `${recommendation.id}-${today}`, date: today, recommended: recommendation.title, status: 'Open', result: '', confidence: recommendation.confidence, reason: recommendation.reason, type: recommendation.type });
    localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(log));
  }
}

function updateDecisionStatus(id, status) {
  const log = readJson(DECISION_LOG_KEY, []);
  const item = log.find((entry) => entry.id === id);
  if (!item) return;
  item.status = status;
  if (status === 'Completed' && !item.result) item.result = 'Result pending';
  localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(log));
  pulseState.log = log;
  showMessage('Decision log updated', 'good');
  renderExecutive();
}

function pulseHistory() {
  return pulseState.snapshots.slice(-8).reverse().map((snapshot, index, all) => {
    const previous = pulseState.snapshots[pulseState.snapshots.findIndex((item) => item.id === snapshot.id) - 1] || null;
    const comparison = comparePulseSnapshots(previous, snapshot);
    const major = pulseAlerts(pulseMovement(comparison), pulseCategoryMovement(comparison), comparison)[0];
    return { label: relativeSnapshotLabel(snapshot.createdAt), note: major ? major.title : 'No major changes detected.', createdAt: snapshot.createdAt };
  });
}

function changeAlert(alert) { return `<article class="pulse-alert ${alert.type}"><span>${alert.icon}</span><div><strong>${alert.title}</strong><p>${alert.note}</p></div></article>`; }
function movementPanel(title, list, tone) { return `<section class="card movement-panel ${tone}"><h3>${title}</h3><div class="movement-list">${list.length ? list.map((item) => `<button data-product-id="${item.id}"><strong>${item.name}</strong><span>${movementSummary(item)}</span></button>`).join('') : `<p class="empty">No major movement.</p>`}</div></section>`; }
function movementSummary(item) { return `${item.deltaUnits > 0 ? '+' : ''}${item.deltaUnits || 0} units · ${money.format(item.deltaGmv || 0)} GMV`; }
function categoryMovementRow(row) { const arrow = row.deltaGmv > 0 ? '↑' : row.deltaGmv < 0 ? '↓' : '→'; const tone = row.deltaGmv > 0 ? 'up' : row.deltaGmv < 0 ? 'down' : 'flat'; return `<article class="category-row ${tone}"><strong>${row.category}</strong><span>${arrow}</span><small>${money.format(row.deltaGmv || 0)} · ${row.deltaUnits || 0} units</small></article>`; }
function historyItem(item) { return `<article class="history-item"><strong>${item.label}</strong><p>${item.note}</p></article>`; }
function decisionLogRow(item) { return `<article class="decision-row"><div><strong>${item.date}</strong><p>Recommended: ${item.recommended}</p><small>Confidence ${item.confidence}% · ${item.reason}</small></div><select data-decision-status="${item.id}">${['Open','In Progress','Completed','Skipped'].map((status) => `<option ${status === item.status ? 'selected' : ''}>${status}</option>`).join('')}</select><span>${item.result || 'Result pending'}</span></article>`; }
function compareSummary(comparison, mode) { const changes = (comparison.productChanges || []).filter((item) => item.deltaUnits || item.deltaGmv || item.deltaScore).length; return `${mode}: ${changes} product changes, ${(comparison.categoryChanges || []).filter((item) => item.deltaGmv).length} category changes, and ${(comparison.sampleChanges || []).filter((item) => item.delta).length} sample pipeline changes detected.`; }
function formatDelta(value, word) { const n = Number(value || 0); const prefix = n > 0 ? '+' : ''; const plural = Math.abs(n) === 1 ? word : `${word}s`; return `${prefix}${n} ${plural}`; }
function relativeSnapshotLabel(date) { const age = Date.now() - new Date(date).getTime(); if (age < 36 * 3600000) return 'Yesterday / Latest'; if (age < 10 * 86400000) return 'Last Week'; if (age < 45 * 86400000) return 'Last Month'; return new Date(date).toLocaleDateString(); }
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function stableFingerprint(value) { return JSON.stringify(value).replace(/"createdAt":"[^"]+",?/g, ''); }


/* Northstar Sprint 3 - Fast Capture™ */
const CAPTURE_LOG_KEY = "northstar.v01.captureLog";
const LAST_CAPTURED_KEY = "northstar.v01.lastCapturedAt";
const CAPTURE_COUNT_KEY = "northstar.v01.captureCount";

if (!pages.some((page) => page.id === "fastCapture")) {
  pages.splice(2, 0, { id: "fastCapture", label: "Fast Capture™", icon: "FC" });
}

function normalizeDatabase() {
  db.sampleRequests = db.sampleRequests || db["sample-requests"] || [];
  db.monthlyReports = db.monthlyReports || db["monthly-reports"] || [];
  db.accounts = db.accounts || [];
  db.products = db.products || [];
  db.videos = db.videos || [];
  db.hooks = db.hooks || [];
  db.audience = db.audience || [];
  db.seasons = db.seasons || {};
  db.performanceSnapshots = db.performanceSnapshots || [];
  db.notes = db.notes || {};
  db.notes.businessRules = db.notes.businessRules || [];
  db.notes.recommendations = db.notes.recommendations || [];
  db.notes.wins = db.notes.wins || [];
  db.notes.seasonalAlerts = db.notes.seasonalAlerts || [];
  db.notes.lessons = db.notes.lessons || [];
}

function renderPage(pageId) {
  activePage = pageId;
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  const page = pages.find((entry) => entry.id === pageId);
  pageTitle.textContent = page ? page.label : "Product Detail";

  if (pageId === "executive") renderExecutive();
  if (pageId === "workspaces") renderWorkspaces();
  if (pageId === "fastCapture") renderFastCapture();
  if (pageId === "products") renderProductsDatabase();
  if (pageId === "productDetail") renderProductDetail(selectedProductId);
  if (pageId === "videos") renderVideosDatabase();
  if (pageId === "recommendations") renderRecommendations();
  if (pageId === "raisedRight") renderAccount("raisedRight");
  if (pageId === "truthTunedTribe") renderAccount("truthTunedTribe");
  if (pageId === "vault") renderVault();
  if (pageId === "samples") renderSamples();
  if (pageId === "calendar") renderCalendar();
  if (pageId === "hooks") renderHooks();
  if (pageId === "audience") renderAudience();
  if (pageId === "reports") renderReports();
  if (pageId === "notes") renderNotes();
  if (pageId === "settings") renderSettings();
}

function renderFastCapture() {
  normalizeDatabase();
  const count = captureCount();
  const lastCaptured = localStorage.getItem(LAST_CAPTURED_KEY) || "Never";
  content.innerHTML = `
    <section class="capture-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Fast Capture™</p>
        <h1>Add today’s creator activity</h1>
        <p>Four quick cards designed for under-60-second entry. Northstar uses each capture in future recommendations.</p>
      </div>
      <div class="capture-meta">
        <span>Last Captured</span>
        <strong>${lastCaptured}</strong>
        <small>${count} total captures</small>
      </div>
    </section>

    ${count > 0 && count % 10 === 0 ? `<section class="backup-reminder"><strong>Backup reminder</strong><span>${count} captures saved. Export a backup from Settings when you finish today’s updates.</span><button class="chart-detail-link" data-page="settings">Open Settings</button></section>` : ""}

    <section class="capture-grid">
      ${captureCard("Add Product", "New product signal", quickProductForm())}
      ${captureCard("Add Video", "New creative activity", quickVideoForm())}
      ${captureCard("Add Performance Snapshot", "Today’s movement", quickPerformanceForm())}
      ${captureCard("Add Lesson Learned", "Knowledge Vault™", quickLessonForm())}
    </section>
  `;
  bindInternalButtons();
  bindFastCaptureForms();
}

function captureCard(title, note, formHtml) {
  return `<article class="capture-card"><div class="capture-card-header"><div><h3>${title}</h3><p>${note}</p></div><span class="badge good">Quick Entry</span></div>${formHtml}</article>`;
}

function quickProductForm() {
  return `<form id="captureProductForm" class="capture-form">
    <label>Product name<input name="name" required placeholder="Product name"></label>
    <label>Account<select name="accountId" required>${accountOptionsHtml()}</select></label>
    <label>Category<input name="category" list="categorySuggestions" required placeholder="Garden, Health, Books"></label>
    <label>Seasonality<select name="seasonality"><option>Evergreen</option><option>Seasonal</option><option>Coming Soon</option><option>Ending Soon</option></select></label>
    <label>Sample status<select name="sampleStatus">${sampleStatusOptions().map((status) => `<option>${status}</option>`).join("")}</select></label>
    <label>Commission<input name="commission" type="number" step="0.01" value="0"></label>
    <label class="wide">Notes<textarea name="notes" placeholder="Why this product matters"></textarea></label>
    ${categoryDatalist()}
    <div class="capture-actions"><button class="icon-button" type="submit">Capture Product</button><button class="ghost-button" type="button" data-reset-form="captureProductForm">Quick Add Another</button></div>
  </form>`;
}

function quickVideoForm() {
  return `<form id="captureVideoForm" class="capture-form">
    <label>Date posted<input name="datePosted" type="date" value="${todayDate()}" required></label>
    <label>Account<select name="accountId" required>${accountOptionsHtml()}</select></label>
    <label>Product<select name="productId" required>${productOptionsHtml()}</select></label>
    <label>Hook type<select name="hookType">${hookTypeOptionsHtml()}</select></label>
    <label class="wide">Hook text<input name="hook" required placeholder="Opening line"></label>
    <label>Video length<input name="videoLength" type="number" step="1" placeholder="Seconds"></label>
    <label class="wide">CTA<input name="cta" placeholder="What you asked viewers to do"></label>
    <label class="wide">Notes<textarea name="notes" placeholder="Creative notes"></textarea></label>
    <div class="capture-actions"><button class="icon-button" type="submit">Capture Video</button><button class="ghost-button" type="button" data-reset-form="captureVideoForm">Quick Add Another</button></div>
  </form>`;
}

function quickPerformanceForm() {
  return `<form id="capturePerformanceForm" class="capture-form">
    <label>Date/time<input name="dateTime" type="datetime-local" value="${localDateTimeValue()}" required></label>
    <label>Account<select name="accountId" required>${accountOptionsHtml()}</select></label>
    <label>Product<select name="productId">${productOptionsHtml("Choose product")}</select></label>
    <label>Video<select name="videoId">${videoOptionsHtml()}</select></label>
    ${["views", "likes", "comments", "shares", "saves", "averageWatchTime", "completionRate", "sales", "gmv", "commission"].map((name) => `<label>${labelize(name)}<input name="${name}" type="number" step="0.01" value="0"></label>`).join("")}
    <div class="capture-actions"><button class="icon-button" type="submit">Capture Snapshot</button><button class="ghost-button" type="button" data-reset-form="capturePerformanceForm">Quick Add Another</button></div>
  </form>`;
}

function quickLessonForm() {
  return `<form id="captureLessonForm" class="capture-form">
    <label>Account<select name="accountId" required>${accountOptionsHtml()}</select></label>
    <label>Product/category<input name="subject" list="categorySuggestions" placeholder="Product or category"></label>
    <label class="wide">Lesson<textarea name="lesson" required placeholder="What did today teach you?"></textarea></label>
    <label>Confidence level<select name="confidence"><option value="95">Very high</option><option value="80" selected>High</option><option value="60">Medium</option><option value="40">Low</option></select></label>
    <label>Tags<input name="tags" placeholder="hook, seasonal, audience"></label>
    ${categoryDatalist()}
    <div class="capture-actions"><button class="icon-button" type="submit">Capture Lesson</button><button class="ghost-button" type="button" data-reset-form="captureLessonForm">Quick Add Another</button></div>
  </form>`;
}

function bindFastCaptureForms() {
  document.querySelector("#captureProductForm")?.addEventListener("submit", handleCaptureProduct);
  document.querySelector("#captureVideoForm")?.addEventListener("submit", handleCaptureVideo);
  document.querySelector("#capturePerformanceForm")?.addEventListener("submit", handleCapturePerformance);
  document.querySelector("#captureLessonForm")?.addEventListener("submit", handleCaptureLesson);
  document.querySelectorAll("[data-reset-form]").forEach((button) => button.addEventListener("click", () => {
    const form = document.querySelector(`#${button.dataset.resetForm}`);
    form?.reset();
    form?.querySelector("input, select, textarea")?.focus();
  }));
}

function handleCaptureProduct(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const account = getAccount(form.get("accountId"));
  const name = String(form.get("name") || "").trim();
  const category = String(form.get("category") || "Uncategorized").trim();
  const commission = Number(form.get("commission") || 0);
  const product = {
    id: uniqueId(`${account.id}-${slug(name) || "product"}`),
    name,
    accountId: account.id,
    account: account.name,
    category,
    categoryGroup: category.split("/")[0].trim(),
    seasonality: form.get("seasonality") || "Evergreen",
    evergreenSeasonal: String(form.get("seasonality") || "Evergreen").includes("Evergreen") ? "Evergreen" : "Seasonal",
    lifetimeGmv: 0,
    lifetimeCommission: commission,
    lifetimeUnits: 0,
    monthlyPerformance: [],
    firstPromotedDate: "",
    lastPromotedDate: "",
    sampleStatus: form.get("sampleStatus"),
    wouldPromoteAgain: "Maybe",
    status: commission > 0 ? "Watch" : "Wait",
    originalStatus: commission > 0 ? "Watch" : "Wait",
    notes: form.get("notes") || "",
    bestHook: "",
    bestCta: "",
    strategyNotes: form.get("notes") || "",
    similarTags: [category.split("/")[0].trim(), account.id]
  };
  db.products.push(product);
  captureSuccess("Product", product.name);
  renderFastCapture();
}

function handleCaptureVideo(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const product = getProduct(form.get("productId"));
  const account = product ? getAccount(product.accountId) : getAccount(form.get("accountId"));
  if (!product) {
    showMessage("Choose a product before capturing a video.", "warn");
    return;
  }
  const video = {
    id: uniqueId(`video-${form.get("datePosted")}-${slug(product.name)}`),
    datePosted: form.get("datePosted") || todayDate(),
    accountId: account.id,
    account: account.name,
    productId: product.id,
    productName: product.name,
    category: product.categoryGroup,
    hook: form.get("hook") || "",
    hookType: form.get("hookType") || product.categoryGroup,
    videoLength: Number(form.get("videoLength") || 0),
    cta: form.get("cta") || "",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    averageWatchTime: 0,
    completionRate: 0,
    sales: 0,
    gmv: 0,
    commission: 0,
    notes: form.get("notes") || ""
  };
  db.videos.push(video);
  product.lastPromotedDate = video.datePosted;
  if (!product.firstPromotedDate) product.firstPromotedDate = video.datePosted;
  if (!product.bestHook && video.hook) product.bestHook = video.hook;
  if (!product.bestCta && video.cta) product.bestCta = video.cta;
  captureSuccess("Video", product.name);
  renderFastCapture();
}

function handleCapturePerformance(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const product = getProduct(form.get("productId"));
  const video = videos().find((entry) => entry.id === form.get("videoId"));
  if (!product && !video) {
    showMessage("Choose a product or video before capturing performance.", "warn");
    return;
  }
  const resolvedProduct = product || getProduct(video.productId);
  const account = getAccount(resolvedProduct?.accountId || form.get("accountId"));
  const snapshot = {
    id: uniqueId(`snapshot-${Date.now()}`),
    capturedAt: form.get("dateTime") || new Date().toISOString(),
    accountId: account.id,
    account: account.name,
    productId: resolvedProduct?.id || "",
    productName: resolvedProduct?.name || "",
    videoId: video?.id || "",
    videoHook: video?.hook || "",
    views: Number(form.get("views") || 0),
    likes: Number(form.get("likes") || 0),
    comments: Number(form.get("comments") || 0),
    shares: Number(form.get("shares") || 0),
    saves: Number(form.get("saves") || 0),
    averageWatchTime: Number(form.get("averageWatchTime") || 0),
    completionRate: Number(form.get("completionRate") || 0),
    sales: Number(form.get("sales") || 0),
    gmv: Number(form.get("gmv") || 0),
    commission: Number(form.get("commission") || 0)
  };
  db.performanceSnapshots.push(snapshot);
  if (resolvedProduct) applySnapshotToProduct(resolvedProduct, snapshot);
  if (video) applySnapshotToVideo(video, snapshot);
  captureSuccess("Performance Snapshot", snapshot.productName || snapshot.videoHook || account.name);
  renderFastCapture();
}

function handleCaptureLesson(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const account = getAccount(form.get("accountId"));
  const lesson = {
    id: uniqueId(`lesson-${Date.now()}`),
    capturedAt: new Date().toISOString(),
    accountId: account.id,
    account: account.name,
    subject: form.get("subject") || "General",
    lesson: form.get("lesson") || "",
    confidence: Number(form.get("confidence") || 80),
    tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean)
  };
  db.notes.lessons.push(lesson);
  db.notes.recommendations = unique([lesson.lesson, ...(db.notes.recommendations || [])]).slice(0, 16);
  captureSuccess("Lesson Learned", lesson.subject);
  renderFastCapture();
}

function applySnapshotToProduct(product, snapshot) {
  product.lifetimeUnits = Number(product.lifetimeUnits || 0) + Number(snapshot.sales || 0);
  product.lifetimeGmv = Number(product.lifetimeGmv || 0) + Number(snapshot.gmv || 0);
  product.lifetimeCommission = Number(product.lifetimeCommission || 0) + Number(snapshot.commission || 0);
  const date = snapshot.capturedAt ? new Date(snapshot.capturedAt) : new Date();
  if (!product.firstPromotedDate) product.firstPromotedDate = todayDate(date);
  product.lastPromotedDate = todayDate(date);
  product.monthlyPerformance = product.monthlyPerformance || [];
  const month = monthLabel(date);
  const row = product.monthlyPerformance.find((entry) => entry.month === month);
  if (row) {
    row.units = Number(row.units || 0) + Number(snapshot.sales || 0);
    row.gmv = Number(row.gmv || 0) + Number(snapshot.gmv || 0);
    row.commission = Number(row.commission || 0) + Number(snapshot.commission || 0);
  } else {
    product.monthlyPerformance.push({ month, units: Number(snapshot.sales || 0), gmv: Number(snapshot.gmv || 0), commission: Number(snapshot.commission || 0) });
  }
}

function applySnapshotToVideo(video, snapshot) {
  ["views", "likes", "comments", "shares", "saves", "averageWatchTime", "completionRate", "sales", "gmv", "commission"].forEach((field) => {
    video[field] = Number(video[field] || 0) + Number(snapshot[field] || 0);
  });
}

function captureSuccess(type, label) {
  const count = captureCount() + 1;
  const now = new Date();
  localStorage.setItem(CAPTURE_COUNT_KEY, String(count));
  localStorage.setItem(LAST_CAPTURED_KEY, now.toLocaleString());
  const log = readJson(CAPTURE_LOG_KEY, []);
  log.push({ id: `capture-${Date.now()}`, type, label: label || "", capturedAt: now.toISOString() });
  localStorage.setItem(CAPTURE_LOG_KEY, JSON.stringify(log.slice(-200)));
  saveData("Captured. Northstar will use this in future recommendations.");
  if (count % 10 === 0) {
    setTimeout(() => showMessage("10 captures saved. Export a backup from Settings.", "warn"), 1200);
  }
}

function renderNotes() {
  const lessons = db.notes.lessons || [];
  content.innerHTML = `
    <div class="section-title"><div><h3>The Knowledge Vault™</h3><p>Business rules, operating reminders, and lessons captured from daily activity.</p></div></div>
    <div class="grid two">
      ${listCard("Business Rules", db.notes.businessRules || [], "good")}
      ${listCard("Creator Compass™ Notes", db.notes.recommendations || [], "hot")}
    </div>
    <section class="card lesson-vault">
      <div class="section-title"><div><h3>Fast Capture Lessons</h3><p>Saved locally from the Lesson Learned card.</p></div><button class="chart-detail-link" data-page="fastCapture">Add Lesson</button></div>
      <div class="lesson-list">${lessons.length ? lessons.slice().reverse().map(lessonRow).join("") : `<p class="empty">No captured lessons yet.</p>`}</div>
    </section>
  `;
  bindInternalButtons();
}

function renderSettings() {
  const count = captureCount();
  const lastCaptured = localStorage.getItem(LAST_CAPTURED_KEY) || "Never";
  content.innerHTML = `<div class="section-title"><div><h3>Settings</h3><p>Backup, restore, or reset your local Northstar database.</p></div><span class="badge good">Last Saved: ${lastSavedAt}</span></div><div class="grid two"><div class="card settings-card"><h3>Backup & Restore</h3><p>Export a JSON backup before major edits. Import restores the full local workspace into this browser.</p><div class="settings-actions"><button id="exportBackup" class="icon-button">Export Backup</button><label class="import-button"><input id="importBackup" type="file" accept="application/json,.json">Import Backup</label></div></div><div class="card settings-card"><h3>Fast Capture™</h3><p>Capture count: ${count}. Last captured: ${lastCaptured}.</p><button class="icon-button" data-page="fastCapture">Open Fast Capture</button></div><div class="card settings-card"><h3>Reset</h3><p>Reset clears localStorage and returns to the default data bundled in data/database.js.</p><button id="resetDefault" class="icon-button danger">Reset to Default Data</button></div></div><div class="card"><h3>Local Storage Status</h3><ul class="list"><li>Products: ${products().length}</li><li>Videos: ${videos().length}</li><li>Performance snapshots: ${db.performanceSnapshots.length}</li><li>Captured lessons: ${(db.notes.lessons || []).length}</li><li>Sample cards: ${db.sampleRequests.length}</li><li>Monthly reports: ${db.monthlyReports.length}</li><li>Last Saved: ${lastSavedAt}</li></ul></div>`;
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  document.querySelector("#importBackup").addEventListener("change", importBackup);
  document.querySelector("#resetDefault").addEventListener("click", resetDefaultData);
  bindInternalButtons();
}

function createPulseSnapshot(reason) {
  const productData = products().map((product) => ({
    id: product.id,
    name: product.name,
    account: product.account,
    category: product.categoryGroup || product.category,
    units: Number(product.lifetimeUnits || 0),
    gmv: Number(product.lifetimeGmv || 0),
    commission: Number(product.lifetimeCommission || 0),
    status: product.status,
    season: seasonIntelligence(product),
    score: flywheelScore(product).score
  }));
  const categories = categoryRankings().map((row) => ({ ...row }));
  const sampleCounts = Object.fromEntries(sampleStatusOptions().map((status) => [status, (db.sampleRequests || []).filter((item) => item.status === status).length]));
  const payload = { products: productData, categories, sampleCounts, captureCount: captureCount(), performanceSnapshots: db.performanceSnapshots.length, lessons: (db.notes.lessons || []).length };
  return {
    id: `snap-${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    label: new Date().toLocaleString(),
    ...payload,
    fingerprint: stableFingerprint(payload)
  };
}

function captureCount() { return Number(localStorage.getItem(CAPTURE_COUNT_KEY) || 0); }
function accountOptionsHtml() { return accounts().map((account) => `<option value="${account.id}">${account.name}</option>`).join(""); }
function productOptionsHtml(placeholder) { return `${placeholder ? `<option value="">${placeholder}</option>` : ""}${products().map((product) => `<option value="${product.id}">${product.name}</option>`).join("")}`; }
function videoOptionsHtml() { return `<option value="">Choose video</option>${videos().map((video) => `<option value="${video.id}">${video.datePosted} · ${video.productName} · ${shortName(video.hook || "Video")}</option>`).join("")}`; }
function hookTypeOptionsHtml() { return unique(["Curiosity", "Problem", "Mistake", "Identity", "Comparison", "Garden", "Health / Wellness", "Books", "Patriotic", "Home", "Beauty", "Seasonal", ...db.hooks.map((hook) => hook.category)]).map((type) => `<option>${type}</option>`).join(""); }
function categoryDatalist() { return `<datalist id="categorySuggestions">${unique(products().map((product) => product.categoryGroup || product.category)).map((category) => `<option value="${escapeAttr(category)}"></option>`).join("")}</datalist>`; }
function todayDate(date = new Date()) { return date.toISOString().slice(0, 10); }
function localDateTimeValue(date = new Date()) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function monthLabel(date) { return date.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function lessonRow(item) { return `<article class="lesson-row"><div><strong>${item.lesson}</strong><p>${item.account} · ${item.subject} · Confidence ${item.confidence}%</p></div><span>${(item.tags || []).join(", ") || "untagged"}</span></article>`; }

function exportBackup() {
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lastSavedAt,
    data: db,
    localMeta: {
      captureCount: captureCount(),
      lastCapturedAt: localStorage.getItem(LAST_CAPTURED_KEY) || "",
      captureLog: readJson(CAPTURE_LOG_KEY, []),
      pulseSnapshots: readJson(PULSE_SNAPSHOTS_KEY, []),
      decisionLog: readJson(DECISION_LOG_KEY, [])
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = mergeDatabase(clone(defaultDb), parsed);
      normalizeDatabase();
      if (parsed.localMeta) {
        localStorage.setItem(CAPTURE_COUNT_KEY, String(parsed.localMeta.captureCount || 0));
        localStorage.setItem(LAST_CAPTURED_KEY, parsed.localMeta.lastCapturedAt || "");
        localStorage.setItem(CAPTURE_LOG_KEY, JSON.stringify(parsed.localMeta.captureLog || []));
        localStorage.setItem(PULSE_SNAPSHOTS_KEY, JSON.stringify(parsed.localMeta.pulseSnapshots || []));
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(parsed.localMeta.decisionLog || []));
      }
      saveData("Backup imported and saved locally");
      renderPage("settings");
    } catch (error) {
      showMessage("Import failed. Choose a valid Northstar JSON backup.", "warn");
    }
  };
  reader.readAsText(file);
}

function resetDefaultData() {
  if (!confirm("Reset Northstar to the default bundled data? This clears local saved changes in this browser.")) return;
  [STORAGE_KEY, SAVED_AT_KEY, CAPTURE_COUNT_KEY, LAST_CAPTURED_KEY, CAPTURE_LOG_KEY, PULSE_SNAPSHOTS_KEY, DECISION_LOG_KEY].forEach((key) => localStorage.removeItem(key));
  db = clone(defaultDb);
  normalizeDatabase();
  lastSavedAt = "Never";
  initializePulseEngine("reset-default");
  updateLastSavedDisplay();
  showMessage("Reset to default data", "warn");
  renderPage("settings");
}

/* Northstar Sprint 4 - Bulk Import™ */
const BULK_IMPORT_HISTORY_KEY = "northstar.v01.bulkImportHistory";
let bulkImportState = {
  step: "upload",
  dataType: "productSales",
  accountId: "",
  fileName: "",
  headers: [],
  rows: [],
  mapping: {},
  duplicateMode: "update",
  preview: null,
  savedSummary: null
};

if (!pages.some((page) => page.id === "bulkImport")) {
  const fastIndex = pages.findIndex((page) => page.id === "fastCapture");
  pages.splice(fastIndex >= 0 ? fastIndex + 1 : 3, 0, { id: "bulkImport", label: "Bulk Import™", icon: "BI" });
}

function normalizeDatabase() {
  db.sampleRequests = db.sampleRequests || db["sample-requests"] || [];
  db.monthlyReports = db.monthlyReports || db["monthly-reports"] || [];
  db.accounts = db.accounts || [];
  db.products = db.products || [];
  db.videos = db.videos || [];
  db.hooks = db.hooks || [];
  db.audience = db.audience || [];
  db.seasons = db.seasons || {};
  db.performanceSnapshots = db.performanceSnapshots || [];
  db.importHistory = db.importHistory || readJson(BULK_IMPORT_HISTORY_KEY, []);
  db.notes = db.notes || {};
  db.notes.businessRules = db.notes.businessRules || [];
  db.notes.recommendations = db.notes.recommendations || [];
  db.notes.wins = db.notes.wins || [];
  db.notes.seasonalAlerts = db.notes.seasonalAlerts || [];
  db.notes.lessons = db.notes.lessons || [];
}

function renderPage(pageId) {
  activePage = pageId;
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  const page = pages.find((entry) => entry.id === pageId);
  pageTitle.textContent = page ? page.label : "Product Detail";

  if (pageId === "executive") renderExecutive();
  if (pageId === "workspaces") renderWorkspaces();
  if (pageId === "fastCapture") renderFastCapture();
  if (pageId === "bulkImport") renderBulkImport();
  if (pageId === "products") renderProductsDatabase();
  if (pageId === "productDetail") renderProductDetail(selectedProductId);
  if (pageId === "videos") renderVideosDatabase();
  if (pageId === "recommendations") renderRecommendations();
  if (pageId === "raisedRight") renderAccount("raisedRight");
  if (pageId === "truthTunedTribe") renderAccount("truthTunedTribe");
  if (pageId === "vault") renderVault();
  if (pageId === "samples") renderSamples();
  if (pageId === "calendar") renderCalendar();
  if (pageId === "hooks") renderHooks();
  if (pageId === "audience") renderAudience();
  if (pageId === "reports") renderReports();
  if (pageId === "notes") renderNotes();
  if (pageId === "settings") renderSettings();
}

function renderBulkImport() {
  normalizeDatabase();
  if (!bulkImportState.accountId) bulkImportState.accountId = accounts()[0]?.id || "";
  const stepOrder = ["upload", "map", "preview", "done"];
  const activeIndex = stepOrder.indexOf(bulkImportState.step);
  content.innerHTML = `
    <section class="import-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Bulk Import™</p>
        <h1>Bring in a week or month of creator data quickly</h1>
        <p>Upload a CSV, map fields once, preview what Northstar sees, then save into the local creator operating system.</p>
      </div>
    </section>

    <nav class="import-stepper" aria-label="Bulk import progress">
      ${["Upload", "Map Fields", "Preview", "Done"].map((label, index) => `<span class="${index <= activeIndex ? "active" : ""}">${index + 1}. ${label}</span>`).join("")}
    </nav>

    ${bulkImportState.step === "upload" ? importUploadStep() : ""}
    ${bulkImportState.step === "map" ? importMappingStep() : ""}
    ${bulkImportState.step === "preview" ? importPreviewStep() : ""}
    ${bulkImportState.step === "done" ? importDoneStep() : ""}

    <section class="card import-history-card">
      <div class="section-title"><div><h3>Import History</h3><p>Every confirmed import is preserved locally.</p></div></div>
      ${importHistoryTable()}
    </section>
  `;
  bindInternalButtons();
  bindBulkImportControls();
}

function importUploadStep() {
  return `
    <section class="import-panel card">
      <div class="section-title"><div><h3>Upload CSV</h3><p>Choose the data type first so Northstar can suggest mappings.</p></div><span class="badge good">Step 1</span></div>
      <div class="import-upload-grid">
        <label>Data type<select id="bulkDataType">${Object.entries(importTypeLabels()).map(([value, label]) => `<option value="${value}" ${bulkImportState.dataType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Default account<select id="bulkAccount">${accountOptionsHtml()}</select></label>
        <label class="file-drop">CSV file<input id="bulkFile" type="file" accept=".csv,text/csv"></label>
      </div>
      <div class="template-actions">
        <button class="ghost-button" data-template="productSales">Download Product Sales Template</button>
        <button class="ghost-button" data-template="videoAnalytics">Download Video Analytics Template</button>
        <button class="ghost-button" data-template="sampleRequests">Download Sample Request Template</button>
      </div>
    </section>`;
}

function importMappingStep() {
  const fields = importFields(bulkImportState.dataType);
  return `
    <section class="import-panel card">
      <div class="section-title"><div><h3>Map Fields</h3><p>${bulkImportState.fileName} · ${bulkImportState.rows.length} non-empty rows detected · ${bulkImportState.headers.length} columns detected.</p></div><span class="badge hot">Step 2</span></div>
      <div class="mapping-grid">
        ${fields.map((field) => `<label><span>${field.label}${field.required ? " *" : ""}</span><select data-map-field="${field.key}"><option value="">Do not import</option>${bulkImportState.headers.map((header) => `<option value="${escapeAttr(header)}" ${bulkImportState.mapping[field.key] === header ? "selected" : ""}>${header}</option>`).join("")}</select></label>`).join("")}
      </div>
      <div class="import-actions">
        <button class="ghost-button" data-import-back="upload">Back</button>
        <button class="icon-button" id="buildImportPreview">Preview Import</button>
      </div>
    </section>`;
}

function importPreviewStep() {
  const preview = bulkImportState.preview || analyzeImport();
  bulkImportState.preview = preview;
  return `
    <section class="import-panel card">
      <div class="section-title"><div><h3>Import Preview</h3><p>Review duplicates, missing fields, and estimated records before saving.</p></div><span class="badge good">Step 3</span></div>
      <div class="grid four">
        ${metric("Rows Detected", number.format(preview.rowsDetected), "Non-empty CSV rows", "")}
        ${metric("Columns Detected", number.format(preview.columnsDetected), "CSV headers found", "")}
        ${metric("Estimated New", number.format(preview.estimatedNew), "New records if confirmed", "")}
        ${metric("Duplicates", number.format(preview.duplicates.length), "Existing or repeated rows", "")}
      </div>
      ${preview.messages.length ? `<div class="import-message-list">${preview.messages.map((message) => `<p class="${message.tone}"><strong>${message.title}</strong><span>${message.detail}</span></p>`).join("")}</div>` : ""}
      <div class="duplicate-choice">
        <strong>If a record already exists:</strong>
        ${["skip", "update", "duplicate"].map((mode) => `<label><input type="radio" name="duplicateMode" value="${mode}" ${bulkImportState.duplicateMode === mode ? "checked" : ""}> ${duplicateModeLabel(mode)}</label>`).join("")}
      </div>
      <div class="table-card import-preview-table"><table><thead><tr>${preview.previewHeaders.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${preview.previewRows.map((row) => `<tr>${preview.previewHeaders.map((header) => `<td>${row[header] || ""}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${preview.previewHeaders.length || 1}">No preview rows available.</td></tr>`}</tbody></table></div>
      <div class="import-actions">
        <button class="ghost-button" data-import-back="map">Back</button>
        <button class="icon-button" id="confirmBulkImport" ${preview.canSave ? "" : "disabled"}>Confirm & Save Import</button>
      </div>
    </section>`;
}

function importDoneStep() {
  const summary = bulkImportState.savedSummary || { imported: 0, skipped: 0, updated: 0, errors: [] };
  return `
    <section class="import-panel card import-done">
      <div class="section-title"><div><h3>Import Complete</h3><p>Northstar saved the confirmed records locally and refreshed recommendations.</p></div><span class="badge good">Done</span></div>
      <div class="grid four">
        ${metric("Imported", number.format(summary.imported), "New records", "")}
        ${metric("Updated", number.format(summary.updated), "Existing records", "")}
        ${metric("Skipped", number.format(summary.skipped), "Duplicate or empty rows", "")}
        ${metric("Errors", number.format(summary.errors.length), "Rows needing review", "")}
      </div>
      ${summary.errors.length ? `<div class="import-message-list">${summary.errors.slice(0, 6).map((error) => `<p class="warn"><strong>${error.title}</strong><span>${error.detail}</span></p>`).join("")}</div>` : ""}
      <div class="import-actions">
        <button class="icon-button" id="startAnotherImport">Import Another CSV</button>
        <button class="ghost-button" data-page="products">View Products</button>
        <button class="ghost-button" data-page="videos">View Videos</button>
      </div>
    </section>`;
}

function bindBulkImportControls() {
  document.querySelector("#bulkDataType")?.addEventListener("change", (event) => {
    bulkImportState.dataType = event.target.value;
    bulkImportState.mapping = autoMapHeaders(bulkImportState.headers, bulkImportState.dataType);
  });
  const accountSelect = document.querySelector("#bulkAccount");
  if (accountSelect) {
    accountSelect.value = bulkImportState.accountId || accounts()[0]?.id || "";
    accountSelect.addEventListener("change", (event) => { bulkImportState.accountId = event.target.value; });
  }
  document.querySelector("#bulkFile")?.addEventListener("change", handleBulkFile);
  document.querySelectorAll("[data-template]").forEach((button) => button.addEventListener("click", () => downloadImportTemplate(button.dataset.template)));
  document.querySelectorAll("[data-map-field]").forEach((selectEl) => selectEl.addEventListener("change", (event) => {
    bulkImportState.mapping[event.target.dataset.mapField] = event.target.value;
  }));
  document.querySelector("#buildImportPreview")?.addEventListener("click", () => {
    bulkImportState.preview = analyzeImport();
    bulkImportState.step = "preview";
    renderBulkImport();
  });
  document.querySelectorAll("[data-import-back]").forEach((button) => button.addEventListener("click", () => {
    bulkImportState.step = button.dataset.importBack;
    renderBulkImport();
  }));
  document.querySelectorAll("input[name='duplicateMode']").forEach((radio) => radio.addEventListener("change", (event) => {
    bulkImportState.duplicateMode = event.target.value;
    bulkImportState.preview = analyzeImport();
    renderBulkImport();
  }));
  document.querySelector("#confirmBulkImport")?.addEventListener("click", confirmBulkImport);
  document.querySelector("#startAnotherImport")?.addEventListener("click", () => {
    bulkImportState = { step: "upload", dataType: "productSales", accountId: accounts()[0]?.id || "", fileName: "", headers: [], rows: [], mapping: {}, duplicateMode: "update", preview: null, savedSummary: null };
    renderBulkImport();
  });
}

function handleBulkFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(String(reader.result || ""));
    if (!parsed.headers.length) {
      showMessage("Missing required columns. Choose a CSV with a header row.", "warn");
      return;
    }
    bulkImportState.fileName = file.name;
    bulkImportState.headers = parsed.headers;
    bulkImportState.rows = parsed.rows;
    bulkImportState.mapping = autoMapHeaders(parsed.headers, bulkImportState.dataType);
    bulkImportState.step = "map";
    bulkImportState.preview = null;
    renderBulkImport();
  };
  reader.readAsText(file);
}

function analyzeImport() {
  const required = importFields(bulkImportState.dataType).filter((field) => field.required);
  const missing = required.filter((field) => !bulkImportState.mapping[field.key]);
  const normalized = normalizeImportRows();
  const duplicates = normalized.filter((row) => row.duplicate);
  const duplicateRows = normalized.filter((row) => row.duplicateInFile);
  const invalid = normalized.flatMap((row) => row.errors.map((error) => ({ title: `Row ${row.rowNumber}`, detail: error, tone: "warn" })));
  const messages = [];
  if (missing.length) messages.push({ title: "Missing required columns", detail: missing.map((field) => field.label).join(", "), tone: "warn" });
  if (invalid.length) messages.push({ title: "Invalid numbers", detail: `${invalid.length} issue${invalid.length === 1 ? "" : "s"} found. Rows with invalid numbers will be skipped until fixed.`, tone: "warn" });
  if (duplicateRows.length) messages.push({ title: "Duplicate rows detected", detail: `${duplicateRows.length} repeated row${duplicateRows.length === 1 ? "" : "s"} inside this CSV.`, tone: "warn" });
  if (duplicates.length) messages.push({ title: "Duplicate existing records", detail: `${duplicates.length} row${duplicates.length === 1 ? "" : "s"} match existing Northstar records.`, tone: "info" });
  if (normalized.some((row) => row.empty)) messages.push({ title: "Empty rows ignored", detail: `${normalized.filter((row) => row.empty).length} blank row${normalized.filter((row) => row.empty).length === 1 ? "" : "s"} ignored.`, tone: "info" });
  const valid = normalized.filter((row) => !row.empty && !row.errors.length);
  const estimatedNew = valid.filter((row) => !row.duplicate || bulkImportState.duplicateMode === "duplicate").length;
  const previewHeaders = ["Row", ...importFields(bulkImportState.dataType).filter((field) => bulkImportState.mapping[field.key]).map((field) => field.label), "Status"];
  const previewRows = valid.slice(0, 12).map((row) => {
    const record = { Row: row.rowNumber, Status: row.duplicate ? `Duplicate: ${duplicateModeLabel(bulkImportState.duplicateMode)}` : "New" };
    importFields(bulkImportState.dataType).forEach((field) => {
      if (bulkImportState.mapping[field.key]) record[field.label] = row.data[field.key];
    });
    return record;
  });
  return {
    rowsDetected: bulkImportState.rows.length,
    columnsDetected: bulkImportState.headers.length,
    missing,
    duplicates,
    duplicateRows,
    invalid,
    estimatedNew,
    messages,
    previewHeaders,
    previewRows,
    normalizedRows: normalized,
    canSave: !missing.length && valid.length > 0
  };
}

function confirmBulkImport() {
  const preview = bulkImportState.preview || analyzeImport();
  if (!preview.canSave) {
    showMessage("Missing required columns or no valid rows to import.", "warn");
    return;
  }
  const summary = { imported: 0, updated: 0, skipped: 0, errors: [] };
  preview.normalizedRows.forEach((row) => {
    if (row.empty) { summary.skipped += 1; return; }
    if (row.errors.length) {
      summary.errors.push({ title: `Row ${row.rowNumber}`, detail: row.errors.join("; ") });
      return;
    }
    const result = importRowByType(row);
    summary[result] += 1;
  });
  const history = {
    id: uniqueImportId(`import-${Date.now()}`),
    importedAt: new Date().toISOString(),
    importedLabel: new Date().toLocaleString(),
    fileName: bulkImportState.fileName,
    rowsImported: summary.imported + summary.updated,
    rowsSkipped: summary.skipped,
    account: getAccount(bulkImportState.accountId).name || "Mixed",
    dataType: importTypeLabels()[bulkImportState.dataType]
  };
  db.importHistory.unshift(history);
  db.importHistory = db.importHistory.slice(0, 80);
  localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
  bulkImportState.savedSummary = summary;
  bulkImportState.step = "done";
  saveData("Import saved. Northstar will use this in future recommendations.");
  renderBulkImport();
}

function importRowByType(row) {
  if (bulkImportState.dataType === "productSales") return importProductSaleRow(row);
  if (bulkImportState.dataType === "videoAnalytics") return importVideoAnalyticsRow(row);
  return importSampleRequestRow(row);
}

function importProductSaleRow(row) {
  const data = row.data;
  const account = resolveImportAccount(data.account);
  const productName = data.productName;
  const product = findProductByName(productName, account.id);
  if (product && bulkImportState.duplicateMode === "skip") return "skipped";
  const target = product && bulkImportState.duplicateMode === "update" ? product : createImportedProduct(data, account);
  if (!product || bulkImportState.duplicateMode === "duplicate") db.products.push(target);
    const snapshot = {
      capturedAt: data.date || new Date().toISOString(),
      sales: toNumber(data.unitsSold),
      gmv: toNumber(data.gmv),
    commission: toNumber(data.commission)
  };
  applySnapshotToProduct(target, snapshot);
  target.status = target.status || (toNumber(data.unitsSold) > 0 ? "Watch" : "Wait");
  target.sampleStatus = data.sampleStatus || target.sampleStatus || "Wait";
  target.notes = [target.notes, data.notes].filter(Boolean).join("\n");
  return product && bulkImportState.duplicateMode === "update" ? "updated" : "imported";
}

function importVideoAnalyticsRow(row) {
  const data = row.data;
  const account = resolveImportAccount(data.account);
  const product = ensureImportedProduct(data.productName, account, data.category);
  const existing = findVideoDuplicate(data, product.id);
  if (existing && bulkImportState.duplicateMode === "skip") return "skipped";
  const target = existing && bulkImportState.duplicateMode === "update" ? existing : {
    id: uniqueImportId(`video-${data.datePosted || todayDate()}-${slug(data.productName)}-${slug(data.hook || "import")}`),
    datePosted: data.datePosted || todayDate(),
    accountId: account.id,
    account: account.name,
    productId: product.id,
    productName: product.name,
    category: product.categoryGroup,
    hook: data.hook || "",
    hookType: data.hookType || product.categoryGroup,
    videoLength: toNumber(data.videoLength),
    cta: data.cta || "",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    averageWatchTime: 0,
    completionRate: 0,
    sales: 0,
    gmv: 0,
    commission: 0,
    notes: data.notes || ""
  };
  const metrics = Object.fromEntries(["views", "likes", "comments", "shares", "saves", "averageWatchTime", "completionRate", "sales", "gmv", "commission"].map((field) => [field, toNumber(data[field])]));
  applySnapshotToVideo(target, metrics);
  if (!existing || bulkImportState.duplicateMode === "duplicate") db.videos.push(target);
  if (metrics.sales || metrics.gmv || metrics.commission) {
    applySnapshotToProduct(product, { capturedAt: data.datePosted || new Date().toISOString(), sales: metrics.sales, gmv: metrics.gmv, commission: metrics.commission });
  }
  return existing && bulkImportState.duplicateMode === "update" ? "updated" : "imported";
}

function importSampleRequestRow(row) {
  const data = row.data;
  const account = resolveImportAccount(data.account);
  const existing = (db.sampleRequests || []).find((sample) => normalizedName(sample.productName) === normalizedName(data.productName) && sample.accountId === account.id);
  if (existing && bulkImportState.duplicateMode === "skip") return "skipped";
  const target = existing && bulkImportState.duplicateMode === "update" ? existing : {
    id: uniqueImportId(`sample-${account.id}-${slug(data.productName)}`),
    productName: data.productName,
    accountId: account.id,
    account: account.name,
    category: data.category || "Uncategorized",
    priority: data.priority || "Medium",
    season: data.season || data.seasonality || "Evergreen",
    commissionPotential: data.commissionPotential || data.commission || "",
    notes: data.notes || "",
    status: data.status || "Request Now"
  };
  target.status = data.status || target.status || "Request Now";
  target.category = data.category || target.category || "Uncategorized";
  target.priority = data.priority || target.priority || "Medium";
  target.season = data.season || data.seasonality || target.season || "Evergreen";
  target.commissionPotential = data.commissionPotential || data.commission || target.commissionPotential || "";
  target.notes = [target.notes, data.notes].filter(Boolean).join("\n");
  if (!existing || bulkImportState.duplicateMode === "duplicate") db.sampleRequests.push(target);
  return existing && bulkImportState.duplicateMode === "update" ? "updated" : "imported";
}

function normalizeImportRows() {
  const seen = new Set();
  return bulkImportState.rows.map((raw, index) => {
    const data = {};
    const errors = [];
    const empty = Object.values(raw).every((value) => !String(value || "").trim());
    importFields(bulkImportState.dataType).forEach((field) => {
      const header = bulkImportState.mapping[field.key];
      data[field.key] = header ? String(raw[header] || "").trim() : "";
      if (field.required && !data[field.key]) errors.push(`${field.label} is required`);
      if (field.type === "number" && data[field.key] && Number.isNaN(toNumber(data[field.key]))) errors.push(`${field.label} is not a valid number`);
    });
    const key = duplicateKeyForImport(data, bulkImportState.dataType);
    const duplicateInFile = key ? seen.has(key) : false;
    if (key) seen.add(key);
    return {
      rowNumber: index + 2,
      raw,
      data,
      empty,
      errors,
      duplicateInFile,
      duplicate: !empty && isDuplicateImportRow(data, bulkImportState.dataType)
    };
  });
}

function isDuplicateImportRow(data, type) {
  const account = resolveImportAccount(data.account);
  if (type === "productSales") return !!findProductByName(data.productName, account.id);
  if (type === "videoAnalytics") {
    const product = findProductByName(data.productName, account.id);
    return !!(product && findVideoDuplicate(data, product.id));
  }
  return (db.sampleRequests || []).some((sample) => normalizedName(sample.productName) === normalizedName(data.productName) && sample.accountId === account.id);
}

function duplicateKeyForImport(data, type) {
  if (!data.productName) return "";
  if (type === "videoAnalytics") return `${normalizedName(data.productName)}|${data.datePosted}|${normalizedName(data.hook)}`;
  return `${normalizedName(data.productName)}|${normalizedName(data.account)}`;
}

function importFields(type) {
  const fields = {
    productSales: [
      { key: "productName", label: "Product name", required: true },
      { key: "account", label: "Account" },
      { key: "category", label: "Category" },
      { key: "date", label: "Sale date" },
      { key: "gmv", label: "GMV", type: "number" },
      { key: "commission", label: "Commission", type: "number" },
      { key: "unitsSold", label: "Units sold", type: "number" },
      { key: "seasonality", label: "Seasonality" },
      { key: "sampleStatus", label: "Sample status" },
      { key: "notes", label: "Notes" }
    ],
    videoAnalytics: [
      { key: "datePosted", label: "Date posted", required: true },
      { key: "account", label: "Account" },
      { key: "productName", label: "Product name", required: true },
      { key: "category", label: "Category" },
      { key: "hook", label: "Hook text" },
      { key: "hookType", label: "Hook type" },
      { key: "videoLength", label: "Video length", type: "number" },
      { key: "cta", label: "CTA" },
      { key: "views", label: "Views", type: "number" },
      { key: "likes", label: "Likes", type: "number" },
      { key: "comments", label: "Comments", type: "number" },
      { key: "shares", label: "Shares", type: "number" },
      { key: "saves", label: "Saves", type: "number" },
      { key: "averageWatchTime", label: "Avg watch time", type: "number" },
      { key: "completionRate", label: "Completion rate", type: "number" },
      { key: "sales", label: "Sales", type: "number" },
      { key: "gmv", label: "GMV", type: "number" },
      { key: "commission", label: "Commission", type: "number" },
      { key: "notes", label: "Notes" }
    ],
    sampleRequests: [
      { key: "productName", label: "Product name", required: true },
      { key: "account", label: "Account" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority" },
      { key: "season", label: "Season" },
      { key: "commissionPotential", label: "Commission potential" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" }
    ]
  };
  return fields[type] || fields.productSales;
}

function autoMapHeaders(headers, type) {
  const aliases = {
    productName: ["product name", "product", "item name", "name", "title"],
    account: ["account", "workspace", "creator account"],
    category: ["category", "product category"],
    date: ["date", "sale date", "ordered date", "created time"],
    datePosted: ["date posted", "posted date", "post date", "video date", "date"],
    gmv: ["gmv", "gross revenue", "gross merchandise value", "revenue", "sales amount"],
    commission: ["commission", "est. commission", "estimated commission", "creator commission"],
    unitsSold: ["unit sales", "units sold", "sales", "quantity", "orders"],
    sales: ["sales", "unit sales", "units sold", "orders"],
    seasonality: ["seasonality", "season"],
    sampleStatus: ["sample status", "status"],
    hook: ["hook", "hook text", "opening line"],
    hookType: ["hook type", "creative type"],
    videoLength: ["video length", "length", "duration"],
    cta: ["cta", "call to action"],
    views: ["views", "video views"],
    likes: ["likes"],
    comments: ["comments"],
    shares: ["shares"],
    saves: ["saves"],
    averageWatchTime: ["average watch time", "avg watch time", "watch time"],
    completionRate: ["completion rate", "completion %", "complete rate"],
    priority: ["priority"],
    season: ["season", "seasonality"],
    commissionPotential: ["commission potential", "potential commission"],
    status: ["status", "sample status"],
    notes: ["notes", "note"]
  };
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizedName(header) }));
  return Object.fromEntries(importFields(type).map((field) => {
    const match = normalizedHeaders.find((item) => (aliases[field.key] || [field.key]).some((alias) => item.normalized === normalizedName(alias) || item.normalized.includes(normalizedName(alias))));
    return [field.key, match?.header || ""];
  }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') { value += '"'; index += 1; continue; }
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { row.push(value); value = ""; continue; }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }
  row.push(value);
  rows.push(row);
  const cleanRows = rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some(Boolean));
  const headers = (cleanRows.shift() || []).map((header, index) => header || `Column ${index + 1}`);
  return { headers, rows: cleanRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]))) };
}

function downloadImportTemplate(type) {
  const headers = importFields(type).map((field) => field.label);
  const sampleRows = {
    productSales: ["Example Product", "Raised Right", "Garden", todayDate(), "125.50", "18.25", "4", "Evergreen", "Selling", "Imported from weekly report"],
    videoAnalytics: [todayDate(), "Raised Right", "Example Product", "Garden", "This fixed my biggest garden problem", "Problem", "38", "See details", "12000", "850", "64", "122", "410", "9.4", "36", "4", "125.50", "18.25", "Strong saves"],
    sampleRequests: ["Example Product", "Truth Tuned Tribe", "Books", "High", "Fall", "$10+", "Request Now", "Request before seasonal window"]
  };
  const csv = [headers, sampleRows[type]].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-${type}-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function createImportedProduct(data, account) {
  const category = data.category || "Uncategorized";
  return {
    id: uniqueImportId(`${account.id}-${slug(data.productName || "product")}`),
    name: data.productName,
    accountId: account.id,
    account: account.name,
    category,
    categoryGroup: category.split("/")[0].trim(),
    seasonality: data.seasonality || "Evergreen",
    evergreenSeasonal: /evergreen/i.test(data.seasonality || "") ? "Evergreen" : "Seasonal",
    lifetimeGmv: 0,
    lifetimeCommission: 0,
    lifetimeUnits: 0,
    monthlyPerformance: [],
    firstPromotedDate: data.date || "",
    lastPromotedDate: data.date || "",
    sampleStatus: data.sampleStatus || "Wait",
    wouldPromoteAgain: "Maybe",
    status: "Watch",
    originalStatus: "Watch",
    notes: data.notes || "",
    bestHook: "",
    bestCta: "",
    strategyNotes: data.notes || "",
    similarTags: [category.split("/")[0].trim(), account.id]
  };
}

function ensureImportedProduct(productName, account, category) {
  const existing = findProductByName(productName, account.id);
  if (existing) return existing;
  const product = createImportedProduct({ productName, category: category || "Imported", seasonality: "Evergreen", notes: "Created during video analytics import." }, account);
  db.products.push(product);
  return product;
}

function findProductByName(name, accountId) { return products().find((product) => normalizedName(product.name) === normalizedName(name) && (!accountId || product.accountId === accountId)); }
function findVideoDuplicate(data, productId) { return videos().find((video) => video.productId === productId && String(video.datePosted || "") === String(data.datePosted || "") && normalizedName(video.hook || "") === normalizedName(data.hook || "")); }
function resolveImportAccount(accountName) { return accounts().find((account) => normalizedName(account.name) === normalizedName(accountName) || normalizedName(account.id) === normalizedName(accountName)) || getAccount(bulkImportState.accountId) || accounts()[0] || {}; }
function importTypeLabels() { return { productSales: "Product sales", videoAnalytics: "Video analytics", sampleRequests: "Sample requests" }; }
function duplicateModeLabel(mode) { return ({ skip: "Skip", update: "Update existing", duplicate: "Create duplicate" })[mode] || mode; }
function normalizedName(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function toNumber(value) { if (value === undefined || value === null || value === "") return 0; return Number(String(value).replace(/[$,%\s,]/g, "")); }
function csvEscape(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function uniqueImportId(base) {
  let id = slug(base) || `item-${Date.now()}`;
  let n = 2;
  const used = new Set([...products().map((p) => p.id), ...videos().map((v) => v.id), ...(db.sampleRequests || []).map((s) => s.id), ...(db.importHistory || []).map((entry) => entry.id), ...db.monthlyReports.map((r) => r.id)]);
  while (used.has(id)) id = `${slug(base)}-${n++}`;
  return id;
}

function importHistoryTable() {
  const rows = db.importHistory || [];
  if (!rows.length) return `<p class="empty">No imports yet.</p>`;
  return `<div class="table-card import-history-table"><table><thead><tr><th>Date imported</th><th>File</th><th>Rows imported</th><th>Account</th><th>Data type</th></tr></thead><tbody>${rows.slice(0, 12).map((entry) => `<tr><td>${entry.importedLabel || new Date(entry.importedAt).toLocaleString()}</td><td>${entry.fileName}</td><td>${number.format(entry.rowsImported || 0)}</td><td>${entry.account}</td><td>${entry.dataType}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderSettings() {
  const count = captureCount();
  const lastCaptured = localStorage.getItem(LAST_CAPTURED_KEY) || "Never";
  content.innerHTML = `<div class="section-title"><div><h3>Settings</h3><p>Backup, restore, or reset your local Northstar database.</p></div><span class="badge good">Last Saved: ${lastSavedAt}</span></div><div class="grid two"><div class="card settings-card"><h3>Backup & Restore</h3><p>Export a JSON backup before major edits. Import restores the full local workspace into this browser.</p><div class="settings-actions"><button id="exportBackup" class="icon-button">Export Backup</button><label class="import-button"><input id="importBackup" type="file" accept="application/json,.json">Import Backup</label></div></div><div class="card settings-card"><h3>Fast Capture™</h3><p>Capture count: ${count}. Last captured: ${lastCaptured}.</p><button class="icon-button" data-page="fastCapture">Open Fast Capture</button></div><div class="card settings-card"><h3>Bulk Import™</h3><p>Import history: ${(db.importHistory || []).length} saved imports.</p><button class="icon-button" data-page="bulkImport">Open Bulk Import</button></div><div class="card settings-card"><h3>Reset</h3><p>Reset clears localStorage and returns to the default data bundled in data/database.js.</p><button id="resetDefault" class="icon-button danger">Reset to Default Data</button></div></div><div class="card"><h3>Local Storage Status</h3><ul class="list"><li>Products: ${products().length}</li><li>Videos: ${videos().length}</li><li>Performance snapshots: ${db.performanceSnapshots.length}</li><li>Captured lessons: ${(db.notes.lessons || []).length}</li><li>Imports: ${(db.importHistory || []).length}</li><li>Sample cards: ${db.sampleRequests.length}</li><li>Monthly reports: ${db.monthlyReports.length}</li><li>Last Saved: ${lastSavedAt}</li></ul></div>`;
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  document.querySelector("#importBackup").addEventListener("change", importBackup);
  document.querySelector("#resetDefault").addEventListener("click", resetDefaultData);
  bindInternalButtons();
}

function exportBackup() {
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lastSavedAt,
    data: db,
    localMeta: {
      captureCount: captureCount(),
      lastCapturedAt: localStorage.getItem(LAST_CAPTURED_KEY) || "",
      captureLog: readJson(CAPTURE_LOG_KEY, []),
      pulseSnapshots: readJson(PULSE_SNAPSHOTS_KEY, []),
      decisionLog: readJson(DECISION_LOG_KEY, []),
      importHistory: db.importHistory || []
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = mergeDatabase(clone(defaultDb), parsed);
      normalizeDatabase();
      if (parsed.localMeta) {
        localStorage.setItem(CAPTURE_COUNT_KEY, String(parsed.localMeta.captureCount || 0));
        localStorage.setItem(LAST_CAPTURED_KEY, parsed.localMeta.lastCapturedAt || "");
        localStorage.setItem(CAPTURE_LOG_KEY, JSON.stringify(parsed.localMeta.captureLog || []));
        localStorage.setItem(PULSE_SNAPSHOTS_KEY, JSON.stringify(parsed.localMeta.pulseSnapshots || []));
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(parsed.localMeta.decisionLog || []));
        db.importHistory = parsed.localMeta.importHistory || db.importHistory || [];
        localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
      }
      saveData("Backup imported and saved locally");
      renderPage("settings");
    } catch (error) {
      showMessage("Import failed. Choose a valid Northstar JSON backup.", "warn");
    }
  };
  reader.readAsText(file);
}

function resetDefaultData() {
  if (!confirm("Reset Northstar to the default bundled data? This clears local saved changes in this browser.")) return;
  [STORAGE_KEY, SAVED_AT_KEY, CAPTURE_COUNT_KEY, LAST_CAPTURED_KEY, CAPTURE_LOG_KEY, PULSE_SNAPSHOTS_KEY, DECISION_LOG_KEY, BULK_IMPORT_HISTORY_KEY].forEach((key) => localStorage.removeItem(key));
  db = clone(defaultDb);
  normalizeDatabase();
  lastSavedAt = "Never";
  initializePulseEngine("reset-default");
  updateLastSavedDisplay();
  showMessage("Reset to default data", "warn");
  renderPage("settings");
}

/* Northstar Sprint 5 - Import Review™ */
const IMPORT_REVIEWS_KEY = "northstar.v01.importReviews";
let selectedImportReviewId = "";

if (!pages.some((page) => page.id === "importReview")) {
  const bulkIndex = pages.findIndex((page) => page.id === "bulkImport");
  pages.splice(bulkIndex >= 0 ? bulkIndex + 1 : 4, 0, { id: "importReview", label: "Import Review™", icon: "IR" });
}

function normalizeDatabase() {
  db.sampleRequests = db.sampleRequests || db["sample-requests"] || [];
  db.monthlyReports = db.monthlyReports || db["monthly-reports"] || [];
  db.accounts = db.accounts || [];
  db.products = db.products || [];
  db.videos = db.videos || [];
  db.hooks = db.hooks || [];
  db.audience = db.audience || [];
  db.seasons = db.seasons || {};
  db.performanceSnapshots = db.performanceSnapshots || [];
  db.importHistory = db.importHistory || readJson(BULK_IMPORT_HISTORY_KEY, []);
  db.importReviews = db.importReviews || readJson(IMPORT_REVIEWS_KEY, []);
  db.notes = db.notes || {};
  db.notes.businessRules = db.notes.businessRules || [];
  db.notes.recommendations = db.notes.recommendations || [];
  db.notes.wins = db.notes.wins || [];
  db.notes.seasonalAlerts = db.notes.seasonalAlerts || [];
  db.notes.lessons = db.notes.lessons || [];
}

function renderPage(pageId) {
  activePage = pageId;
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  const page = pages.find((entry) => entry.id === pageId);
  pageTitle.textContent = page ? page.label : "Product Detail";

  if (pageId === "executive") renderExecutive();
  if (pageId === "workspaces") renderWorkspaces();
  if (pageId === "fastCapture") renderFastCapture();
  if (pageId === "bulkImport") renderBulkImport();
  if (pageId === "importReview") renderImportReview();
  if (pageId === "products") renderProductsDatabase();
  if (pageId === "productDetail") renderProductDetail(selectedProductId);
  if (pageId === "videos") renderVideosDatabase();
  if (pageId === "recommendations") renderRecommendations();
  if (pageId === "raisedRight") renderAccount("raisedRight");
  if (pageId === "truthTunedTribe") renderAccount("truthTunedTribe");
  if (pageId === "vault") renderVault();
  if (pageId === "samples") renderSamples();
  if (pageId === "calendar") renderCalendar();
  if (pageId === "hooks") renderHooks();
  if (pageId === "audience") renderAudience();
  if (pageId === "reports") renderReports();
  if (pageId === "notes") renderNotes();
  if (pageId === "settings") renderSettings();
}

function renderImportReview() {
  normalizeDatabase();
  const reviews = db.importReviews || [];
  if (!selectedImportReviewId && reviews[0]) selectedImportReviewId = reviews[0].id;
  const review = reviews.find((item) => item.id === selectedImportReviewId) || reviews[0] || synthesizeReviewFromHistory();
  content.innerHTML = `
    <section class="review-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Import Review™</p>
        <h1>Did this import work correctly?</h1>
        <p>Reconcile Northstar totals against TikTok, resolve flagged rows, and mark clean imports as trustworthy.</p>
      </div>
      <div class="review-switcher">${reviewSelector(reviews, review)}</div>
    </section>

    ${review ? importReviewContent(review) : emptyImportReview()}
  `;
  bindInternalButtons();
  bindImportReviewControls(review);
}

function importReviewContent(review) {
  const comparison = compareManualTotals(review);
  const status = reviewStatus(comparison, review);
  return `
    <section class="card review-summary-card">
      <div class="section-title"><div><h3>Import Summary</h3><p>${review.fileName || "No file name"} · ${review.dataType || "Import"} · ${review.account || "Mixed account"}</p></div><span class="review-status ${status.className}">${status.label}</span></div>
      <div class="grid four">
        ${metric("Date Imported", review.importedLabel || "Not available", "Saved locally", "")}
        ${metric("Rows Imported", number.format(review.rowsImported || 0), `${number.format(review.rowsUpdated || 0)} updated`, "")}
        ${metric("Rows Skipped", number.format(review.rowsSkipped || 0), "Duplicate or empty", "")}
        ${metric("Errors", number.format(review.errors || 0), "Rows needing attention", "")}
      </div>
    </section>

    <section class="card reconciliation-card">
      <div class="section-title"><div><h3>Reconciliation Totals</h3><p>Northstar totals calculated from this import.</p></div></div>
      <div class="grid four">
        ${metric("Total GMV", money.format(review.totals.gmv || 0), "Northstar import total", "")}
        ${metric("Commission", money.format(review.totals.commission || 0), "Northstar import total", "")}
        ${metric("Units Sold", number.format(review.totals.unitsSold || 0), "Northstar import total", "")}
        ${metric("Sales Records", number.format(review.totals.salesRecords || 0), `${number.format(review.totals.products || 0)} products · ${number.format(review.totals.videos || 0)} videos`, "")}
      </div>
      <form id="manualCheckForm" class="manual-check-form">
        <label>TikTok GMV<input name="tiktokGmv" type="number" step="0.01" value="${escapeAttr(review.manualCheck?.tiktokGmv ?? "")}"></label>
        <label>TikTok commission<input name="tiktokCommission" type="number" step="0.01" value="${escapeAttr(review.manualCheck?.tiktokCommission ?? "")}"></label>
        <label>TikTok units sold<input name="tiktokUnits" type="number" step="1" value="${escapeAttr(review.manualCheck?.tiktokUnits ?? "")}"></label>
        <button class="icon-button" type="submit">Compare Totals</button>
      </form>
      ${manualComparisonTable(comparison)}
    </section>

    <section class="card issue-finder-card">
      <div class="section-title"><div><h3>Issue Finder</h3><p>Northstar flags rows that may need a second look.</p></div><span class="badge ${review.openIssues ? "hot" : "good"}">${number.format(review.openIssues || 0)} open issues</span></div>
      ${issueQueueTable(review)}
    </section>

    <section class="card review-complete-card">
      <div class="section-title"><div><h3>Save Reviewed Import</h3><p>${impactSummary(review)}</p></div></div>
      <form id="markReviewedForm" class="review-complete-form">
        <label>Reviewed by<input name="reviewedBy" value="${escapeAttr(review.reviewedBy || "Jennifer")}"></label>
        <label class="wide">Review notes<textarea name="reviewNotes" placeholder="What did you verify?">${escapeHtml(review.reviewNotes || "")}</textarea></label>
        <button class="icon-button" type="submit">Mark Import Reviewed</button>
      </form>
      ${review.reviewedAt ? `<p class="reviewed-stamp">Reviewed ${new Date(review.reviewedAt).toLocaleString()} by ${review.reviewedBy || "Jennifer"}</p>` : ""}
    </section>
  `;
}

function emptyImportReview() {
  return `<section class="card"><h3>No imports to review yet.</h3><p class="empty">Use Bulk Import first. Northstar will create an Import Review automatically after you confirm the CSV.</p><button class="icon-button" data-page="bulkImport">Open Bulk Import</button></section>`;
}

function confirmBulkImport() {
  const preview = bulkImportState.preview || analyzeImport();
  if (!preview.canSave) {
    showMessage("Missing required columns or no valid rows to import.", "warn");
    return;
  }
  const summary = { imported: 0, updated: 0, skipped: 0, errors: [] };
  preview.normalizedRows.forEach((row) => {
    if (row.empty) { summary.skipped += 1; return; }
    if (row.errors.length) {
      summary.errors.push({ title: `Row ${row.rowNumber}`, detail: row.errors.join("; ") });
      return;
    }
    const result = importRowByType(row);
    summary[result] += 1;
  });
  const review = buildImportReview(preview, summary);
  const history = {
    id: uniqueImportId(`import-${Date.now()}`),
    reviewId: review.id,
    importedAt: review.importedAt,
    importedLabel: review.importedLabel,
    fileName: bulkImportState.fileName,
    rowsImported: summary.imported,
    rowsUpdated: summary.updated,
    rowsSkipped: summary.skipped,
    errors: summary.errors.length,
    account: getAccount(bulkImportState.accountId).name || "Mixed",
    dataType: importTypeLabels()[bulkImportState.dataType]
  };
  review.historyId = history.id;
  db.importHistory.unshift(history);
  db.importHistory = db.importHistory.slice(0, 80);
  db.importReviews.unshift(review);
  db.importReviews = db.importReviews.slice(0, 80);
  localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
  localStorage.setItem(IMPORT_REVIEWS_KEY, JSON.stringify(db.importReviews));
  selectedImportReviewId = review.id;
  bulkImportState.savedSummary = summary;
  bulkImportState.step = "done";
  saveData("Import saved. Review is ready.");
  renderBulkImport();
}

function buildImportReview(preview, summary) {
  const rows = preview.normalizedRows.filter((row) => !row.empty);
  const validRows = rows.filter((row) => !row.errors.length);
  const totals = reviewTotals(validRows);
  const issues = findImportIssues(preview);
  const impacted = importImpact(validRows, summary);
  return {
    id: uniqueImportId(`review-${Date.now()}`),
    importedAt: new Date().toISOString(),
    importedLabel: new Date().toLocaleString(),
    fileName: bulkImportState.fileName,
    account: getAccount(bulkImportState.accountId).name || "Mixed",
    accountId: bulkImportState.accountId,
    dataType: importTypeLabels()[bulkImportState.dataType],
    dataTypeKey: bulkImportState.dataType,
    rowsDetected: preview.rowsDetected,
    rowsImported: summary.imported,
    rowsUpdated: summary.updated,
    rowsSkipped: summary.skipped,
    errors: summary.errors.length,
    totals,
    manualCheck: {},
    issues,
    openIssues: issues.filter((issue) => issue.status === "Open").length,
    unmappedColumns: unmappedImportColumns(),
    impact: impacted,
    reviewedAt: "",
    reviewedBy: "",
    reviewNotes: ""
  };
}

function reviewTotals(rows) {
  const productNames = new Set();
  const videoKeys = new Set();
  return rows.reduce((totals, row) => {
    const data = row.data;
    const units = toNumber(data.unitsSold || data.sales);
    const gmv = toNumber(data.gmv);
    const commission = toNumber(data.commission);
    if (data.productName) productNames.add(normalizedName(data.productName));
    if (bulkImportState.dataType === "videoAnalytics") videoKeys.add(`${data.datePosted}|${normalizedName(data.productName)}|${normalizedName(data.hook)}`);
    totals.gmv += gmv;
    totals.commission += commission;
    totals.unitsSold += units;
    if (units || gmv || commission) totals.salesRecords += 1;
    totals.products = productNames.size;
    totals.videos = videoKeys.size;
    return totals;
  }, { gmv: 0, commission: 0, unitsSold: 0, products: 0, videos: 0, salesRecords: 0 });
}

function findImportIssues(preview) {
  const issues = [];
  preview.missing.forEach((field) => issues.push(reviewIssue("Missing mapping", 1, field.label, `${field.label} was required but not mapped.`, "Map Fields")));
  preview.invalid.forEach((item) => issues.push(reviewIssue("Invalid number", Number(item.title.replace(/\D/g, "")) || 0, "", item.detail, "Edit")));
  preview.duplicateRows.forEach((row) => issues.push(reviewIssue("Duplicate row", row.rowNumber, row.data.productName, "Repeated inside this CSV.", "Merge duplicate")));
  preview.duplicates.forEach((row) => issues.push(reviewIssue("Duplicate existing record", row.rowNumber, row.data.productName, "Matches an existing Northstar record.", "Merge duplicate")));
  preview.normalizedRows.forEach((row) => {
    if (row.empty) return;
    const data = row.data;
    const gmv = toNumber(data.gmv);
    const commission = toNumber(data.commission);
    const units = toNumber(data.unitsSold || data.sales);
    if (!data.productName) issues.push(reviewIssue("Missing product name", row.rowNumber, "", "Product name is blank.", "Edit"));
    if (units > 0 && gmv === 0) issues.push(reviewIssue("$0 GMV with units", row.rowNumber, data.productName, `${units} units sold but GMV is $0.`, "Edit"));
    if (commission > gmv && gmv > 0) issues.push(reviewIssue("Commission higher than GMV", row.rowNumber, data.productName, `${money.format(commission)} commission exceeds ${money.format(gmv)} GMV.`, "Edit"));
    if ([gmv, commission, units].some((value) => value < 0)) issues.push(reviewIssue("Negative value", row.rowNumber, data.productName, "One or more numeric values are negative.", "Edit"));
    if (!data.category && ["productSales", "videoAnalytics", "sampleRequests"].includes(bulkImportState.dataType)) issues.push(reviewIssue("Empty category", row.rowNumber, data.productName, "Category is blank.", "Assign category"));
    if (gmv > 10000 || commission > 2500 || units > 1000) issues.push(reviewIssue("Suspiciously high value", row.rowNumber, data.productName, "This row is unusually high for a creator import.", "Edit"));
    if (gmv > 0 && gmv < 0.25) issues.push(reviewIssue("Suspiciously low GMV", row.rowNumber, data.productName, "GMV is positive but extremely low.", "Edit"));
  });
  unmappedImportColumns().forEach((column) => issues.push(reviewIssue("Unmapped column", 1, column, `${column} was detected but not imported.`, "Ignore")));
  return issues.map((issue, index) => ({ ...issue, id: `issue-${Date.now()}-${index}` })).slice(0, 120);
}

function reviewIssue(type, rowNumber, subject, detail, suggestedAction) {
  return { type, rowNumber, subject: subject || "Import", detail, suggestedAction, status: "Open", note: "" };
}

function importImpact(rows, summary) {
  const productsTouched = new Set(rows.map((row) => normalizedName(row.data.productName)).filter(Boolean));
  const videosTouched = bulkImportState.dataType === "videoAnalytics" ? rows.length : 0;
  const recommendations = Math.min(12, productsTouched.size + Math.ceil(videosTouched / 3));
  return { products: productsTouched.size, videos: videosTouched, recommendations, imported: summary.imported, updated: summary.updated };
}

function unmappedImportColumns() {
  const mapped = new Set(Object.values(bulkImportState.mapping || {}).filter(Boolean));
  return (bulkImportState.headers || []).filter((header) => !mapped.has(header));
}

function bindImportReviewControls(review) {
  document.querySelector("#reviewSelect")?.addEventListener("change", (event) => {
    selectedImportReviewId = event.target.value;
    renderImportReview();
  });
  document.querySelector("#manualCheckForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    review.manualCheck = {
      tiktokGmv: form.get("tiktokGmv"),
      tiktokCommission: form.get("tiktokCommission"),
      tiktokUnits: form.get("tiktokUnits")
    };
    persistImportReviews("Manual totals saved");
    renderImportReview();
  });
  document.querySelectorAll("[data-issue-action]").forEach((button) => button.addEventListener("click", () => updateIssueStatus(review, button.dataset.issueAction, button.dataset.issueId)));
  document.querySelector("#markReviewedForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    review.reviewedAt = new Date().toISOString();
    review.reviewedBy = form.get("reviewedBy") || "Jennifer";
    review.reviewNotes = form.get("reviewNotes") || "";
    review.openIssues = (review.issues || []).filter((issue) => issue.status === "Open").length;
    persistImportReviews("Import marked reviewed");
    renderImportReview();
  });
}

function updateIssueStatus(review, action, issueId) {
  const issue = (review.issues || []).find((item) => item.id === issueId);
  if (!issue) return;
  if (action === "edit") {
    const note = prompt("What correction did you make or need to make?");
    if (note) issue.note = note;
    issue.status = "Edited";
  }
  if (action === "ignore") issue.status = "Ignored";
  if (action === "merge") issue.status = "Merged";
  if (action === "category") {
    const category = prompt("Assign category:");
    if (category) issue.note = `Assigned category: ${category}`;
    issue.status = "Category assigned";
  }
  if (action === "reviewed") issue.status = "Reviewed";
  review.openIssues = (review.issues || []).filter((item) => item.status === "Open").length;
  persistImportReviews("Fix queue updated");
  renderImportReview();
}

function persistImportReviews(message) {
  localStorage.setItem(IMPORT_REVIEWS_KEY, JSON.stringify(db.importReviews || []));
  saveData(message);
}

function reviewSelector(reviews, review) {
  if (!reviews.length) return `<button class="icon-button" data-page="bulkImport">Import CSV</button>`;
  return `<label>Review import<select id="reviewSelect">${reviews.map((item) => `<option value="${item.id}" ${item.id === review?.id ? "selected" : ""}>${item.fileName} · ${item.importedLabel}</option>`).join("")}</select></label>`;
}

function compareManualTotals(review) {
  const manual = review.manualCheck || {};
  return [
    compareTotalRow("GMV", review.totals.gmv || 0, manual.tiktokGmv, true),
    compareTotalRow("Commission", review.totals.commission || 0, manual.tiktokCommission, true),
    compareTotalRow("Units Sold", review.totals.unitsSold || 0, manual.tiktokUnits, false)
  ];
}

function compareTotalRow(label, northstar, tiktok, isMoney) {
  const hasTikTok = tiktok !== undefined && tiktok !== null && String(tiktok) !== "";
  const tikTokValue = hasTikTok ? toNumber(tiktok) : null;
  const difference = hasTikTok ? northstar - tikTokValue : 0;
  const percent = hasTikTok && tikTokValue !== 0 ? (difference / tikTokValue) * 100 : 0;
  return { label, northstar, tiktok: tikTokValue, hasTikTok, difference, percent, isMoney };
}

function manualComparisonTable(rows) {
  return `<div class="table-card comparison-table"><table><thead><tr><th>Total</th><th>Northstar</th><th>TikTok</th><th>Difference</th><th>Difference %</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.label}</td><td>${formatReviewNumber(row.northstar, row.isMoney)}</td><td>${row.hasTikTok ? formatReviewNumber(row.tiktok, row.isMoney) : "Add TikTok total"}</td><td>${row.hasTikTok ? formatReviewNumber(row.difference, row.isMoney) : "-"}</td><td>${row.hasTikTok ? `${row.percent.toFixed(1)}%` : "-"}</td></tr>`).join("")}</tbody></table></div>`;
}

function reviewStatus(comparison, review) {
  if ((review.openIssues || 0) > 0) return { label: "Needs Review", className: "needs-review" };
  const checked = comparison.filter((row) => row.hasTikTok);
  if (!checked.length) return { label: review.reviewedAt ? "Matched" : "Needs Review", className: review.reviewedAt ? "matched" : "needs-review" };
  const maxDiff = Math.max(...checked.map((row) => Math.abs(row.percent)));
  const maxRaw = Math.max(...checked.map((row) => Math.abs(row.difference)));
  if (maxDiff <= 1 || maxRaw <= 1) return { label: "Matched", className: "matched" };
  if (maxDiff <= 5) return { label: "Small Difference", className: "small-difference" };
  return { label: "Needs Review", className: "needs-review" };
}

function issueQueueTable(review) {
  const issues = review.issues || [];
  if (!issues.length) return `<p class="empty">No issues found. This import looks clean.</p>`;
  return `<div class="table-card fix-queue-table"><table><thead><tr><th>Issue</th><th>Row</th><th>Subject</th><th>Detail</th><th>Status</th><th>Actions</th></tr></thead><tbody>${issues.map((issue) => `<tr><td><strong>${issue.type}</strong></td><td>${issue.rowNumber || "-"}</td><td>${issue.subject || ""}</td><td>${issue.detail}${issue.note ? `<span>${issue.note}</span>` : ""}</td><td><span class="badge ${issue.status === "Open" ? "hot" : "good"}">${issue.status}</span></td><td><div class="issue-actions"><button data-issue-action="edit" data-issue-id="${issue.id}">Edit</button><button data-issue-action="ignore" data-issue-id="${issue.id}">Ignore</button><button data-issue-action="merge" data-issue-id="${issue.id}">Merge duplicate</button><button data-issue-action="category" data-issue-id="${issue.id}">Assign category</button><button data-issue-action="reviewed" data-issue-id="${issue.id}">Mark reviewed</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function impactSummary(review) {
  const impact = review.impact || { products: 0, videos: 0, recommendations: 0 };
  return `Northstar updated ${number.format(impact.products || 0)} products, ${number.format(impact.videos || 0)} videos, and ${number.format(impact.recommendations || 0)} recommendations.`;
}

function synthesizeReviewFromHistory() {
  const latest = (db.importHistory || [])[0];
  if (!latest) return null;
  return {
    id: latest.reviewId || latest.id,
    fileName: latest.fileName,
    importedLabel: latest.importedLabel,
    account: latest.account,
    dataType: latest.dataType,
    rowsImported: latest.rowsImported || 0,
    rowsUpdated: latest.rowsUpdated || 0,
    rowsSkipped: latest.rowsSkipped || 0,
    errors: latest.errors || 0,
    totals: { gmv: 0, commission: 0, unitsSold: 0, products: 0, videos: 0, salesRecords: 0 },
    manualCheck: {},
    issues: [],
    openIssues: latest.errors || 0,
    impact: { products: 0, videos: 0, recommendations: 0 }
  };
}

function formatReviewNumber(value, isMoney) { return isMoney ? money.format(value || 0) : number.format(value || 0); }

function renderSettings() {
  const count = captureCount();
  const lastCaptured = localStorage.getItem(LAST_CAPTURED_KEY) || "Never";
  content.innerHTML = `<div class="section-title"><div><h3>Settings</h3><p>Backup, restore, or reset your local Northstar database.</p></div><span class="badge good">Last Saved: ${lastSavedAt}</span></div><div class="grid two"><div class="card settings-card"><h3>Backup & Restore</h3><p>Export a JSON backup before major edits. Import restores the full local workspace into this browser.</p><div class="settings-actions"><button id="exportBackup" class="icon-button">Export Backup</button><label class="import-button"><input id="importBackup" type="file" accept="application/json,.json">Import Backup</label></div></div><div class="card settings-card"><h3>Fast Capture™</h3><p>Capture count: ${count}. Last captured: ${lastCaptured}.</p><button class="icon-button" data-page="fastCapture">Open Fast Capture</button></div><div class="card settings-card"><h3>Bulk Import™</h3><p>Import history: ${(db.importHistory || []).length} saved imports.</p><button class="icon-button" data-page="bulkImport">Open Bulk Import</button></div><div class="card settings-card"><h3>Import Review™</h3><p>Reviewed imports: ${(db.importReviews || []).filter((review) => review.reviewedAt).length} of ${(db.importReviews || []).length}.</p><button class="icon-button" data-page="importReview">Open Import Review</button></div><div class="card settings-card"><h3>Reset</h3><p>Reset clears localStorage and returns to the default data bundled in data/database.js.</p><button id="resetDefault" class="icon-button danger">Reset to Default Data</button></div></div><div class="card"><h3>Local Storage Status</h3><ul class="list"><li>Products: ${products().length}</li><li>Videos: ${videos().length}</li><li>Performance snapshots: ${db.performanceSnapshots.length}</li><li>Captured lessons: ${(db.notes.lessons || []).length}</li><li>Imports: ${(db.importHistory || []).length}</li><li>Import reviews: ${(db.importReviews || []).length}</li><li>Sample cards: ${db.sampleRequests.length}</li><li>Monthly reports: ${db.monthlyReports.length}</li><li>Last Saved: ${lastSavedAt}</li></ul></div>`;
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  document.querySelector("#importBackup").addEventListener("change", importBackup);
  document.querySelector("#resetDefault").addEventListener("click", resetDefaultData);
  bindInternalButtons();
}

function exportBackup() {
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lastSavedAt,
    data: db,
    localMeta: {
      captureCount: captureCount(),
      lastCapturedAt: localStorage.getItem(LAST_CAPTURED_KEY) || "",
      captureLog: readJson(CAPTURE_LOG_KEY, []),
      pulseSnapshots: readJson(PULSE_SNAPSHOTS_KEY, []),
      decisionLog: readJson(DECISION_LOG_KEY, []),
      importHistory: db.importHistory || [],
      importReviews: db.importReviews || []
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = mergeDatabase(clone(defaultDb), parsed);
      normalizeDatabase();
      if (parsed.localMeta) {
        localStorage.setItem(CAPTURE_COUNT_KEY, String(parsed.localMeta.captureCount || 0));
        localStorage.setItem(LAST_CAPTURED_KEY, parsed.localMeta.lastCapturedAt || "");
        localStorage.setItem(CAPTURE_LOG_KEY, JSON.stringify(parsed.localMeta.captureLog || []));
        localStorage.setItem(PULSE_SNAPSHOTS_KEY, JSON.stringify(parsed.localMeta.pulseSnapshots || []));
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(parsed.localMeta.decisionLog || []));
        db.importHistory = parsed.localMeta.importHistory || db.importHistory || [];
        db.importReviews = parsed.localMeta.importReviews || db.importReviews || [];
        localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
        localStorage.setItem(IMPORT_REVIEWS_KEY, JSON.stringify(db.importReviews));
      }
      saveData("Backup imported and saved locally");
      renderPage("settings");
    } catch (error) {
      showMessage("Import failed. Choose a valid Northstar JSON backup.", "warn");
    }
  };
  reader.readAsText(file);
}

function resetDefaultData() {
  if (!confirm("Reset Northstar to the default bundled data? This clears local saved changes in this browser.")) return;
  [STORAGE_KEY, SAVED_AT_KEY, CAPTURE_COUNT_KEY, LAST_CAPTURED_KEY, CAPTURE_LOG_KEY, PULSE_SNAPSHOTS_KEY, DECISION_LOG_KEY, BULK_IMPORT_HISTORY_KEY, IMPORT_REVIEWS_KEY].forEach((key) => localStorage.removeItem(key));
  db = clone(defaultDb);
  normalizeDatabase();
  lastSavedAt = "Never";
  initializePulseEngine("reset-default");
  updateLastSavedDisplay();
  showMessage("Reset to default data", "warn");
  renderPage("settings");
}

/* Northstar Sprint 6 - Action Plan™ and The Mark™ Foundation */
const ACTION_STATUS_KEY = "northstar.v01.actionStatuses";
const ACTION_HISTORY_KEY = "northstar.v01.actionHistory";
let knowledgeSearch = "";
let knowledgeFilter = "All";

renameNorthstarPages();

function renameNorthstarPages() {
  const labels = {
    executive: "Morning Brief",
    recommendations: "Opportunity Center",
    notes: "Knowledge Vault",
    reports: "Briefs",
    fastCapture: "Fast Capture",
    bulkImport: "Bulk Import",
    importReview: "Import Review"
  };
  pages.forEach((page) => { if (labels[page.id]) page.label = labels[page.id]; });
  if (!pages.some((page) => page.id === "actionPlan")) {
    const executiveIndex = pages.findIndex((page) => page.id === "executive");
    pages.splice(executiveIndex >= 0 ? executiveIndex + 1 : 1, 0, { id: "actionPlan", label: "Action Plan", icon: "AP" });
  }
  if (!pages.some((page) => page.id === "decisionLog")) {
    const actionIndex = pages.findIndex((page) => page.id === "actionPlan");
    pages.splice(actionIndex >= 0 ? actionIndex + 1 : 2, 0, { id: "decisionLog", label: "Decision Log", icon: "DL" });
  }
}

function normalizeDatabase() {
  db.sampleRequests = db.sampleRequests || db["sample-requests"] || [];
  db.monthlyReports = db.monthlyReports || db["monthly-reports"] || [];
  db.accounts = db.accounts || [];
  db.products = db.products || [];
  db.videos = db.videos || [];
  db.hooks = db.hooks || [];
  db.audience = db.audience || [];
  db.seasons = db.seasons || {};
  db.performanceSnapshots = db.performanceSnapshots || [];
  db.importHistory = db.importHistory || readJson(BULK_IMPORT_HISTORY_KEY, []);
  db.importReviews = db.importReviews || readJson(IMPORT_REVIEWS_KEY, []);
  db.actionHistory = db.actionHistory || readJson(ACTION_HISTORY_KEY, []);
  db.notes = db.notes || {};
  db.notes.businessRules = db.notes.businessRules || [];
  db.notes.recommendations = db.notes.recommendations || [];
  db.notes.wins = db.notes.wins || [];
  db.notes.seasonalAlerts = db.notes.seasonalAlerts || [];
  db.notes.lessons = db.notes.lessons || [];
}

function renderPage(pageId) {
  activePage = pageId;
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  const page = pages.find((entry) => entry.id === pageId);
  pageTitle.textContent = page ? page.label : "Product Detail";

  if (pageId === "executive") renderExecutive();
  if (pageId === "actionPlan") renderActionPlan();
  if (pageId === "decisionLog") renderDecisionLog();
  if (pageId === "workspaces") renderWorkspaces();
  if (pageId === "fastCapture") renderFastCapture();
  if (pageId === "bulkImport") renderBulkImport();
  if (pageId === "importReview") renderImportReview();
  if (pageId === "products") renderProductsDatabase();
  if (pageId === "productDetail") renderProductDetail(selectedProductId);
  if (pageId === "videos") renderVideosDatabase();
  if (pageId === "recommendations") renderRecommendations();
  if (pageId === "raisedRight") renderAccount("raisedRight");
  if (pageId === "truthTunedTribe") renderAccount("truthTunedTribe");
  if (pageId === "vault") renderVault();
  if (pageId === "samples") renderSamples();
  if (pageId === "calendar") renderCalendar();
  if (pageId === "hooks") renderHooks();
  if (pageId === "audience") renderAudience();
  if (pageId === "reports") renderReports();
  if (pageId === "notes") renderNotes();
  if (pageId === "settings") renderSettings();
}

function renderActionPlan() {
  const actions = buildActionPlan();
  ensureActionDecisionLog(actions);
  const top = actions.filter((action) => action.status !== "Dismissed").slice(0, 5);
  content.innerHTML = `
    <section class="action-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Action Plan</p>
        <h1>What should I do next?</h1>
        <p>Northstar turns Signals into direction using sales strength, commission, growth, seasonality, and audience fit.</p>
      </div>
      <div class="action-export">
        <button class="icon-button" data-export-actions="text">Export Plain Text</button>
        <button class="ghost-button" data-export-actions="json">Export JSON</button>
      </div>
    </section>
    ${actions.length ? `
      <section class="card top-actions-card">
        <div class="section-title"><div><h3>Today's Top 5 Actions</h3><p>Open Northstar, do these first.</p></div><span class="badge good">Confidence Engine</span></div>
        <div class="action-card-grid">${top.map(actionCard).join("")}</div>
      </section>
      <section class="card action-category-card">
        <div class="section-title"><div><h3>Action Categories</h3><p>Film, request, repost, retire, watch, and learn lanes.</p></div></div>
        <div class="action-lanes">${["Film", "Request", "Repost", "Retire", "Watch", "Learn"].map((category) => actionLane(category, actions)).join("")}</div>
      </section>
      <section class="card action-history-card">
        <div class="section-title"><div><h3>Action History</h3><p>Completed, snoozed, and dismissed actions are saved locally.</p></div><button class="chart-detail-link" data-page="decisionLog">Open Decision Log</button></div>
        ${actionHistoryTable()}
      </section>
    ` : `<section class="card"><h3>Northstar needs more creator data before creating reliable direction.</h3><p class="empty">Capture products, videos, or import a CSV. Action Plan will activate once there are enough Signals.</p><button class="icon-button" data-page="fastCapture">Capture Data</button></section>`}
  `;
  bindInternalButtons();
  bindActionPlanControls(actions);
}

function buildActionPlan() {
  const statuses = readJson(ACTION_STATUS_KEY, {});
  const ranked = scoredProducts();
  if (!ranked.length) return [];
  const actions = [];
  const top = ranked[0];
  const topUnits = products().slice().sort((a, b) => (b.lifetimeUnits || 0) - (a.lifetimeUnits || 0))[0];
  const topCommission = products().slice().sort((a, b) => (b.lifetimeCommission || 0) - (a.lifetimeCommission || 0))[0];
  const request = requestOpportunities()[0];
  const repost = ranked.find((product) => seasonIntelligence(product) === "Evergreen" && product.id !== top?.id) || topUnits;
  const retire = ranked.slice().reverse().find((product) => flywheelScore(product).score < 40 || product.status === "Retire");
  const watch = ranked.find((product) => flywheelScore(product).score >= 40 && flywheelScore(product).score < 72) || ranked[2];
  const lesson = latestKnowledgeLesson();

  if (top) actions.push(makeAction("Film", `Film again: ${shortName(top.name)}`, top, confidenceForAction(top, "Film"), productNextMove(top)));
  if (request) actions.push(makeAction("Request", `Request: ${request.title}`, null, confidenceForCategory(request.title, "Request"), request.note, request.title, "Medium"));
  if (repost) actions.push(makeAction("Repost", `Repost or remake: ${shortName(repost.name)}`, repost, confidenceForAction(repost, "Repost"), `${repost.name} is reusable because ${seasonIntelligence(repost).toLowerCase()} Signals still support it.`));
  if (retire) actions.push(makeAction("Retire", `Stop testing: ${shortName(retire.name)}`, retire, confidenceForAction(retire, "Retire"), `${retire.name} has a weak Northstar Score or a retire status. Protect your testing energy.`, retire.categoryGroup, "Medium"));
  if (watch) actions.push(makeAction("Watch", `Analyze: ${shortName(watch.name)}`, watch, confidenceForAction(watch, "Watch"), `${watch.name} is not a clear double-down yet. Review hooks, saves, sales, and category fit.`, watch.categoryGroup, "Low"));
  if (lesson) actions.push(makeAction("Learn", `Apply lesson: ${shortName(lesson.title || lesson.subject || "recent lesson")}`, null, Number(lesson.confidence || 72), lesson.lesson || lesson.title || "Use the latest captured lesson in today's creative decisions.", lesson.subject || "Knowledge Vault", "Medium", lesson.account));

  return actions
    .map((action) => ({ ...action, ...(statuses[action.id] || {}) }))
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.confidence - a.confidence)
    .slice(0, 18);
}

function makeAction(category, action, product, confidence, reason, subject, priority, accountName) {
  const account = accountName || product?.account || inferAccountForSubject(subject);
  const productOrCategory = subject || product?.name || "Category";
  return {
    id: `action-${slug(category)}-${slug(productOrCategory)}-${new Date().toISOString().slice(0, 10)}`,
    dateRecommended: new Date().toISOString().slice(0, 10),
    category,
    action,
    account,
    productId: product?.id || "",
    productOrCategory,
    confidence: Math.round(confidence),
    reason,
    priority: priority || (confidence >= 82 ? "High" : confidence >= 62 ? "Medium" : "Low"),
    status: "Open",
    resultNotes: "",
    dateCompleted: ""
  };
}

function confidenceForAction(product, actionType) {
  if (!product) return 50;
  const maxUnits = Math.max(...products().map((item) => Number(item.lifetimeUnits || 0)), 1);
  const maxCommission = Math.max(...products().map((item) => Number(item.lifetimeCommission || 0)), 1);
  const units = (product.lifetimeUnits || 0) / maxUnits > 0.65 ? 30 : (product.lifetimeUnits || 0) > 0 ? 18 : 4;
  const commission = (product.lifetimeCommission || 0) / maxCommission > 0.65 ? 20 : (product.lifetimeCommission || 0) > 0 ? 12 : 3;
  const growth = recentGrowthScore(product);
  const seasonal = ["Evergreen", "Coming Soon"].includes(seasonIntelligence(product)) ? 15 : seasonIntelligence(product) === "Seasonal" ? 10 : 4;
  const audience = audienceFit(product) * 1.5;
  let score = units + commission + growth + seasonal + audience;
  if (actionType === "Retire") score = 100 - flywheelScore(product).score;
  if (actionType === "Watch") score = Math.max(55, Math.min(78, score));
  return Math.max(35, Math.min(98, score));
}

function confidenceForCategory(title) {
  const category = categoryRankings().find((row) => normalizedName(title).includes(normalizedName(row.category)));
  if (!category) return 64;
  return Math.max(55, Math.min(92, 45 + Math.min(25, category.units) + Math.min(22, category.commission / 20)));
}

function recentGrowthScore(product) {
  const snapshots = readJson(PULSE_SNAPSHOTS_KEY, []);
  const latest = snapshots.at(-1);
  const previous = snapshots.length > 1 ? snapshots.at(-2) : null;
  if (!latest || !previous) return Number(product.lifetimeUnits || 0) > 0 ? 12 : 0;
  const now = latest.products?.find((item) => item.id === product.id);
  const before = previous.products?.find((item) => item.id === product.id);
  if (!now || !before) return 10;
  const unitDelta = (now.units || 0) - (before.units || 0);
  const gmvDelta = (now.gmv || 0) - (before.gmv || 0);
  return unitDelta > 0 || gmvDelta > 0 ? 20 : 6;
}

function actionCard(action) {
  return `<article class="brief-action-card ${action.status.toLowerCase().replace(/\s+/g, "-")}"><div class="action-card-top"><span class="badge ${priorityClass(action.priority)}">${action.priority}</span><strong>${action.confidence}%</strong></div><h3>${action.action}</h3><p>${action.reason}</p><div class="product-meta"><span>${action.account}</span><span>${action.productOrCategory}</span><span>${action.category}</span></div><div class="action-controls"><button data-action-command="complete" data-action-id="${action.id}">Mark Complete</button><button data-action-command="snooze" data-action-id="${action.id}">Snooze</button><button data-action-command="dismiss" data-action-id="${action.id}">Dismiss</button><button data-action-command="note" data-action-id="${action.id}">Add Note</button></div></article>`;
}

function actionLane(category, actions) {
  const list = actions.filter((action) => action.category === category).slice(0, 4);
  return `<section class="action-lane"><h3>${category}</h3>${list.length ? list.map((action) => `<div class="lane-action"><strong>${action.action}</strong><span>${action.confidence}% · ${action.priority}</span></div>`).join("") : `<p class="empty">No ${category.toLowerCase()} action yet.</p>`}</section>`;
}

function bindActionPlanControls(actions) {
  document.querySelectorAll("[data-action-command]").forEach((button) => button.addEventListener("click", () => {
    const action = actions.find((item) => item.id === button.dataset.actionId);
    if (action) updateActionStatus(action, button.dataset.actionCommand);
  }));
  document.querySelectorAll("[data-export-actions]").forEach((button) => button.addEventListener("click", () => exportActionPlan(button.dataset.exportActions, actions)));
}

function updateActionStatus(action, command) {
  const statuses = readJson(ACTION_STATUS_KEY, {});
  const history = readJson(ACTION_HISTORY_KEY, db.actionHistory || []);
  const current = statuses[action.id] || {};
  if (command === "complete") {
    current.status = "Complete";
    current.dateCompleted = new Date().toISOString().slice(0, 10);
    current.resultNotes = prompt("Result notes or outcome/sales notes:") || current.resultNotes || "";
  }
  if (command === "snooze") current.status = "Snoozed";
  if (command === "dismiss") current.status = "Dismissed";
  if (command === "note") current.resultNotes = prompt("Add a note for this action:") || current.resultNotes || "";
  statuses[action.id] = current;
  const record = { ...action, ...current, updatedAt: new Date().toISOString() };
  const existingIndex = history.findIndex((item) => item.id === action.id);
  if (existingIndex >= 0) history[existingIndex] = record; else history.unshift(record);
  db.actionHistory = history.slice(0, 200);
  localStorage.setItem(ACTION_STATUS_KEY, JSON.stringify(statuses));
  localStorage.setItem(ACTION_HISTORY_KEY, JSON.stringify(db.actionHistory));
  upsertDecisionLogFromAction(record);
  saveData("Action Plan updated");
  renderActionPlan();
}

function ensureActionDecisionLog(actions) {
  actions.slice(0, 8).forEach(upsertDecisionLogFromAction);
}

function upsertDecisionLogFromAction(action) {
  const log = readJson(DECISION_LOG_KEY, []);
  const existing = log.find((item) => item.id === action.id);
  const entry = {
    id: action.id,
    date: action.dateRecommended,
    dateRecommended: action.dateRecommended,
    recommended: action.action,
    action: action.action,
    account: action.account,
    productOrCategory: action.productOrCategory,
    confidence: action.confidence,
    reason: action.reason,
    type: action.category,
    status: action.status || "Open",
    dateCompleted: action.dateCompleted || "",
    result: action.resultNotes || "",
    outcomeSalesNotes: action.resultNotes || ""
  };
  if (existing) Object.assign(existing, entry); else log.push(entry);
  localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(log.slice(-300)));
}

function renderDecisionLog() {
  const log = readJson(DECISION_LOG_KEY, []).slice().reverse();
  content.innerHTML = `
    <section class="decision-hero">
      <div><p class="eyebrow">Decision Log</p><h1>Remember what worked.</h1><p>Every Action Plan recommendation is stored here with confidence, status, result notes, and outcome Signals.</p></div>
      <button class="icon-button" data-page="actionPlan">Open Action Plan</button>
    </section>
    <section class="card"><div class="section-title"><div><h3>Recommendation Memory</h3><p>${number.format(log.length)} saved decisions.</p></div></div>${decisionLogTable(log)}</section>
  `;
  bindInternalButtons();
  document.querySelectorAll("[data-decision-update]").forEach((selectEl) => selectEl.addEventListener("change", (event) => {
    const all = readJson(DECISION_LOG_KEY, []);
    const item = all.find((entry) => entry.id === event.target.dataset.decisionUpdate);
    if (!item) return;
    item.status = event.target.value;
    if (item.status === "Completed" || item.status === "Complete") item.dateCompleted = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(all));
    showMessage("Decision Log updated", "good");
    renderDecisionLog();
  }));
}

function decisionLogTable(log) {
  if (!log.length) return `<p class="empty">No decisions yet. Open Action Plan to generate recommendations.</p>`;
  return `<div class="table-card decision-table"><table><thead><tr><th>Date</th><th>Action</th><th>Account</th><th>Product/category</th><th>Confidence</th><th>Status</th><th>Completed</th><th>Result notes</th></tr></thead><tbody>${log.map((item) => `<tr><td>${item.dateRecommended || item.date || ""}</td><td><strong>${item.action || item.recommended}</strong><span>${item.reason || ""}</span></td><td>${item.account || ""}</td><td>${item.productOrCategory || ""}</td><td>${item.confidence || 0}%</td><td><select data-decision-update="${item.id}">${["Open","Snoozed","Complete","Completed","Dismissed","Skipped"].map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></td><td>${item.dateCompleted || ""}</td><td>${item.outcomeSalesNotes || item.result || ""}</td></tr>`).join("")}</tbody></table></div>`;
}

function actionHistoryTable() {
  const history = readJson(ACTION_HISTORY_KEY, db.actionHistory || []);
  if (!history.length) return `<p class="empty">No completed or snoozed actions yet.</p>`;
  return `<div class="table-card action-history-table"><table><thead><tr><th>Date recommended</th><th>Date completed</th><th>Action</th><th>Account</th><th>Product/category</th><th>Status</th><th>Result notes</th></tr></thead><tbody>${history.slice(0, 12).map((item) => `<tr><td>${item.dateRecommended}</td><td>${item.dateCompleted || ""}</td><td>${item.action}</td><td>${item.account}</td><td>${item.productOrCategory}</td><td>${item.status}</td><td>${item.resultNotes || ""}</td></tr>`).join("")}</tbody></table></div>`;
}

function exportActionPlan(format, actions) {
  const today = new Date().toLocaleDateString();
  const payload = actions.slice(0, 5).map((action) => ({ action: action.action, account: action.account, productOrCategory: action.productOrCategory, confidence: action.confidence, priority: action.priority, reason: action.reason }));
  const body = format === "json"
    ? JSON.stringify({ exportedAt: new Date().toISOString(), actions: payload }, null, 2)
    : [`Northstar Action Plan - ${today}`, "", ...payload.map((item, index) => `${index + 1}. ${item.action}\nAccount: ${item.account}\nProduct/category: ${item.productOrCategory}\nConfidence: ${item.confidence}%\nPriority: ${item.priority}\nReason: ${item.reason}\n`)].join("\n");
  const blob = new Blob([body], { type: format === "json" ? "application/json" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-action-plan-${new Date().toISOString().slice(0, 10)}.${format === "json" ? "json" : "txt"}`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderNotes() {
  const lessons = filteredKnowledgeLessons();
  const accountsForFilter = ["All", ...unique((db.notes.lessons || []).map((lesson) => lesson.account).filter(Boolean))];
  content.innerHTML = `
    <section class="knowledge-hero">
      <div><p class="eyebrow">Knowledge Vault</p><h1>Preserve what Northstar learns.</h1><p>Search, filter, edit, and reuse lessons from captures, imports, actions, and videos.</p></div>
      <button class="icon-button" id="addKnowledgeLesson">Add Lesson</button>
    </section>
    <section class="card knowledge-controls">
      <input id="knowledgeSearch" type="search" placeholder="Search lessons, products, categories, tags..." value="${escapeAttr(knowledgeSearch)}">
      ${select("knowledgeFilter", accountsForFilter, knowledgeFilter)}
    </section>
    <div class="grid two">
      ${listCard("Northstar Principles", northstarPrinciples(), "good")}
      ${listCard("Business Rules", db.notes.businessRules || [], "hot")}
    </div>
    <section class="card lesson-vault">
      <div class="section-title"><div><h3>Saved Lessons</h3><p>${number.format(lessons.length)} lessons in the vault.</p></div></div>
      <div class="knowledge-grid">${lessons.length ? lessons.map(knowledgeLessonCard).join("") : `<p class="empty">No lessons match this search.</p>`}</div>
    </section>
  `;
  document.querySelector("#knowledgeSearch")?.addEventListener("input", (event) => { knowledgeSearch = event.target.value; renderNotes(); });
  document.querySelector("#knowledgeFilter")?.addEventListener("change", (event) => { knowledgeFilter = event.target.value; renderNotes(); });
  document.querySelector("#addKnowledgeLesson")?.addEventListener("click", addKnowledgeLesson);
  document.querySelectorAll("[data-edit-lesson]").forEach((button) => button.addEventListener("click", () => editKnowledgeLesson(button.dataset.editLesson)));
}

function filteredKnowledgeLessons() {
  const search = knowledgeSearch.toLowerCase().trim();
  return (db.notes.lessons || []).filter((lesson) => {
    const haystack = [lesson.title, lesson.account, lesson.product, lesson.subject, lesson.category, lesson.lesson, (lesson.tags || []).join(" "), lesson.relatedAction, lesson.relatedVideo].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) && (knowledgeFilter === "All" || lesson.account === knowledgeFilter);
  }).slice().reverse();
}

function knowledgeLessonCard(lesson) {
  return `<article class="knowledge-card"><div><span class="badge good">${lesson.confidence || 80}% confidence</span><h3>${lesson.title || lesson.subject || "Lesson learned"}</h3><p>${lesson.lesson || ""}</p></div><div class="product-meta"><span>${lesson.account || "All accounts"}</span><span>${lesson.product || lesson.subject || "General"}</span><span>${lesson.category || ""}</span></div><small>${lesson.dateAdded || (lesson.capturedAt ? new Date(lesson.capturedAt).toLocaleDateString() : "")} · ${(lesson.tags || []).join(", ")}</small><button class="chart-detail-link" data-edit-lesson="${lesson.id}">Edit</button></article>`;
}

function addKnowledgeLesson() {
  const title = prompt("Lesson title:");
  if (!title) return;
  const lesson = prompt("Lesson:");
  if (!lesson) return;
  db.notes.lessons = db.notes.lessons || [];
  db.notes.lessons.push({ id: uniqueImportId(`lesson-${Date.now()}`), title, lesson, account: "Northstar", product: "", category: "", tags: ["manual"], confidence: 80, dateAdded: new Date().toISOString().slice(0, 10), relatedAction: "", relatedVideo: "" });
  saveData("Knowledge Vault lesson saved");
  renderNotes();
}

function editKnowledgeLesson(id) {
  const lesson = (db.notes.lessons || []).find((item) => item.id === id);
  if (!lesson) return;
  const updated = prompt("Edit lesson:", lesson.lesson || "");
  if (updated === null) return;
  lesson.lesson = updated;
  lesson.title = prompt("Edit title:", lesson.title || lesson.subject || "Lesson learned") || lesson.title || lesson.subject || "Lesson learned";
  saveData("Knowledge Vault lesson updated");
  renderNotes();
}

function latestKnowledgeLesson() {
  return (db.notes.lessons || []).slice().reverse().find((lesson) => lesson.lesson || lesson.title);
}

function northstarPrinciples() {
  return [
    "Data becomes direction.",
    "Every page should answer what changed, why it matters, and what to do next.",
    "Sales Signals matter more than vanity metrics.",
    "The Spark is reserved for moments when evidence becomes action.",
    "Creator decisions should be captured, reviewed, remembered, and reused."
  ];
}

function inferAccountForSubject(subject) {
  const match = accounts().find((account) => normalizedName(subject).includes(normalizedName(account.name)));
  return match?.name || "Northstar";
}
function priorityWeight(priority) { return priority === "High" ? 3 : priority === "Medium" ? 2 : 1; }

function renderReports() {
  const months = unique(db.monthlyReports.map((report) => report.month));
  if (!months.includes(selectedReportMonth) && months.length) selectedReportMonth = months[0];
  const reports = db.monthlyReports.filter((report) => report.month === selectedReportMonth);
  content.innerHTML = `<div class="section-title"><div><h3>Briefs</h3><p>Monthly creator business briefs built from saved Signals.</p></div>${select("reportMonth", months, selectedReportMonth)}</div><details class="form-panel"><summary>Add Monthly Brief</summary>${monthlyReportForm()}</details><div class="grid two">${reports.map((report) => `<div class="card scorecard"><h3>${report.account}</h3>${scoreRow("Month", report.month)}${scoreRow("GMV", money.format(report.gmv || 0))}${scoreRow("Commission", money.format(report.commission || 0))}${scoreRow("Units sold", number.format(report.unitsSold || 0))}${scoreRow("Videos posted", report.videosPosted || "Add monthly total")}${scoreRow("Top product", report.topProduct)}${scoreRow("Top category", report.topCategory)}${scoreRow("Biggest win", report.biggestWin)}${scoreRow("Biggest flop", report.biggestFlop)}${scoreRow("Lessons learned", report.lessonsLearned)}${scoreRow("Test next month", report.whatToTestNextMonth)}</div>`).join("")}</div>`;
  document.querySelector("#reportMonth")?.addEventListener("change", (event) => { selectedReportMonth = event.target.value; renderReports(); });
  document.querySelector("#addReportForm").addEventListener("submit", handleAddReport);
}

function renderSettings() {
  const count = captureCount();
  const lastCaptured = localStorage.getItem(LAST_CAPTURED_KEY) || "Never";
  content.innerHTML = `<div class="section-title"><div><h3>Settings</h3><p>Backup, restore, or reset your local Northstar database.</p></div><span class="badge good">Last Saved: ${lastSavedAt}</span></div><div class="grid two"><div class="card settings-card"><h3>Backup & Restore</h3><p>Export a JSON backup before major edits. Import restores the full local workspace into this browser.</p><div class="settings-actions"><button id="exportBackup" class="icon-button">Export Backup</button><label class="import-button"><input id="importBackup" type="file" accept="application/json,.json">Import Backup</label></div></div><div class="card settings-card"><h3>Action Plan</h3><p>Action history: ${readJson(ACTION_HISTORY_KEY, []).length} saved actions.</p><button class="icon-button" data-page="actionPlan">Open Action Plan</button></div><div class="card settings-card"><h3>Fast Capture</h3><p>Capture count: ${count}. Last captured: ${lastCaptured}.</p><button class="icon-button" data-page="fastCapture">Open Fast Capture</button></div><div class="card settings-card"><h3>Bulk Import</h3><p>Import history: ${(db.importHistory || []).length} saved imports.</p><button class="icon-button" data-page="bulkImport">Open Bulk Import</button></div><div class="card settings-card"><h3>Import Review</h3><p>Reviewed imports: ${(db.importReviews || []).filter((review) => review.reviewedAt).length} of ${(db.importReviews || []).length}.</p><button class="icon-button" data-page="importReview">Open Import Review</button></div><div class="card settings-card"><h3>Reset</h3><p>Reset clears localStorage and returns to the default data bundled in data/database.js.</p><button id="resetDefault" class="icon-button danger">Reset to Default Data</button></div></div><div class="card"><h3>Local Storage Status</h3><ul class="list"><li>Products: ${products().length}</li><li>Videos: ${videos().length}</li><li>Action history: ${readJson(ACTION_HISTORY_KEY, []).length}</li><li>Decision Log: ${readJson(DECISION_LOG_KEY, []).length}</li><li>Knowledge lessons: ${(db.notes.lessons || []).length}</li><li>Imports: ${(db.importHistory || []).length}</li><li>Import reviews: ${(db.importReviews || []).length}</li><li>Last Saved: ${lastSavedAt}</li></ul></div>`;
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  document.querySelector("#importBackup").addEventListener("change", importBackup);
  document.querySelector("#resetDefault").addEventListener("click", resetDefaultData);
  bindInternalButtons();
}

function exportBackup() {
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lastSavedAt,
    data: db,
    localMeta: {
      captureCount: captureCount(),
      lastCapturedAt: localStorage.getItem(LAST_CAPTURED_KEY) || "",
      captureLog: readJson(CAPTURE_LOG_KEY, []),
      pulseSnapshots: readJson(PULSE_SNAPSHOTS_KEY, []),
      decisionLog: readJson(DECISION_LOG_KEY, []),
      actionStatuses: readJson(ACTION_STATUS_KEY, {}),
      actionHistory: readJson(ACTION_HISTORY_KEY, []),
      importHistory: db.importHistory || [],
      importReviews: db.importReviews || []
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = mergeDatabase(clone(defaultDb), parsed);
      normalizeDatabase();
      if (parsed.localMeta) {
        localStorage.setItem(CAPTURE_COUNT_KEY, String(parsed.localMeta.captureCount || 0));
        localStorage.setItem(LAST_CAPTURED_KEY, parsed.localMeta.lastCapturedAt || "");
        localStorage.setItem(CAPTURE_LOG_KEY, JSON.stringify(parsed.localMeta.captureLog || []));
        localStorage.setItem(PULSE_SNAPSHOTS_KEY, JSON.stringify(parsed.localMeta.pulseSnapshots || []));
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(parsed.localMeta.decisionLog || []));
        localStorage.setItem(ACTION_STATUS_KEY, JSON.stringify(parsed.localMeta.actionStatuses || {}));
        localStorage.setItem(ACTION_HISTORY_KEY, JSON.stringify(parsed.localMeta.actionHistory || []));
        db.importHistory = parsed.localMeta.importHistory || db.importHistory || [];
        db.importReviews = parsed.localMeta.importReviews || db.importReviews || [];
        db.actionHistory = parsed.localMeta.actionHistory || db.actionHistory || [];
        localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
        localStorage.setItem(IMPORT_REVIEWS_KEY, JSON.stringify(db.importReviews));
      }
      saveData("Backup imported and saved locally");
      renderPage("settings");
    } catch (error) {
      showMessage("Import failed. Choose a valid Northstar JSON backup.", "warn");
    }
  };
  reader.readAsText(file);
}

function resetDefaultData() {
  if (!confirm("Reset Northstar to the default bundled data? This clears local saved changes in this browser.")) return;
  [STORAGE_KEY, SAVED_AT_KEY, CAPTURE_COUNT_KEY, LAST_CAPTURED_KEY, CAPTURE_LOG_KEY, PULSE_SNAPSHOTS_KEY, DECISION_LOG_KEY, ACTION_STATUS_KEY, ACTION_HISTORY_KEY, BULK_IMPORT_HISTORY_KEY, IMPORT_REVIEWS_KEY].forEach((key) => localStorage.removeItem(key));
  db = clone(defaultDb);
  normalizeDatabase();
  lastSavedAt = "Never";
  initializePulseEngine("reset-default");
  updateLastSavedDisplay();
  showMessage("Reset to default data", "warn");
  renderPage("settings");
}

/* Northstar Sprint 7 - The Intelligence Engine™ */
const PRODUCT_SEASONS_KEY = "northstar.v01.productSeasons";

function storedProductSeasons() { return readJson(PRODUCT_SEASONS_KEY, {}); }
function maxProductValue(field) { return Math.max(...products().map((product) => Number(product[field] || 0)), 1); }
function clampScore(value) { return Math.max(0, Math.min(100, Math.round(value))); }

function scoredProducts() {
  return products().slice().sort((a, b) => opportunityScore(b).score - opportunityScore(a).score);
}

function flywheelScore(product) {
  const opportunity = opportunityScore(product);
  return { score: opportunity.score, label: opportunity.label, tierClass: opportunity.tierClass, reason: opportunity.reason };
}

function opportunityScore(product) {
  if (!product) return { score: 0, label: "Retire", tierClass: "retire-score", icon: "⚪", confidence: 0, reason: "No product data yet." };
  const maxUnits = maxProductValue("lifetimeUnits");
  const maxCommission = maxProductValue("lifetimeCommission");
  const maxGmv = maxProductValue("lifetimeGmv");
  const salesVelocity = Math.min(18, Number(product.lifetimeUnits || 0) / maxUnits * 18) + Math.min(7, productRecentMomentum(product) / 20 * 7);
  const commissionPotential = Math.min(18, Number(product.lifetimeCommission || 0) / maxCommission * 18) + (Number(product.commission || 0) > 0 ? 2 : 0);
  const unitsSold = Math.min(15, Number(product.lifetimeUnits || 0) / maxUnits * 15);
  const seasonalFitScore = seasonalFit(product);
  const audienceFitScore = audienceFit(product) * 1.2;
  const momentum = productRecentMomentum(product);
  const confidence = productConfidence(product);
  const total = salesVelocity + commissionPotential + unitsSold + seasonalFitScore + audienceFitScore + momentum + confidence;
  const score = clampScore(total);
  return {
    score,
    confidence: clampScore(confidence * 5 + momentum + audienceFitScore),
    icon: score >= 84 ? "🔥" : score >= 60 ? "🟡" : "⚪",
    ...scoreLabel(score),
    reason: `${Math.round(salesVelocity)} velocity · ${Math.round(commissionPotential)} commission · ${Math.round(unitsSold)} units · ${Math.round(seasonalFitScore)} season · ${Math.round(audienceFitScore)} audience · ${Math.round(momentum)} momentum`
  };
}

function seasonalFit(product) {
  const season = intelligenceSeason(product);
  if (season === "Evergreen") return 12;
  if (season === "Summer") return ["June", "July", "August"].includes(currentMonthName()) ? 12 : 7;
  if (season === "Back to School") return ["July", "August", "September"].includes(currentMonthName()) ? 12 : 6;
  if (season === "Halloween") return ["August", "September", "October"].includes(currentMonthName()) ? 12 : 5;
  if (season === "Holiday") return ["October", "November", "December"].includes(currentMonthName()) ? 12 : 5;
  if (season === "Winter") return ["December", "January", "February"].includes(currentMonthName()) ? 11 : 5;
  if (season === "Spring") return ["March", "April", "May"].includes(currentMonthName()) ? 11 : 5;
  return 7;
}

function productRecentMomentum(product) {
  const snapshots = readJson(PULSE_SNAPSHOTS_KEY, []);
  const latest = snapshots.at(-1);
  const previous = snapshots.length > 1 ? snapshots.at(-2) : null;
  if (latest && previous) {
    const now = latest.products?.find((item) => item.id === product.id);
    const before = previous.products?.find((item) => item.id === product.id);
    if (now && before) {
      const unitDelta = Number(now.units || 0) - Number(before.units || 0);
      const gmvDelta = Number(now.gmv || 0) - Number(before.gmv || 0);
      if (unitDelta > 0 || gmvDelta > 0) return 10;
      if (unitDelta < 0 || gmvDelta < 0) return 2;
    }
  }
  const related = productVideos(product.id);
  const recentSales = related.reduce((sum, video) => sum + Number(video.sales || 0), 0);
  if (recentSales > 4) return 10;
  if (recentSales > 0 || Number(product.lifetimeUnits || 0) > 0) return 7;
  return 2;
}

function productConfidence(product) {
  let score = 3;
  if (product.name && product.account && product.categoryGroup) score += 2;
  if (Number(product.lifetimeUnits || 0) > 0) score += 2;
  if (Number(product.lifetimeCommission || 0) > 0) score += 1.5;
  if (productVideos(product.id).length) score += 1.5;
  return Math.min(10, score);
}

function intelligenceSeason(product) {
  const stored = storedProductSeasons();
  if (stored[product.id]) return stored[product.id];
  const text = `${product.name || ""} ${product.category || ""} ${product.categoryGroup || ""} ${product.seasonality || ""} ${product.evergreenSeasonal || ""}`.toLowerCase();
  if (/evergreen|all year|year round/.test(text)) return "Evergreen";
  if (/school|teacher|college|student/.test(text)) return "Back to School";
  if (/halloween|pumpkin|spooky/.test(text)) return "Halloween";
  if (/christmas|holiday|gift|ornament|thanksgiving/.test(text)) return "Holiday";
  if (/winter|snow|cold|immune/.test(text)) return "Winter";
  if (/spring|garden|seed|plant/.test(text)) return "Spring";
  if (/summer|pool|patriotic|july|outdoor|water/.test(text)) return "Summer";
  return product.evergreenSeasonal === "Evergreen" ? "Evergreen" : "Seasonal";
}

function seasonIntelligence(product) {
  const season = intelligenceSeason(product);
  if (season === "Evergreen") return "Evergreen";
  const month = currentMonthName();
  if (season === "Summer" && ["July", "August"].includes(month)) return "Ending Soon";
  if (season === "Back to School" && ["July", "August"].includes(month)) return "Coming Soon";
  if (season === "Halloween" && ["August", "September", "October"].includes(month)) return "Coming Soon";
  if (season === "Holiday" && ["October", "November", "December"].includes(month)) return "Coming Soon";
  return season;
}

function currentMonthName() {
  const current = db.seasons?.currentMonth || new Date().toLocaleString("en-US", { month: "long" });
  return String(current).split(" ")[0];
}

function setProductSeason(productId, season) {
  const stored = storedProductSeasons();
  stored[productId] = season;
  localStorage.setItem(PRODUCT_SEASONS_KEY, JSON.stringify(stored));
  saveData("Product season saved");
}

function productLifecycle(product) {
  const opportunity = opportunityScore(product);
  const momentum = productRecentMomentum(product);
  const timing = seasonIntelligence(product);
  if (product.status === "Retire" || opportunity.score < 35) return { stage: "Retired", icon: "🪦", className: "retired", reason: "Low opportunity or retired status." };
  if (timing === "Ending Soon" || (momentum <= 3 && opportunity.score < 65)) return { stage: "Slowing", icon: "🍂", className: "slowing", reason: "Momentum or timing is cooling." };
  if (opportunity.score >= 88 && Number(product.lifetimeUnits || 0) >= Math.max(2, maxProductValue("lifetimeUnits") * 0.5)) return { stage: "Peak", icon: "⭐", className: "peak", reason: "High opportunity with proven sales." };
  if (opportunity.score >= 68 || momentum >= 8) return { stage: "Growing", icon: "🚀", className: "growing", reason: "Positive momentum and useful Signals." };
  return { stage: "Emerging", icon: "🌱", className: "emerging", reason: "Early product with incomplete proof." };
}

function opportunityPill(product) {
  const opportunity = opportunityScore(product);
  const className = opportunity.score >= 84 ? "opportunity-hot" : opportunity.score >= 60 ? "opportunity-mid" : "opportunity-low";
  return `<span class="opportunity-pill ${className}">${opportunity.icon} ${opportunity.score} Opportunity</span>`;
}

function lifecycleBadge(product) {
  const lifecycle = productLifecycle(product);
  return `<span class="lifecycle-badge ${lifecycle.className}">${lifecycle.icon} ${lifecycle.stage}</span>`;
}

function doubleDownProducts() {
  return scoredProducts().filter((product) => {
    const opportunity = opportunityScore(product);
    return opportunity.score >= 74 && opportunity.confidence >= 55 && productRecentMomentum(product) >= 7 && Number(product.lifetimeUnits || 0) > 0;
  }).slice(0, 8).map((product) => ({ product, reason: `${product.name} is outperforming your account average with ${opportunityScore(product).score} Opportunity and positive momentum.` }));
}

function categoryIntelligence() {
  const map = new Map();
  products().forEach((product) => {
    const category = product.categoryGroup || "Uncategorized";
    const row = map.get(category) || { category, products: [], totalOpportunity: 0 };
    row.products.push(product);
    row.totalOpportunity += opportunityScore(product).score;
    map.set(category, row);
  });
  return [...map.values()].map((row) => {
    const sorted = row.products.slice().sort((a, b) => opportunityScore(b).score - opportunityScore(a).score);
    const highestCommission = row.products.slice().sort((a, b) => Number(b.lifetimeCommission || 0) - Number(a.lifetimeCommission || 0))[0];
    const needsAttention = row.products.slice().sort((a, b) => opportunityScore(a).score - opportunityScore(b).score)[0];
    return {
      category: row.category,
      products: row.products.length,
      averageOpportunity: Math.round(row.totalOpportunity / Math.max(row.products.length, 1)),
      fastestGrowing: sorted[0],
      highestCommission,
      needsAttention,
      gmv: row.products.reduce((sum, product) => sum + Number(product.lifetimeGmv || 0), 0),
      commission: row.products.reduce((sum, product) => sum + Number(product.lifetimeCommission || 0), 0),
      units: row.products.reduce((sum, product) => sum + Number(product.lifetimeUnits || 0), 0)
    };
  }).sort((a, b) => b.averageOpportunity - a.averageOpportunity);
}

function categoryRankings() {
  return categoryIntelligence().map((row) => ({
    category: row.category,
    gmv: row.gmv,
    commission: row.commission,
    units: row.units,
    products: row.products,
    averageOpportunity: row.averageOpportunity
  }));
}

function accountComparison() {
  return accounts().map((account) => {
    const list = accountProducts(account.id);
    const sorted = list.slice().sort((a, b) => opportunityScore(b).score - opportunityScore(a).score);
    const growth = sorted.slice().sort((a, b) => productRecentMomentum(b) - productRecentMomentum(a))[0];
    const seasonalCount = list.filter((product) => intelligenceSeason(product) !== "Evergreen").length;
    const commissionAvg = list.reduce((sum, product) => sum + Number(product.lifetimeCommission || 0), 0) / Math.max(list.length, 1);
    const units = list.reduce((sum, product) => sum + Number(product.lifetimeUnits || 0), 0);
    const avgOpportunity = Math.round(list.reduce((sum, product) => sum + opportunityScore(product).score, 0) / Math.max(list.length, 1));
    return { account, bestOpportunity: sorted[0], fastestGrowth: growth, averageCommission: commissionAvg, units, seasonalCount, audienceMatch: avgOpportunity };
  });
}

function weeklyIntelligenceBrief() {
  const ranked = scoredProducts();
  const categories = categoryIntelligence();
  const doubleDown = doubleDownProducts();
  const slowing = ranked.filter((product) => productLifecycle(product).stage === "Slowing").slice(0, 3);
  const retire = ranked.filter((product) => productLifecycle(product).stage === "Retired" || opportunityScore(product).score < 40).slice(0, 3);
  const top = ranked[0];
  const lesson = latestKnowledgeLesson();
  return {
    improved: doubleDown.slice(0, 3).map((item) => item.product.name),
    slowed: slowing.map((product) => product.name),
    topOpportunity: top ? `${top.name} (${opportunityScore(top).score} Opportunity)` : "Add product data to generate this.",
    film: doubleDown.slice(0, 4).map((item) => item.product.name),
    request: requestOpportunities().slice(0, 4).map((item) => item.title),
    retire: retire.map((product) => product.name),
    biggestWin: categories[0] ? `${categories[0].category} leads with ${categories[0].averageOpportunity} average Opportunity.` : "No category winner yet.",
    biggestLesson: lesson?.lesson || lesson?.title || "Keep capturing sales outcomes so Northstar can learn."
  };
}

function intelligenceBanner() {
  const category = categoryIntelligence()[0];
  const top = scoredProducts()[0];
  const commissions = products().reduce((sum, product) => sum + Number(product.lifetimeCommission || 0), 0);
  if (category && commissions > 0 && category.commission / commissions >= 0.55) return `✨ ${category.category} products generated ${Math.round(category.commission / commissions * 100)}% of current commissions.`;
  if (top && opportunityScore(top).score >= 84) return `✨ ${top.name} is the strongest current opportunity at ${opportunityScore(top).score}.`;
  const slowing = products().find((product) => productLifecycle(product).stage === "Slowing");
  if (slowing) return `✨ ${slowing.categoryGroup || slowing.name} is beginning to slow; decide whether to re-film or replace.`;
  return "✨ Northstar is watching for the strongest new Signal.";
}

function decisionQuality(entry) {
  const completed = ["Complete", "Completed"].includes(entry.status);
  if (!completed) return { label: "Pending", className: "quality-pending", reason: "Complete this action to score decision quality." };
  const text = `${entry.result || ""} ${entry.resultNotes || ""} ${entry.outcomeSalesNotes || ""}`.toLowerCase();
  const confidence = Number(entry.confidence || 0);
  if (/sale|sold|gmv|commission|win|worked|increase|growth|completed/.test(text) && confidence >= 75) return { label: "Excellent Decision", className: "quality-excellent", reason: "High confidence and positive outcome notes." };
  if (/sale|sold|worked|complete|posted|filmed/.test(text) || confidence >= 65) return { label: "Good Decision", className: "quality-good", reason: "Useful outcome or solid confidence." };
  if (/no sale|flat|unclear|watch/.test(text)) return { label: "Neutral", className: "quality-neutral", reason: "Outcome is mixed or still unclear." };
  return { label: "Poor Decision", className: "quality-poor", reason: "Low confidence or weak outcome." };
}

function renderExecutive() {
  const brief = weeklyIntelligenceBrief();
  const top = scoredProducts()[0];
  const topThree = executiveTopThree();
  content.innerHTML = `
    <section class="executive-brief-hero">
      <div class="executive-brand-lockup">
        <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
        <div>
          <h1>NORTHSTAR</h1>
          <h2>Data becomes direction.</h2>
          <p>One place to guide every creator decision.</p>
          <span class="feature-kicker">Morning Brief</span>
        </div>
      </div>
      <div class="executive-greeting">
        <span>${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
        <strong>${greetingForNow()}, Jennifer.</strong>
        <button class="update-northstar-button" id="updateNorthstarButton" type="button">Update Northstar</button>
      </div>
    </section>

    <section class="today-spark-card">
      <span>Today's Spark</span>
      <p>${todaySpark()}</p>
    </section>

    <section class="top-three-section">
      <div class="section-title"><div><h3>Today's Top Three</h3><p>What matters, why it matters, and what to do next.</p></div></div>
      <div class="top-three-grid">${topThree.map(topThreeCard).join("")}</div>
      <div class="scroll-cue">Scroll for Intelligence ↓</div>
    </section>

    <div class="below-fold-intelligence">
    <section class="card weekly-brief-card">
      <div class="section-title"><div><h3>Weekly Intelligence Brief</h3><p>A creator newsletter generated from your current local data.</p></div><button class="chart-detail-link" data-page="actionPlan">Open Action Plan</button></div>
      <div class="weekly-brief-grid">
        ${briefSection("What Improved", brief.improved)}
        ${briefSection("What Slowed", brief.slowed)}
        ${briefSection("Top Opportunity", [brief.topOpportunity])}
        ${briefSection("Products to Film", brief.film)}
        ${briefSection("Products to Request", brief.request)}
        ${briefSection("Products to Retire", brief.retire)}
        ${briefSection("Biggest Win", [brief.biggestWin])}
        ${briefSection("Biggest Lesson", [brief.biggestLesson])}
      </div>
    </section>
    <div class="grid two">
      <section class="card product-spotlight intelligence-spotlight">
        <div class="section-title"><div><h3>Top Opportunity</h3><p>Highest priority product right now.</p></div>${top ? opportunityPill(top) : ""}</div>
        ${top ? `<h2>${top.name}</h2><div class="product-meta">${lifecycleBadge(top)}<span class="badge">${intelligenceSeason(top)}</span><span class="badge">${top.account}</span></div><p>${doubleDownReason(top)}</p><button class="chart-detail-link" data-product-id="${top.id}">Open product detail</button>` : `<p class="empty">Add product data to generate an opportunity.</p>`}
      </section>
      <section class="card double-down-panel">
        <div class="section-title"><div><h3>Double Down Engine</h3><p>Products outperforming account averages.</p></div></div>
        <div class="brief-list">${doubleDownProducts().slice(0, 4).map((item) => `<article><strong>✨ ${item.product.name}</strong><span>${item.reason}</span></article>`).join("") || `<p class="empty">No double-down Signal yet.</p>`}</div>
      </section>
    </div>
    <div class="grid two">
      <section class="card"><div class="section-title"><div><h3>Category Intelligence</h3><p>Average opportunity and category leaders.</p></div></div>${categoryIntelligenceTable(categoryIntelligence())}</section>
      <section class="card"><div class="section-title"><div><h3>Account Comparison</h3><p>Raised Right and Truth Tuned Tribe, side by side.</p></div></div><div class="account-comparison-grid">${accountComparison().map(accountComparisonCard).join("")}</div></section>
    </div>
    <div class="grid two">
      <section class="card"><div class="section-title"><div><h3>Decision Log</h3><p>Recent actions Northstar is learning from.</p></div><button class="chart-detail-link" data-page="decisionLog">Open Decision Log</button></div>${decisionLogPreview()}</section>
      <section class="card"><div class="section-title"><div><h3>Knowledge Vault</h3><p>Reusable lessons for today’s direction.</p></div><button class="chart-detail-link" data-page="notes">Open Knowledge Vault</button></div>${knowledgeVaultPreview()}</section>
    </div>
    <div class="grid two">
      <section class="card"><div class="section-title"><div><h3>Product Movement</h3><p>Where opportunity is building or cooling.</p></div><button class="chart-detail-link" data-page="products">Open Products</button></div>${productMovementPreview()}</section>
      <section class="card"><div class="section-title"><div><h3>Import Review</h3><p>Latest capture or import trust check.</p></div><button class="chart-detail-link" data-page="importReview">Open Import Review</button></div>${importReviewPreview()}</section>
    </div>
    <section class="card future-panel"><h3>Future AI Assistant</h3><p>Coming in Version 5. The Intelligence Engine is structured so future platform sources can feed the same Signals.</p></section>
    </div>
  `;
  bindInternalButtons();
  document.querySelector("#updateNorthstarButton")?.addEventListener("click", openUpdateCenter);
  document.querySelectorAll("[data-product-id]").forEach((button) => button.addEventListener("click", () => openProduct(button.dataset.productId)));
}

function todaySpark() {
  const category = categoryIntelligence()[0];
  const top = scoredProducts()[0];
  const slowing = products().find((product) => productLifecycle(product).stage === "Slowing");
  if (category && category.averageOpportunity >= 65) return `${category.category} products remain your strongest opportunity. Momentum is still building.`;
  if (top && opportunityScore(top).score >= 70) return `${top.name} is the clearest Signal today with ${opportunityScore(top).score} Opportunity.`;
  if (slowing) return `${slowing.name} is cooling. Northstar suggests watching before investing more effort.`;
  return "No major Spark detected yet. Northstar is watching your signals.";
}

function executiveTopThree() {
  const actions = buildActionPlan();
  const film = actions.find((action) => action.category === "Film") || actions[0];
  const request = actions.find((action) => action.category === "Request");
  const watch = actions.find((action) => action.category === "Watch") || actions.find((action) => action.category === "Retire");
  return [
    normalizeTopThreeAction("Film", film, "Film the strongest current product.", "Highest Opportunity Score today."),
    normalizeTopThreeAction("Request", request, "Request the next seasonal product.", "Seasonal window is opening."),
    normalizeTopThreeAction("Watch", watch, "Watch the product that needs more proof.", "Momentum is rising, but more data is needed.")
  ];
}

function normalizeTopThreeAction(type, action, fallbackSubject, fallbackReason) {
  return {
    type,
    subject: action?.productOrCategory || fallbackSubject,
    confidence: action?.confidence || (type === "Request" ? 74 : 68),
    reason: action?.reason || fallbackReason,
    impact: estimatedImpactForAction(type, action)
  };
}

function topThreeCard(item) {
  return `<article class="top-three-card ${item.type.toLowerCase()}"><span>${item.type}</span><h3>${item.subject}</h3><div class="top-three-meta"><strong>Confidence ${item.confidence}%</strong><small>${item.impact}</small></div><p>${item.reason}</p><button class="chart-detail-link" data-page="actionPlan">Open Action Plan</button></article>`;
}

function estimatedImpactForAction(type, action) {
  if (action?.productId) {
    const product = getProduct(action.productId);
    if (product) {
      const score = opportunityScore(product).score;
      if (score >= 84) return "Estimated impact: High";
      if (score >= 60) return "Estimated impact: Medium";
    }
  }
  if (type === "Request") return "Estimated impact: Future pipeline";
  if (type === "Watch") return "Estimated impact: Risk control";
  return "Estimated impact: Medium";
}

function decisionLogPreview() {
  const log = readJson(DECISION_LOG_KEY, []).slice(-3).reverse();
  if (!log.length) return `<p class="empty">No decisions logged yet. Open Action Plan to create direction Northstar can remember.</p>`;
  return `<div class="brief-list">${log.map((entry) => `<article><strong>${entry.action || entry.recommended}</strong><span>${entry.status || "Open"} · ${entry.confidence || 0}% confidence</span></article>`).join("")}</div>`;
}

function knowledgeVaultPreview() {
  const lessons = (db.notes.lessons || []).slice(-3).reverse();
  const fallback = (db.notes.businessRules || []).slice(0, 3).map((lesson) => ({ title: "Northstar Principle", lesson }));
  const list = lessons.length ? lessons : fallback;
  return `<div class="brief-list">${list.map((lesson) => `<article><strong>${lesson.title || lesson.subject || "Lesson"}</strong><span>${lesson.lesson || lesson}</span></article>`).join("")}</div>`;
}

function productMovementPreview() {
  const movers = scoredProducts().slice(0, 4);
  if (!movers.length) return `<p class="empty">Add products to see movement Signals.</p>`;
  return `<div class="brief-list">${movers.map((product) => `<article><strong>${product.name}</strong><span>${opportunityPill(product)} ${lifecycleBadge(product)}</span></article>`).join("")}</div>`;
}

function importReviewPreview() {
  const latest = (db.importReviews || []).at(-1);
  if (!latest) return `<p class="empty">No import review yet. Bulk Import and Import Review will appear here after captured data is checked.</p>`;
  return `<div class="brief-list"><article><strong>${latest.fileName || "Latest import"}</strong><span>${latest.status || "Needs Review"} · ${latest.rowsImported || 0} rows imported</span></article></div>`;
}

function briefSection(title, items) {
  const list = (items || []).filter(Boolean);
  return `<article class="brief-section"><h4>${title}</h4>${list.length ? `<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p>No major Signal yet.</p>`}</article>`;
}

function renderProductsDatabase() {
  const filtered = filteredProducts().sort((a, b) => opportunityScore(b).score - opportunityScore(a).score);
  content.innerHTML = `
    <div class="section-title"><div><h3>Products</h3><p>Sorted automatically by Opportunity Score.</p></div><span class="badge">${filtered.length} records</span></div>
    <details class="form-panel"><summary>Add Product</summary>${productForm()}</details>
    <div class="filter-bar">
      <input id="productSearch" type="search" placeholder="Search products, notes, hooks..." value="${escapeAttr(productFilters.search)}">
      ${select("productAccount", ["All", ...accounts().map((a) => a.name)], productFilters.account)}
      ${select("productCategory", ["All", ...unique(products().map((p) => p.categoryGroup))], productFilters.category)}
      ${select("productSeasonality", ["All", "Evergreen", "Seasonal"], productFilters.seasonality)}
      ${select("productStatus", ["All", "Double Down", "Watch", "Wait", "Retire"], productFilters.status)}
    </div>
    <div class="table-card database-table"><table>
      <thead><tr><th>Opportunity</th><th>Lifecycle</th><th>Product</th><th>Account</th><th>Category</th><th>Season</th><th>GMV</th><th>Commission</th><th>Units</th><th>Status</th></tr></thead>
      <tbody>${filtered.map(productIntelligenceRow).join("")}</tbody>
    </table></div>
  `;
  bindProductFilters();
  document.querySelector("#addProductForm").addEventListener("submit", handleAddProduct);
  document.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", () => openProduct(row.dataset.productId)));
}

function productIntelligenceRow(product) {
  const opportunity = opportunityScore(product);
  return `<tr class="click-row" data-product-id="${product.id}"><td>${opportunityPill(product)}<span>${opportunity.label}</span></td><td>${lifecycleBadge(product)}</td><td><strong>${product.name}</strong><span>${doubleDownReason(product)}</span></td><td>${product.account}</td><td>${product.categoryGroup}</td><td>${intelligenceSeason(product)}</td><td>${money.format(product.lifetimeGmv || 0)}</td><td>${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td><span class="badge ${statusClass(product.status)}">${product.status}</span></td></tr>`;
}

function productRows(list) { return list.sort((a, b) => opportunityScore(b).score - opportunityScore(a).score).map(productIntelligenceRow).join(""); }

function productCard(product) {
  return `<article class="product-card" data-card-product="${product.id}"><div class="product-card-top"><h4>${product.name}</h4>${opportunityPill(product)}</div><div class="product-meta"><span class="badge">${product.account}</span>${lifecycleBadge(product)}<span class="badge">${intelligenceSeason(product)}</span></div><div class="mini-stats"><div class="mini-stat"><span>GMV</span><strong>${money.format(product.lifetimeGmv || 0)}</strong></div><div class="mini-stat"><span>Commission</span><strong>${money.format(product.lifetimeCommission || 0)}</strong></div><div class="mini-stat"><span>Units</span><strong>${number.format(product.lifetimeUnits || 0)}</strong></div></div><p class="placeholder">${productNextMove(product)}</p></article>`;
}

function renderRecommendations() {
  const groups = recommendationGroups();
  content.innerHTML = `
    <div class="section-title"><div><h3>Opportunity Center</h3><p>Products grouped by Opportunity Score, lifecycle, timing, and confidence.</p></div><span class="badge good">Intelligence Engine</span></div>
    <div class="recommendation-grid">
      ${Object.entries(groups).map(([name, list]) => `<section class="recommendation-column"><h3>${name}</h3>${list.map(recommendationCard).join("") || `<p class="empty">No products in this lane.</p>`}</section>`).join("")}
    </div>
    <div class="grid two">
      <section class="card"><div class="section-title"><div><h3>Category Intelligence</h3><p>Automatic category summaries.</p></div></div>${categoryIntelligenceTable(categoryIntelligence())}</section>
      <section class="card"><div class="section-title"><div><h3>Account Comparison</h3><p>Which workspace is showing the strongest Signals?</p></div></div><div class="account-comparison-grid">${accountComparison().map(accountComparisonCard).join("")}</div></section>
    </div>
  `;
  bindInternalButtons();
}

function recommendationGroups() {
  return scoredProducts().reduce((groups, product) => {
    const score = opportunityScore(product).score;
    const lifecycle = productLifecycle(product).stage;
    const lane = score >= 78 && lifecycle !== "Slowing" ? "DOUBLE DOWN" : score >= 60 ? "WATCH" : score >= 40 ? "WAIT" : "RETIRE";
    groups[lane].push(product);
    return groups;
  }, { "DOUBLE DOWN": [], WATCH: [], WAIT: [], RETIRE: [] });
}

function recommendationCard(product) {
  return `<article class="recommendation-card" data-card-product="${product.id}"><div><span>${opportunityPill(product)}</span><strong>${product.name}</strong></div><p>${doubleDownReason(product)}</p><div class="product-meta">${lifecycleBadge(product)}<span class="badge">${intelligenceSeason(product)}</span></div></article>`;
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const opportunity = opportunityScore(product);
  const lifecycle = productLifecycle(product);
  const timeline = productTimeline(product);
  const relatedVideos = productVideos(product.id);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).sort((a, b) => opportunityScore(b).score - opportunityScore(a).score).slice(0, 6);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back to Products</button>
    <div class="detail-header intelligence-detail">
      <div><span class="badge ${statusClass(product.status)}">${product.status}</span><h3>${product.name}</h3><p>${product.account} · ${product.category} · ${intelligenceSeason(product)}</p></div>
      <div class="score-badge ${opportunity.tierClass}"><strong>${opportunity.score}</strong><span>Opportunity</span></div>
      <div class="detail-actions">
        <button class="icon-button" id="addNoteButton">Add Note</button>
        <button class="icon-button" id="addVideoButton">Add Video</button>
        ${["Double Down", "Watch", "Wait", "Retire"].map((status) => `<button class="icon-button ${status === "Retire" ? "danger" : ""}" data-status="${status}">Mark as ${status}</button>`).join("")}
      </div>
    </div>
    <section class="card product-intelligence-card">
      <div class="section-title"><div><h3>Product Intelligence</h3><p>${opportunity.reason}</p></div>${opportunityPill(product)}</div>
      <div class="grid four">
        ${metric("Lifecycle", `${lifecycle.icon} ${lifecycle.stage}`, lifecycle.reason, "")}
        ${metric("Season", intelligenceSeason(product), "Manual edits save locally.", "")}
        ${metric("Confidence", `${opportunity.confidence}%`, "Completeness, sales proof, and momentum.", "")}
        ${metric("Double Down", opportunity.score >= 78 ? "Yes" : "Not yet", doubleDownReason(product), "")}
      </div>
      <label class="season-editor">Manual season ${select("productSeasonSelect", ["Spring", "Summer", "Back to School", "Halloween", "Holiday", "Winter", "Evergreen", "Seasonal"], intelligenceSeason(product))}</label>
    </section>
    <div class="grid four">
      ${metric("Lifetime GMV", money.format(product.lifetimeGmv || 0), "Revenue signal", "")}
      ${metric("Commission", money.format(product.lifetimeCommission || 0), "Profit signal", "")}
      ${metric("Units", number.format(product.lifetimeUnits || 0), "Demand signal", "")}
      ${metric("Recent Momentum", productRecentMomentum(product), "Snapshot or recent sales movement", "")}
    </div>
    <div class="grid two">
      <section class="card"><h3>Product Timeline</h3><div class="timeline">${timeline.map((item) => `<div class="timeline-item ${item.done ? "done" : ""}"><span></span><div><strong>${item.label}</strong><p>${item.value}</p></div></div>`).join("")}</div></section>
      <section class="card"><h3>Decision Notes</h3><div class="field-list"><p><strong>Best hook:</strong> ${product.bestHook || "Add after testing."}</p><p><strong>Best CTA:</strong> ${product.bestCta || "Add after testing."}</p><p><strong>Next move:</strong> ${productNextMove(product)}</p><p><strong>Notes:</strong> ${formatNotes(product.notes)}</p></div></section>
    </div>
    <div class="grid two">${tableCard("Related Videos", videoRows(relatedVideos))}<div class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></div></div>
  `;
  bindInternalButtons();
  document.querySelector("#productSeasonSelect")?.addEventListener("change", (event) => { setProductSeason(product.id, event.target.value); renderProductDetail(product.id); });
  document.querySelector("#addNoteButton").addEventListener("click", () => {
    const note = prompt("Add a strategy note for this product:");
    if (note) {
      product.notes = [product.notes, `${new Date().toLocaleDateString()}: ${note}`].filter(Boolean).join("\n");
      product.strategyNotes = note;
      saveData(`Note saved for ${product.name}`);
      renderProductDetail(product.id);
    }
  });
  document.querySelector("#addVideoButton").addEventListener("click", () => { videoFilters.product = product.name; renderPage("videos"); });
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    product.status = button.dataset.status;
    saveData(`${product.name} marked as ${product.status}`);
    renderProductDetail(product.id);
  }));
}

function productNextMove(product) {
  const opportunity = opportunityScore(product);
  const lifecycle = productLifecycle(product);
  if (opportunity.score >= 84 && lifecycle.stage !== "Slowing") return `Double down: this product is outperforming your account average.`;
  if (lifecycle.stage === "Slowing") return `Watch timing: refresh the angle or replace with a stronger seasonal product.`;
  if (seasonIntelligence(product) === "Coming Soon") return `Prepare ahead: request, film, or draft hooks before demand peaks.`;
  if (opportunity.score < 40) return `Retire unless a new hook proves demand.`;
  return `Watch: test one more hook before scaling.`;
}

function doubleDownReason(product) {
  const opportunity = opportunityScore(product);
  if (opportunity.score >= 78 && productRecentMomentum(product) >= 7) return "✨ Double Down: this product is outperforming your account average.";
  return productNextMove(product);
}

function categoryIntelligenceTable(rows) {
  if (!rows.length) return `<p class="empty">Add products to generate category intelligence.</p>`;
  return `<div class="table-card intelligence-table"><table><thead><tr><th>Category</th><th>Products</th><th>Avg Opportunity</th><th>Fastest Growing</th><th>Highest Commission</th><th>Needs Attention</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${row.category}</strong></td><td>${row.products}</td><td>${row.averageOpportunity}</td><td>${row.fastestGrowing?.name || ""}</td><td>${row.highestCommission?.name || ""}</td><td>${row.needsAttention?.name || ""}</td></tr>`).join("")}</tbody></table></div>`;
}

function categoryRankingTable(rows) {
  return `<div class="ranking-table"><table><thead><tr><th>Category</th><th>GMV</th><th>Commission</th><th>Units</th><th>Products</th><th>Avg Opportunity</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${row.category}</strong></td><td>${money.format(row.gmv)}</td><td>${money.format(row.commission)}</td><td>${number.format(row.units)}</td><td>${row.products}</td><td>${row.averageOpportunity || ""}</td></tr>`).join("")}</tbody></table></div>`;
}

function accountComparisonCard(row) {
  return `<article class="account-compare-card"><h4>${row.account.name}</h4><div class="compare-metrics"><span>Best Opportunity <strong>${row.bestOpportunity?.name || "Add products"}</strong></span><span>Fastest Growth <strong>${row.fastestGrowth?.name || "No Signal"}</strong></span><span>Avg Commission <strong>${money.format(row.averageCommission || 0)}</strong></span><span>Highest Units <strong>${number.format(row.units || 0)}</strong></span><span>Seasonal Products <strong>${row.seasonalCount}</strong></span><span>Audience Match <strong>${row.audienceMatch}</strong></span></div></article>`;
}

function buildActionPlan() {
  const statuses = readJson(ACTION_STATUS_KEY, {});
  const ranked = scoredProducts();
  if (!ranked.length) return [];
  const actions = [];
  const doubleDown = doubleDownProducts()[0];
  const top = ranked[0];
  const request = requestOpportunities()[0];
  const repost = ranked.find((product) => intelligenceSeason(product) === "Evergreen" && productLifecycle(product).stage !== "Retired") || top;
  const retire = ranked.slice().reverse().find((product) => productLifecycle(product).stage === "Retired" || opportunityScore(product).score < 40);
  const watch = ranked.find((product) => productLifecycle(product).stage === "Slowing" || (opportunityScore(product).score >= 40 && opportunityScore(product).score < 65)) || ranked[2];
  const lesson = latestKnowledgeLesson();
  if (doubleDown?.product) actions.push(makeAction("Film", `Film again: ${shortName(doubleDown.product.name)}`, doubleDown.product, confidenceForAction(doubleDown.product, "Film"), doubleDown.reason, doubleDown.product.name, "High"));
  else if (top) actions.push(makeAction("Film", `Film: ${shortName(top.name)}`, top, confidenceForAction(top, "Film"), productNextMove(top), top.name));
  if (request) actions.push(makeAction("Request", `Request: ${request.title}`, null, confidenceForCategory(request.title), request.note, request.title, "Medium"));
  if (repost) actions.push(makeAction("Repost", `Repost or remake: ${shortName(repost.name)}`, repost, confidenceForAction(repost, "Repost"), `${repost.name} has ${opportunityScore(repost).score} Opportunity and can keep feeding the same audience Signal.`));
  if (retire) actions.push(makeAction("Retire", `Stop testing: ${shortName(retire.name)}`, retire, confidenceForAction(retire, "Retire"), `${retire.name} is in ${productLifecycle(retire).stage} with ${opportunityScore(retire).score} Opportunity. Protect testing energy.`, retire.categoryGroup, "Medium"));
  if (watch) actions.push(makeAction("Watch", `Analyze: ${shortName(watch.name)}`, watch, confidenceForAction(watch, "Watch"), `${watch.name} needs review because its lifecycle is ${productLifecycle(watch).stage}.`, watch.categoryGroup, "Low"));
  if (lesson) actions.push(makeAction("Learn", `Apply lesson: ${shortName(lesson.title || lesson.subject || "recent lesson")}`, null, Number(lesson.confidence || 72), lesson.lesson || lesson.title || "Use the latest captured lesson in today's creative decisions.", lesson.subject || "Knowledge Vault", "Medium", lesson.account));
  return actions
    .map((action) => ({ ...action, ...(statuses[action.id] || {}) }))
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.confidence - a.confidence)
    .slice(0, 18);
}

function confidenceForAction(product, actionType) {
  if (!product) return 50;
  const opportunity = opportunityScore(product);
  let score = opportunity.confidence + (opportunity.score * 0.35);
  if (actionType === "Retire") score = 100 - opportunity.score + 18;
  if (actionType === "Watch") score = Math.max(55, Math.min(78, score));
  return Math.max(35, Math.min(98, score));
}

function actionCard(action) {
  const quality = decisionQuality(action);
  return `<article class="brief-action-card ${action.status.toLowerCase().replace(/\s+/g, "-")}"><div class="action-card-top"><span class="badge ${priorityClass(action.priority)}">${action.priority}</span><strong>${action.confidence}%</strong></div><h3>${action.action}</h3><p>${action.reason}</p><div class="product-meta"><span>${action.account}</span><span>${action.productOrCategory}</span><span>${action.category}</span></div><span class="quality-badge ${quality.className}">${quality.label}</span><div class="action-controls"><button data-action-command="complete" data-action-id="${action.id}">Mark Complete</button><button data-action-command="snooze" data-action-id="${action.id}">Snooze</button><button data-action-command="dismiss" data-action-id="${action.id}">Dismiss</button><button data-action-command="note" data-action-id="${action.id}">Add Note</button></div></article>`;
}

function decisionLogTable(log) {
  if (!log.length) return `<p class="empty">No decisions yet. Open Action Plan to generate recommendations.</p>`;
  return `<div class="table-card decision-table"><table><thead><tr><th>Date</th><th>Action</th><th>Account</th><th>Product/category</th><th>Confidence</th><th>Status</th><th>Decision Quality</th><th>Completed</th><th>Result notes</th></tr></thead><tbody>${log.map((item) => { const quality = decisionQuality(item); return `<tr><td>${item.dateRecommended || item.date || ""}</td><td><strong>${item.action || item.recommended}</strong><span>${item.reason || ""}</span></td><td>${item.account || ""}</td><td>${item.productOrCategory || ""}</td><td>${item.confidence || 0}%</td><td><select data-decision-update="${item.id}">${["Open","Snoozed","Complete","Completed","Dismissed","Skipped"].map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></td><td><span class="quality-badge ${quality.className}">${quality.label}</span></td><td>${item.dateCompleted || ""}</td><td>${item.outcomeSalesNotes || item.result || ""}</td></tr>`; }).join("")}</tbody></table></div>`;
}

function renderVault() {
  const all = scoredProducts();
  const topCommission = products().slice().sort((a, b) => (b.lifetimeCommission || 0) - (a.lifetimeCommission || 0)).slice(0, 6);
  const topGmv = products().slice().sort((a, b) => (b.lifetimeGmv || 0) - (a.lifetimeGmv || 0)).slice(0, 6);
  const topUnits = products().slice().sort((a, b) => (b.lifetimeUnits || 0) - (a.lifetimeUnits || 0)).slice(0, 6);
  const topHooks = videos().slice().sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 6);
  content.innerHTML = `
    <div class="section-title"><div><h3>Hall of Fame</h3><p>All-time winners through the Intelligence Engine.</p></div></div>
    <div class="grid two">
      <section class="card"><h3>All Time Winners</h3><div class="score-list">${all.slice(0, 6).map((product) => `<div class="score-row" data-card-product="${product.id}"><strong>${product.name}</strong><span>${opportunityPill(product)} ${lifecycleBadge(product)}</span></div>`).join("")}</div></section>
      <section class="card"><h3>Top Categories</h3>${categoryRankingTable(categoryRankings().slice(0, 6))}</section>
      <section class="card"><h3>Top Commission</h3><div class="score-list">${topCommission.map(simpleWinnerRow).join("")}</div></section>
      <section class="card"><h3>Top GMV</h3><div class="score-list">${topGmv.map(simpleWinnerRow).join("")}</div></section>
      <section class="card"><h3>Top Units</h3><div class="score-list">${topUnits.map(simpleWinnerRow).join("")}</div></section>
      <section class="card"><h3>Top Hooks</h3><div class="score-list">${topHooks.map(hookWinnerRow).join("")}</div></section>
    </div>
  `;
  bindInternalButtons();
}

function renderSettings() {
  const count = captureCount();
  const lastCaptured = localStorage.getItem(LAST_CAPTURED_KEY) || "Never";
  const seasonOverrideCount = Object.keys(storedProductSeasons()).length;
  content.innerHTML = `<div class="section-title"><div><h3>Settings</h3><p>Backup, restore, or reset your local Northstar database.</p></div><span class="badge good">Last Saved: ${lastSavedAt}</span></div><div class="grid two"><div class="card settings-card"><h3>Backup & Restore</h3><p>Export a JSON backup before major edits. Import restores the full local workspace into this browser, including Intelligence Engine season overrides.</p><div class="settings-actions"><button id="exportBackup" class="icon-button">Export Backup</button><label class="import-button"><input id="importBackup" type="file" accept="application/json,.json">Import Backup</label></div></div><div class="card settings-card"><h3>Action Plan</h3><p>Action history: ${readJson(ACTION_HISTORY_KEY, []).length} saved actions.</p><button class="icon-button" data-page="actionPlan">Open Action Plan</button></div><div class="card settings-card"><h3>Fast Capture</h3><p>Capture count: ${count}. Last captured: ${lastCaptured}.</p><button class="icon-button" data-page="fastCapture">Open Fast Capture</button></div><div class="card settings-card"><h3>Bulk Import</h3><p>Import history: ${(db.importHistory || []).length} saved imports.</p><button class="icon-button" data-page="bulkImport">Open Bulk Import</button></div><div class="card settings-card"><h3>Import Review</h3><p>Reviewed imports: ${(db.importReviews || []).filter((review) => review.reviewedAt).length} of ${(db.importReviews || []).length}.</p><button class="icon-button" data-page="importReview">Open Import Review</button></div><div class="card settings-card"><h3>Reset</h3><p>Reset clears localStorage and returns to the default data bundled in data/database.js.</p><button id="resetDefault" class="icon-button danger">Reset to Default Data</button></div></div><div class="card"><h3>Local Storage Status</h3><ul class="list"><li>Products: ${products().length}</li><li>Videos: ${videos().length}</li><li>Action history: ${readJson(ACTION_HISTORY_KEY, []).length}</li><li>Decision Log: ${readJson(DECISION_LOG_KEY, []).length}</li><li>Knowledge lessons: ${(db.notes.lessons || []).length}</li><li>Imports: ${(db.importHistory || []).length}</li><li>Import reviews: ${(db.importReviews || []).length}</li><li>Season overrides: ${seasonOverrideCount}</li><li>Last Saved: ${lastSavedAt}</li></ul></div>`;
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  document.querySelector("#importBackup").addEventListener("change", importBackup);
  document.querySelector("#resetDefault").addEventListener("click", resetDefaultData);
  bindInternalButtons();
}

function exportBackup() {
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    lastSavedAt,
    data: db,
    localMeta: {
      captureCount: captureCount(),
      lastCapturedAt: localStorage.getItem(LAST_CAPTURED_KEY) || "",
      captureLog: readJson(CAPTURE_LOG_KEY, []),
      pulseSnapshots: readJson(PULSE_SNAPSHOTS_KEY, []),
      decisionLog: readJson(DECISION_LOG_KEY, []),
      actionStatuses: readJson(ACTION_STATUS_KEY, {}),
      actionHistory: readJson(ACTION_HISTORY_KEY, []),
      productSeasons: storedProductSeasons(),
      syncHistory: readJson(NORTHSTAR_SYNC_HISTORY_KEY, []),
      importHistory: db.importHistory || [],
      importReviews: db.importReviews || []
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = mergeDatabase(clone(defaultDb), parsed);
      normalizeDatabase();
      if (parsed.localMeta) {
        localStorage.setItem(CAPTURE_COUNT_KEY, String(parsed.localMeta.captureCount || 0));
        localStorage.setItem(LAST_CAPTURED_KEY, parsed.localMeta.lastCapturedAt || "");
        localStorage.setItem(CAPTURE_LOG_KEY, JSON.stringify(parsed.localMeta.captureLog || []));
        localStorage.setItem(PULSE_SNAPSHOTS_KEY, JSON.stringify(parsed.localMeta.pulseSnapshots || []));
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(parsed.localMeta.decisionLog || []));
        localStorage.setItem(ACTION_STATUS_KEY, JSON.stringify(parsed.localMeta.actionStatuses || {}));
        localStorage.setItem(ACTION_HISTORY_KEY, JSON.stringify(parsed.localMeta.actionHistory || []));
        localStorage.setItem(PRODUCT_SEASONS_KEY, JSON.stringify(parsed.localMeta.productSeasons || {}));
        localStorage.setItem(NORTHSTAR_SYNC_HISTORY_KEY, JSON.stringify(parsed.localMeta.syncHistory || []));
        db.importHistory = parsed.localMeta.importHistory || db.importHistory || [];
        db.importReviews = parsed.localMeta.importReviews || db.importReviews || [];
        db.actionHistory = parsed.localMeta.actionHistory || db.actionHistory || [];
        localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
        localStorage.setItem(IMPORT_REVIEWS_KEY, JSON.stringify(db.importReviews));
      }
      saveData("Backup imported and saved locally");
      renderPage("settings");
    } catch (error) {
      showMessage("Import failed. Choose a valid Northstar JSON backup.", "warn");
    }
  };
  reader.readAsText(file);
}

function resetDefaultData() {
  if (!confirm("Reset Northstar to the default bundled data? This clears local saved changes in this browser.")) return;
  [STORAGE_KEY, SAVED_AT_KEY, CAPTURE_COUNT_KEY, LAST_CAPTURED_KEY, CAPTURE_LOG_KEY, PULSE_SNAPSHOTS_KEY, DECISION_LOG_KEY, ACTION_STATUS_KEY, ACTION_HISTORY_KEY, BULK_IMPORT_HISTORY_KEY, IMPORT_REVIEWS_KEY, PRODUCT_SEASONS_KEY, NORTHSTAR_SYNC_HISTORY_KEY].forEach((key) => localStorage.removeItem(key));
  db = clone(defaultDb);
  normalizeDatabase();
  lastSavedAt = "Never";
  initializePulseEngine("reset-default");
  updateLastSavedDisplay();
  showMessage("Reset to default data", "warn");
  renderPage("settings");
}

/* Northstar Sprint 9 - Premium Experience™ */
const northstarRenderPage = renderPage;
renderPage = function renderPremiumPage(pageId) {
  document.body.classList.toggle("executive-home", pageId === "executive");
  northstarRenderPage(pageId);
};

function renderNav() {
  nav.innerHTML = pages.map((page) => `
    <button type="button" data-page="${page.id}" class="${page.id === activePage ? "active" : ""}">
      <span class="nav-icon">${navIcon(page.id)}</span>
      <span>${page.label}</span>
    </button>
  `).join("");
  nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => renderPage(button.dataset.page)));
}

function navIcon(pageId) {
  const icons = {
    executive: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`,
    actionPlan: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m15 9-2 6-4 2 2-6 4-2Z"></path></svg>`,
    decisionLog: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path></svg>`,
    notes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8a4 4 0 0 1 8 0v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V8Z"></path><path d="M12 6v12M6 12h12"></path></svg>`,
    products: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 8-9-5-9 5 9 5 9-5Z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path></svg>`,
    fastCapture: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"></path></svg>`,
    bulkImport: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"></path></svg>`,
    importReview: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h6"></path><path d="M9 12l2 2 4-4"></path><path d="M8 3h8l1 2h3v16H4V5h3l1-2Z"></path></svg>`,
    workspaces: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>`,
    videos: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2"></rect><path d="m17 9 4-2v10l-4-2V9Z"></path></svg>`,
    hooks: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10M7 12h7M7 17h4"></path><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path></svg>`,
    samples: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4z"></path><path d="M8 7a4 4 0 0 1 8 0"></path></svg>`,
    recommendations: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"></path><path d="m7 7 10 10M17 7 7 17"></path></svg>`,
    calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>`,
    reports: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"></path><path d="M14 3v6h6M8 13h8M8 17h5"></path></svg>`,
    settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 5h-6l-.4 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h6l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.2-1.5Z"></path></svg>`
  };
  return icons[pageId] || `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>`;
}

/* Northstar Brand Review - read-only founder inspection page */
if (!pages.some((page) => page.id === "brandReview")) {
  const settingsIndex = pages.findIndex((page) => page.id === "settings");
  pages.splice(settingsIndex >= 0 ? settingsIndex : pages.length, 0, { id: "brandReview", label: "Brand Review", icon: "BR" });
}

const northstarBrandReviewRenderPage = renderPage;
renderPage = function renderBrandReviewRoute(pageId) {
  northstarBrandReviewRenderPage(pageId);
  if (pageId === "brandReview") {
    activePage = "brandReview";
    document.body.classList.remove("executive-home");
    renderNav();
    pageTitle.textContent = "Brand Review";
    renderBrandReview();
  }
};

const northstarBrandReviewNavIcon = navIcon;
navIcon = function navIconWithBrandReview(pageId) {
  if (pageId === "brandReview") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 15 10l6 2-6 2-3 7-3-7-6-2 6-2 3-7Z"></path><path d="M12 8v8M8 12h8"></path></svg>`;
  }
  return northstarBrandReviewNavIcon(pageId);
};

function renderBrandReview() {
  content.innerHTML = `
    <section class="brand-review-hero">
      <p class="eyebrow">Founder Review</p>
      <h1>Brand Review</h1>
      <p>Official inspection page for The Mark™ v1.0 and Northstar brand assets.</p>
    </section>

    <section class="brand-review-section official-mark-section">
      <div class="brand-review-section-title"><span>Section 1</span><h2>The Official Mark™</h2></div>
      <div class="official-mark-stage">
        <img src="assets/brand/northstar-horizontal.svg" alt="Northstar horizontal logo">
      </div>
      <div class="official-mark-copy">
        <span>The Mark™</span>
        <h3>NORTHSTAR</h3>
        <strong>Data becomes direction.</strong>
        <p>One place to guide every creator decision.</p>
      </div>
    </section>

    <section class="brand-review-section">
      <div class="brand-review-section-title"><span>Section 2</span><h2>Official Logo Variations</h2></div>
      <div class="logo-variation-grid">
        ${logoVariationCard("Full Horizontal", `<img class="variation-horizontal" src="assets/brand/northstar-horizontal.svg" alt="Full horizontal Northstar logo">`)}
        ${logoVariationCard("Stacked", stackedLogoMarkup())}
        ${logoVariationCard("Mark Only", `<img class="variation-mark" src="assets/brand/northstar-mark.svg" alt="The Mark only">`)}
        ${logoVariationCard("Wordmark Only", `<img class="variation-wordmark" src="assets/brand/northstar-wordmark.svg" alt="Northstar wordmark">`)}
        ${logoVariationCard("App Icon", `<img class="variation-app-icon" src="assets/brand/northstar-app-icon.svg" alt="Northstar app icon">`)}
        ${logoVariationCard("Favicon", `<img class="variation-favicon" src="assets/brand/favicon.svg" alt="Northstar favicon">`)}
      </div>
    </section>

    <section class="brand-review-section">
      <div class="brand-review-section-title"><span>Section 3</span><h2>Background Tests</h2></div>
      <div class="background-test-grid">
        ${backgroundTest("White background", "white", "assets/brand/northstar-horizontal.svg")}
        ${backgroundTest("Dark background", "dark", "assets/brand/northstar-mark-light.svg")}
        ${backgroundTest("Soft Ivory background", "ivory", "assets/brand/northstar-horizontal.svg")}
        ${backgroundTest("Navy background", "navy", "assets/brand/northstar-mark-light.svg")}
      </div>
    </section>

    <section class="brand-review-section">
      <div class="brand-review-section-title"><span>Section 4</span><h2>Logo Sizes</h2></div>
      <div class="logo-size-row">${[24, 32, 48, 64, 128, 256, 512].map(logoSizeSample).join("")}</div>
    </section>

    <section class="brand-review-section">
      <div class="brand-review-section-title"><span>Section 5</span><h2>Brand Colors</h2></div>
      <div class="brand-color-grid">
        ${brandColorSwatch("North Sky Navy", "#0F1B2D")}
        ${brandColorSwatch("Deep North Navy", "#10233F")}
        ${brandColorSwatch("The Spark Gold", "#D4A72C")}
        ${brandColorSwatch("Bright Spark Highlight", "#FFF3B0")}
        ${brandColorSwatch("Soft Ivory", "#FAFAF8")}
        ${brandColorSwatch("Northern Current Teal", "#2F7C7A")}
      </div>
    </section>

    <section class="brand-review-section typography-review">
      <div class="brand-review-section-title"><span>Section 6</span><h2>Typography</h2></div>
      <div class="typography-specimen">
        <h3>NORTHSTAR</h3>
        <strong>Data becomes direction.</strong>
        <p>One place to guide every creator decision.</p>
      </div>
    </section>
  `;
}

function logoVariationCard(label, markup) {
  return `<article class="logo-variation-card"><div>${markup}</div><span>${label}</span></article>`;
}

function stackedLogoMarkup() {
  return `<div class="stacked-logo-review"><img src="assets/brand/northstar-mark.svg" alt=""><strong>NORTHSTAR</strong><span>Data becomes direction.</span><small>One place to guide every creator decision.</small></div>`;
}

function backgroundTest(label, tone, asset) {
  const isWordmark = tone === "white" || tone === "ivory";
  return `<article class="background-test ${tone}"><div>${isWordmark ? `<img src="${asset}" alt="${label}">` : `<img class="background-mark-only" src="${asset}" alt="${label}">`}</div><span>${label}</span></article>`;
}

function logoSizeSample(size) {
  const asset = size <= 32 ? "assets/brand/favicon.svg" : "assets/brand/northstar-mark.svg";
  return `<article class="logo-size-sample"><div class="logo-size-box"><img src="${asset}" alt="${size}px logo sample" style="width:${size}px;height:${size}px"></div><span>${size}px</span></article>`;
}

function brandColorSwatch(name, hex) {
  return `<article class="brand-color-swatch"><span style="background:${hex}"></span><div><strong>${name}</strong><code>${hex}</code></div></article>`;
}

/* Northstar Integration Planning Sprint - TikTok Connection */
if (!pages.some((page) => page.id === "tiktokConnection")) {
  const importReviewIndex = pages.findIndex((page) => page.id === "importReview");
  pages.splice(importReviewIndex >= 0 ? importReviewIndex + 1 : pages.length, 0, { id: "tiktokConnection", label: "TikTok Connection", icon: "TC" });
}

const northstarTikTokConnectionRenderPage = renderPage;
renderPage = function renderTikTokConnectionRoute(pageId) {
  northstarTikTokConnectionRenderPage(pageId);
  if (pageId === "tiktokConnection") {
    activePage = "tiktokConnection";
    document.body.classList.remove("executive-home");
    renderNav();
    pageTitle.textContent = "TikTok Connection";
    renderTikTokConnection();
  }
};

const northstarTikTokConnectionNavIcon = navIcon;
navIcon = function navIconWithTikTokConnection(pageId) {
  if (pageId === "tiktokConnection") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12a5 5 0 0 1 5-5h3"></path><path d="M17 12a5 5 0 0 1-5 5H9"></path><path d="M8 8 4 12l4 4"></path><path d="m16 8 4 4-4 4"></path></svg>`;
  }
  return northstarTikTokConnectionNavIcon(pageId);
};

function renderTikTokConnection() {
  const lastRefresh = localStorage.getItem(LAST_CAPTURED_KEY) || lastSavedAt || "No local refresh yet";
  content.innerHTML = `
    <section class="connection-hero">
      <div>
        <p class="eyebrow">Integration Planning</p>
        <h1>TikTok Connection</h1>
        <p>Prepare Northstar for future TikTok and TikTok Shop account linking without pretending live API access exists today.</p>
      </div>
      <span class="connection-status-pill pending">API Pending</span>
    </section>

    <section class="connection-note">
      <strong>Current state</strong>
      <p>Northstar currently uses manual capture and CSV import. Live TikTok linking requires API approval and secure backend infrastructure.</p>
    </section>

    <section class="connection-section">
      <div class="section-title"><div><h3>Connected Accounts</h3><p>Readiness view for Jennifer's creator business accounts.</p></div></div>
      <div class="connected-account-grid">
        ${connectedAccountCard("Raised Right", "Manual / CSV / API Pending", lastRefresh)}
        ${connectedAccountCard("Truth Tuned Tribe", "Manual / CSV / API Pending", lastRefresh)}
      </div>
    </section>

    <div class="grid two">
      <section class="connection-section">
        <div class="section-title"><div><h3>Data Sources Needed</h3><p>Signals Northstar will need when linking becomes available.</p></div></div>
        <div class="connection-check-grid">
          ${connectionNeed("TikTok Studio video analytics")}
          ${connectionNeed("TikTok Shop sales")}
          ${connectionNeed("Sample approvals")}
          ${connectionNeed("Product invitations")}
          ${connectionNeed("Comments")}
          ${connectionNeed("Follower growth")}
        </div>
      </section>

      <section class="connection-section">
        <div class="section-title"><div><h3>Future API Checklist</h3><p>Infrastructure required before live linking can be trusted.</p></div></div>
        <div class="api-checklist">
          ${apiChecklistItem("TikTok developer account")}
          ${apiChecklistItem("Registered TikTok app")}
          ${apiChecklistItem("OAuth/Login Kit")}
          ${apiChecklistItem("Required scopes")}
          ${apiChecklistItem("TikTok Shop Partner access")}
          ${apiChecklistItem("Backend server")}
          ${apiChecklistItem("Secure token storage")}
          ${apiChecklistItem("Data refresh schedule")}
        </div>
      </section>
    </div>
  `;
}

function connectedAccountCard(name, status, lastRefresh) {
  return `<article class="connected-account-card"><div><span class="connection-account-icon">${name === "Raised Right" ? "RR" : "TT"}</span><h3>${name}</h3></div><div class="connection-account-meta"><span>Connection status</span><strong>${status}</strong></div><div class="connection-account-meta"><span>Last data refresh</span><strong>${lastRefresh}</strong></div></article>`;
}

function connectionNeed(label) {
  return `<article class="connection-need"><span></span><strong>${label}</strong><small>Needed for future linked Signals</small></article>`;
}

function apiChecklistItem(label) {
  return `<div class="api-checklist-item"><span></span><strong>${label}</strong><small>Not connected yet</small></div>`;
}

/* Northstar Sprint 10 - Update Northstar™ */
const NORTHSTAR_SYNC_HISTORY_KEY = "northstar.v01.syncHistory";

function openUpdateCenter() {
  document.querySelector(".update-center-overlay")?.remove();
  document.body.insertAdjacentHTML("beforeend", updateCenterMarkup());
  bindUpdateCenter();
}

function closeUpdateCenter() {
  document.querySelector(".update-center-overlay")?.remove();
}

function updateCenterMarkup() {
  const lastRefresh = latestNorthstarRefresh();
  return `
    <div class="update-center-overlay" role="dialog" aria-modal="true" aria-labelledby="updateCenterTitle">
      <section class="update-center-panel">
        <div class="update-center-header">
          <div>
            <p class="eyebrow">Update Northstar</p>
            <h2 id="updateCenterTitle">Update Center</h2>
            <p>Built for future one-click account syncing. Today, this refreshes Northstar from local manual and CSV data.</p>
          </div>
          <button class="update-center-close" type="button" aria-label="Close Update Center">×</button>
        </div>

        <div class="update-mode-grid">
          <article><span>Current mode</span><strong>Manual / CSV</strong></article>
          <article><span>Future mode</span><strong>Live TikTok Sync</strong></article>
        </div>

        <div class="update-center-note">
          Eventually this button will refresh your latest TikTok, TikTok Shop, sample, sales, and content signals automatically.
        </div>

        <section class="update-center-section">
          <div class="section-title"><div><h3>Connected Accounts</h3><p>Status is intentionally honest until live API linking exists.</p></div></div>
          <div class="update-account-grid">
            ${updateAccountCard("Raised Right", "raisedRight", lastRefresh)}
            ${updateAccountCard("Truth Tuned Tribe", "truthTunedTribe", lastRefresh)}
          </div>
        </section>

        <div class="grid two">
          <section class="update-center-section">
            <div class="section-title"><div><h3>Update Sources</h3><p>Choose a source to simulate a local refresh.</p></div></div>
            <div class="update-source-grid">
              ${updateSourceButton("Manual Capture", "Manual Capture", false)}
              ${updateSourceButton("CSV Import", "CSV Import", false)}
              ${updateSourceButton("Screenshot Import", "Screenshot Import", true)}
              ${updateSourceButton("TikTok API", "TikTok API", true)}
              ${updateSourceButton("TikTok Shop API", "TikTok Shop API", true)}
            </div>
          </section>

          <section class="update-center-section">
            <div class="section-title"><div><h3>Data Needed</h3><p>Signals the future sync engine should collect.</p></div></div>
            <div class="update-data-needed">
              ${["Video analytics", "Sales / GMV / commission", "Product samples", "Product invitations", "Comments", "Followers", "Creator Rewards"].map((item) => `<span>${item}</span>`).join("")}
            </div>
          </section>
        </div>

        <section class="update-center-section">
          <div class="section-title"><div><h3>Sync History</h3><p>Local record of simulated and imported update activity.</p></div></div>
          ${syncHistoryTable()}
        </section>
      </section>
    </div>
  `;
}

function updateAccountCard(name, accountId, lastRefresh) {
  return `<article class="update-account-card"><div><span>${name === "Raised Right" ? "RR" : "TT"}</span><h4>${name}</h4></div><dl><div><dt>Status</dt><dd>Manual / CSV / API Pending</dd></div><div><dt>Last updated</dt><dd>${lastRefresh}</dd></div><div><dt>Next available data source</dt><dd>${nextAvailableDataSource(accountId)}</dd></div></dl><button class="ghost-button" data-sync-source="Manual Capture" data-sync-account="${name}" type="button">Simulate Update</button></article>`;
}

function updateSourceButton(label, source, pending) {
  return `<button class="update-source-button ${pending ? "pending" : ""}" data-sync-source="${source}" data-sync-account="All accounts" type="button"><strong>${label}</strong><span>${pending ? "Placeholder" : "Available now"}</span></button>`;
}

function nextAvailableDataSource(accountId) {
  const hasImport = (db.importHistory || []).some((item) => normalizedName(item.account || "").includes(accountId === "raisedRight" ? "raised" : "truth"));
  if (hasImport) return "CSV Import";
  return "Manual Capture";
}

function latestNorthstarRefresh() {
  const history = readJson(NORTHSTAR_SYNC_HISTORY_KEY, []);
  const lastSync = history.at(-1)?.dateTime;
  return lastSync || localStorage.getItem(LAST_CAPTURED_KEY) || lastSavedAt || "No local refresh yet";
}

function bindUpdateCenter() {
  document.querySelector(".update-center-close")?.addEventListener("click", closeUpdateCenter);
  document.querySelector(".update-center-overlay")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("update-center-overlay")) closeUpdateCenter();
  });
  document.querySelectorAll("[data-sync-source]").forEach((button) => button.addEventListener("click", () => {
    const record = runNorthstarUpdate(button.dataset.syncSource, button.dataset.syncAccount);
    showMessage(`Northstar updated from ${record.source}`, "good");
    closeUpdateCenter();
    renderPage("executive");
    openUpdateCenter();
  }));
}

function runNorthstarUpdate(source, account) {
  const accountProductsList = account === "All accounts" ? products() : products().filter((product) => product.account === account);
  const accountVideosList = account === "All accounts" ? videos() : videos().filter((video) => video.account === account);
  const recordsUpdated = accountProductsList.length + accountVideosList.length;
  const status = /API|Screenshot/.test(source) ? "Placeholder simulated" : "Local refresh complete";
  const record = {
    id: uniqueImportId(`sync-${Date.now()}-${source}-${account}`),
    dateTime: new Date().toLocaleString(),
    source,
    account,
    status,
    recordsUpdated,
    notes: source.includes("API")
      ? "Future live sync placeholder. No TikTok API connection attempted."
      : "Morning Brief refreshed from local Northstar data."
  };
  const history = readJson(NORTHSTAR_SYNC_HISTORY_KEY, []);
  history.push(record);
  localStorage.setItem(NORTHSTAR_SYNC_HISTORY_KEY, JSON.stringify(history.slice(-100)));
  initializePulseEngine(`update-${slug(source)}-${slug(account)}`);
  return record;
}

function syncHistoryTable() {
  const history = readJson(NORTHSTAR_SYNC_HISTORY_KEY, []).slice().reverse();
  if (!history.length) return `<p class="empty">No updates yet. Use Manual Capture or CSV Import, then click Update Northstar.</p>`;
  return `<div class="sync-history-table"><table><thead><tr><th>Date/time</th><th>Source</th><th>Account</th><th>Status</th><th>Records updated</th><th>Notes</th></tr></thead><tbody>${history.slice(0, 8).map((item) => `<tr><td>${item.dateTime}</td><td>${item.source}</td><td>${item.account}</td><td>${item.status}</td><td>${item.recordsUpdated}</td><td>${item.notes}</td></tr>`).join("")}</tbody></table></div>`;
}

/* Northstar Sprint 11 - Project Polaris™ data pipeline bridge */
const NORTHSTAR_POLARIS_SNAPSHOTS_KEY = "northstar.v01.polarisSnapshots";
const NORTHSTAR_POLARIS_CHANGE_KEY = "northstar.v01.polarisChangeSummary";

const northstarPolarisRenderTikTokConnection = renderTikTokConnection;
renderTikTokConnection = function renderPolarisTikTokConnection() {
  northstarPolarisRenderTikTokConnection();
  const note = document.querySelector(".connection-note");
  if (note) note.insertAdjacentHTML("afterend", polarisDataSourcesSection());
};

function polarisDataSourcesSection() {
  return `
    <section class="connection-section polaris-source-section">
      <div class="section-title"><div><h3>Polaris Data Sources</h3><p>Every future source will flow through one Northstar update pipeline.</p></div><span class="badge good">Manual / CSV ready</span></div>
      <div class="polaris-source-grid">${polarisSources().map(polarisSourceCard).join("")}</div>
    </section>
  `;
}

function polarisSources() {
  return window.NorthstarPolaris?.adapters?.SOURCES || [
    { name: "TikTok Studio", status: "API Pending" },
    { name: "TikTok Shop", status: "API Pending" },
    { name: "Creator Rewards", status: "API Pending" },
    { name: "CSV Import", status: "Available" },
    { name: "Screenshot OCR", status: "Planned" },
    { name: "Manual Capture", status: "Available" },
    { name: "Future Platforms", status: "Planned" }
  ];
}

function polarisSourceCard(source) {
  const className = source.status === "Available" ? "available" : source.status === "API Pending" ? "pending" : "planned";
  const dataTypes = (source.dataTypes || ["Future Signals"]).join(", ");
  return `<article class="polaris-source-card ${className}"><div><strong>${source.name}</strong><span>${dataTypes}</span></div><em>${source.status}</em></article>`;
}

updateCenterMarkup = function polarisUpdateCenterMarkup() {
  const lastRefresh = latestNorthstarRefresh();
  return `
    <div class="update-center-overlay" role="dialog" aria-modal="true" aria-labelledby="updateCenterTitle">
      <section class="update-center-panel">
        <div class="update-center-header">
          <div>
            <p class="eyebrow">Project Polaris</p>
            <h2 id="updateCenterTitle">Update Center</h2>
            <p>One update path for manual capture, CSV files, screenshots, and future connected accounts.</p>
          </div>
          <button class="update-center-close" type="button" aria-label="Close Update Center">×</button>
        </div>

        <div class="update-mode-grid">
          <article><span>Current mode</span><strong>Manual / CSV</strong></article>
          <article><span>Future mode</span><strong>Live TikTok Sync</strong></article>
        </div>

        <div class="update-center-note">
          Eventually this button will refresh your latest TikTok, TikTok Shop, sample, sales, and content signals automatically.
        </div>

        <section class="update-center-section">
          <div class="section-title"><div><h3>Connected Accounts</h3><p>Status is intentionally honest until live linking exists.</p></div></div>
          <div class="update-account-grid">
            ${updateAccountCard("Raised Right", "raisedRight", lastRefresh)}
            ${updateAccountCard("Truth Tuned Tribe", "truthTunedTribe", lastRefresh)}
          </div>
        </section>

        <div class="grid two">
          <section class="update-center-section">
            <div class="section-title"><div><h3>Update Sources</h3><p>Choose a source to refresh the Morning Brief from available local data.</p></div></div>
            <div class="update-source-grid">
              ${updateSourceButton("Manual Capture", "Manual Capture", false)}
              ${updateSourceButton("CSV Import", "CSV Import", false)}
              ${updateSourceButton("Screenshot Import", "Screenshot Import", true)}
              ${updateSourceButton("TikTok Studio", "TikTok Studio", true)}
              ${updateSourceButton("TikTok Shop", "TikTok Shop", true)}
              ${updateSourceButton("Creator Rewards", "Creator Rewards", true)}
            </div>
          </section>

          <section class="update-center-section">
            <div class="section-title"><div><h3>Data Needed</h3><p>Signals the future sync engine should collect.</p></div></div>
            <div class="update-data-needed">
              ${["Video analytics", "Sales / GMV / commission", "Product samples", "Product invitations", "Comments", "Followers", "Creator Rewards"].map((item) => `<span>${item}</span>`).join("")}
            </div>
          </section>
        </div>

        <section class="update-center-section">
          <div class="section-title"><div><h3>Polaris Data Sources</h3><p>Available today and planned for future syncing.</p></div></div>
          <div class="polaris-source-grid compact">${polarisSources().slice(0, 6).map(polarisSourceCard).join("")}</div>
        </section>

        <section class="update-center-section">
          <div class="section-title"><div><h3>Update Progress</h3><p>The same steps future connected accounts will use.</p></div></div>
          <div id="polarisProgress" class="polaris-progress">${polarisProgressMarkup([])}</div>
        </section>

        <section class="update-center-section">
          <div class="section-title"><div><h3>Sync History</h3><p>Every update attempt is stored locally.</p></div></div>
          ${syncHistoryTable()}
        </section>
      </section>
    </div>
  `;
};

function polarisProgressMarkup(completed = []) {
  const steps = window.NorthstarPolaris?.STEPS || ["Connecting sources", "Capturing data", "Normalizing data", "Detecting changes", "Updating Morning Brief", "Complete"];
  return steps.map((step) => {
    const done = completed.includes(step);
    return `<div class="polaris-progress-step ${done ? "done" : ""}"><span></span><strong>${step}</strong></div>`;
  }).join("");
}

bindUpdateCenter = function bindPolarisUpdateCenter() {
  document.querySelector(".update-center-close")?.addEventListener("click", closeUpdateCenter);
  document.querySelector(".update-center-overlay")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("update-center-overlay")) closeUpdateCenter();
  });
  document.querySelectorAll("[data-sync-source]").forEach((button) => button.addEventListener("click", () => {
    const progress = document.querySelector("#polarisProgress");
    progress && (progress.innerHTML = polarisProgressMarkup(["Connecting sources"]));
    const result = runNorthstarUpdate(button.dataset.syncSource, button.dataset.syncAccount);
    progress && (progress.innerHTML = polarisProgressMarkup(result.progress?.map((step) => step.label) || []));
    showMessage(`Northstar updated from ${result.source}`, result.errors ? "warn" : "good");
    closeUpdateCenter();
    renderPage("executive");
    openUpdateCenter();
  }));
  document.querySelectorAll("[data-sync-detail]").forEach((button) => button.addEventListener("click", () => openSyncDetail(button.dataset.syncDetail)));
};

runNorthstarUpdate = function runPolarisNorthstarUpdate(source, account) {
  const pipeline = window.NorthstarPolaris;
  if (!pipeline?.runPolarisSync) return legacyNorthstarUpdate(source, account);
  const result = pipeline.runPolarisSync({ db, source, account });
  db.polarisSnapshots = readJson(NORTHSTAR_POLARIS_SNAPSHOTS_KEY, []);
  db.polarisChangeSummary = result.changeSummary;
  safeSaveLocalData("polaris-update");
  lastSavedAt = new Date().toLocaleString();
  safeSetLocalStorage(SAVED_AT_KEY, lastSavedAt, "last-saved");
  updateLastSavedDisplay();
  initializePulseEngine(`polaris-${slug(source)}-${slug(account)}`);
  logPolarisDecision(result.changeSummary, result.record);
  return {
    ...result.record,
    progress: result.progress,
    errors: result.validation.errors.length,
    warnings: result.validation.warnings.length
  };
};

function legacyNorthstarUpdate(source, account) {
  const accountProductsList = account === "All accounts" ? products() : products().filter((product) => product.account === account);
  const accountVideosList = account === "All accounts" ? videos() : videos().filter((video) => video.account === account);
  const recordsUpdated = accountProductsList.length + accountVideosList.length;
  const record = {
    id: uniqueImportId(`sync-${Date.now()}-${source}-${account}`),
    dateTime: new Date().toLocaleString(),
    source,
    account,
    dataType: "Local Signals",
    status: /API|Screenshot/.test(source) ? "Future source prepared" : "Complete",
    recordsCaptured: recordsUpdated,
    recordsUpdated,
    recordsSkipped: 0,
    warnings: 0,
    errors: 0,
    notes: "Morning Brief refreshed from local Northstar data.",
    progress: (window.NorthstarPolaris?.STEPS || []).map((label) => ({ label, status: "Done" }))
  };
  const history = readJson(NORTHSTAR_SYNC_HISTORY_KEY, []);
  history.push(record);
  localStorage.setItem(NORTHSTAR_SYNC_HISTORY_KEY, JSON.stringify(history.slice(-100)));
  initializePulseEngine(`update-${slug(source)}-${slug(account)}`);
  return record;
}

function logPolarisDecision(changeSummary, record) {
  if (!changeSummary) return;
  const log = readJson(DECISION_LOG_KEY, []);
  const today = new Date().toISOString().slice(0, 10);
  const recommended = changeSummary.summary || "Refresh Morning Brief from latest Signals.";
  const id = `polaris-${slug(record.source)}-${today}`;
  const existing = log.find((entry) => entry.id === id);
  const entry = existing || { id, date: today, dateRecommended: today, status: "Open" };
  entry.recommended = recommended;
  entry.action = "Review latest Polaris Signal";
  entry.account = record.account;
  entry.productOrCategory = "Morning Brief";
  entry.confidence = record.errors ? 62 : record.warnings ? 78 : 88;
  entry.reason = `Polaris detected ${record.recordsCaptured} captured records and ${record.warnings || 0} warnings.`;
  entry.type = "Observation";
  if (!existing) log.push(entry);
  localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(log.slice(-160)));
}

syncHistoryTable = function polarisSyncHistoryTable() {
  const history = readJson(NORTHSTAR_SYNC_HISTORY_KEY, []).slice().reverse();
  if (!history.length) return `<p class="empty">No updates yet. Use Manual Capture or CSV Import, then click Update Northstar.</p>`;
  return `<div class="sync-history-table"><table><thead><tr><th>Date/time</th><th>Source</th><th>Account</th><th>Data type</th><th>Captured</th><th>Updated</th><th>Skipped</th><th>Warnings</th><th>Errors</th><th>Status</th><th></th></tr></thead><tbody>${history.slice(0, 12).map((item) => `<tr><td>${item.dateTime}</td><td>${item.source}</td><td>${item.account}</td><td>${item.dataType || "Signals"}</td><td>${item.recordsCaptured ?? item.recordsUpdated ?? 0}</td><td>${item.recordsUpdated || 0}</td><td>${item.recordsSkipped || 0}</td><td>${item.warnings || 0}</td><td>${item.errors || 0}</td><td>${item.status}</td><td><button class="chart-detail-link sync-detail-button" data-sync-detail="${item.id}" type="button">Details</button></td></tr>`).join("")}</tbody></table></div>`;
};

function openSyncDetail(id) {
  const item = readJson(NORTHSTAR_SYNC_HISTORY_KEY, []).find((record) => record.id === id);
  if (!item) return;
  document.querySelector(".sync-detail-overlay")?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sync-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="syncDetailTitle">
      <section class="sync-detail-panel">
        <div class="update-center-header">
          <div><p class="eyebrow">Sync Detail</p><h2 id="syncDetailTitle">${item.source}</h2><p>${item.notes || "Local update record."}</p></div>
          <button class="sync-detail-close" type="button" aria-label="Close sync detail">×</button>
        </div>
        <div class="sync-detail-grid">
          ${syncDetailMetric("Account", item.account)}
          ${syncDetailMetric("Status", item.status)}
          ${syncDetailMetric("Captured", item.recordsCaptured ?? 0)}
          ${syncDetailMetric("Updated", item.recordsUpdated ?? 0)}
          ${syncDetailMetric("Skipped", item.recordsSkipped ?? 0)}
          ${syncDetailMetric("Warnings", item.warnings ?? 0)}
          ${syncDetailMetric("Errors", item.errors ?? 0)}
          ${syncDetailMetric("Snapshot", item.snapshotId || "Local refresh")}
        </div>
        <div class="polaris-progress detail">${polarisProgressMarkup((item.progress || []).map((step) => step.label))}</div>
        <section class="sync-detail-change">
          <h3>Change Summary</h3>
          <p>${item.changeSummary?.summary || "No major changes detected since your last review."}</p>
          ${(item.changeSummary?.signals || []).length ? `<ul>${item.changeSummary.signals.map((signal) => `<li>${signal}</li>`).join("")}</ul>` : ""}
        </section>
      </section>
    </div>
  `);
  document.querySelector(".sync-detail-close")?.addEventListener("click", () => document.querySelector(".sync-detail-overlay")?.remove());
  document.querySelector(".sync-detail-overlay")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("sync-detail-overlay")) document.querySelector(".sync-detail-overlay")?.remove();
  });
}

function syncDetailMetric(label, value) {
  return `<article><span>${label}</span><strong>${value}</strong></article>`;
}

const northstarPolarisTodaySpark = todaySpark;
todaySpark = function todaySparkWithPolaris() {
  const change = readJson(NORTHSTAR_POLARIS_CHANGE_KEY, null);
  if (change?.summary && !/No major changes/.test(change.summary)) return change.summary;
  return northstarPolarisTodaySpark();
};

/* Northstar Data Seed Sprint - July 2, 2026 Truth Tuned Tribe */
const NORTHSTAR_SEED_LOG_KEY = "northstar.v01.seedLog";

const northstarSeedStartApp = startApp;
startApp = function startAppWithSeedData() {
  applyNorthstarSeedData();
  northstarSeedStartApp();
};

function applyNorthstarSeedData() {
  const seed = window.NORTHSTAR_JULY2_2026_SEED;
  if (!seed) return;
  normalizeDatabase();
  db.seedLog = db.seedLog || [];
  const applied = {
    version: seed.version,
    appliedAt: new Date().toISOString(),
    account: seed.account,
    updateDate: seed.updateDate,
    products: seed.products.length,
    videos: seed.videos.length
  };
  seed.products.forEach((productSeed) => upsertSeedProduct(seed, productSeed));
  seed.videos.forEach((videoSeed) => upsertSeedVideo(seed, videoSeed));
  upsertSeedNotes(seed);
  db.seedLog = [...(db.seedLog || []).filter((entry) => entry.version !== seed.version), applied].slice(-20);
  if (typeof safeSetLocalStorage === "function") safeSetLocalStorage(NORTHSTAR_SEED_LOG_KEY, JSON.stringify(db.seedLog), "seed-log");
  if (typeof safeSaveLocalData === "function") safeSaveLocalData("seed-data");
  lastSavedAt = new Date().toLocaleString();
  if (typeof safeSetLocalStorage === "function") safeSetLocalStorage(SAVED_AT_KEY, lastSavedAt, "last-saved");
}

function upsertSeedProduct(seed, productSeed) {
  const product = findSeedProduct(seed, productSeed) || createSeedProduct(seed, productSeed);
  const beforeMonthly = product.monthlyPerformance || [];
  Object.assign(product, {
    accountId: seed.accountId,
    account: seed.account,
    category: productSeed.category || product.category || "Imported",
    categoryGroup: productSeed.categoryGroup || product.categoryGroup || String(productSeed.category || "Imported").split("/")[0].trim(),
    seasonality: productSeed.seasonality || product.seasonality || "Evergreen",
    evergreenSeasonal: productSeed.evergreenSeasonal || product.evergreenSeasonal || "Evergreen",
    sampleStatus: productSeed.sampleStatus || product.sampleStatus || "Watch",
    wouldPromoteAgain: productSeed.wouldPromoteAgain || product.wouldPromoteAgain || "Maybe",
    status: productSeed.status || product.status || "Watch",
    originalStatus: product.originalStatus || productSeed.status || "Watch",
    bestHook: productSeed.bestHook || product.bestHook || "",
    bestCta: productSeed.bestCta || product.bestCta || "",
    notes: mergeSeedText(product.notes, productSeed.notes),
    strategyNotes: mergeSeedText(product.strategyNotes, productSeed.notes),
    contentIntelligence: { ...(product.contentIntelligence || {}), ...(productSeed.contentIntelligence || {}) },
    seedSource: seed.updateLabel
  });
  if (productSeed.julySales) {
    upsertMonthlyPerformance(product, productSeed.julySales);
    const previousJuly = beforeMonthly.find((row) => row.month === productSeed.julySales.month);
    if (!previousJuly) {
      product.lifetimeGmv = Number(product.lifetimeGmv || 0) + Number(productSeed.julySales.gmv || 0);
      product.lifetimeCommission = Number(product.lifetimeCommission || 0) + Number(productSeed.julySales.commission || 0);
      product.lifetimeUnits = Number(product.lifetimeUnits || 0) + Number(productSeed.julySales.units || 0);
    } else {
      product.lifetimeGmv = Number(product.lifetimeGmv || 0) - Number(previousJuly.gmv || 0) + Number(productSeed.julySales.gmv || 0);
      product.lifetimeCommission = Number(product.lifetimeCommission || 0) - Number(previousJuly.commission || 0) + Number(productSeed.julySales.commission || 0);
      product.lifetimeUnits = Number(product.lifetimeUnits || 0) - Number(previousJuly.units || 0) + Number(productSeed.julySales.units || 0);
    }
    product.lastPromotedDate = productSeed.julySales.date;
  }
  product.firstPromotedDate = product.firstPromotedDate || productSeed.julySales?.date || seed.updateDate;
  product.similarTags = unique([...(product.similarTags || []), product.categoryGroup, product.evergreenSeasonal, seed.accountId]);
  if (!db.products.includes(product)) db.products.push(product);
  return product;
}

function findSeedProduct(seed, productSeed) {
  const names = [productSeed.name, ...(productSeed.aliases || [])].map(normalizedName);
  return products().find((product) => product.accountId === seed.accountId && names.includes(normalizedName(product.name)));
}

function createSeedProduct(seed, productSeed) {
  return {
    id: uniqueImportId(`${seed.accountId}-${slug(productSeed.name)}`),
    name: productSeed.name,
    accountId: seed.accountId,
    account: seed.account,
    lifetimeGmv: 0,
    lifetimeCommission: 0,
    lifetimeUnits: 0,
    monthlyPerformance: [],
    firstPromotedDate: seed.updateDate,
    lastPromotedDate: seed.updateDate,
    notes: "",
    bestHook: "",
    bestCta: "",
    strategyNotes: "",
    similarTags: []
  };
}

function upsertMonthlyPerformance(product, row) {
  product.monthlyPerformance = product.monthlyPerformance || [];
  const existing = product.monthlyPerformance.find((item) => item.month === row.month);
  if (existing) Object.assign(existing, { gmv: row.gmv, commission: row.commission, units: row.units, date: row.date });
  else product.monthlyPerformance.push({ month: row.month, gmv: row.gmv, commission: row.commission, units: row.units, date: row.date });
}

function upsertSeedVideo(seed, videoSeed) {
  const product = findSeedProduct(seed, { name: videoSeed.productName, aliases: [videoSeed.productName] }) || upsertSeedProduct(seed, {
    name: videoSeed.productName,
    category: categoryFromContentPurpose(videoSeed.contentPurpose),
    categoryGroup: categoryFromContentPurpose(videoSeed.contentPurpose).split("/")[0].trim(),
    seasonality: "Evergreen",
    evergreenSeasonal: "Evergreen",
    sampleStatus: "Watch",
    wouldPromoteAgain: "Maybe",
    status: videoSeed.contentFlags?.growth && !videoSeed.contentFlags?.revenue ? "Watch" : "Wait",
    notes: "Created from July 2, 2026 video seed so non-shop growth content can build audience capital.",
    contentIntelligence: { audienceCapitalScorePlaceholder: videoSeed.views >= 10000 ? "High" : "Medium", trustScorePlaceholder: videoSeed.saves >= 10 ? "Medium" : "Needs more data" }
  });
  const existing = videos().find((video) => video.id === videoSeed.id || (video.accountId === seed.accountId && video.datePosted === videoSeed.datePosted && normalizedName(video.hook) === normalizedName(videoSeed.hook)));
  const video = existing || { id: videoSeed.id };
  Object.assign(video, {
    id: videoSeed.id,
    datePosted: videoSeed.datePosted,
    timePosted: videoSeed.timePosted,
    postedAt: videoSeed.postedAt,
    accountId: seed.accountId,
    account: seed.account,
    productId: product.id,
    productName: product.name,
    category: product.categoryGroup,
    title: videoSeed.title,
    hook: videoSeed.hook,
    hookType: videoSeed.hookType,
    cta: videoSeed.cta,
    views: videoSeed.views,
    likes: videoSeed.likes,
    comments: videoSeed.comments,
    shares: videoSeed.shares,
    saves: videoSeed.saves,
    averageWatchTime: videoSeed.averageWatchTime,
    completionRate: videoSeed.completionRate,
    newFollowers: videoSeed.newFollowers,
    estimatedRewards: videoSeed.estimatedRewards || 0,
    creatorRewardsEarned: videoSeed.estimatedRewards || 0,
    creatorRewardsEligible: !!videoSeed.contentFlags?.creatorRewardsEligible,
    sales: videoSeed.sales || 0,
    gmv: videoSeed.gmv || 0,
    commission: videoSeed.commission || 0,
    contentPurpose: videoSeed.contentPurpose,
    revenueContent: !!videoSeed.contentFlags?.revenue,
    growthContent: !!videoSeed.contentFlags?.growth,
    trustContent: !!videoSeed.contentFlags?.trust,
    educationContent: !!videoSeed.contentFlags?.education,
    productDemo: !!videoSeed.contentFlags?.productDemo,
    communityContent: !!videoSeed.contentFlags?.community,
    audienceCapitalScorePlaceholder: videoSeed.views >= 10000 || videoSeed.shares >= 50 || videoSeed.newFollowers >= 10 ? "High" : videoSeed.saves >= 5 ? "Medium" : "Needs more data",
    trustScorePlaceholder: videoSeed.saves >= 50 || videoSeed.comments >= 10 ? "High" : videoSeed.saves >= 5 || videoSeed.comments > 0 ? "Medium" : "Needs more data",
    seedSource: seed.updateLabel,
    notes: `Seeded from ${seed.updateLabel}. Purpose: ${videoSeed.contentPurpose}.`
  });
  if (!existing) db.videos.push(video);
}

function upsertSeedNotes(seed) {
  db.notes = db.notes || {};
  db.notes.businessRules = db.notes.businessRules || [];
  db.notes.strategyNotes = db.notes.strategyNotes || [];
  db.notes.recommendations = db.notes.recommendations || [];
  db.notes.lessons = db.notes.lessons || [];
  seed.intelligenceNotes.forEach((note) => {
    if (!db.notes.businessRules.includes(note)) db.notes.businessRules.push(note);
    if (!db.notes.strategyNotes.includes(note)) db.notes.strategyNotes.push(note);
    if (!db.notes.lessons.some((lesson) => normalizedName(lesson.lesson || lesson.title) === normalizedName(note))) {
      db.notes.lessons.push({
        id: uniqueImportId(`lesson-${slug(note)}`),
        title: "Content Intelligence",
        account: seed.account,
        product: "",
        category: "Content Intelligence",
        tags: ["truth-tuned-tribe", "content-intelligence", "july-2026"],
        lesson: note,
        confidence: 82,
        dateAdded: seed.updateDate,
        relatedAction: "July 2 morning seed",
        relatedVideo: ""
      });
    }
  });
  const recommendation = "Prioritize curiosity + education for Truth Tuned Tribe; product demos need story, surprise, or usefulness before scaling.";
  if (!db.notes.recommendations.includes(recommendation)) db.notes.recommendations.push(recommendation);
}

function categoryFromContentPurpose(purpose) {
  const text = String(purpose || "").toLowerCase();
  if (text.includes("home")) return "Home / Product";
  if (text.includes("style")) return "Fashion / Style";
  if (text.includes("health") || text.includes("wellness") || text.includes("education")) return "Education / Curiosity";
  if (text.includes("community")) return "Community / Curiosity";
  return "Content / Audience Capital";
}

function mergeSeedText(existing, addition) {
  if (!addition) return existing || "";
  if (!existing) return addition;
  return existing.includes(addition) ? existing : `${existing}\n${addition}`;
}

/* Polaris Bug Fix - one source of truth for video records */
const northstarVideoSourceNormalizeDatabase = normalizeDatabase;
normalizeDatabase = function normalizePolarisVideoDatabase() {
  northstarVideoSourceNormalizeDatabase();
  normalizeVideoDatabase();
};

function normalizeVideoDatabase() {
  db.videos = (db.videos || []).map((video, index) => normalizeVideoRecord(video, index));
}

function normalizeVideoRecord(video, index = 0) {
  const product = getProduct(video.productId) || findProductByName?.(video.productName, video.accountId) || products().find((item) => normalizedName(item.name) === normalizedName(video.productName));
  const account = getAccount(video.accountId) || accounts().find((item) => normalizedName(item.name) === normalizedName(video.account)) || getAccount(product?.accountId) || {};
  const normalized = {
    ...video,
    id: video.id || uniqueImportId(`video-${video.datePosted || video.postedAt || Date.now()}-${video.productName || video.hook || index}`),
    datePosted: video.datePosted || String(video.postedAt || "").slice(0, 10) || "",
    accountId: video.accountId || account.id || product?.accountId || "",
    account: video.account || account.name || product?.account || "Unassigned",
    productId: video.productId || product?.id || "",
    productName: video.productName || product?.name || "Unassigned product",
    category: video.category || product?.categoryGroup || product?.category || "Uncategorized",
    hook: video.hook || video.title || video.hookText || "Untitled video",
    hookType: video.hookType || video.contentPurpose || video.category || product?.categoryGroup || "General",
    cta: video.cta || "",
    source: video.source || video.importSource || video.seedSource || video.captureSource || "Northstar database"
  };
  ["views", "likes", "comments", "shares", "saves", "averageWatchTime", "completionRate", "sales", "gmv", "commission", "newFollowers", "creatorRewardsEarned", "estimatedRewards", "videoLength"].forEach((field) => {
    normalized[field] = Number(normalized[field] || 0);
  });
  return normalized;
}

const northstarVideoSourceProductVideos = productVideos;
productVideos = function productVideosFromPolarisDatabase(productId) {
  return videos().filter((video) => video.productId === productId);
};

const northstarVideoSourceCreatePulseSnapshot = createPulseSnapshot;
createPulseSnapshot = function createPulseSnapshotWithVideos(reason) {
  const snapshot = northstarVideoSourceCreatePulseSnapshot(reason);
  snapshot.videoMetrics = {
    total: videos().length,
    raisedRight: videos().filter((video) => video.accountId === "raisedRight").length,
    truthTunedTribe: videos().filter((video) => video.accountId === "truthTunedTribe").length,
    views: videos().reduce((sum, video) => sum + Number(video.views || 0), 0),
    followers: videos().reduce((sum, video) => sum + Number(video.newFollowers || 0), 0)
  };
  return snapshot;
};

function videoAccountMatches(video, selectedAccount) {
  if (selectedAccount === "All") return true;
  const selected = accounts().find((account) => account.name === selectedAccount || account.id === selectedAccount);
  return video.account === selectedAccount || video.accountId === selected?.id;
}

filteredVideos = function filteredVideosFromPolarisDatabase() {
  const search = String(videoFilters.search || "").toLowerCase().trim();
  return videos().filter((video) => {
    const haystack = [video.productName, video.account, video.category, video.hook, video.cta, video.hookType, video.contentPurpose, video.source].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) &&
      videoAccountMatches(video, videoFilters.account) &&
      (videoFilters.product === "All" || video.productName === videoFilters.product || video.productId === videoFilters.product) &&
      (videoFilters.category === "All" || video.category === videoFilters.category) &&
      (videoFilters.hookType === "All" || video.hookType === videoFilters.hookType) &&
      (!videoFilters.salesOnly || Number(video.sales || 0) > 0) &&
      (!videoFilters.highSaves || Number(video.saves || 0) >= 10) &&
      (!videoFilters.highShares || Number(video.shares || 0) >= 10);
  }).sort((a, b) => new Date(b.datePosted || b.postedAt || 0) - new Date(a.datePosted || a.postedAt || 0) || Number(b.views || 0) - Number(a.views || 0));
};

renderVideosDatabase = function renderPolarisVideosDatabase() {
  normalizeVideoDatabase();
  const rows = filteredVideos();
  const diagnostics = videoDiagnostics(rows);
  content.innerHTML = `
    <div class="section-title">
      <div><h3>Videos</h3><p>Every row is rendered from the Polaris source of truth: <code>db.videos</code>.</p></div>
      <div class="video-count-badges">
        <span class="badge">${rows.length} displayed</span>
        <span class="badge good">Raised Right: ${diagnostics.accountCounts.raisedRight}</span>
        <span class="badge good">Truth Tuned Tribe: ${diagnostics.accountCounts.truthTunedTribe}</span>
      </div>
    </div>
    <details class="form-panel"><summary>Add Video</summary>${videoForm()}</details>
    <div class="filter-bar">
      <input id="videoSearch" type="search" placeholder="Search videos, hooks, CTA..." value="${escapeAttr(videoFilters.search)}">
      ${select("videoAccount", ["All", ...accounts().map((a) => a.name)], videoFilters.account)}
      ${select("videoProduct", ["All", ...unique(videos().map((v) => v.productName))], videoFilters.product)}
      ${select("videoCategory", ["All", ...unique(videos().map((v) => v.category))], videoFilters.category)}
      ${select("videoHookType", ["All", ...unique(videos().map((v) => v.hookType))], videoFilters.hookType)}
      <label class="check"><input id="salesOnly" type="checkbox" ${videoFilters.salesOnly ? "checked" : ""}> Sales &gt; 0</label>
      <label class="check"><input id="highSaves" type="checkbox" ${videoFilters.highSaves ? "checked" : ""}> High saves</label>
      <label class="check"><input id="highShares" type="checkbox" ${videoFilters.highShares ? "checked" : ""}> High shares</label>
      <button class="ghost-button" id="clearVideoFilters" type="button">Show All Videos</button>
    </div>
    ${videoDiagnosticsPanel(diagnostics)}
    <div class="table-card database-table"><table><thead><tr><th>Date</th><th>Account</th><th>Product</th><th>Hook</th><th>Views</th><th>Engagement</th><th>Watch</th><th>Sales</th><th>GMV</th><th>Commission</th></tr></thead><tbody>${videoRows(rows)}</tbody></table></div>
  `;
  document.querySelector("#addVideoForm").addEventListener("submit", handleAddVideo);
  bindVideoFilters();
  document.querySelector("#clearVideoFilters")?.addEventListener("click", () => {
    videoFilters = { search: "", account: "All", product: "All", category: "All", hookType: "All", salesOnly: false, highSaves: false, highShares: false };
    renderVideosDatabase();
  });
};

function videoDiagnostics(displayedRows) {
  const diagnosticVideos = typeof validVideos === "function" ? validVideos() : videos().filter((video) => !isPlaceholderVideo(video));
  const selectedAccountRows = diagnosticVideos.filter((video) => videoAccountMatches(video, videoFilters.account));
  const displayedIds = new Set(displayedRows.map((video) => video.id));
  const missing = selectedAccountRows.filter((video) => !displayedIds.has(video.id));
  const duplicateMap = new Map();
  diagnosticVideos.forEach((video) => {
    const key = [video.accountId || video.account, normalizedName(video.productName), video.datePosted, normalizedName(video.hook)].join("|");
    if (!key.trim()) return;
    duplicateMap.set(key, [...(duplicateMap.get(key) || []), video]);
  });
  const duplicates = [...duplicateMap.values()].filter((group) => group.length > 1).flat();
  return {
    importedVideos: diagnosticVideos.length,
    displayedVideos: displayedRows.length,
    missing,
    duplicates,
    accountCounts: {
      raisedRight: diagnosticVideos.filter((video) => video.accountId === "raisedRight" || video.account === "Raised Right").length,
      truthTunedTribe: diagnosticVideos.filter((video) => video.accountId === "truthTunedTribe" || video.account === "Truth Tuned Tribe").length
    }
  };
}

function videoDiagnosticsPanel(diagnostics) {
  const missingList = diagnostics.missing.slice(0, 8).map((video) => `<li>${escapeHtml(video.datePosted || "")} · ${escapeHtml(video.account)} · ${escapeHtml(video.productName)} · ${escapeHtml(shortName(video.hook || ""))}</li>`).join("");
  const duplicateList = diagnostics.duplicates.slice(0, 8).map((video) => `<li>${escapeHtml(video.datePosted || "")} · ${escapeHtml(video.account)} · ${escapeHtml(video.productName)} · ${escapeHtml(shortName(video.hook || ""))}</li>`).join("");
  return `
    <details class="developer-diagnostics">
      <summary>Developer diagnostics</summary>
      <div class="diagnostic-grid">
        <article><span>Imported videos</span><strong>${diagnostics.importedVideos}</strong></article>
        <article><span>Displayed videos</span><strong>${diagnostics.displayedVideos}</strong></article>
        <article><span>Missing videos</span><strong>${diagnostics.missing.length}</strong></article>
        <article><span>Duplicate videos</span><strong>${diagnostics.duplicates.length}</strong></article>
      </div>
      ${diagnostics.missing.length ? `<div class="diagnostic-list"><strong>Missing from current view</strong><ul>${missingList}</ul><p>These records exist in <code>db.videos</code> but are hidden by the current search or filters.</p></div>` : `<p class="diagnostic-note">No missing videos for the selected account and current filters.</p>`}
      ${diagnostics.duplicates.length ? `<div class="diagnostic-list"><strong>Potential duplicates</strong><ul>${duplicateList}</ul></div>` : `<p class="diagnostic-note">No duplicate video keys detected.</p>`}
    </details>
  `;
}

const northstarVideoSourceBindVideoFilters = bindVideoFilters;
bindVideoFilters = function bindPolarisVideoFilters() {
  northstarVideoSourceBindVideoFilters();
};

const northstarVideoSourceHandleAddVideo = handleAddVideo;
handleAddVideo = function handleAddVideoToPolarisDatabase(event) {
  northstarVideoSourceHandleAddVideo(event);
  normalizeVideoDatabase();
};

const northstarVideoSourceHandleCaptureVideo = handleCaptureVideo;
handleCaptureVideo = function handleCaptureVideoToPolarisDatabase(event) {
  northstarVideoSourceHandleCaptureVideo(event);
  normalizeVideoDatabase();
};

findVideoDuplicate = function findPolarisVideoDuplicate(data, productId) {
  const posted = normalizeDateKey(data.datePosted || data.date || "");
  const hook = normalizedName(data.hook || data.hookText || "");
  return videos().find((video) => video.productId === productId && normalizeDateKey(video.datePosted || video.postedAt || "") === posted && normalizedName(video.hook || "") === hook);
};

const northstarVideoSourceImportVideoAnalyticsRow = importVideoAnalyticsRow;
importVideoAnalyticsRow = function importVideoAnalyticsRowToPolarisDatabase(row) {
  const beforeIds = new Set(videos().map((video) => video.id));
  const result = northstarVideoSourceImportVideoAnalyticsRow(row);
  db.videos.forEach((video) => {
    if (!beforeIds.has(video.id) || findVideoDuplicate(row.data || {}, video.productId) === video) {
      video.source = "CSV Import";
      video.importSource = "Bulk Import";
      video.importedAt = video.importedAt || new Date().toISOString();
    }
  });
  normalizeVideoDatabase();
  return result;
};

function normalizeDateKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text.slice(0, 10);
}

/* Project Polaris - Import Center */
const VIDEO_BACKFILL_HISTORY_KEY = "northstar.v01.videoBackfillHistory";
let videoBackfillState = {
  activeTab: "csv",
  rawText: "",
  csvText: "",
  jsonText: "",
  parsedRows: [],
  preview: null,
  summary: null,
  errors: []
};

if (!pages.some((page) => page.id === "videoBackfill")) {
  const videosIndex = pages.findIndex((page) => page.id === "videos");
  pages.splice(videosIndex >= 0 ? videosIndex + 1 : 5, 0, { id: "videoBackfill", label: "Import Center", icon: "IC" });
}

const northstarVideoBackfillRenderPage = renderPage;
renderPage = function renderVideoBackfillRoute(pageId) {
  northstarVideoBackfillRenderPage(pageId);
  if (pageId === "videoBackfill") {
    activePage = "videoBackfill";
    document.body.classList.remove("executive-home");
    renderNav();
    pageTitle.textContent = "Import Center";
    renderVideoBackfill();
  }
};

const northstarVideoBackfillNavIcon = navIcon;
navIcon = function navIconWithVideoBackfill(pageId) {
  if (pageId === "videoBackfill") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="14" height="16" rx="2"></rect><path d="m17 9 4-2v10l-4-2V9Z"></path><path d="M7 8h6M7 12h5M7 16h4"></path></svg>`;
  }
  return northstarVideoBackfillNavIcon(pageId);
};

function renderVideoBackfill() {
  normalizeVideoDatabase();
  const preview = videoBackfillState.preview;
  const history = readJson(VIDEO_BACKFILL_HISTORY_KEY, []);
  content.innerHTML = `
    <section class="import-hero video-backfill-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Project Polaris</p>
        <h1>Import Center</h1>
        <p>Paste historical creator videos as JSON or CSV-style text, preview them, then save them directly into the Polaris Database.</p>
      </div>
      <span class="polaris-known-count">Polaris currently knows ${number.format(videos().length)} videos.</span>
    </section>

    <section class="card video-backfill-panel">
      <div class="section-title"><div><h3>Paste Video Batch</h3><p>Use JSON array/object data or CSV with a header row. Northstar will map common TikTok-style column names.</p></div><button class="ghost-button" id="loadBackfillExample" type="button">Example</button></div>
      <textarea id="videoBackfillText" class="video-backfill-textarea" spellcheck="false" placeholder="Account,Date posted,Product/topic,Category,Hook,Purpose,Views,Likes,Comments,Shares,Saves/favorites,Average watch time,Completion %,Followers gained,Sales,GMV,Commission,Creator rewards,Notes">${escapeHtml(videoBackfillState.rawText)}</textarea>
      <div class="import-actions">
        <button class="icon-button" id="previewVideoBackfill" type="button">Preview Backfill</button>
        <button class="ghost-button" id="clearVideoBackfill" type="button">Clear</button>
      </div>
    </section>

    ${preview ? videoBackfillPreviewMarkup(preview) : ""}
    ${videoBackfillState.summary ? videoBackfillSummaryMarkup(videoBackfillState.summary) : ""}

    <section class="card import-history-card">
      <div class="section-title"><div><h3>Backfill History</h3><p>Saved locally in this browser.</p></div></div>
      ${history.length ? `<div class="sync-history-table"><table><thead><tr><th>Date</th><th>Added</th><th>Updated</th><th>Skipped</th><th>Errors</th></tr></thead><tbody>${history.slice(0, 8).map((item) => `<tr><td>${item.dateLabel}</td><td>${item.added}</td><td>${item.updated}</td><td>${item.skipped}</td><td>${item.errors}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No video backfills yet.</p>`}
    </section>
  `;
  bindInternalButtons();
  bindVideoBackfillControls();
}

function videoBackfillPreviewMarkup(preview) {
  return `
    <section class="card video-backfill-preview">
      <div class="section-title"><div><h3>Preview Before Import</h3><p>${preview.validRows.length} usable rows detected from pasted text.</p></div><span class="badge ${preview.errors.length ? "warn" : "good"}">${preview.errors.length} errors</span></div>
      <div class="grid four">
        ${metric("Videos Added", number.format(preview.addCandidates.length), "New records if imported", "")}
        ${metric("Videos Updated", number.format(preview.updateCandidates.length), "Duplicates that will update", "")}
        ${metric("Duplicates Skipped", "0", "Duplicates are updated by default", "")}
        ${metric("Errors", number.format(preview.errors.length), "Rows needing cleanup", "")}
      </div>
      ${preview.errors.length ? `<div class="import-message-list">${preview.errors.slice(0, 8).map((error) => `<p class="warn"><strong>Row ${error.rowNumber}</strong><span>${error.message}</span></p>`).join("")}</div>` : ""}
      <div class="table-card import-preview-table"><table><thead><tr><th>Status</th><th>Account</th><th>Date</th><th>Product/topic</th><th>Hook</th><th>Purpose</th><th>Views</th><th>Sales</th><th>GMV</th></tr></thead><tbody>${preview.validRows.slice(0, 40).map((row) => `<tr><td><span class="badge ${row.existing ? "hot" : "good"}">${row.existing ? "Update existing" : "Create new"}</span></td><td>${row.account}</td><td>${row.datePosted}</td><td>${row.productName}</td><td><strong>${row.hook}</strong></td><td>${row.contentPurpose}</td><td>${number.format(row.views || 0)}</td><td>${number.format(row.sales || 0)}</td><td>${money.format(row.gmv || 0)}</td></tr>`).join("") || `<tr><td colspan="9">No valid rows yet.</td></tr>`}</tbody></table></div>
      <div class="import-actions">
        <button class="icon-button" id="confirmVideoBackfill" type="button" ${preview.validRows.length ? "" : "disabled"}>Import Into Polaris Database</button>
        <button class="ghost-button" data-page="videos" type="button">View Videos</button>
      </div>
    </section>
  `;
}

function videoBackfillSummaryMarkup(summary) {
  return `
    <section class="card import-done">
      <div class="section-title"><div><h3>Backfill Complete</h3><p>Historical videos were saved to the Polaris Database and Northstar intelligence was refreshed.</p></div><span class="badge good">Saved</span></div>
      <div class="grid four">
        ${metric("Videos Added", number.format(summary.added), "New video records", "")}
        ${metric("Videos Updated", number.format(summary.updated), "Existing records refreshed", "")}
        ${metric("Duplicates Skipped", number.format(summary.skipped), "Rows not imported", "")}
        ${metric("Errors", number.format(summary.errors.length), "Rows needing review", "")}
      </div>
      <div class="import-actions"><button class="icon-button" data-page="videos" type="button">Open Videos</button><button class="ghost-button" data-page="actionPlan" type="button">Open Action Plan</button></div>
    </section>
  `;
}

function bindVideoBackfillControls() {
  document.querySelector("#videoBackfillText")?.addEventListener("input", (event) => {
    videoBackfillState.rawText = event.target.value;
    videoBackfillState.summary = null;
  });
  document.querySelector("#previewVideoBackfill")?.addEventListener("click", () => {
    videoBackfillState.rawText = document.querySelector("#videoBackfillText")?.value || "";
    videoBackfillState.preview = analyzeVideoBackfill(videoBackfillState.rawText);
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#confirmVideoBackfill")?.addEventListener("click", confirmVideoBackfill);
  document.querySelector("#clearVideoBackfill")?.addEventListener("click", () => {
    videoBackfillState = { rawText: "", parsedRows: [], preview: null, summary: null, errors: [] };
    renderVideoBackfill();
  });
  document.querySelector("#loadBackfillExample")?.addEventListener("click", () => {
    videoBackfillState.rawText = videoBackfillExample();
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
}

function analyzeVideoBackfill(text) {
  const parsed = parseVideoBackfillText(text);
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((row, index) => normalizeBackfillVideoRow(row, index + 1));
  rows.forEach((row) => { if (row.error) errors.push({ rowNumber: row.rowNumber, message: row.error }); });
  const validRows = rows.filter((row) => !row.error);
  validRows.forEach((row) => { row.existing = findBackfillDuplicate(row); });
  return {
    rows,
    validRows,
    errors,
    addCandidates: validRows.filter((row) => !row.existing),
    updateCandidates: validRows.filter((row) => row.existing)
  };
}

function parseVideoBackfillText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { rows: [], errors: [{ rowNumber: "-", message: "Paste JSON or CSV-style video data first." }] };
  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.videos) ? parsed.videos : [parsed];
    return { rows, errors: [] };
  } catch {
    try {
      return { rows: parseDelimitedVideoText(trimmed), errors: [] };
    } catch (error) {
      return { rows: [], errors: [{ rowNumber: "-", message: error.message || "Could not read pasted video data." }] };
    }
  }
}

function parseDelimitedVideoText(text) {
  const delimiter = text.includes("\t") ? "\t" : text.includes("|") && !text.includes(",") ? "|" : ",";
  if (delimiter === ",") return parseCsv(text).rows;
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitDelimitedLine(lines.shift() || "", delimiter).map((header, index) => header.trim() || `Column ${index + 1}`);
  return lines.map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

function splitDelimitedLine(line, delimiter) {
  if (delimiter === "\t" || delimiter === "|") return String(line).split(delimiter).map((cell) => cell.trim());
  return parseCsv(line).rows[0] || [];
}

function normalizeBackfillVideoRow(raw, rowNumber) {
  const value = (fields) => backfillValue(raw, fields);
  const account = resolveBackfillAccount(value(["account", "workspace", "creator account"]));
  const productName = value(["product/topic", "product", "topic", "product name", "productName", "title"]);
  const hook = value(["hook", "hook text", "opening line"]);
  const datePosted = normalizeDateKey(value(["date posted", "datePosted", "posted date", "post date", "date"]));
  if (!account.id) return { rowNumber, error: "Account is required." };
  if (!datePosted) return { rowNumber, error: "Date posted is required." };
  if (!productName && !hook) return { rowNumber, error: "Product/topic or hook is required." };
  return {
    rowNumber,
    accountId: account.id,
    account: account.name,
    datePosted,
    productName: productName || "General topic",
    category: value(["category", "product category"]) || "Backfilled",
    hook: hook || productName || "Untitled historical video",
    contentPurpose: value(["purpose", "content purpose", "video purpose"]) || "Historical Backfill",
    hookType: value(["hook type", "creative type"]) || value(["purpose", "content purpose"]) || "Backfill",
    views: toNumber(value(["views", "video views"])),
    likes: toNumber(value(["likes"])),
    comments: toNumber(value(["comments"])),
    shares: toNumber(value(["shares"])),
    saves: toNumber(value(["saves/favorites", "saves", "favorites"])),
    averageWatchTime: toNumber(value(["average watch time", "avg watch time", "watch time"])),
    completionRate: toNumber(value(["completion %", "completion", "completion rate", "completionRate"])),
    newFollowers: toNumber(value(["followers gained", "new followers", "followers"])),
    sales: toNumber(value(["sales", "unit sales", "items sold"])),
    gmv: toNumber(value(["gmv", "gross revenue", "revenue"])),
    commission: toNumber(value(["commission", "creator commission"])),
    creatorRewardsEarned: toNumber(value(["creator rewards", "creator rewards earned", "estimated rewards", "rewards"])),
    notes: value(["notes", "note"]) || "",
    raw
  };
}

function backfillValue(raw, names) {
  const entries = Object.entries(raw || {});
  for (const name of names) {
    const target = normalizedName(name);
    const targetCompact = compactBackfillKey(name);
    const match = entries.find(([key]) => {
      const keyName = normalizedName(key);
      const keyCompact = compactBackfillKey(key);
      return keyName === target || keyName.includes(target) || target.includes(keyName) || keyCompact === targetCompact;
    });
    if (match && String(match[1] ?? "").trim()) return String(match[1]).trim();
  }
  return "";
}

function compactBackfillKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveBackfillAccount(accountName) {
  return accounts().find((account) => normalizedName(account.name) === normalizedName(accountName) || normalizedName(account.id) === normalizedName(accountName)) || {};
}

function findBackfillDuplicate(row) {
  const productKey = normalizedName(row.productName);
  const hookKey = normalizedName(row.hook);
  return videos().find((video) => {
    const sameAccount = video.accountId === row.accountId || normalizedName(video.account) === normalizedName(row.account);
    const sameDate = normalizeDateKey(video.datePosted || video.postedAt || "") === row.datePosted;
    const sameHook = hookKey && normalizedName(video.hook || "") === hookKey;
    const sameProduct = productKey && normalizedName(video.productName || "") === productKey;
    return sameAccount && sameDate && (sameHook || sameProduct);
  });
}

function confirmVideoBackfill() {
  const preview = videoBackfillState.preview || analyzeVideoBackfill(videoBackfillState.rawText);
  const summary = { added: 0, updated: 0, skipped: 0, errors: [...preview.errors] };
  preview.validRows.forEach((row) => {
    try {
      const result = upsertBackfillVideo(row);
      summary[result] += 1;
    } catch (error) {
      summary.errors.push({ rowNumber: row.rowNumber, message: error.message });
    }
  });
  normalizeVideoDatabase();
  db.videoBackfillHistory = db.videoBackfillHistory || [];
  const historyRecord = {
    id: uniqueImportId(`video-backfill-${Date.now()}`),
    importedAt: new Date().toISOString(),
    dateLabel: new Date().toLocaleString(),
    added: summary.added,
    updated: summary.updated,
    skipped: summary.skipped,
    errors: summary.errors.length
  };
  db.videoBackfillHistory.unshift(historyRecord);
  db.videoBackfillHistory = db.videoBackfillHistory.slice(0, 80);
  localStorage.setItem(VIDEO_BACKFILL_HISTORY_KEY, JSON.stringify(db.videoBackfillHistory));
  db.importHistory = db.importHistory || [];
  db.importHistory.unshift({
    id: uniqueImportId(`video-backfill-import-${Date.now()}`),
    importedAt: historyRecord.importedAt,
    importedLabel: historyRecord.dateLabel,
    fileName: "Import Center paste",
    rowsImported: summary.added + summary.updated,
    rowsSkipped: summary.skipped,
    account: "Mixed",
    dataType: "Import Center"
  });
  db.importHistory = db.importHistory.slice(0, 80);
  localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
  videoBackfillState.summary = summary;
  saveData("Video backfill saved to Polaris Database.");
  initializePulseEngine("video-backfill");
  renderVideoBackfill();
}

function upsertBackfillVideo(row) {
  const product = ensureImportedProduct(row.productName, getAccount(row.accountId), row.category);
  const existing = findBackfillDuplicate(row);
  const target = existing || { id: uniqueImportId(`video-backfill-${row.accountId}-${row.datePosted}-${slug(row.productName)}-${slug(row.hook)}`) };
  const previousMetrics = {
    sales: Number(target.sales || 0),
    gmv: Number(target.gmv || 0),
    commission: Number(target.commission || 0)
  };
  Object.assign(target, {
    datePosted: row.datePosted,
    accountId: row.accountId,
    account: row.account,
    productId: product.id,
    productName: product.name,
    category: row.category || product.categoryGroup,
    hook: row.hook,
    hookType: row.hookType,
    contentPurpose: row.contentPurpose,
    cta: target.cta || "",
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    averageWatchTime: row.averageWatchTime,
    completionRate: row.completionRate,
    newFollowers: row.newFollowers,
    sales: row.sales,
    gmv: row.gmv,
    commission: row.commission,
    creatorRewardsEarned: row.creatorRewardsEarned,
    estimatedRewards: row.creatorRewardsEarned,
    creatorRewardsEligible: row.creatorRewardsEarned > 0,
    notes: row.notes,
    source: "Import Center",
    importSource: "Polaris Import Center",
    importedAt: target.importedAt || new Date().toISOString()
  });
  if (!existing) db.videos.push(target);
  if (!product.firstPromotedDate || row.datePosted < product.firstPromotedDate) product.firstPromotedDate = row.datePosted;
  if (!product.lastPromotedDate || row.datePosted > product.lastPromotedDate) product.lastPromotedDate = row.datePosted;
  if (!product.bestHook && row.hook) product.bestHook = row.hook;
  if (row.sales || row.gmv || row.commission) {
    applySnapshotToProduct(product, {
      capturedAt: row.datePosted,
      sales: row.sales - previousMetrics.sales,
      gmv: row.gmv - previousMetrics.gmv,
      commission: row.commission - previousMetrics.commission
    });
  }
  return existing ? "updated" : "added";
}

function videoBackfillExample() {
  return `Account,Date posted,Product/topic,Category,Hook,Purpose,Views,Likes,Comments,Shares,Saves/favorites,Average watch time,Completion %,Followers gained,Sales,GMV,Commission,Creator rewards,Notes
Truth Tuned Tribe,2026-06-01,Example Peptide Topic,Health / Education,The peptide mistake most people miss,Revenue / Education,12500,240,18,52,91,5.2,2.4,12,3,74.97,6.12,4.50,Historical backfill example
Raised Right,2026-06-02,Example Garden Tool,Garden,This garden tool solved a problem in 10 seconds,Revenue / Product Demo,8600,118,9,31,44,6.1,4.8,5,2,39.98,5.10,0,Historical backfill example`;
}

/* Polaris Import Pipeline v1 - central import architecture */
function renderVideoBackfill() {
  normalizeVideoDatabase();
  const preview = videoBackfillState.preview;
  const history = readJson(VIDEO_BACKFILL_HISTORY_KEY, []);
  content.innerHTML = `
    <section class="import-hero video-backfill-hero import-center-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Project Polaris</p>
        <h1>Import Center</h1>
        <p>Bring video Signals into one Polaris Database through manual entry, CSV, screenshots, JSON, and future live sync.</p>
      </div>
      <span class="polaris-known-count">Polaris currently knows ${number.format(videos().length)} videos.</span>
    </section>

    <nav class="import-center-tabs" aria-label="Import Center tabs">
      ${importCenterTabs().map((tab) => `<button type="button" class="${videoBackfillState.activeTab === tab.id ? "active" : ""}" data-import-tab="${tab.id}">${tab.label}</button>`).join("")}
    </nav>

    ${importCenterTabMarkup()}
    ${preview ? videoBackfillPreviewMarkup(preview) : ""}
    ${videoBackfillState.summary ? videoBackfillSummaryMarkup(videoBackfillState.summary) : ""}
    ${polarisRoadmapCard()}

    <section class="card import-history-card">
      <div class="section-title"><div><h3>Import History</h3><p>Saved locally in this browser.</p></div></div>
      ${history.length ? `<div class="sync-history-table"><table><thead><tr><th>Date</th><th>Added</th><th>Updated</th><th>Skipped</th><th>Errors</th></tr></thead><tbody>${history.slice(0, 8).map((item) => `<tr><td>${item.dateLabel}</td><td>${item.added}</td><td>${item.updated}</td><td>${item.skipped}</td><td>${item.errors}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No imports yet.</p>`}
    </section>
  `;
  bindInternalButtons();
  bindVideoBackfillControls();
}

function importCenterTabs() {
  return [
    { id: "manual", label: "Manual" },
    { id: "csv", label: "CSV" },
    { id: "screenshots", label: "Screenshots" },
    { id: "json", label: "JSON" },
    { id: "live", label: "Future Live Sync" }
  ];
}

function importCenterTabMarkup() {
  if (videoBackfillState.activeTab === "manual") return manualImportTabMarkup();
  if (videoBackfillState.activeTab === "screenshots") return screenshotImportTabMarkup();
  if (videoBackfillState.activeTab === "json") return jsonImportTabMarkup();
  if (videoBackfillState.activeTab === "live") return liveSyncTabMarkup();
  return csvImportTabMarkup();
}

function manualImportTabMarkup() {
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Manual Add Video</h3><p>Manual entry stays available for one-off videos. Bulk work should use CSV or JSON.</p></div><span class="badge good">Available</span></div>
      <div class="grid two">
        <article class="import-source-card"><h4>Existing Add Video</h4><p>Use the Videos page when you need to add a single video by hand.</p><button class="icon-button" data-page="videos" type="button">Open Videos</button></article>
        <article class="import-source-card"><h4>Fast Capture</h4><p>Capture daily creator activity quickly when you do not have a CSV export.</p><button class="ghost-button" data-page="fastCapture" type="button">Open Fast Capture</button></article>
      </div>
    </section>
  `;
}

function csvImportTabMarkup() {
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>CSV Import</h3><p>Drag a TikTok CSV export here or paste CSV-style text. Northstar auto-maps common TikTok column names.</p></div><span class="badge good">Available</span></div>
      <label class="csv-drop-zone" id="videoCsvDropZone">
        <strong>Drag CSV here</strong>
        <span>or click to choose a file</span>
        <input id="videoCsvFile" type="file" accept=".csv,text/csv">
      </label>
      <textarea id="videoBackfillText" class="video-backfill-textarea" spellcheck="false" placeholder="Account,Date posted,Product/topic,Category,Hook,Purpose,Views,Likes,Comments,Shares,Saves/favorites,Average watch time,Completion %,Followers gained,Sales,GMV,Commission,Creator rewards,Notes">${escapeHtml(videoBackfillState.csvText || videoBackfillState.rawText)}</textarea>
      <div class="import-actions"><button class="icon-button" id="previewVideoBackfill" type="button">Preview CSV Import</button><button class="ghost-button" id="clearVideoBackfill" type="button">Clear</button></div>
    </section>
  `;
}

function jsonImportTabMarkup() {
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Batch JSON</h3><p>Paste an array of videos or an object with a <code>videos</code> array.</p></div><button class="ghost-button" id="loadBackfillExample" type="button">Example</button></div>
      <textarea id="videoBackfillText" class="video-backfill-textarea" spellcheck="false" placeholder='[{"account":"Truth Tuned Tribe","datePosted":"2026-06-01","productName":"Example","hook":"Opening line","views":1200}]'>${escapeHtml(videoBackfillState.jsonText || "")}</textarea>
      <div class="import-actions"><button class="icon-button" id="previewVideoBackfill" type="button">Preview JSON Import</button><button class="ghost-button" id="clearVideoBackfill" type="button">Clear</button></div>
    </section>
  `;
}

function screenshotImportTabMarkup() {
  return `
    <section class="card import-center-panel screenshot-placeholder">
      <div class="section-title"><div><h3>Import TikTok Screenshots</h3><p>Drop screenshots here. OCR is not active yet, but the parser hooks are ready.</p></div><span class="badge hot">Coming Soon</span></div>
      <div class="screenshot-drop-zone">
        <strong>Drop screenshots here</strong>
        <span>Supported: Analytics screenshots, Product screenshots, Rewards screenshots</span>
      </div>
      <div class="pipeline-note"><strong>Placeholder architecture</strong><code>parseScreenshot()</code><code>normalizeScreenshot()</code><code>importScreenshot()</code></div>
    </section>
  `;
}

function liveSyncTabMarkup() {
  const lastSync = latestNorthstarRefresh();
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Live TikTok Sync</h3><p>Future one-click sync. No live API connection is attempted in this local version.</p></div><span class="badge hot">Future</span></div>
      <div class="connected-account-grid">
        ${connectedAccountCard("Raised Right", "Manual / CSV / API Pending", lastSync)}
        ${connectedAccountCard("Truth Tuned Tribe", "Manual / CSV / API Pending", lastSync)}
      </div>
      <div class="update-center-note">Future live sync will need TikTok approval, secure login, a backend server, and protected token storage.</div>
      <button class="icon-button" id="futureLiveSyncButton" type="button">One-click Update</button>
    </section>
  `;
}

function polarisRoadmapCard() {
  const items = [
    ["done", "Manual Entry"],
    ["done", "Batch JSON"],
    ["active", "CSV Import"],
    ["planned", "Screenshot OCR"],
    ["planned", "TikTok Live Sync"],
    ["planned", "Creator Timeline"],
    ["planned", "Northstar Coach"]
  ];
  return `<section class="card polaris-roadmap"><div class="section-title"><div><h3>Project Polaris Roadmap</h3><p>Architecture-first path toward less manual work.</p></div></div><div class="roadmap-list">${items.map(([status, label]) => `<span class="${status}">${status === "done" ? "✓" : status === "active" ? "•" : "○"} ${label}</span>`).join("")}</div></section>`;
}

function bindVideoBackfillControls() {
  document.querySelectorAll("[data-import-tab]").forEach((button) => button.addEventListener("click", () => {
    videoBackfillState.activeTab = button.dataset.importTab;
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  }));
  document.querySelector("#videoBackfillText")?.addEventListener("input", (event) => {
    if (videoBackfillState.activeTab === "json") videoBackfillState.jsonText = event.target.value;
    else videoBackfillState.csvText = event.target.value;
    videoBackfillState.rawText = event.target.value;
    videoBackfillState.summary = null;
  });
  document.querySelector("#previewVideoBackfill")?.addEventListener("click", () => {
    videoBackfillState.rawText = document.querySelector("#videoBackfillText")?.value || "";
    videoBackfillState.preview = analyzeVideoBackfill(videoBackfillState.rawText, videoBackfillState.activeTab);
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#confirmVideoBackfill")?.addEventListener("click", confirmVideoBackfill);
  document.querySelector("#clearVideoBackfill")?.addEventListener("click", () => {
    if (videoBackfillState.activeTab === "json") videoBackfillState.jsonText = "";
    else videoBackfillState.csvText = "";
    videoBackfillState.rawText = "";
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#loadBackfillExample")?.addEventListener("click", () => {
    videoBackfillState.jsonText = JSON.stringify([
      { account: "Truth Tuned Tribe", datePosted: "2026-06-01", productName: "Example Peptide Topic", category: "Health / Education", hook: "The peptide mistake most people miss", purpose: "Revenue / Education", views: 12500, likes: 240, comments: 18, shares: 52, saves: 91, averageWatchTime: 5.2, completionRate: 2.4, newFollowers: 12, sales: 3, gmv: 74.97, commission: 6.12, creatorRewards: 4.5, notes: "Historical backfill example" }
    ], null, 2);
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#futureLiveSyncButton")?.addEventListener("click", () => showMessage("Live TikTok Sync is architected for the future. No API connection is active yet.", "warn"));
  bindCsvDropZone();
}

function bindCsvDropZone() {
  const dropZone = document.querySelector("#videoCsvDropZone");
  const fileInput = document.querySelector("#videoCsvFile");
  if (!dropZone || !fileInput) return;
  fileInput.addEventListener("change", (event) => readVideoCsvFile(event.target.files?.[0]));
  ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  }));
  dropZone.addEventListener("drop", (event) => readVideoCsvFile(event.dataTransfer?.files?.[0]));
}

function readVideoCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    videoBackfillState.csvText = String(reader.result || "");
    videoBackfillState.rawText = videoBackfillState.csvText;
    videoBackfillState.preview = analyzeVideoBackfill(videoBackfillState.rawText, "csv");
    videoBackfillState.summary = null;
    renderVideoBackfill();
  };
  reader.readAsText(file);
}

function analyzeVideoBackfill(text, mode = videoBackfillState.activeTab) {
  const parsed = parseVideoBackfillText(text, mode);
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((row, index) => normalizeVideo(row, index + 1));
  rows.forEach((row) => { if (row.error) errors.push({ rowNumber: row.rowNumber, message: row.error }); });
  const validRows = rows.filter((row) => !row.error);
  validRows.forEach((row) => { row.existing = detectDuplicate(row); });
  return {
    rows,
    validRows,
    errors,
    addCandidates: validRows.filter((row) => !row.existing),
    updateCandidates: validRows.filter((row) => row.existing)
  };
}

function parseVideoBackfillText(text, mode = "csv") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { rows: [], errors: [{ rowNumber: "-", message: "Paste or drop video data first." }] };
  if (mode === "json") {
    try {
      const parsed = JSON.parse(trimmed);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.videos) ? parsed.videos : [parsed];
      return { rows, errors: [] };
    } catch (error) {
      return { rows: [], errors: [{ rowNumber: "-", message: error.message || "Could not read JSON." }] };
    }
  }
  try {
    return { rows: parseDelimitedVideoText(trimmed), errors: [] };
  } catch (error) {
    return { rows: [], errors: [{ rowNumber: "-", message: error.message || "Could not read CSV-style video data." }] };
  }
}

function normalizeVideo(raw, rowNumber = 1) {
  return normalizeBackfillVideoRow(raw, rowNumber);
}

function detectDuplicate(video) {
  return findBackfillDuplicate(video);
}

function saveVideo(video) {
  return upsertBackfillVideo(video);
}

function refreshNorthstar(reason = "polaris-import") {
  normalizeVideoDatabase();
  saveData("Import saved to Polaris Database.");
  initializePulseEngine(reason);
}

function confirmVideoBackfill() {
  const preview = videoBackfillState.preview || analyzeVideoBackfill(videoBackfillState.rawText, videoBackfillState.activeTab);
  const summary = importVideoBatch(preview.validRows, `video-${videoBackfillState.activeTab}`, preview.errors);
  videoBackfillState.summary = summary;
  refreshNorthstar(`video-${videoBackfillState.activeTab}-import`);
  renderVideoBackfill();
}

function importVideoBatch(rows, source = "video-import", initialErrors = []) {
  const summary = { added: 0, updated: 0, skipped: 0, errors: [...initialErrors] };
  rows.forEach((row) => {
    try {
      const result = saveVideo(row);
      summary[result] += 1;
    } catch (error) {
      summary.errors.push({ rowNumber: row.rowNumber, message: error.message });
    }
  });
  writeVideoImportHistory(summary, source);
  return summary;
}

importVideoAnalyticsRow = function importVideoAnalyticsRowViaPolarisPipeline(row) {
  const normalized = normalizeVideo(row.data || {}, row.rowNumber || 1);
  if (normalized.error) return "skipped";
  const result = saveVideo(normalized);
  return result === "added" ? "imported" : "updated";
};

function writeVideoImportHistory(summary, source) {
  db.videoBackfillHistory = db.videoBackfillHistory || [];
  const historyRecord = {
    id: uniqueImportId(`video-import-${Date.now()}`),
    importedAt: new Date().toISOString(),
    dateLabel: new Date().toLocaleString(),
    source,
    added: summary.added,
    updated: summary.updated,
    skipped: summary.skipped,
    errors: summary.errors.length
  };
  db.videoBackfillHistory.unshift(historyRecord);
  db.videoBackfillHistory = db.videoBackfillHistory.slice(0, 80);
  localStorage.setItem(VIDEO_BACKFILL_HISTORY_KEY, JSON.stringify(db.videoBackfillHistory));
  db.importHistory = db.importHistory || [];
  db.importHistory.unshift({
    id: uniqueImportId(`video-import-history-${Date.now()}`),
    importedAt: historyRecord.importedAt,
    importedLabel: historyRecord.dateLabel,
    fileName: source === "video-csv" ? "TikTok CSV import" : source === "video-json" ? "Batch JSON import" : "Video import",
    rowsImported: summary.added + summary.updated,
    rowsSkipped: summary.skipped,
    account: "Mixed",
    dataType: "Video Import"
  });
  db.importHistory = db.importHistory.slice(0, 80);
  localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
}

function parseScreenshot(file) {
  return { file, status: "Coming Soon", rows: [] };
}

function normalizeScreenshot(parsedScreenshot) {
  return { ...parsedScreenshot, normalized: [], status: "Coming Soon" };
}

function importScreenshot(normalizedScreenshot) {
  return { ...normalizedScreenshot, imported: 0, status: "Coming Soon" };
}

/* Project Polaris - Data Source Audit + Sample Pipeline Upgrade */
const POLARIS_SAMPLE_SEED_VERSION = "polaris-sample-strategy-2026-07-v2";

const northstarSampleAuditNormalizeDatabase = normalizeDatabase;
normalizeDatabase = function normalizePolarisSamplesAndAudit() {
  northstarSampleAuditNormalizeDatabase();
  backupPolarisDataBeforeSampleMigration();
  normalizePolarisSamples();
  seedPolarisSampleIdeas();
};

function backupPolarisDataBeforeSampleMigration() {
  const backupKey = "northstar.v01.prePolarisSampleBackup";
  try {
    if (!localStorage.getItem(backupKey)) {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) localStorage.setItem(backupKey, current);
    }
  } catch {}
}

function polarisSamples() {
  db.samples = db.samples || db.sampleRecords || db.sampleRequests || [];
  db.sampleRecords = db.samples;
  db.sampleRequests = db.samples;
  return db.samples;
}

function normalizePolarisSamples() {
  const existingSampleRequests = db.sampleRequests || db["sample-requests"] || [];
  const existingSamples = db.samples || [];
  const existingSampleRecords = db.sampleRecords || [];
  const merged = [];
  [...existingSamples, ...existingSampleRecords, ...existingSampleRequests].forEach((sample, index) => {
    const normalized = normalizePolarisSample(sample, index);
    const key = sampleDuplicateKey(normalized);
    const current = merged.find((item) => sampleDuplicateKey(item) === key);
    if (current) Object.assign(current, { ...normalized, ...current });
    else merged.push(normalized);
  });
  db.samples = merged;
  db.sampleRecords = db.samples;
  db.sampleRequests = db.samples;
}

function sampleDuplicateKey(sample) {
  const accountKey = normalizedName(sample.account || "").includes("both") ? "both" : normalizedName(sample.account || sample.accountId || "");
  return `${normalizedName(sample.productName || sample.name)}::${accountKey}`;
}

function normalizePolarisSample(sample, index = 0) {
  const account = accounts().find((item) => item.id === sample.accountId || item.name === sample.account) || {};
  const relatedProduct = getProduct(sample.productId) || products().find((product) => normalizedName(product.name) === normalizedName(sample.productName || sample.name));
  const status = normalizeSampleStatus(sample.status);
  return {
    ...sample,
    id: sample.id || uniqueImportId(`sample-${sample.accountId || sample.account || "both"}-${sample.productName || sample.name || index}`),
    productName: sample.productName || sample.name || "Untitled sample",
    accountId: sample.accountId || account.id || relatedProduct?.accountId || "both",
    account: sample.account || account.name || relatedProduct?.account || "Both",
    brand: sample.brand || "",
    category: sample.category || relatedProduct?.categoryGroup || "Uncategorized",
    status,
    priority: sample.priority || "Medium",
    seasonality: sample.seasonality || sample.season || "Evergreen",
    season: sample.season || sample.seasonality || "Evergreen",
    dateRequested: sample.dateRequested || sample.requestedDate || "",
    dateApproved: sample.dateApproved || sample.approvedDate || "",
    dateShipped: sample.dateShipped || sample.shippedDate || "",
    dateDelivered: sample.dateDelivered || sample.deliveredDate || "",
    expectedArrival: sample.expectedArrival || "",
    campaignDueDate: sample.campaignDueDate || "",
    trackingNumber: sample.trackingNumber || "",
    trackingURL: sample.trackingURL || "",
    contentIdea: sample.contentIdea || "",
    hookIdea: sample.hookIdea || sample.bestHook || "",
    notes: sample.notes || "",
    productId: sample.productId || relatedProduct?.id || "",
    relatedProductId: sample.relatedProductId || relatedProduct?.id || sample.productId || "",
    relatedVideoId: sample.relatedVideoId || "",
    estimatedGMV: toNumber(sample.estimatedGMV || sample.estimatedGmv || sample.gmv),
    estimatedCommission: toNumber(sample.estimatedCommission || sample.commission),
    source: sample.source || "Polaris Database",
    lastUpdated: sample.lastUpdated || ""
  };
}

function normalizeSampleStatus(status) {
  const text = String(status || "").trim();
  if (/needs[_\s-]*content|pending[_\s-]*criteria|received/i.test(text)) return "Waiting to Film";
  if (/waiting.*film|ready.*film/i.test(text)) return "Waiting to Film";
  if (/selling|watch|wait/i.test(text)) return "Posted";
  if (/request now/i.test(text)) return "Request Now";
  if (/requested/i.test(text)) return "Requested";
  if (/approved/i.test(text)) return "Approved";
  if (/shipped/i.test(text)) return "Shipped";
  if (/delivered/i.test(text)) return "Delivered";
  if (/filmed/i.test(text)) return "Filmed";
  if (/complete|done/i.test(text)) return "Complete";
  if (/posted/i.test(text)) return "Posted";
  if (/idea/i.test(text)) return "Idea";
  return text || "Idea";
}

sampleStatusOptions = function polarisSampleStatusOptions() {
  return ["Idea", "Request Now", "Requested", "Approved", "Shipped", "Delivered", "Waiting to Film", "Filmed", "Posted", "Complete"];
};

function seedPolarisSampleIdeas() {
  db.seedLog = db.seedLog || [];
  if (db.seedLog.some((entry) => entry.version === POLARIS_SAMPLE_SEED_VERSION)) return;
  const ideas = [
    {
      productName: "More garden problem solvers",
      account: "Both",
      accountId: "both",
      category: "Garden",
      status: "Request Now",
      priority: "High",
      seasonality: "",
      notes: "Garden tools are performing well. Look for additional problem-solving products.",
      contentIdea: "Find more problem-solving garden products while garden momentum is still active.",
      hookIdea: "If you hate dealing with garden problems, watch this."
    },
    {
      productName: "Water testing / water quality products",
      account: "Raised Right",
      accountId: "raisedRight",
      category: "Health / Water",
      status: "Request Now",
      priority: "High",
      seasonality: "",
      notes: "Water tester fits health and curiosity angle.",
      contentIdea: "Test water at home and explain why people should care.",
      hookIdea: "Most people buying this do not realize what is in their water."
    },
    {
      productName: "Copper peptide / GHK-Cu products",
      account: "Both",
      accountId: "both",
      category: "Beauty / Health / Wellness",
      status: "Request Now",
      priority: "High",
      seasonality: "",
      notes: "Strong education potential. Needs curiosity-driven hook.",
      contentIdea: "Educational curiosity video about topical GHK-Cu.",
      hookIdea: "The most overlooked part of peptide skincare?"
    },
    {
      productName: "Peptide / wellness books",
      account: "Both",
      accountId: "both",
      category: "Health Book",
      status: "Request Now",
      priority: "High",
      seasonality: "",
      notes: "Peptide books are authority builders and revenue products.",
      contentIdea: "Use as authority-building educational content.",
      hookIdea: "Does it cover dosing? Yes, it does."
    },
    {
      productName: "Fall garden products",
      account: "Raised Right",
      accountId: "raisedRight",
      category: "Garden",
      status: "Idea",
      priority: "Medium",
      seasonality: "",
      notes: "Seasonal transition opportunity.",
      contentIdea: "Start preparing before summer garden products slow.",
      hookIdea: "Before summer garden season ends, start looking for this."
    },
    {
      productName: "Fall wellness / immune support products",
      account: "Truth Tuned Tribe",
      accountId: "truthTunedTribe",
      category: "Wellness",
      status: "Idea",
      priority: "Medium",
      seasonality: "",
      notes: "Good seasonal planning category.",
      contentIdea: "Prepare for fall wellness season.",
      hookIdea: "Everyone talks about this in fall, but here is what I noticed."
    }
  ];
  ideas.forEach((idea) => {
    const exists = polarisSamples().find((sample) => normalizedName(sample.productName) === normalizedName(idea.productName) && normalizedName(sample.account) === normalizedName(idea.account));
    if (exists && /seed/i.test(exists.source || "")) {
      Object.assign(exists, normalizePolarisSample({
        ...exists,
        ...idea,
        id: exists.id,
        status: exists.status || idea.status,
        dateRequested: exists.dateRequested || "",
        dateApproved: exists.dateApproved || "",
        dateShipped: exists.dateShipped || "",
        dateDelivered: exists.dateDelivered || "",
        source: exists.source || "Polaris sample seed",
        lastUpdated: new Date().toISOString()
      }));
      return;
    }
    if (!exists) {
      db.samples.push(normalizePolarisSample({
        id: uniqueImportId(`sample-${idea.accountId}-${slug(idea.productName)}`),
        ...idea,
        source: "Polaris sample seed"
      }));
    }
  });
  db.seedLog.push({ version: POLARIS_SAMPLE_SEED_VERSION, appliedAt: new Date().toISOString(), samples: ideas.length });
}

const northstarSampleAuditRenderExecutive = renderExecutive;
renderExecutive = function renderExecutiveWithPolarisSampleAudit() {
  northstarSampleAuditRenderExecutive();
  insertUpcomingContentInventory();
  insertMorningBriefDiagnostics();
  bindPolarisSampleControls();
};

function insertUpcomingContentInventory() {
  const spark = document.querySelector(".today-spark-card");
  const topThree = document.querySelector(".top-three-section");
  if (!spark || !topThree || document.querySelector(".upcoming-content-inventory")) return;
  topThree.insertAdjacentHTML("beforebegin", upcomingContentInventoryMarkup());
}

function upcomingContentInventoryMarkup() {
  const summary = samplePipelineSummary();
  return `
    <section class="card upcoming-content-inventory">
      <div class="section-title">
        <div><h3>Upcoming Content Inventory</h3><p>${summary.message}</p></div>
        <button class="chart-detail-link" data-page="samples" type="button">Open Sample Pipeline</button>
      </div>
      <div class="inventory-grid">
        ${inventoryMetric("Waiting to film", summary.waitingToFilm.length)}
        ${inventoryMetric("Approved", summary.approved.length)}
        ${inventoryMetric("Shipped", summary.shipped.length)}
        ${inventoryMetric("Delivered", summary.delivered.length)}
        ${inventoryMetric("High Priority", summary.highPriority.length)}
        ${inventoryMetric("Overdue", summary.overdue.length)}
      </div>
      <div class="brief-list inventory-list">
        ${summary.oldestUnfilmed ? `<article><strong>Oldest unfilmed sample</strong><span>${summary.oldestUnfilmed.productName} · ${summary.oldestUnfilmed.account} · ${summary.oldestUnfilmed.status}</span></article>` : `<article><strong>No unfilmed delivered samples yet</strong><span>Keep moving high-priority requests into the pipeline.</span></article>`}
        ${summary.highPriorityRequest.slice(0, 3).map((sample) => `<article><strong>${sample.productName}</strong><span>${sample.account} · ${sample.category} · ${sample.priority}</span></article>`).join("")}
      </div>
      <p class="polaris-source-line">Calculated from Polaris Database: ${number.format(summary.total)} samples.</p>
    </section>
  `;
}

function inventoryMetric(label, count) {
  return `<article><span>${label}</span><strong>${number.format(count)}</strong></article>`;
}

function samplePipelineSummary() {
  const list = polarisSamples();
  const today = new Date();
  const waitingToFilm = list.filter(sampleRequiresFilming);
  const approved = list.filter((sample) => sample.status === "Approved");
  const shipped = list.filter((sample) => sample.status === "Shipped");
  const delivered = list.filter((sample) => sample.status === "Delivered");
  const highPriority = list.filter((sample) => sample.priority === "High");
  const highPriorityRequest = list.filter((sample) => sample.priority === "High" && ["Idea", "Request Now"].includes(sample.status));
  const overdue = list.filter((sample) => {
    const dueDate = sample.campaignDueDate || sample.expectedArrival || "";
    if (!dueDate || ["Posted", "Complete"].includes(sample.status)) return false;
    const parsed = new Date(dueDate);
    return !Number.isNaN(parsed.getTime()) && parsed < today;
  });
  const unfilmed = list.filter((sample) => ["Approved", "Shipped"].includes(sample.status) || sampleRequiresFilming(sample)).sort((a, b) => new Date(a.dateRequested || a.dateApproved || a.dateDelivered || "2099-01-01") - new Date(b.dateRequested || b.dateApproved || b.dateDelivered || "2099-01-01"));
  const attention = waitingToFilm.length + approved.length + shipped.length + delivered.length + highPriorityRequest.length + overdue.length;
  const priorityNames = highPriorityRequest.slice(0, 2).map((sample) => sample.productName.toLowerCase()).join(" and ");
  return {
    total: list.length,
    waitingToFilm,
    approved,
    shipped,
    delivered,
    highPriority,
    highPriorityRequest,
    overdue,
    oldestUnfilmed: unfilmed[0],
    message: attention
      ? `${attention} sample opportunities need attention. ${priorityNames ? `${priorityNames} should be prioritized.` : "Prioritize the oldest unfilmed sample first."}`
      : "No urgent sample bottlenecks. Northstar is watching the pipeline."
  };
}

function insertMorningBriefDiagnostics() {
  const target = document.querySelector(".below-fold-intelligence");
  if (!target || document.querySelector(".morning-brief-diagnostics")) return;
  target.insertAdjacentHTML("beforeend", morningBriefDiagnosticsMarkup());
}

function morningBriefDiagnosticsMarkup() {
  const rows = morningBriefDataSourceAudit();
  return `
    <details class="developer-diagnostics morning-brief-diagnostics">
      <summary>Developer diagnostics: Morning Brief data sources</summary>
      <div class="sync-history-table"><table><thead><tr><th>Widget</th><th>Current source</th><th>Polaris source</th><th>Migration status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.widget}</td><td>${row.current}</td><td>${row.polaris}</td><td><span class="badge ${row.status === "Migrated" ? "good" : row.status === "Awaiting Polaris data" ? "hot" : ""}">${row.status}</span></td></tr>`).join("")}</tbody></table></div>
    </details>
  `;
}

function morningBriefDataSourceAudit() {
  return [
    { widget: "Brand Header / Date", current: "Browser date + static brand text", polaris: "Not database-backed", status: "Keep existing" },
    { widget: "Today's Spark", current: "categoryIntelligence(), scoredProducts(), Polaris change summary", polaris: "db.products + db.videos + Polaris change summary", status: "Migrated" },
    { widget: "Upcoming Content Inventory", current: "Polaris Sample Pipeline", polaris: "db.samples / db.sampleRecords", status: "Migrated" },
    { widget: "Today's Top Three", current: "buildActionPlan()", polaris: "db.products + db.videos + db.samples", status: "Migrated" },
    { widget: "Weekly Intelligence Brief", current: "weeklyIntelligenceBrief()", polaris: "db.products + db.videos + db.notes + db.samples", status: "Migrated" },
    { widget: "Top Opportunity", current: "scoredProducts()", polaris: "db.products with video momentum from db.videos", status: "Migrated" },
    { widget: "Double Down Engine", current: "doubleDownProducts()", polaris: "db.products + productVideos(db.videos)", status: "Migrated" },
    { widget: "Category Intelligence", current: "categoryIntelligence()", polaris: "db.products", status: "Migrated" },
    { widget: "Account Comparison", current: "accountComparison()", polaris: "db.accounts + db.products", status: "Migrated" },
    { widget: "Decision Log", current: "localStorage decision log", polaris: "Future db.actions / db.decisionRecords", status: "Awaiting Polaris data" },
    { widget: "Knowledge Vault", current: "db.notes", polaris: "db.notes / future db.lessons", status: "Keep existing" },
    { widget: "Product Movement", current: "scoredProducts()", polaris: "db.products + db.videos", status: "Migrated" },
    { widget: "Import Review", current: "db.importReviews", polaris: "db.importReviews / import batches", status: "Keep existing" },
    { widget: "Future AI Assistant", current: "Static placeholder", polaris: "Not applicable until Version 5", status: "Awaiting Polaris data" }
  ];
}

const northstarSampleAuditRenderSamples = renderSamples;
renderSamples = function renderPolarisSamplePipeline() {
  const columns = sampleStatusOptions();
  const list = polarisSamples();
  content.innerHTML = `
    <div class="section-title">
      <div><h3>Sample Pipeline</h3><p>Plan what needs to be requested, filmed, and posted next.</p></div>
      <span class="badge good">Calculated from Polaris Database: ${number.format(list.length)} samples</span>
    </div>
    <section class="card sample-pipeline-brief">
      <div class="section-title"><div><h3>Content Planning Summary</h3><p>${samplePipelineSummary().message}</p></div></div>
      <div class="inventory-grid">
        ${inventoryMetric("Request Now", list.filter((sample) => sample.status === "Request Now").length)}
        ${inventoryMetric("Approved", list.filter((sample) => sample.status === "Approved").length)}
        ${inventoryMetric("Delivered", list.filter((sample) => sample.status === "Delivered").length)}
        ${inventoryMetric("Waiting to Film", list.filter((sample) => sample.status === "Waiting to Film").length)}
        ${inventoryMetric("Posted", list.filter((sample) => sample.status === "Posted").length)}
        ${inventoryMetric("Complete", list.filter((sample) => sample.status === "Complete").length)}
      </div>
    </section>
    <div class="kanban sample-kanban">${columns.map((status) => `<section class="kanban-column"><h3>${status}</h3>${list.filter((item) => item.status === status).map(polarisSampleCard).join("") || `<p class="empty">No cards yet.</p>`}</section>`).join("")}</div>
  `;
  bindPolarisSampleControls();
};

function polarisSampleCard(item) {
  const relatedProduct = item.relatedProductId ? getProduct(item.relatedProductId) : null;
  const relatedVideo = item.relatedVideoId ? videos().find((video) => video.id === item.relatedVideoId) : null;
  return `
    <article class="sample-card polaris-sample-card">
      <div><h4>${item.productName}</h4><p>${item.account} · ${item.category}</p></div>
      <div class="product-meta"><span class="badge ${priorityClass(item.priority)}">${item.priority}</span><span class="badge">${item.seasonality}</span><span class="badge">${item.status}</span></div>
      <label class="sample-status">Status ${select(`sample-${item.id}`, sampleStatusOptions(), item.status).replace("<select", `<select data-sample-status="${item.id}"`)}</label>
      <dl class="sample-card-details">
        <div><dt>Requested</dt><dd>${item.dateRequested || "Not set"}</dd></div>
        <div><dt>Approved</dt><dd>${item.dateApproved || "Not set"}</dd></div>
        <div><dt>Shipped</dt><dd>${item.dateShipped || "Not set"}</dd></div>
        <div><dt>Delivered</dt><dd>${item.dateDelivered || "Not set"}</dd></div>
        <div><dt>Due</dt><dd>${item.campaignDueDate || item.expectedArrival || "Not set"}</dd></div>
      </dl>
      ${item.contentIdea ? `<p><strong>Content idea:</strong> ${item.contentIdea}</p>` : ""}
      ${item.hookIdea ? `<p><strong>Hook idea:</strong> ${item.hookIdea}</p>` : ""}
      <p>${item.notes}</p>
      <small>${relatedProduct ? `Related product: ${relatedProduct.name}` : "No related product yet"}${relatedVideo ? ` · Related video: ${shortName(relatedVideo.hook)}` : ""}</small>
    </article>
  `;
}

function bindPolarisSampleControls() {
  document.querySelectorAll("[data-sample-status]").forEach((selectEl) => {
    if (selectEl.dataset.boundPolarisSample) return;
    selectEl.dataset.boundPolarisSample = "true";
    selectEl.addEventListener("change", (event) => {
      const item = polarisSamples().find((sample) => sample.id === event.target.dataset.sampleStatus);
      if (!item) return;
      item.status = event.target.value;
      if (item.status === "Requested" && !item.dateRequested) item.dateRequested = new Date().toISOString().slice(0, 10);
      if (item.status === "Approved" && !item.dateApproved) item.dateApproved = new Date().toISOString().slice(0, 10);
      if (item.status === "Shipped" && !item.dateShipped) item.dateShipped = new Date().toISOString().slice(0, 10);
      if (item.status === "Delivered" && !item.dateDelivered) item.dateDelivered = new Date().toISOString().slice(0, 10);
      item.lastUpdated = new Date().toISOString();
      saveData(`${item.productName} moved to ${item.status}`);
      renderPage(activePage);
    });
  });
}

const northstarSampleAuditBuildActionPlan = buildActionPlan;
buildActionPlan = function buildActionPlanWithSamples() {
  const base = northstarSampleAuditBuildActionPlan();
  const sampleActions = samplePipelineActions();
  return [...sampleActions, ...base]
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.confidence - a.confidence)
    .slice(0, 18);
};

function samplePipelineActions() {
  const list = polarisSamples();
  const actions = [];
  const highRequest = list.find((sample) => sample.priority === "High" && ["Idea", "Request Now"].includes(sample.status));
  const delivered = list.find(sampleRequiresFilming);
  const requested = list.find((sample) => sample.status === "Requested");
  const shipped = list.find((sample) => sample.status === "Shipped");
  const needsHook = list.find((sample) => !sample.hookIdea && ["Idea", "Request Now", "Requested"].includes(sample.status));
  const filmed = list.find((sample) => sample.status === "Filmed");
  const posted = list.find((sample) => sample.status === "Posted");
  if (highRequest) actions.push(makeSampleAction("Request", `Request sample: ${highRequest.productName}`, highRequest, 88, `${highRequest.productName} is high priority and still needs to enter the sample pipeline.`));
  if (delivered) actions.push(makeSampleAction("Film", `Film delivered sample: ${delivered.productName}`, delivered, 86, `${delivered.productName} is delivered and ready for content.`));
  if (requested) actions.push(makeSampleAction("Watch", `Follow up on requested sample: ${requested.productName}`, requested, 76, `${requested.productName} has been requested; check whether it has been approved.`));
  if (shipped) actions.push(makeSampleAction("Watch", `Track shipped sample: ${shipped.productName}`, shipped, 70, `${shipped.productName} is shipped; prepare hook and filming plan before it arrives.`));
  if (needsHook) actions.push(makeSampleAction("Learn", `Create hook idea: ${needsHook.productName}`, needsHook, 68, `${needsHook.productName} needs a content angle before Jennifer spends effort on it.`));
  if (filmed) actions.push(makeSampleAction("Repost", `Post filmed sample: ${filmed.productName}`, filmed, 66, `${filmed.productName} is filmed; track whether it has been posted.`));
  if (posted) actions.push(makeSampleAction("Learn", `Move sample to complete: ${posted.productName}`, posted, 60, `${posted.productName} is posted; close the loop once results are reviewed.`));
  return actions;
}

function makeSampleAction(category, action, sample, confidence, reason) {
  return {
    id: `sample-action-${slug(category)}-${slug(sample.id)}-${new Date().toISOString().slice(0, 10)}`,
    dateRecommended: new Date().toISOString().slice(0, 10),
    category,
    action,
    account: sample.account,
    productId: sample.relatedProductId || sample.productId || "",
    productOrCategory: sample.productName,
    confidence,
    reason,
    priority: sample.priority || "Medium",
    status: "Open",
    resultNotes: "",
    dateCompleted: ""
  };
}

/* Project Polaris - Real Data Operating Sprint import extensions */
function importCenterTabs() {
  return [
    { id: "videos", label: "Videos" },
    { id: "samples", label: "Samples" },
    { id: "products", label: "Products" },
    { id: "sales", label: "Sales" },
    { id: "screenshots", label: "Screenshots Coming Soon" },
    { id: "live", label: "Live Sync Future" }
  ];
}

function importCenterTabMarkup() {
  if (!importCenterTabs().some((tab) => tab.id === videoBackfillState.activeTab)) videoBackfillState.activeTab = "videos";
  if (videoBackfillState.activeTab === "samples") return sampleImportTabMarkup();
  if (videoBackfillState.activeTab === "products") return productsImportTabMarkup();
  if (videoBackfillState.activeTab === "sales") return salesImportTabMarkup();
  if (videoBackfillState.activeTab === "screenshots") return screenshotImportTabMarkup();
  if (videoBackfillState.activeTab === "live") return liveSyncTabMarkup();
  return videosImportTabMarkup();
}

function videosImportTabMarkup() {
  const csvText = videoBackfillState.videoText || videoBackfillState.csvText || videoBackfillState.rawText || "";
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Video Import</h3><p>Drag a CSV export here or paste JSON/CSV video Signals. Everything flows through the Polaris video pipeline.</p></div><button class="ghost-button" id="loadBackfillExample" type="button">Example</button></div>
      <label class="csv-drop-zone" id="videoCsvDropZone">
        <strong>Drag video CSV here</strong>
        <span>or click to choose a file</span>
        <input id="videoCsvFile" type="file" accept=".csv,text/csv,.txt">
      </label>
      <textarea id="videoBackfillText" class="video-backfill-textarea" spellcheck="false" placeholder="Account,Date posted,Product/topic,Category,Hook,Purpose,Views,Likes,Comments,Shares,Saves/favorites,Average watch time,Completion %,Followers gained,Sales,GMV,Commission,Creator rewards,Notes">${escapeHtml(csvText)}</textarea>
      <div class="import-actions"><button class="icon-button" id="previewVideoBackfill" type="button">Preview Video Import</button><button class="ghost-button" id="clearVideoBackfill" type="button">Clear</button></div>
    </section>
  `;
}

function sampleImportTabMarkup() {
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Sample Import</h3><p>Paste JSON or CSV sample records. Duplicates are detected by Product Name + Account and update existing cards.</p></div><button class="ghost-button" id="loadBackfillExample" type="button">Sample Header</button></div>
      <textarea id="videoBackfillText" class="video-backfill-textarea" spellcheck="false" placeholder="${escapeHtml(sampleImportHeader())}">${escapeHtml(videoBackfillState.sampleText || "")}</textarea>
      <div class="import-actions"><button class="icon-button" id="previewVideoBackfill" type="button">Preview Sample Import</button><button class="ghost-button" id="clearVideoBackfill" type="button">Clear</button></div>
      <p class="pipeline-note">Sample duplicate rule: Product Name + Account. Existing samples are updated; new samples are added to <code>db.samples</code>.</p>
    </section>
  `;
}

function productsImportTabMarkup() {
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Product Import</h3><p>Product imports are routed through the existing Bulk Import workflow for now.</p></div><span class="badge hot">Ready via Bulk Import</span></div>
      <div class="grid two">
        <article class="import-source-card"><h4>Existing Product Capture</h4><p>Add individual products from Fast Capture or Products.</p><button class="icon-button" data-page="fastCapture" type="button">Open Fast Capture</button></article>
        <article class="import-source-card"><h4>Future Polaris Product Pipeline</h4><p>This tab is reserved for product catalog CSVs that will use the same normalize → duplicate check → save flow.</p></article>
      </div>
    </section>
  `;
}

function salesImportTabMarkup() {
  return `
    <section class="card import-center-panel">
      <div class="section-title"><div><h3>Sales Import</h3><p>Sales imports currently enter through video/product performance imports and monthly reports.</p></div><span class="badge hot">Pipeline reserved</span></div>
      <div class="update-center-note">Future sales imports will normalize GMV, commission, units, order date, product, and account into the Polaris Database without changing Morning Brief widgets.</div>
    </section>
  `;
}

function sampleImportHeader() {
  return "Account,Product Name,Brand,Category,Status,Priority,Date Requested,Date Approved,Date Shipped,Date Delivered,Expected Arrival,Campaign Due Date,Content Idea,Hook Idea,Notes";
}

function videoBackfillPreviewMarkup(preview) {
  if (preview.kind === "samples") return sampleImportPreviewMarkup(preview);
  return `
    <section class="card video-backfill-preview">
      <div class="section-title"><div><h3>Preview Before Import</h3><p>${preview.validRows.length} usable video rows detected.</p></div><span class="badge ${preview.errors.length ? "warn" : "good"}">${preview.errors.length} errors</span></div>
      <div class="grid four">
        ${metric("Videos Added", number.format(preview.addCandidates.length), "New records if imported", "")}
        ${metric("Videos Updated", number.format(preview.updateCandidates.length), "Duplicates that will update", "")}
        ${metric("Duplicates Skipped", "0", "Duplicates are updated by default", "")}
        ${metric("Errors", number.format(preview.errors.length), "Rows needing cleanup", "")}
      </div>
      ${preview.errors.length ? `<div class="import-message-list">${preview.errors.slice(0, 8).map((error) => `<p class="warn"><strong>Row ${error.rowNumber}</strong><span>${error.message}</span></p>`).join("")}</div>` : ""}
      <div class="table-card import-preview-table"><table><thead><tr><th>Status</th><th>Account</th><th>Date</th><th>Product/topic</th><th>Hook</th><th>Purpose</th><th>Views</th><th>Sales</th><th>GMV</th></tr></thead><tbody>${preview.validRows.slice(0, 40).map((row) => `<tr><td><span class="badge ${row.existing ? "hot" : "good"}">${row.existing ? "Update existing" : "Create new"}</span></td><td>${row.account}</td><td>${row.datePosted}</td><td>${row.productName}</td><td><strong>${row.hook}</strong></td><td>${row.contentPurpose}</td><td>${number.format(row.views || 0)}</td><td>${number.format(row.sales || 0)}</td><td>${money.format(row.gmv || 0)}</td></tr>`).join("") || `<tr><td colspan="9">No valid rows yet.</td></tr>`}</tbody></table></div>
      <div class="import-actions">
        <button class="icon-button" id="confirmVideoBackfill" type="button" ${preview.validRows.length ? "" : "disabled"}>Import Into Polaris Database</button>
        <button class="ghost-button" data-page="videos" type="button">View Videos</button>
      </div>
    </section>
  `;
}

function sampleImportPreviewMarkup(preview) {
  return `
    <section class="card video-backfill-preview">
      <div class="section-title"><div><h3>Preview Sample Import</h3><p>${preview.validRows.length} usable sample rows detected.</p></div><span class="badge ${preview.errors.length ? "warn" : "good"}">${preview.errors.length} errors</span></div>
      <div class="grid four">
        ${metric("Samples Added", number.format(preview.addCandidates.length), "New sample cards", "")}
        ${metric("Samples Updated", number.format(preview.updateCandidates.length), "Existing cards refreshed", "")}
        ${metric("Duplicates Skipped", "0", "Duplicates update by default", "")}
        ${metric("Errors", number.format(preview.errors.length), "Rows needing cleanup", "")}
      </div>
      ${preview.errors.length ? `<div class="import-message-list">${preview.errors.slice(0, 8).map((error) => `<p class="warn"><strong>Row ${error.rowNumber}</strong><span>${error.message}</span></p>`).join("")}</div>` : ""}
      <div class="table-card import-preview-table"><table><thead><tr><th>Status</th><th>Account</th><th>Product</th><th>Category</th><th>Priority</th><th>Pipeline</th><th>Content idea</th><th>Hook idea</th></tr></thead><tbody>${preview.validRows.slice(0, 40).map((row) => `<tr><td><span class="badge ${row.existing ? "hot" : "good"}">${row.existing ? "Update existing" : "Create new"}</span></td><td>${row.account}</td><td><strong>${row.productName}</strong></td><td>${row.category}</td><td>${row.priority}</td><td>${row.status}</td><td>${row.contentIdea}</td><td>${row.hookIdea}</td></tr>`).join("") || `<tr><td colspan="8">No valid rows yet.</td></tr>`}</tbody></table></div>
      <div class="import-actions">
        <button class="icon-button" id="confirmVideoBackfill" type="button" ${preview.validRows.length ? "" : "disabled"}>Import Samples Into Polaris</button>
        <button class="ghost-button" data-page="samples" type="button">View Sample Pipeline</button>
      </div>
    </section>
  `;
}

function videoBackfillSummaryMarkup(summary) {
  const label = summary.kind === "samples" ? "Sample Import Complete" : "Video Import Complete";
  const noun = summary.kind === "samples" ? "Samples" : "Videos";
  return `
    <section class="card import-done">
      <div class="section-title"><div><h3>${label}</h3><p>Records were saved to the Polaris Database and Northstar intelligence was refreshed.</p></div><span class="badge good">Saved</span></div>
      <div class="grid four">
        ${metric(`${noun} Added`, number.format(summary.added), "New records", "")}
        ${metric(`${noun} Updated`, number.format(summary.updated), "Existing records refreshed", "")}
        ${metric("Duplicates Skipped", number.format(summary.skipped), "Rows not imported", "")}
        ${metric("Errors", number.format(summary.errors.length), "Rows needing review", "")}
      </div>
      <div class="import-actions"><button class="icon-button" data-page="${summary.kind === "samples" ? "samples" : "videos"}" type="button">Open ${summary.kind === "samples" ? "Sample Pipeline" : "Videos"}</button><button class="ghost-button" data-page="actionPlan" type="button">Open Action Plan</button></div>
    </section>
  `;
}

function bindVideoBackfillControls() {
  if (!importCenterTabs().some((tab) => tab.id === videoBackfillState.activeTab)) videoBackfillState.activeTab = "videos";
  document.querySelectorAll("[data-import-tab]").forEach((button) => button.addEventListener("click", () => {
    videoBackfillState.activeTab = button.dataset.importTab;
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  }));
  document.querySelector("#videoBackfillText")?.addEventListener("input", (event) => {
    if (videoBackfillState.activeTab === "samples") videoBackfillState.sampleText = event.target.value;
    else videoBackfillState.videoText = event.target.value;
    videoBackfillState.rawText = event.target.value;
    videoBackfillState.summary = null;
  });
  document.querySelector("#previewVideoBackfill")?.addEventListener("click", () => {
    videoBackfillState.rawText = document.querySelector("#videoBackfillText")?.value || "";
    videoBackfillState.preview = analyzeVideoBackfill(videoBackfillState.rawText, videoBackfillState.activeTab);
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#confirmVideoBackfill")?.addEventListener("click", confirmVideoBackfill);
  document.querySelector("#clearVideoBackfill")?.addEventListener("click", () => {
    if (videoBackfillState.activeTab === "samples") videoBackfillState.sampleText = "";
    else videoBackfillState.videoText = "";
    videoBackfillState.rawText = "";
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#loadBackfillExample")?.addEventListener("click", () => {
    if (videoBackfillState.activeTab === "samples") {
      videoBackfillState.sampleText = `${sampleImportHeader()}\nBoth,More garden problem solvers,,Garden,Request Now,High,,,,,,,Show a useful problem-solving garden tool in action.,This solved a garden problem I did not know had a fix.,Garden tools are performing well.`;
    } else {
      videoBackfillState.videoText = videoBackfillExample();
    }
    videoBackfillState.preview = null;
    videoBackfillState.summary = null;
    renderVideoBackfill();
  });
  document.querySelector("#futureLiveSyncButton")?.addEventListener("click", () => showMessage("Live TikTok Sync is architected for the future. No API connection is active yet.", "warn"));
  bindCsvDropZone();
}

function readVideoCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    videoBackfillState.videoText = String(reader.result || "");
    videoBackfillState.rawText = videoBackfillState.videoText;
    videoBackfillState.preview = analyzeVideoBackfill(videoBackfillState.rawText, "videos");
    videoBackfillState.summary = null;
    renderVideoBackfill();
  };
  reader.readAsText(file);
}

function analyzeVideoBackfill(text, mode = videoBackfillState.activeTab) {
  if (mode === "samples") return analyzeSampleImport(text);
  const trimmed = String(text || "").trim();
  const videoMode = mode === "videos" && (/^\[/.test(trimmed) || /^{/.test(trimmed)) ? "json" : mode === "videos" ? "csv" : mode;
  const parsed = parseVideoBackfillText(text, videoMode);
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((row, index) => normalizeVideo(row, index + 1));
  rows.forEach((row) => { if (row.error) errors.push({ rowNumber: row.rowNumber, message: row.error }); });
  const validRows = rows.filter((row) => !row.error);
  validRows.forEach((row) => { row.existing = detectDuplicate(row); });
  return {
    kind: "videos",
    rows,
    validRows,
    errors,
    addCandidates: validRows.filter((row) => !row.existing),
    updateCandidates: validRows.filter((row) => row.existing)
  };
}

function analyzeSampleImport(text) {
  const parsed = parseSampleImportText(text);
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((row, index) => normalizeSampleImportRow(row, index + 1));
  rows.forEach((row) => { if (row.error) errors.push({ rowNumber: row.rowNumber, message: row.error }); });
  const validRows = rows.filter((row) => !row.error);
  validRows.forEach((row) => { row.existing = detectSampleDuplicate(row); });
  return {
    kind: "samples",
    rows,
    validRows,
    errors,
    addCandidates: validRows.filter((row) => !row.existing),
    updateCandidates: validRows.filter((row) => row.existing)
  };
}

function parseSampleImportText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { rows: [], errors: [{ rowNumber: "-", message: "Paste JSON or CSV-style sample data first." }] };
  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.samples) ? parsed.samples : [parsed];
    return { rows, errors: [] };
  } catch {
    try {
      return { rows: parseDelimitedVideoText(trimmed), errors: [] };
    } catch (error) {
      return { rows: [], errors: [{ rowNumber: "-", message: error.message || "Could not read pasted sample data." }] };
    }
  }
}

function normalizeSampleImportRow(raw, rowNumber) {
  const value = (fields) => backfillValue(raw, fields);
  const productName = value(["product name", "product", "sample", "name"]);
  const accountText = value(["account", "workspace", "creator account"]) || "Both";
  const account = resolveBackfillAccount(accountText);
  if (!productName) return { rowNumber, error: "Product Name is required." };
  const normalized = normalizePolarisSample({
    accountId: account.id || (normalizedName(accountText) === "both" ? "both" : ""),
    account: account.name || accountText,
    productName,
    brand: value(["brand"]),
    category: value(["category"]) || "Uncategorized",
    status: value(["status", "sample status"]) || "Idea",
    priority: value(["priority"]) || "Medium",
    dateRequested: normalizeDateKey(value(["date requested", "requested", "requested date"])),
    dateApproved: normalizeDateKey(value(["date approved", "approved", "approved date"])),
    dateShipped: normalizeDateKey(value(["date shipped", "shipped", "shipped date"])),
    dateDelivered: normalizeDateKey(value(["date delivered", "delivered", "delivered date"])),
    expectedArrival: normalizeDateKey(value(["expected arrival", "arrival", "eta"])),
    campaignDueDate: normalizeDateKey(value(["campaign due date", "due date", "content due"])),
    trackingNumber: value(["tracking number", "tracking"]),
    trackingURL: value(["tracking url", "tracking link"]),
    contentIdea: value(["content idea", "content"]),
    hookIdea: value(["hook idea", "hook"]),
    notes: value(["notes", "note"]),
    estimatedGMV: toNumber(value(["estimated gmv", "gmv"])),
    estimatedCommission: toNumber(value(["estimated commission", "commission"])),
    source: "Polaris Sample Import",
    lastUpdated: new Date().toISOString()
  }, rowNumber);
  return { ...normalized, rowNumber, raw };
}

function detectSampleDuplicate(row) {
  const rowKey = sampleDuplicateKey(row);
  return polarisSamples().find((sample) => sampleDuplicateKey(sample) === rowKey);
}

function saveSample(row) {
  const existing = detectSampleDuplicate(row);
  if (existing) {
    Object.assign(existing, normalizePolarisSample({ ...existing, ...row, id: existing.id, lastUpdated: new Date().toISOString() }));
    return "updated";
  }
  db.samples.push(normalizePolarisSample({ ...row, id: uniqueImportId(`sample-import-${row.accountId || row.account}-${slug(row.productName)}`), lastUpdated: new Date().toISOString() }));
  db.sampleRecords = db.samples;
  db.sampleRequests = db.samples;
  return "added";
}

function confirmVideoBackfill() {
  const preview = videoBackfillState.preview || analyzeVideoBackfill(videoBackfillState.rawText, videoBackfillState.activeTab);
  if (preview.kind === "samples") {
    videoBackfillState.summary = importSampleBatch(preview.validRows, preview.errors);
    refreshNorthstar("sample-import");
  } else {
    videoBackfillState.summary = importVideoBatch(preview.validRows, `video-${videoBackfillState.activeTab}`, preview.errors);
    refreshNorthstar(`video-${videoBackfillState.activeTab}-import`);
  }
  renderVideoBackfill();
}

function importSampleBatch(rows, initialErrors = []) {
  const summary = { kind: "samples", added: 0, updated: 0, skipped: 0, errors: [...initialErrors] };
  rows.forEach((row) => {
    try {
      const result = saveSample(row);
      summary[result] += 1;
    } catch (error) {
      summary.errors.push({ rowNumber: row.rowNumber, message: error.message });
    }
  });
  writeSampleImportHistory(summary);
  return summary;
}

function writeSampleImportHistory(summary) {
  db.importHistory = db.importHistory || [];
  db.importHistory.unshift({
    id: uniqueImportId(`sample-import-history-${Date.now()}`),
    importedAt: new Date().toISOString(),
    importedLabel: new Date().toLocaleString(),
    fileName: "Sample Import Center paste",
    rowsImported: summary.added + summary.updated,
    rowsSkipped: summary.skipped,
    account: "Mixed",
    dataType: "Sample Import"
  });
  db.importHistory = db.importHistory.slice(0, 80);
  try {
    localStorage.setItem(BULK_IMPORT_HISTORY_KEY, JSON.stringify(db.importHistory));
  } catch {}
}

/* Northstar Morning Brief v2 - account-based briefing */
const northstarAccountBriefRenderExecutive = renderExecutive;
renderExecutive = function renderExecutiveWithAccountBriefing() {
  northstarAccountBriefRenderExecutive();
  insertCeoSummary();
  insertAccountBriefSections();
};

function northstarBriefAccounts() {
  return accounts().filter((account) => ["Raised Right", "Truth Tuned Tribe"].includes(account.name));
}

function insertCeoSummary() {
  const hero = document.querySelector(".executive-brief-hero");
  if (!hero || document.querySelector(".ceo-summary-card")) return;
  hero.insertAdjacentHTML("afterend", ceoSummaryMarkup());
}

function ceoSummaryMarkup() {
  const priority = topOverallPriority();
  return `
    <section class="card ceo-summary-card">
      <div>
        <span class="account-brief-label">CEO Summary</span>
        <h2>${priority.title}</h2>
        <p>${priority.reason}</p>
      </div>
      <div class="ceo-summary-meta">
        <span>${priority.account}</span>
        <strong>${priority.scoreLabel}</strong>
        <small>${priority.subject}</small>
      </div>
      <button class="chart-detail-link" data-page="actionPlan" type="button">Open Action Plan</button>
    </section>
  `;
}

function topOverallPriority() {
  const actions = buildActionPlan().filter((action) => ["Raised Right", "Truth Tuned Tribe", "Both"].includes(action.account));
  const bestAction = actions[0];
  const bestProduct = scoredProducts()[0];
  if (bestAction) {
    return {
      title: bestAction.action,
      account: bestAction.account || bestProduct?.account || "Both accounts",
      subject: bestAction.productOrCategory || bestProduct?.name || "Creator business",
      reason: bestAction.reason || "Highest priority Signal across both accounts.",
      scoreLabel: `${Math.round(bestAction.confidence || 0)}% confidence`
    };
  }
  if (bestProduct) {
    return {
      title: `Film again: ${shortName(bestProduct.name)}`,
      account: bestProduct.account,
      subject: bestProduct.name,
      reason: `${bestProduct.name} has the highest Opportunity Score and strongest available Polaris Signal.`,
      scoreLabel: `${opportunityScore(bestProduct).score} Opportunity`
    };
  }
  return {
    title: "Capture fresh creator data",
    account: "Both accounts",
    subject: "Polaris Database",
    reason: "Northstar needs products, videos, samples, or sales before choosing a confident top priority.",
    scoreLabel: "Awaiting data"
  };
}

function insertAccountBriefSections() {
  const belowFold = document.querySelector(".below-fold-intelligence");
  if (!belowFold || document.querySelector(".account-briefs-section")) return;
  belowFold.insertAdjacentHTML("beforebegin", accountBriefsMarkup());
}

function accountBriefsMarkup() {
  return `
    <section class="account-briefs-section">
      ${northstarBriefAccounts().map(accountBriefMarkup).join("")}
    </section>
  `;
}

function accountBriefMarkup(account) {
  const brief = accountBriefData(account);
  return `
    <section class="card account-brief-card">
      <div class="account-brief-header">
        <div>
          <span class="account-brief-label">${account.name}</span>
          <h2>${account.name} Brief</h2>
        </div>
        <p>${brief.spark}</p>
      </div>
      <div class="account-brief-grid">
        <article class="account-brief-panel account-actions-panel">
          <h3>Top Three Actions</h3>
          ${brief.actions.map(accountActionMarkup).join("")}
        </article>
        <article class="account-brief-panel">
          <h3>Sample Inventory</h3>
          ${accountSampleInventoryMarkup(brief.samples)}
        </article>
        <article class="account-brief-panel">
          <h3>Revenue Snapshot</h3>
          ${accountRevenueMarkup(brief.revenue)}
        </article>
        <article class="account-brief-panel">
          <h3>Content Snapshot</h3>
          ${accountContentMarkup(brief.content)}
        </article>
      </div>
    </section>
  `;
}

function accountBriefData(account) {
  const productList = accountProducts(account.id);
  const videoList = accountVideos(account);
  const sampleList = accountSamples(account);
  const actions = accountTopThreeActions(account, productList, videoList, sampleList);
  return {
    spark: accountSpark(account, productList, videoList, sampleList),
    actions,
    samples: accountSampleSummary(sampleList),
    revenue: accountRevenueSnapshot(account, productList),
    content: accountContentSnapshot(videoList)
  };
}

function accountProducts(accountId) {
  return products().filter((product) => product.accountId === accountId || getAccount(product.accountId)?.id === accountId);
}

function accountVideos(account) {
  return videos().filter((video) => video.accountId === account.id || normalizedName(video.account) === normalizedName(account.name));
}

function accountSamples(account) {
  return polarisSamples().filter((sample) => sampleBelongsToAccount(sample, account));
}

function sampleBelongsToAccount(sample, account) {
  const accountText = normalizedName(sample.account || sample.accountId || "");
  return sample.accountId === account.id || accountText === normalizedName(account.name) || accountText === normalizedName(account.id) || accountText.includes("both") || accountText.includes("tbd");
}

function sharedSamples() {
  return polarisSamples().filter((sample) => {
    const text = normalizedName(sample.account || sample.accountId || "");
    return sample.accountId === "both" || text.includes("both") || text.includes("tbd");
  });
}

function accountSpark(account, productList, videoList, sampleList) {
  const topProduct = productList.slice().sort((a, b) => opportunityScore(b).score - opportunityScore(a).score)[0];
  const topVideo = videoList.slice().sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
  const highPrioritySamples = sampleList.filter((sample) => sample.priority === "High" && ["Idea", "Request Now", "Requested"].includes(sample.status));
  if (topProduct && opportunityScore(topProduct).score >= 70) return `${topProduct.name} is the strongest ${account.name} Signal at ${opportunityScore(topProduct).score} Opportunity.`;
  if (topVideo && Number(topVideo.views || 0) > 0) return `${shortName(topVideo.productName || topVideo.hook)} is the top content Signal with ${number.format(topVideo.views || 0)} views.`;
  if (highPrioritySamples.length) return `${highPrioritySamples[0].productName} needs attention in the sample pipeline.`;
  return `No major ${account.name} Spark detected yet. Northstar is watching this account's Signals.`;
}

function accountTopThreeActions(account, productList, videoList, sampleList) {
  const accountActions = buildActionPlan().filter((action) => normalizedName(action.account) === normalizedName(account.name) || normalizedName(action.account).includes("both"));
  const filmAction = accountActions.find((action) => action.category === "Film") || makeAccountFilmFallback(account, productList, videoList);
  const requestAction = accountActions.find((action) => action.category === "Request") || makeAccountRequestFallback(account, sampleList);
  const watchAction = accountActions.find((action) => ["Watch", "Retire", "Learn"].includes(action.category)) || makeAccountWatchFallback(account, productList, videoList);
  return [
    normalizeAccountAction("Film", filmAction, account),
    normalizeAccountAction("Request", requestAction, account),
    normalizeAccountAction("Watch / Improve", watchAction, account)
  ];
}

function normalizeAccountAction(label, action, account) {
  return {
    label,
    title: action?.action || `${label}: Capture more data`,
    subject: action?.productOrCategory || account.name,
    confidence: Math.round(action?.confidence || 55),
    reason: action?.reason || "Northstar needs more Polaris data for a stronger recommendation."
  };
}

function makeAccountFilmFallback(account, productList, videoList) {
  const product = productList.slice().sort((a, b) => opportunityScore(b).score - opportunityScore(a).score)[0];
  const video = videoList.slice().sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0) || Number(b.views || 0) - Number(a.views || 0))[0];
  if (product) return makeAction("Film", `Film again: ${shortName(product.name)}`, product, confidenceForAction(product, "Film"), `${product.name} is the strongest available product Signal for ${account.name}.`, product.name, "High");
  if (video) return { action: `Remake: ${shortName(video.productName || video.hook)}`, productOrCategory: video.productName || video.hook, confidence: 62, reason: `${shortName(video.productName || video.hook)} is the strongest available video Signal for ${account.name}.` };
  return null;
}

function makeAccountRequestFallback(account, sampleList) {
  const sample = sampleList.find((item) => item.priority === "High" && ["Idea", "Request Now"].includes(item.status));
  if (!sample) return null;
  return { action: `Request sample: ${sample.productName}`, productOrCategory: sample.productName, confidence: 78, reason: `${sample.productName} is high priority in ${account.name}'s sample inventory.` };
}

function makeAccountWatchFallback(account, productList, videoList) {
  const slowing = productList.find((product) => productLifecycle(product).stage === "Slowing" || opportunityScore(product).score < 60);
  if (slowing) return makeAction("Watch", `Analyze: ${shortName(slowing.name)}`, slowing, confidenceForAction(slowing, "Watch"), `${slowing.name} needs review before Jennifer spends more creative energy.`, slowing.categoryGroup, "Medium");
  const weakVideo = videoList.filter((video) => Number(video.views || 0) > 0).sort((a, b) => Number(a.sales || 0) - Number(b.sales || 0) || Number(a.completionRate || 0) - Number(b.completionRate || 0))[0];
  if (weakVideo) return { action: `Improve: ${shortName(weakVideo.productName || weakVideo.hook)}`, productOrCategory: weakVideo.productName || weakVideo.hook, confidence: 58, reason: `${shortName(weakVideo.productName || weakVideo.hook)} has weaker sales or completion Signals than this account's best content.` };
  return null;
}

function accountActionMarkup(action) {
  return `<div class="account-action-row"><span>${action.label}</span><strong>${action.subject}</strong><small>${action.confidence}% · ${action.reason}</small></div>`;
}

function accountSampleSummary(sampleList) {
  return {
    waitingToFilm: sampleList.filter(sampleRequiresFilming),
    approved: sampleList.filter((sample) => sample.status === "Approved"),
    shipped: sampleList.filter((sample) => sample.status === "Shipped"),
    delivered: sampleList.filter((sample) => sample.status === "Delivered"),
    highPriority: sampleList.filter((sample) => sample.priority === "High" && ["Idea", "Request Now", "Requested"].includes(sample.status))
  };
}

function accountSampleInventoryMarkup(summary) {
  const rows = [
    ["Waiting to Film", summary.waitingToFilm],
    ["Approved", summary.approved],
    ["Shipped", summary.shipped],
    ["Delivered", summary.delivered],
    ["High Priority", summary.highPriority]
  ];
  return `<div class="account-sample-list">${rows.map(([label, list]) => `<div><span>${label}</span><strong>${number.format(list.length)}</strong><small>${sampleNameList(list)}</small></div>`).join("")}</div>`;
}

function sampleNameList(list) {
  return list.slice(0, 3).map((sample) => sample.productName).join(", ") || "None";
}

function accountRevenueSnapshot(account, productList) {
  const sales = accountSalesRecords(account);
  if (sales.length) {
    const totals = sales.reduce((acc, row) => {
      acc.gmv += toNumber(row.gmv || row.revenue || row.grossRevenue);
      acc.commission += toNumber(row.commission || row.creatorCommission);
      acc.units += toNumber(row.unitsSold || row.sales || row.itemsSold || row.units);
      return acc;
    }, { gmv: 0, commission: 0, units: 0 });
    const topProductName = sales.slice().sort((a, b) => toNumber(b.gmv || b.revenue) - toNumber(a.gmv || a.revenue))[0]?.productName || "No product yet";
    return { ...totals, topProductName, source: "db.salesRecords" };
  }
  const totals = productList.reduce((acc, product) => {
    acc.gmv += Number(product.lifetimeGmv || 0);
    acc.commission += Number(product.lifetimeCommission || 0);
    acc.units += Number(product.lifetimeUnits || 0);
    return acc;
  }, { gmv: 0, commission: 0, units: 0 });
  const topProduct = productList.slice().sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0))[0];
  return { ...totals, topProductName: topProduct?.name || "No product yet", source: productList.length ? "db.products" : "Awaiting Polaris data" };
}

function accountSalesRecords(account) {
  const rows = db.salesRecords || db.sales || [];
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row.accountId === account.id || normalizedName(row.account) === normalizedName(account.name));
}

function accountRevenueMarkup(revenue) {
  return `<div class="account-metric-grid"><div><span>GMV</span><strong>${money.format(revenue.gmv || 0)}</strong></div><div><span>Commission</span><strong>${money.format(revenue.commission || 0)}</strong></div><div><span>Items sold</span><strong>${number.format(revenue.units || 0)}</strong></div><div><span>Top product</span><strong>${revenue.topProductName}</strong></div></div>`;
}

function accountContentSnapshot(videoList) {
  const topVideo = videoList.slice().sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
  const growthVideo = videoList.slice().sort((a, b) => Number(b.newFollowers || 0) - Number(a.newFollowers || 0) || Number(b.shares || 0) - Number(a.shares || 0))[0];
  const educationVideo = videoList.find((video) => /education|trust|authority|curiosity|community/i.test(`${video.contentPurpose || ""} ${video.hookType || ""} ${video.notes || ""}`)) || videoList.slice().sort((a, b) => Number(b.saves || 0) - Number(a.saves || 0))[0];
  const underperformingVideo = videoList.filter((video) => Number(video.views || 0) > 0).sort((a, b) => Number(a.sales || 0) - Number(b.sales || 0) || Number(a.completionRate || 0) - Number(b.completionRate || 0))[0];
  return { topVideo, growthVideo, educationVideo, underperformingVideo };
}

function accountContentMarkup(contentData) {
  const rows = [
    ["Top video", contentData.topVideo],
    ["Growth video", contentData.growthVideo],
    ["Trust / education", contentData.educationVideo],
    ["Underperforming", contentData.underperformingVideo]
  ];
  return `<div class="account-content-list">${rows.map(([label, video]) => `<div><span>${label}</span><strong>${video ? shortName(video.productName || video.hook) : "Awaiting data"}</strong><small>${video ? `${number.format(video.views || 0)} views · ${number.format(video.sales || 0)} sales` : "No Polaris video Signal yet"}</small></div>`).join("")}</div>`;
}

function upcomingContentInventoryMarkup() {
  const accountSummaries = northstarBriefAccounts().map((account) => ({ account, summary: accountSampleSummary(accountSamples(account)) }));
  const shared = sharedSamples();
  const total = polarisSamples().length;
  return `
    <section class="card upcoming-content-inventory account-content-inventory">
      <div class="section-title">
        <div><h3>Upcoming Content Inventory</h3><p>Sample attention split by account from Polaris.</p></div>
        <button class="chart-detail-link" data-page="samples" type="button">Open Sample Pipeline</button>
      </div>
      <div class="account-inventory-grid">
        ${accountSummaries.map(({ account, summary }) => accountInventoryBlock(account.name, summary)).join("")}
        ${shared.length ? sharedInventoryBlock(shared) : ""}
      </div>
      <p class="polaris-source-line">Calculated from Polaris Database: ${number.format(total)} samples.</p>
    </section>
  `;
}

function accountInventoryBlock(title, summary) {
  return `
    <article class="account-inventory-block">
      <h4>${title}</h4>
      ${accountInventoryRow("Waiting to Film", summary.waitingToFilm)}
      ${accountInventoryRow("Approved", summary.approved)}
      ${accountInventoryRow("Shipped", summary.shipped)}
      ${accountInventoryRow("High Priority", summary.highPriority)}
    </article>
  `;
}

function sharedInventoryBlock(samples) {
  return `
    <article class="account-inventory-block shared">
      <h4>Shared Opportunities</h4>
      ${accountInventoryRow("Both accounts", samples)}
    </article>
  `;
}

function accountInventoryRow(label, list) {
  return `<div><span>${label}</span><strong>${number.format(list.length)}</strong><small>${sampleNameList(list)}</small></div>`;
}

function morningBriefDiagnosticsMarkup() {
  const rows = morningBriefDataSourceAudit();
  const accountRows = northstarBriefAccounts().map(accountDiagnostics);
  return `
    <details class="developer-diagnostics morning-brief-diagnostics">
      <summary>Developer diagnostics: Morning Brief data sources</summary>
      <div class="sync-history-table"><table><thead><tr><th>Widget</th><th>Current source</th><th>Polaris source</th><th>Migration status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.widget}</td><td>${row.current}</td><td>${row.polaris}</td><td><span class="badge ${row.status === "Migrated" ? "good" : row.status === "Awaiting Polaris data" ? "hot" : ""}">${row.status}</span></td></tr>`).join("")}</tbody></table></div>
      <div class="sync-history-table account-diagnostics-table"><table><thead><tr><th>Account</th><th>Videos</th><th>Products</th><th>Samples</th><th>Sales Records</th><th>Actions</th><th>Missing data warnings</th></tr></thead><tbody>${accountRows.map((row) => `<tr><td>${row.account}</td><td>${row.videos}</td><td>${row.products}</td><td>${row.samples}</td><td>${row.salesRecords}</td><td>${row.actions}</td><td>${row.warnings}</td></tr>`).join("")}</tbody></table></div>
    </details>
  `;
}

function accountDiagnostics(account) {
  const videoCount = accountVideos(account).length;
  const productCount = accountProducts(account.id).length;
  const sampleCount = accountSamples(account).length;
  const salesCount = accountSalesRecords(account).length;
  const actionCount = buildActionPlan().filter((action) => normalizedName(action.account) === normalizedName(account.name) || normalizedName(action.account).includes("both")).length;
  const warnings = [];
  if (!videoCount) warnings.push("Awaiting Polaris video data");
  if (!productCount) warnings.push("Awaiting Polaris product data");
  if (!sampleCount) warnings.push("Awaiting Polaris sample data");
  if (!salesCount) warnings.push("Awaiting Polaris salesRecords data; revenue snapshot uses products");
  return {
    account: account.name,
    videos: number.format(videoCount),
    products: number.format(productCount),
    samples: number.format(sampleCount),
    salesRecords: number.format(salesCount),
    actions: number.format(actionCount),
    warnings: warnings.join("; ") || "None"
  };
}

/* Northstar v0.2 - navigation, product lifecycle, and positive Morning Brief */
let productLifecycleTab = "Live";
let dataHubTab = "Connections";
let productRequestSubtab = "Ideas";
let productFilmSubtab = "Waiting to Film";

function primaryNavigationPages() {
  return [
    { id: "executive", label: "Morning Brief" },
    { id: "recommendations", label: "Opportunity Center" },
    { id: "products", label: "Products" },
    { id: "videos", label: "Videos" },
    { id: "hooks", label: "Hooks" },
    { id: "contentPlanner", label: "Content Planner" },
    { id: "notes", label: "Knowledge Vault" },
    { id: "brands", label: "Brands" },
    { id: "dataHub", label: "Data Hub" },
    { id: "settings", label: "Settings" }
  ];
}

const northstarV02RenderPageBase = renderPage;
renderPage = function renderNorthstarV02Page(pageId) {
  const aliases = { workspaces: "brands", calendar: "contentPlanner", bulkImport: "dataHub", videoBackfill: "dataHub", importReview: "dataHub", tiktokConnection: "dataHub", samples: "products" };
  const routedPage = aliases[pageId] || pageId;
  if (pageId === "bulkImport" || pageId === "videoBackfill") dataHubTab = "CSV";
  if (pageId === "importReview") dataHubTab = "Review";
  if (pageId === "tiktokConnection") dataHubTab = "Connections";
  if (pageId === "samples") {
    productLifecycleTab = "Request";
    productRequestSubtab = "Request Samples";
  }
  document.body.classList.toggle("executive-home", routedPage === "executive");
  if (routedPage === "brands") {
    activePage = "brands";
    renderNav();
    pageTitle.textContent = "Brands";
    renderWorkspaces();
    return;
  }
  if (routedPage === "contentPlanner") {
    activePage = "contentPlanner";
    renderNav();
    pageTitle.textContent = "Content Planner";
    renderCalendar();
    return;
  }
  if (routedPage === "dataHub") {
    activePage = "dataHub";
    renderNav();
    pageTitle.textContent = "Data Hub";
    renderDataHub();
    return;
  }
  northstarV02RenderPageBase(routedPage);
};

renderWorkspaces = function renderBrands() {
  content.innerHTML = `
    <div class="section-title"><div><h3>Brands</h3><p>Creator business accounts Northstar guides separately.</p></div></div>
    <div class="workspace-grid">
      <button class="workspace-card raised" data-page="raisedRight"><span>❤️</span><h3>Raised Right</h3><p>Useful problem-solvers, practical proof, home, garden, patriotic, and outdoor decisions.</p><small>Open brand</small></button>
      <button class="workspace-card tribe" data-page="truthTunedTribe"><span>💙</span><h3>Truth Tuned Tribe</h3><p>Knowledge, curiosity, wellness, books, education, and explainers.</p><small>Open brand</small></button>
    </div>
  `;
  bindInternalButtons();
};

renderCalendar = function renderContentPlanner() {
  const seasons = db.seasons || {};
  content.innerHTML = `
    <div class="section-title"><div><h3>Content Planner</h3><p>Seasonal content, sample lead time, repost windows, and upcoming opportunities.</p></div></div>
    <div class="grid four">
      ${listCard("Current Month Opportunities", seasons.currentMonthOpportunities || [], "good")}
      ${listCard("Next Month Sample Requests", seasons.nextMonthSampleRequests || [], "hot")}
      ${listCard("Evergreen Products to Repost", (seasons.evergreenProductsToRepost || []).map((id) => getProduct(id)?.name).filter(Boolean), "")}
      ${listCard("Seasonal Alerts", db.notes.seasonalAlerts || [], "warn")}
    </div>
    <div class="grid three">${Object.entries(seasons.opportunitiesByMonth || {}).map(([month, items]) => `<div class="card calendar-card"><h3>${month}</h3><ul class="list">${items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`).join("")}</div>
  `;
};

renderNav = function renderNorthstarV02Nav() {
  nav.innerHTML = primaryNavigationPages().map((page) => `
    <button type="button" data-page="${page.id}" class="${page.id === activePage ? "active" : ""}">
      <span class="nav-icon">${navIcon(page.id)}</span>
      <span>${page.label}</span>
    </button>
  `).join("");
  nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => renderPage(button.dataset.page)));
};

const northstarV02NavIconBase = navIcon;
navIcon = function navIconNorthstarV02(pageId) {
  const icons = {
    contentPlanner: northstarV02NavIconBase("calendar"),
    brands: northstarV02NavIconBase("workspaces"),
    dataHub: northstarV02NavIconBase("bulkImport")
  };
  return icons[pageId] || northstarV02NavIconBase(pageId);
};

function northstarInsightText() {
  const lessons = [
    ...((db.notes?.lessons || []).map((item) => item.lesson || item.title).filter(Boolean)),
    ...(db.notes?.businessRules || [])
  ].filter(Boolean);
  const fallback = [
    "Products that solve a specific problem consistently outperform novelty products.",
    "High watch time does not always predict high sales.",
    "Data becomes direction when it changes what you do next."
  ];
  const list = lessons.length ? lessons : fallback;
  const index = new Date().getDate() % list.length;
  return list[index];
}

updateLastSavedDisplay = function updateNorthstarV02SidebarInsight() {
  const footer = document.querySelector(".sidebar-footer");
  if (!footer) return;
  footer.innerHTML = `
    <img class="footer-mark" src="assets/brand/northstar-mark.svg" alt="" aria-hidden="true">
    <span>Northstar Insight</span>
    <strong>${northstarInsightText()}</strong>
    <small>Version 0.2 · Last Saved: ${lastSavedAt}</small>
  `;
};

function productLifecycleTabs() {
  return ["Live", "Request", "Film", "Posted"];
}

function productRequestSubtabs() {
  return ["Ideas", "Request Samples", "Requested", "Approved", "Shipped", "Delivered"];
}

function productFilmSubtabs() {
  return ["Waiting to Film", "Filmed"];
}

renderProductsDatabase = function renderProductsWithLifecycleTabs() {
  if (!productLifecycleTabs().includes(productLifecycleTab)) productLifecycleTab = "Live";
  const rows = productLifecycleRows(productLifecycleTab);
  content.innerHTML = `
    <div class="section-title">
      <div><h3>Products</h3><p>Manage what is live, what should be requested, and what needs to be filmed or posted next.</p></div>
      <span class="badge good">${number.format(rows.length)} ${productLifecycleTab}</span>
    </div>
    <nav class="product-lifecycle-tabs" aria-label="Product lifecycle tabs">
      ${productLifecycleTabs().map((tab) => `<button type="button" class="${productLifecycleTab === tab ? "active" : ""}" data-product-lifecycle-tab="${tab}">${tab}</button>`).join("")}
    </nav>
    ${productLifecycleSubtabMarkup(productLifecycleTab)}
    <details class="form-panel"><summary>Add Product</summary>${productForm()}</details>
    ${productLifecycleTable(productLifecycleTab, rows)}
  `;
  document.querySelectorAll("[data-product-lifecycle-tab]").forEach((button) => button.addEventListener("click", () => {
    productLifecycleTab = button.dataset.productLifecycleTab;
    renderProductsDatabase();
  }));
  document.querySelectorAll("[data-product-request-subtab]").forEach((button) => button.addEventListener("click", () => {
    productRequestSubtab = button.dataset.productRequestSubtab;
    renderProductsDatabase();
  }));
  document.querySelectorAll("[data-product-film-subtab]").forEach((button) => button.addEventListener("click", () => {
    productFilmSubtab = button.dataset.productFilmSubtab;
    renderProductsDatabase();
  }));
  document.querySelector("#addProductForm")?.addEventListener("submit", handleAddProduct);
  document.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", () => openProduct(row.dataset.productId)));
  bindPolarisSampleControls();
};

function productLifecycleSubtabMarkup(tab) {
  if (tab === "Request") {
    return `
      <section class="card product-tab-note"><h3>Request Pipeline</h3><p>Ideas are future product opportunities. Request Samples through Delivered tracks sample flow.</p></section>
      <nav class="product-subtabs" aria-label="Request filters">${productRequestSubtabs().map((subtab) => `<button type="button" class="${productRequestSubtab === subtab ? "active" : ""}" data-product-request-subtab="${subtab}">${subtab}</button>`).join("")}</nav>
    `;
  }
  if (tab === "Film") {
    return `
      <section class="card product-tab-note"><h3>Film Pipeline</h3><p>Samples that are ready for filming or already filmed.</p></section>
      <nav class="product-subtabs" aria-label="Film filters">${productFilmSubtabs().map((subtab) => `<button type="button" class="${productFilmSubtab === subtab ? "active" : ""}" data-product-film-subtab="${subtab}">${subtab}</button>`).join("")}</nav>
    `;
  }
  return "";
}

function productLifecycleRows(tab) {
  if (tab === "Live") return scoredProducts().filter((product) => Number(product.lifetimeUnits || 0) > 0 || Number(product.lifetimeGmv || 0) > 0 || product.status === "Double Down");
  if (tab === "Request") return polarisSamples().filter((sample) => {
    if (productRequestSubtab === "Ideas") return sample.status === "Idea";
    if (productRequestSubtab === "Request Samples") return sample.status === "Request Now";
    return sample.status === productRequestSubtab;
  });
  if (tab === "Film") return polarisSamples().filter((sample) => {
    if (productFilmSubtab === "Waiting to Film") return sampleRequiresFilming(sample);
    return sample.status === "Filmed";
  });
  if (tab === "Posted") return polarisSamples().filter((sample) => sample.status === "Posted");
  return [];
}

function productLifecycleTable(tab, rows) {
  if (tab === "Live") {
    return `<div class="table-card database-table product-lifecycle-table"><table><thead><tr><th>Opportunity</th><th>Product</th><th>Account</th><th>Category</th><th>GMV</th><th>Commission</th><th>Units</th><th>Next direction</th></tr></thead><tbody>${rows.map((product) => `<tr class="click-row" data-product-id="${product.id}"><td>${opportunityPill(product)}</td><td><strong>${product.name}</strong><span>${lifecycleBadge(product)}</span></td><td>${product.account}</td><td>${product.categoryGroup}</td><td>${money.format(product.lifetimeGmv || 0)}</td><td>${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td>${productNextMove(product)}</td></tr>`).join("") || `<tr><td colspan="8">No live products yet.</td></tr>`}</tbody></table></div>`;
  }
  return `<div class="product-sample-grid">${rows.map(productSampleLifecycleCard).join("") || `<div class="card empty">No ${tab.toLowerCase()} records yet.</div>`}</div>`;
}

function productSampleLifecycleCard(sample) {
  return `
    <article class="sample-card polaris-sample-card product-sample-card">
      <div><h4>${sample.productName}</h4><p>${sample.account} · ${sample.category}</p></div>
      <div class="product-meta"><span class="badge ${priorityClass(sample.priority)}">${sample.priority}</span><span class="badge">${sample.status}</span></div>
      <label class="sample-status">Status ${select(`sample-${sample.id}`, sampleStatusOptions(), sample.status).replace("<select", `<select data-sample-status="${sample.id}"`)}</label>
      ${sample.contentIdea ? `<p><strong>Content idea:</strong> ${sample.contentIdea}</p>` : ""}
      ${sample.hookIdea ? `<p><strong>Hook idea:</strong> ${sample.hookIdea}</p>` : ""}
      ${sample.notes ? `<p>${sample.notes}</p>` : ""}
    </article>
  `;
}

function dataHubTabs() {
  return ["Connections", "Imports", "Review", "CSV", "OCR", "Manual Entry", "API Status"];
}

function renderDataHub() {
  if (!dataHubTabs().includes(dataHubTab)) dataHubTab = "Connections";
  content.innerHTML = `
    <div class="section-title"><div><h3>Data Hub</h3><p>Connections, imports, reviews, manual entry, OCR planning, and API status in one place.</p></div><span class="badge good">Polaris</span></div>
    <nav class="data-hub-tabs" aria-label="Data Hub tabs">${dataHubTabs().map((tab) => `<button type="button" class="${dataHubTab === tab ? "active" : ""}" data-data-hub-tab="${tab}">${tab}</button>`).join("")}</nav>
    ${dataHubTabMarkup(dataHubTab)}
  `;
  document.querySelectorAll("[data-data-hub-tab]").forEach((button) => button.addEventListener("click", () => {
    dataHubTab = button.dataset.dataHubTab;
    renderDataHub();
  }));
  bindInternalButtons();
}

function dataHubTabMarkup(tab) {
  if (tab === "Connections") return dataHubConnectionsMarkup();
  if (tab === "Imports") return dataHubImportsMarkup();
  if (tab === "Review") return dataHubReviewMarkup();
  if (tab === "CSV") return dataHubCsvMarkup();
  if (tab === "OCR") return dataHubOcrMarkup();
  if (tab === "Manual Entry") return dataHubManualMarkup();
  return dataHubApiMarkup();
}

function dataHubConnectionsMarkup() {
  return `<section class="card data-hub-panel"><div class="section-title"><div><h3>Connections</h3><p>Current mode is Manual / CSV. Live account syncing remains future infrastructure.</p></div></div><div class="connected-account-grid">${connectedAccountCard("Raised Right", "Manual / CSV / API Pending", latestNorthstarRefresh())}${connectedAccountCard("Truth Tuned Tribe", "Manual / CSV / API Pending", latestNorthstarRefresh())}</div></section>`;
}

function dataHubImportsMarkup() {
  const history = db.importHistory || [];
  return `<section class="card data-hub-panel"><div class="section-title"><div><h3>Imports</h3><p>Recent files and paste imports saved locally.</p></div></div>${history.length ? `<div class="sync-history-table"><table><thead><tr><th>Date</th><th>Type</th><th>Rows</th><th>Skipped</th></tr></thead><tbody>${history.slice(0, 10).map((entry) => `<tr><td>${entry.importedLabel || entry.dateLabel || ""}</td><td>${entry.dataType || entry.fileName || "Import"}</td><td>${number.format(entry.rowsImported || 0)}</td><td>${number.format(entry.rowsSkipped || 0)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No imports yet.</p>`}</section>`;
}

function dataHubReviewMarkup() {
  const reviews = db.importReviews || [];
  return `<section class="card data-hub-panel"><div class="section-title"><div><h3>Review</h3><p>Import trust checks and reconciliation live here.</p></div></div>${reviews.length ? importReviewPreview() : `<p class="empty">No import reviews yet. Use CSV or Imports after your next capture.</p>`}</section>`;
}

function dataHubCsvMarkup() {
  const previousTab = videoBackfillState.activeTab;
  videoBackfillState.activeTab = "videos";
  const markup = `<section class="data-hub-embedded">${videosImportTabMarkup()}</section>`;
  videoBackfillState.activeTab = previousTab;
  setTimeout(bindVideoBackfillControls, 0);
  return markup;
}

function dataHubOcrMarkup() {
  return `<section class="card data-hub-panel screenshot-placeholder"><div class="section-title"><div><h3>OCR</h3><p>Screenshot import is prepared for future OCR, but no recognition runs in this local version.</p></div><span class="badge hot">Coming Soon</span></div><div class="screenshot-drop-zone"><strong>Screenshot OCR Coming Soon</strong><span>Analytics, product, and rewards screenshots will eventually feed Polaris.</span></div></section>`;
}

function dataHubManualMarkup() {
  return `<section class="card data-hub-panel"><div class="section-title"><div><h3>Manual Entry</h3><p>Use Fast Capture for daily manual additions.</p></div></div><div class="grid two"><article class="import-source-card"><h4>Fast Capture</h4><p>Add products, videos, snapshots, and lessons quickly.</p><button class="icon-button" data-page="fastCapture" type="button">Open Fast Capture</button></article><article class="import-source-card"><h4>Products</h4><p>Move ideas and samples through the product lifecycle.</p><button class="ghost-button" data-page="products" type="button">Open Products</button></article></div></section>`;
}

function dataHubApiMarkup() {
  return `<section class="card data-hub-panel"><div class="section-title"><div><h3>API Status</h3><p>Future live sync checklist. No API connection is active yet.</p></div><span class="badge hot">Future</span></div><div class="update-data-needed">${["TikTok developer account", "Registered app", "OAuth/Login Kit", "Required scopes", "TikTok Shop Partner access", "Backend server", "Secure token storage", "Refresh schedule"].map((item) => `<span>${item}</span>`).join("")}</div><p class="update-center-note">Northstar currently uses manual capture and CSV import. Live linking requires API approval and secure backend infrastructure.</p></section>`;
}

function currentMonthReports() {
  const months = unique((db.monthlyReports || []).map((report) => report.month));
  const month = months.find((item) => /july 2026/i.test(item)) || months[0] || "July 2026";
  return (db.monthlyReports || []).filter((report) => report.month === month);
}

function monthlyProgressData() {
  const reports = currentMonthReports();
  const reportTotals = reports.reduce((acc, report) => {
    acc.gmv += Number(report.gmv || 0);
    acc.commission += Number(report.commission || 0);
    acc.units += Number(report.unitsSold || 0);
    acc.videos += Number(report.videosPosted || 0);
    return acc;
  }, { gmv: 0, commission: 0, units: 0, videos: 0 });
  if (reportTotals.gmv || reportTotals.commission || reportTotals.units || reportTotals.videos) return reportTotals;
  return {
    gmv: products().reduce((sum, product) => sum + Number(product.lifetimeGmv || 0), 0),
    commission: products().reduce((sum, product) => sum + Number(product.lifetimeCommission || 0), 0),
    units: products().reduce((sum, product) => sum + Number(product.lifetimeUnits || 0), 0),
    videos: videos().filter((video) => /2026-07/.test(video.datePosted || "")).length || videos().length
  };
}

function monthlyProgressMarkup() {
  const data = monthlyProgressData();
  const goals = { gmv: 5000, commission: 500, units: 250, videos: 60 };
  return `<section class="card monthly-progress-card"><div class="section-title"><div><h3>Monthly Progress</h3><p>Current month Signals from Polaris data.</p></div></div><div class="monthly-progress-grid">${progressMetric("GMV this month", money.format(data.gmv), data.gmv, goals.gmv)}${progressMetric("Commission this month", money.format(data.commission), data.commission, goals.commission)}${progressMetric("Units sold", number.format(data.units), data.units, goals.units)}${progressMetric("Videos posted", number.format(data.videos), data.videos, goals.videos)}</div></section>`;
}

function progressMetric(label, value, current, goal) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(current || 0) / Math.max(goal, 1) * 100)));
  return `<article><span>${label}</span><strong>${value}</strong><div class="progress-bar"><i style="width:${percent}%"></i></div><small>${percent}% of goal</small></article>`;
}

function winsMarkup() {
  const wins = currentWins();
  if (!wins.length) return "";
  return `<section class="card wins-card"><div class="section-title"><div><h3>Wins</h3><p>Motivational Signals worth noticing.</p></div></div><div class="wins-grid">${wins.map((win) => `<article><span>${win.label}</span><strong>${win.title}</strong><small>${win.detail}</small></article>`).join("")}</div></section>`;
}

function currentWins() {
  const list = [];
  const topSale = videos().filter((video) => Number(video.gmv || 0) > 0).sort((a, b) => Number(b.gmv || 0) - Number(a.gmv || 0))[0];
  const topConverting = videos().filter((video) => Number(video.sales || 0) > 0).sort((a, b) => (Number(b.sales || 0) / Math.max(Number(b.views || 0), 1)) - (Number(a.sales || 0) / Math.max(Number(a.views || 0), 1)))[0];
  const bestHookVideo = videos().slice().sort((a, b) => Number(b.saves || 0) + Number(b.shares || 0) - Number(a.saves || 0) - Number(a.shares || 0))[0];
  const breakout = scoredProducts()[0];
  if (topSale) list.push({ label: "Biggest sale Signal", title: topSale.productName || topSale.hook, detail: `${money.format(topSale.gmv || 0)} GMV` });
  if (topConverting) list.push({ label: "Highest converting video", title: topConverting.productName || topConverting.hook, detail: `${number.format(topConverting.sales || 0)} sales` });
  if (bestHookVideo?.hook) list.push({ label: "Best hook", title: shortName(bestHookVideo.hook), detail: `${number.format((bestHookVideo.saves || 0) + (bestHookVideo.shares || 0))} saves + shares` });
  if (breakout) list.push({ label: "Breakout product", title: breakout.name, detail: `${opportunityScore(breakout).score} Opportunity` });
  return list.slice(0, 4);
}

function todaysDirectionMarkup() {
  const actions = positiveActionPlan().slice(0, 5);
  return `<section class="card todays-direction-card"><div class="section-title"><div><h3>Today's Direction</h3><p>Only what to do next.</p></div><button class="chart-detail-link" data-page="actionPlan" type="button">Open Action Plan</button></div><div class="direction-grid">${actions.map((action) => `<article><span>${action.category}</span><strong>${action.productOrCategory}</strong><small>${action.reason}</small></article>`).join("") || `<p class="empty">Capture more data to generate today's direction.</p>`}</div></section>`;
}

function positiveActionPlan() {
  const allowed = ["Film", "Request", "Repost", "Watch", "Learn"];
  return buildActionPlan().filter((action) => allowed.includes(action.category)).map((action) => {
    const category = action.category === "Watch" ? "Test hook" : action.category === "Learn" ? "Follow up" : action.category;
    return { ...action, category, action: action.action.replace(/stop testing:?/i, "Review") };
  });
}

function executiveTopThree() {
  const actions = positiveActionPlan();
  const film = actions.find((action) => action.category === "Film") || actions[0];
  const request = actions.find((action) => action.category === "Request");
  const watch = actions.find((action) => ["Test hook", "Follow up", "Repost"].includes(action.category));
  return [
    normalizeTopThreeAction("Film", film, "Film the strongest current product.", "Highest Opportunity Score today."),
    normalizeTopThreeAction("Request", request, "Request the next useful product.", "Sample flow needs consistent new opportunities."),
    normalizeTopThreeAction("Watch", watch, "Test or improve the next hook.", "Review the Signal before spending more filming time.")
  ];
}

function opportunitySnapshotMarkup() {
  const groups = recommendationGroups();
  return `<section class="card opportunity-snapshot-card"><div class="section-title"><div><h3>Opportunity Snapshot</h3><p>Decision lanes remain in Opportunity Center.</p></div><button class="chart-detail-link" data-page="recommendations" type="button">Open Opportunity Center</button></div><div class="opportunity-snapshot-grid">${["DOUBLE DOWN", "WATCH", "WAIT"].map((lane) => `<article><span>${lane}</span><strong>${number.format((groups[lane] || []).length)}</strong><small>${(groups[lane] || [])[0]?.name || "No product in this lane"}</small></article>`).join("")}</div></section>`;
}

const northstarV02RenderExecutiveBase = renderExecutive;
renderExecutive = function renderNorthstarV02MorningBrief() {
  northstarV02RenderExecutiveBase();
  insertMorningBriefV02Panels();
};

function insertMorningBriefV02Panels() {
  const ceo = document.querySelector(".ceo-summary-card");
  if (ceo && !document.querySelector(".monthly-progress-card")) ceo.insertAdjacentHTML("afterend", monthlyProgressMarkup());
  const spark = document.querySelector(".today-spark-card");
  if (spark && !document.querySelector(".wins-card")) spark.insertAdjacentHTML("afterend", winsMarkup());
  const topThree = document.querySelector(".top-three-section");
  if (topThree && !document.querySelector(".todays-direction-card")) topThree.insertAdjacentHTML("beforebegin", todaysDirectionMarkup());
  const accountBriefs = document.querySelector(".account-briefs-section");
  if (accountBriefs && !document.querySelector(".opportunity-snapshot-card")) accountBriefs.insertAdjacentHTML("beforebegin", opportunitySnapshotMarkup());
  document.querySelectorAll(".brief-section h4").forEach((heading) => {
    if (/Products to Retire/i.test(heading.textContent || "")) heading.textContent = "Products to Review";
  });
  bindInternalButtons();
}

function topOverallPriority() {
  const actions = positiveActionPlan();
  const bestAction = actions[0];
  const bestProduct = scoredProducts()[0];
  if (bestAction) {
    return {
      title: bestAction.action,
      account: bestAction.account || bestProduct?.account || "Both accounts",
      subject: bestAction.productOrCategory || bestProduct?.name || "Creator business",
      reason: bestAction.reason || "Highest positive action Signal across both accounts.",
      scoreLabel: `${Math.round(bestAction.confidence || 0)}% confidence`
    };
  }
  if (bestProduct) {
    return {
      title: `Film again: ${shortName(bestProduct.name)}`,
      account: bestProduct.account,
      subject: bestProduct.name,
      reason: `${bestProduct.name} has the highest Opportunity Score and strongest available Polaris Signal.`,
      scoreLabel: `${opportunityScore(bestProduct).score} Opportunity`
    };
  }
  return {
    title: "Capture fresh creator data",
    account: "Both accounts",
    subject: "Polaris Database",
    reason: "Northstar needs products, videos, samples, or sales before choosing a confident top priority.",
    scoreLabel: "Awaiting data"
  };
}

function accountTopThreeActions(account, productList, videoList, sampleList) {
  const accountActions = positiveActionPlan().filter((action) => normalizedName(action.account) === normalizedName(account.name) || normalizedName(action.account).includes("both"));
  const filmAction = accountActions.find((action) => action.category === "Film") || makeAccountFilmFallback(account, productList, videoList);
  const requestAction = accountActions.find((action) => action.category === "Request") || makeAccountRequestFallback(account, sampleList);
  const watchAction = accountActions.find((action) => ["Test hook", "Follow up", "Watch"].includes(action.category)) || makeAccountWatchFallback(account, productList, videoList);
  return [
    normalizeAccountAction("Film", filmAction, account),
    normalizeAccountAction("Request", requestAction, account),
    normalizeAccountAction("Watch / Improve", watchAction, account)
  ];
}

function daysRemainingInMonth() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
}

function monthlyMomentumLine() {
  const categories = categoryIntelligence().slice(0, 2).map((row) => row.category.toLowerCase());
  if (categories.length >= 2) return `${categories[0]} and ${categories[1]} are carrying this month's momentum.`;
  if (categories.length === 1) return `${categories[0]} is carrying this month's momentum.`;
  return "Northstar is watching for the clearest momentum Signal this month.";
}

function monthlyProjection(current) {
  const today = new Date();
  const day = Math.max(today.getDate(), 1);
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return {
    gmv: current.gmv / day * totalDays,
    commission: current.commission / day * totalDays
  };
}

function monthlyProgressMarkup() {
  const data = monthlyProgressData();
  const projected = monthlyProjection(data);
  const goals = { gmv: 5000, commission: 500, units: 250, videos: 60 };
  return `
    <section class="card monthly-progress-card command-center-hero">
      <div class="monthly-progress-hero-copy">
        <span class="account-brief-label">Monthly Progress</span>
        <h2>${money.format(data.gmv)} GMV this month</h2>
        <p>${monthlyMomentumLine()}</p>
      </div>
      <div class="monthly-progress-grid">
        ${progressMetric("GMV this month", money.format(data.gmv), data.gmv, goals.gmv)}
        ${progressMetric("Commission this month", money.format(data.commission), data.commission, goals.commission)}
        ${progressMetric("Units sold", number.format(data.units), data.units, goals.units)}
        ${progressMetric("Videos posted", number.format(data.videos), data.videos, goals.videos)}
      </div>
      <div class="monthly-projection-row">
        <article><span>Projected month</span><strong>${money.format(projected.gmv)}</strong><small>${money.format(projected.commission)} projected commission</small></article>
        <article><span>Days remaining</span><strong>${number.format(daysRemainingInMonth())}</strong><small>Keep feeding the strongest Signals.</small></article>
      </div>
    </section>
  `;
}

function todaysDirectionMarkup() {
  const groups = todayDirectionGroups();
  return `
    <section class="card todays-direction-card">
      <div class="section-title"><div><h3>Today's Direction</h3><p>What should Jennifer do today?</p></div><button class="chart-detail-link" data-page="actionPlan" type="button">Open Action Plan</button></div>
      <div class="direction-grid grouped">
        ${directionGroupMarkup("Film Today", groups.film)}
        ${directionGroupMarkup("Request Samples", groups.request)}
        ${directionGroupMarkup("Post / Repost", groups.repost)}
        ${directionGroupMarkup("Needs Attention", groups.attention)}
      </div>
    </section>
  `;
}

function todayDirectionGroups() {
  const actions = positiveActionPlan();
  const deliveredSample = polarisSamples().find(sampleRequiresFilming);
  const requestSample = polarisSamples().find((sample) => sample.priority === "High" && ["Idea", "Request Now"].includes(sample.status));
  const filmedSample = polarisSamples().find((sample) => sample.status === "Filmed");
  const shippedSample = polarisSamples().find((sample) => ["Requested", "Approved", "Shipped"].includes(sample.status));
  return {
    film: [
      actions.find((action) => action.category === "Film"),
      deliveredSample ? { category: "Film", productOrCategory: deliveredSample.productName, reason: `${deliveredSample.productName} is ready to film from the sample pipeline.` } : null
    ].filter(Boolean).slice(0, 2),
    request: [
      actions.find((action) => action.category === "Request"),
      requestSample ? { category: "Request", productOrCategory: requestSample.productName, reason: `${requestSample.productName} is a high-priority sample opportunity.` } : null
    ].filter(Boolean).slice(0, 2),
    repost: [
      actions.find((action) => action.category === "Repost"),
      filmedSample ? { category: "Post / Repost", productOrCategory: filmedSample.productName, reason: `${filmedSample.productName} is filmed; move it toward posting.` } : null
    ].filter(Boolean).slice(0, 2),
    attention: [
      actions.find((action) => ["Test hook", "Follow up"].includes(action.category)),
      shippedSample ? { category: "Follow up", productOrCategory: shippedSample.productName, reason: `${shippedSample.productName} needs a sample status check.` } : null
    ].filter(Boolean).slice(0, 2)
  };
}

function directionGroupMarkup(title, items) {
  return `<article><span>${title}</span>${items.length ? items.map((item) => `<strong>${item.productOrCategory}</strong><small>${item.reason}</small>`).join("") : `<strong>Nothing urgent</strong><small>Northstar is watching for a stronger Signal.</small>`}</article>`;
}

function pulseReportMarkup() {
  const brief = weeklyIntelligenceBrief();
  return `
    <section class="card weekly-brief-card pulse-report-card">
      <div class="section-title"><div><h3>Pulse Report</h3><p>What changed, why it matters, and what to do next.</p></div><button class="chart-detail-link" data-page="actionPlan">Open Action Plan</button></div>
      <div class="weekly-brief-grid">
        ${briefSection("What improved", brief.improved)}
        ${briefSection("What slowed", brief.slowed)}
        ${briefSection("Biggest win", [brief.biggestWin])}
        ${briefSection("Biggest lesson", [brief.biggestLesson])}
        ${briefSection("Top opportunity", [brief.topOpportunity])}
        ${briefSection("Products/samples to request", brief.request)}
        ${briefSection("Products/videos to film", brief.film)}
        ${briefSection("Products to watch", [...(brief.slowed || []), ...(brief.retire || [])].slice(0, 4))}
      </div>
    </section>
  `;
}

function recommendationGroups() {
  return scoredProducts().reduce((groups, product) => {
    const score = opportunityScore(product).score;
    const lifecycle = productLifecycle(product).stage;
    const lane = score >= 78 && lifecycle !== "Slowing" ? "DOUBLE DOWN" : score >= 60 ? "WATCH" : "WAIT";
    groups[lane].push(product);
    return groups;
  }, { "DOUBLE DOWN": [], WATCH: [], WAIT: [] });
}

renderRecommendations = function renderOpportunityCenterWithoutRetire() {
  const groups = recommendationGroups();
  content.innerHTML = `
    <div class="section-title"><div><h3>Opportunity Center</h3><p>Products grouped by Opportunity Score, lifecycle, timing, and confidence.</p></div><span class="badge good">Intelligence Engine</span></div>
    <div class="recommendation-grid">
      ${["DOUBLE DOWN", "WATCH", "WAIT"].map((name) => `<section class="recommendation-column"><h3>${name}</h3>${(groups[name] || []).map(recommendationCard).join("") || `<p class="empty">No products in this lane.</p>`}</section>`).join("")}
    </div>
    <div class="grid two">
      <section class="card"><div class="section-title"><div><h3>Category Intelligence</h3><p>Automatic category summaries.</p></div></div>${categoryIntelligenceTable(categoryIntelligence())}</section>
      <section class="card"><div class="section-title"><div><h3>Account Comparison</h3><p>Which brand is showing the strongest Signals?</p></div></div><div class="account-comparison-grid">${accountComparison().map(accountComparisonCard).join("")}</div></section>
    </div>
  `;
  bindInternalButtons();
};

const northstarV02RefinedRenderExecutiveBase = renderExecutive;
renderExecutive = function renderMorningBriefCommandCenter() {
  northstarV02RefinedRenderExecutiveBase();
  refineMorningBriefCommandCenterOrder();
};

function refineMorningBriefCommandCenterOrder() {
  const root = content;
  if (!root) return;
  root.querySelector(".executive-brief-hero")?.remove();
  root.querySelector(".ceo-summary-card")?.remove();
  root.querySelector(".today-spark-card")?.remove();
  root.querySelector(".top-three-section")?.remove();
  root.querySelector(".wins-card")?.remove();
  root.querySelector(".opportunity-snapshot-card")?.remove();
  root.querySelector(".weekly-brief-card")?.remove();

  const existingMonthly = root.querySelector(".monthly-progress-card");
  if (existingMonthly) existingMonthly.remove();
  const existingDirection = root.querySelector(".todays-direction-card");
  if (existingDirection) existingDirection.remove();

  root.insertAdjacentHTML("afterbegin", monthlyProgressMarkup());

  const monthly = root.querySelector(".monthly-progress-card");
  const accountBriefs = root.querySelector(".account-briefs-section");
  if (monthly && accountBriefs) monthly.insertAdjacentElement("afterend", accountBriefs);
  const anchor = accountBriefs || monthly;
  if (anchor) anchor.insertAdjacentHTML("afterend", todaysDirectionMarkup());
  const direction = root.querySelector(".todays-direction-card");
  if (direction) direction.insertAdjacentHTML("afterend", pulseReportMarkup());
  root.querySelectorAll(".brief-section h4").forEach((heading) => {
    if (/Products to Retire/i.test(heading.textContent || "")) heading.textContent = "Products to watch";
  });
  bindInternalButtons();
}

/* Northstar Real Data Sprint - daily data entry, bulk paste import, source labels, and backup snapshots */
let dailyUpdateState = { summary: null };
let bulkPasteState = { type: "Videos", rawText: "", preview: null, summary: null };
let productImageScreenshotState = { files: [], idsText: "", preview: [], summary: null };

function dataHubTabs() {
  return ["Connections", "Quick Daily Update", "Bulk Paste Import", "Product Images", "Templates", "Imports", "Review", "CSV", "OCR", "Manual Entry", "API Status"];
}

function renderDataHub() {
  if (!dataHubTabs().includes(dataHubTab)) dataHubTab = "Connections";
  content.innerHTML = `
    <div class="section-title"><div><h3>Data Hub</h3><p>Connections, daily updates, paste imports, reviews, manual entry, OCR planning, and API status in one place.</p></div><span class="badge good">Polaris</span></div>
    <nav class="data-hub-tabs" aria-label="Data Hub tabs">${dataHubTabs().map((tab) => `<button type="button" class="${dataHubTab === tab ? "active" : ""}" data-data-hub-tab="${tab}">${tab}</button>`).join("")}</nav>
    ${dataHubTabMarkup(dataHubTab)}
  `;
  document.querySelectorAll("[data-data-hub-tab]").forEach((button) => button.addEventListener("click", () => {
    dataHubTab = button.dataset.dataHubTab;
    renderDataHub();
  }));
  bindInternalButtons();
  bindRealDataHubControls();
}

function dataHubTabMarkup(tab) {
  if (tab === "Quick Daily Update") return quickDailyUpdateMarkup();
  if (tab === "Bulk Paste Import") return bulkPasteImportMarkup();
  if (tab === "Product Images") return productImageImportMarkup();
  if (tab === "Templates") return importTemplatesMarkup();
  if (tab === "Connections") return dataHubConnectionsMarkup();
  if (tab === "Imports") return dataHubImportsMarkup();
  if (tab === "Review") return dataHubReviewMarkup();
  if (tab === "CSV") return dataHubCsvMarkup();
  if (tab === "OCR") return dataHubOcrMarkup();
  if (tab === "Manual Entry") return dataHubManualMarkup();
  return dataHubApiMarkup();
}

function quickDailyUpdateMarkup() {
  const last = latestSourceLog("dailyUpdates") || latestSourceLog("monthlyReports");
  return `
    <section class="card data-hub-panel quick-daily-panel">
      <div class="section-title"><div><h3>Quick Daily Update</h3><p>Enter today's real account totals in under five minutes. Northstar uses this for Monthly Progress and the Morning Brief.</p></div><span class="badge">Last updated: ${last ? formatDateTime(last.lastUpdated) : "Not yet"}</span></div>
      <form id="quickDailyUpdateForm" class="form-grid">
        <label>Account <select id="dailyAccount" name="dailyAccount" required>${accounts().map((account) => `<option value="${escapeAttr(account.id)}">${account.name}</option>`).join("")}</select></label>
        <label>Date <input name="dailyDate" type="date" required value="${todayDate(new Date())}"></label>
        <label>GMV today <input name="gmvToday" type="number" min="0" step="0.01" placeholder="0.00"></label>
        <label>GMV this month <input name="gmvMonth" type="number" min="0" step="0.01" placeholder="Optional monthly total"></label>
        <label>Commission today <input name="commissionToday" type="number" min="0" step="0.01" placeholder="0.00"></label>
        <label>Commission this month <input name="commissionMonth" type="number" min="0" step="0.01" placeholder="Optional monthly total"></label>
        <label>Units sold <input name="unitsSold" type="number" min="0" step="1" placeholder="0"></label>
        <label>Videos posted <input name="videosPosted" type="number" min="0" step="1" placeholder="0"></label>
        <label>Best product <input name="bestProduct" type="text" placeholder="Product name"></label>
        <label>Best video <input name="bestVideo" type="text" placeholder="Video or hook"></label>
        <label>New samples approved <input name="samplesApproved" type="number" min="0" step="1" placeholder="0"></label>
        <label>New samples shipped <input name="samplesShipped" type="number" min="0" step="1" placeholder="0"></label>
        <label>New samples delivered <input name="samplesDelivered" type="number" min="0" step="1" placeholder="0"></label>
        <label class="full-span">Notes <textarea name="notes" rows="4" placeholder="Anything Northstar should remember from today?"></textarea></label>
        <div class="form-actions full-span"><button class="icon-button" type="submit">Save Daily Update</button><button class="ghost-button" type="button" data-data-hub-tab="Bulk Paste Import">Bulk Paste Import</button></div>
      </form>
      ${dailyUpdateState.summary ? realDataSummaryMarkup(dailyUpdateState.summary) : ""}
    </section>
  `;
}

function bulkPasteImportMarkup() {
  const preview = bulkPasteState.preview;
  const options = ["Videos", "Product sales", "Samples", "Monthly totals"];
  return `
    <section class="card data-hub-panel bulk-paste-panel">
      <div class="section-title"><div><h3>Bulk Paste Import</h3><p>Paste rows for videos, product sales, samples, or monthly totals. Preview before saving.</p></div><span class="badge">Backup before import</span></div>
      <div class="form-grid">
        <label>Import type <select id="bulkPasteType">${options.map((option) => `<option value="${escapeAttr(option)}" ${option === bulkPasteState.type ? "selected" : ""}>${option}</option>`).join("")}</select></label>
        <label class="full-span">Paste data <textarea id="bulkPasteText" class="video-backfill-textarea" rows="12" spellcheck="false" placeholder="${escapeHtml(templateForType(bulkPasteState.type))}">${escapeHtml(bulkPasteState.rawText || "")}</textarea></label>
        <div class="form-actions full-span"><button class="icon-button" id="previewBulkPaste" type="button">Preview Import</button><button class="ghost-button" id="clearBulkPaste" type="button">Clear</button></div>
      </div>
      ${preview ? bulkPastePreviewMarkup(preview) : ""}
      ${bulkPasteState.summary ? realDataSummaryMarkup(bulkPasteState.summary) : ""}
    </section>
  `;
}

function productImageImportMarkup() {
  const mapCount = Object.keys(window.NORTHSTAR_PRODUCT_IMAGE_MAP || {}).length;
  const productsWithImages = products().filter((product) => productImageUrl(product)).length;
  return `
    <section class="card data-hub-panel product-image-import-panel">
      <div class="section-title">
        <div>
          <h3>Product Image Import / Screenshot Mode</h3>
          <p>Review TikTok Shop product list screenshots before thumbnails are saved as bundled image files.</p>
        </div>
        <span class="badge good">${number.format(mapCount)} bundled thumbnails</span>
      </div>
      <div class="monthly-progress-grid">
        ${metric("Bundled images", number.format(mapCount), "assets/product-images", "")}
        ${metric("Products showing images", number.format(productsWithImages), "Matched by product ID", "")}
        ${metric("Storage mode", "File assets", "No base64 in localStorage", "")}
        ${metric("Match rule", "Product ID first", "Name fallback only if needed", "")}
      </div>
      <div class="form-grid">
        <label class="full-span">Upload screenshots
          <input id="productImageScreenshots" type="file" accept="image/*" multiple>
        </label>
        <label class="full-span">Product IDs, one per row
          <textarea id="productImageIds" rows="8" placeholder="1732298265051107333&#10;1731186947024524093">${escapeHtml(productImageScreenshotState.idsText || "")}</textarea>
        </label>
        <div class="form-actions full-span">
          <button class="icon-button" id="previewProductImages" type="button">Preview Screenshot Rows</button>
          <button class="ghost-button" id="exportProductImageReview" type="button">Export Review JSON</button>
        </div>
      </div>
      <p class="subtle-note">Northstar can preview screenshot rows in the browser. Final saved thumbnails live in <strong>assets/product-images/</strong> so browser storage stays small.</p>
      ${productImageScreenshotState.summary ? `<div class="import-summary">${escapeHtml(productImageScreenshotState.summary)}</div>` : ""}
      ${productImagePreviewMarkup(productImageScreenshotState.preview)}
    </section>
  `;
}

function productImagePreviewMarkup(rows = []) {
  if (!rows.length) return `<p class="empty">Drop screenshots and paste product IDs to review thumbnail matches.</p>`;
  return `
    <div class="product-image-review-grid">
      ${rows.map((row) => `
        <article class="product-image-review-card">
          <img src="${escapeAttr(row.previewUrl)}" alt="${escapeAttr(row.productId)}">
          <div>
            <strong>${escapeHtml(row.productName || "Product match pending")}</strong>
            <small>ID: ${escapeHtml(row.productId || "Missing")}</small>
            <span class="badge ${row.matched ? "good" : "warn"}">${row.matched ? "Matched" : "Needs review"}</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function importTemplatesMarkup() {
  const templates = importTemplates();
  return `
    <section class="card data-hub-panel import-templates-panel">
      <div class="section-title"><div><h3>Import Templates</h3><p>Copy a header row, paste your data underneath, then use Bulk Paste Import.</p></div></div>
      <div class="grid two">
        ${Object.entries(templates).map(([name, text]) => `
          <article class="import-source-card template-card">
            <h4>${name}</h4>
            <textarea class="template-text" readonly rows="5">${escapeHtml(text)}</textarea>
            <button class="ghost-button" type="button" data-copy-template="${escapeHtml(text)}">Copy Template</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function bindRealDataHubControls() {
  document.querySelector("#quickDailyUpdateForm")?.addEventListener("submit", saveQuickDailyUpdate);
  document.querySelector("#productImageScreenshots")?.addEventListener("change", (event) => {
    productImageScreenshotState.files = Array.from(event.target.files || []);
    productImageScreenshotState.summary = `${productImageScreenshotState.files.length} screenshot file(s) ready for preview.`;
  });
  document.querySelector("#productImageIds")?.addEventListener("input", (event) => {
    productImageScreenshotState.idsText = event.target.value;
  });
  document.querySelector("#previewProductImages")?.addEventListener("click", previewProductImageScreenshots);
  document.querySelector("#exportProductImageReview")?.addEventListener("click", exportProductImageReview);
  document.querySelector("#bulkPasteType")?.addEventListener("change", (event) => {
    bulkPasteState.type = event.target.value;
    bulkPasteState.preview = null;
    bulkPasteState.summary = null;
    renderDataHub();
  });
  document.querySelector("#bulkPasteText")?.addEventListener("input", (event) => {
    bulkPasteState.rawText = event.target.value;
    bulkPasteState.preview = null;
    bulkPasteState.summary = null;
  });
  document.querySelector("#previewBulkPaste")?.addEventListener("click", () => {
    bulkPasteState.rawText = document.querySelector("#bulkPasteText")?.value || "";
    bulkPasteState.preview = analyzeBulkPasteImport(bulkPasteState.type, bulkPasteState.rawText);
    bulkPasteState.summary = null;
    renderDataHub();
  });
  document.querySelector("#confirmBulkPaste")?.addEventListener("click", confirmBulkPasteImport);
  document.querySelector("#clearBulkPaste")?.addEventListener("click", () => {
    bulkPasteState.rawText = "";
    bulkPasteState.preview = null;
    bulkPasteState.summary = null;
    renderDataHub();
  });
  document.querySelectorAll("[data-copy-template]").forEach((button) => button.addEventListener("click", async () => {
    const text = button.dataset.copyTemplate || "";
    try {
      await navigator.clipboard.writeText(text);
      showMessage("Template copied.", "success");
    } catch {
      showMessage("Template is shown in the box above for copying.", "warn");
    }
  }));
  document.querySelectorAll("[data-data-hub-tab]").forEach((button) => button.addEventListener("click", () => {
    dataHubTab = button.dataset.dataHubTab;
    renderDataHub();
  }));
}

async function previewProductImageScreenshots() {
  productImageScreenshotState.idsText = document.querySelector("#productImageIds")?.value || "";
  const productIds = productImageScreenshotState.idsText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!productImageScreenshotState.files.length || !productIds.length) {
    productImageScreenshotState.summary = "Add at least one screenshot and one product ID to preview.";
    productImageScreenshotState.preview = [];
    renderDataHub();
    return;
  }
  const rows = [];
  let idIndex = 0;
  for (const file of productImageScreenshotState.files) {
    const remaining = productIds.length - idIndex;
    if (remaining <= 0) break;
    const perFile = Math.min(10, remaining);
    const thumbnails = await cropProductImageRows(file, perFile);
    thumbnails.forEach((previewUrl) => {
      const productId = productIds[idIndex] || "";
      const product = findProductByImageProductId(productId);
      rows.push({
        fileName: file.name,
        productId,
        productName: product?.name || "",
        matched: !!product,
        previewUrl
      });
      idIndex += 1;
    });
  }
  productImageScreenshotState.preview = rows;
  productImageScreenshotState.summary = `${rows.length} thumbnail row(s) previewed. ${rows.filter((row) => row.matched).length} matched existing Northstar products.`;
  renderDataHub();
}

async function cropProductImageRows(file, rowCount) {
  const image = await loadBrowserImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const thumbSize = Math.max(64, Math.round(image.naturalWidth * 0.08));
  const left = Math.max(18, Math.round(image.naturalWidth * 0.055));
  const hasHeader = image.naturalHeight / Math.max(image.naturalWidth, 1) > 1.15;
  const top = hasHeader ? Math.round(image.naturalHeight * 0.08) : Math.round(image.naturalHeight * 0.02);
  const rowHeight = Math.max(92, Math.round((image.naturalHeight - top) / Math.max(rowCount, 1)));
  canvas.width = thumbSize;
  canvas.height = thumbSize;
  const crops = [];
  for (let index = 0; index < rowCount; index += 1) {
    const y = Math.min(image.naturalHeight - thumbSize, top + index * rowHeight);
    context.clearRect(0, 0, thumbSize, thumbSize);
    context.drawImage(image, left, y, thumbSize, thumbSize, 0, 0, thumbSize, thumbSize);
    crops.push(canvas.toDataURL("image/png"));
  }
  return crops;
}

function loadBrowserImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve(image);
    };
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function exportProductImageReview() {
  const rows = productImageScreenshotState.preview || [];
  if (!rows.length) {
    showMessage("Preview screenshots before exporting a review file.", "warn");
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    storageRule: "Review only. Do not store base64 thumbnails in localStorage.",
    rows: rows.map(({ previewUrl, ...row }) => row)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-product-image-review-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Product image review exported.", "good");
}

function saveQuickDailyUpdate(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const account = getAccount(form.get("dailyAccount")) || accounts()[0] || {};
  const date = normalizeDateKey(form.get("dailyDate")) || todayDate(new Date());
  const update = {
    id: uniqueImportId(`daily-update-${account.id}-${date}`),
    accountId: account.id,
    account: account.name,
    date,
    gmvToday: toNumber(form.get("gmvToday")),
    gmvMonth: toNumber(form.get("gmvMonth")),
    commissionToday: toNumber(form.get("commissionToday")),
    commissionMonth: toNumber(form.get("commissionMonth")),
    unitsSold: toNumber(form.get("unitsSold")),
    videosPosted: toNumber(form.get("videosPosted")),
    bestProduct: String(form.get("bestProduct") || "").trim(),
    bestVideo: String(form.get("bestVideo") || "").trim(),
    samplesApproved: toNumber(form.get("samplesApproved")),
    samplesShipped: toNumber(form.get("samplesShipped")),
    samplesDelivered: toNumber(form.get("samplesDelivered")),
    notes: String(form.get("notes") || "").trim(),
    source: "Manual",
    lastUpdated: new Date().toISOString()
  };
  createPolarisBackupSnapshot("Quick Daily Update");
  db.dailyUpdates = db.dailyUpdates || [];
  const existing = db.dailyUpdates.find((item) => item.accountId === update.accountId && item.date === update.date);
  if (existing) Object.assign(existing, update, { id: existing.id });
  else db.dailyUpdates.unshift(update);
  db.dailyUpdates = db.dailyUpdates.slice(0, 120);
  upsertMonthlyReportFromDaily(update);
  if (update.notes) saveRealDataNote(update);
  recordDataSource("dailyUpdates", "Manual", `${account.name} daily update`);
  recordDataSource("monthlyReports", "Manual", `${monthLabel(new Date(`${date}T00:00:00`))} totals`);
  dailyUpdateState.summary = {
    title: "Quick Daily Update saved",
    added: existing ? 0 : 1,
    updated: existing ? 1 : 0,
    duplicates: existing ? 1 : 0,
    errors: [],
    missing: [],
    totals: {
      gmv: update.gmvMonth || update.gmvToday,
      commission: update.commissionMonth || update.commissionToday,
      units: update.unitsSold,
      videos: update.videosPosted
    }
  };
  finishRealDataImport("Quick Daily Update saved to Polaris.", "quick-daily-update");
}

function upsertMonthlyReportFromDaily(update) {
  db.monthlyReports = db.monthlyReports || [];
  const date = new Date(`${update.date}T00:00:00`);
  const month = monthLabel(date);
  let report = db.monthlyReports.find((item) => item.month === month && normalizedName(item.account) === normalizedName(update.account));
  if (!report) {
    report = {
      id: uniqueImportId(`monthly-${update.accountId}-${slug(month)}`),
      month,
      accountId: update.accountId,
      account: update.account,
      gmv: 0,
      commission: 0,
      unitsSold: 0,
      videosPosted: 0
    };
    db.monthlyReports.push(report);
  }
  report.gmv = update.gmvMonth || Number(report.gmv || 0) + update.gmvToday;
  report.commission = update.commissionMonth || Number(report.commission || 0) + update.commissionToday;
  report.unitsSold = Number(report.unitsSold || 0) + update.unitsSold;
  report.videosPosted = Number(report.videosPosted || 0) + update.videosPosted;
  report.topProduct = update.bestProduct || report.topProduct || "";
  report.topVideo = update.bestVideo || report.topVideo || "";
  report.notes = update.notes || report.notes || "";
  report.source = "Manual";
  report.lastUpdated = update.lastUpdated;
  return report;
}

function saveRealDataNote(update) {
  db.notes = db.notes || {};
  db.notes.lessons = db.notes.lessons || [];
  db.notes.lessons.unshift({
    id: uniqueImportId(`daily-note-${update.accountId}-${update.date}`),
    title: `Daily update: ${update.account}`,
    account: update.account,
    category: "Daily Update",
    lesson: update.notes,
    confidence: "Medium",
    dateAdded: update.date,
    tags: ["daily-update", "real-data"],
    source: "Quick Daily Update"
  });
}

function analyzeBulkPasteImport(type, text) {
  if (type === "Videos") return addValidationTotals(analyzeVideoBackfill(text, "csv"), type);
  if (type === "Samples") return addValidationTotals(analyzeSampleImport(text), type);
  if (type === "Product sales") return analyzeProductSalesImport(text);
  if (type === "Monthly totals") return analyzeMonthlyTotalsImport(text);
  return { type, rows: [], validRows: [], addCandidates: [], updateCandidates: [], errors: [{ rowNumber: "-", message: "Choose an import type." }], missingFields: [], duplicates: [], totals: {} };
}

function confirmBulkPasteImport() {
  const preview = bulkPasteState.preview || analyzeBulkPasteImport(bulkPasteState.type, bulkPasteState.rawText);
  createPolarisBackupSnapshot(`Bulk Paste Import: ${bulkPasteState.type}`);
  let summary;
  if (bulkPasteState.type === "Videos") {
    summary = importVideoBatch(preview.validRows, "bulk-paste-videos", preview.errors);
    recordDataSource("videos", "Manual", "Bulk paste videos");
  } else if (bulkPasteState.type === "Samples") {
    summary = importSampleBatch(preview.validRows, preview.errors);
    recordDataSource("samples", "Manual", "Bulk paste samples");
  } else if (bulkPasteState.type === "Product sales") {
    summary = importProductSalesBatch(preview.validRows, preview.errors);
    recordDataSource("salesRecords", "Manual", "Bulk paste product sales");
    recordDataSource("products", "Manual", "Product sales upsert");
  } else {
    summary = importMonthlyTotalsBatch(preview.validRows, preview.errors);
    recordDataSource("monthlyReports", "Manual", "Bulk paste monthly totals");
  }
  bulkPasteState.summary = realDataSummaryFromImport(summary, preview);
  writeRealDataImportHistory(bulkPasteState.type, bulkPasteState.summary);
  finishRealDataImport("Bulk Paste Import saved to Polaris.", `bulk-paste-${slug(bulkPasteState.type)}`);
}

function analyzeProductSalesImport(text) {
  const parsed = parseGenericPasteRows(text, "Product sales");
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((row, index) => normalizeProductSalesRow(row, index + 1));
  rows.forEach((row) => { if (row.error) errors.push({ rowNumber: row.rowNumber, message: row.error }); });
  const validRows = rows.filter((row) => !row.error);
  validRows.forEach((row) => { row.existing = findSalesRecordDuplicate(row); });
  return addValidationTotals({
    type: "Product sales",
    rows,
    validRows,
    errors,
    addCandidates: validRows.filter((row) => !row.existing),
    updateCandidates: validRows.filter((row) => row.existing)
  }, "Product sales");
}

function analyzeMonthlyTotalsImport(text) {
  const parsed = parseGenericPasteRows(text, "Monthly totals");
  const errors = [...parsed.errors];
  const rows = parsed.rows.map((row, index) => normalizeMonthlyTotalsRow(row, index + 1));
  rows.forEach((row) => { if (row.error) errors.push({ rowNumber: row.rowNumber, message: row.error }); });
  const validRows = rows.filter((row) => !row.error);
  validRows.forEach((row) => { row.existing = findMonthlyReportDuplicate(row); });
  return addValidationTotals({
    type: "Monthly totals",
    rows,
    validRows,
    errors,
    addCandidates: validRows.filter((row) => !row.existing),
    updateCandidates: validRows.filter((row) => row.existing)
  }, "Monthly totals");
}

function parseGenericPasteRows(text, label) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { rows: [], errors: [{ rowNumber: "-", message: `Paste ${label} rows first.` }] };
  try {
    const parsed = JSON.parse(trimmed);
    const key = label === "Product sales" ? "sales" : "monthlyTotals";
    return { rows: Array.isArray(parsed) ? parsed : Array.isArray(parsed[key]) ? parsed[key] : [parsed], errors: [] };
  } catch {
    try {
      return { rows: parseDelimitedVideoText(trimmed), errors: [] };
    } catch (error) {
      return { rows: [], errors: [{ rowNumber: "-", message: error.message || `Could not read ${label} rows.` }] };
    }
  }
}

function normalizeProductSalesRow(raw, rowNumber) {
  const value = (fields) => backfillValue(raw, fields);
  const account = resolveBackfillAccount(value(["account", "workspace", "creator account"]));
  const productName = value(["product name", "product", "product/topic", "title"]);
  const date = normalizeDateKey(value(["date", "sale date", "date sold"])) || todayDate(new Date());
  if (!account.id) return { rowNumber, error: "Account is required." };
  if (!productName) return { rowNumber, error: "Product Name is required." };
  return {
    rowNumber,
    accountId: account.id,
    account: account.name,
    productName,
    category: value(["category", "product category"]) || "Imported",
    date,
    gmv: toNumber(value(["gmv", "gross revenue", "revenue", "sales amount"])),
    commission: toNumber(value(["commission", "creator commission"])),
    unitsSold: toNumber(value(["units sold", "items sold", "unit sales", "sales"])),
    notes: value(["notes", "note"]),
    raw
  };
}

function normalizeMonthlyTotalsRow(raw, rowNumber) {
  const value = (fields) => backfillValue(raw, fields);
  const account = resolveBackfillAccount(value(["account", "workspace", "creator account"]));
  const month = normalizeMonthLabel(value(["month", "report month", "date"]));
  if (!account.id) return { rowNumber, error: "Account is required." };
  if (!month) return { rowNumber, error: "Month is required." };
  return {
    rowNumber,
    accountId: account.id,
    account: account.name,
    month,
    gmv: toNumber(value(["gmv", "gross revenue", "revenue"])),
    commission: toNumber(value(["commission", "creator commission"])),
    unitsSold: toNumber(value(["units sold", "items sold", "unit sales"])),
    videosPosted: toNumber(value(["videos posted", "posts", "videos"])),
    topProduct: value(["top product", "best product"]),
    bestVideo: value(["best video", "top video"]),
    notes: value(["notes", "note"]),
    raw
  };
}

function normalizeMonthLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[a-z]+\s+\d{4}$/i.test(text)) return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : monthLabel(date);
}

function findSalesRecordDuplicate(row) {
  db.salesRecords = db.salesRecords || [];
  return db.salesRecords.find((record) => normalizedName(record.account) === normalizedName(row.account) && normalizedName(record.productName) === normalizedName(row.productName) && normalizeDateKey(record.date || record.capturedAt || "") === row.date);
}

function findMonthlyReportDuplicate(row) {
  return (db.monthlyReports || []).find((report) => normalizedName(report.account) === normalizedName(row.account) && normalizedName(report.month) === normalizedName(row.month));
}

function importProductSalesBatch(rows, initialErrors = []) {
  db.salesRecords = db.salesRecords || [];
  const summary = { added: 0, updated: 0, skipped: 0, errors: [...initialErrors] };
  rows.forEach((row) => {
    try {
      const existing = findSalesRecordDuplicate(row);
      const product = ensureImportedProduct(row.productName, getAccount(row.accountId), row.category);
      const previous = existing ? { unitsSold: Number(existing.unitsSold || 0), gmv: Number(existing.gmv || 0), commission: Number(existing.commission || 0) } : { unitsSold: 0, gmv: 0, commission: 0 };
      const record = existing || { id: uniqueImportId(`sale-${row.accountId}-${row.date}-${slug(row.productName)}`) };
      Object.assign(record, {
        accountId: row.accountId,
        account: row.account,
        productId: product.id,
        productName: product.name,
        category: row.category,
        date: row.date,
        gmv: row.gmv,
        commission: row.commission,
        unitsSold: row.unitsSold,
        notes: row.notes,
        source: "Bulk Paste Import",
        lastUpdated: new Date().toISOString()
      });
      if (!existing) db.salesRecords.unshift(record);
      applySnapshotToProduct(product, {
        capturedAt: row.date,
        sales: row.unitsSold - previous.unitsSold,
        gmv: row.gmv - previous.gmv,
        commission: row.commission - previous.commission
      });
      summary[existing ? "updated" : "added"] += 1;
    } catch (error) {
      summary.errors.push({ rowNumber: row.rowNumber, message: error.message });
    }
  });
  return summary;
}

function importMonthlyTotalsBatch(rows, initialErrors = []) {
  const summary = { added: 0, updated: 0, skipped: 0, errors: [...initialErrors] };
  db.monthlyReports = db.monthlyReports || [];
  rows.forEach((row) => {
    try {
      const existing = findMonthlyReportDuplicate(row);
      const report = existing || { id: uniqueImportId(`monthly-${row.accountId}-${slug(row.month)}`) };
      Object.assign(report, {
        month: row.month,
        accountId: row.accountId,
        account: row.account,
        gmv: row.gmv,
        commission: row.commission,
        unitsSold: row.unitsSold,
        videosPosted: row.videosPosted,
        topProduct: row.topProduct,
        topVideo: row.bestVideo,
        notes: row.notes,
        source: "Bulk Paste Import",
        lastUpdated: new Date().toISOString()
      });
      if (!existing) db.monthlyReports.push(report);
      summary[existing ? "updated" : "added"] += 1;
    } catch (error) {
      summary.errors.push({ rowNumber: row.rowNumber, message: error.message });
    }
  });
  return summary;
}

function addValidationTotals(preview, type) {
  const missingFields = preview.errors.filter((error) => /required|missing/i.test(error.message || ""));
  const duplicates = preview.updateCandidates || [];
  const totals = (preview.validRows || []).reduce((acc, row) => {
    acc.gmv += Number(row.gmv || 0);
    acc.commission += Number(row.commission || 0);
    acc.units += Number(row.unitsSold || row.sales || 0);
    acc.videos += type === "Videos" ? 1 : 0;
    acc.samples += type === "Samples" ? 1 : 0;
    return acc;
  }, { gmv: 0, commission: 0, units: 0, videos: 0, samples: 0 });
  return { ...preview, type, missingFields, duplicates, totals };
}

function bulkPastePreviewMarkup(preview) {
  const rows = preview.validRows || [];
  return `
    <section class="import-preview-card">
      <div class="section-title"><div><h3>Real Data Validation</h3><p>Review what Northstar will save before importing.</p></div><button class="icon-button" id="confirmBulkPaste" type="button">Save Import</button></div>
      <div class="monthly-progress-grid">
        ${metric("Records added", number.format((preview.addCandidates || []).length), "New Polaris records", "")}
        ${metric("Records updated", number.format((preview.updateCandidates || []).length), "Existing matches", "")}
        ${metric("Possible duplicates", number.format((preview.duplicates || []).length), "Matched by account/date/name", "")}
        ${metric("Missing fields", number.format((preview.missingFields || []).length), "Rows needing cleanup", "")}
      </div>
      <div class="monthly-projection-row">
        <article><span>Total GMV preview</span><strong>${money.format(preview.totals?.gmv || 0)}</strong><small>${money.format(preview.totals?.commission || 0)} commission</small></article>
        <article><span>Units / rows</span><strong>${number.format(preview.totals?.units || rows.length)}</strong><small>${number.format(rows.length)} valid rows detected</small></article>
      </div>
      ${preview.errors?.length ? `<div class="import-errors"><strong>Errors</strong>${preview.errors.slice(0, 8).map((error) => `<p>Row ${error.rowNumber}: ${error.message}</p>`).join("")}</div>` : ""}
      ${rows.length ? `<div class="sync-history-table"><table><thead><tr><th>Row</th><th>Account</th><th>Name</th><th>Date/Month</th><th>Status</th></tr></thead><tbody>${rows.slice(0, 10).map((row) => `<tr><td>${row.rowNumber}</td><td>${row.account || ""}</td><td>${row.productName || row.hook || row.month || ""}</td><td>${row.datePosted || row.date || row.month || ""}</td><td>${row.existing ? "Update" : "Add"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No valid rows yet.</p>`}
    </section>
  `;
}

function realDataSummaryFromImport(summary, preview) {
  return {
    title: "Import saved",
    added: summary.added || 0,
    updated: summary.updated || 0,
    duplicates: (preview.duplicates || []).length,
    errors: summary.errors || [],
    missing: preview.missingFields || [],
    totals: preview.totals || {}
  };
}

function realDataSummaryMarkup(summary) {
  return `
    <section class="import-summary-card">
      <div class="section-title"><div><h3>${summary.title || "Saved"}</h3><p>Northstar refreshed the Morning Brief, account briefs, Today’s Direction, and Pulse Report from Polaris data.</p></div><span class="badge good">Saved</span></div>
      <div class="monthly-progress-grid">
        ${metric("Records added", number.format(summary.added || 0), "New", "")}
        ${metric("Records updated", number.format(summary.updated || 0), "Changed", "")}
        ${metric("Possible duplicates", number.format(summary.duplicates || 0), "Reviewed", "")}
        ${metric("Errors", number.format((summary.errors || []).length), "Not saved", "")}
      </div>
    </section>
  `;
}

function templateForType(type) {
  const templates = importTemplates();
  return templates[type === "Videos" ? "Video analytics" : type === "Samples" ? "Sample requests" : type === "Monthly totals" ? "Monthly account totals" : "Product sales"];
}

function importTemplates() {
  return {
    "Video analytics": "Account,Date posted,Product/topic,Category,Hook,Purpose,Views,Likes,Comments,Shares,Saves/favorites,Average watch time,Completion %,Followers gained,Sales,GMV,Commission,Creator rewards,Notes",
    "Product sales": "Account,Date,Product Name,Category,GMV,Commission,Units Sold,Notes",
    "Sample requests": "Account,Product Name,Brand,Category,Status,Priority,Date Requested,Date Approved,Date Shipped,Date Delivered,Expected Arrival,Campaign Due Date,Content Idea,Hook Idea,Notes",
    "Monthly account totals": "Account,Month,GMV,Commission,Units Sold,Videos Posted,Top Product,Best Video,Notes"
  };
}

function createPolarisBackupSnapshot(reason) {
  db.backupSnapshots = db.backupSnapshots || [];
  const backup = JSON.parse(JSON.stringify({ ...db, backupSnapshots: [] }));
  db.backupSnapshots.unshift({
    id: uniqueImportId(`backup-${Date.now()}`),
    createdAt: new Date().toISOString(),
    createdLabel: new Date().toLocaleString(),
    reason,
    data: backup
  });
  db.backupSnapshots = db.backupSnapshots.slice(0, 10);
  try {
    localStorage.setItem("northstar.v02.backupSnapshots", JSON.stringify(db.backupSnapshots));
  } catch {
    db.backupSnapshots = db.backupSnapshots.slice(0, 3);
  }
}

function recordDataSource(target, source, notes = "") {
  db.dataSourceLog = db.dataSourceLog || [];
  const existing = db.dataSourceLog.find((entry) => entry.target === target);
  const entry = {
    target,
    source,
    notes,
    lastUpdated: new Date().toISOString(),
    lastUpdatedLabel: new Date().toLocaleString()
  };
  if (existing) Object.assign(existing, entry);
  else db.dataSourceLog.unshift(entry);
}

function latestSourceLog(target) {
  return (db.dataSourceLog || []).find((entry) => entry.target === target);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function finishRealDataImport(message, reason) {
  recordDataSource("morningBrief", "Polaris", reason);
  normalizeVideoDatabase();
  saveData(message);
  if (typeof initializePulseEngine === "function") initializePulseEngine(reason);
  if (activePage === "dataHub") renderDataHub();
}

function writeRealDataImportHistory(type, summary) {
  db.importHistory = db.importHistory || [];
  db.importHistory.unshift({
    id: uniqueImportId(`real-data-import-${Date.now()}`),
    importedAt: new Date().toISOString(),
    importedLabel: new Date().toLocaleString(),
    fileName: "Bulk Paste Import",
    rowsImported: Number(summary.added || 0) + Number(summary.updated || 0),
    rowsSkipped: Number(summary.errors?.length || 0),
    account: "Mixed",
    dataType: type
  });
  db.importHistory = db.importHistory.slice(0, 80);
}

function morningBriefDiagnosticsMarkup() {
  const rows = morningBriefDataSourceAudit();
  const accountRows = northstarBriefAccounts().map(accountDiagnostics);
  const sourceRows = [
    ["Monthly Progress", latestSourceLog("monthlyReports") || { source: "Polaris", lastUpdated: "" }],
    ["Raised Right Brief", latestSourceLog("products") || latestSourceLog("videos") || { source: "Polaris", lastUpdated: "" }],
    ["Truth Tuned Tribe Brief", latestSourceLog("products") || latestSourceLog("videos") || { source: "Polaris", lastUpdated: "" }],
    ["Today's Direction", latestSourceLog("samples") || latestSourceLog("actions") || { source: "Polaris", lastUpdated: "" }],
    ["Pulse Report", latestSourceLog("morningBrief") || { source: "Polaris", lastUpdated: "" }]
  ];
  return `
    <details class="developer-diagnostics morning-brief-diagnostics">
      <summary>Developer diagnostics: Morning Brief data sources</summary>
      <div class="sync-history-table"><table><thead><tr><th>Widget</th><th>Current source</th><th>Polaris source</th><th>Migration status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.widget}</td><td>${row.current}</td><td>${row.polaris}</td><td><span class="badge ${row.status === "Migrated" ? "good" : row.status === "Awaiting Polaris data" ? "hot" : ""}">${row.status}</span></td></tr>`).join("")}</tbody></table></div>
      <div class="sync-history-table account-diagnostics-table"><table><thead><tr><th>Account</th><th>Videos</th><th>Products</th><th>Samples</th><th>Sales Records</th><th>Actions</th><th>Missing data warnings</th></tr></thead><tbody>${accountRows.map((row) => `<tr><td>${row.account}</td><td>${row.videos}</td><td>${row.products}</td><td>${row.samples}</td><td>${row.salesRecords}</td><td>${row.actions}</td><td>${row.warnings}</td></tr>`).join("")}</tbody></table></div>
      <div class="sync-history-table"><table><thead><tr><th>Section</th><th>Source</th><th>Last updated</th></tr></thead><tbody>${sourceRows.map(([section, entry]) => `<tr><td>${section}</td><td>${entry.source || "Polaris"}</td><td>${entry.lastUpdatedLabel || formatDateTime(entry.lastUpdated) || "Awaiting real-data update"}</td></tr>`).join("")}</tbody></table></div>
    </details>
  `;
}

/* Northstar Real Data + Signal Lifecycle Sprint - July 3 data and 14-day Signal Collection */
const SIGNAL_COLLECTION_DAYS = 14;
const JULY_3_REAL_DATA_SEED = "northstar-real-data-2026-07-03-v1";

const northstarSignalNormalizeDatabaseBase = normalizeDatabase;
normalizeDatabase = function normalizeRealDataAndSignals() {
  northstarSignalNormalizeDatabaseBase();
  seedJuly3RealData();
  normalizeSignalCollectionRecords();
};

function seedJuly3RealData() {
  db.seedVersions = db.seedVersions || [];
  const before = JSON.stringify({
    videos: (db.videos || []).length,
    salesRecords: (db.salesRecords || []).length,
    samples: (db.samples || db.sampleRequests || []).length
  });
  seedJuly3Videos();
  seedJuly3Sales();
  seedJuly3Samples();
  seedJuly3Learnings();
  if (!db.seedVersions.includes(JULY_3_REAL_DATA_SEED)) db.seedVersions.push(JULY_3_REAL_DATA_SEED);
  const after = JSON.stringify({
    videos: (db.videos || []).length,
    salesRecords: (db.salesRecords || []).length,
    samples: (db.samples || db.sampleRequests || []).length
  });
  if (before !== after) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Local storage can be full; the in-memory Polaris database still receives the seed safely.
    }
  }
}

function seedJuly3Videos() {
  [
    {
      accountId: "raisedRight",
      datePosted: "2026-07-03",
      timePosted: "7:00 AM",
      productName: "Fourth of July Flyover Schedule",
      category: "Patriotic / Current Events",
      hook: "Flyover schedule for the Fourth of July",
      views: 22300,
      likes: 395,
      comments: 19,
      shares: 160,
      saves: 80,
      averageWatchTime: 11.5,
      completionRate: 43.44,
      newFollowers: 8,
      sales: 0,
      gmv: 0,
      commission: 0,
      notes: "High completion informational/current-event patriotic content."
    },
    {
      accountId: "raisedRight",
      datePosted: "2026-07-03",
      timePosted: "2:55 PM",
      productName: "New Air Force One Flyover",
      category: "Patriotic / Current Events",
      hook: "Trump Force One / New Air Force One flyover",
      views: 225300,
      likes: 11000,
      comments: 319,
      shares: 1941,
      saves: 587,
      averageWatchTime: 15,
      completionRate: 17.58,
      newFollowers: 437,
      sales: 0,
      gmv: 0,
      commission: 0,
      notes: "Viral audience builder. Strong follower growth and shareability. Non-shop content should influence audience-growth intelligence."
    },
    {
      accountId: "raisedRight",
      datePosted: "2026-07-02",
      timePosted: "9:49 PM",
      productName: "CERN / Time Returned Post",
      category: "Curiosity / Community Content",
      hook: "Did time feel slower because CERN shut down?",
      views: 719,
      likes: 19,
      comments: 3,
      shares: 1,
      saves: 0,
      averageWatchTime: 0,
      completionRate: 0,
      newFollowers: 0,
      sales: 0,
      gmv: 0,
      commission: 0,
      notes: "Community curiosity post. Track as audience signal."
    },
    {
      accountId: "raisedRight",
      datePosted: "2026-07-02",
      timePosted: "6:01 PM",
      productName: "Freeze Pop / Heat Product",
      category: "Summer / Utility",
      hook: "Summer heat / freezer pop product",
      views: 931,
      likes: 5,
      comments: 0,
      shares: 1,
      saves: 0,
      averageWatchTime: 4.3,
      completionRate: 2.11,
      newFollowers: 0,
      sales: 0,
      gmv: 0,
      commission: 0,
      notes: "Product video still within 14-day Signal Collection window."
    },
    {
      accountId: "truthTunedTribe",
      datePosted: "2026-07-03",
      timePosted: "1:20 PM",
      productName: "Copper Plant Stakes",
      category: "Garden / Plant Care",
      hook: "Plants looking weak no matter what you do?",
      views: 380,
      likes: 4,
      comments: 0,
      shares: 1,
      saves: 2,
      averageWatchTime: 6.4,
      completionRate: 2.68,
      newFollowers: 0,
      sales: 0,
      gmv: 0,
      commission: 0,
      notes: "Do not mark as failure. New product video. Hold in Signal Collection for 14 days."
    }
  ].forEach(upsertSeedVideo);
}

function upsertSeedVideo(row) {
  const account = getAccount(row.accountId);
  const product = ensureImportedProduct(row.productName, account, row.category);
  const existing = videos().find((video) => {
    const sameAccount = video.accountId === row.accountId || normalizedName(video.account) === normalizedName(account.name);
    const sameDate = normalizeDateKey(video.datePosted || "") === row.datePosted;
    const sameTopic = normalizedName(video.productName) === normalizedName(row.productName) || normalizedName(video.hook) === normalizedName(row.hook);
    return sameAccount && sameDate && sameTopic;
  });
  const target = existing || { id: uniqueImportId(`video-${row.accountId}-${row.datePosted}-${slug(row.productName)}`) };
  Object.assign(target, {
    datePosted: row.datePosted,
    timePosted: row.timePosted,
    accountId: row.accountId,
    account: account.name,
    productId: product.id,
    productName: product.name,
    category: row.category,
    hook: row.hook,
    hookType: row.category,
    contentPurpose: row.gmv > 0 || row.sales > 0 ? "Revenue / Product Signal" : "Audience / Content Signal",
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    averageWatchTime: row.averageWatchTime,
    completionRate: row.completionRate,
    newFollowers: row.newFollowers,
    sales: row.sales,
    gmv: row.gmv,
    commission: row.commission,
    notes: row.notes,
    source: "July 3 Real Data Sprint",
    signalStatus: "Signal Collection",
    lastUpdated: new Date().toISOString()
  });
  if (!existing) db.videos.push(target);
  product.lastPromotedDate = row.datePosted;
  if (!product.firstPromotedDate) product.firstPromotedDate = row.datePosted;
  product.signalStatus = "Signal Collection";
}

function seedJuly3Sales() {
  [
    ["raisedRight", "2-in-1 Garden Hoe & Weed Puller Rake", "Garden / Outdoor Problem Solver", 81.10, 8.30, 4],
    ["raisedRight", "4-in-1 Digital TDS Water Quality Tester", "Health / Water / Home Testing", 31.52, 6.32, 8],
    ["raisedRight", "The Complete Peptide Protocols Playbook", "Health Book / Biohacking", 24.71, 2.04, 1],
    ["raisedRight", "Big Size Jericho Flower", "Garden / Spiritual", 10.34, 1.03, 1],
    ["truthTunedTribe", "The Complete Peptide Protocols Playbook", "Health Book / Biohacking", 204.59, 16.32, 9],
    ["truthTunedTribe", "The Ultimate Peptide Protocols Bible", "Health Book / Biohacking", 25.98, 2.16, 1],
    ["truthTunedTribe", "Women's Solid Color Hollow Out Tie Front", "Fashion", 14.84, 1.32, 1]
  ].forEach(([accountId, productName, category, gmv, commission, unitsSold]) => {
    upsertSeedSale({ accountId, productName, category, gmv, commission, unitsSold, date: "2026-07-03" });
  });
}

function upsertSeedSale(row) {
  db.salesRecords = db.salesRecords || [];
  const account = getAccount(row.accountId);
  const product = ensureImportedProduct(row.productName, account, row.category);
  const existing = db.salesRecords.find((record) => {
    return (record.accountId === row.accountId || normalizedName(record.account) === normalizedName(account.name)) &&
      normalizedName(record.productName) === normalizedName(product.name) &&
      normalizeDateKey(record.date || record.capturedAt || "") === row.date;
  });
  const previous = existing ? {
    unitsSold: Number(existing.unitsSold || 0),
    gmv: Number(existing.gmv || 0),
    commission: Number(existing.commission || 0)
  } : { unitsSold: 0, gmv: 0, commission: 0 };
  const record = existing || { id: uniqueImportId(`sale-${row.accountId}-${row.date}-${slug(product.name)}`) };
  Object.assign(record, {
    accountId: row.accountId,
    account: account.name,
    productId: product.id,
    productName: product.name,
    category: row.category,
    date: row.date,
    gmv: row.gmv,
    commission: row.commission,
    unitsSold: row.unitsSold,
    source: "July 3 Real Data Sprint",
    lastUpdated: new Date().toISOString()
  });
  if (!existing) db.salesRecords.unshift(record);
  applySnapshotToProduct(product, {
    capturedAt: row.date,
    sales: row.unitsSold - previous.unitsSold,
    gmv: row.gmv - previous.gmv,
    commission: row.commission - previous.commission
  });
}

function seedJuly3Samples() {
  [
    ["raisedRight", "RAD Recovery Rounds Myofascial Release Balls", "Wellness / Recovery", "Waiting to Film", 12, 3.75, 25.00, "Needs content. Post a review for followers."],
    ["raisedRight", "Dashing Diva Miss Me Medium Square Glue-On Gel Nails", "Beauty / Nails", "Waiting to Film", 13, 1.50, 10.00, "Needs content. Post a review for followers."],
    ["truthTunedTribe", "Smart AI Glasses with Camera", "Tech / AI / Creator Tools", "Waiting to Film", 5, 2.87, 79.79, "Needs content urgently. Sample deadline should appear in Today’s Direction."]
  ].forEach(([accountId, productName, category, status, daysRemaining, estimatedCommission, productPrice, notes]) => {
    const account = getAccount(accountId);
    const sample = normalizePolarisSample({
      accountId,
      account: account.name,
      productName,
      category,
      status,
      priority: daysRemaining <= 5 ? "High" : "Medium",
      seasonality: "Evergreen",
      daysRemaining,
      estimatedCommission,
      productPrice,
      notes,
      source: "July 3 Real Data Sprint",
      lastUpdated: new Date().toISOString()
    });
    saveSample(sample);
  });
}

function seedJuly3Learnings() {
  db.notes = db.notes || {};
  db.notes.lessons = db.notes.lessons || [];
  [
    "Air Force One video generated 225.3K views and 437 followers.",
    "Patriotic/current-event informational content is a strong audience builder for Raised Right.",
    "Raised Right sales were led by Garden Hoe and TDS Meter.",
    "Truth Tuned Tribe sales were led by Complete Peptide Protocols Playbook with 9 units.",
    "Smart AI Glasses sample has only 5 days left and should be filmed soon."
  ].forEach((lesson, index) => {
    const id = `july-3-learning-${index + 1}`;
    const existing = db.notes.lessons.find((item) => item.id === id);
    const row = {
      id,
      title: "Yesterday’s Learning",
      account: index === 3 ? "Truth Tuned Tribe" : index === 4 ? "Truth Tuned Tribe" : "Raised Right",
      category: "Real Data",
      lesson,
      confidence: "High",
      dateAdded: "2026-07-04",
      tags: ["july-3", "real-data", "signal-lifecycle"],
      source: "July 3 Real Data Sprint"
    };
    if (existing) Object.assign(existing, row);
    else db.notes.lessons.unshift(row);
  });
}

function normalizeSignalCollectionRecords() {
  videos().forEach((video) => {
    const signal = signalCollectionInfo(video);
    video.signalStatus = signal.isCollecting ? "Signal Collection" : video.signalStatus || "Ready for Evaluation";
    video.lifecycleStage = signal.isCollecting ? "New" : video.lifecycleStage || "";
  });
  products().forEach((product) => {
    const signal = productSignalCollectionInfo(product);
    product.signalStatus = signal.isCollecting ? "Signal Collection" : product.signalStatus || "";
    if (product.status === "Retire") product.status = "Cooling";
    if (product.originalStatus === "Retire") product.originalStatus = "Cooling";
  });
}

function signalCollectionInfo(item) {
  const rawDate = item.datePosted || item.lastPromotedDate || item.firstPromotedDate || item.postedAt || "";
  const posted = rawDate ? new Date(`${normalizeDateKey(rawDate)}T00:00:00`) : null;
  if (!posted || Number.isNaN(posted.getTime())) return { isCollecting: false, daysSince: null, daysRemaining: 0 };
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysSince = Math.max(0, Math.floor((todayMidnight - posted) / 86400000));
  const daysRemaining = Math.max(0, SIGNAL_COLLECTION_DAYS - daysSince);
  return { isCollecting: daysSince < SIGNAL_COLLECTION_DAYS, daysSince, daysRemaining };
}

function productSignalCollectionInfo(product) {
  const related = productVideos(product.id);
  const latestVideo = related.slice().sort((a, b) => new Date(b.datePosted || 0) - new Date(a.datePosted || 0))[0];
  return signalCollectionInfo(latestVideo || product);
}

function signalCollectionBadgeForInfo(signal) {
  if (!signal.isCollecting) return "";
  return `<span class="signal-collection-badge">Signal Collection · ${number.format(signal.daysSince)} days since · ${number.format(signal.daysRemaining)} days left</span>`;
}

function signalCollectionNote() {
  return "Too early to judge. TikTok may still distribute this video, and seller/ad spend may still amplify it.";
}

function productLifecycle(product) {
  const signal = productSignalCollectionInfo(product);
  if (signal.isCollecting) return { stage: "New", icon: "●", className: "signal-collection", reason: `${signal.daysSince} days since posted. ${signal.daysRemaining} days remaining before evaluation. ${signalCollectionNote()}` };
  const opportunity = opportunityScore(product);
  const momentum = productRecentMomentum(product);
  const timing = seasonIntelligence(product);
  if (timing === "Ending Soon" || opportunity.score < 35 || (momentum <= 3 && opportunity.score < 65) || product.status === "Cooling") return { stage: "Cooling", icon: "↓", className: "slowing", reason: "Momentum or timing is cooling." };
  if (opportunity.score >= 88 && Number(product.lifetimeUnits || 0) >= Math.max(2, maxProductValue("lifetimeUnits") * 0.5)) return { stage: "Peak", icon: "★", className: "peak", reason: "High opportunity with proven sales." };
  if (opportunity.score >= 68 || momentum >= 8) return { stage: "Growing", icon: "▲", className: "growing", reason: "Positive momentum and useful Signals." };
  return { stage: "Emerging", icon: "•", className: "emerging", reason: "Early product with incomplete proof." };
}

function opportunityPill(product) {
  const signal = productSignalCollectionInfo(product);
  if (signal.isCollecting) return `<span class="opportunity-pill opportunity-mid">Signal Collection</span>`;
  const opportunity = opportunityScore(product);
  const className = opportunity.score >= 84 ? "opportunity-hot" : opportunity.score >= 60 ? "opportunity-mid" : "opportunity-low";
  return `<span class="opportunity-pill ${className}">${opportunity.icon} ${opportunity.score} Opportunity</span>`;
}

function lifecycleBadge(product) {
  const lifecycle = productLifecycle(product);
  return `<span class="lifecycle-badge ${lifecycle.className}">${lifecycle.icon} ${lifecycle.stage}</span>`;
}

function recommendationGroups() {
  return scoredProducts().reduce((groups, product) => {
    const signal = productSignalCollectionInfo(product);
    if (signal.isCollecting) {
      groups.WATCH.push(product);
      return groups;
    }
    const score = opportunityScore(product).score;
    const lifecycle = productLifecycle(product).stage;
    const lane = score >= 78 && lifecycle !== "Cooling" ? "DOUBLE DOWN" : score >= 60 ? "WATCH" : "WAIT";
    groups[lane].push(product);
    return groups;
  }, { "DOUBLE DOWN": [], WATCH: [], WAIT: [] });
}

function productNextMove(product) {
  const signal = productSignalCollectionInfo(product);
  if (signal.isCollecting) return `Signal Collection: ${signal.daysSince} days since posted, ${signal.daysRemaining} days before evaluation. ${signalCollectionNote()}`;
  const opportunity = opportunityScore(product);
  const lifecycle = productLifecycle(product);
  if (opportunity.score >= 84 && lifecycle.stage !== "Cooling") return "Double down: this product is outperforming your account average.";
  if (lifecycle.stage === "Cooling") return "Cooling: refresh the angle or replace with a stronger seasonal product.";
  if (seasonIntelligence(product) === "Coming Soon") return "Prepare ahead: request, film, or draft hooks before demand peaks.";
  if (opportunity.score < 40) return "Wait unless a new hook proves demand.";
  return "Watch: test one more hook before scaling.";
}

function doubleDownProducts() {
  return scoredProducts().filter((product) => {
    if (productSignalCollectionInfo(product).isCollecting) return false;
    const opportunity = opportunityScore(product);
    return opportunity.score >= 74 && opportunity.confidence >= 55 && productRecentMomentum(product) >= 7 && Number(product.lifetimeUnits || 0) > 0;
  }).slice(0, 8).map((product) => ({ product, reason: `${product.name} is outperforming your account average with ${opportunityScore(product).score} Opportunity and positive momentum.` }));
}

function weeklyIntelligenceBrief() {
  const ranked = scoredProducts();
  const categories = categoryIntelligence();
  const doubleDown = doubleDownProducts();
  const cooling = ranked.filter((product) => productLifecycle(product).stage === "Cooling").slice(0, 3);
  const top = ranked[0];
  const lesson = latestKnowledgeLesson();
  return {
    improved: doubleDown.slice(0, 3).map((item) => item.product.name),
    slowed: cooling.map((product) => product.name),
    topOpportunity: top ? `${top.name} (${productSignalCollectionInfo(top).isCollecting ? "Signal Collection" : `${opportunityScore(top).score} Opportunity`})` : "Add product data to generate this.",
    film: doubleDown.slice(0, 4).map((item) => item.product.name),
    request: requestOpportunities().slice(0, 4).map((item) => item.title),
    retire: [],
    biggestWin: categories[0] ? `${categories[0].category} leads with ${categories[0].averageOpportunity} average Opportunity.` : "No category winner yet.",
    biggestLesson: lesson?.lesson || lesson?.title || "Keep capturing sales outcomes so Northstar can learn."
  };
}

function buildActionPlan() {
  const statuses = readJson(ACTION_STATUS_KEY, {});
  const ranked = scoredProducts();
  const actions = [];
  const smartGlasses = polarisSamples().find((sample) => /smart ai glasses/i.test(sample.productName || ""));
  const copper = videos().find((video) => /copper plant stakes/i.test(video.productName || ""));
  const airForce = videos().find((video) => /air force one|trump force one/i.test(`${video.productName} ${video.hook}`));
  if (smartGlasses) actions.push({
    id: "action-film-smart-ai-glasses",
    category: "Film",
    action: "Film Smart AI Glasses",
    productOrCategory: "Smart AI Glasses with Camera",
    account: "Truth Tuned Tribe",
    confidence: 94,
    reason: "Sample has only 5 days left and needs content urgently.",
    priority: "High",
    status: "Open"
  });
  if (airForce) actions.push({
    id: "action-raised-right-patriotic-current-event",
    category: "Repost",
    action: "Create another patriotic/current-event informational post",
    productOrCategory: "Patriotic / Current Events",
    account: "Raised Right",
    confidence: 90,
    reason: "Air Force One video generated 225.3K views and 437 followers.",
    priority: "High",
    status: "Open"
  });
  if (copper) actions.push({
    id: "action-watch-copper-plant-stakes",
    category: "Watch",
    action: "Monitor Copper Plant Stakes",
    productOrCategory: "Copper Plant Stakes",
    account: "Truth Tuned Tribe",
    confidence: 82,
    reason: "Copper Plant Stakes is still in Signal Collection and is too early to judge.",
    priority: "Medium",
    status: "Open"
  });
  if (ranked.length) {
    const doubleDown = doubleDownProducts()[0];
    const top = ranked.find((product) => !productSignalCollectionInfo(product).isCollecting) || ranked[0];
    const request = requestOpportunities()[0];
    const repost = ranked.find((product) => intelligenceSeason(product) === "Evergreen" && productLifecycle(product).stage !== "Cooling") || top;
    const watch = ranked.find((product) => productSignalCollectionInfo(product).isCollecting) || ranked.find((product) => productLifecycle(product).stage === "Cooling" || (opportunityScore(product).score >= 40 && opportunityScore(product).score < 65)) || ranked[2];
    const lesson = latestKnowledgeLesson();
    if (doubleDown?.product) actions.push(makeAction("Film", `Film again: ${shortName(doubleDown.product.name)}`, doubleDown.product, confidenceForAction(doubleDown.product, "Film"), doubleDown.reason, doubleDown.product.name, "High"));
    else if (top) actions.push(makeAction("Film", `Film: ${shortName(top.name)}`, top, confidenceForAction(top, "Film"), productNextMove(top), top.name));
    if (request) actions.push(makeAction("Request", `Request: ${request.title}`, null, confidenceForCategory(request.title), request.note, request.title, "Medium"));
    if (repost) actions.push(makeAction("Repost", `Repost or remake: ${shortName(repost.name)}`, repost, confidenceForAction(repost, "Repost"), `${repost.name} has ${productSignalCollectionInfo(repost).isCollecting ? "an active Signal Collection window" : `${opportunityScore(repost).score} Opportunity`} and can keep feeding the same audience Signal.`));
    if (watch) actions.push(makeAction("Watch", `Monitor: ${shortName(watch.name)}`, watch, confidenceForAction(watch, "Watch"), productNextMove(watch), watch.categoryGroup, "Low"));
    if (lesson) actions.push(makeAction("Learn", `Apply lesson: ${shortName(lesson.title || lesson.subject || "recent lesson")}`, null, Number(lesson.confidence || 72), lesson.lesson || lesson.title || "Use the latest captured lesson in today's creative decisions.", lesson.subject || "Knowledge Vault", "Medium", lesson.account));
  }
  return actions
    .map((action) => ({ ...action, ...(statuses[action.id] || {}) }))
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.confidence - a.confidence)
    .filter((action, index, list) => list.findIndex((item) => item.id === action.id) === index)
    .slice(0, 18);
}

function todayDirectionGroups() {
  const actions = positiveActionPlan();
  const smartGlasses = polarisSamples().find((sample) => /smart ai glasses/i.test(sample.productName || ""));
  const requestSample = polarisSamples().find((sample) => sample.priority === "High" && ["Idea", "Request Now"].includes(sample.status));
  const filmedSample = polarisSamples().find((sample) => sample.status === "Filmed");
  const shippedSample = polarisSamples().find((sample) => ["Requested", "Approved", "Shipped"].includes(sample.status));
  const copper = videos().find((video) => /copper plant stakes/i.test(video.productName || ""));
  const patriotic = videos().find((video) => /air force one|flyover/i.test(`${video.productName} ${video.hook}`));
  return {
    film: [
      smartGlasses ? { category: "Film", productOrCategory: "Smart AI Glasses", reason: "Film Smart AI Glasses for Truth Tuned Tribe. Only 5 days remain on the sample." } : null,
      actions.find((action) => action.category === "Film")
    ].filter(Boolean).slice(0, 2),
    request: [
      requestSample ? { category: "Request", productOrCategory: requestSample.productName, reason: `${requestSample.productName} is a high-priority sample opportunity.` } : null
    ].filter(Boolean).slice(0, 2),
    repost: [
      patriotic ? { category: "Post / Repost", productOrCategory: "Patriotic / Current Events", reason: "Consider another patriotic/current-event informational post for Raised Right." } : null,
      filmedSample ? { category: "Post / Repost", productOrCategory: filmedSample.productName, reason: `${filmedSample.productName} is filmed; move it toward posting.` } : null
    ].filter(Boolean).slice(0, 2),
    attention: [
      copper ? { category: "Watch", productOrCategory: "Copper Plant Stakes", reason: "Continue monitoring Copper Plant Stakes because it is still in Signal Collection." } : null,
      shippedSample ? { category: "Follow up", productOrCategory: shippedSample.productName, reason: `${shippedSample.productName} needs a sample status check.` } : null
    ].filter(Boolean).slice(0, 2)
  };
}

function yesterdayLearningsMarkup() {
  const learnings = [
    "Air Force One video generated 225.3K views and 437 followers.",
    "Patriotic/current-event informational content is a strong audience builder for Raised Right.",
    "Raised Right sales were led by Garden Hoe and TDS Meter.",
    "Truth Tuned Tribe sales were led by Complete Peptide Protocols Playbook with 9 units.",
    "Smart AI Glasses sample has only 5 days left and should be filmed soon."
  ];
  return `<section class="card yesterday-learnings-card"><div class="section-title"><div><h3>Yesterday's Learnings</h3><p>July 3 Signals Northstar should use today.</p></div><span class="badge good">Real data</span></div><div class="brief-list">${learnings.map((learning) => `<article><strong>${learning}</strong></article>`).join("")}</div></section>`;
}

const northstarSignalRefineMorningBriefBase = refineMorningBriefCommandCenterOrder;
refineMorningBriefCommandCenterOrder = function refineMorningBriefWithSignalLifecycle() {
  northstarSignalRefineMorningBriefBase();
  const monthly = content.querySelector(".monthly-progress-card");
  if (monthly && !content.querySelector(".yesterday-learnings-card")) monthly.insertAdjacentHTML("afterend", yesterdayLearningsMarkup());
  content.querySelectorAll(".brief-section h4, .recommendation-column h3, .detail-actions button, option, .badge").forEach((node) => {
    if (/Retire/i.test(node.textContent || "")) node.textContent = node.textContent.replace(/Retire/gi, "Cooling");
  });
  bindInternalButtons();
};

function videoRows(list) {
  return list.map((video) => {
    const signal = signalCollectionInfo(video);
    return `<tr><td>${video.datePosted}${video.timePosted ? `<span>${video.timePosted}</span>` : ""}</td><td>${video.account}</td><td>${video.productName}${signalCollectionBadgeForInfo(signal)}</td><td><strong>${video.hook}</strong><span>${video.cta || ""}</span>${signal.isCollecting ? `<small>${signalCollectionNote()}</small>` : ""}</td><td>${number.format(video.views || 0)}</td><td>${number.format(video.likes || 0)} likes · ${number.format(video.saves || 0)} saves · ${number.format(video.shares || 0)} shares</td><td>${video.averageWatchTime || 0}s · ${video.completionRate || 0}%</td><td>${number.format(video.sales || 0)}</td><td>${money.format(video.gmv || 0)}</td><td>${money.format(video.commission || 0)}</td></tr>`;
  }).join("") || `<tr><td colspan="10">No videos yet.</td></tr>`;
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const opportunity = opportunityScore(product);
  const lifecycle = productLifecycle(product);
  const signal = productSignalCollectionInfo(product);
  const timeline = productTimeline(product);
  const relatedVideos = productVideos(product.id);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).sort((a, b) => opportunityScore(b).score - opportunityScore(a).score).slice(0, 6);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back to Products</button>
    <div class="detail-header intelligence-detail">
      <div class="product-detail-hero-image">${productImageMarkup(product)}</div>
      <div><span class="badge ${statusClass(product.status)}">${product.status === "Retire" ? "Cooling" : product.status}</span><h3>${product.name}</h3><p>${product.account} · ${product.category} · ${intelligenceSeason(product)}</p>${signalCollectionBadgeForInfo(signal)}</div>
      <div class="score-badge ${opportunity.tierClass}"><strong>${signal.isCollecting ? "New" : opportunity.score}</strong><span>${signal.isCollecting ? "Signal Collection" : "Opportunity"}</span></div>
      <div class="detail-actions">
        <button class="icon-button" id="addNoteButton">Add Note</button>
        <button class="icon-button" id="addVideoButton">Add Video</button>
        ${["Double Down", "Watch", "Wait", "Cooling"].map((status) => `<button class="icon-button" data-status="${status}">Mark as ${status}</button>`).join("")}
      </div>
    </div>
    ${signal.isCollecting ? `<section class="card signal-collection-card"><h3>Signal Collection</h3><p>${signalCollectionNote()}</p><div class="grid two">${metric("Days since posted", number.format(signal.daysSince), "Lifecycle: New", "")}${metric("Days remaining", number.format(signal.daysRemaining), "Before evaluation", "")}</div></section>` : ""}
    <section class="card product-intelligence-card">
      <div class="section-title"><div><h3>Product Intelligence</h3><p>${lifecycle.reason}</p></div>${opportunityPill(product)}</div>
      <div class="grid four">
        ${metric("Lifecycle", `${lifecycle.icon} ${lifecycle.stage}`, lifecycle.reason, "")}
        ${metric("Season", intelligenceSeason(product), "Manual edits save locally.", "")}
        ${metric("Confidence", signal.isCollecting ? "Collecting" : `${opportunity.confidence}%`, "Completeness, sales proof, and momentum.", "")}
        ${metric("Double Down", !signal.isCollecting && opportunity.score >= 78 ? "Yes" : "Not yet", productNextMove(product), "")}
      </div>
      <label class="season-editor">Manual season ${select("productSeasonSelect", ["Spring", "Summer", "Back to School", "Halloween", "Holiday", "Winter", "Evergreen", "Seasonal"], intelligenceSeason(product))}</label>
    </section>
    ${hookGeneratorMarkup(product)}
    <div class="grid four">
      ${metric("Lifetime GMV", money.format(product.lifetimeGmv || 0), "Revenue signal", "")}
      ${metric("Commission", money.format(product.lifetimeCommission || 0), "Profit signal", "")}
      ${metric("Units", number.format(product.lifetimeUnits || 0), "Demand signal", "")}
      ${metric("Recent Momentum", productRecentMomentum(product), "Snapshot or recent sales movement", "")}
    </div>
    <div class="grid two">
      <section class="card"><h3>Product Timeline</h3><div class="timeline">${timeline.map((item) => `<div class="timeline-item ${item.done ? "done" : ""}"><span></span><div><strong>${item.label}</strong><p>${item.value}</p></div></div>`).join("")}</div></section>
      <section class="card"><h3>Decision Notes</h3><div class="field-list"><p><strong>Best hook:</strong> ${product.bestHook || "Add after testing."}</p><p><strong>Best CTA:</strong> ${product.bestCta || "Add after testing."}</p><p><strong>Next move:</strong> ${productNextMove(product)}</p><p><strong>Notes:</strong> ${formatNotes(product.notes)}</p></div></section>
    </div>
    <div class="grid two">${tableCard("Related Videos", videoRows(relatedVideos))}<div class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></div></div>
  `;
  bindInternalButtons();
  bindHookGeneratorControls(product);
  document.querySelector("#productSeasonSelect")?.addEventListener("change", (event) => { setProductSeason(product.id, event.target.value); renderProductDetail(product.id); });
  document.querySelector("#addNoteButton").addEventListener("click", () => {
    const note = prompt("Add a strategy note for this product:");
    if (note) {
      product.notes = [product.notes, `${new Date().toLocaleDateString()}: ${note}`].filter(Boolean).join("\n");
      product.strategyNotes = note;
      saveData(`Note saved for ${product.name}`);
      renderProductDetail(product.id);
    }
  });
  document.querySelector("#addVideoButton").addEventListener("click", () => { videoFilters.product = product.name; renderPage("videos"); });
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    product.status = button.dataset.status;
    saveData(`${product.name} marked as ${product.status}`);
    renderProductDetail(product.id);
  }));
}

function scoreLabel(score) {
  if (score >= 95) return { label: "Excellent", tierClass: "excellent" };
  if (score >= 84) return { label: "Strong", tierClass: "strong" };
  if (score >= 72) return { label: "Good", tierClass: "good-score" };
  if (score >= 40) return { label: "Watch", tierClass: "watch-score" };
  return { label: "Cooling", tierClass: "watch-score" };
}

function statusClass(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("double") || text.includes("selling")) return "good";
  if (text.includes("wait") || text.includes("watch") || text.includes("cool")) return "hot";
  return "";
}

function productForm() {
  return `<form id="addProductForm" class="data-form">
    <label>Product name<input name="name" required placeholder="New product name"></label>
    <label>Account<select name="accountId">${accounts().map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}</select></label>
    <label>Category<input name="category" required placeholder="Home / Utility"></label>
    <label>Seasonality<input name="seasonality" value="Evergreen"></label>
    <label>Evergreen/Seasonal<select name="evergreenSeasonal"><option>Evergreen</option><option>Seasonal</option></select></label>
    <label>GMV<input name="lifetimeGmv" type="number" step="0.01" value="0"></label>
    <label>Commission<input name="lifetimeCommission" type="number" step="0.01" value="0"></label>
    <label>Units<input name="lifetimeUnits" type="number" step="1" value="0"></label>
    <label>First promoted<input name="firstPromotedDate" type="date"></label>
    <label>Last promoted<input name="lastPromotedDate" type="date"></label>
    <label>Sample status<select name="sampleStatus">${sampleStatusOptions().map((s) => `<option>${s}</option>`).join("")}</select></label>
    <label>Would promote again<select name="wouldPromoteAgain"><option>Yes</option><option selected>Maybe</option><option>No</option></select></label>
    <label>Status<select name="status"><option>Double Down</option><option selected>Watch</option><option>Wait</option><option>Cooling</option></select></label>
    <label>Best hook<input name="bestHook" placeholder="Winning hook"></label>
    <label>Best CTA<input name="bestCta" placeholder="CTA"></label>
    <label class="wide">Notes<textarea name="notes" placeholder="Product notes"></textarea></label>
    <button class="icon-button" type="submit">Save Product</button>
  </form>`;
}

function renderActionPlan() {
  const actions = buildActionPlan();
  ensureActionDecisionLog(actions);
  const top = actions.filter((action) => action.status !== "Dismissed").slice(0, 5);
  content.innerHTML = `
    <section class="action-hero">
      <div class="pulse-mark pulse-once" aria-hidden="true"><img src="assets/brand/northstar-mark.svg" alt=""></div>
      <div>
        <p class="eyebrow">Action Plan</p>
        <h1>What should I do next?</h1>
        <p>Northstar turns Signals into direction using sales strength, commission, growth, seasonality, and audience fit.</p>
      </div>
      <div class="action-export">
        <button class="icon-button" data-export-actions="text">Export Plain Text</button>
        <button class="ghost-button" data-export-actions="json">Export JSON</button>
      </div>
    </section>
    ${actions.length ? `
      <section class="card top-actions-card">
        <div class="section-title"><div><h3>Today's Top 5 Actions</h3><p>Open Northstar, do these first.</p></div><span class="badge good">Confidence Engine</span></div>
        <div class="action-card-grid">${top.map(actionCard).join("")}</div>
      </section>
      <section class="card action-category-card">
        <div class="section-title"><div><h3>Action Categories</h3><p>Film, request, repost, watch, and learn lanes.</p></div></div>
        <div class="action-lanes">${["Film", "Request", "Repost", "Watch", "Learn"].map((category) => actionLane(category, actions)).join("")}</div>
      </section>
      <section class="card action-history-card">
        <div class="section-title"><div><h3>Action History</h3><p>Completed, snoozed, and dismissed actions are saved locally.</p></div><button class="chart-detail-link" data-page="decisionLog">Open Decision Log</button></div>
        ${actionHistoryTable()}
      </section>
    ` : `<section class="card"><h3>Northstar needs more creator data before creating reliable direction.</h3><p class="empty">Capture products, videos, or import a CSV. Action Plan will activate once there are enough Signals.</p><button class="icon-button" data-page="fastCapture">Capture Data</button></section>`}
  `;
  bindInternalButtons();
  bindActionPlanControls(actions);
}

function accountContentMarkup(contentData) {
  const rows = [
    ["Top video", contentData.topVideo],
    ["Growth video", contentData.growthVideo],
    ["Trust / education", contentData.educationVideo],
    ["Needs review", contentData.underperformingVideo]
  ];
  return `<div class="account-content-list">${rows.map(([label, video]) => {
    const signal = video ? signalCollectionInfo(video) : { isCollecting: false };
    const displayLabel = signal.isCollecting && label === "Needs review" ? "Signal Collection" : label;
    return `<div><span>${displayLabel}</span><strong>${video ? shortName(video.productName || video.hook) : "Awaiting data"}</strong><small>${video ? `${number.format(video.views || 0)} views · ${signal.isCollecting ? "Too early to judge" : `${number.format(video.sales || 0)} sales`}` : "No Polaris video Signal yet"}</small></div>`;
  }).join("")}</div>`;
}

let generatedHookIdeasByProduct = {};

function hookGeneratorMarkup(product) {
  const ideas = generatedHookIdeasByProduct[product.id] || [];
  return `
    <section class="card hook-generator-card">
      <div class="section-title">
        <div><h3>Hook Generator</h3><p>Audience-specific hooks for the next ${product.account} video.</p></div>
        <button class="icon-button" id="generateHookIdeas" type="button">Generate Hook Ideas</button>
      </div>
      <div class="hook-generator-context-wrap">
        <div class="hook-generator-image">${productImageMarkup(product)}</div>
        <div class="hook-generator-context">
          ${hookContextPill("Product", product.name)}
          ${hookContextPill("Account / Brand", product.account)}
          ${hookContextPill("Category", product.categoryGroup || product.category)}
          ${hookContextPill("Lifecycle", productLifecycle(product).stage)}
          ${hookContextPill("Opportunity", productSignalCollectionInfo(product).isCollecting ? "Signal Collection" : opportunityScore(product).label)}
          ${hookContextPill("Best hook", product.bestHook || "Not saved yet")}
          ${hookContextPill("Best CTA", product.bestCta || "Not saved yet")}
        </div>
      </div>
      <div class="hook-audience-profile">
        <strong>Audience profile</strong>
        <p>${audienceProfileForProduct(product)}</p>
      </div>
      ${ideas.length ? `<div class="generated-hook-grid">${ideas.map((idea, index) => hookIdeaCard(product, idea, index)).join("")}</div>` : `<p class="empty">Generate hooks when you are ready to plan the next video for this product.</p>`}
    </section>
  `;
}

function hookContextPill(label, value) {
  return `<span><strong>${label}</strong>${escapeHtml(value || "Not set")}</span>`;
}

function audienceProfileForProduct(product) {
  if (product.accountId === "raisedRight" || /raised right/i.test(product.account || "")) {
    return "Useful problem-solver, practical, Gen-X relatable, home/garden when relevant, patriotic when relevant, with “I didn’t know I needed this” energy.";
  }
  if (product.accountId === "truthTunedTribe" || /truth tuned tribe/i.test(product.account || "")) {
    return "Curiosity, education, wellness, authority, and “I researched this so you don’t have to” energy.";
  }
  return "Specific, practical, curiosity-driven, and grounded in the product notes.";
}

function hookIdeaCard(product, idea, index) {
  const saved = hookAlreadySaved(product, idea.text);
  return `
    <article class="generated-hook-card">
      <div class="generated-hook-top"><span class="badge">${idea.type}</span><span class="badge ${saved ? "good" : ""}">${saved ? "Saved" : "Untested"}</span></div>
      <h4>${escapeHtml(idea.text)}</h4>
      <p><strong>CTA:</strong> ${escapeHtml(idea.cta)}</p>
      <p><strong>Why:</strong> ${escapeHtml(idea.why)}</p>
      <p><strong>Angle:</strong> ${escapeHtml(idea.angle)}</p>
      <div class="hook-card-actions">
        <button class="ghost-button" type="button" data-save-hook="${index}">Save to Hooks</button>
        <button class="ghost-button" type="button" data-copy-hook="${index}">Copy Hook</button>
        <button class="ghost-button" type="button" data-film-hook="${index}">Mark for Filming</button>
      </div>
    </article>
  `;
}

function bindHookGeneratorControls(product) {
  document.querySelector("#generateHookIdeas")?.addEventListener("click", () => {
    generatedHookIdeasByProduct[product.id] = generateHookIdeasForProduct(product);
    renderProductDetail(product.id);
  });
  document.querySelectorAll("[data-save-hook]").forEach((button) => button.addEventListener("click", () => saveGeneratedHook(product, Number(button.dataset.saveHook), "Untested")));
  document.querySelectorAll("[data-film-hook]").forEach((button) => button.addEventListener("click", () => saveGeneratedHook(product, Number(button.dataset.filmHook), "Marked for Filming")));
  document.querySelectorAll("[data-copy-hook]").forEach((button) => button.addEventListener("click", async () => {
    const idea = generatedHookIdeasByProduct[product.id]?.[Number(button.dataset.copyHook)];
    if (!idea) return;
    try {
      await navigator.clipboard.writeText(idea.text);
      showMessage("Hook copied.", "good");
    } catch {
      showMessage("Hook text is visible on the card for copying.", "warn");
    }
  }));
}

function generateHookIdeasForProduct(product) {
  const account = product.accountId === "truthTunedTribe" || /truth tuned tribe/i.test(product.account || "") ? "truth" : "raised";
  const context = hookProductContext(product);
  const templates = account === "truth" ? truthTunedHookTemplates(product, context) : raisedRightHookTemplates(product, context);
  return [
    ...templates.problem.slice(0, 2).map((text) => hookIdea("Problem", text, product, context)),
    ...templates.curiosity.slice(0, 2).map((text) => hookIdea("Curiosity", text, product, context)),
    ...templates.proof.slice(0, 2).map((text) => hookIdea("Proof/demo", text, product, context)),
    hookIdea("Urgency", templates.urgency[0], product, context),
    hookIdea("Soft sell", templates.soft[0], product, context)
  ];
}

function hookProductContext(product) {
  const name = product.name;
  const category = product.categoryGroup || product.category || "this category";
  const notes = String(product.notes || product.strategyNotes || "").toLowerCase();
  const isPatriotic = /patriot|america|anniversary|coin|flag|fourth/i.test(`${name} ${category} ${notes}`);
  const isGarden = /garden|plant|weed|soil|yard/i.test(`${name} ${category} ${notes}`);
  const isWellness = /health|wellness|peptide|recovery|water|tester|tds|beauty/i.test(`${name} ${category} ${notes}`);
  const mainUse = isGarden ? "solves a real home or garden problem" : isPatriotic ? "turns a patriotic moment into something tangible" : isWellness ? "makes a wellness or health question easier to act on" : "solves a specific everyday problem";
  return { name, category, notes, isPatriotic, isGarden, isWellness, mainUse };
}

function raisedRightHookTemplates(product, context) {
  if (context.isPatriotic) {
    return {
      problem: [`This is the kind of thing people will wish they bought before the 250th anniversary.`, `If you collect patriotic keepsakes, ${context.name} actually makes sense.`],
      curiosity: [`The 250th birthday of America only happens once.`, `I didn’t expect ${context.name} to feel this special in person.`],
      proof: [`Here’s what ${context.name} looks like up close.`, `I wanted to see if ${context.name} felt cheap or collectible, and here’s what I noticed.`],
      urgency: [`If you want a keepsake before the anniversary rush, this is one I’d look at now.`],
      soft: [`I’ll link ${context.name} if you want to see the details for yourself.`]
    };
  }
  return {
    problem: [`I didn’t know I needed ${context.name} until I saw the problem it fixes.`, `If ${context.category.toLowerCase()} has been annoying you, ${context.name} might be the simple fix.`],
    curiosity: [`This is one of those products that makes you go, “Wait, why didn’t I have this already?”`, `I bought this to see if it actually helps with ${context.category.toLowerCase()}, and I get it now.`],
    proof: [`Here’s exactly how ${context.name} works in real life.`, `I’m testing ${context.name} so you can see if it’s actually useful.`],
    urgency: [`This is the kind of practical product I’d rather have before I need it.`],
    soft: [`I’ll link ${context.name} if you want to check the size, price, or details.`]
  };
}

function truthTunedHookTemplates(product, context) {
  return {
    problem: [`Most people miss this part of ${context.category.toLowerCase()}, and ${context.name} made me look closer.`, `If you’ve been trying to understand ${context.category.toLowerCase()}, ${context.name} is worth a closer look.`],
    curiosity: [`I researched ${context.name} so you don’t have to, and this is what stood out.`, `The interesting thing about ${context.name} is not what most people think.`],
    proof: [`Here’s what I checked first when I looked at ${context.name}.`, `I’m walking through ${context.name} so you can decide if it fits your own research.`],
    urgency: [`If ${context.category.toLowerCase()} is already on your radar, I would not wait too long to compare this.`],
    soft: [`I’ll link ${context.name} for anyone who wants to read the details and decide for themselves.`]
  };
}

function hookIdea(type, text, product, context) {
  const cta = product.bestCta || (type === "Soft sell" ? `Check ${context.name} and decide if it fits.` : `Tap through to compare the details.`);
  const why = hookWhy(type, product, context);
  const angle = hookAngle(type, product, context);
  return { type, text, cta, why, angle };
}

function hookWhy(type, product, context) {
  if (type === "Problem") return `Frames ${product.name} around a specific audience pain point instead of a generic product pitch.`;
  if (type === "Curiosity") return `Creates an open loop that fits ${product.account}'s audience and gives viewers a reason to keep watching.`;
  if (type === "Proof/demo") return `Shows the product in action, which helps turn interest into trust.`;
  if (type === "Urgency") return context.isPatriotic ? "Connects the product to a time-sensitive patriotic moment." : "Gives the viewer a practical reason to look now.";
  return "Keeps the sale low-pressure while still giving interested viewers a next step.";
}

function hookAngle(type, product, context) {
  if (type === "Problem") return `Start with the everyday problem, then reveal ${product.name} as the simple answer.`;
  if (type === "Curiosity") return `Open with the surprising part, then explain what Jennifer noticed or researched.`;
  if (type === "Proof/demo") return `Show close-up proof, use, comparison, or a quick before/after.`;
  if (type === "Urgency") return `Tie the product to timing, season, deadline, or missed opportunity.`;
  return `Use a calm review tone and invite viewers to check details only if it fits them.`;
}

function saveGeneratedHook(product, index, status) {
  const idea = generatedHookIdeasByProduct[product.id]?.[index];
  if (!idea) return;
  db.hooks = db.hooks || [];
  const existing = db.hooks.find((hook) => hook.productId === product.id && normalizedName(hook.text) === normalizedName(idea.text));
  const payload = {
    id: existing?.id || uniqueImportId(`hook-${product.id}-${slug(idea.text)}`),
    text: idea.text,
    category: idea.type,
    hookType: idea.type,
    accountId: product.accountId,
    accountUsed: product.account,
    account: product.account,
    productId: product.id,
    productUsed: product.name,
    productName: product.name,
    suggestedCta: idea.cta,
    suggestedVideoAngle: idea.angle,
    whyThisMightWork: idea.why,
    notes: `${idea.why} Angle: ${idea.angle}`,
    salesGenerated: existing?.salesGenerated || 0,
    status,
    dateCreated: existing?.dateCreated || todayDate(new Date()),
    source: "Product Detail Hook Generator"
  };
  if (existing) Object.assign(existing, payload);
  else db.hooks.unshift(payload);
  saveData(status === "Marked for Filming" ? "Hook saved and marked for filming." : "Hook saved to Hooks.");
  renderProductDetail(product.id);
}

function hookAlreadySaved(product, text) {
  return (db.hooks || []).some((hook) => hook.productId === product.id && normalizedName(hook.text) === normalizedName(text));
}

function renderHooks() {
  const hooks = filteredHooks();
  content.innerHTML = `
    <div class="section-title"><div><h3>Hooks</h3><p>Searchable hook database with product and sales context.</p></div><span class="badge">${hooks.length} hooks</span></div>
    <div class="filter-bar"><input id="hookSearch" type="search" placeholder="Search hooks..." value="${escapeAttr(hookSearch)}"></div>
    <div class="hook-grid">${hooks.map((hook) => `
      <article class="card hook-card">
        <div class="product-meta"><span class="badge">${hook.category}</span><span class="badge ${hook.status === "Marked for Filming" ? "good" : ""}">${hook.status || "Untested"}</span></div>
        <h3>${hook.text}</h3>
        <p>${hook.productUsed || hook.productName || "No product assigned yet"}</p>
        <div class="mini-stats"><div class="mini-stat"><span>Account</span><strong>${hook.accountUsed || hook.account || "TBD"}</strong></div><div class="mini-stat"><span>Sales</span><strong>${number.format(hook.salesGenerated || 0)}</strong></div></div>
        ${hook.suggestedCta ? `<p><strong>CTA:</strong> ${hook.suggestedCta}</p>` : ""}
        ${hook.suggestedVideoAngle ? `<p><strong>Angle:</strong> ${hook.suggestedVideoAngle}</p>` : ""}
        <p class="placeholder">${hook.notes || ""}</p>
      </article>
    `).join("")}</div>
  `;
  document.querySelector("#hookSearch").addEventListener("input", (event) => { hookSearch = event.target.value; renderHooks(); });
}

let opportunityAccountFilter = "All";

function sparkReportItems() {
  const items = [];
  const july3Sales = (db.salesRecords || []).filter((record) => normalizeDateKey(record.date || record.capturedAt || "") === "2026-07-03");
  const airForce = videos().find((video) => /air force one|trump force one/i.test(`${video.productName || ""} ${video.hook || ""}`));
  if (airForce && (Number(airForce.views || 0) >= 100000 || Number(airForce.newFollowers || 0) >= 100)) {
    items.push({
      icon: "rocket",
      text: `Air Force One video generated ${number.format(airForce.views || 0)} views and ${number.format(airForce.newFollowers || 0)} followers.`,
      note: "Unusual audience-growth spike."
    });
  }
  const smartGlasses = polarisSamples().find((sample) => /smart ai glasses/i.test(sample.productName || ""));
  if (smartGlasses && Number(smartGlasses.daysRemaining || 999) <= 7) {
    items.push({
      icon: "clock",
      text: `Smart AI Glasses sample has ${number.format(smartGlasses.daysRemaining || 0)} days left.`,
      note: "Deadline signal."
    });
  }
  const peptide = july3Sales.find((record) => normalizedName(record.account) === normalizedName("Truth Tuned Tribe") && /complete peptide protocols playbook/i.test(record.productName || ""));
  if (peptide && Number(peptide.unitsSold || 0) >= 5) {
    items.push({
      icon: "money",
      text: `Complete Peptide Protocols Playbook sold ${number.format(peptide.unitsSold || 0)} units.`,
      note: "Highest Truth Tuned Tribe seller yesterday."
    });
  }
  const raisedRightSales = july3Sales.filter((record) => normalizedName(record.account) === normalizedName("Raised Right"));
  const raisedTop = raisedRightSales.slice().sort((a, b) => Number(b.gmv || 0) - Number(a.gmv || 0))[0];
  if (raisedTop) {
    items.push({
      icon: "chart",
      text: `${raisedTop.productName} remained yesterday's top Raised Right revenue product.`,
      note: `${money.format(raisedTop.gmv || 0)} GMV.`
    });
  }
  const tds = raisedRightSales.find((record) => /tds|water quality tester/i.test(record.productName || ""));
  if (tds && Number(tds.unitsSold || 0) >= 3) {
    items.push({
      icon: "spark",
      text: `TDS Meter sales resumed with ${number.format(tds.unitsSold || 0)} units sold.`,
      note: "Product waking up."
    });
  }
  return items.slice(0, 5);
}

function sparkIcon(name) {
  const icons = { rocket: "🚀", clock: "⏰", money: "💰", chart: "📈", spark: "🔥" };
  return icons[name] || "✦";
}

function yesterdayLearningsMarkup() {
  const sparks = sparkReportItems();
  return `
    <section class="card spark-report-card yesterday-learnings-card">
      <div class="section-title"><div><h3>Spark Report</h3><p>Unusual, high-value Signals only.</p></div><span class="badge good">${sparks.length} Sparks</span></div>
      ${sparks.length ? `<div class="spark-report-list">${sparks.map((spark) => `<article><span>${sparkIcon(spark.icon)}</span><div><strong>${spark.text}</strong><small>${spark.note}</small></div></article>`).join("")}</div>` : `<p class="empty">No major Spark detected yet. Northstar is watching for unusual Signals.</p>`}
    </section>
  `;
}

function opportunityAccountMatches(product) {
  if (opportunityAccountFilter === "All") return true;
  if (opportunityAccountFilter === "Both / Shared") return !product.account || /both|shared/i.test(`${product.account} ${product.accountId}`);
  return normalizedName(product.account) === normalizedName(opportunityAccountFilter);
}

function opportunityGroupsForDisplay() {
  const base = recommendationGroups();
  return {
    "Double Down": (base["DOUBLE DOWN"] || []).filter(opportunityAccountMatches),
    "Watch / Signal Collection": (base.WATCH || []).filter(opportunityAccountMatches),
    "Wait / Cooling": (base.WAIT || []).filter(opportunityAccountMatches)
  };
}

function opportunityAccountSummary() {
  const all = scoredProducts();
  return {
    raisedRight: all.filter((product) => normalizedName(product.account) === normalizedName("Raised Right")).length,
    truthTunedTribe: all.filter((product) => normalizedName(product.account) === normalizedName("Truth Tuned Tribe")).length,
    shared: all.filter((product) => !product.account || /both|shared/i.test(`${product.account} ${product.accountId}`)).length
  };
}

renderRecommendations = function renderOpportunityCenterLayoutFix() {
  const groups = opportunityGroupsForDisplay();
  const summary = opportunityAccountSummary();
  const filters = ["All", "Raised Right", "Truth Tuned Tribe", "Both / Shared"];
  content.innerHTML = `
    <div class="section-title"><div><h3>Opportunity Center</h3><p>Decision lanes by confidence, timing, Signal Collection, and hook refresh needs.</p></div><span class="badge good">4 focused lanes</span></div>
    <div class="opportunity-toolbar">
      <div class="opportunity-account-filters">${filters.map((filter) => `<button type="button" class="${opportunityAccountFilter === filter ? "active" : ""}" data-opportunity-account="${filter}">${filter}</button>`).join("")}</div>
      <div class="opportunity-account-summary"><span>Raised Right: ${summary.raisedRight}</span><span>Truth Tuned Tribe: ${summary.truthTunedTribe}</span><span>Shared: ${summary.shared}</span></div>
    </div>
    <div class="recommendation-grid opportunity-grid-fixed">
      ${Object.entries(groups).map(([name, list]) => `<section class="recommendation-column"><h3>${name}</h3><p class="lane-rule">${opportunityLaneRule(name)}</p>${list.map(recommendationCard).join("") || `<p class="empty">No products in this lane.</p>`}</section>`).join("")}
    </div>
    <div class="grid two">
      <section class="card"><div class="section-title"><div><h3>Category Intelligence</h3><p>Automatic category summaries.</p></div></div>${categoryIntelligenceTable(categoryIntelligence())}</section>
      <section class="card"><div class="section-title"><div><h3>Account Comparison</h3><p>Which brand is showing the strongest Signals?</p></div></div><div class="account-comparison-grid">${accountComparison().map(accountComparisonCard).join("")}</div></section>
    </div>
  `;
  document.querySelectorAll("[data-opportunity-account]").forEach((button) => button.addEventListener("click", () => {
    opportunityAccountFilter = button.dataset.opportunityAccount;
    renderRecommendations();
  }));
  bindInternalButtons();
};

function opportunityLaneRule(name) {
  if (name === "Double Down") return "High confidence, proven products.";
  if (name === "Watch / Signal Collection") return "Promising or too new to evaluate.";
  return "Timing, seasonality, or cooling momentum.";
}

function recommendationCard(product) {
  const signal = productSignalCollectionInfo(product);
  const account = product.account || "Both / Shared";
  return `
    <article class="recommendation-card" data-card-product="${product.id}">
      <div class="recommendation-card-header">
        <span class="badge account-badge">${account}</span>
        ${opportunityPill(product)}
      </div>
      <div class="recommendation-product-line">
        ${productImageMarkup(product)}
        <div><strong>${product.name}</strong><p>${productNextMove(product)}</p></div>
      </div>
      ${signal.isCollecting ? `<small class="signal-note">Signal Collection: ${number.format(signal.daysSince)} days since posted, ${number.format(signal.daysRemaining)} days before evaluation. ${signalCollectionNote()}</small>` : ""}
      <div class="product-meta">${lifecycleBadge(product)}<span class="badge">${intelligenceSeason(product)}</span></div>
    </article>
  `;
}

/* Northstar Product Detail Command Center + compact product request cards */
function requestConfidence(sample) {
  const priority = String(sample.priority || "").toLowerCase();
  const category = String(sample.category || "").toLowerCase();
  let score = priority.includes("high") ? 91 : priority.includes("medium") ? 76 : 62;
  if (/garden|water|peptide|wellness|ai|tech/.test(category)) score += 4;
  if (Number(sample.daysRemaining || 99) <= 7) score += 5;
  return Math.max(40, Math.min(98, score));
}

function requestDemand(sample) {
  const score = requestConfidence(sample);
  if (score >= 88) return "High demand";
  if (score >= 72) return "Moderate demand";
  return "Early demand";
}

function productSampleLifecycleCard(sample) {
  const confidence = requestConfidence(sample);
  const audience = sample.account || "Both / Shared";
  return `
    <article class="sample-card polaris-sample-card product-sample-card compact-request-card">
      <div class="compact-request-head">
        <span class="badge">${sample.category || "Uncategorized"}</span>
        <strong><small>Estimated demand</small>${requestDemand(sample)}</strong>
      </div>
      <h4>${sample.productName}</h4>
      <div class="compact-request-grid">
        <div><span>Audience</span><strong>${audience}</strong></div>
        <div><span>Priority</span><strong>${sample.priority || "Medium"}</strong></div>
        <div><span>Status</span><strong>${sample.status || "Idea"}</strong></div>
        <div><span>Confidence</span><strong>${confidence}%</strong></div>
      </div>
      <button class="icon-button compact-request-button" type="button" data-request-sample="${sample.id}">${sample.status === "Idea" ? "Request Now" : sample.status === "Request Now" ? "Mark Requested" : "Update Request"}</button>
    </article>
  `;
}

function productLifecycleTable(tab, rows) {
  if (tab === "Live") {
    return `<div class="table-card database-table product-lifecycle-table"><table><thead><tr><th>Opportunity</th><th>Product</th><th>Account</th><th>Category</th><th>GMV</th><th>Commission</th><th>Units</th><th>Next direction</th></tr></thead><tbody>${rows.map((product) => `<tr class="click-row" data-product-id="${product.id}"><td>${opportunityPill(product)}</td><td><strong>${product.name}</strong><span>${lifecycleBadge(product)}</span></td><td>${product.account}</td><td>${product.categoryGroup}</td><td>${money.format(product.lifetimeGmv || 0)}</td><td>${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td>${productNextMove(product)}</td></tr>`).join("") || `<tr><td colspan="8">No live products yet.</td></tr>`}</tbody></table></div>`;
  }
  return `<div class="product-sample-grid compact-request-grid-wrap">${rows.map(productSampleLifecycleCard).join("") || `<div class="card empty">No ${tab.toLowerCase()} records yet.</div>`}</div>`;
}

function productImageUrl(item = {}) {
  const direct = item.imageUrl || item.thumbnail || item.productImage || item.image || item.photoUrl || "";
  if (direct) return direct;
  const product = findProductForImageSubject(item);
  return product && product !== item ? (product.imageUrl || product.thumbnail || product.productImage || product.image || product.photoUrl || "") : "";
}

function productImageIds(item = {}) {
  return [
    item.externalProductId,
    item.tiktokProductId,
    item.productId,
    item.sourceProductId,
    item.historicalMetrics?.productId
  ].filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
}

function findProductByImageProductId(productId) {
  const id = String(productId || "").trim();
  if (!id) return null;
  return products().find((product) => productImageIds(product).includes(id)) || null;
}

function findProductForImageSubject(item = {}) {
  if (!item || !Array.isArray(db.products)) return null;
  const idCandidates = [
    item.productId,
    item.relatedProductId,
    item.externalProductId,
    item.tiktokProductId,
    item.sourceProductId,
    item.historicalMetrics?.productId
  ].filter(Boolean).map((value) => String(value).trim());
  const byRecordId = idCandidates.length ? products().find((product) => idCandidates.includes(String(product.id)) || productImageIds(product).some((id) => idCandidates.includes(id))) : null;
  if (byRecordId) return byRecordId;
  const name = normalizedName(item.productName || item.name || item.product || item.topic || "");
  if (!name) return null;
  return products().find((product) => {
    const productName = normalizedName(product.name);
    return productName === name || (productName.length > 12 && name.includes(productName)) || (name.length > 12 && productName.includes(name));
  }) || null;
}

function applyBundledProductImages() {
  const map = window.NORTHSTAR_PRODUCT_IMAGE_MAP || {};
  const entries = Object.entries(map);
  if (!entries.length || !Array.isArray(db.products)) return { matched: 0, skipped: 0 };
  let newlyApplied = 0;
  let alreadyHadImage = 0;
  let unmatched = 0;
  const attachedProducts = new Set();
  entries.forEach(([productId, imageUrl]) => {
    const product = findProductByImageProductId(productId);
    if (!product) {
      unmatched += 1;
      return;
    }
    if (!productImageUrl(product)) {
      product.imageUrl = imageUrl;
      product.imageSource = "TikTok Shop screenshot crop";
      newlyApplied += 1;
    } else {
      alreadyHadImage += 1;
    }
    attachedProducts.add(product.id);
  });
  window.NORTHSTAR_PRODUCT_IMAGE_IMPORT_SUMMARY = { bundledImages: entries.length, attachedProducts: attachedProducts.size, newlyApplied, alreadyHadImage, unmatched, appliedAt: new Date().toISOString() };
  return window.NORTHSTAR_PRODUCT_IMAGE_IMPORT_SUMMARY;
}

function connectProductImagesAcrossLifecycle() {
  if (!Array.isArray(db.products)) return;
  const attach = (record) => {
    const product = findProductForImageSubject(record);
    if (!product) return;
    record.productId = record.productId || product.id;
    record.relatedProductId = record.relatedProductId || product.id;
    const productSrc = productImageUrl(product);
    const recordSrc = record.imageUrl || record.thumbnail || record.productImage || "";
    if (productSrc && !recordSrc) record.imageUrl = productSrc;
    if (recordSrc && !productImageUrl(product)) {
      product.imageUrl = recordSrc;
      product.imageSource = record.imageSource || record.source || "Sample/product image";
    }
  };
  (db.samples || []).forEach(attach);
  (db.sampleRecords || []).forEach(attach);
  (db.sampleRequests || []).forEach(attach);
  (db.videos || []).forEach(attach);
}

function sampleRequiresFilming(sample = {}) {
  const raw = `${sample.status || ""} ${sample.rawStatus || ""} ${sample.sourceStatus || ""}`.toLowerCase();
  const status = normalizeSampleStatus(sample.status);
  if (["Posted", "Complete", "Filmed"].includes(status) || /posted|complete|done|filmed/.test(raw)) return false;
  return status === "Delivered" || status === "Waiting to Film" || /needs[_\s-]*content|pending[_\s-]*criteria|delivered|waiting[_\s-]*to[_\s-]*film|received/.test(raw);
}

function sampleDaysLeft(sample = {}) {
  const direct = Number(sample.daysRemaining ?? sample.daysLeft ?? sample.daysUntilDue);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const due = sample.campaignDueDate || sample.dueDate || sample.deadline || "";
  if (!due) return null;
  const parsed = new Date(due);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((parsed - new Date()) / 86400000);
}

function productImageMarkup(item = {}, label = "Product") {
  const src = productImageUrl(item);
  if (src) return `<img class="product-thumb" src="${escapeAttr(src)}" alt="${escapeAttr(item.productName || item.name || label)}" loading="lazy">`;
  return `<div class="product-thumb product-thumb-placeholder" aria-hidden="true">⌁</div>`;
}

productCard = function productCardWithImage(product) {
  return `
    <article class="product-card product-card-with-image" data-card-product="${product.id}">
      <div class="product-card-top">
        ${productImageMarkup(product)}
        <div>
          <h4 class="clamp-2" title="${escapeAttr(product.name || "")}">${product.name}</h4>
          <div class="product-meta"><span class="badge">${product.account}</span><span class="badge ${statusClass(product.status)}">${product.status}</span></div>
        </div>
      </div>
      <div class="mini-stats">
        <div class="mini-stat"><span>GMV</span><strong>${money.format(product.lifetimeGmv || 0)}</strong></div>
        <div class="mini-stat"><span>Commission</span><strong>${money.format(product.lifetimeCommission || 0)}</strong></div>
        <div class="mini-stat"><span>Units</span><strong>${number.format(product.lifetimeUnits || 0)}</strong></div>
      </div>
      <div class="product-meta"><span class="badge">${product.seasonality}</span><span class="badge">Again: ${product.wouldPromoteAgain}</span></div>
    </article>
  `;
};

function productForSample(sample) {
  return findProductForImageSubject(sample) || products().find((product) => product.id === sample.productId || normalizedName(product.name) === normalizedName(sample.productName));
}

productSampleLifecycleCard = function productSampleLifecycleCardWithImage(sample) {
  const confidence = requestConfidence(sample);
  const audience = sample.account || "Both / Shared";
  const imageSource = { ...productForSample(sample), ...sample };
  const daysLeft = sampleDaysLeft(sample);
  const earnAmount = Number(sample.estimatedCommission || sample.commission || sample.productPrice || sample.estimatedGMV || 0);
  const nextAction = sampleRequiresFilming(sample) ? "Film Content" : sample.status === "Idea" || sample.status === "Request Now" ? "Request Now" : sample.status === "Shipped" ? "Track Sample" : sample.status === "Approved" ? "Watch Shipping" : "Update Status";
  return `
    <article class="sample-card polaris-sample-card product-sample-card compact-request-card">
      <div class="compact-request-media">${productImageMarkup(imageSource, sample.productName)}</div>
      <div class="compact-request-body">
        <div class="compact-request-head">
          <span class="badge">${sample.category || "Uncategorized"}</span>
          <strong><small>Estimated demand</small>${requestDemand(sample)}</strong>
        </div>
        <h4 title="${escapeAttr(sample.productName || "")}">${sample.productName}</h4>
        <div class="compact-request-grid">
          <div><span>Audience</span><strong>${audience}</strong></div>
          <div><span>Days left</span><strong>${daysLeft === null ? "Not set" : number.format(daysLeft)}</strong></div>
          <div><span>Status</span><strong>${sample.status || "Idea"}</strong></div>
          <div><span>Earn amount</span><strong>${earnAmount ? money.format(earnAmount) : "Not set"}</strong></div>
        </div>
        <div class="compact-request-footer"><span class="badge">${sample.priority || "Medium"} priority</span><span class="badge">${confidence}% confidence</span></div>
        <button class="icon-button compact-request-button" type="button" data-request-sample="${sample.id}">${nextAction}</button>
      </div>
    </article>
  `;
};

productLifecycleTable = function productLifecycleTableWithImages(tab, rows) {
  if (tab === "Live") {
    return `<div class="table-card database-table product-lifecycle-table"><table><colgroup><col class="product-image-col"><col class="product-name-col"><col class="product-account-col"><col class="product-category-col"><col class="product-money-col"><col class="product-money-col"><col class="product-units-col"><col class="product-direction-col"></colgroup><thead><tr><th>Image</th><th>Product</th><th>Account</th><th>Category</th><th>GMV</th><th>Commission</th><th>Units</th><th>Next Direction</th></tr></thead><tbody>${rows.map((product) => `<tr class="click-row" data-product-id="${product.id}"><td>${productImageMarkup(product)}</td><td><strong class="clamp-2 product-name-cell" title="${escapeAttr(product.name || "")}">${product.name}</strong><span>${opportunityPill(product)} ${lifecycleBadge(product)}</span></td><td>${product.account}</td><td><span class="clamp-2" title="${escapeAttr(product.categoryGroup || product.category || "")}">${product.categoryGroup || product.category || ""}</span></td><td>${money.format(product.lifetimeGmv || 0)}</td><td>${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td><span class="clamp-2 next-direction-cell" title="${escapeAttr(productNextMove(product))}">${productNextMove(product)}</span></td></tr>`).join("") || `<tr><td colspan="8">No live products yet.</td></tr>`}</tbody></table></div>`;
  }
  return `<div class="product-sample-grid compact-request-grid-wrap">${rows.map(productSampleLifecycleCard).join("") || `<div class="card empty">No ${tab.toLowerCase()} records yet.</div>`}</div>`;
};

videoRows = function videoRowsCompact(list) {
  return list.map((video) => {
    const signal = signalCollectionInfo(video);
    const hookText = video.hook || video.productName || "Untitled video";
    return `<tr><td>${compactDate(video.datePosted || video.postedAt || "")}${video.timePosted ? `<span>${video.timePosted}</span>` : ""}</td><td>${video.account}</td><td><span class="clamp-2" title="${escapeAttr(video.productName || "")}">${video.productName || ""}</span>${signalCollectionBadgeForInfo(signal)}</td><td><strong class="clamp-3" title="${escapeAttr(hookText)}">${hookText}</strong>${video.cta ? `<span class="clamp-1" title="${escapeAttr(video.cta)}">${video.cta}</span>` : ""}</td><td>${compactNumber(video.views || 0)}</td><td><span class="clamp-2">${compactNumber(video.likes || 0)} likes · ${compactNumber(video.saves || 0)} saves · ${compactNumber(video.shares || 0)} shares</span></td><td>${Number(video.averageWatchTime || 0).toFixed(1)}s · ${Number(video.completionRate || 0).toFixed(1)}%</td><td>${number.format(video.sales || 0)}</td><td class="numeric-nowrap">${money.format(video.gmv || 0)}</td><td class="numeric-nowrap">${money.format(video.commission || 0)}</td></tr>`;
  }).join("") || `<tr><td colspan="10">No videos yet.</td></tr>`;
};

const northstarMediaRenderVideosDatabaseBase = renderVideosDatabase;
renderVideosDatabase = function renderVideosDatabaseCompactLayout() {
  normalizeVideoDatabase();
  const rows = filteredVideos();
  const diagnostics = videoDiagnostics(rows);
  const videoList = validVideos();
  content.innerHTML = `
    <div class="section-title">
      <div><h3>Videos</h3><p>Every row is rendered from the Polaris source of truth: <code>db.videos</code>.</p></div>
      <div class="video-count-badges">
        <span class="badge">${rows.length} displayed</span>
        <span class="badge good">Raised Right: ${diagnostics.accountCounts.raisedRight}</span>
        <span class="badge good">Truth Tuned Tribe: ${diagnostics.accountCounts.truthTunedTribe}</span>
      </div>
    </div>
    <details class="form-panel"><summary>Add Video</summary>${videoForm()}</details>
    <div class="filter-bar">
      <input id="videoSearch" type="search" placeholder="Search videos, hooks, CTA..." value="${escapeAttr(videoFilters.search)}">
      ${select("videoAccount", ["All", ...accounts().map((a) => a.name)], videoFilters.account)}
      ${select("videoProduct", ["All", ...unique(videoList.map((v) => v.productName))], videoFilters.product)}
      ${select("videoCategory", ["All", ...unique(videoList.map((v) => v.category))], videoFilters.category)}
      ${select("videoHookType", ["All", ...unique(videoList.map((v) => v.hookType))], videoFilters.hookType)}
      <label class="check"><input id="salesOnly" type="checkbox" ${videoFilters.salesOnly ? "checked" : ""}> Sales &gt; 0</label>
      <label class="check"><input id="highSaves" type="checkbox" ${videoFilters.highSaves ? "checked" : ""}> High saves</label>
      <label class="check"><input id="highShares" type="checkbox" ${videoFilters.highShares ? "checked" : ""}> High shares</label>
      <button class="ghost-button" id="clearVideoFilters" type="button">Show All Videos</button>
    </div>
    ${videoDiagnosticsPanel(diagnostics)}
    <div class="table-card database-table videos-table"><table><colgroup><col class="video-date-col"><col class="video-account-col"><col class="video-product-col"><col class="video-hook-col"><col class="video-views-col"><col class="video-engagement-col"><col class="video-watch-col"><col class="video-sales-col"><col class="video-gmv-col"><col class="video-commission-col"></colgroup><thead><tr><th>Date</th><th>Account</th><th>Product</th><th>Hook</th><th>Views</th><th>Engagement</th><th>Watch</th><th>Sales</th><th>GMV</th><th>Comm.</th></tr></thead><tbody>${videoRows(rows)}</tbody></table></div>
  `;
  document.querySelector("#addVideoForm")?.addEventListener("submit", handleAddVideo);
  bindVideoFilters();
  document.querySelector("#clearVideoFilters")?.addEventListener("click", () => {
    videoFilters = { search: "", account: "All", product: "All", category: "All", hookType: "All", salesOnly: false, highSaves: false, highShares: false };
    renderVideosDatabase();
  });
};

function bindCompactRequestButtons() {
  document.querySelectorAll("[data-request-sample]").forEach((button) => button.addEventListener("click", () => {
    const sample = polarisSamples().find((item) => item.id === button.dataset.requestSample);
    if (!sample) return;
    sample.status = sample.status === "Idea" ? "Request Now" : sample.status === "Request Now" ? "Requested" : sample.status;
    sample.lastUpdated = new Date().toISOString();
    saveSample(sample);
    saveData(`${sample.productName} moved to ${sample.status}`);
    renderProductsDatabase();
  }));
}

const northstarCommandRenderProductsBase = renderProductsDatabase;
renderProductsDatabase = function renderProductsWithCompactRequests() {
  northstarCommandRenderProductsBase();
  bindCompactRequestButtons();
};

function productVideoStats(product, relatedVideos = productVideos(product.id)) {
  const count = relatedVideos.length;
  const highestViews = Math.max(0, ...relatedVideos.map((video) => Number(video.views || 0)));
  const highestGmv = Math.max(0, ...relatedVideos.map((video) => Number(video.gmv || 0)));
  const highestCommission = Math.max(0, ...relatedVideos.map((video) => Number(video.commission || 0)));
  const averageViews = count ? Math.round(relatedVideos.reduce((sum, video) => sum + Number(video.views || 0), 0) / count) : 0;
  const averageWatchTime = count ? relatedVideos.reduce((sum, video) => sum + Number(video.averageWatchTime || 0), 0) / count : 0;
  return { count, highestViews, highestGmv, highestCommission, averageViews, averageWatchTime };
}

function productSummaryMarkup(product, relatedVideos) {
  const stats = productVideoStats(product, relatedVideos);
  return `
    <section class="card product-summary-card">
      <div class="section-title"><div><h3>Video Summary</h3><p>The product history at a glance.</p></div></div>
      <div class="product-summary-grid">
        ${metric("Videos Created", number.format(stats.count), "Total videos", "")}
        ${metric("Highest Views", number.format(stats.highestViews), "Best reach", "")}
        ${metric("Highest GMV", money.format(stats.highestGmv), "Best video GMV", "")}
        ${metric("Highest Commission", money.format(stats.highestCommission), "Best video commission", "")}
        ${metric("Lifetime Product GMV", money.format(product.lifetimeGmv || 0), "All tracked sales", "")}
        ${metric("Lifetime Product Commission", money.format(product.lifetimeCommission || 0), "All tracked commission", "")}
        ${metric("Total Units", number.format(product.lifetimeUnits || 0), "All tracked units", "")}
        ${metric("Average Views", number.format(stats.averageViews), "Per video", "")}
        ${metric("Average Watch Time", `${stats.averageWatchTime.toFixed(1)}s`, "Per video", "")}
      </div>
    </section>
  `;
}

function videoPerformanceStatus(video) {
  if (Number(video.gmv || 0) >= 100 || Number(video.sales || 0) >= 5 || Number(video.views || 0) >= 100000) return "Winner";
  if (Number(video.gmv || 0) > 0 || Number(video.sales || 0) > 0 || Number(video.views || 0) >= 10000) return "Good";
  if (signalCollectionInfo(video).isCollecting) return "Testing";
  return "Needs Hook Refresh";
}

function videoHistoryMarkup(relatedVideos) {
  const winner = relatedVideos.filter((video) => videoPerformanceStatus(video) === "Winner").length;
  const testing = relatedVideos.filter((video) => videoPerformanceStatus(video) === "Testing").length;
  const refresh = relatedVideos.filter((video) => videoPerformanceStatus(video) === "Needs Hook Refresh").length;
  return `
    <section class="card video-history-card">
      <div class="section-title"><div><h3>Video History</h3><p>Product maturity by creative testing.</p></div></div>
      <div class="video-history-grid">
        ${metric("Videos Created", `${number.format(relatedVideos.length)} Total Videos`, "All tracked creative", "")}
        ${metric("Winner", number.format(winner), "Benchmark videos", "")}
        ${metric("Still Testing", number.format(testing), "Signal Collection", "")}
        ${metric("Needs Hook Refresh", number.format(refresh), "New angle needed", "")}
      </div>
    </section>
  `;
}

function bestPerformingVideo(relatedVideos) {
  return relatedVideos.slice().sort((a, b) => {
    const aScore = Number(a.gmv || 0) * 8 + Number(a.commission || 0) * 10 + Number(a.views || 0) * 0.02 + Number(a.saves || 0) * 3 + Number(a.shares || 0) * 2;
    const bScore = Number(b.gmv || 0) * 8 + Number(b.commission || 0) * 10 + Number(b.views || 0) * 0.02 + Number(b.saves || 0) * 3 + Number(b.shares || 0) * 2;
    return bScore - aScore;
  })[0];
}

function bestVideoMarkup(video) {
  if (!video) return `<section class="card best-video-card"><h3>Best Performing Video</h3><p class="empty">No related videos yet.</p></section>`;
  const ctr = Number(video.views || 0) ? Number(video.sales || 0) / Number(video.views || 0) * 100 : 0;
  const saveRate = Number(video.views || 0) ? Number(video.saves || 0) / Number(video.views || 0) * 100 : 0;
  return `
    <section class="card best-video-card">
      <div class="section-title"><div><h3>Best Performing Video</h3><p>Benchmark every future hook against this.</p></div><span class="badge good">${videoPerformanceStatus(video)}</span></div>
      <div class="best-video-layout">
        <div class="video-thumbnail-placeholder">Video</div>
        <div class="best-video-copy">
          <strong>${video.hook || video.productName}</strong>
          <div class="best-video-stats">
            ${metric("Views", number.format(video.views || 0), "Reach", "")}
            ${metric("GMV", money.format(video.gmv || 0), "Revenue", "")}
            ${metric("Commission", money.format(video.commission || 0), "Earnings", "")}
            ${metric("CTR", `${ctr.toFixed(2)}%`, "Sales / views", "")}
            ${metric("Watch Time", `${Number(video.averageWatchTime || 0).toFixed(1)}s`, "Average", "")}
            ${metric("Save Rate", `${saveRate.toFixed(2)}%`, `${number.format(video.saves || 0)} saves`, "")}
            ${metric("Shares", number.format(video.shares || 0), "Distribution", "")}
            ${metric("Followers", number.format(video.newFollowers || 0), "Gained", "")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function compactRelatedVideosTable(relatedVideos) {
  const rows = relatedVideos.slice().sort((a, b) => new Date(b.datePosted || 0) - new Date(a.datePosted || 0));
  return `
    <section class="card related-videos-card">
      <div class="section-title"><div><h3>Related Videos</h3><p>Compact performance table.</p></div></div>
      <div class="table-card compact-video-table"><table><thead><tr><th>Image</th><th>Date</th><th>Hook</th><th>Views</th><th>GMV</th><th>Comm.</th><th>Units</th><th>Status</th></tr></thead><tbody>
        ${rows.map((video) => `<tr class="click-row" data-video-id="${video.id}"><td>${productImageMarkup(video, video.productName)}</td><td>${compactDate(video.datePosted)}</td><td><strong class="clamp-3" title="${escapeAttr(video.hook || "Untitled video")}">${video.hook || "Untitled video"}</strong></td><td>${compactNumber(video.views || 0)}</td><td>${money.format(video.gmv || 0)}</td><td class="numeric-nowrap">${money.format(video.commission || 0)}</td><td>${number.format(video.sales || 0)}</td><td><span class="badge">${videoPerformanceStatus(video)}</span></td></tr>`).join("") || `<tr><td colspan="8">No related videos yet.</td></tr>`}
      </tbody></table></div>
    </section>
  `;
}

function compactDate(value) {
  const date = new Date(`${normalizeDateKey(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value || "" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function compactNumber(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return number.format(n);
}

function productHooks(product) {
  return (db.hooks || []).filter((hook) => hook.productId === product.id || normalizedName(hook.productUsed || hook.productName) === normalizedName(product.name));
}

function hookPerformance(hook, relatedVideos) {
  const matches = relatedVideos.filter((video) => normalizedName(video.hook).includes(normalizedName(hook.text)) || normalizedName(hook.text).includes(normalizedName(video.hook)));
  const totals = matches.reduce((acc, video) => {
    acc.views += Number(video.views || 0);
    acc.gmv += Number(video.gmv || 0);
    acc.commission += Number(video.commission || 0);
    acc.units += Number(video.sales || 0);
    acc.watch += Number(video.averageWatchTime || 0);
    acc.retention += Number(video.completionRate || 0);
    return acc;
  }, { views: 0, gmv: 0, commission: 0, units: 0, watch: 0, retention: 0 });
  const count = Math.max(matches.length, 1);
  const status = hook.status === "Expired" ? "Expired" : hook.status === "Marked for Filming" ? "Testing" : totals.gmv >= 100 || totals.units >= 5 ? "Winner" : totals.gmv > 0 || totals.units > 0 ? "Scaling" : matches.length ? "Testing" : "Untested";
  return { ...totals, averageWatchTime: totals.watch / count, retention: totals.retention / count, status };
}

function hookHistoryMarkup(product, relatedVideos) {
  const hooks = productHooks(product);
  const groups = {
    "Successful Hooks": hooks.filter((hook) => ["Winner", "Scaling"].includes(hookPerformance(hook, relatedVideos).status)),
    "Tested Hooks": hooks.filter((hook) => hookPerformance(hook, relatedVideos).status === "Testing"),
    "Failed Hooks": hooks.filter((hook) => hookPerformance(hook, relatedVideos).status === "Expired"),
    "Untested Hooks": hooks.filter((hook) => hookPerformance(hook, relatedVideos).status === "Untested")
  };
  return `
    <section class="card hook-history-card">
      <div class="section-title"><div><h3>Hook History</h3><p>Saved hooks connected to this product.</p></div><span class="badge">${hooks.length} hooks</span></div>
      <div class="hook-history-grid">${Object.entries(groups).map(([title, list]) => `<article><span>${title}</span><strong>${number.format(list.length)}</strong><small>${list.slice(0, 2).map((hook) => shortName(hook.text)).join(" · ") || "None yet"}</small></article>`).join("")}</div>
      ${hookPerformanceTable(hooks, relatedVideos)}
    </section>
  `;
}

function hookPerformanceTable(hooks, relatedVideos) {
  if (!hooks.length) return `<p class="empty">Generate or save hooks to begin tracking hook performance.</p>`;
  return `<div class="table-card compact-video-table"><table><thead><tr><th>Hook</th><th>Views</th><th>GMV</th><th>Commission</th><th>Units</th><th>Watch</th><th>Retention</th><th>Status</th></tr></thead><tbody>${hooks.map((hook) => {
    const perf = hookPerformance(hook, relatedVideos);
    return `<tr><td><strong>${hook.text}</strong></td><td>${compactNumber(perf.views)}</td><td>${money.format(perf.gmv)}</td><td>${money.format(perf.commission)}</td><td>${number.format(perf.units)}</td><td>${perf.averageWatchTime.toFixed(1)}s</td><td>${perf.retention.toFixed(1)}%</td><td><span class="badge">${perf.status}</span></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function productIntelligenceSummaryMarkup(product, relatedVideos) {
  const best = bestPerformingVideo(relatedVideos);
  const hooks = productHooks(product);
  const untested = hooks.filter((hook) => hookPerformance(hook, relatedVideos).status === "Untested").length;
  const hasEducational = relatedVideos.some((video) => /education|research|curiosity|why|how|mistake/i.test(`${video.hook} ${video.hookType} ${video.contentPurpose}`));
  const recommendation = productSignalCollectionInfo(product).isCollecting
    ? "Keep collecting Signals before judging this product."
    : untested
      ? "Use one saved untested hook next so Northstar can compare creative angles."
      : !hasEducational
        ? "This product still has room for another curiosity or educational hook because that angle has not been tested."
        : productNextMove(product);
  return `
    <section class="card product-command-intelligence">
      <div class="section-title"><div><h3>Product Intelligence Summary</h3><p>What this product has proven so far.</p></div></div>
      <p>This product has generated <strong>${number.format(relatedVideos.length)} videos</strong>, <strong>${money.format(product.lifetimeGmv || 0)} GMV</strong>, <strong>${money.format(product.lifetimeCommission || 0)} commission</strong>, and <strong>${number.format(product.lifetimeUnits || 0)} units</strong>.</p>
      <p><strong>Best hook:</strong> ${best?.hook || product.bestHook || "No winning hook identified yet."}</p>
      <p><strong>Recommendation:</strong> ${recommendation}</p>
    </section>
  `;
}

function bindProductCommandCenterControls(product) {
  document.querySelectorAll("[data-video-id]").forEach((row) => row.addEventListener("click", () => openVideo(row.dataset.videoId, product.id)));
}

let selectedVideoId = "";
let selectedVideoBackProductId = "";

function openVideo(videoId, productId = "") {
  selectedVideoId = videoId;
  selectedVideoBackProductId = productId;
  activePage = "videoDetail";
  pageTitle.textContent = "Video Detail";
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderNav();
  renderVideoDetail(videoId);
}

function renderVideoDetail(videoId) {
  const video = videos().find((item) => item.id === videoId);
  if (!video) {
    renderVideosDatabase();
    return;
  }
  content.innerHTML = `
    <button class="back-button" data-product-id="${video.productId || selectedVideoBackProductId}">Back to Product</button>
    <div class="detail-header intelligence-detail">
      <div><span class="badge">${videoPerformanceStatus(video)}</span><h3>${video.productName}</h3><p>${video.account} · ${compactDate(video.datePosted)} · ${video.category}</p></div>
    </div>
    <section class="card">
      <h3>${video.hook || "Untitled video"}</h3>
      <div class="grid four">
        ${metric("Views", number.format(video.views || 0), "Reach", "")}
        ${metric("GMV", money.format(video.gmv || 0), "Revenue", "")}
        ${metric("Commission", money.format(video.commission || 0), "Earnings", "")}
        ${metric("Units", number.format(video.sales || 0), "Sold", "")}
      </div>
      <div class="grid four">
        ${metric("Watch Time", `${Number(video.averageWatchTime || 0).toFixed(1)}s`, "Average", "")}
        ${metric("Completion", `${Number(video.completionRate || 0).toFixed(1)}%`, "Retention", "")}
        ${metric("Saves", number.format(video.saves || 0), "Intent", "")}
        ${metric("Shares", number.format(video.shares || 0), "Distribution", "")}
      </div>
      <p>${video.notes || ""}</p>
    </section>
  `;
  bindInternalButtons();
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const opportunity = opportunityScore(product);
  const lifecycle = productLifecycle(product);
  const signal = productSignalCollectionInfo(product);
  const timeline = productTimeline(product);
  const relatedVideos = productVideos(product.id);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).sort((a, b) => opportunityScore(b).score - opportunityScore(a).score).slice(0, 6);
  const bestVideo = bestPerformingVideo(relatedVideos);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back to Products</button>
    <div class="detail-header intelligence-detail">
      <div><span class="badge ${statusClass(product.status)}">${product.status === "Retire" ? "Cooling" : product.status}</span><h3>${product.name}</h3><p>${product.account} · ${product.category} · ${intelligenceSeason(product)}</p>${signalCollectionBadgeForInfo(signal)}</div>
      <div class="score-badge ${opportunity.tierClass}"><strong>${signal.isCollecting ? "New" : opportunity.score}</strong><span>${signal.isCollecting ? "Signal Collection" : "Opportunity"}</span></div>
      <div class="detail-actions">
        <button class="icon-button" id="addNoteButton">Add Note</button>
        <button class="icon-button" id="addVideoButton">Add Video</button>
        ${["Double Down", "Watch", "Wait", "Cooling"].map((status) => `<button class="icon-button" data-status="${status}">Mark as ${status}</button>`).join("")}
      </div>
    </div>
    ${productSummaryMarkup(product, relatedVideos)}
    ${signal.isCollecting ? `<section class="card signal-collection-card"><h3>Signal Collection</h3><p>${signalCollectionNote()}</p><div class="grid two">${metric("Days since posted", number.format(signal.daysSince), "Lifecycle: New", "")}${metric("Days remaining", number.format(signal.daysRemaining), "Before evaluation", "")}</div></section>` : ""}
    <section class="card product-intelligence-card">
      <div class="section-title"><div><h3>Product Intelligence</h3><p>${lifecycle.reason}</p></div>${opportunityPill(product)}</div>
      <div class="grid four">
        ${metric("Lifecycle", `${lifecycle.icon} ${lifecycle.stage}`, lifecycle.reason, "")}
        ${metric("Season", intelligenceSeason(product), "Manual edits save locally.", "")}
        ${metric("Confidence", signal.isCollecting ? "Collecting" : `${opportunity.confidence}%`, "Completeness, sales proof, and momentum.", "")}
        ${metric("Double Down", !signal.isCollecting && opportunity.score >= 78 ? "Yes" : "Not yet", productNextMove(product), "")}
      </div>
      <label class="season-editor">Manual season ${select("productSeasonSelect", ["Spring", "Summer", "Back to School", "Halloween", "Holiday", "Winter", "Evergreen", "Seasonal"], intelligenceSeason(product))}</label>
    </section>
    ${productIntelligenceSummaryMarkup(product, relatedVideos)}
    ${hookGeneratorMarkup(product)}
    ${hookHistoryMarkup(product, relatedVideos)}
    ${videoHistoryMarkup(relatedVideos)}
    ${bestVideoMarkup(bestVideo)}
    <div class="grid two">
      <section class="card"><h3>Product Timeline</h3><div class="timeline">${timeline.map((item) => `<div class="timeline-item ${item.done ? "done" : ""}"><span></span><div><strong>${item.label}</strong><p>${item.value}</p></div></div>`).join("")}</div></section>
      <section class="card"><h3>Decision Notes</h3><div class="field-list"><p><strong>Best hook:</strong> ${bestVideo?.hook || product.bestHook || "Add after testing."}</p><p><strong>Best CTA:</strong> ${product.bestCta || "Add after testing."}</p><p><strong>Next move:</strong> ${productNextMove(product)}</p><p><strong>Notes:</strong> ${formatNotes(product.notes)}</p></div></section>
    </div>
    ${compactRelatedVideosTable(relatedVideos)}
    <section class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></section>
  `;
  bindInternalButtons();
  bindHookGeneratorControls(product);
  bindProductCommandCenterControls(product);
  document.querySelector("#productSeasonSelect")?.addEventListener("change", (event) => { setProductSeason(product.id, event.target.value); renderProductDetail(product.id); });
  document.querySelector("#addNoteButton").addEventListener("click", () => {
    const note = prompt("Add a strategy note for this product:");
    if (note) {
      product.notes = [product.notes, `${new Date().toLocaleDateString()}: ${note}`].filter(Boolean).join("\n");
      product.strategyNotes = note;
      saveData(`Note saved for ${product.name}`);
      renderProductDetail(product.id);
    }
  });
  document.querySelector("#addVideoButton").addEventListener("click", () => { videoFilters.product = product.name; renderPage("videos"); });
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    product.status = button.dataset.status;
    saveData(`${product.name} marked as ${product.status}`);
    renderProductDetail(product.id);
  }));
}

/* Raised Right historical product import: Jan 5–June 30, 2026 */
const RAISED_RIGHT_HISTORICAL_IMPORT_VERSION = "raised-right-historical-products-jan5-june30-2026-v1";
const RAISED_RIGHT_HISTORICAL_PERIOD = "Jan 5–June 30, 2026";
const RAISED_RIGHT_HISTORICAL_SOURCE = "Raised Right historical product export";
let raisedRightHistoricalImportApplied = false;

const northstarRaisedRightHistoricalNormalizeBase = normalizeDatabase;
normalizeDatabase = function normalizeRaisedRightHistoricalImport() {
  northstarRaisedRightHistoricalNormalizeBase();
  validateNorthstarDatabaseShape();
  if (!raisedRightHistoricalImportApplied && !window.NORTHSTAR_FAST_BOOT_ACTIVE) {
    raisedRightHistoricalImportApplied = true;
    try {
      importRaisedRightHistoricalProducts();
    } catch (error) {
      recordNorthstarStartupDiagnostic("historical import failed", error);
      console.error("Northstar historical import failed safely.", error);
    }
  }
  try {
    if (window.NORTHSTAR_FAST_BOOT_ACTIVE) return;
    applyBundledProductImages();
    connectProductImagesAcrossLifecycle();
  } catch (error) {
    recordNorthstarStartupDiagnostic("product image import skipped", error);
    console.warn("Northstar skipped bundled product images safely.", error);
  }
};

function importRaisedRightHistoricalProducts() {
  const rows = window.NORTHSTAR_RAISED_RIGHT_HISTORICAL_PRODUCTS || [];
  if (!rows.length) return;
  db.salesRecords = db.salesRecords || [];
  db.historicalImports = db.historicalImports || [];
  const summary = { version: RAISED_RIGHT_HISTORICAL_IMPORT_VERSION, account: "Raised Right", rows: rows.length, addedProducts: 0, updatedProducts: 0, updatedSalesRecords: 0, importedAt: new Date().toISOString() };
  rows.forEach((row) => {
    const result = upsertRaisedRightHistoricalRow(row);
    summary.addedProducts += result.addedProduct ? 1 : 0;
    summary.updatedProducts += result.updatedProduct ? 1 : 0;
    summary.updatedSalesRecords += 1;
  });
  db.historicalImports = db.historicalImports.filter((entry) => entry.version !== RAISED_RIGHT_HISTORICAL_IMPORT_VERSION);
  db.historicalImports.unshift(summary);
  db.historicalImports = db.historicalImports.slice(0, 10);
  recordDataSource?.("products", "Raised Right historical product export", `${rows.length} historical product rows`);
  recordDataSource?.("salesRecords", "Raised Right historical product export", RAISED_RIGHT_HISTORICAL_PERIOD);
  recordNorthstarStartupDiagnostic("historical import applied", null, summary);
}

function upsertRaisedRightHistoricalRow(row) {
  const account = getAccount("raisedRight") || { id: "raisedRight", name: "Raised Right" };
  const product = findHistoricalProduct(row, account) || createHistoricalProduct(row, account);
  const addedProduct = !products().some((item) => item.id === product.id);
  if (addedProduct) db.products.push(product);
  const previousName = product.name;
  product.externalProductId = row.productId || product.externalProductId || "";
  product.tiktokProductId = row.productId || product.tiktokProductId || "";
  product.accountId = "raisedRight";
  product.account = "Raised Right";
  product.name = product.name || row.productName;
  product.category = product.category || inferHistoricalCategory(row.productName);
  product.categoryGroup = product.categoryGroup || product.category.split("/")[0].trim();
  product.seasonality = product.seasonality || inferHistoricalSeasonality(row.productName);
  product.evergreenSeasonal = product.evergreenSeasonal || (/garden|summer|patriot|flag|fourth/i.test(row.productName || "") ? "Seasonal" : "Evergreen");
  product.historicalPeriod = RAISED_RIGHT_HISTORICAL_PERIOD;
  product.historicalSalesSource = RAISED_RIGHT_HISTORICAL_SOURCE;
  product.historicalMetrics = {
    period: RAISED_RIGHT_HISTORICAL_PERIOD,
    gmv: Number(row.gmv || 0),
    commission: Number(row.commission || 0),
    unitsSold: Number(row.unitsSold || 0),
    source: RAISED_RIGHT_HISTORICAL_SOURCE,
    productId: row.productId || ""
  };
  product.notes = product.notes || `Imported from ${RAISED_RIGHT_HISTORICAL_SOURCE}.`;
  product.strategyNotes = product.strategyNotes || product.notes || "";
  product.sampleStatus = product.sampleStatus || "Wait";
  product.wouldPromoteAgain = product.wouldPromoteAgain || "Maybe";
  product.status = product.status === "Retire" ? "Cooling" : product.status || historicalStatus(row);
  product.originalStatus = product.originalStatus === "Retire" ? "Cooling" : product.originalStatus || product.status;
  product.firstPromotedDate = product.firstPromotedDate || "2026-01-05";
  product.lastPromotedDate = maxDateString(product.lastPromotedDate, "2026-06-30");
  upsertHistoricalMonthlyPerformance(product, row);
  upsertHistoricalSalesRecord(product, row);
  recalculateProductLifetimeFromHistorical(product);
  return { addedProduct, updatedProduct: !addedProduct && previousName === product.name };
}

function findHistoricalProduct(row, account) {
  const productId = String(row.productId || "").trim();
  if (productId) {
    const byId = products().find((product) => {
      return [product.externalProductId, product.tiktokProductId, product.productId, product.sourceProductId].filter(Boolean).map(String).includes(productId);
    });
    if (byId) return byId;
  }
  const rowName = normalizedName(row.productName);
  return products().find((product) => {
    if (product.accountId !== account.id && normalizedName(product.account) !== normalizedName(account.name)) return false;
    const existingName = normalizedName(product.name);
    return existingName === rowName || (existingName.length > 12 && rowName.includes(existingName)) || (rowName.length > 12 && existingName.includes(rowName));
  });
}

function createHistoricalProduct(row, account) {
  const category = inferHistoricalCategory(row.productName);
  return {
    id: uniqueImportId(`${account.id}-${row.productId || slug(row.productName)}`),
    name: row.productName,
    accountId: account.id,
    account: account.name,
    category,
    categoryGroup: category.split("/")[0].trim(),
    seasonality: inferHistoricalSeasonality(row.productName),
    evergreenSeasonal: /garden|summer|patriot|flag|fourth/i.test(row.productName || "") ? "Seasonal" : "Evergreen",
    lifetimeGmv: 0,
    lifetimeCommission: 0,
    lifetimeUnits: 0,
    monthlyPerformance: [],
    firstPromotedDate: "2026-01-05",
    lastPromotedDate: "2026-06-30",
    sampleStatus: "Wait",
    wouldPromoteAgain: "Maybe",
    status: historicalStatus(row),
    originalStatus: historicalStatus(row),
    notes: `Imported from ${RAISED_RIGHT_HISTORICAL_SOURCE}.`,
    bestHook: "",
    bestCta: "",
    strategyNotes: `Imported from ${RAISED_RIGHT_HISTORICAL_SOURCE}.`,
    similarTags: [category.split("/")[0].trim(), account.id]
  };
}

function historicalStatus(row) {
  const gmv = Number(row.gmv || 0);
  const units = Number(row.unitsSold || 0);
  if (gmv >= 500 || units >= 25) return "Double Down";
  if (gmv > 0 || units > 0) return "Watch";
  return "Wait";
}

function inferHistoricalCategory(name) {
  const text = String(name || "").toLowerCase();
  if (/garden|weed|soil|plant|lawn|yard|hoe|rake|shovel/.test(text)) return "Garden / Outdoor Problem Solver";
  if (/vmrk|vrmk|supplement|health|peptide|protocol|fenbendazole|ivermectin|water|tds|tester|wellness|recovery/.test(text)) return "Health / Wellness";
  if (/flag|patriot|america|coin|trump|fourth|july|250th/.test(text)) return "Patriotic / Collectible";
  if (/dress|cardigan|fashion|shirt|women|nail|beauty|makeup|hair/.test(text)) return "Fashion / Beauty";
  if (/sofa|home|kitchen|cover|organizer|clean|house|bed|bath/.test(text)) return "Home / Utility";
  if (/book|bible|handbook|guide|journal|planner/.test(text)) return "Books / Education";
  return "Imported / Historical";
}

function inferHistoricalSeasonality(name) {
  const text = String(name || "").toLowerCase();
  if (/garden|weed|lawn|summer|pool/.test(text)) return "Spring/Summer";
  if (/christmas|holiday|ornament|halloween|fall/.test(text)) return "Seasonal";
  if (/flag|patriot|america|250th|fourth|july/.test(text)) return "Evergreen through 2026";
  return "Evergreen";
}

function upsertHistoricalMonthlyPerformance(product, row) {
  product.monthlyPerformance = product.monthlyPerformance || [];
  const existing = product.monthlyPerformance.find((entry) => entry.month === RAISED_RIGHT_HISTORICAL_PERIOD);
  const payload = {
    month: RAISED_RIGHT_HISTORICAL_PERIOD,
    gmv: Number(row.gmv || 0),
    commission: Number(row.commission || 0),
    units: Number(row.unitsSold || 0),
    source: RAISED_RIGHT_HISTORICAL_SOURCE
  };
  if (existing) Object.assign(existing, payload);
  else product.monthlyPerformance.unshift(payload);
}

function upsertHistoricalSalesRecord(product, row) {
  const key = `historical-raised-right-${row.productId || slug(row.productName)}-2026-01-05-2026-06-30`;
  const existing = db.salesRecords.find((record) => record.id === key || (record.historicalPeriod === RAISED_RIGHT_HISTORICAL_PERIOD && String(record.externalProductId || "") === String(row.productId || "") && record.accountId === "raisedRight"));
  const payload = {
    id: key,
    accountId: "raisedRight",
    account: "Raised Right",
    productId: product.id,
    externalProductId: row.productId || "",
    productName: product.name,
    category: product.category,
    date: "2026-06-30",
    periodStart: "2026-01-05",
    periodEnd: "2026-06-30",
    historicalPeriod: RAISED_RIGHT_HISTORICAL_PERIOD,
    gmv: Number(row.gmv || 0),
    commission: Number(row.commission || 0),
    unitsSold: Number(row.unitsSold || 0),
    source: RAISED_RIGHT_HISTORICAL_SOURCE,
    lastUpdated: new Date().toISOString()
  };
  if (existing) Object.assign(existing, payload, { id: existing.id });
  else db.salesRecords.unshift(payload);
}

function recalculateProductLifetimeFromHistorical(product) {
  const historical = product.historicalMetrics || { gmv: 0, commission: 0, unitsSold: 0 };
  const current = (db.salesRecords || []).filter((record) => {
    if (record.source === RAISED_RIGHT_HISTORICAL_SOURCE || record.historicalPeriod === RAISED_RIGHT_HISTORICAL_PERIOD) return false;
    if (record.productId !== product.id && normalizedName(record.productName) !== normalizedName(product.name)) return false;
    const date = normalizeDateKey(record.date || record.capturedAt || "");
    return !date || date >= "2026-07-01";
  }).reduce((acc, record) => {
    acc.gmv += Number(record.gmv || 0);
    acc.commission += Number(record.commission || 0);
    acc.unitsSold += Number(record.unitsSold || record.sales || 0);
    return acc;
  }, { gmv: 0, commission: 0, unitsSold: 0 });
  const currentFromMonthly = current.gmv || current.commission || current.unitsSold ? current : (product.monthlyPerformance || []).filter((entry) => {
    if (entry.source === RAISED_RIGHT_HISTORICAL_SOURCE || entry.month === RAISED_RIGHT_HISTORICAL_PERIOD) return false;
    return /July|August|September|October|November|December 2026|2027/i.test(String(entry.month || entry.date || ""));
  }).reduce((acc, entry) => {
    acc.gmv += Number(entry.gmv || 0);
    acc.commission += Number(entry.commission || 0);
    acc.unitsSold += Number(entry.units || entry.unitsSold || 0);
    return acc;
  }, { gmv: 0, commission: 0, unitsSold: 0 });
  product.lifetimeGmv = Number(historical.gmv || 0) + currentFromMonthly.gmv;
  product.lifetimeCommission = Number(historical.commission || 0) + currentFromMonthly.commission;
  product.lifetimeUnits = Number(historical.unitsSold || 0) + currentFromMonthly.unitsSold;
}

function maxDateString(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";
  return String(a) > String(b) ? a : b;
}

function raisedRightHistoricalSourceMarkup(product) {
  if (!product.historicalMetrics) return "";
  return `<section class="card historical-source-card"><div class="section-title"><div><h3>Historical Sales Source</h3><p>${product.historicalMetrics.source}</p></div><span class="badge">Raised Right</span></div><div class="grid three">${metric("Historical GMV", money.format(product.historicalMetrics.gmv || 0), product.historicalMetrics.period, "")}${metric("Historical Commission", money.format(product.historicalMetrics.commission || 0), "Jan–June baseline", "")}${metric("Historical Units", number.format(product.historicalMetrics.unitsSold || 0), "Imported unit sales", "")}</div></section>`;
}

function validateNorthstarDatabaseShape() {
  db.products = Array.isArray(db.products) ? db.products : [];
  db.videos = Array.isArray(db.videos) ? db.videos : [];
  db.samples = Array.isArray(db.samples) ? db.samples : Array.isArray(db.sampleRecords) ? db.sampleRecords : Array.isArray(db.sampleRequests) ? db.sampleRequests : [];
  db.sampleRecords = db.samples;
  db.sampleRequests = db.samples;
  db.salesRecords = Array.isArray(db.salesRecords) ? db.salesRecords : [];
  db.hooks = Array.isArray(db.hooks) ? db.hooks : [];
  db.notes = db.notes && typeof db.notes === "object" ? db.notes : {};
  db.notes.lessons = Array.isArray(db.notes.lessons) ? db.notes.lessons : [];
  db.notes.businessRules = Array.isArray(db.notes.businessRules) ? db.notes.businessRules : [];
  db.monthlyReports = Array.isArray(db.monthlyReports) ? db.monthlyReports : [];
  db.importHistory = Array.isArray(db.importHistory) ? db.importHistory : [];
  db.actions = Array.isArray(db.actions) ? db.actions : [];
  return db;
}

function recordNorthstarStartupDiagnostic(status, error = null, details = {}) {
  window.NORTHSTAR_STARTUP_DIAGNOSTICS = window.NORTHSTAR_STARTUP_DIAGNOSTICS || [];
  const entry = {
    status,
    timestamp: new Date().toISOString(),
    products: Array.isArray(db.products) ? db.products.length : 0,
    videos: Array.isArray(db.videos) ? db.videos.length : 0,
    samples: Array.isArray(db.samples) ? db.samples.length : 0,
    salesRecords: Array.isArray(db.salesRecords) ? db.salesRecords.length : 0,
    localStorageRestored: !!localStorage.getItem(STORAGE_KEY),
    details,
    error: error ? String(error.message || error) : ""
  };
  window.NORTHSTAR_STARTUP_DIAGNOSTICS.push(entry);
  db.startupDiagnostics = window.NORTHSTAR_STARTUP_DIAGNOSTICS.slice(-8);
  return entry;
}

function northstarStartupErrorPanel(error) {
  const message = escapeHtml(error?.message || String(error || "Unknown startup error"));
  if (content) {
    content.innerHTML = `
      <section class="card startup-error-panel">
        <div class="section-title"><div><h3>Northstar could not finish loading</h3><p>Your saved local data was not cleared. Refresh after this fix is applied.</p></div><span class="badge warn">Startup paused</span></div>
        <p><strong>Error:</strong> ${message}</p>
        <div class="form-actions"><button id="startupExportBackup" class="icon-button" type="button">Export Backup</button></div>
        <ul class="list">
          <li>Products loaded: ${Array.isArray(db.products) ? db.products.length : 0}</li>
          <li>Videos loaded: ${Array.isArray(db.videos) ? db.videos.length : 0}</li>
          <li>Samples loaded: ${Array.isArray(db.samples) ? db.samples.length : 0}</li>
          <li>Sales records loaded: ${Array.isArray(db.salesRecords) ? db.salesRecords.length : 0}</li>
          <li>Local storage restored: ${localStorage.getItem(STORAGE_KEY) ? "Yes" : "No"}</li>
        </ul>
      </section>
    `;
    document.querySelector("#startupExportBackup")?.addEventListener("click", exportBackup);
  }
  if (nav) nav.innerHTML = "";
  if (pageTitle) pageTitle.textContent = "Startup diagnostics";
}

const northstarHistoricalProductSummaryBase = productSummaryMarkup;
productSummaryMarkup = function productSummaryWithHistoricalSource(product, relatedVideos) {
  return `${northstarHistoricalProductSummaryBase(product, relatedVideos)}${raisedRightHistoricalSourceMarkup(product)}`;
};

const northstarHistoricalProductLifecycleRowsBase = productLifecycleRows;
productLifecycleRows = function productLifecycleRowsRankedByHistoricalGmv(tab) {
  const rows = northstarHistoricalProductLifecycleRowsBase(tab);
  if (tab === "Live") return rows.slice().sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0));
  return rows;
};

if (!importCenterTabs().some((tab) => tab.id === videoBackfillState.activeTab)) videoBackfillState.activeTab = "videos";

/* Startup performance safety: historical imports make product scoring much larger than the prototype data. */
let northstarProductMetricMaxCache = { count: -1, values: {} };
const northstarMaxProductValueBase = maxProductValue;
maxProductValue = function maxProductValueCached(field) {
  const count = products().length;
  if (northstarProductMetricMaxCache.count !== count) northstarProductMetricMaxCache = { count, values: {} };
  if (northstarProductMetricMaxCache.values[field] !== undefined) return northstarProductMetricMaxCache.values[field];
  const value = northstarMaxProductValueBase(field);
  northstarProductMetricMaxCache.values[field] = value;
  return value;
};

let northstarPulseSnapshotCache = { raw: null, snapshots: [] };
function cachedPulseSnapshots() {
  const raw = localStorage.getItem(PULSE_SNAPSHOTS_KEY) || "[]";
  if (northstarPulseSnapshotCache.raw === raw) return northstarPulseSnapshotCache.snapshots;
  try {
    northstarPulseSnapshotCache = { raw, snapshots: JSON.parse(raw) || [] };
  } catch {
    northstarPulseSnapshotCache = { raw, snapshots: [] };
  }
  return northstarPulseSnapshotCache.snapshots;
}

productRecentMomentum = function productRecentMomentumCached(product) {
  const snapshots = cachedPulseSnapshots();
  const latest = snapshots.at(-1);
  const previous = snapshots.length > 1 ? snapshots.at(-2) : null;
  if (latest && previous) {
    const now = latest.products?.find((item) => item.id === product.id);
    const before = previous.products?.find((item) => item.id === product.id);
    if (now && before) {
      const unitDelta = Number(now.units || 0) - Number(before.units || 0);
      const gmvDelta = Number(now.gmv || 0) - Number(before.gmv || 0);
      if (unitDelta > 0 || gmvDelta > 0) return 10;
      if (unitDelta < 0 || gmvDelta < 0) return 2;
    }
  }
  const related = productVideos(product.id);
  const recentSales = related.reduce((sum, video) => sum + Number(video.sales || 0), 0);
  if (recentSales > 4) return 10;
  if (recentSales > 0 || Number(product.lifetimeUnits || 0) > 0) return 7;
  return 2;
};

let northstarScoredProductsCache = { count: -1, gmv: -1, rows: null };
const northstarScoredProductsBase = scoredProducts;
scoredProducts = function scoredProductsCached() {
  const rows = products();
  const gmv = rows.reduce((sum, product) => sum + Number(product.lifetimeGmv || 0), 0);
  if (northstarScoredProductsCache.rows && northstarScoredProductsCache.count === rows.length && northstarScoredProductsCache.gmv === gmv) {
    return northstarScoredProductsCache.rows.slice();
  }
  const scored = northstarScoredProductsBase();
  northstarScoredProductsCache = { count: rows.length, gmv, rows: scored };
  return scored.slice();
};

let northstarActionPlanCache = { key: "", rows: null };
const northstarBuildActionPlanBase = buildActionPlan;
buildActionPlan = function buildActionPlanCached() {
  const key = [
    products().length,
    videos().length,
    polarisSamples().length,
    db.salesRecords?.length || 0,
    JSON.stringify(readJson(ACTION_STATUS_KEY, {}))
  ].join("|");
  if (northstarActionPlanCache.rows && northstarActionPlanCache.key === key) return northstarActionPlanCache.rows.map((action) => ({ ...action }));
  const actions = northstarBuildActionPlanBase();
  northstarActionPlanCache = { key, rows: actions };
  return actions.map((action) => ({ ...action }));
};

/* LocalStorage quota safety: save only Jennifer's editable overlay, not bundled historical data. */
const NORTHSTAR_COMPACT_STORAGE_VERSION = "northstar-compact-user-edits-v1";

function localStorageSizeEstimate() {
  let bytes = 0;
  const entries = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const value = localStorage.getItem(key) || "";
      const size = (key.length + value.length) * 2;
      bytes += size;
      if (/northstar/i.test(key)) entries.push({ key, bytes: size });
    }
  } catch {}
  return { bytes, mb: bytes / 1024 / 1024, entries: entries.sort((a, b) => b.bytes - a.bytes) };
}

function safeSetLocalStorage(key, value, label = key) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    recordNorthstarStartupDiagnostic("localStorage save skipped", error, { key, label, attemptedBytes: value.length * 2 });
    console.warn(`Northstar skipped saving ${label}; browser storage is full.`, error);
    try { showMessage("Storage is full. Northstar skipped saving but kept the app open.", "warn"); } catch {}
    return false;
  }
}

function compactProductOverlay(product) {
  return {
    id: product.id,
    externalProductId: product.externalProductId || product.tiktokProductId || "",
    name: product.name,
    accountId: product.accountId,
    account: product.account,
    category: product.category,
    categoryGroup: product.categoryGroup,
    seasonality: product.seasonality,
    evergreenSeasonal: product.evergreenSeasonal,
    sampleStatus: product.sampleStatus,
    wouldPromoteAgain: product.wouldPromoteAgain,
    status: product.status,
    originalStatus: product.originalStatus,
    notes: product.notes,
    bestHook: product.bestHook,
    bestCta: product.bestCta,
    whatWorked: product.whatWorked,
    whatToTestNext: product.whatToTestNext,
    videoPlans: Array.isArray(product.videoPlans) ? product.videoPlans : [],
    strategyNotes: product.strategyNotes,
    firstPromotedDate: product.firstPromotedDate,
    lastPromotedDate: product.lastPromotedDate,
    source: product.source || "",
    seedSource: product.seedSource || "",
    userCreated: !!product.userCreated
  };
}

function productNeedsCompactOverlay(product) {
  if (!product.historicalMetrics) return true;
  if (product.userCreated || product.source || product.seedSource) return true;
  if (product.bestHook || product.bestCta) return true;
  if (product.whatWorked || product.whatToTestNext) return true;
  if (Array.isArray(product.videoPlans) && product.videoPlans.length) return true;
  if (product.sampleStatus && product.sampleStatus !== "Wait") return true;
  if (product.wouldPromoteAgain && product.wouldPromoteAgain !== "Maybe") return true;
  if (product.status && product.status !== historicalStatus(product.historicalMetrics)) return true;
  const importedNote = `Imported from ${RAISED_RIGHT_HISTORICAL_SOURCE}.`;
  if (product.notes && product.notes !== importedNote) return true;
  if (product.strategyNotes && product.strategyNotes !== importedNote && product.strategyNotes !== product.notes) return true;
  return false;
}

function createCompactLocalData() {
  const historicalSource = RAISED_RIGHT_HISTORICAL_SOURCE;
  const productEdits = products().filter(productNeedsCompactOverlay).map(compactProductOverlay);
  return {
    storageVersion: NORTHSTAR_COMPACT_STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    userLayerOnly: true,
    data: {
      productEdits,
      products: products().filter((product) => !product.historicalMetrics && product.userCreated).map(compactProductOverlay),
      videos: videos(),
      samples: polarisSamples(),
      sampleRecords: polarisSamples(),
      sampleRequests: polarisSamples(),
      hooks: db.hooks || [],
      notes: db.notes || {},
      actions: db.actions || [],
      actionHistory: db.actionHistory || [],
      monthlyReports: db.monthlyReports || [],
      dailyUpdates: db.dailyUpdates || [],
      performanceSnapshots: db.performanceSnapshots || [],
      importHistory: db.importHistory || [],
      importReviews: db.importReviews || [],
      dataSourceLog: db.dataSourceLog || [],
      polarisSnapshots: db.polarisSnapshots || [],
      polarisChangeSummary: db.polarisChangeSummary || null,
      salesRecords: (db.salesRecords || []).filter((record) => record.source !== historicalSource && record.historicalPeriod !== RAISED_RIGHT_HISTORICAL_PERIOD),
      startupDiagnostics: db.startupDiagnostics || []
    }
  };
}

function mergeProductEdits(productEdits = []) {
  const byId = new Map(products().map((product) => [product.id, product]));
  productEdits.forEach((edit) => {
    const existing = byId.get(edit.id) || products().find((product) => {
      const editExternal = String(edit.externalProductId || edit.tiktokProductId || "").trim();
      return editExternal && [product.externalProductId, product.tiktokProductId, product.productId].filter(Boolean).map(String).includes(editExternal);
    });
    if (existing) Object.assign(existing, edit);
    else db.products.push(edit);
  });
}

const northstarMergeDatabaseBase = mergeDatabase;
mergeDatabase = function mergeDatabaseWithCompactUserLayer(base, saved) {
  const incoming = saved?.storageVersion === NORTHSTAR_COMPACT_STORAGE_VERSION ? saved.data || {} : saved?.data || saved || {};
  const merged = northstarMergeDatabaseBase(base, incoming);
  db = merged;
  validateNorthstarDatabaseShape();
  if (Array.isArray(incoming.productEdits)) mergeProductEdits(incoming.productEdits);
  return db;
};

function safeSaveLocalData(label = "user-edits") {
  const compact = createCompactLocalData();
  const ok = safeSetLocalStorage(STORAGE_KEY, JSON.stringify(compact), label);
  if (ok) {
    lastSavedAt = new Date().toLocaleString();
    safeSetLocalStorage(SAVED_AT_KEY, lastSavedAt, "last-saved");
    updateLastSavedDisplay();
  }
  return ok;
}

saveData = function saveCompactLocalData(message = "Changes saved locally") {
  const ok = safeSaveLocalData("saveData");
  if (ok) showMessage(message, "good");
};

const northstarInitializePulseEngineBase = initializePulseEngine;
initializePulseEngine = function initializePulseEngineCompact(reason = "snapshot") {
  try {
    const snapshots = readJson(PULSE_SNAPSHOTS_KEY, []);
    const current = createPulseSnapshot(reason);
    current.products = (current.products || [])
      .slice()
      .sort((a, b) => Number(b.gmv || 0) - Number(a.gmv || 0))
      .slice(0, 25);
    current.categories = (current.categories || []).slice(0, 20).map((category) => ({
      category: category.category,
      gmv: category.gmv,
      commission: category.commission,
      units: category.units,
      products: category.products,
      averageOpportunity: category.averageOpportunity
    }));
    current.fingerprint = stableFingerprint({
      products: current.products.map((product) => ({ id: product.id, units: product.units, gmv: product.gmv, commission: product.commission, score: product.score })),
      categories: current.categories,
      sampleCounts: current.sampleCounts,
      videoMetrics: current.videoMetrics
    });
    const latest = snapshots.at(-1);
    let nextSnapshots = snapshots;
    if (!latest || latest.fingerprint !== current.fingerprint) {
      nextSnapshots = [...snapshots, current].slice(-12);
      safeSetLocalStorage(PULSE_SNAPSHOTS_KEY, JSON.stringify(nextSnapshots), "pulse-snapshots");
    }
    pulseState.snapshots = nextSnapshots;
    pulseState.current = nextSnapshots.at(-1) || current;
    pulseState.previous = nextSnapshots.length > 1 ? nextSnapshots.at(-2) : null;
    pulseState.comparison = comparePulseSnapshots(pulseState.previous, pulseState.current);
    pulseState.log = readJson(DECISION_LOG_KEY, []);
  } catch (error) {
    recordNorthstarStartupDiagnostic("pulse skipped", error);
    console.warn("Northstar skipped Pulse snapshot save safely.", error);
  }
};

function storageHealthMarkup() {
  const storage = localStorageSizeEstimate();
  const compactBytes = JSON.stringify(createCompactLocalData()).length * 2;
  const tone = storage.mb >= 4 ? "warn" : storage.mb >= 3 ? "hot" : "good";
  return `
    <div class="card storage-health-card">
      <div class="section-title"><div><h3>Storage Health</h3><p>Northstar now saves a lightweight user-edits layer. Historical sales stay in bundled data files.</p></div><span class="badge ${tone}">${storage.mb.toFixed(2)} MB used</span></div>
      <ul class="list">
        <li>Current browser storage estimate: ${storage.mb.toFixed(2)} MB</li>
        <li>Next compact Northstar save estimate: ${(compactBytes / 1024).toFixed(0)} KB</li>
        <li>Bundled historical products: ${(window.NORTHSTAR_RAISED_RIGHT_HISTORICAL_PRODUCTS || []).length}</li>
        <li>Largest Northstar keys: ${storage.entries.slice(0, 3).map((entry) => `${entry.key} (${(entry.bytes / 1024).toFixed(0)} KB)`).join(", ") || "None"}</li>
      </ul>
      <div class="form-actions"><button id="storageExportBackup" class="ghost-button" type="button">Export Backup</button><button id="storageCompactSave" class="icon-button" type="button">Save Compact User Data</button></div>
    </div>
  `;
}

const northstarStorageRenderSettingsBase = renderSettings;
renderSettings = function renderSettingsWithStorageHealth() {
  northstarStorageRenderSettingsBase();
  content.insertAdjacentHTML("beforeend", storageHealthMarkup());
  document.querySelector("#storageExportBackup")?.addEventListener("click", exportBackup);
  document.querySelector("#storageCompactSave")?.addEventListener("click", () => {
    if (safeSaveLocalData("manual-compact-save")) showMessage("Compact user data saved", "good");
    renderSettings();
  });
};

const northstarStorageExportBackupBase = exportBackup;
exportBackup = function exportBackupWithStorageMode() {
  const backup = {
    version: BACKUP_VERSION,
    storageMode: "compact-user-layer",
    exportedAt: new Date().toISOString(),
    lastSavedAt,
    data: db,
    compactData: createCompactLocalData(),
    storageHealth: localStorageSizeEstimate(),
    localMeta: {
      captureCount: captureCount(),
      lastCapturedAt: localStorage.getItem(LAST_CAPTURED_KEY) || "",
      captureLog: readJson(CAPTURE_LOG_KEY, []),
      pulseSnapshots: readJson(PULSE_SNAPSHOTS_KEY, []),
      decisionLog: readJson(DECISION_LOG_KEY, []),
      actionStatuses: readJson(ACTION_STATUS_KEY, {}),
      actionHistory: readJson(ACTION_HISTORY_KEY, []),
      productSeasons: storedProductSeasons(),
      syncHistory: readJson(NORTHSTAR_SYNC_HISTORY_KEY, []),
      importHistory: db.importHistory || [],
      importReviews: db.importReviews || []
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("Backup exported", "good");
};

/* Northstar Morning Brief + layout polish: defensive view filters and compact executive briefing. */
let revenueSnapshotRange = "Current Month";

function isPlaceholderVideo(video = {}) {
  const product = normalizedName(video.productName || video.product || video.topic || "");
  const hook = normalizedName(video.hook || video.title || "");
  const metrics = ["views", "likes", "saves", "shares", "sales", "gmv", "commission"].every((key) => Number(video[key] || 0) === 0);
  return product === "unassigned product" || hook === "untitled video" || (!product && !hook && metrics) || metrics && (product === "unassigned product" || hook === "untitled video");
}

function validVideos() {
  return (db.videos || []).filter((video) => !isPlaceholderVideo(video));
}

const northstarPolishProductVideosBase = productVideos;
productVideos = function productVideosWithoutPlaceholders(productId) {
  return validVideos().filter((video) => video.productId === productId);
};

filteredVideos = function filteredVideosWithoutPlaceholders() {
  return validVideos().filter((video) => {
    if (videoFilters.search && !`${video.productName} ${video.hook} ${video.cta} ${video.account}`.toLowerCase().includes(videoFilters.search.toLowerCase())) return false;
    if (videoFilters.account !== "All" && video.account !== videoFilters.account) return false;
    if (videoFilters.product !== "All" && video.productName !== videoFilters.product) return false;
    if (videoFilters.category !== "All" && video.category !== videoFilters.category) return false;
    if (videoFilters.hookType !== "All" && video.hookType !== videoFilters.hookType) return false;
    if (videoFilters.salesOnly && !(Number(video.sales || 0) > 0)) return false;
    if (videoFilters.highSaves && !(Number(video.saves || 0) >= 10)) return false;
    if (videoFilters.highShares && !(Number(video.shares || 0) >= 10)) return false;
    return true;
  });
};

function accountVideos(account) {
  return validVideos().filter((video) => video.accountId === account.id || normalizedName(video.account) === normalizedName(account.name));
}

function recordInRange(row, range = revenueSnapshotRange) {
  const dateKey = normalizeDateKey(row.date || row.capturedAt || row.datePosted || row.postedAt || "");
  if (!dateKey || range === "Lifetime") return true;
  const now = new Date();
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  if (range === "Current Month") return date >= currentStart;
  if (range === "Previous Month") return date >= previousStart && date <= previousEnd;
  if (range === "Last 90 Days") return date >= new Date(now.getTime() - 90 * 86400000);
  if (range === "Year to Date") return date >= new Date(now.getFullYear(), 0, 1);
  return true;
}

function accountSalesRecords(account, range = revenueSnapshotRange) {
  const rows = db.salesRecords || db.sales || [];
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => (row.accountId === account.id || normalizedName(row.account) === normalizedName(account.name)) && recordInRange(row, range));
}

function accountRevenueSnapshot(account, productList, range = revenueSnapshotRange) {
  const sales = accountSalesRecords(account, range);
  if (sales.length) {
    const totals = sales.reduce((acc, row) => {
      acc.gmv += toNumber(row.gmv || row.revenue || row.grossRevenue);
      acc.commission += toNumber(row.commission || row.creatorCommission);
      acc.units += toNumber(row.unitsSold || row.sales || row.itemsSold || row.units);
      return acc;
    }, { gmv: 0, commission: 0, units: 0 });
    const topProductName = sales.slice().sort((a, b) => toNumber(b.gmv || b.revenue) - toNumber(a.gmv || a.revenue))[0]?.productName || "No product yet";
    return { ...totals, topProductName, source: "db.salesRecords", range };
  }
  const totals = productList.reduce((acc, product) => {
    acc.gmv += Number(product.lifetimeGmv || 0);
    acc.commission += Number(product.lifetimeCommission || 0);
    acc.units += Number(product.lifetimeUnits || 0);
    return acc;
  }, { gmv: 0, commission: 0, units: 0 });
  const topProduct = productList.slice().sort((a, b) => Number(b.lifetimeGmv || 0) - Number(a.lifetimeGmv || 0))[0];
  return { ...totals, topProductName: topProduct?.name || "No product yet", source: productList.length ? "db.products" : "Awaiting Polaris data", range: "Lifetime fallback" };
}

function accountRevenueMarkup(revenue) {
  return `<div class="account-metric-grid compact-revenue-grid"><div><span>GMV</span><strong>${money.format(revenue.gmv || 0)}</strong></div><div><span>Comm.</span><strong class="nowrap-money">${money.format(revenue.commission || 0)}</strong></div><div><span>Items sold</span><strong>${number.format(revenue.units || 0)}</strong></div><div><span>Top product</span><strong class="clamp-2" title="${escapeAttr(revenue.topProductName || "")}">${revenue.topProductName}</strong></div></div>`;
}

function accountSampleInventoryMarkup(summary) {
  const rows = [
    ["Waiting to Film", summary.waitingToFilm],
    ["High Priority", summary.highPriority]
  ];
  return `<div class="account-sample-list compact-account-samples">${rows.map(([label, list]) => `<div><span>${label}</span><strong>${number.format(list.length)}</strong><small>${sampleNameList(list)}</small></div>`).join("")}</div>`;
}

function accountBriefMarkup(account) {
  const brief = accountBriefData(account);
  const ranges = ["Current Month", "Previous Month", "Last 90 Days", "Year to Date", "Lifetime"];
  return `
    <section class="card account-brief-card compact-brand-brief">
      <div class="account-brief-header">
        <div>
          <span class="account-brief-label">${account.name}</span>
          <h2>${account.name} Brief</h2>
        </div>
        <p>${brief.spark}</p>
      </div>
      <div class="account-brief-grid">
        <article class="account-brief-panel account-actions-panel">
          <h3>Top Three Actions</h3>
          ${brief.actions.map(accountActionMarkup).join("")}
        </article>
        <article class="account-brief-panel">
          <h3>Sample Inventory</h3>
          ${accountSampleInventoryMarkup(brief.samples)}
        </article>
        <article class="account-brief-panel">
          <div class="panel-title-row"><h3>Revenue Snapshot</h3>${select(`revenueRange-${account.id}`, ranges, revenueSnapshotRange).replace("<select", `<select data-revenue-range`)}</div>
          ${accountRevenueMarkup(brief.revenue)}
        </article>
        <article class="account-brief-panel">
          <h3>Content Snapshot</h3>
          ${accountContentMarkup(brief.content)}
        </article>
      </div>
    </section>
  `;
}

function monthlyAccountSplits() {
  const split = {};
  northstarBriefAccounts().forEach((account) => {
    const rows = accountSalesRecords(account, "Current Month");
    split[account.name] = rows.reduce((acc, row) => {
      acc.gmv += toNumber(row.gmv || row.revenue || row.grossRevenue);
      acc.commission += toNumber(row.commission || row.creatorCommission);
      acc.units += toNumber(row.unitsSold || row.sales || row.itemsSold || row.units);
      return acc;
    }, { gmv: 0, commission: 0, units: 0 });
  });
  return split;
}

function monthlyProgressData() {
  const reports = currentMonthReports();
  const validMonthlyVideos = validVideos().filter((video) => /2026-07/.test(video.datePosted || video.postedAt || ""));
  const reportTotals = reports.reduce((acc, report) => {
    acc.gmv += Number(report.gmv || 0);
    acc.commission += Number(report.commission || 0);
    acc.units += Number(report.unitsSold || 0);
    acc.videos += Number(report.videosPosted || 0);
    return acc;
  }, { gmv: 0, commission: 0, units: 0, videos: 0 });
  if (reportTotals.gmv || reportTotals.commission || reportTotals.units || reportTotals.videos) return { ...reportTotals, videos: reportTotals.videos || validMonthlyVideos.length };
  const splits = monthlyAccountSplits();
  const splitTotals = Object.values(splits).reduce((acc, row) => {
    acc.gmv += row.gmv;
    acc.commission += row.commission;
    acc.units += row.units;
    return acc;
  }, { gmv: 0, commission: 0, units: 0 });
  if (splitTotals.gmv || splitTotals.commission || splitTotals.units) return { ...splitTotals, videos: validMonthlyVideos.length || validVideos().length };
  return {
    gmv: products().reduce((sum, product) => sum + Number(product.lifetimeGmv || 0), 0),
    commission: products().reduce((sum, product) => sum + Number(product.lifetimeCommission || 0), 0),
    units: products().reduce((sum, product) => sum + Number(product.lifetimeUnits || 0), 0),
    videos: validMonthlyVideos.length || validVideos().length
  };
}

function northstarScore() {
  const data = monthlyProgressData();
  const highPriority = polarisSamples().filter((sample) => sample.priority === "High" && !["Posted", "Complete"].includes(sample.status)).length;
  const waiting = polarisSamples().filter(sampleRequiresFilming).length;
  const urgent = polarisSamples().filter((sample) => {
    const days = sampleDaysLeft(sample);
    return days !== null && days <= 7 && !["Posted", "Complete"].includes(sample.status);
  }).length;
  const strongProducts = scoredProducts().filter((product) => opportunityScore(product).score >= 78).length;
  const sparks = sparkReportItems().length;
  let score = 40;
  score += Math.min(18, data.videos * 1.5);
  score += Math.min(18, data.gmv / 250);
  score += Math.min(12, data.commission / 40);
  score += Math.min(12, strongProducts * 2);
  score += Math.min(8, highPriority + waiting);
  score += Math.min(7, sparks * 2);
  score -= Math.min(15, urgent * 4);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const message = score >= 85 ? "You're on track for a strong month." : score >= 65 ? "Good momentum, but a few opportunities need attention." : "Too many high-value opportunities are waiting.";
  return { score, message, highPriority, waiting, urgent };
}

function northstarScoreMarkup() {
  const result = northstarScore();
  return `<section class="card northstar-score-card"><div><span class="account-brief-label">Northstar Score</span><strong>${result.score} / 100</strong><p>${result.message}</p></div><div class="score-support"><span>${number.format(result.waiting)} waiting to film</span><span>${number.format(result.highPriority)} high priority</span><span>${number.format(result.urgent)} urgent</span></div></section>`;
}

function monthlyProgressMarkup() {
  const data = monthlyProgressData();
  const projected = monthlyProjection(data);
  const goals = { gmv: 5000, commission: 500, units: 250, videos: 60 };
  const splits = monthlyAccountSplits();
  const splitLine = (key, formatter) => northstarBriefAccounts().map((account) => `${account.name}: ${formatter(splits[account.name]?.[key] || 0)}`).join(" · ");
  return `
    <section class="card monthly-progress-card command-center-hero">
      <div class="monthly-progress-hero-copy">
        <span class="account-brief-label">Monthly Progress</span>
        <h2>${money.format(data.gmv)} <span>Total GMV — All Accounts</span></h2>
        <p>${splitLine("gmv", (value) => money.format(value))}</p>
        <p class="hero-split-line">Commission: ${splitLine("commission", (value) => money.format(value))}</p>
        <p class="hero-split-line">Units: ${splitLine("units", (value) => number.format(value))}</p>
        <p>${monthlyMomentumLine()}</p>
      </div>
      <div class="monthly-progress-grid">
        ${progressMetric("Total GMV — All Accounts", money.format(data.gmv), data.gmv, goals.gmv)}
        ${progressMetric("Commission this month", money.format(data.commission), data.commission, goals.commission)}
        ${progressMetric("Units sold", number.format(data.units), data.units, goals.units)}
        ${progressMetric("Videos posted", number.format(data.videos), data.videos, goals.videos)}
      </div>
      <div class="monthly-projection-row">
        <article><span>Projected month</span><strong>${money.format(projected.gmv)}</strong><small>${money.format(projected.commission)} projected commission</small></article>
        <article><span>Days remaining</span><strong>${number.format(daysRemainingInMonth())}</strong><small>Keep feeding the strongest Signals.</small></article>
      </div>
    </section>
    ${northstarScoreMarkup()}
  `;
}

function executiveSummaryMarkup() {
  const top = topOverallPriority();
  const waiting = polarisSamples().filter(sampleRequiresFilming)[0];
  const raisedSpark = accountSpark(getAccount("raisedRight") || northstarBriefAccounts()[0], accountProducts("raisedRight"), accountVideos(getAccount("raisedRight") || {}), accountSamples(getAccount("raisedRight") || {}));
  const second = waiting ? `Today’s highest-value move is filming ${waiting.productName} before the sample deadline.` : `Today’s highest-value move is ${top.title}.`;
  return `<section class="card executive-summary-card"><strong>Good morning Jennifer.</strong><p>${second} ${raisedSpark}</p></section>`;
}

function actionPotential(action = {}) {
  const product = products().find((item) => item.id === action.productId || normalizedName(item.name) === normalizedName(action.productOrCategory));
  const value = Number(product?.lifetimeCommission || product?.lifetimeGmv || 0);
  if (value >= 500) return "$$$$";
  if (value >= 150) return "$$$";
  if (value > 0) return "$$";
  return "$";
}

function actionTypeLabel(action = {}) {
  if (action.category === "Watch" || action.category === "Test hook" || action.category === "Follow up") return "Monitor";
  return action.category || "Monitor";
}

function compactActionCard(action = {}) {
  return `<article class="compact-action-card"><strong>${Math.round(action.confidence || 0)}%</strong><span>${actionTypeLabel(action)}</span><h4 class="clamp-2" title="${escapeAttr(action.productOrCategory || action.action || "")}">${action.productOrCategory || action.action || "Creator action"}</h4><small>${action.account || "Both"}</small><p class="clamp-2" title="${escapeAttr(action.reason || "")}">${action.reason || "Northstar needs more data for the reason."}</p><div><b>Potential ${actionPotential(action)}</b><em>${action.priority || "Medium"} effort</em></div></article>`;
}

function directionGroupMarkup(title, items) {
  return `<article class="direction-group-card"><span>${title}</span>${items.length ? items.map(compactActionCard).join("") : `<strong>Nothing urgent</strong><small>Northstar is watching for a stronger Signal.</small>`}</article>`;
}

function todayDirectionGroups() {
  const actions = positiveActionPlan();
  const deliveredSample = polarisSamples().find(sampleRequiresFilming);
  const requestSample = polarisSamples().find((sample) => sample.priority === "High" && ["Idea", "Request Now"].includes(sample.status));
  const filmedSample = polarisSamples().find((sample) => sample.status === "Filmed");
  const shippedSample = polarisSamples().find((sample) => ["Requested", "Approved", "Shipped"].includes(sample.status));
  return {
    film: [
      deliveredSample ? { category: "Film", productOrCategory: deliveredSample.productName, account: deliveredSample.account, confidence: deliveredSample.priority === "High" ? 92 : 82, reason: `${deliveredSample.productName} is waiting to be filmed.` } : null,
      actions.find((action) => action.category === "Film")
    ].filter(Boolean).slice(0, 2),
    request: [
      actions.find((action) => action.category === "Request"),
      requestSample ? { category: "Request", productOrCategory: requestSample.productName, account: requestSample.account, confidence: 84, reason: "High-priority sample opportunity." } : null
    ].filter(Boolean).slice(0, 2),
    repost: [
      actions.find((action) => action.category === "Repost"),
      filmedSample ? { category: "Repost", productOrCategory: filmedSample.productName, account: filmedSample.account, confidence: 70, reason: "Filmed sample is ready to move toward posting." } : null
    ].filter(Boolean).slice(0, 2),
    attention: [
      actions.find((action) => ["Test hook", "Follow up", "Watch"].includes(action.category)),
      shippedSample ? { category: "Monitor", productOrCategory: shippedSample.productName, account: shippedSample.account, confidence: 68, reason: "Sample status needs a check." } : null
    ].filter(Boolean).slice(0, 2)
  };
}

function sparkReportItems() {
  const items = [];
  const julySales = (db.salesRecords || []).filter((record) => ["2026-07-03", "2026-07-02", "2026-07-01"].includes(normalizeDateKey(record.date || record.capturedAt || "")));
  const airForce = validVideos().find((video) => /air force one|trump force one/i.test(`${video.productName || ""} ${video.hook || ""}`));
  if (airForce && (Number(airForce.views || 0) >= 100000 || Number(airForce.newFollowers || 0) >= 100)) {
    items.push({ account: "Raised Right", icon: "rocket", text: `Air Force One video generated ${compactNumber(airForce.views || 0)} views and ${number.format(airForce.newFollowers || 0)} followers.`, note: "Unusual audience-growth spike." });
  }
  const smartGlasses = polarisSamples().find((sample) => /smart ai glasses/i.test(sample.productName || ""));
  const smartDays = smartGlasses ? sampleDaysLeft(smartGlasses) : null;
  if (smartGlasses && smartDays !== null && smartDays <= 7) {
    items.push({ account: "Truth Tuned Tribe", icon: "clock", text: `Smart AI Glasses sample expires in ${number.format(smartDays)} days.`, note: "Deadline signal." });
  }
  const peptide = julySales.find((record) => normalizedName(record.account) === normalizedName("Truth Tuned Tribe") && /complete peptide protocols playbook/i.test(record.productName || ""));
  if (peptide && Number(peptide.unitsSold || 0) >= 5) {
    items.push({ account: "Truth Tuned Tribe", icon: "money", text: `Complete Peptide Protocols Playbook sold ${number.format(peptide.unitsSold || 0)} units.`, note: "High-value sales Signal." });
  }
  const garden = categoryIntelligence().find((row) => /garden/i.test(row.category || ""));
  if (garden && Number(garden.gmv || 0) > 0) {
    items.push({ account: "Both", icon: "chart", text: "Garden products are still producing strong sales momentum.", note: `${money.format(garden.gmv || 0)} tracked GMV.` });
  }
  return items.slice(0, 3);
}

function yesterdayLearningsMarkup() {
  const sparks = sparkReportItems();
  return `
    <section class="card spark-report-card yesterday-learnings-card">
      <div class="section-title"><div><h3>Spark Report</h3><p>Unusual, high-value Signals only.</p></div><span class="badge good">${sparks.length} Sparks</span></div>
      ${sparks.length ? `<div class="spark-report-list">${sparks.map((spark) => `<article><span>${sparkIcon(spark.icon)}</span><div><strong><em>${spark.account}</em>: ${spark.text}</strong><small>${spark.note}</small></div></article>`).join("")}</div>` : `<p class="empty">No major Spark detected yet. Northstar is watching for unusual Signals.</p>`}
    </section>
  `;
}

function recommendationGroups() {
  return scoredProducts().reduce((groups, product) => {
    const signal = productSignalCollectionInfo(product);
    const score = opportunityScore(product).score;
    const lifecycle = productLifecycle(product).stage;
    if (signal.isCollecting) groups["SIGNAL COLLECTION"].push(product);
    else if (score >= 78 && lifecycle !== "Cooling") groups["DOUBLE DOWN"].push(product);
    else if (lifecycle === "Cooling" || /hook|angle|refresh/i.test(productNextMove(product))) groups["NEEDS NEW HOOK"].push(product);
    else groups.WATCH.push(product);
    return groups;
  }, { "DOUBLE DOWN": [], WATCH: [], "SIGNAL COLLECTION": [], "NEEDS NEW HOOK": [] });
}

function opportunityGroupsForDisplay() {
  const base = recommendationGroups();
  return {
    "Double Down": (base["DOUBLE DOWN"] || []).filter(opportunityAccountMatches),
    "Watch": (base.WATCH || []).filter(opportunityAccountMatches),
    "Signal Collection": (base["SIGNAL COLLECTION"] || []).filter(opportunityAccountMatches),
    "Needs New Hook": (base["NEEDS NEW HOOK"] || []).filter(opportunityAccountMatches)
  };
}

function opportunityLaneRule(name) {
  if (name === "Double Down") return "High confidence, proven products.";
  if (name === "Signal Collection") return "New enough that more Signals are needed.";
  if (name === "Needs New Hook") return "Keep the product, refresh the angle.";
  return "Monitor before adding more effort.";
}

function buildActionPlan() {
  const statuses = readJson(ACTION_STATUS_KEY, {});
  const todayKey = new Date().toISOString().slice(0, 10);
  const makeFinalAction = (category, action, subject, account, confidence, reason, priority = "Medium", productId = "") => {
    const id = `${todayKey}-${category}-${normalizedName(account)}-${normalizedName(subject)}`.replace(/[^a-z0-9-]/gi, "-");
    const saved = statuses[id] || {};
    return {
      id,
      dateRecommended: todayKey,
      category,
      action: String(action || "").replace(/retire|stop testing/gi, "monitor"),
      account: account || "Both",
      productOrCategory: subject || "Creator business",
      productId,
      confidence: Math.max(35, Math.min(98, Math.round(confidence || 70))),
      priority,
      reason: String(reason || "Northstar is watching this Signal.").replace(/retire|stop testing/gi, "monitor"),
      status: saved.status || "Open",
      dateCompleted: saved.dateCompleted || "",
      resultNotes: saved.resultNotes || ""
    };
  };
  const ranked = scoredProducts();
  const actions = [];
  const waitingSample = polarisSamples().find(sampleRequiresFilming);
  if (waitingSample) actions.push(makeFinalAction(
    "Film",
    `Film ${waitingSample.productName}`,
    waitingSample.productName,
    waitingSample.account,
    waitingSample.priority === "High" ? 92 : 84,
    `${waitingSample.productName} is waiting to be filmed.`,
    waitingSample.priority || "High",
    waitingSample.productId || ""
  ));
  const requestSample = polarisSamples().find((sample) => sample.priority === "High" && ["Idea", "Request Now"].includes(sample.status));
  if (requestSample) actions.push(makeFinalAction(
    "Request",
    `Request sample: ${requestSample.productName}`,
    requestSample.productName,
    requestSample.account,
    88,
    `${requestSample.productName} is a high-priority sample opportunity.`,
    "High",
    requestSample.productId || ""
  ));
  const topProduct = ranked.find((product) => Number(product.lifetimeUnits || 0) > 0) || ranked[0];
  if (topProduct) actions.push(makeFinalAction(
    "Film",
    `Film again: ${shortName(topProduct.name)}`,
    topProduct.name,
    topProduct.account,
    opportunityScore(topProduct).confidence || opportunityScore(topProduct).score,
    productNextMove(topProduct),
    opportunityScore(topProduct).score >= 78 ? "High" : "Medium",
    topProduct.id
  ));
  const evergreen = ranked.find((product) => intelligenceSeason(product) === "Evergreen" && opportunityScore(product).score >= 60);
  if (evergreen) actions.push(makeFinalAction(
    "Repost",
    `Repost or remake: ${shortName(evergreen.name)}`,
    evergreen.name,
    evergreen.account,
    Math.max(62, opportunityScore(evergreen).score - 6),
    `${evergreen.name} has evergreen potential and usable performance Signals.`,
    "Medium",
    evergreen.id
  ));
  const watchProduct = ranked.find((product) => productSignalCollectionInfo(product).isCollecting) || ranked.find((product) => productLifecycle(product).stage === "Cooling");
  if (watchProduct) actions.push(makeFinalAction(
    "Watch",
    `Monitor: ${shortName(watchProduct.name)}`,
    watchProduct.name,
    watchProduct.account,
    68,
    productNextMove(watchProduct),
    "Low",
    watchProduct.id
  ));
  const lesson = latestKnowledgeLesson();
  if (lesson) actions.push(makeFinalAction(
    "Learn",
    `Apply lesson: ${shortName(lesson.title || lesson.lesson)}`,
    lesson.product || lesson.category || "Creator pattern",
    lesson.account || "Both",
    Number(lesson.confidence || 70),
    lesson.lesson || "Carry this learning into the next content decision.",
    "Medium"
  ));
  return actions
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.confidence - a.confidence)
    .slice(0, 18);
}

function decisionLogTable(log) {
  if (!log.length) return `<p class="empty">No decisions yet. Open Action Plan to generate direction Northstar can remember.</p>`;
  return `<div class="table-card decision-table"><table><thead><tr><th>Recommended</th><th>Reason</th><th>Decision</th><th>Outcome</th><th>Result notes</th></tr></thead><tbody>${log.map((item) => `<tr><td><strong>${item.action || item.recommended || ""}</strong><span>${item.dateRecommended || item.date || ""} · ${item.account || ""}</span></td><td><span class="clamp-3" title="${escapeAttr(item.reason || "")}">${String(item.reason || "").replace(/retire|stop testing/gi, "monitor")}</span></td><td><select data-decision-update="${item.id}">${["Open","Snoozed","Complete","Completed","Dismissed","Skipped"].map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></td><td>${decisionQuality(item).label}</td><td><span class="clamp-3">${item.outcomeSalesNotes || item.result || ""}</span></td></tr>`).join("")}</tbody></table></div>`;
}

const northstarFinalProductNextMoveBase = productNextMove;
productNextMove = function productNextMoveWithoutRetire(product) {
  const text = String(northstarFinalProductNextMoveBase(product) || "");
  return text
    .replace(/retire unless/gi, "Pause new videos unless")
    .replace(/retire/gi, "monitor")
    .replace(/stop testing/gi, "pause new videos");
};

const northstarFinalFlywheelScoreBase = flywheelScore;
flywheelScore = function flywheelScoreWithoutRetire(product) {
  const result = northstarFinalFlywheelScoreBase(product);
  if (result && /retire/i.test(result.label || "")) return { ...result, label: "Monitor", tierClass: "watch-score" };
  return result;
};

const northstarFinalProductLifecycleBase = productLifecycle;
productLifecycle = function productLifecycleWithoutRetiredStage(product) {
  const result = northstarFinalProductLifecycleBase(product);
  if (result && /retired/i.test(result.stage || "")) {
    return { ...result, stage: "Cooling", icon: "↓", className: "slowing", reason: "Momentum or timing is cooling." };
  }
  return result;
};

function sanitizeNorthstarLanguage(root = content) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll("h1, h2, h3, h4, p, small, span, strong, button, option, label, td, th").forEach((node) => {
    if (!node.childElementCount) {
      node.textContent = String(node.textContent || "")
        .replace(/Products to Retire/gi, "Products to Watch")
        .replace(/Retired/gi, "Cooling")
        .replace(/Retire/gi, "Monitor")
        .replace(/Stop testing/gi, "Pause new videos")
        .replace(/stop testing/gi, "pause new videos");
    }
  });
}

const northstarFinalRenderPageBase = renderPage;
renderPage = function renderPageWithFinalSafety(pageId) {
  northstarFinalRenderPageBase(pageId);
  sanitizeNorthstarLanguage(content);
};

const northstarPolishRefineMorningBriefBase = refineMorningBriefCommandCenterOrder;
refineMorningBriefCommandCenterOrder = function refineMorningBriefExecutivePolish() {
  northstarPolishRefineMorningBriefBase();
  if (!content.querySelector(".executive-summary-card")) content.insertAdjacentHTML("afterbegin", executiveSummaryMarkup());
  content.querySelectorAll("[data-revenue-range]").forEach((selectEl) => {
    selectEl.addEventListener("change", (event) => {
      revenueSnapshotRange = event.target.value;
      renderExecutive();
    });
  });
  content.querySelectorAll(".brief-section h4, .recommendation-column h3, .detail-actions button, option, .badge, .card p, .card small").forEach((node) => {
    if (/Retire/i.test(node.textContent || "")) node.textContent = node.textContent.replace(/Retire/gi, "Monitor");
    if (/Stop testing/i.test(node.textContent || "")) node.textContent = node.textContent.replace(/Stop testing/gi, "Pause new videos");
  });
  sanitizeNorthstarLanguage(content);
  bindInternalButtons();
};

/* Northstar UX cleanup + lifecycle simplification: compact, clickable, single-source product flow. */
const NORTHSTAR_LIFECYCLE_PATH = ["Requested", "Approved", "Shipped", "Delivered", "Waiting to Film", "Filmed", "Posted", "Sales Evaluation", "Hook Testing"];
let productLifecycleSearch = "";
let videoSortMode = "Newest";

function cleanStatus(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function sampleProductId(sample = {}) {
  const product = productForSample(sample);
  return product?.id || sample.productId || sample.relatedProductId || "";
}

function sampleSearchText(sample = {}) {
  const product = productForSample(sample);
  return normalizedName([
    sample.productName,
    sample.account,
    sample.category,
    sample.status,
    product?.name,
    product?.category,
    product?.categoryGroup
  ].join(" "));
}

function productSearchText(product = {}) {
  return normalizedName([product.name, product.account, product.category, product.categoryGroup, product.status, intelligenceSeason(product)].join(" "));
}

function productVideoCandidates(product = {}) {
  return new Set([
    product.id,
    product.productId,
    product.relatedProductId,
    product.externalProductId,
    product.tiktokProductId,
    product.sourceProductId,
    product.historicalMetrics?.productId,
    ...productImageIds(product)
  ].filter(Boolean).map((value) => String(value).trim()));
}

function videoProductCandidates(video = {}) {
  return new Set([
    video.productId,
    video.relatedProductId,
    video.externalProductId,
    video.tiktokProductId,
    video.sourceProductId,
    video.historicalMetrics?.productId
  ].filter(Boolean).map((value) => String(value).trim()));
}

function productVideosForProduct(product = {}) {
  const productIds = productVideoCandidates(product);
  const productName = normalizedName(product.name || product.productName || "");
  return validVideos().filter((video) => {
    const videoIds = videoProductCandidates(video);
    if ([...videoIds].some((id) => productIds.has(id))) return true;
    const videoName = normalizedName(video.productName || video.product || video.topic || video.title || "");
    return productName && videoName && (videoName === productName || (productName.length > 12 && videoName.includes(productName)) || (videoName.length > 12 && productName.includes(videoName)));
  });
}

productVideos = function productVideosByIdOrName(productId) {
  const product = getProduct(productId) || products().find((item) => productVideoCandidates(item).has(String(productId || "").trim()));
  if (!product) return validVideos().filter((video) => video.productId === productId);
  return productVideosForProduct(product);
};

function videoTitle(video = {}) {
  return video.hook || video.title || video.caption || video.productName || "Video";
}

function videoCoverUrl(video = {}) {
  return video.coverImage || video.thumbnail || video.videoThumbnail || video.imageUrl || productImageUrl(video);
}

function videoCoverMarkup(video = {}) {
  const src = videoCoverUrl(video);
  if (src) return `<img class="video-cover-thumb" src="${escapeAttr(src)}" alt="${escapeAttr(videoTitle(video))}" loading="lazy">`;
  return `<div class="video-cover-thumb video-cover-placeholder" aria-hidden="true">▶</div>`;
}

function videoLink(video = {}) {
  return video.videoUrl || video.videoLink || video.url || video.permalink || "";
}

function saveRate(video = {}) {
  return Number(video.views || 0) ? Number(video.saves || 0) / Number(video.views || 0) : 0;
}

function sortVideosForDisplay(rows = []) {
  const list = rows.slice();
  const dateValue = (video) => new Date(video.datePosted || video.postedAt || video.date || 0).getTime() || 0;
  const numeric = (field) => (a, b) => Number(b[field] || 0) - Number(a[field] || 0);
  const sorters = {
    "Views high to low": numeric("views"),
    "GMV high to low": numeric("gmv"),
    "Commission high to low": numeric("commission"),
    "Sales high to low": numeric("sales"),
    "Watch time high to low": numeric("averageWatchTime"),
    "Save rate high to low": (a, b) => saveRate(b) - saveRate(a),
    "Shares high to low": numeric("shares"),
    Newest: (a, b) => dateValue(b) - dateValue(a),
    Oldest: (a, b) => dateValue(a) - dateValue(b)
  };
  return list.sort(sorters[videoSortMode] || sorters.Newest);
}

const northstarUxFilteredVideosBase = filteredVideos;
filteredVideos = function filteredVideosSortedAndCleaned() {
  return sortVideosForDisplay(northstarUxFilteredVideosBase().filter((video) => !isPlaceholderVideo(video)));
};

videoRows = function videoRowsWithCovers(list) {
  return list.map((video) => {
    const signal = signalCollectionInfo(video);
    const hookText = videoTitle(video);
    return `<tr class="click-row" data-video-id="${video.id || ""}"><td>${videoCoverMarkup(video)}</td><td>${compactDate(video.datePosted || video.postedAt || "")}${video.timePosted ? `<span>${video.timePosted}</span>` : ""}</td><td>${video.account || ""}</td><td><span class="clamp-2" title="${escapeAttr(video.productName || "")}">${video.productName || ""}</span>${signalCollectionBadgeForInfo(signal)}</td><td><strong class="clamp-2" title="${escapeAttr(hookText)}">${hookText}</strong>${video.cta ? `<span class="clamp-1" title="${escapeAttr(video.cta)}">${video.cta}</span>` : ""}</td><td>${compactNumber(video.views || 0)}</td><td><span class="clamp-2">${compactNumber(video.likes || 0)} likes · ${compactNumber(video.saves || 0)} saves · ${compactNumber(video.shares || 0)} shares</span></td><td>${Number(video.averageWatchTime || 0).toFixed(1)}s</td><td>${number.format(video.sales || 0)}</td><td class="numeric-nowrap">${money.format(video.gmv || 0)}</td><td class="numeric-nowrap commission-cell">${money.format(video.commission || 0)}</td></tr>`;
  }).join("") || `<tr><td colspan="11">No videos yet.</td></tr>`;
};

renderVideosDatabase = function renderVideosDatabaseWithSorting() {
  normalizeVideoDatabase();
  const rows = filteredVideos();
  const diagnostics = videoDiagnostics(rows);
  const videoList = validVideos();
  content.innerHTML = `
    <div class="section-title">
      <div><h3>Videos</h3><p>Every row is rendered from Polaris video records.</p></div>
      <div class="video-count-badges">
        <span class="badge">${rows.length} displayed</span>
        <span class="badge good">Raised Right: ${diagnostics.accountCounts.raisedRight}</span>
        <span class="badge good">Truth Tuned Tribe: ${diagnostics.accountCounts.truthTunedTribe}</span>
      </div>
    </div>
    <details class="form-panel"><summary>Add Video</summary>${videoForm()}</details>
    <div class="filter-bar video-filter-bar">
      <input id="videoSearch" type="search" placeholder="Search videos, hooks, CTA..." value="${escapeAttr(videoFilters.search)}">
      ${select("videoSort", ["Views high to low", "GMV high to low", "Commission high to low", "Sales high to low", "Watch time high to low", "Save rate high to low", "Shares high to low", "Newest", "Oldest"], videoSortMode)}
      ${select("videoAccount", ["All", ...accounts().map((a) => a.name)], videoFilters.account)}
      ${select("videoProduct", ["All", ...unique(videoList.map((v) => v.productName))], videoFilters.product)}
      ${select("videoCategory", ["All", ...unique(videoList.map((v) => v.category))], videoFilters.category)}
      ${select("videoHookType", ["All", ...unique(videoList.map((v) => v.hookType))], videoFilters.hookType)}
      <label class="check"><input id="salesOnly" type="checkbox" ${videoFilters.salesOnly ? "checked" : ""}> Sales &gt; 0</label>
      <label class="check"><input id="highSaves" type="checkbox" ${videoFilters.highSaves ? "checked" : ""}> High saves</label>
      <label class="check"><input id="highShares" type="checkbox" ${videoFilters.highShares ? "checked" : ""}> High shares</label>
      <button class="ghost-button" id="clearVideoFilters" type="button">Show All Videos</button>
    </div>
    ${videoDiagnosticsPanel(diagnostics)}
    <div class="table-card database-table videos-table"><table><colgroup><col class="video-cover-col"><col class="video-date-col"><col class="video-account-col"><col class="video-product-col"><col class="video-hook-col"><col class="video-views-col"><col class="video-engagement-col"><col class="video-watch-col"><col class="video-sales-col"><col class="video-gmv-col"><col class="video-commission-col"></colgroup><thead><tr><th>Cover</th><th>Date</th><th>Account</th><th>Product</th><th>Hook</th><th>Views</th><th>Engagement</th><th>Watch</th><th>Sales</th><th>GMV</th><th>Comm.</th></tr></thead><tbody>${videoRows(rows)}</tbody></table></div>
  `;
  document.querySelector("#addVideoForm")?.addEventListener("submit", handleAddVideo);
  bindVideoFilters();
  document.querySelector("#videoSort")?.addEventListener("change", (event) => {
    videoSortMode = event.target.value;
    renderVideosDatabase();
  });
  document.querySelector("#clearVideoFilters")?.addEventListener("click", () => {
    videoFilters = { search: "", account: "All", product: "All", category: "All", hookType: "All", salesOnly: false, highSaves: false, highShares: false };
    videoSortMode = "Newest";
    renderVideosDatabase();
  });
  bindProductCommandCenterControls({});
};

function productLifecycleTabs() {
  return NORTHSTAR_LIFECYCLE_PATH;
}

function lifecycleRowsForStage(stage) {
  if (["Requested", "Approved", "Shipped", "Delivered"].includes(stage)) {
    return polarisSamples().filter((sample) => normalizeSampleStatus(sample.status) === stage || cleanStatus(sample.status) === cleanStatus(stage));
  }
  if (stage === "Waiting to Film") return polarisSamples().filter(sampleRequiresFilming);
  if (stage === "Filmed") return polarisSamples().filter((sample) => normalizeSampleStatus(sample.status) === "Filmed");
  if (stage === "Posted") return polarisSamples().filter((sample) => normalizeSampleStatus(sample.status) === "Posted");
  if (stage === "Sales Evaluation") return scoredProducts().filter((product) => Number(product.lifetimeGmv || 0) > 0 || Number(product.lifetimeUnits || 0) > 0);
  if (stage === "Hook Testing") return scoredProducts().filter((product) => productVideos(product.id).length || productHooks(product).length || /hook|angle|test/i.test(productNextMove(product)));
  return [];
}

function productLifecycleRows(tab) {
  const query = normalizedName(productLifecycleSearch);
  const rows = lifecycleRowsForStage(tab);
  if (!query) return rows;
  return rows.filter((row) => row.productName ? sampleSearchText(row).includes(query) : productSearchText(row).includes(query));
}

function productLifecycleTable(tab, rows) {
  if (tab === "Sales Evaluation" || tab === "Hook Testing") {
    return `<div class="table-card database-table product-lifecycle-table"><table><colgroup><col class="product-image-col"><col class="product-name-col"><col class="product-account-col"><col class="product-category-col"><col class="product-money-col"><col class="product-money-col"><col class="product-units-col"><col class="product-direction-col"></colgroup><thead><tr><th>Image</th><th>Product</th><th>Account</th><th>Category</th><th>GMV</th><th>Comm.</th><th>Units</th><th>Next Direction</th></tr></thead><tbody>${rows.map((product) => `<tr class="click-row" data-product-id="${product.id}"><td>${productImageMarkup(product)}</td><td><strong class="clamp-2 product-name-cell" title="${escapeAttr(product.name || "")}">${product.name}</strong><span>${opportunityPill(product)} ${lifecycleBadge(product)}</span></td><td>${product.account || ""}</td><td><span class="clamp-2" title="${escapeAttr(product.categoryGroup || product.category || "")}">${product.categoryGroup || product.category || ""}</span></td><td>${money.format(product.lifetimeGmv || 0)}</td><td class="numeric-nowrap">${money.format(product.lifetimeCommission || 0)}</td><td>${number.format(product.lifetimeUnits || 0)}</td><td><span class="clamp-2 next-direction-cell" title="${escapeAttr(productNextMove(product))}">${productNextMove(product)}</span></td></tr>`).join("") || `<tr><td colspan="8">No product records match this lifecycle stage yet.</td></tr>`}</tbody></table></div>`;
  }
  return `<div class="product-sample-grid compact-request-grid-wrap lifecycle-card-grid">${rows.map(productSampleLifecycleCard).join("") || `<div class="card empty">No ${tab.toLowerCase()} records yet.</div>`}</div>`;
}

renderProductsDatabase = function renderProductsWithSimpleLifecycle() {
  if (!productLifecycleTabs().includes(productLifecycleTab)) productLifecycleTab = "Waiting to Film";
  const rows = productLifecycleRows(productLifecycleTab);
  const waitingCount = polarisSamples().filter(sampleRequiresFilming).length;
  content.innerHTML = `
    <div class="section-title">
      <div><h3>Products</h3><p>One lifecycle from request through sales and hook testing.</p></div>
      <div class="video-count-badges"><span class="badge good">${number.format(waitingCount)} waiting to film</span><span class="badge">${number.format(rows.length)} ${productLifecycleTab}</span></div>
    </div>
    <div class="filter-bar product-search-bar">
      <input id="productLifecycleSearch" type="search" placeholder="Search products, account, category, status..." value="${escapeAttr(productLifecycleSearch)}">
    </div>
    <nav class="product-lifecycle-tabs simplified-lifecycle-tabs" aria-label="Product lifecycle tabs">
      ${productLifecycleTabs().map((tab) => `<button type="button" class="${productLifecycleTab === tab ? "active" : ""}" data-product-lifecycle-tab="${tab}">${tab}</button>`).join("")}
    </nav>
    <details class="form-panel"><summary>Add Product</summary>${productForm()}</details>
    ${productLifecycleTable(productLifecycleTab, rows)}
  `;
  document.querySelectorAll("[data-product-lifecycle-tab]").forEach((button) => button.addEventListener("click", () => {
    productLifecycleTab = button.dataset.productLifecycleTab;
    renderProductsDatabase();
  }));
  document.querySelector("#productLifecycleSearch")?.addEventListener("input", (event) => {
    productLifecycleSearch = event.target.value;
    renderProductsDatabase();
  });
  document.querySelector("#addProductForm")?.addEventListener("submit", handleAddProduct);
  document.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", () => openProduct(row.dataset.productId)));
  bindLifecycleCardClicks();
  bindCompactRequestButtons();
};

productSampleLifecycleCard = function productSampleLifecycleCardCommandCard(sample) {
  const product = productForSample(sample);
  const id = sampleProductId(sample);
  const imageSource = { ...product, ...sample };
  const daysLeft = sampleDaysLeft(sample);
  const related = product ? productVideos(product.id).length : 0;
  const gmv = Number(product?.lifetimeGmv || sample.gmv || sample.estimatedGMV || 0);
  const commission = Number(product?.lifetimeCommission || sample.commission || sample.estimatedCommission || 0);
  const units = Number(product?.lifetimeUnits || sample.units || sample.unitsSold || 0);
  const nextAction = sampleRequiresFilming(sample) ? "Film Content" : ["Idea", "Request Now"].includes(sample.status) ? "Request Now" : "Update Status";
  return `
    <article class="sample-card polaris-sample-card product-sample-card compact-request-card lifecycle-sample-card ${id ? "clickable" : ""}" ${id ? `data-sample-product-id="${id}"` : ""}>
      <div class="compact-request-media">${productImageMarkup(imageSource, sample.productName)}</div>
      <div class="compact-request-body">
        <div class="compact-request-head">
          <span class="badge">${sample.status || "Requested"}</span>
          <strong><small>Demand</small>${requestDemand(sample)}</strong>
        </div>
        <h4 class="clamp-2" title="${escapeAttr(sample.productName || "")}">${sample.productName || "Product"}</h4>
        <div class="compact-request-grid">
          <div><span>Account</span><strong>${sample.account || product?.account || "Both"}</strong></div>
          <div><span>Days left</span><strong>${daysLeft === null ? "Not set" : number.format(daysLeft)}</strong></div>
          <div><span>GMV</span><strong>${money.format(gmv)}</strong></div>
          <div><span>Comm.</span><strong>${money.format(commission)}</strong></div>
          <div><span>Units</span><strong>${number.format(units)}</strong></div>
          <div><span>Videos</span><strong>${number.format(related)}</strong></div>
        </div>
        <div class="compact-request-actions">
          <button class="icon-button compact-request-button" type="button" data-request-sample="${sample.id}">${nextAction}</button>
          ${id ? `<button class="ghost-button" type="button" data-product-id="${id}">Hook Generator</button>` : ""}
        </div>
      </div>
    </article>
  `;
};

function bindLifecycleCardClicks() {
  document.querySelectorAll("[data-sample-product-id]").forEach((card) => card.addEventListener("click", (event) => {
    if (event.target.closest("button, select, input, a")) return;
    openProduct(card.dataset.sampleProductId);
  }));
  document.querySelectorAll(".product-sample-card [data-product-id]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openProduct(button.dataset.productId);
  }));
  bindSampleDeleteControls();
}

function accountSampleInventoryMarkup(summary) {
  const waitingList = Array.isArray(summary?.waitingToFilm) ? summary.waitingToFilm : (summary?.waitingSamples || polarisSamples().filter(sampleRequiresFilming));
  const waiting = waitingList.slice(0, 3);
  return `
    <div class="account-sample-list compact-account-samples single-sample-inventory">
      <article><span>Waiting to Film</span><strong>${number.format(waitingList.length || 0)}</strong></article>
      ${waiting.map((sample) => {
        const id = sampleProductId(sample);
        return `<button class="inventory-product-link" type="button" ${id ? `data-product-id="${id}"` : ""}>${productImageMarkup({ ...productForSample(sample), ...sample }, sample.productName)}<span class="clamp-2">${sample.productName}</span></button>`;
      }).join("") || `<small>No samples waiting right now.</small>`}
    </div>
  `;
}

function northstarScoreMarkup() {
  const result = northstarScore();
  return `<section class="card northstar-score-card"><div><span class="account-brief-label">Northstar Score</span><strong>${result.score} / 100</strong><p>${result.message}</p></div><div class="score-support"><span>${number.format(result.waiting)} waiting to film</span><span>${number.format(result.urgent)} urgent</span></div></section>`;
}

function executiveSummaryMarkup() {
  const actions = buildActionPlan();
  const film = actions.find((action) => action.category === "Film") || actions[0];
  const watch = actions.find((action) => /watch|monitor|test/i.test(action.category || action.action || "")) || actions[1];
  const sample = polarisSamples().filter(sampleRequiresFilming).sort((a, b) => (sampleDaysLeft(a) ?? 999) - (sampleDaysLeft(b) ?? 999))[0];
  const topSale = (db.salesRecords || []).slice().sort((a, b) => toNumber(b.gmv || b.revenue) - toNumber(a.gmv || a.revenue))[0];
  return `
    <section class="card executive-summary-card executive-bullet-card">
      <strong>Good morning Jennifer.</strong>
      <ul class="executive-bullet-list">
        <li><span>Film today:</span><b>${film?.productOrCategory || film?.action || "Open Action Plan"}</b></li>
        <li><span>Watch:</span><b>${watch?.productOrCategory || "Northstar is watching for a stronger Signal."}</b></li>
        <li><span>Sample deadline:</span><b>${sample ? `${sample.productName} ${sampleDaysLeft(sample) !== null ? `(${number.format(sampleDaysLeft(sample))} days left)` : ""}` : "No urgent deadline loaded."}</b></li>
        <li><span>Sales signal:</span><b>${topSale ? `${topSale.account || "Both"}: ${topSale.productName || "Top product"} at ${money.format(toNumber(topSale.gmv || topSale.revenue))}` : "No sales Signal loaded yet."}</b></li>
      </ul>
    </section>
  `;
}

function todayDirectionListMarkup() {
  const rows = buildActionPlan().slice(0, 7);
  return `
    <section class="card todays-direction-card direction-list-card">
      <div class="section-title"><div><h3>Today’s Direction</h3><p>Simple next moves from current Polaris data.</p></div></div>
      <div class="direction-list-table"><table><thead><tr><th>Priority</th><th>Account</th><th>Product</th><th>Action</th><th>Why</th><th>Due</th></tr></thead><tbody>${rows.map((action) => {
        const sample = polarisSamples().find((item) => normalizedName(item.productName) === normalizedName(action.productOrCategory));
        const days = sample ? sampleDaysLeft(sample) : null;
        return `<tr><td><span class="badge ${priorityClass(action.priority)}">${action.priority || "Medium"}</span></td><td>${action.account || "Both"}</td><td><span class="clamp-2" title="${escapeAttr(action.productOrCategory || "")}">${action.productOrCategory || "Creator business"}</span></td><td>${actionTypeLabel(action)}</td><td><span class="clamp-2" title="${escapeAttr(action.reason || "")}">${action.reason || "Northstar is watching this Signal."}</span></td><td>${days === null ? "Not set" : `${number.format(days)} days`}</td></tr>`;
      }).join("") || `<tr><td colspan="6">Northstar needs more creator data before creating reliable direction.</td></tr>`}</tbody></table></div>
    </section>
  `;
}

const northstarUxRefineMorningBriefBase = refineMorningBriefCommandCenterOrder;
refineMorningBriefCommandCenterOrder = function refineMorningBriefUxCleanup() {
  try {
    northstarUxRefineMorningBriefBase();
    const direction = content.querySelector(".todays-direction-card");
    if (direction) direction.outerHTML = todayDirectionListMarkup();
    content.querySelectorAll(".inventory-product-link[data-product-id]").forEach((button) => button.addEventListener("click", () => openProduct(button.dataset.productId)));
    bindLifecycleCardClicks();
    sanitizeNorthstarLanguage(content);
  } catch (error) {
    recordNorthstarStartupDiagnostic("morning brief refinement skipped", error);
    console.warn("Northstar skipped a Morning Brief refinement safely.", error);
  }
};

function productLifecycleTrackerMarkup(product, relatedVideos) {
  const productSamples = polarisSamples().filter((sample) => sampleProductId(sample) === product.id || normalizedName(sample.productName) === normalizedName(product.name));
  const currentStatuses = new Set(productSamples.map((sample) => normalizeSampleStatus(sample.status)));
  if (productSamples.some(sampleRequiresFilming)) currentStatuses.add("Waiting to Film");
  if (relatedVideos.length) currentStatuses.add("Posted");
  if (Number(product.lifetimeGmv || 0) || Number(product.lifetimeUnits || 0)) currentStatuses.add("Sales Evaluation");
  if (productHooks(product).length || relatedVideos.length) currentStatuses.add("Hook Testing");
  return `
    <section class="card lifecycle-tracker-card">
      <div class="section-title"><div><h3>Lifecycle</h3><p>Requested through hook testing.</p></div></div>
      <div class="lifecycle-tracker">${NORTHSTAR_LIFECYCLE_PATH.map((stage) => `<button type="button" class="${currentStatuses.has(stage) ? "active" : ""}" data-lifecycle-jump="${stage}"><span></span>${stage}</button>`).join("")}</div>
    </section>
  `;
}

function productNotesMarkup(product, bestVideo) {
  return `
    <section class="card product-notes-card">
      <div class="section-title"><div><h3>Product Notes</h3><p>Compact working notes for the next video.</p></div></div>
      <form id="productNotesForm" class="product-notes-grid">
        <label>Best hook<input name="bestHook" value="${escapeAttr(product.bestHook || bestVideo?.hook || "")}" placeholder="Best hook"></label>
        <label>Best CTA<input name="bestCta" value="${escapeAttr(product.bestCta || "")}" placeholder="Best CTA"></label>
        <label>What worked<textarea name="whatWorked" rows="2">${product.whatWorked || ""}</textarea></label>
        <label>What to test next<textarea name="whatToTestNext" rows="2">${product.whatToTestNext || productNextMove(product) || ""}</textarea></label>
        <label class="wide">Notes<textarea name="notes" rows="3">${product.notes || ""}</textarea></label>
        <button class="icon-button" type="submit">Save Product Notes</button>
      </form>
    </section>
  `;
}

function bestVideoMarkup(video) {
  if (!video) return `<section class="card best-video-card"><h3>Best Performing Video</h3><p class="empty">No related videos yet.</p></section>`;
  const ctr = Number(video.views || 0) ? Number(video.sales || 0) / Number(video.views || 0) * 100 : 0;
  const rate = saveRate(video) * 100;
  const link = videoLink(video);
  return `
    <section class="card best-video-card">
      <div class="section-title"><div><h3>Best Performing Video</h3><p>Benchmark every future hook against this.</p></div><span class="badge good">${videoPerformanceStatus(video)}</span></div>
      <div class="best-video-layout">
        <div class="best-video-cover">${videoCoverMarkup(video)}</div>
        <div class="best-video-copy">
          <strong class="clamp-2" title="${escapeAttr(videoTitle(video))}">${videoTitle(video)}</strong>
          <div class="best-video-stats">
            ${metric("Views", number.format(video.views || 0), "Reach", "")}
            ${metric("GMV", money.format(video.gmv || 0), "Revenue", "")}
            ${metric("Commission", money.format(video.commission || 0), "Earnings", "")}
            ${metric("Sales", number.format(video.sales || 0), "Units", "")}
            ${metric("Watch Time", `${Number(video.averageWatchTime || 0).toFixed(1)}s`, "Average", "")}
            ${metric("Save Rate", `${rate.toFixed(2)}%`, `${number.format(video.saves || 0)} saves`, "")}
            ${metric("Shares", number.format(video.shares || 0), "Distribution", "")}
            ${metric("Followers", number.format(video.newFollowers || video.followersGained || 0), "Gained", "")}
          </div>
          <div class="best-video-actions">
            <button class="ghost-button" type="button" data-video-id="${video.id || ""}">Open Video</button>
            ${link ? `<a class="ghost-button" href="${escapeAttr(link)}" target="_blank" rel="noreferrer">Video Link</a>` : ""}
          </div>
        </div>
      </div>
    </section>
  `;
}

function compactRelatedVideosTable(relatedVideos) {
  const rows = relatedVideos.slice().sort((a, b) => new Date(b.datePosted || b.postedAt || 0) - new Date(a.datePosted || a.postedAt || 0));
  return `
    <section class="card related-videos-card">
      <div class="section-title"><div><h3>Related Videos</h3><p>${number.format(rows.length)} videos connected by product ID or product name. More videos may appear after TikTok sync/import.</p></div></div>
      <div class="table-card compact-video-table"><table><colgroup><col class="related-cover-col"><col class="related-date-col"><col class="related-hook-col"><col class="related-views-col"><col class="related-sales-col"><col class="related-gmv-col"><col class="related-comm-col"></colgroup><thead><tr><th>Cover</th><th>Date</th><th>Hook</th><th>Views</th><th>Sales</th><th>GMV</th><th>Comm.</th></tr></thead><tbody>
        ${rows.map((video) => `<tr class="click-row" data-video-id="${video.id}"><td>${videoCoverMarkup(video)}</td><td>${compactDate(video.datePosted || video.postedAt)}</td><td><strong class="clamp-2" title="${escapeAttr(videoTitle(video))}">${videoTitle(video)}</strong></td><td>${compactNumber(video.views || 0)}</td><td>${number.format(video.sales || 0)}</td><td>${money.format(video.gmv || 0)}</td><td class="numeric-nowrap">${money.format(video.commission || 0)}</td></tr>`).join("") || `<tr><td colspan="7">No related videos yet. More videos may appear after TikTok sync/import.</td></tr>`}
      </tbody></table></div>
    </section>
  `;
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const opportunity = opportunityScore(product);
  const lifecycle = productLifecycle(product);
  const signal = productSignalCollectionInfo(product);
  const relatedVideos = productVideos(product.id);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).sort((a, b) => opportunityScore(b).score - opportunityScore(a).score).slice(0, 6);
  const bestVideo = bestPerformingVideo(relatedVideos);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back to Products</button>
    <div class="detail-header intelligence-detail product-detail-command-header">
      <div class="product-detail-title-wrap">
        <div class="product-detail-hero-image">${productImageMarkup(product)}</div>
        <div><span class="badge ${statusClass(product.status)}">${product.status === "Retire" ? "Cooling" : product.status}</span><h3 class="clamp-2" title="${escapeAttr(product.name || "")}">${product.name}</h3><p>${product.account} · ${product.category} · ${intelligenceSeason(product)}</p><p class="detail-video-count">Videos created: ${number.format(relatedVideos.length)}</p>${signalCollectionBadgeForInfo(signal)}</div>
      </div>
      <div class="score-badge ${opportunity.tierClass}"><strong>${signal.isCollecting ? "New" : opportunity.score}</strong><span>${signal.isCollecting ? "Signal Collection" : "Opportunity"}</span></div>
      <div class="detail-actions">
        <button class="icon-button" id="addNoteButton">Add Note</button>
        <button class="icon-button" id="addVideoButton">Add Video</button>
        ${["Double Down", "Watch", "Wait", "Cooling"].map((status) => `<button class="icon-button" data-status="${status}">Mark as ${status}</button>`).join("")}
      </div>
    </div>
    ${productSummaryMarkup(product, relatedVideos)}
    ${signal.isCollecting ? `<section class="card signal-collection-card"><h3>Signal Collection</h3><p>${signalCollectionNote()}</p><div class="grid two">${metric("Days since posted", number.format(signal.daysSince), "Lifecycle: New", "")}${metric("Days remaining", number.format(signal.daysRemaining), "Before evaluation", "")}</div></section>` : ""}
    ${productLifecycleTrackerMarkup(product, relatedVideos)}
    <section class="card product-intelligence-card">
      <div class="section-title"><div><h3>Product Intelligence</h3><p>${lifecycle.reason}</p></div>${opportunityPill(product)}</div>
      <div class="grid four">
        ${metric("Lifecycle", `${lifecycle.icon} ${lifecycle.stage}`, lifecycle.reason, "")}
        ${metric("Season", intelligenceSeason(product), "Manual edits save locally.", "")}
        ${metric("Videos Created", number.format(relatedVideos.length), "Connected videos", "")}
        ${metric("Double Down", !signal.isCollecting && opportunity.score >= 78 ? "Yes" : "Not yet", productNextMove(product), "")}
      </div>
      <label class="season-editor">Manual season ${select("productSeasonSelect", ["Spring", "Summer", "Back to School", "Halloween", "Holiday", "Winter", "Evergreen", "Seasonal"], intelligenceSeason(product))}</label>
    </section>
    ${productIntelligenceSummaryMarkup(product, relatedVideos)}
    ${productNotesMarkup(product, bestVideo)}
    ${bestVideoMarkup(bestVideo)}
    ${compactRelatedVideosTable(relatedVideos)}
    ${hookGeneratorMarkup(product)}
    ${hookHistoryMarkup(product, relatedVideos)}
    ${videoHistoryMarkup(relatedVideos)}
    <section class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></section>
  `;
  bindInternalButtons();
  bindHookGeneratorControls(product);
  bindProductCommandCenterControls(product);
  document.querySelectorAll("[data-lifecycle-jump]").forEach((button) => button.addEventListener("click", () => {
    productLifecycleTab = button.dataset.lifecycleJump;
    renderPage("products");
  }));
  document.querySelector("#productSeasonSelect")?.addEventListener("change", (event) => { setProductSeason(product.id, event.target.value); renderProductDetail(product.id); });
  document.querySelector("#productNotesForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    product.bestHook = form.get("bestHook") || "";
    product.bestCta = form.get("bestCta") || "";
    product.whatWorked = form.get("whatWorked") || "";
    product.whatToTestNext = form.get("whatToTestNext") || "";
    product.notes = form.get("notes") || "";
    saveData(`Product notes saved for ${product.name}`);
    renderProductDetail(product.id);
  });
  document.querySelector("#addNoteButton")?.addEventListener("click", () => {
    const note = prompt("Add a strategy note for this product:");
    if (note) {
      product.notes = [product.notes, `${new Date().toLocaleDateString()}: ${note}`].filter(Boolean).join("\n");
      product.strategyNotes = note;
      saveData(`Note saved for ${product.name}`);
      renderProductDetail(product.id);
    }
  });
  document.querySelector("#addVideoButton")?.addEventListener("click", () => { videoFilters.product = product.name; renderPage("videos"); });
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
    product.status = button.dataset.status;
    saveData(`${product.name} marked as ${product.status}`);
    renderProductDetail(product.id);
  }));
};

const northstarUxRenderExecutiveBase = renderExecutive;
renderExecutive = function renderExecutiveSafely() {
  try {
    northstarUxRenderExecutiveBase();
  } catch (error) {
    recordNorthstarStartupDiagnostic("morning brief render failed", error);
    console.error("Northstar Morning Brief failed safely.", error);
    renderNorthstarRecoveryPage("executive", error);
  }
};

const northstarUxRenderNavBase = renderNav;
renderNav = function renderNavWithoutDecisionLog() {
  try {
    northstarUxRenderNavBase();
    nav.querySelectorAll('[data-page="decisionLog"]').forEach((button) => button.remove());
  } catch (error) {
    recordNorthstarStartupDiagnostic("navigation fallback rendered", error);
    nav.innerHTML = `
      <button class="active" data-page="executive">Morning Brief</button>
      <button data-page="products">Products</button>
      <button data-page="videos">Videos</button>
      <button data-page="settings">Settings</button>
    `;
  }
};

const northstarUxRenderPageBase = renderPage;
renderPage = function renderPageUxCleanup(pageId) {
  try {
    if (pageId === "decisionLog") pageId = "actionPlan";
    northstarUxRenderPageBase(pageId);
    document.querySelectorAll("[data-page='decisionLog']").forEach((button) => button.remove());
    content.querySelectorAll(".section-title").forEach((title) => {
      if (/Action Categories/i.test(title.textContent || "")) title.closest("section, .card")?.remove();
    });
    sanitizeNorthstarLanguage(content);
    bindLifecycleCardClicks();
  } catch (error) {
    recordNorthstarStartupDiagnostic(`render failed for ${pageId || "unknown page"}`, error);
    console.error("Northstar page render failed safely.", error);
    renderNorthstarRecoveryPage(pageId, error);
  }
};

function renderNorthstarRecoveryPage(pageId, error) {
  try {
    activePage = pageId === "decisionLog" ? "actionPlan" : (pageId || "executive");
    renderNav();
    const productCount = Array.isArray(db?.products) ? db.products.length : 0;
    const videoCount = Array.isArray(db?.videos) ? validVideos().length : 0;
    const sampleCount = Array.isArray(db?.samples) ? db.samples.length : 0;
    const salesCount = Array.isArray(db?.salesRecords) ? db.salesRecords.length : 0;
    pageTitle.textContent = "Northstar Recovery";
    content.innerHTML = `
      <section class="card startup-error recovery-card">
        <div class="section-title">
          <div>
            <h3>Northstar caught a loading issue</h3>
            <p>Your local data was not cleared. Use the buttons below while the broken section is isolated.</p>
          </div>
        </div>
        <div class="grid four">
          ${metric("Products", number.format(productCount), "Loaded safely", "")}
          ${metric("Videos", number.format(videoCount), "Loaded safely", "")}
          ${metric("Samples", number.format(sampleCount), "Loaded safely", "")}
          ${metric("Sales records", number.format(salesCount), "Loaded safely", "")}
        </div>
        <p class="error-copy">${escapeHtml(error?.message || "A page section failed to render.")}</p>
        <div class="button-row">
          <button class="icon-button" data-page="executive">Retry Morning Brief</button>
          <button class="ghost-button" data-page="products">Open Products</button>
          <button class="ghost-button" data-page="videos">Open Videos</button>
          <button class="ghost-button" data-page="settings">Open Settings</button>
        </div>
      </section>
    `;
    bindInternalButtons();
  } catch (fallbackError) {
    console.error("Northstar recovery view failed.", fallbackError);
    content.innerHTML = `<section class="card startup-error"><h3>Northstar could not render this page.</h3><p>Your data is still stored locally. Refresh the browser and open Settings to export a backup.</p></section>`;
  }
}

/* Morning Brief cleanup Round 1: concise 6 AM briefing without changing stored data. */
const NORTHSTAR_MONTHLY_VIDEO_GOAL = 32;
let northstarBriefRevenueRanges = {};
let generatedScriptIdeasByProduct = {};

function briefAccountKey(account) {
  return typeof account === "string" ? account : (account?.name || account?.id || "Both");
}

function briefAccountInitial(accountName = "Both") {
  if (/raised/i.test(accountName)) return "R";
  if (/truth/i.test(accountName)) return "T";
  return "B";
}

function briefAccountClass(accountName = "Both") {
  if (/raised/i.test(accountName)) return "raised";
  if (/truth/i.test(accountName)) return "truth";
  return "both";
}

function briefAccountMarker(accountName = "Both") {
  return `<span class="brief-account-marker ${briefAccountClass(accountName)}">${briefAccountInitial(accountName)}</span>`;
}

function briefFindProduct(subject = "", accountName = "") {
  const subjectNorm = normalizedName(subject);
  if (!subjectNorm) return null;
  return products().find((product) => normalizedName(product.id) === subjectNorm || normalizedName(product.productId) === subjectNorm) ||
    products().find((product) => normalizedName(product.name) === subjectNorm && (!accountName || normalizedName(product.account) === normalizedName(accountName) || /both/i.test(accountName))) ||
    products().find((product) => normalizedName(product.name).includes(subjectNorm) || subjectNorm.includes(normalizedName(product.name)));
}

function briefOpenProductButton(subject = "", accountName = "", extraClass = "") {
  const product = briefFindProduct(subject, accountName);
  const label = subject || product?.name || "Product";
  if (!product) return `<span class="brief-link-text clamp-2" title="${escapeAttr(label)}">${escapeHtml(label)}</span>`;
  return `<button class="brief-product-link ${extraClass}" type="button" data-product-id="${escapeAttr(product.id)}" title="${escapeAttr(product.name || label)}">${escapeHtml(label)}</button>`;
}

function briefRequestName(accountName = "") {
  const topCategory = categoryIntelligence()
    .filter((row) => !accountName || /both/i.test(accountName) || normalizedName(row.account || "") === normalizedName(accountName) || !row.account)
    .sort((a, b) => Number(b.gmv || 0) - Number(a.gmv || 0))[0]?.category || "";
  if (/garden/i.test(topCategory) || /raised/i.test(accountName)) return "Garden problem solvers";
  if (/health|wellness|peptide/i.test(topCategory) || /truth/i.test(accountName)) return "Wellness books";
  if (/water/i.test(topCategory)) return "Water quality products";
  return "Seasonal Halloween items";
}

function briefSampleListForAccount(accountName = "") {
  return polarisSamples()
    .filter(sampleRequiresFilming)
    .filter((sample) => {
      const sampleAccount = sample.account || "Both";
      return /both|shared/i.test(sampleAccount) || normalizedName(sampleAccount) === normalizedName(accountName);
    })
    .sort((a, b) => (sampleDaysLeft(a) ?? 999) - (sampleDaysLeft(b) ?? 999));
}

function briefSampleRows(accountName = "") {
  const waiting = briefSampleListForAccount(accountName);
  if (!waiting.length) return `<p class="empty compact-empty">No samples waiting to film.</p>`;
  return `<div class="brief-sample-rows">${waiting.slice(0, 4).map((sample) => {
    const product = productForSample(sample) || {};
    const productId = sampleProductId(sample);
    const days = sampleDaysLeft(sample);
    return `
      <button class="brief-sample-row" type="button" ${productId ? `data-product-id="${escapeAttr(productId)}"` : ""} title="${escapeAttr(sample.productName || product.name || "Sample")}">
        ${productImageMarkup({ ...product, ...sample }, sample.productName || product.name || "Sample")}
        <span><strong class="clamp-2">${escapeHtml(sample.productName || product.name || "Sample")}</strong><small>${escapeHtml(sample.account || accountName || "Both")} ${days === null ? "" : `· ${number.format(days)} days left`}</small></span>
      </button>
    `;
  }).join("")}</div>`;
}

function briefRecentVideoForAccount(account, avoidName = "") {
  const now = new Date();
  const avoidNorm = normalizedName(avoidName);
  return accountVideos(account)
    .filter((video) => {
      const posted = new Date(`${normalizeDateKey(video.datePosted || video.postedAt || "")}T00:00:00`);
      const age = Number.isNaN(posted.getTime()) ? 0 : (now - posted) / 86400000;
      const videoName = normalizedName(video.productName || video.hook || "");
      return age <= 14 && (!avoidNorm || !videoName.includes(avoidNorm));
    })
    .sort((a, b) => new Date(b.datePosted || b.postedAt || 0) - new Date(a.datePosted || a.postedAt || 0))[0];
}

function briefActionsForAccount(account) {
  const accountName = briefAccountKey(account);
  const actions = buildActionPlan().filter((action) => normalizedName(action.account) === normalizedName(accountName) || /both/i.test(action.account || ""));
  const waiting = briefSampleListForAccount(accountName)[0];
  const filmAction = waiting
    ? { label: "Film", subject: waiting.productName, reason: sampleDaysLeft(waiting) !== null ? `${number.format(sampleDaysLeft(waiting))} days left.` : "Waiting to be filmed." }
    : actions.find((action) => action.category === "Film");
  const filmSubject = filmAction?.subject || filmAction?.productOrCategory || "";
  const watchVideo = briefRecentVideoForAccount(account, filmSubject);
  const watchAction = watchVideo
    ? { label: "Watch", subject: watchVideo.productName || videoTitle(watchVideo), reason: Number(watchVideo.comments || 0) ? "Watch comments." : "Test another hook." }
    : actions.find((action) => /watch|monitor|test/i.test(`${action.category} ${action.action}`));
  return [
    { label: "Film", subject: filmSubject || "Top product", reason: waiting ? filmAction.reason : "Strongest current signal." },
    { label: "Request", subject: briefRequestName(accountName), reason: "Keep sample flow moving." },
    { label: "Watch", subject: watchAction?.subject || watchAction?.productOrCategory || "Recent video", reason: watchAction?.reason || "Monitor fresh signals." }
  ];
}

function briefActionMarkup(action, accountName) {
  return `
    <article class="brief-action-row">
      <span>${escapeHtml(action.label)}</span>
      <div>${briefOpenProductButton(action.subject, accountName, "clamp-2")}<small>${escapeHtml(action.reason || "Northstar is watching this signal.")}</small></div>
    </article>
  `;
}

function briefSummarySentence(account, revenue, samples) {
  const top = revenue.topProductName && revenue.topProductName !== "No product yet" ? revenue.topProductName : "current products";
  if (samples.length) return `${account.name} has ${number.format(samples.length)} sample${samples.length === 1 ? "" : "s"} waiting to film.`;
  if (revenue.gmv) return `${account.name} is led by ${shortName(top)} this month.`;
  return `${account.name} is waiting for fresh Polaris signals.`;
}

function accountSampleInventoryMarkup(summary) {
  const accountName = summary?.account || "";
  return briefSampleRows(accountName);
}

function accountBriefMarkup(account) {
  const accountName = account.name;
  const range = northstarBriefRevenueRanges[account.id] || "Current Month";
  const productList = accountProducts(account.id);
  const revenue = accountRevenueSnapshot(account, productList, range);
  const samples = briefSampleListForAccount(accountName);
  const contentRows = accountContentMarkup(accountContentSnapshot(accountVideos(account)));
  const ranges = ["Current Month", "Previous Month", "Last 90 Days", "Year to Date", "Lifetime"];
  return `
    <section class="card account-brief-card round-one-brief">
      <div class="account-brief-header">
        <div>
          <span class="account-brief-label">${escapeHtml(accountName)}</span>
          <h2>${escapeHtml(accountName)} Brief</h2>
        </div>
        <p>${escapeHtml(briefSummarySentence(account, revenue, samples))}</p>
      </div>
      <div class="account-brief-grid round-one-grid">
        <article class="account-brief-panel account-actions-panel">
          <h3>Top 3 Actions</h3>
          <div class="brief-action-list">${briefActionsForAccount(account).map((action) => briefActionMarkup(action, accountName)).join("")}</div>
        </article>
        <article class="account-brief-panel brief-samples-panel">
          <h3>Sample Inventory</h3>
          <small class="panel-kicker">Waiting to Film</small>
          ${briefSampleRows(accountName)}
        </article>
        <article class="account-brief-panel">
          <div class="panel-title-row"><h3>Revenue Snapshot</h3><select class="brief-revenue-range" data-brief-revenue-range="${escapeAttr(account.id)}">${ranges.map((item) => `<option ${item === range ? "selected" : ""}>${item}</option>`).join("")}</select></div>
          ${accountRevenueMarkup(revenue)}
        </article>
        <article class="account-brief-panel">
          <h3>Content Snapshot</h3>
          ${contentRows}
        </article>
      </div>
    </section>
  `;
}

function briefGoalLine(label, actual, goalText) {
  return `<small class="brief-goal-line">${escapeHtml(actual)} · Goal: ${escapeHtml(goalText)}</small>`;
}

function monthlyProgressMarkup() {
  const data = monthlyProgressData();
  const projected = monthlyProjection(data);
  const goals = { gmv: 5000, commission: 500, units: 250, videos: NORTHSTAR_MONTHLY_VIDEO_GOAL };
  const splits = monthlyAccountSplits();
  const splitLine = (key, formatter) => northstarBriefAccounts().map((account) => `<span>${escapeHtml(account.name)}: <b>${formatter(splits[account.name]?.[key] || 0)}</b></span>`).join("");
  return `
    <section class="card monthly-progress-card command-center-hero round-one-progress">
      <div class="monthly-progress-hero-copy">
        <span class="account-brief-label">Monthly Progress</span>
        <h2>${money.format(data.gmv)} <span>Total GMV — All Accounts</span></h2>
        <div class="brief-split-line">${splitLine("gmv", (value) => money.format(value))}</div>
        <div class="executive-bullet-list inline-brief-lines">
          <div><span>Film today:</span><b>${escapeHtml(briefActionsForAccount(northstarBriefAccounts()[0] || {}).find((item) => item.label === "Film")?.subject || "Top product")}</b></div>
          <div><span>Watch:</span><b>${escapeHtml(briefActionsForAccount(northstarBriefAccounts()[1] || northstarBriefAccounts()[0] || {}).find((item) => item.label === "Watch")?.subject || "Recent videos")}</b></div>
          <div><span>Sample deadline:</span><b>${escapeHtml((polarisSamples().filter(sampleRequiresFilming).sort((a, b) => (sampleDaysLeft(a) ?? 999) - (sampleDaysLeft(b) ?? 999))[0]?.productName) || "No urgent deadline")}</b></div>
          <div><span>Sales signal:</span><b>${escapeHtml(monthlyMomentumLine())}</b></div>
        </div>
      </div>
      <div class="monthly-progress-grid round-one-progress-grid">
        ${progressMetric("Total GMV — All Accounts", money.format(data.gmv), data.gmv, goals.gmv).replace("</article>", `${briefGoalLine("GMV", money.format(data.gmv), money.format(goals.gmv))}</article>`)}
        ${progressMetric("Commission this month", money.format(data.commission), data.commission, goals.commission).replace("</article>", `${briefGoalLine("Commission", money.format(data.commission), money.format(goals.commission))}</article>`)}
        ${progressMetric("Units sold", number.format(data.units), data.units, goals.units).replace("</article>", `${briefGoalLine("Units", number.format(data.units), `${number.format(goals.units)}/month`)}</article>`)}
        ${progressMetric("Videos posted", number.format(data.videos), data.videos, goals.videos).replace("</article>", `${briefGoalLine("Videos", `${number.format(data.videos)} posted`, `${NORTHSTAR_MONTHLY_VIDEO_GOAL}/month`)}</article>`)}
      </div>
      <div class="monthly-projection-row round-one-projection">
        <article><span>Projected GMV</span><strong>${money.format(projected.gmv)}</strong><small>Based on current pace.</small></article>
        <article><span>Days remaining</span><strong>${number.format(daysRemainingInMonth())}</strong><small>Keep feeding the strongest signals.</small></article>
      </div>
      <div class="brief-split-line secondary">${splitLine("commission", (value) => money.format(value))}${splitLine("units", (value) => number.format(value))}</div>
    </section>
  `;
}

function yesterdayLearningsMarkup() {
  const seen = new Set();
  const sparks = sparkReportItems().filter((spark) => {
    const key = normalizedName(`${spark.account}-${spark.text}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
  return `
    <section class="card spark-report-card yesterday-learnings-card round-one-pulse">
      <div class="section-title"><div><h3>Spark Report</h3><p>Unusual, high-value Signals only.</p></div><span class="badge good">${sparks.length} Sparks</span></div>
      ${sparks.length ? `<div class="spark-report-list compact-pulse-list">${sparks.map((spark) => `<article>${briefAccountMarker(spark.account)}<div><strong class="clamp-2" title="${escapeAttr(spark.text)}">${escapeHtml(spark.text)}</strong><small>${escapeHtml(spark.note || "Signal detected.")}</small></div></article>`).join("")}</div>` : `<p class="empty">No major Spark detected yet. Northstar is watching your signals.</p>`}
    </section>
  `;
}

function pulseReportMarkup() {
  const sparks = sparkReportItems().slice(0, 3);
  const actions = buildActionPlan();
  const rows = [
    ...sparks.map((spark) => ({ account: spark.account, label: "What changed", text: spark.text })),
    ...actions.slice(0, 3).map((action) => ({ account: action.account || "Both", label: actionTypeLabel(action), text: `${action.productOrCategory || action.action}: ${action.reason || "Review this signal."}` }))
  ];
  const seen = new Set();
  const uniqueRows = rows.filter((row) => {
    const key = normalizedName(`${row.account}-${row.label}-${row.text}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
  return `
    <section class="card pulse-report-card round-one-pulse">
      <div class="section-title"><div><h3>Pulse Report</h3><p>What changed, why it matters, and what to do next.</p></div></div>
      <div class="pulse-report-list">${uniqueRows.map((row) => `<article>${briefAccountMarker(row.account)}<span>${escapeHtml(row.label)}</span><strong class="clamp-2" title="${escapeAttr(row.text)}">${escapeHtml(row.text)}</strong></article>`).join("") || `<p class="empty">No major Pulse changes yet.</p>`}</div>
    </section>
  `;
}

function briefCategoryAccount(row = {}) {
  if (row.account) return row.account;
  const productsInCategory = products().filter((product) => normalizedName(product.categoryGroup || product.category) === normalizedName(row.category));
  const accountsForCategory = [...new Set(productsInCategory.map((product) => product.account).filter(Boolean))];
  if (accountsForCategory.length === 1) return accountsForCategory[0];
  return accountsForCategory.length > 1 ? "Both" : "Both";
}

function briefBestHookForCategory(row = {}) {
  const categoryProducts = products().filter((product) => normalizedName(product.categoryGroup || product.category) === normalizedName(row.category));
  const categoryProductNames = new Set(categoryProducts.map((product) => normalizedName(product.name)));
  const video = validVideos()
    .filter((item) => categoryProductNames.has(normalizedName(item.productName)) || normalizedName(item.category) === normalizedName(row.category))
    .sort((a, b) => Number(b.gmv || b.views || 0) - Number(a.gmv || a.views || 0))[0];
  return videoTitle(video || {}) || "Awaiting video signal";
}

function categoryIntelligenceTable(rows) {
  if (!rows.length) return `<p class="empty">Add products to generate category intelligence.</p>`;
  const sorted = rows.slice().sort((a, b) => Number(b.gmv || 0) - Number(a.gmv || 0)).slice(0, 10);
  return `
    <div class="category-intel-grid round-one-category-grid">
      <div class="category-intel-head"><span>Category</span><span>Account</span><span>Best product</span><span>Best hook/video</span><span>GMV</span><span>Comm.</span><span>Next move</span></div>
      ${sorted.map((row) => {
        const bestProduct = row.highestCommission || row.fastestGrowing || row.bestProduct || {};
        const nextMove = bestProduct.name ? productNextMove(bestProduct) : "Watch for a stronger signal.";
        return `<article class="category-intel-row">
          <strong title="${escapeAttr(row.category || "")}">${escapeHtml(row.category || "Category")}</strong>
          <span>${briefAccountMarker(briefCategoryAccount(row))}${escapeHtml(briefCategoryAccount(row))}</span>
          <span class="clamp-2" title="${escapeAttr(bestProduct.name || "")}">${escapeHtml(bestProduct.name || "Awaiting product")}</span>
          <span class="clamp-2" title="${escapeAttr(briefBestHookForCategory(row))}">${escapeHtml(briefBestHookForCategory(row))}</span>
          <span>${money.format(row.gmv || 0)}</span>
          <span>${money.format(row.commission || bestProduct.lifetimeCommission || 0)}</span>
          <span class="clamp-2" title="${escapeAttr(nextMove)}">${escapeHtml(nextMove)}</span>
        </article>`;
      }).join("")}
    </div>
  `;
}

function generateScriptIdeasForProduct(product) {
  const name = shortName(product.name || "this product");
  const account = /truth/i.test(product.account || "") ? "truth" : "raised";
  const opener = account === "truth" ? "I researched this so you do not have to." : "I did not know I needed this until I tried it.";
  return [
    { title: "Curiosity Script", body: `${opener} Here is what caught my attention about ${name}, what it is supposed to solve, and who I think it makes sense for.` },
    { title: "Problem Solver Script", body: `If you have been dealing with this problem, ${name} is worth a closer look. Show the problem first, demo the fix, then end with a soft CTA.` },
    { title: "Proof Demo Script", body: `Start with the result, show ${name} in use, compare before and after, then ask viewers what they would test next.` }
  ];
}

function scriptGeneratorMarkup(product) {
  const scripts = generatedScriptIdeasByProduct[product.id] || [];
  return `
    <section class="card script-generator-card">
      <div class="section-title"><div><h3>Script Generator</h3><p>Turn the strongest hook into a short filming outline.</p></div><button class="icon-button" id="generateScriptIdeas" type="button">Generate Script Ideas</button></div>
      ${scripts.length ? `<div class="script-idea-grid">${scripts.map((script) => `<article><strong>${escapeHtml(script.title)}</strong><p>${escapeHtml(script.body)}</p></article>`).join("")}</div>` : `<p class="empty">Generate scripts after choosing a hook direction.</p>`}
    </section>
  `;
}

const northstarRoundOneHookGeneratorBase = hookGeneratorMarkup;
hookGeneratorMarkup = function hookGeneratorWithScriptGenerator(product) {
  return `${northstarRoundOneHookGeneratorBase(product)}${scriptGeneratorMarkup(product)}`;
};

const northstarRoundOneBindHookGeneratorBase = bindHookGeneratorControls;
bindHookGeneratorControls = function bindHookAndScriptGeneratorControls(product) {
  northstarRoundOneBindHookGeneratorBase(product);
  document.querySelector("#generateScriptIdeas")?.addEventListener("click", () => {
    generatedScriptIdeasByProduct[product.id] = generateScriptIdeasForProduct(product);
    renderProductDetail(product.id);
  });
};

function productVideoPlans(product = {}) {
  if (!Array.isArray(product.videoPlans)) product.videoPlans = [];
  return product.videoPlans;
}

function videoBuilderAudienceProfile(product = {}) {
  const account = product.account || "";
  if (/truth/i.test(account)) {
    return {
      style: "curiosity + education",
      hookLead: "I researched this so you do not have to",
      proofPrompt: "show the detail or research angle that makes this worth understanding",
      softCta: "I linked it if you want to read the details and decide for yourself",
      tags: ["#wellnesstok", "#learnontiktok", "#curiositytok", "#healthfinds", "#booktok"]
    };
  }
  return {
    style: "practical problem-solver",
    hookLead: "I did not know I needed this until I saw what it fixes",
    proofPrompt: "show the everyday problem, then the product solving it",
    softCta: "I linked it if you want to check the details",
    tags: ["#tiktokmademebuyit", "#practicalfinds", "#homefinds", "#gardenfinds", "#creatorfinds"]
  };
}

function usedVideoPlanAngles(product = {}, relatedVideos = []) {
  const saved = productVideoPlans(product).flatMap((plan) => [plan.angle, plan.openingHook, ...(plan.alternateHooks || [])]);
  const prior = relatedVideos.flatMap((video) => [video.hook, video.title, video.caption, video.angle]);
  return new Set([...saved, ...prior].filter(Boolean).map(normalizedName));
}

function nextVideoPlanAngle(product = {}, relatedVideos = []) {
  const used = usedVideoPlanAngles(product, relatedVideos);
  const category = product.categoryGroup || product.category || "Product";
  const options = [
    { name: "Problem / Solution Demo", premise: "Lead with the problem this product solves, then show the simplest proof." },
    { name: "Curiosity Test", premise: "Open with the most surprising detail and make viewers want the explanation." },
    { name: "Proof Close-Up", premise: "Use close shots, packaging, and product details as the trust builder." },
    { name: "Story + Demo", premise: "Explain why this product caught Jennifer's attention, then demonstrate it." },
    { name: "Comment Reply Angle", premise: "Answer the most likely shopper question before it appears in comments." },
    { name: `${category} Comparison`, premise: "Compare this product against the common alternative or usual workaround." }
  ];
  return options.find((option) => !used.has(normalizedName(option.name))) || {
    name: `Fresh Angle ${productVideoPlans(product).length + 1}`,
    premise: "Use a new opening, new first visual, and a different reason to care."
  };
}

function productVideoBuilderHashtags(product = {}) {
  const audience = videoBuilderAudienceProfile(product);
  const category = `${product.categoryGroup || product.category || ""} ${product.name || ""}`.toLowerCase();
  const categoryTags = [];
  if (/garden|weed|yard|plant/.test(category)) categoryTags.push("#gardentok", "#yardwork", "#gardenfinds");
  if (/water|tds|filter/.test(category)) categoryTags.push("#waterquality", "#healthtok", "#homehealth");
  if (/peptide|wellness|health|recovery|supplement/.test(category)) categoryTags.push("#wellnesstok", "#healthfinds", "#biohacking");
  if (/patriot|america|trump|flag|coin/.test(category)) categoryTags.push("#patrioticfinds", "#americanmade", "#collectibles");
  if (/beauty|nail|serum|skin|hair/.test(category)) categoryTags.push("#beautytok", "#skincarefinds", "#beautyreview");
  const basics = ["#tiktokshop", "#productreview", "#shopfinds", "#creatorbusiness"];
  return [...new Set([...audience.tags, ...categoryTags, ...basics])].slice(0, 12);
}

function generateCompleteVideoPlan(product = {}) {
  const relatedVideos = productVideos(product.id);
  const bestVideo = bestPerformingVideo(relatedVideos);
  const audience = videoBuilderAudienceProfile(product);
  const angle = nextVideoPlanAngle(product, relatedVideos);
  const name = shortName(product.name || "this product");
  const account = product.account || "Both";
  const category = product.categoryGroup || product.category || "Product";
  const seasonality = product.seasonality || intelligenceSeason(product) || "Evergreen";
  const bestHook = product.bestHook || bestVideo?.hook || videoTitle(bestVideo || {}) || "";
  const metricSignal = toNumber(product.lifetimeGmv || bestVideo?.gmv) > 0
    ? `${money.format(toNumber(product.lifetimeGmv || bestVideo?.gmv))} known GMV`
    : `${number.format(relatedVideos.length)} related video${relatedVideos.length === 1 ? "" : "s"} connected`;
  const openingHook = bestHook && !usedVideoPlanAngles(product, relatedVideos).has(normalizedName(bestHook))
    ? bestHook
    : `${audience.hookLead}: ${name}.`;
  const productProblem = /truth/i.test(account)
    ? `The interesting part is not just the product. It is why ${category.toLowerCase()} keeps getting attention.`
    : `This works best if the first shot shows the exact problem before ${name} appears.`;
  const script = [
    `${openingHook}`,
    `${productProblem}`,
    `Show ${name} close up, then explain the one thing Jennifer noticed that makes it worth testing.`,
    `Use the demo to make the benefit obvious without overexplaining.`,
    `End with a soft TikTok Shop CTA and invite viewers to save it if they want to compare it later.`
  ].join(" ");
  return {
    id: uniqueImportId(`video-plan-${product.id}-${Date.now()}`),
    productId: product.id,
    productName: product.name,
    account,
    category,
    seasonality,
    angle: angle.name,
    anglePremise: angle.premise,
    status: "Idea",
    createdAt: new Date().toISOString(),
    openingHook,
    spokenScript: script,
    onScreenText: [
      { time: "0-3s", text: openingHook.replace(/\.$/, "") },
      { time: "3-8s", text: `The problem: ${category}` },
      { time: "8-18s", text: `What ${name} does` },
      { time: "18-25s", text: "Close-up proof" },
      { time: "25-30s", text: "Linked if you want details" }
    ],
    shotList: [
      "Shot 1: opening visual with the problem or surprising detail.",
      "Shot 2: product close-up in hand or on a clean surface.",
      "Shot 3: demo, use case, or page/product detail walkthrough.",
      "Shot 4: proof, benefit, texture, size, result, or why it matters.",
      "Shot 5: calm CTA with product visible."
    ],
    broll: [
      "Product in hand.",
      "Close-up details.",
      "Before/after or problem shot.",
      "Lifestyle use.",
      "Packaging/sample shot if available."
    ],
    editingNotes: [
      "Zoom slightly on the first proof detail.",
      "Pause for half a beat before the benefit line.",
      "Add text only where it clarifies the reason to care.",
      "Show the product detail or price area briefly near the CTA.",
      `Do not reuse the same first shot as the last ${relatedVideos.length ? "connected video" : "test"}.`
    ],
    ctas: {
      shop: `Tap the product link if you want to check ${name}.`,
      engagement: "Save this if you want to remember it, or comment what you would test first.",
      softSell: audience.softCta
    },
    caption: `${name}: ${angle.premise}`,
    hashtags: productVideoBuilderHashtags(product),
    alternateHooks: [
      `I did not expect ${name} to be useful for this.`,
      `Before you scroll, look at what ${name} actually solves.`,
      /truth/i.test(account) ? `I researched ${name}, and this is the part worth knowing.` : `This is one of those finds that makes more sense once you see it work.`
    ],
    sourceSignals: [
      `Account: ${account}`,
      `Audience style: ${audience.style}`,
      `Seasonality: ${seasonality}`,
      `Available signal: ${metricSignal}`,
      bestHook ? `Previous hook signal: ${bestHook}` : "Previous hook signal: awaiting imported hooks"
    ]
  };
}

function videoPlanList(items = []) {
  return items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : `${item.time}: ${item.text}`)}</li>`).join("");
}

function completeVideoPlanCard(plan, index) {
  const statuses = ["Idea", "Filmed", "Posted", "Needs revision"];
  return `
    <article class="video-plan-card">
      <div class="video-plan-header">
        <div>
          <span class="account-brief-label">Video Plan ${index + 1}</span>
          <h4 class="clamp-2" title="${escapeAttr(plan.angle || "Complete Video Plan")}">${escapeHtml(plan.angle || "Complete Video Plan")}</h4>
          <p>${escapeHtml(plan.anglePremise || "Ready-to-film TikTok plan.")}</p>
        </div>
        <label class="video-plan-status">Status
          <select data-video-plan-status="${escapeAttr(plan.id)}">
            ${statuses.map((status) => `<option value="${escapeAttr(status)}" ${status === plan.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="video-plan-section-grid">
        <section class="video-plan-section"><h5>Opening Hook</h5><p>${escapeHtml(plan.openingHook || "")}</p></section>
        <section class="video-plan-section"><h5>CTA</h5><p><strong>Shop:</strong> ${escapeHtml(plan.ctas?.shop || "")}</p><p><strong>Engage:</strong> ${escapeHtml(plan.ctas?.engagement || "")}</p><p><strong>Soft sell:</strong> ${escapeHtml(plan.ctas?.softSell || "")}</p></section>
        <section class="video-plan-section video-plan-script"><h5>Spoken Script</h5><p>${escapeHtml(plan.spokenScript || "")}</p></section>
        <section class="video-plan-section"><h5>On-Screen Text</h5><ul>${videoPlanList(plan.onScreenText || [])}</ul></section>
        <section class="video-plan-section"><h5>Shot List</h5><ul>${videoPlanList(plan.shotList || [])}</ul></section>
        <section class="video-plan-section"><h5>B-Roll Checklist</h5><ul>${videoPlanList(plan.broll || [])}</ul></section>
        <section class="video-plan-section"><h5>Editing Notes</h5><ul>${videoPlanList(plan.editingNotes || [])}</ul></section>
        <section class="video-plan-section"><h5>Caption + Hashtags</h5><p>${escapeHtml(plan.caption || "")}</p><p class="video-plan-tags">${escapeHtml((plan.hashtags || []).join(" "))}</p></section>
        <section class="video-plan-section"><h5>Alternate Hooks</h5><ul>${videoPlanList(plan.alternateHooks || [])}</ul></section>
        <section class="video-plan-section"><h5>Signals Used</h5><ul>${videoPlanList(plan.sourceSignals || [])}</ul></section>
      </div>
    </article>
  `;
}

function completeVideoBuilderMarkup(product) {
  const plans = productVideoPlans(product);
  return `
    <section class="card complete-video-builder-card">
      <div class="section-title">
        <div><h3>Complete Video Builder</h3><p>Generate a ready-to-film plan from product signals, audience fit, and prior content.</p></div>
        <button class="icon-button create-video-plan-button" id="createCompleteVideoPlan" type="button">🎬 Create Complete Video</button>
      </div>
      ${plans.length ? `<div class="video-plan-list">${plans.map(completeVideoPlanCard).join("")}</div>` : `<p class="empty">Create a complete video plan when you are ready to film this product.</p>`}
    </section>
  `;
}

function bindCompleteVideoBuilderControls(product) {
  document.querySelector("#createCompleteVideoPlan")?.addEventListener("click", () => {
    productVideoPlans(product).unshift(generateCompleteVideoPlan(product));
    saveData("Complete video plan saved to this Product Workspace.");
    renderProductDetail(product.id);
  });
  document.querySelectorAll("[data-video-plan-status]").forEach((selectEl) => {
    selectEl.addEventListener("change", () => {
      const plan = productVideoPlans(product).find((item) => item.id === selectEl.dataset.videoPlanStatus);
      if (!plan) return;
      plan.status = selectEl.value;
      plan.updatedAt = new Date().toISOString();
      saveData(`Video plan marked ${selectEl.value}.`);
    });
  });
}

const northstarVideoBuilderHookGeneratorBase = hookGeneratorMarkup;
hookGeneratorMarkup = function hookGeneratorWithCompleteVideoBuilder(product) {
  return `${northstarVideoBuilderHookGeneratorBase(product)}${completeVideoBuilderMarkup(product)}`;
};

const northstarVideoBuilderBindHookGeneratorBase = bindHookGeneratorControls;
bindHookGeneratorControls = function bindHookScriptAndVideoBuilderControls(product) {
  northstarVideoBuilderBindHookGeneratorBase(product);
  bindCompleteVideoBuilderControls(product);
};

/* Product Workspace: samples are simple Waiting to Film cards; creative work happens after click. */
function sampleSeedRecord(accountName, productName, category, daysLeft, productId = "", status = "Waiting to Film") {
  return {
    id: uniqueImportId(`sample-${normalizedName(accountName)}-${normalizedName(productName)}`),
    productId,
    productName,
    account: accountName,
    category,
    status,
    sampleStatus: "Received",
    seasonality: /solar|ice cream|garden|lantern/i.test(productName) ? "Summer / Evergreen" : "Evergreen",
    dateDelivered: "",
    arrivalDate: "",
    daysLeft,
    notes: "Current sample waiting to film.",
    source: "Northstar current sample seed"
  };
}

function ensureProductForSample(sample) {
  let product = productForSample(sample) || briefFindProduct(sample.productName, sample.account);
  if (!product) {
    product = {
      id: sample.productId || uniqueImportId(`product-${normalizedName(sample.account)}-${normalizedName(sample.productName)}`),
      productId: sample.productId || "",
      name: sample.productName,
      account: sample.account,
      accountId: /truth/i.test(sample.account) ? "truthTunedTribe" : "raisedRight",
      category: sample.category || "Sample",
      categoryGroup: sample.category || "Sample",
      seasonality: sample.seasonality || "Evergreen",
      sampleStatus: sample.sampleStatus || sample.status || "Waiting to Film",
      status: "Watch",
      notes: sample.notes || "",
      source: "Northstar current sample seed"
    };
    db.products.push(product);
  } else {
    product.sampleStatus = product.sampleStatus || sample.sampleStatus || sample.status;
    product.status = product.status || "Watch";
    product.category = product.category || sample.category;
    product.categoryGroup = product.categoryGroup || sample.category;
    product.seasonality = product.seasonality || sample.seasonality;
    product.account = product.account || sample.account;
    product.accountId = product.accountId || (/truth/i.test(sample.account) ? "truthTunedTribe" : "raisedRight");
  }
  sample.productId = sample.productId || product.id || product.productId || "";
  return product;
}

function ensureCurrentWaitingToFilmSamples() {
  if (!Array.isArray(db.samples)) db.samples = [];
  if (!Array.isArray(db.products)) db.products = [];
  const seeds = [
    sampleSeedRecord("Raised Right", "RAD Recovery Rounds Myofascial Release Balls", "Wellness / Recovery", 12, "1729534583838052769"),
    sampleSeedRecord("Raised Right", "Silicone Ice Cream Holder", "Kitchen / Summer", 12, "1731155105595494832"),
    sampleSeedRecord("Raised Right", "Dog Wig", "Pets / Novelty", 12, "1732221397360874335"),
    sampleSeedRecord("Raised Right", "Dashing Diva Glue-On Gel Nails", "Beauty / Nails", 13),
    sampleSeedRecord("Raised Right", "Dopamine Bead Necklace Set", "Fashion / Jewelry", 12, "1732316857163092167"),
    sampleSeedRecord("Raised Right", "Ettika Layered Gold Necklace", "Fashion / Jewelry", 12, "1729454831588053819"),
    sampleSeedRecord("Raised Right", "Ettika Heart Necklace", "Fashion / Jewelry", 12, "1729418806776730427"),
    sampleSeedRecord("Truth Tuned Tribe", "Smart AI Glasses", "Tech / AI / Creator Tools", 5, "1731553898155184778"),
    sampleSeedRecord("Truth Tuned Tribe", "Hanging Solar Lantern", "Home / Outdoor", 10, "1729467851955212813"),
    sampleSeedRecord("Truth Tuned Tribe", "Peppermint & Cedar Oil Spray", "Wellness / Home", 10)
  ];
  seeds.forEach((seed) => {
    const existing = db.samples.find((sample) =>
      (seed.productId && (sample.productId === seed.productId || sample.relatedProductId === seed.productId)) ||
      (normalizedName(sample.productName) === normalizedName(seed.productName) && normalizedName(sample.account) === normalizedName(seed.account))
    );
    const target = existing || seed;
    if (!existing) db.samples.push(target);
    target.status = sampleRequiresFilming(target) ? target.status : "Waiting to Film";
    target.sampleStatus = target.sampleStatus || "Received";
    target.category = target.category || seed.category;
    target.account = target.account || seed.account;
    target.daysLeft = target.daysLeft ?? seed.daysLeft;
    target.notes = target.notes || seed.notes;
    ensureProductForSample(target);
  });
}

function productWorkspaceSamples(product = {}) {
  return polarisSamples().filter((sample) => {
    const productId = sampleProductId(sample);
    return productId === product.id ||
      productId === product.productId ||
      normalizedName(sample.productName) === normalizedName(product.name);
  });
}

function productWorkspacePrimarySample(product = {}) {
  return productWorkspaceSamples(product).sort((a, b) => (sampleDaysLeft(a) ?? 999) - (sampleDaysLeft(b) ?? 999))[0] || {};
}

function productWorkspaceLink(product = {}, sample = {}) {
  const link = product.productLink || product.tiktokShopUrl || product.url || sample.productLink || sample.tiktokShopUrl || "";
  return link ? `<a class="ghost-button" href="${escapeAttr(link)}" target="_blank" rel="noreferrer">Product Link</a>` : `<span class="muted-placeholder">Product link not added yet.</span>`;
}

function productWorkspaceOverviewMarkup(product, sample, relatedVideos) {
  const days = sampleDaysLeft(sample);
  return `
    <section class="card product-workspace-overview">
      <div class="product-workspace-hero">
        <div class="product-workspace-image">${productImageMarkup({ ...product, ...sample }, product.name)}</div>
        <div class="product-workspace-title">
          <span class="account-brief-label">Product Workspace</span>
          <h2 class="clamp-2" title="${escapeAttr(product.name || "")}">${escapeHtml(product.name || "Product")}</h2>
          <p>${escapeHtml(product.account || sample.account || "Both")} · ${escapeHtml(product.categoryGroup || product.category || sample.category || "Category")} · ${escapeHtml(product.seasonality || intelligenceSeason(product) || "Evergreen")}</p>
          <div class="workspace-chip-row">
            <span>${escapeHtml(sample.sampleStatus || product.sampleStatus || sample.status || "Status not set")}</span>
            <span>${days === null ? "No deadline" : `${number.format(days)} days left`}</span>
            <span>${number.format(relatedVideos.length)} related videos</span>
          </div>
          <div class="workspace-action-row">${productWorkspaceLink(product, sample)}</div>
        </div>
      </div>
      <div class="workspace-overview-grid">
        ${metric("Account", product.account || sample.account || "Both", "Creator brand", "")}
        ${metric("Category", product.categoryGroup || product.category || sample.category || "Not set", "Product type", "")}
        ${metric("Seasonality", product.seasonality || intelligenceSeason(product) || "Evergreen", "Timing angle", "")}
        ${metric("Sample status", sample.sampleStatus || product.sampleStatus || sample.status || "Not set", `Arrival: ${sample.arrivalDate || sample.dateDelivered || "Not added"}`, "")}
      </div>
    </section>
  `;
}

function productSalesHistoryMarkup(product, relatedVideos) {
  const rows = (db.salesRecords || []).filter((record) =>
    record.productId === product.id ||
    record.productId === product.productId ||
    normalizedName(record.productName) === normalizedName(product.name)
  );
  const videoTotals = relatedVideos.reduce((acc, video) => {
    acc.gmv += toNumber(video.gmv);
    acc.commission += toNumber(video.commission);
    acc.units += toNumber(video.sales || video.unitsSold);
    return acc;
  }, { gmv: 0, commission: 0, units: 0 });
  const salesTotals = rows.reduce((acc, row) => {
    acc.gmv += toNumber(row.gmv || row.revenue || row.grossRevenue);
    acc.commission += toNumber(row.commission || row.creatorCommission);
    acc.units += toNumber(row.unitsSold || row.sales || row.itemsSold || row.units);
    return acc;
  }, { gmv: 0, commission: 0, units: 0 });
  return `
    <section class="card workspace-performance-card">
      <div class="section-title"><div><h3>Sales / GMV / Commission History</h3><p>Appears from imported sales and connected videos.</p></div></div>
      <div class="grid four">
        ${metric("GMV", money.format((product.lifetimeGmv || 0) || salesTotals.gmv || videoTotals.gmv), `${number.format(rows.length)} sales rows`, "")}
        ${metric("Commission", money.format((product.lifetimeCommission || 0) || salesTotals.commission || videoTotals.commission), "Creator earnings", "")}
        ${metric("Units", number.format((product.lifetimeUnits || 0) || salesTotals.units || videoTotals.units), "Sold", "")}
        ${metric("Videos", number.format(relatedVideos.length), "Connected content", "")}
      </div>
    </section>
  `;
}

function creativePromptCard(title, items) {
  return `<article class="creative-prompt-card"><h4>${escapeHtml(title)}</h4>${items.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</article>`;
}

function captionGeneratorMarkup(product) {
  const name = shortName(product.name || "this find");
  return creativePromptCard("Caption Generator", [
    `I found ${name} and immediately thought of the one problem it solves.`,
    `This is the kind of find that makes more sense once you see it in action.`,
    `Saving this for anyone who likes practical finds that actually do something.`
  ]);
}

function hashtagGeneratorMarkup(product) {
  const accountTags = /truth/i.test(product.account || "") ? "#wellnesstok #learnontiktok #curiositytok" : "#tiktokmademebuyit #practicalfinds #homefinds";
  return creativePromptCard("Hashtag Generator", [accountTags, "#creatorfinds #productreview #shopfinds"]);
}

function shotListMarkup(product) {
  return creativePromptCard("Shot List", [
    "1. Show the product in hand or in its real setting.",
    "2. Show the problem before the product appears.",
    "3. Show one clear close-up demo.",
    "4. End with the result or reason to care."
  ]);
}

function creativeStudioMarkup(product) {
  const name = shortName(product.name || "this product");
  return `
    <section class="product-workspace-section creative-studio-section">
      <div class="section-title"><div><h3>Creative Studio</h3><p>Hooks, scripts, captions, shots, CTAs, and filming angles for ${escapeHtml(name)}.</p></div></div>
      ${hookGeneratorMarkup(product)}
      <div class="creative-generator-grid">
        ${captionGeneratorMarkup(product)}
        ${creativePromptCard("Thumbnail Ideas", [`Hold ${name} close to camera with the result visible.`, "Use a clean before/after frame.", "Show the most surprising detail first."])}
        ${creativePromptCard("Opening Shot Ideas", ["Start with the problem.", "Start with the result.", "Start with a close-up detail people would pause on."])}
        ${shotListMarkup(product)}
        ${creativePromptCard("B-Roll Checklist", ["Product packaging.", "Handheld close-up.", "In-use demo.", "Reaction or result shot.", "Final CTA frame."])}
        ${creativePromptCard("Voiceover Version", [`Here is why ${name} caught my attention, what it solves, and who I think it is for.`])}
        ${creativePromptCard("UGC Version", [`I tried ${name} so you can see what it actually looks like before deciding.`])}
        ${creativePromptCard("Problem / Solution Version", ["Name the pain point.", "Show the simple product action.", "Show the result without overselling."])}
        ${creativePromptCard("Curiosity Version", [`I did not expect ${name} to be useful for this.`])}
        ${creativePromptCard("Storytelling Version", [`I was looking for a better way to solve this, and ${name} ended up being the thing I wanted to test.`])}
        ${creativePromptCard("CTA Generator", ["Worth checking if this solves a problem you have.", "I linked it if you want to compare it.", "Save this if you want to remember the idea."])}
        ${hashtagGeneratorMarkup(product)}
      </div>
    </section>
  `;
}

function audienceIntelligenceMarkup(product, relatedVideos) {
  const bestHooks = relatedVideos.slice().sort((a, b) => toNumber(b.views || b.gmv) - toNumber(a.views || a.gmv)).slice(0, 3);
  const name = shortName(product.name || "this product");
  return `
    <section class="card audience-intelligence-card">
      <div class="section-title"><div><h3>Audience Intelligence</h3><p>Angles to research before filming.</p></div></div>
      <div class="creative-generator-grid">
        ${creativePromptCard("Competitor Research", [`Search ${name} demos.`, "Look for comments that repeat the same question.", "Notice the first 2 seconds of top videos."])}
        ${creativePromptCard("Similar Viral Videos", bestHooks.length ? bestHooks.map(videoTitle) : ["Add TikTok sync/import data to see similar winning videos."])}
        ${creativePromptCard("Winning Hooks", bestHooks.length ? bestHooks.map(videoTitle) : [product.bestHook || "No winning hook saved yet."])}
        ${creativePromptCard("Audience Angles", /truth/i.test(product.account || "") ? ["Curiosity", "Education", "Authority", "I researched this for you"] : ["Practical problem-solver", "I did not know I needed this", "Gen-X relatable", "Home or everyday use"])}
        ${creativePromptCard("Reply-to-Comment Ideas", ["Does it actually work?", "Can you show it closer?", "How would you use this?", "Is it worth the price?", "What problem does it solve?"])}
      </div>
    </section>
  `;
}

function productWorkspaceNotesMarkup(product, bestVideo) {
  return productNotesMarkup(product, bestVideo).replace("Product Notes", "Notes").replace("Compact working notes for the next video.", "Personal notes, ideas, things to test, and future video ideas.");
}

productSampleLifecycleCard = function productSampleLifecycleCardWaitingOnly(sample) {
  const product = productForSample(sample);
  const id = sampleProductId(sample);
  const daysLeft = sampleDaysLeft(sample);
  return `
    <article class="sample-card product-sample-card waiting-film-card ${id ? "clickable" : ""}" ${id ? `data-sample-product-id="${escapeAttr(id)}"` : ""}>
      <div class="waiting-film-image">${productImageMarkup({ ...product, ...sample }, sample.productName)}</div>
      <div class="waiting-film-copy">
        <h4 class="clamp-2" title="${escapeAttr(sample.productName || product?.name || "")}">${escapeHtml(sample.productName || product?.name || "Product")}</h4>
        <p>${escapeHtml(sample.account || product?.account || "Both")}</p>
        <div class="workspace-chip-row">
          <span>${daysLeft === null ? "No deadline" : `${number.format(daysLeft)} days left`}</span>
          <span>${escapeHtml(sample.sampleStatus || sample.status || "Waiting to Film")}</span>
        </div>
      </div>
    </article>
  `;
};

accountBriefMarkup = function accountBriefWaitingToFilmOnly(account) {
  const accountName = account.name;
  const samples = briefSampleListForAccount(accountName);
  const summary = samples.length
    ? `${number.format(samples.length)} product${samples.length === 1 ? "" : "s"} waiting to film.`
    : "No samples waiting to film right now.";
  return `
    <section class="card account-brief-card round-one-brief waiting-only-brief">
      <div class="account-brief-header">
        <div>
          <span class="account-brief-label">${escapeHtml(accountName)}</span>
          <h2>${escapeHtml(accountName)}</h2>
        </div>
        <p>${escapeHtml(summary)}</p>
      </div>
      <article class="account-brief-panel brief-samples-panel waiting-only-panel">
        <h3>Waiting to Film</h3>
        ${briefSampleRows(accountName)}
      </article>
    </section>
  `;
};

renderProductDetail = function renderProductWorkspace(productId) {
  const product = getProduct(productId);
  if (!product) { renderProductsDatabase(); return; }
  const relatedVideos = productVideos(product.id);
  const bestVideo = bestPerformingVideo(relatedVideos);
  const sample = productWorkspacePrimarySample(product);
  const similar = products().filter((candidate) => candidate.id !== product.id && (candidate.categoryGroup === product.categoryGroup || candidate.accountId === product.accountId)).slice(0, 6);
  content.innerHTML = `
    <button class="back-button" data-page="products">Back</button>
    ${productWorkspaceOverviewMarkup(product, sample, relatedVideos)}
    ${creativeStudioMarkup(product)}
    ${audienceIntelligenceMarkup(product, relatedVideos)}
    <section class="product-workspace-section">
      <div class="section-title"><div><h3>Performance</h3><p>Previous videos and analytics appear once videos exist.</p></div></div>
      ${bestVideoMarkup(bestVideo)}
      ${compactRelatedVideosTable(relatedVideos)}
      ${productSalesHistoryMarkup(product, relatedVideos)}
    </section>
    ${productWorkspaceNotesMarkup(product, bestVideo)}
    <section class="card"><h3>Similar Products</h3><div class="product-grid compact">${similar.map(productCard).join("")}</div></section>
  `;
  bindInternalButtons();
  bindHookGeneratorControls(product);
  bindProductCommandCenterControls(product);
  document.querySelector("#productNotesForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    product.bestHook = form.get("bestHook") || "";
    product.bestCta = form.get("bestCta") || "";
    product.whatWorked = form.get("whatWorked") || "";
    product.whatToTestNext = form.get("whatToTestNext") || "";
    product.notes = form.get("notes") || "";
    saveData(`Product notes saved for ${product.name}`);
    renderProductDetail(product.id);
  });
};

function bindMorningBriefRoundOneControls() {
  content.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", () => openProduct(button.dataset.productId));
  });
  content.querySelectorAll("[data-brief-revenue-range]").forEach((selectEl) => {
    selectEl.addEventListener("change", (event) => {
      northstarBriefRevenueRanges[event.target.dataset.briefRevenueRange] = event.target.value;
      renderExecutive();
    });
  });
}

function resolvedProductImageSubject(product = {}, sample = {}) {
  const productSrc = productImageUrl(product);
  const sampleSrc = productImageUrl(sample);
  return productSrc && !sampleSrc ? { ...sample, ...product, productName: sample.productName || product.name } : { ...product, ...sample };
}

function sampleRecordKey(sample = {}) {
  return sample.id || sample.productId || sample.relatedProductId || normalizedName(`${sample.account}-${sample.productName}`);
}

function deleteSampleByKey(sampleKey = "") {
  if (!sampleKey) return;
  const before = polarisSamples().length;
  db.samples = polarisSamples().filter((sample) => sampleRecordKey(sample) !== sampleKey);
  db.sampleRecords = db.samples;
  db.sampleRequests = db.samples;
  if (before !== db.samples.length) saveData("Sample removed from Waiting to Film.");
  if (activePage === "products") renderProductsDatabase();
  else renderExecutive();
}

function bindSampleDeleteControls() {
  content.querySelectorAll("[data-delete-sample]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sampleName = button.dataset.sampleName || "this sample";
      if (!confirm(`Delete ${sampleName} from Waiting to Film?`)) return;
      deleteSampleByKey(button.dataset.deleteSample);
    });
  });
}

function dedupeCurrentWaitingToFilmSamples() {
  const samples = polarisSamples();
  const seen = new Set();
  let dashingDivaSeen = false;
  db.samples = samples.filter((sample) => {
    const key = normalizedName(`${sample.account || "Both"}-${sample.productId || sample.relatedProductId || sample.productName}`);
    const isDashingDiva = /dashing\s*diva|glue.?on.*nail|miss\s*me.*nail/i.test(`${sample.productName || ""} ${sample.notes || ""}`);
    if (!isDashingDiva) return true;
    if (dashingDivaSeen || seen.has(key)) return false;
    dashingDivaSeen = true;
    seen.add(key || "dashingdiva");
    return true;
  });
  db.sampleRecords = db.samples;
  db.sampleRequests = db.samples;
}

const northstarLifecycleCleanupEnsureSamplesBase = ensureCurrentWaitingToFilmSamples;
ensureCurrentWaitingToFilmSamples = function ensureCurrentWaitingToFilmSamplesCleanup() {
  northstarLifecycleCleanupEnsureSamplesBase();
  [
    sampleSeedRecord("Raised Right", "Ettika All the Chains Layered Necklace", "Fashion / Jewelry", 12, "1729454831588053819"),
    sampleSeedRecord("Raised Right", "Ettika Locked in Mixed Metal Heart Necklace", "Fashion / Jewelry", 12, "1729418806776730427")
  ].forEach((seed) => {
    const existing = polarisSamples().find((sample) =>
      (seed.productId && (sample.productId === seed.productId || sample.relatedProductId === seed.productId)) ||
      (normalizedName(sample.productName) === normalizedName(seed.productName) && normalizedName(sample.account) === normalizedName(seed.account))
    );
    const target = existing || seed;
    if (!existing) db.samples.push(target);
    target.status = "Waiting to Film";
    target.sampleStatus = target.sampleStatus || "Received";
    target.daysLeft = target.daysLeft ?? seed.daysLeft;
    ensureProductForSample(target);
  });
  dedupeCurrentWaitingToFilmSamples();
  connectProductImagesAcrossLifecycle?.();
};

function sparkAccountMarker(accountName = "") {
  const label = /truth/i.test(accountName) ? "T" : /raised/i.test(accountName) ? "R" : "R/T";
  const klass = /truth/i.test(accountName) ? "truth" : /raised/i.test(accountName) ? "raised" : "both";
  return `<span class="brief-account-marker ${klass}">${label}</span>`;
}

yesterdayLearningsMarkup = function sparkReportMarkupOnlyThree() {
  const seen = new Set();
  const sparks = sparkReportItems().filter((spark) => {
    const key = normalizedName(`${spark.account}-${spark.text}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
  return `
    <section class="card spark-report-card yesterday-learnings-card round-one-pulse">
      <div class="section-title"><div><h3>Spark Report</h3><p>Only the three highest-value Signals.</p></div><span class="badge good">${sparks.length} Sparks</span></div>
      ${sparks.length ? `<div class="spark-report-list compact-pulse-list">${sparks.map((spark) => `<article>${sparkAccountMarker(spark.account)}<div><strong class="clamp-2" title="${escapeAttr(spark.text)}">${escapeHtml(spark.text)}</strong><small>${escapeHtml(spark.note || "Signal detected.")}</small></div></article>`).join("")}</div>` : `<p class="empty">No major Spark detected yet. Northstar is watching your signals.</p>`}
    </section>
  `;
};

const northstarLifecycleCleanupBriefSampleRowsBase = briefSampleRows;
briefSampleRows = function briefSampleRowsWithImagesAndDelete(accountName = "") {
  const waiting = briefSampleListForAccount(accountName);
  if (!waiting.length) return `<p class="empty compact-empty">No samples waiting to film.</p>`;
  return `<div class="brief-sample-rows">${waiting.slice(0, 6).map((sample) => {
    const product = productForSample(sample) || {};
    const productId = sampleProductId(sample);
    const days = sampleDaysLeft(sample);
    const sampleKey = sampleRecordKey(sample);
    const label = sample.productName || product.name || "Sample";
    return `
      <article class="brief-sample-row brief-sample-row-card" title="${escapeAttr(label)}">
        <button class="brief-sample-open" type="button" ${productId ? `data-product-id="${escapeAttr(productId)}"` : ""}>
          ${productImageMarkup(resolvedProductImageSubject(product, sample), label)}
          <span><strong class="clamp-2">${escapeHtml(label)}</strong><small>${escapeHtml(sample.account || accountName || "Both")} ${days === null ? "" : `· ${number.format(days)} days left`}</small></span>
        </button>
        <button class="sample-delete-button" type="button" data-delete-sample="${escapeAttr(sampleKey)}" data-sample-name="${escapeAttr(label)}" aria-label="Delete ${escapeAttr(label)}">Delete</button>
      </article>
    `;
  }).join("")}</div>`;
};

productLifecycleTabs = function productLifecycleTabsCleanup() {
  return ["Waiting to Film", "Filmed", "Posted", "Sales Evaluation", "Hook Testing"];
};

const northstarLifecycleCleanupProductSampleCardBase = productSampleLifecycleCard;
productSampleLifecycleCard = function productSampleLifecycleCardWithDelete(sample) {
  const product = productForSample(sample);
  const id = sampleProductId(sample);
  const daysLeft = sampleDaysLeft(sample);
  const label = sample.productName || product?.name || "Product";
  const sampleKey = sampleRecordKey(sample);
  return `
    <article class="sample-card product-sample-card waiting-film-card ${id ? "clickable" : ""}" ${id ? `data-sample-product-id="${escapeAttr(id)}"` : ""}>
      <div class="waiting-film-image">${productImageMarkup(resolvedProductImageSubject(product || {}, sample), label)}</div>
      <div class="waiting-film-copy">
        <div class="waiting-film-title-row">
          <h4 class="clamp-2" title="${escapeAttr(label)}">${escapeHtml(label)}</h4>
          <button class="sample-delete-button icon-only" type="button" data-delete-sample="${escapeAttr(sampleKey)}" data-sample-name="${escapeAttr(label)}" aria-label="Delete ${escapeAttr(label)}">×</button>
        </div>
        <p>${escapeHtml(sample.account || product?.account || "Both")}</p>
        <div class="workspace-chip-row">
          <span>${daysLeft === null ? "No deadline" : `${number.format(daysLeft)} days left`}</span>
          <span>${escapeHtml(sample.sampleStatus || sample.status || "Waiting to Film")}</span>
        </div>
      </div>
    </article>
  `;
};

const northstarRoundOneRefineMorningBriefBase = refineMorningBriefCommandCenterOrder;
refineMorningBriefCommandCenterOrder = function refineMorningBriefRoundOne() {
  northstarRoundOneRefineMorningBriefBase();
  content.querySelector(".northstar-score-card")?.remove();
  content.querySelector(".todays-direction-card")?.remove();
  content.querySelector(".executive-summary-card")?.remove();
  content.querySelector(".yesterday-learnings-card")?.remove();
  content.querySelector(".upcoming-content-card")?.remove();
  content.querySelector(".decision-log-card")?.remove();
  content.querySelector(".knowledge-vault-card")?.remove();
  content.querySelector(".product-movement-card")?.remove();
  content.querySelector(".import-review-card")?.remove();
  content.querySelector(".pulse-report-card")?.remove();
  content.querySelectorAll(".card, section").forEach((node) => {
    const text = node.querySelector(".section-title h3, h3")?.textContent || "";
    if (/Today.?s Actions|Northstar Score|Upcoming Content Inventory|Decision Log|Knowledge Vault|Product Movement|Import Review|Pulse Report/i.test(text)) node.remove();
  });
  content.querySelector(".yesterday-learnings-card")?.remove();
  const monthly = content.querySelector(".monthly-progress-card");
  if (monthly) monthly.insertAdjacentHTML("afterend", yesterdayLearningsMarkup());
  content.querySelectorAll(".account-brief-card").forEach((card) => card.classList.add("round-one-brief"));
  content.querySelectorAll(".card").forEach((card) => {
    const heading = card.querySelector(".section-title h3, h3")?.textContent || "";
    if (/Category Intelligence/i.test(heading)) card.classList.add("full-width-card", "round-one-category-card");
  });
  bindMorningBriefRoundOneControls();
  bindSampleDeleteControls();
  sanitizeNorthstarLanguage(content);
};

/* TikTok connection + initial import foundation.
   Future API/OAuth work should feed payloads through importTikTokCommercePayload()
   so videos, products, sales, and insights continue using one Polaris source of truth. */
const TIKTOK_IMPORT_START_DEFAULT = "2025-03-01";
let tiktokImportState = { summary: null, errors: [] };

const northstarTikTokNormalizeDatabaseBase = normalizeDatabase;
normalizeDatabase = function normalizeDatabaseWithTikTokLayer() {
  northstarTikTokNormalizeDatabaseBase();
  db.tiktokConnections = Array.isArray(db.tiktokConnections) ? db.tiktokConnections : [];
  db.tiktokImportJobs = Array.isArray(db.tiktokImportJobs) ? db.tiktokImportJobs : [];
  db.tiktokSyncHistory = Array.isArray(db.tiktokSyncHistory) ? db.tiktokSyncHistory : [];
  db.salesRecords = Array.isArray(db.salesRecords) ? db.salesRecords : [];
};

const northstarTikTokCreateCompactLocalDataBase = createCompactLocalData;
createCompactLocalData = function createCompactLocalDataWithTikTokLayer() {
  const compact = northstarTikTokCreateCompactLocalDataBase();
  compact.data.tiktokConnections = db.tiktokConnections || [];
  compact.data.tiktokImportJobs = db.tiktokImportJobs || [];
  compact.data.tiktokSyncHistory = db.tiktokSyncHistory || [];
  return compact;
};

const northstarTikTokDataHubTabsBase = dataHubTabs;
dataHubTabs = function dataHubTabsWithTikTokInitialImport() {
  const tabs = northstarTikTokDataHubTabsBase();
  return tabs.includes("TikTok Initial Import") ? tabs : tabs.map((tab) => tab === "Connections" ? [tab, "TikTok Initial Import"] : tab).flat();
};

const northstarTikTokDataHubTabMarkupBase = dataHubTabMarkup;
dataHubTabMarkup = function dataHubTabMarkupWithTikTokImport(tab) {
  if (tab === "TikTok Initial Import") return tiktokInitialImportMarkup();
  if (tab === "Connections") return `${northstarTikTokDataHubTabMarkupBase(tab)}${tiktokConnectionStatusMarkup()}`;
  return northstarTikTokDataHubTabMarkupBase(tab);
};

const northstarTikTokBindRealDataHubControlsBase = bindRealDataHubControls;
bindRealDataHubControls = function bindRealDataHubControlsWithTikTokImport() {
  northstarTikTokBindRealDataHubControlsBase();
  document.querySelector("#saveTikTokConnection")?.addEventListener("click", saveTikTokConnectionFromForm);
  document.querySelector("#runTikTokInitialImport")?.addEventListener("click", runTikTokInitialImportFromForm);
  document.querySelector("#copyTikTokPayloadTemplate")?.addEventListener("click", async () => {
    const template = tiktokCommercePayloadTemplate();
    try {
      await navigator.clipboard.writeText(template);
      showMessage("TikTok import template copied.", "good");
    } catch {
      showMessage("Template is shown in the import box.", "warn");
    }
  });
};

function tiktokConnectionStatusMarkup() {
  const connections = db.tiktokConnections || [];
  const history = db.tiktokSyncHistory || [];
  return `
    <section class="card data-hub-panel tiktok-status-panel">
      <div class="section-title">
        <div><h3>TikTok Commerce Connection Prep</h3><p>Prepared for one account at a time. Current mode remains Manual / CSV until API approval and secure backend infrastructure exist.</p></div>
        <button class="ghost-button" type="button" data-data-hub-tab="TikTok Initial Import">Open Initial Import</button>
      </div>
      <div class="connected-account-grid">
        ${connections.length ? connections.map((connection) => connectedAccountCard(connection.account || "TikTok Account", connection.status || "Manual / CSV / API Pending", connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt) : "Not synced yet")).join("") : connectedAccountCard("No TikTok account selected", "Manual / CSV / API Pending", "Ready to configure")}
      </div>
      <div class="sync-history-table account-diagnostics-table">
        <table><thead><tr><th>Last sync</th><th>Source</th><th>Account</th><th>Status</th><th>Records</th><th>Notes</th></tr></thead><tbody>
          ${history.slice(0, 5).map((row) => `<tr><td>${formatDateTime(row.syncedAt)}</td><td>${escapeHtml(row.source || "")}</td><td>${escapeHtml(row.account || "")}</td><td>${escapeHtml(row.status || "")}</td><td>${number.format(row.recordsUpdated || 0)}</td><td class="clamp-2" title="${escapeAttr(row.notes || "")}">${escapeHtml(row.notes || "")}</td></tr>`).join("") || `<tr><td colspan="6">No TikTok sync history yet.</td></tr>`}
        </tbody></table>
      </div>
    </section>
  `;
}

function tiktokInitialImportMarkup() {
  const connections = db.tiktokConnections || [];
  const last = connections[0] || {};
  const summary = tiktokImportState.summary;
  return `
    <section class="card data-hub-panel tiktok-initial-import-panel">
      <div class="section-title">
        <div><h3>Connect TikTok Account</h3><p>Set up the account and import useful creator-commerce data from March 1, 2025 forward.</p></div>
        <span class="badge hot">API Pending</span>
      </div>
      <div class="form-grid">
        <label>Account <select id="tiktokImportAccount">${accounts().map((account) => `<option value="${escapeAttr(account.id)}" ${last.accountId === account.id ? "selected" : ""}>${account.name}</option>`).join("")}</select></label>
        <label>Import start date <input id="tiktokImportStartDate" type="date" value="${escapeAttr(last.importStartDate || TIKTOK_IMPORT_START_DEFAULT)}"></label>
        <label>Status <input value="Manual / CSV / API Pending" readonly></label>
        <label>Mode <input value="Initial historical import, then daily incremental sync" readonly></label>
        <label class="full-span">Initial import JSON <textarea id="tiktokInitialImportPayload" class="video-backfill-textarea" rows="12" spellcheck="false" placeholder="${escapeAttr(tiktokCommercePayloadTemplate())}"></textarea></label>
        <div class="form-actions full-span">
          <button class="ghost-button" id="saveTikTokConnection" type="button">Save Connection Prep</button>
          <button class="ghost-button" id="copyTikTokPayloadTemplate" type="button">Copy Template</button>
          <button class="icon-button" id="runTikTokInitialImport" type="button">Run Initial Import</button>
        </div>
      </div>
      <div class="update-center-note">Northstar will import only videos posted on or after ${TIKTOK_IMPORT_START_DEFAULT}, products linked to those videos, and sales tied to those products or videos. Drafts, deleted posts, lives, unrelated products, and older videos are skipped.</div>
      ${summary ? tiktokImportSummaryMarkup(summary) : ""}
    </section>
  `;
}

function tiktokCommercePayloadTemplate() {
  return JSON.stringify({
    videos: [{
      video_id: "7420000000000000000",
      account: "Raised Right",
      video_url: "https://www.tiktok.com/@account/video/7420000000000000000",
      cover_image: "assets/product-images/example-video-cover.png",
      publish_date: "2025-03-01",
      caption: "Caption text",
      hook: "Opening hook text",
      hashtags: ["#tiktokshop", "#shopfinds"],
      duration: 24,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      average_watch_time: 0,
      completion_rate: 0,
      followers_gained: 0,
      linked_product_ids: ["1730000000000000000"],
      is_shop_video: true
    }],
    products: [{
      product_id: "1730000000000000000",
      product_name: "Product name",
      account: "Raised Right",
      seller: "Seller or brand",
      category: "Garden",
      product_image: "assets/product-images/example-product.png",
      price: 19.99,
      commission_rate: 0.15,
      current_status: "Live"
    }],
    sales: [{
      product_id: "1730000000000000000",
      video_id: "7420000000000000000",
      date: "2025-03-01",
      units_sold: 1,
      GMV: 19.99,
      commission: 2.99,
      refunds: 0
    }]
  }, null, 2);
}

function saveTikTokConnectionFromForm() {
  normalizeDatabase();
  const account = getAccount(document.querySelector("#tiktokImportAccount")?.value) || accounts()[0] || {};
  const startDate = normalizeDateKey(document.querySelector("#tiktokImportStartDate")?.value) || TIKTOK_IMPORT_START_DEFAULT;
  const connection = upsertTikTokConnection({
    accountId: account.id,
    account: account.name,
    importStartDate: startDate,
    status: "Manual / CSV / API Pending",
    currentMode: "Manual / CSV",
    futureMode: "Live TikTok Sync",
    lastPreparedAt: new Date().toISOString()
  });
  safeSaveLocalData("tiktok-connection");
  showMessage(`${connection.account} TikTok connection prep saved.`, "good");
  renderDataHub();
}

function runTikTokInitialImportFromForm() {
  normalizeDatabase();
  const account = getAccount(document.querySelector("#tiktokImportAccount")?.value) || accounts()[0] || {};
  const startDate = normalizeDateKey(document.querySelector("#tiktokImportStartDate")?.value) || TIKTOK_IMPORT_START_DEFAULT;
  const payloadText = document.querySelector("#tiktokInitialImportPayload")?.value || "";
  upsertTikTokConnection({
    accountId: account.id,
    account: account.name,
    importStartDate: startDate,
    status: "Manual / CSV / API Pending",
    currentMode: "Manual / CSV",
    futureMode: "Live TikTok Sync",
    lastPreparedAt: new Date().toISOString()
  });
  createPolarisBackupSnapshot(`TikTok initial import: ${account.name}`);
  let summary;
  if (payloadText.trim()) {
    try {
      summary = importTikTokCommercePayload(JSON.parse(payloadText), { account, startDate, source: "TikTok Initial Import" });
    } catch (error) {
      summary = emptyTikTokImportSummary(account.name, startDate);
      summary.errors.push({ message: error.message || "Could not read TikTok import JSON." });
    }
  } else {
    summary = emptyTikTokImportSummary(account.name, startDate);
    summary.notes.push("Connection prep saved. Paste a TikTok/TikTok Shop export payload to import records.");
  }
  tiktokImportState.summary = summary;
  writeTikTokSyncHistory(summary, "Initial Import");
  recordDataSource("videos", "TikTok Initial Import", `${account.name} from ${startDate}`);
  recordDataSource("products", "TikTok Initial Import", "Linked products only");
  recordDataSource("salesRecords", "TikTok Initial Import", "Sales tied to linked videos/products");
  safeSaveLocalData("tiktok-initial-import");
  if (summary.errors.length) showMessage("TikTok import finished with items to review.", "warn");
  else showMessage("TikTok initial import saved to Polaris.", "good");
  if (typeof initializePulseEngine === "function") initializePulseEngine("tiktok-initial-import");
  renderDataHub();
}

function upsertTikTokConnection(connection) {
  db.tiktokConnections = db.tiktokConnections || [];
  const existing = db.tiktokConnections.find((item) => item.accountId === connection.accountId || normalizedName(item.account) === normalizedName(connection.account));
  if (existing) Object.assign(existing, connection);
  else db.tiktokConnections.unshift({ id: uniqueImportId(`tiktok-connection-${connection.accountId || slug(connection.account)}`), ...connection });
  return existing || db.tiktokConnections[0];
}

function emptyTikTokImportSummary(account, startDate) {
  return {
    account,
    startDate,
    importedAt: new Date().toISOString(),
    videosAdded: 0,
    videosUpdated: 0,
    productsAdded: 0,
    productsUpdated: 0,
    salesAdded: 0,
    salesUpdated: 0,
    skippedOlderVideos: 0,
    skippedUnrelatedProducts: 0,
    skippedUnrelatedSales: 0,
    errors: [],
    notes: []
  };
}

function importTikTokCommercePayload(payload, options = {}) {
  const account = options.account || accounts()[0] || {};
  const startDate = normalizeDateKey(options.startDate) || TIKTOK_IMPORT_START_DEFAULT;
  const summary = emptyTikTokImportSummary(account.name, startDate);
  const rawVideos = Array.isArray(payload?.videos) ? payload.videos : [];
  const rawProducts = Array.isArray(payload?.products) ? payload.products : [];
  const rawSales = Array.isArray(payload?.sales) ? payload.sales : Array.isArray(payload?.salesRecords) ? payload.salesRecords : [];
  const normalizedVideos = rawVideos.map((row, index) => normalizeTikTokVideo(row, { account, startDate, rowNumber: index + 1 }));
  normalizedVideos.forEach((row) => {
    if (row.error) {
      if (row.error === "older") summary.skippedOlderVideos += 1;
      else summary.errors.push({ rowNumber: row.rowNumber, message: row.error });
    }
  });
  const videosToImport = normalizedVideos.filter((row) => !row.error);
  const allowedVideoIds = new Set(videosToImport.map((video) => video.videoId));
  const allowedProductIds = new Set(videosToImport.flatMap((video) => video.linkedProductIds || []).filter(Boolean).map(String));
  const productsByExternalId = new Map();

  rawProducts.forEach((row, index) => {
    const product = normalizeTikTokProduct(row, { account, rowNumber: index + 1 });
    if (product.error) {
      summary.errors.push({ rowNumber: product.rowNumber, message: product.error });
      return;
    }
    if (allowedProductIds.size && product.externalProductId && !allowedProductIds.has(String(product.externalProductId))) {
      summary.skippedUnrelatedProducts += 1;
      return;
    }
    if (!allowedProductIds.size && !videosToImport.some((video) => normalizedName(video.productName) === normalizedName(product.name))) {
      summary.skippedUnrelatedProducts += 1;
      return;
    }
    const result = upsertTikTokProduct(product);
    productsByExternalId.set(String(product.externalProductId || ""), result.product);
    summary[result.status === "added" ? "productsAdded" : "productsUpdated"] += 1;
  });

  videosToImport.forEach((video) => {
    const linkedProduct = findTikTokProductForVideo(video, productsByExternalId, account);
    if (linkedProduct) {
      video.productId = linkedProduct.id;
      video.productName = linkedProduct.name;
      video.category = video.category || linkedProduct.categoryGroup || linkedProduct.category || "Imported";
      linkedProduct.relatedVideoIds = unique([...(linkedProduct.relatedVideoIds || []), video.videoId]);
      if (!linkedProduct.firstVideoDate || video.datePosted < linkedProduct.firstVideoDate) linkedProduct.firstVideoDate = video.datePosted;
      if (!linkedProduct.lastVideoDate || video.datePosted > linkedProduct.lastVideoDate) linkedProduct.lastVideoDate = video.datePosted;
    }
    const result = upsertTikTokVideo(video);
    summary[result === "added" ? "videosAdded" : "videosUpdated"] += 1;
  });

  rawSales.forEach((row, index) => {
    const sale = normalizeTikTokSale(row, { account, rowNumber: index + 1 });
    if (sale.error) {
      summary.errors.push({ rowNumber: sale.rowNumber, message: sale.error });
      return;
    }
    const saleHasVideo = Boolean(sale.videoId);
    const saleHasProduct = Boolean(sale.externalProductId);
    const videoAllowed = saleHasVideo && allowedVideoIds.has(String(sale.videoId));
    const productAllowed = saleHasProduct && (allowedProductIds.has(String(sale.externalProductId)) || productsByExternalId.has(String(sale.externalProductId)));
    if ((saleHasVideo && !videoAllowed) || (!saleHasVideo && saleHasProduct && !productAllowed)) {
      summary.skippedUnrelatedSales += 1;
      return;
    }
    const result = upsertTikTokSale(sale, productsByExternalId);
    summary[result === "added" ? "salesAdded" : "salesUpdated"] += 1;
  });

  if (typeof connectProductImagesAcrossLifecycle === "function") connectProductImagesAcrossLifecycle();
  if (typeof normalizeVideoDatabase === "function") normalizeVideoDatabase();
  db.tiktokImportJobs = db.tiktokImportJobs || [];
  db.tiktokImportJobs.unshift({ id: uniqueImportId(`tiktok-job-${Date.now()}`), ...summary, source: options.source || "TikTok Initial Import" });
  db.tiktokImportJobs = db.tiktokImportJobs.slice(0, 40);
  return summary;
}

function normalizeTikTokVideo(raw, context) {
  const value = (names) => backfillValue(raw, names);
  const resolvedAccount = resolveBackfillAccount(value(["account", "creator account", "workspace"]));
  const account = resolvedAccount.id ? resolvedAccount : context.account || {};
  const videoId = value(["video_id", "video id", "videoId", "id"]);
  const datePosted = normalizeDateKey(value(["publish_date", "publish date", "date posted", "datePosted", "posted date", "date"]));
  const status = normalizedName(value(["status", "video status", "type"]));
  if (!videoId) return { rowNumber: context.rowNumber, error: "Video ID is required." };
  if (!datePosted) return { rowNumber: context.rowNumber, error: "Publish date is required." };
  if (datePosted && datePosted < context.startDate) return { rowNumber: context.rowNumber, error: "older" };
  if (/draft|deleted|live/.test(status)) return { rowNumber: context.rowNumber, error: "Drafts, deleted videos, and lives are excluded." };
  const linkedProductIds = parseLinkedProductIds(value(["linked_product_ids", "linked product ids", "product_ids", "product id", "product_id"]));
  const productName = value(["product_name", "product name", "product", "product/topic"]);
  return {
    rowNumber: context.rowNumber,
    id: uniqueImportId(`tiktok-video-${videoId}`),
    videoId,
    tiktokVideoId: videoId,
    accountId: account.id || context.account?.id,
    account: account.name || context.account?.name,
    videoUrl: value(["video_url", "video url", "url", "permalink"]),
    coverImage: value(["cover_image", "cover image", "thumbnail", "video thumbnail"]),
    thumbnail: value(["thumbnail", "cover_image", "cover image"]),
    datePosted,
    publishDate: datePosted,
    caption: value(["caption", "description"]),
    hook: value(["hook/opening text", "opening text", "hook", "opening line"]) || value(["caption", "description"]),
    hashtags: parseHashtags(value(["hashtags", "tags"])),
    duration: toNumber(value(["duration", "video length", "length"])),
    views: toNumber(value(["views"])),
    likes: toNumber(value(["likes"])),
    comments: toNumber(value(["comments"])),
    shares: toNumber(value(["shares"])),
    saves: toNumber(value(["saves", "favorites", "saves/favorites"])),
    averageWatchTime: toNumber(value(["average_watch_time", "average watch time", "avg watch time"])),
    completionRate: toNumber(value(["completion_rate", "completion rate", "completion %", "completion"])),
    newFollowers: toNumber(value(["followers_gained", "followers gained", "new followers"])),
    linkedProductIds,
    productName,
    isShopVideo: parseBoolean(value(["is_shop_video", "shop video", "is shop video"])) || linkedProductIds.length > 0,
    category: value(["category", "product category"]),
    sales: toNumber(value(["sales", "units sold", "items sold"])),
    gmv: toNumber(value(["gmv", "gross revenue", "revenue"])),
    commission: toNumber(value(["commission", "creator commission"])),
    source: "TikTok Initial Import",
    importedAt: new Date().toISOString(),
    raw
  };
}

function normalizeTikTokProduct(raw, context) {
  const value = (names) => backfillValue(raw, names);
  const resolvedAccount = resolveBackfillAccount(value(["account", "creator account", "workspace"]));
  const account = resolvedAccount.id ? resolvedAccount : context.account || {};
  const externalProductId = value(["product_id", "product id", "productId", "id"]);
  const name = value(["product_name", "product name", "name", "product"]);
  if (!externalProductId && !name) return { rowNumber: context.rowNumber, error: "Product ID or Product Name is required." };
  return {
    rowNumber: context.rowNumber,
    id: uniqueImportId(`tiktok-product-${externalProductId || slug(name)}`),
    externalProductId,
    tiktokProductId: externalProductId,
    productId: externalProductId,
    name,
    productName: name,
    accountId: account.id || context.account?.id,
    account: account.name || context.account?.name,
    seller: value(["seller", "brand", "seller/brand"]),
    brand: value(["seller", "brand", "seller/brand"]),
    categoryGroup: value(["category", "product category"]) || "Imported",
    category: value(["category", "product category"]) || "Imported",
    imageUrl: value(["product_image", "product image", "image", "imageUrl", "thumbnail"]),
    productImage: value(["product_image", "product image", "image", "thumbnail"]),
    price: toNumber(value(["price", "current price"])),
    commissionRate: toNumber(value(["commission_rate", "commission rate", "estimated commission rate"])),
    estimatedCommission: toNumber(value(["estimated commission", "commission estimate"])),
    status: value(["current_status", "current status", "status"]) || "Live",
    source: "TikTok Initial Import",
    relatedVideoIds: parseLinkedProductIds(value(["related_video_ids", "related video ids", "video_ids", "video id"])),
    userCreated: true
  };
}

function normalizeTikTokSale(raw, context) {
  const value = (names) => backfillValue(raw, names);
  const resolvedAccount = resolveBackfillAccount(value(["account", "creator account", "workspace"]));
  const account = resolvedAccount.id ? resolvedAccount : context.account || {};
  const externalProductId = value(["product_id", "product id", "productId"]);
  const videoId = value(["video_id", "video id", "videoId"]);
  const date = normalizeDateKey(value(["date", "sale date", "order date"])) || todayDate(new Date());
  if (!externalProductId && !videoId) return { rowNumber: context.rowNumber, error: "Sales need a Product ID or Video ID." };
  return {
    rowNumber: context.rowNumber,
    accountId: account.id || context.account?.id,
    account: account.name || context.account?.name,
    externalProductId,
    tiktokProductId: externalProductId,
    videoId,
    date,
    unitsSold: toNumber(value(["units_sold", "units sold", "items sold", "sales"])),
    gmv: toNumber(value(["GMV", "gmv", "gross revenue", "revenue"])),
    commission: toNumber(value(["commission", "creator commission"])),
    refunds: toNumber(value(["refunds", "refund"])),
    source: "TikTok Initial Import",
    importedAt: new Date().toISOString(),
    raw
  };
}

function upsertTikTokProduct(product) {
  const existing = products().find((item) => {
    const ids = [item.externalProductId, item.tiktokProductId, item.productId].filter(Boolean).map(String);
    return product.externalProductId && ids.includes(String(product.externalProductId));
  }) || products().find((item) => normalizedName(item.name) === normalizedName(product.name) && normalizedName(item.account) === normalizedName(product.account));
  const target = existing || product;
  Object.assign(target, {
    ...product,
    id: target.id || product.id,
    notes: target.notes || product.notes || "",
    bestHook: target.bestHook || product.bestHook || "",
    bestCta: target.bestCta || product.bestCta || "",
    sampleStatus: target.sampleStatus || product.sampleStatus || "",
    strategyNotes: target.strategyNotes || product.strategyNotes || "",
    imageUrl: target.imageUrl || product.imageUrl || product.productImage || "",
    productImage: target.productImage || product.productImage || product.imageUrl || "",
    relatedVideoIds: unique([...(target.relatedVideoIds || []), ...(product.relatedVideoIds || [])])
  });
  if (!existing) db.products.push(target);
  return { status: existing ? "updated" : "added", product: target };
}

function upsertTikTokVideo(video) {
  db.videos = db.videos || [];
  const existing = db.videos.find((item) => String(item.videoId || item.tiktokVideoId || item.video_id || "") === String(video.videoId));
  const target = existing || { id: video.id };
  Object.assign(target, {
    ...video,
    id: target.id || video.id,
    title: video.caption || video.hook || target.title || "",
    datePosted: video.datePosted,
    postedAt: video.datePosted,
    thumbnail: target.thumbnail || video.thumbnail || video.coverImage || "",
    coverImage: target.coverImage || video.coverImage || video.thumbnail || "",
    videoLink: video.videoUrl || target.videoLink || "",
    source: "TikTok Initial Import"
  });
  if (!existing) db.videos.push(target);
  return existing ? "updated" : "added";
}

function upsertTikTokSale(sale, productsByExternalId = new Map()) {
  db.salesRecords = db.salesRecords || [];
  const product = productsByExternalId.get(String(sale.externalProductId || "")) || products().find((item) => [item.externalProductId, item.tiktokProductId, item.productId].filter(Boolean).map(String).includes(String(sale.externalProductId || "")));
  const video = sale.videoId ? videos().find((item) => String(item.videoId || item.tiktokVideoId || "") === String(sale.videoId)) : null;
  const existing = db.salesRecords.find((record) => String(record.videoId || record.tiktokVideoId || "") === String(sale.videoId || "") && String(record.externalProductId || record.tiktokProductId || record.productId || "") === String(sale.externalProductId || product?.id || "") && normalizeDateKey(record.date || record.capturedAt || "") === sale.date);
  const target = existing || { id: uniqueImportId(`tiktok-sale-${sale.externalProductId || product?.id}-${sale.videoId || "product"}-${sale.date}`) };
  const previous = existing ? { unitsSold: Number(target.unitsSold || 0), gmv: Number(target.gmv || 0), commission: Number(target.commission || 0) } : { unitsSold: 0, gmv: 0, commission: 0 };
  Object.assign(target, {
    ...sale,
    productId: product?.id || sale.externalProductId,
    productName: product?.name || sale.productName || "",
    videoRecordId: video?.id || "",
    category: product?.categoryGroup || product?.category || sale.category || "",
    source: "TikTok Initial Import"
  });
  if (!existing) db.salesRecords.unshift(target);
  if (product) {
    applySnapshotToProduct(product, {
      capturedAt: sale.date,
      sales: sale.unitsSold - previous.unitsSold,
      gmv: sale.gmv - previous.gmv,
      commission: sale.commission - previous.commission
    });
  }
  if (video) {
    video.sales = Math.max(Number(video.sales || 0), sale.unitsSold || 0);
    video.gmv = Math.max(Number(video.gmv || 0), sale.gmv || 0);
    video.commission = Math.max(Number(video.commission || 0), sale.commission || 0);
  }
  return existing ? "updated" : "added";
}

function findTikTokProductForVideo(video, productsByExternalId, account) {
  const linked = (video.linkedProductIds || []).map(String);
  for (const productId of linked) {
    const mapped = productsByExternalId.get(productId);
    if (mapped) return mapped;
    const existing = products().find((product) => [product.externalProductId, product.tiktokProductId, product.productId].filter(Boolean).map(String).includes(productId));
    if (existing) return existing;
  }
  if (video.productName) return ensureImportedProduct(video.productName, account, video.category || "Imported");
  return null;
}

function findExistingTikTokProductForVideo(video = {}) {
  const directProduct = video.productId ? getProduct(video.productId) : null;
  if (directProduct) return directProduct;
  const linked = (video.linkedProductIds || []).map(String);
  const byLinkedId = products().find((product) => {
    const productIds = [product.externalProductId, product.tiktokProductId, product.productId, product.id].filter(Boolean).map(String);
    return linked.some((linkedId) => productIds.includes(linkedId));
  });
  if (byLinkedId) return byLinkedId;
  if (!video.productName) return null;
  return products().find((product) => normalizedName(product.name) === normalizedName(video.productName) && (!video.account || normalizedName(product.account) === normalizedName(video.account))) || null;
}

function parseLinkedProductIds(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "").split(/[,\n|;]+/).map((item) => item.trim()).filter(Boolean);
}

function parseHashtags(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(/[\s,]+/).map((tag) => tag.trim()).filter((tag) => tag.startsWith("#"));
}

function parseBoolean(value) {
  return /^(true|yes|y|1)$/i.test(String(value || "").trim());
}

function writeTikTokSyncHistory(summary, source) {
  db.tiktokSyncHistory = db.tiktokSyncHistory || [];
  const recordsUpdated = summary.videosAdded + summary.videosUpdated + summary.productsAdded + summary.productsUpdated + summary.salesAdded + summary.salesUpdated;
  db.tiktokSyncHistory.unshift({
    id: uniqueImportId(`tiktok-sync-${Date.now()}`),
    syncedAt: new Date().toISOString(),
    source,
    account: summary.account,
    status: summary.errors.length ? "Needs Review" : "Prepared",
    recordsUpdated,
    notes: summary.notes.join(" ") || `Imported from ${summary.startDate} forward.`
  });
  db.tiktokSyncHistory = db.tiktokSyncHistory.slice(0, 80);
  const connection = (db.tiktokConnections || []).find((item) => normalizedName(item.account) === normalizedName(summary.account));
  if (connection) connection.lastSyncedAt = new Date().toISOString();
}

function tiktokImportSummaryMarkup(summary) {
  return `
    <div class="import-summary tiktok-import-summary">
      <div class="monthly-progress-grid">
        ${metric("Videos", `${number.format(summary.videosAdded)} added`, `${number.format(summary.videosUpdated)} updated`, "")}
        ${metric("Products", `${number.format(summary.productsAdded)} added`, `${number.format(summary.productsUpdated)} updated`, "")}
        ${metric("Sales", `${number.format(summary.salesAdded)} added`, `${number.format(summary.salesUpdated)} updated`, "")}
        ${metric("Skipped", number.format(summary.skippedOlderVideos + summary.skippedUnrelatedProducts + summary.skippedUnrelatedSales), "Outside import scope", "")}
      </div>
      ${summary.errors.length ? `<div class="error-list">${summary.errors.slice(0, 8).map((error) => `<p>${escapeHtml(error.message || error)}</p>`).join("")}</div>` : `<p class="subtle-note">Import scope respected: videos from ${escapeHtml(summary.startDate)} forward, linked products only, related sales only.</p>`}
      ${summary.notes.length ? `<p class="subtle-note">${escapeHtml(summary.notes.join(" "))}</p>` : ""}
    </div>
  `;
}

const northstarTikTokRenderVideoDetailBase = renderVideoDetail;
renderVideoDetail = function renderVideoDetailWithTikTokCommerce(videoId) {
  const video = videos().find((item) => item.id === videoId || item.videoId === videoId || item.tiktokVideoId === videoId);
  if (!video) {
    northstarTikTokRenderVideoDetailBase(videoId);
    return;
  }
  const product = findExistingTikTokProductForVideo(video);
  const link = videoLink(video);
  content.innerHTML = `
    <button class="back-button" data-product-id="${escapeAttr(video.productId || product?.id || selectedVideoBackProductId || "")}">Back to Product</button>
    <div class="detail-header intelligence-detail video-detail-header">
      <div class="product-detail-title-with-image">
        ${videoCoverMarkup(video)}
        <div><span class="badge">${videoPerformanceStatus(video)}</span><h3>${escapeHtml(videoTitle(video))}</h3><p>${escapeHtml(video.account || "")} · ${compactDate(video.datePosted || video.postedAt)} · ${escapeHtml(product?.name || video.productName || "Linked product pending")}</p></div>
      </div>
      ${link ? `<a class="ghost-button" href="${escapeAttr(link)}" target="_blank" rel="noreferrer">Open Video Link</a>` : ""}
    </div>
    <section class="card">
      <div class="section-title"><div><h3>Commerce Signals</h3><p>Video to product to sales/GMV/commission.</p></div></div>
      <div class="grid four">
        ${metric("Views", number.format(video.views || 0), "Reach", "")}
        ${metric("GMV", money.format(video.gmv || 0), "Revenue", "")}
        ${metric("Commission", money.format(video.commission || 0), "Earnings", "")}
        ${metric("Units", number.format(video.sales || 0), "Sold", "")}
      </div>
      <div class="grid four">
        ${metric("Saves", number.format(video.saves || 0), "Intent", "")}
        ${metric("Shares", number.format(video.shares || 0), "Distribution", "")}
        ${metric("Watch Time", `${Number(video.averageWatchTime || 0).toFixed(1)}s`, "Average", "")}
        ${metric("Completion", `${Number(video.completionRate || 0).toFixed(1)}%`, "Retention", "")}
      </div>
      <div class="grid two">
        <article class="mini-card"><span>Linked product IDs</span><strong class="clamp-2" title="${escapeAttr((video.linkedProductIds || []).join(", "))}">${escapeHtml((video.linkedProductIds || []).join(", ") || product?.externalProductId || product?.tiktokProductId || "Not linked yet")}</strong></article>
        <article class="mini-card"><span>Hashtags</span><strong class="clamp-2" title="${escapeAttr((video.hashtags || []).join(" "))}">${escapeHtml((video.hashtags || []).join(" ") || "Not imported yet")}</strong></article>
      </div>
      ${video.caption ? `<p class="subtle-note clamp-3" title="${escapeAttr(video.caption)}">${escapeHtml(video.caption)}</p>` : ""}
    </section>
  `;
  bindInternalButtons();
};

const northstarTikTokRunNorthstarUpdateBase = runNorthstarUpdate;
runNorthstarUpdate = function runNorthstarUpdateWithTikTokSyncFoundation(source, account) {
  const result = northstarTikTokRunNorthstarUpdateBase(source, account);
  if (/tiktok/i.test(source || "")) {
    const accountName = account || "All accounts";
    const summary = emptyTikTokImportSummary(accountName, TIKTOK_IMPORT_START_DEFAULT);
    summary.notes.push("Future live sync placeholder. No API connection is active in this local version.");
    writeTikTokSyncHistory(summary, source);
    safeSaveLocalData("tiktok-sync-placeholder");
  }
  return result;
};

/* Fast boot: paint Northstar before heavy historical imports, image linking, or Pulse snapshots run. */
window.NORTHSTAR_FAST_BOOT_ACTIVE = true;
let northstarDeferredWarmupStarted = false;

const northstarFastBootInitializePulseEngineBase = initializePulseEngine;
initializePulseEngine = function initializePulseEngineAfterBoot(reason = "snapshot") {
  if (window.NORTHSTAR_FAST_BOOT_ACTIVE) {
    pulseState.snapshots = cachedPulseSnapshots();
    pulseState.current = pulseState.snapshots.at(-1) || null;
    pulseState.previous = pulseState.snapshots.length > 1 ? pulseState.snapshots.at(-2) : null;
    pulseState.comparison = pulseState.current && pulseState.previous ? comparePulseSnapshots(pulseState.previous, pulseState.current) : null;
    pulseState.log = readJson(DECISION_LOG_KEY, []);
    return;
  }
  return northstarFastBootInitializePulseEngineBase(reason);
};

const northstarFullLoadDataForIdle = loadData;
loadData = function loadDataFastBoot() {
  const bootStartedAt = Date.now();
  defaultDb = clone(window.PROJECT_FLYWHEEL_DB || {});
  db = clone(defaultDb);
  recordNorthstarStartupDiagnostic("local data restore deferred until idle");
  normalizeDatabase();
  ensureCurrentWaitingToFilmSamples?.();
  renderNav();
  renderPage("executive");
  updateLastSavedDisplay();
  recordNorthstarStartupDiagnostic("fast boot painted", null, { ms: Date.now() - bootStartedAt });
  scheduleNorthstarDeferredWarmup();
};

function scheduleNorthstarDeferredWarmup() {
  if (northstarDeferredWarmupStarted) return;
  northstarDeferredWarmupStarted = true;
  const warmup = () => {
    try {
      window.NORTHSTAR_FAST_BOOT_ACTIVE = false;
      let savedRaw = "";
      try {
        savedRaw = localStorage.getItem(STORAGE_KEY) || "";
      } catch (error) {
        recordNorthstarStartupDiagnostic("deferred localStorage read skipped", error);
      }
      if (savedRaw) {
        try {
          db = mergeDatabase(db, JSON.parse(savedRaw));
          recordNorthstarStartupDiagnostic("saved data restored after paint", null, { bytes: savedRaw.length });
        } catch (error) {
          recordNorthstarStartupDiagnostic("saved data restore skipped", error, { bytes: savedRaw.length });
        }
      }
      applyNorthstarSeedData?.();
      normalizeDatabase();
      ensureCurrentWaitingToFilmSamples?.();
      normalizeDatabase();
      validateNorthstarDatabaseShape();
      initializePulseEngine("idle-warmup");
      recordNorthstarStartupDiagnostic("idle warmup complete");
      if (activePage === "executive") showMessage("Northstar finished loading background data.", "good");
    } catch (error) {
      recordNorthstarStartupDiagnostic("idle warmup skipped", error);
      console.warn("Northstar skipped idle warmup safely.", error);
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(warmup, { timeout: 5000 });
  else setTimeout(warmup, 1800);
}

function safeNorthstarStartup() {
  try {
    recordNorthstarStartupDiagnostic("startup begin");
    loadData();
    validateNorthstarDatabaseShape();
    recordNorthstarStartupDiagnostic("app initialized");
  } catch (error) {
    recordNorthstarStartupDiagnostic("startup failed", error);
    console.error("Northstar startup failed safely.", error);
    northstarStartupErrorPanel(error);
  }
}

safeNorthstarStartup();
