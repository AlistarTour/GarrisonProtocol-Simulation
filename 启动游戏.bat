@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先从 https://nodejs.org/ 安装 Node.js 22 或更新版本。
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络连接。
    pause
    exit /b 1
  )
)
echo.
echo 卫戍协议：盟约 — APK 高保真复刻
if not defined PORT set PORT=3001
echo 打开浏览器访问 http://localhost:%PORT%
echo 如果端口已占用，请修改 PORT 后重试。
echo 此窗口为游戏服务器，关闭后房间将停止。
echo.
node server\index.js
if errorlevel 1 pause
