# Especificação Técnica v2.5 — Extraqui

*Contexto para desenvolvimento com Claude Code. 22/08/2026. Substitui a v2.4 — apague as anteriores.*
*Complementa o `CONTEXTO.md`. Em conflito, o modelo de negócio prevalece.*

**Mudanças em relação à v2.4:**

1. **Alcance da vaga** — a empresa pode estreitar o alcance do anúncio: só a cidade, ou até um raio (§7.5, §16.2)
2. **O alcance da empresa só estreita, nunca amplia** — o filtro do trabalhador é o teto (§16.2)
3. **Inscrição explícita vence o raio da empresa** — quem escolheu aquela cidade na mão sempre recebe (§16.2)
4. **Custo do alcance visível na publicação** e **distância na lista de candidatos** (§16.2, §16.5)

**Mudanças anteriores, mantidas:**

5. **Raio de vizinhança do trabalhador** — 25 ou 50 km em torno da cidade onde mora (§7.3)
6. **`city_neighbors`** — distâncias entre municípios, calculadas uma vez (§7.1)
7. **`City` é entidade** com IBGE, UF, slug e coordenadas (§7.1)
8. **Notificação por cidades assinadas** — 1 a 5 (§7.3, §16.2)
9. **Candidatura é livre de cidade** — a lista filtra, a candidatura não checa nada (§16.2)
10. **`providesTransport`** na vaga (§7.5)
11. **URL por cidade** — `/vagas/[cidade]`, indexada separadamente (§15)
12. **Asaas** como gateway, com webhook soberano sobre o status da assinatura (§20)

---

## 1. O que estamos construindo

Classificado de trabalho extra. A **empresa** publica vagas de bico e paga assinatura mensal. O **trabalhador** se cadastra de graça, escolhe as cidades de que quer receber aviso, e se candidata. As duas partes se acertam fora da plataforma.

**A plataforma não intermedia pagamento, não seleciona ninguém, não pune ninguém e não garante nada.**

O valor central não é "ter um site" — é **roteamento**: a vaga certa chegar na pessoa certa em minutos, coisa que um grupo de WhatsApp com 3.000 pessoas não faz.

## 2. Princípios inegociáveis

| Regra | Como aparece no código |
|---|---|
| Trabalhador nunca paga | Não existe rota, tabela ou fluxo de cobrança ligado a `Worker` |
| Não tocamos no dinheiro do bico | `payAmount` é informativo. Nenhuma integração de split ou custódia |
| Não punimos trabalhador | Não existe `banWorker`, `autoDisable`, `blockByAbsence`. Só o próprio usuário desativa a conta |
| Não garantimos nada | Copy proibida em toda a UI (§2.1) |

> **Sobre a primeira linha.** O que mantém a plataforma na categoria "classificado" e fora da categoria "agência de emprego" é o trabalhador não pagar. Existe jurisprudência trabalhista contra cobrança de candidato por acesso a banco de vagas. Alterar esta regra não é decisão de produto: é trocar o regime jurídico do negócio, e exige advogado antes de exigir migration.

### 2.1 Vocabulário obrigatório

| Nunca escrever | Escrever |
|---|---|
| verificado, aprovado, confiável | identificado |
| profissional de confiança | perfil completo |
| garantimos, asseguramos | histórico informado pelas empresas |

---

## 3. Arquitetura

```
                    Internet
                       │
                 ┌─────▼─────┐
                 │   nginx    │  reverse proxy + TLS (certbot)
                 └──┬──────┬──┘
          app.dominio│      │api.dominio
             ┌───────▼─┐  ┌─▼────────┐
             │   web    │  │   api    │
             │ Next.js  │  │ Node/TS  │
             │  :3000   │  │  :3333   │
             └──────────┘  └────┬─────┘
                                │
                    ┌───────────┼───────────┐
              ┌─────▼─────┐         ┌───────▼──────┐
              │ postgres  │         │    minio     │
              └───────────┘         └──────────────┘
```

Rede Docker interna. **Só o nginx expõe porta pública.**

---

## 4. Stack e custo

nginx + certbot · Next.js 16.3 (`standalone`) · Tailwind + shadcn/ui · react-hook-form + zod · TanStack Query · Node 22 + Fastify · Prisma · PostgreSQL 17 · MinIO · Web Push (VAPID) · WhatsApp Cloud API · Resend · Docker Compose no VPS Hostinger. **Tudo R$ 0** exceto o gateway (§20), que cobra sobre receita.

### 4.1 Restrições do público

Android de entrada, 4G, dados limitados. Requisito, não detalhe:

- Bundle JS nas rotas públicas: **< 150 KB** comprimido
- `next/image` sempre, AVIF/WebP · vídeo comprimido **no cliente**
- Server Components por padrão · LCP em 4G: **< 2,5s** · testar em 360px

---

## 5. Monorepo

```
extra/
  apps/web/ · apps/api/
  packages/shared/src/{types,schemas,constants}
  infra/{docker-compose.yml,nginx.conf,backup.sh,sql/constraints.reference.sql,seed/cities.csv}
  CONTEXTO.md · ESPECIFICACAO-TECNICA-v2_3.md · CLAUDE.md
```

**`apps/web` e `apps/api` nunca declaram um tipo de domínio localmente.**

---

## 6. Abordagem: outside-in

**Fase 1** contratos em `packages/shared` · **Fase 2** mock com as assinaturas definitivas · **Fase 3** front completo, vendável sem backend · **Fase 4** API real, front não muda · **Fase 5** Prisma e Postgres.

> **Dívida da Fase 3:** em modo mock tudo renderiza sob demanda (`ƒ`). Ao ligar o modo live, **`/vagas/[cidade]` e `/vagas/[cidade]/[slug]` precisam voltar a ser estáticas ou ISR** — são as páginas que o Google indexa, e indexação é a única aquisição gratuita do projeto.

**Nenhum componente importa de `src/mocks/` diretamente.**

---

## 7. Contratos de dados

### 7.1 Cidade — entidade, nunca texto livre

```ts
// city.ts
export interface City {
  id: string        // código IBGE, 7 dígitos. Chave natural, estável, canônica
  name: string      // "Poços de Caldas"
  uf: string        // "MG"
  slug: string      // "pocos-de-caldas-mg" — ÚNICO. É a URL indexada
  lat: number
  lng: number
}
```

