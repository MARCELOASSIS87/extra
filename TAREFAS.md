# Backlog de tarefas — copie, cole, revise, commite

**Progresso: tudo até o PARE AQUI concluído**, mas a sessão de modelagem do banco (22/08)
mudou contratos que o front já implementou. **O bloco S é a dívida que isso gerou** e vem
antes de mostrar qualquer coisa pro sócio. S1 a S5 já foram: cidade é entidade, a vaga
guarda instantes, as referências saíram do cadastro, as cidades de aviso existem no cadastro,
no perfil e na listagem, a publicação mostra o custo de estreitar o alcance e a contestação
virou dimensão própria, sem apagar a marcação. O S7 fechou a revisão. **Bloco S concluído.**

Depois do bloco S: o sócio no celular, com roteiro de tarefas. Depois disso, contar os
anunciantes recorrentes nos grupos e pré-vender cinco assinaturas. As Fases 4 e 5 (API, banco,
Docker) só valem o esforço com esse retorno na mão.

Uma tarefa por conversa no Claude Code. **Commit ao fim de cada uma** — é o seu desfazer.
Não pule a ordem dentro de cada bloco.

> Referências de seção apontam para `ESPECIFICACAO-TECNICA.md` (sem versão no nome).
> O modelo de dados está escrito em `apps/api/prisma/schema.prisma` e
> `infra/sql/constraints.sql`, mas **nada foi executado ainda**.

---

## Fase 1 — Fundação e contratos

### 1. Monorepo ✅
```
Crie a estrutura do monorepo com pnpm workspaces conforme o CLAUDE.md:
apps/web (Next.js 16.3 App Router, TypeScript strict, Tailwind, shadcn/ui),
apps/api (Node + Fastify + TypeScript) e packages/shared.
Configure ESLint e Prettier na raiz, valendo para todos os workspaces.
Não crie nenhuma tela ainda.
```
**Pronto quando:** `pnpm dev` sobe o Next e a página padrão abre.

### 2. Tipos do domínio ✅
```
Crie todos os tipos de domínio em packages/shared/src/types/ exatamente
como estão na seção 7 da especificação: worker, attendance, job,
application, company e api.
Exporte tudo pelo package. Nada de tipo de domínio em apps/.
```
**Pronto quando:** `pnpm -F shared build` passa sem erro.

### 3. Schemas de validação ✅
```
Crie os schemas zod em packages/shared/src/schemas/ para: cadastro de
trabalhador (uma etapa por schema), cadastro de empresa e publicação de vaga.
Inclua o filtro de linguagem discriminatória da seção 14.1 do CLAUDE.md
e a validação de idade mínima de 18 anos.
Os schemas precisam servir tanto pro formulário quanto pra API.
```
**Pronto quando:** existe teste simples provando que "preciso de moça até 30 anos" é rejeitado.

### 4. Trava de import ✅
```
Configure no ESLint de apps/web uma regra no-restricted-imports que proíba
qualquer arquivo fora de src/lib/api/ de importar de src/mocks/.
```
**Pronto quando:** um import proposital em um componente acusa erro de lint.

---

## Fase 2 — Camada mock

### 5. Fixtures ✅
```
Crie apps/web/src/mocks/fixtures.ts com dados falsos realistas de uma cidade
brasileira: 12 empresas, 40 trabalhadores e 25 vagas em estados variados
(abertas, preenchidas, expiradas). Use nomes, bairros e funções plausíveis.
```

### 6. Camada de acesso ✅
```
Crie apps/web/src/lib/api/ com jobs.ts, workers.ts, companies.ts,
applications.ts e attendance.ts, com as assinaturas da seção 8.1 da spec.
A implementação lê das fixtures, simula 300 a 800ms de latência e falha em
5% das chamadas. Tudo retorna ApiResult.
Controle por NEXT_PUBLIC_API_MODE=mock.
```
**Pronto quando:** dá pra chamar `listJobs()` numa página de teste e ver os dados.

---

## Fase 3 — Telas (o que o sócio leva pra vender)

### 7. Layout e navegação ✅
```
Crie o layout base do app: cabeçalho, navegação mobile-first, rodapé e o
manifest do PWA. Sem service worker ainda.
Desenhe pensando em tela de 360px de largura.
```

