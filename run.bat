@echo off
:: Set command window title
title OmniQA System Launcher

echo =================================================================
echo   🚀 OMNIQA - AUTOMATIC QUESTION ANSWERING SYSTEM LAUNCHER
echo =================================================================
echo.

:: Ensure directory context is set to script directory
cd /d "%~dp0"

:: Step 1: Validate Node.js Installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js executable could not be detected.
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Step 2: Ensure Environment Configurations
if not exist .env (
    echo [INFO] .env file not found. Copying from template...
    copy .env.example .env >nul
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create .env file.
        pause
        exit /b 1
    )
    echo [SUCCESS] .env template file created successfully.
)

:: Step 3: Check for default OpenRouter API key placeholder
findstr /C:"your_openrouter_api_key_here" .env >nul
if %errorlevel% equ 0 (
    echo.
    echo =================================================================
    echo ⚠️  WARNING: API KEY MISSING
    echo =================================================================
    echo It looks like you haven't configured your OpenRouter API key.
    echo Please open the newly created '.env' file in this folder and
    echo replace 'your_openrouter_api_key_here' with your real API key.
    echo =================================================================
    echo.
)

:: Step 4: Install Dependencies if missing
if not exist node_modules (
    echo [INFO] node_modules folder is missing. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install execution failed. Please verify your internet connection.
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed successfully.
)

:: Step 5: Start user browser session
echo [INFO] Opening default web browser to http://localhost:3000...
start http://localhost:3000

:: Step 6: Start Node.js server
echo [INFO] Starting Node Express server...
echo.
node server.js

:: If node process terminates unexpectedly
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The server terminated with an error code.
    pause
)