**Por que entidade e não string:** cidade como texto livre vira "Poços de Caldas", "Pocos de
Caldas", "POÇOS" e "poços" no mesmo banco. Para o Postgres são quatro cidades diferentes, e o
roteamento passa a errar **em silêncio** — nada quebra, a vaga simplesmente não chega em
ninguém, e você descobre meses depois pela reclamação de uma empresa.

O slug carrega a UF porque nome de município se repete entre estados.

Seed: `infra/seed/cities.csv`, lista do IBGE, ~5.570 linhas, carregada uma vez. **Não é seed de
aplicação** — é dado de referência, entra em produção também.

```ts
export interface CityNeighbor {
  cityId: string
  neighborCityId: string
  distanceKm: number    // entre os centros dos municípios, arredondado
}
```

**Vizinhança é tabela calculada, não conta feita na hora.** Gerada uma vez a partir de
`lat`/`lng`, guardando só os pares até 100 km. Dá algumas centenas de milhares de linhas —
nada para o Postgres — e transforma "vagas num raio de 50 km" num `JOIN` comum com índice, em
vez de uma conta geométrica no caminho mais quente do produto.

A alternativa seria a extensão `earthdistance` ou PostGIS. Não vale: adiciona dependência no
contêiner e coloca cálculo na query que precisa responder em segundos. Município não se move —
o que não muda deve ser pré-calculado.

**A distância é entre centros de município**, não porta a porta. É aproximação, e a interface
deve tratá-la como tal ("cerca de 24 km"), nunca como número exato.

### 7.2 Conta — a credencial, separada do perfil

```ts
// account.ts
export interface Account {
  id: string
  phone: string                   // E.164 — ÚNICO. É o login
  phoneVerifiedAt: string | null  // null é permitido: nunca travar o cadastro (§11.4)
  createdAt: string
}
```

O telefone é credencial, não atributo de perfil. Estando aqui, `Worker` não tem campo de
telefone — e a regra "contato nunca em payload público" deixa de depender de alguém lembrar de
escrever o `select` certo. Não se vaza um campo que não existe no tipo.

Uma conta aponta para no máximo um `Worker` e no máximo uma `Company`. **Ter os dois é
permitido** — proibir agora custa migração depois (§21).

### 7.3 Trabalhador

```ts
// worker.ts
export type WorkerStatus = 'incomplete' | 'complete' | 'self_deactivated'

export interface Worker {
  id: string
  accountId: string
  firstName: string
  lastName: string                 // o perfil público mostra só a inicial
  cpf: string                      // ÚNICO. NUNCA em resposta pública
  birthDate: string                // bloquear < 18 anos (ECA Digital)
  cityId: string                   // onde mora
  neighborhood: string             // só faz sentido dentro da cidade acima
  notificationCityIds: string[]    // 1 a 5. De onde ele QUER receber aviso
  nearbyRadiusKm: 25 | 50 | null   // null = desligado. Raio em torno de cityId
  roles: JobRole[]                 // máximo 5
  experience: string
  availability: Availability[]
  documentSelfieKey: string | null // MinIO, bucket PRIVADO
  introVideoKey: string | null     // MinIO, bucket público. OPCIONAL
  status: WorkerStatus
  termsVersion: string
  termsAcceptedAt: string
  termsAcceptedIp: string
  profileCompletedAt: string | null
  attendance: AttendanceSummary
  createdAt: string
}

export interface Availability {
  weekday: 0|1|2|3|4|5|6
  period: 'morning' | 'afternoon' | 'night'
}

// O que a empresa enxerga. Sem CPF, sem nascimento, sem telefone.
export interface WorkerPublicProfile {
  id: string
  firstName: string
  lastNameInitial: string
  cityName: string          // "Poços de Caldas" — junto com o bairro, senão o bairro não diz nada
  neighborhood: string
  roles: JobRole[]
  experience: string
  introVideoUrl: string | null
  hasCompleteProfile: boolean
  attendance: AttendanceSummary
  memberSince: string
}

// O que a empresa DAQUELA vaga enxerga do candidato dela. O público mais
// disponibilidade — e o nome completo só depois de ela chamar.
export interface WorkerApplicantProfile extends WorkerPublicProfile {
  fullName: string | null   // null até contactedAt. Mesmo portão do telefone
  availability: Availability[]
}
```

**O nome completo passa pelo MESMO portão do telefone (§16.5).** `fullName` é `null` enquanto a
empresa não pediu o contato; até lá a lista mostra primeiro nome e inicial, que já vêm no perfil
público. Duas razões, e a segunda é a que decide:

1. **Para ESCOLHER, a empresa não precisa do sobrenome.** Ela decide por função, distância,
   disponibilidade e histórico — o sobrenome só passa a importar quando já existe uma conversa.
2. **Uma assinatura mensal não pode virar colheita de nomes completos.** Sem o portão, qualquer
   empresa paga um mês, abre as vagas e exporta nome completo de toda a base da cidade sem
   chamar ninguém. Com ele, cada nome revelado custa um `contactedAt` — que é registro de que a
   escolha aconteceu, e é auditável.

Nome completo mais cidade e bairro identifica uma pessoa; primeiro nome mais inicial, não.

**`cityId` e `notificationCityIds` são coisas diferentes.** O primeiro é onde a pessoa mora —
serve para a empresa entender o bairro, para pré-marcar a assinatura de aviso e como centro do
raio. O segundo é de onde ela quer ser avisada.

**`nearbyRadiusKm` é opcional e ancorado só em `cityId`**, nunca em cada uma das 5 cidades
assinadas. Cinco cidades cada uma com 50 km de raio viraria meio estado, e o teto de 5 existe
justamente para proteger a permissão de notificar. Uma âncora, um raio.

Valores fechados em **25 ou 50 km**, não campo livre. E a tela deve mostrar o efeito antes de
ligar — *"50 km inclui 23 cidades"* — porque a pessoa tem direito de ver o que está aceitando.
O número sai da própria tabela de vizinhança, então custa uma consulta.

**Não existe endereço do trabalhador.** Só cidade e bairro. Endereço completo é auto-declarado
— quem for causar problema digita endereço falso — e o CPF já identifica sob ordem judicial,
com base atualizada, coisa que um endereço digitado uma vez não é.

