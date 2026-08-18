# Plataforma de Bicos — Modelo de Negócio v2

*Consolida todas as decisões tomadas até 17/08/2026. Substitui a v1.*

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
2. Selfie segurando o documento
3. Confirmação do WhatsApp por código
4. Perfil: funções que faz, experiência, disponibilidade, bairro/região
5. Vídeo de 30 segundos se apresentando
6. Duas referências de onde já trabalhou, com contato

**A lógica:** ficha criminal não prevê se a pessoa aparece no sábado — não há correlação. Disposição de fazer coisa chata direito prevê. Quem não gasta 8 minutos por uma vaga de R$150 também não levanta às 6h. O filtro mede exatamente o comportamento que se quer prever.

**Selo "Perfil Completo":** quem cumpre as 6 etapas ganha destaque na listagem. É um selo que descreve **o que a pessoa fez**, não o que a plataforma promete sobre ela. Dá a sensação de exclusividade sem gerar responsabilidade.

**Bloqueio de menores de 18 anos** no cadastro — exigência do ECA Digital (Lei 15.211/2025), em vigor desde 17/03/2026.

### A linha que não se cruza

| Pode | Não pode |
|---|---|
| **Identificar** quem é a pessoa | **Aprovar** se a pessoa presta |
| "Identificamos quem se cadastra" | "Verificamos", "aprovamos", "confiável" |

Quem identifica registra um fato. Quem aprova emite uma promessa — e vira porteiro. Porteiro responde por quem deixou entrar.

**Sobre documento falso:** a plataforma não é perita e não audita autenticidade. Registra o que foi enviado. Documento falso é crime de quem enviou. Auditar documento = voltar a ser porteiro.

---

## 5. Cadastro da empresa

CNPJ, razão social, responsável, telefone e e-mail. Aceite dos termos. Cartão para a assinatura.

## 6. Publicação de vaga

Campos: função, data, horário, valor oferecido, local, exigências (uniforme, experiência), contato direto.

**O uniforme, se exigido, é exigência da empresa na descrição da vaga.** A plataforma nunca exige uniforme de ninguém — isso seria definir condição de trabalho.

**Filtro automático de anúncio discriminatório.** Bloquear no envio: "moça", "rapaz", "boa aparência", "até X anos", referência a sexo, cor, estado civil. Lista de palavras proibidas com mensagem explicativa ao anunciante. Custa uma tarde de código e elimina o principal vetor de ação do MPT (art. 373-A da CLT).

---

## 7. Os três mecanismos que fazem funcionar

### 7.1 Notificação segmentada — o coração do produto

Vaga publicada dispara notificação só para quem faz aquela função naquela região. É isto que ganha do grupo de WhatsApp e é isto que a empresa está pagando. Se 40 pessoas veem em 3 minutos e 6 se candidatam, o buffet escolhe e não depende de um único cara aparecer.

### 7.2 Confirmação de véspera

Na véspera do bico: "confirma que vai amanhã?". Quem não confirma até as 18h tem a vaga reaberta e a empresa é avisada a tempo de repor. Custo zero, resolve boa parte do no-show, e não pune ninguém.

### 7.3 Histórico de presença

Depois da data da vaga, **só a empresa que publicou** responde a uma pergunta de um clique: *compareceu? sim/não*.

No perfil aparece o número cru:

> João Silva — 9 presenças, 1 falta, contratado por 5 empresas

Regras que mantêm isso defensável:

- **Binário. Sem estrela, sem nota, sem comentário em texto livre** — texto livre é o que gera ação por dano moral
- Só a empresa que publicou aquela vaga pode marcar, e só depois da data
- O trabalhador contesta em até 7 dias; enquanto contestado, o registro some do perfil
- Registros expiram em 12 meses
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
- [ ] Coleta mínima: o que não se guarda não vaza. Não pedir endereço residencial
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
