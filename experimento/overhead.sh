#!/usr/bin/env bash
# Amostra o consumo (kubectl top, metrics-server) por namespace: N amostras a cada INTERVALO segundos.
# Saída CSV: instante,namespace,cpu_m,mem_mi   Uso: ./overhead.sh [N=20] [INTERVALO=30] > dados/overhead.csv
set -euo pipefail
N=${1:-20}; INTERVALO=${2:-30}
echo "instante,namespace,cpu_m,mem_mi"
for i in $(seq 1 "$N"); do
  t=$(date -Iseconds)
  kubectl top pods -A --no-headers | awk -v t="$t" '{c=$3; m=$4; sub("m","",c); sub("Mi","",m); C[$1]+=c; M[$1]+=m}
    END {for (n in C) printf "%s,%s,%d,%d\n", t, n, C[n], M[n]}'
  kubectl top node --no-headers | awk -v t="$t" '{c=$2; m=$4; sub("m","",c); sub("Mi","",m); printf "%s,_no,%d,%d\n", t, c, m}'
  [ "$i" -lt "$N" ] && sleep "$INTERVALO"
done
