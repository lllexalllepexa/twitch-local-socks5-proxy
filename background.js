const SOCKS_HOST = "127.0.0.1";
const SOCKS_PORT = 2080;

let proxyEnabled = false;
let disableTimer = null;

function generatePacScript() {
  return `
function FindProxyForURL(url, host) {

  const proxy = "SOCKS5 ${SOCKS_HOST}:${SOCKS_PORT}";

  const domains = [
    "usher.ttvnw.net",
    "gql.twitch.tv",
    ".ttvnw.net",
    ".twitch.tv"
  ];

  for (let i = 0; i < domains.length; i++) {

    const domain = domains[i];

    if (
      host === domain ||
      shExpMatch(host, "*" + domain)
    ) {
      return proxy;
    }
  }

  return "DIRECT";
}
`;
}

function enableProxy() {

  if (proxyEnabled) {
    return;
  }

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
      proxyEnabled = true;
      console.log("[Twitch Proxy] ENABLED");
    }
  );
}

function disableProxy() {

  if (!proxyEnabled) {
    return;
  }

  chrome.proxy.settings.clear(
    {
      scope: "regular"
    },
    () => {
      proxyEnabled = false;
      console.log("[Twitch Proxy] DISABLED");
    }
  );
}

function triggerTemporaryProxy() {

  enableProxy();

  if (disableTimer) {
    clearTimeout(disableTimer);
  }

  disableTimer = setTimeout(() => {
    disableProxy();
  }, 2000);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  if (changeInfo.status !== "complete") {
    return;
  }

  if (!tab.url) {
    return;
  }

  const isTwitchStream =
    /^https:\/\/www\.twitch\.tv\/[^/]+$/i.test(tab.url);

  if (isTwitchStream) {

    console.log("[Twitch Proxy] Stream detected:", tab.url);

    triggerTemporaryProxy();
  }
});

console.log("[Twitch Proxy] Extension loaded");