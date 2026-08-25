# Decisões do Extraqui

*Registro cronológico. Uma entrada por decisão, com o motivo e o que foi descartado.*
*O detalhe vive na `ESPECIFICACAO-TECNICA.md`; aqui fica só o porquê e a data.*

Este arquivo não é lido automaticamente por ninguém. Ele existe para responder, daqui a seis
meses, a pergunta "por que isso está assim?" — antes que alguém desfaça uma decisão boa por
não saber que ela foi tomada de propósito.

---

## 2026-08-22 — Modelo de dados

### Rota de contato invertida

`GET /v1/jobs/:id/contact [trabalhador]` e o tipo `JobPostContact` foram **apagados**.
Entregavam ao trabalhador o telefone da empresa — exatamente o que a regra 9 proíbe. E
`contactPhone` não era lido por ninguém: quem clica em "Falar no WhatsApp" é a empresa, e o
link aponta para o número do trabalhador. Dado sem leitor só gera risco.

No lugar: `GET /v1/applications/:id/contact [empresa]`, com 403 se a empresa não for dona da
vaga. O pedido é o ato de escolher, e grava `contactedAt`.

### Referências saíram do cadastro

`WorkerReference` era coletada na etapa 6 e não aparecia em tela nenhuma — nem no perfil
público, nem em rota da API. Eram nome e telefone de duas pessoas que nunca se cadastraram,
nunca aceitaram termo e não eram lidas por ninguém.

Motivo do corte, do Marcelo: **a pessoa escolhe quem indica, então aquilo não prova nada** e
pode ser telefone inventado. Virou regra geral: *campo declarado pela própria pessoa nunca é
garantia, só informação.*

**Descartado:** exibir as referências à empresa depois do contato (exigiria mais uma tela) e
manter só nome sem telefone (não resolve o problema de fundo, que é não haver leitor).

### Endereço do trabalhador: só cidade e bairro

Proposta original era guardar endereço completo para fornecer à empresa em caso de problema.
Derrubada por três motivos: endereço é auto-declarado, e quem vai causar problema digita
endereço falso; o CPF já identifica sob ordem judicial, em base atualizada; e fornecer dado
direto a empresa privada é decisão — e responsabilidade — da plataforma, quando o caminho é
ordem judicial dirigida a ela.

O `MODELO-NEGOCIO.md` §10 já dizia "não pedir endereço residencial" desde agosto. A decisão só
confirmou o que já estava escrito.

### Vaga atravessa a meia-noite

`date` + `startTime` + `endTime` viraram `startsAt` / `endsAt` em timestamptz. Formatura entra
às 22h e sai às 2h: com três campos separados a duração dá negativo e a expiração erra o dia.
O formulário continua com três campos; o contrato, não.

### Contestação virou dimensão separada

Na v2.1 o valor `'disputed'` morava em `AttendanceStatus` e **destruía a marcação original** —
contestada uma falta, não havia como saber que era falta, nem para onde voltar depois de
resolver. Agora `status` guarda só o que a empresa marcou, e a contestação vive em
`disputedAt` / `disputeResolvedAt` / `disputeOutcome`.

### Entidade `Account`, separada de `Worker` e `Company`

O telefone é credencial, não atributo de perfil. Morando em `Account`, `Worker` não tem coluna
de telefone — e a regra "contato nunca em payload público" deixa de depender de alguém lembrar
de escrever o `select` certo. Não se vaza coluna que não existe na tabela.

Uma conta pode vir a ter os dois perfis. Não foi criada a constraint que proíbe: permitir agora
custa zero, permitir depois custa migração com gente cadastrada.

### Cidade virou entidade, não texto livre

`City` com código IBGE, UF, slug e coordenadas. Cidade como string vira "Poços de Caldas",
"Pocos de Caldas", "POÇOS" e "poços" no mesmo banco — quatro cidades diferentes para o
Postgres, e o roteamento erra **em silêncio**: nada quebra, a vaga só não chega em ninguém.

Cada cidade ganhou URL própria (`/vagas/[cidade]`), indexada em separado. Barato agora, caro
depois: trocar URL indexada joga fora a indexação já conquistada.

### Notificação por cidades escolhidas + raio opcional

