# Financeiro — migração do ConstrutoraPRO (Base44) para sistema próprio

Sistema financeiro/contábil da Construtora Silvereng, hoje no Base44
(app `69ceaaf2ff370a0c3a2d44e7`), sendo movido para Postgres/Supabase.

**Regra número um: o Base44 continua sendo a fonte da verdade até o snapshot
estar extraído, auditado e reconciliado. Nada é apagado de lá — nem depois.**

## Ordem de trabalho

| Fase | O que é | Estado |
|---|---|---|
| 0 | Snapshot bruto e íntegro de todas as entidades | **concluída** — 25.015 registros, varredura dupla conferida |
| 1 | Auditoria: contagens, duplicatas, órfãs, débito = crédito | **concluída** — ver `docs/auditoria-snapshot.md` |
| 2 | Modelagem do Postgres (plano de contas, partidas, caixas) | **concluída** — `banco/*.sql`, 10 testes passando |
| 3 | Carga idempotente com `base44_id` em toda linha | **concluída** — 0 falhas |
| 4 | Reconciliação: saldo por caixa igual dos dois lados, centavo a centavo | **concluída** — R$ 0,00 de diferença |
| 5 | Sistema novo (backend + UI) e operação em paralelo | em andamento — tela de extrato pronta |
| 6 | Cutover, com o Base44 congelado como arquivo histórico | — |

## Como rodar a Fase 0

```bash
cp .env.example .env          # cole SUA api key em BASE44_API_KEY
node migracao/testar-acesso.mjs   # confirma credencial e descobre o header certo
node migracao/extrair.mjs         # baixa tudo para data/raw/ + gera manifesto
node migracao/validar.mjs         # audita o snapshot offline
```

Não use o sistema no Base44 enquanto a extração roda — um lançamento criado no
meio da paginação pode deslocar páginas. Leva poucos minutos.

## Scripts

- `migracao/lib/base44.mjs` — cliente HTTP. Pagina com `limit`/`skip` e **aborta**
  se detectar que o `skip` foi ignorado, em vez de entregar snapshot incompleto.
- `migracao/testar-acesso.mjs` — descobre qual header de auth o app aceita.
- `migracao/extrair.mjs` — sonda quais entidades existem, extrai todas, grava
  `data/raw/<Entidade>.json` e um manifesto com contagem + sha256 de cada arquivo.
- `migracao/validar.mjs` — roda offline: ids duplicados, FKs órfãs, hash x manifesto.
- `migracao/descobrir.mjs` — lista entidades pelo bundle público (o app é privado,
  então hoje não retorna nada; mantido caso o app seja publicado).

Todos os scripts de extração são **somente leitura**. Nenhum escreve no Base44.

## Decisões

- Banco/hospedagem: **Supabase** (Postgres gerenciado; dá para sair levando o banco).
- Usuários: equipe de 2 a 10 — exige login por pessoa, papéis e trilha de auditoria.
- Credencial: API key do Base44 fica só no `.env` local, fora do git.

## Dados sensíveis

`data/raw/`, `data/csv/` e `.env` estão no `.gitignore`. O manifesto (contagens e
hashes, sem valores) é versionado — é ele que prova a integridade do snapshot.


## Banco de dados

```bash
createdb silvereng_dev
psql -d silvereng_dev -f banco/01_cadastros.sql
psql -d silvereng_dev -f banco/02_financeiro.sql
psql -d silvereng_dev -f banco/03_contabil.sql
psql -d silvereng_dev -f banco/99_testes.sql   # 10 casos, todos devem dar "ok"
```

Cada teste reproduz um erro real encontrado no Base44 e verifica se o banco o
recusa. Rodar isso depois de qualquer mudança no schema.


## Identidade visual

Paleta oficial SILVERENG: off-white `#F4F6F8` (60%), navy `#0B1F3A` (25%),
grafite `#23272D` (10%), vinho `#7A1F1F` (5%), tipografia Inter.
Entradas em verde sóbrio `#10694A`; saídas no próprio vinho da marca.

