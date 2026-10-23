$ErrorActionPreference = 'Stop'
$toolkitRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $toolkitRoot 'package.json') -Raw | ConvertFrom-Json
if ($package.version -notmatch '^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$') { throw 'Unsafe package version' }
$outputDir = Join-Path $toolkitRoot 'dist'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$stage = Join-Path $outputDir ('stage-' + [guid]::NewGuid().ToString())
$archive = Join-Path $outputDir ("figma-delta-$($package.version).zip")
if (Test-Path -LiteralPath $archive) { throw "Archive already exists: $archive. Move it aside before rebuilding." }
$payload = Join-Path $stage 'figma-toolkit'
New-Item -ItemType Directory -Path $payload -Force | Out-Null
try {
    # Explicit allowlist: never copy the checkout, local projects or installed dependencies wholesale.
    $entries = @('src', 'templates', 'scripts', 'examples', 'test',
        'docs/configuration.md', 'docs/per-run-comparisons.md', 'docs/prepared-pages.md', 'docs/figma-reference.md', 'docs/findings-format.md', 'docs/distribution.md',
        'package.json', 'package-lock.json', '.npmrc', '.nvmrc', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE', 'START-HERE-WINDOWS.md',
        'START-HERE-MAC.md', 'VALIDATION.md', 'CURSOR-BENCHMARK.md', '.gitignore')
    foreach ($entry in $entries) {
        $source = Join-Path $toolkitRoot $entry
        $items = @(Get-Item -LiteralPath $source) + @(Get-ChildItem -LiteralPath $source -Recurse -Force)
        if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
            throw "Release input contains a link: $entry"
        }
        $destination = Join-Path $payload $entry
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Recurse
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Add-Type -AssemblyName System.IO.Compression
    $zip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $stage -Recurse -File -Force | Sort-Object FullName) {
            $entryName = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName) | Out-Null
        }
    } finally { $zip.Dispose() }
    $sha256 = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($archive)
    try { $hash = [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha256.Dispose() }
    "$hash  $([IO.Path]::GetFileName($archive))" | Set-Content -LiteralPath ($archive + '.sha256') -Encoding ascii
    Write-Output "Archive: $archive"
    Write-Output "Checksum: $archive.sha256"
} finally {
    # Verify the absolute cleanup target is the unique staging child of this release directory.
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    $resolvedOutput = [IO.Path]::GetFullPath($outputDir)
    if ([IO.Path]::GetDirectoryName($resolvedStage) -ne $resolvedOutput -or
        [IO.Path]::GetFileName($resolvedStage) -notmatch '^stage-[0-9a-f-]{36}$') {
        throw 'Refusing cleanup outside the release staging directory'
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