**Não existem referências.** A pessoa escolhe quem indica, então aquilo não prova nada e pode
ser telefone inventado. Regra geral: **campo declarado pela própria pessoa nunca vira garantia,
só informação.**

**Termo de uso é dado de primeira classe.** Versão, data e IP. Termo novo = nova versão = novo
aceite.

### 7.4 Presença

```ts
// attendance.ts
export interface AttendanceSummary {
  present: number
  absent: number
  distinctCompanies: number
  hasHistory: boolean   // false → a UI escreve "Novo por aqui", NUNCA "0 presenças" (§16.6)
  // NUNCA existe rating, stars, score ou comment.
}

export type AttendanceStatus =
  | 'pending'        // aguardando a empresa marcar
  | 'not_selected'   // não foi chamado — NEUTRO
  | 'present'        // foi chamado e compareceu
  | 'absent'         // foi chamado e NÃO compareceu — só isto é falta

export type DisputeOutcome = 'upheld' | 'reversed'

export interface AttendanceRecord {
  id: string
  applicationId: string          // 1:1 com a candidatura. A única coluna de ligação
  // Os três abaixo são DERIVADOS por join a partir de applicationId — nunca colunas:
  //   attendance_records → applications → workers
  //   attendance_records → applications → job_posts → companies
  workerId: string
  companyId: string
  jobPostId: string
  status: AttendanceStatus
  markedAt: string | null
  disputedAt: string | null
  disputeResolvedAt: string | null
  disputeOutcome: DisputeOutcome | null
  // Sem campo de texto livre. Nenhum.
  // Sem expiresAt: é markedAt + 12 meses, calculado na leitura.
}
```

Contestar não apaga a marcação: `status` continua sendo o que a empresa marcou, e a contestação
vive nos três campos de disputa. "Em contestação" é `disputedAt != null && disputeResolvedAt == null`.

**`workerId`, `companyId` e `jobPostId` não são campos.** São derivados da candidatura, no join
que serve a leitura. Foram colunas guardadas na tabela e deixaram de ser: cópia do que a
candidatura já diz envelhece, e o que a mantinha honesta era chave estrangeira composta — ver
§10.1. Sai a cópia, não a garantia; o que nunca é gravado não tem como divergir.

### 7.5 Vaga

```ts
// job.ts
export type JobRole =
  | 'garcom' | 'cozinheiro' | 'auxiliar_cozinha' | 'auxiliar_limpeza'
  | 'diarista' | 'barman' | 'seguranca' | 'recepcionista'
  | 'montagem_evento' | 'motorista' | 'outro'

export type JobStatus = 'open' | 'filled' | 'expired' | 'cancelled'

// Até onde o anúncio alcança. SEMPRE dentro do que o trabalhador já aceitou — ver §16.2.
export type JobReach =
  | 'unrestricted'   // PADRÃO: alcança todo mundo que já aceitou receber daquela cidade
  | 'nearby'         // a cidade da vaga mais um raio, definido em reachRadiusKm
  | 'city_only'      // só quem mora na cidade da vaga

export interface JobPost {
  id: string
  slug: string               // ÚNICO dentro da cidade
  companyId: string
  cityId: string
  role: JobRole
  title: string
  description: string
  startsAt: string           // ISO 8601 UTC
  endsAt: string             // ISO 8601 UTC. PODE cair no dia seguinte
  payAmount: number          // INFORMATIVO
  payNote: string | null
  address: string            // endereço DO BICO — este sim existe
  neighborhood: string
  requirements: string | null
  providesTransport: boolean // faz o bico de outra cidade valer a pena
  reach: JobReach            // padrão 'unrestricted' — ver §16.2
  reachRadiusKm: number | null  // obrigatório e só válido quando reach = 'nearby'
  vacancies: number
  applicationsCount: number
  status: JobStatus
  isHighlighted: boolean
  publishedAt: string
  expiresAt: string
}
```

**`startsAt` / `endsAt` em vez de data e hora separadas:** formatura entra às 22h e sai às 2h.
Com três campos, a duração dá negativo e a expiração erra o dia.

**`maxApplications` não é campo.** É `vacancies * 3`, derivado.

**Vaga vencida é DERIVADA de `expiresAt` na leitura**, nunca lida da coluna: o job de
expiração só materializa `status` para consulta, e não é a fonte da verdade — entre o instante
vencer e o job rodar, quem responde a pergunta é `expiresAt`.

**`providesTransport`** existe porque é o dado que decide se vale viajar. Junto com a cidade,
a pessoa decide sozinha — a plataforma informa, não escolhe por ninguém.

**`reach` nasce em `'unrestricted'`.** Uma cidade de dez mil habitantes com festa popular não
preenche seis vagas de garçom sozinha; um contratante numa capital, um dia, não vai querer
gente de duas horas de distância. Os dois casos são reais, e por isso o campo existe — mas o
padrão é o mais aberto, porque **padrão restritivo mata vaga em silêncio**: a empresa marca
"só minha cidade" por precaução, ninguém aparece, e ela conclui que o site não funciona sem
nunca saber por quê.

### 7.6 Candidatura

```ts
// application.ts
export type ApplicationStatus = 'applied' | 'confirmed' | 'withdrawn' | 'no_response'

export interface Application {
  id: string
  shortCode: string             // 4 caracteres, ex "A7K2". Único DENTRO da vaga
  jobPostId: string
  workerId: string
  status: ApplicationStatus
  appliedAt: string
  contactedAt: string | null    // quando a EMPRESA tocou em "Falar no WhatsApp"
  confirmedAt: string | null
}
```

### 7.7 Empresa

```ts
// company.ts
export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled'

export type ContractorDocumentType = 'cnpj' | 'cpf'   // 'cpf' só na v2.0 — §21

export interface Company {
  id: string
  accountId: string
  documentType: ContractorDocumentType   // no MVP, sempre 'cnpj'
  document: string                       // ÚNICO. Dígito verificador validado no zod
  legalName: string
  tradeName: string
  responsibleName: string
  email: string
  cityId: string
  subscriptionStatus: SubscriptionStatus
  gatewayCustomerId: string | null       // id no Asaas
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  createdAt: string
}
```

