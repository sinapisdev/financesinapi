#!/usr/bin/env bash
# Roda as travas do banco num banco descartável, nunca no de trabalho.
set -euo pipefail
cd "$(dirname "$0")/.."

BANCO="silvereng_teste_$$"
limpar() { psql -d postgres -q -c "drop database if exists $BANCO" 2>/dev/null || true; }
trap limpar EXIT

psql -d postgres -q -c "create database $BANCO"
for f in banco/0*.sql; do psql -d "$BANCO" -q -v ON_ERROR_STOP=1 -f "$f"; done

saida=$(psql -d "$BANCO" -f banco/99_testes.sql 2>&1)
echo "$saida" | grep -E "NOTICE: +(ok|FALHOU)" | sed 's/.*NOTICE: *//'
echo "$saida" | grep -E "^ (principal|numero|identificacao)" -A 6 | sed 's/^/  /' || true

falhas=$(echo "$saida" | grep -c "FALHOU" || true)
passou=$(echo "$saida" | grep -cE "NOTICE: +ok" || true)
echo
echo "=================================================="
if [ "$falhas" -gt 0 ]; then echo "# $falhas FALHA(S) de $((passou + falhas))"; exit 1; fi
echo "# $passou travas do banco funcionando"
