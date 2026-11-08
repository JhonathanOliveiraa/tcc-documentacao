#!/usr/bin/env python3
"""Medições do experimento do TCC (Apêndice D). Instantes em UTC.

  implantar <app> <rep>            push de um commit vazio na main da app e mede até Healthy + 200
  falha <tipo> <rep>               tipo = inicializacao | funcional (só catalogo-api)

Saída: uma linha JSON por medição em dados/implantacao.jsonl ou dados/falha.jsonl.
Requer: gh autenticado, kubectl no contexto do cluster, clones dos repositórios no workspace.
"""
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone

WS = pathlib.Path(__file__).resolve().parents[2]
DADOS = pathlib.Path(__file__).resolve().parent / "dados"
OWNER = "JhonathanOliveiraa"
URL = {
    "catalogo-api": ("https://hml-catalogo-api.tcc.altasistemas.com.br/health",
                     "https://hml-catalogo-api.tcc.altasistemas.com.br/produtos"),
    "catalogo-front": ("https://hml-catalogo.tcc.altasistemas.com.br/healthz",
                       "https://hml-catalogo.tcc.altasistemas.com.br/"),
}


def agora():
    return datetime.now(timezone.utc)


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def sh(*args, cwd=None, check=True):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(f"{args}: {r.stderr.strip()}")
    return r.stdout.strip()


def http(url):
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def estado(app):
    ns = f"{app}-hml"
    a = json.loads(sh("kubectl", "-n", "argocd", "get", "application", ns, "-o", "json"))
    d = json.loads(sh("kubectl", "-n", ns, "get", "deploy", "app", "-o", "json"))
    st = d.get("status", {})
    pronto = (st.get("observedGeneration") == d["metadata"]["generation"]
              and st.get("updatedReplicas") == d["spec"]["replicas"]
              and st.get("availableReplicas") == d["spec"]["replicas"]
              and st.get("replicas") == d["spec"]["replicas"])
    return {
        "revisao": a["status"]["sync"].get("revision", ""),
        "sync": a["status"]["sync"]["status"],
        "health": a["status"]["health"]["status"],
        "imagem": d["spec"]["template"]["spec"]["containers"][0]["image"],
        "rollout_completo": pronto,
    }


def aguardar(cond, limite=1800, passo=3, nome=""):
    fim = time.time() + limite
    while time.time() < fim:
        r = cond()
        if r:
            return r
        time.sleep(passo)
    raise TimeoutError(nome)


def run_do_commit(app, sha):
    def achar():
        lst = json.loads(sh("gh", "run", "list", "-R", f"{OWNER}/{app}", "-L", "10", "--json", "databaseId,headSha,event"))
        return next((r["databaseId"] for r in lst if r["headSha"] == sha and r["event"] == "push"), None)
    return aguardar(achar, 300, 5, "run")


def esperar_run(app, rid):
    def fim():
        r = json.loads(sh("gh", "run", "view", str(rid), "-R", f"{OWNER}/{app}", "--json", "status,conclusion,createdAt,jobs"))
        return r if r["status"] == "completed" else None
    return aguardar(fim, 2400, 10, "esteira")


def commit_plataforma(app, tag):
    """Commit deploy(<app>): <tag> no tcc-platform: (sha, instante)."""
    def achar():
        lst = json.loads(sh("gh", "api", f"repos/{OWNER}/tcc-platform/commits?per_page=15"))
        for c in lst:
            if c["commit"]["message"].startswith(f"deploy({app}): {tag}"):
                return c["sha"], ts(c["commit"]["committer"]["date"])
        return None
    return aguardar(achar, 600, 5, "commit na plataforma")


