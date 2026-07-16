(function () {
  const data = window.NORTHSTAR_SANDBOX_DATA;
  const state = {
    page: "brief",
    accountId: "all",
    dateRange: "month",
    customStart: "2026-07-01",
    customEnd: "2026-07-16",
    activeSource: null,
    storyView: "timeline",
    productSort: "earnings",
    videoSort: "date",
    selectedProductId: null,
    selectedVideoId: null,
    selectedOpportunityId: null,
    selectedDay: null,
    history: []
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

  const dateRanges = [
    ["today", "Today"],
    ["week", "This Week"],
    ["month", "This Month"],
    ["custom", "Custom"]
  ];

  const els = {
    nav: document.getElementById("sidebarNav"),
    title: document.getElementById("pageTitle"),
    content: document.getElementById("content"),
    accountButton: document.getElementById("accountButton"),
    accountMenu: document.getElementById("accountMenu"),
    accountAvatar: document.getElementById("accountAvatar"),
    accountLabel: document.getElementById("accountLabel"),
    dateButton: document.getElementById("dateButton"),
    dateMenu: document.getElementById("dateMenu"),
    dateLabel: document.getElementById("dateLabel"),
    customPanel: document.getElementById("customDatePanel"),
    customStart: document.getElementById("customStart"),
    customEnd: document.getElementById("customEnd"),
    modal: document.getElementById("modalRoot")
  };

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat("en-US");

  function account(id = state.accountId) {
    return data.accounts.find((item) => item.id === id);
  }

  function accountName(id = state.accountId) {
    return account(id)?.name || "All Accounts";
  }

  function source(id = state.activeSource) {
    return data.revenueSources.find((item) => item.id === id);
  }

  function product(id) {
    return data.products.find((item) => item.id === id);
  }

  function video(id) {
    return data.videos.find((item) => item.id === id);
  }

  function dateWindow() {
    const today = new Date("2026-07-16T12:00:00");
    if (state.dateRange === "today") return [new Date("2026-07-16T00:00:00"), new Date("2026-07-16T23:59:59")];
    if (state.dateRange === "week") return [new Date("2026-07-10T00:00:00"), today];
    if (state.dateRange === "custom") return [new Date(`${state.customStart}T00:00:00`), new Date(`${state.customEnd}T23:59:59`)];
    return [new Date("2026-07-01T00:00:00"), today];
  }

  function inRange(date) {
    const [start, end] = dateWindow();
    const current = new Date(`${date}T12:00:00`);
    return current >= start && current <= end;
  }

  function accountMatches(item) {
    return state.accountId === "all" || item.accountId === state.accountId;
  }

  function filteredVideos(extra = {}) {
    return data.videos
      .filter(accountMatches)
      .filter((item) => inRange(item.date))
      .filter((item) => !extra.productId || item.productId === extra.productId)
      .filter((item) => !extra.sourceId || item.sourceIds.includes(extra.sourceId));
  }

  function filteredProducts(extra = {}) {
    const visibleVideos = filteredVideos(extra);
    const ids = new Set(visibleVideos.map((item) => item.productId));
    return data.products
      .filter(accountMatches)
      .filter((item) => ids.has(item.id) || (item.type === "sample" && inRange(item.updatedAt)))
      .filter((item) => !extra.sourceId || item.type === "sample" || visibleVideos.some((v) => v.productId === item.id));
  }

  function sourceDays(sourceId = state.activeSource) {
    return data.days.filter((day) => inRange(day.date)).map((day) => {
      const accountIds = state.accountId === "all" ? data.accounts.map((item) => item.id) : [state.accountId];
      const parts = accountIds.map((id) => day[id === "raised-right" ? "raisedRight" : "truthTunedTribe"]);
      return {
        date: day.date,
        earnings: parts.reduce((sum, part) => sum + (part[sourceId] || 0), 0),
        videos: parts.reduce((sum, part) => sum + part.videos, 0),
        bestVideo: parts.find((part) => part[sourceId])?.bestVideo || parts[0]?.bestVideo || "No video",
        bestProduct: parts.find((part) => part[sourceId])?.bestProduct || parts[0]?.bestProduct || "No product",
        time: parts.find((part) => part[sourceId])?.time || parts[0]?.time || "N/A",
        units: parts.reduce((sum, part) => sum + (sourceId === "go" ? part.bookings || 0 : part.units || 0), 0)
      };
    });
  }

  function totals(sourceId = null) {
    const videos = filteredVideos(sourceId ? { sourceId } : {});
    const products = filteredProducts(sourceId ? { sourceId } : {});
    const days = sourceId ? sourceDays(sourceId) : data.days.filter((day) => inRange(day.date));
    const accountIds = state.accountId === "all" ? data.accounts.map((item) => item.id) : [state.accountId];
    const totalFromDays = (sourceKey) => days.reduce((sum, day) => {
      if (sourceId) return sum + day.earnings;
      return sum + accountIds.reduce((inner, id) => {
        const part = day[id === "raised-right" ? "raisedRight" : "truthTunedTribe"];
        return inner + (sourceKey ? part[sourceKey] : part.shop + part.rewards + part.go);
      }, 0);
    }, 0);
    const shopEarnings = totalFromDays(sourceId || null);
    const shopVideos = sourceId ? videos : filteredVideos();
    return {
      followers: state.accountId === "all" ? data.accounts.reduce((sum, item) => sum + item.followers, 0) : account().followers,
      views: shopVideos.reduce((sum, item) => sum + item.views, 0),
      videos: shopVideos.length,
      earnings: sourceId ? shopEarnings : totalFromDays(null),
      commission: videos.reduce((sum, item) => {
        if (sourceId === "shop" || sourceId === "go") return sum + item.earnings;
        return sum + (item.sourceIds.includes("shop") ? item.earnings : 0);
      }, 0),
      gmv: videos.reduce((sum, item) => sum + item.gmv, 0),
      units: videos.reduce((sum, item) => sum + item.units, 0),
      productsEarning: products.filter((item) => item.earnings > 0 && item.type !== "place").length,
      rewardsEarned: videos.filter((item) => item.sourceIds.includes("rewards")).reduce((sum, item) => sum + Math.round(item.earnings * 0.34), 0),
      qualifiedViews: videos.filter((item) => item.sourceIds.includes("rewards")).reduce((sum, item) => sum + item.qualifiedViews, 0),
      eligibleVideos: videos.filter((item) => item.sourceIds.includes("rewards")).length,
      rpm: videos.filter((item) => item.sourceIds.includes("rewards")).reduce((sum, item) => sum + Math.round(item.earnings * 0.34), 0) / Math.max(1, videos.filter((item) => item.sourceIds.includes("rewards")).reduce((sum, item) => sum + item.qualifiedViews, 0) / 1000),
      linkClicks: videos.filter((item) => item.sourceIds.includes("go")).reduce((sum, item) => sum + item.linkClicks, 0),
      bookings: videos.filter((item) => item.sourceIds.includes("go")).reduce((sum, item) => sum + item.bookings, 0),
      placesEarning: products.filter((item) => item.type === "place" && item.earnings > 0).length
    };
  }

  function readableRange() {
    if (state.dateRange === "custom") return `${state.customStart} to ${state.customEnd}`;
    return dateRanges.find(([id]) => id === state.dateRange)?.[1] || "This Month";
  }

  function setPage(page, id = null, push = true) {
    if (push) state.history.push({ page: state.page, id: state.selectedProductId || state.selectedVideoId || state.selectedOpportunityId || state.activeSource });
    state.page = page;
    if (page === "product-detail") state.selectedProductId = id;
    if (page === "video-detail") state.selectedVideoId = id;
    if (page === "opportunity-detail") state.selectedOpportunityId = id;
    if (page === "source-detail") state.activeSource = id;
    render();
    els.content.focus();
  }

  function goBack() {
    const previous = state.history.pop();
    if (!previous) return setPage("brief", null, false);
    state.page = previous.page;
    if (previous.page === "product-detail") state.selectedProductId = previous.id;
    if (previous.page === "video-detail") state.selectedVideoId = previous.id;
    if (previous.page === "opportunity-detail") state.selectedOpportunityId = previous.id;
    if (previous.page === "source-detail") state.activeSource = previous.id;
    render();
  }

  function card(label, value, detail, tone = "white", action = "") {
    return `
      <button class="metric-card ${tone}" type="button" ${action}>
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${detail}</small>
        <em aria-hidden="true">→</em>
      </button>
    `;
  }

  function identity(accountId = state.accountId) {
    if (accountId === "all") return `<span class="avatar avatar-all">RR<br>TT</span>`;
    const item = account(accountId);
    return `<span class="avatar">${item.initials}</span>`;
  }

  function renderBrief() {
    const total = totals();
    const active = state.accountId === "all" ? null : account();
    const lead = active?.summary || "Across both accounts, shop earnings are leading while creator rewards and local discovery add useful secondary signals.";
    const topProducts = [...filteredProducts()].sort((a, b) => b.earnings - a.earnings).slice(0, 3);
    const topVideos = [...filteredVideos()].sort((a, b) => b.views - a.views).slice(0, 3);
    const samples = filteredProducts().filter((item) => item.type === "sample").slice(0, 3);
    return `
      <section class="brief-hero">
        <div>
          <p class="eyebrow">Morning Brief</p>
          <h2>Good afternoon, Jennifer.</h2>
          <div class="brief-account">${identity()}<span>${accountName()} · TikTok account view</span></div>
          <p>${lead}</p>
        </div>
        <img src="assets/northstar-mark.svg" alt="" class="hero-mark">
      </section>
      <section class="metric-grid">
        ${card("Followers", number.format(total.followers), `${state.accountId === "all" ? "Combined accounts" : account().followerChange + " new this month"}`, "navy", 'data-page="videos"')}
        ${card("Views", number.format(total.views), readableRange(), "white", 'data-page="videos"')}
        ${card("Videos Posted", total.videos, readableRange(), "white", 'data-page="videos"')}
        ${card("Total Earnings", money.format(total.earnings), `${accountName()} · ${readableRange()}`, "gold", 'data-page="earnings"')}
      </section>
      <section class="section">
        <div class="section-heading">
          <div><p class="eyebrow">Revenue Compass</p><h3>See how each creator income stream is contributing.</h3></div>
        </div>
        <div class="source-grid">
          ${data.revenueSources.map((item) => sourceCard(item)).join("")}
        </div>
      </section>
      <section class="split-grid">
        <div class="section">
          <div class="section-heading"><div><p class="eyebrow">Products</p><h3>Products carrying momentum</h3></div></div>
          <div class="stack">${topProducts.map(productRow).join("")}</div>
        </div>
        <div class="section">
          <div class="section-heading"><div><p class="eyebrow">Content</p><h3>Videos with useful signals</h3></div></div>
          <div class="stack">${topVideos.map(videoRow).join("")}</div>
        </div>
      </section>
      <section class="section soft-section">
        <div class="section-heading"><div><p class="eyebrow">Samples</p><h3>Clean sample view</h3></div></div>
        <div class="sample-grid">${samples.map(sampleCard).join("") || empty("No sample-only products in this filter.")}</div>
      </section>
    `;
  }

  function sourceCard(item) {
    const total = totals(item.id);
    const primary = item.id === "rewards" ? total.rewardsEarned : total.earnings;
    const detail = item.id === "shop" ? `${total.productsEarning} products earning` : item.id === "rewards" ? `${total.eligibleVideos} eligible videos` : `${total.placesEarning} places earning`;
    return `
      <button class="source-card ${item.accent}" type="button" data-action="open-source" data-id="${item.id}">
        <span class="source-dot"></span>
        <small>${item.name}</small>
        <strong>${money.format(primary)}</strong>
        <p>${detail}</p>
      </button>
    `;
  }

  function renderEarnings() {
    return `
      <section class="page-intro">
        <div><p class="eyebrow">Earnings</p><h2>Why did I earn that amount?</h2><p>Open a source to see source-specific metrics and the story behind strong days.</p></div>
      </section>
      <div class="source-grid">${data.revenueSources.map(sourceCard).join("")}</div>
      ${renderRevenueStory(null)}
    `;
  }

  function renderSourceDetail() {
    const item = source();
    const total = totals(item.id);
    return `
      ${backButton()}
      <section class="page-intro source-intro ${item.accent}">
        <div><p class="eyebrow">${item.name}</p><h2>${item.description}</h2><p>${accountName()} · ${readableRange()}</p></div>
      </section>
      <section class="metric-grid compact">
        ${item.metrics.map((metric) => {
          const raw = total[metric.key] || 0;
          const value = metric.key.includes("Views") || metric.key === "linkClicks" || metric.key === "eligibleVideos" || metric.key.includes("Earning") || metric.key === "bookings" || metric.key === "units" ? number.format(Math.round(raw)) : money.format(raw);
          return card(metric.label, value, item.name, "white", metric.key === "productsEarning" ? 'data-action="show-contributors"' : "");
        }).join("")}
      </section>
      ${renderRevenueStory(item.id)}
    `;
  }

  function renderRevenueStory(sourceId) {
    const days = sourceId ? sourceDays(sourceId) : sourceDays("shop");
    const max = Math.max(...days.map((day) => day.earnings), 1);
    return `
      <section class="section">
        <div class="section-heading">
          <div><p class="eyebrow">Revenue Story</p><h3>What happened, and what contributed to it?</h3></div>
          <div class="segmented" role="group" aria-label="Revenue story view">
            <button class="${state.storyView === "timeline" ? "active" : ""}" type="button" data-action="story-view" data-id="timeline">Timeline</button>
            <button class="${state.storyView === "calendar" ? "active" : ""}" type="button" data-action="story-view" data-id="calendar">Calendar</button>
          </div>
        </div>
        ${state.storyView === "calendar" ? calendarView(days, max, sourceId || "shop") : timelineView(days, max, sourceId || "shop")}
      </section>
    `;
  }

  function timelineView(days, max, sourceId) {
    const points = days.map((day, index) => {
      const x = 40 + (index * (720 / Math.max(1, days.length - 1)));
      const y = 230 - ((day.earnings / max) * 170);
      return { ...day, x, y };
    });
    const line = points.map((point) => `${point.x},${point.y}`).join(" ");
    const activeDay = points.find((day) => day.date === state.selectedDay) || points[points.length - 1];
    return `
      <div class="story-grid">
        <div class="timeline-card">
          <svg viewBox="0 0 800 270" role="img" aria-label="Daily ${sourceId} revenue trend">
            <defs><linearGradient id="storyFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--source-color)" stop-opacity=".34"/><stop offset="1" stop-color="var(--source-color)" stop-opacity="0"/></linearGradient></defs>
            <polyline points="${line}" fill="none" stroke="var(--source-color)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
            <polygon points="40,240 ${line} 760,240" fill="url(#storyFill)"></polygon>
            ${points.map((point) => `<button class="svg-button" data-action="select-day" data-id="${point.date}" style="--x:${point.x};--y:${point.y}"><circle cx="${point.x}" cy="${point.y}" r="${point.date === activeDay.date ? 8 : 5}"></circle><title>${point.date}: ${money.format(point.earnings)}</title></button>`).join("")}
          </svg>
        </div>
        ${dayDetail(activeDay, sourceId)}
      </div>
    `;
  }

  function calendarView(days, max, sourceId) {
    const activeDay = days.find((day) => day.date === state.selectedDay) || days[days.length - 1];
    return `
      <div class="story-grid">
        <div class="heatmap" aria-label="Calendar earnings heatmap">
          ${days.map((day) => `<button type="button" class="${day.date === activeDay.date ? "active" : ""}" style="--heat:${Math.max(.12, day.earnings / max)}" data-action="select-day" data-id="${day.date}"><span>${new Date(`${day.date}T12:00:00`).getDate()}</span><strong>${money.format(day.earnings)}</strong></button>`).join("")}
        </div>
        ${dayDetail(activeDay, sourceId)}
      </div>
    `;
  }

  function dayDetail(day, sourceId) {
    const unitLabel = sourceId === "go" ? "Bookings" : sourceId === "rewards" ? "Qualified signal" : "Units sold";
    return `
      <aside class="detail-panel">
        <p class="eyebrow">Daily Detail</p>
        <h3>${day.date}</h3>
        <dl>
          <div><dt>Earnings</dt><dd>${money.format(day.earnings)}</dd></div>
          <div><dt>Videos posted</dt><dd>${day.videos}</dd></div>
          <div><dt>Best video</dt><dd>${day.bestVideo}</dd></div>
          <div><dt>${sourceId === "go" ? "Place" : "Product"}</dt><dd>${day.bestProduct}</dd></div>
          <div><dt>Best posting time</dt><dd>${day.time}</dd></div>
          <div><dt>${unitLabel}</dt><dd>${number.format(day.units)}</dd></div>
        </dl>
        <p class="takeaway">Takeaway: ${day.time} is the strongest visible posting window in this filter.</p>
      </aside>
    `;
  }

  function renderOpportunities() {
    const items = data.opportunities.filter((item) => state.accountId === "all" || item.accountId === state.accountId);
    return `
      <section class="page-intro"><div><p class="eyebrow">Opportunity Center</p><h2>Small, actionable signals worth acting on.</h2></div></section>
      <div class="opportunity-grid">${items.map(opportunityCard).join("")}</div>
    `;
  }

  function opportunityCard(item) {
    return `
      <button class="opportunity-card" type="button" data-action="open-opportunity" data-id="${item.id}">
        <span>${item.type}</span>
        <h3>${item.noticed}</h3>
        <p>${item.why}</p>
        <strong>${item.action}</strong>
        <small>${accountName(item.accountId)} →</small>
      </button>
    `;
  }

  function renderOpportunityDetail() {
    const item = data.opportunities.find((opp) => opp.id === state.selectedOpportunityId);
    const destination = item.targetType === "video" ? video(item.targetId) : product(item.targetId);
    return `
      ${backButton()}
      <section class="product-studio">
        <div><p class="eyebrow">Opportunity</p><h2>${item.noticed}</h2><p>${item.why}</p></div>
        <button class="primary-button" type="button" data-action="open-${item.targetType}" data-id="${item.targetId}">Open ${item.targetType === "video" ? "Video Detail" : "Product Studio"}</button>
      </section>
      <section class="section"><h3>Recommended action</h3><p>${item.action}</p><p class="muted">Destination: ${destination.name || destination.title}</p></section>
    `;
  }

  function renderProducts() {
    const products = sortProducts(filteredProducts());
    return `
      <section class="page-intro">
        <div><p class="eyebrow">Products</p><h2>Product Studio starts here.</h2><p>Samples stay clean until there is content or revenue to analyze.</p></div>
        <label class="mini-control">Sort products<select data-action="product-sort"><option value="earnings">Earnings</option><option value="views">Views</option><option value="updated">Updated</option></select></label>
      </section>
      <div class="product-grid">${products.map(productCard).join("")}</div>
    `;
  }

  function productCard(item) {
    const isSample = item.type === "sample";
    return `
      <button class="product-card ${isSample ? "sample" : ""}" type="button" data-action="open-product" data-id="${item.id}">
        <span class="product-image">${item.image}</span>
        <span class="pill">${isSample ? "Sample" : "Earning"}</span>
        <h3>${item.name}</h3>
        <p>${accountName(item.accountId)}</p>
        ${isSample && item.dueDate ? `<small>Video due ${item.dueDate}</small>` : `<small>${money.format(item.earnings)} earned</small>`}
        ${workflow(item.workflowStep)}
      </button>
    `;
  }

  function renderProductDetail() {
    const item = product(state.selectedProductId) || filteredProducts()[0];
    const videos = sortVideos(filteredVideos({ productId: item.id }));
    return `
      ${backButton()}
      <section class="product-studio">
        <span class="product-image large">${item.image}</span>
        <div>
          <p class="eyebrow">Product Studio</p>
          <h2>${item.name}</h2>
          <p>${accountName(item.accountId)} · ${item.type === "sample" ? "Sample" : money.format(item.earnings) + " current earnings"}</p>
          ${workflow(item.workflowStep)}
        </div>
      </section>
      <section class="split-grid">
        <div class="section">
          <div class="section-heading"><div><p class="eyebrow">Create Content</p><h3>Northstar tools</h3></div></div>
          <div class="tool-grid">
            ${["Generate Hooks", "Generate Script", "Generate Caption", "Generate Hashtags", "Generate Talking Points", "Generate CTA"].map((label) => `<button class="tool-button" type="button" data-action="generate" data-id="${label}" data-product="${item.id}">${label}<span>✦</span></button>`).join("")}
          </div>
          <div id="generatorOutput" class="workspace-output">Choose a tool to generate a mock creator-ready direction for this product.</div>
        </div>
        <div class="section">
          <p class="eyebrow">Product Intelligence</p>
          <h3>${item.bestHook}</h3>
          <p>${item.insight}</p>
          <dl class="mini-stats">
            <div><dt>Earnings</dt><dd>${money.format(item.earnings)}</dd></div>
            <div><dt>GMV</dt><dd>${money.format(item.gmv)}</dd></div>
            <div><dt>Units</dt><dd>${number.format(item.units)}</dd></div>
          </dl>
        </div>
      </section>
      <section class="section">
        <div class="section-heading">
          <div><p class="eyebrow">Product Videos</p><h3>Posting time stays visible</h3></div>
          <label class="mini-control">Sort<select data-action="product-video-sort"><option value="date">Date</option><option value="time">Posting time</option><option value="views">Views</option><option value="sales">Sales</option><option value="earnings">Earnings</option></select></label>
        </div>
        <div class="video-table">${videos.map(videoTableRow).join("") || empty("More product videos appear here after import.")}</div>
      </section>
    `;
  }

  function renderVideos() {
    const videos = sortVideos(filteredVideos());
    return `
      <section class="page-intro">
        <div><p class="eyebrow">Videos</p><h2>Video performance with posting time preserved.</h2></div>
        <label class="mini-control">Sort videos<select data-action="video-sort"><option value="date">Date</option><option value="time">Posting time</option><option value="views">Views</option><option value="sales">Sales</option><option value="earnings">Earnings</option></select></label>
      </section>
      <div class="video-table">${videos.map(videoTableRow).join("")}</div>
    `;
  }

  function renderVideoDetail() {
    const item = video(state.selectedVideoId) || filteredVideos()[0];
    const linked = product(item.productId);
    return `
      ${backButton()}
      <section class="product-studio">
        <span class="product-image large">${item.thumbnail}</span>
        <div><p class="eyebrow">Video Detail</p><h2>${item.title}</h2><p>${accountName(item.accountId)} · Posted ${item.date} at ${item.time}</p></div>
      </section>
      <section class="metric-grid compact">
        ${card("Views", number.format(item.views), "Public video metric", "white")}
        ${card("Earnings", money.format(item.earnings), item.sourceIds.map((id) => source(id).name).join(" + "), "gold")}
        ${card("Units Sold", number.format(item.units), linked?.name || "Linked product", "white")}
        ${card("Shares", number.format(item.shares), "Audience signal", "white")}
      </section>
    `;
  }

  function renderDataHub() {
    return `
      <section class="page-intro"><div><p class="eyebrow">Data Hub</p><h2>Mock import health and source readiness.</h2></div></section>
      <section class="section muted-grid">
        ${["Manual capture ready", "CSV templates ready", "Screenshot OCR placeholder", "Live sync not connected"].map((item) => `<div><strong>${item}</strong><span>Sandbox-only visual state</span></div>`).join("")}
      </section>
    `;
  }

  function renderSettings() {
    return `
      <section class="page-intro"><div><p class="eyebrow">Settings</p><h2>Useful preferences only.</h2></div></section>
      <div class="settings-grid">
        <section class="section"><h3>Accounts</h3>${data.accounts.map((item) => `<p>${identity(item.id)} ${item.name} <span class="muted">${item.handle}</span></p>`).join("")}</section>
        <section class="section"><h3>Revenue Sources</h3>${data.revenueSources.map((item) => `<p><span class="source-dot ${item.accent}"></span>${item.name}</p>`).join("")}<button class="secondary-button" type="button" data-action="mock-modal" data-id="Add Revenue Source">Add Revenue Source</button></section>
        <section class="section"><h3>Display Preferences</h3><label class="mini-control">Density<select><option>Comfortable</option><option>Compact</option></select></label><label class="mini-control">Appearance<select><option>System</option><option>Light</option><option>Dark</option></select></label></section>
      </div>
    `;
  }

  function productRow(item) {
    return `<button class="list-row" type="button" data-action="open-product" data-id="${item.id}"><span class="product-image small">${item.image}</span><span><strong>${item.name}</strong><small>${accountName(item.accountId)} · ${money.format(item.earnings)}</small></span><em>→</em></button>`;
  }

  function videoRow(item) {
    return `<button class="list-row" type="button" data-action="open-video" data-id="${item.id}"><span class="product-image small">${item.thumbnail}</span><span><strong>${item.title}</strong><small>${item.date} · ${item.time} · ${number.format(item.views)} views</small></span><em>→</em></button>`;
  }

  function sampleCard(item) {
    return `<button class="sample-card" type="button" data-action="open-product" data-id="${item.id}"><span class="product-image">${item.image}</span><span><strong>${item.name}</strong><small>${accountName(item.accountId)}${item.dueDate ? " · Due " + item.dueDate : ""}</small></span>${workflow(item.workflowStep)}</button>`;
  }

  function videoTableRow(item) {
    return `<button class="video-row" type="button" data-action="open-video" data-id="${item.id}"><span class="product-image small">${item.thumbnail}</span><strong>${item.title}</strong><span>${accountName(item.accountId)}</span><span>${item.date}<b>${item.time}</b></span><span>${number.format(item.views)}</span><span>${number.format(item.units)}</span><span>${money.format(item.gmv)}</span><span>${money.format(item.earnings)}</span></button>`;
  }

  function sortProducts(items) {
    return [...items].sort((a, b) => {
      if (state.productSort === "views") return b.views - a.views;
      if (state.productSort === "updated") return new Date(b.updatedAt) - new Date(a.updatedAt);
      return b.earnings - a.earnings;
    });
  }

  function sortVideos(items) {
    return [...items].sort((a, b) => {
      if (state.videoSort === "views" || state.productVideoSort === "views") return b.views - a.views;
      if (state.videoSort === "sales" || state.productVideoSort === "sales") return b.units - a.units;
      if (state.videoSort === "earnings" || state.productVideoSort === "earnings") return b.earnings - a.earnings;
      if (state.videoSort === "time" || state.productVideoSort === "time") return a.time.localeCompare(b.time);
      return new Date(b.date) - new Date(a.date);
    });
  }

  function workflow(step) {
    return `<div class="workflow" aria-label="Sample to earnings progress">${["Sample", "Content", "Videos", "Earnings"].map((label, index) => `<span class="${index + 1 <= step ? "done" : ""}">${label}</span>`).join("")}</div>`;
  }

  function backButton() {
    return `<button class="back-button" type="button" data-action="back">← Back</button>`;
  }

  function empty(message) {
    return `<p class="empty">${message}</p>`;
  }

  function showGenerator(tool, productId) {
    const item = product(productId);
    const output = document.getElementById("generatorOutput");
    if (!output) return;
    output.innerHTML = `<strong>${tool}</strong><p>${item.name}: Lead with "${item.bestHook}" and show the practical payoff in the first five seconds.</p><small>Mock Northstar creative direction · ${accountName(item.accountId)}</small>`;
  }

  function renderChrome() {
    els.nav.innerHTML = navItems.map(([id, label]) => `<button class="${state.page === id ? "active" : ""}" type="button" data-page="${id}">${label}</button>`).join("");
    const active = account();
    els.accountAvatar.className = `avatar ${state.accountId === "all" ? "avatar-all" : ""}`;
    els.accountAvatar.innerHTML = state.accountId === "all" ? "RR<br>TT" : active.initials;
    els.accountLabel.textContent = accountName();
    els.dateLabel.textContent = state.dateRange === "custom" ? `${state.customStart} → ${state.customEnd}` : readableRange();
    els.accountMenu.innerHTML = [`<button role="option" data-action="account" data-id="all">${identity("all")}<span>All Accounts</span></button>`, ...data.accounts.map((item) => `<button role="option" data-action="account" data-id="${item.id}">${identity(item.id)}<span>${item.name}<small>${item.handle}</small></span></button>`)].join("");
    els.dateMenu.querySelector(".date-options").innerHTML = dateRanges.map(([id, label]) => `<button class="${state.dateRange === id ? "active" : ""}" type="button" data-action="date-range" data-id="${id}">${label}</button>`).join("");
  }

  function render() {
    renderChrome();
    const titles = { brief: "Morning Brief", opportunities: "Opportunity Center", earnings: "Earnings", products: "Products", videos: "Videos", data: "Data Hub", settings: "Settings", "product-detail": "Product Studio", "video-detail": "Video Detail", "source-detail": source()?.name || "Revenue Source", "opportunity-detail": "Opportunity Detail" };
    const pages = { brief: renderBrief, opportunities: renderOpportunities, earnings: renderEarnings, products: renderProducts, videos: renderVideos, data: renderDataHub, settings: renderSettings, "product-detail": renderProductDetail, "video-detail": renderVideoDetail, "source-detail": renderSourceDetail, "opportunity-detail": renderOpportunityDetail };
    els.title.textContent = titles[state.page] || "Morning Brief";
    els.content.innerHTML = pages[state.page]();
  }

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) return setPage(pageButton.dataset.page);
    const action = event.target.closest("[data-action]");
    if (!action) {
      if (!event.target.closest(".selector-wrap")) {
        els.accountMenu.hidden = true;
        els.dateMenu.hidden = true;
      }
      return;
    }
    const id = action.dataset.id;
    if (action.dataset.action === "account") { state.accountId = id; els.accountMenu.hidden = true; render(); }
    if (action.dataset.action === "date-range") {
      if (id === "custom") { els.customPanel.hidden = false; return; }
      state.dateRange = id; els.dateMenu.hidden = true; render();
    }
    if (action.dataset.action === "open-source") setPage("source-detail", id);
    if (action.dataset.action === "open-product") setPage("product-detail", id);
    if (action.dataset.action === "open-video") setPage("video-detail", id);
    if (action.dataset.action === "open-opportunity") setPage("opportunity-detail", id);
    if (action.dataset.action === "story-view") { state.storyView = id; render(); }
    if (action.dataset.action === "select-day") { state.selectedDay = id; render(); }
    if (action.dataset.action === "back") goBack();
    if (action.dataset.action === "generate") showGenerator(id, action.dataset.product);
    if (action.dataset.action === "cancel-custom") { els.customPanel.hidden = true; els.dateMenu.hidden = true; }
    if (action.dataset.action === "show-contributors") setPage("products");
    if (action.dataset.action === "mock-modal") alert(`${id} is a visual prototype action.`);
  });

  document.addEventListener("change", (event) => {
    const action = event.target.dataset.action;
    if (action === "product-sort") { state.productSort = event.target.value; render(); }
    if (action === "video-sort") { state.videoSort = event.target.value; render(); }
    if (action === "product-video-sort") { state.productVideoSort = event.target.value; render(); }
  });

  els.accountButton.addEventListener("click", () => {
    els.accountMenu.hidden = !els.accountMenu.hidden;
    els.dateMenu.hidden = true;
    els.accountButton.setAttribute("aria-expanded", String(!els.accountMenu.hidden));
  });

  els.dateButton.addEventListener("click", () => {
    els.dateMenu.hidden = !els.dateMenu.hidden;
    els.accountMenu.hidden = true;
    els.dateButton.setAttribute("aria-expanded", String(!els.dateMenu.hidden));
  });

  els.customPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    state.dateRange = "custom";
    state.customStart = els.customStart.value;
    state.customEnd = els.customEnd.value;
    els.customPanel.hidden = true;
    els.dateMenu.hidden = true;
    render();
  });

  render();
})();
