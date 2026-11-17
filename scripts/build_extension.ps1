<#
.SYNOPSIS
  Firefox拡張機能（extension/）を Mozilla AMO 提出・頒布用 ZIP にパッケージ化します。
#>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExtDir = Join-Path $RepoRoot "extension"
$ReleaseDir = Join-Path $RepoRoot "release"
$ManifestFile = Join-Path $ExtDir "manifest.json"

if (!(Test-Path $ManifestFile)) {
    throw "extension/manifest.json が見つかりません。"
}

$Manifest = Get-Content -Path $ManifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = $Manifest.version
if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "manifest.json に version が設定されていません。"
}

New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
$ZipName = "nfsu2-revived-rpc-extension-v$Version.zip"
$ZipPath = Join-Path $ReleaseDir $ZipName

if (Test-Path $ZipPath) {
    Remove-Item -Path $ZipPath -Force
}

Write-Host "Building Firefox Extension package: $ZipName ..." -ForegroundColor Cyan

$ZipStream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::CreateNew)
try {
    $Archive = New-Object System.IO.Compression.ZipArchive($ZipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        $Files = Get-ChildItem -Path $ExtDir -Recurse -File | Where-Object {
            $_.Extension -ne ".zip" -and $_.Extension -ne ".xpi" -and $_.Name -notlike ".*"
        }
        foreach ($File in $Files) {
            # AMO仕様に準拠するためエントリパス区切りを常にスラッシュ(/)に統一しルート直下へ配置
            $RelPath = $File.FullName.Substring($ExtDir.Length).TrimStart('\', '/').Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $Archive,
                $File.FullName,
                $RelPath,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
            Write-Host "  + $RelPath"
        }
    }
    finally {
        $Archive.Dispose()
    }
}
finally {
    $ZipStream.Dispose()
}

Write-Host "[OK] 拡張機能パッケージを作成しました: $ZipPath" -ForegroundColor Green