def esperar_no_ar(app, tag, revisao=None):
    saude = URL[app][0]
    marcos = {}
    def cond():
        e = estado(app)
        t = agora()
        if revisao and e["revisao"].startswith(revisao) and "argo_detectou" not in marcos:
            marcos["argo_detectou"] = t
        if tag in e["imagem"] and "argo_aplicou" not in marcos:
            marcos["argo_aplicou"] = t
        if tag in e["imagem"] and e["rollout_completo"] and e["sync"] == "Synced" and e["health"] == "Healthy" \
                and http(saude) == 200:
            marcos["no_ar"] = t
            return marcos
        return None
    return aguardar(cond, 1800, 3, "no ar")


def git_commit_push(repo, msg, allow_empty=False):
    cwd = WS / repo
    sh("git", "pull", "-q", "--rebase", "--autostash", cwd=cwd)
    args = ["git", "commit", "-q", "-m", msg] + (["--allow-empty"] if allow_empty else ["-a"])
    sh(*args, cwd=cwd)
    sh("git", "push", "-q", "origin", "main", cwd=cwd)
    return sh("git", "rev-parse", "HEAD", cwd=cwd), agora()


def registrar(arquivo, dado):
    DADOS.mkdir(exist_ok=True)
    with open(DADOS / arquivo, "a", encoding="utf-8") as f:
        f.write(json.dumps(dado, ensure_ascii=False) + "\n")
    print(json.dumps(dado, ensure_ascii=False, indent=1))


def duracao(a, b):
    return round((b - a).total_seconds(), 1)


def implantar(app, rep, sha=None, t_push=None, nota=""):
    if sha is None:
        sha, t_push = git_commit_push(app, f"experimento: implantação {rep}", allow_empty=True)
    tag = f"sha-{sha[:12]}"
    rid = run_do_commit(app, sha)
    run = esperar_run(app, rid)
    if run["conclusion"] != "success":
        registrar("implantacao.jsonl", {"app": app, "rep": rep, "run": rid, "conclusao": run["conclusion"], "nota": nota})
        return None
    jobs = {j["name"].split(" / ")[-1]: j for j in run["jobs"]}
    psha, t_plat = commit_plataforma(app, tag)
    m = esperar_no_ar(app, tag, psha)
    d = {
        "app": app, "rep": rep, "run": rid, "tag": tag, "commit_plataforma": psha[:12], "nota": nota,
        "t_push": iso(t_push), "t_run_inicio": run["createdAt"], "t_commit_plataforma": iso(t_plat),
        "t_argo_detectou": iso(m.get("argo_detectou", m["no_ar"])), "t_no_ar": iso(m["no_ar"]),
        "esteira_s": duracao(t_push, t_plat),
        "testes_s": duracao(ts(jobs["test"]["startedAt"]), ts(jobs["test"]["completedAt"])) if "test" in jobs else None,
        "build_s": duracao(ts(jobs["build"]["startedAt"]), ts(jobs["build"]["completedAt"])),
        "deteccao_argo_s": duracao(t_plat, m.get("argo_detectou", m["no_ar"])),
        "reconciliacao_s": duracao(t_plat, m["no_ar"]),
        "total_s": duracao(t_push, m["no_ar"]),
    }
    registrar("implantacao.jsonl", d)
    return d


DEFEITOS = {
    # (a) exige uma configuração inexistente no ambiente: o processo encerra no startup
    "inicializacao": ("src/CatalogoApi/Program.cs",
                      "var app = builder.Build();\n",
                      "var app = builder.Build();\n"
                      "_ = app.Configuration[\"Catalogo:Fornecedor\"] ?? throw new InvalidOperationException("
                      "\"Configuração obrigatória Catalogo:Fornecedor ausente.\"); // EXPERIMENTO: defeito injetado\n"),
    # (b) a listagem responde 500; as sondas continuam 200
    "funcional": ("src/CatalogoApi/Controllers/ProdutosController.cs",
                  "        service.ListarAsync(query, cancellationToken);",
                  "        throw new InvalidOperationException(\"EXPERIMENTO: defeito injetado na listagem\");"),
}


