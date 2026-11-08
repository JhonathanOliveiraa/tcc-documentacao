/* Gera as Figuras 1, 3 e 4 do TCC (diagramas) como SVG e PNG.
 * Uso: node figuras/gerar_diagramas.js   (a partir de texto/)
 * Fontes: Arial do Windows (WSL) ou do sistema. */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const OUT = __dirname;
const FONTES = ["/mnt/c/Windows/Fonts/arial.ttf", "/mnt/c/Windows/Fonts/arialbd.ttf",
  "/mnt/c/Windows/Fonts/ariali.ttf"].filter(f => fs.existsSync(f));

// paleta para impressão (tons claros, contorno escuro)
const COR = {
  linha: "#333333", texto: "#111111", sub: "#444444",
  git: "#E8EEF7", ci: "#EAF4EA", cluster: "#FAFAFA", plat: "#FFF4E0", app: "#EEF0FF",
  ext: "#F3F3F3", obs: "#FDECEC",
};

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

class Svg {
  constructor(w, h) { this.w = w; this.h = h; this.els = []; }
  box(x, y, w, h, titulo, linhas = [], o = {}) {
    const fill = o.fill || "#FFFFFF";
    const dash = o.tracejado ? ' stroke-dasharray="8 5"' : "";
    this.els.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 10}" fill="${fill}" stroke="${COR.linha}" stroke-width="${o.sw || 2}"${dash}/>`);
    const tam = o.tam || 22;
    const alinhar = o.topo ? "start" : "middle";
    const cx = o.topo ? x + 14 : x + w / 2;
    const total = (titulo ? 1 : 0) + linhas.length;
    let ty = o.topo ? y + tam + 10 : y + h / 2 - ((total - 1) * (tam + 6)) / 2 + tam * 0.35;
    if (titulo) {
      this.els.push(`<text x="${cx}" y="${ty}" font-size="${tam}" font-weight="bold" text-anchor="${alinhar}" fill="${COR.texto}">${esc(titulo)}</text>`);
      ty += tam + 6;
    }
    for (const l of linhas) {
      this.els.push(`<text x="${cx}" y="${ty}" font-size="${tam - 4}" text-anchor="${alinhar}" fill="${COR.sub}">${esc(l)}</text>`);
      ty += tam + 2;
    }
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
  }
  seta(pts, rotulo, o = {}) {
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
    const dash = o.tracejado ? ' stroke-dasharray="8 6"' : "";
    const ponta = o.dupla ? ' marker-start="url(#pi)"' : "";
    this.els.push(`<path d="${d}" fill="none" stroke="${COR.linha}" stroke-width="2.4"${dash} marker-end="url(#pf)"${ponta}/>`);
    if (rotulo) {
      const i = o.seg ?? Math.floor((pts.length - 1) / 2);
      const [a, b] = [pts[i], pts[i + 1]];
      const mx = (a[0] + b[0]) / 2 + (o.dx || 0), my = (a[1] + b[1]) / 2 + (o.dy ?? -8);
      const linhas = Array.isArray(rotulo) ? rotulo : [rotulo];
      linhas.forEach((t, k) => {
        this.els.push(`<text x="${mx}" y="${my + k * 20}" font-size="17" text-anchor="${o.ancora || "middle"}" fill="${COR.texto}" font-style="italic" stroke="#FFFFFF" stroke-width="5" paint-order="stroke">${esc(t)}</text>`);
      });
    }
  }
  texto(x, y, t, o = {}) {
    this.els.push(`<text x="${x}" y="${y}" font-size="${o.tam || 20}" font-weight="${o.negrito ? "bold" : "normal"}" text-anchor="${o.ancora || "start"}" fill="${COR.texto}">${esc(t)}</text>`);
  }
  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" font-family="Arial">
