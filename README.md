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
cd texto
npm ci
node build_tcc.js        # -> "TCC - Esteira Kubernetes - COMPLETO.docx"
```

Edite o **`build_tcc.js`**, não o `.docx`. Ao abrir o documento, aceite "atualizar campos" para o Word
preencher o sumário e as listas de ilustrações e quadros.

A parte prática está nos repositórios `tcc-platform`, `tcc-pipeline-templates`, `catalogo-api` e
`catalogo-front`.
