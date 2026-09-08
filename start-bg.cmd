@echo off
cd /d d:\infinite-canvas
rmdir /s /q node_modules
pnpm install > pnpm-install.log 2>&1
if errorlevel 1 goto :failed
node node_modules/vite/bin/vite.js > vite-dev.log 2>&1
goto :eof
:failed
echo pnpm install FAILED >> pnpm-install.log
