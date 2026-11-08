// Capitulo 3 - Metodologia
module.exports = (H) => {
  const { h1, h2, p, pm, bullet, legendaQuadro, quadro, fonte, R } = H;
  const t = [];

  t.push(h1("3", "METODOLOGIA"));
  t.push(p("Este capítulo descreve os procedimentos metodológicos adotados para projetar, implementar e avaliar a plataforma. São apresentados a classificação da pesquisa, o ambiente e as ferramentas utilizadas, as etapas de desenvolvimento, as métricas de avaliação, os requisitos da plataforma e as ameaças à validade da avaliação."));

  t.push(h2("3.1", "Classificação da pesquisa"));
  t.push(p("Quanto à natureza, a pesquisa é aplicada, pois objetiva gerar um artefato com utilidade prática. Quanto ao método, adota-se a Design Science Research (DSR), voltada à construção e à avaliação de artefatos que resolvem problemas de classe conhecida (HEVNER et al., 2004; DRESCH; LACERDA; ANTUNES JÚNIOR, 2015). O problema é a recriação manual e não padronizada da cadeia de implantação e operação a cada nova aplicação (Seção 1.1); o artefato é a plataforma descrita no Capítulo 4, instanciada em um ambiente real; e a avaliação, apresentada no Capítulo 5, consiste em medir o comportamento do artefato em funcionamento segundo métricas definidas previamente."));
  t.push(p("A avaliação é observacional e descritiva: as medições são repetidas três vezes pelo próprio autor, no mesmo ambiente, e relatadas com média, mínimo e máximo. Não há grupo de controle nem tratamento estatístico, de modo que os números indicam a ordem de grandeza dos ganhos e servem para verificar os requisitos, e não para generalizações estatísticas. A abordagem é quantitativa nas medições e qualitativa na verificação dos requisitos e na discussão dos resultados."));

  t.push(h2("3.2", "Ambiente e ferramentas"));
  t.push(p("A plataforma foi construída sobre um cluster Kubernetes de nó único, utilizando ferramentas de código aberto consolidadas no ecossistema cloud native e serviços gerenciados de nível gratuito para armazenamento de imagens, segredos e telemetria. O Quadro 3 apresenta as ferramentas adotadas e seus respectivos papéis."));
  t.push(legendaQuadro("Quadro 3 – Ferramentas utilizadas na plataforma"));
  t.push(quadro(["Ferramenta", "Papel na plataforma"], [
    ["Oracle Cloud Infrastructure (OCI)", "Máquina virtual ARM64 que hospeda o cluster; cofre de segredos (OCI Vault)."],
    ["Kubernetes (k3s) e containerd", "Orquestração, escalonamento e autorrecuperação das cargas de trabalho. O k3s usa o containerd como runtime de contêineres no nó."],
    ["Docker (Buildx)", "Construção das imagens linux/arm64 na integração contínua. Não é executado no cluster."],
    ["Git (GitHub)", "Fonte única da verdade para o estado desejado da infraestrutura e das aplicações."],
    ["GitHub Actions", "Integração contínua por workflows reutilizáveis (templates de backend e frontend)."],
    ["GitHub Container Registry (GHCR)", "Registro das imagens de contêiner."],
    ["Trivy", "Análise de vulnerabilidades e segredos no código, nas dependências e nas imagens."],
    ["Kustomize", "Composição dos manifestos a partir de uma base comum e de overlays por aplicação e ambiente."],
    ["Argo CD", "Entrega contínua declarativa (GitOps), geração das aplicações por ApplicationSet e reconciliação do estado."],
    ["Kong (Gateway API)", "Ponto de entrada HTTP/HTTPS (Gateway) e roteamento para as aplicações (HTTPRoute)."],
    ["cert-manager", "Emissão e renovação automática de certificados TLS (Let’s Encrypt, validação DNS-01)."],
    ["External Secrets Operator (ESO)", "Materialização, no cluster, dos segredos guardados no OCI Vault."],
    ["Stakater Reloader", "Reinício controlado dos pods quando um segredo que eles usam é alterado."],
    ["PostgreSQL 17", "Banco de dados da API, implantado no namespace da própria aplicação."],
    ["OpenTelemetry SDK (.NET)", "Instrumentação de traces, métricas e logs da API, configurada pelas variáveis OTEL_*."],
    ["Grafana Alloy", "Coletor no cluster: recebe OTLP e coleta métricas e logs do Kubernetes."],
    ["Grafana Cloud", "Armazenamento, visualização e alertas da telemetria; verificações sintéticas (Synthetic Monitoring)."],
    ["k6", "Geração de carga HTTP durante a avaliação da observabilidade."],
  ], [30, 70]));
  t.push(fonte());
  t.push(p("O ambiente de execução é uma máquina virtual na Oracle Cloud Infrastructure (OCI), do tipo VM.Standard.A1.Flex (processador Ampere, arquitetura ARM64), com 2 OCPU e 12 GB de memória, dentro da camada gratuita do provedor, executando Ubuntu 24.04 LTS (ORACLE, 2026). Nas instâncias Ampere A1, uma OCPU corresponde a um núcleo físico e a uma vCPU, de modo que o nó dispõe de 2 vCPU; neste trabalho usa-se o termo OCPU, empregado pelo provedor. Sobre ela foi instalado o k3s v1.36.4, distribuição leve e certificada do Kubernetes adequada a nó único (K3S, 2026), com o containerd como runtime e persistência pela StorageClass local-path. Por ser ARM64, todas as imagens de contêiner são construídas para a plataforma linux/arm64."));
  t.push(p("Os componentes da plataforma e suas versões são: Argo CD v3.5.3 (ARGO PROJECT, 2026); Kong Gateway 3.9, pelo chart kong/ingress 0.24.0, como implementação da Gateway API do Kubernetes (KONG, 2026; KUBERNETES SIGS, 2026); cert-manager v1.21.2 (CERT-MANAGER, 2026); External Secrets Operator 2.11.0 (EXTERNAL SECRETS, 2026); Stakater Reloader 1.4 (STAKATER, 2026); e Grafana Alloy v1.19.2, instalado pelo chart grafana/k8s-monitoring 4.5.2 (GRAFANA LABS, 2026a). A integração contínua é executada no GitHub Actions, com imagens publicadas no GitHub Container Registry e analisadas pelo Trivy (GITHUB, 2026; AQUA SECURITY, 2026)."));
  t.push(p("O k3s instala por padrão o Traefik como controlador de entrada, que foi desabilitado na instalação. A escolha do Kong deve-se a dois fatores: o mesmo nó já hospedava outra carga de trabalho exposta pelo Kong, e um único controlador evita que dois serviços disputem as portas 80 e 443 do balanceador embutido do k3s; além disso, o Kong é uma implementação da Gateway API e oferece plugins, como a restrição por endereço IP usada na rota administrativa do Argo CD, sem alterar as aplicações."));

  t.push(h2("3.3", "Etapas de desenvolvimento"));
  t.push(p("Seguindo as atividades da DSR, o trabalho foi organizado nas seguintes etapas:", { noIndent: true }));
  t.push(bullet("identificação do problema e revisão bibliográfica sobre os fundamentos e ferramentas envolvidos;"));
  t.push(bullet("definição do padrão mínimo (contrato) a ser seguido pelas aplicações e dos requisitos da plataforma;"));
  t.push(bullet("projeto da arquitetura e da estrutura de repositórios;"));
  t.push(bullet("implementação dos componentes comuns, do template do Golden Path e dos templates de integração contínua;"));
  t.push(bullet("desenvolvimento e incorporação das aplicações de validação;"));
  t.push(bullet("avaliação do artefato conforme o protocolo do Apêndice D e verificação dos requisitos."));

  t.push(h2("3.4", "Métricas de avaliação"));
  t.push(p("As métricas foram definidas para serem medidas sem interpretação e alinhadas, quando possível, às quatro métricas de desempenho de entrega de software propostas por Forsgren, Humble e Kim (2018), conhecidas como métricas DORA: tempo de espera de mudanças (lead time), frequência de implantação, taxa de falha de mudanças e tempo de recuperação. O Quadro 4 apresenta cada métrica, a correspondência com as métricas DORA e a forma de medição."));
  t.push(legendaQuadro("Quadro 4 – Métricas de avaliação da plataforma"));
  t.push(quadro(["Métrica", "DORA", "Como é medida"], [
    ["Esforço de implantação", "—", "Número de passos manuais e de arquivos e linhas criados ou alterados fora do código da aplicação (git diff --stat), comparando a implantação manual e a implantação pela plataforma das duas aplicações, com as mesmas capacidades: HTTPS, segredos, telemetria e rollback."],
    ["Tempo até a implantação", "Lead time de mudança", "Do push do commit até a aplicação Healthy no Argo CD e respondendo 200 por HTTPS, decomposto em tempo da esteira de integração contínua e tempo de reconciliação."],
    ["Padronização", "—", "(a) Linhas do overlay ÷ linhas do manifesto renderizado (kustomize build); (b) número de campos divergentes entre os Deployments renderizados das duas aplicações; (c) checklist de conformidade com o contrato (probes, recursos, securityContext, OpenTelemetry, NetworkPolicy, rota HTTPS)."],
    ["Cobertura de observabilidade", "—", "Matriz sinal × aplicação (métricas de contêiner, métricas de aplicação, logs, traces e verificação sintética) com presente ou ausente, e tempo entre a implantação e o primeiro dado no Grafana Cloud."],
    ["Tempo de recuperação", "Tempo de recuperação", "Para cada tipo de falha injetada: detecção (t1 − t0), reação (t2 − t1), reconciliação (t3 − t2) e total (t3 − t0), reportados separadamente."],
    ["Taxa de falha de mudança", "Taxa de falha de mudança", "Implantações que exigiram reversão ÷ implantações do período de avaliação (descritiva)."],
    ["Consumo da plataforma", "—", "CPU e memória dos componentes comuns (Argo CD, Kong, cert-manager, ESO, Reloader e coleta de telemetria), médias de 20 amostras do metrics-server."],
  ], [22, 18, 60]));
  t.push(fonte());
  t.push(p("A frequência de implantação não é avaliada, porque depende do ritmo de trabalho da equipe, e não da plataforma; a plataforma apenas não impõe limite a ela. O protocolo de execução das medições, com as etapas, os instantes registrados e o número de repetições, é apresentado no Apêndice D. A carga de teste é gerada com a ferramenta k6 (GRAFANA LABS, 2026c)."));

  t.push(h2("3.5", "Requisitos da plataforma"));
  t.push(p("A plataforma atende a dois perfis de usuário. A equipe de plataforma mantém a infraestrutura comum — cluster, componentes compartilhados e template — e é a única a alterar o repositório da plataforma fora dos overlays das aplicações. As equipes de aplicação desenvolvem os serviços e os incorporam seguindo o contrato do Golden Path, sem acesso administrativo ao cluster e sem conhecimento detalhado de seus componentes."));
  t.push(p("A partir dos objetivos do trabalho e das necessidades desses perfis, foram definidos os requisitos funcionais, apresentados no Quadro 5, e os requisitos não funcionais, apresentados no Quadro 6. Cada requisito é verificado no Capítulo 5, o que torna a avaliação objetiva e rastreável aos objetivos específicos."));
  t.push(legendaQuadro("Quadro 5 – Requisitos funcionais da plataforma"));
  t.push(quadro(["Código", "Requisito"], [
    ["RF01", "Implantar uma aplicação a partir de uma alteração versionada no Git, sem comandos manuais no cluster."],
    ["RF02", "Construir, testar, analisar e publicar a imagem de cada aplicação a partir do commit, registrando a nova versão no repositório da plataforma."],
    ["RF03", "Reverter uma aplicação à versão estável anterior por meio da reversão do commit correspondente."],
    ["RF04", "Coletar métricas, logs e traces de toda aplicação incorporada, sem configuração individual na infraestrutura."],
    ["RF05", "Fornecer às aplicações os segredos de que necessitam a partir de um cofre externo ao Git."],
    ["RF06", "Expor as aplicações por HTTPS, com certificados emitidos e renovados automaticamente."],
    ["RF07", "Permitir a incorporação de uma nova aplicação apenas com os artefatos do contrato (Quadro 9), sem alterar arquivos fora de apps/<aplicação>."],
  ], [14, 86]));
  t.push(fonte());
  t.push(legendaQuadro("Quadro 6 – Requisitos não funcionais da plataforma"));
  t.push(quadro(["Código", "Requisito"], [
    ["RNF01", "Segurança: nenhum valor de segredo no Git; a esteira de integração contínua não possui credenciais do cluster; os contêineres das aplicações são executados sem privilégios (usuário não root, sem escalonamento, sem capabilities). Exceção declarada: os coletores de telemetria (Alloy e node-exporter) precisam de acesso ao host para ler métricas e logs do nó."],
    ["RNF02", "Reprodutibilidade: a plataforma pode ser reconstruída em uma nova máquina virtual a partir do Git e do roteiro do Apêndice C."],
    ["RNF03", "Auditabilidade: toda mudança no estado das aplicações é rastreável a um commit."],
    ["RNF04", "Compatibilidade: imagens construídas para linux/arm64, arquitetura da máquina virtual."],
    ["RNF05", "Custo: operação dentro das camadas gratuitas dos serviços utilizados (OCI, GitHub e Grafana Cloud)."],
    ["RNF06", "Eficiência: componentes comuns com limites de recursos definidos e consumo medido, preservando capacidade para as aplicações no nó de 2 OCPU e 12 GB."],
    ["RNF07", "Independência da observabilidade: dados de telemetria, painéis e regras de alerta (Seção 4.7) mantidos fora do cluster, disponíveis mesmo com falha do nó."],
  ], [14, 86]));
  t.push(fonte());

  t.push(h2("3.6", "Ameaças à validade"));
  t.push(p("Algumas características da avaliação limitam o alcance das conclusões e são declaradas a seguir."));
  t.push(pm("**Viés do avaliador e efeito de aprendizado.** O autor projetou a plataforma e executou as medições; conhece seus detalhes e repetiu as mesmas tarefas, o que tende a reduzir os tempos a cada repetição e a favorecer a plataforma. A linha de base manual também foi executada pelo autor, depois da plataforma, já conhecendo a solução. O teste que mitiga esse viés — uma pessoa sem contato prévio incorporar uma aplicação apenas com a documentação do Golden Path (docs/ONBOARDING.md) — é a avaliação complementar mais importante da proposta; seus resultados, quando disponíveis, são relatados na Seção 5.2."));
  t.push(pm("**Representatividade das cargas.** As duas aplicações são contêineres HTTP sem estado (o estado da API fica no PostgreSQL). Cargas de outro tipo, como processamento assíncrono ou tarefas agendadas, não foram avaliadas, o que limita a generalidade demonstrada."));
  t.push(pm("**Ambiente e serviços externos.** Os tempos dependem da fila e do cache do GitHub Actions, do intervalo de consulta do Argo CD ao Git e da latência dos serviços gerenciados, que variam ao longo do dia. O ambiente de nó único não permite avaliar escalabilidade horizontal nem alta disponibilidade."));
  t.push(pm("**Número de repetições.** Três repetições bastam para indicar a ordem de grandeza e a variabilidade, mas não para intervalos de confiança."));
  return t;
};
