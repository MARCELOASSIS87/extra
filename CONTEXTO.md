# Extraqui — Contexto completo do projeto

*Briefing para retomar o projeto em qualquer conversa nova, sem reexplicar nada.*
*Última atualização: 22/08/2026, depois da sessão de modelagem do banco.*

---

## Como usar este documento

Os outros documentos dizem **o quê**. Este diz **por quê** — e é o porquê que evita desfazer
decisão boa por engano seis semanas depois.

| Documento | Serve para |
|---|---|
| `CLAUDE.md` | regras invioláveis e convenções, lido em toda tarefa |
| `ESPECIFICACAO-TECNICA.md` | arquitetura, contratos, fluxos — detalhe sob demanda |
| `MODELO-NEGOCIO.md` | regras de negócio. **Prevalece em caso de conflito** |
| `TAREFAS.md` | backlog com prompts prontos e o que já foi feito |
| `DECISOES.md` | log datado de decisões técnicas, com o que foi descartado |
| **`CONTEXTO.md`** (este) | história, raciocínio do negócio e o que está em aberto |

Os nomes dos documentos **não carregam versão**. A versão vive na primeira linha de dentro de
cada um. Nome versionado fazia o ponteiro do `CLAUDE.md` apodrecer a cada revisão — e ponteiro
quebrado não dá erro: a tarefa roda sem contexto, em silêncio. Já aconteceu uma vez.

Só `CLAUDE.md`, `ESPECIFICACAO-TECNICA.md` e `MODELO-NEGOCIO.md` são citados na linha "leia
também". `CONTEXTO.md` e `DECISOES.md` ficam no repo por versionamento e backup, sem custar
contexto em toda sessão.

---

## 1. O negócio em uma página

Em Poços de Caldas–MG existem sete grupos de WhatsApp com centenas a milhares de pessoas
cada. Neles, empresas anunciam trabalho extra — "preciso de garçom para formatura sábado,
R$ 150", "cozinheira para domingo", "auxiliar de limpeza fim de semana". Trabalho informal,
sem registro, resolvido no grito.

O problema **não** é falta de vaga nem falta de gente. É **roteamento**: a mensagem se perde
entre corrente de bom dia e áudio de quatro minutos. O buffet posta às 22h de sexta e reza.
O garçom que queria aquele bico não viu.

**O Extraqui é um classificado que resolve o roteamento.** A empresa publica e paga
assinatura mensal. O trabalhador se cadastra de graça e recebe notificação das vagas da
função e região dele. As duas partes se acertam fora da plataforma.

Frase que resume e vale como título da home:

> **O trabalho existe. O que falta é organização.**

**Teto realista:** R$ 3.000 a 5.000 por mês, divididos entre dois sócios. É um bom negócio
paralelo e um startup ruim — a vantagem competitiva é um grupo de WhatsApp de uma cidade, e
isso não se replica em Sorocaba. A decisão foi consciente.

---

## 2. Quem é quem

**Marcelo** — desenvolvedor. Faz tudo: código, infraestrutura, servidor. Perfil hands-on,
gosta de fazer "no braço", usa VPS próprio com contêineres, WSL no Windows.

**O sócio** — dono dos grupos de WhatsApp, garçom de profissão. É a distribuição inteira do
negócio e é quem vai vender. Sociedade 50/50, a formalizar em contrato antes do lançamento.
Testa o produto antes de sair vendendo: é o usuário real de um lado e conhece o comprador do
outro.

**Divisão:** Marcelo constrói, o sócio vende. O gargalo do negócio é venda, não código —
vender 30 assinaturas mensais para donos de buffet é mais trabalho que escrever o sistema.

---

## 3. Estado do projeto

Front-end completo rodando contra mock, sem backend nenhum. Fluxo da empresa e do
trabalhador navegáveis.

Em 22/08/2026 o **modelo de dados foi projetado e escrito** — `schema.prisma`,
`constraints.sql`, seed de municípios e scripts de migração. Nada foi executado ainda: nenhuma
migration rodou e `apps/api` ainda não existe.

