@echo off
setlocal
chcp 65001 >nul
title Dayu Manager Publisher
cd /d "%~dp0"

set "TOKEN_URL=https://github.com/settings/tokens/new?scopes=repo&description=Dayu-Manager-Publisher"

if /I "%~1"=="-DryRun" goto run
if not exist "%USERPROFILE%\.dsh-dayu-manager.cred" (
  echo ============================================================
  echo   First publish: create a GitHub classic token with repo scope.
  echo   The browser page will open now.
  echo   Copy the token, come back here, and paste it at the prompt.
  echo ============================================================
  echo.
  start "" "%TOKEN_URL%"
  echo.
)

:run
powershell -NoProfile -ExecutionPolicy Bypass -NoLogo -File "%~dp0publish-now.ps1" %*
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo Publish failed with exit code %EXITCODE%.
) else (
  echo Publish finished.
)
if /I "%~1"=="-DryRun" exit /b %EXITCODE%
pause
exit /b %EXITCODE%