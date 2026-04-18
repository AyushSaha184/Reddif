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
set "REQ_HASH_FILE=%VENV_DIR%\.requirements.sha256"

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

call :get_requirements_hash
set "HASH_AVAILABLE=1"
if errorlevel 2 (
  set "HASH_AVAILABLE=0"
) else (
  if errorlevel 1 exit /b 1
)

set "INSTALL_NEEDED=0"
if "!HASH_AVAILABLE!"=="1" (
  if not exist "%REQ_HASH_FILE%" (
    echo [INFO] First-time dependency setup required.
    set "INSTALL_NEEDED=1"
  ) else (
    set /p EXISTING_REQ_HASH=<"%REQ_HASH_FILE%"
    if /I not "!EXISTING_REQ_HASH!"=="!CURRENT_REQ_HASH!" (
      echo [INFO] requirements.txt changed. Reinstall required.
      set "INSTALL_NEEDED=1"
    )
  )
)

if "!HASH_AVAILABLE!"=="0" (
  echo [WARN] requirements hash unavailable, using import checks only.
)

if "!INSTALL_NEEDED!"=="0" (
  echo [INFO] Verifying installed packages...
  "%VENV_PY%" -c "import fastapi,uvicorn" >nul 2>nul
  if errorlevel 1 (
    echo [INFO] One or more required packages are missing. Reinstall required.
    set "INSTALL_NEEDED=1"
  )
)

if "!INSTALL_NEEDED!"=="0" (
  echo [INFO] Dependencies are up to date.
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

if "!HASH_AVAILABLE!"=="1" (
  >"%REQ_HASH_FILE%" echo !CURRENT_REQ_HASH!
  if errorlevel 1 (
    echo [ERROR] Failed to write dependency marker file: "%REQ_HASH_FILE%"
    exit /b 1
  )
  echo [INFO] Dependency marker updated.
)

exit /b 0

:get_requirements_hash
set "CURRENT_REQ_HASH="
where certutil >nul 2>nul
if errorlevel 1 (
  exit /b 2
)

for /f "skip=1 tokens=1" %%H in ('certutil -hashfile "%REQUIREMENTS%" SHA256 ^| findstr /R /I "^[0-9A-F][0-9A-F]"') do (
  set "CURRENT_REQ_HASH=%%H"
  goto :hash_done
)

:hash_done
if not defined CURRENT_REQ_HASH (
  exit /b 2
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

echo [INFO] Starting backend in new terminal...
echo [INFO] Backend will be at: http://localhost:8000/health

start cmd /k "pushd "%BACKEND_DIR%" && "%VENV_PY%" main.py"
exit /b 0

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