### 8. Home ✅
```
Implemente a home pública: vagas abertas mais recentes, busca por função e
dois caminhos claros — "quero trabalhar" e "quero contratar".
Server Component, consumindo listJobs pela camada de api.
```

### 9. Listagem de vagas ✅
```
Implemente a listagem de vagas com filtro por função, data e bairro,
paginação e estados de carregando, vazio e erro.
```

### 10. Detalhe da vaga ✅
```
Implemente a página de detalhe da vaga por slug, com SSG/ISR para ser
indexável no Google. Inclua metadata e JSON-LD de JobPosting.
Botão de candidatura visível sem rolar a página no celular.
```
**Aqui você já tem o que mandar o sócio mostrar pros buffets.**

### 10.1. Ajustes da primeira revisão ✅
```
Faça estes ajustes:

1. Nas fixtures, só 1 em cada 6 vagas deve ter isHighlighted = true.
   Hoje quase todas estão marcadas como destaque.

2. No menu, "Candidaturas" e "Perfil" só devem aparecer para usuário
   autenticado. Visitante anônimo vê apenas Vagas, Publicar vaga e Entrar.

3. Aumente o contraste dos textos secundários (o subtítulo da home e as
   legendas dos cards). Garanta no mínimo 4.5:1 contra o fundo.

4. A faixa de filtros por função precisa rolar na horizontal com suavidade
   em telas de 360px, sem quebrar linha e sem cortar o último item.

5. Na home, troque "Trabalho extra na sua região" por "Trabalho extra em
   Poços de Caldas", já que ainda não existe seletor de região.

6. Nas fixtures, a cidade é Poços de Caldas-MG, não Juiz de Fora. Corrija
   em todas as vagas e empresas, e use os bairros reais da lista abaixo.

Depois confira a home e a listagem em viewport de 360px.
```
**Pronto quando:** em 360px nada corta, e no card só aparece "Destaque" de vez em quando.

---

## Bloco de demonstração — fazer agora

*É o que o sócio precisa apresentar: a empresa se cadastra, publica e vê candidatos.
Nenhuma delas depende do cadastro do trabalhador.*

### 12. Cadastro da empresa ✅
```
Implemente o cadastro da empresa com CNPJ, dados do responsável e aceite dos
termos. Valide o CNPJ.
```

### 12.1. Acesso à área da empresa na demo ✅
```
Enquanto NEXT_PUBLIC_API_MODE=mock, deixe a área da empresa acessível sem
autenticação, com um seletor no topo para escolher "entrar como" uma das
empresas das fixtures. Isso é só para demonstração e deve sumir no modo live.
```

### 14. Publicar vaga ✅
```
Implemente o formulário de publicação de vaga usando o schema compartilhado,
com o filtro de linguagem discriminatória atuando no envio e mensagem
explicativa, não acusatória, quando bloquear.
```

### 15. Painel da empresa ✅
```
Implemente o painel da empresa: vagas abertas, candidatos novos e a lista de
pendências de marcação de presença.
```

### 16. Candidatos da vaga ✅
```
Implemente a tela de candidatos de uma vaga, exibindo WorkerPublicProfile
(nunca CPF nem data de nascimento), o histórico de presença como número cru,
o selo de perfil completo e um botão que abre o WhatsApp do candidato.
```

## Correções de contrato e mecanismo — F a J

*Saíram da conversa depois da tarefa 16. Fazer antes do bloco A–E, porque
mudam contrato de dados e fixtures.*

### F. Contato só após candidatura ✅
```
Mudança de contrato conforme §16.5 da especificação.

1. packages/shared: JobPost perde contactPhone e ganha applicationsCount e
   maxApplications. Novo tipo JobPostContact { jobPostId, contactPhone }.
   Application ganha shortCode (4 caracteres maiúsculos) e contactedAt.
2. Página pública da vaga não mostra telefone nenhum. Botão principal
   "Quero essa vaga".
3. Depois de candidatar: "Candidatura registrada. Você aparece no painel da
   empresa. Chame no WhatsApp para combinar os detalhes." Nunca escrever
   "a empresa foi notificada".
4. Botão "Falar no WhatsApp" abre wa.me com a mensagem da §16.5 e grava
   contactedAt no mesmo clique.
5. getJobContact(jobId) só retorna com candidatura ativa do usuário atual.
6. maxApplications = vacancies * 3. No teto, exibe "candidatos suficientes".
7. No card da listagem, applicationsCount no lugar de qualquer contato.
8. Atualize as fixtures.
```