Tabelas rolam **por dentro** (`max-height` no `.tabela-wrap`), não pela página:
com a barra no fim de 300 linhas ninguém descobre que existe coluna à direita.
Presa ao rodapé do quadro, ela fica sempre à mão — e o estilo é explícito porque
no macOS a barra some sozinha. O cabeçalho é `sticky`, então a coluna continua
identificada durante a rolagem.

Formulários usam **grade de 12 colunas** com spans explícitos (`.c3`, `.c4`,
`.c5`…) em vez de `auto-fit` — com auto-fit cada linha quebrava numa largura
diferente e o card ficava torto. Todo controle tem **38px de altura**, e o
`select` recebe `appearance: none` com seta desenhada: o select nativo do macOS
tem altura e moldura próprias e destoava dos campos de texto ao lado.

## Acesso

Toda página passa por `exigirEmpresa()`, que agora chama `exigirUsuario()`
antes de qualquer consulta — é o ponto único por onde as telas passam, então
proteger ali protege o sistema inteiro. **As server actions não passam por lá**:
cada uma que grava chama `exigirEscrita()`, que também barra o papel de leitura.

Decisões de segurança:

- **scrypt** (nativo do Node) com salt por usuário e comparação em tempo
  constante. O Base44 guardava SHA-256 puro — rápido demais para senha — e por
  isso **nenhuma senha foi migrada**.
- **Sessão em tabela**, não JWT: dá para revogar na hora e ver quem está
  conectado. Cookie `httpOnly` (JavaScript da página não lê), `sameSite=lax`,
  e `secure` quando em produção.
- **Mensagem de erro idêntica** para e-mail inexistente e senha errada — não
  confirma a quem tenta se aquele e-mail existe.
- **5 tentativas falhas em 15 minutos** travam o e-mail.
- Trocar a senha **encerra as outras sessões** do usuário.
- `acesso_log` registra cada entrada e cada falha, com motivo e navegador.

Papéis: `admin` (tudo, inclusive usuários), `financeiro` (lança, baixa, edita),
`leitura` (só consulta). `usuario_empresa` restringe quais empresas alguém
enxerga — sem nenhuma linha, enxerga todas.

### Criar um acesso

```bash
node scripts/criar-usuario.mjs email@silvereng.com.br "Nome Completo" admin
```

A senha é digitada no terminal, sem eco. Não passa por argumento, log ou arquivo.

## Contexto de empresa

A empresa é escolhida **na entrada do sistema** (`/empresa`) e vale para todas as
telas, guardada em cookie. Não é filtro de tela: misturar as quatro empresas em
cada lista embaralhava a leitura e deixava fácil olhar um número consolidado
achando que era de uma SPE. A opção **"Todas as empresas"** existe para conferir
o grupo somado — nas telas, ela liga a coluna de empresa que fica oculta quando
há uma selecionada.

`lib/empresa.ts` expõe `exigirEmpresa()`, que toda página chama no topo: sem
escolha, redireciona para a seleção.

## Aplicação

Next.js 15 lendo direto do Postgres. Para ir ao Supabase basta definir
`DATABASE_URL` — nenhuma consulta muda.

```bash
npm run dev        # http://localhost:3100
```

- `app/extrato/` — extrato de caixa com filtro por empresa, conta, centro de
  custo e período, totais e saldo acumulado. É a tela que confere a migração
  contra o extrato bancário.
- `app/receber/` e `app/pagar/` — parcelas em aberto, vencidas, a vencer e
  liquidadas, com busca por contraparte, descrição ou documento.