**Validação de CNPJ prova pouco.** Dígito verificador só diz que o número é bem-formado — não
que a empresa existe nem que é dela. Consulta à Receita por API pública para autopreencher a
razão social é opcional, melhora o cadastro e dá um sinal de que a empresa é real; se a API
estiver fora, o cadastro **não pode travar**.

### 7.8 Genéricos

```ts
export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } }
```

---

## 8. Contrato HTTP

Prefixo `/v1`. JSON. `Authorization: Bearer <jwt>`.

```
POST   /v1/auth/request-code        { phone }
POST   /v1/auth/verify-code         { phone, code } → { token, account, worker?, company? }
GET    /v1/auth/me

GET    /v1/cities                   ?uf=&q=          busca para o select
GET    /v1/jobs                     ?city=&role=&from=&to=&page=   city = slug
GET    /v1/jobs/:citySlug/:slug
POST   /v1/jobs                     [empresa]  403 se assinatura suspensa
PATCH  /v1/jobs/:id/close           [empresa]

POST   /v1/jobs/:id/applications    [trabalhador]  409 se atingiu o teto
GET    /v1/me/applications          [trabalhador]
POST   /v1/applications/:id/confirm [trabalhador]

GET    /v1/jobs/:id/applicants      [empresa] → { job, candidates[] } — perfil de candidato,
                                    distância, presentWithCompany, attendanceStatus. SEM telefone
GET    /v1/jobs/reach-count         [empresa] ?cityId=&role=&reach=&reachRadiusKm=&startsAt=
                                    → { count }  o "34 garçons serão avisados" do §16.2.
                                    MESMA query do disparo do push. `startsAt` opcional: sem ele
                                    a disponibilidade não filtra e o número é um TETO
GET    /v1/applications/:id/contact [empresa] → telefone DO TRABALHADOR. Grava contactedAt
POST   /v1/jobs/:id/attendance      [empresa] { applicationId, status }
GET    /v1/companies/me/attendance/pending  [empresa] fila de marcação, já sem os not_selected
                                    → { applicationId, shortCode, job, worker } — SEM telefone
POST   /v1/attendance/:id/dispute   [trabalhador]

GET    /v1/companies/me/jobs        [empresa] as vagas dela em QUALQUER estado (aberta, fechada,
                                    preenchida, vencida). Não é /v1/jobs filtrado: aquela só
                                    devolve aberta e não vencida
GET    /v1/companies/me/applicants  [empresa] candidaturas `applied` de todas as vagas dela,
                                    mais recentes antes. SEM telefone

POST   /v1/workers                  cadastro (multi-etapa, PATCH parcial)
PATCH  /v1/workers/me
PATCH  /v1/workers/me/notifications  { cityIds, nearbyRadiusKm }   1 a 5 cidades, raio 25|50|null
GET    /v1/cities/:id/neighbors      ?radiusKm=   quantas e quais cidades o raio inclui
DELETE /v1/workers/me               exclusão de conta — §13.1
POST   /v1/uploads/presign          { kind: 'selfie'|'video' } → URL do MinIO

POST   /v1/companies
GET    /v1/companies/me/subscription
POST   /v1/companies/me/subscription/checkout   → URL do Asaas

POST   /v1/push/subscribe           { subscription }
POST   /v1/reports
POST   /v1/webhooks/whatsapp
POST   /v1/webhooks/asaas
```

### Ainda NÃO implementadas

Estas a camada de acesso já chama e a API ainda não serve. Enquanto não existirem, as funções
correspondentes de `apps/web/src/lib/api/` devolvem `not_implemented` em modo `live` — nenhuma
inventa dado, e nenhuma monta no cliente o que é conta do servidor.

```
GET    /v1/jobs/for-me              [trabalhador] o roteamento do §16.2 aplicado à LISTAGEM:
                                    só as funções e as cidades que ele assinou. /v1/jobs é
                                    público e não olha o token
GET    /v1/jobs/neighborhoods       bairros COM vaga aberta agora — o filtro só oferece o que
                                    leva a resultado. Derivar da página 1 esconderia bairro
GET    /v1/me/attendance            [trabalhador] o próprio histórico, sem os expirados (12 meses)
POST   /v1/applications/:id/withdraw [trabalhador] retirar candidatura. Retirar não gera falta
POST   /v1/workers/me/deactivate    [trabalhador] só o próprio dono desativa (regra 3). NÃO é
                                    campo de PATCH: desativar é ato, não edição de perfil
POST   /v1/workers/quick            cadastro reduzido do muro do "Quero essa vaga" — sem CPF,
                                    que `workerCreateSchema` exige hoje
```

`POST /v1/workers` existe, mas só aceita o cadastro INTEIRO (`.strict()`), enquanto a tela grava
etapa a etapa para queda de conexão não zerar o esforço (§16.1). Falta a rota aceitar o parcial.

**Não existe rota que entregue ao trabalhador o telefone da empresa.** O único contato que a
plataforma revela é o do trabalhador, para a empresa dona da vaga.

**Candidatar-se não depende de cidade assinada.** `POST /v1/jobs/:id/applications` não checa
cidade nenhuma — quem assina cidade recebe aviso; quem navega se candidata a qualquer vaga.

### 8.1 Camada de acesso no front

```ts
export async function listJobs(filters: JobFilters): Promise<Paginated<JobPost>>
export async function getJobBySlug(citySlug: string, slug: string): Promise<JobPost | null>
export async function createJob(input: CreateJobInput): Promise<ApiResult<JobPost>>
```

O mock simula 300–800ms de latência e falha em ~5% das chamadas.

---

## 9. Docker

Sem alteração: nginx, certbot, web, api, postgres e minio; postgres e minio sem porta
publicada; certbot renovando a cada 12h; Dockerfiles multi-stage com `HEALTHCHECK`.
Dev: `docker-compose.dev.yml` sobe só postgres e minio.

Backup: `pg_dump` diário no cron do host, retenção de 14 dias. **Testar a restauração uma vez.**

Deploy: `git pull` + `docker compose up -d --build` por SSH. 2 GB de swap. Migrações **não**
entram no deploy automático.

---

## 10. Banco e migrações