Essa sessão também mudou contratos que o front já implementou (referências, formato de data da
vaga, cidade como entidade, contestação). O `TAREFAS.md` tem o bloco de correções que isso
gerou.

> **A regra do PARE continua valendo, e vale reler.** Este documento diz que a API, o banco e
> o Docker só valem o esforço quando voltarem cinco "topo testar" de gente de verdade.
> Projetar o banco é barato — é documento. **Construir o `apps/api` e rodar migration é começar
> a Fase 4/5**, que é exatamente o que estava adiado. Se for decisão consciente, tudo bem. Só
> não deve passar sem alguém reparar.

Domínios comprados: `extraqui.com.br` (principal) e `extraki.com.br` (redireciona para o
principal, pega quem digita errado).

---

## 4. Modelo de receita — o que foi testado e descartado

| Modelo | Veredito |
|---|---|
| **Assinatura da empresa, R$ 149/mês** | **escolhido.** Recorrente, cobra do lado escasso e com caixa, e melhora quando o produto melhora |
| Anúncio destacado avulso, R$ 15–25 | complementar, porta de entrada para quem não assina |
| Publicidade (AdSense) | **descartado.** ~R$ 300 a 900/mês com esse tráfego, e o incentivo é oposto ao do produto: publicidade paga por tempo de tela, e um bom classificado resolve em 40 segundos. Além disso, quem compra esse público é consignado e aposta — seria monetizar o desespero dos próprios usuários |
| Cobrar do trabalhador | **descartado, e é regra inviolável.** Reduz a oferta, que é o que faz a empresa pagar; filtra para fora justamente quem mais precisa; e há decisões (TRT-4 entre outras) tratando cobrança de candidato por acesso a vagas como abusiva. **Voltou à mesa em 22/08** como plano para quando a plataforma escalar — R$ 20/mês por receber aviso — e foi recusado de novo: é justamente esse fato que faz um juiz enxergar agência de emprego no lugar de classificado. E no cenário em que seria possível cobrar, a receita das empresas tornaria a cobrança desnecessária |
| Comissão sobre o bico | **descartado.** Vira arranjo de pagamento (regulação do BCB), coloca a plataforma na cadeia de consumo e aproxima do vínculo |

**A lógica que decide tudo:** numa plataforma de dois lados, cobra-se do lado **escasso e com
dinheiro**. Trabalhador de bico é abundante — e vai ficar mais ainda se a PEC do fim da escala
6x1 passar (aprovada na Câmara em dois turnos, passou na CCJ do Senado, em discussão no
plenário em agosto de 2026). Empresa que contrata toda semana é escassa e tem caixa.

---

## 5. As travas jurídicas e a razão de cada uma

O modelo de defesa se apoia em quatro pernas: **não pagamos ninguém, não escolhemos ninguém,
não cobramos do trabalhador e não punimos ninguém.** Enquanto isso for verdade, o Extraqui é
um classificado — ninguém processa a OLX pelo sofá que veio quebrado.

### Por que cada regra existe

**Trabalhador nunca paga.** Vínculo empregatício exige onerosidade — o trabalhador precisa
receber *da plataforma*. Se o dinheiro nunca passa por nós, não há salário e não há
empregador. É por isso que Catho e OLX nunca enfrentaram o que a Uber enfrenta. O Tema 1291
do STF (vínculo em plataformas) segue sem tese fixada — retomado em junho de 2026 sem
julgamento concluído. Insegurança jurídica é o cenário, não a exceção.

**Não punimos trabalhador.** Poder disciplinar é o que caracteriza patrão, e é exatamente o
critério de "subordinação algorítmica" que o STF está julgando. Desligamento automático por
falta seria entregar o argumento de graça.

