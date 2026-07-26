(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NORTHSTAR_LIVE_PERIOD = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const TIME_ZONE = "America/New_York";
  const keyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  function dateKey(value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = Object.fromEntries(keyFormatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function addDays(key, amount) {
    const date = new Date(`${key}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  function range(options = {}) {
    const today = dateKey(options.now || new Date());
    if (options.kind === "today") return { start: today, end: today };
    if (options.kind === "week") return { start: addDays(today, -6), end: today };
    if (options.kind === "custom") {
      return { start: String(options.customStart || ""), end: String(options.customEnd || "") };
    }
    return { start: `${today.slice(0, 7)}-01`, end: today };
  }

  function inRange(value, options = {}) {
    const key = dateKey(value);
    const bounds = range(options);
    return !!key && !!bounds.start && !!bounds.end && key >= bounds.start && key <= bounds.end;
  }

  function publishedTime(video) {
    const value = video?.publishedAt || video?.published_at;
    if (value) {
      const time = new Date(value).getTime();
      if (Number.isFinite(time)) return time;
    }
    const fallback = new Date(`${video?.date || ""}T${video?.time || "12:00:00"}`).getTime();
    return Number.isFinite(fallback) ? fallback : 0;
  }

  function newest(items) {
    return [...items].sort((a, b) => publishedTime(b) - publishedTime(a));
  }

  function followerSummary(snapshots, options = {}) {
    const bounds = range(options);
    const valid = (Array.isArray(snapshots) ? snapshots : [])
      .filter((item) => !item.syncStatus || item.syncStatus === "succeeded")
      .map((item) => ({ ...item, key: dateKey(item.snapshotAt), time: new Date(item.snapshotAt).getTime() }))
      .filter((item) => item.key && Number.isFinite(item.time) && Number.isFinite(Number(item.followerCount)))
      .sort((a, b) => a.time - b.time);
    const throughEnd = valid.filter((item) => item.key <= bounds.end);
    const latest = throughEnd[throughEnd.length - 1] || null;
    if (!latest) return { total: 0, change: 0, baseline: 0 };
    const inside = throughEnd.filter((item) => item.key >= bounds.start);
    const before = throughEnd.filter((item) => item.key < bounds.start);
    const baseline = inside.length >= 2
      ? inside[0]
      : (before[before.length - 1] || inside[0] || latest);
    return {
      total: Number(latest.followerCount),
      change: Number(latest.followerCount) - Number(baseline.followerCount),
      baseline: Number(baseline.followerCount)
    };
  }

  function liveFollowerSummary(snapshots, currentFollowerCount, options = {}) {
    const bounds = range(options);
    const current = Number(currentFollowerCount || 0);
    const valid = (Array.isArray(snapshots) ? snapshots : [])
      .filter((item) => !item.syncStatus || item.syncStatus === "succeeded")
      .map((item) => ({ ...item, key: dateKey(item.snapshotAt), time: new Date(item.snapshotAt).getTime() }))
      .filter((item) => item.key && Number.isFinite(item.time) && Number.isFinite(Number(item.followerCount)))
      .sort((a, b) => a.time - b.time);
    const inside = valid.filter((item) => item.key >= bounds.start && item.key <= bounds.end);
    const before = valid.filter((item) => item.key < bounds.start);
    const baseline = inside[0] || before[before.length - 1] || null;
    return {
      total: current,
      change: baseline ? current - Number(baseline.followerCount) : 0,
      baseline: baseline ? Number(baseline.followerCount) : current
    };
  }

  return { TIME_ZONE, dateKey, range, inRange, newest, followerSummary, liveFollowerSummary };
});
