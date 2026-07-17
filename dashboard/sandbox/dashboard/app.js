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
    selectedOrderId: null,
    audienceMode: "viewers",
    audienceDemo: "gender",
    activityMode: "hours",
    attributionFilter: "all",
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
  const order = (id) => data.shopOrders.find((item) => item.id === id);

  const sectionIcon = {
    "Revenue Compass": "M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3zm0 5.6L10.6 12l1.4 3.4 1.4-3.4L12 8.6z",
    "Product Compass": "M5 7.5 12 4l7 3.5v8.9L12 20l-7-3.6V7.5zm7 4.1 7-3.6M12 11.6 5 8m7 3.6V20",
    "Product Studio": "M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2zm7 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z",
    "Northstar Pulse": "M3 13h4l2-7 4 13 2-6h6M18 4l.8 2.2L21 7l-2.2.8L18 10l-.8-2.2L15 7l2.2-.8L18 4z",
    "Northstar Insight": "M12 3a6 6 0 0 0-3.3 11v2.5h6.6V14A6 6 0 0 0 12 3zm-2 17h4",
    "Opportunity Center": "M4 18c5-1 9-5 10-10l2 2 4-6-7 1 2 2C14 11 10 15 4 18zM5 6h4v4H5z",
    "Audience": "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-4 3-6 5-6s4.3 2 5 6m-2 0c.7-3.2 2.7-5 5-5 2 0 4 1.7 5 5",
    "View Performance": "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  };

  function icon(name) {
    return `<span class="heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${sectionIcon[name] || sectionIcon["Northstar Insight"]}"></path></svg></span>`;
  }

  function heading(eyebrow, title, iconName = eyebrow) {
    return `<div class="section-heading"><div class="heading-title">${icon(iconName)}<div><p class="eyebrow">${eyebrow}</p><h3>${title}</h3></div></div></div>`;
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
    const audience = activeAudience("viewers");
    const bestDay = largestEntry(audience.weekdays);
    const direction = strongestSource.change >= 0 ? "up" : "down";
    const changeText = strongestSource.change === 0 ? "is steady" : `is ${direction} ${Math.abs(strongestSource.change)}%`;
    return [
      ["Revenue", `${strongestSource.shortName} revenue ${changeText} in this filter.`],
      ["Top seller", `${leader?.bestProduct || "A leading product"} is the strongest seller.`],
      ["Audience", `${bestDay?.[0] || "Thursday"} remains the strongest viewer day.`],
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

  function filteredOrders(extra = {}) {
    return data.shopOrders
      .filter(accountMatches)
      .filter((item) => inRange(item.date))
      .filter((item) => !extra.productId || item.productId === extra.productId)
      .filter((item) => !extra.videoId || item.videoId === extra.videoId)
      .filter((item) => !extra.attributionType || item.attributionType === extra.attributionType);
  }

  function commissionValue(item) {
    return Number(item.actualCommission ?? item.estimatedCommission ?? 0);
  }

  function orderGmv(item) {
    return Number(item.price || 0) * Number(item.quantity || 0);
  }

  function attributionSummary(extra = {}) {
    const orders = filteredOrders(extra);
    const base = { orders: 0, units: 0, gmv: 0, commission: 0, rateBase: 0, weightedRate: 0 };
    const summary = { organic_video: { ...base }, shop_ad: { ...base }, all: { ...base } };
    orders.forEach((item) => {
      const key = item.attributionType;
      [summary[key], summary.all].forEach((bucket) => {
        bucket.orders += 1;
        bucket.units += item.quantity;
        bucket.gmv += orderGmv(item);
        bucket.commission += commissionValue(item);
        bucket.rateBase += item.commissionBase;
        bucket.weightedRate += item.commissionBase * item.commissionRate;
      });
    });
    Object.values(summary).forEach((bucket) => {
      bucket.avgRate = bucket.rateBase ? bucket.weightedRate / bucket.rateBase : 0;
    });
    return summary;
  }

  function attributionLabel(type) {
    return type === "shop_ad" ? "Shop Ads" : "Organic Video";
  }

  function attributionBadge(type) {
    return `<span class="attribution-badge ${type}">${attributionLabel(type)}</span>`;
  }

  function selectedAudienceRecord(accountId = state.accountId) {
    const records = data.audience.filter((item) => accountId === "all" || item.accountId === accountId);
    if (accountId !== "all") return records[0];
    const merged = { accountId: "all", range: "month", viewers: {}, followers: {} };
    ["viewers", "followers"].forEach((mode) => {
      const first = records[0][mode];
      const total = records.reduce((sum, item) => sum + item[mode].total, 0);
      const combinePercent = (field) => Object.fromEntries(Object.keys(first[field]).map((key) => [
        key,
        Math.round(records.reduce((sum, item) => sum + item[mode][field][key] * item[mode].total, 0) / Math.max(1, total))
      ]));
      const sumArray = (field) => first[field].map((_, index) => records.reduce((sum, item) => sum + item[mode][field][index], 0));
      merged[mode] = {
        total,
        new: records.reduce((sum, item) => sum + (item[mode].new || 0), 0),
        returning: records.reduce((sum, item) => sum + (item[mode].returning || 0), 0),
        netNew: records.reduce((sum, item) => sum + (item[mode].netNew || 0), 0),
        gained: records.reduce((sum, item) => sum + (item[mode].gained || 0), 0),
        lost: records.reduce((sum, item) => sum + (item[mode].lost || 0), 0),
        gender: combinePercent("gender"),
        age: combinePercent("age"),
        locations: combinePercent("locations"),
        hourly: sumArray("hourly"),
        weekdays: Object.fromEntries(Object.keys(first.weekdays).map((key) => [key, records.reduce((sum, item) => sum + item[mode].weekdays[key], 0)])),
        trend: sumArray("trend")
      };
    });
    return merged;
  }

  function activeAudience(mode = state.audienceMode) {
    const record = selectedAudienceRecord();
    return record?.[mode] || selectedAudienceRecord("all")[mode];
  }

  function largestEntry(object) {
    return Object.entries(object).sort((a, b) => b[1] - a[1])[0];
  }

  function bestHourLabel(values) {
    const index = values.indexOf(Math.max(...values));
    const next = (index + 1) % 24;
    const fmt = (hour) => new Date(`2026-07-16T${String(hour).padStart(2, "0")}:00:00`).toLocaleTimeString("en-US", { hour: "numeric" });
    return `${fmt(index)}-${fmt(next)}`;
  }

  function sourceDays(sourceId) {
    return data.days.filter((day) => inRange(day.date)).map((day) => {
      const parts = accountIds().map((id) => accountPart(day, id));
      const orders = sourceId === "shop" ? filteredOrders().filter((item) => item.date === day.date) : [];
      const shopEarnings = orders.reduce((sum, item) => sum + commissionValue(item), 0);
      return {
        date: day.date,
        earnings: sourceId === "shop" ? shopEarnings : parts.reduce((sum, part) => sum + (part[sourceId] || 0), 0),
        videos: parts.reduce((sum, part) => sum + part.videos, 0),
        units: sourceId === "shop" ? orders.reduce((sum, item) => sum + item.quantity, 0) : parts.reduce((sum, part) => sum + (sourceId === "go" ? part.bookings || part.units || 0 : part.units || 0), 0),
        bestVideo: parts.find((part) => part[sourceId])?.bestVideo || parts[0]?.bestVideo || "No video",
        bestProduct: parts.find((part) => part[sourceId])?.bestProduct || parts[0]?.bestProduct || "No product",
        time: parts.find((part) => part[sourceId])?.time || parts[0]?.time || "N/A"
      };
    });
  }

  function totalEarnings() {
    const shop = filteredOrders().reduce((sum, item) => sum + commissionValue(item), 0);
    return data.days.filter((day) => inRange(day.date)).reduce((sum, day) => (
      sum + accountIds().reduce((inner, id) => {
        const part = accountPart(day, id);
        return inner + part.rewards + part.go;
      }, 0)
    ), shop);
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
      commission: sourceId === "shop" ? earnings : sourceId === "go" ? earnings : videos.reduce((sum, item) => sum + ((!sourceId && item.sourceIds.includes("shop")) ? item.earnings : 0), 0),
      gmv: sourceId === "shop" ? filteredOrders().reduce((sum, item) => sum + orderGmv(item), 0) : videos.reduce((sum, item) => sum + item.gmv, 0),
      units: sourceId === "shop" ? filteredOrders().reduce((sum, item) => sum + item.quantity, 0) : videos.reduce((sum, item) => sum + item.units, 0),
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
    if (push) state.history.push({ page: state.page, id: state.selectedProductId || state.selectedVideoId || state.selectedOpportunityId || state.selectedOrderId || state.activeSource });
    state.page = page;
    if (page === "product-detail") state.selectedProductId = id;
    if (page === "video-detail") state.selectedVideoId = id;
    if (page === "opportunity-detail") state.selectedOpportunityId = id;
    if (page === "order-detail") state.selectedOrderId = id;
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
    if (previous.page === "order-detail") state.selectedOrderId = previous.id;
    if (previous.page === "source-detail") state.activeSource = previous.id;
    render();
  }

  function metricFormat(key, value) {
    return ["units", "productsEarning", "qualifiedViews", "eligibleVideos", "linkClicks", "bookings", "placesEarning"].includes(key)
      ? number.format(Math.round(value))
      : money.format(value);
  }

  function dayMetric(day, sourceId, key) {
    if (sourceId === "shop") {
      const orders = filteredOrders().filter((item) => item.date === day.date);
      if (key === "gmv") return orders.reduce((sum, item) => sum + orderGmv(item), 0);
      if (key === "units") return orders.reduce((sum, item) => sum + item.quantity, 0);
      if (key === "productsEarning") return new Set(orders.map((item) => item.productId)).size;
    }
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
    const audience = activeAudience("viewers");
    const gender = audience.gender;
    const largestAge = largestEntry(audience.age);
    const bestDay = largestEntry(audience.weekdays);
    const bestHour = bestHourLabel(audience.hourly);
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
        ${heading("Revenue Compass", "See what is guiding your earnings.")}
        <div class="source-grid">${data.revenueSources.map(sourceCard).join("")}</div>
      </section>
      <button class="audience-glance section" type="button" data-page="audience" data-audience-mode="viewers">
        ${icon("Audience")}
        <span><strong>Audience at a Glance</strong><small>${gender.Female}% Women · ${gender.Male}% Men</small></span>
        <span><small>Largest group</small><b>${largestAge[0]}</b></span>
        <span><small>Best day</small><b>${bestDay[0]}</b></span>
        <span><small>Best time</small><b>${bestHour}</b></span>
      </button>
      <section class="split-grid">
        <div class="section">${heading("Product Compass", "Products carrying momentum")}<div class="stack">${topProducts.map(productRow).join("")}</div></div>
        <div class="section">${heading("View Performance", "Videos with useful signals")}<div class="stack">${topVideos.map(videoRow).join("")}</div></div>
      </section>
      <section class="section soft-section">${heading("Product Studio", "Samples waiting for content")}<div class="sample-grid">${samples.map(sampleCard).join("") || empty("No samples need content in this filter.")}</div></section>
    `;
  }

  function sourceCard(item) {
    const total = totals(item.id);
    const primary = total.earnings;
    const detail = item.id === "shop" ? `${total.productsEarning} products earning` : item.id === "rewards" ? `${total.eligibleVideos} eligible videos` : `${total.placesEarning} places earning`;
    const attribution = attributionSummary();
    const attributionLine = item.id === "shop" ? `<p class="attribution-line">${money.format(attribution.organic_video.commission)} Organic · ${money.format(attribution.shop_ad.commission)} Shop Ads</p>` : "";
    return `<button class="source-card ${item.accent}" type="button" data-action="open-source" data-id="${item.id}"><span class="source-dot"></span><small>${item.name}</small><strong>${money.format(primary)}</strong><p>${detail}</p>${attributionLine}</button>`;
  }

  function renderAudience() {
    const item = activeAudience();
    const isViewers = state.audienceMode === "viewers";
    const largestGender = largestEntry(item.gender);
    const largestAge = largestEntry(item.age);
    const topLocation = largestEntry(item.locations);
    const bestDay = largestEntry(item.weekdays);
    const bestTime = bestHourLabel(item.hourly);
    const accountBreakdown = state.accountId === "all"
      ? `<section class="section"><div class="section-heading"><div><p class="eyebrow">Account Breakdown</p><h3>Followers by account</h3></div></div><div class="breakdown-cards">${data.accounts.map((item) => `<article><span>${identity(item.id)}</span><strong>${number.format(currentFollowers(item.id))}</strong><small>${item.name} · +${number.format(periodFollowerGain(item.id))} in ${readableRange()}</small></article>`).join("")}</div></section>`
      : "";
    const insight = isViewers
      ? `${largestAge[0]} viewers and ${bestDay[0]} activity are the clearest planning signals for ${accountName()} in this sandbox view.`
      : `${largestGender[0]} followers are leading the audience mix, with the strongest follower activity around ${bestTime}.`;
    return `
      ${morningBackButton()}
      <section class="page-intro"><div><p class="eyebrow">Audience</p><h2>${isViewers ? "Viewer" : "Follower"} intelligence for ${accountName()}.</h2><p>${readableRange()} · Sandbox mock data structured for future authorized sources.</p></div><div class="segmented"><button class="${state.audienceMode === "viewers" ? "active" : ""}" type="button" data-action="audience-mode" data-id="viewers">Viewers</button><button class="${state.audienceMode === "followers" ? "active" : ""}" type="button" data-action="audience-mode" data-id="followers">Followers</button></div></section>
      <section class="metric-grid compact">
        ${isViewers ? metricCard("Total Viewers", number.format(item.total), "Selected account/date", "white") : metricCard("Total Followers", number.format(item.total), "Current audience base", "white")}
        ${isViewers ? metricCard("New Viewers", number.format(item.new), "Sandbox viewer signal", "gold") : metricCard("Net Followers", `+${number.format(item.netNew)}`, `${number.format(item.gained)} gained · ${number.format(item.lost)} lost`, "gold")}
        ${metricCard("Best Day", bestDay[0], `${number.format(bestDay[1])} activity points`, "white")}
        ${metricCard("Best Time", bestTime, "Most active hour window", "white")}
      </section>
      <section class="section trend-section">${heading(isViewers ? "Viewer Trend" : "Follower Growth", "Selected-period timeline", "Audience")}${miniTrend(item.trend.map((value, index) => ({ date: data.days[index]?.date || `Day ${index + 1}`, value })), number.format)}</section>
      <section class="split-grid">
        <div class="section">${heading("Audience", "Demographics")}<div class="segmented sub-tabs"><button class="${state.audienceDemo === "gender" ? "active" : ""}" type="button" data-action="audience-demo" data-id="gender">Gender</button><button class="${state.audienceDemo === "age" ? "active" : ""}" type="button" data-action="audience-demo" data-id="age">Age</button><button class="${state.audienceDemo === "locations" ? "active" : ""}" type="button" data-action="audience-demo" data-id="locations">Locations</button></div>${demographicPanel(item)}</div>
        <div class="section">${heading("Audience", "Most Active")}<div class="segmented sub-tabs"><button class="${state.activityMode === "hours" ? "active" : ""}" type="button" data-action="activity-mode" data-id="hours">Hours</button><button class="${state.activityMode === "days" ? "active" : ""}" type="button" data-action="activity-mode" data-id="days">Days</button></div>${activityPanel(item)}</div>
      </section>
      ${accountBreakdown}
      ${insightCard(insight)}
    `;
  }

  function demographicPanel(item) {
    if (state.audienceDemo === "age") {
      const largest = largestEntry(item.age)[0];
      return `<div class="bar-list">${Object.entries(item.age).map(([label, value]) => `<div class="${label === largest ? "largest" : ""}"><span>${label}</span><b style="--value:${value}%"></b><strong>${value}%</strong></div>`).join("")}</div>`;
    }
    if (state.audienceDemo === "locations") {
      return `<div class="rank-list">${Object.entries(item.locations).map(([label, value], index) => `<div><span>${index + 1}</span><strong>${label}</strong><b>${value}%</b></div>`).join("")}</div>`;
    }
    return `<div class="donut-panel"><div class="donut" style="--a:${item.gender.Female}%;--b:${item.gender.Male}%"></div><div class="legend-list">${Object.entries(item.gender).map(([label, value]) => `<span><i></i>${label}<strong>${value}%</strong></span>`).join("")}</div></div>`;
  }

  function activityPanel(item) {
    if (state.activityMode === "days") {
      const strongest = largestEntry(item.weekdays)[0];
      return `<div class="activity-bars day-bars">${Object.entries(item.weekdays).map(([label, value]) => `<button type="button" class="${label === strongest ? "active" : ""}" title="${label}: ${number.format(value)}"><b style="--height:${Math.max(12, value / Math.max(...Object.values(item.weekdays)) * 100)}%"></b><span>${label}</span></button>`).join("")}</div><p class="muted activity-summary">Your ${state.audienceMode} were most active on ${strongest}.</p>`;
    }
    const max = Math.max(...item.hourly);
    const strongest = item.hourly.indexOf(max);
    return `<div class="activity-bars">${item.hourly.map((value, hour) => `<button type="button" class="${hour === strongest ? "active" : ""}" title="${hour}:00 · ${number.format(value)}"><b style="--height:${Math.max(8, value / max * 100)}%"></b><span>${hour % 6 === 0 ? hour : ""}</span></button>`).join("")}</div><p class="muted activity-summary">Your ${state.audienceMode} were most active between ${bestHourLabel(item.hourly)}.</p>`;
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
    const shopDetails = item.id === "shop" ? renderShopAttributionDetail() : "";
    return `
      ${backButton()}
      <section class="page-intro source-intro ${item.accent}"><div><p class="eyebrow">${item.name}</p><h2>${item.description}</h2><p>${accountName()} · ${readableRange()}</p></div></section>
      <section class="metric-grid compact">
        ${item.metrics.map((entry) => metricCard(entry.label, metricFormat(entry.key, total[entry.key] || 0), entry.key === metric ? "Selected chart metric" : "Click for breakdown", entry.key === metric ? "selected" : "white", `data-action="metric-breakdown" data-id="${entry.key}"`)).join("")}
      </section>
      ${shopDetails}
      ${renderRevenueStory(item.id)}
      ${metricBreakdown(item.id, metric)}
    `;
  }

  function renderShopAttributionDetail(extra = {}) {
    const summary = attributionSummary(extra);
    const filter = state.attributionFilter === "all" ? null : state.attributionFilter;
    const orders = filteredOrders({ ...extra, attributionType: filter }).sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
      <section class="section attribution-section">
        ${heading("Sales Attribution", "Organic Video and Shop Ads commission", "Revenue Compass")}
        <div class="segmented attribution-filter">
          <button class="${state.attributionFilter === "all" ? "active" : ""}" type="button" data-action="attribution-filter" data-id="all">All Sales</button>
          <button class="${state.attributionFilter === "organic_video" ? "active" : ""}" type="button" data-action="attribution-filter" data-id="organic_video">Organic Video</button>
          <button class="${state.attributionFilter === "shop_ad" ? "active" : ""}" type="button" data-action="attribution-filter" data-id="shop_ad">Shop Ads</button>
        </div>
        <div class="attribution-grid">
          ${attributionSummaryCard("organic_video", summary.organic_video)}
          ${attributionSummaryCard("shop_ad", summary.shop_ad)}
        </div>
        <div class="order-list">${orders.map(orderRow).join("") || empty("No orders in this attribution filter.")}</div>
      </section>
    `;
  }

  function attributionSummaryCard(type, item) {
    return `<article class="attribution-card ${type}">${attributionBadge(type)}<dl><div><dt>Orders</dt><dd>${number.format(item.orders)}</dd></div><div><dt>Units</dt><dd>${number.format(item.units)}</dd></div><div><dt>GMV</dt><dd>${money.format(item.gmv)}</dd></div><div><dt>Commission</dt><dd>${money.format(item.commission)}</dd></div><div><dt>Avg rate</dt><dd>${Math.round(item.avgRate * 1000) / 10}%</dd></div></dl></article>`;
  }

  function orderRow(item) {
    const linkedProduct = product(item.productId);
    const linkedVideo = video(item.videoId);
    return `<button class="order-row" type="button" data-action="open-order" data-id="${item.id}"><span class="product-image small">${linkedProduct?.image || "✦"}</span><span><strong>${linkedProduct?.name || "Linked product"}</strong><small>${item.status} · ${linkedVideo?.title || "No video linked"}</small></span>${attributionBadge(item.attributionType)}<span>${money.format(item.price)} × ${item.quantity}</span><span>${Math.round(item.commissionRate * 1000) / 10}%</span><strong>${money.format(commissionValue(item))}</strong></button>`;
  }

  function renderOrderDetail() {
    const item = order(state.selectedOrderId) || filteredOrders()[0];
    const linkedProduct = product(item.productId);
    const linkedVideo = video(item.videoId);
    return `
      ${backButton()}
      <section class="product-studio"><span class="product-image large">${linkedProduct?.image || "✦"}</span><div><p class="eyebrow">Order Detail</p><h2>${linkedProduct?.name || "TikTok Shop order"}</h2><p>${accountName(item.accountId)} · ${item.date} · ${item.status}</p>${attributionBadge(item.attributionType)}</div></section>
      <section class="section"><dl class="detail-list">
        <div><dt>Order ID</dt><dd>${item.id}</dd></div>
        <div><dt>Attribution</dt><dd>${attributionLabel(item.attributionType)}</dd></div>
        <div><dt>Product</dt><dd>${linkedProduct?.name || "Linked product"}</dd></div>
        <div><dt>Video</dt><dd>${linkedVideo?.title || "No video linked"}</dd></div>
        <div><dt>Product price</dt><dd>${money.format(item.price)}</dd></div>
        <div><dt>Quantity</dt><dd>${number.format(item.quantity)}</dd></div>
        <div><dt>Commission base</dt><dd>${money.format(item.commissionBase)}</dd></div>
        <div><dt>Commission rate</dt><dd>${Math.round(item.commissionRate * 1000) / 10}%</dd></div>
        <div><dt>Earnings</dt><dd>${money.format(commissionValue(item))}</dd></div>
        <div><dt>Settlement</dt><dd>${item.settlement}</dd></div>
      </dl></section>
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
    const orderSummary = attributionSummary({ productId: item.id });
    return `
      ${backButton()}
      <section class="product-studio"><span class="product-image large">${item.image}</span><div><p class="eyebrow">Product Studio</p><h2>${item.name}</h2><p>${accountName(item.accountId)} · ${item.type === "sample" ? "Sample" : `${money.format(item.earnings)} current earnings`}${item.dueDate ? ` · Post by ${item.dueDate}` : ""}</p>${workflow(item.workflowStep)}</div></section>
      <section class="split-grid"><div class="section"><div class="section-heading"><div><p class="eyebrow">Create Content</p><h3>Northstar tools</h3></div></div><div class="tool-grid">${["Generate Hooks", "Generate Script", "Generate Caption", "Generate Hashtags", "Generate Talking Points", "Generate CTA"].map((label) => `<button class="tool-button" type="button" data-action="generate" data-id="${label}" data-product="${item.id}">${label}<span>✦</span></button>`).join("")}</div><div id="generatorOutput" class="workspace-output">Choose a tool to generate a mock creator-ready direction for this product.</div></div><div class="section"><p class="eyebrow">Product Intelligence</p><h3>${item.bestHook}</h3><p>${item.insight}</p><dl class="mini-stats"><div><dt>Earnings</dt><dd>${money.format(item.earnings)}</dd></div><div><dt>GMV</dt><dd>${money.format(item.gmv)}</dd></div><div><dt>Units</dt><dd>${number.format(item.units)}</dd></div></dl></div></section>
      <section class="section attribution-section">${heading("Sales Attribution", "How this product earned", "Revenue Compass")}<div class="attribution-grid">${attributionSummaryCard("organic_video", orderSummary.organic_video)}${attributionSummaryCard("shop_ad", orderSummary.shop_ad)}</div></section>
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
    const orderSummary = attributionSummary({ videoId: item.id });
    const totalOrders = orderSummary.all.orders;
    const shopShare = orderSummary.all.commission ? Math.round((orderSummary.shop_ad.commission / orderSummary.all.commission) * 100) : 0;
    const insight = totalOrders
      ? shopShare > 0 ? `Shop Ads generated ${shopShare}% of this video's shop commission, but organic sales paid a different average rate.` : "This video is currently earning from organic product-linked traffic in the sandbox data."
      : "No TikTok Shop orders are connected to this video in the sandbox data yet.";
    return `${backButton()}<section class="product-studio"><span class="product-image large">${item.thumbnail}</span><div><p class="eyebrow">Video Detail</p><h2>${item.title}</h2><p>${accountName(item.accountId)} · Posted ${item.date} at ${item.time}</p></div></section><section class="metric-grid compact">${metricCard("Views", number.format(item.views), "Public video metric", "white")}${metricCard("Earnings", money.format(item.earnings), item.sourceIds.map((id) => source(id).name).join(" + "), "selected")}${metricCard("Units Sold", number.format(item.units), linked?.name || "Linked product", "white")}${metricCard("Shares", number.format(item.shares), "Audience signal", "white")}</section><section class="section attribution-section">${heading("Sales Attribution", "Video earnings by origin", "Revenue Compass")}<div class="attribution-grid">${orderSummary.organic_video.orders ? attributionSummaryCard("organic_video", orderSummary.organic_video) : ""}${orderSummary.shop_ad.orders ? attributionSummaryCard("shop_ad", orderSummary.shop_ad) : ""}</div>${insightCard(insight)}</section>`;
  }

  function renderDataHub() {
    return `<section class="page-intro"><div><p class="eyebrow">Data Hub</p><h2>Sandbox source readiness by data category.</h2><p>No live TikTok service is connected in this prototype.</p></div></section><section class="section data-source-grid">${data.dataHubSources.map((item) => `<article><span class="status-dot ${item.status.toLowerCase().replaceAll(" ", "-")}"></span><strong>${item.name}</strong><small>${item.status}</small><dl><div><dt>Last updated</dt><dd>${item.lastUpdated}</dd></div><div><dt>Records</dt><dd>${number.format(item.records)}</dd></div><div><dt>Source</dt><dd>${item.dataSource.replaceAll("_", " ")}</dd></div></dl></article>`).join("")}</section>`;
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
    const orderTypes = [...new Set(filteredOrders({ videoId: item.id }).map((entry) => entry.attributionType))];
    return `<button class="video-row" type="button" data-action="open-video" data-id="${item.id}"><span class="product-image small">${item.thumbnail}</span><strong>${item.title}</strong><span>${accountName(item.accountId)}</span><span>${item.date}<b>${item.time}</b></span><span>${number.format(item.views)}</span><span>${number.format(item.units)}</span><span>${money.format(item.gmv)}</span><span>${money.format(item.earnings)}${orderTypes.length ? `<small class="badge-stack">${orderTypes.map(attributionBadge).join("")}</small>` : ""}</span></button>`;
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
    const activeNav = ["audience", "view-performance"].includes(state.page) ? "brief" : ["source-detail", "order-detail"].includes(state.page) ? "earnings" : state.page;
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
    const titles = { brief: "Morning Brief", audience: "Audience", "view-performance": "View Performance", opportunities: "Opportunity Center", earnings: "Earnings", products: "Products", videos: "Videos", data: "Data Hub", settings: "Settings", "product-detail": "Product Studio", "video-detail": "Video Detail", "source-detail": source()?.name || "Revenue Source", "opportunity-detail": "Opportunity Detail", "order-detail": "Order Detail" };
    const pages = { brief: renderBrief, audience: renderAudience, "view-performance": renderViewPerformance, opportunities: renderOpportunities, earnings: renderEarnings, products: renderProducts, videos: renderVideos, data: renderDataHub, settings: renderSettings, "product-detail": renderProductDetail, "video-detail": renderVideoDetail, "source-detail": renderSourceDetail, "opportunity-detail": renderOpportunityDetail, "order-detail": renderOrderDetail };
    els.title.textContent = titles[state.page] || "Morning Brief";
    els.content.innerHTML = pages[state.page]();
  }

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      if (pageButton.dataset.audienceMode) state.audienceMode = pageButton.dataset.audienceMode;
      return setPage(pageButton.dataset.page);
    }
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
    if (action.dataset.action === "open-order") setPage("order-detail", id);
    if (action.dataset.action === "open-opportunity") setPage("opportunity-detail", id);
    if (action.dataset.action === "story-view") { state.storyView = id; render(); }
    if (action.dataset.action === "select-day") { state.selectedDay = id; render(); }
    if (action.dataset.action === "metric-breakdown") { state.activeMetric = id; render(); }
    if (action.dataset.action === "audience-mode") { state.audienceMode = id; render(); }
    if (action.dataset.action === "audience-demo") { state.audienceDemo = id; render(); }
    if (action.dataset.action === "activity-mode") { state.activityMode = id; render(); }
    if (action.dataset.action === "attribution-filter") { state.attributionFilter = id; render(); }
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
