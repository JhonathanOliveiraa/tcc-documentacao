/* Gera o TCC completo formatado em ABNT (Manual PUC-GO / Escola Politecnica) */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  TableOfContents, PageNumber, Header, Footer, PageBreak, LevelFormat,
  Tab, TabStopType, TabStopPosition, BorderStyle, ShadingType,
  Table, TableRow, TableCell, WidthType, StyleLevel
} = require("docx");

// ---- constantes de formatacao ABNT ----
const CM = 567;                 // 1 cm em DXA
const FONT = "Arial";
const SZ = 24;                  // 12pt
const SZ10 = 20;                // 10pt
const LINE = 360;               // 1,5 entrelinhas
const INDENT = Math.round(1.25 * CM); // 709 (recuo 1a linha)
const TW = 9 * CM + 4 * CM;     // largura aproximada do conteudo (~13cm util)

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
// referencia (alinhada esquerda, simples, espaco depois)
function ref(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 240 },
    children: [new TextRun({ text, font: FONT, size: SZ })] });
}
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
  children: [run("Orientador: Prof. Dr. Rafael Leal Martins", { size: SZ10 })] }));
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
pretextual.push(center("Orientador: Prof. Dr. Rafael Leal Martins"));
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
pretextual.push(p("Ao meu orientador, Prof. Dr. Rafael Leal Martins, pela confiança, pelas orientações precisas e pelas valiosas contribuições para a construção deste trabalho."));
pretextual.push(p("Aos professores da Escola Politécnica e de Artes da Pontifícia Universidade Católica de Goiás, pelos conhecimentos compartilhados ao longo do curso de Engenharia de Computação."));
pretextual.push(p("Aos colegas de curso e de trabalho, pelas discussões técnicas, trocas de experiência e sugestões que enriqueceram esta pesquisa."));
pretextual.push(p("A todos que, direta ou indiretamente, contribuíram para a realização deste trabalho."));

// ---- EPIGRAFE ----
pretextual.push(new Paragraph({ pageBreakBefore: true, spacing: { line: LINE }, children: [run("")] }));
for (let i = 0; i < 18; i++) pretextual.push(blank());
pretextual.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 7 * CM }, spacing: { line: LINE },
  children: [run("“Simplicidade é o pré-requisito para a confiabilidade.”", { italics: true })] }));
pretextual.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { line: LINE },
  children: [run("Edsger W. Dijkstra", { italics: true })] }));

// ---- RESUMO ----
pretextual.push(htop("RESUMO"));
pretextual.push(p("A crescente adoção de arquiteturas baseadas em microsserviços e de aplicações conteinerizadas ampliou a complexidade dos processos de implantação, monitoramento e operação de software. Em muitos contextos, cada nova aplicação exige a configuração manual e repetitiva de pipelines de entrega, de mecanismos de monitoramento e de estratégias de recuperação, o que eleva o esforço operacional, a probabilidade de erros e a divergência entre ambientes. Este trabalho propõe e implementa uma plataforma padronizada para implantação automatizada e observabilidade de aplicações conteinerizadas, fundamentada na orquestração com Kubernetes, na prática de GitOps por meio do Argo CD e na instrumentação de telemetria com OpenTelemetry e Grafana. A proposta adota os princípios de Platform Engineering e o conceito de Golden Path, oferecendo um modelo (template) de infraestrutura no qual qualquer aplicação que siga um padrão mínimo é implantada, monitorada e observada automaticamente, dispondo ainda de mecanismos de rollback. Para validar a plataforma, foram implantadas duas aplicações de naturezas distintas — uma API de backend e uma aplicação web de frontend — sem alterações na infraestrutura subjacente. Os resultados indicam redução do esforço manual de implantação, padronização entre serviços e maior facilidade de observabilidade e de recuperação, evidenciando a viabilidade da abordagem como base reprodutível e escalável para a entrega de microsserviços."));
pretextual.push(blank());
pretextual.push(p([run("Palavras-chave: ", { bold: true }), run("Kubernetes. GitOps. Observabilidade. OpenTelemetry. Engenharia de Plataforma.")], { noIndent: true }));

// ---- ABSTRACT ----
pretextual.push(htop("ABSTRACT"));
pretextual.push(p("The growing adoption of microservice-based architectures and containerized applications has increased the complexity of software deployment, monitoring and operation. In many contexts, each new application requires manual and repetitive configuration of delivery pipelines, monitoring mechanisms and recovery strategies, which raises operational effort, the likelihood of errors and the divergence between environments. This work proposes and implements a standardized platform for automated deployment and observability of containerized applications, based on container orchestration with Kubernetes, on the GitOps practice through Argo CD, and on telemetry instrumentation with OpenTelemetry and Grafana. The proposal adopts Platform Engineering principles and the Golden Path concept, providing an infrastructure template in which any application that follows a minimal standard is automatically deployed, monitored and observed, while also having rollback mechanisms available. To validate the platform, two applications of different natures — a backend API and a web frontend — were deployed without changes to the underlying infrastructure. The results indicate a reduction in manual deployment effort, standardization across services, and greater ease of observability and recovery, demonstrating the feasibility of the approach as a reproducible and scalable foundation for microservice delivery."));
pretextual.push(blank());
pretextual.push(p([run("Keywords: ", { bold: true }), run("Kubernetes. GitOps. Observability. OpenTelemetry. Platform Engineering.")], { noIndent: true }));

// ---- LISTA DE ILUSTRACOES ----
pretextual.push(htop("LISTA DE ILUSTRAÇÕES"));
pretextual.push(new TableOfContents("Lista de ilustrações", { hyperlink: true, stylesWithLevels: [new StyleLevel("Legenda Figura", 1)] }));

// ---- LISTA DE QUADROS ----
pretextual.push(htop("LISTA DE QUADROS"));
pretextual.push(new TableOfContents("Lista de quadros", { hyperlink: true, stylesWithLevels: [new StyleLevel("Legenda Quadro", 1)] }));

