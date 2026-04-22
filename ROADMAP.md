# Total Control App Roadmap

## Objetivo

Este roadmap organiza o estado atual do produto, o que ja foi entregue, o que precisa ser consolidado e quais melhorias fazem mais sentido para a proxima fase do Total Control App.

O produto ja possui um MVP funcional, com frontend, backend, autenticacao, persistencia, configuracoes e operacoes financeiras centrais. A partir daqui, a evolucao precisa priorizar estabilidade, experiencia de uso e preparo para operacao real.

## O que ja foi feito

### Base tecnica

- Frontend com `React + Vite + TypeScript`
- Backend com `Fastify + TypeScript`
- Persistencia em `PostgreSQL`
- Ambiente local com suporte a banco via Docker
- Seed demo para ambiente de desenvolvimento

### Estrutura de dados

- Usuarios
- Sessoes
- Convites
- Transacoes
- Categorias customizadas
- Configuracoes de marca
- Configuracoes globais do app

### Autenticacao e acesso

- Login com sessao baseada em cookie
- Logout
- Endpoint de usuario autenticado (`/auth/me`)
- Hash de senha com `argon2`
- Primeiro usuario registrado vira `admin`
- Registros seguintes via convite
- Controle de acesso por papel (`admin` e `user`)
- Rate limit em fluxos sensiveis

### Operacoes financeiras

- Criacao de transacoes
- Edicao de transacoes
- Exclusao de transacoes
- Marcacao de transacao como paga ou em aberto
- Suporte a transacao unica
- Suporte a transacao parcelada
- Suporte a transacao recorrente
- Filtros por tipo, categoria, status e periodo
- Presets como mes atual, mes anterior, proximos 30 dias e atrasadas

### Organizacao e configuracao

- Categorias customizadas por usuario
- Protecao contra exclusao de categoria em uso
- Configuracoes de branding
- Configuracoes globais de app
- Sistema de convites para novos usuarios

### Importacao e exportacao

- Exportacao em JSON
- Importacao em JSON
- Reconciliacao de categorias durante importacao

### Frontend e experiencia atual

- Tela de autenticacao
- Dashboard com resumo financeiro
- Lista de transacoes
- Formulario de transacoes
- Contas futuras
- Grafico de despesas
- Notificacoes
- Modais administrativos
- Internacionalizacao inicial

### Qualidade e seguranca

- Testes automatizados no backend
- Testes utilitarios no frontend
- Health check da aplicacao
- Cookies `httpOnly`
- Configuracao de CORS
- Uso de `helmet`

## Estado atual do produto

O Total Control App esta hoje em um estagio de MVP funcional. O fluxo principal de uso ja existe:

- autenticacao
- gestao de transacoes
- categorias
- visualizacao de resumo financeiro
- importacao e exportacao
- administracao basica do produto

Isso significa que a proxima etapa nao deve ser abrir muitas frentes ao mesmo tempo. O maior retorno agora vem de consolidar o que ja existe, reduzir risco tecnico e melhorar a usabilidade dos fluxos principais.

## Roadmap recomendado

## Fase 1 - Consolidacao do MVP

Objetivo: estabilizar o produto e reduzir regressao antes de ampliar escopo.

- Adicionar testes de integracao cobrindo login, transacoes, categorias, importacao e convites
- Criar testes E2E para os fluxos principais do navegador
- Melhorar mensagens de erro e validacao no frontend
- Padronizar estados de loading, erro e tela vazia
- Revisar seguranca para ambiente de producao
- Melhorar padrao de setup local para reduzir dependencia manual de infraestrutura
- Melhorar logs operacionais e diagnostico de falhas

## Fase 2 - Usabilidade e operacao

Objetivo: melhorar experiencia real de uso e eficiencia do trabalho diario.

- Criar tela no frontend para editar `app settings`
- Melhorar UX dos filtros e da busca de transacoes
- Adicionar paginação ou virtualizacao para listas maiores
- Permitir acoes em lote em transacoes
- Melhorar manipulacao de recorrencia e parcelamento
- Permitir editar uma serie inteira de lancamentos
- Tornar importacao mais segura com preview e confirmacao
- Adicionar exportacao CSV do lado do backend

## Fase 3 - Inteligencia de produto

Objetivo: transformar o app em uma ferramenta de decisao, nao apenas de registro.

- Metas financeiras por periodo
- Orcamentos mensais por categoria
- Alertas de estouro de orçamento
- Comparativos entre meses
- Analise de tendencia de gastos
- Projecao de saldo futuro com base em recorrencias
- Indicadores mais executivos no dashboard

## Fase 4 - Estrutura comercial e multiusuario

Objetivo: preparar o produto para venda, operacao por cliente e administracao mais madura.

- Evoluir modelo atual para suportar tenant ou workspace
- Branding por cliente
- Permissoes mais granulares
- Listagem e revogacao de convites
- Auditoria de acoes administrativas
- Estrutura para licenciamento ou billing futuro

## Fase 5 - Producao e escala

Objetivo: deixar o produto preparado para operacao estavel em producao.

- Pipeline CI/CD
- Ambientes separados de dev, staging e prod
- Estrategia segura de migracao de banco
- Backup e restore do PostgreSQL
- Monitoramento com alertas
- Hardening de performance em consultas e indices
- Reforco de observabilidade

## Priorizacao sugerida

Se a evolucao for incremental e pragmatica, a ordem recomendada e:

1. Testes E2E e testes de integracao dos fluxos criticos
2. Tela de configuracoes reais para `app settings`
3. Melhorias de UX em filtros, recorrencia e series
4. Gestao mais completa de convites e acoes administrativas
5. Metas, orcamentos e insights financeiros

## Proposta de marco por versao

### v0.1

MVP funcional com:

- autenticacao
- transacoes
- categorias
- branding
- convites
- importacao e exportacao

### v0.2

Consolidacao tecnica com:

- testes mais completos
- mais estabilidade
- melhores mensagens de erro
- tela de configuracoes do app

### v0.3

Melhorias de usabilidade com:

- filtros mais fortes
- recorrencia mais robusta
- acoes em lote
- relatorios melhores

### v0.4

Avanco de produto com:

- metas
- orcamentos
- insights financeiros
- dashboard mais analitico

### v1.0

Pronto para operacao comercial com:

- multiusuario mais maduro
- observabilidade
- deploy estavel
- seguranca e operacao mais solidas

## Observacoes finais

O produto ja tem base suficiente para evoluir com disciplina. O principal risco agora nao e falta de funcionalidade, e sim crescer sem consolidar os fluxos principais. Por isso, o foco imediato deve estar em qualidade, previsibilidade operacional e refinamento da experiencia central.