O trabalhador assina de 1 a 5 cidades (a dele já vem marcada) e pode ligar um raio de 25 ou
50 km **em torno da cidade onde mora** — nunca em torno de cada uma das cinco, o que viraria
meio estado.

Ver e se candidatar não depende disso: a lista tem seletor de cidade e a candidatura não checa
nada. Desenho do Marcelo, e melhor que a proposta anterior (raio fixo de 50 km para todo
mundo), porque separa "receber aviso" de "poder se candidatar" e devolve a decisão à pessoa.

**Descartado:** PostGIS e a extensão `earthdistance`. A vizinhança está na query mais quente do
produto e município não muda de lugar — virou tabela pré-calculada (`city_neighbors`, pares até
100 km), gerada uma vez.

### Alcance da vaga, definido pela empresa

Ideia do sócio. Uma cidade de dez mil habitantes com festa popular não preenche seis vagas
sozinha; um contratante numa capital não vai querer gente a duas horas de distância.

Duas travas tornam o campo seguro: **só estreita, nunca amplia** (o opt-in do trabalhador é o
teto, então o campo dispensa limite), e **inscrição explícita vence o filtro da empresa** —
quem assinou aquela cidade na mão declarou que trabalha lá.

Padrão é o mais aberto (`unrestricted`), porque padrão restritivo mata vaga em silêncio.

### Exclusão de conta apaga o histórico de presença

Não anonimiza. Guardar registro de falta de quem pediu para sair é material de ação, e não
serve para nada porque o perfil deixou de existir. Candidaturas ficam anonimizadas — a empresa
tem interesse legítimo em saber quantas candidaturas a vaga dela teve.

### Vídeo opcional, e é ele que dá o selo

Antes, o selo de perfil completo exigia as 6 etapas. Agora quem não grava se cadastra e recebe
vagas do mesmo jeito, só não exibe o selo. Protege o funil: se a conclusão cair, o ajuste é de
copy, não de migração.

### Termo de uso é dado de primeira classe

Versão aceita, data e IP. Não estava em nenhum tipo antes. É a prova de consentimento de que a
defesa depende.

### Assinatura pelo Asaas

Primeiro mês grátis, vagas ilimitadas. Suspensão por falta de pagamento impede publicar vaga
nova mas **não derruba vaga aberta** — derrubar puniria quem já se candidatou.

Duas regras de integração: o status vem do **webhook**, nunca do retorno do navegador (senão
basta abrir a URL de sucesso para ganhar assinatura); e o cartão usa tokenização, para o número
nunca tocar no servidor. A avaliar: Pix Automático — o cliente é buffet pequeno, e muitos não
têm cartão de PJ.

---

## 2026-08-24 — Banco

### Constraints migraram para dentro das migrations

**Sintoma:** `prisma migrate dev` passou a anunciar drift em toda execução e a exigir reset do
banco antes de fazer qualquer coisa — mesmo sem ninguém ter tocado no `schema.prisma`. Num
banco de desenvolvimento isso custa a recarga dos municípios e o recálculo da vizinhança; a
tentação de resolver com um reset por dia é o que assusta.

**Causa:** o `infra/sql/constraints.sql` era aplicado *depois* de cada migration, por fora do
histórico. Funciona para o que o Prisma ignora — CHECK, trigger, view, índice parcial —, mas as
chaves estrangeiras compostas de `attendance_records` são objetos que ele **modela**. Existindo
no banco sem estar em migration nenhuma, ele as lê como divergência e quer desfazê-las. A
metade da defesa que vivia fora do histórico era exatamente a metade que ele sabia derrubar.

**Correção:** todo CHECK, chave composta, índice parcial, trigger e view entra no SQL da
migration que o introduz — `prisma migrate dev --create-only`, o SQL acrescentado à mão no
arquivo gerado, e só então aplicado. O `constraints.reference.sql` continua no repositório como
catálogo do que existe e por quê; ninguém o executa. A rede que sobrou é o teste que roda
contra o banco e falha se alguma constraint sumiu (tarefa 24.1), e ele ficou mais importante do
que era. Incompleta: ver a entrada de 25/08 — chave composta o Prisma apaga, e as colunas foram
eliminadas.