- Dev: `prisma migrate dev` contra o Postgres local (WSL, 5433) — `--create-only` primeiro
  quando a migration levar constraint junto (§10.1)
- Produção: `prisma migrate deploy` na mão no contêiner, **com `pg_dump` antes**
- **Sem seed de aplicação em produção.** A tabela `cities` é exceção: é dado de referência
- Índices: ver `schema.prisma`

### 10.1 O que o Prisma não modela

`CHECK`, coluna gerada, índice parcial, trigger e view **não existem no `schema.prisma`**: os
CHECK de `job_posts` e `attendance_records`, o alvo único de `reports`, os quatro triggers e as
duas views. Como boa parte da defesa deste modelo está justamente aí, tudo entra no SQL da
migration que introduz cada uma — `prisma migrate dev --create-only`, acrescenta o SQL, aplica.

Isso vale para o que o Prisma **ignora**. O que ele **modela**, ele reconcilia: chave
estrangeira que não estiver declarada no `schema.prisma` ele apaga, criando uma migration
sozinho só para o `DROP`. Foi o que aconteceu com as três chaves compostas que amarravam
`worker_id`, `company_id` e `job_post_id` em `attendance_records` — e a saída não foi declarar
relação falsa no modelo, foi **eliminar as três colunas**. Os ids chegam por join a partir de
`applicationId` (§7.4), e o que nunca é gravado não tem como divergir.

Nada é aplicado por fora das migrations: objeto existindo no banco sem estar no histórico é
*drift permanente*, e todo `migrate dev` passa a exigir reset.
`infra/sql/constraints.reference.sql` é catálogo, não script.

A rede é um teste que roda contra o banco e falha se alguma constraint sumiu. Constraint que
some em silêncio é o mesmo tipo de problema que confundir banco de dev com produção: o banco
continua aceitando escrita, só parou de proteger.

`uuid` v7 gerado na aplicação — o PostgreSQL 17 não tem `uuidv7()` nativo (chegou no 18).

---

## 11. Autenticação — WhatsApp, custo zero

**Telefone + código de uso único, confirmado pelo WhatsApp. Sem senha, sem e-mail, sem SMS.**

### 11.1 OTP invertido

Conversa iniciada pelo usuário é gratuita. Então o usuário é quem manda:

1. Digita o telefone → 2. Backend gera código de 6 dígitos e devolve link `wa.me` →
3. Botão **"Confirmar no WhatsApp"** → 4. Um toque em enviar →
5. Webhook recebe a mensagem **com o número validado pelo próprio WhatsApp** →
6. Backend casa código + número e grava `phoneVerifiedAt` → 7. Responde "Confirmado!" →
8. Front detecta por polling curto (2s, limite de 3min)

### 11.2 Por que é melhor que SMS

Custo zero e oficialmente suportado · número assinado pelo WhatsApp é prova mais forte que
receber um SMS · funciona em número que só tem WhatsApp · um toque.

### 11.3 O que montar

Meta Business + Cloud API · **um número dedicado** (deixa de funcionar no app comum — nunca o
pessoal e **jamais** o dos grupos do sócio) · webhook em `POST /v1/webhooks/whatsapp` ·
verificação de token e da assinatura `X-Hub-Signature-256`.

### 11.4 Bordas

Código expira em 10 minutos; máximo 3 tentativas por telefone por hora; rate limit por IP.
Botão "não consegui confirmar" → segue com `phoneVerifiedAt = null` e aviso discreto.
**Nunca travar o cadastro por falha de verificação.** O código é guardado **em hash**.

### 11.5 Sessão

JWT de 30 dias com refresh silencioso.

---

## 12. PWA e notificações

`manifest.json` com `display: standalone` · service worker próprio (evitar `next-pwa`) ·
Web Push com VAPID · prompt de instalação **só depois da primeira candidatura** ·
iOS exige PWA na tela de início para receber push — detectar e instruir antes de pedir permissão.

**O gargalo dos 60 segundos do §16.2 não é o banco.** A query responde em milissegundos. O
tempo vai no fan-out do push — centenas de requisições HTTP, uma por dispositivo. Quem cumpre a
meta é paralelismo e retry na entrega, não índice.

**A permissão de notificar é o recurso mais escasso do produto.** Push irrelevante não faz
perder uma vaga: faz perder a pessoa, porque desligar notificação no Android é definitivo na
prática. É por isso que push é só das cidades assinadas (§16.2).

**E o mesmo vale do outro lado.** Vaga que não recebe candidato e aviso que não interessa são o
mesmo erro com dois nomes: os dois fazem alguém concluir que a plataforma não serve. Quem
chegou a essa conclusão não reclama — some. E trazer de volta custa muito mais do que teria
custado não perder. Toda escolha de padrão neste documento — alcance aberto por default, raio
desligado por default, nunca travar cadastro por falha de verificação — vem daí.

---

## 13. Mídia no MinIO

Dois buckets: `docs` (**privado**) e `public` (vídeos) · upload direto do navegador por URL
pré-assinada, **o arquivo nunca passa pela API** · selfie comprimida no cliente (1200px, ~200 KB) ·
vídeo com teto rígido de 30s e ~5 MB.

### 13.1 Exclusão de conta (LGPD)

Exclusão é **transação com efeito no MinIO**, não `deleted = true`. Ordem: apaga objetos →
apaga linhas → grava o registro. Se o MinIO falhar, não commita; entra em fila de retry.

| O quê | Destino |
|---|---|
| CPF, nascimento, selfie, vídeo, telefone | **apagados**, linha e objeto |
| Funções, disponibilidade, cidades assinadas, inscrições de push | **apagados** |
| Histórico de presença | **apagado** — guardar registro de falta de quem pediu para sair é material de ação, e não serve para nada porque o perfil deixou de existir |
| Candidaturas | **anonimizadas**: `workerId → null`, mantendo vaga, `shortCode` e datas |
| Denúncias e ações de moderação | **ficam** — exercício regular de direito; é a prova de diligência do §14.4 |
| Registro da exclusão | **fica, sem identificador.** Não guardar hash de CPF: o espaço é pequeno e se reverte por força bruta. Hash de CPF é dado pessoal, não anônimo |

Prazo de retenção de moderação e de resposta ao titular: **revisão jurídica pré-lançamento.**

---

## 14. Regras de negócio no código

