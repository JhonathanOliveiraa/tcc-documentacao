# Planejamento da parte prática — Plataforma DevOps para o TCC

> **Status em 2026-09-30:** o cluster descrito aqui recebeu uma aplicação real (CaIA — API .NET +
> frontend Angular, prod e hml) por uma esteira GitOps completa. Decisões, problemas, causas-raiz e
> medições estão em [`APRENDIZADOS_MIGRACAO_CAIA.md`](APRENDIZADOS_MIGRACAO_CAIA.md). O CaIA serviu
> para validar a infraestrutura e gerar aprendizados; **não** é a aplicação de validação do TCC. A
> validação (Fase 7) usa duas aplicações novas, criadas para o trabalho: a API de Produtos (ASP.NET
> Core) e o Frontend de Catálogo (Angular).
>
> Mudanças técnicas em relação a este plano: MetalLB **removido** (confirmado que o L2 não funciona
> na VCN); Ingress **Kong** atrás do ServiceLB do k3s (em vez de NGINX em `hostNetwork` — o
> `ingress-nginx` foi aposentado); observabilidade no **Grafana Cloud** (em vez de Prometheus/Loki/Tempo
> no cluster); segredos no **OCI Vault** entregues pelo **External Secrets Operator** (em vez de
> Sealed Secrets; no CaIA os Secrets ainda foram criados à mão). O CaIA usou
> Azure Repos + Azure Pipelines + Docker Hub por **preferência daquele projeto**; o padrão deste plano
> continua **GitHub + GHCR + GitHub Actions**.
>
> **Para montar uma VM do zero**, siga `docs/RECONSTRUIR_CLUSTER.md` do repositório `tcc-platform`
> (roteiro na ordem certa, com versões fixadas, verificações por fase e arquivos de configuração).

## Objetivo do experimento

Construir uma plataforma reprodutível para implantar, observar e reverter
aplicações conteinerizadas usando Kubernetes e GitOps. As aplicações de
validação entram somente depois que a plataforma estiver pronta: uma API e um
frontend deverão seguir o mesmo contrato de onboarding, sem mudança na
infraestrutura comum.

## Ambiente já disponível

| Item | Estado atual |
|---|---|
| Infraestrutura | VM Ampere na Oracle Cloud Infrastructure (OCI) |
| Cluster | k3s v1.36.4, um nó, Ubuntu 24.04, ARM64 |
| Capacidade alocável | 2 vCPU, aproximadamente 11,6 GiB de memória e 42 GiB de armazenamento efêmero |
| Persistência | StorageClass `local-path` |
| Entrada HTTP | Kong 3.9 (chart `kong/ingress` 0.24.0) atrás do ServiceLB do k3s |
| TLS | cert-manager v1.21.2, Let's Encrypt com DNS-01 no Cloudflare |
| GitOps | Argo CD v3.5.3 |
| Observabilidade | Grafana Alloy v1.19.2 (`k8s-monitoring` 4.5.2) enviando ao Grafana Cloud |
| MetalLB | Removido (o L2 não funciona na VCN da OCI) |

Versões conferidas no cluster em 2026-10-13. A plataforma do TCC reaproveita esses componentes; as
Fases 1 a 4 passam a registrar, versionar no `tcc-platform` e evidenciar o que já existe, em vez de
reinstalar.

### Decisão de rede

O MetalLB em L2 **não será usado**. A VCN padrão da OCI não suporta takeover de
IP via GARP, que é necessário ao modo L2. A plataforma publicará aplicações por
um controlador de entrada em nó único (Kong, portas 80 e 443, pelo ServiceLB do
k3s). A Security List/NSG da OCI permitirá apenas as portas necessárias.

## Arquitetura planejada

```text
Git remoto
  │ commit de infraestrutura ou versão de imagem
  ▼
Argo CD ── reconciliação GitOps ──► k3s na VM OCI
                                      ├── Kong (entrada HTTP) + cert-manager (TLS)
                                      ├── External Secrets Operator ◄── OCI Vault
                                      ├── namespaces de aplicações
                                      └── Grafana Alloy (coletor + receptor OTLP)
                                                │ métricas, logs, eventos e traces
                                                ▼
                                      Grafana Cloud (Prometheus/Mimir, Loki, Tempo, alertas)
```

O Git é a fonte de verdade. A única exceção é o bootstrap inicial do Argo CD;
depois dele, toda alteração nos componentes da plataforma será feita por commit.

## Decisões técnicas

