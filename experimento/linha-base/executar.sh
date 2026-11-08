#!/usr/bin/env bash
# Linha de base (Apêndice D, etapa 1): implantação MANUAL de uma aplicação, sem a plataforma.
# Cada comando é um passo que uma pessoa executaria; o script registra o instante de cada um.
# Uso: ./executar.sh api|front   -> ../dados/linha-base.jsonl
set -euo pipefail
APP=$1
AQUI=$(cd "$(dirname "$0")" && pwd)
WS=$(cd "$AQUI/../../.." && pwd)
WIN_WS='C:\Users\jhone\OneDrive\Documents\Git\ProjetosParalelos\TCC\TCC-Jhonathan'
DOCKER="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
NO=ubuntu@163.176.1.147; IP=163.176.1.147
OUT="$AQUI/../dados/linha-base.jsonl"
INICIO=$(date -u +%s.%N); N=0
passo() { # passo <descrição> <comando...>
  local d=$1; shift; N=$((N+1)); local t0; t0=$(date -u +%s.%N)
  "$@"
  local t1; t1=$(date -u +%s.%N)
  printf '{"app":"%s","passo":%d,"descricao":"%s","inicio":"%s","duracao_s":%.1f}\n' "$APP" "$N" "$d" \
    "$(date -u -d @"$t0" +%FT%T.%3NZ)" "$(echo "$t1 - $t0" | bc)" | tee -a "$OUT"
}
manual() { echo "(passo manual registrado, não automatizável aqui: $*)"; }

if [ "$APP" = api ]; then
  NS=manual-api; HOST=manual-api.tcc.altasistemas.com.br; IMG=catalogo-api:manual-1; CTX="$WIN_WS\\catalogo-api"
  SENHA=$(openssl rand -hex 16)
  passo "build da imagem linux/arm64" "$DOCKER" build -q --platform linux/arm64 -t "$IMG" "$CTX"
  passo "transferência da imagem para o nó (docker save | ctr import)" bash -c "\"$DOCKER\" save $IMG | ssh $NO 'sudo k3s ctr -n k8s.io images import -' >/dev/null"
  passo "criação do namespace" kubectl create namespace $NS
  passo "criação do segredo do banco (fora do Git)" kubectl -n $NS create secret generic banco \
    --from-literal=usuario=catalogo --from-literal=senha="$SENHA" \
    --from-literal=connection-string="Host=postgres;Database=catalogo;Username=catalogo;Password=$SENHA"
  passo "aplicação dos manifestos" kubectl apply -f "$AQUI/api/api.yaml"
  passo "espera do banco" kubectl -n $NS rollout status statefulset/postgres --timeout=300s
  passo "espera da API" kubectl -n $NS rollout status deploy/api --timeout=300s
  passo "registro DNS do host (Cloudflare)" manual "criar A $HOST -> $IP"
  passo "verificação HTTPS" bash -c "until [ \"\$(curl -s -o /dev/null -w '%{http_code}' --resolve $HOST:443:$IP https://$HOST/health)\" = 200 ]; do sleep 2; done"
  passo "verificação da telemetria no Grafana" manual "Explore > Tempo: service.name=catalogo-api-manual"
else
  NS=manual-front; HOST=manual-front.tcc.altasistemas.com.br; IMG=catalogo-front:manual-1; CTX="$WIN_WS\\catalogo-front"
  passo "build da imagem linux/arm64" "$DOCKER" build -q --platform linux/arm64 -t "$IMG" "$CTX"
  passo "transferência da imagem para o nó (docker save | ctr import)" bash -c "\"$DOCKER\" save $IMG | ssh $NO 'sudo k3s ctr -n k8s.io images import -' >/dev/null"
  passo "aplicação dos manifestos" kubectl apply -f "$AQUI/front/front.yaml"
  passo "espera do frontend" kubectl -n $NS rollout status deploy/front --timeout=300s
  passo "registro DNS do host (Cloudflare)" manual "criar A $HOST -> $IP"
  passo "verificação HTTPS" bash -c "until [ \"\$(curl -s -o /dev/null -w '%{http_code}' --resolve $HOST:443:$IP https://$HOST/healthz)\" = 200 ]; do sleep 2; done"
fi
FIM=$(date -u +%s.%N)
printf '{"app":"%s","passo":"total","passos":%d,"duracao_s":%.1f}\n' "$APP" "$N" "$(echo "$FIM - $INICIO" | bc)" | tee -a "$OUT"
