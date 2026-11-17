<#
.SYNOPSIS
  Firefox拡張機能パッケージ(.zip) と PC連携インストーラー(Setup.exe / Portable.zip) を一括ビルドします。
#>
$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "build_extension.ps1")
Write-Host ""
& (Join-Path $PSScriptRoot "build_companion.ps1")

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 全パッケージのビルドが完了しました！" -ForegroundColor Green
Write-Host " 出力先: $(Join-Path (Split-Path -Parent $PSScriptRoot) 'release')" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
