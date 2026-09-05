const button = document.getElementById("toggle");

function render(enabled) {
  button.textContent = enabled ? "ВКЛЮЧЕНО" : "ВЫКЛЮЧЕНО";
  button.className = enabled ? "on" : "off";
}

async function getState() {
  if (typeof browser !== "undefined" && browser.storage) {
    const res = await browser.storage.local.get("enabled");
    return res.enabled !== undefined ? Boolean(res.enabled) : true;
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(["enabled"], (res) => {
      resolve(res.enabled !== undefined ? Boolean(res.enabled) : true);
    });
  });
}

async function setState(enabled) {
  if (typeof browser !== "undefined" && browser.storage) {
    await browser.storage.local.set({ enabled });
    return;
  }
  return new Promise((resolve) => {
    chrome.storage.local.set({ enabled }, resolve);
  });
}

getState().then(render);

button.onclick = async () => {
  const current = await getState();
  const next = !current;
  await setState(next);
  render(next);
};
