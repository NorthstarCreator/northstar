(function () {
  const config = window.NORTHSTAR_CONFIG || {};
  const apiOrigin = config.apiOrigin || "";
  let csrfToken = "";
  const pendingVideoRequests = new Map();

  function apiUrl(path) {
    return `${apiOrigin}${path}`;
  }

  async function parseJson(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || "request_failed");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function get(path) {
    const response = await fetch(apiUrl(path), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    return parseJson(response);
  }

  async function post(path) {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        "X-CSRF-Token": csrfToken
      }
    });
    return parseJson(response);
  }

  async function bootstrapSession() {
    const payload = await get("/session");
    csrfToken = payload.csrfToken || "";
    return payload;
  }

  function startConnect() {
    window.location.href = apiUrl("/auth/tiktok/start");
  }

  async function me() {
    return get("/tiktok/me");
  }

  async function videos(period = {}) {
    const params = new URLSearchParams();
    if (period.start) params.set("start", period.start);
    if (period.end) params.set("end", period.end);
    const query = params.toString();
    const path = `/tiktok/videos${query ? `?${query}` : ""}`;
    if (pendingVideoRequests.has(path)) return pendingVideoRequests.get(path);
    const pending = get(path).finally(() => pendingVideoRequests.delete(path));
    pendingVideoRequests.set(path, pending);
    return pending;
  }

  async function revenueSourceStatus() {
    return get("/revenue/source-status");
  }

  async function sync() {
    if (!csrfToken) await bootstrapSession();
    return post("/tiktok/sync");
  }

  async function disconnect() {
    if (!csrfToken) await bootstrapSession();
    return post("/auth/tiktok/disconnect");
  }

  window.NORTHSTAR_TIKTOK_CLIENT = {
    bootstrapSession,
    startConnect,
    me,
    videos,
    revenueSourceStatus,
    sync,
    disconnect
  };
})();
