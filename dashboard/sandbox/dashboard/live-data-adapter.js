(function () {
  const number = (value) => Number(value || 0);
  const text = (value, fallback = "") => String(value || fallback).trim();

  function safeId(value) {
    return text(value, "unknown").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  }

  function initials(name) {
    const parts = text(name, "TikTok").split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "T").toUpperCase() + (parts[1]?.[0] || "K").toUpperCase();
  }

  function dateFromVideo(video) {
    if (video.published_at) {
      const published = new Date(video.published_at);
      if (!Number.isNaN(published.getTime())) {
        return window.NORTHSTAR_LIVE_PERIOD?.dateKey(published) || published.toISOString().slice(0, 10);
      }
    }
    if (video.create_time) {
      const created = new Date(Number(video.create_time) * 1000);
      if (!Number.isNaN(created.getTime())) {
        return window.NORTHSTAR_LIVE_PERIOD?.dateKey(created) || created.toISOString().slice(0, 10);
      }
    }
    if (video.publish_date) return String(video.publish_date).slice(0, 10);
    return "";
  }

  function timeFromVideo(video) {
    const created = video.published_at
      ? new Date(video.published_at)
      : new Date(Number(video.create_time) * 1000);
    if (Number.isNaN(created.getTime())) return "";
    return created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  }

  function freshnessTime(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York"
    });
  }

  function normalizeAccount(payload) {
    const profile = payload?.profile || null;
    if (!profile?.open_id) return null;
    return {
      id: `tiktok-${safeId(profile.open_id)}`,
      openId: profile.open_id,
      name: text(profile.display_name, "TikTok Creator"),
      handle: text(profile.display_name, "TikTok Creator"),
      initials: initials(profile.display_name),
      avatarUrl: profile.avatar_url || "",
      focus: "TikTok Sandbox connected account",
      followers: number(profile.follower_count),
      followerChange: 0,
      followerSnapshots: [],
      following: number(profile.following_count),
      likes: number(profile.likes_count),
      videoCount: number(profile.video_count),
      summary: "Connected through TikTok Sandbox Display API.",
      source: "tiktok_display_api",
      connection: payload.connection || null
    };
  }

  function normalizeVideo(video, account, lastSuccessfulSyncAt) {
    const title = text(video.title || video.video_description, "TikTok video");
    return {
      id: `tt-${safeId(video.id)}`,
      tiktokVideoId: text(video.id),
      accountId: account.id,
      productId: null,
      sourceIds: ["tiktok-display"],
      title,
      hook: title,
      date: dateFromVideo(video),
      time: timeFromVideo(video),
      publishedAt: video.published_at || (video.create_time ? new Date(Number(video.create_time) * 1000).toISOString() : ""),
      duration: number(video.duration),
      views: number(video.view_count),
      likes: number(video.like_count),
      comments: number(video.comment_count),
      shares: number(video.share_count),
      saves: number(video.save_count),
      units: 0,
      gmv: 0,
      earnings: 0,
      watchTime: number(video.average_watch_time_seconds),
      completion: number(video.completion_rate),
      followers: number(video.followers_gained),
      coverImage: video.cover_image_url || "",
      thumbnailUrl: video.cover_image_url || "",
      videoUrl: video.share_url || video.embed_link || "",
      notes: "Live TikTok Sandbox Display API record. Commerce, save, and audience demographic fields are not included in this initial scope.",
      status: "Live",
      source: "tiktok_display_api",
      freshnessStatus: video.live_status || "persisted",
      freshnessReadAt: video.live_read_at || "",
      freshnessLabel: video.live_status === "not_yet_synced"
        ? "Live · Not yet synced"
        : video.live_status === "refreshed"
          ? `Live as of ${freshnessTime(video.live_read_at)}`
          : lastSuccessfulSyncAt
            ? `Last synced ${freshnessTime(lastSuccessfulSyncAt)}`
            : "Not synced"
    };
  }

  function createDisplaySource() {
    return {
      id: "tiktok-display",
      name: "TikTok Display API",
      type: "Live Sandbox",
      shortName: "Display API",
      accent: "display",
      color: "#2f7c7a",
      status: "Connected",
      summary: "Basic identity, stats, and public video metrics from approved Sandbox Display API scopes."
    };
  }

  function buildLiveSnapshot({ mePayload, videosPayload, syncedAt }) {
    const account = normalizeAccount(mePayload);
    if (!account) return null;
    account.followerSnapshots = (Array.isArray(videosPayload?.accountMetricSnapshots)
      ? videosPayload.accountMetricSnapshots
      : []).map((item) => ({
        snapshotAt: item.snapshot_at,
        followerCount: number(item.follower_count),
        followingCount: number(item.following_count),
        likesCount: number(item.likes_count),
        videoCount: number(item.video_count),
        syncStatus: item.sync_status
      }));
    const rawVideos = Array.isArray(videosPayload?.videos) ? videosPayload.videos : [];
    const seen = new Set();
    const videos = rawVideos
      .map((video) => normalizeVideo(video, account, syncedAt))
      .filter((video) => {
        if (!video.tiktokVideoId || seen.has(video.tiktokVideoId)) return false;
        seen.add(video.tiktokVideoId);
        return true;
      });
    return {
      connected: true,
      account,
      videos,
      source: String(videosPayload?.source || "").startsWith("northstar_postgres")
        ? { ...createDisplaySource(), name: "Northstar Persisted TikTok Data", type: "Live Sandbox", shortName: "Neon + Display API" }
        : createDisplaySource(),
      syncedAt: syncedAt || null,
      overlay: videosPayload?.overlay || null,
      unsupported: [
        "TikTok Shop GMV, commissions, orders, samples, Creator Rewards, TikTok GO, and audience demographics are demo-only in this Sandbox phase."
      ]
    };
  }

  window.NORTHSTAR_LIVE_ADAPTER = {
    buildLiveSnapshot,
    createDisplaySource
  };
})();