// ---- LISTA DE ABREVIATURAS E SIGLAS ----
pretextual.push(htop("LISTA DE ABREVIATURAS E SIGLAS"));
[
  ["ABNT", "Associação Brasileira de Normas Técnicas"],
  ["API", "Application Programming Interface"],
  ["CD", "Continuous Delivery / Continuous Deployment"],
  ["CI", "Continuous Integration"],
  ["CNCF", "Cloud Native Computing Foundation"],
  ["CPU", "Central Processing Unit"],
  ["DevOps", "Development and Operations"],
  ["DNS", "Domain Name System"],
  ["GHCR", "GitHub Container Registry"],
  ["GitOps", "Git Operations"],
  ["HTTP", "HyperText Transfer Protocol"],
  ["IaC", "Infrastructure as Code"],
  ["K8s", "Kubernetes"],
  ["OCI", "Oracle Cloud Infrastructure"],
  ["OTel", "OpenTelemetry"],
  ["OTLP", "OpenTelemetry Protocol"],
  ["PaaS", "Platform as a Service"],
  ["REST", "Representational State Transfer"],
  ["SLA", "Service Level Agreement"],
  ["SLO", "Service Level Objective"],
  ["SPA", "Single Page Application"],
  ["SRE", "Site Reliability Engineering"],
  ["TCC", "Trabalho de Conclusão de Curso"],
  ["TLS", "Transport Layer Security"],
  ["VM", "Virtual Machine"],
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
textual.push(p("Como resposta a esse problema, emergiu a disciplina de Engenharia de Plataforma (Platform Engineering), cujo objetivo é construir plataformas internas de desenvolvimento que ofereçam aos times caminhos pavimentados — os chamados Golden Paths — para entregar software de maneira padronizada, autônoma e segura (SKELTON; PAIS, 2019). Em paralelo, a prática de GitOps propõe utilizar repositórios Git como fonte única da verdade para o estado desejado da infraestrutura, automatizando a reconciliação entre o que está declarado e o que está em execução no cluster (LIMONCELLI, 2018; ARGO, 2024)."));
textual.push(p("Este trabalho insere-se nesse contexto e propõe a construção de uma plataforma padronizada para implantação automatizada e observabilidade de aplicações conteinerizadas, integrando Kubernetes, GitOps (por meio do Argo CD) e telemetria com OpenTelemetry e Grafana. O foco do trabalho não está em uma aplicação específica, mas na infraestrutura que permite que qualquer aplicação aderente a um padrão mínimo seja implantada, monitorada e recuperada automaticamente."));

textual.push(h2("1.1", "Problema de pesquisa"));
textual.push(p("Em organizações que adotam microsserviços, cada nova aplicação frequentemente exige a recriação de toda a cadeia de implantação e operação: scripts de build, manifestos de implantação, configuração de monitoramento, definição de alertas e mecanismos de retorno a versões anteriores. Esse processo manual e não padronizado gera retrabalho, inconsistências entre ambientes, dependência de conhecimento individual e dificuldade de garantir que todos os serviços nasçam observáveis e resilientes. Diante disso, formula-se a seguinte questão de pesquisa: como projetar e implementar uma plataforma padronizada que permita que aplicações conteinerizadas sejam implantadas de forma automatizada e já nasçam observáveis e preparadas para rollback, reduzindo o esforço manual e a divergência entre serviços?"));

textual.push(h2("1.2", "Objetivo geral"));
textual.push(p("Propor e implementar uma plataforma padronizada de implantação automatizada e observabilidade para aplicações conteinerizadas, baseada em Kubernetes, GitOps e OpenTelemetry, de modo que qualquer aplicação aderente a um padrão mínimo seja implantada, monitorada e recuperada de forma automática e reprodutível."));

textual.push(h2("1.3", "Objetivos específicos"));
textual.push(p("Para alcançar o objetivo geral, definem-se os seguintes objetivos específicos:", { noIndent: true }));
textual.push(bullet("estudar os fundamentos de conteinerização, orquestração com Kubernetes, integração e entrega contínua, GitOps e observabilidade;"));
textual.push(bullet("definir um padrão mínimo (contrato) que as aplicações devem seguir para serem incorporadas à plataforma;"));
textual.push(bullet("projetar a arquitetura da plataforma, contemplando entrega contínua via Argo CD, telemetria com OpenTelemetry e visualização com Grafana;"));
textual.push(bullet("implementar um template (Golden Path) reutilizável que provisione implantação, observabilidade e rollback de forma automática;"));
textual.push(bullet("validar a plataforma por meio da implantação de duas aplicações de naturezas distintas (uma API de backend e um frontend web) sem alterações na infraestrutura;"));
textual.push(bullet("avaliar os resultados quanto à redução de esforço manual, padronização, observabilidade e capacidade de recuperação."));

textual.push(h2("1.4", "Justificativa"));
textual.push(p("A padronização da implantação e da operação de aplicações é um dos principais fatores associados ao desempenho de equipes de entrega de software de alto rendimento (FORSGREN; HUMBLE; KIM, 2018). A ausência de um caminho padronizado faz com que cada equipe reinvente soluções para problemas já resolvidos, aumentando o custo cognitivo e o tempo até a entrega de valor. Plataformas internas que oferecem capacidades de implantação, observabilidade e recuperação como serviço reduzem esse custo e permitem que os desenvolvedores se concentrem na lógica de negócio."));
textual.push(p("Do ponto de vista acadêmico, o trabalho integra conhecimentos de sistemas distribuídos, engenharia de software, redes e infraestrutura, alinhando-se às competências esperadas de um Engenheiro de Computação. Do ponto de vista prático, a plataforma proposta utiliza tecnologias amplamente adotadas pela indústria e mantidas por comunidades de código aberto sob a Cloud Native Computing Foundation, o que confere relevância e aplicabilidade direta ao resultado. Por fim, ao tratar a infraestrutura como produto reprodutível e independente da aplicação, o trabalho demonstra um modelo que pode ser reutilizado e estendido por outras equipes e projetos."));

textual.push(h2("1.5", "Metodologia"));
textual.push(p("Quanto à natureza, esta pesquisa caracteriza-se como aplicada; quanto aos objetivos, como exploratória e descritiva; e quanto aos procedimentos, adota a abordagem de pesquisa experimental com construção de artefato, na qual a plataforma é projetada, implementada e avaliada por meio de experimentos controlados. Os procedimentos metodológicos detalhados são apresentados no Capítulo 3."));

textual.push(h2("1.6", "Organização do trabalho"));
textual.push(p("Além desta introdução, o trabalho está organizado da seguinte forma. O Capítulo 2 apresenta o referencial teórico, abordando microsserviços, conteinerização, Kubernetes, integração e entrega contínua, GitOps, observabilidade e engenharia de plataforma, além dos trabalhos relacionados. O Capítulo 3 descreve a metodologia, incluindo a classificação da pesquisa, o ambiente, as ferramentas, as métricas de avaliação e os requisitos da plataforma. O Capítulo 4 apresenta o desenvolvimento da plataforma, detalhando sua arquitetura e seus componentes. O Capítulo 5 apresenta os resultados obtidos e a discussão. Por fim, o Capítulo 6 traz as conclusões e as propostas de trabalhos futuros. Os apêndices reúnem os manifestos do template, os templates de integração contínua, o roteiro de reconstrução da plataforma e o protocolo do experimento."));

// ---------- 2 REFERENCIAL TEORICO ----------
textual.push(h1("2", "REFERENCIAL TEÓRICO"));
textual.push(p("Este capítulo apresenta os fundamentos teóricos que sustentam a proposta. São discutidos os conceitos de microsserviços, conteinerização e Docker, orquestração com Kubernetes, integração e entrega contínua, GitOps e Argo CD, observabilidade e OpenTelemetry, visualização com Grafana e, por fim, engenharia de plataforma e Golden Paths, encerrando com os trabalhos relacionados."));

textual.push(h2("2.1", "Microsserviços e aplicações conteinerizadas"));
textual.push(p("A arquitetura de microsserviços consiste em estruturar uma aplicação como um conjunto de serviços pequenos, independentes e implantáveis de forma autônoma, cada um responsável por uma capacidade de negócio e comunicando-se por meio de mecanismos leves, geralmente APIs sobre HTTP ou mensageria (FOWLER; LEWIS, 2014). Esse estilo arquitetural contrapõe-se ao modelo monolítico, no qual toda a aplicação é construída e implantada como uma única unidade."));
textual.push(p("Segundo Newman (2021), os microsserviços favorecem a escalabilidade independente, a autonomia das equipes e a possibilidade de adotar tecnologias distintas por serviço. Em contrapartida, deslocam a complexidade para o espaço entre os serviços, exigindo maior maturidade em automação de implantação, monitoramento e tratamento de falhas. Richardson (2018) reforça que a viabilidade dos microsserviços depende fortemente de uma infraestrutura de entrega e de observabilidade robusta, sem a qual os benefícios são superados pelo custo operacional."));

textual.push(h2("2.2", "Docker e conteinerização"));
textual.push(p("Contêineres são uma forma de virtualização em nível de sistema operacional que empacota uma aplicação e suas dependências em uma unidade isolada, portável e leve, compartilhando o núcleo do sistema operacional hospedeiro (MERKEL, 2014). Diferentemente das máquinas virtuais, que emulam um sistema operacional completo, os contêineres iniciam rapidamente e consomem menos recursos, o que os torna adequados a arquiteturas com muitos serviços."));
textual.push(p("O Docker popularizou o uso de contêineres ao oferecer um formato de imagem e um conjunto de ferramentas para construí-los, distribuí-los e executá-los (MERKEL, 2014). Uma imagem de contêiner é descrita de forma declarativa por meio de um Dockerfile e armazenada em um registro, garantindo que o mesmo artefato seja executado de maneira consistente em diferentes ambientes — característica essencial para a reprodutibilidade buscada neste trabalho."));

textual.push(h2("2.3", "Kubernetes e orquestração de contêineres"));
textual.push(p("À medida que o número de contêineres cresce, gerenciá-los manualmente torna-se inviável. O Kubernetes é uma plataforma de código aberto para automação de implantação, escalonamento e gerenciamento de aplicações conteinerizadas (KUBERNETES, 2024). Ele organiza os contêineres em pods, distribui-os por um conjunto de nós e mantém continuamente o estado desejado declarado pelo usuário, recriando ou reposicionando cargas de trabalho em caso de falha."));
textual.push(p("O modelo de operação do Kubernetes é declarativo e baseado em reconciliação: o usuário descreve, em objetos como Deployments, Services e ConfigMaps, o estado que deseja alcançar, e o sistema atua de forma contínua para que o estado real corresponda ao estado declarado (BURNS; BEDA; HIGHTOWER, 2022). Esse paradigma é fundamental para a abordagem deste trabalho, pois permite tratar a infraestrutura como código versionável e auditável."));

textual.push(h2("2.4", "Integração e entrega contínua (CI/CD)"));
textual.push(p("A integração contínua (CI) é a prática de integrar frequentemente as alterações de código a um repositório compartilhado, validando-as por meio de builds e testes automatizados. A entrega contínua (CD) estende essa prática garantindo que o software esteja sempre em condições de ser implantado, automatizando o caminho desde o repositório até os ambientes de produção (HUMBLE; FARLEY, 2010)."));
textual.push(p("Humble e Farley (2010) argumentam que a automação do pipeline de entrega reduz o risco de cada implantação, encurta o tempo de retorno e torna as liberações de versão eventos rotineiros e previsíveis. Kim et al. (2016) complementam que a combinação de CI/CD com cultura DevOps melhora simultaneamente a estabilidade e a velocidade de entrega, desfazendo a falsa oposição entre os dois objetivos."));

textual.push(h2("2.5", "GitOps e Argo CD"));
textual.push(p("GitOps é uma abordagem operacional que utiliza repositórios Git como fonte única da verdade para a definição declarativa de infraestrutura e aplicações. Nessa abordagem, qualquer mudança no ambiente é feita por meio de alterações versionadas no repositório, e um agente automatizado reconcilia continuamente o estado do cluster com o estado declarado (ARGO, 2024). Entre as vantagens estão a auditabilidade, a facilidade de reversão (bastando reverter um commit) e a eliminação de alterações manuais não rastreadas."));
textual.push(p("O Argo CD é uma ferramenta de entrega contínua declarativa para Kubernetes que implementa o modelo GitOps. Ele monitora repositórios contendo os manifestos das aplicações e aplica automaticamente as diferenças ao cluster, sinalizando divergências entre o estado desejado e o estado observado e permitindo sincronização automática ou controlada (ARGO, 2024). Por implementar nativamente o conceito de reversão a estados anteriores, o Argo CD é peça central da estratégia de rollback adotada neste trabalho."));

textual.push(h2("2.6", "Observabilidade: logs, métricas e traces"));
textual.push(p("Observabilidade é a capacidade de inferir o estado interno de um sistema a partir de seus dados de saída, permitindo compreender e diagnosticar comportamentos sem a necessidade de antecipar todas as falhas possíveis (SRIDHARAN, 2018). Distingue-se do monitoramento tradicional por privilegiar a investigação de problemas desconhecidos, e não apenas a verificação de condições previamente definidas."));
textual.push(p("A observabilidade apoia-se em três sinais de telemetria, frequentemente chamados de pilares: logs, que registram eventos discretos; métricas, que representam medidas numéricas agregadas ao longo do tempo; e traces distribuídos, que acompanham uma requisição à medida que ela percorre múltiplos serviços (SRIDHARAN, 2018). O Quadro 1 sintetiza esses pilares."));
// Quadro 1
textual.push(legendaQuadro("Quadro 1 – Pilares da observabilidade"));
textual.push(quadroPilares());
textual.push(fonte("Fonte: adaptado de Sridharan (2018)."));

textual.push(h2("2.7", "OpenTelemetry"));
textual.push(p("O OpenTelemetry (OTel) é um projeto de código aberto, mantido pela Cloud Native Computing Foundation, que define um conjunto de APIs, bibliotecas, agentes e especificações para a geração, coleta e exportação de telemetria — métricas, logs e traces — de forma padronizada e independente de fornecedor (OPENTELEMETRY, 2024). Seu principal mérito é desacoplar a instrumentação da aplicação das ferramentas de análise: uma aplicação instrumentada com OpenTelemetry pode ter seus dados enviados a diferentes backends sem alteração de código."));
textual.push(p("Esse desacoplamento é estratégico para a plataforma proposta, pois permite que a instrumentação seja padronizada e, em grande parte, automatizada, de modo que as aplicações aderentes ao padrão produzam telemetria consistente sem que cada equipe precise configurar manualmente a coleta e a exportação dos dados."));

textual.push(h2("2.8", "Grafana e visualização de telemetria"));
textual.push(p("O Grafana é uma plataforma de código aberto para visualização e análise de dados de observabilidade, permitindo a construção de painéis (dashboards) que consolidam métricas, logs e traces provenientes de diferentes fontes (GRAFANA LABS, 2024). Por meio de consultas a backends de telemetria, o Grafana possibilita acompanhar o comportamento das aplicações em tempo real, definir alertas e correlacionar sinais distintos durante a investigação de incidentes."));
textual.push(p("Além da distribuição de código aberto, a Grafana Labs oferece o Grafana Cloud, serviço gerenciado que hospeda os backends de métricas (compatível com Prometheus), logs (Loki) e traces (Tempo), além do próprio Grafana e do sistema de alertas. A coleta no cluster é feita pelo Grafana Alloy, distribuição do OpenTelemetry Collector mantida pela Grafana Labs, capaz de receber telemetria pelo protocolo OTLP e de coletar métricas e logs do Kubernetes (GRAFANA LABS, 2026a; 2026b)."));
textual.push(p("Na plataforma proposta, o Grafana Cloud atua como camada de armazenamento e apresentação da observabilidade. Por estar fora do cluster, os dados e os alertas continuam disponíveis mesmo que o nó falhe, e o consumo de recursos na máquina virtual limita-se ao coletor. Os painéis de Kubernetes, filtráveis por namespace e workload, e as visões por serviço derivadas dos traces ficam disponíveis para qualquer aplicação incorporada, dispensando configuração individual e garantindo uma experiência uniforme de monitoramento."));

textual.push(h2("2.9", "Engenharia de plataforma e Golden Paths"));
textual.push(p("A Engenharia de Plataforma (Platform Engineering) é a disciplina dedicada a projetar e construir plataformas internas de desenvolvimento, que funcionam como produtos voltados aos desenvolvedores e abstraem a complexidade da infraestrutura subjacente (SKELTON; PAIS, 2019). O objetivo é reduzir a carga cognitiva das equipes de produto, oferecendo capacidades de autoatendimento para implantar, observar e operar aplicações."));
textual.push(p("Um conceito central nessa disciplina é o de Golden Path (caminho pavimentado): um trajeto recomendado, padronizado e bem suportado para realizar tarefas comuns, como criar e implantar um novo serviço. Ao seguir o Golden Path, a equipe obtém, sem esforço adicional, conformidade com boas práticas de implantação, observabilidade e segurança (SKELTON; PAIS, 2019). A plataforma proposta neste trabalho materializa um Golden Path para a implantação e a observabilidade de aplicações conteinerizadas."));

textual.push(h2("2.10", "Trabalhos relacionados"));
textual.push(p("Diversos estudos e iniciativas abordam a automação de implantação e a observabilidade em ambientes conteinerizados. Burns (2018) discute padrões reutilizáveis para sistemas distribuídos sobre orquestradores de contêineres, evidenciando a importância de abstrações que se repetem entre aplicações. Forsgren, Humble e Kim (2018) apresentam evidências empíricas de que práticas de automação de entrega e de medição contínua estão associadas a melhor desempenho organizacional."));
textual.push(p("No âmbito das ferramentas, a documentação do Argo CD (ARGO, 2024) e do OpenTelemetry (OPENTELEMETRY, 2024) descreve, respectivamente, a aplicação do modelo GitOps e a padronização de telemetria, mas o faz de forma isolada por componente. O presente trabalho diferencia-se por integrar esses elementos em uma única plataforma coesa, orientada à independência da aplicação e validada empiricamente com serviços de naturezas distintas, contribuindo com um modelo reprodutível que articula entrega contínua, observabilidade e recuperação."));

// ---------- 3 METODOLOGIA ----------
textual.push(h1("3", "METODOLOGIA"));
textual.push(p("Este capítulo descreve os procedimentos metodológicos adotados para projetar, implementar e avaliar a plataforma. São apresentados a classificação da pesquisa, o ambiente e as ferramentas utilizadas, as etapas de desenvolvimento, as métricas de avaliação e os requisitos da plataforma."));

textual.push(h2("3.1", "Classificação da pesquisa"));
textual.push(p("Quanto à natureza, a pesquisa é aplicada, pois objetiva gerar um artefato com utilidade prática. Quanto aos objetivos, é exploratória e descritiva, na medida em que investiga e descreve a construção e o comportamento da plataforma. Quanto à abordagem, é predominantemente qualitativa, com elementos quantitativos relativos às métricas de avaliação. Quanto aos procedimentos técnicos, adota-se a pesquisa experimental com construção de artefato, em que a solução é desenvolvida e submetida a experimentos controlados de validação."));

textual.push(h2("3.2", "Ambiente e ferramentas"));
textual.push(p("A plataforma foi construída sobre um cluster Kubernetes de nó único, utilizando ferramentas de código aberto consolidadas no ecossistema cloud native e serviços gerenciados de nível gratuito para armazenamento de imagens, segredos e telemetria. O Quadro 2 apresenta as ferramentas adotadas e seus respectivos papéis."));
textual.push(legendaQuadro("Quadro 2 – Ferramentas utilizadas na plataforma"));
textual.push(quadroFerramentas());
textual.push(fonte("Fonte: elaborado pelo autor."));
textual.push(p("O ambiente de execução é uma máquina virtual na Oracle Cloud Infrastructure (OCI), do tipo VM.Standard.A1.Flex (processador Ampere, arquitetura ARM64), com 2 vCPU e 12 GB de memória, dentro da camada gratuita do provedor, executando Ubuntu 24.04 LTS (ORACLE, 2026). Sobre ela foi instalado o k3s v1.36.4, distribuição leve e certificada do Kubernetes adequada a nó único (K3S, 2026), com persistência pela StorageClass local-path. Por ser ARM64, todas as imagens de contêiner são construídas para a plataforma linux/arm64."));
textual.push(p("Os componentes da plataforma e suas versões são: Argo CD v3.5.3 (ARGO, 2024); Kong Gateway 3.9, pelo chart kong/ingress 0.24.0, como implementação da Gateway API do Kubernetes e ponto de entrada HTTP/HTTPS (KONG, 2026); cert-manager v1.21.2, emitindo certificados Let’s Encrypt com validação DNS-01 no Cloudflare (CERT-MANAGER, 2026); Grafana Alloy v1.19.2, instalado pelo chart grafana/k8s-monitoring 4.5.2, enviando a telemetria ao Grafana Cloud (GRAFANA LABS, 2026a); e External Secrets Operator, que materializa no cluster os segredos guardados no OCI Vault (EXTERNAL SECRETS, 2026). A integração contínua é executada no GitHub Actions, com imagens publicadas no GitHub Container Registry (GHCR) e analisadas pelo Trivy (GITHUB, 2026; AQUA SECURITY, 2026)."));

textual.push(h2("3.3", "Etapas de desenvolvimento"));
textual.push(p("O desenvolvimento da plataforma foi organizado nas seguintes etapas:", { noIndent: true }));
textual.push(bullet("revisão bibliográfica sobre os fundamentos e ferramentas envolvidos;"));
textual.push(bullet("definição do padrão mínimo (contrato) a ser seguido pelas aplicações;"));
textual.push(bullet("projeto da arquitetura e da estrutura de repositórios da plataforma;"));
textual.push(bullet("implementação do template reutilizável de implantação e observabilidade;"));
textual.push(bullet("configuração da integração contínua com GitHub Actions, da entrega contínua com Argo CD e da telemetria com OpenTelemetry, Grafana Alloy e Grafana Cloud;"));
textual.push(bullet("implantação das aplicações de validação e execução dos experimentos;"));
textual.push(bullet("coleta e análise das métricas de avaliação."));

textual.push(h2("3.4", "Métricas de avaliação"));
textual.push(p("Para avaliar a plataforma, foram definidas métricas associadas aos objetivos do trabalho, sintetizadas no Quadro 3. A avaliação compara o cenário de implantação manual (sem a plataforma) com o cenário utilizando a plataforma proposta."));
textual.push(legendaQuadro("Quadro 3 – Métricas de avaliação da plataforma"));
textual.push(quadroMetricas());
textual.push(fonte("Fonte: elaborado pelo autor."));
textual.push(p("O protocolo de execução das medições, com as etapas, os instantes registrados e o número de repetições, é apresentado no Apêndice D. A carga de teste é gerada com a ferramenta k6 (GRAFANA LABS, 2026c)."));

textual.push(h2("3.5", "Requisitos da plataforma"));
textual.push(p("A plataforma atende a dois perfis de usuário. A equipe de plataforma mantém a infraestrutura comum — cluster, componentes compartilhados e template — e é a única a alterar o repositório da plataforma fora dos overlays das aplicações. As equipes de aplicação desenvolvem os serviços e os incorporam seguindo o contrato do Golden Path, sem acesso administrativo ao cluster e sem conhecimento detalhado de seus componentes."));
textual.push(p("A partir dos objetivos do trabalho e das necessidades desses perfis, foram definidos os requisitos funcionais, apresentados no Quadro 4, e os requisitos não funcionais, apresentados no Quadro 5. Cada requisito é verificado no Capítulo 5, o que torna a avaliação da plataforma objetiva e rastreável aos objetivos específicos."));
textual.push(legendaQuadro("Quadro 4 – Requisitos funcionais da plataforma"));
textual.push(quadroRequisitos([
  ["RF01", "Implantar uma aplicação a partir de uma alteração versionada no Git, sem comandos manuais no cluster."],
  ["RF02", "Construir, testar, analisar e publicar a imagem de cada aplicação a partir do commit, registrando a nova versão no repositório da plataforma."],
  ["RF03", "Reverter uma aplicação à versão estável anterior por meio da reversão do commit correspondente."],
  ["RF04", "Coletar métricas, logs e traces de toda aplicação incorporada, sem configuração individual na infraestrutura."],
  ["RF05", "Fornecer às aplicações os segredos de que necessitam a partir de um cofre externo ao Git."],
  ["RF06", "Expor as aplicações por HTTPS, com certificados emitidos e renovados automaticamente."],
  ["RF07", "Permitir a incorporação de uma nova aplicação apenas com os artefatos do contrato (Quadro 6)."],
]));
textual.push(fonte("Fonte: elaborado pelo autor."));
textual.push(legendaQuadro("Quadro 5 – Requisitos não funcionais da plataforma"));
textual.push(quadroRequisitos([
  ["RNF01", "Segurança: nenhum valor de segredo no Git; a esteira de integração contínua não possui credenciais do cluster; contêineres executados sem privilégios."],
  ["RNF02", "Reprodutibilidade: a plataforma pode ser reconstruída em uma nova máquina virtual a partir do Git e do roteiro do Apêndice C."],
  ["RNF03", "Auditabilidade: toda mudança no estado do cluster é rastreável a um commit."],
  ["RNF04", "Compatibilidade: imagens construídas para linux/arm64, arquitetura da máquina virtual."],
  ["RNF05", "Custo: operação dentro das camadas gratuitas dos serviços utilizados (OCI, GitHub e Grafana Cloud)."],
  ["RNF06", "Eficiência: componentes comuns com limites de recursos definidos, preservando capacidade para as aplicações no nó de 2 vCPU e 12 GB."],
  ["RNF07", "Independência da observabilidade: dados de telemetria e alertas mantidos fora do cluster, disponíveis mesmo com falha do nó."],
]));
textual.push(fonte("Fonte: elaborado pelo autor."));

// ---------- 4 DESENVOLVIMENTO ----------
textual.push(h1("4", "DESENVOLVIMENTO DA PLATAFORMA"));
textual.push(p("Este capítulo apresenta a plataforma proposta, descrevendo sua arquitetura geral, a estrutura de repositórios e o template (Golden Path), a padronização da conteinerização, a integração contínua, a implantação via GitOps e a gestão de segredos, a observabilidade automática, a estratégia de rollback e o processo de onboarding de novas aplicações."));

textual.push(h2("4.1", "Visão geral da arquitetura"));
textual.push(p("A plataforma é composta por quatro camadas integradas: (i) a camada de orquestração, provida pelo Kubernetes; (ii) a camada de entrega contínua, baseada em GitOps com o Argo CD; (iii) a camada de observabilidade, baseada em OpenTelemetry, Grafana Alloy e Grafana Cloud; e (iv) a camada de padronização, representada pelo template reutilizável que define o contrato das aplicações. A Figura 1 ilustra a arquitetura geral."));
textual.push(...figura("Figura 1 – Arquitetura geral da plataforma proposta",
  "[A PREENCHER: inserir o diagrama da arquitetura: GitHub (código e repositório da plataforma) e GitHub Actions publicando imagens no GHCR; Argo CD reconciliando o k3s na VM da OCI; Kong (Gateway API) e cert-manager na entrada; External Secrets Operator lendo o OCI Vault; aplicações instrumentadas com OpenTelemetry enviando telemetria ao Grafana Alloy, que a exporta ao Grafana Cloud.]"));
textual.push(p("O fluxo de funcionamento parte de uma alteração versionada no repositório Git, que descreve de forma declarativa o estado desejado das aplicações e da infraestrutura. O Argo CD detecta a alteração e reconcilia o cluster, aplicando as mudanças necessárias. As aplicações, ao serem executadas, emitem telemetria padronizada via OpenTelemetry, que é coletada pelo Grafana Alloy no cluster e exportada ao Grafana Cloud, onde painéis padronizados permitem o acompanhamento contínuo."));

textual.push(h2("4.2", "Estrutura de repositórios e template (Golden Path)"));
textual.push(p("A organização dos repositórios materializa o Golden Path da plataforma e segue a separação, comum em GitOps, entre código e configuração. Cada aplicação tem seu próprio repositório, com o código-fonte, o Dockerfile e um arquivo curto de integração contínua que apenas parametriza um template compartilhado. Os templates de integração contínua, um para serviços de backend e outro para front-ends, ficam no repositório tcc-pipeline-templates, de modo que a esteira é definida uma única vez e reutilizada por todas as aplicações. Um único repositório de plataforma, tcc-platform, reúne tudo o que o Argo CD aplica ao cluster: os componentes comuns, o template do Golden Path e o overlay de cada aplicação, que é o único ponto em que a esteira de uma aplicação escreve. A estrutura adotada é apresentada a seguir e ilustrada na Figura 2."));
textual.push(codeBlock([
  "tcc-platform/                # repositorio da plataforma (lido pelo Argo CD)",
  "   bootstrap/                # unico apply manual: instala o Argo CD",
  "   clusters/oci-k3s/         # Application raiz (app-of-apps)",
  "   platform/                 # componentes comuns",
  "      ingress/  cert-manager/  external-secrets/  observability/  argocd-projects/",
  "   golden-path/base/         # Deployment, Service, probes, resources, OTel",
  "   apps/<aplicacao>/         # overlay de cada aplicacao (tag da imagem)",
  "tcc-pipeline-templates/      # templates de CI compartilhados",
  "   .github/workflows/backend-service.yml",
  "   .github/workflows/frontend-service.yml",
  "catalogo-api/                # API de Produtos: codigo, Dockerfile e ci.yml",
  "catalogo-front/              # Frontend de Catalogo: codigo, Dockerfile e ci.yml",
]));
textual.push(...figura("Figura 2 – Estrutura de repositórios e do template (Golden Path)",
  "[A PREENCHER: inserir captura ou diagrama da estrutura de diretórios real do projeto.]"));
textual.push(p("Cada aplicação precisa fornecer apenas um conjunto mínimo de artefatos para ser incorporada à plataforma. Esse contrato é sintetizado no Quadro 6 e detalhado na Seção 4.9. Os manifestos do template base são apresentados no Apêndice A."));

textual.push(h2("4.3", "Conteinerização padronizada"));
textual.push(p("A primeira exigência do contrato é que a aplicação seja conteinerizada de acordo com um padrão. Para isso, define-se um Dockerfile de referência e convenções de construção de imagem, garantindo que todas as imagens sigam práticas comuns de tamanho reduzido, execução com privilégios mínimos e exposição padronizada de portas e de endpoints de saúde (health checks). Dessa forma, o orquestrador pode verificar a disponibilidade das aplicações de maneira uniforme."));

textual.push(h2("4.4", "Integração contínua e publicação de imagens"));
textual.push(p("A integração contínua é executada no GitHub Actions por meio de workflows reutilizáveis. O repositório tcc-pipeline-templates define dois templates, backend-service e frontend-service, e o repositório de cada aplicação contém apenas um arquivo que referencia o template adequado e informa seus parâmetros, como o diretório do overlay e a versão do runtime. Assim, uma melhoria na esteira é feita em um único lugar e passa a valer para todas as aplicações, o que reforça a padronização buscada pelo Golden Path. A cada alteração, a esteira executa os testes automatizados, analisa o código e as dependências com o Trivy em busca de vulnerabilidades, constrói a imagem para linux/arm64, analisa a imagem resultante e a publica no GHCR com uma etiqueta imutável derivada do commit (GITHUB, 2026; AQUA SECURITY, 2026). Uma vulnerabilidade crítica interrompe a esteira antes da publicação. Os templates e o arquivo de uma aplicação são apresentados no Apêndice B."));
textual.push(p("A esteira não acessa o cluster. Sua última etapa é registrar a nova etiqueta da imagem no overlay Kustomize correspondente, por meio de um commit no repositório da plataforma. Dessa forma, a implantação continua sendo uma consequência de uma alteração versionada no Git, e o cluster não precisa expor credenciais administrativas a sistemas externos: é o Argo CD, de dentro do cluster, que busca o novo estado desejado."));

textual.push(h2("4.5", "Implantação via GitOps com Argo CD"));
textual.push(p("A implantação é realizada de forma declarativa e automatizada por meio do Argo CD. Para cada aplicação, define-se um objeto Application que aponta para o repositório e o diretório contendo seus manifestos. O Argo CD reconcilia continuamente o estado do cluster com o estado declarado, conforme ilustrado na Figura 3."));
textual.push(...figura("Figura 3 – Fluxo de integração e entrega contínua com GitOps (Argo CD)",
  "[A PREENCHER: inserir o diagrama do fluxo: commit no código → GitHub Actions (testes, Trivy, build arm64, push no GHCR) → commit da nova etiqueta no overlay → detecção pelo Argo CD → sincronização/reconciliação → estado aplicado no cluster.]"));
textual.push(p("Como o estado desejado reside integralmente no Git, toda implantação é auditável e reversível. Não há intervenção manual no cluster: alterações são propostas, revisadas e versionadas no repositório, o que reduz erros operacionais e elimina divergências entre ambientes."));
textual.push(p("A exposição das aplicações utiliza a Gateway API do Kubernetes, implementada pelo Kong, e não o recurso Ingress. A plataforma mantém o Gateway, com os pontos de escuta HTTPS de cada host e os respectivos certificados, enquanto cada aplicação declara apenas um HTTPRoute em seu overlay, indicando o host e o serviço de destino. Essa divisão reproduz na própria API do cluster a separação entre a equipe de plataforma e as equipes de aplicação descrita na Seção 3.5 (KUBERNETES, 2024; KONG, 2026)."));

textual.push(h2("4.6", "Gestão de segredos"));
textual.push(p("Credenciais como senhas de banco de dados e chaves de acesso não podem ser versionadas no Git, mas a implantação continua precisando delas. Para conciliar as duas exigências, os valores são armazenados no OCI Vault, serviço de cofre de segredos da Oracle Cloud, e o External Secrets Operator os materializa como Secrets do Kubernetes (ORACLE, 2026; EXTERNAL SECRETS, 2026). No Git ficam apenas objetos ExternalSecret, que declaram quais segredos do cofre devem originar quais chaves no cluster, sem conter nenhum valor."));
textual.push(p("A autenticação do operador junto à OCI é feita por Instance Principal: a própria máquina virtual se identifica perante o provedor, e uma política concede a ela somente a leitura dos segredos do cofre. Assim, nenhuma credencial do provedor é armazenada dentro do cluster. A troca de um valor no cofre é propagada automaticamente na próxima sincronização, sem commit e sem acesso manual ao cluster."));

textual.push(h2("4.7", "Observabilidade automática"));
textual.push(p("A observabilidade é incorporada por padrão, sem exigir configuração individual por aplicação. A instrumentação com OpenTelemetry coleta métricas, logs e traces, que são enviados pelo protocolo OTLP ao Grafana Alloy, distribuição do OpenTelemetry Collector executada no cluster, e exportados por ele ao Grafana Cloud. O mesmo coletor obtém as métricas do cluster e os logs de todos os contêineres, sem configuração por aplicação. Sempre que a tecnologia da aplicação permite, adota-se a instrumentação automática (zero-code) do OpenTelemetry, na qual a telemetria é habilitada por configuração externa, sem alterar o código-fonte da aplicação — abordagem que reforça o princípio de que os serviços nascem observáveis ao aderir ao Golden Path. A Figura 4 apresenta a pipeline de telemetria."));
textual.push(...figura("Figura 4 – Pipeline de telemetria com OpenTelemetry e Grafana",
  "[A PREENCHER: inserir o diagrama da pipeline: aplicação instrumentada (OTel SDK) → OTLP → Grafana Alloy no cluster → Grafana Cloud (Prometheus/Mimir, Loki, Tempo) → Grafana.]"));
textual.push(p("Os painéis de Kubernetes do Grafana Cloud e as visões por serviço geradas a partir dos traces ficam disponíveis assim que a aplicação passa a emitir telemetria, de modo que qualquer aplicação incorporada à plataforma dispõe de métricas de pod e de aplicação, logs centralizados e traces distribuídos. Painéis específicos de negócio, quando necessários, são criados sobre esses mesmos dados. A Figura 5 ilustra um exemplo de dashboard."));
textual.push(...figura("Figura 5 – Dashboard de observabilidade no Grafana",
  "[A PREENCHER: inserir captura de tela de um dashboard do Grafana com os dados de uma das aplicacoes de validacao.]"));

textual.push(h2("4.8", "Estratégia de rollback"));
textual.push(p("A estratégia de recuperação aproveita o modelo declarativo e versionado da plataforma. Como o estado desejado é definido no Git, o retorno a uma versão anterior estável é realizado revertendo-se a alteração correspondente, fazendo com que o Argo CD reconcilie o cluster ao estado anterior. Adicionalmente, as verificações de saúde permitem identificar implantações com problemas, conforme demonstrado na Figura 6."));
textual.push(...figura("Figura 6 – Demonstração de rollback por reversão no Git",
  "[A PREENCHER: inserir evidencia do rollback: estado da aplicacao antes, durante a falha e apos a reversao, conforme exibido no Argo CD e/ou no Grafana.]"));

textual.push(h2("4.9", "Onboarding de novas aplicações"));
textual.push(p("O processo de incorporação de uma nova aplicação resume-se a seguir o Golden Path: a equipe fornece o Dockerfile padronizado, os manifestos a partir do template base e adota a instrumentação de OpenTelemetry prevista no padrão. A partir disso, a aplicação é automaticamente implantada pelo Argo CD, passa a emitir telemetria e a dispor de dashboards e de rollback, sem qualquer alteração na infraestrutura da plataforma. O Quadro 6 sintetiza os requisitos mínimos de onboarding."));
textual.push(legendaQuadro("Quadro 6 – Requisitos mínimos para onboarding de uma aplicação"));
textual.push(quadroOnboarding());
textual.push(fonte("Fonte: elaborado pelo autor."));

// ---------- 5 RESULTADOS ----------
textual.push(h1("5", "RESULTADOS E DISCUSSÃO"));
textual.push(p("Este capítulo apresenta os resultados obtidos com a validação da plataforma e a discussão à luz dos objetivos do trabalho. A validação consistiu na implantação de duas aplicações de naturezas distintas — uma API de backend e um frontend web — sem alterações na infraestrutura, seguida da coleta das métricas definidas no Capítulo 3."));
textual.push(new Paragraph({ spacing: { line: LINE, after: 120 }, children: [
  run("Observação: ", { bold: true }),
  ph("Este capítulo deve ser preenchido com os dados reais obtidos nos seus experimentos. A seguir, a estrutura sugerida e o que registrar em cada seção.")] }));

textual.push(h2("5.1", "Aplicações de validação"));
textual.push(p("Para validar a plataforma, foi implementado um catálogo de produtos, um sistema de domínio reconhecível e propositalmente simples em sua lógica de negócio, composto por duas aplicações de naturezas distintas. O objetivo não está na complexidade das aplicações, mas em demonstrar que serviços com características de execução diferentes são incorporados à plataforma seguindo o mesmo Golden Path, sem alterações na infraestrutura. As aplicações são descritas a seguir e sintetizadas no Quadro 7."));
textual.push(bullet("API de Produtos (ASP.NET Core): serviço HTTP REST responsável pelas operações de cadastro e listagem de produtos, oferecendo endpoints para criar, listar, detalhar, editar e remover produtos (por exemplo, POST /produtos, GET /produtos, GET /produtos/{id}, PUT /produtos/{id} e DELETE /produtos/{id}), com persistência em banco de dados. Representa uma carga de trabalho síncrona de backend, implantada como Deployment e exposta por um Service, exercitando métricas de latência, throughput e códigos de status HTTP (MICROSOFT, 2024)."));
textual.push(bullet("Frontend de Catálogo (Angular): aplicação web de página única (SPA) que consome a API e oferece as telas de cadastro de produto e de listagem, com busca e filtragem. Representa uma aplicação de interface, executada no navegador e servida como conteúdo estático por um contêiner exposto pelo Kong. Sua observabilidade na plataforma vem dos logs e métricas do contêiner e de verificações sintéticas de disponibilidade da rota pública (GOOGLE, 2024)."));
textual.push(p("Embora compartilhem o mesmo domínio, as duas aplicações possuem formatos de implantação distintos no Kubernetes — um serviço de backend que recebe tráfego e um frontend estático servido ao navegador —, o que permite avaliar a generalidade da plataforma. Como ambas participam de um mesmo fluxo (do cadastro na interface à persistência pela API), a instrumentação com OpenTelemetry da API possibilita observar, para cada requisição originada no frontend, um trace que vai da entrada na API até o banco de dados, conforme discutido na Seção 4.7. As duas aplicações foram incorporadas à plataforma seguindo exclusivamente o contrato definido no Quadro 6, sem qualquer modificação na infraestrutura."));
textual.push(legendaQuadro("Quadro 7 – Aplicações de validação e suas naturezas"));
textual.push(quadroAppsValidacao());
textual.push(fonte("Fonte: elaborado pelo autor."));

textual.push(h2("5.2", "Esforço e tempo de implantação"));
textual.push(p([run("Apresente a comparação entre implantar manualmente e implantar pela plataforma. ", {}),
  ph("[A PREENCHER: número de passos manuais, tempo até a primeira implantação e quantidade de arquivos/configurações necessários em cada cenário; inserir tabela comparativa.]")]));

textual.push(h2("5.3", "Observabilidade obtida"));
textual.push(p([run("Evidencie que as aplicações nasceram observáveis. ", {}),
  ph("[A PREENCHER: capturas dos dashboards do Grafana com métricas, logs e traces das duas aplicações, indicando que nenhuma configuração adicional foi necessária.]")]));

textual.push(h2("5.4", "Teste de rollback e resiliência"));
textual.push(p([run("Relate o experimento de falha e recuperação. ", {}),
  ph("[A PREENCHER: descrição da falha injetada, tempo de detecção, tempo de recuperação via reversão no Git/Argo CD e evidências do retorno ao estado estável.]")]));

textual.push(h2("5.5", "Discussão"));
textual.push(p("Os resultados devem ser discutidos em relação aos objetivos específicos e às métricas do Quadro 3, evidenciando a redução do esforço manual, a padronização entre serviços, a observabilidade obtida sem configuração adicional e a capacidade de recuperação. Recomenda-se também discutir as limitações observadas e a generalização dos achados."));
textual.push(p([ph("[A PREENCHER: quadro de verificação dos requisitos dos Quadros 4 e 5 (atendido, parcialmente atendido ou não atendido, com a evidência de cada um); síntese crítica dos resultados e confronto com os trabalhos relacionados do Capítulo 2.]")]));

textual.push(h2("5.6", "Limitações"));
textual.push(p("O experimento foi conduzido em um cluster de nó único. O Kubernetes recupera automaticamente contêineres e pods que falham, mas não protege contra a falha da própria máquina virtual: uma pane, uma reinicialização ou uma manutenção do provedor interrompe todas as aplicações e os próprios componentes da plataforma, inclusive o Argo CD. Pelo mesmo motivo, réplicas e escalonamento horizontal aumentam a capacidade, mas não oferecem alta disponibilidade, pois todas as cópias residem no mesmo nó."));
textual.push(p("A persistência utiliza a StorageClass local-path, que grava os volumes em um diretório do disco da máquina virtual. O banco de dados da API fica, portanto, vinculado a esse nó: não pode ser movido para outro e é perdido junto com o disco. Essa forma de armazenamento não substitui um volume distribuído nem dispensa uma rotina de backup."));
textual.push(p("Além disso, a telemetria depende da camada gratuita do Grafana Cloud, cujas cotas e retenção são definidas pelo serviço, e da conectividade da máquina virtual com a internet. Essas limitações não afetam o objetivo do trabalho, que é avaliar a viabilidade e a padronização da implantação e da observabilidade, e não o desempenho ou a disponibilidade de um ambiente de produção em larga escala; a extensão para múltiplos nós e armazenamento distribuído é indicada como trabalho futuro."));

// ---------- 6 CONCLUSAO ----------
textual.push(h1("6", "CONCLUSÃO"));
textual.push(p("Este trabalho propôs e implementou uma plataforma padronizada para implantação automatizada e observabilidade de aplicações conteinerizadas, integrando Kubernetes, GitOps por meio do Argo CD e telemetria com OpenTelemetry e Grafana, sob os princípios de Engenharia de Plataforma e do conceito de Golden Path. Ao deslocar o foco da aplicação para a infraestrutura que a sustenta, a plataforma demonstrou ser possível que qualquer aplicação aderente a um padrão mínimo seja implantada, monitorada e recuperada de forma automática e reprodutível."));
textual.push(p([run("A validação com duas aplicações de naturezas distintas — uma API de backend e um frontend web — ", {}),
  ph("[ajustar conforme os resultados]"), run(" indicou que a abordagem reduz o esforço manual de implantação, promove a padronização entre serviços e facilita a observabilidade e a recuperação, atendendo aos objetivos propostos. Conclui-se que a construção de uma plataforma interna padronizada constitui uma alternativa viável e escalável para a entrega de microsserviços, alinhada às práticas adotadas pela indústria.", {})]));

textual.push(h2("6.1", "Trabalhos futuros"));
textual.push(p("Como continuidade, sugerem-se: a incorporação de políticas de admissão no cluster e de assinatura de imagens ao Golden Path, complementando a análise de vulnerabilidades já executada na esteira; a adoção de estratégias avançadas de implantação, como canário e blue-green; a integração de um catálogo de autoatendimento para desenvolvedores; a definição de SLOs e de alertas padronizados; a extensão para um cluster de múltiplos nós com armazenamento distribuído e backup automatizado; e a avaliação da plataforma em ambientes de produção com maior volume de serviços e de tráfego."));

// ---------- REFERENCIAS ----------
textual.push(htop("REFERÊNCIAS", true));
const referencias = [
  "AQUA SECURITY. Trivy documentation. [S. l.]: Aqua Security, 2026. Disponível em: https://trivy.dev/docs/. Acesso em: 13 out. 2026.",
  "ARGO. Argo CD – Declarative GitOps CD for Kubernetes. [S. l.]: The Argo Project, 2024. Disponível em: https://argo-cd.readthedocs.io. Acesso em: 3 jun. 2026.",
  "BURNS, Brendan. Designing distributed systems: patterns and paradigms for scalable, reliable services. Sebastopol: O’Reilly Media, 2018.",
  "BURNS, Brendan; BEDA, Joe; HIGHTOWER, Kelsey. Kubernetes: up and running. 3. ed. Sebastopol: O’Reilly Media, 2022.",
  "CERT-MANAGER. cert-manager documentation. [S. l.]: The cert-manager Authors / Cloud Native Computing Foundation, 2026. Disponível em: https://cert-manager.io/docs/. Acesso em: 13 out. 2026.",
  "EXTERNAL SECRETS. External Secrets Operator documentation. [S. l.]: The External Secrets Authors, 2026. Disponível em: https://external-secrets.io. Acesso em: 13 out. 2026.",
  "FORSGREN, Nicole; HUMBLE, Jez; KIM, Gene. Accelerate: the science of lean software and DevOps. Portland: IT Revolution Press, 2018.",
  "FOWLER, Martin; LEWIS, James. Microservices: a definition of this new architectural term. 2014. Disponível em: https://martinfowler.com/articles/microservices.html. Acesso em: 3 jun. 2026.",
  "GITHUB. GitHub Actions documentation. [S. l.]: GitHub, 2026. Disponível em: https://docs.github.com/actions. Acesso em: 13 out. 2026.",
  "GOOGLE. Angular documentation. [S. l.]: Google, 2024. Disponível em: https://angular.dev. Acesso em: 3 jun. 2026.",
  "GRAFANA LABS. Grafana documentation. [S. l.]: Grafana Labs, 2024. Disponível em: https://grafana.com/docs/. Acesso em: 3 jun. 2026.",
  "GRAFANA LABS. Grafana Alloy documentation. [S. l.]: Grafana Labs, 2026a. Disponível em: https://grafana.com/docs/alloy/latest/. Acesso em: 13 out. 2026.",
  "GRAFANA LABS. Grafana Cloud documentation. [S. l.]: Grafana Labs, 2026b. Disponível em: https://grafana.com/docs/grafana-cloud/. Acesso em: 13 out. 2026.",
  "GRAFANA LABS. k6 documentation. [S. l.]: Grafana Labs, 2026c. Disponível em: https://grafana.com/docs/k6/latest/. Acesso em: 13 out. 2026.",
  "HUMBLE, Jez; FARLEY, David. Continuous delivery: reliable software releases through build, test, and deployment automation. Boston: Addison-Wesley, 2010.",
  "K3S. K3s: lightweight Kubernetes documentation. [S. l.]: The K3s Authors / Cloud Native Computing Foundation, 2026. Disponível em: https://docs.k3s.io. Acesso em: 13 out. 2026.",
  "KIM, Gene; HUMBLE, Jez; DEBOIS, Patrick; WILLIS, John. The DevOps handbook: how to create world-class agility, reliability, and security in technology organizations. Portland: IT Revolution Press, 2016.",
  "KONG. Kong Ingress Controller documentation. [S. l.]: Kong Inc., 2026. Disponível em: https://developer.konghq.com/kubernetes-ingress-controller/. Acesso em: 13 out. 2026.",
  "KUBERNETES. Kubernetes documentation. [S. l.]: The Kubernetes Authors / Cloud Native Computing Foundation, 2024. Disponível em: https://kubernetes.io/docs/. Acesso em: 3 jun. 2026.",
  "LIMONCELLI, Thomas A. GitOps: a path to more self-service IT. Communications of the ACM, New York, v. 61, n. 9, p. 38-42, 2018.",
  "MERKEL, Dirk. Docker: lightweight Linux containers for consistent development and deployment. Linux Journal, Houston, v. 2014, n. 239, 2014.",
  "MICROSOFT. .NET documentation. [S. l.]: Microsoft, 2024. Disponível em: https://learn.microsoft.com/dotnet/. Acesso em: 3 jun. 2026.",
  "NEWMAN, Sam. Building microservices: designing fine-grained systems. 2. ed. Sebastopol: O’Reilly Media, 2021.",
  "OPENTELEMETRY. OpenTelemetry documentation. [S. l.]: Cloud Native Computing Foundation, 2024. Disponível em: https://opentelemetry.io/docs/. Acesso em: 3 jun. 2026.",
  "ORACLE. Oracle Cloud Infrastructure documentation. [S. l.]: Oracle, 2026. Disponível em: https://docs.oracle.com/iaas/. Acesso em: 13 out. 2026.",
  "RICHARDSON, Chris. Microservices patterns: with examples in Java. Shelter Island: Manning Publications, 2018.",
  "SKELTON, Matthew; PAIS, Manuel. Team topologies: organizing business and technology teams for fast flow. Portland: IT Revolution Press, 2019.",
  "SRIDHARAN, Cindy. Distributed systems observability: a guide to building robust systems. Sebastopol: O’Reilly Media, 2018.",
];
referencias.forEach(r => textual.push(ref(r)));

// ---------- APENDICES ----------
textual.push(htop("APÊNDICE A – MANIFESTOS BASE DO GOLDEN PATH", true));
textual.push(p("Este apêndice apresenta os manifestos do diretório golden-path/base do repositório tcc-platform, dos quais derivam os overlays de todas as aplicações incorporadas à plataforma."));
textual.push(p([ph("[A PREENCHER após a implementação: kustomization.yaml, deployment.yaml (probes, resources, securityContext e variáveis OpenTelemetry), service.yaml e o exemplo de ExternalSecret, como blocos de código.]")]));

textual.push(htop("APÊNDICE B – TEMPLATES DE INTEGRAÇÃO CONTÍNUA", true));
textual.push(p("Este apêndice apresenta os templates de integração contínua do repositório tcc-pipeline-templates (backend-service e frontend-service) e o arquivo ci.yml com que cada aplicação de validação os consome: testes, análise de vulnerabilidades com o Trivy, construção da imagem linux/arm64, publicação no GHCR e registro da nova etiqueta no overlay da aplicação no repositório da plataforma."));
textual.push(p([ph("[A PREENCHER após a validação: conteúdo final de backend-service.yml, frontend-service.yml e de um ci.yml de aplicação, como blocos de código.]")]));

textual.push(htop("APÊNDICE C – ROTEIRO DE RECONSTRUÇÃO DA PLATAFORMA", true));
textual.push(p("Este apêndice resume o roteiro para reconstruir a plataforma em uma nova máquina virtual, condição para o requisito de reprodutibilidade (RNF02). Cada fase termina com uma verificação objetiva, e a fase seguinte só é iniciada após a anterior ser verificada."));
[
  ["Fase 1 – Máquina virtual.", "Criar a instância VM.Standard.A1.Flex (2 OCPU, 12 GB) com Ubuntu 24.04 ARM64 e endereço IP público reservado; liberar na lista de segurança as portas 22 e 6443 apenas para o IP administrativo e as portas 80 e 443 para a internet; abrir as mesmas portas no firewall da própria máquina. Verificação: acesso SSH e resposta das portas a partir de fora da VM."],
  ["Fase 2 – k3s.", "Instalar o k3s v1.36.4 com o IP privado como endereço do nó e o IP público como nome alternativo do certificado da API, desabilitando o Traefik embutido. Verificação: nó em estado Ready e kubectl funcional a partir da máquina de administração."],
  ["Fase 3 – Entrada HTTP.", "Instalar os CRDs da Gateway API e, em seguida, o Kong pelo chart kong/ingress, com o roteador compatível com o modelo tradicional e a política de tráfego externo local, para preservar o IP real dos clientes; criar a GatewayClass e o Gateway da plataforma. Verificação: o Gateway aceito pelo controlador, com o IP público, e resposta 404 a uma rota inexistente."],
  ["Fase 4 – DNS e certificados.", "Delegar o domínio ao Cloudflare, criar um token restrito à zona e instalar o cert-manager com emissores Let's Encrypt de homologação e produção por validação DNS-01. Verificação: emissão de um certificado de homologação e teste de roteamento com serviços de exemplo."],
  ["Fase 5 – GitOps.", "Instalar o Argo CD (único apply manual), registrar o acesso ao repositório tcc-platform e aplicar a Application raiz; a partir daí, os demais componentes são reconciliados a partir do Git. Verificação: Application raiz Synced e Healthy, e uma alteração inofensiva no Git reconciliada sem comando manual."],
  ["Fase 6 – Segredos.", "Criar na OCI o Vault (sem a opção de cofre privado virtual, que é paga), uma chave de software, o grupo dinâmico com o OCID da VM e a política de leitura de segredos; o External Secrets Operator e o ClusterSecretStore são aplicados pelo Argo CD. Verificação: um ExternalSecret de teste gera o Secret correspondente."],
  ["Fase 7 – Observabilidade.", "Instalar o Grafana Alloy pelo chart grafana/k8s-monitoring com o token do Grafana Cloud e habilitar o receptor OTLP. Verificação: métricas do nó e logs dos pods visíveis no Grafana Cloud e um trace de teste recebido no Tempo."],
  ["Fase 8 – Aplicações.", "Incorporar cada aplicação pelo contrato do Golden Path: overlay em apps/<aplicação>, segredos no Vault e, no repositório da aplicação, o ci.yml que consome o template de integração contínua. Verificação: aplicação Healthy no Argo CD, acessível por HTTPS e emitindo telemetria."],
].forEach(([fase, texto]) => textual.push(p([run(fase + " ", { bold: true }), run(texto)])));
textual.push(p("O roteiro completo, com os comandos, as versões fixadas e os arquivos de configuração, é mantido no repositório da plataforma."));

textual.push(htop("APÊNDICE D – PROTOCOLO DO EXPERIMENTO", true));
textual.push(p("Este apêndice descreve o protocolo de coleta das métricas do Quadro 3. Todas as medições partem da plataforma já verificada (Apêndice C) e são registradas com data, hora e o commit correspondente."));
[
  ["Etapa 1 – Implantação de referência, sem a plataforma.", "Implantar a API de Produtos manualmente: construção e publicação da imagem, criação dos manifestos, aplicação no cluster e configuração do monitoramento. Registrar o número de passos, o número de arquivos criados ou alterados e o tempo total."],
  ["Etapa 2 – Onboarding pelo Golden Path.", "Para cada aplicação de validação, cronometrar do início do onboarding até o estado Healthy no Argo CD. Registrar passos, arquivos alterados (git diff --stat) e se algum arquivo fora de apps/<aplicação> precisou ser alterado; essa ocorrência caracteriza uma falha do Golden Path e é relatada como resultado."],
  ["Etapa 3 – Observabilidade.", "Gerar carga com o k6 sobre as rotas da API e do frontend por um período fixo. Verificar, sem nenhuma configuração adicional, a presença de métricas, logs e traces de cada aplicação no Grafana Cloud e o tempo entre a implantação e o primeiro dado recebido."],
  ["Etapa 4 – Falha e recuperação.", "Publicar pela esteira uma versão deliberadamente defeituosa da API. Registrar o instante do commit defeituoso (t0), da detecção da falha no Argo CD ou por alerta (t1), do commit de reversão (t2) e do retorno ao estado Healthy (t3). O tempo de recuperação é t3 − t1, e o tempo de reconciliação após a reversão é t3 − t2."],
  ["Etapa 5 – Repetições.", "Repetir as etapas 2 e 4 três vezes e apresentar os resultados em tabelas, com média e valores mínimo e máximo."],
].forEach(([etapa, texto]) => textual.push(p([run(etapa + " ", { bold: true }), run(texto)])));

// ---------- ANEXO ----------
textual.push(htop("ANEXO A – TERMO DE AUTORIZAÇÃO DE PUBLICAÇÃO DE PRODUÇÃO ACADÊMICA", true));
textual.push(p([ph("[A PREENCHER na versão final, após a defesa: inserir o Termo de autorização de publicação de produção acadêmica (Anexo B do Manual de TCC da Escola Politécnica e de Artes), preenchido e assinado, exigido para a submissão ao Repositório Acadêmico da Graduação (RAG).]")]));

// ---- quadros (tabelas) ----
function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.w, type: WidthType.DXA },
    shading: opts.head ? { type: ShadingType.CLEAR, fill: "D9D9D9" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { line: 240 }, alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, font: FONT, size: SZ10, bold: opts.head })] })],
  });
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
// figura: legenda em cima (fonte 12), area da imagem com moldura, fonte embaixo (fonte 10)
function figura(titulo, instrucao, origem = "Fonte: elaborado pelo autor.") {
  const borda = { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 };
  return [
    new Paragraph({ style: "LegendaFigura", children: [run(titulo)] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE, before: 60, after: 60 },
      border: { top: borda, bottom: borda, left: borda, right: borda },
      children: [new TextRun({ text: instrucao, font: FONT, size: SZ, italics: true, color: "C00000" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, after: 240 }, children: [run(origem, { size: SZ10 })] }),
  ];
}
function codeBlock(lines) {
  return new Paragraph({
    spacing: { before: 120, after: 120, line: 240 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
    children: lines.flatMap((l, i) => {
      const r = [new TextRun({ text: l, font: "Consolas", size: SZ10 })];
      if (i < lines.length - 1) r.push(new TextRun({ text: "", break: 1 }));
      return r;
    }),
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
    // Secao 1: pre-textuais (sem numeracao de pagina)
    {
      properties: { page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 3 * CM, right: 2 * CM, bottom: 2 * CM, left: 3 * CM },
      } },
      children: pretextual,
    },
    // Secao 2: textuais e pos-textuais (numeracao no canto superior direito)
    {
      properties: { page: {
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
  fs.writeFileSync("TCC - Esteira Kubernetes - COMPLETO.docx", buf);
  console.log("OK -> TCC - Esteira Kubernetes - COMPLETO.docx (" + buf.length + " bytes)");
});
