@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "MOBILE_DIR=%ROOT_DIR%mobile"
set "ANDROID_DIR=%ROOT_DIR%mobile\android"
set "NATIVE_MODULES_GRADLE=%MOBILE_DIR%\node_modules\@react-native-community\cli-platform-android\native_modules.gradle"
set "NODE_MODULES_DIR=%MOBILE_DIR%\node_modules"
set "LOCKFILE=%MOBILE_DIR%\package-lock.json"

if not exist "%NODE_MODULES_DIR%" (
	echo [INFO] Missing node_modules. Installing dependencies...
	cd /d "%MOBILE_DIR%"
	if errorlevel 1 (
		echo [ERROR] Could not open mobile directory.
		exit /b 1
	)
	if exist "%LOCKFILE%" (
		call npm ci
	) else (
		call npm install
	)
	if errorlevel 1 (
		echo [ERROR] Dependency install failed.
		exit /b 1
	)
)

if not exist "%NATIVE_MODULES_GRADLE%" (
	echo [ERROR] React Native Android gradle script not found after dependency install.
	echo [ERROR] Try deleting node_modules and running npm install in mobile.
	exit /b 1
)

cd /d "%ANDROID_DIR%"
if errorlevel 1 (
	echo [ERROR] Could not open Android directory.
	exit /b 1
)

echo Generating Debug and Release APKs...
call gradlew.bat clean assembleDebug assembleRelease
if errorlevel 1 goto :build_failed

echo.
echo ========================
echo Build complete!
echo APKs saved to C:\Apk-release
echo ========================
pause
exit /b 0

:build_failed
echo.
echo [ERROR] Build failed.
pause
exit /b 1