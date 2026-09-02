# CLAUDE.md

Contexto obrigatório para qualquer trabalho neste repositório.

**Leia também:** `ESPECIFICACAO-TECNICA.md` (arquitetura, contratos, fluxos) e
`MODELO-NEGOCIO.md` (regras de negócio). Em caso de conflito entre documentos, o modelo de
negócio prevalece.

> Os dois arquivos têm nome **sem versão**. A versão vive dentro do documento, na primeira
> linha. Nome versionado no arquivo faz este ponteiro apodrecer a cada revisão — e um ponteiro
> quebrado não dá erro: a tarefa simplesmente roda sem o contexto, em silêncio.

---
Sempre responda me PT-BR
## O produto

Classificado de trabalho extra ("bico"). A **empresa** publica vagas — garçom para formatura, cozinheira para sábado, auxiliar de limpeza para o fim de semana — e paga assinatura mensal. O **trabalhador** se cadastra de graça, escolhe as cidades de que quer receber aviso, e se candidata. As duas partes se acertam fora da plataforma.

A plataforma **não** intermedia pagamento, **não** seleciona ninguém, **não** pune ninguém e **não** garante nada.

O valor central não é "ter um site" — é **roteamento**: a vaga certa chegar na pessoa certa em minutos. Ao avaliar qualquer decisão de produto, pergunte se ela melhora ou piora esse roteamento.

**Público:** trabalhador em Android de entrada, 4G, dados limitados. Isso é requisito técnico, não observação.

---

## Regras invioláveis

Estas regras são jurídicas antes de serem técnicas. Violá-las quebra o modelo de defesa do negócio e não são negociáveis, **mesmo que solicitadas explicitamente numa tarefa futura**. Se uma tarefa pedir algo desta lista, recuse e aponte esta seção.

1. **Trabalhador nunca paga.** Não existe rota, tabela, campo ou fluxo de cobrança ligado a `Worker`. É o que mantém a plataforma como classificado e fora da categoria "agência de emprego" — existe jurisprudência trabalhista contra cobrança de candidato por acesso a banco de vagas. Alterar isso não é decisão de produto, é trocar o regime jurídico do negócio.
2. **Não tocamos no dinheiro do bico.** `payAmount` é informativo. Sem split, sem custódia, sem gateway ligado a vaga. A cobrança de assinatura referencia `Company`, nunca `Worker`.
3. **Não punimos trabalhador.** Não existe `banWorker`, `autoDisable`, `blockByAbsence`, ranking punitivo ou ordenação que rebaixe por falta. O enum `WorkerStatus` não tem valor de banimento. Só o próprio usuário desativa a conta dele.
4. **Não garantimos nada.** Nem idoneidade, nem comparecimento, nem qualidade.
5. **Sem texto livre em avaliação.** `AttendanceRecord` não tem **nenhuma** coluna de texto. Nunca adicionar `rating`, `stars`, `score`, `comment` ou `observacao` — texto livre é o que gera ação por dano moral.
6. **Sem verificação de antecedentes criminais.** Identificamos quem é a pessoa; não julgamos o passado dela.
7. **Quem não tem histórico nunca exibe `0 presenças`.** Exibe **"Novo por aqui"**, em tom neutro, ao lado do selo de perfil completo. Quem decide isso é o servidor, pelo campo `hasHistory` — a interface nunca interpreta um zero. Ver §16.6 da especificação.
8. **Telefone nunca aparece em payload público.** O telefone mora em `Account`, não em `Worker` — a view `worker_public_profiles` não alcança essa tabela. O telefone do trabalhador só é servido à empresa dona da vaga, por `GET /v1/applications/:id/contact`, e o ato de pedir é o ato de escolher (`contactedAt`). Ver §16.5.
9. **Só a empresa inicia o contato.** O trabalhador nunca recebe o telefone da empresa e não tem botão de contato em lugar nenhum. E o número **nunca** é exibido como texto na interface — sempre atrás de um botão que abre o WhatsApp. Número escrito na tela é número colado no grupo. Ver §16.5.
10. **Não marcar significa `not_selected`, nunca falta.** Três saídas: não chamei / compareceu / não compareceu. Só `absent` conta como falta. `not_selected` é neutro, nunca aparece no perfil público e é aplicado automaticamente após 7 dias. Ver §16.7.
11. **Contestação não apaga a marcação.** `status` guarda o que a empresa marcou; a contestação vive em `disputedAt` / `disputeResolvedAt` / `disputeOutcome`. Ver §7.4.
12. **Sem chat interno.** As partes trocam contato e conversam pelo WhatsApp.
13. **Bloqueio de menores de 18 anos** no cadastro (ECA Digital, Lei 15.211/2025). Validado no zod **e** por trigger no banco.
14. **Não guardamos dado sem leitor.** Não existe endereço do trabalhador (só cidade e bairro), não existem referências pessoais. Campo declarado pela própria pessoa nunca vira garantia — só informação. Antes de coletar qualquer dado novo: quem lê, e o que ele prova?

