(function () {
  const data = window.NORTHSTAR_SANDBOX_DATA;
  const state = {
    page: "brief",
    accountId: "all",
    dateRange: "month",
    customStart: "2026-07-01",
    customEnd: "2026-07-16",
    activeSource: null,
    activeMetric: null,
    storyView: "timeline",
    selectedDay: null,
    productSort: "earnings",
    videoSort: "date",
    productVideoSort: "date",
    selectedProductId: null,
    selectedVideoId: null,
    selectedOpportunityId: null,
    history: []
  };

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
    customEnd: document.getElementById("customEnd")
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
  const dateRanges = [["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["custom", "Custom"]];
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat("en-US");

  const account = (id = state.accountId) => data.accounts.find((item) => item.id === id);
  const accountName = (id = state.accountId) => account(id)?.name || "All Accounts";
  const source = (id = state.activeSource) => data.revenueSources.find((item) => item.id === id);
  const product = (id) => data.products.find((item) => item.id === id);
  const video = (id) => data.videos.find((item) => item.id === id);

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

  const accountIds = () => state.accountId === "all" ? data.accounts.map((item) => item.id) : [state.accountId];
  const accountMatches = (item) => state.accountId === "all" || item.accountId === state.accountId;
  const accountPart = (day, id) => day[id === "raised-right" ? "raisedRight" : "truthTunedTribe"];
  const filteredDays = () => data.days.filter((day) => inRange(day.date));

  function periodFollowerGain(accountId = state.accountId) {
    const days = Math.max(1, filteredDays().length);
    const scale = Math.min(1, days / Math.max(1, data.days.length));
    if (accountId === "all") return data.accounts.reduce((sum, item) => sum + periodFollowerGain(item.id), 0);
    return Math.round((account(accountId)?.followerChange || 0) * scale);
  }

  function currentFollowers(accountId = state.accountId) {
    if (accountId === "all") return data.accounts.reduce((sum, item) => sum + item.followers, 0);
    return account(accountId)?.followers || 0;
  }

  function sourceValue(day, sourceId) {
    return accountIds().reduce((sum, id) => {
      const part = accountPart(day, id);
      return sum + (part[sourceId] || 0);
    }, 0);
  }

  function bestDayPart(day) {
    return accountIds()
      .map((id) => ({ id, part: accountPart(day, id) }))
      .sort((a, b) => (b.part.shop + b.part.rewards + b.part.go) - (a.part.shop + a.part.rewards + a.part.go))[0];
  }

  function topVideoByViews() {
    return [...filteredVideos()].sort((a, b) => b.views - a.views)[0];
  }

  function pulseItems() {
    const days = filteredDays();
    const latest = days[days.length - 1] || data.days[data.days.length - 1];
    const previous = days[days.length - 2] || data.days[Math.max(0, data.days.indexOf(latest) - 1)] || latest;
    const sourceSignals = data.revenueSources.map((item) => {
      const current = sourceValue(latest, item.id);
      const prior = sourceValue(previous, item.id);
      const change = prior ? Math.round(((current - prior) / prior) * 100) : 0;
      return { ...item, current, change };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const strongestSource = sourceSignals[0];
    const leader = bestDayPart(latest)?.part;
    const leadingVideo = topVideoByViews();
    const direction = strongestSource.change >= 0 ? "up" : "down";
    const changeText = strongestSource.change === 0 ? "is steady" : `is ${direction} ${Math.abs(strongestSource.change)}%`;
    return [
      ["Revenue", `${strongestSource.shortName} revenue ${changeText} in this filter.`],
      ["Top seller", `${leader?.bestProduct || "A leading product"} is the strongest seller.`],
      ["Posting window", `Strongest posting window begins near ${leader?.time || "7:30 PM"}.`],
      ["Views", `${leadingVideo?.title || "Top videos"} leads with ${number.format(leadingVideo?.views || 0)} views.`]
    ];
  }

  function followerTimeline() {
    const days = filteredDays();
    const total = currentFollowers();
    const gained = periodFollowerGain();
    const base = total - gained;
    return (days.length ? days : [data.days[data.days.length - 1]]).map((day, index, list) => ({
      date: day.date,
      value: Math.round(base + gained * ((index + 1) / Math.max(1, list.length)))
    }));
  }

  function viewTimeline() {
    const days = filteredDays();
    return (days.length ? days : [data.days[data.days.length - 1]]).map((day) => ({
      date: day.date,
      value: filteredVideos().filter((item) => item.date === day.date).reduce((sum, item) => sum + item.views, 0)
    }));
  }

  function miniTrend(items, formatter = number.format) {
    const max = Math.max(...items.map((item) => item.value), 1);
    const min = Math.min(...items.map((item) => item.value), 0);
    const span = Math.max(1, max - min);
    const points = items.map((item, index) => {
      const x = 18 + index * (464 / Math.max(1, items.length - 1));
      const y = 138 - ((item.value - min) / span) * 96;
      return { ...item, x, y };
    });
    const line = points.map((point) => `${point.x},${point.y}`).join(" ");
    return `
      <div class="mini-trend" role="img" aria-label="Selected period trend">
        <svg viewBox="0 0 500 170">
          <polyline points="${line}" fill="none" stroke="var(--teal)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
          ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4"><title>${point.date}: ${formatter(point.value)}</title></circle>`).join("")}
        </svg>
        <div class="trend-caption"><span>${items[0]?.date || "Start"}</span><strong>${formatter(items[items.length - 1]?.value || 0)}</strong><span>${items[items.length - 1]?.date || "End"}</span></div>
      </div>
    `;
  }

  function insightCard(message) {
    return `<section class="section insight-card"><span class="mini-mark" aria-hidden="true">✦</span><div><p class="eyebrow">Northstar Insight</p><p>${message}</p></div></section>`;
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

  function sourceDays(sourceId) {
    return data.days.filter((day) => inRange(day.date)).map((day) => {
      const parts = accountIds().map((id) => accountPart(day, id));
      return {
        date: day.date,
        earnings: parts.reduce((sum, part) => sum + (part[sourceId] || 0), 0),
        videos: parts.reduce((sum, part) => sum + part.videos, 0),
        units: parts.reduce((sum, part) => sum + (sourceId === "go" ? part.bookings || part.units || 0 : part.units || 0), 0),
        bestVideo: parts.find((part) => part[sourceId])?.bestVideo || parts[0]?.bestVideo || "No video",
        bestProduct: parts.find((part) => part[sourceId])?.bestProduct || parts[0]?.bestProduct || "No product",
        time: parts.find((part) => part[sourceId])?.time || parts[0]?.time || "N/A"
      };
    });
  }

  function totalEarnings() {
    return data.days.filter((day) => inRange(day.date)).reduce((sum, day) => (
      sum + accountIds().reduce((inner, id) => {
        const part = accountPart(day, id);
        return inner + part.shop + part.rewards + part.go;
      }, 0)
    ), 0);
  }

  function totals(sourceId = null) {
    const videos = filteredVideos(sourceId ? { sourceId } : {});
    const products = filteredProducts(sourceId ? { sourceId } : {});
    const days = sourceId ? sourceDays(sourceId) : [];
    const earnings = sourceId ? days.reduce((sum, day) => sum + day.earnings, 0) : totalEarnings();
    const rewardVideos = videos.filter((item) => item.sourceIds.includes("rewards"));
    const goVideos = videos.filter((item) => item.sourceIds.includes("go"));
    return {
      followers: state.accountId === "all" ? data.accounts.reduce((sum, item) => sum + item.followers, 0) : account().followers,
      views: videos.reduce((sum, item) => sum + item.views, 0),
      videos: videos.length,
      earnings,
      commission: sourceId === "go" ? earnings : videos.reduce((sum, item) => sum + ((sourceId === "shop" || (!sourceId && item.sourceIds.includes("shop"))) ? item.earnings : 0), 0),
      gmv: videos.reduce((sum, item) => sum + item.gmv, 0),
      units: videos.reduce((sum, item) => sum + item.units, 0),
      productsEarning: products.filter((item) => item.type === "product" && item.earnings > 0).length,
      rewardsEarned: sourceId === "rewards" ? earnings : rewardVideos.reduce((sum, item) => sum + Math.round(item.earnings * 0.34), 0),
      qualifiedViews: rewardVideos.reduce((sum, item) => sum + item.qualifiedViews, 0),
      eligibleVideos: rewardVideos.length,
      rpm: rewardVideos.reduce((sum, item) => sum + Math.round(item.earnings * 0.34), 0) / Math.max(1, rewardVideos.reduce((sum, item) => sum + item.qualifiedViews, 0) / 1000),
      linkClicks: goVideos.reduce((sum, item) => sum + item.linkClicks, 0),
      bookings: goVideos.reduce((sum, item) => sum + item.bookings, 0),
      placesEarning: products.filter((item) => item.type === "place" && item.earnings > 0).length
    };
  }

  function readableRange() {
    return state.dateRange === "custom"
      ? `${state.customStart} to ${state.customEnd}`
      : dateRanges.find(([id]) => id === state.dateRange)?.[1] || "This Month";
  }

  function identity(accountId = state.accountId) {
    if (accountId === "all") return `<span class="avatar avatar-all"><i>RR</i><i>TT</i></span>`;
    const item = account(accountId);
    return `<span class="avatar avatar-${item.id}"><i>${item.initials}</i></span>`;
  }

  function setPage(page, id = null, push = true) {
    if (push) state.history.push({ page: state.page, id: state.selectedProductId || state.selectedVideoId || state.selectedOpportunityId || state.activeSource });
    state.page = page;
    if (page === "product-detail") state.selectedProductId = id;
    if (page === "video-detail") state.selectedVideoId = id;
    if (page === "opportunity-detail") state.selectedOpportunityId = id;
    if (page === "source-detail") {
      state.activeSource = id;
      state.activeMetric = source(id)?.metrics?.[0]?.key || "commission";
    }
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

  function metricFormat(key, value) {
    return ["units", "productsEarning", "qualifiedViews", "eligibleVideos", "linkClicks", "bookings", "placesEarning"].includes(key)
      ? number.format(Math.round(value))
      : money.format(value);
  }

  function dayMetric(day, sourceId, key) {
    if (key === "gmv") return Math.round(day.earnings * 7.6);
    if (key === "units" || key === "bookings") return day.units;
    if (key === "qualifiedViews") return Math.round(day.earnings * 1700);
    if (key === "linkClicks") return Math.round(day.earnings * 2.25);
    return day.earnings;
  }

  function activeMetricFor(sourceId) {
    const item = source(sourceId);
    return item.metrics.some((entry) => entry.key === state.activeMetric) ? state.activeMetric : item.metrics[0].key;
  }

  function metricCard(label, value, detail, tone = "white", attrs = "") {
    return `
      <button class="metric-card ${tone}" type="button" ${attrs}>
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${detail}</small>
        <em aria-hidden="true">→</em>
      </button>
    `;
  }

  function renderBrief() {
    const total = totals();
    const active = state.accountId === "all" ? null : account();
    const lead = active?.summary || "Across both accounts, shop earnings are leading while creator rewards and local discovery add useful secondary signals.";
    const topProducts = [...filteredProducts()].filter((item) => item.type !== "sample").sort((a, b) => b.earnings - a.earnings).slice(0, 3);
    const topVideos = [...filteredVideos()].sort((a, b) => b.views - a.views).slice(0, 3);
    const samples = filteredProducts().filter((item) => item.type === "sample").slice(0, 3);
    const pulse = pulseItems();
    return `
      <section class="brief-hero alive">
        <div>
          <p class="eyebrow">Morning Brief</p>
          <h2>Good afternoon, Jennifer.</h2>
          <div class="brief-account">${identity()}<span><strong>${accountName()}</strong><small>${active?.focus || "Combined creator view"}</small></span></div>
          <p>${lead}</p>
        </div>
        <aside class="pulse-panel">
          <p class="eyebrow">Northstar Pulse</p>
          <dl>
            ${pulse.map(([label, text]) => `<div><dt>${label}</dt><dd>${text}</dd></div>`).join("")}
          </dl>
        </aside>
      </section>
      <section class="metric-grid">
        ${metricCard("Followers", number.format(total.followers), `+${number.format(periodFollowerGain())} in ${readableRange()}`, "white", 'data-page="audience"')}
        ${metricCard("Views", number.format(total.views), `${number.format(Math.round(total.views / Math.max(1, total.videos)))} avg/video`, "white", 'data-page="view-performance"')}
        ${metricCard("Videos Posted", total.videos, `${readableRange()} · 32/month goal`, "white", 'data-page="videos"')}
        ${metricCard("Total Earnings", money.format(total.earnings), "Shop + Rewards + GO", "white", 'data-page="earnings"')}
      </section>
      <section class="section">
        <div class="section-heading"><div><p class="eyebrow">Revenue Compass</p><h3>See what is guiding your earnings.</h3></div></div>
        <div class="source-grid">${data.revenueSources.map(sourceCard).join("")}</div>
      </section>
      <section class="split-grid">
        <div class="section"><div class="section-heading"><div><p class="eyebrow">Product Compass</p><h3>Products carrying momentum</h3></div></div><div class="stack">${topProducts.map(productRow).join("")}</div></div>
        <div class="section"><div class="section-heading"><div><p class="eyebrow">Content</p><h3>Videos with useful signals</h3></div></div><div class="stack">${topVideos.map(videoRow).join("")}</div></div>
      </section>
      <section class="section soft-section"><div class="section-heading"><div><p class="eyebrow">Samples</p><h3>Waiting for content</h3></div></div><div class="sample-grid">${samples.map(sampleCard).join("") || empty("No samples need content in this filter.")}</div></section>
    `;
  }

  function sourceCard(item) {
    const total = totals(item.id);
    const primary = total.earnings;
    const detail = item.id === "shop" ? `${total.productsEarning} products earning` : item.id === "rewards" ? `${total.eligibleVideos} eligible videos` : `${total.placesEarning} places earning`;
    return `<button class="source-card ${item.accent}" type="button" data-action="open-source" data-id="${item.id}"><span class="source-dot"></span><small>${item.name}</small><strong>${money.format(primary)}</strong><p>${detail}</p></button>`;
  }

  function renderAudience() {
    const total = totals();
    const gain = periodFollowerGain();
    const accountBreakdown = state.accountId === "all"
      ? `<section class="section"><div class="section-heading"><div><p class="eyebrow">Account Breakdown</p><h3>Followers by account</h3></div></div><div class="breakdown-cards">${data.accounts.map((item) => `<article><span>${identity(item.id)}</span><strong>${number.format(currentFollowers(item.id))}</strong><small>${item.name} · +${number.format(periodFollowerGain(item.id))} in ${readableRange()}</small></article>`).join("")}</div></section>`
      : "";
    const insight = state.accountId === "all"
      ? "Truth Tuned Tribe is contributing the larger share of new followers in this selected period, while Raised Right keeps a strong commerce audience base."
      : `${accountName()} gained ${number.format(gain)} followers in this selected period, with content volume and evening posting windows carrying the signal.`;
    return `
      ${morningBackButton()}
      <section class="page-intro"><div><p class="eyebrow">Audience</p><h2>Follower movement for ${accountName()}.</h2><p>${readableRange()} · Lightweight prototype view with no demographic assumptions.</p></div></section>
      <section class="metric-grid compact">
        ${metricCard("Current Followers", number.format(total.followers), "Matches Morning Brief", "white")}
        ${metricCard("Followers Gained", `+${number.format(gain)}`, readableRange(), "gold")}
        ${metricCard("Videos Posted", number.format(total.videos), "Content in this period", "white", 'data-page="videos"')}
        ${metricCard("Total Views", number.format(total.views), "Audience reach signal", "white", 'data-page="view-performance"')}
      </section>
      <section class="section trend-section"><div class="section-heading"><div><p class="eyebrow">Follower Growth</p><h3>Selected-period timeline</h3></div></div>${miniTrend(followerTimeline(), number.format)}</section>
      ${accountBreakdown}
      ${insightCard(insight)}
    `;
  }

  function renderViewPerformance() {
    const total = totals();
    const videos = [...filteredVideos()].sort((a, b) => b.views - a.views);
    const top = videos[0];
    const shownViews = videos.reduce((sum, item) => sum + item.views, 0);
    const insight = top
      ? `${top.title} is carrying the strongest view signal for ${accountName()} in ${readableRange()}. Use it as the benchmark for the next hook.`
      : "No videos are available in this filter yet. Once video data appears, Northstar will summarize the strongest view signal here.";
    return `
      ${morningBackButton()}
      <section class="page-intro"><div><p class="eyebrow">View Performance</p><h2>What is driving attention right now.</h2><p>${accountName()} · ${readableRange()}</p></div></section>
      <section class="metric-grid compact">
        ${metricCard("Total Views", number.format(total.views), "Matches Morning Brief", "white")}
        ${metricCard("Avg Views / Video", number.format(Math.round(total.views / Math.max(1, total.videos))), `${total.videos} videos posted`, "gold")}
        ${metricCard("Highest Viewed", top ? number.format(top.views) : "0", top?.title || "No video in filter", "white", top ? `data-action="open-video" data-id="${top.id}"` : "")}
        ${metricCard("Videos Posted", number.format(total.videos), "Open Videos page", "white", 'data-page="videos"')}
      </section>
      <section class="section trend-section"><div class="section-heading"><div><p class="eyebrow">Views Over Time</p><h3>Daily contribution by posted video</h3></div></div>${miniTrend(viewTimeline(), number.format)}</section>
      <section class="section"><div class="section-heading"><div><p class="eyebrow">Top Contributing Videos</p><h3>Click a row to open Video Detail</h3></div></div><div class="video-table">${videos.map(videoTableRow).join("") || empty("No videos in this filter.")}</div><p class="contributor-total">Displayed video total: ${number.format(shownViews)} views</p></section>
      ${insightCard(insight)}
    `;
  }

  function renderEarnings() {
    return `
      <section class="page-intro"><div><p class="eyebrow">Earnings</p><h2>Source-specific revenue, trends, and contributors.</h2><p>Morning Brief shows what matters now. Earnings explains why it happened.</p></div></section>
      <div class="source-grid">${data.revenueSources.map(sourceCard).join("")}</div>
      ${renderRevenueStory("shop")}
    `;
  }

  function renderSourceDetail() {
    const item = source();
    const total = totals(item.id);
    const metric = activeMetricFor(item.id);
    return `
      ${backButton()}
      <section class="page-intro source-intro ${item.accent}"><div><p class="eyebrow">${item.name}</p><h2>${item.description}</h2><p>${accountName()} · ${readableRange()}</p></div></section>
      <section class="metric-grid compact">
        ${item.metrics.map((entry) => metricCard(entry.label, metricFormat(entry.key, total[entry.key] || 0), entry.key === metric ? "Selected chart metric" : "Click for breakdown", entry.key === metric ? "selected" : "white", `data-action="metric-breakdown" data-id="${entry.key}"`)).join("")}
      </section>
      ${renderRevenueStory(item.id)}
      ${metricBreakdown(item.id, metric)}
    `;
  }

  function renderRevenueStory(sourceId) {
    const item = source(sourceId);
    const metric = activeMetricFor(sourceId);
    const days = sourceDays(sourceId);
    return `
      <section class="section chart-section ${item.accent}">
        <div class="section-heading">
          <div><p class="eyebrow">Earnings Over Time</p><h3>${item.name}: ${item.metrics.find((entry) => entry.key === metric)?.label} by day</h3><p class="muted">Each point represents one day in ${readableRange()}.</p></div>
          <label class="mini-control">Metric<select data-action="source-metric">${item.metrics.map((entry) => `<option value="${entry.key}" ${entry.key === metric ? "selected" : ""}>${entry.label}</option>`).join("")}</select></label>
          <div class="segmented"><button class="${state.storyView === "timeline" ? "active" : ""}" type="button" data-action="story-view" data-id="timeline">Timeline</button><button class="${state.storyView === "calendar" ? "active" : ""}" type="button" data-action="story-view" data-id="calendar">Calendar</button></div>
        </div>
        ${state.storyView === "calendar" ? calendarView(days, sourceId, metric) : timelineView(days, sourceId, metric)}
      </section>
    `;
  }

  function timelineView(days, sourceId, metric) {
    const max = Math.max(...days.map((day) => dayMetric(day, sourceId, metric)), 1);
    const points = days.map((day, index) => {
      const value = dayMetric(day, sourceId, metric);
      return { ...day, value, x: 40 + index * (720 / Math.max(1, days.length - 1)), y: 230 - (value / max) * 170 };
    });
    const line = points.map((point) => `${point.x},${point.y}`).join(" ");
    const activeDay = points.find((day) => day.date === state.selectedDay) || points[points.length - 1];
    return `
      <div class="story-grid">
        <div class="timeline-card">
          <svg viewBox="0 0 800 282" role="img" aria-label="${source(sourceId).name} ${metric} trend">
            <polyline points="${line}" fill="none" stroke="var(--source-color)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
            ${points.map((point) => `<g class="svg-button" tabindex="0" role="button" data-action="select-day" data-id="${point.date}"><circle cx="${point.x}" cy="${point.y}" r="${point.date === activeDay.date ? 8 : 5}"></circle><title>${point.date}: ${metricFormat(metric, point.value)}</title></g>`).join("")}
            ${points.map((point, index) => index % 3 === 0 ? `<text x="${point.x}" y="265" text-anchor="middle">${new Date(`${point.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</text>` : "").join("")}
          </svg>
        </div>
        ${dayDetail(activeDay, sourceId, metric)}
      </div>
    `;
  }

  function calendarView(days, sourceId, metric) {
    const max = Math.max(...days.map((day) => dayMetric(day, sourceId, metric)), 1);
    const activeDay = days.find((day) => day.date === state.selectedDay) || days[days.length - 1];
    return `<div class="story-grid"><div class="heatmap">${days.map((day) => `<button type="button" class="${day.date === activeDay.date ? "active" : ""}" style="--heat:${Math.max(.12, dayMetric(day, sourceId, metric) / max)}" data-action="select-day" data-id="${day.date}"><span>${new Date(`${day.date}T12:00:00`).getDate()}</span><strong>${metricFormat(metric, dayMetric(day, sourceId, metric))}</strong></button>`).join("")}</div>${dayDetail(activeDay, sourceId, metric)}</div>`;
  }

  function dayDetail(day, sourceId, metric) {
    return `
      <aside class="detail-panel"><p class="eyebrow">Daily Detail</p><h3>${day.date}</h3>
      <dl>
        <div><dt>${source(sourceId).metrics.find((entry) => entry.key === metric)?.label}</dt><dd>${metricFormat(metric, dayMetric(day, sourceId, metric))}</dd></div>
        <div><dt>Videos posted</dt><dd>${day.videos}</dd></div>
        <div><dt>Best video</dt><dd>${day.bestVideo}</dd></div>
        <div><dt>${sourceId === "go" ? "Place" : "Product"}</dt><dd>${day.bestProduct}</dd></div>
        <div><dt>Best posting time</dt><dd>${day.time}</dd></div>
      </dl><p class="takeaway">Takeaway: ${day.time} is the strongest visible posting window in this filter.</p></aside>
    `;
  }

  function metricBreakdown(sourceId, metric) {
    const videos = filteredVideos({ sourceId }).sort((a, b) => b.views - a.views).slice(0, 5);
    const noun = sourceId === "go" ? "places and videos" : sourceId === "rewards" ? "eligible videos" : "products and videos";
    return `<section class="section breakdown-panel"><div class="section-heading"><div><p class="eyebrow">Drill Down</p><h3>Contributing ${noun}</h3></div></div><div class="video-table">${videos.map(videoTableRow).join("") || empty("No contributors in this filter.")}</div></section>`;
  }

  function renderOpportunities() {
    const items = data.opportunities.filter((item) => state.accountId === "all" || item.accountId === state.accountId).slice(0, 4);
    return `<section class="page-intro"><div><p class="eyebrow">Opportunity Center</p><h2>Small, actionable signals worth acting on.</h2></div></section><div class="opportunity-grid">${items.map(opportunityCard).join("")}</div>`;
  }

  function opportunityCard(item) {
    return `<button class="opportunity-card" type="button" data-action="open-opportunity" data-id="${item.id}"><span>${item.type}</span><h3>${item.noticed}</h3><p>${item.why}</p><strong>${item.action}</strong><small>${accountName(item.accountId)} →</small></button>`;
  }

  function renderOpportunityDetail() {
    const item = data.opportunities.find((opp) => opp.id === state.selectedOpportunityId);
    const destination = item.targetType === "video" ? video(item.targetId) : product(item.targetId);
    return `${backButton()}<section class="product-studio"><div><p class="eyebrow">Opportunity</p><h2>${item.noticed}</h2><p>${item.why}</p></div><button class="primary-button" type="button" data-action="open-${item.targetType}" data-id="${item.targetId}">Open ${item.targetType === "video" ? "Video Detail" : "Product Studio"}</button></section><section class="section"><h3>Recommended action</h3><p>${item.action}</p><p class="muted">Destination: ${destination.name || destination.title}</p></section>`;
  }

  function renderProducts() {
    const products = sortProducts(filteredProducts());
    return `<section class="page-intro"><div><p class="eyebrow">Product Compass</p><h2>Sample to earnings, without the clutter.</h2><p>Samples needing content and products already earning each open into Product Studio.</p></div><label class="mini-control">Sort products<select data-action="product-sort"><option value="earnings">Earnings</option><option value="views">Views</option><option value="updated">Updated</option></select></label></section><div class="product-grid">${products.map(productCard).join("")}</div>`;
  }

  function productCard(item) {
    const isSample = item.type === "sample";
    return `<button class="product-card ${isSample ? "sample" : ""}" type="button" data-action="open-product" data-id="${item.id}"><span class="product-image">${item.image}</span><span class="pill ${isSample ? "sample-pill" : "earning-pill"}">${isSample ? "Sample" : "Products Earning"}</span><h3>${item.name}</h3><p>${accountName(item.accountId)}</p>${isSample && item.dueDate ? `<small>Post by ${item.dueDate}</small>` : `<small>${money.format(item.earnings)} earned · ${number.format(item.units)} units</small>`}${workflow(item.workflowStep)}</button>`;
  }

  function renderProductDetail() {
    const item = product(state.selectedProductId) || filteredProducts()[0];
    const videos = sortVideos(filteredVideos({ productId: item.id }));
    return `
      ${backButton()}
      <section class="product-studio"><span class="product-image large">${item.image}</span><div><p class="eyebrow">Product Studio</p><h2>${item.name}</h2><p>${accountName(item.accountId)} · ${item.type === "sample" ? "Sample" : `${money.format(item.earnings)} current earnings`}${item.dueDate ? ` · Post by ${item.dueDate}` : ""}</p>${workflow(item.workflowStep)}</div></section>
      <section class="split-grid"><div class="section"><div class="section-heading"><div><p class="eyebrow">Create Content</p><h3>Northstar tools</h3></div></div><div class="tool-grid">${["Generate Hooks", "Generate Script", "Generate Caption", "Generate Hashtags", "Generate Talking Points", "Generate CTA"].map((label) => `<button class="tool-button" type="button" data-action="generate" data-id="${label}" data-product="${item.id}">${label}<span>✦</span></button>`).join("")}</div><div id="generatorOutput" class="workspace-output">Choose a tool to generate a mock creator-ready direction for this product.</div></div><div class="section"><p class="eyebrow">Product Intelligence</p><h3>${item.bestHook}</h3><p>${item.insight}</p><dl class="mini-stats"><div><dt>Earnings</dt><dd>${money.format(item.earnings)}</dd></div><div><dt>GMV</dt><dd>${money.format(item.gmv)}</dd></div><div><dt>Units</dt><dd>${number.format(item.units)}</dd></div></dl></div></section>
      <section class="section"><div class="section-heading"><div><p class="eyebrow">Product Videos</p><h3>Posting time stays visible</h3></div><label class="mini-control">Sort<select data-action="product-video-sort"><option value="date">Date</option><option value="time">Posting time</option><option value="views">Views</option><option value="sales">Sales</option><option value="earnings">Earnings</option></select></label></div><div class="video-table">${videos.map(videoTableRow).join("") || empty("More product videos appear here after import.")}</div></section>
    `;
  }

  function renderVideos() {
    const videos = sortVideos(filteredVideos());
    return `<section class="page-intro"><div><p class="eyebrow">Videos</p><h2>Video performance with posting time preserved.</h2></div><label class="mini-control">Sort videos<select data-action="video-sort"><option value="date">Date</option><option value="time">Posting time</option><option value="views">Views</option><option value="sales">Sales</option><option value="earnings">Earnings</option></select></label></section><div class="video-table">${videos.map(videoTableRow).join("")}</div>`;
  }

  function renderVideoDetail() {
    const item = video(state.selectedVideoId) || filteredVideos()[0];
    const linked = product(item.productId);
    return `${backButton()}<section class="product-studio"><span class="product-image large">${item.thumbnail}</span><div><p class="eyebrow">Video Detail</p><h2>${item.title}</h2><p>${accountName(item.accountId)} · Posted ${item.date} at ${item.time}</p></div></section><section class="metric-grid compact">${metricCard("Views", number.format(item.views), "Public video metric", "white")}${metricCard("Earnings", money.format(item.earnings), item.sourceIds.map((id) => source(id).name).join(" + "), "selected")}${metricCard("Units Sold", number.format(item.units), linked?.name || "Linked product", "white")}${metricCard("Shares", number.format(item.shares), "Audience signal", "white")}</section>`;
  }

  function renderDataHub() {
    return `<section class="page-intro"><div><p class="eyebrow">Data Hub</p><h2>Mock import health and source readiness.</h2></div></section><section class="section muted-grid">${["Manual capture ready", "CSV templates ready", "Screenshot OCR placeholder", "Live sync not connected"].map((item) => `<div><strong>${item}</strong><span>Sandbox-only visual state</span></div>`).join("")}</section>`;
  }

  function renderSettings() {
    return `<section class="page-intro"><div><p class="eyebrow">Settings</p><h2>Useful preferences only.</h2></div></section><div class="settings-grid"><section class="section"><h3>Accounts</h3>${data.accounts.map((item) => `<p>${identity(item.id)} ${item.name} <span class="muted">${item.handle}</span></p>`).join("")}</section><section class="section revenue-settings"><h3>Revenue Sources</h3>${data.revenueSources.map((item) => `<p><span class="source-dot ${item.accent}"></span><strong>${item.name}</strong><small>${item.shortName}</small></p>`).join("")}<button class="secondary-button" type="button" data-action="mock-modal" data-id="Add Revenue Source">Add Revenue Source</button></section><section class="section"><h3>Appearance</h3><label class="mini-control">Dashboard View<select><option>Comfortable</option><option>Compact</option></select></label><label class="mini-control">Theme<select><option>System</option><option>Light</option><option>Dark</option></select></label></section></div>`;
  }

  function productRow(item) {
    return `<button class="list-row" type="button" data-action="open-product" data-id="${item.id}"><span class="product-image small">${item.image}</span><span><strong>${item.name}</strong><small>${accountName(item.accountId)} · ${money.format(item.earnings)}</small></span><em>→</em></button>`;
  }

  function videoRow(item) {
    return `<button class="list-row" type="button" data-action="open-video" data-id="${item.id}"><span class="product-image small">${item.thumbnail}</span><span><strong>${item.title}</strong><small>${item.date} · ${item.time} · ${number.format(item.views)} views</small></span><em>→</em></button>`;
  }

  function sampleCard(item) {
    return `<button class="sample-card" type="button" data-action="open-product" data-id="${item.id}"><span class="product-image">${item.image}</span><span><strong>${item.name}</strong><small>${accountName(item.accountId)}${item.dueDate ? " · Post by " + item.dueDate : ""}</small></span>${workflow(item.workflowStep)}</button>`;
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
    const key = state.page === "product-detail" ? state.productVideoSort : state.videoSort;
    return [...items].sort((a, b) => {
      if (key === "views") return b.views - a.views;
      if (key === "sales") return b.units - a.units;
      if (key === "earnings") return b.earnings - a.earnings;
      if (key === "time") return a.time.localeCompare(b.time);
      return new Date(b.date) - new Date(a.date);
    });
  }

  function workflow(step) {
    return `<div class="workflow">${["Sample", "Content", "Videos", "Earnings"].map((label, index) => `<span class="${index + 1 <= step ? "done" : ""}">${label}</span>`).join("")}</div>`;
  }

  const backButton = () => `<button class="back-button" type="button" data-action="back">← Back</button>`;
  const morningBackButton = () => `<button class="back-button morning-back" type="button" data-action="morning-back">← Morning Brief</button>`;
  const empty = (message) => `<p class="empty">${message}</p>`;

  function showGenerator(tool, productId) {
    const item = product(productId);
    const output = document.getElementById("generatorOutput");
    if (!output) return;
    output.innerHTML = `<strong>${tool}</strong><p>${item.name}: Lead with "${item.bestHook}" and show the practical payoff in the first five seconds.</p><small>Mock Northstar creative direction · ${accountName(item.accountId)}</small>`;
  }

  function renderChrome() {
    const activeNav = ["audience", "view-performance"].includes(state.page) ? "brief" : state.page === "source-detail" ? "earnings" : state.page;
    els.nav.innerHTML = navItems.map(([id, label]) => `<button class="${activeNav === id ? "active" : ""}" type="button" data-page="${id}">${label}</button>`).join("");
    const active = account();
    els.accountAvatar.className = `avatar ${state.accountId === "all" ? "avatar-all" : `avatar-${active.id}`}`;
    els.accountAvatar.innerHTML = state.accountId === "all" ? "<i>RR</i><i>TT</i>" : `<i>${active.initials}</i>`;
    els.accountLabel.textContent = accountName();
    els.dateLabel.textContent = state.dateRange === "custom" ? `${state.customStart} → ${state.customEnd}` : readableRange();
    els.accountMenu.innerHTML = [`<button role="option" data-action="account" data-id="all">${identity("all")}<span>All Accounts<small>Combined view</small></span></button>`, ...data.accounts.map((item) => `<button role="option" data-action="account" data-id="${item.id}">${identity(item.id)}<span>${item.name}<small>${item.focus}</small></span></button>`)].join("");
    els.dateMenu.querySelector(".date-options").innerHTML = dateRanges.map(([id, label]) => `<button class="${state.dateRange === id ? "active" : ""}" type="button" data-action="date-range" data-id="${id}">${label}</button>`).join("");
  }

  function render() {
    renderChrome();
    const titles = { brief: "Morning Brief", audience: "Audience", "view-performance": "View Performance", opportunities: "Opportunity Center", earnings: "Earnings", products: "Products", videos: "Videos", data: "Data Hub", settings: "Settings", "product-detail": "Product Studio", "video-detail": "Video Detail", "source-detail": source()?.name || "Revenue Source", "opportunity-detail": "Opportunity Detail" };
    const pages = { brief: renderBrief, audience: renderAudience, "view-performance": renderViewPerformance, opportunities: renderOpportunities, earnings: renderEarnings, products: renderProducts, videos: renderVideos, data: renderDataHub, settings: renderSettings, "product-detail": renderProductDetail, "video-detail": renderVideoDetail, "source-detail": renderSourceDetail, "opportunity-detail": renderOpportunityDetail };
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
      state.dateRange = id; els.customPanel.hidden = true; els.dateMenu.hidden = true; render();
    }
    if (action.dataset.action === "open-source") setPage("source-detail", id);
    if (action.dataset.action === "open-product") setPage("product-detail", id);
    if (action.dataset.action === "open-video") setPage("video-detail", id);
    if (action.dataset.action === "open-opportunity") setPage("opportunity-detail", id);
    if (action.dataset.action === "story-view") { state.storyView = id; render(); }
    if (action.dataset.action === "select-day") { state.selectedDay = id; render(); }
    if (action.dataset.action === "metric-breakdown") { state.activeMetric = id; render(); }
    if (action.dataset.action === "back") goBack();
    if (action.dataset.action === "morning-back") setPage("brief", null, false);
    if (action.dataset.action === "generate") showGenerator(id, action.dataset.product);
    if (action.dataset.action === "cancel-custom") { els.customPanel.hidden = true; els.dateMenu.hidden = true; }
    if (action.dataset.action === "mock-modal") alert(`${id} is a visual prototype action.`);
  });

  document.addEventListener("change", (event) => {
    const action = event.target.dataset.action;
    if (action === "product-sort") { state.productSort = event.target.value; render(); }
    if (action === "video-sort") { state.videoSort = event.target.value; render(); }
    if (action === "product-video-sort") { state.productVideoSort = event.target.value; render(); }
    if (action === "source-metric") { state.activeMetric = event.target.value; render(); }
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
