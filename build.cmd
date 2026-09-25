@echo off
setlocal EnableExtensions
title Education Platform build

set "PAUSE_AT_END=0"
echo %CMDCMDLINE% | find /I "%~nx0" >nul && set "PAUSE_AT_END=1"

rem Works from the repo root or from web\
set "ROOT=%~dp0"
if exist "%ROOT%web\package.json" (
  cd /d "%ROOT%web"
) else if exist "%ROOT%package.json" (
  cd /d "%ROOT%"
) else (
  echo Could not find web\package.json next to this script.
  goto :fail
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install it, then run this file again.
  goto :fail
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm not found. Enabling it with Corepack...
  call corepack enable
  if errorlevel 1 goto :fail
  call corepack prepare pnpm@10.34.5 --activate
  if errorlevel 1 goto :fail
)

set "TARGET_ENV=%~1"
if not "%TARGET_ENV%"=="" (
  if /I not "%TARGET_ENV%"=="development" if /I not "%TARGET_ENV%"=="staging" if /I not "%TARGET_ENV%"=="production" (
    echo Usage: %~nx0 [development^|staging^|production]
    echo   No argument uses APP_ENV from .env / .env.local
    goto :fail
  )
  set "APP_ENV=%TARGET_ENV%"
)

echo.
echo == Installing dependencies ==
call pnpm install
if errorlevel 1 goto :fail

echo.
echo == Checking environment ==
if "%TARGET_ENV%"=="" (
  call pnpm env:check
) else (
  call pnpm exec tsx scripts/check-env.ts --env %TARGET_ENV%
)
if errorlevel 1 goto :fail

echo.
echo == Building Next.js app ==
call pnpm build
if errorlevel 1 goto :fail

echo.
echo Build finished.
echo Output is in web\.next
echo Start it with:
echo   cd /d "%CD%"
if /I "%APP_ENV%"=="staging" (
  echo   pnpm start:staging
) else if /I "%APP_ENV%"=="production" (
  echo   pnpm start:production
) else (
  echo   pnpm start
)
if "%PAUSE_AT_END%"=="1" pause
exit /b 0

:fail
echo.
echo Build failed.
if "%PAUSE_AT_END%"=="1" pause
exit /b 1
