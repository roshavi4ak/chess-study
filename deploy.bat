@echo off
echo 🚀 Chess Study Platform - Source Only Deployment
echo ==============================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found.
    pause
    exit /b 1
)

REM Clean up
echo 🧹 Cleaning previous build...
if exist deploy rmdir /s /q deploy

REM Build
echo 🏗️  Building the application...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed.
    pause
    exit /b 1
)

echo ✅ Build successful!

REM Fix nested standalone structure if exists (due to absolute path preservation)
if exist ".next\standalone\StudioProjects\chess-study" (
    echo 🔧 Fixing nested standalone structure...
    xcopy /e /y /q ".next\standalone\StudioProjects\chess-study\*" ".next\standalone\"
    rmdir /s /q ".next\standalone\StudioProjects"
)

REM Create package
echo 📦 Creating deployment package...
if exist deploy rmdir /s /q deploy
mkdir deploy
mkdir deploy\chess-study

REM --- STANDALONE FLATTENING STRATEGY ---
echo 📂 assembling standalone structure...

REM 1. Copy the standalone Build (Server logic)
xcopy /e /i /y .next\standalone deploy\chess-study

REM 2. Copy Static Assets (REQUIRED for standalone to serve CSS/JS)
REM    Must go to .next/static inside the deployment
mkdir deploy\chess-study\.next\static
xcopy /e /i /y .next\static deploy\chess-study\.next\static

REM 3. Copy Public Assets
xcopy /e /i /y public deploy\chess-study\public

REM 4. Copy Internationalization Messages (Fixes ENVIRONMENT_FALLBACK)
xcopy /e /i /y messages deploy\chess-study\messages

REM 5. Copy Prisma (For potential schema usage/updates)
xcopy /e /i /y prisma deploy\chess-study\prisma

REM 6. Copy Scripts & Configs
xcopy /e /i /y scripts deploy\chess-study\scripts

REM 7. Copy Original Package.json (Better for 'npm install' on host)
copy /y package.json deploy\chess-study\package.json
copy /y package-lock.json deploy\chess-study\package-lock.json

REM 8. Cleanup Windows-specific node_modules from the bundle
REM    (We want the server to run 'npm install' to get Linux binaries)
if exist deploy\chess-study\node_modules rmdir /s /q deploy\chess-study\node_modules

echo 🤐 Creating zip file...
cd deploy
powershell -command "Compress-Archive -Path chess-study\* -DestinationPath chess-study-source.zip"
cd ..

echo ✅ Package Created: deploy\chess-study-source.zip
echo 📊 Size: Optimized (Source + Static + Server)
echo.
echo 📋 FINAL REPAIR INSTRUCTIONS:
echo 1. In cPanel, STOP the Node.js App.
echo 2. Using File Manager, delete EVERYTHING in 'public_html'.
echo 3. Also delete the folder: '/home/andrey12/nodevenv/shah.belovezem.com'
echo 4. Upload 'deploy\chess-study-source.zip' to 'public_html' and Extract.
echo    (You should see 'server.js' directly in public_html now).
echo 5. Open Terminal, cd to public_html, and run: npm install
echo    (This installs Linux binaries for Prisma/Next).
echo 6. In cPanel 'Setup Node.js App':
echo    - Set 'Application startup file' to: server.js
echo    - Run 'npm run db:generate' if needed (usually handled by postinstall).
echo 7. Start the App.
echo.
pause
