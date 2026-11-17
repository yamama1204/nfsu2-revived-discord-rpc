<#
.SYNOPSIS
  開発者向けローカル即時セットアップスクリプト
.DESCRIPTION
  Setup.exe を毎回ビルドし直さずに、companion_app/nfsu2_rpc_host.py の編集内容を
  そのまま Firefox から呼び出してテストできるようローカル登録を行います。
  解除したい場合は .\scripts\dev_setup.ps1 -Unregister を実行してください。
#>
param(
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$CompanionDir = Join-Path $RepoRoot "companion_app"
$HostScript = Join-Path $CompanionDir "nfsu2_rpc_host.py"
$ReqFile = Join-Path $CompanionDir "requirements.txt"

function Find-PythonCommand {
    foreach ($cmd in @("python", "py")) {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) {
            try {
                & $cmd --version 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) { return $cmd }
            } catch {}
        }
    }
    $localPyDir = Join-Path $env:LOCALAPPDATA "Programs\Python"
    if (Test-Path $localPyDir) {
        $found = Get-ChildItem -Path $localPyDir -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch "\\venv\\" } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    throw "Python が見つかりません。Python 3.10以上をインストールしてください。"
}

$PythonCmd = Find-PythonCommand
Write-Host "Using Python: $PythonCmd" -ForegroundColor Cyan

if ($Unregister) {
    & $PythonCmd $HostScript --unregister --silent
    if ($LASTEXITCODE -ne 0) { throw "登録解除に失敗しました。" }
    Write-Host "[OK] 開発用 Native Host 登録を解除しました。" -ForegroundColor Green
    exit 0
}

Write-Host "Python 依存パッケージを確認中..."
& $PythonCmd -m pip install -r $ReqFile
if ($LASTEXITCODE -ne 0) { throw "pip install に失敗しました。" }

Write-Host "開発用 Native Host を登録中..."
& $PythonCmd $HostScript --register --silent
if ($LASTEXITCODE -ne 0) { throw "開発用 Native Host の登録に失敗しました。" }

Write-Host ""
Write-Host "[OK] 開発モードの登録が完了しました！" -ForegroundColor Green
Write-Host "・Firefox の about:debugging#/runtime/this-firefox から extension/manifest.json を読み込んでテストできます。"
Write-Host "・companion_app/nfsu2_rpc_host.py を書き換えた際は、再ビルド不要でそのまま反映されます。"
