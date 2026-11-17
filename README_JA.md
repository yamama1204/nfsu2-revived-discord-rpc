[English](./README.md)
# NFSU2 Revived Discord RPC

`https://nfsu2.xyz/` で動作する **Need for Speed: Underground 2 Revived** のプレイ状況を自動検出し、Discord のアクティビティ（Rich Presence）へリアルタイム反映する **Firefox 拡張機能** と **Windows 連携アプリ（Companion App）** です。

---

## 主な機能

- **プレイ状態のリアルタイム自動判別**（公開DOMの `MutationObserver` による検知）:
  - `🚗 Free Roam`: フリーローム走行中（スケートボード・ドローン含む）
  - `🏁 Racing: <ジャンル>` / `🏁 Racing`: レース中（イベント・ロビー等から判別可能な場合は英語ジャンル名を併記）
    - 対応ジャンル: `Circuit`, `Sprint`, `Drag`, `Drift`, `Street X`, `Underground Racing League`, `Outrun`, `Downhill Drift`
  - `🔧 In Menu / Garage or Pause`: ガレージ、ショップ、メインメニュー、ポーズ画面
  - `Offline`: ゲーム起動前・終了後のランチャー画面（`nfsu2.xyz` のタブをすべて閉じると RPC 表示も自動終了します）
- **仕様上の制限事項**:
  - ガレージ内のバトルリスト（ワールドマップ）/ クイックレースのジャンル名や詳細座標は、サイトの非公開 Wasm メモリ内にのみ存在しアンチチート規約に抵触するため読み取りを行わず、公開DOM情報のみで安全に動作します。

---

## 一般ユーザー向け：導入手順

本ツールを使うには、**① Firefox 拡張機能** と **② PC側連携アプリ（インストーラー）** の2つを導入します（Python等のインストールや管理者権限は不要です）。

### 1. PC側連携アプリのインストール
1. 配布ページ（Releases 等）から **`NFSU2_Revived_RPC_Setup_vX.X.X.exe`** をダウンロードして実行します。
   - ※初回起動時に Windows の青い確認画面（「Windows によって PC が保護されました」）が表示された場合は、**「詳細情報」→「実行」** をクリックしてください。
2. 画面の案内に従ってインストールを完了します（`%LOCALAPPDATA%\Programs\NFSU2RevivedRPC` に導入され、Firefox への連携登録も自動で行われます）。

### 2. Firefox 拡張機能の追加
1. Firefox アドオンページ（または配布されている署名済み `.xpi` ファイル）から **NFSU2 Revived Discord RPC** を Firefox に追加します。
2. **Discord デスクトップアプリ** を起動した状態で、Firefox で `https://nfsu2.xyz/` を開くと自動的に Discord のステータスへ反映されます。

### アンインストール方法
- **PC側連携アプリ**: Windows の **「設定」＞「アプリ」＞「インストールされているアプリ」** から `NFSU2 Revived Discord RPC Host` をアンインストールしてください（レジストリ登録やログも自動で削除されます）。
- **Firefox 拡張機能**: Firefox のアドオン管理（`about:addons`）から削除してください。

---

## 開発者向け：ディレクトリ構成と編集・ビルドガイド

本リポジトリは、後から自由にコードを編集・改造したり GitHub で公開・共同開発しやすいように設計されています。

### フォルダ構成

