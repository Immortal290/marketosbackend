// ─── MarketOS Frontend Config ────────────────────────────────────────────────
// The frontend is served from the same Express server as the API,
// so all requests target window.location.origin automatically.
// Override API_BASE_URL only if the API lives on a different domain.
(function () {
  window.CONFIG = {
    API_BASE_URL:   window.location.origin,
    API_PREFIX:     '/api/v1',
    SOCKET_URL:     window.location.origin,
    TOKEN_KEY:      'marketos_access_token',
    REFRESH_KEY:    'marketos_refresh_token',
    DASHBOARD_PATH: '/dashboard.html',
    AUTH_PATH:      '/auth.html',
  };

  CONFIG._api    = CONFIG.API_BASE_URL + CONFIG.API_PREFIX;
  CONFIG._socket = CONFIG.SOCKET_URL;
})();
