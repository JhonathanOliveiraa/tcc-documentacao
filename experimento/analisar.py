#!/usr/bin/env python3
"""Consolida os dados brutos de dados/ em resultados.json (consumido pelo build do texto).

Uso: python3 -I analisar.py   (a partir de experimento/)
"""
import csv
import json
import pathlib
import statistics
import subprocess
import sys

AQUI = pathlib.Path(__file__).resolve().parent
DADOS = AQUI / "dados"
WS = AQUI.parents[1]


def jsonl(nome):
    f = DADOS / nome
    return [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()] if f.exists() else []


def resumo(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    return {"n": len(vals), "media": round(statistics.mean(vals), 1), "min": round(min(vals), 1), "max": round(max(vals), 1)}


def linhas(f):
    return sum(1 for l in pathlib.Path(f).read_text(encoding="utf-8").splitlines() if l.strip() and not l.strip().startswith("#"))


res = {}

# --- implantação (lead time) ---
imp = [d for d in jsonl("implantacao.jsonl") if "total_s" in d]
falhas_esteira = [d for d in jsonl("implantacao.jsonl") if "total_s" not in d]
res["implantacao"] = {}
for app in ("catalogo-api", "catalogo-front"):
    reps = [d for d in imp if d["app"] == app and str(d["rep"]).isdigit()]
    todas = [d for d in imp if d["app"] == app]
    res["implantacao"][app] = {
        "repeticoes": reps,
        "primeira": next((d for d in imp if d["app"] == app and d["rep"] == "primeira"), None),
        **{k: resumo([d[k] for d in reps]) for k in ("esteira_s", "testes_s", "build_s", "deteccao_argo_s", "reconciliacao_s", "total_s")},
        "todas_total_s": resumo([d["total_s"] for d in todas]),
    }

# --- recuperação ---
fal = jsonl("falha.jsonl")
res["recuperacao"] = {}
for tipo in ("inicializacao", "funcional"):
    reps = [d for d in fal if d["tipo"] == tipo]
    res["recuperacao"][tipo] = {
        "repeticoes": reps,
        **{k: resumo([d[k] for d in reps]) for k in ("deteccao_s", "reacao_s", "reconciliacao_s", "total_s", "argo_detectou_reversao_s")},
        "health_publico_durante_falha": sorted({d["health_publico_durante_falha"] for d in reps}),
    }

# --- linha de base manual ---
lb = jsonl("linha-base.jsonl")
res["linha_base"] = {}
for app, pasta in (("api", "api"), ("front", "front")):
    passos = [d for d in lb if d["app"] == app and d["passo"] != "total"]
    total = next((d for d in lb if d["app"] == app and d["passo"] == "total"), None)
    arqs = sorted((AQUI / "linha-base" / pasta).glob("*.yaml"))
    res["linha_base"][app] = {
        "passos": passos, "n_passos": len(passos), "duracao_total_s": total and total["duracao_s"],
        "arquivos": len(arqs), "linhas": sum(linhas(f) for f in arqs),
        "passos_por_nova_versao": 3,  # build, transferência para o nó, kubectl set image/apply
    }

# --- esforço pela plataforma (arquivos fora do código da aplicação) ---
plat = WS / "tcc-platform"
res["plataforma_esforco"] = {}
for app, n_passos in (("catalogo-api", 5), ("catalogo-front", 4)):
    arqs = sorted((plat / "apps" / app).rglob("*.yaml")) + [WS / app / ".github/workflows/ci.yml"]
    res["plataforma_esforco"][app] = {
        "arquivos": len(arqs), "linhas": sum(linhas(f) for f in arqs),
        "arquivos_fora_de_apps": 0, "n_passos": n_passos, "passos_por_nova_versao": 1,
        "lista": [str(f.relative_to(WS)) for f in arqs],
    }

# --- padronização ---
res["padronizacao"] = json.loads(subprocess.run([sys.executable, "-I", str(AQUI / "padronizacao.py"), str(plat)],
                                                check=True, capture_output=True, text=True).stdout)

# --- consumo da plataforma ---
def overhead(arq):
    f = DADOS / arq
    if not f.exists():
        return None
    por = {}
    for r in csv.DictReader(f.open(encoding="utf-8")):
        por.setdefault(r["namespace"], {"cpu": [], "mem": []})
        por[r["namespace"]]["cpu"].append(int(r["cpu_m"]))
        por[r["namespace"]]["mem"].append(int(r["mem_mi"]))
    return {ns: {"cpu_m": round(statistics.mean(v["cpu"]), 1), "mem_mi": round(statistics.mean(v["mem"]), 1),
                 "amostras": len(v["cpu"])} for ns, v in sorted(por.items())}

res["overhead"] = {"sem_apps": overhead("overhead-sem-apps.csv"), "com_apps_carga": overhead("overhead-com-apps.csv")}

# --- observabilidade e esteira ---
for extra in ("observabilidade.json", "esteira.json", "colega.json"):
    f = DADOS / extra
    res[extra.split(".")[0]] = json.loads(f.read_text(encoding="utf-8")) if f.exists() else None
res["falhas_na_esteira"] = falhas_esteira

# --- condições do ambiente que alteram a verificação dos requisitos ---
import socket, uuid
try:
    ip = socket.gethostbyname(f"verifica-{uuid.uuid4().hex[:8]}.tcc.altasistemas.com.br")
except OSError:
    ip = None
res["dns_curinga"] = ip == "163.176.1.147"
g = DADOS / "grafana.json"
res["grafana"] = json.loads(g.read_text(encoding="utf-8")) if g.exists() else {"alertas": False, "sinteticos": False}

(AQUI / "resultados.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok ->", AQUI / "resultados.json")