**Não garantimos nada.** No dia em que o site diz "profissional verificado", deixamos de ser
mural e viramos porteiro — e porteiro responde por quem deixou entrar. O STF, ao julgar o
art. 19 do Marco Civil (jun/2025), foi explícito: marketplace responde pelo CDC, não pelo
Marco Civil. Uma indenização de R$ 15 mil apaga oito anos de assinatura de um cliente.
Daí a regra do vocabulário: **identificar é fato, aprovar é promessa.**

**Sem antecedentes criminais.** 99 e Uber exigem porque a **lei obriga** (Lei 12.587/2012,
art. 11-B, incluído pela Lei 13.640/2018) — e quem cumpre dever legal tem defesa pronta.
Fazer por conta própria é assumir dever que ninguém impôs. E o TST fixou tese em recurso
repetitivo (IRR Tema 1): exigir certidão fora das hipóteses justificadas gera dano moral
*in re ipsa*. Garçom, cozinheiro e auxiliar de limpeza de evento não estão nas hipóteses.

**Sem reservista.** Só existe para homem de 18 a 45 anos — excluiria 100% das mulheres, que
são a maior parte da oferta (cozinheira, diarista, auxiliar de limpeza). Discriminação por
sexo e idade escancarada.

**Sem texto livre em avaliação.** Comentário é o que gera ação por dano moral. Registro
binário de presença é fato verificável, não juízo de valor.

**Bloqueio de menores de 18.** ECA Digital (Lei 15.211/2025), em vigor desde 17/03/2026.
Multa de até 10% do faturamento, limitada a R$ 50 milhões por infração.

**Filtro de linguagem discriminatória.** Art. 373-A da CLT. Os anúncios dos grupos hoje estão
cheios de "moça", "boa aparência", "até 30 anos". No WhatsApp isso evapora; numa plataforma
fica arquivado e indexado, e é o tipo de caso que o MPT resolve sozinho.

### O risco que quase ninguém enxerga

Os grupos funcionam hoje porque são **invisíveis e efêmeros**. A plataforma é uma **máquina de
produzir prova**: cada anúncio, cada match, cada pagamento vira registro permanente e passível
de intimação. Esse é o maior salto de risco do projeto, e não tem a ver com nenhum artigo de
lei específico — tem a ver com *descobribilidade*. É por isso que a disciplina de copy e as
travas de produto importam tanto.

### O que compra o sono

Não é a lei, é a **documentação**: termos de uso claros, log de tudo, canal de denúncia com
remoção registrada, e a disciplina de nunca escrever "profissional verificado" num story
empolgado de sexta-feira. E uma revisão dos termos por advogado, uma vez, antes do
lançamento — R$ 1.500 a 3.000.

---

## 6. Os mecanismos de produto e o porquê

**Cadastro em etapas (~8 minutos).** A fricção é intencional e é de **esforço**, nunca de
dinheiro nem de passado. Ficha criminal não prevê se a pessoa aparece no sábado; disposição
de fazer coisa chata direito prevê. Quem não gasta 8 minutos por uma vaga de R$ 150 também
não levanta às 6h. **É hipótese, não dogma:** se a conclusão ficar abaixo de 40%, o vídeo é o
primeiro a cair — e por isso ele já nasceu **opcional**, com o selo de perfil completo pendurado
nele. Assim a queda vira ajuste de copy, não migração.

**As duas referências saíram (22/08).** Não apareciam em tela nenhuma: eram nome e telefone de
duas pessoas que nunca se cadastraram, nunca aceitaram termo e não eram lidas por ninguém.
E a pessoa escolhe quem indica, então aquilo não provava nada. Virou regra geral: **campo
declarado pela própria pessoa nunca é garantia, só informação** — o mesmo raciocínio que
derrubou guardar endereço completo.

**Histórico de presença sem nota.** Substitui estrelas. Sanção vem do mercado (quem falta para
de ser chamado), não da plataforma. Contestável em 7 dias, expira em 12 meses. Contestar **não
apaga a marcação da empresa**: as duas informações são guardadas separadas, senão não há como
resolver a contestação depois.

