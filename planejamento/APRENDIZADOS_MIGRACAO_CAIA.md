# Aprendizados da migração do CaIA para o k3s na OCI

Registro técnico da migração real de uma aplicação (API .NET + frontend Angular, multi-tenant)
da AWS para o cluster k3s de nó único na Oracle Cloud, usando GitOps. Serve como **caso de
validação** da plataforma planejada em `PLANEJAMENTO_DEVOPS.md` e como fonte para os
Capítulos 4 (Desenvolvimento) e 5 (Resultados e Discussão).

> Período: 29 e 30 de setembro de 2026. Horários em UTC-3, salvo indicação.
> Guia operacional completo (comandos e troubleshooting): `RepoAltaSistemas/MIGRACAO-OCI-K3S.md`.

---

## 1. Contexto

| Item | Antes (AWS) | Depois (OCI) |
|---|---|---|
| API (.NET 10) | EC2 com `docker compose`, deploy por SSH | k3s, Deployment reconciliado pelo Argo CD |
| Frontend (Angular 21) | S3 + CloudFront | k3s, nginx em container |
| Arquivos (RAG) | S3 | Cloudflare R2 (API compatível com S3) |
| Banco | Aiven PostgreSQL + pgvector | Aiven (mantido) |
| DNS | Hostinger | Cloudflare (registro do domínio segue na Hostinger) |
| TLS | ACM (CloudFront) | cert-manager + Let's Encrypt (DNS-01) |
| CI | Azure Pipelines, pipeline completo por repositório | Azure Pipelines com templates compartilhados |
| Deploy | imperativo (SSH + `compose up`) | declarativo (commit da tag → Argo CD) |
| Observabilidade | Loki na EC2 | Grafana Cloud (métricas, logs, alertas, checks externos) |
| Ambientes | prod e hml na mesma EC2 | namespaces `caia-prod` e `caia-hml` no mesmo nó |

A aplicação é **multi-tenant por subdomínio**: o front extrai o tenant de `<alias>.altasistemas.com.br`
(prod) ou `<alias>.hml.altasistemas.com.br` (hml). Isso tem consequência direta em DNS, TLS e roteamento
(Seções 4.6 e 4.9).

---

## 2. Arquitetura final

```text
Usuário
  │ DNS Cloudflare (tenants de prod com proxy; API/hml/Argo em DNS only)
  ▼
163.176.1.147 (IP público reservado, VM OCI Ampere arm64, 2 vCPU, 12 GB)
  │ Security List OCI: 80/443 públicos; 22 e 6443 restritos
  ▼
ServiceLB (klipper, do k3s) :80/:443
  ▼
Kong Ingress Controller (router traditional_compatible, externalTrafficPolicy=Local,
  confia no CF-Connecting-IP só para as faixas do Cloudflare)
  ├── caia-prod: caia-api  ← caia-api.altasistemas.com.br
  │              caia-front ← *.altasistemas.com.br
  ├── caia-hml:  caia-api  ← hml-caia-api.altasistemas.com.br
  │              caia-front ← *.hml.altasistemas.com.br
  └── argocd:    argocd-server ← argo.altasistemas.com.br (ip-restriction)

cert-manager ── DNS-01 (API do Cloudflare) ── Let's Encrypt
Grafana Alloy (namespace monitoring, ~125 MB) ── métricas/logs/eventos ──► Grafana Cloud

Azure Repos ──► Azure Pipelines (templates: testes → Trivy → buildx arm64 → push Docker Hub
                 → Trivy imagem → commit da tag em k8s/overlays/<env>)
           ──► Argo CD (auto-sync, prune, selfHeal) ──► k3s
```

Fluxo de deploy: `merge na develop` → pipeline → commit `deploy: <tag> [skip ci]` no overlay `hml`
→ Argo CD aplica. Prod é igual a partir da `main`.

---

## 3. Decisões: planejado × realizado