### G. Histórico ao lado do candidato ✅
```
Na tela de candidatos da empresa, mostre o histórico de presença ao lado do
nome, no formato: 9 presenças · 1 falta · 5 empresas

- sem estrela, sem nota, sem porcentagem, sem cor que sugira julgamento
- contestados e com mais de 12 meses não entram na contagem
- quem não tem histórico exibe "Novo por aqui", nunca "0 presenças"
- ao lado, o shortCode da candidatura
Mostre também no perfil público do trabalhador.
```

### H. Desfecho neutro na marcação ✅
```
Conforme §16.7 da especificação.

1. AttendanceStatus passa a ser:
   'pending' | 'not_selected' | 'present' | 'absent' | 'disputed'
   AttendanceRecord ganha applicationId; markedAt vira string | null.
2. Na marcação, três botões por candidato:
   "Não chamei este" | "Compareceu" | "Não compareceu"
3. not_selected não entra em AttendanceSummary e nunca aparece no perfil
   público, nem como contagem.
4. 'pending' com mais de 7 dias da data da vaga vira 'not_selected'
   automaticamente. No mock, calcule na leitura.
5. Nunca inferir falta de ausência de marcação. Só 'absent' é falta.
6. Vaga fechada ou expirada avisa quem ficou not_selected com "A vaga foi
   preenchida". Nunca "você não foi escolhido".
7. Atualize as fixtures com os quatro desfechos misturados.
```

### I. Fixtures com datas no passado ✅
```
Nas fixtures, garanta vagas com data nos últimos 10 dias, com candidatos em
desfechos variados: alguns compareceu, alguns não compareceu, alguns não
chamei e pelo menos 3 ainda pendentes de marcação.
Sem isso a tela de marcar presença nunca aparece na demonstração.
```

### J. Compartilhamento de vaga ✅
```
1. Botão "Compartilhar" no detalhe da vaga, abrindo wa.me com:

Vaga de {função} — {título}
{dia} {data}, {hora início} às {hora fim} — R$ {valor}
{n} vagas
{url completa da vaga}

2. Use navigator.share quando disponível, com o wa.me como alternativa.
3. Crie opengraph-image.tsx na rota da vaga gerando imagem dinâmica com
   função, título, data, valor, cidade e a marca Extraqui, nas cores do
   projeto.
4. Metadata completa (og:title, og:description, og:image) por vaga.
```

---

## Ajustes pós-primeira revisão — K a R

### K. Modo demonstração e conteúdo por papel ✅
Barra em dois passos, seletores lendo do store, navegação e home mudando por
papel (visitante / trabalhador / empresa).

### L. Card de pendência com contexto ✅
Nome, função, vaga, data e horário, bairro, shortCode e botão de WhatsApp.

### M. Valor sempre em real inteiro ✅
`payAmount` inteiro no schema, input `step="1"`, exibição sem centavos.

### N. Telefone nunca como texto ✅
Único caminho é o botão que abre o WhatsApp, inclusive para referências.

### O. Detalhe do candidato ✅ *(falta o link — ver Q)*
`WorkerApplicantProfile` e a rota `/empresa/vagas/[id]/candidatos/[workerId]`.

### P. Direção única de contato ✅
Só a empresa inicia. `contactedAt` gravado no clique da empresa.

### Q. Tornar o card do candidato clicável ✅
```
Na lista de candidatos da vaga, o card inteiro leva para
/empresa/vagas/[id]/candidatos/[workerId].
O card é um link acessível (foco visível, navegável por teclado), e os
botões internos — WhatsApp e marcação de presença — não disparam a
navegação ao serem clicados.
```

