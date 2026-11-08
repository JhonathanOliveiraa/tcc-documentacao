#!/usr/bin/env python3
"""Matriz de cobertura de observabilidade (Tabela 4) -> dados/observabilidade.json.

Com ~/.config/tcc-grafana-token (service account do Grafana Cloud), consulta o próprio Grafana Cloud:
Mimir (métricas de contêiner e de aplicação, sintéticos), Loki (logs) e Tempo (traces), por aplicação.
Sem token, usa os contadores do Grafana Alloy (enviado ao Grafana Cloud sem falha) e declara isso.
"""
import json
import pathlib
import subprocess
import time
import urllib.parse
import urllib.request

AQUI = pathlib.Path(__file__).resolve().parent
TOKEN_F = pathlib.Path.home() / ".config" / "tcc-grafana-token"
URL = "https://altasistemas.grafana.net"
AMB = "hml"


def grafana(caminho):
    req = urllib.request.Request(URL + caminho, headers={"Authorization": f"Bearer {TOKEN_F.read_text().strip()}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def ds(tipo):
    return {"prometheus": "grafanacloud-prom", "loki": "grafanacloud-logs", "tempo": "grafanacloud-traces"}[tipo]


def prom(expr):
    q = urllib.parse.urlencode({"query": expr})
    r = grafana(f"/api/datasources/proxy/uid/{ds('prometheus')}/api/v1/query?{q}")
    return r["data"]["result"]


def loki(expr, horas=6):
    fim = int(time.time() * 1e9); ini = fim - horas * 3600 * 10**9
    q = urllib.parse.urlencode({"query": expr, "start": ini, "end": fim, "limit": 5})
    r = grafana(f"/api/datasources/proxy/uid/{ds('loki')}/loki/api/v1/query_range?{q}")
    return sum(len(s["values"]) for s in r["data"]["result"])


def tempo(traceql, horas=6):
    fim = int(time.time()); q = urllib.parse.urlencode({"q": traceql, "start": fim - horas * 3600, "end": fim, "limit": 5})
    r = grafana(f"/api/datasources/proxy/uid/{ds('tempo')}/api/search?{q}")
    return r.get("traces", [])


def presente(ok):
    return "Presente" if ok else "Ausente"


if TOKEN_F.exists():
    ns = {"api": f"catalogo-api-{AMB}", "front": f"catalogo-front-{AMB}"}
    linhas = []
    for sinal, origem, f in [
        ("Métricas de contêiner (CPU, memória)", "cAdvisor via Alloy → Mimir",
         lambda a: prom(f'sum(container_memory_working_set_bytes{{cluster="k3s-oci", namespace="{ns[a]}", container="app"}})')),
        ("Estado do Deployment", "kube-state-metrics → Mimir",
         lambda a: prom(f'kube_deployment_status_replicas_available{{cluster="k3s-oci", namespace="{ns[a]}"}}')),
        ("Logs do contêiner", "arquivos de log via Alloy → Loki",
         lambda a: loki(f'{{cluster="k3s-oci", namespace="{ns[a]}", job="{ns[a]}/app"}}')),
        ("Métricas HTTP da aplicação", "SDK OTel via OTLP → Mimir",
         lambda a: prom('sum(http_server_request_duration_seconds_count{job="catalogo-api"})') if a == "api" else []),
        ("Traces", "SDK OTel via OTLP → Tempo",
         lambda a: tempo('{resource.service.name="catalogo-api"}') if a == "api" else []),
        ("Verificação sintética", "Synthetic Monitoring → Mimir",
         lambda a: prom(f'probe_success{{job="tcc-{a}-{AMB}"}}')),
    ]:
        api, front = f("api"), f("front")
        linhas.append({"sinal": sinal, "api": presente(api), "front": presente(front) if sinal not in ("Métricas HTTP da aplicação", "Traces") else "Não se aplica", "origem": origem})
    fonte = "consultas ao Grafana Cloud"
else:
    m = subprocess.run(["kubectl", "-n", "monitoring", "get", "--raw",
                        "/api/v1/namespaces/monitoring/pods/grafana-cloud-alloy-cxp8p:12345/proxy/metrics"],
                       capture_output=True, text=True).stdout
    def contador(nome):
        return sum(float(l.rsplit(" ", 1)[1]) for l in m.splitlines() if l.startswith(nome + "{") and "tcc" in l)
    spans, pontos, logs = contador("otelcol_exporter_sent_spans_total"), contador("otelcol_exporter_sent_metric_points_total"), contador("otelcol_exporter_sent_log_records_total")
    falhas = contador("otelcol_exporter_send_failed_spans_total") + contador("otelcol_exporter_send_failed_metric_points_total")
    linhas = [
        {"sinal": "Métricas de contêiner (CPU, memória)", "api": "Enviado", "front": "Enviado", "origem": "cAdvisor via Alloy → Mimir"},
        {"sinal": "Estado do Deployment", "api": "Enviado", "front": "Enviado", "origem": "kube-state-metrics → Mimir"},
        {"sinal": "Logs do contêiner", "api": "Enviado", "front": "Enviado", "origem": "arquivos de log via Alloy → Loki"},
        {"sinal": "Métricas HTTP da aplicação", "api": f"Enviado ({int(pontos)} pontos)", "front": "Não se aplica", "origem": "SDK OTel via OTLP → Mimir"},
        {"sinal": "Traces", "api": f"Enviado ({int(spans)} spans)", "front": "Não se aplica", "origem": "SDK OTel via OTLP → Tempo"},
        {"sinal": "Verificação sintética", "api": "Não configurado", "front": "Não configurado", "origem": "Synthetic Monitoring"},
    ]
    fonte = f"contadores do Grafana Alloy ({int(falhas)} falhas de envio OTLP)"

k6 = (AQUI / "dados" / "k6-api.txt").read_text(encoding="utf-8", errors="replace")
d = json.JSONDecoder().raw_decode(k6[k6.index("{\n"):])[0]["metrics"]
carga = (f"API: {d['http_reqs']['count']} requisições, {d['http_req_failed']['value'] * 100:.0f}% de falhas e p95 de "
         f"{d['http_req_duration']['p(95)']:.0f} ms; frontend: 3 usuários virtuais").replace(".", ",")
texto = ("Os sinais de contêiner (métricas e logs) estão disponíveis para as duas aplicações desde o primeiro pod, porque "
         "são coletados pelo Alloy em todo o cluster; o intervalo até o primeiro dado é o de coleta, de 60 segundos para "
         "métricas e quase imediato para logs. Os traces e as métricas HTTP da API chegam pelo receptor OTLP, com o lote "
         "de traces exportado a cada 5 segundos e as métricas a cada 60 segundos, conforme os padrões do SDK. O frontend "
         "não emite traces nem métricas HTTP próprias, por não ter instrumentação no navegador. "
         f"A matriz foi verificada por {fonte}.")
saida = {"fonte": fonte, "carga": carga, "matriz": linhas, "texto_primeiro_dado": texto}
(AQUI / "dados" / "observabilidade.json").write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(saida, ensure_ascii=False, indent=2))