### Vocabulário proibido na interface

O texto da UI é parte da defesa jurídica. Nunca escrever:

`verificado` · `aprovado` · `confiável` · `garantido` · `asseguramos` · `selecionado por nós` · `profissional de confiança`

Escrever no lugar: `identificado` · `perfil completo` · `histórico informado pelas empresas`

A regra: **identificar é fato, aprovar é promessa.** Fato não gera responsabilidade; promessa gera.

### Filtro de linguagem discriminatória

Toda vaga passa por validação que bloqueia exigência de sexo, idade ou aparência (art. 373-A da CLT): `moça`, `moço`, `rapaz`, `boa aparência`, `boa apresentação`, `até \d+ anos`, `sexo (masculino|feminino)`, `apenas (homens|mulheres)`, `solteir[oa]`, `sem filhos`, recortes raciais.

Validar no schema zod compartilhado — vale para o formulário **e** para a rota da API. O cliente é contornável. Registrar tentativas bloqueadas em log: é prova de diligência.

---

## Princípios de produto

Não são regras jurídicas, são o que decide discussão de design.

- **Abandono silencioso é o custo mais alto.** Push irrelevante e vaga sem candidato são o mesmo erro com dois nomes: fazem alguém concluir que a plataforma não serve. Quem conclui isso não reclama — some. Por isso **todo padrão nasce no ajuste mais aberto**: alcance da vaga em `unrestricted`, raio de vizinhança desligado, falha de verificação de telefone nunca trava o cadastro.
- **A permissão de notificar é o recurso mais escasso.** Desligar notificação no Android é definitivo na prática. Nada entra no push sem opt-in explícito, e o push carrega no texto o que a pessoa precisa para decidir sem abrir o app (distância, transporte).
- **Quem decide é quem tem a informação.** A plataforma exibe fato — distância, transporte, histórico — nunca recomendação, nota ou ordenação com juízo. Teste rápido para qualquer feature nova: ela informa ou ela decide?
- **Filtro de um lado nunca fura a escolha do outro.** O alcance definido pela empresa só estreita; o opt-in do trabalhador é o teto. E quem assinou aquela cidade na mão sempre recebe.
- **Mostrar o custo antes da escolha.** "Só Poços: 34 garçons. Até 50 km: 121." "50 km inclui 23 cidades."

---

## Arquitetura

Monorepo pnpm. Três contêineres em produção, VPS próprio.

```
extra/
  apps/
    web/         Next.js 16.3 App Router  → contêiner "web"  :3000
    api/         Node 22 + Fastify        → contêiner "api"  :3333
      prisma/    schema.prisma + migrations/
  packages/
    shared/      tipos + schemas zod + constantes
  infra/
    sql/         constraints.reference.sql — referência; o SQL real vive nas migrations
    seed/        cities.csv, load_cities.sh, build_city_neighbors.sql
    db-setup-local.sh · db-deploy-prod.sh
    docker-compose.yml, Dockerfiles, nginx, backup.sh
```

Postgres e MinIO também em contêiner, sem porta pública. Nginx à frente como proxy reverso e TLS.

**Regra estrutural mais importante do repositório:** tipos de domínio e schemas zod vivem **sempre** em `packages/shared`. `apps/web` e `apps/api` nunca declaram um tipo de domínio localmente. É o que impede o backend separado de virar dívida técnica.

