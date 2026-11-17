[日本語](./README_JA.md)
# NFSU2 Revived Discord RPC

A **Firefox extension** and **Windows Companion App** that automatically detects your gameplay status for **Need for Speed: Underground 2 Revived** running on `[https://nfsu2.xyz/](https://nfsu2.xyz/)` and reflects it in real-time as your Discord activity (Rich Presence).

---

## Key Features

* **Real-time Automatic Game State Detection** (via `MutationObserver` on public DOM elements):
* `🚗 Free Roam`: Cruising in free roam (including skateboard and drones).
* `🏁 Racing: <Genre>` / `🏁 Racing`: In a race (English genre name is included if it can be determined from events, lobbies, etc.).
* Supported genres: `Circuit`, `Sprint`, `Drag`, `Drift`, `Street X`, `Underground Racing League`, `Outrun`, `Downhill Drift`.


* `🔧 In Menu / Garage or Pause`: Garage, shop, main menu, or pause screen.
* `Offline`: Launcher screen before the game starts or after it ends (closing all `nfsu2.xyz` tabs will also automatically end the RPC display).


* **Design Limitations**:
* Battle lists in the garage (world map), quick race genre names, and detailed coordinates exist only within the site's private Wasm memory and violate anti-cheat terms. Therefore, they are not read, and the app operates safely using only public DOM information.



---

## For General Users: Installation Guide

To use this tool, you need to install two components: **① The Firefox Extension** and **② The PC Companion App (Installer)**. (No Python installation or administrator privileges required).

### 1. Installing the PC Companion App

1. Download **`NFSU2_Revived_RPC_Setup_vX.X.X.exe`** from the distribution page (Releases, etc.) and run it.
* *Note: If Windows Defender shows a blue confirmation screen ("Windows protected your PC") on first launch, click **"More info"** -> **"Run anyway"**.*


2. Follow the on-screen instructions to complete the installation (it will be installed to `%LOCALAPPDATA%\Programs\NFSU2RevivedRPC`, and the Firefox integration registration is done automatically).

### 2. Adding the Firefox Extension

1. Add **NFSU2 Revived Discord RPC** to Firefox from the Firefox Add-ons page (or via the provided signed `.xpi` file).
2. With the **Discord desktop app** running, open `[https://nfsu2.xyz/](https://nfsu2.xyz/)` in Firefox, and it will automatically reflect in your Discord status.

### How to Uninstall

* **PC Companion App**: Uninstall `NFSU2 Revived Discord RPC Host` from Windows **Settings > Apps > Installed apps** (registry entries and logs will also be automatically deleted).
* **Firefox Extension**: Remove it from Firefox Add-on management (`about:addons`).

---

## For Developers: Directory Structure, Editing, and Build Guide

This repository is designed to make it easy for you to freely edit and modify the code, or publish and co-develop it on GitHub.

### Folder Structure

```text
├── extension/                    # [① Firefox Extension] (JS / HTML / manifest.json)
│   ├── manifest.json             # Extension definition (ID: nfsu2-revived-rpc@yamama)
│   ├── detector.js               # Game state detection script on nfsu2.xyz
│   ├── background.js             # Tab monitoring & Native Messaging send/receive
│   ├── popup.html                # Popup UI when clicking the toolbar icon
│   └── popup.js                  # Popup control (contains distribution URL setting constant)
│
├── companion_app/                # [② PC Companion Program (Native Messaging Host)]
│   ├── nfsu2_rpc_host.py         # Python-based host core (Discord IPC communication & auto-registration)
│   ├── config.json               # Discord Application ID (client_id) settings
│   ├── requirements.txt          # Python dependency packages definition
│   └── installer.iss             # Inno Setup 6 installer definition script
│
├── scripts/                      # [③ Development & Build Automation Scripts]
│   ├── dev_setup.ps1             # For dev: Registers local code directly to Firefox without rebuilding
│   ├── build_extension.ps1       # For distribution: Creates ZIP for AMO submission from extension/
│   ├── build_companion.ps1       # For distribution: Creates Setup.exe and Portable.zip
│   └── build_all.ps1             # For distribution: Bulk-builds all distribution packages
│
└── .github/workflows/release.yml # Cloud automated build settings via GitHub Actions

```

### Local Editing and Testing Method (No need to create an installer every time)

1. **Run development mode registration once** (Requires Python 3.10+):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev_setup.ps1

```


This allows `companion_app/nfsu2_rpc_host.py` to be called directly by Firefox (editing Python code takes effect immediately without rebuilding the EXE).
2. **Temporarily load the extension in Firefox**:
* Type `about:debugging#/runtime/this-firefox` into the Firefox address bar.
* Click **"Load Temporary Add-on..."** and select `extension/manifest.json`.
* When you edit JS inside `extension/`, click the **"Reload"** button on that same screen.


3. If you want to unregister the development mode registry:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev_setup.ps1 -Unregister

```



### How to Build Distribution Packages (`Setup.exe` & Extension `.zip`)

#### Method A: Build on your local Windows PC

1. Install **Python 3.10+** and **[Inno Setup 6](https://jrsoftware.org/isdl.php)** (or via `winget install JRSoftware.InnoSetup`) beforehand.
2. Run the following script:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_all.ps1

```


3. The following three files will be generated in the `release/` folder:
* `nfsu2-revived-rpc-extension-vX.X.X.zip` (For Mozilla AMO submission)
* `NFSU2_Revived_RPC_Setup_vX.X.X.exe` (Installer for general users)
* `NFSU2_Revived_RPC_Portable_vX.X.X.zip` (Portable version)



#### Method B: Automatic build on GitHub (GitHub Actions)

* Push this folder as-is to a GitHub repository, and either manually run `Build & Release Packages` from the **Actions** tab on GitHub, or push a tag like `v0.5.0`. `Setup.exe` and `.zip` will be automatically built in the cloud and attached to GitHub Releases.

### Release & Publication Checklist

1. **Setting the Distribution URL (Optional)**: Once the distribution page URL (GitHub Releases, etc.) is decided, enter the URL into `COMPANION_DOWNLOAD_URL` at the top of `extension/popup.js`. This will display a download button on the popup screen for users who haven't installed the companion app yet.
2. **Extension Signing on Mozilla AMO (Required & Free)**: To allow installation on regular versions of Firefox for general users, upload `release/nfsu2-revived-rpc-extension-vX.X.X.zip` to the [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/) and proceed with store publication (Listed) or self-distribution signing (acquiring an Unlisted `.xpi`).
* *Important: If you change the `gecko.id` (`nfsu2-revived-rpc@yamama`) in `extension/manifest.json`, make sure to match it with `ALLOWED_EXTENSION_IDS` in `companion_app/nfsu2_rpc_host.py`.*
