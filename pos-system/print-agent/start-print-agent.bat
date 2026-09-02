@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules\express (
  echo Print helper is not installed yet.
  echo Run install-print-helper.bat first.
  pause
  exit /b 1
)
if not defined PRINTER_INTERFACE set "PRINTER_INTERFACE=printer:POS-58"
echo Starting Tiger Car Wash print helper...
echo Printer: %PRINTER_INTERFACE%
echo Keep this window open while using the POS.
echo.
call npm start
pause
