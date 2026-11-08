# experimento/

Avaliação da plataforma (Capítulo 5 e Apêndice D do TCC). Tudo em UTC; dados brutos em `dados/`.

| Script | Mede |
|---|---|
| `medir.py implantar <app> <rep>` | commit vazio na `main` da app → esteira → commit no overlay → Argo CD → Healthy + HTTP 200 |
| `medir.py falha <inicializacao\|funcional> <rep>` | injeta o defeito (com testes desligados), mede t0–t3, reverte no overlay e depois na app |
| `vigiar.sh <application> <url>` | linha do tempo a cada 5 s: revisão, sync, health, imagem, HTTP |
| `linha-base/executar.sh api\|front` | implantação manual (sem a plataforma), passo a passo |
| `padronizacao.py <tcc-platform>` | razão overlay/renderizado, campos divergentes, checklist |
| `overhead.sh N INTERVALO` | CPU/memória por namespace (metrics-server) |
| `carga-front.k6.js` (e `catalogo-api/scripts/carga.k6.js`) | carga com k6 |
| `analisar.py` | consolida `dados/` em `resultados.json`, lido por `texto/build_tcc.js` |

Requisitos: `gh` autenticado, `kubectl` no contexto `k3s-jhone-prd`, clones dos 5 repositórios lado a lado.
