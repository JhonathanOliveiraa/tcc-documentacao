#!/usr/bin/env bash
# Registra, a cada INTERVALO s, o estado de uma Application do Argo CD e da sua rota pública.
# CSV: instante,revisao,sync,health,imagem,http_codigo,http_ms
# Uso: ./vigiar.sh <application> <url> [INTERVALO=5] > dados/<arquivo>.csv   (Ctrl+C ou kill para parar)
set -uo pipefail
APP=$1; URL=$2; INTERVALO=${3:-5}
NS=$APP
echo "instante,revisao,sync,health,imagem,http_codigo,http_ms"
while true; do
  t=$(date -u +%FT%T.%3NZ)
  st=$(kubectl -n argocd get application "$APP" -o jsonpath='{.status.sync.revision}{","}{.status.sync.status}{","}{.status.health.status}' 2>/dev/null)
  img=$(kubectl -n "$NS" get deploy app -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null | sed 's/.*@sha256:\(.\{12\}\).*/\1/; s/.*://')
  http=$(curl -s -o /dev/null -m 8 -w '%{http_code},%{time_total}' "$URL" || echo "000,0")
  ms=$(awk -F, '{printf "%s,%d", $1, $2*1000}' <<<"$http")
  echo "$t,${st:0:7}${st:40},$img,$ms"
  sleep "$INTERVALO"
done
