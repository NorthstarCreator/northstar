(function () {
  const modes = {
    demo: {
      id: "demo",
      label: "Demo Mode",
      description: "Prototype data for visual review. Not connected to TikTok."
    },
    live: {
      id: "live",
      label: "TikTok Sandbox",
      description: "Authorized TikTok Display API data for the current Sandbox session."
    }
  };

  window.NORTHSTAR_DATA_MODE = {
    modes,
    defaultMode: "demo",
    liveMode: "live"
  };
})();