---

## Stack

Next.js 16.3 (App Router) · TypeScript strict · Tailwind + shadcn/ui · react-hook-form + zod · TanStack Query · Fastify · Prisma · PostgreSQL 17 · MinIO (S3) · Web Push (VAPID) · WhatsApp Cloud API (verificação de telefone) · Resend (e-mail) · Asaas (assinatura da empresa) · Docker Compose · nginx

---

## Método: outside-in

Telas primeiro, banco por último — com os contratos definidos antes, para o backend não nascer torto.

| Fase | O quê                                                                         |
| ---- | ------------------------------------------------------------------------------ |
| 1    | Tipos e schemas zod em`packages/shared`. **Nenhuma tela antes disto.** |
| 2    | Camada mock em`apps/web/src/lib/api/` com as assinaturas definitivas         |
| 3    | Front completo navegável contra o mock — vendável sem uma linha de backend  |
| 4    | API Fastify cumprindo os mesmos contratos. O front não muda                   |
| 5    | Prisma e Postgres, schema derivado dos tipos já validados na prática         |

**Regra de ouro:** nenhum componente importa de `src/mocks/` diretamente. Tudo passa por `src/lib/api/`. Respeitada essa regra, a Fase 4 é troca de implementação, não reescrita.

O mock simula 300–800ms de latência e falha em ~5% das chamadas — os estados de carregamento e erro nascem junto com a tela, em vez de virarem dívida.

> O banco foi modelado antes da Fase 4 porque o motivo daquela ordem — não desenhar banco antes
> de saber o que as telas precisam — já está satisfeito pelo front rodando contra o mock.

---

## Convenções de código

- TypeScript `strict: true`. **Zero `any`.**
- Server Components por padrão. `"use client"` apenas onde há interação real.
- Funções de `lib/api/` retornam `ApiResult<T>` — erro é valor de retorno, não exceção.
- Schemas zod em `packages/shared/src/schemas/`, usados no formulário e na rota.
- Código, nomes de variáveis e comentários em **inglês**. Textos de interface em **português do Brasil**.
- Datas em ISO 8601 UTC no contrato. Formatação para `America/Sao_Paulo` só na exibição.
- Sem barrel files (`index.ts` reexportando tudo).
- Commits convencionais (`feat:`, `fix:`, `chore:`).
- Segredos só em `.env`. `.env.example` versionado, `.env` nunca.
- **Nunca commitar.** O commit é sempre do desenvolvedor, com script próprio. Faça a alteração e pare.

### Orçamento de performance (não é sugestão)

- Bundle JS nas rotas públicas: **< 150 KB** comprimido
- LCP em 4G simulado: **< 2,5s**
- Imagens sempre via `next/image`, AVIF/WebP
- Testar em viewport de **360px**, não em desktop
- Vídeo e selfie comprimidos **no cliente** antes do upload

---

## Banco de dados

Dois bancos distintos. **A confusão entre eles apaga dados reais.**

| Ambiente   | Onde                                   | Comando permitido                                                     |
| ---------- | -------------------------------------- | --------------------------------------------------------------------- |
| Local      | contêiner Postgres no WSL, porta 5433 | `./infra/db-setup-local.sh`                                         |
| Produção | contêiner no VPS                      | `./infra/db-deploy-prod.sh` — na mão, e ele faz `pg_dump` antes |

São dois scripts com nomes diferentes de propósito: um script único com flag é um erro de digitação de distância de rodar `migrate dev` contra dado real. Cada um checa a `DATABASE_URL` e se recusa a rodar no ambiente errado.

- **`prisma migrate dev` nunca toca em produção.** Ele reseta o banco quando detecta divergência de schema.
- `prisma migrate deploy` não reseta: só aplica o que falta.
- Migração **não** entra em deploy automático, e não roda quando a API sobe.
- Sem seed de aplicação em produção. `cities` é exceção: é dado de referência.

### Constraints vivem dentro das migrations

