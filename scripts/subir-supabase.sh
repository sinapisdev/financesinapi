#!/usr/bin/env bash
# Sobe o banco inteiro para o Supabase: schema + dados, de uma vez.
#
#   bash scripts/subir-supabase.sh
#
# Lê DATABASE_URL_MIGRACAO do .env (a conexão direta, porta 5432 — o pooler não
# aceita as operações de schema). Nada é apagado do banco local.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "  Falta o arquivo .env — copie de .env.example e preencha."; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a
: "${DATABASE_URL_MIGRACAO:?Preencha DATABASE_URL_MIGRACAO no .env — Direct connection, ou Session pooler se sua rede for IPv4-only}"

esconder() { sed -E 's#(postgres(ql)?://[^:]+:)[^@]+@#\1***@#g'; }
echo "→ destino: $(echo "$DATABASE_URL_MIGRACAO" | esconder)"

echo
echo "1/5 · conferindo o destino"
if ! psql "$DATABASE_URL_MIGRACAO" -q -c "select 1" >/dev/null 2>&1; then
  echo
  echo "  Não consegui conectar."
  echo "  A causa mais comum: a Direct connection do Supabase só responde em IPv6."
  echo "  Se a sua rede for só IPv4 (o normal em boa parte do Brasil), volte ao"
  echo "  painel, clique em Connect e copie a string do SESSION POOLER (porta 5432"
  echo "  no host ...pooler.supabase.com) para DATABASE_URL_MIGRACAO."
  echo
  echo "  Para saber se você tem IPv6:  curl -s -6 https://ifconfig.co"
  exit 1
fi
existentes=$(psql "$DATABASE_URL_MIGRACAO" -t -A -c \
  "select count(*) from information_schema.tables where table_schema='public'")
if [ "$existentes" -gt 0 ]; then
  echo "  O schema public do destino já tem $existentes tabela(s)."
  read -r -p "  Apagar TUDO lá e recriar? digite APAGAR para confirmar: " ok
  [ "$ok" = "APAGAR" ] || { echo "  cancelado."; exit 1; }
  psql "$DATABASE_URL_MIGRACAO" -q -c "drop schema public cascade; create schema public;"
fi

echo "2/5 · gerando o dump do banco local"
mkdir -p data/dump
DUMP="data/dump/silvereng-$(date +%Y%m%d-%H%M).sql"
pg_dump --no-owner --no-privileges --no-acl -d silvereng_dev -f "$DUMP"
echo "  $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "3/5 · restaurando no Supabase"
psql "$DATABASE_URL_MIGRACAO" -q -v ON_ERROR_STOP=1 -f "$DUMP"

echo "4/5 · conferindo o que chegou"
psql "$DATABASE_URL_MIGRACAO" -c "
select 'lançamentos' o, count(*) n from lancamento
union all select 'parcelas', count(*) from parcela
union all select 'baixas', count(*) from baixa
union all select 'partidas contábeis', count(*) from livro_partida
union all select 'contas do plano', count(*) from conta
order by 1;"

echo "5/5 · conferindo o caixa (tem de bater com o local)"
for alvo in "silvereng_dev" "$DATABASE_URL_MIGRACAO"; do
  if [ "$alvo" = "silvereng_dev" ]; then rotulo="local "; conn=(-d silvereng_dev)
  else rotulo="remoto"; conn=("$alvo"); fi
  valor=$(psql "${conn[@]}" -t -A -c "
    select to_char(sum(case when p.tipo='receber' then b.valor_liquido else -b.valor_liquido end),'FM999G999G999D00')
    from lancamento l join parcela p on p.lancamento_id=l.id
    join baixa b on b.parcela_id=p.id and b.estornada_em is null and b.estorno_de_id is null
    where l.status='ativo'")
  echo "  caixa $rotulo: $valor"
done

echo
echo "Pronto. Agora preencha DATABASE_URL (o pooler, porta 6543) e rode: npm run dev"
