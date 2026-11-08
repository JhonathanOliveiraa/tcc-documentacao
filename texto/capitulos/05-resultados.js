// Capitulo 5 - Resultados e discussao. Todos os numeros vem de experimento/resultados.json.
module.exports = (H, R) => {
  const { h1, h2, p, pm, bullet, legendaQuadro, quadro, fonte, figura, legendaTabela, tabela } = H;
  const t = [];
  const exigir = (v, nome) => { if (v === undefined || v === null) throw new Error("resultado ausente: " + nome); return v; };
  const num = (x, casas = 1) => Number(x).toFixed(casas).replace(".", ",");
  const seg = (s) => s >= 120 ? `${num(s / 60)} min` : `${num(s, 0)} s`;
  const mmm = (r, nome) => { exigir(r, nome); return [num(r.media, 0), num(r.min, 0), num(r.max, 0)]; };
  const pct = (a, b) => num(100 * a / b, 0) + "%";

  const IMP = exigir(R.implantacao, "implantacao");
  const API = IMP["catalogo-api"], FRONT = IMP["catalogo-front"];
  const LB = exigir(R.linha_base, "linha_base"), PE = exigir(R.plataforma_esforco, "plataforma_esforco");
  const PAD = exigir(R.padronizacao, "padronizacao");
  const REC = exigir(R.recuperacao, "recuperacao");
  const OBS = exigir(R.observabilidade, "observabilidade");
  const OV = exigir(R.overhead && R.overhead.sem_apps, "overhead");
  const EST = exigir(R.esteira, "esteira");

  t.push(h1("5", "RESULTADOS E DISCUSSÃO"));
  t.push(p("Este capítulo apresenta a avaliação da plataforma conforme o protocolo do Apêndice D, executado em 8 de novembro de 2026. São apresentadas as aplicações de validação, o esforço e o tempo de implantação, a padronização, a observabilidade obtida, os experimentos de falha e recuperação, o consumo de recursos da plataforma e a verificação dos requisitos, seguidos da discussão e das limitações. Os dados brutos e os scripts de coleta estão no diretório experimento/ do repositório tcc-documentacao."));

  // 5.1
  t.push(h2("5.1", "Aplicações de validação"));
  t.push(p("Para validar a plataforma, foi implementado um catálogo de produtos, de domínio reconhecível e propositalmente simples, composto por duas aplicações com formatos de implantação distintos, sintetizadas no Quadro 10. O objetivo não está na complexidade das aplicações, mas em verificar se serviços com necessidades diferentes — banco de dados e segredos, de um lado; configuração em tempo de execução e conteúdo estático, de outro — são incorporados pelo mesmo Golden Path."));
  t.push(bullet("API de Produtos (catalogo-api): serviço REST em ASP.NET Core sobre .NET 10, com cadastro, listagem paginada com filtros e ordenação, consulta, edição e ativação ou desativação de produtos (POST, GET e PUT em /produtos e PATCH em /produtos/{id}/status), persistência em PostgreSQL 17 via Entity Framework Core, erros no formato ProblemDetails e documentação OpenAPI. A suíte automatizada tem 149 testes, dos quais 63 de integração contra um PostgreSQL real em contêiner (MICROSOFT, 2026)."));
  t.push(bullet("Frontend de Catálogo (catalogo-front): aplicação de página única em Angular 22 que consome a API e oferece as telas de listagem com busca, filtros e paginação, cadastro, detalhe e edição, servida como conteúdo estático pelo nginx, com 120 testes unitários (GOOGLE, 2026)."));
  t.push(legendaQuadro("Quadro 10 – Aplicações de validação"));
  t.push(quadro(["Aplicação", "Tecnologia", "Implantação no Kubernetes", "Necessidades atendidas pela plataforma"], [
    ["catalogo-api", "ASP.NET Core (.NET 10), PostgreSQL 17", "Deployment, Service, HTTPRoute e StatefulSet do banco com volume persistente", "Segredos do cofre, CORS por ambiente, traces, métricas e logs via OTLP"],
    ["catalogo-front", "Angular 22, nginx", "Deployment, Service e HTTPRoute", "URL da API em tempo de execução, health check estático, logs do contêiner"],
  ], [16, 22, 31, 31]));
  t.push(fonte());
  t.push(p("As duas aplicações participam do mesmo fluxo: uma operação feita na interface gera uma requisição do navegador à API, cujo trace — da entrada no ASP.NET Core às consultas ao PostgreSQL — é registrado no Grafana Cloud. Como o frontend não tem instrumentação no navegador (Seção 4.7), o trace começa na API. As duas foram incorporadas seguindo exclusivamente o contrato do Quadro 9, sem alteração em arquivos fora de apps/<aplicação> no repositório da plataforma."));

  // 5.2
  t.push(h2("5.2", "Esforço e tempo de implantação"));
  t.push(p("A Tabela 1 compara o esforço de implantar cada aplicação manualmente, sem a plataforma, e pelo Golden Path. Na linha de base, a imagem foi construída na máquina do autor, transferida ao nó e os manifestos foram escritos e aplicados com kubectl, com credenciais de administrador do cluster; os segredos foram criados manualmente e o registro DNS do host precisaria ser criado à parte. Pela plataforma, contam-se os arquivos que a aplicação precisa fornecer fora do seu código (overlay e ci.yml); o Dockerfile, os endpoints de saúde e o SDK de telemetria são necessários nos dois cenários e foram excluídos da contagem."));
  t.push(legendaTabela("Tabela 1 – Esforço de implantação: manual × plataforma"));
  t.push(tabela(["Indicador", "API manual", "API plataforma", "Front manual", "Front plataforma"], [
    ["Passos na primeira implantação", LB.api.n_passos, PE["catalogo-api"].n_passos, LB.front.n_passos, PE["catalogo-front"].n_passos],
    ["Arquivos escritos", LB.api.arquivos, PE["catalogo-api"].arquivos, LB.front.arquivos, PE["catalogo-front"].arquivos],
    ["Linhas escritas", LB.api.linhas, PE["catalogo-api"].linhas, LB.front.linhas, PE["catalogo-front"].linhas],
    ["Passos por nova versão", LB.api.passos_por_nova_versao, 1, LB.front.passos_por_nova_versao, 1],
    ["Credencial do cluster necessária", "Sim", "Não", "Sim", "Não"],
    ["Arquivos alterados fora de apps/<app>", "—", 0, "—", 0],
  ], [34, 16, 17, 16, 17]));
  t.push(fonte("Fonte: elaborado pelo autor (Apêndice D, etapas 1 e 2)."));
  t.push(p(`Os números de arquivos e linhas da plataforma são maiores que os da linha de base, e não menores. Isso ocorre porque os manifestos manuais, escritos para o mínimo funcional, não incluem o que o template agrega: sondas de inicialização, limites de recursos, contexto de segurança, NetworkPolicy, segredos vindos do cofre e o ambiente de produção. Com o Golden Path, essas linhas não são escritas pela aplicação — vêm do template — e as que a aplicação escreve são majoritariamente declarações de suas particularidades. O ganho está nos passos: depois do onboarding, publicar uma nova versão custa um único passo (git push) contra ${LB.api.passos_por_nova_versao} passos manuais, sem credenciais do cluster e com rastro no Git. A linha de base também expôs um erro típico da configuração manual: sem sonda de inicialização, o contêiner manual da API foi reiniciado pela liveness durante as migrações do banco, o que não ocorre com o template.`));
  t.push(p("A Tabela 2 apresenta o tempo de implantação de uma mudança — correspondente ao lead time das métricas DORA —, do push do commit até a aplicação Healthy no Argo CD e respondendo 200 por HTTPS, em três repetições por aplicação. O tempo é decomposto na esteira de integração contínua (do push ao commit no overlay) e na reconciliação (do commit no overlay à aplicação no ar)."));
  t.push(legendaTabela("Tabela 2 – Tempo de implantação de uma mudança, em segundos (3 repetições)"));
  t.push(tabela(["Etapa", "API média", "API mín.", "API máx.", "Front média", "Front mín.", "Front máx."], [
    ["Esteira (push → commit no overlay)", ...mmm(API.esteira_s, "api.esteira"), ...mmm(FRONT.esteira_s, "front.esteira")],
    ["  dos quais: testes", ...mmm(API.testes_s, "api.testes"), ...mmm(FRONT.testes_s, "front.testes")],
    ["  dos quais: build, Trivy e publicação", ...mmm(API.build_s, "api.build"), ...mmm(FRONT.build_s, "front.build")],
    ["Detecção pelo Argo CD", ...mmm(API.deteccao_argo_s, "api.det"), ...mmm(FRONT.deteccao_argo_s, "front.det")],
    ["Reconciliação (commit → no ar)", ...mmm(API.reconciliacao_s, "api.rec"), ...mmm(FRONT.reconciliacao_s, "front.rec")],
    ["**Total (push → no ar)**", ...mmm(API.total_s, "api.total"), ...mmm(FRONT.total_s, "front.total")],
  ], [34, 11, 11, 11, 11, 11, 11]));
  t.push(fonte("Fonte: elaborado pelo autor (Apêndice D, etapa 2)."));
  t.push(p(`O tempo total ficou entre ${seg(Math.min(API.total_s.min, FRONT.total_s.min))} e ${seg(Math.max(API.total_s.max, FRONT.total_s.max))}. Duas parcelas dominam: a esteira, cuja maior parte é o build com as duas análises do Trivy e, na API, os testes de integração; e a detecção da mudança pelo Argo CD, que consulta o Git periodicamente (a cada 60 segundos, após o ajuste discutido na Seção 5.8) e responde pela maior parte da reconciliação. Em tempo de máquina, a linha de base manual foi mais rápida (${seg(LB.api.duracao_total_s)} para a API e ${seg(LB.front.duracao_total_s)} para o frontend, executando comandos já prontos), porque não testa, não analisa vulnerabilidades e não espera a consulta ao Git. A plataforma troca, portanto, alguns minutos de espera por verificações automáticas e pela ausência de trabalho manual; a espera do Argo CD pode ser eliminada com um webhook do repositório, o que exigiria expor o endpoint do Argo CD à internet e foi deixado como trabalho futuro.`));
  if (R.colega) {
    const C = R.colega;
    t.push(p(`Para mitigar o viés do avaliador (Seção 3.6), ${C.quem} incorporou ${C.aplicacao} seguindo apenas o guia docs/ONBOARDING.md, sem ajuda do autor${C.ajudas ? ", exceto em " + C.ajudas : ""}. O onboarding levou ${C.tempo_min} minutos e ${C.passos} passos, ${C.arquivos_fora === 0 ? "sem alteração em arquivos fora de apps/<aplicação>" : C.arquivos_fora + " alterações fora de apps/<aplicação>, registradas como falha do Golden Path"}. ${C.observacoes}`));
  } else {
    t.push(p("O teste de onboarding por uma pessoa sem contato prévio com a plataforma, apenas com o guia docs/ONBOARDING.md, não foi realizado nesta versão do trabalho; os números desta seção refletem, portanto, a execução pelo próprio autor, com as ameaças à validade discutidas na Seção 3.6."));
  }
  t.push(p(`As verificações da esteira mostraram efeito já nas primeiras publicações: das ${EST.publicacoes} execuções da esteira na avaliação, ${EST.barradas} foram interrompidas antes de chegar ao cluster — ${EST.descricao_barradas}. Nenhuma dessas versões foi implantada, e a taxa de falha de mudança das versões que chegaram ao cluster, excluídos os defeitos injetados de propósito na Seção 5.5, foi de zero.`));

  // 5.3
  t.push(h2("5.3", "Padronização"));
  const pa = PAD.apps["catalogo-api"], pf = PAD.apps["catalogo-front"];
  t.push(p("A Tabela 3 apresenta as três medidas de padronização definidas no Quadro 4, calculadas sobre os manifestos renderizados do ambiente de homologação."));
  t.push(legendaTabela("Tabela 3 – Indicadores de padronização"));
  t.push(tabela(["Indicador", "catalogo-api", "catalogo-front"], [
    ["Linhas escritas pela aplicação (base + hml)", pa.linhas_escritas, pf.linhas_escritas],
    ["Linhas do manifesto renderizado", pa.linhas_renderizadas, pf.linhas_renderizadas],
    ["Razão escritas ÷ renderizadas", num(pa.razao_escritas_renderizadas, 2), num(pf.razao_escritas_renderizadas, 2)],
    ["Itens do checklist de conformidade atendidos", pa.conformidade, pf.conformidade],
    ["Campos do Deployment iguais entre as aplicações", `${PAD.deployment.campos_iguais} de ${PAD.deployment.campos_total}`, ""],
  ], [52, 24, 24]));
  t.push(fonte("Fonte: elaborado pelo autor (script padronizacao.py)."));
  t.push(p(`Os dois Deployments renderizados compartilham ${PAD.deployment.campos_iguais} de ${PAD.deployment.campos_total} campos (${pct(PAD.deployment.campos_iguais, PAD.deployment.campos_total)}). Os ${PAD.deployment.campos_divergentes} campos divergentes são exatamente os que o contrato prevê que variem: imagem e digest, variáveis de ambiente próprias (cadeia de conexão e CORS na API, URL da API no frontend), caminhos das sondas, recursos solicitados e volumes graváveis adicionais. Os itens de segurança, de entrega e de observabilidade do checklist são idênticos nas duas aplicações, porque vêm do template e não foram reescritos por elas.`));

  // 5.4
  t.push(h2("5.4", "Observabilidade obtida"));
  t.push(p(`Com as aplicações no ar, foi gerada carga com o k6 por cinco minutos (${OBS.carga}). A Tabela 4 apresenta a matriz de cobertura: cada sinal foi procurado no Grafana Cloud, filtrando pelo namespace ou pelo nome do serviço, sem nenhuma configuração feita para as aplicações além do contrato.`));
  t.push(legendaTabela("Tabela 4 – Cobertura de observabilidade por aplicação"));
  t.push(tabela(["Sinal", "catalogo-api", "catalogo-front", "Origem"], OBS.matriz.map(l => [l.sinal, l.api, l.front, l.origem]), [30, 18, 18, 34]));
  t.push(fonte("Fonte: elaborado pelo autor."));
  t.push(p(OBS.texto_primeiro_dado));
  t.push(p("A Figura 7 mostra um trace de uma listagem durante a carga: o span do servidor HTTP (ASP.NET Core) contém os dois spans de banco gerados pelo Entity Framework Core — a contagem do total e a consulta da página —, o que permite atribuir a latência de cada requisição à aplicação ou ao banco."));
  t.push(...figura("Figura 7 – Trace de uma requisição GET /produtos com as consultas ao PostgreSQL", "figura7-trace.png", "Fonte: Grafana Cloud, capturado pelo autor."));

  // 5.5
  t.push(h2("5.5", "Falha e recuperação"));
  const ri = REC.inicializacao, rf = REC.funcional;
  t.push(p("Os dois tipos de falha definidos no Apêndice D foram injetados três vezes cada na API. Como a suíte de testes barra os dois defeitos — o que é, em si, um resultado positivo da esteira —, o commit defeituoso desligou a etapa de testes para simular um defeito que escapa à suíte. A Tabela 5 apresenta os tempos medidos; a reação (t2 − t1) foi executada por script logo após a detecção e representa, portanto, o tempo mínimo, sem o tempo humano de resposta a um alerta."));
  t.push(legendaTabela("Tabela 5 – Tempos de detecção e recuperação, em segundos (3 repetições por tipo)"));
  t.push(tabela(["Intervalo", "Inicialização média", "mín.", "máx.", "Funcional média", "mín.", "máx."], [
    ["Detecção (t1 − t0)", ...mmm(ri.deteccao_s, "ri.det"), ...mmm(rf.deteccao_s, "rf.det")],
    ["Reação (t2 − t1)", ...mmm(ri.reacao_s, "ri.rea"), ...mmm(rf.reacao_s, "rf.rea")],
    ["Reconciliação (t3 − t2)", ...mmm(ri.reconciliacao_s, "ri.rec"), ...mmm(rf.reconciliacao_s, "rf.rec")],
    ["**Total (t3 − t0)**", ...mmm(ri.total_s, "ri.tot"), ...mmm(rf.total_s, "rf.tot")],
  ], [28, 14, 10, 10, 14, 10, 10]));
  t.push(fonte("Fonte: elaborado pelo autor (Apêndice D, etapa 5)."));
  t.push(p(`Na falha de inicialização, a versão defeituosa nunca atendeu tráfego: o rolling update manteve o pod anterior, a rota pública respondeu ${ri.health_publico_durante_falha.join(" e ")} durante todo o episódio e o Argo CD marcou a aplicação como Degraded quando o prazo de progresso de 180 segundos expirou — o que define o tempo de detecção. O impacto para o usuário foi nulo; o rollback apenas devolve o estado declarado ao da versão estável. Na falha funcional, ao contrário, a versão entrou no ar, passou nas sondas e o Argo CD a exibiu como Synced e Healthy, e só a observabilidade detectou o problema. O alerta de erros 5xx do Grafana Cloud disparou, em média, ${seg(rf.deteccao_s.media)} após a versão defeituosa entrar no overlay, enquanto a primeira resposta 500 observada por uma sonda externa ocorreu ${seg(R.recuperacao.funcional.deteccao_sonda_s.media)} após. A diferença soma o intervalo de exportação das métricas pelo SDK (60 segundos), a janela de 2 minutos da taxa de erros e o período de confirmação de 2 minutos da regra, escolhidos para evitar alarmes por erros isolados; uma janela menor detectaria antes, ao custo de mais alarmes falsos. Esse contraste é o principal resultado do experimento: a plataforma impede, sem intervenção, que uma versão que não inicia substitua a anterior, mas um defeito funcional depende da observabilidade para ser detectado, o que justifica o requisito RNF07.`));
  t.push(p(`A reconciliação após a reversão levou em média ${seg(ri.reconciliacao_s.media)} e ${seg(rf.reconciliacao_s.media)}, dominada novamente pela consulta periódica do Argo CD ao Git (em média ${seg(ri.argo_detectou_reversao_s.media)} e ${seg(rf.argo_detectou_reversao_s.media)} até a nova revisão ser detectada). Corrigir a falha pelo repositório da aplicação, com uma nova versão, levaria além disso o tempo da esteira (Tabela 2); a reversão no overlay devolve a imagem anterior, já existente, sem novo build. A Figura 6 mostra a linha do tempo de uma das repetições de cada tipo.`));

  // 5.6
  t.push(h2("5.6", "Consumo de recursos da plataforma"));
  const comp = [["Argo CD", "argocd"], ["Kong", "kong"], ["cert-manager", "cert-manager"], ["External Secrets Operator", "external-secrets"], ["Reloader", "reloader"], ["Coleta de telemetria (Alloy e exportadores)", "monitoring"]];
  const tot = comp.reduce((a, [, ns]) => ({ cpu: a.cpu + exigir(OV[ns], ns).cpu_m, mem: a.mem + OV[ns].mem_mi }), { cpu: 0, mem: 0 });
  t.push(p("A Tabela 6 apresenta o consumo médio de CPU e memória dos componentes comuns, em 20 amostras do metrics-server a cada 30 segundos, frente à capacidade do nó (2 OCPU, equivalentes a 2.000 milicores, e 11,6 GiB alocáveis)."));
  t.push(legendaTabela("Tabela 6 – Consumo médio dos componentes da plataforma"));
  t.push(tabela(["Componente", "CPU (milicores)", "Memória (MiB)", "% da CPU do nó", "% da memória do nó"], [
    ...comp.map(([n, ns]) => [n, num(OV[ns].cpu_m, 0), num(OV[ns].mem_mi, 0), num(OV[ns].cpu_m / 20, 1) + "%", num(OV[ns].mem_mi / 118.7, 1) + "%"]),
    ["**Total da plataforma**", num(tot.cpu, 0), num(tot.mem, 0), num(tot.cpu / 20, 1) + "%", num(tot.mem / 118.7, 1) + "%"],
  ], [36, 16, 16, 16, 16]));
  t.push(fonte("Fonte: elaborado pelo autor (Apêndice D, etapa 6)."));
  t.push(p(`Os componentes comuns consomem cerca de ${num(tot.cpu / 20, 0)}% da CPU e ${num(tot.mem / 118.7, 0)}% da memória do nó em repouso, deixando a maior parte da capacidade para as aplicações. A coleta de telemetria é o maior consumidor de memória, mesmo com o armazenamento e a consulta fora do cluster; manter Prometheus, Loki e Tempo no próprio nó, como seria necessário sem o Grafana Cloud, aumentaria esse valor. O resultado sustenta o requisito RNF06.`));
  const OC = R.overhead && R.overhead.com_apps_carga;
  if (OC) {
    const totC = comp.reduce((a, [, ns]) => a + (OC[ns] ? OC[ns].cpu_m : 0), 0);
    t.push(p(`Durante a carga da Seção 5.4, os mesmos componentes somaram ${num(totC, 0)} milicores, com o aumento concentrado no Kong (${num(OC.kong.cpu_m, 0)} milicores), que encaminha as requisições, e no Argo CD; a API em homologação usou ${num(OC["catalogo-api-hml"].cpu_m, 0)} milicores e ${num(OC["catalogo-api-hml"].mem_mi, 0)} MiB, e o frontend menos de ${num(Math.max(1, Math.ceil(OC["catalogo-front-hml"].cpu_m)), 0)} milicores e ${num(Math.ceil(OC["catalogo-front-hml"].mem_mi), 0)} MiB.`));
  }

  // 5.7
  t.push(h2("5.7", "Verificação dos requisitos"));
  t.push(p("O Quadro 11 verifica cada requisito dos Quadros 5 e 6, com a evidência correspondente."));
  t.push(legendaQuadro("Quadro 11 – Verificação dos requisitos"));
  const G = R.grafana || {};
  const verif = [
    ["RF01", "Atendido", "Todas as implantações das Seções 5.2 e 5.5 partiram de commits; nenhum kubectl apply foi usado nas aplicações da plataforma."],
    ["RF02", "Atendido", `Esteira compartilhada com testes, Trivy, build arm64 e publicação; ${EST.publicacoes} execuções, ${EST.barradas} barradas antes do cluster (Seção 5.2).`],
    ["RF03", "Atendido", `Reversão do commit no overlay restabeleceu a versão estável nos ${REC.inicializacao.repeticoes.length + REC.funcional.repeticoes.length} episódios de falha (Tabela 5).`],
    ["RF04", G.alertas ? "Atendido" : "Atendido", "Métricas de contêiner e logs coletados para as duas aplicações sem configuração individual; traces e métricas de aplicação da API pelo SDK (Tabela 4)."],
    ["RF05", "Atendido", "Credenciais do banco e do registro vindas do OCI Vault pelo External Secrets Operator; nenhum valor no Git."],
    ["RF06", "Atendido", "Hosts de homologação e produção servidos por HTTPS com certificado curinga Let’s Encrypt renovado pelo cert-manager."],
    ["RF07", R.dns_curinga ? "Atendido" : "Parcialmente atendido",
      R.dns_curinga ? "As duas aplicações foram incorporadas só com os artefatos do Quadro 9; nenhum arquivo fora de apps/<aplicação> foi alterado e o DNS curinga dispensa registro por host."
                    : "Nenhum arquivo fora de apps/<aplicação> foi alterado, mas cada host novo ainda exige um registro DNS criado pela equipe de plataforma (sem registro curinga na subzona)."],
    ["RNF01", "Atendido", "Segredos fora do Git; esteira sem credencial do cluster; aplicações sem root, sem escalonamento e sem capabilities (18 de 18 itens do checklist); exceção declarada para os coletores."],
    ["RNF02", "Atendido", "Roteiro do Apêndice C e docs/RECONSTRUIR_CLUSTER.md; componentes de aplicação reconstruídos pelo Argo CD a partir do Git."],
    ["RNF03", "Atendido", "Toda versão implantada corresponde a um commit deploy(<aplicação>) ou promove(<aplicação>) no repositório da plataforma."],
    ["RNF04", "Atendido", "Todas as imagens publicadas para linux/arm64 e executadas no nó Ampere."],
    ["RNF05", "Atendido", "OCI Always Free, GitHub (repositórios privados, Actions e GHCR) e Grafana Cloud Free; nenhum custo incorrido."],
    ["RNF06", "Atendido", "Componentes comuns com requests e limits; consumo medido na Tabela 6."],
    ["RNF07", G.alertas ? "Atendido" : "Parcialmente atendido",
      G.alertas ? "Telemetria, painel e as regras de alerta do Quadro 8 mantidos no Grafana Cloud, fora do cluster."
                : "Telemetria e painéis no Grafana Cloud, fora do cluster; as regras de alerta do Quadro 8 estão versionadas, mas não foram aplicadas no período da avaliação."],
  ];
  t.push(quadro(["Requisito", "Situação", "Evidência"], verif, [12, 18, 70]));
  t.push(fonte());

  // 5.8
  t.push(h2("5.8", "Discussão"));
  t.push(p(`Em relação às métricas DORA, o tempo de espera de mudanças ficou em ${seg(Math.min(API.total_s.min, FRONT.total_s.min))} a ${seg(Math.max(API.total_s.max, FRONT.total_s.max))} após o ajuste do intervalo de consulta do Argo CD, a taxa de falha das mudanças que chegaram ao cluster foi nula fora dos defeitos injetados, e o tempo de recuperação de uma falha funcional, do commit defeituoso ao serviço restabelecido, foi de ${seg(REC.funcional.total_s.media)} em média, com a reação humana reduzida a um git revert. A frequência de implantação não é limitada pela plataforma: cada push na branch principal gera uma implantação em homologação, e a promoção é um clique.`));
  t.push(p(`A primeira implantação de cada aplicação levou ${seg(API.primeira.total_s)} (API) e ${seg(FRONT.primeira.total_s)} (frontend), dos quais ${seg(API.primeira.deteccao_argo_s)} e ${seg(FRONT.primeira.deteccao_argo_s)} foram espera pela detecção do commit pelo Argo CD, com a configuração padrão (consulta a cada 120 segundos, mais até 60 segundos de variação e um cache de revisões de 3 minutos). A medição levou a reduzir o intervalo para 60 segundos, e a detecção passou a ${seg(API.deteccao_argo_s.media)} e ${seg(FRONT.deteccao_argo_s.media)} em média nas repetições — um ciclo de construção, avaliação e ajuste típico da Design Science Research. A primeira repetição, que trazia mudanças reais de código, foi mais lenta que as seguintes, feitas com commits vazios que aproveitaram o cache de build da esteira; o intervalo da Tabela 2 inclui os dois casos.`));
  t.push(p("Os resultados dialogam com os trabalhos relacionados. Maulana, Umar e Yudhana (2025) relatam redução de cerca de 40% no tempo de implantação com Argo CD em relação à implantação manual; aqui, em tempo de máquina, a implantação manual foi mais rápida, porque a linha de base não inclui o tempo humano de escrever comandos e manifestos e a esteira executa testes de integração e duas análises de segurança que o processo manual não faz. O ganho mensurável está no número de passos, na ausência de credenciais do cluster fora dele e na uniformidade, e não na velocidade bruta. Ramadoni, Utami e Fatta (2021) defendem o modelo puxado para tornar o rollback efetivo; este trabalho acrescenta a medição do tempo de recuperação e a distinção entre os dois tipos de falha, que mostra que a plataforma contém sozinha a falha de inicialização, mas depende da observabilidade para a falha funcional. A carga de cinco minutos sobre a API instrumentada manteve o percentil 95 da latência em torno de 52 milissegundos, compatível com o baixo custo de instrumentação medido por Gomes et al. (2024), embora este trabalho não tenha medido a mesma API sem instrumentação."));
  t.push(p("Três achados práticos merecem registro. Primeiro, as verificações da esteira já mostraram valor antes de qualquer experimento: a análise de imagem barrou uma vulnerabilidade crítica com correção disponível na imagem base do nginx, e os testes de integração barraram um erro de contrato (o tipo de conteúdo das respostas de validação) que os testes de unidade não detectavam. Segundo, o template publica a imagem no registro antes de analisá-la, e uma imagem barrada fica no GHCR sem chegar ao cluster; analisar antes de publicar é uma melhoria simples para a esteira. Terceiro, o próprio experimento de falha revelou um defeito no template: quando a etapa de testes era desligada (opção documentada do template), a etapa que grava a imagem no overlay também era pulada, porque o GitHub Actions propaga a situação de uma etapa ignorada a todas as que dependem dela; a correção, uma linha no template, passou a valer para todas as aplicações ao mesmo tempo, o que ilustra a vantagem de manter a esteira em um único lugar. Por fim, a linha de base manual, embora mais curta em linhas, omitiu a sonda de inicialização e teve o contêiner reiniciado durante as migrações do banco — o tipo de erro que o template elimina ao concentrar essas decisões em um único lugar."));

  // 5.9
  t.push(h2("5.9", "Limitações"));
  t.push(p("O experimento foi conduzido em um cluster de nó único. O Kubernetes recupera automaticamente contêineres e pods que falham, mas não protege contra a falha da própria máquina virtual: uma pane, uma reinicialização ou uma manutenção do provedor interrompe todas as aplicações e os próprios componentes da plataforma, inclusive o Argo CD. Pelo mesmo motivo, réplicas aumentam a capacidade, mas não oferecem alta disponibilidade, e a escalabilidade horizontal da proposta não foi avaliada: o trabalho demonstra a padronização e a reprodutibilidade da implantação, não sua escala."));
  t.push(p("A persistência utiliza a StorageClass local-path, que grava os volumes em um diretório do disco da máquina virtual. O banco de dados da API fica, portanto, vinculado a esse nó e é perdido junto com o disco; essa forma de armazenamento não substitui um volume distribuído nem dispensa uma rotina de backup. Na gestão de segredos, a NetworkPolicy protege a identidade da máquina virtual apenas nos namespaces das aplicações; qualquer componente comprometido fora deles ainda poderia ler o cofre."));
  t.push(p("A generalidade demonstrada é limitada: as duas aplicações são serviços HTTP sem estado no contêiner, e cargas de outro tipo, como processamento assíncrono ou tarefas agendadas, não foram incorporadas, embora o AppProject já admita Jobs e CronJobs. A telemetria depende da camada gratuita do Grafana Cloud, cujas cotas e retenção são definidas pelo serviço, e da conectividade da máquina virtual com a internet. Por fim, as medições foram feitas pelo autor, com as ameaças à validade discutidas na Seção 3.6."));
  return t;
};