| Tema | Planejamento do TCC | Realizado no CaIA | Motivo da mudança |
|---|---|---|---|
| Git remoto | GitHub | **Azure Repos** | Os repositórios da aplicação já estavam lá |
| CI | GitHub Actions | **Azure Pipelines** | Idem; o Argo CD lê o Azure Repos via PAT (`repo-creds`) |
| Registry | GHCR | **Docker Hub** | Já existia a service connection; limite de 1 repo privado contornado com prefixo de tag |
| Ingress | NGINX em `hostNetwork` | **Kong** atrás do **ServiceLB (klipper)** | Escolha do responsável técnico; o klipper publica 80/443 no IP do nó sem MetalLB |
| MetalLB | não usar (L2 não funciona na VCN) | **removido** | Confirmado: a VCN não aceita GARP; conflitava com o ServiceLB (Seção 4.0) |
| TLS | cert-manager | cert-manager, **DNS-01 no Cloudflare** | Wildcard (`*.dominio`) só é emitido por DNS-01 |
| Segredos | Sealed Secrets | **Secret do Kubernetes criado à mão** (fora do Git) + cópia no Bitwarden | Menos componentes para um caso real pequeno; Sealed Secrets fica como evolução |
| Observabilidade | Prometheus + Loki + Tempo + Grafana no cluster | **Grafana Cloud** (free tier) + Alloy no cluster | Alertas continuam funcionando se a VM cair; ~125 MB na VM contra ~1,5–2 GB self-hosted |
| Pipeline | um por repositório | **templates compartilhados** (`extends`) em repo próprio | Mesmo modelo usado em ambiente corporativo; novos serviços reaproveitam |
| Tag da imagem | SHA do commit | `<prefixo>-<BuildId>` (`-hml` em hml) | Um único repo no Docker Hub para back e front |

---

## 4. Problemas encontrados, causa-raiz e solução

Esta é a parte mais útil como aprendizado: nenhum destes problemas aparece num tutorial, e
vários só surgiram porque o teste foi feito **antes** de ir para produção.

### 4.0 Infraestrutura de rede: load balancer em nó único na OCI

**Estado encontrado:** o cluster tinha o **MetalLB v0.16.1 instalado sem nenhum `IPAddressPool`** e,
ao mesmo tempo, o **ServiceLB (klipper) do k3s ativo** — dois controladores disputando os Services do
tipo `LoadBalancer`. O Traefik (Ingress padrão do k3s) havia sido desligado (`--disable traefik`).

**Por que o MetalLB em modo L2 não funciona na OCI:**

- O modo L2 anuncia o IP de um Service respondendo a consultas ARP e, na troca de nó, usa
  *gratuitous ARP* (GARP) para "tomar" o IP (METALLB, [s.d.]b).
- A VCN da OCI é uma rede definida por software: **não suporta takeover de IP por GARP**, nem
  broadcast/multicast (ORACLE, [s.d.]a). O ARP é emulado pela plataforma, que só resolve IPs
  atribuídos por ela mesma às VNICs.
- Resultado: um IP de um `IPAddressPool` da VCN nunca recebe tráfego, mesmo com o speaker do MetalLB
  respondendo ARP. A própria documentação do MetalLB avisa que o L2 não funciona na maioria das
  nuvens (METALLB, [s.d.]a). O laboratório da Oracle que usa MetalLB depende de um recurso
  específico (*Layer 2 Networking for VLANs*) que não está disponível de forma geral (ORACLE, [s.d.]b).
- O modo BGP também não se aplica: exigiria um roteador par para as VMs, que a VCN não oferece.

**Alternativas avaliadas:**

| Alternativa | Como funciona | Por que não / por que sim |
|---|---|---|
| MetalLB L2 | IPs extras anunciados por ARP | ❌ incompatível com a VCN (acima) |
| OCI Load Balancer via Cloud Controller Manager | o k8s cria um LB gerenciado da OCI | Possível (há um LB flexível no Always Free), mas exige instalar o CCM com credenciais da OCI e adiciona um salto de rede; desnecessário com um nó |
| NodePort | porta alta (30000–32767) no nó | ❌ usuários acessariam `:3xxxx`; sem 80/443 |
| Ingress em `hostNetwork` | o Ingress escuta direto nas portas do nó | Funciona; era o plano original |
| **ServiceLB (klipper) do k3s** | DaemonSet `svclb-*` com `hostPort` 80/443 que encaminha para o Service; `EXTERNAL-IP` = IP do nó | ✅ escolhido: já vem no k3s, Service `LoadBalancer` "de verdade" para o Kong, zero componente extra |

