"""
NFSU2 Revived Discord Rich Presence - Native Messaging Host (Companion App)

Firefox拡張機能からのステータス通知（stdio Native Messaging）を受け取り、
ローカルで起動中のDiscordデスクトップアプリ（IPC）へプレイ状況を反映します。

【開発者向けメモ】
- 拡張機能IDやDiscord Application IDを変更したい場合は、下記の定数セクションを編集してください。
- コマンドライン引数:
  --register [--silent]   : 現在の配置場所でFirefox用マニフェストを生成しレジストリ(HKCU)へ登録
  --unregister [--silent] : レジストリ登録を解除
"""

import ctypes
import json
import logging
from logging.handlers import RotatingFileHandler
import os
import struct
import sys
import time
import traceback
import winreg

# ============================================================================
# 設定定数（カスタマイズ時はここを編集）
# ============================================================================
HOST_NAME = "com.nfsu2revived.discordrpc.full"
HOST_DESCRIPTION = "NFSU2 Revived Discord Rich Presence Host"
ALLOWED_EXTENSION_IDS = [
    "nfsu2-revived-rpc@yamama",
]
DEFAULT_CLIENT_ID = "1568744127628320880"
GAME_TITLE = "Need for Speed Underground 2: Revived"

REGISTRY_SUBKEY = rf"Software\Mozilla\NativeMessagingHosts\{HOST_NAME}"

VALID_MODES = {
    "Offline",
    "Online",
    "Racing",
    "Cruising",
    "Free Roam",
    "Menu",
}

# ============================================================================
# パス解決・ロガー初期化（最大 256KB × 2世代のローテーション）
# ============================================================================
IS_FROZEN = getattr(sys, "frozen", False)
HERE = os.path.dirname(sys.executable) if IS_FROZEN else os.path.dirname(os.path.abspath(__file__))


def setup_logger() -> logging.Logger:
    logger = logging.getLogger("nfsu2_rpc_host")
    logger.setLevel(logging.INFO)
    if logger.handlers:
        return logger

    try:
        base_appdata = os.environ.get("LOCALAPPDATA") or HERE
        log_dir = os.path.join(base_appdata, "NFSU2RevivedRPC", "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "nfsu2_rpc_host.log")

        handler = RotatingFileHandler(
            log_path,
            maxBytes=256 * 1024,
            backupCount=2,
            encoding="utf-8",
        )
        formatter = logging.Formatter("[%(asctime)s] %(levelname)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    except Exception:
        logger.addHandler(logging.NullHandler())

    return logger


LOGGER = setup_logger()


def log(msg: str) -> None:
    LOGGER.info(msg)


# ============================================================================
# Windows ダイアログ / レジストリ登録ユーティリティ
# ============================================================================
MB_OK = 0x00000000
MB_YESNO = 0x00000004
MB_ICONINFORMATION = 0x00000040
MB_ICONQUESTION = 0x00000020
MB_ICONERROR = 0x00000010
IDYES = 6


def show_message_box(title: str, text: str, flags: int = MB_OK | MB_ICONINFORMATION) -> int:
    try:
        return ctypes.windll.user32.MessageBoxW(0, text, title, flags)
    except Exception:
        return 0


def get_manifest_path() -> str:
    return os.path.join(HERE, f"{HOST_NAME}.json")


def get_registered_manifest_path() -> str | None:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REGISTRY_SUBKEY, 0, winreg.KEY_READ) as key:
            val, _ = winreg.QueryValueEx(key, "")
            return str(val) if val else None
    except FileNotFoundError:
        return None
    except Exception:
        return None


def register_native_host(silent: bool = False) -> int:
    try:
        os.makedirs(HERE, exist_ok=True)

        if IS_FROZEN:
            target_exec = os.path.abspath(sys.executable)
        else:
            # 開発モード（Pythonスクリプト直接実行時）はアンバッファード起動用ラッパーを生成
            wrapper_path = os.path.join(HERE, "run_dev_host.cmd")
            script_path = os.path.abspath(__file__)
            py_exec = os.path.abspath(sys.executable)
            with open(wrapper_path, "w", encoding="utf-8") as wf:
                wf.write(f'@echo off\r\n"{py_exec}" -u "{script_path}" %*\r\n')
            target_exec = wrapper_path

        manifest_path = get_manifest_path()
        manifest_data = {
            "name": HOST_NAME,
            "description": HOST_DESCRIPTION,
            "path": target_exec,
            "type": "stdio",
            "allowed_extensions": ALLOWED_EXTENSION_IDS,
        }

        with open(manifest_path, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2, ensure_ascii=False)

        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, REGISTRY_SUBKEY) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, manifest_path)

        log(f"Registered Native Host: {manifest_path} -> {target_exec}")
        if not silent:
            show_message_box(
                "NFSU2 Revived Discord RPC",
                f"Firefox 連携ホストの登録が完了しました。\n\n登録先:\n{HERE}",
                MB_OK | MB_ICONINFORMATION,
            )
        return 0
    except Exception as exc:
        LOGGER.error("Registration failed: %s\n%s", exc, traceback.format_exc())
        if not silent:
            show_message_box(
                "NFSU2 Revived Discord RPC - エラー",
                f"レジストリ登録に失敗しました:\n{exc}",
                MB_OK | MB_ICONERROR,
            )
        return 1


