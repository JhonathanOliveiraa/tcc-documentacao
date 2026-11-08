/* Gera o TCC completo formatado em ABNT (Manual PUC-GO / Escola Politecnica) */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  TableOfContents, PageNumber, Header, Footer, PageBreak, LevelFormat,
  Tab, TabStopType, TabStopPosition, BorderStyle, ShadingType,
  Table, TableRow, TableCell, WidthType, StyleLevel, ImageRun, SectionType
} = require("docx");

// ---- constantes de formatacao ABNT ----
const CM = 567;                 // 1 cm em DXA
const FONT = "Arial";
const SZ = 24;                  // 12pt
const SZ10 = 20;                // 10pt
const LINE = 360;               // 1,5 entrelinhas
const INDENT = Math.round(1.25 * CM); // 709 (recuo 1a linha)
const TW = 16 * CM;             // largura util: A4 (21 cm) - margens 3 + 2 cm
const WORKSPACE = path.resolve(__dirname, "..", "..");

// paragrafo de corpo (justificado, 1.5, recuo primeira linha)
function p(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, font: FONT, size: SZ })];
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { line: LINE, after: 0, before: 0 },
    indent: opts.noIndent ? undefined : { firstLine: INDENT },
    children: runs,
  });
}
function run(text, o = {}) {
  return new TextRun({ text, font: FONT, size: o.size || SZ, bold: o.bold, italics: o.italics, color: o.color });
}
// placeholder destacado (a preencher pelo autor)
function ph(text) {
  return new TextRun({ text, font: FONT, size: SZ, italics: true, color: "C00000",
    shading: { type: ShadingType.CLEAR, fill: "FFF2CC" } });
}

// titulo de secao primaria (1 INTRODUCAO) - nova pagina, esquerda, maiusculo, negrito
function h1(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { line: LINE, before: 0, after: 240 },
    children: [new TextRun({ text: `${num} ${title}`, font: FONT, size: SZ, bold: true })],
  });
}
function h2(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { line: LINE, before: 240, after: 120 },
    children: [new TextRun({ text: `${num} ${title}`, font: FONT, size: SZ, bold: true })],
  });
}
function h3(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { line: LINE, before: 180, after: 120 },
    children: [new TextRun({ text: `${num} ${title}`, font: FONT, size: SZ, bold: true, italics: true })],
  });
}
// titulo sem indicativo (RESUMO, ABSTRACT, SUMARIO, REFERENCIAS) - centralizado maiusculo negrito
function htop(title, toc = false) {
  return new Paragraph({
    heading: toc ? HeadingLevel.HEADING_1 : undefined,
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
    spacing: { line: LINE, before: 0, after: 240 },
    children: [new TextRun({ text: title, font: FONT, size: SZ, bold: true })],
  });
}
function blank() { return new Paragraph({ spacing: { line: LINE }, children: [new TextRun({ text: "", font: FONT, size: SZ })] }); }
function center(text, o = {}) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE },
    children: [new TextRun({ text, font: FONT, size: o.size || SZ, bold: o.bold, italics: o.italics })] });
}
// citacao longa (recuo 4cm, fonte 10, espaco simples)
function quoteLong(text, fonte) {
  return [
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 4 * CM },
      spacing: { line: 240, before: 240, after: 120 },
      children: [new TextRun({ text, font: FONT, size: SZ10 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, indent: { left: 4 * CM }, spacing: { line: 240, after: 240 },
      children: [new TextRun({ text: fonte, font: FONT, size: SZ10 })] }),
  ];
}
// referencia (alinhada a esquerda, espaco simples, uma linha em branco entre elas - NBR 6023).
// O destaque do titulo (negrito) e marcado no texto com **...**.
function ref(text) {
  const partes = text.split(/\*\*(.+?)\*\*/);
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 240, after: 240 },
    children: partes.map((t, i) => new TextRun({ text: t, font: FONT, size: SZ, bold: i % 2 === 1 })) });
}
// paragrafo com trechos marcados: **negrito** e ~~italico~~ (termos estrangeiros)
function marcar(text) {
  const runs = [];
  text.split(/(\*\*.+?\*\*|~~.+?~~)/).forEach(t => {
    if (!t) return;
    if (t.startsWith("**")) runs.push(run(t.slice(2, -2), { bold: true }));
    else if (t.startsWith("~~")) runs.push(run(t.slice(2, -2), { italics: true }));
    else runs.push(run(t));
  });
  return runs;
}
function pm(text, opts = {}) { return p(marcar(text), opts); }
// item de lista (figuras/siglas) com tab e leader de pontos
function listItem(label, page) {
  return new Paragraph({
    spacing: { line: LINE },
    tabStops: [{ type: TabStopType.RIGHT, position: 9 * CM + 4 * CM, leader: "dot" }],
    children: [new TextRun({ text: label, font: FONT, size: SZ }), new TextRun({ text: `\t${page}`, font: FONT, size: SZ })],
  });
}
function sigla(s, d) {
  return new Paragraph({ spacing: { line: LINE },
    tabStops: [{ type: TabStopType.LEFT, position: 3 * CM }],
    children: [new TextRun({ text: s, font: FONT, size: SZ }), new TextRun({ text: `\t${d}`, font: FONT, size: SZ })] });
}
// legenda (identificacao na parte superior, fonte 12, sem negrito) e fonte (fonte 10)
// Os estilos alimentam as listas de ilustracoes e de quadros (campos TOC \t no Word).
function legendaQuadro(text) {
  return new Paragraph({ style: "LegendaQuadro", children: [run(text)] });
}
function fonte(text = "Fonte: elaborado pelo autor.") {
  return new Paragraph({ spacing: { line: 240, after: 240 }, children: [run(text, { size: SZ10 })] });
}
// bullet
function bullet(text) {
  return new Paragraph({ numbering: { reference: "bul", level: 0 }, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE }, children: [new TextRun({ text, font: FONT, size: SZ })] });
}