### 14.1 Filtro de linguagem discriminatória

Schema zod em `packages/shared`, usado no formulário **e** na rota — o cliente é contornável.
Aplica-se a `title`, `description` e `requirements`.

Bloquear: `moça`, `moço`, `rapaz`, `boa aparência`, `boa apresentação`, `até \d+ anos`,
`sexo (masculino|feminino)`, `apenas (homens|mulheres)`, `solteir[oa]`, `sem filhos`, recortes raciais.

Mensagem explicativa: *"Anúncios de vaga não podem exigir sexo, idade ou aparência (art. 373-A
da CLT). Reescreva descrevendo a função e os requisitos técnicos."* Registrar em log — é prova
de diligência.

### 14.2 Bloqueio de menores

Validação de `birthDate` no schema compartilhado **e** trigger no banco (§10.1).

### 14.3 Ausência de poder disciplinar

Nunca: banimento por faltas, desativação automática, bloqueio por nota, ranking punitivo,
ordenação que rebaixa por falta. O enum de `WorkerStatus` não tem valor de banimento —
alterar exige mexer no tipo, o que é visível em revisão.

### 14.4 Denúncia e remoção

Denúncia em toda vaga e todo perfil. Fila no painel. Meta de 48h. Toda ação com data registrada.

---

## 15. Telas do MVP

**Público:** home · **`/vagas/[cidade]`** listagem filtrável · **`/vagas/[cidade]/[slug]`**
detalhe (SSG/ISR) · cadastro do trabalhador · cadastro da empresa · entrar

**Trabalhador:** minhas candidaturas (confirmação de véspera em destaque) · meu perfil ·
**minhas cidades de aviso**

**Empresa:** painel · publicar vaga · candidatos da vaga · marcar presença · assinatura

**URL por cidade não é enfeite.** Cada cidade vira uma página que o Google indexa
separadamente, e indexação é a única aquisição gratuita do projeto. Trocar URL depois de
indexado joga fora o que já foi conquistado — por isso a estrutura nasce assim, mesmo com uma
cidade só.

---

## 16. Fluxos críticos

### 16.1 Cadastro do trabalhador

**nome e CPF** → **telefone** (verificação por WhatsApp) → **foto do rosto com o documento ao
lado** → **perfil** (cidade, bairro, até 5 funções, experiência, disponibilidade) →
**cidades de aviso** → **aceite do termo** → **vídeo de 30s, opcional**.

Progresso salvo a cada etapa: queda de conexão não pode zerar o esforço.

**A etapa de cidades já vem com a cidade dele marcada.** Ele acabou de informá-la; perguntar de
novo numa tela em branco com 5.570 municípios é fricção no lugar errado — e essa é a tela que
liga o produto. **Mínimo uma, máximo cinco.** Quem sai com zero não recebe nada, acha que o
site é quebrado e some sem reclamar.

Na mesma tela, desligado por padrão: **"receber também vagas de cidades vizinhas"**, com 25 ou
50 km e o número de cidades que aquilo inclui exibido antes de ligar.

**O vídeo é opcional e é ele que dá o selo.** Quem não grava se cadastra e recebe vagas do
mesmo jeito; só não exibe *perfil completo*. `profileCompletedAt` é preenchido quando tudo,
inclusive o vídeo, está lá.

A fricção é intencional — filtra quem não faria o esforço de acordar às 6h no sábado. **Mas é
hipótese, não dogma:** se a conclusão ficar abaixo de 40%, o vídeo é o primeiro item a cair —
e como já é opcional, essa queda é ajuste de copy, não migração.

### 16.2 Publicação → notificação → candidatura

Empresa publica → filtro de conteúdo (§14.1) → vaga `open` → o job seleciona quem
**alcança aquela cidade** + tem a função + tem disponibilidade no dia e período da vaga →
dispara Web Push → trabalhador se candidata → empresa vê a lista e chama no WhatsApp.

**"Alcança aquela cidade" é a união de duas coisas:**

1. a cidade da vaga está entre as **cidades assinadas** do trabalhador, **ou**
2. o trabalhador ligou o **raio** e a cidade da vaga está a até `nearbyRadiusKm` da cidade dele

E a empresa pode **estreitar** esse alcance no anúncio, com `reach` (§7.5).

**Duas regras que tornam o filtro da empresa seguro:**

**1. O alcance da empresa só estreita, nunca amplia.** O trabalhador já disse de onde aceita
receber; a empresa não fura essa escolha. Uma empresa pode pedir 500 km que ninguém fora do
opt-in recebe. Por isso o campo não precisa de teto — **o filtro do trabalhador é o teto.**

**2. Inscrição explícita vence o raio da empresa.** Quem colocou aquela cidade na mão, entre as
cinco, sempre recebe. Ele declarou "eu trabalho nessa cidade" — pode morar a 80 km e ir de
ônibus todo fim de semana, e a plataforma não tem por que saber melhor que ele. O `reach` da
empresa filtra **apenas** quem está chegando pelo raio de vizinhança.

```sql
SELECT DISTINCT w.id
FROM workers w
JOIN worker_roles wr        ON wr.worker_id = w.id AND wr.role = $role
JOIN worker_availability wa ON wa.worker_id = w.id
                           AND wa.weekday = $weekday AND wa.period = $period
LEFT JOIN worker_notification_cities wnc
       ON wnc.worker_id = w.id AND wnc.city_id = $jobCityId
LEFT JOIN city_neighbors cn
       ON cn.city_id          = w.city_id
      AND cn.neighbor_city_id = $jobCityId
      AND cn.distance_km     <= w.nearby_radius_km
WHERE w.status = 'complete'
  AND (
        wnc.city_id IS NOT NULL                      -- inscrição explícita: sempre passa
        OR (
          cn.neighbor_city_id IS NOT NULL            -- chegou pela vizinhança
          AND (
                $jobReach = 'unrestricted'
             OR ($jobReach = 'city_only' AND w.city_id = $jobCityId)
             OR ($jobReach = 'nearby'    AND cn.distance_km <= $jobReachRadiusKm)
          )
        )
      );
```

`city_neighbors` inclui o par (X, X) com distância 0. É o que faz `city_only` funcionar pelo
mesmo caminho, sem ramo especial na query.