### R. Remover o contato morto da vaga ✅
```
Com a direção única de contato (§16.5), o telefone da empresa não é servido
a ninguém. Remova o código morto:
- o campo contactPhone de JobPost
- o tipo JobPostContact
- o input de contato no formulário de publicar vaga e o texto de ajuda dele
- qualquer referência restante nas fixtures, no mock e nos schemas
O telefone da empresa continua existindo em Company.phone, que é o que o
botão de WhatsApp usa.
```

---

## Demonstração ponta a ponta — A a E

*Sem isso o sócio mostra um painel vazio. Com isso ele candidata no celular e
o candidato aparece no painel do notebook, na frente do cliente.*

### A. Semear candidaturas nas fixtures ✅
```
Nas fixtures, cada vaga aberta deve nascer com 2 a 5 candidaturas de
trabalhadores diferentes, cada uma com shortCode, appliedAt variado e
histórico de presença plausível. Nenhuma vaga pode ficar sem candidato.
```

### B. Seletor de pessoa em modo demonstração ✅
```
Estenda o modo demonstração para o lado do trabalhador. Além de escolher a
empresa, permita escolher "entrar como" um dos trabalhadores das fixtures.
Mesmo mecanismo de cookie do CompanySwitcher. A barra de demonstração passa
a ter os dois seletores. Some no modo live.
```

### C. Navegação por estado ✅
```
A barra de navegação muda conforme quem está logado:
- anônimo: Vagas, Publicar vaga, e "Entrar" discreto
- trabalhador: Vagas, Minhas candidaturas, Perfil
- empresa: Painel, Publicar vaga, Minhas vagas
"Área da empresa" sai do menu público; só existe na barra de demonstração.
Vale para o menu do topo e para a barra inferior no celular.
```

### D. Muro na candidatura ✅
```
Abrir a vaga é livre para qualquer visitante — não coloque muro aí, isso
quebraria a indexação no Google e o compartilhamento por link.

O muro é no botão "Quero essa vaga": se não estiver autenticado como
trabalhador, leve para /cadastro/trabalhador guardando a vaga de origem.
Ao concluir o cadastro, volte para a vaga E registre a candidatura
automaticamente, sem ele precisar tocar de novo.
```

### E. Cadastro do trabalhador, versão mínima ✅
```
Crie /cadastro/trabalhador em versão reduzida: nome, telefone, funções que
faz e bairro. Só isso — é o destino do muro da tarefa D.
As 6 etapas completas ficam para a tarefa 11.
Bloqueie menor de 18 anos.
```

---

### 16.1. Paleta e identidade ✅
```
Vamos definir a identidade visual. Ajuste as variáveis CSS do shadcn em
globals.css para a paleta que eu vou passar, mantendo contraste mínimo de
4.5:1 em todo texto. Não altere marcação de componente, só as variáveis.
```

### 16.2. Revisão antes da demonstração ✅
```
Percorra todas as telas prontas e confira:
- toda a copy contra o vocabulário proibido do CLAUDE.md
- nenhum componente importando de src/mocks/ direto
- nenhum tipo de domínio declarado fora de packages/shared
- estados de carregando, vazio e erro em todas as listas
- tudo funcionando em viewport de 360px
Liste o que encontrou e corrija.
```

## Bloco S — dívida criada pelo modelo de dados (22/08)

*O banco foi projetado e mudou contratos que o front já implementou. Estas tarefas alinham o
que existe com o que ficou decidido. **Fazer antes de mostrar pro sócio** — senão ele testa
uma tela que já está errada e o retorno dele vem contaminado.*

*Ordem obrigatória: S1 primeiro (é contrato), depois o resto.*

### S1. Cidade vira entidade ✅
```
Conforme §7.1 da especificação.

1. packages/shared: novo tipo City { id, name, uf, slug, lat, lng } e
   CityNeighbor { cityId, neighborCityId, distanceKm }.
2. Worker troca city: string por cityId: string, e ganha
   notificationCityIds: string[] e nearbyRadiusKm: 25 | 50 | null.
3. JobPost troca city: string por cityId: string.
4. Company troca city: string por cityId: string.
5. WorkerPublicProfile ganha cityName — o bairro sozinho não diz nada
   quando a pessoa é de outra cidade.
6. Nas fixtures, crie um punhado de cidades reais da região de Poços de
   Caldas com código IBGE e coordenadas, mais os pares de distância entre
   elas. Não invente código IBGE: se não souber, use um TODO explícito.
7. Todo lugar que hoje digita ou compara cidade como texto passa a usar id.
```
**Pronto quando:** não existe mais nenhuma comparação de cidade por string no `apps/web`.

