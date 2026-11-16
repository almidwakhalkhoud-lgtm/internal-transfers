# BUZZ Windows production server

The current deployment is **D:\ChatGPT\internal-transfers**, running the newer
application revision `d1b776e`. The OneDrive checkout is an older source copy;
do not deploy it over the live directory or replace the live `.env` or `.postgres`.

- Public HTTPS address: https://transfers.mehdiali.om
- Production web listener: `127.0.0.1:3100`
- Existing PostgreSQL cluster: `.postgres/data`, port `54329`, database `buzz_live`
- Named Cloudflare tunnel: `buzz-transfers`, using the existing private files in
  `C:\Users\User\.cloudflared`. Other installed tunnels/services are independent.

`scripts/server-supervisor.mjs` starts the existing database, production Next.js
server, notification worker and dedicated tunnel. It restarts failed components,
checks database connectivity and the local login page, and recycles the web
process after repeated failed health checks. It refuses to create a new database.
Local logs and heartbeat are in `output/server/`; component logs rotate at 10 MB.
Private machine configuration is in ignored `.postgres/server-config.json`.

## Install automatic startup

Run this once in **Administrator PowerShell**, with the existing deployment and
Chromium already installed:

```powershell
& 'D:\ChatGPT\internal-transfers\scripts\install-windows-server.ps1'
```

It registers `BUZZ Transfers Server` as a SYSTEM scheduled task at Windows startup,
before anyone signs in, with a one-minute recovery trigger, and a daily
`BUZZ Transfers Backup` task at 03:00 in the
Windows timezone. No Windows password is stored. The installer gracefully stops
the previous BUZZ supervisor before handing over. It does not replace the existing
Cloudflared Windows service used by another application.

To start or inspect it from Administrator PowerShell:

```powershell
Start-ScheduledTask -TaskName 'BUZZ Transfers Server'
Get-ScheduledTask -TaskName 'BUZZ Transfers*'
Get-Content 'D:\ChatGPT\internal-transfers\output\server\status.json'
```

For a deliberate maintenance stop, disable the startup task first and request a
graceful supervisor stop. PostgreSQL remains running until explicitly stopped:

```powershell
Disable-ScheduledTask -TaskName 'BUZZ Transfers Server'
New-Item 'D:\ChatGPT\internal-transfers\.postgres\server-stop' -ItemType File -Force
```

After maintenance, enable the task and start it again. Do not run `next dev`,
another notification worker, or a second server on the production port.

## Backups

Backups are saved outside the project to `D:\Backups\BUZZ\<timestamp>` with
restricted permissions. A backup briefly pauses the website, worker and tunnel,
waits for PostgreSQL to stop cleanly, copies the entire cluster and deployment
secrets, verifies every database file with SHA-256, and resumes the server.
It includes `.env`, the access-code pepper, local database password, tunnel
configuration and tunnel credentials. Keep the entire backup private.

```powershell
& 'D:\ChatGPT\internal-transfers\scripts\backup-local-server.ps1'
```

A backup is complete only when `manifest.json` and `checksums.json` exist.
Incomplete directories are retained for investigation. Backups are not deleted
automatically. These are physical PostgreSQL backups: restore with the same
PostgreSQL major version while all BUZZ processes and PostgreSQL are stopped.
Preserve the current cluster separately before replacing anything, restore the
matching secrets, then start and check users, documents and PDFs. Never merge
data-directory files or copy a live PostgreSQL data directory.

The backup is on the same computer; keep an additional private copy on another
disk or backup destination for disk-failure recovery. The host must remain on,
awake and connected to the internet for the public site to be reachable.

## Updating the application

Back up first, stop the supervisor for maintenance, apply reviewed code to the
live checkout, install locked dependencies when changed, run `npm run db:deploy`,
`npm run build`, and restart the startup task. Preserve `.env`, `.postgres`, the
VAPID keys and the access-code pepper. Keep `APP_ORIGIN` and `VAPID_SUBJECT` set
to `https://transfers.mehdiali.om`. Test HTTPS, authenticated data and PDF delivery
after an update. A new hostname requires the devices to grant notification
permission again; existing HTTPS-origin cookies do not move between domains.