Todas as listas filtram por período, e o período incide sobre a data que se
escolher: **vencimento**, **lançamento** (competência) ou **pagamento**
(liquidação). No extrato a escolha é entre **movimento** e **competência** — a
diferença entre os dois é o descasamento entre o fato e o caixa.
- `app/_componentes/ListaParcelas.tsx` — a lista serve aos dois lados.
- `app/lancamentos/[id]/editar` — edição. Classificação (data, centro de custo,
  processo, conta, contraparte, descrição, observação) muda sempre; o **valor só
  muda enquanto não houver baixa**, e ao mudar as parcelas são redistribuídas
  proporcionalmente, mantendo datas e quantidade.
- `app/lancamentos/[id]` — detalhe: parcelas, baixas, contabilização, estorno
  de baixa e cancelamento do lançamento.
- `app/parcelas/[id]/baixar` — liquidação da parcela, com juros, multa e
  desconto, mostrando o líquido que entra ou sai do banco antes de confirmar.
- `app/painel/` — visão geral: caixa, a receber/a pagar com vencido, resultado do
  mês, evolução de 12 meses, vencimentos dos próximos 15 dias, idade dos
  recebíveis vencidos e despesas por centro de custo.
- `app/_componentes/GraficoMensal.tsx` — SVG inline, sem biblioteca. As duas
  cores das séries (`#109E68` entrada, `#B53232` saída) passaram no validador de
  paleta: ΔE 9.8 em deuteranopia, 29.9 em visão normal, contraste acima de 3:1.
  Legenda sempre presente e tooltip no hover — identidade nunca é só a cor.
- `app/relatorios/fluxo` — caixa realizado (movimentos) e previsto (parcelas em
  aberto pela data de vencimento), numa linha do tempo só, com saldo projetado.
- `app/relatorios/dre` — resultado por competência, agrupado pela conta contábil
  de cada lançamento. **Gerencial, não contábil** — a tela diz isso em destaque,
  porque a classificação herdada tem os problemas de `docs/diagnostico-contabil.md`.
  Lançamentos em conta de ativo/passivo (mútuos, empréstimos, imobilizado) ficam
  de fora e são declarados no rodapé: não são resultado.
- `app/transferencias/` — dinheiro mudando de conta dentro da mesma empresa.
  Não é receita nem despesa: o caixa consolidado não se altera.
- `app/lancamentos/` — lista e criação. O formulário monta entrada, parcelas,
  balões e parcela de chaves, com prévia ao vivo; o botão só libera quando as
  parcelas fecham com o valor do lançamento.
- **Contabilização no lançamento**: quando o processo aponta para conta
  **sintética** (`6.1` despesas administrativas, `5.1` custos de obra, `4.3`
  outras receitas…), o formulário exige a analítica de verdade — e o servidor
  confere que ela pertence ao grupo do processo. 7 dos 25 processos caem nesse
  caso. O plano de contas segue intacto, com as 118 contas originais.
- `lib/parcelamento.ts` — a regra de divisão, em centavos inteiros. Usada no
  preview **e** na gravação, para que o que se vê seja o que é gravado. A sobra
  da divisão vai na última parcela. Testes em `testes/parcelamento.test.ts`.

```bash
npx tsx testes/parcelamento.test.ts   # regra de parcelamento
```
- `lib/db.ts` — pool de conexão e formatadores.

### Duas normalizações feitas na carga

- **"Obra" virou centro de custo.** A entidade do Base44 agrupa também
  ADMINISTRATIVO, INCORPORADORA e projetos de engenharia. O tipo é inferido pelo
  nome: 2 obras, 6 projetos, 1 administrativo, 1 incorporadora.
- **Lançamento cancelado cancela suas parcelas.** No Base44 elas continuavam
  abertas, inflando o contas a receber em **R$ 6.335.468,38**.


## Descrições e maiúsculas

- **Todo texto digitado é gravado em MAIÚSCULAS** (`lib/texto.ts`), e os campos
  mostram assim enquanto se escreve. Os dados migrados também foram
  normalizados: zero textos fora do padrão.
