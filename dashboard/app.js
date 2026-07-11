const config = window.NORTHSTAR_CONFIG || {};
const apiOrigin = String(config.apiOrigin || "").replace(/\/+$/, "");

const state = {
  csrfToken: "",
  sessionReady: false,
  connected: false
};

const els = {
  connect: document.querySelector("#connectTikTok"),
  sync: document.querySelector("#syncTikTok"),
  disconnect: document.querySelector("#disconnectTikTok"),
  status: document.querySelector("#statusMessage"),
  profile: document.querySelector("#profilePanel"),
  stats: document.querySelector("#statsPanel"),
  videos: document.querySelector("#videosPanel"),
  videoCount: document.querySelector("#videoCount"),
  backupImport: document.querySelector("#backupImport"),
  exportHostedBackup: document.querySelector("#exportHostedBackup"),
  migrationStatus: document.querySelector("#migrationStatus")
};

function setStatus(message, tone = "info") {
  els.status.textContent = message;
  els.status.dataset.tone = tone;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: Number(value || 0) >= 10000 ? "compact" : "standard" }).format(Number(value || 0));
}

function safeText(value, fallback = "") {
  return String(value ?? fallback).replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[char]));
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Accept": "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.method && options.method !== "GET" ? { "X-CSRF-Token": state.csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function bootstrapSession() {
  if (!apiOrigin) {
    setStatus("Missing API origin in dashboard config.", "error");
    return;
  }
  try {
    const session = await apiFetch("/session");
    state.csrfToken = session.csrfToken || "";
    state.sessionReady = true;
    els.connect.href = `${apiOrigin}/auth/tiktok/start`;
    setStatus(session.connected ? "TikTok is connected." : "Secure session ready. Connect TikTok when you are ready.", session.connected ? "good" : "info");
    await refreshTikTokPanels();
  } catch (error) {
    setStatus(`Session could not start: ${error.message}`, "error");
  }
}

async function refreshTikTokPanels() {
  if (!state.sessionReady) return;
  try {
    const profile = await apiFetch("/tiktok/me");
    state.connected = !!profile.connected;
    renderProfile(profile);
    if (state.connected) await loadVideos();
  } catch (error) {
    renderDisconnected();
    setStatus(error.message === "not_connected" ? "TikTok is not connected yet." : `Could not load TikTok profile: ${error.message}`, "warn");
  }
}

function renderDisconnected() {
  state.connected = false;
  els.profile.className = "profile-panel empty";
  els.profile.textContent = "Connect TikTok to show authorized creator identity.";
  els.stats.innerHTML = ["Followers", "Following", "Likes", "Videos"].map((label) => `<div><span>${label}</span><strong>--</strong></div>`).join("");
  els.videos.className = "video-list empty";
  els.videos.textContent = "Connect TikTok, then sync public videos available through the approved Display API scope.";
  els.videoCount.textContent = "No videos loaded";
}

function renderProfile(payload) {
  if (!payload.connected || !payload.profile) {
    renderDisconnected();
    return;
  }
  const profile = payload.profile;
  const avatar = profile.avatar_url || "assets/northstar-mark.svg";
  els.profile.className = "profile-panel";
  els.profile.innerHTML = `
    <img src="${safeText(avatar)}" alt="">
    <div>
      <strong>${safeText(profile.display_name || "TikTok Creator")}</strong>
      <span class="subtle">${safeText(profile.open_id || "Authorized TikTok account")}</span>
    </div>
  `;
  els.stats.innerHTML = [
    ["Followers", profile.follower_count],
    ["Following", profile.following_count],
    ["Likes", profile.likes_count],
    ["Videos", profile.video_count]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${formatNumber(value)}</strong></div>`).join("");
  setStatus("TikTok profile loaded from authorized Display API scopes.", "good");
}

async function loadVideos() {
  const payload = await apiFetch("/tiktok/videos");
  const videos = Array.isArray(payload.videos) ? payload.videos : [];
  els.videoCount.textContent = `${formatNumber(videos.length)} video${videos.length === 1 ? "" : "s"} loaded`;
  els.videos.className = videos.length ? "video-list" : "video-list empty";
  els.videos.innerHTML = videos.length ? videos.map(videoRow).join("") : "No public videos returned for this authorized account yet.";
}

function videoRow(video) {
  const cover = video.cover_image_url || video.cover_image || "assets/northstar-mark.svg";
  const title = video.title || video.video_description || "TikTok video";
  return `
    <article class="video-row">
      <img src="${safeText(cover)}" alt="">
      <div>
        <h3 title="${safeText(title)}">${safeText(title)}</h3>
        <p title="${safeText(video.video_description || "")}">${safeText(video.video_description || video.share_url || "Public video returned by TikTok Display API.")}</p>
      </div>
      <div class="video-metrics">
        <span><strong>${formatNumber(video.view_count)}</strong> views</span>
        <span><strong>${formatNumber(video.like_count)}</strong> likes</span>
        <span><strong>${formatNumber(video.comment_count)}</strong> comments</span>
        <span><strong>${formatNumber(video.share_count)}</strong> shares</span>
      </div>
    </article>
  `;
}

async function syncTikTok() {
  if (!state.csrfToken) {
    setStatus("Secure session is not ready yet.", "warn");
    return;
  }
  els.sync.disabled = true;
  setStatus("Syncing TikTok videos securely...", "info");
  try {
    await apiFetch("/tiktok/sync", { method: "POST", body: JSON.stringify({ reason: "manual" }) });
    await refreshTikTokPanels();
    setStatus("TikTok sync complete.", "good");
  } catch (error) {
    setStatus(`Sync failed: ${error.message}`, "error");
  } finally {
    els.sync.disabled = false;
  }
}

async function disconnectTikTok() {
  if (!state.csrfToken) {
    setStatus("Secure session is not ready yet.", "warn");
    return;
  }
  if (!confirm("Disconnect TikTok and stop future NorthStar access?")) return;
  els.disconnect.disabled = true;
  setStatus("Disconnecting TikTok...", "info");
  try {
    await apiFetch("/auth/tiktok/disconnect", { method: "POST", body: JSON.stringify({ confirm: true }) });
    renderDisconnected();
    setStatus("TikTok disconnected. Stored connection metadata was removed from the secure token store.", "good");
  } catch (error) {
    setStatus(`Disconnect needs review: ${error.message}`, "error");
  } finally {
    els.disconnect.disabled = false;
  }
}

function handleOAuthReturnMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("tiktok") === "connected") setStatus("TikTok connected successfully. Loading profile and videos...", "good");
  if (params.get("tiktok")?.startsWith("error")) setStatus(`TikTok connection did not finish: ${params.get("tiktok")}`, "warn");
  if (params.has("tiktok")) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

function initMigrationTools() {
  const imported = localStorage.getItem("northstar.hosted.importedBackupAt");
  if (imported) els.migrationStatus.textContent = `Last hosted backup import: ${imported}`;

  els.backupImport.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      JSON.parse(text);
      localStorage.setItem("northstar.hosted.importedBackup", text);
      const timestamp = new Date().toLocaleString();
      localStorage.setItem("northstar.hosted.importedBackupAt", timestamp);
      els.migrationStatus.textContent = `Backup imported into this browser at ${timestamp}.`;
    } catch {
      els.migrationStatus.textContent = "That file was not valid JSON. No hosted data changed.";
    }
  });

  els.exportHostedBackup.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      appOrigin: config.appOrigin,
      importedBackup: JSON.parse(localStorage.getItem("northstar.hosted.importedBackup") || "null")
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `northstar-hosted-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

els.sync.addEventListener("click", syncTikTok);
els.disconnect.addEventListener("click", disconnectTikTok);
initMigrationTools();
handleOAuthReturnMessage();
bootstrapSession();
