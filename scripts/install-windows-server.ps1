param([string]$ProjectPath = (Split-Path -Parent $PSScriptRoot), [string]$TunnelConfig = "$env:USERPROFILE\.cloudflared\buzz-transfers.yml", [string]$BrowserPath = "$env:LOCALAPPDATA\ms-playwright")
$ErrorActionPreference = 'Stop'
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$admin = ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Run this installer in an Administrator PowerShell. Windows requires administrator rights to register a task that starts before sign-in.' }
$nodePath = (Get-Command node.exe).Source
$cloudflared = (Get-Command cloudflared.exe).Source
foreach ($required in @('.env', '.next\BUILD_ID', '.postgres\data\PG_VERSION', '.postgres\access-code-pepper', 'scripts\server-supervisor.mjs', 'scripts\backup-local-server.ps1')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath $required))) { throw "Required file missing: $required" }
}
if (-not (Test-Path -LiteralPath $TunnelConfig)) { throw 'Tunnel configuration missing.' }
$config = @{ cloudflared=$cloudflared; tunnelConfig=$TunnelConfig; browserPath=$BrowserPath }
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ProjectPath '.postgres\server-config.json') -Encoding UTF8
$action = New-ScheduledTaskAction -Execute $nodePath -Argument ('"' + (Join-Path $ProjectPath 'scripts\server-supervisor.mjs') + '"') -WorkingDirectory $ProjectPath
$trigger = New-ScheduledTaskTrigger -AtStartup
$recoveryTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'BUZZ Transfers Server' -Action $action -Trigger @($trigger, $recoveryTrigger) -Settings $settings -Principal $principal -Description 'Local BUZZ PostgreSQL, production website, notification worker and dedicated Cloudflare tunnel.' -Force | Out-Null
$backupAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $ProjectPath 'scripts\backup-local-server.ps1') + '"') -WorkingDirectory $ProjectPath
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '03:00'
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'BUZZ Transfers Backup' -Action $backupAction -Trigger $backupTrigger -Settings $backupSettings -Principal $principal -Description 'Consistent cold backup of BUZZ local database and deployment secrets; brief maintenance at 03:00.' -Force | Out-Null
$statusFile = Join-Path $ProjectPath 'output\server\status.json'
if (Test-Path -LiteralPath $statusFile) {
    $state = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
    if (Get-Process -Id $state.pid -ErrorAction SilentlyContinue) {
        New-Item -ItemType File -Path (Join-Path $ProjectPath '.postgres\server-stop') -Force | Out-Null
        for ($attempt=0; $attempt -lt 30; $attempt++) {
            if (-not (Get-Process -Id $state.pid -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Seconds 1
        }
        if (Get-Process -Id $state.pid -ErrorAction SilentlyContinue) { throw 'The previous supervisor did not stop; refusing to start a second instance.' }
    }
}
for ($attempt=0; $attempt -lt 30; $attempt++) {
    if ((Get-ScheduledTask -TaskName 'BUZZ Transfers Server').State -ne 'Running') { break }
    Start-Sleep -Milliseconds 500
}
Start-ScheduledTask -TaskName 'BUZZ Transfers Server'
for ($attempt=0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $state = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
        if ($state.webHealthy -and (Get-Process -Id $state.pid -ErrorAction SilentlyContinue)) { break }
    } catch { }
}
if (-not $state.webHealthy) { throw 'Startup task was installed but the website did not become healthy; inspect output\server logs.' }
Get-ScheduledTask -TaskName 'BUZZ Transfers*' | ForEach-Object {
    $taskInfo = $_ | Get-ScheduledTaskInfo
    @{ name=$_.TaskName; state=[string]$_.State; user=$_.Principal.UserId; triggerTypes=@($_.Triggers | ForEach-Object { $_.CimClass.CimClassName }); lastResult=$taskInfo.LastTaskResult; nextRun=[string]$taskInfo.NextRunTime }
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $ProjectPath 'output\server\windows-tasks.json') -Encoding UTF8
Write-Output 'Installed BUZZ Transfers Server (startup before sign-in) and BUZZ Transfers Backup (03:00 daily).'
