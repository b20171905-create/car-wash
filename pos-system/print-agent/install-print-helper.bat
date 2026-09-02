@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo   Tiger Car Wash - Printer Helper Setup
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found.
  echo Install the LTS version from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)

if not exist "%~dp0package.json" (
  echo The complete print-agent folder is required.
  echo Keep this file beside agent.js, package.json, and package-lock.json.
  echo Do not copy this BAT file by itself.
  pause
  exit /b 1
)

if not exist "%~dp0agent.js" (
  echo agent.js was not found beside this installer.
  pause
  exit /b 1
)

set /p PRINTER_NAME=Enter the exact Windows printer name (default: POS-58): 
if "%PRINTER_NAME%"=="" set "PRINTER_NAME=POS-58"
>printer-config.bat echo @echo off
>>printer-config.bat echo set "PRINTER_INTERFACE=printer:%PRINTER_NAME%"
>>printer-config.bat echo call "%%~dp0start-print-agent.bat"

call npm install --omit=dev
if errorlevel 1 (
  echo.
  echo Installation failed. Check your internet connection and try again.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
>"%STARTUP%\Tiger Car Wash Print Helper.bat" echo @echo off
>>"%STARTUP%\Tiger Car Wash Print Helper.bat" echo call "%~dp0printer-config.bat"

echo.
echo Setup complete.
echo The print helper will start automatically when Windows starts.
echo Starting it now...
call printer-config.bat
