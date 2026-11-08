# tcc-documentacao

Texto, apresentação e planejamento do TCC **Implementação de uma plataforma de deploy automatizado e
observabilidade para microsserviços baseada em Kubernetes e GitOps** (Engenharia de Computação — PUC Goiás).

```text
texto/          build_tcc.js gera o .docx em ABNT (Manual de TCC da Escola Politécnica)
apresentacao/   slides da defesa
planejamento/   PLANEJAMENTO_DEVOPS.md (fases da parte prática) e APRENDIZADOS_MIGRACAO_CAIA.md
referencias/    modelos e materiais de apoio
```

## Gerar o documento

```bash
cd texto && npm ci
node figuras/gerar_diagramas.js                 # Figuras 1, 3 e 4
node figuras/gerar_linha_tempo.js               # Figura 6 (dados de experimento/dados/falha*)
python3 -I figuras/capturar_grafana.py <ini> <fim>  # Figuras 5 e 7 (token do Grafana em ~/.config)
(cd ../experimento && python3 -I observabilidade.py && python3 -I analisar.py)   # resultados.json
node build_tcc.js                               # -> "TCC - Esteira Kubernetes - COMPLETO.docx"
```

- O texto fica em `texto/build_tcc.js` (pré-textuais e Capítulo 1) e `texto/capitulos/` (2 a 6,
  referências e apêndices). Edite os `.js`, nunca o `.docx`.
- O Capítulo 5, a Conclusão e o Resumo/Abstract leem `experimento/resultados.json`: nenhum número é
  digitado à mão, e o build falha se faltar dado. Os Apêndices A e B leem os YAML dos outros repositórios.
- `TCC_RASCUNHO=1 node build_tcc.js` gera `rascunho.docx` tolerando figuras ausentes.
- Ao abrir o documento no Word, responda **Sim** ao aviso de atualizar campos (preenche sumário e
  listas de ilustrações, quadros e tabelas).

A parte prática está nos repositórios `tcc-platform`, `tcc-pipeline-templates`, `catalogo-api` e
`catalogo-front`; a avaliação, em `experimento/` (ver `experimento/README.md`).