// Resultados da avaliacao (gerados por experimento/analisar.py)
const R = JSON.parse(fs.readFileSync(process.env.TCC_RESULTADOS || path.join(__dirname, "..", "experimento", "resultados.json"), "utf8"));
const CONC = require("./capitulos/06-conclusao");

const TITULO = "IMPLEMENTAÇÃO DE UMA PLATAFORMA DE DEPLOY AUTOMATIZADO E OBSERVABILIDADE PARA MICROSSERVIÇOS BASEADA EM KUBERNETES E GITOPS";
const AUTOR = "JHONATHAN OLIVEIRA DE ALMEIDA";

// =========================================================================
// PRE-TEXTUAIS
// =========================================================================
const pretextual = [];

// ---- CAPA ----
pretextual.push(center("PONTIFÍCIA UNIVERSIDADE CATÓLICA DE GOIÁS", { bold: true }));
pretextual.push(center("ESCOLA POLITÉCNICA E DE ARTES", { bold: true }));
pretextual.push(center("GRADUAÇÃO EM ENGENHARIA DE COMPUTAÇÃO", { bold: true }));
for (let i = 0; i < 6; i++) pretextual.push(blank());
pretextual.push(center(AUTOR, { bold: true }));
for (let i = 0; i < 6; i++) pretextual.push(blank());
pretextual.push(center(TITULO, { bold: true }));
for (let i = 0; i < 10; i++) pretextual.push(blank());
pretextual.push(center("GOIÂNIA", { bold: true }));
pretextual.push(center("2026", { bold: true }));

// ---- FOLHA DE ROSTO ----
pretextual.push(new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { line: LINE },
  children: [run(AUTOR, { bold: true })] }));
for (let i = 0; i < 8; i++) pretextual.push(blank());
pretextual.push(center(TITULO, { bold: true }));
for (let i = 0; i < 4; i++) pretextual.push(blank());
// natureza do trabalho (recuo ~8cm, fonte 10, espaco simples)
pretextual.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 8 * CM }, spacing: { line: 240 },
  children: [run("Trabalho de Conclusão de Curso apresentado à Escola Politécnica e de Artes, da Pontifícia Universidade Católica de Goiás, como parte dos requisitos para a obtenção do título de Bacharel em Engenharia de Computação.", { size: SZ10 })] }));
pretextual.push(blank());
pretextual.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 8 * CM }, spacing: { line: 240 },
  children: [run("Orientador: Prof. Me. Rafael Leal Martins", { size: SZ10 })] }));
for (let i = 0; i < 8; i++) pretextual.push(blank());
pretextual.push(center("GOIÂNIA", { bold: true }));
pretextual.push(center("2026", { bold: true }));

// ---- FOLHA DE APROVACAO ----
pretextual.push(new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { line: LINE },
  children: [run(AUTOR, { bold: true })] }));
for (let i = 0; i < 4; i++) pretextual.push(blank());
pretextual.push(center(TITULO, { bold: true }));
for (let i = 0; i < 2; i++) pretextual.push(blank());
pretextual.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 8 * CM }, spacing: { line: 240 },
  children: [run("Trabalho de Conclusão de Curso aprovado em sua forma final pela Escola Politécnica e de Artes, da Pontifícia Universidade Católica de Goiás, para obtenção do título de Bacharel em Engenharia de Computação, em _____/_____/__________.", { size: SZ10 })] }));
