$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectRoot
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw 'Node 24 is required.' }
$dependencies = Join-Path $projectRoot '.runtime/dependencies'
$pgBinary = Join-Path $dependencies 'pgsql/bin/postgres.exe'
if (-not $env:AW_DATABASE_URL -and -not $env:AW_PG_BIN -and -not (Test-Path -LiteralPath $pgBinary)) {
    New-Item -ItemType Directory -Force -Path $dependencies | Out-Null
    $archive = Join-Path $dependencies 'postgresql-18.6-windows.zip'
    $source = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260566'
    Write-Host 'Downloading PostgreSQL 18.6 from EDB...'
    Invoke-WebRequest -Uri $source -OutFile $archive
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -notmatch '^pgsql/(bin/|lib/|share/|server_license\.txt$|commandlinetools_3rd_party_licenses\.txt$)') { continue }
            if ($entry.FullName.EndsWith('/')) { continue }
            $target = [System.IO.Path]::GetFullPath((Join-Path $dependencies $entry.FullName))
            if (-not $target.StartsWith($dependencies + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes dependency directory.' }
            New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    } finally { $zip.Dispose() }
    $pgVersion = & $pgBinary --version
    if ($LASTEXITCODE -ne 0 -or $pgVersion -notmatch '18\.6') { throw 'PostgreSQL version verification failed.' }
    @{ source = $source; version = $pgVersion; sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dependencies 'postgresql-source.json') -Encoding UTF8
    Remove-Item -LiteralPath $archive
}
# Browser service does not need Electron's desktop executable.
$priorSkip = $env:ELECTRON_SKIP_BINARY_DOWNLOAD
try {
    $env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
} finally { $env:ELECTRON_SKIP_BINARY_DOWNLOAD = $priorSkip }
& node --import tsx tools/validate-content.ts
if ($LASTEXITCODE -ne 0) { throw 'Game assets are missing or invalid; restore or rebuild them before starting.' }
& node tools/local-service.mjs install
if ($LASTEXITCODE -ne 0) { throw 'Service installation failed.' }
