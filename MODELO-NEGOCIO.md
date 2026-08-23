# Extraqui — Modelo de Negócio v2.1

*Consolida as decisões até 22/08/2026. Substitui a v2.*

> **Este documento prevalece em caso de conflito com a especificação técnica.** Por isso ele
> precisa ser corrigido junto com ela: um trecho velho aqui derruba uma decisão nova de lá, e
> ninguém percebe. Foi o que motivou a v2.1 — cinco pontos abaixo estavam contradizendo
> decisões já implementadas no banco.

**O que mudou na v2.1:** cadastro sem referências e com vídeo opcional (§4) · vaga não tem
campo de contato (§6) · notificação por cidades escolhidas, não por "região" (§7.1) ·
marcação de presença tem três saídas, não duas (§7.3) · assinatura pelo Asaas com primeiro
mês grátis (§5).

---

## 1. O negócio em uma frase

Classificado de trabalho extra onde a **empresa contratante paga assinatura mensal** para publicar vagas e alcançar trabalhadores cadastrados e identificados. O trabalhador nunca paga nada. A plataforma não intermedia o pagamento do bico, não seleciona ninguém e não garante nada.

## 2. O problema que resolve

Hoje a vaga é anunciada em grupo de WhatsApp com 3.000 pessoas e se perde entre corrente, bom dia e áudio de 4 minutos. O buffet posta às 22h de sexta e reza. O trabalhador que queria o bico não viu a mensagem.

Não é falta de gente e não é falta de vaga. É falta de **roteamento**.

## 3. Quem paga o quê

| Quem | Paga | Quanto |
|---|---|---|
| Trabalhador | **Nunca, em nenhuma hipótese** | R$ 0 |
| Empresa recorrente — buffet, casa de festa, restaurante, empresa de limpeza, produtora de evento | Assinatura mensal | R$ 149/mês (faixa 99–199), vagas ilimitadas |
| Anunciante avulso — o buteco da esquina | Anúncio destacado | R$ 15–25 por anúncio |

**Por que só a empresa paga:** numa plataforma de dois lados, cobra-se do lado escasso e com dinheiro. Trabalhador de bico é abundante — e vai ficar mais abundante ainda se a PEC do fim da 6x1 passar. Empresa que contrata toda semana é escassa e tem caixa. Cobrar do lado abundante esvazia a oferta, a vaga não preenche e o lado pagante cancela.

**Metas:** 20 assinantes em 90 dias · 30 assinantes = R$ 4.470/mês bruto · 40 assinantes = meta cheia. Custos de infra ~R$ 300/mês. Divisão 50/50.

---

## 4. Cadastro do trabalhador

Gratuito e obrigatoriamente trabalhoso. **A fricção é de esforço, nunca de dinheiro nem de passado.**

Etapas (~8 minutos):

1. Nome completo e CPF
2. Confirmação do WhatsApp por código
3. Selfie segurando o documento
4. Perfil: cidade e bairro, até 5 funções, experiência, disponibilidade
5. Cidades de que quer receber aviso — de 1 a 5, com a cidade dele já marcada
6. Aceite do termo de uso
7. Vídeo de 30 segundos se apresentando — **opcional**

**A lógica:** ficha criminal não prevê se a pessoa aparece no sábado — não há correlação. Disposição de fazer coisa chata direito prevê. Quem não gasta 8 minutos por uma vaga de R$150 também não levanta às 6h. O filtro mede exatamente o comportamento que se quer prever.

**Selo "Perfil Completo":** é o vídeo que dá o selo. Quem não grava se cadastra e recebe vagas do mesmo jeito, só não exibe o selo para a empresa. É um selo que descreve **o que a pessoa fez**, não o que a plataforma promete sobre ela — dá sensação de exclusividade sem gerar responsabilidade.

Deixar o vídeo opcional protege o funil: se a conclusão do cadastro ficar baixa, o ajuste é de copy, não de migração.

**As duas referências saíram do cadastro.** A pessoa escolhe quem indica, então aquilo não prova nada — e pode ser telefone inventado. Guardar nome e telefone de duas pessoas que nunca se cadastraram, nunca aceitaram termo nenhum e não são lidas por ninguém é passivo de LGPD puro. Vale como regra geral: **campo declarado pela própria pessoa nunca vira garantia, só informação.**

**Bloqueio de menores de 18 anos** no cadastro — exigência do ECA Digital (Lei 15.211/2025), em vigor desde 17/03/2026.

### A linha que não se cruza

| Pode | Não pode |
|---|---|
| **Identificar** quem é a pessoa | **Aprovar** se a pessoa presta |
| "Identificamos quem se cadastra" | "Verificamos", "aprovamos", "confiável" |

