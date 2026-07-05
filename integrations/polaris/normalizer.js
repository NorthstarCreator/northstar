(function () {
  function baseRecord(type, source, accountId, notes) {
    const now = new Date().toISOString();
    return {
      id: "",
      type,
      source: source.id || source.name,
      accountId: accountId || "",
      platform: source.id && source.id.includes("tiktok") ? "TikTok" : "Northstar Local",
      capturedAt: now,
      rawSourceId: "",
      normalizedAt: now,
      confidence: source.available ? 92 : 55,
      notes: notes || ""
    };
  }

  function accountIdFor(row, fallback) {
    return row.accountId || String(row.account || fallback || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function normalizeProduct(row, source, fallbackAccount) {
    const base = baseRecord("Product", source, accountIdFor(row, fallbackAccount), "Normalized product signal.");
    return {
      ...base,
      id: row.id || `product-${Date.now()}`,
      rawSourceId: row.rawSourceId || row.id || "",
      name: row.name || row.productName || "Untitled product",
      category: row.categoryGroup || row.category || "Uncategorized",
      gmv: Number(row.lifetimeGmv || row.gmv || 0),
      commission: Number(row.lifetimeCommission || row.commission || 0),
      unitsSold: Number(row.lifetimeUnits || row.unitsSold || 0),
      status: row.status || "Watch"
    };
  }

  function normalizeVideo(row, source, fallbackAccount) {
    const base = baseRecord("Video", source, accountIdFor(row, fallbackAccount), "Normalized content signal.");
    return {
      ...base,
      id: row.id || `video-${Date.now()}`,
      rawSourceId: row.rawSourceId || row.id || "",
      productId: row.productId || "",
      hook: row.hook || row.hookText || "Untitled hook",
      datePosted: row.datePosted || row.date || "",
      views: Number(row.views || 0),
      likes: Number(row.likes || 0),
      comments: Number(row.comments || 0),
      shares: Number(row.shares || 0),
      saves: Number(row.saves || 0),
      sales: Number(row.sales || 0),
      gmv: Number(row.gmv || 0),
      commission: Number(row.commission || 0),
      newFollowers: Number(row.newFollowers || 0),
      creatorRewardsEarned: Number(row.creatorRewardsEarned || row.estimatedRewards || 0)
    };
  }

  function normalizeSalesRecord(product, source, fallbackAccount) {
    const base = baseRecord("SalesRecord", source, accountIdFor(product, fallbackAccount), "Derived from product lifetime and monthly performance.");
    const latest = (product.monthlyPerformance || []).at(-1) || {};
    return {
      ...base,
      id: `${product.id || product.name}-sales-${latest.month || "lifetime"}`,
      rawSourceId: product.id || "",
      productId: product.id || "",
      productName: product.name || "",
      period: latest.month || "Lifetime",
      gmv: Number(latest.gmv || product.lifetimeGmv || 0),
      commission: Number(latest.commission || product.lifetimeCommission || 0),
      unitsSold: Number(latest.units || product.lifetimeUnits || 0)
    };
  }

  function normalizeSample(row, source, fallbackAccount) {
    const base = baseRecord("SampleRecord", source, accountIdFor(row, fallbackAccount), "Normalized sample pipeline signal.");
    return {
      ...base,
      id: row.id || `sample-${Date.now()}`,
      rawSourceId: row.rawSourceId || row.id || "",
      productName: row.productName || row.name || "Untitled sample",
      status: row.status || "Watch",
      priority: row.priority || "Medium",
      notes: row.notes || base.notes
    };
  }

  function normalizeLesson(row, source, fallbackAccount) {
    const base = baseRecord("Lesson", source, accountIdFor(row, fallbackAccount), "Normalized Knowledge Vault lesson.");
    return {
      ...base,
      id: row.id || `lesson-${Date.now()}`,
      title: row.title || "Creator lesson",
      lesson: row.lesson || row.notes || "",
      tags: row.tags || [],
      confidence: Number(row.confidence || base.confidence)
    };
  }

  function normalizeImportBatch(row, source, fallbackAccount) {
    const base = baseRecord("ImportBatch", source, accountIdFor(row, fallbackAccount), "Normalized capture batch.");
    return {
      ...base,
      id: row.id || `import-${Date.now()}`,
      fileName: row.fileName || row.source || "Local capture",
      dataType: row.dataType || row.type || "Mixed",
      rowsImported: Number(row.rowsImported || row.rows || 0),
      rowsSkipped: Number(row.rowsSkipped || 0),
      rowsUpdated: Number(row.rowsUpdated || 0)
    };
  }

  function normalizeCapture(capture) {
    const source = capture.source;
    const account = capture.accountLabel;
    const products = (capture.products || []).map((row) => normalizeProduct(row, source, account));
    const videos = (capture.videos || []).map((row) => normalizeVideo(row, source, account));
    const salesRecords = (capture.products || []).map((row) => normalizeSalesRecord(row, source, account));
    const sampleRecords = (capture.samples || []).map((row) => normalizeSample(row, source, account));
    const lessons = (capture.lessons || []).map((row) => normalizeLesson(row, source, account));
    const importBatches = (capture.imports || []).map((row) => normalizeImportBatch(row, source, account));
    return {
      source,
      capturedAt: capture.capturedAt,
      accountLabel: account,
      products,
      videos,
      salesRecords,
      sampleRecords,
      commentSignals: [],
      audienceSnapshots: [],
      rewardRecords: videos.filter((video) => video.creatorRewardsEarned > 0).map((video) => ({
        ...baseRecord("RewardRecord", source, video.accountId, "Creator Rewards signal from video data."),
        id: `${video.id}-reward`,
        videoId: video.id,
        amount: video.creatorRewardsEarned
      })),
      actions: [],
      lessons,
      importBatches
    };
  }

  window.NorthstarPolaris = window.NorthstarPolaris || {};
  window.NorthstarPolaris.normalizer = { normalizeCapture };
})();