`CHECK`, coluna gerada, índice parcial, trigger e view **não existem no `schema.prisma`**.
Elas entram no SQL da própria migration: gere com `prisma migrate dev --create-only`,
acrescente o SQL no arquivo, aplique.

**Vale para o que o Prisma não modela.** `CHECK`, trigger, view e índice parcial ele ignora, e
por isso sobrevivem dentro da migration. Chave estrangeira ele **modela**: reconcilia o banco
com o `schema.prisma` e apaga a que não encontrar declarada — criando uma migration sozinho só
para o `DROP`. FK que o Prisma não consegue declarar não se contrabandeia por SQL: ou ela cabe
no modelo, ou o dado que ela protegia não devia existir.

**Não aplique SQL por fora das migrations.** Foi a primeira tentativa deste projeto e estava
errada: objeto existindo no banco sem estar no histórico vira *drift permanente*, e todo
`migrate dev` passa a exigir reset do banco.

`infra/sql/constraints.reference.sql` é só leitura: o catálogo do que existe e por quê.
Ninguém o executa.

A rede de segurança é um teste que roda contra o banco e falha se alguma constraint sumiu.
Constraint que some é falha silenciosa — o banco continua aceitando escrita, só parou de
proteger.

E a regra 1 não tem constraint possível, porque é uma **ausência**: a defesa mecânica é um
teste no CI que lê o `schema.prisma` e falha se algo com relação a `Worker` ganhar campo
monetário.

### Índices que existem desde o início

`job_posts (city_id, status, role, starts_at)` · `job_posts (slug)` por cidade · `job_posts (status, expires_at)` · `applications (job_post_id, worker_id)` único · `accounts (phone)` único · `workers (cpf)` único · `attendance_records (status)` parcial em pending · `worker_roles (role, worker_id)` · `worker_availability (weekday, period, worker_id)` · `worker_notification_cities (city_id, worker_id)`

---

## Deploy

Desenvolve no WSL → commit → push → no VPS:

```bash
cd /opt/extra && git pull
docker compose -f infra/docker-compose.yml up -d --build
```

Migração de banco é passo separado e manual: `./infra/db-deploy-prod.sh`.

O build do Next.js é pesado: manter 2 GB de swap no VPS.

---

## Dados sensíveis

- Telefone mora em `Account`. `Worker` não tem campo de telefone — não se vaza coluna que não existe na tabela.
- `cpf` e `birthDate` **nunca** aparecem em resposta pública. Toda rota que a empresa consome lê a view `worker_public_profiles`, nunca a tabela `workers` direto.
- Não existe endereço do trabalhador. Só cidade e bairro. Endereço completo existe apenas na vaga.
- Selfie com documento vai para bucket **privado** no MinIO, acessível só por URL assinada de curta duração. Nunca é conteúdo público.
- Vídeo de apresentação é público (é o cartão de visitas do trabalhador) e **opcional** — é ele que dá o selo de perfil completo.
- Termo de uso é dado de primeira classe: versão aceita, data e IP.
- Exclusão de conta é transação com efeito no MinIO, nunca `deleted = true`. Apaga histórico de presença; anonimiza candidaturas; mantém denúncias e ações de moderação. **Não guardar hash de CPF achando que anonimizou** — o espaço de CPF se reverte por força bruta.
- Upload sempre direto do navegador via URL pré-assinada — o arquivo nunca passa pelo contêiner da API.

---

## Fora do escopo

Não implementar, mesmo que pareça fácil ou útil:

chat interno · estrelas, notas ou comentários · processamento do pagamento do bico · verificação de antecedentes criminais · app nativo · painel de analytics elaborado · internacionalização · raio por GPS ou endereço exato (a distância é entre centros de município) · **qualquer cobrança ligada ao trabalhador**

---

## Antes de considerar uma tarefa concluída