Quem identifica registra um fato. Quem aprova emite uma promessa — e vira porteiro. Porteiro responde por quem deixou entrar.

**Sobre documento falso:** a plataforma não é perita e não audita autenticidade. Registra o que foi enviado. Documento falso é crime de quem enviou. Auditar documento = voltar a ser porteiro.

---

## 5. Cadastro da empresa e assinatura

CNPJ, razão social, responsável, telefone e e-mail. Aceite dos termos.

**Assinatura pelo Asaas.** Primeiro mês gratuito com vagas ilimitadas; a cobrança começa no segundo. Falha de pagamento suspende a publicação de vaga nova, mas **não derruba vaga já aberta** — derrubar puniria o trabalhador que já se candidatou e não tem nada a ver com o boleto.

**Avaliar Pix Automático antes de assumir cartão.** O cliente é buffet pequeno e restaurante de bairro: muitos não têm cartão de crédito empresarial, todos têm Pix. Falha de cobrança vira churn que não é do produto.

No MVP o contratante é sempre CNPJ. O cadastro já está preparado para aceitar CPF numa versão futura — contratante pessoa física, o cliente que precisa de encanador em casa.

## 6. Publicação de vaga

Campos: função, data e horário (a vaga pode virar a meia-noite), valor oferecido, local, exigências (uniforme, experiência), se fornece transporte, e até onde o anúncio alcança.

**A vaga não tem campo de contato.** Nenhum telefone aparece em página pública. Quem inicia o contato é sempre a empresa, no candidato que ela escolheu, por um botão que abre o WhatsApp — e o clique é o ato de escolher. O trabalhador nunca recebe o telefone da empresa e não tem botão de contato em lugar nenhum.

Motivo comercial, não só jurídico: uma vaga de seis aceita até dezoito candidaturas. Se todos pudessem chamar, o contratante — que é quem paga — receberia dezoito mensagens de desconhecidos por anúncio e cancelaria. E o número dele, hoje exposto a milhares de pessoas no grupo, aqui não aparece para ninguém. Isso é argumento de venda.

**O uniforme, se exigido, é exigência da empresa na descrição da vaga.** A plataforma nunca exige uniforme de ninguém — isso seria definir condição de trabalho.

**Filtro automático de anúncio discriminatório.** Bloquear no envio: "moça", "rapaz", "boa aparência", "até X anos", referência a sexo, cor, estado civil. Lista de palavras proibidas com mensagem explicativa ao anunciante. Custa uma tarde de código e elimina o principal vetor de ação do MPT (art. 373-A da CLT).

---

## 7. Os três mecanismos que fazem funcionar

### 7.1 Notificação segmentada — o coração do produto

Vaga publicada dispara notificação só para quem faz aquela função, está disponível naquele dia e horário, e escolheu receber daquela cidade. É isto que ganha do grupo de WhatsApp e é isto que a empresa está pagando. Se 40 pessoas veem em 3 minutos e 6 se candidatam, o buffet escolhe e não depende de um único cara aparecer.

**"Região" virou escolha explícita, não palpite da plataforma.** O trabalhador marca de 1 a 5 cidades e, se quiser, liga um raio de 25 ou 50 km em volta da cidade onde mora. A empresa, do lado dela, pode estreitar o alcance do anúncio — mas **só estreitar**: o opt-in do trabalhador é o teto, e quem assinou aquela cidade na mão sempre recebe.

**Ver e se candidatar não depende disso.** A lista tem seletor de cidade e a candidatura não checa nada — quem quiser olhar a vaga de R$ 500 na cidade vizinha, olha e se candidata.

**A permissão de notificar é o recurso mais escasso do negócio.** Desligar notificação no celular é definitivo na prática: um aviso irrelevante não custa uma vaga, custa a pessoa. É por isso que nada entra no push sem a pessoa ter pedido, e por isso o aviso de cidade vizinha carrega distância e transporte no próprio texto.

### 7.2 Confirmação de véspera

Na véspera do bico: "confirma que vai amanhã?". Quem não confirma até as 18h tem a vaga reaberta e a empresa é avisada a tempo de repor. Custo zero, resolve boa parte do no-show, e não pune ninguém.

### 7.3 Histórico de presença

Depois da data da vaga, **só a empresa que publicou** marca cada candidato, num clique, entre **três** saídas:

| Marcação | Significa | Entra no histórico? |
|---|---|---|
| **não chamei** | a empresa não escolheu essa pessoa | **Não.** É neutro |
| **compareceu** | foi chamada e foi | Sim |
| **não compareceu** | foi chamada e não foi | Sim — **só isto é falta** |

