// Настройки локального SOCKS5 прокси
const SOCKS_HOST = "127.0.0.1";
const SOCKS_PORT = 2080; // Измените на порт вашего SOCKS5 прокси при необходимости
const PROXY_DURATION_MS = 3000; // 3 секунды для инициализации стрима

let proxyActive = false;
let extensionEnabled = true;
let disableTimer = null;

function setBadge(text, color) {
  try {
    browser.action.setBadgeText({ text });
    if (color) browser.action.setBadgeBackgroundColor({ color });
  } catch (e) {
    console.warn("[Twitch Proxy] Badge error:", e);
  }
}

/* ── Firefox specific: browser.proxy.onRequest ─────── */
// Маршрутизирует конкретные запросы на лету, не затрагивая глобальные настройки Firefox и не конфликтуя с FoxyProxy!

const hasOnRequestAPI = typeof browser !== "undefined" && browser.proxy && typeof browser.proxy.onRequest !== "undefined";

if (hasOnRequestAPI) {
  browser.proxy.onRequest.addListener(
    (requestInfo) => {
      if (proxyActive && extensionEnabled) {
        console.log("[Twitch Proxy] Proxying request via onRequest API:", requestInfo.url);
        return {
          type: "socks",
          host: SOCKS_HOST,
          port: SOCKS_PORT,
          proxyDNS: true
        };
      }
      return { type: "direct" };
    },
    { urls: ["*://*.twitch.tv/*", "*://*.ttvnw.net/*"] }
  );
}

/* ── Proxy control ── */

function enableProxy() {
  if (proxyActive) return;

  proxyActive = true;
  setBadge("ON", "#f59e0b");
  console.log("[Twitch Proxy] ✅ Proxy ON (3s)");

  // Fallback для версий без API onRequest
  if (!hasOnRequestAPI) {
    try {
      browser.proxy.settings.set({
        value: {
          proxyType: "manual",
          socks: `${SOCKS_HOST}:${SOCKS_PORT}`,
          socksVersion: 5
        },
        scope: "regular"
      });
    } catch (err) {
      console.error("[Twitch Proxy] Error enabling proxy settings:", err);
    }
  }
}

function disableProxy() {
  if (!proxyActive) return;

  proxyActive = false;
  setBadge("", null);
  console.log("[Twitch Proxy] ❌ Proxy OFF");

  if (!hasOnRequestAPI) {
    try {
      browser.proxy.settings.set({
        value: { proxyType: "system" },
        scope: "regular"
      });
    } catch (err) {
      console.error("[Twitch Proxy] Error disabling proxy settings:", err);
    }
  }
}

function triggerProxy() {
  if (!extensionEnabled) return;

  enableProxy();

  if (disableTimer) clearTimeout(disableTimer);

  disableTimer = setTimeout(() => {
    disableProxy();
    disableTimer = null;
  }, PROXY_DURATION_MS);
}

/* ── Twitch stream URL detection ───────────────────── */

function isTwitchStream(url) {
  if (!url) return false;
  return /^https?:\/\/(?:www\.)?twitch\.tv\/[a-zA-Z0-9_]{3,25}\/?(?:\?.*)?$/i.test(
    url
  );
}

/* ── Navigation listeners ──────────────────────────── */

browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (!isTwitchStream(details.url)) return;

  console.log("[Twitch Proxy] Navigation:", details.url);
  triggerProxy();
});

browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (!isTwitchStream(details.url)) return;

  console.log("[Twitch Proxy] SPA navigation:", details.url);
  triggerProxy();
});

/* ── Extension toggle & storage ────────────────────── */

browser.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    extensionEnabled = changes.enabled.newValue;
    console.log("[Twitch Proxy] Extension status:", extensionEnabled ? "ON" : "OFF");

    if (!extensionEnabled) {
      if (disableTimer) {
        clearTimeout(disableTimer);
        disableTimer = null;
      }
      disableProxy();
    }
  }
});

browser.storage.local.get(["enabled"]).then((result) => {
  extensionEnabled = result.enabled !== undefined ? Boolean(result.enabled) : true;
  console.log("[Twitch Proxy] Loaded, enabled:", extensionEnabled);
});
