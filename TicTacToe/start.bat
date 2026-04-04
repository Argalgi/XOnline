@echo off
echo Starting Tic Tac Toe Online Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"
if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
npm start