| Tema | Decisão | Motivo |
|---|---|---|
| Organização | `tcc-platform` (tudo o que o Argo aplica) + `tcc-pipeline-templates` (templates de CI backend/frontend) + um repositório de código por aplicação | Separa código de configuração (padrão GitOps); o CI de cada aplicação é um `ci.yml` curto que chama o template compartilhado, como os templates `extends` de Azure Pipelines usados em ambiente corporativo; o CI só altera o overlay da própria aplicação. |
| GitOps | Argo CD com padrão app-of-apps | Separa bootstrap, plataforma e futuras aplicações. |
| Manifestos | Kustomize | Já vem no `kubectl` e permite reutilizar um base sem duplicação. |
| Entrada HTTP | Kong (Gateway API/Ingress) atrás do ServiceLB do k3s | Publica HTTP/HTTPS pela VM sem MetalLB; o `ingress-nginx` foi aposentado pelo projeto Kubernetes. |
| TLS | cert-manager, após haver domínio/DNS | Permite demonstrar HTTPS automático com Let’s Encrypt. |
| Registry | GHCR ou Docker Hub, com imagens `linux/arm64` | A VM é ARM64; imagem somente `amd64` não executará nela. |
| Segredos | **OCI Vault** + **External Secrets Operator** (ClusterSecretStore com Instance Principal) | Os valores ficam só no Vault da OCI; o Git guarda apenas quais secrets do Vault viram quais chaves no Kubernetes. A VM se autentica na OCI por Instance Principal (Dynamic Group + Policy `read secret-family`), sem credencial dentro do cluster. Vault padrão com chave *Software* não tem custo. |
| Observabilidade | **Grafana Cloud** (free tier) + Grafana Alloy no cluster (chart `grafana/k8s-monitoring`) | Métricas, logs, traces e alertas fora da VM: continuam funcionando se o nó cair e custam ~125 MB no cluster, contra ~1,5–2 GB de Prometheus + Loki + Tempo + Grafana self-hosted. |
| Métricas | Alloy → Prometheus (Mimir) do Grafana Cloud | Métricas do cluster (kube-state-metrics, node-exporter) e das aplicações. |
| Logs | Alloy → Loki do Grafana Cloud | Logs dos pods e eventos do Kubernetes. |
| Traces | Aplicações → OTLP no Alloy → Tempo do Grafana Cloud | Permite evidenciar rastreabilidade entre frontend e API. |
| Visualização | Grafana do Grafana Cloud | Consolida métricas, logs e traces em painéis, sem Grafana no cluster. |

## Estrutura do repositório

```text
tcc-platform/
├── bootstrap/                  # único apply manual: instala o Argo CD
├── clusters/oci-k3s/
│   ├── root-application.yaml   # ponto de entrada do Argo CD
│   └── kustomization.yaml
├── platform/
│   ├── ingress/
│   ├── cert-manager/
│   ├── observability/
│   ├── external-secrets/       # operador + ClusterSecretStore do OCI Vault
│   └── argocd-projects/
├── golden-path/
│   ├── base/                   # Deployment, Service, probes, resources
│   └── overlays/               # configuração específica de cada app
├── apps/                       # vazio nesta etapa; usado na validação
└── docs/
    ├── arquitetura.md
    ├── runbook.md
    └── evidencias.md
```

Fora dele, um repositório **por aplicação** (`catalogo-api`, `catalogo-front`) com código, Dockerfile
e um `ci.yml` curto que chama o template compartilhado do repositório `tcc-pipeline-templates`
(`backend-service.yml` ou `frontend-service.yml`). O texto, a apresentação e este planejamento ficam
no repositório `tcc-documentacao`. O CI desses repositórios só escreve em `tcc-platform/apps/<app>/`
(commit da tag da imagem); o Argo CD lê apenas o `tcc-platform`. Mesma estrutura descrita na
Seção 4.2 do texto do TCC.

## Fases de execução

### Fase 1 — Baseline e segurança da infraestrutura

**Objetivo:** registrar o ambiente e reduzir a superfície de exposição antes de
instalar componentes.

- Registrar versões do Ubuntu, k3s, Kubernetes, recursos do nó e StorageClass.
- Restringir a API Kubernetes (`6443`) ao IP administrativo; não expô-la para a
  internet inteira.
- Liberar `80` e `443` somente quando o Ingress estiver instalado; manter SSH
  protegido por chave e regra de origem restrita.
- Criar namespaces `argocd`, `monitoring`, `kong`, `external-secrets` e `apps`.
- Definir limites de recursos para o Alloy (a retenção fica no Grafana Cloud).

**Evidências:** saída de `kubectl get nodes -o wide`, regras de rede da OCI e
lista inicial de namespaces.

### Fase 2 — Repositório remoto e bootstrap GitOps

