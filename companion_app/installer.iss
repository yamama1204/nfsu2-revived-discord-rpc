; ============================================================================
; NFSU2 Revived Discord RPC Host - Inno Setup 6 Script
; 管理者権限不要（ユーザー領域 %LOCALAPPDATA%\Programs\NFSU2RevivedRPC へ導入）
; ============================================================================

#ifndef MyAppVersion
  #define MyAppVersion "0.5.0"
#endif

#define MyAppName "NFSU2 Revived Discord RPC Host"
#define MyAppPublisher "yamama"
#define MyAppExeName "nfsu2_rpc_host.exe"
#define NativeHostName "com.nfsu2revived.discordrpc.full"

[Setup]
AppId={{8F5B6D2E-4A91-4C3B-9E72-1D6A0F5C8B34}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\NFSU2RevivedRPC
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\release
OutputBaseFilename=NFSU2_Revived_RPC_Setup_v{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=force
CloseApplicationsFilter=nfsu2_rpc_host.exe
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\build\pyinstaller_dist\nfsu2_rpc_host\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "config.json"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Registry]
; アンインストール時にレジストリキーを確実に自動削除するための定義
Root: HKCU; Subkey: "Software\Mozilla\NativeMessagingHosts\{#NativeHostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\{#NativeHostName}.json"; Flags: uninsdeletekey

[Run]
; インストール完了時にUTF-8マニフェストJSONの生成＆レジストリ登録を実行
Filename: "{app}\{#MyAppExeName}"; Parameters: "--register --silent"; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--unregister --silent"; RunOnceId: "UnregisterNativeHost"; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: files; Name: "{app}\{#NativeHostName}.json"
Type: filesandordirs; Name: "{localappdata}\NFSU2RevivedRPC"
