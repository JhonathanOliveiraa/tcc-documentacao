// Capitulo 4 - Desenvolvimento da plataforma
module.exports = (H) => {
  const { h1, h2, p, pm, bullet, legendaQuadro, quadro, fonte, figura, codeBlock, arquivoRepo, R } = H;
  const t = [];

  t.push(h1("4", "DESENVOLVIMENTO DA PLATAFORMA"));
  t.push(p("Este capítulo apresenta a plataforma proposta, descrevendo sua arquitetura geral, a estrutura de repositórios e o template (Golden Path), a padronização da conteinerização, a integração contínua, a implantação via GitOps, a gestão de segredos, a observabilidade, a estratégia de recuperação e o processo de incorporação (onboarding) de novas aplicações."));

  // 4.1
  t.push(h2("4.1", "Visão geral da arquitetura"));
  t.push(p("A plataforma é composta por quatro camadas integradas: (i) a camada de orquestração, provida pelo Kubernetes; (ii) a camada de entrega contínua, baseada em GitOps com o Argo CD; (iii) a camada de observabilidade, baseada em OpenTelemetry, Grafana Alloy e Grafana Cloud; e (iv) a camada de padronização, representada pelo template reutilizável que define o contrato das aplicações. A Figura 1 ilustra a arquitetura geral."));
  t.push(...figura("Figura 1 – Arquitetura geral da plataforma proposta", "figura1-arquitetura.png"));
  t.push(p("O fluxo parte de uma alteração versionada no Git. A esteira de integração contínua de uma aplicação testa, analisa e publica a imagem e registra sua referência no repositório da plataforma; o Argo CD, de dentro do cluster, puxa o novo estado desejado e reconcilia o cluster. O Kong expõe as aplicações por HTTPS com certificados do cert-manager, o External Secrets Operator entrega os segredos do OCI Vault e o Grafana Alloy coleta a telemetria e a exporta ao Grafana Cloud."));

  // 4.2
  t.push(h2("4.2", "Estrutura de repositórios e template (Golden Path)"));
  t.push(p("A organização dos repositórios materializa o Golden Path e segue a separação, comum em GitOps, entre código e configuração. Cada aplicação tem seu próprio repositório, com o código-fonte, o Dockerfile e um arquivo curto de integração contínua que apenas parametriza um template compartilhado. Os templates de integração contínua, um para serviços de backend e outro para frontends, ficam no repositório tcc-pipeline-templates. Um único repositório de plataforma, tcc-platform, reúne tudo o que o Argo CD aplica ao cluster: os componentes comuns, o template do Golden Path e os overlays de cada aplicação e ambiente. A Figura 2 apresenta os quatro tipos de repositório."));
  t.push(...figura("Figura 2 – Estrutura de repositórios e do template (Golden Path)", [
    "tcc-platform/                     repositório da plataforma (lido pelo Argo CD)",
    "├── clusters/oci-k3s/             Application raiz (app-of-apps)",
    "│   └── apps/                     AppProject, ApplicationSet e Reloader",
    "├── platform/                     componentes comuns",
    "│   ├── gateway/                  GatewayClass e Gateway do Kong",
    "│   ├── cert-manager/             emissores Let’s Encrypt (DNS-01)",
    "│   ├── external-secrets/         ClusterSecretStore do OCI Vault",
    "│   └── observability/            receptor OTLP do Grafana Alloy",
    "├── golden-path/base/             contrato: Deployment, Service, HTTPRoute,",
    "│                                 NetworkPolicy, ServiceAccount, ExternalSecret",
    "├── apps/<aplicação>/",
    "│   ├── base/                     o que é da aplicação (probes, banco, segredos)",
    "│   ├── hml/                      overlay de homologação (a esteira grava a imagem)",
    "│   └── prd/                      overlay de produção (promoção)",
    "└── docs/                         roteiro de reconstrução e guia de onboarding",
    "",
    "tcc-pipeline-templates/           templates de integração contínua",
    "└── .github/workflows/            backend-service.yml, frontend-service.yml",
    "",
    "catalogo-api/                     repositório da API (um por aplicação)",
    "├── src/  tests/                  código e testes",
    "├── Dockerfile",
    "└── .github/workflows/ci.yml      chama backend-service.yml",
    "",
    "catalogo-front/                   repositório do frontend",
    "├── src/  docker/                 código e configuração do nginx",
    "├── Dockerfile",
    "└── .github/workflows/ci.yml      chama frontend-service.yml",
  ]));
  t.push(p("A esteira de uma aplicação escreve no repositório da plataforma apenas o arquivo kustomization.yaml do overlay de homologação, onde registra a imagem publicada. Como um token de escrita do GitHub vale para o repositório inteiro, essa restrição é garantida por três mecanismos complementares, e não pelo token: (i) o template de integração contínua recusa o commit se qualquer outro arquivo for alterado; (ii) o AppProject do Argo CD que agrupa as aplicações só aceita destinos nos namespaces <aplicação>-hml e <aplicação>-prd, só este repositório como origem e só uma lista fechada de tipos de recurso — Deployment, StatefulSet, Service, HTTPRoute, ExternalSecret, NetworkPolicy, entre outros —, de modo que um overlay não pode criar papéis de acesso (RBAC), definições de recursos (CRD) nem objetos de cluster além do Namespace; e (iii) todo commit da esteira fica registrado com o autor github-actions[bot]. Os manifestos do template base são apresentados no Apêndice A."));

  // 4.3
  t.push(h2("4.3", "Conteinerização padronizada"));
  t.push(p("A primeira exigência do contrato é a imagem. O Dockerfile de referência, adotado pela API e reproduzido no Quadro 7, é multi-stage: o estágio de compilação usa a imagem do SDK na arquitetura da máquina de build ($BUILDPLATFORM) e publica o binário para a arquitetura de destino ($TARGETARCH), e o estágio final usa uma imagem mínima do runtime (chiseled, sem shell nem gerenciador de pacotes), com o usuário não root da própria imagem e a porta 8080. O frontend segue o mesmo padrão: um estágio Node.js gera os arquivos estáticos e o estágio final usa o nginx-unprivileged, também não root e na porta 8080."));
  t.push(legendaQuadro("Quadro 7 – Dockerfile de referência (catalogo-api)"));
  t.push(...arquivoRepo("catalogo-api", "Dockerfile").slice(1));
  t.push(fonte());
  t.push(p("O contrato também exige endpoints de saúde que distinguem liveness de readiness. Na API, GET /health/live responde 200 enquanto o processo atende, sem testar dependências, e é usado pelas sondas de inicialização e de liveness; GET /health inclui a conexão com o PostgreSQL e responde 503 quando o banco está indisponível, e é usado pela sonda de readiness. Assim, uma queda do banco retira a API do balanceamento sem reiniciá-la em ciclo. No frontend, servido como conteúdo estático, o nginx responde GET /healthz com 200 sem tocar disco nem a API, e esse endpoint atende às duas sondas: a disponibilidade do frontend depende apenas do servidor web, e a indisponibilidade da API é tratada pela própria interface. As sondas, os recursos e o contexto de segurança (usuário não root, raiz somente leitura, sem capabilities e com perfil seccomp) são definidos no template base e ajustados por aplicação no diretório apps/<aplicação>/base."));

  // 4.4
  t.push(h2("4.4", "Integração contínua e publicação de imagens"));
  t.push(p("A integração contínua é executada no GitHub Actions por meio de workflows reutilizáveis. O repositório tcc-pipeline-templates define dois templates, backend-service e frontend-service, e o repositório de cada aplicação contém apenas um arquivo que referencia o template adequado e informa seus parâmetros, como o overlay de destino e a versão do runtime. Assim, uma melhoria na esteira é feita em um único lugar e passa a valer para todas as aplicações. A cada push na branch principal, a esteira executa os testes automatizados, analisa o código e as dependências com o Trivy, constrói a imagem linux/arm64, analisa a imagem resultante e a publica no GHCR; em pull requests, executa as mesmas verificações sem publicar (GITHUB, 2026; AQUA SECURITY, 2026). Os templates e o arquivo de uma aplicação são apresentados no Apêndice B."));
  t.push(p("Os runners do GitHub Actions são x86-64. A construção arm64 não emula o compilador: o estágio de compilação roda nativamente na arquitetura do runner e gera o binário para arm64 (compilação cruzada do .NET e build do Angular, que produz arquivos independentes de arquitetura), e o estágio final arm64 não executa comandos (RUN), de modo que o emulador QEMU, instalado pelo template, quase não é exercitado. O tempo de build fica, portanto, próximo ao de um build x86-64 comum, o que é relevante para a métrica de tempo até a implantação."));
  t.push(p("A política do Trivy é explícita: a esteira falha apenas em vulnerabilidades de severidade crítica que já tenham correção disponível (opção ignore-unfixed), tanto no código quanto na imagem; achados de severidade alta ou inferior e vulnerabilidades críticas sem correção são exibidos no log, mas não bloqueiam. Sem essa regra, uma vulnerabilidade sem correção na imagem base poderia bloquear a esteira indefinidamente. A análise do código também procura segredos versionados por engano."));
  t.push(p("A esteira não acessa o cluster. Sua última etapa é registrar a imagem no overlay de homologação por meio de um commit no repositório da plataforma. A imagem recebe a etiqueta sha-<commit>, legível, mas etiquetas de registro são mutáveis; por isso o overlay registra também o digest da imagem, e o Kustomize a renderiza como <imagem>:<etiqueta>@sha256:<digest>. O nó baixa exatamente o conteúdo construído e analisado pela esteira, ainda que alguém reescreva a etiqueta no registro."));

  // 4.5
  t.push(h2("4.5", "Implantação via GitOps com Argo CD"));
  t.push(p("A implantação é realizada de forma declarativa pelo Argo CD. Uma Application raiz — o único objeto aplicado manualmente, após a instalação do Argo CD — reconcilia o diretório clusters/oci-k3s/apps, que contém o AppProject das aplicações e um ApplicationSet. O ApplicationSet usa o gerador de diretórios do Git sobre apps/*/*, excluindo os diretórios base: cada pasta apps/<aplicação>/<ambiente> gera uma Application <aplicação>-<ambiente>, implantada no namespace de mesmo nome, criado pela própria Application com os rótulos exigidos pelo Gateway (ARGO PROJECT, 2026). Criar a pasta da aplicação no Git é, portanto, suficiente para que ela passe a existir no cluster, sem alterar nenhum arquivo fora de apps/<aplicação>. A sincronização é automática, com remoção de recursos que saíram do Git (prune) e correção de alterações manuais (self-heal). A Figura 3 resume o fluxo."));
  t.push(...figura("Figura 3 – Fluxo de integração e entrega contínua com GitOps (Argo CD)", "figura3-fluxo-cicd.png"));
  t.push(p("A homologação recebe toda nova versão publicada pela esteira. A produção recebe a mesma imagem por promoção: um workflow do repositório da plataforma copia a etiqueta e o digest do overlay de homologação para o de produção em um commit, de modo que a imagem promovida é exatamente a validada, sem reconstrução."));
  t.push(p("A exposição das aplicações utiliza a Gateway API, implementada pelo Kong, e não o recurso Ingress. A plataforma mantém um Gateway com um ponto de escuta HTTPS para *.tcc.altasistemas.com.br, com certificado curinga emitido pelo cert-manager por validação DNS-01, e aceita rotas apenas de namespaces com o rótulo tcc/exposto=true. Cada aplicação declara somente um HTTPRoute em seu overlay, com o host e o serviço de destino; um registro DNS curinga da subzona aponta para a máquina virtual, de modo que um host novo não exige alteração de DNS nem de certificado. Essa divisão reproduz na própria API do cluster a separação entre a equipe de plataforma e as equipes de aplicação (KUBERNETES SIG NETWORK, 2026; KONG, 2026)."));

  // 4.6
  t.push(h2("4.6", "Gestão de segredos"));
  t.push(p("Credenciais como senhas de banco de dados e o token de leitura do registro de imagens não podem ser versionadas no Git, mas a implantação precisa delas. Os valores são armazenados no OCI Vault, e o External Secrets Operator os materializa como Secrets do Kubernetes (ORACLE, 2026; EXTERNAL SECRETS, 2026). No Git ficam apenas objetos ExternalSecret, que declaram quais segredos do cofre originam quais chaves no cluster; o da API, por exemplo, compõe a cadeia de conexão do banco a partir do usuário e da senha guardados no cofre, nomeados pelo padrão <AMBIENTE>-TCC-<APLICAÇÃO>-<CHAVE>."));
  t.push(p("A autenticação do operador junto à OCI é feita por Instance Principal: a própria máquina virtual se identifica perante o provedor, e uma política concede ao seu grupo dinâmico somente a leitura dos segredos do cofre. Nenhuma credencial do provedor é armazenada no cluster. Em contrapartida, em um nó único, qualquer pod capaz de alcançar o serviço de metadados da máquina virtual (169.254.169.254) poderia obter a mesma identidade e ler o cofre. Para mitigar esse risco, o template base inclui uma NetworkPolicy que, nos namespaces das aplicações, libera o tráfego de saída exceto para esse endereço. O efeito foi verificado: a partir de um pod em um namespace de aplicação, o serviço de metadados não responde e a internet continua acessível, enquanto um pod em outro namespace obtém resposta de ambos. A mitigação vale apenas para os namespaces das aplicações; os componentes da plataforma permanecem com acesso e fazem parte da base confiável do cluster."));
  t.push(p("O External Secrets Operator consulta o cofre a cada hora e atualiza o Secret quando o valor muda. Pods que leem o segredo como variável de ambiente, como a API, só enxergariam o novo valor após reiniciar; por isso o Deployment do template base é anotado para o Stakater Reloader, que executa um rolling update quando um Secret usado pelo pod é alterado (STAKATER, 2026). A troca de um valor no cofre chega, assim, às aplicações sem commit e sem acesso manual ao cluster, no máximo após o intervalo de sincronização."));

  // 4.7
  t.push(h2("4.7", "Observabilidade"));
  t.push(p("A observabilidade é incorporada por padrão. O Grafana Alloy, instalado pelo chart k8s-monitoring, coleta as métricas do cluster (kube-state-metrics, node-exporter e cAdvisor) e os logs de todos os contêineres, com rótulos de namespace, pod e contêiner, sem qualquer configuração por aplicação. Para a telemetria emitida pelas próprias aplicações, o Alloy mantém um receptor OTLP (gRPC na porta 4317 e HTTP na porta 4318) que reencaminha traces, métricas e logs ao Grafana Cloud (GRAFANA LABS, 2026a). A Figura 4 apresenta a pipeline de telemetria."));
  t.push(...figura("Figura 4 – Pipeline de telemetria com OpenTelemetry e Grafana", "figura4-telemetria.png"));
  t.push(p("O mecanismo de instrumentação da API é o SDK do OpenTelemetry para .NET, adicionado ao código com as bibliotecas que instrumentam automaticamente o ASP.NET Core, o HttpClient e o Entity Framework Core. Não se trata, portanto, de instrumentação sem código: a aplicação declara o SDK uma vez, e tudo o que varia por ambiente — o endereço do receptor, o protocolo, o nome do serviço e o ambiente — vem das variáveis OTEL_* que o Deployment do template base injeta (OPENTELEMETRY, 2026). A alternativa sem código, por injeção de agente ou por sondas eBPF do Grafana Beyla, está disponível no chart de monitoramento, mas foi desabilitada para os namespaces das aplicações para não duplicar os spans de quem já usa o SDK; ela é a opção indicada para aplicações que não possam alterar o código (GRAFANA LABS, 2026d)."));
  t.push(p("O frontend não tem instrumentação no navegador: seu contêiner serve apenas arquivos estáticos, e a telemetria disponível é a do contêiner (logs de acesso do nginx e métricas de pod) e a das verificações sintéticas. Por isso, o trace de uma operação feita na interface começa quando a requisição chega à API, e não no clique do usuário; instrumentar o navegador, com o OpenTelemetry Web ou o Grafana Faro, é indicado como trabalho futuro."));
  t.push(p("O Grafana Cloud atua como camada de armazenamento, apresentação e alerta. Por estar fora do cluster, os dados, os painéis e as regras de alerta continuam disponíveis mesmo que o nó falhe, e o consumo de recursos na máquina virtual limita-se ao coletor. Os painéis de Kubernetes, filtráveis por namespace, e as visões por serviço derivadas dos traces (Application Observability) ficam disponíveis para qualquer aplicação incorporada sem configuração individual. As verificações sintéticas (Synthetic Monitoring) consultam, a cada cinco minutos e a partir de um ponto de prova externo em São Paulo, GET /healthz do frontend e GET /health da API em cada ambiente, verificando o caminho completo do DNS ao contêiner (GRAFANA LABS, 2026e); a frequência foi limitada pela cota gratuita de execuções do serviço. Alertas, verificações e o painel das aplicações são declarados em um script versionado no repositório da plataforma, como o restante da configuração. As regras de alerta existentes são as do Quadro 8."));
  t.push(legendaQuadro("Quadro 8 – Alertas da plataforma"));
  t.push(quadro(["Alerta", "Condição", "Sinal"], [
    ["Aplicação indisponível", "Verificação sintética de qualquer rota pública falhando por 2 minutos (checks a cada 5 minutos)", "Synthetic Monitoring"],
    ["Erros 5xx na API", "Mais de 5% das requisições HTTP da API com status 5xx em 2 minutos", "Métricas OTLP (http.server.request.duration)"],
    ["Pod sem réplica pronta", "Deployment de aplicação com réplica indisponível por 3 minutos", "kube-state-metrics"],
  ], [24, 50, 26]));
  t.push(fonte());
  t.push(p("A Figura 5 apresenta o painel das aplicações no Grafana Cloud durante a carga gerada na avaliação (Seção 5.4): requisições por segundo e latência da API, a partir das métricas OTLP; CPU e memória dos contêineres das duas aplicações, a partir do cAdvisor; e os logs dos contêineres, em que aparecem tanto os eventos estruturados da API quanto os registros de acesso do nginx do frontend. Nenhum desses dados exigiu configuração específica das aplicações na plataforma."));
  t.push(...figura("Figura 5 – Painel das aplicações no Grafana Cloud durante a carga (horário de Brasília)", "figura5-grafana.png", "Fonte: Grafana Cloud, capturado pelo autor."));

  // 4.8
  t.push(h2("4.8", "Estratégia de recuperação"));
  t.push(p("A recuperação não é automática: ela é padronizada, rastreável e de baixo esforço. Como o estado desejado é definido no Git, o retorno a uma versão estável é feito revertendo-se (git revert) o commit deploy(<aplicação>) que a esteira gravou no overlay, e o Argo CD reconcilia o cluster ao estado anterior. O procedimento é o mesmo para qualquer aplicação, fica registrado no histórico e não exige acesso ao cluster. O botão de rollback da interface do Argo CD não é usado: com a sincronização automática ligada, a ferramenta não o permite, e qualquer alteração fora do Git seria desfeita na reconciliação seguinte."));
  t.push(p("O comportamento diante de uma versão defeituosa depende do tipo de falha, e os dois tipos foram avaliados no Capítulo 5. Em uma falha de inicialização — processo que encerra ou readiness que nunca responde —, o rolling update configurado com maxUnavailable igual a zero não remove os pods antigos enquanto o novo não fica pronto: o serviço continua atendendo pela versão anterior, e o Argo CD exibe a aplicação como Progressing e, depois, Degraded. Em uma falha funcional — a aplicação responde 500 mas passa nas sondas —, a nova versão entra no ar e só a observabilidade detecta o problema, pelo alerta de erros 5xx ou pelas verificações sintéticas. É esse segundo caso que justifica o requisito de observabilidade independente (RNF07) e a reversão pelo Git. A Figura 6 mostra uma recuperação medida na avaliação: o código HTTP de GET /produtos, o estado da aplicação no Argo CD e a imagem em execução ao longo do episódio."));
  t.push(...figura("Figura 6 – Linha do tempo de uma falha de inicialização e de uma falha funcional, com recuperação por reversão no Git", "figura6-recuperacao.png", "Fonte: elaborado pelo autor a partir dos registros do experimento (Seção 5.5)."));

  // 4.9
  t.push(h2("4.9", "Onboarding de novas aplicações"));
  t.push(p("A incorporação de uma nova aplicação resume-se a seguir o Golden Path, descrito para as equipes de aplicação no guia docs/ONBOARDING.md do repositório da plataforma. O Quadro 9 sintetiza o contrato. A partir dele, a aplicação é implantada pelo Argo CD, exposta por HTTPS, recebe seus segredos e passa a ter métricas e logs coletados, sem alteração na infraestrutura comum."));
  t.push(legendaQuadro("Quadro 9 – Contrato de onboarding de uma aplicação"));
  t.push(quadro(["Artefato", "Onde", "Exigência"], [
    ["Dockerfile", "Repositório da aplicação", "Multi-stage, compilação em $BUILDPLATFORM, imagem final linux/arm64, usuário não root, porta 8080."],
    ["Endpoints de saúde", "Código da aplicação", "Liveness sem dependências e readiness com as dependências obrigatórias; frontend estático: /healthz no servidor web."],
    ["Instrumentação", "Código da aplicação", "SDK OpenTelemetry configurado só pelas variáveis OTEL_* (a plataforma injeta endereço e protocolo)."],
    ["Integração contínua", "Repositório da aplicação", "ci.yml que chama o template de backend ou de frontend, com o overlay de homologação como destino."],
    ["Overlay", "apps/<aplicação>/{base,hml,prd}", "Base herdando golden-path/base; ambientes com host, variáveis, chaves do cofre e bloco images."],
    ["Rota de entrada", "Overlay do ambiente", "HTTPRoute herdado do template, com o host <ambiente>-<aplicação>.tcc.altasistemas.com.br e o caminho /; TLS do Gateway."],
    ["Namespace", "Nenhum arquivo", "<aplicação>-<ambiente>, criado pelo ApplicationSet a partir do nome da pasta."],
    ["Segredos", "OCI Vault e ExternalSecret no overlay", "Nomes <AMBIENTE>-TCC-<APLICAÇÃO>-<CHAVE>; nenhum valor no Git; valores gravados pela equipe de plataforma."],
  ], [18, 26, 56]));
  t.push(fonte());
  t.push(p("O banco de dados da API é um PostgreSQL 17 declarado no diretório apps/catalogo-api/base como um StatefulSet com volume persistente (local-path), um Service e o ExternalSecret das credenciais, no mesmo namespace da API. Ele é, portanto, parte do overlay da aplicação, e não da infraestrutura comum: a plataforma oferece o mecanismo (manifestos, segredos e armazenamento), e a aplicação declara a dependência de que precisa. A API aplica as migrações do esquema na inicialização, antes de aceitar tráfego."));

  // 4.10
  t.push(h2("4.10", "Configuração do frontend"));
  t.push(p("O frontend descobre a URL da API em tempo de execução, e não no build. Ao iniciar, o contêiner valida a variável API_BASE_URL, definida no overlay de cada ambiente, e gera o arquivo /config.json a partir de um template; sem a variável, ou com um valor que não seja uma URL HTTPS, o contêiner não sobe. A aplicação Angular lê esse arquivo antes de iniciar, de modo que a mesma imagem serve à homologação e à produção. O navegador chama a API diretamente, em seu próprio host, e a API autoriza a origem do frontend pela política de CORS, cuja lista de origens também vem do overlay (Cors__OrigensPermitidas). Optou-se por não servir a API sob o mesmo host do frontend para manter as duas aplicações independentes no Gateway, cada uma com seu próprio HTTPRoute."));
  return t;
};