**Por que ServiceLB (klipper) + Kong, e não as outras formas:**

*1. Por que o klipper, e não o Ingress em `hostNetwork` (o plano original do TCC):*
- Com `hostNetwork`, o pod do Ingress passa a usar a **pilha de rede do nó**: ele enxerga todas as
  interfaces e portas da VM e perde o isolamento de rede do pod. Um problema no Ingress afeta o nó.
- Também deixa de existir um Service `LoadBalancer`: o Ingress não "tem" um IP externo para os
  outros componentes descobrirem (ex.: o `ADDRESS` dos Ingress fica vazio ou precisa ser forçado).
- O klipper mantém o pod do Ingress **isolado** (rede normal de pod) e publica só as portas 80/443 do
  nó através de um pod auxiliar mínimo (`svclb`). É o mecanismo nativo do k3s, sem instalar nada.
- Para trocar de Ingress no futuro (Kong → outro), basta outro Service `LoadBalancer`; com
  `hostNetwork` seria preciso liberar as portas do nó antes.

*2. Por que o klipper, e não o Load Balancer gerenciado da OCI (via Cloud Controller Manager):*
- Exigiria instalar o CCM da OCI com **credenciais da conta** dentro do cluster (mais um segredo
  sensível e mais uma superfície de ataque).
- Adiciona um salto de rede e um componente pago fora da cota gratuita se passar do LB flexível
  mínimo; e com **um nó só** não há para onde balancear.
- Faz sentido quando houver mais de um nó (alta disponibilidade) — fica como trabalho futuro.

*3. Por que o Kong, e não o NGINX Ingress ou o Traefik:*
- **NGINX Ingress (`ingress-nginx`):** o projeto da comunidade Kubernetes anunciou a **aposentadoria**
  (manutenção apenas até março de 2026, sem novas correções de segurança depois disso)
  (KUBERNETES, 2025). Adotar em setembro de 2026 seria começar com um componente sem suporte.
- **Traefik:** é o padrão do k3s, mas foi desligado na instalação do cluster (`--disable traefik`);
  religar exigiria alterar os argumentos do servidor k3s e reiniciá-lo.
- **Kong:** foi a orientação técnica recebida para o projeto e é o Ingress com o qual há experiência
  prévia em ambiente corporativo. Na prática, trouxe recursos usados nesta migração sem componentes
  extras: **plugins declarativos** por CRD (`KongPlugin` de `ip-restriction` protegendo o Argo CD),
  **redirecionamento HTTP→HTTPS** e **timeouts por Service** por anotação, e suporte à Gateway API
  para evolução futura. O custo foi aprender dois ajustes não óbvios: o `router_flavor`
  (Seção 4.3) e o `externalTrafficPolicy` (Seção 4.4).

*Resumo da decisão:* num nó único da OCI, o caminho de menor complexidade e maior isolamento é
**Service `LoadBalancer` atendido pelo klipper → Ingress Kong em rede de pod**. O MetalLB não
resolve o problema da VCN, o LB da OCI resolve um problema (vários nós) que ainda não existe, e o
`hostNetwork` troca isolamento por simplicidade que o klipper já oferece.

**Solução aplicada:** remover o MetalLB inteiro (namespace, 13 CRDs, 2 webhooks, RBAC — conferindo
antes que o manifesto era da mesma versão instalada e que nenhum Service o usava) e instalar o Kong
com `proxy.type=LoadBalancer`. O klipper criou `svclb-kong-gateway-proxy` e o Service recebeu o IP do
nó na hora (sem ficar `<pending>`).

**Limitações do klipper a registrar:**
- **Uma porta por nó:** dois Services `LoadBalancer` na mesma porta deixam o segundo `<pending>`
  (o pod `svclb` não sobe por conflito de `hostPort`). Numa instalação paralela, um Service de teste
  `whoami` esquecido na porta 80 causou exatamente isso.
- **SNAT por padrão:** com `externalTrafficPolicy=Cluster` o Ingress perde o IP do cliente (Seção 4.4).
- Não é balanceamento entre nós: com um nó só, isso não importa.

