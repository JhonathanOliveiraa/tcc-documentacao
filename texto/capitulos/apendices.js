// Apendices A a D. Os arquivos de A e B sao lidos dos repositorios no momento do build.
module.exports = (H) => {
  const { htop, p, pm, run, arquivoRepo } = H;
  const t = [];

  t.push(htop("APÊNDICE A – MANIFESTOS BASE DO GOLDEN PATH", true));
  t.push(p("Este apêndice apresenta os manifestos do diretório golden-path/base do repositório tcc-platform, dos quais derivam os overlays de todas as aplicações, e o diretório da API em apps/catalogo-api, como exemplo de overlay com banco de dados e segredos. O conteúdo é o da versão avaliada."));
  ["kustomization.yaml", "deployment.yaml", "service.yaml", "httproute.yaml", "networkpolicy.yaml",
    "serviceaccount.yaml", "externalsecret-ghcr.yaml"].forEach(f => t.push(...arquivoRepo("tcc-platform", `golden-path/base/${f}`)));
  ["base/kustomization.yaml", "base/deployment.yaml", "base/externalsecret.yaml", "hml/kustomization.yaml", "hml/deployment.yaml"]
    .forEach(f => t.push(...arquivoRepo("tcc-platform", `apps/catalogo-api/${f}`)));
  t.push(p("O ApplicationSet e o AppProject que transformam cada diretório apps/<aplicação>/<ambiente> em uma aplicação no cluster são apresentados a seguir."));
  ["clusters/oci-k3s/apps/applicationset.yaml", "clusters/oci-k3s/apps/projeto.yaml"].forEach(f => t.push(...arquivoRepo("tcc-platform", f)));

  t.push(htop("APÊNDICE B – TEMPLATES DE INTEGRAÇÃO CONTÍNUA", true));
  t.push(p("Este apêndice apresenta o template de integração contínua para serviços de backend do repositório tcc-pipeline-templates e o arquivo ci.yml com que cada aplicação de validação consome um template. O template de frontend difere apenas na etapa de testes (Node.js em vez de .NET) e é omitido."));
  t.push(...arquivoRepo("tcc-pipeline-templates", ".github/workflows/backend-service.yml"));
  t.push(...arquivoRepo("catalogo-api", ".github/workflows/ci.yml"));
  t.push(...arquivoRepo("catalogo-front", ".github/workflows/ci.yml"));
  t.push(p("A promoção de homologação para produção é feita pelo workflow do repositório da plataforma apresentado a seguir."));
  t.push(...arquivoRepo("tcc-platform", ".github/workflows/promover.yml"));

  t.push(htop("APÊNDICE C – ROTEIRO DE RECONSTRUÇÃO DA PLATAFORMA", true));
  t.push(p("Este apêndice resume o roteiro para reconstruir a plataforma em uma nova máquina virtual, condição para o requisito de reprodutibilidade (RNF02). Cada fase termina com uma verificação objetiva, e a fase seguinte só é iniciada após a anterior ser verificada."));
  [
    ["Fase 1 – Máquina virtual.", "Criar a instância VM.Standard.A1.Flex (2 OCPU, equivalentes a 2 vCPU, e 12 GB) com Ubuntu 24.04 ARM64 e endereço IP público reservado; liberar na lista de segurança as portas 22 e 6443 apenas para o IP administrativo e as portas 80 e 443 para a internet; abrir as mesmas portas no firewall da própria máquina. Verificação: acesso SSH e resposta das portas a partir de fora da VM."],
    ["Fase 2 – k3s.", "Instalar o k3s v1.36.4 com o IP privado como endereço do nó e o IP público como nome alternativo do certificado da API, desabilitando o Traefik embutido (o controlador de entrada será o Kong). Verificação: nó em estado Ready e kubectl funcional a partir da máquina de administração."],
    ["Fase 3 – Entrada HTTP.", "Instalar os CRDs da Gateway API e, em seguida, o Kong pelo chart kong/ingress, com o roteador compatível com o modelo tradicional e a política de tráfego externo local, para preservar o IP real dos clientes; criar a GatewayClass e o Gateway da plataforma. Verificação: o Gateway aceito pelo controlador, com o IP público, e resposta 404 a uma rota inexistente."],
    ["Fase 4 – DNS e certificados.", "Delegar o domínio ao Cloudflare, criar o registro curinga da subzona das aplicações apontando para o IP público, criar um token restrito à zona e instalar o cert-manager com emissores Let’s Encrypt por validação DNS-01; emitir o certificado curinga usado pelo Gateway. Verificação: certificado Ready e teste de roteamento com serviços de exemplo."],
    ["Fase 5 – GitOps.", "Instalar o Argo CD (único apply manual), registrar o acesso ao repositório tcc-platform e aplicar a Application raiz, que cria o AppProject, o ApplicationSet e o Reloader. Verificação: Application raiz Synced e Healthy, e uma alteração inofensiva no Git reconciliada sem comando manual."],
    ["Fase 6 – Segredos.", "Criar na OCI o Vault (sem a opção de cofre privado virtual, que é paga), uma chave de software, o grupo dinâmico com o OCID da VM e a política de leitura de segredos; instalar o External Secrets Operator e o ClusterSecretStore. Verificação: um ExternalSecret de teste gera o Secret correspondente."],
    ["Fase 7 – Observabilidade.", "Instalar o Grafana Alloy pelo chart grafana/k8s-monitoring com o token do Grafana Cloud, criar o pipeline do receptor OTLP, as verificações sintéticas e as regras de alerta. Verificação: métricas do nó e logs dos pods visíveis no Grafana Cloud e um trace de teste recebido no Tempo."],
    ["Fase 8 – Aplicações.", "Incorporar cada aplicação pelo contrato do Golden Path (docs/ONBOARDING.md): diretório apps/<aplicação>, segredos no Vault e, no repositório da aplicação, o ci.yml que consome o template. Verificação: aplicação Healthy no Argo CD, acessível por HTTPS e emitindo telemetria."],
  ].forEach(([fase, texto]) => t.push(p([run(fase + " ", { bold: true }), run(texto)])));
  t.push(p("O roteiro completo, com os comandos, as versões fixadas e os arquivos de configuração, é mantido em docs/RECONSTRUIR_CLUSTER.md no repositório da plataforma."));

  t.push(htop("APÊNDICE D – PROTOCOLO DE AVALIAÇÃO", true));
  t.push(p("Este apêndice descreve o protocolo de coleta das métricas do Quadro 4. Todas as medições partem da plataforma já verificada (Apêndice C) e são registradas com data, hora (UTC) e o commit correspondente. Os instantes do cluster são registrados a cada 5 segundos por um script que consulta o estado da Application no Argo CD, a imagem em execução e o código HTTP da rota pública; os da esteira, pela API do GitHub Actions. Os scripts e os dados brutos estão no diretório experimento/ do repositório tcc-documentacao."));
  [
    ["Etapa 1 – Linha de base, sem a plataforma.", "Implantar manualmente as duas aplicações, em namespaces próprios, com as mesmas capacidades obtidas pela plataforma: imagem arm64 publicada, Deployment e Service, banco de dados (API), segredos fora do repositório, rota HTTPS com certificado válido, envio de telemetria e um procedimento de rollback. Registrar cada comando ou ação manual como um passo, os arquivos criados e suas linhas não vazias, e o tempo total."],
    ["Etapa 2 – Onboarding pelo Golden Path.", "Para cada aplicação, contar os passos e os arquivos e linhas criados fora do código (overlay e ci.yml) e verificar se algum arquivo fora de apps/<aplicação> precisou ser alterado, o que caracteriza falha do Golden Path. Medir o tempo de implantação de uma mudança — do push ao estado Healthy com resposta 200 — decomposto em tempo da esteira e tempo de reconciliação, em três repetições por aplicação."],
    ["Etapa 3 – Padronização.", "Renderizar os overlays (kustomize build) e calcular a razão entre as linhas escritas pela aplicação e as renderizadas, os campos divergentes entre os Deployments e o checklist de conformidade (script padronizacao.py)."],
    ["Etapa 4 – Observabilidade.", "Gerar carga com o k6 sobre a API e o frontend por 5 minutos. Verificar, sem configuração adicional, a presença de cada sinal da matriz do Quadro 4 no Grafana Cloud, e o tempo entre a implantação e o primeiro dado recebido."],
    ["Etapa 5 – Falha e recuperação.", "Publicar pela esteira dois tipos de versão defeituosa da API: (a) falha de inicialização, em que o processo encerra no startup por exigir uma configuração que não existe no ambiente; e (b) falha funcional, em que GET /produtos responde 500 enquanto as sondas respondem 200. Como os testes automatizados da esteira barram os dois defeitos, o commit defeituoso desliga a etapa de testes, simulando um defeito que escapou à suíte. Registrar t0 (commit da versão defeituosa no overlay), t1 (detecção: Argo CD Degraded para a falha (a); primeiro alerta ou falha da verificação sintética para a falha (b)), t2 (commit de reversão no overlay) e t3 (aplicação Healthy na versão anterior e respondendo 200). Reportar detecção (t1 − t0), reação (t2 − t1), reconciliação (t3 − t2) e total (t3 − t0). Em seguida, reverter também o commit no repositório da aplicação."],
    ["Etapa 6 – Repetições e consumo.", "Repetir as medições de tempo das etapas 2 e 5 três vezes e apresentar média, mínimo e máximo. Coletar 20 amostras do consumo de CPU e memória por namespace, a cada 30 segundos."],
  ].forEach(([etapa, texto]) => t.push(p([run(etapa + " ", { bold: true }), run(texto)])));
  return t;
};
