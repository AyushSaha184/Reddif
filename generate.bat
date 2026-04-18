@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "ANDROID_DIR=%ROOT_DIR%mobile\android"
set "RES_DIR=%ANDROID_DIR%\app\src\main\res"

call :cleanup_launcher_pngs

cd /d "%ANDROID_DIR%"
if errorlevel 1 (
	echo [ERROR] Could not open Android directory.
	exit /b 1
)

echo Generating Debug APK...
call gradlew.bat assembleDebug
if errorlevel 1 goto :build_failed

echo.
echo Generating Release APK...
call gradlew.bat assembleRelease
if errorlevel 1 goto :build_failed

call :cleanup_launcher_pngs

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

:cleanup_launcher_pngs
for %%D in (drawable-hdpi drawable-mdpi drawable-xhdpi drawable-xxhdpi drawable-xxxhdpi) do (
	if exist "%RES_DIR%\%%D\ic_launcher.png" del /f /q "%RES_DIR%\%%D\ic_launcher.png"
	if exist "%RES_DIR%\%%D\ic_launcher_round.png" del /f /q "%RES_DIR%\%%D\ic_launcher_round.png"
)
exit /b 0