**Outros achados de infraestrutura da OCI/k3s:**

| Achado | Explicação | Consequência prática |
|---|---|---|
| O IP público **não aparece na VM** | A OCI faz NAT 1:1: a VNIC só tem o IP privado (`172.0.0.240`); o nó mostra `EXTERNAL-IP <none>` | O IP público precisa estar no `--tls-san` do k3s para o `kubectl` remoto validar o certificado |
| API do k3s (6443) aberta para `0.0.0.0/0` | Regra criada para o `kubectl` remoto | Restrita ao IP administrativo; fora de casa, usar túnel SSH (`ssh -L 6443:127.0.0.1:6443`) |
| Imagens Ubuntu da OCI com `REJECT` no `iptables` | Política padrão da Oracle; o backend é `iptables-nft` | Liberar 80/443 no host além da Security List; **não remover** as regras de `169.254.0.0/16` (serviços de metadados da instância) |
| `k3s.service` alterado sem `daemon-reload` | O systemd avisa que a unit em disco difere da carregada | Mudanças de flags do k3s exigem `daemon-reload` + restart (API fica segundos fora; pods seguem rodando) |
| IP reservado reaproveitado de outra VM | `known_hosts` com chave antiga para o mesmo IP | Conferir a *fingerprint* da chave antes de aceitar (evita aceitar um MITM por hábito) |

### 4.1 Portas 80/443 “fechadas” mesmo com Security List liberada

- **Sintoma:** timeout de fora da VM.
- **Diagnóstico:** timeout (pacote descartado) aponta para a Security List; “connection refused”
  imediato aponta para o host. Medir o tempo da falha separa as duas camadas.
- **Causa:** duas camadas de firewall — Security List da OCI **e** `iptables` da imagem Ubuntu da
  OCI (vem com `REJECT` para tudo além de SSH).
- **Solução:** liberar nas duas; persistir no `/etc/iptables/rules.v4` editando o arquivo (não
  `netfilter-persistent save`, que gravaria também as chains dinâmicas do k3s).
- **Detalhe adicional (colega):** regra da Security List com *Source Port Range = 80* bloqueia tudo,
  porque a porta de origem do cliente é efêmera. O correto é *All*.

### 4.2 IP público efêmero

- A OCI **não converte** IP efêmero em reservado; trocar gera outro número.
- Fazer **antes** de publicar DNS. Ao trocar: incluir o novo IP no `--tls-san` do k3s **antes** da
  troca (senão o `kubectl` quebra por TLS), depois atualizar o kubeconfig.
- O SAN antigo continua no certificado do k3s (ele acumula SANs no Secret `k3s-serving`); é
  inofensivo e sai na rotação.

### 4.3 Wildcard do Kong capturando dois níveis (bug de roteamento evitado)

- **Teste:** Ingress `*.altasistemas.com.br` (front prod) e `*.hml.altasistemas.com.br` (front hml)
  com backends `whoami`.
- **Resultado com o roteador padrão (`traditional`):** `empresa.hml.altasistemas.com.br` caía no
  **front de produção**. `konghq.com/regex-priority` não resolve (só vale para path regex).
- **Solução:** `router_flavor=traditional_compatible`. Todos os 7 casos de teste corretos.
- **Aprendizado:** testar a matriz de hosts com backends falsos antes de publicar — o erro não gera
  falha visível, só serve a aplicação errada.

### 4.4 Kong vendo `10.42.0.1` como cliente

- **Causa:** `externalTrafficPolicy=Cluster` faz SNAT no ServiceLB.
- **Efeito:** logs sem IP real e `ip-restriction` inútil (bloquearia ou liberaria todos).
- **Solução:** `externalTrafficPolicy=Local` (sem custo num nó único). Medido: `10.42.0.1` → IP real.
- Com o proxy do Cloudflare: `trusted_ips` = faixas do Cloudflare + `real_ip_header=CF-Connecting-IP`.
  Teste de **spoofing**: cabeçalho falso vindo de fora das faixas é ignorado.

### 4.5 Rede do pod indisponível nos primeiros ~3 segundos