for (let i = 0; i < 5; i++) pretextual.push(blank());
pretextual.push(center("__________________________________________"));
pretextual.push(center("Orientador: Prof. Me. Rafael Leal Martins"));
for (let i = 0; i < 2; i++) pretextual.push(blank());
pretextual.push(center("__________________________________________"));
pretextual.push(center("Prof.(a) [Nome do Membro 1 da Banca]"));
for (let i = 0; i < 2; i++) pretextual.push(blank());
pretextual.push(center("__________________________________________"));
pretextual.push(center("Prof.(a) [Nome do Membro 2 da Banca]"));
for (let i = 0; i < 6; i++) pretextual.push(blank());
pretextual.push(center("GOIÂNIA"));
pretextual.push(center("2026"));

// ---- DEDICATORIA ----
pretextual.push(new Paragraph({ pageBreakBefore: true, spacing: { line: LINE }, children: [run("")] }));
for (let i = 0; i < 18; i++) pretextual.push(blank());
pretextual.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 7 * CM }, spacing: { line: LINE },
  children: [run("Dedico este trabalho à minha família, pelo apoio incondicional, e a todos que acreditam que a tecnologia deve ser construída de forma sólida, confiável e ao alcance de quem dela depende.", { italics: true })] }));

// ---- AGRADECIMENTOS ----
pretextual.push(htop("AGRADECIMENTOS"));
pretextual.push(p("A Deus, por me conceder saúde, persistência e oportunidades ao longo desta caminhada."));
pretextual.push(p("À minha família, pelo apoio constante, pela compreensão nos momentos de ausência e pelo incentivo em todas as etapas da graduação."));
pretextual.push(p("Ao meu orientador, Prof. Me. Rafael Leal Martins, pela confiança, pelas orientações precisas e pelas valiosas contribuições para a construção deste trabalho."));
pretextual.push(p("Aos professores da Escola Politécnica e de Artes da Pontifícia Universidade Católica de Goiás, pelos conhecimentos compartilhados ao longo do curso de Engenharia de Computação."));
pretextual.push(p("Aos colegas de curso e de trabalho, pelas discussões técnicas, trocas de experiência e sugestões que enriqueceram esta pesquisa."));
pretextual.push(p("A todos que, direta ou indiretamente, contribuíram para a realização deste trabalho."));

// ---- EPIGRAFE ----
pretextual.push(new Paragraph({ pageBreakBefore: true, spacing: { line: LINE }, children: [run("")] }));
for (let i = 0; i < 18; i++) pretextual.push(blank());
pretextual.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 7 * CM }, spacing: { line: LINE },
  children: [run("“O preço da confiabilidade é a busca da máxima simplicidade.”", { italics: true })] }));
pretextual.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { line: LINE },
  children: [run("C. A. R. Hoare (1981, tradução nossa)", { italics: true })] }));

// ---- RESUMO ----
pretextual.push(htop("RESUMO"));
pretextual.push(p(CONC.resumo(R)));
pretextual.push(blank());
pretextual.push(p([run("Palavras-chave: ", { bold: true }), run("Kubernetes. GitOps. Observabilidade. OpenTelemetry. Engenharia de Plataforma.")], { noIndent: true }));

// ---- ABSTRACT ----
pretextual.push(htop("ABSTRACT"));
pretextual.push(p(CONC.abstract(R)));
pretextual.push(blank());
pretextual.push(p([run("Keywords: ", { bold: true }), run("Kubernetes. GitOps. Observability. OpenTelemetry. Platform Engineering.")], { noIndent: true }));

// ---- LISTA DE ILUSTRACOES ----
pretextual.push(htop("LISTA DE ILUSTRAÇÕES"));
pretextual.push(new TableOfContents("Lista de ilustrações", { hyperlink: true, stylesWithLevels: [new StyleLevel("Legenda Figura", 1)] }));

// ---- LISTA DE QUADROS ----
pretextual.push(htop("LISTA DE QUADROS"));
pretextual.push(new TableOfContents("Lista de quadros", { hyperlink: true, stylesWithLevels: [new StyleLevel("Legenda Quadro", 1)] }));

// ---- LISTA DE TABELAS ----
pretextual.push(htop("LISTA DE TABELAS"));
pretextual.push(new TableOfContents("Lista de tabelas", { hyperlink: true, stylesWithLevels: [new StyleLevel("Legenda Tabela", 1)] }));