def unregister_native_host(silent: bool = False) -> int:
    try:
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, REGISTRY_SUBKEY)
        except FileNotFoundError:
            pass

        manifest_path = get_manifest_path()
        if os.path.exists(manifest_path):
            try:
                os.remove(manifest_path)
            except OSError:
                pass

        dev_wrapper = os.path.join(HERE, "run_dev_host.cmd")
        if os.path.exists(dev_wrapper):
            try:
                os.remove(dev_wrapper)
            except OSError:
                pass

        log("Unregistered Native Host.")
        if not silent:
            show_message_box(
                "NFSU2 Revived Discord RPC",
                "Firefox 連携ホストの登録を解除しました。",
                MB_OK | MB_ICONINFORMATION,
            )
        return 0
    except Exception as exc:
        LOGGER.error("Unregistration failed: %s\n%s", exc, traceback.format_exc())
        if not silent:
            show_message_box(
                "NFSU2 Revived Discord RPC - エラー",
                f"登録解除に失敗しました:\n{exc}",
                MB_OK | MB_ICONERROR,
            )
        return 1


def handle_human_direct_launch() -> int:
    """エクスプローラー等から直接ダブルクリックされた場合の案内処理"""
    expected_manifest = os.path.normcase(os.path.abspath(get_manifest_path()))
    current_reg = get_registered_manifest_path()
    is_registered_here = (
        current_reg is not None
        and os.path.exists(current_reg)
        and os.path.normcase(os.path.abspath(current_reg)) == expected_manifest
    )

    if is_registered_here:
        show_message_box(
            "NFSU2 Revived Discord RPC Host",
            "連携プログラムは正常にインストール・登録されています。\n\n"
            "【使い方】\n"
            "1. Discord デスクトップアプリを起動しておく\n"
            "2. Firefox（拡張機能導入済み）で https://nfsu2.xyz/ を開く\n\n"
            "※このプログラムは Firefox から自動的にバックグラウンド起動されるため、直接開く必要はありません。",
            MB_OK | MB_ICONINFORMATION,
        )
        return 0

    ans = show_message_box(
        "NFSU2 Revived Discord RPC Host",
        "このフォルダの連携プログラムはまだ Firefox に登録されていません。\n"
        "現在の場所で Firefox に登録しますか？\n\n"
        f"フォルダ: {HERE}",
        MB_YESNO | MB_ICONQUESTION,
    )
    if ans == IDYES:
        return register_native_host(silent=False)
    return 0


# ============================================================================
# Discord Rich Presence 表示フォーマット & Native Messaging 通信処理
# ============================================================================
def load_client_id() -> str:
    config_path = os.path.join(HERE, "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8-sig") as cf:
                config = json.load(cf)
            cid = str(config.get("client_id", "")).strip()
            if cid and cid != "PASTE_DISCORD_APPLICATION_ID_HERE":
                return cid
        except Exception as exc:
            LOGGER.warning("config.json load warning (using default client_id): %s", exc)
    return DEFAULT_CLIENT_ID


def format_presence(mode: str, genre: str, region: str) -> tuple[str, str]:
    genre = (genre or "").strip()
    region = (region or "").strip()

    if mode == "Racing":
        race_str = f"🏁 Racing: {genre}" if genre else "🏁 Racing"
        if region:
            return race_str, f"📍 {region}"
        return GAME_TITLE, race_str

    if mode in ("Free Roam", "Cruising"):
        if region:
            return "🚗 Free Roam", f"📍 {region}"
        return GAME_TITLE, "🚗 Free Roam"

    if mode == "Menu":
        return GAME_TITLE, "🔧 In Menu / Garage or Pause"

    if mode == "Online":
        return GAME_TITLE, "Online"

    return GAME_TITLE, "Offline"