- **Sintoma:** `psql` falhava com *Host is unreachable* de forma intermitente; `nc` funcionava.
- **Isolamento:** o firewall não contava pacotes rejeitados (nem `iptables` nem `nftables`); o
  problema seguia o **momento** da conexão, não o pod nem a imagem. Teste controlado no mesmo pod:
  `t=0s` falha, `t=3s` e `t=8s` funcionam.
- **Efeito na aplicação:** a API conecta ao banco no startup (migrations) — cairia no reinício.
- **Solução:** `initContainer` `wait-for-db` (`nc` em loop) antes do container principal.

### 4.6 DNS: registros perdidos na migração de nameservers

- A varredura por nomes conhecidos **não encontra registros que você não sabe que existem**.
  Dois subdomínios (`smtserver`, `admin`) ficaram fora e o `smtserver` saiu do ar até ser corrigido.
- Wildcard mascarou o erro: o nome ausente passou a resolver para o CloudFront (resposta válida, destino errado).
- **Aprendizado:** a fonte da verdade é a **lista do painel do provedor**; comparar registro a registro
  e testar cada serviço após a troca. Exportar a zona em formato BIND e importar evita digitação.
- O import do Cloudflare marca A/CNAME como **proxied** por padrão — DKIM e e-mail quebram com proxy.

### 4.7 Segredos e criptografia acoplados

- `JwtSettings:SecretKey` estava versionado. Ao planejar a troca, descobriu-se que o mesmo valor
  era a **chave de criptografia** dos parâmetros no banco (inclusive o token de IA de cada empresa).
- Trocar o JWT sem cuidado tornaria dados cifrados ilegíveis.
- **Solução:** separar: `ParametroCriptografia__SecretKey` = JWT antigo; `JwtSettings__SecretKey` = novo.
- **Aprendizado:** antes de rotacionar um segredo, procurar **todos** os usos dele no código.

### 4.8 Pipeline: identidade de build errada (HTTP 403)

- Commit da tag negado com `TF401027 GenericContribute`.
- Com *Limit job authorization scope* desligado, o pipeline roda como **Project Collection Build
  Service**, não como a identidade do projeto; e a permissão da **branch** sobrepõe a do repositório.
- Mensagem do script corrigida para distinguir “sem permissão” de “a branch andou”.

### 4.9 Scan de imagem bloqueando deploy (o gate funcionando)

- Front bloqueado pelo Trivy: `nginx:1.27-alpine` com 2 CVEs CRITICAL do OpenSSL corrigíveis.
- Solução: base `nginx:1.30-alpine`. Depois, `apk upgrade` / `apt-get upgrade` no estágio final para
  aplicar correções que ainda não entraram nas imagens oficiais (ex.: `libexpat` 2.8.5).
- Rodar comando no estágio arm64 exige **QEMU (binfmt)** no agente amd64; a compilação continua sem
  emulação (`--platform=$BUILDPLATFORM`).

### 4.10 Bug pré-existente revelado pela migração

- Login com 500: usuário convidado guarda `SenhaHash = "PENDENTE_ATIVACAO"`, e o `PasswordHasher`
  lançava `FormatException`. Corrigido tratando como senha inválida (segue o fluxo de ativação).

### 4.11 Branch apagada no merge

- PR `develop → main` com *Delete source branch*: o Argo CD ficou `Unknown`
  (`unable to resolve 'develop'`). O ambiente continuou no ar (último estado aplicado).
- Recriada a `develop` a partir da `main`, sem nenhum redeploy.

### 4.12 Proxy com timeout de 100 s e geração síncrona de IA

- O `POST /mensagem` esperava a IA responder. Atrás do Cloudflare Free (100 s), um 524 fecharia a
  conexão e o `cancellationToken` **cancelaria a geração** — a resposta seria perdida.
- **Decisão:** proxy só nos fronts (fase 1) e mudança arquitetural na API: resposta gerada em
  **segundo plano** (fila + worker, serial por chat, até 3 chats em paralelo), entregue pelo SignalR
  que o front já usava. O front não precisou de alteração.

### 4.13 Outros achados

