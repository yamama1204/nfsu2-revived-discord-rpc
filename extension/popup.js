// ============================================================================
// 【開発者向け設定】
// 連携アプリ（Setup.exe）の配布ページURLが決まったら下記に入力してください。
// 例: "https://github.com/あなたのID/リポジトリ名/releases/latest"
// 空欄("")のままだとボタンは非表示になり、テキスト案内のみ表示されます。
// ============================================================================
const COMPANION_DOWNLOAD_URL = "https://github.com/yamama1204/nfsu2-revived-discord-rpc/releases/latest";

function isHostMissingError(errText) {
  if (!errText) return false;
  const lower = errText.toLowerCase();
  return (
    lower.includes("no such native application") ||
    lower.includes("could not connect to native host") ||
    lower.includes("attempt to postmessage on disconnected port")
  );
}

function formatFriendlyError(errText) {
  if (!errText) return "";
  const lower = errText.toLowerCase();
  if (lower.includes("discordnotfound") || lower.includes("discord connection failed")) {
    return "Discord デスクトップアプリが見つかりません。Discord を起動すると自動的に接続されます。";
  }
  return "状態: " + errText;
}

const dlBtn = document.getElementById("dl-btn");
if (dlBtn && COMPANION_DOWNLOAD_URL) {
  dlBtn.addEventListener("click", () => {
    browser.tabs.create({ url: COMPANION_DOWNLOAD_URL });
    window.close();
  });
}

async function update() {
  const status = document.getElementById("status");
  const hostStatus = document.getElementById("host-status");
  const extraInfo = document.getElementById("extra-info");
  const modeVal = document.getElementById("mode-val");
  const genreRow = document.getElementById("genre-row");
  const genreVal = document.getElementById("genre-val");
  const regionRow = document.getElementById("region-row");
  const regionVal = document.getElementById("region-val");
  const rpcRow = document.getElementById("rpc-row");
  const rpcVal = document.getElementById("rpc-val");
  const setupGuide = document.getElementById("setup-guide");
  const dlWrap = document.getElementById("dl-wrap");
  const errorBox = document.getElementById("error-box");

  try {
    const result = await browser.runtime.sendMessage({ action: "getStatus" });
    if (result.detected) {
      status.textContent = "● nfsu2.xyz を検出中";
      extraInfo.hidden = false;
      modeVal.textContent = result.mode || "Offline";

      if (result.genre) {
        genreRow.hidden = false;
        genreVal.textContent = result.genre;
      } else {
        genreRow.hidden = true;
      }

      if (result.region) {
        regionRow.hidden = false;
        regionVal.textContent = result.region;
      } else {
        regionRow.hidden = true;
      }

      if (result.lastRpcState) {
        rpcRow.hidden = false;
        rpcVal.textContent = result.lastRpcState;
      } else {
        rpcRow.hidden = true;
      }

      hostStatus.hidden = false;
      if (result.nativeConnected) {
        hostStatus.className = "badge badge-ok";
        hostStatus.textContent = "✓ Discord RPC 接続中";
        setupGuide.hidden = true;
        errorBox.hidden = true;
      } else if (isHostMissingError(result.nativeError)) {
        hostStatus.className = "badge badge-err";
        hostStatus.textContent = "✗ PC連携アプリ未導入";
        setupGuide.hidden = false;
        dlWrap.hidden = !COMPANION_DOWNLOAD_URL;
        errorBox.hidden = true;
      } else {
        hostStatus.className = "badge badge-warn";
        hostStatus.textContent = "! RPCホスト待機中";
        setupGuide.hidden = true;
        if (result.nativeError) {
          errorBox.hidden = false;
          errorBox.textContent = formatFriendlyError(result.nativeError);
        } else {
          errorBox.hidden = true;
        }
      }
    } else {
      status.textContent = "○ nfsu2.xyz のタブが見つかりません";
      extraInfo.hidden = true;
      hostStatus.hidden = true;
      setupGuide.hidden = true;
      errorBox.hidden = true;
    }
  } catch (error) {
    status.textContent = "状態を取得できませんでした。拡張機能を再読み込みしてください。";
    console.error(error);
  }
}

update();