**Objetivo:** fazer o Argo CD consumir o estado desejado a partir de Git.

- Criar o repositório remoto e publicar esta estrutura.
- Instalar o Argo CD apenas no bootstrap inicial.
- Configurar uma chave de leitura (deploy key) se o repositório for privado.
- Aplicar somente a `root-application`; ela passa a reconciliar todo o conteúdo
  em `platform/`.
- Criar `AppProject` com destinos limitados aos namespaces do experimento.
- Instalar o External Secrets Operator pelo Argo CD e criar o `ClusterSecretStore`
  do OCI Vault com `principalType: InstancePrincipal`. Na OCI: criar o Vault (sem
  marcar *virtual private vault*, que é pago), uma chave *Software*, o Dynamic
  Group com o OCID da VM e a Policy `Allow dynamic-group <grupo> to read
  secret-family in compartment <compartimento>`.

**Critério de aceite:** a interface e a CLI do Argo CD mostram a aplicação raiz
como `Synced` e `Healthy`; uma alteração inofensiva no Git é reconciliada sem
`kubectl apply` manual.

### Fase 3 — Entrada HTTP e certificados

**Objetivo:** disponibilizar uma rota pública previsível para as futuras
aplicações.

- Versionar a configuração do Kong (já instalado) e as rotas no `tcc-platform`.
- Validar acesso HTTP pelo IP público da VM ou por hostname temporário.
- Se houver domínio, instalar cert-manager e emitir certificado TLS.
- Criar um Ingress de teste e confirmar que apenas 80/443 são expostos.

**Critério de aceite:** requisição externa chega a um serviço de teste e a rota
TLS funciona quando um domínio estiver disponível.

### Fase 4 — Observabilidade da plataforma

**Objetivo:** disponibilizar métricas, logs e traces antes das aplicações.

- Instalar o Grafana Alloy pelo chart `grafana/k8s-monitoring` (comando gerado
  pelo Grafana Cloud), com o token guardado em Secret, fora do Git.
- Habilitar o receptor OTLP gRPC/HTTP no Alloy para os traces das aplicações. O
  assistente do k8s-monitoring não oferece OTLP: o receptor é um pipeline manual
  no Fleet Management (ver `APRENDIZADOS_MIGRACAO_CAIA.md` e o caso Norte).
- Usar os dashboards de Kubernetes do Grafana Cloud e criar um dashboard mínimo
  do cluster: CPU, memória, reinícios de pods e uso de armazenamento.
- Criar alertas básicos (pod em CrashLoop, nó indisponível) e um check externo
  (Synthetic Monitoring) para a rota pública.

**Critério de aceite:** o Grafana Cloud mostra métricas, logs e eventos reais
da VM; um trace de teste enviado ao Alloy aparece no Tempo.

### Fase 5 — Golden Path

**Objetivo:** definir o contrato reutilizável que será usado pela API e pelo
frontend, sem implementar as aplicações ainda.

O template deve exigir:

- `Deployment` com `readinessProbe`, `livenessProbe` e `startupProbe`;
- `Service` interno e `Ingress` opcional;
- `requests` e `limits` de CPU/memória;
- execução sem privilégios, sistema de arquivos somente leitura quando possível
  e capabilities removidas;