| Achado | Aprendizado |
|---|---|
| Aiven Free desliga serviço ocioso (host em NXDOMAIN) | verificar o provedor antes de depurar a rede |
| `.env` antigo apontava para banco de teste | inventariar configuração **com teste real**, não por leitura |
| Aliases de tenant diferentes por ambiente (`tecnohard-prd`) | teste de fumaça deve usar dados do ambiente |
| Bug do npm 10 ao regerar lockfile (`edgesOut null`) | gerar com npm 11 e validar `npm ci` com a versão do build |
| AutoMapper ≥ 15 com licença comercial | atualização de segurança pode ter impacto **jurídico**, não só técnico |

---

## 5. Medições e evidências

| Medida | Valor | Fonte |
|---|---|---|
| Emissão de certificado wildcard (staging, DNS-01) | ~1 min 40 s | eventos do `Certificate` |
| Emissão do certificado de prod | ~1 min 15 s | idem |
| Criação das Applications hml → `Synced/Healthy` | ~1 min 30 s | `kubectl get applications` |
| Deploy prod → `Synced/Healthy` + certificado | ~1 min 25 s | idem |
| Atraso de rede de pod novo | ~3 s | teste controlado (Seção 4.5) |
| Uso do nó após prod + hml | ~2,2 GB RAM (18%), ~15% CPU | `kubectl top node` |
| Uso com monitoramento | ~2,8 GB RAM (23%), ~6% CPU | idem |
| Agente de coleta (Alloy e cia.) | ~125 MB RAM, ~6m CPU | `kubectl top pods -n monitoring` |
| Testes automatizados (API) | 179 → 188, todos passando | `dotnet test` em pod arm64 |
| Vulnerabilidades de dependências | front 22 → 0; back 4 → 0 | Trivy + `dotnet list package --vulnerable` |
| Vulnerabilidades corrigíveis nas imagens | nginx 2 CRITICAL + 1 HIGH → 0; aspnet 0 | Trivy |
| Checks externos (Synthetic Monitoring) | 4 URLs, 5 min, 2 regiões, ~69 mil exec./mês | Grafana Cloud |
| Cache do front no Cloudflare | `MISS` → `HIT` na 2ª requisição; `index.html` `DYNAMIC` | cabeçalho `cf-cache-status` |

### Passos manuais × automatizados (para a Seção 5.2)

| Etapa | Antes | Depois |
|---|---|---|
| Deploy de nova versão | pipeline + SSH + `compose pull/up` | merge na branch; nenhum passo manual |
| Rollback | SSH + editar `.env` + `compose up` | `git revert` do commit da tag |
| Novo ambiente/tenant | criar registros DNS + CloudFront | nada (wildcard + certificado wildcard) |
| Certificado | ACM manual | automático (renovação 30 dias antes) |
| Novo serviço na esteira | copiar pipeline inteiro | ~25 linhas com `extends` do template |

---

## 6. Figuras sugeridas para o TCC

| Figura | O que capturar |
|---|---|
| Arquitetura | Diagrama da Seção 2 |
| GitOps em ação | Commit `deploy: back-caia-api-172 [skip ci]` → Argo CD `Synced` → pod com a tag nova |
| Gate de segurança | Run do pipeline falhando no Trivy (nginx 1.27) e o seguinte passando (1.30) |
| Roteamento | Tabela dos 7 hosts × destino, antes e depois do `router_flavor` |
| Observabilidade | Grafana: cluster `k3s-oci`, Drilldown Logs (`caia-api`), Synthetics verdes |
| Alertas | E-mail de alerta recebido; lista de regras da pasta `k3s-oci` |
| Borda | `cf-cache-status: HIT`, Security Events do Cloudflare |
| Resiliência | `unable to resolve 'develop'` → branch recriada → `Synced` sem redeploy |

---

## 7. Lições para o texto (Discussão)

1. **Nó único não é alta disponibilidade** — mas GitOps torna a recriação reprodutível: o estado
   desejado inteiro está no Git, e o que não está (Secrets) está inventariado e guardado.
2. **Testar antes de expor** encontrou três problemas que chegariam à produção: wildcard do Kong,
   rede do pod no startup e o timeout do proxy com a IA síncrona.
3. **Os gates automáticos pagaram-se no primeiro run**: o Trivy barrou uma imagem vulnerável e os
   testes validaram atualizações de biblioteca com 4 versões maiores de diferença.
