#!/bin/bash
# Encerra instâncias anteriores do ambiente de dev deste projeto (inclusive as
# suspensas com Ctrl+Z) e libera as portas do backend e do frontend.
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORTS="${DEV_PORTS:-3001 4173}"

# Processos de dev deste projeto: concurrently, nodemon, vite e server.js
PIDS=$(ps -ax -o pid=,command= | grep -F "$PROJECT_DIR" \
  | grep -E "concurrently|nodemon|vite|server\.js" | grep -v -E "grep|stop-dev" | awk '{print $1}')

# server.js iniciado pelo nodemon aparece sem caminho completo: pega pelas portas
for port in $PORTS; do
  PIDS="$PIDS $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)"
done

PIDS=$(echo "$PIDS" | tr ' ' '\n' | grep -E '^[0-9]+$' | grep -v "^$$\$" | sort -u)
if [ -n "$PIDS" ]; then
  echo "[stop-dev] Encerrando instância anterior: $(echo $PIDS)"
  # SIGKILL funciona também em processos suspensos (estado T)
  kill -9 $PIDS 2>/dev/null
  sleep 1
fi
exit 0
