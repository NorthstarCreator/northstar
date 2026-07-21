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
    if (video.create_time) {
      const created = new Date(Number(video.create_time) * 1000);
      if (!Number.isNaN(created.getTime())) return created.toISOString().slice(0, 10);
    }
    if (video.publish_date) return String(video.publish_date).slice(0, 10);
    return "";
  }

  function timeFromVideo(video) {
    if (!video.create_time) return "";
    const created = new Date(Number(video.create_time) * 1000);
    if (Number.isNaN(created.getTime())) return "";
    return created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
      following: number(profile.following_count),
      likes: number(profile.likes_count),
      videoCount: number(profile.video_count),
      summary: "Connected through TikTok Sandbox Display API.",
      source: "tiktok_display_api",
      connection: payload.connection || null
    };
  }

  function normalizeVideo(video, account) {
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
      duration: number(video.duration),
      views: number(video.view_count),
      likes: number(video.like_count),
      comments: number(video.comment_count),
      shares: number(video.share_count),
      saves: 0,
      units: 0,
      gmv: 0,
      earnings: 0,
      watchTime: 0,
      completion: 0,
      followers: 0,
      coverImage: video.cover_image_url || "",
      thumbnailUrl: video.cover_image_url || "",
      videoUrl: video.share_url || video.embed_link || "",
      notes: "Live TikTok Sandbox Display API record. Commerce, save, and audience demographic fields are not included in this initial scope.",
      status: "Live",
      source: "tiktok_display_api"
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
    const rawVideos = Array.isArray(videosPayload?.videos) ? videosPayload.videos : [];
    const seen = new Set();
    const videos = rawVideos
      .map((video) => normalizeVideo(video, account))
      .filter((video) => {
        if (!video.tiktokVideoId || seen.has(video.tiktokVideoId)) return false;
        seen.add(video.tiktokVideoId);
        return true;
      });
    return {
      connected: true,
      account,
      videos,
      source: createDisplaySource(),
      syncedAt: syncedAt || new Date().toISOString(),
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
