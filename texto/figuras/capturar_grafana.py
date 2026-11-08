#!/usr/bin/env python3
"""Figuras 5 e 7 a partir do Grafana Cloud (API de renderização), com token em ~/.config/tcc-grafana-token.

Figura 5: painéis do dashboard tcc-aplicacoes (provisionado pelo tcc-platform) na janela da carga do k6,
          renderizados um a um e montados em grade (sem a interface do Grafana em volta).
Figura 7: um trace de GET /produtos da carga, num painel de trace de um dashboard auxiliar.
Uso: python3 -I figuras/capturar_grafana.py <inicio ISO> <fim ISO>   (a partir de texto/)
"""
import base64
import json
import pathlib
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime

AQUI = pathlib.Path(__file__).resolve().parent
URL = "https://altasistemas.grafana.net"
TOKEN = (pathlib.Path.home() / ".config" / "tcc-grafana-token").read_text().strip()
INI, FIM = [int(datetime.fromisoformat(x.replace("Z", "+00:00")).timestamp() * 1000) for x in sys.argv[1:3]]


def req(caminho, corpo=None, metodo=None):
    r = urllib.request.Request(URL + caminho, data=json.dumps(corpo).encode() if corpo else None, method=metodo,
                               headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=180) as resp:
        return resp.read()


def painel(uid, pid, w, h, extra=""):
    q = f"orgId=1&panelId={pid}&from={INI}&to={FIM}&width={w}&height={h}&theme=light&tz=America%2FSao_Paulo{extra}"
    return req(f"/render/d-solo/{uid}/x?{q}")


# ---- Figura 5: grade 2 x 3 de painéis
grade = [(1, 0, 0), (2, 1, 0), (3, 0, 1), (4, 1, 1), (6, 0, 2)]
W, H = 900, 420
imgs = []
for pid, col, lin in grade:
    larg = W * 2 if pid == 6 else W
    png = painel("tcc-aplicacoes", pid, larg, H, "&var-amb=hml")
    imgs.append(f'<image x="{col * W}" y="{lin * H}" width="{larg}" height="{H}" href="data:image/png;base64,{base64.b64encode(png).decode()}"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{2 * W}" height="{3 * H}"><rect width="100%" height="100%" fill="#fff"/>{"".join(imgs)}</svg>'
(AQUI / "figura5-grafana.svg").write_text(svg)
subprocess.run(["node", "-e", f"""
const fs=require('fs');const {{Resvg}}=require('@resvg/resvg-js');
fs.writeFileSync('{AQUI / "figura5-grafana.png"}', new Resvg(fs.readFileSync('{AQUI / "figura5-grafana.svg"}','utf8')).render().asPng());
"""], check=True, cwd=AQUI.parent)
(AQUI / "figura5-grafana.svg").unlink()
print("ok figura5-grafana.png")

# ---- Figura 7: trace de uma listagem durante a carga
q = urllib.parse.urlencode({"q": '{resource.service.name="catalogo-api" && name="GET produtos"}',
                            "start": INI // 1000, "end": FIM // 1000, "limit": 20})
traces = json.loads(req(f"/api/datasources/proxy/uid/grafanacloud-traces/api/search?{q}"))["traces"]
trace = max(traces, key=lambda t: t.get("durationMs", 0))["traceID"]
dash = {"uid": "tcc-trace-figura", "title": "TCC – trace da Figura 7", "schemaVersion": 39,
        "panels": [{"id": 1, "type": "traces", "title": "", "gridPos": {"x": 0, "y": 0, "w": 24, "h": 14},
                    "targets": [{"datasource": {"type": "tempo", "uid": "grafanacloud-traces"}, "queryType": "traceql",
                                 "query": trace, "refId": "A"}]}]}
req("/api/dashboards/db", {"dashboard": dash, "folderUid": "tcc", "overwrite": True})
(AQUI / "figura7-trace.png").write_bytes(painel("tcc-trace-figura", 1, 1600, 520))
print("ok figura7-trace.png", trace)