// ---- LISTA DE ABREVIATURAS E SIGLAS ----
pretextual.push(htop("LISTA DE ABREVIATURAS E SIGLAS"));
[
  ["ACME", "Automatic Certificate Management Environment"],
  ["API", "Application Programming Interface"],
  ["ARM", "Advanced RISC Machines (arquitetura de processador)"],
  ["CD", "Continuous Delivery (entrega contínua)"],
  ["CI", "Continuous Integration (integração contínua)"],
  ["CNCF", "Cloud Native Computing Foundation"],
  ["CORS", "Cross-Origin Resource Sharing"],
  ["CPU", "Central Processing Unit"],
  ["CRD", "Custom Resource Definition"],
  ["DevOps", "Development and Operations"],
  ["DNS", "Domain Name System"],
  ["DORA", "DevOps Research and Assessment"],
  ["DSR", "Design Science Research"],
  ["eBPF", "extended Berkeley Packet Filter"],
  ["ESO", "External Secrets Operator"],
  ["GHCR", "GitHub Container Registry"],
  ["HTTP", "HyperText Transfer Protocol"],
  ["HTTPS", "HyperText Transfer Protocol Secure"],
  ["IaC", "Infrastructure as Code (Infraestrutura como Código)"],
  ["IoT", "Internet of Things"],
  ["OCI", "Oracle Cloud Infrastructure"],
  ["OCPU", "Oracle CPU (unidade de processamento da OCI)"],
  ["OTel", "OpenTelemetry"],
  ["OTLP", "OpenTelemetry Protocol"],
  ["RBAC", "Role-Based Access Control"],
  ["REST", "Representational State Transfer"],
  ["RF", "Requisito Funcional"],
  ["RNF", "Requisito Não Funcional"],
  ["SDK", "Software Development Kit"],
  ["SPA", "Single Page Application"],
  ["TCC", "Trabalho de Conclusão de Curso"],
  ["TLS", "Transport Layer Security"],
  ["UTC", "Coordinated Universal Time"],
  ["VM", "Virtual Machine (máquina virtual)"],
  ["YAML", "YAML Ain’t Markup Language"],
].forEach(([s, d]) => pretextual.push(sigla(s, d)));

