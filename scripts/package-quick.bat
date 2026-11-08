@echo off
rem Double-click entry point for quick packaging.
rem chcp 65001 keeps the node script's Chinese output readable.
chcp 65001 >nul
cd /d "%~dp0.."
node scripts\quick-package.js
pause