def desligar_testes(repo, desligar):
    f = WS / repo / ".github/workflows/ci.yml"
    s = f.read_text(encoding="utf-8")
    if desligar:
        s = s.replace('      dotnet-version: "10.0.x"\n',
                      '      dotnet-version: "10.0.x"\n      test-command: ""   # EXPERIMENTO: defeito que escapa aos testes\n')
    f.write_text(s, encoding="utf-8", newline="\n")


def falha(tipo, rep):
    app = "catalogo-api"
    cwd = WS / app
    arq, antes, depois = DEFEITOS[tipo]
    sh("git", "pull", "-q", "--rebase", cwd=cwd)
    f = cwd / arq
    s = f.read_text(encoding="utf-8")
    assert antes in s, "trecho do defeito não encontrado"
    f.write_text(s.replace(antes, depois, 1), encoding="utf-8", newline="\n")
    desligar_testes(app, True)
    estavel = estado(app)["imagem"]
    # linha do tempo do episódio (Figura 6): estado do Argo CD, imagem e HTTP de GET /produtos a cada 5 s
    csv_f = open(DADOS / f"falha-{tipo}-{rep}.csv", "w", encoding="utf-8")
    vigia = subprocess.Popen([str(pathlib.Path(__file__).resolve().parent / "vigiar.sh"), f"{app}-hml", URL[app][1], "5"],
                             stdout=csv_f, stderr=subprocess.DEVNULL)
    sha, t_push = git_commit_push(app, f"experimento: falha {tipo} ({rep})")
    tag = f"sha-{sha[:12]}"
    rid = run_do_commit(app, sha)
    run = esperar_run(app, rid)
    assert run["conclusion"] == "success", run["conclusion"]
    psha, t0 = commit_plataforma(app, tag)

    # t1: detecção
    def detectou():
        e = estado(app)
        if tipo == "inicializacao":
            return agora() if (tag in e["imagem"] and e["health"] == "Degraded") else None
        return agora() if (tag in e["imagem"] and e["rollout_completo"] and http(URL[app][1]) == 500) else None
    t1 = aguardar(detectou, 1200, 3, "detecção")
    disponivel_durante = http(URL[app][0])

    # t2: reversão do commit da esteira no repositório da plataforma
    plat = WS / "tcc-platform"
    sh("git", "pull", "-q", "--rebase", cwd=plat)
    sh("git", "revert", "--no-edit", psha, cwd=plat)
    sh("git", "push", "-q", "origin", "main", cwd=plat)
    t2 = agora()
    rsha = sh("git", "rev-parse", "HEAD", cwd=plat)
    estavel_tag = re.search(r"sha-[0-9a-f]{12}", estavel).group(0)
    m = esperar_no_ar(app, estavel_tag, rsha[:7])
    t3 = m["no_ar"]
    d = {
        "tipo": tipo, "rep": rep, "tag_defeituosa": tag, "tag_estavel": estavel_tag,
        "t0": iso(t0), "t1": iso(t1), "t2": iso(t2), "t3": iso(t3),
        "deteccao_s": duracao(t0, t1), "reacao_s": duracao(t1, t2),
        "reconciliacao_s": duracao(t2, t3), "total_s": duracao(t0, t3),
        "health_publico_durante_falha": disponivel_durante,
        "argo_detectou_reversao_s": duracao(t2, m.get("argo_detectou", t3)),
    }
    time.sleep(30)
    vigia.terminate(); csv_f.close()
    registrar("falha.jsonl", d)

    # Restaura a main da aplicação (revert do commit defeituoso); a esteira publica uma versão boa.
    sh("git", "revert", "--no-edit", "HEAD", cwd=cwd)
    sh("git", "push", "-q", "origin", "main", cwd=cwd)
    sha_bom = sh("git", "rev-parse", "HEAD", cwd=cwd)
    implantar(app, f"pos-falha-{tipo}-{rep}", sha_bom, agora(), nota="revert do defeito no repositório da app")
    return d


if __name__ == "__main__":
    if sys.argv[1] == "implantar":
        implantar(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "falha":
        falha(sys.argv[2], sys.argv[3])
