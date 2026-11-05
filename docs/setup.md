# Setup and development

[English](setup.md) | [Español](setup.es.md) · [Back to Monitor UV](../README.md)

This guide covers the desktop application. It does not include Arduino firmware or wiring instructions.

## Prerequisites

- Node.js 22.12 or later compatible with the project's dependencies, and npm.
- MariaDB Server and an administrative account to create the schema and application account.
- USB/serial drivers for your board if you plan to connect the prototype.
- Native build tools if SerialPort has no compatible prebuilt binary. On Windows, a path without spaces can help if node-gyp reports a path-related failure.
- Arduino IDE only if you need to upload or modify firmware; firmware is not included here.

Clone and install from the repository root:

```bash
git clone https://github.com/AstronomicalDeveloper/monitor-uv.git
cd monitor-uv
npm ci
```

`npm ci` uses the lockfile and runs the Electron native-dependency setup. Use `npm.cmd` in PowerShell if script execution policy blocks `npm`.

## Configure MariaDB

### 1. Create the schema

From the repository root, open the MariaDB client with your administrative account. Replace `YOUR_ADMIN_USER` with that account's name; `-p` requests its password interactively.

```bash
mariadb -h 127.0.0.1 -u YOUR_ADMIN_USER -p
```

In the MariaDB client:

```sql
SOURCE src/main/database/schema.sql;
SHOW TABLE STATUS FROM monitor_uv;
```

The [schema](../src/main/database/schema.sql) creates `monitor_uv`, its session and measurement tables, and indexes. It does not create users or change passwords. Check that both tables use **InnoDB**. `CREATE TABLE IF NOT EXISTS` does not convert older tables from another engine; back up an existing database before considering a migration. The app does not import the schema automatically.

### 2. Use a dedicated account

Create an application account with a new password used only for this project. It needs **`SELECT`, `INSERT`, and `UPDATE` on `monitor_uv.*`**, not schema-management or user-administration privileges. Restrict the account's host to the computer or connection origin you actually use. Do not run the app with an administrator account.

Keep passwords out of shell command arguments, versioned SQL files, and shared terminal recordings. If a password has been exposed or reused, rotate it wherever it was used; switching to a new account does not revoke the old one.

### 3. Create the private JSON file

Use [database.example.json](../database.example.json) as the template. Set its `host`, numeric `port`, `user`, `password`, and `database` to your local connection details. The example's empty password is a placeholder, not a ready-to-use account.

Store the completed JSON **outside the repository and installation directory**, with operating-system permissions limited to the people who need it. This PowerShell example copies the template only if the destination does not exist:

```powershell
$privateDirectory = Join-Path $env:USERPROFILE 'monitor-uv-private'
New-Item -ItemType Directory -Path $privateDirectory -Force
$privateConfig = Join-Path $privateDirectory 'database.json'
if (-not (Test-Path -LiteralPath $privateConfig)) {
  Copy-Item database.example.json $privateConfig
}
```

Edit the copied JSON before running the app. Do not overwrite a working configuration with the template.

### 4. Set the configuration path

In the terminal that will launch the app:

```powershell
$env:MONITOR_UV_DB_CONFIG = "$env:USERPROFILE\monitor-uv-private\database.json"
npm.cmd run dev
```

On a POSIX shell, the equivalent is:

```bash
export MONITOR_UV_DB_CONFIG="/absolute/path/to/database.json"
npm run dev
```

Replace the example path with your own file's absolute path. `MONITOR_UV_DB_CONFIG` contains **the path, not the password**. On Windows, you can persist the current path for your user:

```powershell
[Environment]::SetEnvironmentVariable('MONITOR_UV_DB_CONFIG', $env:MONITOR_UV_DB_CONFIG, 'User')
```

Reopen the app or terminal after setting a persistent variable. Without the variable, the app reads `database.json` from Electron's `app.getPath('userData')`. On Windows this is under `%APPDATA%` in the app's folder; the folder name may vary between development and a packaged build.

A private file may also be named `database.local.json`, but the variable must point to it explicitly. That filename is not discovered automatically. `.env` files are not loaded automatically either.

Git ignores the expected private JSON filenames and the packager excludes them. Keep custom-named copies out of the project too. The file is not encrypted: a desktop app cannot hide connection credentials from someone who controls the computer. Configuration is read in Electron's main process and is not sent to the renderer.

## Connect the prototype

1. Make sure MariaDB is running and use the app's connection test.
2. Connect the Arduino and close any other application using its serial port, including the Arduino IDE serial monitor.
3. List ports, select the prototype's port, test it, and connect at **9600 baud**.
4. Create a manual or timed session and choose the storage interval. Use the history and reports pages to inspect saved readings.

### Serial format

This illustrative cycle matches the desktop receiver's expected labels; it is not a recorded measurement:

```text
UV ADC: 100 | Voltaje: 0.489 V
Nivel: BAJO
Luz: 120.0 lux
Temperatura: 25.0 C
Humedad: 60.0 %
Presion: 1013.0 hPa
Presencia: NO DETECTADA
Fecha y hora: 2026-11-04 12:00:00
```

The UV header starts a cycle and `Fecha y hora` ends it. Middle fields can arrive in a different order. The receiver discards incomplete or duplicate cycles, non-finite numbers, and cycles taking over ten seconds, rather than reusing readings from an earlier cycle. Confirm the contract with the actual firmware before changing the protocol. The RTC date remains text; the app does not impose a new RTC format.

## Development commands

Run from the repository root:

| Command                 | Purpose                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Start the development app.                                                                                                         |
| `npm run typecheck`     | Check main, preload, and renderer types.                                                                                           |
| `npm run lint`          | Run ESLint.                                                                                                                        |
| `npm test`              | Run focused tests with simulated services.                                                                                         |
| `npm run build`         | Type-check and compile main, preload, and renderer into `out/`.                                                                    |
| `npm start`             | Open the local build after compiling.                                                                                              |
| `npm run test:electron` | After building, check sandbox, preload, IPC origin validation, native SerialPort loading, and PDF generation using hidden windows. |
| `npm audit`             | Review dependency advisories.                                                                                                      |

The automated tests do not verify a real MariaDB server or open the prototype's port. If the environment sets `ELECTRON_RUN_AS_NODE`, unset it before launching Electron as an app. On PowerShell:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
```

## Builds and installers

```bash
npm run build:win
```

This builds a Windows installer in `dist/`. `npm run build:unpack` creates an unpacked distribution directory. macOS and Linux scripts are also declared, but need their own environment and validation.

To keep an existing distribution intact, choose a separate output directory and then inspect its package:

```bash
npm run build:win -- --publish never --config.directories.output=dist/local-build
npm run test:package -- dist/local-build/win-unpacked
```

Configure the private JSON separately on the destination computer. Publishing is disabled in the build configuration; there is no automatic-update service. The Windows installer is unsigned and macOS notarization is not configured. Package inspection does not replace installation, uninstallation, and hardware testing on the target system.

Do not distribute old packages that may contain an obsolete connection configuration. Review dependency advisories before sharing a new build.

## Project layout

```text
src/main/database/  Runtime configuration, queries, and MariaDB schema
src/main/serial/    Port management and serial parsing
src/main/ipc/       Operations and validation between processes
src/main/reports/   CSV and HTML/PDF generation
src/preload/        Specific functions exposed to React
src/renderer/      Interface, routing, capture, and visualization
tests/             Automated tests and package inspection
```
