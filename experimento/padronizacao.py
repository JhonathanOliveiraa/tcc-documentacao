#!/usr/bin/env python3
"""Métricas de padronização (Quadro 4 do TCC), a partir do repositório tcc-platform.

(a) linhas escritas pela aplicação (apps/<app>/{base,<amb>}) ÷ linhas do manifesto renderizado
(b) campos divergentes entre os Deployments renderizados das duas aplicações
(c) checklist de conformidade com o contrato do Golden Path

Uso: python3 -I padronizacao.py <caminho do tcc-platform> [amb=hml]  -> JSON em stdout
"""
import json
import pathlib
import subprocess
import sys

import yaml

PLAT = pathlib.Path(sys.argv[1])
AMB = sys.argv[2] if len(sys.argv) > 2 else "hml"
APPS = ["catalogo-api", "catalogo-front"]


def linhas_uteis(texto):
    return sum(1 for l in texto.splitlines() if l.strip() and not l.strip().startswith("#"))


def renderizar(app):
    return subprocess.run(["kubectl", "kustomize", str(PLAT / "apps" / app / AMB)],
                          check=True, capture_output=True, text=True).stdout


def achatar(obj, prefixo=""):
    """dict/list -> {caminho: valor}; listas de containers/env/volumes indexadas pelo name."""
    saida = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            saida.update(achatar(v, f"{prefixo}.{k}" if prefixo else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            chave = v.get("name", i) if isinstance(v, dict) else i
            saida.update(achatar(v, f"{prefixo}[{chave}]"))
    else:
        saida[prefixo] = obj
    return saida


def checklist(docs):
    dep = next(d for d in docs if d["kind"] == "Deployment")
    pod = dep["spec"]["template"]["spec"]
    c = pod["containers"][0]
    sc = c.get("securityContext", {})
    env = {e["name"] for e in c.get("env", [])}
    kinds = {d["kind"] for d in docs}
    itens = {
        "liveness": "livenessProbe" in c,
        "readiness": "readinessProbe" in c,
        "startup": "startupProbe" in c,
        "requests": bool(c.get("resources", {}).get("requests")),
        "limits": bool(c.get("resources", {}).get("limits")),
        "nao_root": pod.get("securityContext", {}).get("runAsNonRoot") is True,
        "sem_escalonamento": sc.get("allowPrivilegeEscalation") is False,
        "raiz_somente_leitura": sc.get("readOnlyRootFilesystem") is True,
        "sem_capabilities": sc.get("capabilities", {}).get("drop") == ["ALL"],
        "seccomp": pod.get("securityContext", {}).get("seccompProfile", {}).get("type") == "RuntimeDefault",
        "sem_token_sa": pod.get("automountServiceAccountToken") is False,
        "otel_endpoint": "OTEL_EXPORTER_OTLP_ENDPOINT" in env,
        "otel_ambiente": "OTEL_RESOURCE_ATTRIBUTES" in env,
        "imagem_por_digest": "@sha256:" in c["image"],
        "rolling_sem_indisponibilidade": dep["spec"]["strategy"]["rollingUpdate"]["maxUnavailable"] == 0,
        "httproute_https": any(d["kind"] == "HTTPRoute" and d["spec"]["parentRefs"][0].get("sectionName") == "https-tcc" for d in docs),
        "networkpolicy_metadados": "NetworkPolicy" in kinds,
        "pull_secret_do_vault": any(d["kind"] == "ExternalSecret" and d["metadata"]["name"] == "ghcr" for d in docs),
    }
    return itens


resultado = {"ambiente": AMB, "apps": {}}
deploys = {}
for app in APPS:
    escritas = 0
    arquivos = []
    for sub in ("base", AMB):
        for f in sorted((PLAT / "apps" / app / sub).glob("*.yaml")):
            n = linhas_uteis(f.read_text(encoding="utf-8"))
            escritas += n
            arquivos.append({"arquivo": str(f.relative_to(PLAT)), "linhas": n})
    render = renderizar(app)
    docs = [d for d in yaml.safe_load_all(render) if d]
    ck = checklist(docs)
    deploys[app] = achatar(next(d for d in docs if d["kind"] == "Deployment"))
    resultado["apps"][app] = {
        "arquivos_da_app": arquivos,
        "linhas_escritas": escritas,
        "linhas_renderizadas": linhas_uteis(render),
        "razao_escritas_renderizadas": round(escritas / linhas_uteis(render), 3),
        "recursos_renderizados": sorted(d["kind"] for d in docs),
        "checklist": ck,
        "conformidade": f"{sum(ck.values())}/{len(ck)}",
    }

a, b = deploys[APPS[0]], deploys[APPS[1]]
chaves = sorted(set(a) | set(b))
divergentes = [k for k in chaves if a.get(k) != b.get(k)]
iguais = [k for k in chaves if k in a and k in b and a[k] == b[k]]
resultado["deployment"] = {
    "campos_total": len(chaves),
    "campos_iguais": len(iguais),
    "campos_divergentes": len(divergentes),
    "divergentes": divergentes,
}
golden = linhas_uteis(subprocess.run(["kubectl", "kustomize", str(PLAT / "golden-path" / "base")],
                                     check=True, capture_output=True, text=True).stdout)
resultado["golden_path_base_linhas_renderizadas"] = golden
print(json.dumps(resultado, ensure_ascii=False, indent=2))
