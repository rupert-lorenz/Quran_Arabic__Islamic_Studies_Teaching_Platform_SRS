@echo off
setlocal EnableExtensions
cd /d "%~dp0web"
if not exist package.json (
  echo Could not find web\package.json.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required.
  pause
  exit /b 1
)
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm is required.
  pause
  exit /b 1
)

echo Stopping any previous build or server for this app...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'Name = ''node.exe''' | Where-Object { $_.CommandLine -match 'Education Platform\\web' -and ($_.CommandLine -match 'next' -or $_.CommandLine -match 'pool_entry') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do call :stopnode %%P
if exist .next\lock del /f /q .next\lock >nul 2>&1

call pnpm install
if errorlevel 1 goto fail

echo Building. The site opens when the server is ready.
node node_modules\next\dist\bin\next build > "%TEMP%\education-platform-build.log" 2>&1
if errorlevel 1 goto fail

start "" /MIN powershell -NoProfile -Command "$deadline=(Get-Date).AddMinutes(3); while((Get-Date) -lt $deadline){ foreach($url in @('http://127.0.0.1:3000/','http://163.245.201.77:3000/')){ try { $r=Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 5; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 400){ Start-Process 'http://163.245.201.77:3000/'; exit 0 } } catch {} }; Start-Sleep -Seconds 2 }"

echo http://163.245.201.77:3000/
node node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000
exit /b %errorlevel%

:stopnode
tasklist /FI "PID eq %~1" /NH | findstr /I "node.exe" >nul
if errorlevel 1 exit /b 0
taskkill /F /PID %~1 >nul 2>&1
exit /b 0

:fail
echo.
echo Build failed. The site was not started.
echo Details are in %TEMP%\education-platform-build.log
if exist "%TEMP%\education-platform-build.log" type "%TEMP%\education-platform-build.log"
pause
exit /b 1