### S2. Data e hora da vaga viram instantes ✅
```
Conforme §7.5 da especificação.

1. JobPost perde date, startTime e endTime, e ganha startsAt e endsAt
   (ISO 8601 UTC).
2. O formulário continua com três campos — data, hora de início e hora de
   fim — e monta os dois instantes no envio, em America/Sao_Paulo.
3. Se a hora de fim for menor que a de início, a vaga termina no dia
   seguinte. Formatura entra 22h e sai 2h: isso é caso normal, não erro.
4. Exibição sempre formatada em America/Sao_Paulo.
5. Atualize fixtures, filtros de listagem e ordenação.
```
**Pronto quando:** existe uma vaga nas fixtures que atravessa a meia-noite e ela exibe, filtra
e ordena certo.

### S3. Referências saem do cadastro ✅
```
Conforme §16.1 da especificação.

1. packages/shared: remova WorkerReference e o campo references de Worker.
2. Remova a etapa de referências do cadastro do trabalhador.
3. Worker ganha termsVersion, termsAcceptedAt e termsAcceptedIp; o aceite
   do termo de uso vira etapa própria.
4. O vídeo passa a ser OPCIONAL e é ele que dá o selo de perfil completo.
   Quem não grava conclui o cadastro e recebe vagas do mesmo jeito.
5. Limite de 5 funções por trabalhador, validado no schema compartilhado.
6. Atualize fixtures e a tela de "o que falta pro perfil completo".
```

### S4. Cidades de aviso no cadastro e no perfil ✅
```
Conforme §7.3 e §16.2 da especificação.

1. Nova etapa no cadastro: "de quais cidades você quer receber aviso?",
   com a cidade dele JÁ MARCADA. Mínimo 1, máximo 5.
2. Na mesma tela, desligado por padrão: "receber também vagas de cidades
   vizinhas", com opção de 25 ou 50 km.
3. Antes de ligar, mostre quantas cidades o raio inclui — "50 km inclui 23
   cidades". O número sai da tabela de vizinhança.
4. A mesma tela existe em "meu perfil", editável.
5. A listagem de vagas abre já filtrada nas cidades dele, com seletor para
   trocar. Nunca abrir mostrando o país inteiro.
6. Candidatar-se NÃO depende de cidade assinada. A candidatura não checa
   cidade nenhuma.
```

### S5. Alcance e transporte na publicação ✅
```
Conforme §7.5 e §16.2 da especificação.

1. JobPost ganha providesTransport: boolean e
   reach: 'unrestricted' | 'nearby' | 'city_only', com reachRadiusKm
   obrigatório e só válido quando reach = 'nearby'.
2. O padrão é 'unrestricted'. Padrão restritivo mata vaga em silêncio.
3. No formulário, ao escolher o alcance, mostre o custo:
   "Só Poços de Caldas: 34 garçons serão avisados. Até 50 km: 121."
4. Na lista de candidatos, exiba a distância e o transporte:
   "João · Caldas · cerca de 24 km · transporte fornecido".
5. Atualize as fixtures.
```

### S6. Contestação deixa de ser status ✅
```
Conforme §7.4 da especificação.

1. AttendanceStatus passa a ser só:
   'pending' | 'not_selected' | 'present' | 'absent'
   O valor 'disputed' deixa de existir — ele apagava a marcação original.
2. AttendanceRecord ganha disputedAt, disputeResolvedAt e
   disputeOutcome: 'upheld' | 'reversed' | null.
3. "Em contestação" passa a ser disputedAt != null && disputeResolvedAt
   == null, e é isso que sai da contagem pública.
4. AttendanceRecord perde expiresAt: é markedAt + 12 meses, calculado na
   leitura.
5. AttendanceSummary ganha hasHistory: boolean. A interface NUNCA
   interpreta zero — quem decide "Novo por aqui" é o servidor.
6. Atualize fixtures e a tela de contestação.
```

