param([string]$ProjectPath = (Split-Path -Parent $PSScriptRoot), [string]$BackupRoot = 'D:\Backups\BUZZ')
$ErrorActionPreference = 'Stop'
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$pgData = Join-Path $ProjectPath '.postgres\data'
$pgCtl = Join-Path $ProjectPath 'node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
$maintenance = Join-Path $ProjectPath '.postgres\server-maintenance.json'
$statusFile = Join-Path $ProjectPath 'output\server\status.json'
$backupLock = Join-Path $ProjectPath '.postgres\backup.lock'
# This is a cold physical backup: PostgreSQL is stopped only after the web and
# worker have acknowledged maintenance. Never copy the live data directory.
New-Item -ItemType Directory -Path $backupLock -ErrorAction Stop | Out-Null
$destination = Join-Path ([IO.Path]::GetFullPath($BackupRoot)) (Get-Date -Format 'yyyyMMdd-HHmmss')
if ($destination.StartsWith($ProjectPath + '\', [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $backupLock; throw 'Backups must be outside the application directory.' }
$paused = $false
try {
    $requested = [DateTime]::UtcNow
    @{ pid=$PID; requestedAt=$requested.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $maintenance -Encoding UTF8
    $ready = $false
    for ($attempt=0; $attempt -lt 45; $attempt++) {
        if (Test-Path -LiteralPath $statusFile) {
            try {
                $state = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
                if ($state.maintenance -and ([DateTime]$state.checkedAt).ToUniversalTime() -ge $requested) { $ready=$true; break }
            } catch { }
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Supervisor did not acknowledge maintenance; database was not stopped or copied.' }
    & $pgCtl stop -D $pgData -m fast -w -t 30
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not stop cleanly; no backup copied.' }
    $paused = $true
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    $account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $destination '/inheritance:r' '/grant:r' "${account}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to backup directory.' }
    Copy-Item -LiteralPath $pgData -Destination (Join-Path $destination 'data') -Recurse
    Copy-Item -LiteralPath (Join-Path $ProjectPath '.env') -Destination (Join-Path $destination '.env')
    foreach ($name in @('access-code-pepper', 'local-secret', 'server-config.json')) {
        Copy-Item -LiteralPath (Join-Path $ProjectPath ".postgres\$name") -Destination (Join-Path $destination $name)
    }
    $serverConfig = Get-Content -LiteralPath (Join-Path $ProjectPath '.postgres\server-config.json') -Raw | ConvertFrom-Json
    $tunnelDirectory = Join-Path $destination 'cloudflared'
    New-Item -ItemType Directory -Path $tunnelDirectory | Out-Null
    Copy-Item -LiteralPath $serverConfig.tunnelConfig -Destination (Join-Path $tunnelDirectory 'buzz-transfers.yml')
    $credentialsLine = Get-Content -LiteralPath $serverConfig.tunnelConfig | Where-Object { $_ -match '^credentials-file:\s*(.+)$' }
    if (-not $credentialsLine -or $credentialsLine -notmatch '^credentials-file:\s*(.+)$') { throw 'Tunnel credentials path not found; backup incomplete.' }
    $credentialsPath = $Matches[1].Trim().Trim('"').Trim("'")
    Copy-Item -LiteralPath $credentialsPath -Destination $tunnelDirectory
    $sourceFiles = @(Get-ChildItem -LiteralPath $pgData -File -Recurse)
    $copiedFiles = @(Get-ChildItem -LiteralPath (Join-Path $destination 'data') -File -Recurse)
    if ($sourceFiles.Count -ne $copiedFiles.Count -or ($sourceFiles | Measure-Object Length -Sum).Sum -ne ($copiedFiles | Measure-Object Length -Sum).Sum) { throw 'Backup file validation failed.' }
    $checksums = @{}
    foreach ($sourceFile in $sourceFiles) {
        $relative = $sourceFile.FullName.Substring($pgData.Length + 1)
        $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath (Join-Path (Join-Path $destination 'data') $relative) -Algorithm SHA256).Hash
        if ($sourceHash -ne $targetHash) { throw "Backup checksum mismatch: $relative" }
        $checksums[$relative] = $sourceHash
    }
    $checksums | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'checksums.json') -Encoding UTF8
    @{ completedAt=[DateTime]::UtcNow.ToString('o'); source=$ProjectPath; postgresMajor=(Get-Content -LiteralPath (Join-Path $pgData 'PG_VERSION') -Raw).Trim(); files=$copiedFiles.Count; bytes=($copiedFiles | Measure-Object Length -Sum).Sum; method='clean PostgreSQL shutdown and full data-directory copy'; secrets='env, access-code-pepper and local-secret included; keep private' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
    Write-Output "Backup verified: $destination"
} finally {
    # PostgreSQL is started again by the supervisor, not here: started from
    # an interactive window it stays tied to that console, and closing the
    # window or pressing Ctrl+C later kills the live database (0xC000013A).
    # The supervisor runs as SYSTEM without a console and starts the cluster
    # as soon as maintenance ends.
    if (Test-Path -LiteralPath $maintenance) { Remove-Item -LiteralPath $maintenance }
    Remove-Item -LiteralPath $backupLock
    if ($paused) {
        $resumed = $false
        for ($attempt=0; $attempt -lt 90 -and -not $resumed; $attempt++) {
            Start-Sleep -Seconds 1
            try {
                $state = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
                $resumed = -not $state.maintenance -and $state.database -and $state.webHealthy
            } catch { }
        }
        if (-not $resumed) { Write-Warning 'The supervisor has not reported the database and website healthy yet; check output\server\status.json.' }
    }
}