def read_exact(length: int) -> bytes | None:
    data = b""
    while len(data) < length:
        chunk = sys.stdin.buffer.read(length - len(data))
        if not chunk:
            return None
        data += chunk
    return data


def read_message() -> dict | None:
    raw_len = read_exact(4)
    if raw_len is None:
        return None

    msg_len = struct.unpack("=I", raw_len)[0]
    if msg_len > 1024 * 1024:
        raise ValueError("Native Messaging message is too large")

    data = read_exact(msg_len)
    if data is None:
        raise RuntimeError("Incomplete Native Messaging message")

    return json.loads(data.decode("utf-8"))


def write_message(obj: dict) -> None:
    try:
        data = json.dumps(obj).encode("utf-8")
        sys.stdout.buffer.write(struct.pack("=I", len(data)))
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
    except Exception as exc:
        LOGGER.error("write_message error: %s", exc)


def close_rpc(rpc) -> None:
    if rpc is not None:
        try:
            rpc.clear()
        except Exception:
            pass
        try:
            rpc.close()
        except Exception:
            pass


def run_native_messaging_loop() -> int:
    rpc = None
    last_presence_tuple = None
    log("=== NFSU2 RPC Native Host started ===")

    try:
        from pypresence import Presence

        client_id = load_client_id()
        if not client_id:
            raise ValueError("Discord client_id is empty.")

        log(f"Client ID ready: {client_id}")

        while True:
            msg = read_message()
            if msg is None:
                log("EOF received on stdin. Exiting.")
                break

            action = msg.get("action")

            if action == "stop":
                log("Action: stop. Closing RPC.")
                close_rpc(rpc)
                rpc = None
                last_presence_tuple = None
                write_message({"type": "status", "connected": False})
                continue

            if action != "update":
                continue

            mode = str(msg.get("mode", "Offline"))
            if mode not in VALID_MODES:
                mode = "Offline"

            genre = str(msg.get("genre", "")).strip()
            region = str(msg.get("region", "")).strip()
            started_at = int(msg.get("started_at") or time.time())

            details_text, state_text = format_presence(mode, genre, region)
            if len(details_text) > 128:
                details_text = details_text[:125] + "..."
            if len(state_text) > 128:
                state_text = state_text[:125] + "..."

            current_tuple = (details_text, state_text, started_at)

            # Connect to Discord if needed
            if rpc is None:
                try:
                    rpc = Presence(client_id)
                    rpc.connect()
                    log("Connected to Discord IPC successfully.")
                    write_message({"type": "status", "connected": True})
                except Exception as conn_err:
                    err_str = str(conn_err)
                    LOGGER.warning("Discord connection error: %s", err_str)
                    write_message({"type": "error", "message": f"Discord connection failed: {err_str}"})
                    rpc = None
                    continue

            # Update presence only if changed or first time
            if current_tuple != last_presence_tuple:
                try:
                    rpc.update(
                        details=details_text,
                        state=state_text,
                        start=started_at,
                    )
                    last_presence_tuple = current_tuple
                    combined_display = f"{details_text} | {state_text}"
                    log(f"Presence updated: [{combined_display}]")
                    write_message({"type": "status", "connected": True, "state": combined_display})
                except Exception as update_err:
                    err_str = str(update_err)
                    LOGGER.warning("Presence update error: %s", err_str)
                    write_message({"type": "error", "message": f"Presence update failed: {err_str}"})
                    close_rpc(rpc)
                    rpc = None
                    last_presence_tuple = None

        return 0

    except Exception as exc:
        err_msg = str(exc)
        LOGGER.error("Fatal error in main loop: %s\n%s", err_msg, traceback.format_exc())
        write_message({
            "type": "error",
            "message": err_msg,
        })
        return 1

    finally:
        log("Native Host shutting down.")
        close_rpc(rpc)


def main() -> int:
    args = sys.argv[1:]
    silent = "--silent" in args

    if "--register" in args:
        return register_native_host(silent=silent)

    if "--unregister" in args:
        return unregister_native_host(silent=silent)

    # Firefoxから起動された場合は引数にマニフェストパスが渡され、stdinはパイプになる
    if len(args) == 0 and (sys.stdin is None or sys.stdin.isatty()):
        return handle_human_direct_launch()

    return run_native_messaging_loop()


if __name__ == "__main__":
    sys.exit(main())