### S7. Revisão de copy e contrato depois do bloco S ✅
```
Percorra as telas afetadas pelo bloco S e confira:
- toda a copy nova contra o vocabulário proibido do CLAUDE.md
- nenhum tipo de domínio declarado fora de packages/shared
- nenhuma cidade como texto digitado
- nenhum telefone exibido como texto em lugar nenhum
- estados de carregando, vazio e erro nas telas novas
- tudo em viewport de 360px
Liste o que encontrou e corrija.
```

---

> ## PARE AQUI — você chegou
>
> Front completo, os dois fluxos navegáveis. **Agora é o sócio no celular.**
>
> Mande tarefas, não peça opinião:
> 1. ache uma vaga de garçom pra este fim de semana
> 2. se candidate nela
> 3. troque para empresa e publique uma vaga de cozinheira pra sábado
> 4. veja quem se candidatou
> 5. marque presença de quem foi e "não chamei" nos outros
>
> Em cada uma: quanto tempo levou, **onde você parou pra pensar**, e o que esperava que
> acontecesse e não aconteceu. Hesitação é bug de interface.
>
> Depois do retorno dele: contar os anunciantes recorrentes nos grupos e pré-vender cinco
> assinaturas. As Fases 4 e 5 abaixo só valem com esse retorno na mão.

---

## Bloco do trabalhador — depois da validação

### 11. Cadastro do trabalhador ✅
```
Implemente o cadastro do trabalhador em 6 etapas conforme a seção 16.1 da spec:
nome e CPF, telefone, selfie com documento, perfil, vídeo de 30s e duas referências.
Salve o progresso a cada etapa em localStorage para não perder tudo com queda
de conexão. Bloqueie menor de 18 anos na primeira etapa com mensagem clara.
Por enquanto o upload é simulado.
```

### 13. Login ✅
```
Implemente a tela de entrar por telefone com o fluxo de confirmação por
WhatsApp da seção 11 da spec, ainda mockado: gera o código, mostra o botão
"Confirmar no WhatsApp" e simula a confirmação após 3 segundos.
Inclua o botão "não consegui confirmar", que segue sem verificar.
```

### 17. Marcar presença ✅
```
Implemente a marcação de presença: um clique por candidato, só liberada
depois da data da vaga, sem campo de texto.
Implemente também a contestação pelo trabalhador em até 7 dias.
```

### 18. Minhas candidaturas ✅
```
Implemente a área do trabalhador: minhas candidaturas com a confirmação de
véspera em destaque, e meu perfil mostrando o que falta pro perfil completo.
```

---

## Fase 4 — API real

### 20. Esqueleto da API
```
Monte o esqueleto do Fastify em apps/api: estrutura de rotas, tratamento de
erro no formato ApiResult, CORS liberado só pro domínio do front,
healthcheck e logs.
```

### 21. Autenticação
```
Implemente a autenticação por JWT de 30 dias com refresh silencioso e o
webhook do WhatsApp Cloud API da seção 11 da spec: recebe a mensagem,
confere a assinatura X-Hub-Signature-256, casa o código com o telefone e
marca phoneVerifiedAt. Rate limit por telefone e por IP.
```

### 22. Rotas de domínio
```
Implemente todas as rotas da seção 8 da spec, cumprindo exatamente os
contratos de packages/shared. Validação com os schemas compartilhados.
```

### 23. Trocar o mock pela API
```
Reescreva apps/web/src/lib/api/ para chamar a API real via HTTP quando
NEXT_PUBLIC_API_MODE=live, mantendo as mesmas assinaturas.
Nenhum componente pode mudar.
```
**Se algum componente precisar mudar, a regra de ouro foi violada em algum lugar — investigue antes de seguir.**

---

## Fase 5 — Infra

### 24.0. Esqueleto do `apps/api` — pré-requisito do banco
```
Crie apps/api mínimo: package.json no workspace pnpm, TypeScript strict,
Fastify, Prisma instalado, .env.example com DATABASE_URL apontando pro
Postgres local do WSL na porta 5433, e um healthcheck em /health.
Nenhuma rota de domínio ainda.
O schema.prisma já existe em apps/api/prisma/ — não reescreva, use o que
está lá.
```
**Pronto quando:** `pnpm -F api dev` sobe e `/health` responde.

