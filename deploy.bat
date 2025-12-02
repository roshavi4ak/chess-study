@echo off
echo 🚀 Chess Study Platform - Deployment Script
echo ===========================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root.
    pause
    exit /b 1
)

REM Clean up any previous build
echo 🧹 Cleaning previous build...
if exist deploy rmdir /s /q deploy

REM Build the application
echo 🏗️  Building the application...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed. Please fix the errors and try again.
    pause
    exit /b 1
)

echo ✅ Build successful!

REM Create deployment package
echo 📦 Creating deployment package...
mkdir deploy
mkdir deploy\chess-study

REM Copy necessary files for Standalone Mode
echo Copying files...

REM 1. Copy the standalone build (contains server.js and node_modules)
xcopy /e /i /y .next\standalone\StudioProjects\chess-study deploy\chess-study

REM 2. Copy static assets (required for standalone)
mkdir deploy\chess-study\.next\static
xcopy /e /i /y .next\static deploy\chess-study\.next\static

REM 3. Copy public assets
xcopy /e /i /y public deploy\chess-study\public

REM 4. Copy messages (if not already bundled, safe to include)
xcopy /e /i /y messages deploy\chess-study\messages

REM 5. Copy Prisma schema/migrations (if needed for runtime)
xcopy /e /i /y prisma deploy\chess-study\prisma

REM 6. Copy i18n request (if not bundled)
mkdir deploy\chess-study\src\i18n
copy src\i18n\request.ts deploy\chess-study\src\i18n\

REM 7. Copy package-lock.json (for reference, though standalone has its own package.json)
copy package-lock.json deploy\chess-study\

REM 8. Copy .htaccess (Passenger configuration)
copy .htaccess deploy\chess-study\

REM 8. Remove any .env files to prevent localhost values from overriding production
echo Removing .env files from deployment package...
if exist deploy\chess-study\.env del /f deploy\chess-study\.env
if exist deploy\chess-study\.env.local del /f deploy\chess-study\.env.local
if exist deploy\chess-study\.env.production del /f deploy\chess-study\.env.production

REM Create a zip file
echo Creating zip file...
cd deploy
powershell -command "Compress-Archive -Path chess-study\* -DestinationPath chess-study-deploy.zip"
cd ..

echo ✅ Deployment package created: deploy\chess-study-deploy.zip
echo.
echo 📋 Next steps:
echo 1. Upload 'deploy\chess-study-deploy.zip' to your cPanel
echo 2. Extract it to: /home/andrey12/shah.belovezem.com/public_html
echo 3. Restart the Node.js application in cPanel
echo 4. Ensure Environment Variables are set correctly in cPanel:
echo    - NEXTAUTH_URL=https://shah.belovezem.com
echo    - NEXTAUTH_SECRET=(your secret)
echo    - DATABASE_URL=(your database connection string)
echo    - LICHESS_CLIENT_ID=chess-study-app
echo.
pause