A saída neutra não é detalhe: sem ela, ou o painel entope de pendência, ou a empresa marca falta só para limpar a lista — e aí a plataforma passa a punir quem nunca foi chamado. Passados 7 dias sem marcação, o registro vira "não chamei" automaticamente. Nunca falta.

No perfil aparece o número cru:

> João Silva — 9 presenças, 1 falta, contratado por 5 empresas

Regras que mantêm isso defensável:

- **Sem estrela, sem nota, sem comentário em texto livre** — texto livre é o que gera ação por dano moral. O registro não tem nenhum campo de texto, nem um
- Só a empresa que publicou aquela vaga pode marcar, e só depois da data
- O trabalhador contesta em até 7 dias; enquanto contestado, o registro some do perfil. **Contestar não apaga a marcação da empresa** — as duas informações são guardadas separadas, senão não há como resolver a contestação depois
- Registros expiram em 12 meses
- **Quem ainda não tem histórico nunca exibe "0 presenças".** Exibe "Novo por aqui", ao lado do selo de perfil completo. Reputação sem rampa de entrada tranca o novato para sempre: não é chamado porque não tem histórico, e não tem histórico porque não é chamado
- Nos termos: o histórico é declaração da empresa, não verificação da plataforma, e não constitui garantia

Quem falta muito para de ser chamado — e a sanção veio do mercado, não da plataforma. **Nunca há desligamento automático**, porque punir é poder disciplinar, e poder disciplinar é o que caracteriza patrão.

---

## 8. As quatro regras invioláveis

Assinar junto com o contrato de sociedade. Servem de árbitro quando surgir a próxima ideia.

1. **Não cobrar nada do trabalhador** — nem cadastro, nem destaque, nem taxa de nada
2. **Não tocar no dinheiro do bico** — combinação e pagamento acontecem 100% fora da plataforma
3. **Não punir trabalhador** — sem desligamento automático, sem banimento por falta, sem bloqueio unilateral
4. **Não garantir nada** — nem idoneidade, nem comparecimento, nem qualidade, nem reembolso, nem substituto

Enquanto as quatro forem verdade, a plataforma é um classificado. Ninguém processa a OLX pelo sofá que veio quebrado.

**Sobre a regra 1, com nome e sobrenome:** existe decisão de Justiça do Trabalho de que agência de emprego não pode cobrar por acesso a banco de vagas, e ação no TST sobre taxa de inscrição. Cobrar do candidato — por cadastro, por destaque, por receber aviso, por qualquer coisa — é exatamente o fato que faz um juiz olhar para a plataforma e enxergar uma agência. **Não é decisão de produto, é trocar o regime jurídico do negócio**, e não se toma sem advogado na mesa.

No `CLAUDE.md` essas quatro viraram catorze, detalhadas em linguagem de código. As quatro daqui continuam sendo as originais — as outras dez são consequência delas.

### Palavras proibidas no site, no marketing e no Instagram

~~verificado~~ · ~~aprovado~~ · ~~confiável~~ · ~~garantido~~ · ~~selecionado por nós~~ · ~~profissional de confiança~~

É por aqui que quase todo mundo se enrola — não no código, no story empolgado de sexta-feira.

### Também não se faz

- **Certidão de antecedentes criminais.** 99 e Uber exigem porque a lei obriga (Lei 12.587/2012, art. 11-B, incluído pela Lei 13.640/2018). Quem cumpre dever legal tem defesa. Fazer voluntariamente é assumir dever que ninguém impôs — e o TST fixou tese em recurso repetitivo (IRR Tema 1) de que exigir certidão fora das hipóteses justificadas gera dano moral *in re ipsa*. Garçom, cozinheiro e auxiliar de limpeza de evento não estão nas hipóteses.
- **Reservista.** Só existe para homem de 18 a 45 anos. Exclui 100% das mulheres — que são a maior parte da oferta (cozinheira, diarista, auxiliar de limpeza). Discriminação por sexo e idade.
- **Chat interno.** Vira depositário de comunicações e obrigação de moderação, e ninguém usa: trocam WhatsApp na segunda mensagem.
- **Preço de entrada que sobe conforme entram mais trabalhadores.** É taxar o próprio crescimento.

---

## 9. A assimetria que poucos percebem

A plataforma **não pode** disciplinar o trabalhador — vira patrão.

A plataforma **pode** disciplinar a empresa livremente. Ela é cliente comercial, não trabalhador. Suspender assinatura de empresa que não paga o bico combinado, que publica vaga falsa ou que trata mal é decisão comercial normal, prevista em contrato, sem risco trabalhista nenhum.

É a única alavanca de aplicação de regra que existe — e ela está do lado certo. Usar.

---

## 10. Compliance — o que precisa existir antes de faturar

