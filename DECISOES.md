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
