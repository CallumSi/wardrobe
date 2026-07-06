@echo off
rem Starts the wardrobe app using the portable Node 22 install
rem (system Node 18.15 is too old for Next.js 15).
cd /d "%~dp0"
echo Starting wardrobe app at http://localhost:3000 ...
"%USERPROFILE%\.node\node-v22.14.0-win-x64\node.exe" node_modules\next\dist\bin\next dev
pause