**Descartado:** `prisma migrate diff --from-migrations`, que gera o SQL da diferença e permite
aplicar com `migrate deploy` sem reset. Resolve o sintoma daquela vez e deixa a causa de pé —
os objetos continuam fora do histórico, e o próximo `migrate dev` reclama de novo. Contornar um
aviso que está certo é como se descobre, meses depois, que a constraint sumiu.

---

## 2026-08-25 — Banco

### Chave estrangeira não se contrabandeia por SQL

Segundo achado do mesmo problema, e o que completa a entrada de 24/08: pôr o SQL dentro da
migration resolve para o que o Prisma **ignora**, não para tudo.

**Sintoma:** com as constraints já dentro da migration inicial, o `db-setup-local.sh` aplicou
tudo — e o Prisma, na mesma execução, **criou e aplicou uma segunda migration sozinho**, com
três linhas e nada mais: `DROP CONSTRAINT` para as três chaves compostas de
`attendance_records`. Os 10 CHECK, os índices parciais, os quatro triggers e as duas views não
foram tocados.

**Causa:** chave estrangeira é objeto que ele **modela**, e o que ele modela ele reconcilia
contra o `schema.prisma` — não contra o histórico de migrations. Estar dentro da migration não
protege nada: ele encontra no banco uma FK que o datamodel não declara e a desfaz. A entrada de
24/08 tratou "dentro da migration" como suficiente para todos os objetos; é suficiente só para
os que ele não enxerga.

**Correção:** apagar as colunas em vez de declarar relação falsa. `worker_id`, `company_id` e
`job_post_id` saíram de `attendance_records` — eram cópias do que a candidatura já diz, e a
única razão das chaves compostas era impedir que envelhecessem. Sem a cópia, não há o que
proteger. Os três ids continuam no contrato de `packages/shared`, agora derivados por join a
partir de `applicationId`, no mesmo espírito do `maxApplications`. A view
`worker_attendance_summary` passou a chegar ao trabalhador por `applications` e à empresa por
`applications → job_posts`. Depois disso, `migrate dev` responde "Already in sync" com uma
única migration no histórico.

**Descartado:** declarar as três FKs compostas no `schema.prisma`. Foi testado e o
`prisma validate` aceita — mas cobra caro: duas relações de `AttendanceRecord` para a mesma
linha de `Application`, que não significam nada no domínio e alguém vai ter de decifrar, mais
dois índices únicos redundantes na tabela, já que `application_id` sozinho já é único. Tudo
isso para proteger um dado que não precisava existir. Quando a defesa custa mais que o dado
defendido, o dado é que está sobrando.

---

## Recusado

### Cobrar do trabalhador quando a plataforma escalar

Levantado como plano de futuro ("quando tiver 150 mil candidatos e 20 mil empresas, R$ 20 por
mês para receber os avisos"). Nenhuma preparação foi modelada, conforme a regra 1.

O que mantém a plataforma como **classificado**, e fora da categoria **agência de emprego**, é
o trabalhador não pagar. Há decisão do TRT-RS de que agência de emprego não pode cobrar por
acesso a banco de vagas, e ação no TST sobre taxa de inscrição. Cobrar do candidato é
exatamente o fato que muda o enquadramento.

Além disso: no cenário em que seria possível cobrar, a receita do lado das empresas tornaria a
cobrança desnecessária — e teriam sido anos prometendo "grátis para sempre" a quem ganha R$ 150
por bico.

Se voltar ao assunto, é decisão de negócio com advogado na mesa. Nunca um campo que aparece no
schema.

---

## Aberto

- Prazo de retenção dos registros de moderação e prazo de resposta ao titular — revisão
  jurídica antes do lançamento. Não chutar.
- Premissas não validadas (`MODELO-NEGOCIO.md` §14): quantas empresas repetem nos grupos, o
  preço de R$ 149, e o contrato de sociedade não assinado.
- CPF e data de nascimento ficaram na tabela `workers`, protegidos pela view
  `worker_public_profiles`, e não numa tabela 1:1 separada. É proteção por view em vez de por
  topologia: se alguém consultar `workers` direto numa rota de empresa, vaza. A versão mais
  rígida ainda cabe.
