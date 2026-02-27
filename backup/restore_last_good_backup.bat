@echo off
setlocal enabledelayedexpansion

REM One-click restore to previous known-good OpenClaw config backup
set "OPENCLAW_DIR=%USERPROFILE%\.openclaw"
set "CONFIG=%OPENCLAW_DIR%\openclaw.json"

if not exist "%OPENCLAW_DIR%" (
  echo [ERROR] OpenClaw folder not found: %OPENCLAW_DIR%
  pause
  exit /b 1
)

REM Find backup files sorted by newest first
for /f "delims=" %%F in ('dir /b /o-d "%OPENCLAW_DIR%\openclaw.json.backup-*" 2^>nul') do (
  if not defined newest (
    set "newest=%%F"
  ) else if not defined previous (
    set "previous=%%F"
  )
)

if defined previous (
  set "TARGET=%OPENCLAW_DIR%\!previous!"
) else if defined newest (
  set "TARGET=%OPENCLAW_DIR%\!newest!"
) else (
  echo [ERROR] No backup file found: %OPENCLAW_DIR%\openclaw.json.backup-*
  pause
  exit /b 1
)

echo Restoring from: !TARGET!
copy /y "!TARGET!" "%CONFIG%" >nul
if errorlevel 1 (
  echo [ERROR] Restore failed.
  pause
  exit /b 1
)

echo Restarting OpenClaw gateway...
openclaw gateway restart || openclaw gateway start

echo [OK] Restore completed.
pause
