// Настройки локального SOCKS5 прокси
const SOCKS_HOST = "127.0.0.1";
const SOCKS_PORT = 2080; // Измените на порт вашего SOCKS5 прокси при необходимости
const PROXY_DURATION_MS = 3000; // 3 секунды для инициализации стрима

let proxyActive = false;
let extensionEnabled = true;
let disableTimer = null;

function setBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text });
    if (color) chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) {
    console.warn("[Twitch Proxy] Badge error:", e);
  }
}

function generatePacScript() {
  return `
function FindProxyForURL(url, host) {
  if (
    host === "usher.ttvnw.net" ||
    host === "gql.twitch.tv" ||
    shExpMatch(host, "*.ttvnw.net") ||
    shExpMatch(host, "*.twitch.tv") ||
    host === "twitch.tv"
  ) {
    return "SOCKS5 ${SOCKS_HOST}:${SOCKS_PORT}; SOCKS ${SOCKS_HOST}:${SOCKS_PORT}; DIRECT";
  }
  return "DIRECT";
}
`;
}

function enableProxy() {
  if (proxyActive) return;

  chrome.proxy.settings.set(
    {
      value: {
        mode: "pac_script",
        pacScript: {
          data: generatePacScript()
        }
      },
      scope: "regular"
    },
    () => {
      proxyActive = true;
      setBadge("ON", "#f59e0b");
      console.log("[Twitch Proxy] ✅ Proxy ON (3s)");
    }
  );
}

function disableProxy() {
  if (!proxyActive) return;

  chrome.proxy.settings.clear({ scope: "regular" }, () => {
    proxyActive = false;
    setBadge("", null);
    console.log("[Twitch Proxy] ❌ Proxy OFF");
  });
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

// Обычный переход по ссылке / ввод адреса
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (!isTwitchStream(details.url)) return;

  console.log("[Twitch Proxy] Navigation:", details.url);
  triggerProxy();
});

// SPA-навигация при переключении стримов внутри сайта Twitch
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (!isTwitchStream(details.url)) return;

  console.log("[Twitch Proxy] SPA navigation:", details.url);
  triggerProxy();
});

/* ── Extension toggle & storage ────────────────────── */

chrome.storage.onChanged.addListener((changes) => {
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

chrome.storage.local.get(["enabled"], (result) => {
  extensionEnabled = result.enabled !== undefined ? Boolean(result.enabled) : true;
  console.log("[Twitch Proxy] Loaded, enabled:", extensionEnabled);
});