**"Novo por aqui" em vez de "0 presenças".** Reputação sem rampa de entrada tranca o novato
para sempre: não é chamado porque não tem histórico, não tem histórico porque não é chamado.
`0 presenças` lê como ruim, não como neutro. O selo de perfil completo é a reputação
substituta de quem chegou agora.

**Três desfechos na marcação, não dois.** Uma vaga de seis recebe até dezoito candidatos; a
empresa chama poucos. Os demais **não faltaram — não foram chamados**. Sem o desfecho neutro,
ou o painel entope de pendências ou a empresa marca falta para limpar a lista, destruindo a
reputação de quem não fez nada.

**Contato só depois da candidatura, e só a empresa inicia.** Se o telefone aparecesse na
página, o trabalhador mandaria mensagem direto e a plataforma não registraria nada — sem
candidatura, sem dado, sem produto. E seria convite a raspagem. A direção única protege o
cliente pagante: uma vaga de seis geraria dezoito mensagens de desconhecidos, e ele
cancelaria. Além disso, hoje no grupo o número dele fica exposto a milhares — aqui não
aparece para ninguém, o que é **argumento de venda**.

**Telefone nunca como texto.** Sempre atrás de botão. Número escrito na tela é número colado
no grupo.

**"Você já contratou João 3 vezes".** Dado da própria empresa, factual, risco zero. Para
buffet que chama sempre a mesma turma, é a informação mais útil da tela.

**Fricção explícita, nunca gesto implícito.** A faixa de chips com rolagem horizontal foi
substituída por filtro com lista, porque a mãe do Marcelo (60 anos) não descobriu que
arrastava. O público é muito variado — o que é óbvio para quem usa app o dia todo não é
óbvio para quem não usa.

**Duas superfícies visuais.** Landing escura com neon e tipografia grande; app claro. Motivo
técnico: o lime tem 13:1 sobre preto e 1,51:1 sobre branco. Motivo prático: tela escura ao sol
é pior, não melhor — o reflexo domina. O trabalhador está na rua, em Android de entrada.

---

## 7. Decisões técnicas e o porquê

**Outside-in (telas primeiro, banco por último), com contratos definidos antes.** O risco do
projeto está na experiência, não na complexidade técnica. E com as telas prontas o sócio vende
com print na mão. O antídoto contra o front-first bagunçado é definir os tipos antes: o
backend nasce obrigado a cumprir contrato já validado na prática.

**Regra de ouro:** nenhum componente importa de `src/mocks/` — tudo por `src/lib/api/`.
Já foi violada uma vez (uma camada paralela em localStorage) e o sintoma apareceu na hora:
vaga publicada aparecia numa tela e não em outra. Foi desfeita; o mock virou mutável dentro
do lugar certo.

**Backend separado (Fastify) em vez de Next full-stack.** Justificado pela decisão de ter app
nativo depois — a API serve web e app com o mesmo contrato. O preço é pago pelo
`packages/shared`, que impede os tipos de duplicarem.

**Custo de infraestrutura R$ 0.** VPS Hostinger próprio, tudo em contêiner, MinIO no lugar de
storage pago, nginx com certbot, Web Push gratuito. O único ponto onde custo zero doeu foi o
OTP — resolvido com um truque: **OTP invertido**. Enviar código pelo WhatsApp custa
US$ 0,0068, mas conversa iniciada pelo usuário é gratuita e ilimitada desde nov/2024. Então
o usuário manda o código via `wa.me`, o webhook recebe com o número validado pela própria
Meta, e custa zero. É mais forte que SMS e funciona em número que só tem WhatsApp.

**Dois bancos, sempre.** `prisma migrate dev` só no Postgres local; `migrate deploy` no VPS,
na mão, com `pg_dump` antes. `migrate dev` reseta o banco quando detecta divergência — com
CPF e selfie de trezentas pessoas dentro, isso é incidente de LGPD, não perda de seed.