- [ ] `pnpm -r test` na RAIZ passou — nunca só o pacote que você tocou
- [ ] Nenhum tipo de domínio declarado fora de `packages/shared`
- [ ] Nenhum import direto de `src/mocks/` em componente
- [ ] Nenhum telefone em payload ou página pública
- [ ] Trabalhador sem histórico exibindo "Novo por aqui", não "0 presenças"
- [ ] Toda copy nova conferida contra o vocabulário proibido
- [ ] Validação existe no schema compartilhado, não só no formulário
- [ ] Cidade veio da tabela `cities`, nunca de texto digitado
- [ ] Mexeu no schema? A constraint nova entrou no SQL da migration
- [ ] Estados de carregamento, vazio e erro implementados
- [ ] Testado em viewport de 360px
- [ ] Sem `any`, sem `console.log` esquecido, sem segredo no código


## Segurança

A arquitetura já elimina a falha mais comum de apps gerados por IA: não existe credencial de
banco no cliente, o Postgres não tem porta pública, e só a API alcança o banco. **Por isso todo
o risco está na autorização dentro da API.**

**Regra que resume tudo:** toda rota autenticada responde a uma pergunta antes de responder ao
cliente — *o que prova que este token pode ver este registro?* Se a resposta for "o id veio na
URL", falta autorização.

- **Posse entra no `where`, nunca num `if` depois da consulta.** `GET /v1/applications/:id/contact`
  é a única rota que revela um telefone: ela prova, na mesma query, que a candidatura pertence a
  uma vaga da empresa do token. Tem teste próprio: empresa A pedindo candidatura da empresa B
  responde 403.
- **Webhook verifica assinatura antes de olhar o corpo** (`X-Hub-Signature-256` no WhatsApp,
  equivalente no Asaas) e é idempotente. Webhook forjado do WhatsApp é tomada de conta.
- **URL assinada é credencial.** Vida curta, nunca em log, nunca em payload público. Bucket
  `docs` privado, verificado por teste.
- **Upload pré-assinado limita content-type e tamanho na política, no servidor.**
- **JWT carrega versão de sessão**, conferida no banco — sem isso não há como matar token vazado.
- **OTP:** hash, expira em 10 min, uso único, 3 tentativas por telefone por hora e rate limit
  por IP na geração.
- **Log vaza igual banco:** redigir `authorization`, `cpf`, `phone`, `code` e URLs assinadas.
  Erro completo no log, genérico na resposta.

## Ritmo de trabalho

Quem verifica o resultado visual é o desenvolvedor, olhando o navegador.
O servidor de desenvolvimento já está rodando o tempo todo.

NÃO faça, a menos que eu peça explicitamente:

- subir servidor de desenvolvimento ou abrir portas
- rodar build para conferir
- abrir navegador, tirar screenshot ou testar interface
- medir espaçamento, contraste ou responsividade
- escrever testes
- reler os arquivos que você acabou de escrever para conferir

Faça a alteração, diga em duas linhas o que mudou e em quais arquivos, e pare.
Se algo ficou incerto ou você teve que decidir algo por conta, diga qual foi
a decisão — mas não vá verificar.

Responda em no máximo 3 linhas: o que mudou e em quais arquivos.
Sem relatório, sem explicar raciocínio, sem justificar decisão técnica.
Se algo ficou ambíguo, pergunte em uma linha.

## Como pedir tarefas neste repositório

Uma tarefa por vez, referenciando a seção da especificação. Exemplo:

> implemente a etapa 4 do cadastro do trabalhador conforme §16.1 da especificação, usando os tipos de §7 e a camada de acesso de §8.1

**Prompt fechado rende mais que prompt aberto.** Dizer quais arquivos tocar evita que a tarefa se espalhe. Em qualquer tarefa que mexa com dados, incluir explicitamente: *"não crie camada de dados nova, use `src/lib/api/`"*.

**Escolha do modelo:** Sonnet para tela, Opus para dados, contrato e arquitetura. O Sonnet resolve o pedido literal pelo caminho mais curto — foi assim que nasceu uma camada de dados paralela em `localStorage`, que quebrou a regra de ouro e teve de ser desfeita.

**Este arquivo só é lido no início da sessão.** Mexeu nele, rode `/clear` antes da próxima tarefa, senão a sessão continua com a versão velha.

**Sobre o bloco "Ritmo de trabalho":** ele existe porque a verificação custava dez minutos por tarefa. A única exceção que vale o tempo é mudança em fronteira cliente/servidor — aí um `pnpm build` se paga.
