(function () {
  const data = window.NORTHSTAR_SANDBOX_DATA;
  const state = {
    page: "brief",
    accountId: "all",
    dateRange: "month",
    customStart: "2026-07-01",
    customEnd: "2026-07-16",
    earningsSource: "all",
    productSort: "earnings",
    videoSort: "views",
    productVideoSort: "date",
    selectedProductId: null,
    selectedVideoId: null
  };

  const navItems = [
    ["brief", "Morning Brief"],
    ["opportunities", "Opportunity Center"],
    ["earnings", "Earnings"],
    ["products", "Products"],
    ["videos", "Videos"],
    ["data", "Data Hub"],
    ["settings", "Settings"]
  ];

  const els = {
    nav: document.getElementById("sidebarNav"),
    title: document.getElementById("pageTitle"),
    content: document.getElementById("content"),
    account: document.getElementById("accountSelect"),
    date: document.getElementById("dateSelect"),
    custom: document.getElementById("customRange"),
    customStart: document.getElementById("customStart"),
    customEnd: document.getElementById("customEnd"),
    modal: document.getElementById("modalRoot")
  };

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  const number = new Intl.NumberFormat("en-US");

  function accountName(id) {
    const account = data.accounts.find((item) => item.id === id);
    return account ? account.name : "All Accounts";
  }

  function sourceName(id) {
    const source = data.revenueSources.find((item) => item.id === id);
    return source ? source.name : "All Earnings";
  }

  function dateWindow() {
    const today = new Date("2026-07-16T12:00:00");
    if (state.dateRange === "today") {
      return [new Date("2026-07-16T00:00:00"), new Date("2026-07-16T23:59:59")];
    }
    if (state.dateRange === "week") {
      return [new Date("2026-07-10T00:00:00"), today];
    }
    if (state.dateRange === "custom") {
      return [new Date(`${state.customStart}T00:00:00`), new Date(`${state.customEnd}T23:59:59`)];
    }
    return [new Date("2026-07-01T00:00:00"), today];
  }

  function inDateRange(item) {
    const [start, end] = dateWindow();
    const itemDate = new Date(`${item.date || item.updatedAt}T12:00:00`);
    return itemDate >= start && itemDate <= end;
  }

  function accountMatches(item) {
    return state.accountId === "all" || item.accountId === state.accountId;
  }

  function sourceMatches(video) {
    return state.earningsSource === "all" || video.sourceIds.includes(state.earningsSource);
  }

  function filteredVideos(extra = {}) {
    return data.videos
      .filter(accountMatches)
      .filter(inDateRange)
      .filter(sourceMatches)
      .filter((video) => !extra.productId || video.productId === extra.productId);
  }

  function filteredProducts() {
    const videos = filteredVideos();
    const activeProductIds = new Set(videos.map((video) => video.productId));
    return data.products
      .filter(accountMatches)
      .filter((product) => activeProductIds.has(product.id) || inDateRange(product));
  }

  function periodTotals() {
    const videos = filteredVideos();
    const products = filteredProducts();
    const accountIds = state.accountId === "all" ? data.accounts.map((a) => a.id) : [state.accountId];
    const followers = data.accounts
      .filter((account) => accountIds.includes(account.id))
      .reduce((sum, account) => sum + account.followers, 0);
    const followerChange = data.accounts
      .filter((account) => accountIds.includes(account.id))
      .reduce((sum, account) => sum + account.followerChange, 0);

    return {
      followers,
      followerChange,
      views: videos.reduce((sum, video) => sum + video.views, 0),
      videos: videos.length,
      earnings: videos.reduce((sum, video) => sum + video.earnings, 0),
      gmv: videos.reduce((sum, video) => sum + video.gmv, 0),
      units: videos.reduce((sum, video) => sum + video.units, 0),
      products: products.length
    };
  }

  function bySource(sourceId) {
    return filteredVideos()
      .filter((video) => sourceId === "all" || video.sourceIds.includes(sourceId))
      .reduce((sum, video) => sum + video.earnings, 0);
  }

  function topVideos(limit = 4) {
    return [...filteredVideos()]
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, limit);
  }

  function topProducts(limit = 4) {
    return [...filteredProducts()]
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, limit);
  }

  function productVideos(productId) {
    return data.videos.filter((video) => video.productId === productId);
  }

  function sortItems(items, key) {
    const copy = [...items];
    const sorters = {
      earnings: (a, b) => b.earnings - a.earnings,
      sales: (a, b) => (b.sales || b.units) - (a.sales || a.units),
      views: (a, b) => b.views - a.views,
      recent: (a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date),
      date: (a, b) => new Date(b.date) - new Date(a.date),
      time: (a, b) => minutes(b.time) - minutes(a.time)
    };
    return copy.sort(sorters[key] || sorters.earnings);
  }

  function minutes(time) {
    const match = time.match(/(\d+):(\d+) (AM|PM)/);
    if (!match) return 0;
    let hours = Number(match[1]);
    const mins = Number(match[2]);
    if (match[3] === "PM" && hours < 12) hours += 12;
    if (match[3] === "AM" && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  function setPage(page, detailId) {
    state.page = page;
    if (page === "product-detail") state.selectedProductId = detailId;
    if (page === "video-detail") state.selectedVideoId = detailId;
    render();
    els.content.focus({ preventScroll: true });
  }

  function card(title, value, detail, tone = "") {
    return `
      <article class="card metric-card ${tone}">
        <span class="label">${title}</span>
        <strong>${value}</strong>
        <p>${detail}</p>
      </article>
    `;
  }

  function thumbnail(text) {
    return `<span class="thumb" aria-hidden="true">${text}</span>`;
  }

  function actionButton(label, action, id = "") {
    return `<button class="text-button" type="button" data-action="${action}" data-id="${id}">${label}</button>`;
  }

  function renderBrief() {
    const totals = periodTotals();
    const videos = topVideos(3);
    const products = topProducts(3);
    const insight = state.accountId === "raised-right"
      ? "Raised Right is getting its strongest shop signal from evening problem-solver videos."
      : state.accountId === "truth-tuned-tribe"
        ? "Truth Tuned Tribe is earning best when curiosity opens into a useful explanation."
        : "Across both accounts, product videos earn fastest when the first line creates curiosity.";
    const opportunity = data.opportunities.find((opp) => state.accountId === "all" || opp.accountId === state.accountId);

    return `
      <section class="hero-grid">
        ${card("Followers", number.format(totals.followers), `+${number.format(totals.followerChange)} this period`, "navy")}
        ${card("Views", number.format(totals.views), "Selected date range", "teal")}
        ${card("Videos Posted", totals.videos, readableRange(), "white")}
        ${card("Total Earnings", money.format(totals.earnings), accountName(state.accountId), "gold")}
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Earning Sources</p>
            <h3>Where the money is coming from</h3>
          </div>
        </div>
        <div class="source-grid">
          ${data.revenueSources.map((source) => `
            <button class="card source-card ${source.color}" type="button" data-action="open-earnings" data-id="${source.id}">
              <span>${source.name}</span>
              <strong>${money.format(bySource(source.id))}</strong>
              <small>Open earnings view</small>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="two-column">
        <div class="section">
          <div class="section-heading"><h3>Top Performing Videos</h3></div>
          <div class="stack">${videos.map(renderVideoRow).join("") || emptyState("No videos in this range.")}</div>
        </div>
        <div class="section">
          <div class="section-heading"><h3>Top Performing Products</h3></div>
          <div class="stack">${products.map(renderProductRow).join("") || emptyState("No products in this range.")}</div>
        </div>
      </section>

      <section class="two-column">
        <button class="card insight-card" type="button">
          <span class="label">Northstar Insight</span>
          <strong>${insight}</strong>
        </button>
        <button class="card insight-card warm" type="button" data-action="open-${opportunity.targetType}" data-id="${opportunity.targetId}">
          <span class="label">Opportunity</span>
          <strong>${opportunity.title}</strong>
          <p>${opportunity.body}</p>
        </button>
      </section>
    `;
  }

  function renderEarnings() {
    const sources = [{ id: "all", name: "All Earnings", color: "navy" }, ...data.revenueSources];
    const totals = periodTotals();
    const max = Math.max(...data.dailyEarnings.map((day) => day.raisedRight + day.truthTunedTribe));

    return `
      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Earnings</p>
            <h3>${sourceName(state.earningsSource)} overview</h3>
          </div>
          ${selectControl("earningsSource", sources.map((s) => [s.id, s.name]), state.earningsSource)}
        </div>
        <div class="hero-grid">
          ${card("All Earnings", money.format(totals.earnings), readableRange(), "gold")}
          ${card("GMV", money.format(totals.gmv), "TikTok Shop mock detail", "white")}
          ${card("Units Sold", number.format(totals.units), "Across selected videos", "teal")}
          ${card("Products Active", totals.products, accountName(state.accountId), "navy")}
        </div>
        <div class="chart-card">
          <div class="bar-chart" aria-label="Earnings over time">
            ${data.dailyEarnings.map((day) => {
              const value = state.accountId === "raised-right" ? day.raisedRight : state.accountId === "truth-tuned-tribe" ? day.truthTunedTribe : day.raisedRight + day.truthTunedTribe;
              const height = Math.max(10, Math.round((value / max) * 100));
              return `<span title="${day.date}: ${money.format(value)}" style="--height:${height}%"><i>${money.format(value)}</i></span>`;
            }).join("")}
          </div>
        </div>
      </section>

      <section class="two-column">
        ${data.revenueSources.map((source) => `
          <article class="card detail-card">
            <span class="label">${source.name}</span>
            <strong>${money.format(bySource(source.id))}</strong>
            <p>${sourceDetail(source.id)}</p>
          </article>
        `).join("")}
      </section>
    `;
  }

  function sourceDetail(id) {
    if (id === "shop") return "Commission, GMV, and units sold roll up from product videos.";
    if (id === "rewards") return "Rewards reflect qualified educational and original videos.";
    return "TikTok GO reflects place-based clicks, purchases, or bookings.";
  }

  function renderProducts() {
    const products = sortItems(filteredProducts(), state.productSort);
    return `
      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Products</p>
            <h3>Workflow hub</h3>
          </div>
          ${selectControl("productSort", [["earnings", "Sort by earnings"], ["sales", "Sort by sales"], ["views", "Sort by views"], ["recent", "Recent activity"]], state.productSort)}
        </div>
        <div class="product-grid">
          ${products.map(renderProductCard).join("") || emptyState("No products in this range.")}
        </div>
      </section>
    `;
  }

  function renderProductCard(product) {
    return `
      <button class="card product-card" type="button" data-action="open-product" data-id="${product.id}">
        ${thumbnail(product.image)}
        <span class="title">${product.name}</span>
        ${workflow(product.workflowStep)}
        <div class="mini-metrics">
          <span>${money.format(product.earnings)}<small>Earnings</small></span>
          <span>${number.format(product.sales)}<small>Sales</small></span>
          <span>${number.format(product.views)}<small>Views</small></span>
        </div>
      </button>
    `;
  }

  function renderProductDetail() {
    const product = data.products.find((item) => item.id === state.selectedProductId) || topProducts(1)[0];
    const videos = sortItems(productVideos(product.id), state.productVideoSort);
    return `
      <button class="back-button" type="button" data-action="back">Back</button>
      <section class="product-workspace">
        <div class="workspace-header">
          ${thumbnail(product.image)}
          <div>
            <p class="eyebrow">${accountName(product.accountId)}</p>
            <h3>${product.name}</h3>
            <strong>${money.format(product.earnings)} current earnings</strong>
          </div>
        </div>
        <div class="workflow-large">${workflow(product.workflowStep, ["Sample", "Content", "Videos", "Earnings"])}</div>
      </section>

      <section class="section">
        <div class="section-heading"><h3>Create Content</h3></div>
        <div class="action-grid">
          ${["Hooks", "Script", "Caption", "Hashtags", "Talking Points", "CTA"].map((item) => `
            <button class="card generator-card" type="button" data-action="generate" data-id="${item}">
              <span>Generate</span><strong>${item}</strong>
            </button>
          `).join("")}
        </div>
        <div id="generatedContent" class="generated-panel" hidden></div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Product Videos</p>
            <h3>Posting time and sales patterns</h3>
          </div>
          ${selectControl("productVideoSort", [["date", "Sort by date"], ["time", "Sort by posting time"], ["views", "Sort by views"], ["sales", "Sort by sales"], ["earnings", "Sort by earnings"]], state.productVideoSort)}
        </div>
        <div class="video-list">${videos.map(renderVideoCard).join("")}</div>
      </section>

      <section class="section quiet-notes">
        <h3>Quiet Notes</h3>
        <p>${product.insight}</p>
      </section>
    `;
  }

  function renderVideos() {
    const videos = sortItems(filteredVideos(), state.videoSort);
    return `
      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Videos</p>
            <h3>All creator videos</h3>
          </div>
          <div class="inline-controls">
            ${selectControl("earningsSource", [["all", "All sources"], ["shop", "TikTok Shop"], ["rewards", "Creator Rewards"], ["go", "TikTok GO"]], state.earningsSource)}
            ${selectControl("videoSort", [["views", "Sort by views"], ["earnings", "Sort by earnings"], ["sales", "Sort by sales"], ["time", "Sort by posting time"]], state.videoSort)}
          </div>
        </div>
        <div class="video-list">${videos.map(renderVideoCard).join("") || emptyState("No videos in this range.")}</div>
      </section>
    `;
  }

  function renderVideoDetail() {
    const video = data.videos.find((item) => item.id === state.selectedVideoId) || topVideos(1)[0];
    const product = data.products.find((item) => item.id === video.productId);
    return `
      <button class="back-button" type="button" data-action="back">Back</button>
      <section class="product-workspace video-detail">
        <div class="workspace-header">
          ${thumbnail(video.thumbnail)}
          <div>
            <p class="eyebrow">${accountName(video.accountId)} · ${video.date} at ${video.time}</p>
            <h3>${video.title}</h3>
            <strong>${number.format(video.views)} views</strong>
          </div>
        </div>
      </section>
      <section class="hero-grid">
        ${card("Earnings", money.format(video.earnings), video.sourceIds.map(sourceName).join(" + "), "gold")}
        ${card("Likes", number.format(video.likes), "Engagement signal", "white")}
        ${card("Comments", number.format(video.comments), "Conversation signal", "teal")}
        ${card("Shares", number.format(video.shares), "Spread signal", "navy")}
      </section>
      <section class="two-column">
        <article class="card detail-card">
          <span class="label">Linked Item</span>
          <strong>${product ? product.name : "Place or product"}</strong>
          <p>${video.gmv ? `${money.format(video.gmv)} GMV and ${video.units} units sold.` : `${video.units} mock bookings or actions.`}</p>
        </article>
        <article class="card insight-card">
          <span class="label">Northstar Insight</span>
          <strong>${video.time.includes("PM") ? "This posting window is worth testing again." : "This topic may need a stronger first three seconds."}</strong>
        </article>
      </section>
    `;
  }

  function renderOpportunities() {
    const opportunities = data.opportunities.filter((opp) => state.accountId === "all" || opp.accountId === state.accountId);
    return `
      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Opportunity Center</p>
            <h3>Small number of useful next moves</h3>
          </div>
        </div>
        <div class="opportunity-grid">
          ${opportunities.map((opp) => `
            <button class="card opportunity-card" type="button" data-action="open-${opp.targetType}" data-id="${opp.targetId}">
              <span class="label">${accountName(opp.accountId)} · ${opp.type}</span>
              <strong>${opp.title}</strong>
              <p>${opp.body}</p>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDataHub() {
    return `
      <section class="section">
        <div class="section-heading"><h3>Data Hub</h3></div>
        <div class="two-column">
          ${data.accounts.map((account) => `
            <article class="card detail-card">
              <span class="label">${account.name}</span>
              <strong>Connected</strong>
              <p>Last sync today at 8:04 AM. Mock records updated: ${account.id === "raised-right" ? 42 : 38}.</p>
            </article>
          `).join("")}
        </div>
        <article class="empty-state">No real TikTok API calls are made in this sandbox.</article>
      </section>
    `;
  }

  function renderSettings() {
    return `
      <section class="section">
        <div class="section-heading"><h3>Settings</h3></div>
        <div class="settings-grid">
          <article class="card detail-card"><span class="label">Accounts</span><strong>2 active</strong><p>Raised Right and Truth Tuned Tribe are available in this prototype.</p></article>
          <article class="card detail-card"><span class="label">Display Preferences</span><strong>Calm by default</strong><p>Compact cards, simple visuals, and fewer alerts.</p></article>
          <article class="card detail-card"><span class="label">Revenue Sources</span><strong>TikTok Shop, Creator Rewards, TikTok GO</strong><p>Future sources can be added without redesigning the dashboard.</p>${actionButton("Add Revenue Source", "add-revenue")}</article>
        </div>
      </section>
    `;
  }

  function renderProductRow(product) {
    return `
      <button class="list-row" type="button" data-action="open-product" data-id="${product.id}">
        ${thumbnail(product.image)}
        <span><strong>${product.name}</strong><small>${accountName(product.accountId)}</small></span>
        <b>${money.format(product.earnings)}</b>
      </button>
    `;
  }

  function renderVideoRow(video) {
    return `
      <button class="list-row" type="button" data-action="open-video" data-id="${video.id}">
        ${thumbnail(video.thumbnail)}
        <span><strong>${video.title}</strong><small>${video.date} · ${video.time}</small></span>
        <b>${money.format(video.earnings)}</b>
      </button>
    `;
  }

  function renderVideoCard(video) {
    const product = data.products.find((item) => item.id === video.productId);
    return `
      <button class="card video-card" type="button" data-action="open-video" data-id="${video.id}">
        ${thumbnail(video.thumbnail)}
        <div>
          <span class="label">${accountName(video.accountId)} · ${video.date}</span>
          <strong>${video.title}</strong>
          <small>${video.time} · ${product ? product.name : "TikTok GO place"}</small>
        </div>
        <div class="video-metrics">
          <span>${number.format(video.views)}<small>Views</small></span>
          <span>${video.units}<small>Sales</small></span>
          <span>${money.format(video.earnings)}<small>Earnings</small></span>
        </div>
      </button>
    `;
  }

  function workflow(step, labels = ["Sample", "Content", "Videos", "Earnings"]) {
    return `<div class="workflow">${labels.map((label, index) => `
      <span class="${index + 1 <= step ? "active" : ""}"><i></i>${label}</span>
    `).join("")}</div>`;
  }

  function selectControl(name, options, value) {
    return `
      <label class="compact-select">
        <span class="sr-only">${name}</span>
        <select data-control="${name}">
          ${options.map(([id, label]) => `<option value="${id}" ${id === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function emptyState(message) {
    return `<article class="empty-state">${message}</article>`;
  }

  function readableRange() {
    if (state.dateRange === "today") return "Today";
    if (state.dateRange === "week") return "This week";
    if (state.dateRange === "custom") return `${state.customStart} to ${state.customEnd}`;
    return "This month";
  }

  function generatedContent(type) {
    const product = data.products.find((item) => item.id === state.selectedProductId);
    const account = accountName(product.accountId);
    const samples = {
      Hooks: `If you have been putting off this problem, this is the simple fix I would try first.`,
      Script: `Here is why I would test ${product.name} next for ${account}. Start with the problem, show the product in use, then end with the clearest benefit.`,
      Caption: `A simple fix that makes the job easier. Testing this one today.`,
      Hashtags: `#creatorfinds #tiktokshopfinds #northstar #producttest #${account.replace(/\s+/g, "").toLowerCase()}`,
      "Talking Points": `Problem, first impression, quick demo, what surprised me, who should try it.`,
      CTA: `Tap the product link if you want to compare it before you forget.`
    };
    return samples[type] || "Generated mock content appears here.";
  }

  function openModal(title, body) {
    els.modal.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <section class="modal" role="dialog" aria-modal="true" aria-label="${title}">
        <button class="close-button" type="button" data-action="close-modal">Close</button>
        <p class="eyebrow">Mock Interaction</p>
        <h3>${title}</h3>
        <p>${body}</p>
      </section>
    `;
    els.modal.hidden = false;
  }

  function renderNav() {
    els.nav.innerHTML = navItems.map(([id, label]) => `
      <button class="${state.page === id ? "active" : ""}" type="button" data-page="${id}">${label}</button>
    `).join("");
  }

  function render() {
    renderNav();
    const titles = {
      brief: "Morning Brief",
      opportunities: "Opportunity Center",
      earnings: "Earnings",
      products: "Products",
      videos: "Videos",
      data: "Data Hub",
      settings: "Settings",
      "product-detail": "Product Workspace",
      "video-detail": "Video Detail"
    };
    els.title.textContent = titles[state.page] || "Morning Brief";
    const pages = {
      brief: renderBrief,
      opportunities: renderOpportunities,
      earnings: renderEarnings,
      products: renderProducts,
      videos: renderVideos,
      data: renderDataHub,
      settings: renderSettings,
      "product-detail": renderProductDetail,
      "video-detail": renderVideoDetail
    };
    els.content.innerHTML = pages[state.page]();
  }

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) setPage(pageButton.dataset.page);

    const action = event.target.closest("[data-action]");
    if (!action) return;
    const id = action.dataset.id;
    if (action.dataset.action === "open-product") setPage("product-detail", id);
    if (action.dataset.action === "open-video") setPage("video-detail", id);
    if (action.dataset.action === "open-earnings") {
      state.earningsSource = id;
      setPage("earnings");
    }
    if (action.dataset.action === "back") setPage("brief");
    if (action.dataset.action === "generate") {
      const panel = document.getElementById("generatedContent");
      panel.hidden = false;
      panel.innerHTML = `<span class="label">Generated ${id}</span><p>${generatedContent(id)}</p>`;
    }
    if (action.dataset.action === "add-revenue") {
      openModal("Add Revenue Source", "This will let Jennifer track future income streams without redesigning Northstar.");
    }
    if (action.dataset.action === "close-modal") {
      els.modal.hidden = true;
      els.modal.innerHTML = "";
    }
  });

  document.addEventListener("change", (event) => {
    const control = event.target.closest("[data-control]");
    if (control) {
      state[control.dataset.control] = control.value;
      render();
    }
  });

  els.account.addEventListener("change", () => {
    state.accountId = els.account.value;
    render();
  });

  els.date.addEventListener("change", () => {
    state.dateRange = els.date.value;
    els.custom.hidden = state.dateRange !== "custom";
    render();
  });

  els.customStart.addEventListener("change", () => {
    state.customStart = els.customStart.value;
    render();
  });

  els.customEnd.addEventListener("change", () => {
    state.customEnd = els.customEnd.value;
    render();
  });

  document.getElementById("addAccountButton").addEventListener("click", () => {
    openModal("Add Account", "This is a visual-only preview of adding another creator account.");
  });

  render();
})();
