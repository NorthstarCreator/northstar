(function () {
  const config = window.NORTHSTAR_CONFIG || {};
  const apiOrigin = config.apiOrigin || "";
  let csrfToken = "";

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

  async function videos() {
    return get("/tiktok/videos");
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
    sync,
    disconnect
  };
})();