// ---- SUMARIO ----
pretextual.push(htop("SUMÁRIO"));
pretextual.push(new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-3" }));

// =========================================================================
// TEXTUAIS
// =========================================================================
const textual = [];

// ---------- 1 INTRODUCAO ----------
textual.push(h1("1", "INTRODUÇÃO"));
textual.push(p("O desenvolvimento de software passou, nas últimas décadas, por uma transição significativa em relação à forma como as aplicações são construídas, implantadas e operadas. A consolidação da computação em nuvem, a popularização dos contêineres e a adoção de arquiteturas baseadas em microsserviços alteraram profundamente o ciclo de vida das aplicações, deslocando o foco da simples codificação para a entrega contínua, a confiabilidade e a operação em escala (NEWMAN, 2021; KIM et al., 2016)."));
textual.push(p("Nesse cenário, contêineres tornaram-se a unidade padrão de empacotamento e distribuição de aplicações, e o Kubernetes consolidou-se como o principal sistema de orquestração de contêineres, responsável por automatizar a implantação, o escalonamento e a recuperação de cargas de trabalho conteinerizadas (BURNS; BEDA; HIGHTOWER, 2022). Entretanto, a flexibilidade oferecida por essas tecnologias traz consigo uma elevada complexidade operacional: configurar pipelines de implantação, instrumentar telemetria, definir estratégias de rollback e padronizar ambientes são tarefas que, quando realizadas de forma manual e repetitiva para cada nova aplicação, aumentam o esforço das equipes e a probabilidade de erros."));
textual.push(p("Como resposta a esse problema, emergiu a disciplina de Engenharia de Plataforma (Platform Engineering), cujo objetivo é construir plataformas internas que ofereçam às equipes de produto capacidades de autoatendimento e caminhos recomendados — os chamados Golden Paths — para entregar software de maneira padronizada, autônoma e segura (CNCF TAG APP DELIVERY, 2023; NIEMEN, 2020), reduzindo a carga cognitiva dessas equipes (SKELTON; PAIS, 2019). Em paralelo, a prática de GitOps propõe utilizar repositórios Git como fonte única da verdade para o estado desejado da infraestrutura, com agentes que puxam esse estado e reconciliam continuamente o que está declarado com o que está em execução no cluster (OPENGITOPS, 2021; LIMONCELLI, 2018)."));
textual.push(p("Este trabalho insere-se nesse contexto e propõe a construção de uma plataforma padronizada para implantação automatizada e observabilidade de aplicações conteinerizadas, integrando Kubernetes, GitOps (por meio do Argo CD) e telemetria com OpenTelemetry e Grafana. O foco do trabalho não está em uma aplicação específica, mas na infraestrutura que permite que qualquer aplicação aderente a um padrão mínimo seja implantada e monitorada automaticamente e recuperada de forma padronizada e rastreável."));

textual.push(h2("1.1", "Problema de pesquisa"));
textual.push(p("Em organizações que adotam microsserviços, cada nova aplicação frequentemente exige a recriação de toda a cadeia de implantação e operação: scripts de build, manifestos de implantação, configuração de monitoramento, definição de alertas e mecanismos de retorno a versões anteriores. Esse processo manual e não padronizado gera retrabalho, inconsistências entre ambientes, dependência de conhecimento individual e dificuldade de garantir que todos os serviços nasçam observáveis e resilientes. Diante disso, formula-se a seguinte questão de pesquisa: como projetar e implementar uma plataforma padronizada que permita que aplicações conteinerizadas sejam implantadas de forma automatizada e já nasçam observáveis e preparadas para rollback, reduzindo o esforço manual e a divergência entre serviços?"));

textual.push(h2("1.2", "Objetivo geral"));
textual.push(p("Propor e implementar uma plataforma padronizada de implantação automatizada e observabilidade para aplicações conteinerizadas, baseada em Kubernetes, GitOps e OpenTelemetry, de modo que qualquer aplicação aderente a um padrão mínimo seja implantada e monitorada de forma automática e reprodutível e possa ser recuperada de forma padronizada, rastreável e de baixo esforço."));

textual.push(h2("1.3", "Objetivos específicos"));
textual.push(p("Para alcançar o objetivo geral, definem-se os seguintes objetivos específicos:", { noIndent: true }));
textual.push(bullet("estudar os fundamentos de conteinerização, orquestração com Kubernetes, integração e entrega contínua, GitOps e observabilidade;"));
textual.push(bullet("definir um padrão mínimo (contrato) que as aplicações devem seguir para serem incorporadas à plataforma;"));
textual.push(bullet("projetar a arquitetura da plataforma, contemplando entrega contínua via Argo CD, telemetria com OpenTelemetry e visualização com Grafana;"));
textual.push(bullet("implementar um template (Golden Path) reutilizável que provisione implantação e observabilidade de forma automática e um procedimento padronizado de rollback;"));
textual.push(bullet("validar a plataforma por meio da implantação de duas aplicações com formatos de implantação distintos (uma API de backend com banco de dados e um frontend web estático) sem alterações na infraestrutura comum;"));
textual.push(bullet("avaliar os resultados quanto à redução de esforço manual, padronização, observabilidade, capacidade de recuperação e consumo de recursos da própria plataforma."));

textual.push(h2("1.4", "Justificativa"));
textual.push(p("A padronização da implantação e da operação de aplicações é um dos principais fatores associados ao desempenho de equipes de entrega de software de alto rendimento (FORSGREN; HUMBLE; KIM, 2018). A ausência de um caminho padronizado faz com que cada equipe reinvente soluções para problemas já resolvidos, aumentando o custo cognitivo e o tempo até a entrega de valor. Plataformas internas que oferecem capacidades de implantação, observabilidade e recuperação como serviço reduzem esse custo e permitem que os desenvolvedores se concentrem na lógica de negócio."));
textual.push(p("Do ponto de vista acadêmico, o trabalho integra conhecimentos de sistemas distribuídos, engenharia de software, redes e infraestrutura, alinhando-se às competências esperadas de um Engenheiro de Computação. Do ponto de vista prático, a plataforma proposta utiliza tecnologias amplamente adotadas pela indústria e mantidas por comunidades de código aberto sob a Cloud Native Computing Foundation, o que confere relevância e aplicabilidade direta ao resultado. Por fim, ao tratar a infraestrutura como produto reprodutível e independente da aplicação, o trabalho demonstra um modelo que pode ser reutilizado e estendido por outras equipes e projetos."));

textual.push(h2("1.5", "Metodologia"));
textual.push(p("Quanto à natureza, esta pesquisa caracteriza-se como aplicada e, quanto ao método, segue a Design Science Research (HEVNER et al., 2004; DRESCH; LACERDA; ANTUNES JÚNIOR, 2015): a plataforma é o artefato construído para resolver um problema prático, e sua avaliação consiste em medições objetivas feitas sobre o artefato em funcionamento, sem a pretensão de controle estatístico de um experimento. Os procedimentos metodológicos detalhados são apresentados no Capítulo 3."));

textual.push(h2("1.6", "Organização do trabalho"));
textual.push(p("Além desta introdução, o trabalho está organizado da seguinte forma. O Capítulo 2 apresenta o referencial teórico, abordando microsserviços, conteinerização, Kubernetes, integração e entrega contínua, GitOps, observabilidade e engenharia de plataforma, além dos trabalhos relacionados. O Capítulo 3 descreve a metodologia, incluindo a classificação da pesquisa, o ambiente, as ferramentas, as métricas de avaliação, os requisitos da plataforma e as ameaças à validade. O Capítulo 4 apresenta o desenvolvimento da plataforma, detalhando sua arquitetura e seus componentes. O Capítulo 5 apresenta os resultados obtidos e a discussão. Por fim, o Capítulo 6 traz as conclusões e as propostas de trabalhos futuros. Os apêndices reúnem os manifestos do template, os templates de integração contínua, o roteiro de reconstrução da plataforma e o protocolo de avaliação."));

// ---------- 2 a 4: capitulos em capitulos/ ----------
const H = { h1, h2, h3, p, pm, bullet, legendaQuadro, quadro, fonte, figura, codeBlock, arquivoRepo,
  legendaTabela, tabela, run, marcar, center };
textual.push(...require("./capitulos/02-referencial")(H));
textual.push(...require("./capitulos/03-metodologia")(H));
textual.push(...require("./capitulos/04-desenvolvimento")(H));

// ---------- 5 e 6, referencias e apendices ----------
textual.push(...require("./capitulos/05-resultados")(H, R));
textual.push(...CONC.conclusao(H, R));

textual.push(htop("REFERÊNCIAS", true));
require("./capitulos/referencias").forEach(r => textual.push(ref(r)));

textual.push(...require("./capitulos/apendices")({ ...H, htop }));

// ---------- ANEXO ----------
textual.push(htop("ANEXO A – TERMO DE AUTORIZAÇÃO DE PUBLICAÇÃO DE PRODUÇÃO ACADÊMICA", true));
textual.push(p("Termo de autorização de publicação de produção acadêmica (Anexo B do Manual de TCC da Escola Politécnica e de Artes), a ser inserido preenchido e assinado na versão final, após a defesa, para a submissão ao Repositório Acadêmico da Graduação (RAG)."));

// ---- quadros (tabelas) ----
function cell(text, opts = {}) {
  const negrito = opts.head || text.startsWith("**");
  return new TableCell({
    width: { size: opts.w, type: WidthType.DXA },
    shading: opts.head ? { type: ShadingType.CLEAR, fill: "D9D9D9" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { line: 240 }, alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: text.replace(/\*\*/g, ""), font: FONT, size: SZ10, bold: negrito })] })],
  });
}
// quadro (bordas fechadas, texto): cabecalho, linhas e pesos relativos das colunas
function quadro(cab, linhas, pesos) {
  const tot = pesos.reduce((x, y) => x + y, 0);
  const ws = pesos.map(x => Math.round(TW * x / tot));
  ws[ws.length - 1] = TW - ws.slice(0, -1).reduce((x, y) => x + y, 0);
  return tbl([rowOf(cab, ws, true), ...linhas.map(l => rowOf(l, ws))]);
}
function rowOf(cols, ws, head) {
  return new TableRow({ children: cols.map((c, i) => cell(c, { w: ws[i], head })) });
}
function tbl(rows) {
  return new Table({ width: { size: TW, type: WidthType.DXA }, rows });
}
function quadroPilares() {
  const ws = [Math.round(TW * 0.28), Math.round(TW * 0.72)];
  ws[1] = TW - ws[0];
  return tbl([
    rowOf(["Sinal", "Descrição"], ws, true),
    rowOf(["Logs", "Registros de eventos discretos, úteis para detalhar o que ocorreu em um instante."], ws),
    rowOf(["Métricas", "Medidas numéricas agregadas ao longo do tempo, úteis para tendências e alertas."], ws),
    rowOf(["Traces", "Acompanhamento de uma requisição ao percorrer múltiplos serviços, úteis para latência e causa raiz."], ws),
  ]);
}
function quadroFerramentas() {
  const ws = [Math.round(TW * 0.30), TW - Math.round(TW * 0.30)];
  return tbl([
    rowOf(["Ferramenta", "Papel na plataforma"], ws, true),
    rowOf(["Oracle Cloud Infrastructure (OCI)", "Máquina virtual ARM64 que hospeda o cluster."], ws),
    rowOf(["Kubernetes (k3s)", "Orquestração, escalonamento e auto-recuperação das cargas de trabalho; distribuição leve para nó único."], ws),
    rowOf(["Docker", "Empacotamento das aplicações em imagens de contêiner linux/arm64."], ws),
    rowOf(["Git (GitHub)", "Fonte única da verdade para o estado desejado da infraestrutura e das aplicações."], ws),
    rowOf(["GitHub Actions", "Integração contínua por workflows reutilizáveis (templates de backend e frontend): testes, análise, construção e publicação das imagens."], ws),
    rowOf(["GitHub Container Registry (GHCR)", "Registro das imagens de contêiner."], ws),
    rowOf(["Trivy", "Análise de vulnerabilidades no código, nas dependências e nas imagens."], ws),
    rowOf(["Kustomize", "Composição dos manifestos a partir de uma base comum e de overlays por aplicação."], ws),
    rowOf(["Argo CD", "Entrega contínua declarativa (GitOps) e reconciliação do estado."], ws),
    rowOf(["Kong (Gateway API)", "Ponto de entrada HTTP/HTTPS (Gateway) e roteamento para as aplicações (HTTPRoute)."], ws),
    rowOf(["cert-manager", "Emissão e renovação automática de certificados TLS (Let’s Encrypt)."], ws),
    rowOf(["OCI Vault e External Secrets Operator", "Armazenamento dos segredos fora do Git e entrega deles ao cluster."], ws),
    rowOf(["OpenTelemetry", "Instrumentação padronizada de métricas, logs e traces nas aplicações."], ws),
    rowOf(["Grafana Alloy", "Coletor no cluster (distribuição do OpenTelemetry Collector): recebe OTLP e coleta métricas e logs do Kubernetes."], ws),
    rowOf(["Grafana Cloud", "Armazenamento, visualização e alertas da telemetria (métricas, logs e traces)."], ws),
  ]);
}
function quadroMetricas() {
  const ws = [Math.round(TW * 0.34), TW - Math.round(TW * 0.34)];
  return tbl([
    rowOf(["Métrica", "O que avalia"], ws, true),
    rowOf(["Esforço de implantação", "Número de passos e de arquivos necessários para implantar uma aplicação."], ws),
    rowOf(["Tempo até a primeira implantação", "Tempo decorrido entre iniciar o onboarding e a aplicação em execução."], ws),
    rowOf(["Cobertura de observabilidade", "Disponibilidade automática de métricas, logs e traces por aplicação."], ws),
    rowOf(["Tempo de recuperação (rollback)", "Tempo para retornar a um estado estável após uma falha."], ws),
    rowOf(["Padronização", "Grau de uniformidade entre os serviços implantados pela plataforma."], ws),
  ]);
}
function quadroRequisitos(linhas) {
  const ws = [Math.round(TW * 0.14), TW - Math.round(TW * 0.14)];
  return tbl([rowOf(["Código", "Requisito"], ws, true), ...linhas.map(l => rowOf(l, ws))]);
}
function quadroOnboarding() {
  const ws = [Math.round(TW * 0.34), TW - Math.round(TW * 0.34)];
  return tbl([
    rowOf(["Artefato exigido", "Descrição"], ws, true),
    rowOf(["Dockerfile padronizado", "Construção da imagem conforme as convenções da plataforma."], ws),
    rowOf(["Arquivo de integração contínua", "ci.yml que referencia o template de backend ou de frontend e informa seus parâmetros."], ws),
    rowOf(["Manifestos a partir do template", "Overlay em apps/<aplicação> derivado de golden-path/base."], ws),
    rowOf(["Instrumentação OpenTelemetry", "Adoção do SDK/configuração padrão de telemetria, enviando por OTLP ao coletor da plataforma."], ws),
    rowOf(["Segredos declarados", "ExternalSecret com os nomes dos segredos no OCI Vault; nenhum valor no Git."], ws),
    rowOf(["Endpoint de health check", "Endpoint padronizado para verificação de saúde pelo orquestrador."], ws),
  ]);
}
function quadroAppsValidacao() {
  const ws = [Math.round(TW * 0.22), Math.round(TW * 0.23), TW - Math.round(TW * 0.22) - Math.round(TW * 0.23)];
  return tbl([
    rowOf(["Aplicação", "Tecnologia", "Natureza / implantação no Kubernetes"], ws, true),
    rowOf(["API de Produtos", "ASP.NET Core", "Serviço HTTP síncrono de backend; Deployment exposto por Service."], ws),
    rowOf(["Frontend de Catálogo", "Angular", "Aplicação web (SPA) no navegador; conteúdo estático servido por contêiner exposto pelo Kong."], ws),
  ]);
}
// figura: legenda em cima (fonte 12), imagem, fonte embaixo (fonte 10). "imagem" e um PNG em
// figuras/ (largura maxima ~16 cm) ou um array de linhas, desenhado em fonte monoespacada.
function dimensoesPng(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
function figura(titulo, imagem, origem = "Fonte: elaborado pelo autor.", larguraCm = 16) {
  let corpo;
  if (Array.isArray(imagem)) {
    corpo = codeBlock(imagem, { centro: false });
  } else {
    const arq = path.join(__dirname, "figuras", imagem);
    if (!fs.existsSync(arq)) {
      if (!process.env.TCC_RASCUNHO) throw new Error("figura ausente: " + arq);
      return [new Paragraph({ style: "LegendaFigura", children: [run(titulo)] }), center("[rascunho: " + imagem + " ausente]"), fonte(origem)];
    }
    const buf = fs.readFileSync(arq);
    const { w, h } = dimensoesPng(buf);
    const largura = Math.round(larguraCm / 2.54 * 96);
    corpo = new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { line: 240, before: 60, after: 60 },
      children: [new ImageRun({ type: "png", data: buf, transformation: { width: largura, height: Math.round(largura * h / w) } })] });
  }
  return [
    new Paragraph({ style: "LegendaFigura", children: [run(titulo)] }),
    corpo,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, after: 240 }, children: [run(origem, { size: SZ10 })] }),
  ];
}
function codeBlock(lines, o = {}) {
  return new Paragraph({
    keepLines: o.keepLines,
    spacing: { before: 120, after: 120, line: 240 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
    children: lines.flatMap((l, i) => {
      const r = [new TextRun({ text: l, font: "Consolas", size: o.size || 18 })];
      if (i < lines.length - 1) r.push(new TextRun({ text: "", break: 1 }));
      return r;
    }),
  });
}
// arquivo de outro repositorio do workspace (TCC-Jhonathan/<repo>/<caminho>), como bloco de codigo
function arquivoRepo(repo, caminho) {
  const arq = path.join(WORKSPACE, repo, caminho);
  const linhas = fs.readFileSync(arq, "utf8").replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  return [
    new Paragraph({ spacing: { line: 240, before: 240, after: 60 }, keepNext: true,
      children: [run(`${repo}/${caminho}`, { bold: true, size: SZ10 })] }),
    codeBlock(linhas, { size: 16 }),
  ];
}
// tabela no padrao IBGE: titulo em cima, bordas horizontais no cabecalho e no fim, laterais abertas
function legendaTabela(text) { return new Paragraph({ style: "LegendaTabela", children: [run(text)] }); }
function tabela(cab, linhas, pesos, o = {}) {
  const tot = pesos.reduce((a, b) => a + b, 0);
  const ws = pesos.map(x => Math.round(TW * x / tot));
  ws[ws.length - 1] = TW - ws.slice(0, -1).reduce((a, b) => a + b, 0);
  const nada = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const fino = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const celula = (t, i, ehCab, ultima) => new TableCell({
    width: { size: ws[i], type: WidthType.DXA },
    borders: { left: nada, right: nada, top: ehCab ? fino : nada, bottom: ehCab || ultima ? fino : nada },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ spacing: { line: 240 }, alignment: i === 0 || o.alinharEsq ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [new TextRun({ text: String(t).replace(/\*\*/g, ""), font: FONT, size: SZ10,
        bold: ehCab || String(t).startsWith("**") })] })],
  });
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    borders: { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada },
    rows: [
      new TableRow({ tableHeader: true, children: cab.map((c, i) => celula(c, i, true, false)) }),
      ...linhas.map((l, k) => new TableRow({ children: l.map((c, i) => celula(c, i, false, k === linhas.length - 1)) })),
    ],
  });
}

