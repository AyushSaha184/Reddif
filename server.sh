#!/bin/bash

# Reddif Backend Launcher (Linux)
# Usage:
#   ./server.sh            -> setup (if needed) and run backend
#   ./server.sh start      -> same as default
#   ./server.sh deps       -> only install/check dependencies
#   ./server.sh help       -> show help

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"
VENV_PY="$VENV_DIR/bin/python"
REQUIREMENTS="$BACKEND_DIR/requirements.txt"
REQ_HASH_FILE="$VENV_DIR/.requirements.sha256"

show_help() {
    echo ""
    echo "Reddif Backend Launcher (Linux)"
    echo ""
    echo "Usage:"
    echo "  ./server.sh [start|deps|help]"
    echo ""
    echo "Commands:"
    echo "  start  Setup if needed, then run backend (default)"
    echo "  deps   Setup/check virtualenv and dependencies only"
    echo "  help   Show this help"
    echo ""
}

check_backend() {
    if [[ ! -f "$BACKEND_DIR/main.py" ]]; then
        echo "[ERROR] Could not find backend entrypoint: \"$BACKEND_DIR/main.py\""
        echo "[ERROR] Run this script from the Reddif project root."
        return 1
    fi
    if [[ ! -f "$REQUIREMENTS" ]]; then
        echo "[ERROR] Could not find requirements file: \"$REQUIREMENTS\""
        return 1
    fi
    return 0
}

ensure_python() {
    if command -v python3 &>/dev/null; then
        PY_BOOTSTRAP="python3"
        return 0
    elif command -v python &>/dev/null; then
        PY_BOOTSTRAP="python"
        return 0
    fi

    echo "[ERROR] Python not found. Install Python 3.9+ and retry."
    return 1
}

ensure_venv() {
    if [[ -f "$VENV_PY" ]]; then
        return 0
    fi

    echo "[INFO] Creating virtual environment..."
    ensure_python || return 1

    $PY_BOOTSTRAP -m venv "$VENV_DIR"
    if [[ $? -ne 0 ]]; then
        echo "[ERROR] Failed to create virtual environment."
        return 1
    fi
    return 0
}

get_requirements_hash() {
    if command -v sha256sum &>/dev/null; then
        CURRENT_REQ_HASH=$(sha256sum "$REQUIREMENTS" | awk '{ print $1 }')
        return 0
    fi
    return 2
}

install_deps() {
    ensure_venv || return 1

    get_requirements_hash
    HASH_AVAILABLE=$?
    
    INSTALL_NEEDED=0
    if [[ $HASH_AVAILABLE -eq 0 ]]; then
        if [[ ! -f "$REQ_HASH_FILE" ]]; then
            echo "[INFO] First-time dependency setup required."
            INSTALL_NEEDED=1
        else
            EXISTING_REQ_HASH=$(cat "$REQ_HASH_FILE")
            if [[ "$EXISTING_REQ_HASH" != "$CURRENT_REQ_HASH" ]]; then
                echo "[INFO] requirements.txt changed. Reinstall required."
                INSTALL_NEEDED=1
            fi
        fi
    else
        echo "[WARN] sha256sum unavailable, using import checks only."
    fi

    if [[ $INSTALL_NEEDED -eq 0 ]]; then
        echo "[INFO] Verifying installed packages..."
        "$VENV_PY" -c "import fastapi,uvicorn" &>/dev/null
        if [[ $? -ne 0 ]]; then
            echo "[INFO] One or more required packages are missing. Reinstall required."
            INSTALL_NEEDED=1
        fi
    fi

    if [[ $INSTALL_NEEDED -eq 0 ]]; then
        echo "[INFO] Dependencies are up to date."
        return 0
    fi

    echo "[INFO] Installing dependencies from backend/requirements.txt..."
    "$VENV_PY" -m pip install --upgrade pip
    if [[ $? -ne 0 ]]; then
        echo "[ERROR] Failed to upgrade pip."
        return 1
    fi

    "$VENV_PY" -m pip install -r "$REQUIREMENTS"
    if [[ $? -ne 0 ]]; then
        echo "[ERROR] Failed to install dependencies."
        return 1
    fi

    if [[ $HASH_AVAILABLE -eq 0 ]]; then
        echo "$CURRENT_REQ_HASH" > "$REQ_HASH_FILE"
        echo "[INFO] Dependency marker updated."
    fi

    return 0
}

start_backend() {
    check_backend || exit 1
    install_deps || exit 1

    echo "[INFO] Starting backend..."
    echo "[INFO] Backend will be at: http://localhost:8000/health"
    
    cd "$BACKEND_DIR"
    exec "$VENV_PY" main.py
}

case "$1" in
    help|--help|-h)
        show_help
        ;;
    deps)
        check_backend && install_deps && echo "[INFO] Dependency setup complete."
        ;;
    start|"")
        start_backend
        ;;
    *)
        echo "[ERROR] Unknown command: $1"
        show_help
        exit 1
        ;;
esac
