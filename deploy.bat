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

REM Create package
echo 📦 Creating deployment package...
mkdir deploy
mkdir deploy\chess-study

REM Copy FILES ONLY (No node_modules)
echo 📂 Copying source files...

REM .next folder (App Logic)
xcopy /e /i /y .next deploy\chess-study\.next

REM Public assets
xcopy /e /i /y public deploy\chess-study\public

REM Config & Scripts
copy package.json deploy\chess-study\
copy package-lock.json deploy\chess-study\
copy server.js deploy\chess-study\
copy .htaccess deploy\chess-study\
xcopy /e /i /y messages deploy\chess-study\messages
xcopy /e /i /y prisma deploy\chess-study\prisma
mkdir deploy\chess-study\src\i18n
copy src\i18n\request.ts deploy\chess-study\src\i18n\

REM Cleanup Env
if exist deploy\chess-study\.env del /f deploy\chess-study\.env
if exist deploy\chess-study\.env.local del /f deploy\chess-study\.env.local
if exist deploy\chess-study\.env.production del /f deploy\chess-study\.env.production

REM Zip
echo 🤐 Creating zip file...
cd deploy
powershell -command "Compress-Archive -Path chess-study\* -DestinationPath chess-study-source.zip"
cd ..

echo ✅ Package Created: deploy\chess-study-source.zip
echo 📊 Size: ~20MB (Source code only)
echo.
echo 📋 FINAL REPAIR INSTRUCTIONS:
echo 1. In cPanel, STOP the Node.js App.
echo 2. Using File Manager, delete EVERYTHING in 'public_html'.
echo 3. Also delete the folder: '/home/andrey12/nodevenv/shah.belovezem.com' (This fixes the npm error!)
echo 4. Upload 'deploy\chess-study-source.zip' to 'public_html' and Extract.
echo 5. Open Terminal, cd to public_html, and run: npm install
echo 6. Start the App.
echo.
pause
