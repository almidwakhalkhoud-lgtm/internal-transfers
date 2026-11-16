# Rebuilds the live BUZZ server: backs up, stops the supervisor (web, worker,
# tunnel), applies pending database migrations, runs npm run build, then
# starts the startup task again even if a step failed, so the site is never
# left down. PostgreSQL keeps running throughout. Run in Administrator
# PowerShell.
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$task = 'BUZZ Transfers Server'
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Run this in an Administrator PowerShell.' }
Set-Location $app
$statusFile = Join-Path $app 'output\server\status.json'

# A migration changes the live database, so a verified backup comes first.
Write-Output 'Backing up...'
& (Join-Path $PSScriptRoot 'backup-local-server.ps1')
for ($i = 0; $i -lt 60; $i++) {
    try { if ((Get-Content $statusFile -Raw | ConvertFrom-Json).webHealthy) { break } } catch { }
    Start-Sleep 1
}
$supervisor = (Get-Content $statusFile -Raw | ConvertFrom-Json).pid

Write-Output 'Stopping the BUZZ server...'
Disable-ScheduledTask -TaskName $task | Out-Null
$built = $false
try {
    New-Item (Join-Path $app '.postgres\server-stop') -ItemType File -Force | Out-Null
    for ($i = 0; $i -lt 60 -and (Get-Process -Id $supervisor -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }
    if (Get-Process -Id $supervisor -ErrorAction SilentlyContinue) { throw 'The supervisor did not stop within 60 seconds; nothing was built.' }
    Start-Sleep 2
    Remove-Item (Join-Path $app 'node_modules\.prisma\client\*.tmp*') -ErrorAction SilentlyContinue
    # Engine files moved aside while the server held them; free now.
    Remove-Item (Join-Path $app 'node_modules\.prisma\client\*.inuse-*') -ErrorAction SilentlyContinue
    Write-Output 'Applying database migrations...'
    npm run db:deploy
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed; the previous build is kept. Check the output above.' }
    Write-Output 'Building...'
    npm run build
    $built = $LASTEXITCODE -eq 0
    if (-not $built) { Write-Warning 'Build failed. Starting the server again; check the output above.' }
} finally {
    Remove-Item (Join-Path $app '.postgres\server-stop') -ErrorAction SilentlyContinue
    Enable-ScheduledTask -TaskName $task | Out-Null
    Start-ScheduledTask -TaskName $task
    Write-Output 'Server starting...'
    $healthy = $false
    for ($i = 0; $i -lt 60 -and -not $healthy; $i++) {
        Start-Sleep 1
        try {
            $state = Get-Content $statusFile -Raw | ConvertFrom-Json
            $healthy = $state.pid -ne $supervisor -and $state.webHealthy -and [bool](Get-Process -Id $state.pid -ErrorAction SilentlyContinue)
        } catch { }
    }
    if ($healthy) { Write-Output "Server is healthy. Build succeeded: $built" }
    else { Write-Warning 'Server has not reported healthy yet; check output\server\status.json and the logs in output\server.' }
}