**Duas telas valem tanto quanto esses campos:**

**Na publicação, mostrar o custo de estreitar:** *"Só Poços de Caldas: 34 garçons serão
avisados. Até 50 km: 121."* Sai da mesma tabela de vizinhança. Sem esse número, a decisão é
tomada no escuro e o prejuízo fica invisível para os dois lados.

**Na lista de candidatos, mostrar a distância:** *"João · Caldas · cerca de 24 km · transporte
fornecido"*. A empresa escolhe olhando o fato — a plataforma informa, não decide.

**Duas coisas separadas, e é o coração do modelo:**

| | Regra |
|---|---|
| **Receber aviso** | Cidades assinadas (1 a 5) **mais**, se ligado, o raio de 25 ou 50 km em torno da cidade onde mora. Opt-in explícito nos dois |
| **Ver e se candidatar** | Qualquer cidade. A lista tem select de cidade e a candidatura não checa nada |

**Push de cidade vizinha carrega a distância e o transporte no próprio texto** — "Caldas ·
cerca de 24 km · transporte fornecido". Sem isso o aviso chega e a pessoa precisa abrir o app
para descobrir se vale, e essa é exatamente a fricção que faz alguém desligar notificação.

O raio não é um furo no teto de 5 cidades: a filtragem por função e por disponibilidade
continua valendo, então não é "todas as vagas de 23 cidades", é "as vagas da minha função, no
horário em que eu posso, num raio que eu escolhi".

Alguém que passa um mês em outro estado troca as cidades assinadas. Alguém que quer só olhar a
vaga de R$ 500 na cidade vizinha abre a lista e se candidata — sem assinar, sem receber push
das outras vinte vagas de lá.

**A lista abre já filtrada nas cidades dele.** Abrir mostrando o país inteiro faz o cara de
Poços ver vaga em Manaus e concluir que o site não serve.

**O tempo entre publicar e a primeira notificação chegar é a métrica técnica mais importante do
produto. Meta: menos de 60 segundos.**

### 16.3 Confirmação de véspera

Job diário às 18h notifica os candidatos das vagas do dia seguinte. Sem confirmação até 18h, a
vaga reabre e a empresa é avisada. Não confirmar **não gera falta** — é aviso, não punição.

### 16.4 Marcação de presença e contestação

Após a data, pendência no painel. Um clique por candidato, entre três opções (§16.7).
**Sem texto.** O trabalhador é notificado e tem 7 dias para contestar. Contestado, o registro
sai da contagem pública até a resolução — mas **a marcação original é preservada**. Registro
com mais de 12 meses sai da contagem.

### 16.5 Revelação de contato — só a empresa inicia

O telefone **nunca** aparece em página pública, e **nunca é exibido como texto em lugar nenhum
da interface** — só existe atrás de um botão que abre o WhatsApp. Número escrito na tela é
número copiado e colado no grupo.

**Direção única: a empresa entra em contato com o trabalhador. Nunca o contrário.**

Uma vaga de seis aceita até dezoito candidaturas. Se todos pudessem chamar, o contratante —
que é o cliente pagante — receberia dezoito mensagens de desconhecidos por anúncio e
cancelaria a assinatura. E o número dele, hoje exposto a milhares no grupo, aqui não aparece
para ninguém. É argumento comercial, não só proteção.

**Trabalhador:** abre a vaga e vê tudo menos o contato → toca em **"Quero essa vaga"** → a tela
diz **"Candidatura enviada. Se a empresa escolher você, ela chama no seu WhatsApp."** (nunca
"a empresa foi notificada": é promessa sobre terceiro) → **não existe botão de contato para
ele, em momento nenhum**.

**Empresa:** vê os candidatos com perfil, histórico e **distância até o local do bico** → toca
em **"Falar no WhatsApp"** →
`GET /v1/applications/:id/contact` grava `contactedAt` e abre o `wa.me`:

```
Oi João! Aqui é o Buffet Encanto.
Vi sua candidatura para Garçom para casamento em Cascatinha,
sábado 22/08 às 17h — R$ 150.
Código: A7K2
— via extraqui.com.br
```

**O clique é o ato de escolher.** `contactedAt` preenchido = a empresa chamou.

**O nome completo sai pelo mesmo portão, e no mesmo instante.** Antes do clique, a empresa vê
"João S."; `GET /v1/applications/:id/contact` devolve `{ phone, fullName, contactedAt }` — as
duas coisas de uma vez, porque é a mesma decisão. Vale para as três telas da empresa (lista de
candidatos, detalhe do candidato, fila de presença), **sem exceção por tela**: quem faz o corte
é `worker-profiles.ts`, num lugar só, e a tela nunca escolhe se mostra ou não.

Sem esse portão, uma assinatura mensal vira colheita: paga-se um mês, abrem-se as vagas e
exporta-se nome completo de toda a base da cidade sem chamar ninguém. Com ele, cada nome custa
um `contactedAt` — registro auditável de que a escolha aconteceu. E para ESCOLHER a empresa não
precisa do sobrenome: ela decide por função, distância, disponibilidade e histórico.

Enquanto `fullName` é `null`, a tela mostra primeiro nome e inicial mais uma linha discreta —
*"o nome completo aparece quando você chamar no WhatsApp"* — porque campo vazio sem explicação
a empresa lê como bug. Depois do contato, o nome completo entra na lista com o valor que veio
na própria resposta, sem recarregar nada.

**Teto de candidaturas:** `vacancies * 3`. Atingido, exibe "candidatos suficientes".

**Métrica que isso destrava:** candidaturas por vaga versus `contactedAt` preenchidos. Muitas
candidaturas e poucos contatos = a empresa não está voltando ao painel, e o problema é de
notificação, não de oferta.

### 16.6 Exibição do histórico

```
9 presenças · 1 falta · 5 empresas
```

Número cru, sem estrela, nota, porcentagem ou barra · **sem cor que sugira julgamento** ·
contestados em aberto e registros com mais de 12 meses fora da contagem · ao lado, o `shortCode`.

A contagem sai da view `worker_attendance_summary`, que não lê coluna alguma de trabalhador ou
de empresa em `attendance_records` — não existe nenhuma. Chega ao trabalhador por
`applications`, e à empresa por `applications → job_posts`; as empresas distintas são contadas
sobre `job_posts.company_id` (§7.4, §10.1).

