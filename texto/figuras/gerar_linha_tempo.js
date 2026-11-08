/* Figura 6: linha do tempo de uma falha de inicialização e de uma falha funcional (rep 1),
 * a partir de experimento/dados/falha-<tipo>-1.csv e falha.jsonl.  Uso: node figuras/gerar_linha_tempo.js */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const DADOS = path.join(__dirname, "..", "..", "experimento", "dados");
const FONTES = ["/mnt/c/Windows/Fonts/arial.ttf", "/mnt/c/Windows/Fonts/arialbd.ttf"].filter(f => fs.existsSync(f));
const REP = process.argv[2] || "1";
const eventos = fs.readFileSync(path.join(DADOS, "falha.jsonl"), "utf8").trim().split("\n").map(JSON.parse);

const W = 1700, PAINEL = 330, TOPO = 40, ESQ = 250, DIR = 40;
const COR = { ok: "#4E9A4E", erro: "#C0392B", aviso: "#E0A030", neutro: "#9E9E9E", def: "#7A4FB0", est: "#3B6EA8", linha: "#222" };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
let els = [];
const txt = (x, y, t, o = {}) => els.push(`<text x="${x}" y="${y}" font-size="${o.tam || 18}" font-weight="${o.b ? "bold" : "normal"}" text-anchor="${o.a || "start"}" fill="${o.cor || COR.linha}">${esc(t)}</text>`);

function painel(tipo, titulo, y0) {
  const ev = eventos.find(e => e.tipo === tipo && String(e.rep) === REP);
  if (!ev) throw new Error("sem evento " + tipo);
  const linhas = fs.readFileSync(path.join(DADOS, `falha-${tipo}-${REP}.csv`), "utf8").trim().split("\n").slice(1)
    .map(l => l.split(",")).map(([t, rev, sync, health, img, code]) => ({ t: Date.parse(t), sync, health, img, code: +code }));
  const t0 = Date.parse(ev.t0), tf = Date.parse(ev.t3) + 30000;
  const ti = Math.min(t0 - 30000, linhas[0].t);
  const pts = linhas.filter(l => l.t >= ti && l.t <= tf);
  const X = t => ESQ + (t - ti) / (tf - ti) * (W - ESQ - DIR);
  txt(20, y0 + 24, titulo, { b: true, tam: 22 });
  const faixas = [
    ["HTTP GET /produtos", l => l.code === 200 ? [COR.ok, "200"] : l.code >= 500 ? [COR.erro, String(l.code)] : [COR.neutro, String(l.code || "—")]],
    ["Argo CD (health)", l => [{ Healthy: COR.ok, Progressing: COR.aviso, Degraded: COR.erro }[l.health] || COR.neutro, l.health]],
    ["Imagem em execução", l => [l.img.includes(ev.tag_defeituosa.slice(4)) || l.img === ev.tag_defeituosa ? COR.def : COR.est, l.img.includes(ev.tag_defeituosa.slice(4)) ? "defeituosa" : "estável"]],
  ];
  faixas.forEach(([nome, f], i) => {
    const y = y0 + 50 + i * 60;
    txt(ESQ - 12, y + 27, nome, { a: "end" });
    for (let k = 0; k < pts.length; k++) {
      const a = X(pts[k].t), b = k + 1 < pts.length ? X(pts[k + 1].t) : X(tf);
      els.push(`<rect x="${a}" y="${y}" width="${Math.max(1, b - a + 0.5)}" height="40" fill="${f(pts[k])[0]}"/>`);
    }
  });
  const marcos = [["t0", ev.t0], ["t1", ev.t1], ["t2", ev.t2], ["t3", ev.t3]];
  marcos.forEach(([n, t], i) => {
    const x = X(Date.parse(t));
    els.push(`<line x1="${x}" y1="${y0 + 40}" x2="${x}" y2="${y0 + 240}" stroke="#000" stroke-width="2" stroke-dasharray="6 4"/>`);
    txt(x, y0 + 262 + (i % 2) * 22, `${n} (${Math.round((Date.parse(t) - t0) / 1000)} s)`, { a: "middle", b: true, tam: 17 });
  });
  // eixo
  for (let s = Math.ceil((ti - t0) / 60000) * 60; s * 1000 + t0 <= tf; s += 60) {
    const x = X(t0 + s * 1000);
    els.push(`<line x1="${x}" y1="${y0 + 228}" x2="${x}" y2="${y0 + 236}" stroke="#000"/>`);
    txt(x, y0 + 312, `${s / 60} min`, { a: "middle", tam: 15, cor: "#555" });
  }
}

painel("inicializacao", "(a) Falha de inicialização: a versão defeituosa nunca recebe tráfego", TOPO);
painel("funcional", "(b) Falha funcional: a versão entra no ar e só a verificação externa detecta", TOPO + PAINEL + 30);
const yl = TOPO + 2 * PAINEL + 50;
[[COR.ok, "200 / Healthy"], [COR.erro, "5xx / Degraded"], [COR.aviso, "Progressing"], [COR.est, "imagem estável"], [COR.def, "imagem defeituosa"]]
  .forEach(([c, n], i) => { els.push(`<rect x="${ESQ + i * 270}" y="${yl}" width="26" height="20" fill="${c}"/>`); txt(ESQ + i * 270 + 34, yl + 16, n, { tam: 17 }); });
txt(ESQ, yl + 50, "t0: commit da versão defeituosa no overlay · t1: detecção · t2: commit de reversão · t3: versão estável no ar e respondendo 200", { tam: 16 });

const H = yl + 70;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial"><rect width="100%" height="100%" fill="#fff"/>${els.join("")}</svg>`;
fs.writeFileSync(path.join(__dirname, "figura6-recuperacao.svg"), svg);
fs.writeFileSync(path.join(__dirname, "figura6-recuperacao.png"), new Resvg(svg, { fitTo: { mode: "width", value: W * 2 },
  font: { fontFiles: FONTES, loadSystemFonts: !FONTES.length, defaultFontFamily: "Arial" } }).render().asPng());
console.log("ok figura6-recuperacao");