<defs>
<marker id="pf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR.linha}"/></marker>
<marker id="pi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR.linha}"/></marker>
</defs>
<rect width="100%" height="100%" fill="#FFFFFF"/>
${this.els.join("\n")}
</svg>`;
  }
}

function salvar(nome, svg) {
  const s = svg.toString();
  fs.writeFileSync(path.join(OUT, nome + ".svg"), s);
  const png = new Resvg(s, { fitTo: { mode: "width", value: svg.w * 2 },
    font: { fontFiles: FONTES, loadSystemFonts: FONTES.length === 0, defaultFontFamily: "Arial" } }).render().asPng();
  fs.writeFileSync(path.join(OUT, nome + ".png"), png);
  console.log("ok", nome, svg.w + "x" + svg.h);
}

// ---------------------------------------------------------------- Figura 1
function figura1() {
  const s = new Svg(1700, 960);
  // GitHub
  s.box(30, 30, 520, 760, "GitHub", [], { fill: COR.git, topo: true, tam: 24 });
  const app = s.box(55, 85, 230, 120, "Aplicações", ["catalogo-api", "catalogo-front", "(código, ci.yml)"], { tam: 21 });
  const tpl = s.box(300, 85, 225, 120, "Templates", ["tcc-pipeline-", "templates"], { tam: 21 });
  const gha = s.box(55, 260, 470, 110, "GitHub Actions", ["testes → Trivy → build linux/arm64", "→ Trivy na imagem → publicação"], { fill: COR.ci });
  const ghcr = s.box(55, 430, 190, 120, "GHCR", ["imagens"]);
  const plat = s.box(275, 430, 250, 160, "tcc-platform", ["(GitOps)", "golden-path/base", "apps/<app>/<amb>"], { fill: COR.plat });
  s.seta([[app.cx, app.b], [app.cx, gha.y]], "push", { dx: 30, dy: 6 });
  s.seta([[tpl.cx, tpl.b], [tpl.cx, gha.y]], "uses:", { dx: 34, dy: 6 });
  s.seta([[ghcr.cx, gha.b], [ghcr.cx, ghcr.y]], "imagem", { dx: 46, dy: 4 });
  s.seta([[plat.cx, gha.b], [plat.cx, plat.y]], "tag + digest", { dx: 66, dy: 4 });

  // VM / k3s
  s.box(600, 30, 760, 900, "VM OCI A1.Flex (ARM64, 2 OCPU, 12 GB) — k3s", [], { fill: COR.cluster, topo: true, tam: 22 });
  const argo = s.box(630, 90, 330, 110, "Argo CD", ["ApplicationSet (apps/*/*)", "AppProject tcc"], { fill: COR.plat });
  const kong = s.box(1000, 90, 330, 110, "Kong (Gateway API)", ["Gateway + HTTPRoute, TLS"]);
  const cm = s.box(1000, 240, 330, 110, "cert-manager", ["certificados Let's Encrypt"]);
  const eso = s.box(1000, 400, 330, 110, "External Secrets", ["Operator (Instance", "Principal)"]);
  const alloy = s.box(1000, 570, 330, 140, "Grafana Alloy", ["receptor OTLP; métricas do", "cluster; logs dos contêineres"], { fill: COR.obs });
  const ns = s.box(630, 390, 320, 380, "Namespaces <app>-<amb>", [], { fill: COR.app, topo: true, tracejado: true });
  const front = s.box(655, 440, 270, 80, "catalogo-front", ["nginx · SPA Angular"], { tam: 21 });
  const api = s.box(655, 560, 270, 80, "catalogo-api", ["ASP.NET Core · OTel SDK"], { tam: 21 });
  const pg = s.box(655, 680, 270, 60, "PostgreSQL 17", [], { tam: 20 });
  const rel = s.box(630, 810, 320, 90, "Reloader", ["reinicia pods se um Secret muda"], { tam: 20 });
  s.texto(1165, 790, "Apps sem root, raiz somente leitura,", { tam: 17, ancora: "middle" });
  s.texto(1165, 813, "sem acesso a 169.254.169.254;", { tam: 17, ancora: "middle" });
  s.texto(1165, 836, "componentes com requests/limits.", { tam: 17, ancora: "middle" });

  // externos
  const user = s.box(1400, 90, 270, 110, "Usuário", ["navegador"], { fill: COR.ext });
  const dns = s.box(1400, 220, 270, 70, "Cloudflare DNS", [], { fill: COR.ext, tam: 20 });
  const le = s.box(1400, 300, 270, 70, "Let's Encrypt", [], { fill: COR.ext, tam: 20 });
  const vault = s.box(1400, 400, 270, 110, "OCI Vault", ["segredos fora do Git"], { fill: COR.ext });
  const gc = s.box(1400, 560, 270, 200, "Grafana Cloud", ["Mimir · Loki · Tempo", "painéis · alertas", "sintéticos"], { fill: COR.obs });

  s.seta([[plat.r, plat.y + 40], [575, plat.y + 40], [575, argo.cy], [argo.x, argo.cy]], "pull", { seg: 1, dx: -24 });
  s.seta([[argo.cx, argo.b], [argo.cx, ns.y]], "aplica", { dx: 40 });
  s.seta([[ghcr.cx, ghcr.b], [ghcr.cx, 730], [ns.x, 730]], "pull por digest", { seg: 1, dx: 40 });
  s.seta([[user.x, user.cy], [kong.r, kong.cy]], "HTTPS", { dy: -8 });
  s.seta([[cm.cx, cm.y], [cm.cx, kong.b]], "certificado", { dx: 62, dy: 6 });
  s.seta([[cm.r, 280], [dns.x, dns.cy]], "DNS-01", { dy: -14, dx: -6 });
  s.seta([[cm.r, 320], [le.x, le.cy]], "ACME", { dy: 22 });
  s.seta([[kong.x, 180], [975, 180], [975, front.cy], [front.r, front.cy]], "rota", { seg: 1, dx: -26 });
  s.seta([[eso.r, eso.cy], [vault.x, vault.cy]], "lê", { dy: -8 });
  s.seta([[eso.x, 495], [955, 495], [955, 590], [api.r, 590]], "Secret", { seg: 1, dx: -32, dy: 10 });
  s.seta([[api.r, 620], [alloy.x, 620]], "OTLP", { dy: -8, dx: 18 });
  s.seta([[alloy.r, alloy.cy], [gc.x, alloy.cy]], "OTLP", { dy: -8 });
  s.seta([[api.cx, api.b], [api.cx, pg.y]]);
  s.seta([[rel.cx, rel.y], [rel.cx, ns.b]], "", { tracejado: true });
  salvar("figura1-arquitetura", s);
}

// ---------------------------------------------------------------- Figura 3
function figura3() {
  const s = new Svg(1700, 760);
  s.texto(30, 40, "Integração contínua (GitHub Actions, template compartilhado)", { negrito: true, tam: 22 });
  const ys = 70, h = 120, w = 190, gap = 40;
  const etapas = [
    ["Commit", ["push na main", "do repositório", "da aplicação"]],
    ["Testes", ["dotnet test /", "npm test"]],
    ["Trivy (código)", ["CRITICAL com", "correção: falha"]],
    ["Build", ["linux/arm64", "(compilação", "cruzada)"]],
    ["Push GHCR", ["tag sha-<commit>", "+ digest"]],
    ["Trivy (imagem)", ["CRITICAL com", "correção: falha"]],
    ["Commit no", ["apps/<app>/hml", "tag + digest"]],
  ];
  const caixas = etapas.map(([t, l], i) => s.box(30 + i * (w + gap), ys, w, h, t, l,
    { fill: i === 0 ? COR.git : i === 6 ? COR.plat : COR.ci, tam: 20 }));
  for (let i = 0; i < caixas.length - 1; i++) s.seta([[caixas[i].r, caixas[i].cy], [caixas[i + 1].x, caixas[i + 1].cy]]);
  s.texto(30, 240, "A esteira não tem credencial do cluster: sua saída é um commit no repositório da plataforma.", { tam: 18 });

  s.texto(30, 325, "Entrega contínua (Argo CD, dentro do cluster)", { negrito: true, tam: 22 });
  const y2 = 345;
  const d1 = s.box(30, y2, 250, 130, "Argo CD detecta", ["polling do Git", "(até 3 min) ou refresh"], { fill: COR.plat });
  const d2 = s.box(330, y2, 250, 130, "Renderiza", ["kustomize build", "apps/<app>/<amb>"], { fill: COR.plat });
  const d3 = s.box(630, y2, 250, 130, "Sincroniza", ["server-side apply", "prune + self-heal"], { fill: COR.plat });
  const d4 = s.box(930, y2, 270, 130, "Rolling update", ["maxUnavailable 0;", "pod novo só entra", "com readiness 200"], { fill: COR.app });
  const d5 = s.box(1250, y2, 200, 130, "Synced", ["Healthy"], { fill: COR.ci });
  [[d1, d2], [d2, d3], [d3, d4], [d4, d5]].forEach(([a, b]) => s.seta([[a.r, a.cy], [b.x, b.cy]]));
  s.seta([[caixas[6].cx, caixas[6].b], [caixas[6].cx, 268], [d1.cx, 268], [d1.cx, d1.y]], "", { seg: 1 });

  const p1 = s.box(30, 560, 380, 120, "Promoção para prd", ["workflow promover: copia", "tag + digest hml → prd"], { fill: COR.git });
  const r1 = s.box(470, 560, 380, 120, "Rollback", ["git revert do commit", "deploy(<app>) no tcc-platform"], { fill: COR.git });
  const f1 = s.box(930, 560, 520, 120, "Versão que não fica pronta", ["pods antigos seguem atendendo;", "Argo CD mostra Progressing/Degraded"], { fill: COR.obs });
  s.seta([[p1.cx, p1.y], [p1.cx, 520], [d1.cx + 40, 520], [d1.cx + 40, d1.b]], "", { tracejado: true, seg: 1 });
  s.seta([[r1.cx, r1.y], [r1.cx, 520], [d1.cx + 80, 520], [d1.cx + 80, d1.b]], "novo commit → mesmo fluxo", { tracejado: true, seg: 1, dx: 220, dy: -8 });
  s.seta([[d4.cx, d4.b], [d4.cx, f1.y]], "falha na readiness", { dx: 90 });
  salvar("figura3-fluxo-cicd", s);
}

// ---------------------------------------------------------------- Figura 4
function figura4() {
  const s = new Svg(1700, 850);
  s.box(30, 30, 1030, 760, "Cluster k3s (namespace monitoring e namespaces das aplicações)", [], { fill: COR.cluster, topo: true, tam: 22 });
  const api = s.box(60, 100, 330, 150, "catalogo-api", ["OpenTelemetry SDK .NET", "ASP.NET Core · HttpClient · EF Core", "configurado só por OTEL_*"], { fill: COR.app });
  const front = s.box(60, 300, 330, 110, "catalogo-front", ["nginx; sem SDK no navegador;", "logs de acesso em stdout"], { fill: COR.app });
  const ksm = s.box(60, 450, 330, 120, "Métricas do cluster", ["kube-state-metrics, node-exporter,", "kubelet / cAdvisor"], { fill: "#FFFFFF" });
  const logs = s.box(60, 610, 330, 120, "Logs dos contêineres", ["/var/log/pods (stdout/stderr)"], { fill: "#FFFFFF" });
  const alloy = s.box(560, 180, 460, 470, "Grafana Alloy", [], { fill: COR.obs, topo: true });
  const rx = s.box(590, 240, 400, 110, "otelcol.receiver.otlp", ["gRPC 4317 / HTTP 4318", "(pipeline remoto tcc_otlp_receiver)"]);
  const sc = s.box(590, 380, 400, 100, "coleta de métricas do cluster", ["(pipeline do k8s-monitoring)"]);
  const lg = s.box(590, 510, 400, 100, "coleta de logs e eventos", ["rótulos namespace, pod, contêiner"]);
  s.seta([[api.r, 175], [rx.x, 295]], ["OTLP gRPC", "traces, métricas, logs"], { dy: -18 });
  s.seta([[ksm.r, ksm.cy], [sc.x, sc.cy]], "scrape", { dy: -8 });
  s.seta([[logs.r, logs.cy], [480, logs.cy], [480, 560], [lg.x, 560]], "arquivos", { seg: 0, dy: -8, dx: 4 });

  const gc = s.box(1150, 100, 520, 640, "Grafana Cloud (fora do cluster)", [], { fill: COR.obs, topo: true, tam: 22 });
  const gw = s.box(1180, 160, 460, 80, "Gateway OTLP / remote write", []);
  const tempo = s.box(1180, 280, 140, 90, "Tempo", ["traces"]);
  const mimir = s.box(1340, 280, 140, 90, "Mimir", ["métricas"]);
  const loki = s.box(1500, 280, 140, 90, "Loki", ["logs"]);
  const graf = s.box(1180, 420, 460, 110, "Grafana", ["painéis Kubernetes · Application", "Observability · Explore"]);
  const al = s.box(1180, 560, 220, 150, "Alertas", ["regras sobre", "métricas e", "sintéticos"]);
  const syn = s.box(1420, 560, 220, 150, "Synthetic", ["Monitoring:", "GET /healthz", "e /health"]);
  s.seta([[alloy.r, 300], [1100, 300], [1100, gw.cy], [gw.x, gw.cy]], "HTTPS", { seg: 1, dx: -36 });
  [tempo, mimir, loki].forEach(b => s.seta([[b.cx, gw.b], [b.cx, b.y]]));
  [tempo, mimir, loki].forEach(b => s.seta([[b.cx, b.b], [b.cx, graf.y]]));
  s.seta([[syn.cx, syn.b], [syn.cx, 815], [1068, 815]], "verifica as rotas públicas (HTTPS)", { seg: 1, dy: -8 });
  salvar("figura4-telemetria", s);
}

figura1(); figura3(); figura4();
