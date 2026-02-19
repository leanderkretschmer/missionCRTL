#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "[MissionCRTL] Setup wird gestartet..."

if ! command -v node >/dev/null 2>&1; then
  echo "[Fehler] Node.js ist nicht installiert. Bitte Node.js >= 20 installieren."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[Fehler] npm ist nicht installiert."
  exit 1
fi

NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[Fehler] Node.js v20+ erforderlich. Gefunden: $(node -v)"
  exit 1
fi

echo "[MissionCRTL] Node-Version: $(node -v)"

echo "[MissionCRTL] Optional: npm install (falls später Dependencies hinzukommen)..."
if npm install --no-audit --no-fund >/tmp/missioncrtl-npm-install.log 2>&1; then
  echo "[MissionCRTL] npm install erfolgreich."
else
  echo "[MissionCRTL] Warnung: npm install konnte nicht ausgeführt werden (siehe /tmp/missioncrtl-npm-install.log)."
  echo "[MissionCRTL] Fahre fort, da der aktuelle MVP dependency-frei lauffähig ist."
fi

RUN_TESTS="${RUN_TESTS:-1}"
if [ "$RUN_TESTS" = "1" ]; then
  echo "[MissionCRTL] Führe Tests aus..."
  if npm test; then
    echo "[MissionCRTL] Tests erfolgreich."
  else
    echo "[MissionCRTL] Warnung: Tests fehlgeschlagen. Server wird trotzdem gestartet (RUN_TESTS=0 zum Überspringen)."
  fi
else
  echo "[MissionCRTL] Tests übersprungen (RUN_TESTS=0)."
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"

echo "[MissionCRTL] Starte Webapp auf http://${HOST}:${PORT}"
HOST="$HOST" PORT="$PORT" node server.js
