<#
.SYNOPSIS
  PC側連携プログラム（companion_app/）をビルドし、Setup.exe インストーラーとポータブルZIPを生成します。
#>
param(
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = Split-Path -Parent $PSScriptRoot
$CompanionDir = Join-Path $RepoRoot "companion_app"
$BuildDir = Join-Path $RepoRoot "build"
$PyDistDir = Join-Path $BuildDir "pyinstaller_dist"
$PyWorkDir = Join-Path $BuildDir "pyinstaller_work"
$ReleaseDir = Join-Path $RepoRoot "release"
$ManifestFile = Join-Path $RepoRoot "extension\manifest.json"

$Version = "0.5.0"
if (Test-Path $ManifestFile) {
    $Manifest = Get-Content -Path $ManifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Manifest.version) { $Version = $Manifest.version }
}

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

function Find-InnoSetupCompiler {
    if (Get-Command ISCC.exe -ErrorAction SilentlyContinue) {
        return (Get-Command ISCC.exe).Source
    }
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    return $null
}

$PythonCmd = Find-PythonCommand
Write-Host "Using Python: $PythonCmd" -ForegroundColor Cyan

Write-Host "1/3 Installing Python build dependencies..." -ForegroundColor Cyan
& $PythonCmd -m pip install -r (Join-Path $CompanionDir "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    throw "Python 依存パッケージのインストールに失敗しました。"
}

Write-Host "2/3 Building Companion App executable (PyInstaller --onedir)..." -ForegroundColor Cyan
if (Test-Path $PyDistDir) { Remove-Item -Path $PyDistDir -Recurse -Force }
if (Test-Path $PyWorkDir) { Remove-Item -Path $PyWorkDir -Recurse -Force }
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

& $PythonCmd -m PyInstaller --noconfirm --clean --onedir --console `
    --name nfsu2_rpc_host `
    --distpath $PyDistDir `
    --workpath $PyWorkDir `
    --specpath $BuildDir `
    (Join-Path $CompanionDir "nfsu2_rpc_host.py")

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller ビルドに失敗しました。"
}

$CompiledAppDir = Join-Path $PyDistDir "nfsu2_rpc_host"
Copy-Item -Path (Join-Path $CompanionDir "config.json") -Destination (Join-Path $CompiledAppDir "config.json") -Force

# ポータブル版ZIPの作成（インストーラーを使わない上級者向け）
$PortableStage = Join-Path $BuildDir "portable_stage\NFSU2RevivedRPC"
if (Test-Path (Join-Path $BuildDir "portable_stage")) {
    Remove-Item -Path (Join-Path $BuildDir "portable_stage") -Recurse -Force
}
New-Item -ItemType Directory -Path $PortableStage -Force | Out-Null
Copy-Item -Path "$CompiledAppDir\*" -Destination $PortableStage -Recurse -Force

Set-Content -Path (Join-Path $PortableStage "register_host.bat") -Encoding ASCII -Value "@echo off`r`n`"%~dp0nfsu2_rpc_host.exe`" --register`r`n"
Set-Content -Path (Join-Path $PortableStage "unregister_host.bat") -Encoding ASCII -Value "@echo off`r`n`"%~dp0nfsu2_rpc_host.exe`" --unregister`r`n"

$PortableZip = Join-Path $ReleaseDir "NFSU2_Revived_RPC_Portable_v$Version.zip"
if (Test-Path $PortableZip) { Remove-Item -Path $PortableZip -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $BuildDir "portable_stage"), $PortableZip)
Write-Host "[OK] ポータブル版ZIPを作成しました: $PortableZip" -ForegroundColor Green

if ($SkipInstaller) {
    Write-Host "(-SkipInstaller 指定のため Setup.exe の作成をスキップしました)" -ForegroundColor Yellow
    exit 0
}

Write-Host "3/3 Building Windows Installer (Setup.exe via Inno Setup)..." -ForegroundColor Cyan
$IsccPath = Find-InnoSetupCompiler
if (!$IsccPath) {
    throw "Inno Setup 6 (ISCC.exe) が見つかりません。'winget install JRSoftware.InnoSetup' でインストールしてから再実行してください。"
}

$IssFile = Join-Path $CompanionDir "installer.iss"
& $IsccPath "/DMyAppVersion=$Version" $IssFile
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup によるインストーラー生成に失敗しました。"
}

$SetupExe = Join-Path $ReleaseDir "NFSU2_Revived_RPC_Setup_v$Version.exe"
Write-Host "[OK] インストーラーを作成しました: $SetupExe" -ForegroundColor Green
