(function () {
  const SOURCES = [
    { id: "tiktok-studio", name: "TikTok Studio", status: "API Pending", dataTypes: ["Video analytics", "Followers", "Comments"], available: false },
    { id: "tiktok-shop", name: "TikTok Shop", status: "API Pending", dataTypes: ["Sales", "Samples", "Product invitations"], available: false },
    { id: "creator-rewards", name: "Creator Rewards", status: "API Pending", dataTypes: ["Reward earnings"], available: false },
    { id: "csv-import", name: "CSV Import", status: "Available", dataTypes: ["Product sales", "Video analytics", "Sample requests"], available: true },
    { id: "screenshot-ocr", name: "Screenshot OCR", status: "Planned", dataTypes: ["Screenshots"], available: false },
    { id: "manual-capture", name: "Manual Capture", status: "Available", dataTypes: ["Products", "Videos", "Lessons", "Snapshots"], available: true },
    { id: "future-platforms", name: "Future Platforms", status: "Planned", dataTypes: ["Additional creator platforms"], available: false },
    { id: "instagram", name: "Future Instagram", status: "Planned", dataTypes: ["Content signals"], available: false },
    { id: "youtube", name: "Future YouTube", status: "Planned", dataTypes: ["Video signals"], available: false },
    { id: "amazon", name: "Future Amazon", status: "Planned", dataTypes: ["Affiliate sales"], available: false }
  ];

  function sourceIdFromLabel(label) {
    const normalized = String(label || "").toLowerCase();
    if (normalized.includes("csv")) return "csv-import";
    if (normalized.includes("screenshot")) return "screenshot-ocr";
    if (normalized.includes("shop")) return "tiktok-shop";
    if (normalized.includes("reward")) return "creator-rewards";
    if (normalized.includes("tiktok")) return "tiktok-studio";
    if (normalized.includes("manual")) return "manual-capture";
    return SOURCES.find((source) => source.id === label)?.id || "manual-capture";
  }

  function getSource(label) {
    const id = sourceIdFromLabel(label);
    return SOURCES.find((source) => source.id === id) || SOURCES.find((source) => source.id === "manual-capture");
  }

  function accountMatches(item, account) {
    if (!account || account === "All accounts") return true;
    const needle = String(account).toLowerCase().replace(/[^a-z0-9]+/g, "");
    return [item.account, item.accountId].some((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").includes(needle));
  }

  function captureLocalData(db, sourceLabel, accountLabel) {
    const source = getSource(sourceLabel);
    const products = (db.products || []).filter((item) => accountMatches(item, accountLabel));
    const videos = (db.videos || []).filter((item) => accountMatches(item, accountLabel));
    const samples = (db.sampleRequests || []).filter((item) => accountMatches(item, accountLabel));
    const snapshots = (db.performanceSnapshots || []).filter((item) => accountMatches(item, accountLabel));
    const imports = (db.importHistory || []).filter((item) => accountMatches(item, accountLabel));
    const lessons = ((db.notes || {}).lessons || []).filter((item) => accountMatches(item, accountLabel));

    return {
      source,
      capturedAt: new Date().toISOString(),
      accountLabel: accountLabel || "All accounts",
      products,
      videos,
      samples,
      snapshots,
      imports,
      lessons,
      rawRecords: products.length + videos.length + samples.length + snapshots.length + imports.length + lessons.length
    };
  }

  window.NorthstarPolaris = window.NorthstarPolaris || {};
  window.NorthstarPolaris.adapters = { SOURCES, getSource, captureLocalData };
})();