// =========================================================================
// DOCUMENTO
// =========================================================================
const doc = new Document({
  creator: "Jhonathan Oliveira de Almeida",
  title: TITULO,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: SZ } } },
    paragraphStyles: [
      { id: "LegendaFigura", name: "Legenda Figura", basedOn: "Normal", next: "Normal",
        run: { size: SZ, font: FONT, color: "000000" },
        paragraph: { alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 240, after: 60, line: 240 } } },
      { id: "LegendaQuadro", name: "Legenda Quadro", basedOn: "Normal", next: "Normal",
        run: { size: SZ, font: FONT, color: "000000" },
        paragraph: { keepNext: true, spacing: { before: 240, after: 60, line: 240 } } },
      { id: "LegendaTabela", name: "Legenda Tabela", basedOn: "Normal", next: "Normal",
        run: { size: SZ, font: FONT, color: "000000" },
        paragraph: { keepNext: true, spacing: { before: 240, after: 60, line: 240 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ, bold: true, font: FONT, color: "000000" },
        paragraph: { spacing: { before: 0, after: 240, line: LINE }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ, bold: true, font: FONT, color: "000000" },
        paragraph: { spacing: { before: 240, after: 120, line: LINE }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: SZ, bold: true, font: FONT, color: "000000" },
        paragraph: { spacing: { before: 180, after: 120, line: LINE }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: INDENT + 360, hanging: 360 } } } }] },
    ],
  },
  sections: [
    // Secao 1: pre-textuais. Contadas a partir da folha de rosto (a capa e a pagina 0) e sem
    // numero impresso (NBR 14724): cabecalho vazio explicito.
    {
      properties: { page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 3 * CM, right: 2 * CM, bottom: 2 * CM, left: 3 * CM },
        pageNumbers: { start: 0 },
      } },
      headers: { default: new Header({ children: [new Paragraph({ children: [] })] }) },
      children: pretextual,
    },
    // Secao 2 (quebra de secao antes do Capitulo 1): textuais e pos-textuais; a contagem continua
    // da secao 1 e o numero aparece no canto superior direito.
    {
      properties: { type: SectionType.NEXT_PAGE, page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 3 * CM, right: 2 * CM, bottom: 2 * CM, left: 3 * CM },
      } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ })],
      })] }) },
      children: textual,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  const saida = process.env.TCC_RASCUNHO ? "rascunho.docx" : "TCC - Esteira Kubernetes - COMPLETO.docx";
  fs.writeFileSync(saida, buf);
  console.log("OK -> " + saida + " (" + buf.length + " bytes)");
});