**Dívida registrada:** em modo mock todas as rotas renderizam sob demanda. Ao ligar o modo
live, `/vagas/[cidade]/[slug]` **precisa** voltar a ser estática ou ISR — é a página que o
Google indexa, e indexação é a única aquisição gratuita do projeto.

### Decisões do modelo de dados (22/08) — resumo, detalhe em `DECISOES.md`

**Cidade virou entidade, não texto.** Com código IBGE, UF, slug e coordenadas. Como string,
viraria "Poços de Caldas", "Pocos", "POÇOS" no mesmo banco — quatro cidades para o Postgres, e
o roteamento erraria **em silêncio**: nada quebra, a vaga só não chega em ninguém. Cada cidade
ganhou URL própria, indexada em separado.

**Notificação virou escolha explícita.** O trabalhador assina de 1 a 5 cidades e pode ligar um
raio de 25 ou 50 km em torno de onde mora. A empresa pode estreitar o alcance do anúncio, mas
**só estreitar** — o opt-in do trabalhador é o teto. Ver e se candidatar não depende de nada
disso. Foi desenho do Marcelo, e melhor que a proposta anterior de raio fixo, porque separa
"receber aviso" de "poder se candidatar".

**Telefone saiu de `Worker` e foi para `Account`.** Não se vaza coluna que não existe na
tabela: a regra "contato nunca em payload público" deixou de depender de alguém lembrar de
escrever o `select` certo.

**Metade das garantias do banco não está no `schema.prisma`.** `CHECK`, trigger, índice parcial
e chave composta não existem no Prisma — vivem em `infra/sql/constraints.sql`, que precisa ser
reaplicado depois de cada migration. Constraint que some é falha silenciosa: o banco continua
aceitando escrita, só parou de proteger.

**Vizinhança entre municípios é tabela pré-calculada**, não PostGIS nem `earthdistance`. Está
na query mais quente do produto, e município não muda de lugar.

---

## 8. Como trabalhar com o Marcelo

- Direto e duro. Contrarie quando for o caso; ele pediu isso explicitamente e responde bem
- Ele acha buracos de verdade olhando tela — o contato exposto, o histórico faltando, o
  desfecho neutro, o card sem informação vieram todos dele. Leve a sério
- Ele testa com gente real (a mãe, o sócio) e traz dado, não opinião. Isso vale mais que
  teoria de design
- Fala por áudio transcrito: o texto chega truncado e com palavras trocadas. Peça
  confirmação quando o sentido mudar, mas não trave por causa disso
- **Prosa na conversa, imperativo no prompt.** Ele copia e cola no Claude Code, e elogio ou
  contexto no meio do prompt vira ruído que o agente tenta resolver
- Não repita cobrança. Se um ponto já foi levantado duas vezes e ele não agiu, é escolha dele

---

## 9. Como trabalhar com o Claude Code neste projeto

**Modelo por tipo de tarefa.** Sonnet para telas — rápido e suficiente. Opus quando mexer em
fluxo de dados, contrato ou arquitetura: o Sonnet resolve o pedido literal pelo caminho mais
curto, sem perguntar se cabe na arquitetura, e foi assim que nasceu a camada paralela.

**O `CLAUDE.md` só é lido no início da sessão.** Alterou o arquivo? `/clear` antes de rodar a
próxima tarefa, senão as regras novas não valem.

**O bloco "Ritmo de trabalho" existe porque a verificação estava custando 10 minutos por
tarefa** — subia servidor, abria navegador, media contraste, rodava build. Quem verifica é o
Marcelo, olhando. Exceção: mudança que mexe em fronteira cliente/servidor merece um `pnpm
build`, porque é a classe de erro que o typecheck não pega.

**Prompts fechados rendem mais.** Dizer quais arquivos tocar evita exploração cara. E quando
a tarefa mexer em dados, incluir a frase *"não crie camada de dados nova, use `src/lib/api/`"*.

**Uma tarefa por conversa não é regra.** Tarefas vizinhas (telas que compartilham componente)
rendem mais juntas. Comece do zero ao mudar de fase, depois de uma tarefa que deu errado, ou
quando aparecer aviso de compactação.