- **424 lançamentos (27,6%) vieram sem descrição do Base44.** Em vez de
  `"receita 1789501922995"`, passam a mostrar o **nome da contraparte** ou, na
  falta dela, o **nome do processo**. Ficam marcados com
  `descricao_automatica = true` e um **ponto bordô** ao lado, para irem sendo
  corrigidos aos poucos.
- A descrição se edita **direto na lista** (ícone de lápis ao passar o mouse) ou
  no detalhe do lançamento. Ao salvar, o ponto some.

## Armadilha da deduplicação de pessoas

Cliente e fornecedor com o mesmo CPF/CNPJ viram **uma** pessoa. O segundo
cadastro não ganha `base44_id` próprio — então resolver `código → pessoa` pelo
`base44_id` perde esses vínculos. Eram **16 cadastros** (SICOOB, as duas SPEs, os
sócios) e **403 lançamentos sem contraparte**, R$ 17,5 milhões. A resolução é
pelo **CPF/CNPJ**, com `base44_id` e nome como reserva (`resolverPessoa` em
`carga/02_movimentos.mjs`).

## A conta contábil não vinha no lançamento

O Base44 **não guarda no lançamento** qual conta analítica foi escolhida — ela só
existe nos movimentos contábeis que ele gerou. Recuperá-la é questão de olhar
esses movimentos e achar, entre as contas usadas na emissão, a que pertence ao
grupo sintético do processo.

Resultado: **1.384 de 1.386** lançamentos ativos ganharam sua conta. Reabrir um a
um não teria sido viável.

| | |
|---|---:|
| Conta recuperada | 1.384 |
| Sem conta | 2 |
| Conta fora do grupo do processo (marcados) | 40 |

Os 40 divergentes preservam a conta que o Base44 usou — a inconsistência é dele,
e escondê-la seria pior. Ficam marcados e filtráveis na tela de lançamentos.

## Duas armadilhas do driver e dos dados

- **`bigint` chega como string.** O node-postgres devolve INT8 como texto para
  não perder precisão, e `"1" !== 1` quebra comparações sem erro nenhum. Nossos
  ids não chegam perto de 2^53, então `lib/db.ts` registra um parser que os
  converte para número.
- **Transferência migrada não tem contas.** O Base44 não registra de onde saiu
  nem para onde foi. Elas ficam com as duas pontas na conta guarda-chuva e
  `contas_identificadas = false`, em vez de escolhermos um destino plausível —
  chutar criaria saldo onde não há. A constraint de contas diferentes só vale
  quando as contas são identificadas.

## Cadastros

- `app/cadastros/pessoas` — cliente, fornecedor e vendedor são **papéis da mesma
  pessoa**, não cadastros separados. CPF/CNPJ é validado pelo dígito verificador
  (`lib/documento.ts`, com testes), na tela e no servidor.
- `app/cadastros/centros` — obras, projetos e áreas, com gasto acumulado.
- `app/cadastros/contas` — contas bancárias, com saldo calculado dos movimentos.
- `app/cadastros/formas` — formas de pagamento, edição na própria lista.
- `app/cadastros/usuarios` — só admin. Senha nova é sempre **temporária e
  mostrada uma vez**; quem recebe troca no primeiro acesso. Ninguém muda o
  próprio papel nem se desativa, e o último admin ativo não pode ser rebaixado —
  senão o sistema ficaria sem administrador.

## Regras que valem a pena lembrar

- **Só o principal amortiza a parcela.** Juros e multa são acréscimos; desconto
  reduz o que entra no caixa. Nenhum deles muda quanto da dívida foi quitado —
  somá-los ao `valor_baixado` deixa o saldo negativo.
- **Estorno não apaga.** A baixa fica no histórico com `estornada_em` e deixa de
  contar no caixa e no saldo da parcela.
- **Descrição é obrigatória e precisa dizer algo**: o banco recusa vazio ou
  texto com menos de 3 caracteres, por qualquer caminho.
- **Cancelar lançamento com baixa ativa é recusado.** Primeiro estorna-se a
  baixa; senão o caixa deixa de bater com o extrato.