4. **Segurança é camadas**: Security List + iptables + restrição por IP no Kong + TLS de ponta a ponta
   + segredos fora do Git + scan de dependências e de imagem.
5. **Serviços gerenciados reduzem carga no nó único**: observabilidade externa custa ~125 MB e
   continua avisando quando a VM cai.
6. **Mudanças de infraestrutura revelam dívidas da aplicação** (login, segredo acoplado, geração síncrona).
7. **Custo zero é viável** nesta escala: OCI Always Free, Cloudflare Free, Grafana Cloud Free,
   Let's Encrypt, Docker Hub Free — com as limitações registradas abaixo.

## 8. Limitações

- Um nó: sem tolerância a falha da VM; `Recreate` na API (migrations) causa segundos de indisponibilidade no deploy.
- Dependência de free tiers (cotas do Grafana Cloud, 100 s de timeout no Cloudflare Free, Aiven Free desligando ociosos).
- IP da VM público por `hml`, `argo` e `caia-api` (DNS only): o proxy não esconde a origem.
- Secrets fora do GitOps (criados à mão); Sealed Secrets/External Secrets é evolução natural.
- Fila da IA em memória: reinício da API durante uma geração perde aquela resposta.

## 9. Evoluções possíveis (Trabalhos futuros)

- Sealed Secrets ou External Secrets para trazer os Secrets ao Git.
- Proxy do Cloudflare na API após medir a latência do `POST /mensagem`.
- Fila persistente (ex.: tabela ou broker) para respostas da IA.
- Segundo nó ou cluster gerenciado para alta disponibilidade.
- Rollback automático baseado nos alertas (ex.: Argo Rollouts).

---

## Referências

AQUA SECURITY. **Trivy documentation**. [S. l.], [s.d.]. Disponível em: https://trivy.dev/docs/. Acesso em: 30 set. 2026.

ARGO PROJECT. **Argo CD: declarative GitOps CD for Kubernetes**. [S. l.], [s.d.]. Disponível em: https://argo-cd.readthedocs.io/. Acesso em: 30 set. 2026.

CERT-MANAGER. **ACME DNS01 — Cloudflare**. [S. l.], [s.d.]. Disponível em: https://cert-manager.io/docs/configuration/acme/dns01/cloudflare/. Acesso em: 29 set. 2026.

CLOUDFLARE. **IP ranges**. [S. l.], [s.d.]. Disponível em: https://www.cloudflare.com/ips/. Acesso em: 30 set. 2026.

GRAFANA LABS. **Kubernetes Monitoring Helm chart**. [S. l.], [s.d.]. Disponível em: https://grafana.com/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/. Acesso em: 30 set. 2026.

K3S. **Networking services: Service Load Balancer (ServiceLB)**. [S. l.], [s.d.]. Disponível em: https://docs.k3s.io/networking/networking-services. Acesso em: 29 set. 2026.

KUBERNETES. **Ingress NGINX retirement: what you need to know**. Kubernetes Blog, nov. 2025. Disponível em: https://kubernetes.io/blog/. Acesso em: 30 set. 2026.

KONG. **Kong Ingress Controller documentation**. [S. l.], [s.d.]. Disponível em: https://developer.konghq.com/kubernetes-ingress-controller/. Acesso em: 29 set. 2026.

METALLB. **Cloud compatibility**. [S. l.], [s.d.]a. Disponível em: https://metallb.io/installation/clouds/. Acesso em: 25 set. 2026.

METALLB. **Layer 2 mode**. [S. l.], [s.d.]b. Disponível em: https://metallb.io/concepts/layer2/. Acesso em: 25 set. 2026.

ORACLE. **Virtual Cloud Network FAQ**. [S. l.], [s.d.]a. Disponível em: https://www.oracle.com/cloud/networking/virtual-cloud-network/faq/. Acesso em: 25 set. 2026.

ORACLE. **Use MetalLB with Oracle Cloud Native Environment**. [S. l.], [s.d.]b. Disponível em: https://docs.oracle.com/en/learn/ocne-metallb/. Acesso em: 25 set. 2026.