- rótulos uniformes (`app.kubernetes.io/name`, `version`, `component`);
- variáveis de OpenTelemetry (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`)
  que apontam ao receptor OTLP do Alloy;
- anotações de scrape (`k8s.grafana.com/scrape`) para as métricas da aplicação;
- `HorizontalPodAutoscaler` opcional, limitado pela capacidade de nó único;
- segredos por `ExternalSecret` apontando ao OCI Vault (nomes no padrão
  `<AMB>-TCC-<APP>-<CHAVE>`), nunca valores no Git.

**Critério de aceite:** `kustomize build` renderiza um serviço-modelo sem
edições na infraestrutura comum.

### Fase 6 — Pipeline de imagem e promoção GitOps

**Objetivo:** transformar uma alteração de código em nova versão declarada no
Git, pronta para o Argo CD reconciliar.

- GitHub Actions com workflows reutilizáveis no repositório `tcc-pipeline-templates`
  (`backend-service.yml` e `frontend-service.yml`); cada aplicação só declara os parâmetros.
- Executar testes, construir a imagem `linux/arm64`, atribuir tag imutável pelo
  SHA do commit e publicá-la no registry.
- Atualizar o tag no overlay Kustomize por commit automatizado ou Pull Request.
- Argo CD detecta a alteração e sincroniza a nova versão.

**Critério de aceite:** uma imagem publicada aparece em um Deployment somente
após o tag correspondente estar versionado no Git.

### Fase 7 — Validação com as aplicações e rollback

**Objetivo:** executar os experimentos que preencherão o Capítulo 5.

- Criar as duas aplicações de validação — API de Produtos (ASP.NET Core) e
  Frontend de Catálogo (Angular) — e fazer o onboard usando exclusivamente o
  Golden Path.
- Registrar tempo e número de passos desde o onboarding até `Healthy`.
- Gerar tráfego e capturar métricas, logs e traces no Grafana Cloud.
- Publicar deliberadamente uma versão defeituosa, registrar a falha e reverter
  o commit que alterou a imagem.
- Medir o tempo entre a reversão no Git e a recuperação observada no Argo CD.

**Critério de aceite:** as duas aplicações são reconciliadas, observáveis e
recuperadas por reversão de commit, sem alteração manual no cluster.

## Evidências para o TCC

| Figura/seção do TCC | Evidência prática a capturar |
|---|---|
| Figura 1 | Diagrama final da arquitetura deste planejamento. |
| Figura 2 | Histórico Git → Argo CD `Synced` → pods atualizados. |
| Figura 3 | Árvore real do repositório `tcc-platform`. |
| Figura 4 | Fluxo aplicação → Alloy (OTLP) → Grafana Cloud (Tempo/Prometheus/Loki) → Grafana. |
| Figura 5 | Dashboard do Grafana Cloud com métricas e uma consulta de logs/traces. |
| Figura 6 | Commit defeituoso, estado degradado e commit de reversão com recuperação. |
| Seção 5.2 | Tabela: passos manuais, arquivos e tempo de implantação manual vs. Golden Path. |
| Seção 5.3 | Capturas e URLs/consultas usadas para métricas, logs e traces. |
| Seção 5.4 | Linha do tempo da falha, detecção e rollback. |

## Decisões pendentes para a próxima sessão

Estas decisões não impedem organizar os manifestos e a documentação, mas devem
ser resolvidas antes do bootstrap efetivo da plataforma.

| Decisão | Opções | Recomendação inicial | Impacto |
|---|---|---|---|
| Repositório Git remoto | GitHub, GitLab ou Azure DevOps | GitHub | O Argo CD precisa de URL e credencial de leitura se o repositório for privado. |
| Registry de imagens | GHCR, Docker Hub ou outro registry | GHCR, se o GitHub for escolhido | O CI publicará imagens compatíveis com `linux/arm64`. |
| CI | GitHub Actions ou Azure Pipelines | GitHub Actions, junto com GHCR | Define onde executar testes, build e a atualização do tag no Git. |
| Exposição inicial | IP/hostname temporário ou domínio próprio | IP/hostname temporário primeiro | Define se o Ingress entra inicialmente apenas em HTTP ou já com TLS. |
| Domínio e DNS | Usar domínio próprio ou adiar | Adiar até o Ingress responder | cert-manager e Let’s Encrypt dependem de domínio e validação DNS/HTTP. |
| Regras de rede OCI | Origens permitidas para SSH, API Kubernetes, HTTP e HTTPS | SSH e `6443` restritos ao IP administrativo; `80/443` públicos quando o Ingress existir | Evita exposição desnecessária da VM e da API do cluster. |
| Volume de telemetria | O que coletar no Alloy | Começar com o padrão do k8s-monitoring e cortar o que não for usado | A retenção é a do free tier do Grafana Cloud; o limite real é a cota de séries, logs e traces. |
| Limites de recursos | Valores iniciais para cada componente | Definir após a primeira medição no nó | Evita que a observabilidade concorra com as aplicações de validação. |
| Métricas do experimento | Método de cronometragem e carga de teste | Cronômetro por etapa, `k6` para tráfego e Git/Argo CD como evidência | Produz números reproduzíveis para as Seções 5.2, 5.3 e 5.4. |

### Checklist de retomada

1. Escolher Git remoto, registry e CI.
2. Criar o repositório remoto e informar a URL.
3. Definir se haverá domínio próprio nesta fase.
4. Conferir as regras da OCI e registrar as origens permitidas.
5. Iniciar as Fases 1 e 2 do planejamento.

## Limitações a declarar no texto

- Há somente um nó; réplicas e HPA não fornecem alta disponibilidade contra
  falha da VM ou manutenção do nó.
- O armazenamento `local-path` é local ao nó e não substitui backup ou volume
  distribuído.
- A telemetria depende do free tier do Grafana Cloud (cotas e retenção fixadas
  pelo serviço) e de conectividade da VM com a internet.
- O experimento mede viabilidade e padronização; não mede desempenho de
  produção em larga escala.
