const HOST = "com.nfsu2revived.discordrpc.full";
const TARGET_HOST = "nfsu2.xyz";
const START_KEY = "nfsu2_rpc_started_at";

const VALID_MODES = ["Offline", "Online", "Racing", "Cruising", "Free Roam", "Menu"];

let port = null;
let startedAt = null;
let detected = false;
let currentMode = "Offline";
let currentGenre = "";
let currentRegion = "";
let nativeHostConnected = false;
let nativeHostError = null;
let lastRpcState = null;
let lastSentPayload = null;
let refreshQueue = Promise.resolve();

function isTarget(url) {
  try {
    return new URL(url).hostname === TARGET_HOST;
  } catch (_) {
    return false;
  }
}

function connect() {
  if (port) return port;

  try {
    port = browser.runtime.connectNative(HOST);
    nativeHostError = null;

    port.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.type === "error") {
        console.warn("NFSU2 RPC error from host:", msg.message);
        nativeHostError = msg.message;
      } else if (msg.type === "status") {
        nativeHostConnected = !!msg.connected;
        if (msg.connected) {
          nativeHostError = null;
        }
        if (msg.state) {
          lastRpcState = msg.state;
        }
      }
    });

    port.onDisconnect.addListener(() => {
      const error = browser.runtime.lastError;
      const errMsg = error ? error.message : "Native host disconnected";
      console.warn("NFSU2 RPC native host disconnected:", errMsg);
      port = null;
      nativeHostConnected = false;
      nativeHostError = errMsg;
      lastSentPayload = null;
    });
  } catch (error) {
    const errMsg = error ? error.message : "Could not connect to native host";
    console.error("Could not connect to native host:", error);
    port = null;
    nativeHostConnected = false;
    nativeHostError = errMsg;
    lastSentPayload = null;
  }

  return port;
}

function send(payload) {
  const nativePort = connect();
  if (!nativePort) return;

  try {
    nativePort.postMessage(payload);
  } catch (error) {
    console.error("NFSU2 RPC send failed:", error);
    nativeHostError = error ? error.message : "Send failed";
  }
}

function refresh() {
  refreshQueue = refreshQueue
    .then(async () => {
      const tabs = await browser.tabs.query({});
      const hasTargetTab = tabs.some((tab) => isTarget(tab.url));

      if (hasTargetTab) {
        if (startedAt === null) {
          const saved = await browser.storage.local.get(START_KEY);
          const savedStart = Number(saved[START_KEY]);

          startedAt =
            Number.isFinite(savedStart) && savedStart > 0
              ? savedStart
              : Math.floor(Date.now() / 1000);

          await browser.storage.local.set({
            [START_KEY]: startedAt
          });
        }

        detected = true;

        const payload = {
          action: "update",
          mode: currentMode,
          genre: currentGenre,
          region: currentRegion,
          started_at: startedAt
        };

        // Send only when state has actually changed or native host just reconnected
        const payloadStr = JSON.stringify(payload);
        if (payloadStr !== lastSentPayload) {
          lastSentPayload = payloadStr;
          send(payload);
        }
      } else {
        detected = false;
        currentMode = "Offline";
        currentGenre = "";
        currentRegion = "";
        lastRpcState = null;
        lastSentPayload = null;

        if (startedAt !== null) {
          startedAt = null;
          await browser.storage.local.remove(START_KEY);
        }

        if (port) {
          try {
            port.postMessage({ action: "stop" });
          } catch (error) {
            console.warn("NFSU2 RPC stop failed", error);
          }
        }
      }
    })
    .catch((error) => {
      console.error("NFSU2 RPC refresh failed:", error);
    });

  return refreshQueue;
}

browser.tabs.onCreated.addListener(refresh);
browser.tabs.onActivated.addListener(refresh);
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    refresh();
  }
});
browser.tabs.onRemoved.addListener(refresh);
browser.tabs.onReplaced.addListener(refresh);
browser.runtime.onStartup.addListener(refresh);
browser.runtime.onInstalled.addListener(refresh);

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "nfsu2Mode") {
    const senderUrl = sender.url || sender.tab?.url;

    if (!isTarget(senderUrl)) return;

    if (VALID_MODES.includes(msg.mode)) {
      const modeChanged =
        currentMode !== msg.mode ||
        currentGenre !== (msg.genre || "") ||
        currentRegion !== (msg.region || "");

      if (modeChanged) {
        currentMode = msg.mode;
        currentGenre = typeof msg.genre === "string" ? msg.genre : "";
        currentRegion = typeof msg.region === "string" ? msg.region : "";
        refresh();
      }
    }

    return;
  }

  if (msg && msg.action === "getStatus") {
    return refresh().then(() => ({
      detected,
      startedAt,
      mode: currentMode,
      genre: currentGenre,
      region: currentRegion,
      nativeConnected: nativeHostConnected,
      nativeError: nativeHostError,
      lastRpcState
    }));
  }
});

// Periodic retry if target tab is detected but native host is disconnected
setInterval(() => {
  if (detected && !port) {
    lastSentPayload = null;
    refresh();
  }
}, 5000);

refresh();