---

## 10. O que ainda NÃO foi validado

Três premissas sustentam o projeto inteiro e nenhuma foi verificada:

**Quantas empresas repetem anúncio nos grupos.** A convicção de que "as empresas vão pagar" é
leitura de mercado dos sócios, não dado coletado. A diferença entre 8 e 40 empresas
recorrentes é a diferença entre R$ 1.200 e R$ 6.000 por mês. Custa uma hora de rolagem nos
grupos: quantas vagas por semana, quantos anunciantes distintos, **quantos repetem**.

**O preço.** R$ 149/mês é chute fundamentado. Só se descobre dizendo o número em voz alta
para dez donos de buffet.

**A fricção de 8 minutos no cadastro.** Pode filtrar o desleixado ou pode matar a oferta.
Medir "cadastros iniciados vs. completos" desde o primeiro dia.

E uma quarta, mais delicada: **o contrato de sociedade ainda não foi assinado.** Toda a
distribuição do negócio pertence a outra pessoa, hoje num acordo verbal entre amigos. Isso
precisa estar no papel antes de existir dinheiro em jogo — não por desconfiança, mas para
nunca precisar confiar em memória depois.

---

## 11. O que vem depois

1. Aplicar as correções que o modelo de dados gerou no front (bloco S no `TAREFAS.md`) — o
   cadastro ainda pede referências, a vaga ainda usa data e hora separadas, a cidade ainda é
   texto digitado
2. **PARE.** O sócio testa no celular, com roteiro de tarefas (não peça opinião — peça que
   ele execute cinco tarefas e conte onde travou; hesitação é bug de interface)
3. Ajustar com o retorno dele
4. O sócio sai vendendo: contar os anunciantes recorrentes e pré-vender cinco assinaturas
5. Se voltarem cinco "topo testar": API, Postgres, MinIO, Web Push, Docker, deploy
6. Se não voltarem: descobriram de graça, em vez de depois de erguer a infraestrutura toda

O passo 4 continua sendo o mais importante e o mais adiado do projeto. Contar quantas empresas
repetem anúncio nos grupos custa **uma hora de rolagem** e decide se o resto vale o esforço.
Nenhuma linha de código responde essa pergunta.

---

## Fontes jurídicas consultadas

- [STF — tese sobre responsabilização de plataformas, art. 19 do Marco Civil (jun/2025)](https://www.migalhas.com.br/quentes/433462/stf-redes-respondem-por-posts-mesmo-sem-ordem-judicial-veja-tese)
- [STF muda regime de responsabilização das plataformas (Machado Meyer)](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/stf-muda-regime-de-responsabilizacao-das-plataformas)
- [ECA Digital (Lei 15.211/2025), em vigor desde 17/03/2026](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/estatuto-digital-da-crianca-e-do-adolescente-lei-n-15-211-2025-entra-em-vigor-em-17-de-marco-de-2026)
- [TST — IRR Tema 1, exigência de antecedentes criminais](https://www.trt6.jus.br/portal/jurisprudencia/temas-e-precedentes/14444)
- [Lei 12.587/2012, art. 11-B (Lei do Uber)](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13640.htm)
- [STF — Tema 1291, vínculo em plataformas, sem tese fixada](https://conjur.com.br/2026-jun-24/stf-retoma-nesta-quarta-24-julgamento-sobre-vinculo-empregaticio-entre-motoristas-e-aplicativos-2/)
- [Agência de emprego não pode cobrar por acesso a banco de vagas (TRT-4)](https://www.migalhas.com.br/quentes/339370/agencia-de-emprego-nao-pode-cobrar-por-acesso-a-banco-de-vagas)
- [Câmara aprova fim da escala 6x1](https://www.camara.leg.br/noticias/1277141-camara-aprova-em-dois-turnos-fim-da-escala-6x1-com-jornada-maxima-de-40-horas-semanais/)
