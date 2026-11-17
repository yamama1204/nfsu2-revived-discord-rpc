(() => {
  console.info("[NFSU2 RPC] detector.js initialized (DOM observer mode)");

  let wasInFreeRoam = false;
  let sawLoadingSinceRoam = false;
  let inSinglePlayerRace = false;
  let lastDrivingSignalAt = 0;
  let raceStartingUntil = 0;

  let pendingLobbyGenre = "";
  let pendingLobbyAt = 0;
  let activeRaceGenre = "";
  let lastReportedKey = "";

  function normalizeGenre(raw) {
    if (typeof raw !== "string") return "";
    const text = raw.trim();
    if (!text) return "";
    const lower = text.toLowerCase();

    // Check Street X before generic Street / Circuit
    if (lower.includes("street x") || lower.includes("streetx") || text.includes("ストリートX") || text.includes("ストリート X")) {
      return "Street X";
    }
    if (lower.includes("url") || lower.includes("underground racing league")) {
      return "Underground Racing League";
    }
    if (lower.includes("downhill") || text.includes("ダウンヒル")) {
      return "Downhill Drift";
    }
    if (lower.includes("sprint") || text.includes("スプリント")) {
      return "Sprint";
    }
    if (lower.includes("drag") || text.includes("ドラッグ")) {
      return "Drag";
    }
    if (lower.includes("drift") || text.includes("ドリフト")) {
      return "Drift";
    }
    if (lower.includes("outrun") || text.includes("アウトラン")) {
      return "Outrun";
    }
    if (lower.includes("circuit") || text.includes("サーキット") || text === "ストリート") {
      return "Circuit";
    }
    return "";
  }

  function readDetailedFpsDrive() {
    const fpsEl = document.getElementById("fps");
    if (!fpsEl || fpsEl.hidden) return null;
    const dl = fpsEl.querySelector("dl");
    if (!dl) return null;
    const dts = dl.querySelectorAll("dt");
    for (const dt of dts) {
      if (dt.textContent?.trim() === "drive") {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === "DD") {
          const val = Number(dd.textContent.replace(/,/g, "").trim());
          if (Number.isFinite(val)) return val;
        }
      }
    }
    return null;
  }

  function readTrackMenuGenreHint() {
    const menuTracksVal = document.querySelector('#menu [data-act="tracks"] .menu-val');
    if (menuTracksVal && menuTracksVal.textContent) {
      const g = normalizeGenre(menuTracksVal.textContent);
      if (g) return g;
    }
    const currentTrackRow = document.querySelector('#menu-tracks-races .menu-row[aria-current="true"]');
    if (currentTrackRow && currentTrackRow.textContent) {
      const g = normalizeGenre(currentTrackRow.textContent);
      if (g) return g;
    }
    return "";
  }

  function detectMode() {
    try {
      const now = Date.now();
      const phase = document.body?.dataset?.phase || "";

      // Before game launch or after quitting back to launcher page -> Offline (RPC still active)
      if (phase !== "playing") {
        wasInFreeRoam = false;
        sawLoadingSinceRoam = false;
        inSinglePlayerRace = false;
        raceStartingUntil = 0;
        pendingLobbyGenre = "";
        activeRaceGenre = "";
        return { mode: "Offline", genre: "", region: "" };
      }

      const touchEl = document.querySelector(".touch");
      const hasDataRoam = !!touchEl?.hasAttribute("data-roam");
      const hasDataNetrace = !!touchEl?.hasAttribute("data-netrace");
      const hasDataGears = !!touchEl?.hasAttribute("data-gears");
      const isFast = !!touchEl?.querySelector('[data-ctl="reset"]')?.classList.contains("stowed");

      const pauseHintEl = document.querySelector(".pause-hint");
      const isPaused = !!(pauseHintEl && !pauseHintEl.hidden);

      const titleMarkEl = document.querySelector(".title-mark");
      const titleMarkVisible = !!(titleMarkEl && !titleMarkEl.hidden);
      const isTitleScreen = titleMarkVisible && !titleMarkEl.classList.contains("corner");
      const isLoading = titleMarkVisible && titleMarkEl.classList.contains("corner");

      const lobbyEl = document.getElementById("lobby");
      const lobbyVisible = !!(lobbyEl && !lobbyEl.hidden);
      const lobbyCoverEl = document.getElementById("lobby-cover");
      const lobbyCoverVisible = !!(lobbyCoverEl && !lobbyCoverEl.hidden);

      const driftBoardEl = document.querySelector(".drift-board");
      const driftBoardVisible = !!(driftBoardEl && !driftBoardEl.hidden);

      const skateCardEl = document.querySelector(".skate-card");
      const skateVisible = !!(skateCardEl && !skateCardEl.hidden);

      const droneCardEl = document.querySelector(".drone-card");
      const droneVisible = !!(droneCardEl && !droneCardEl.hidden);

      // Capture genre from race lobby / event spot overlay whenever shown
      if (lobbyVisible) {
        const raceTitleEl = lobbyEl.querySelector(".lobby-race");
        if (raceTitleEl) {
          const parsed = normalizeGenre(raceTitleEl.textContent || "");
          if (parsed) {
            pendingLobbyGenre = parsed;
            pendingLobbyAt = now;
          }
        }
      } else if (pendingLobbyGenre && now - pendingLobbyAt > 20000) {
        pendingLobbyGenre = "";
      }

      // Latch race start transition when lobby cover ("Starting the race") appears
      if (lobbyCoverVisible) {
        inSinglePlayerRace = true;
        lastDrivingSignalAt = now;
        raceStartingUntil = now + 12000;
        if (!activeRaceGenre && pendingLobbyGenre) {
          activeRaceGenre = pendingLobbyGenre;
          pendingLobbyGenre = "";
        }
      }

      // Detect loading / title transitions
      if (isLoading || isTitleScreen) {
        sawLoadingSinceRoam = true;
        if (inSinglePlayerRace && now >= raceStartingUntil && !lobbyCoverVisible) {
          inSinglePlayerRace = false;
          if (!hasDataNetrace) {
            activeRaceGenre = "";
          }
        }
      }

      // 1. Free Roam (driving in city/track, riding skateboard, or flying drone)
      if (hasDataRoam || skateVisible || droneVisible) {
        inSinglePlayerRace = false;
        raceStartingUntil = 0;
        activeRaceGenre = "";
        wasInFreeRoam = true;
        sawLoadingSinceRoam = false;

        if (!lobbyVisible && pendingLobbyGenre && now - pendingLobbyAt > 4000) {
          pendingLobbyGenre = "";
        }

        if (isPaused) {
          return { mode: "Menu", genre: "", region: "" };
        }

        return { mode: "Free Roam", genre: "", region: "" };
      }

      // 2. Online / Multiplayer Race or Drift Battle
      if (hasDataNetrace || lobbyCoverVisible || driftBoardVisible) {
        if (driftBoardVisible && !activeRaceGenre) {
          activeRaceGenre = "Drift";
        } else if (!activeRaceGenre && pendingLobbyGenre) {
          activeRaceGenre = pendingLobbyGenre;
        }
        if (isPaused) {
          return { mode: "Menu", genre: "", region: "" };
        }
        return { mode: "Racing", genre: activeRaceGenre, region: "" };
      }

      // 3. Title Screen
      if (isTitleScreen) {
        wasInFreeRoam = false;
        inSinglePlayerRace = false;
        raceStartingUntil = 0;
        activeRaceGenre = "";
        return { mode: "Menu", genre: "", region: "" };
      }

      // 4. Optional passive check if Detailed FPS HUD happens to be enabled by user
      const fpsDrive = readDetailedFpsDrive();
      if (fpsDrive !== null) {
        const driveMode = fpsDrive & 3;
        if (driveMode === 1) {
          if (!inSinglePlayerRace) {
            inSinglePlayerRace = true;
            activeRaceGenre =
              pendingLobbyGenre ||
              (!sawLoadingSinceRoam && wasInFreeRoam ? "Outrun" : readTrackMenuGenreHint());
            pendingLobbyGenre = "";
          }
          lastDrivingSignalAt = now;
          return isPaused
            ? { mode: "Menu", genre: "", region: "" }
            : { mode: "Racing", genre: activeRaceGenre, region: "" };
        }
        if (driveMode === 0 && now >= raceStartingUntil) {
          inSinglePlayerRace = false;
          activeRaceGenre = "";
          return { mode: "Menu", genre: "", region: "" };
        }
      }

      // 5. Single-Player Race detection via active driving signals when outside Free Roam
      if (!isLoading && !isPaused) {
        if (hasDataGears || isFast) {
          lastDrivingSignalAt = now;
          if (!inSinglePlayerRace) {
            inSinglePlayerRace = true;
            if (pendingLobbyGenre) {
              activeRaceGenre = pendingLobbyGenre;
              pendingLobbyGenre = "";
            } else if (wasInFreeRoam && !sawLoadingSinceRoam) {
              activeRaceGenre = "Outrun";
            } else {
              activeRaceGenre = readTrackMenuGenreHint();
            }
          }
        } else if (inSinglePlayerRace && now >= raceStartingUntil && now - lastDrivingSignalAt > 15000) {
          inSinglePlayerRace = false;
          activeRaceGenre = "";
        }
      }

      if (inSinglePlayerRace) {
        if (isPaused) {
          return { mode: "Menu", genre: "", region: "" };
        }
        return { mode: "Racing", genre: activeRaceGenre, region: "" };
      }

      // 6. Otherwise in Main Menu / Garage / Shop / Pause
      return { mode: "Menu", genre: "", region: "" };
    } catch (error) {
      console.error("[NFSU2 RPC] detector error:", error);
      const phase = document.body?.dataset?.phase || "";
      return { mode: phase === "playing" ? "Menu" : "Offline", genre: "", region: "" };
    }
  }

  function report(force = false) {
    const data = detectMode();
    const key = `${data.mode}|${data.genre}|${data.region}`;
    if (!force && key === lastReportedKey) return;
    lastReportedKey = key;

    browser.runtime.sendMessage({
      type: "nfsu2Mode",
      ...data
    }).catch(() => {});
  }

  // Observe DOM attribute changes on body and #stage so fast loading screens / lobbies are never missed
  const observer = new MutationObserver(() => {
    report(false);
  });

  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-phase"]
    });
  }

  const stageEl = document.getElementById("stage");
  if (stageEl) {
    observer.observe(stageEl, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["hidden", "class", "data-roam", "data-netrace", "data-gears"]
    });
  }

  report(true);
  setInterval(() => report(false), 1000);
  // Periodic heartbeat to ensure background worker stays synced after service reload
  setInterval(() => report(true), 10000);
})();