### 24. Primeira migração e banco local
```
Suba o Postgres local (docker-compose.dev.yml, porta 5433) e rode
./infra/db-setup-local.sh.

O script faz, nesta ordem: prisma migrate dev → carrega os municípios →
calcula a tabela de vizinhança. Ele se recusa a rodar se a DATABASE_URL não
for localhost.

As constraints não são aplicadas por fora: CHECK, chaves compostas, índices
parciais, triggers e views entram no SQL da própria migration. Gere com
prisma migrate dev --create-only, acrescente o SQL no arquivo gerado, e só
então aplique pelo script.
```
**Pronto quando:** o script imprime a contagem de cidades e de pares de vizinhança no fim.

### 24.1. Teste de constraints
```
Crie um teste que roda contra o banco local e falha se alguma constraint
tiver sumido: os CHECK de job_posts e attendance_records, os índices parciais,
os quatro triggers e as duas views.

Motivo: com as constraints dentro das migrations, este teste é a única rede
que sobrou. Há relatos do prisma migrate gerar DROP para objeto criado à mão
que ele não reconhece. Constraint que some é falha silenciosa — o banco
continua aceitando escrita, só parou de proteger.
```

### 24.2. Teste da regra 1
```
Crie um teste no CI que lê apps/api/prisma/schema.prisma e falha se:
- algum model com relação a Worker tiver campo monetário
- algum model com nome contendo payment, charge, invoice ou subscription
  tiver relação com Worker

A regra "trabalhador nunca paga" é uma AUSÊNCIA, e ausência não tem
constraint de banco. Este teste é a única defesa mecânica que ela admite.
```

### 25. MinIO e uploads
```
Implemente o upload por URL pré-assinada no MinIO: bucket docs privado para
a selfie com documento e bucket public para o vídeo.
O arquivo nunca passa pela API. Comprima no cliente antes de enviar.
```

### 26. Push
```
Implemente Web Push com VAPID: service worker próprio, inscrição, e o job
diário de confirmação de véspera às 18h com node-cron.
O prompt de instalação do PWA só aparece depois da primeira candidatura.

O disparo usa a query de roteamento da §16.2 da spec: cidades assinadas OU
raio do trabalhador, cruzado com o alcance definido pela empresa, filtrado
por função e disponibilidade. Inscrição explícita numa cidade vence o
filtro da empresa.

O push de cidade vizinha carrega distância e transporte no texto —
"Caldas · cerca de 24 km · transporte fornecido". Sem isso a pessoa precisa
abrir o app pra saber se vale, e é essa fricção que faz desligar
notificação.

Meta: menos de 60 segundos entre publicar e o primeiro push chegar. O
gargalo é o fan-out HTTP, não o banco — invista em paralelismo e retry.
```

### 27. Contêineres
```
Crie os Dockerfiles multi-stage de web e api, o docker-compose com postgres
e minio sem porta pública, a configuração do nginx com os três subdomínios,
e o script de backup do Postgres.
```

### 28. Primeiro deploy
```
Me guie no primeiro deploy: o que configurar no VPS, ordem dos comandos,
DNS, certificado e como conferir que subiu.
```

---

### 29. Assinatura no Asaas
```
Conforme §20 da especificação.

Cadastro cria a empresa em trialing com 30 dias. Cobrança mensal a partir
do segundo mês, vagas ilimitadas. Falha de pagamento suspende publicar vaga
nova, mas NÃO derruba vaga já aberta.

Duas regras que não podem ser negociadas na implementação:
1. O status da assinatura vem do webhook POST /v1/webhooks/asaas, NUNCA do
   retorno do navegador. Webhook idempotente — o mesmo evento chega mais de
   uma vez.
2. Checkout transparente usa a tokenização do Asaas: o número do cartão
   nunca toca no nosso servidor, no nosso log nem no nosso banco.

Avalie Pix Automático antes de assumir cartão: o cliente é buffet pequeno e
muitos não têm cartão de PJ.

A cobrança referencia Company. Nunca Worker.
```

---

## Depois

Domínio próprio · anúncio destacado avulso · painel de denúncias · contratante pessoa física
(v2.0, o campo `documentType` já aceita `cpf`)