```text
├── extension/                    # 【① Firefox拡張機能】（JS / HTML / manifest.json）
│   ├── manifest.json             # 拡張機能定義（ID: nfsu2-revived-rpc@yamama）
│   ├── detector.js               # nfsu2.xyz 上のゲーム状態検出スクリプト
│   ├── background.js             # タブ監視・Native Messaging 送受信
│   ├── popup.html                # ツールバーアイコンクリック時のポップアップUI
│   └── popup.js                  # ポップアップ制御（配布先URL設定定数あり）
│
├── companion_app/                # 【② PC側連携プログラム（Native Messaging Host）】
│   ├── nfsu2_rpc_host.py         # Python製ホスト本体（Discord IPC 通信・自己登録機能）
│   ├── config.json               # Discord Application ID (client_id) 設定
│   ├── requirements.txt          # Python 依存パッケージ定義
│   └── installer.iss             # Inno Setup 6 インストーラー定義スクリプト
│
├── scripts/                      # 【③ 開発・ビルド自動化スクリプト】
│   ├── dev_setup.ps1             # 開発用：再ビルド不要でローカルコードをFirefoxへ直接登録
│   ├── build_extension.ps1       # 配布用：extension/ から AMO提出用 ZIP を作成
│   ├── build_companion.ps1       # 配布用：Setup.exe と Portable.zip を作成
│   └── build_all.ps1             # 配布用：すべての配布パッケージを一括ビルド
│
└── .github/workflows/release.yml # GitHub Actions によるクラウド自動ビルド設定
```

### ローカルでの編集・テスト方法（毎回インストーラーを作る必要はありません）

1. **初回のみ開発モード登録を実行**（要 Python 3.10+）:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\dev_setup.ps1
   ```
   これにより、`companion_app/nfsu2_rpc_host.py` がそのまま Firefox から呼び出されるようになります（Python コードを編集しても EXE の再ビルドなしで即反映されます）。
2. **Firefox で拡張機能を一時読み込み**:
   - Firefox のアドレスバーに `about:debugging#/runtime/this-firefox` を入力します。
   - **「一時的なアドオンを読み込む...」** を押し、`extension/manifest.json` を選択します。
   - `extension/` 内の JS を編集した際は、同画面の **「再読み込み」** ボタンを押してください。
3. 開発モードのレジストリ登録を解除したい場合:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\dev_setup.ps1 -Unregister
   ```

### 配布用パッケージ（`Setup.exe` & 拡張機能 `.zip`）のビルド方法

#### 方法A：手元の Windows PC でビルドする
1. 事前に **Python 3.10+** と **[Inno Setup 6](https://jrsoftware.org/isdl.php)**（または `winget install JRSoftware.InnoSetup`）をインストールします。
2. 以下のスクリプトを実行します:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\build_all.ps1
   ```
3. `release/` フォルダ内に以下の3ファイルが生成されます:
   - `nfsu2-revived-rpc-extension-vX.X.X.zip` （Mozilla AMO 提出用）
   - `NFSU2_Revived_RPC_Setup_vX.X.X.exe` （一般ユーザー配布用インストーラー）
   - `NFSU2_Revived_RPC_Portable_vX.X.X.zip` （ポータブル版）

#### 方法B：GitHub 上で自動ビルドする（GitHub Actions）
- このフォルダをそのまま GitHub リポジトリへ Push し、GitHub の **Actions** タブから `Build & Release Packages` を手動実行（Run workflow）するか、`v0.5.0` のようなタグを Push すると、クラウド上で自動的に `Setup.exe` と `.zip` がビルドされ、GitHub Releases に添付されます。

### リリース・公開時のチェックリスト
1. **配布先URLの設定（任意）**: 配布ページのURL（GitHub Releases 等）が決まったら、`extension/popup.js` 先頭の `COMPANION_DOWNLOAD_URL` に URL を記入すると、連携アプリ未導入ユーザーのポップアップ画面にダウンロードボタンが表示されます。
2. **Mozilla AMO での拡張機能署名（必須・無料）**: 一般ユーザーの通常版 Firefox にインストールできるようにするため、[Firefox Add-on Developer Hub](https://addons.mozilla.org/ja/developers/) に `release/nfsu2-revived-rpc-extension-vX.X.X.zip` をアップロードし、ストア公開（Listed）または自己配布用署名（Unlisted `.xpi` 取得）を行ってください。
   - ※重要：`extension/manifest.json` の `gecko.id`（`nfsu2-revived-rpc@yamama`）を変更する場合は、必ず `companion_app/nfsu2_rpc_host.py` の `ALLOWED_EXTENSION_IDS` も同じ値に揃えてください。
