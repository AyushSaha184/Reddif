@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Reddif Backend Launcher (Windows)
REM Usage:
REM   server.bat            -> setup (if needed) and run backend
REM   server.bat start      -> same as default
REM   server.bat deps       -> only install/check dependencies
REM   server.bat help       -> show help

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "VENV_DIR=%BACKEND_DIR%\venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "REQUIREMENTS=%BACKEND_DIR%\requirements.txt"

if /I "%~1"=="help" goto :help
if /I "%~1"=="--help" goto :help
if /I "%~1"=="-h" goto :help
if /I "%~1"=="deps" goto :deps
if /I "%~1"=="start" goto :start
if "%~1"=="" goto :start

echo [ERROR] Unknown command: %~1
goto :help

:check_backend
if not exist "%BACKEND_DIR%\main.py" (
  echo [ERROR] Could not find backend entrypoint: "%BACKEND_DIR%\main.py"
  echo [ERROR] Run this script from the Reddif project root.
  exit /b 1
)
if not exist "%REQUIREMENTS%" (
  echo [ERROR] Could not find requirements file: "%REQUIREMENTS%"
  exit /b 1
)
exit /b 0

:ensure_python
where py >nul 2>nul
if %errorlevel%==0 (
  set "PY_BOOTSTRAP=py -3"
  exit /b 0
)

where python >nul 2>nul
if %errorlevel%==0 (
  set "PY_BOOTSTRAP=python"
  exit /b 0
)

echo [ERROR] Python not found. Install Python 3.9+ and retry.
exit /b 1

:ensure_venv
if exist "%VENV_PY%" exit /b 0

echo [INFO] Creating virtual environment...
call :ensure_python
if errorlevel 1 exit /b 1

%PY_BOOTSTRAP% -m venv "%VENV_DIR%"
if errorlevel 1 (
  echo [ERROR] Failed to create virtual environment.
  exit /b 1
)
exit /b 0

:install_deps
call :ensure_venv
if errorlevel 1 exit /b 1

echo [INFO] Checking backend dependencies...
"%VENV_PY%" -c "import fastapi" >nul 2>nul
if %errorlevel%==0 (
  echo [INFO] Dependencies already installed.
  exit /b 0
)

echo [INFO] Installing dependencies from backend\requirements.txt...
"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 (
  echo [ERROR] Failed to upgrade pip.
  exit /b 1
)

"%VENV_PY%" -m pip install -r "%REQUIREMENTS%"
if errorlevel 1 (
  echo [ERROR] Failed to install dependencies.
  exit /b 1
)

exit /b 0

:deps
call :check_backend
if errorlevel 1 exit /b 1
call :install_deps
if errorlevel 1 exit /b 1
echo [INFO] Dependency setup complete.
exit /b 0

:start
call :check_backend
if errorlevel 1 exit /b 1
call :install_deps
if errorlevel 1 exit /b 1

echo [INFO] Starting backend...
echo [INFO] URL: http://localhost:8000/health
echo [INFO] Press Ctrl+C to stop.

pushd "%BACKEND_DIR%"
"%VENV_PY%" main.py
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%

:help
echo.
echo Reddif Backend Launcher (Windows)
echo.
echo Usage:
echo   server.bat [start^|deps^|help]
echo.
echo Commands:
echo   start  Setup if needed, then run backend (default)
echo   deps   Setup/check virtualenv and dependencies only
echo   help   Show this help
echo.
exit /b 0