- [ ] CNPJ aberto
- [ ] Contrato de sociedade 50/50 assinado, com as quatro regras anexas
- [ ] Termos de uso explícitos: não intermedia, não seleciona, não avalia, não garante, não é parte da relação de trabalho
- [ ] Política de privacidade (LGPD) — base legal definida, retenção, exclusão a pedido
- [ ] Coleta mínima: o que não se guarda não vaza. **Não pedir endereço residencial** — cumprido: o trabalhador informa só cidade e bairro. Endereço completo existe apenas na vaga
- [ ] Nenhum dado sem leitor: antes de coletar qualquer campo novo, responder quem lê e o que ele prova. Foi o que tirou as referências do cadastro
- [ ] CPF armazenado, **nunca exibido publicamente**
- [ ] Canal de denúncia com remoção de anúncio em até 48h, com registro de data
- [ ] Bloqueio de menores de 18 anos
- [ ] Filtro de anúncio discriminatório
- [ ] **Revisão dos termos por advogado, uma vez** — R$ 1.500 a 3.000. É o que compra o sono.

---

## 11. Quando der problema — o que fazer

| Situação | Postura |
|---|---|
| Trabalhador furtou / causou dano no cliente | Não somos parte. Fornecemos os dados de identificação mediante requisição legal. Não indenizamos, não mediamos, não prometemos nada. |
| Trabalhador se acidentou no local | Não somos parte. A relação é entre ele e o contratante. Prestamos as informações cabíveis. |
| Empresa não pagou o trabalhador | Não mediamos o pagamento — mas registramos a reclamação e **suspendemos a assinatura da empresa reincidente**. É a alavanca do item 9. |
| Trabalhador quer remover uma falta do histórico | Contestação em 7 dias, registro some enquanto contestado. Processo documentado. |
| Notificação extrajudicial pedindo remoção de conteúdo | Avaliar e remover em 48h se procedente. Registrar tudo. Não ignorar. |

---

## 12. Ordem de execução

**Etapa 0 — Validar (ainda em aberto)**

- Contar nos grupos: quantas vagas por semana, quantos anunciantes diferentes, **quantos repetem**
- Pré-vender: ligar para 10 empresas da lista de repetidores. Meta: 5 dizendo "topo testar"
- *Este passo continua pendente. Ver seção 14.*

**Etapa 1 — Estrutura**

- CNPJ, contrato de sociedade, termos revisados por advogado

**Etapa 2 — Construir o mínimo**

- Cadastro de trabalhador (6 etapas), cadastro de empresa, publicar vaga, listagem filtrável, notificação segmentada, confirmação de véspera, histórico de presença, painel da empresa
- Nada além disso

**Etapa 3 — Encher o lado do trabalhador**

- Divulgação nos grupos pelo sócio. Meta: 300 cadastros completos antes de cobrar de qualquer empresa
- Plataforma vazia não vende assinatura nenhuma

**Etapa 4 — Cobrar**

- Converter os pré-vendidos, atacar o resto da lista

---

## 13. Métricas que dizem se está funcionando

| Métrica | Leitura |
|---|---|
| **Renovação da empresa no 2º mês** | Abaixo de 80%, o produto não está entregando. É a métrica-rainha. |
| Vagas preenchidas / vagas publicadas | Se cai, o lado do trabalhador está fino |
| Candidatos por vaga nas primeiras 2h | Mede se a notificação está funcionando |
| Taxa de confirmação de véspera | Prevê no-show antes de acontecer |
| Cadastros iniciados vs. completos | Se a conclusão for muito baixa, as 8 etapas estão pesadas demais |

Se o churn subir, o problema é quase sempre o mesmo: **falta trabalhador respondendo**. Resolve-se enchendo a oferta, nunca baixando o preço.

---

## 14. O que ainda não foi respondido

**Quantas empresas repetem nos grupos.** A convicção de que "as empresas vão pagar" é leitura de mercado dos sócios, não dado coletado. Pode estar certa — mas a diferença entre 8 e 40 empresas recorrentes é a diferença entre R$1.200 e R$6.000 por mês, e entre um projeto que vale o esforço e um que não vale.

Custa uma hora de rolagem nos grupos e responde: quantas vagas por semana, quantos anunciantes distintos, quantos repetem.

**Preço não testado.** R$149 é chute fundamentado. O único jeito de saber é dizer o número em voz alta pra 10 donos de buffet e ver a reação.

**Geografia.** Todo o modelo depende de 7 grupos de WhatsApp de uma cidade. Essa vantagem não se replica em outra cidade — lá não há sócio com grupo. Não é problema agora, mas define o teto: isto é um bom negócio paralelo, não um negócio que escala sozinho.