**A rampa de entrada:** quem não tem histórico **nunca** exibe `0 presenças`. Exibe
**"Novo por aqui"**, ao lado do selo de perfil completo. É por isso que `AttendanceSummary`
carrega `hasHistory`: a decisão vem do servidor, para nenhum componente novo precisar
interpretar que zero significa "novo" e não "ruim".

Reputação sem rampa tranca o novato em definitivo — não é chamado porque não tem histórico, e
não tem histórico porque não é chamado.

### 16.7 Os três desfechos da marcação

| Desfecho | Significa | Entra no histórico público? |
|---|---|---|
| **não chamei** (`not_selected`) | a empresa não escolheu essa pessoa | **Não.** É neutro |
| **compareceu** (`present`) | foi chamada e foi | Sim |
| **não compareceu** (`absent`) | foi chamada e não foi | Sim — **só isto é falta** |

Sem o desfecho neutro, ou o painel entope de pendência, ou a empresa marca falta só para
limpar a lista — e aí a plataforma pune quem nunca foi chamado.

Passados **7 dias sem marcação**, o registro vira `not_selected` automaticamente. Nunca falta.

---

## 17. Padrões de código

TypeScript `strict`, zero `any` · Server Components por padrão · zod em `packages/shared`,
compartilhado entre formulário e rota · `lib/api/` retorna `ApiResult<T>` — erro é valor, não
exceção · código em inglês, interface em português · datas ISO 8601 UTC no contrato,
`America/Sao_Paulo` só na exibição · sem barrel files · commits convencionais · segredos no `.env`.

---

## 18. Ordem de execução

1. Monorepo, workspaces, lint, TS
2. **Todos os tipos e schemas de `packages/shared`**
3. Fixtures e camada mock (inclui um punhado de cidades)
4. Layout base, navegação, PWA manifest
5. **Home + `/vagas/[cidade]` + detalhe** ← *é o que o sócio leva para vender*
6. Cadastro do trabalhador, incluindo cidades de aviso
7. Login (mockado)
8. Publicar vaga + filtro discriminatório
9. Painel da empresa + candidatos
10. Marcação de presença + contestação
11. Confirmação de véspera
12. **Revisão de toda a copy contra a tabela do §2.1**
13. Fase 4: API Fastify
14. Fase 5: Prisma, Postgres, constraints dentro das migrations (§10.1), seed de cidades
15. MinIO, Web Push real, Resend
16. Deploy, DNS, nginx e certbot
17. Backup configurado **e restauração testada**
18. Assinatura e Asaas (§20)

Itens 1 a 12 rodam inteiramente contra o mock.

---

## 19. Fora do escopo

Chat interno · estrelas, notas ou comentários · processamento do pagamento do bico ·
antecedentes criminais · app nativo · analytics elaborado · internacionalização ·
raio por endereço exato ou GPS (a distância é entre centros de município) ·
**qualquer cobrança ligada ao trabalhador** (§2).

---

## 20. Assinatura da empresa — Asaas

Entra no item 18 da ordem de execução, não antes.

- Cadastro cria a empresa em `trialing`, `trialEndsAt = createdAt + 30 dias`
- **Primeiro mês gratuito, vagas ilimitadas.** Não existe limite de anúncios por plano
- Ao fim do teste, cobrança mensal. Pago → `active`. Falhou → `past_due`, com aviso e prazo
- `past_due` esgotado → `suspended`: **não publica vaga nova, e as vagas já abertas seguem até
  expirar.** Derrubar vaga em andamento pune trabalhador que já se candidatou e não tem nada a
  ver com o boleto
- Cancelamento → `cancelled` ao fim do período pago

### 20.1 Regras de integração

**O status da assinatura é definido pelo webhook, nunca pelo retorno do navegador.** É o bug
clássico: o cliente paga, volta para a página de sucesso, o front marca `active` — e aí basta
abrir aquela URL para ganhar assinatura. O redirect é enfeite; `POST /v1/webhooks/asaas` é o
fato. Webhook com verificação de origem e **idempotente**: o mesmo evento chega mais de uma vez.

**Checkout transparente significa que o cartão passa pela nossa página.** Usar a tokenização do
Asaas para que o número **nunca** toque no nosso servidor, no nosso log nem no nosso banco.

**Avaliar Pix Automático antes de assumir cartão.** O cliente é buffet pequeno e restaurante de
bairro: muitos não têm cartão de crédito empresarial, todos têm Pix. Assinatura em cartão de PJ
pequena falha muito, e falha de cobrança vira churn que não é do produto.

Guardar os eventos crus do gateway em tabela própria — auditoria e idempotência.

**A cobrança referencia `Company`. Nunca `Worker`.** Nenhuma tabela, coluna, rota ou webhook de
cobrança pode ter relação com trabalhador — vale um teste no CI que lê o `schema.prisma` e
falha se algum model com relação a `Worker` tiver campo monetário. Ausência não tem constraint;
tem teste.

---

## 21. Preparado para a v2.0 (não implementar agora)

| v2.0 | O que já está pronto |
|---|---|
| **Contratante pessoa física** — quem precisa de encanador em casa | `documentType` aceita `'cpf'`; o campo se chama `document`, não `cnpj` |
| **Mesma pessoa contrata e trabalha** | `Account` é separado de `Worker` e `Company`; nada proíbe ter os dois |
| **Escala nacional** | `City` com IBGE, UF e slug; URL por cidade; notificação por assinatura de cidade e por raio |
| **Raio maior ou por endereço** | `city_neighbors` já guarda pares até 100 km; `lat`/`lng` na tabela |
| **App nativo** | API separada desde o começo, contrato único |

O que **não** está preparado, de propósito: cobrança ligada a trabalhador (§2), avaliação com
texto, e qualquer forma de ranking. Preparar essas coisas seria construir a porta para a
violação da regra.

---

## 22. Como usar com o Claude Code

O `CLAUDE.md` na raiz é a fonte das regras invioláveis e das convenções. Este documento é a
referência de detalhe, lida sob demanda.

Uma tarefa por vez, referenciando a seção:

> implemente o cadastro do trabalhador conforme §16.1, usando os tipos de §7 e a camada de §8.1
