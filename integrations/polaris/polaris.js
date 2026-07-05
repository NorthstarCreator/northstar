(function () {
  const SNAPSHOT_KEY = "northstar.v01.polarisSnapshots";
  const CHANGE_KEY = "northstar.v01.polarisChangeSummary";
  const STORAGE_KEY = "northstar.v01.data";

  const STEPS = [
    "Connecting sources",
    "Capturing data",
    "Normalizing data",
    "Detecting changes",
    "Updating Morning Brief",
    "Complete"
  ];

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function fingerprint(value) {
    return JSON.stringify(value);
  }

  function sourceId(label) {
    return window.NorthstarPolaris.adapters.getSource(label).id;
  }

  function buildSnapshot(db, sourceLabel, accountLabel, normalized, validation) {
    const accountName = accountLabel || "All accounts";
    const accountKey = accountName === "All accounts" ? "" : accountName.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const accountFilter = (item) => !accountKey || [item.account, item.accountId].some((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").includes(accountKey));
    const products = (db.products || []).filter(accountFilter);
    const videos = (db.videos || []).filter(accountFilter);
    const samples = (db.sampleRequests || []).filter(accountFilter);
    const rewards = videos.reduce((sum, video) => sum + Number(video.creatorRewardsEarned || video.estimatedRewards || 0), 0);
    const videoMetrics = {
      videos: videos.length,
      views: videos.reduce((sum, video) => sum + Number(video.views || 0), 0),
      likes: videos.reduce((sum, video) => sum + Number(video.likes || 0), 0),
      comments: videos.reduce((sum, video) => sum + Number(video.comments || 0), 0),
      shares: videos.reduce((sum, video) => sum + Number(video.shares || 0), 0),
      saves: videos.reduce((sum, video) => sum + Number(video.saves || 0), 0),
      followers: videos.reduce((sum, video) => sum + Number(video.newFollowers || 0), 0)
    };
    const salesMetrics = {
      products: products.length,
      gmv: products.reduce((sum, product) => sum + Number(product.lifetimeGmv || 0), 0),
      commission: products.reduce((sum, product) => sum + Number(product.lifetimeCommission || 0), 0),
      units: products.reduce((sum, product) => sum + Number(product.lifetimeUnits || 0), 0)
    };
    const sampleMetrics = samples.reduce((map, sample) => {
      const status = sample.status || "Watch";
      map[status] = (map[status] || 0) + 1;
      return map;
    }, {});
    const rewardMetrics = { earnings: rewards, rewardRecords: normalized.rewardRecords.length };
    const payload = { videoMetrics, salesMetrics, sampleMetrics, rewardMetrics };
    return {
      snapshotId: `polaris-snapshot-${Date.now()}`,
      createdAt: new Date().toISOString(),
      accountId: accountName,
      source: sourceLabel,
      ...payload,
      audienceMetrics: { snapshots: normalized.audienceSnapshots.length },
      notes: `${validation.summary.recordsChecked} records checked.`,
      fingerprint: fingerprint(payload)
    };
  }

  function compareSnapshots(previous, current) {
    if (!previous) {
      return {
        id: `change-${Date.now()}`,
        createdAt: current.createdAt,
        source: current.source,
        accountId: current.accountId,
        newVideos: current.videoMetrics.videos,
        newSales: current.salesMetrics.units,
        increasedViews: current.videoMetrics.views,
        increasedFollowers: current.videoMetrics.followers,
        productsGainingMomentum: [],
        productsSlowing: [],
        samplesNewlyApproved: current.sampleMetrics.Approved || 0,
        samplesWaitingTooLong: current.sampleMetrics.Wait || 0,
        newComments: current.videoMetrics.comments,
        newCreatorRewardsEarnings: current.rewardMetrics.earnings,
        summary: "Baseline created. Northstar will compare future updates against this snapshot.",
        signals: []
      };
    }
    const delta = (section, field) => Number(current[section]?.[field] || 0) - Number(previous[section]?.[field] || 0);
    const signals = [];
    if (delta("videoMetrics", "videos") > 0) signals.push(`${delta("videoMetrics", "videos")} new videos captured.`);
    if (delta("salesMetrics", "units") > 0) signals.push(`${delta("salesMetrics", "units")} new sales detected.`);
    if (delta("videoMetrics", "views") > 0) signals.push(`${delta("videoMetrics", "views").toLocaleString()} additional views detected.`);
    if (delta("videoMetrics", "followers") > 0) signals.push(`${delta("videoMetrics", "followers")} additional followers detected.`);
    if (delta("rewardMetrics", "earnings") > 0) signals.push(`New Creator Rewards earnings detected.`);
    return {
      id: `change-${Date.now()}`,
      createdAt: current.createdAt,
      source: current.source,
      accountId: current.accountId,
      newVideos: Math.max(0, delta("videoMetrics", "videos")),
      newSales: Math.max(0, delta("salesMetrics", "units")),
      increasedViews: Math.max(0, delta("videoMetrics", "views")),
      increasedFollowers: Math.max(0, delta("videoMetrics", "followers")),
      productsGainingMomentum: [],
      productsSlowing: [],
      samplesNewlyApproved: Math.max(0, (current.sampleMetrics.Approved || 0) - (previous.sampleMetrics.Approved || 0)),
      samplesWaitingTooLong: current.sampleMetrics.Wait || 0,
      newComments: Math.max(0, delta("videoMetrics", "comments")),
      newCreatorRewardsEarnings: Math.max(0, delta("rewardMetrics", "earnings")),
      summary: signals[0] || "No major changes detected since your last review.",
      signals
    };
  }

  function saveSnapshot(snapshot) {
    const snapshots = readJson(SNAPSHOT_KEY, []);
    const latest = snapshots.at(-1);
    const next = !latest || latest.fingerprint !== snapshot.fingerprint ? [...snapshots, snapshot].slice(-120) : snapshots;
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    return { snapshots: next, previous: next.length > 1 ? next.at(-2) : null, current: next.at(-1) || snapshot };
  }

  function buildRecord(normalized) {
    return {
      recordsCaptured: normalized.products.length + normalized.videos.length + normalized.salesRecords.length + normalized.sampleRecords.length + normalized.lessons.length + normalized.importBatches.length,
      recordsUpdated: normalized.products.length + normalized.videos.length + normalized.sampleRecords.length,
      recordsSkipped: 0
    };
  }

  function runPolarisSync(options) {
    const startedAt = new Date().toISOString();
    const db = options.db || {};
    const sourceLabel = options.source || "Manual Capture";
    const accountLabel = options.account || "All accounts";
    const source = window.NorthstarPolaris.adapters.getSource(sourceLabel);
    const progress = STEPS.map((label, index) => ({ label, status: index === STEPS.length - 1 ? "Complete" : "Done" }));

    const capture = window.NorthstarPolaris.adapters.captureLocalData(db, sourceLabel, accountLabel);
    const normalized = window.NorthstarPolaris.normalizer.normalizeCapture(capture);
    const validation = window.NorthstarPolaris.validators.validateNormalized(normalized);
    const snapshot = buildSnapshot(db, sourceLabel, accountLabel, normalized, validation);
    const savedSnapshots = saveSnapshot(snapshot);
    const changeSummary = compareSnapshots(savedSnapshots.previous, savedSnapshots.current);
    localStorage.setItem(CHANGE_KEY, JSON.stringify(changeSummary));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

    const counts = buildRecord(normalized);
    const status = source.available ? "Complete" : "Future source prepared";
    const record = {
      id: `polaris-sync-${Date.now()}`,
      dateTime: new Date(startedAt).toLocaleString(),
      createdAt: startedAt,
      source: source.name,
      sourceId: sourceId(sourceLabel),
      account: accountLabel,
      dataType: source.dataTypes.join(", "),
      recordsCaptured: counts.recordsCaptured,
      recordsUpdated: counts.recordsUpdated,
      recordsSkipped: counts.recordsSkipped,
      warnings: validation.warnings.length,
      errors: validation.errors.length,
      status,
      notes: source.available ? "Morning Brief refreshed from local Northstar data." : "Prepared for future live source. No live connection attempted.",
      progress,
      validation,
      snapshotId: savedSnapshots.current.snapshotId,
      changeSummary
    };
    window.NorthstarPolaris.syncHistory.writeSync(record);
    return { record, snapshot: savedSnapshots.current, changeSummary, validation, normalized, progress };
  }

  window.NorthstarPolaris = window.NorthstarPolaris || {};
  window.NorthstarPolaris.STEPS = STEPS;
  window.NorthstarPolaris.SNAPSHOT_KEY = SNAPSHOT_KEY;
  window.NorthstarPolaris.CHANGE_KEY = CHANGE_KEY;
  window.NorthstarPolaris.runPolarisSync = runPolarisSync;
  window.runPolarisSync = runPolarisSync;
})();
