#!/usr/bin/env bash
# ============================================================
# INFINDA Digital — Migração Lovable Cloud → Supabase próprio
# ============================================================
# Requisitos: bash, psql (postgresql-client) instalados localmente.
#
# 1) Pegue as connection strings (Project Settings → Database → Connection string → URI):
#      SOURCE_URL = string do projeto Lovable Cloud (origem)
#      TARGET_URL = string do seu Supabase próprio (destino)
#
# 2) Antes de rodar este script, aplique TODAS as migrations do repositório
#    (pasta supabase/migrations/) no banco DESTINO, em ordem alfabética,
#    via SQL Editor do Supabase. Isso cria tabelas, RLS, funções e triggers.
#
# 3) Execute:
#      export SOURCE_URL='postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres'
#      export TARGET_URL='postgresql://postgres:SENHA@db.yyy.supabase.co:5432/postgres'
#      bash scripts/migrate-supabase.sh
#
# O script:
#   - Exporta cada tabela do schema public para CSV em ./dump/
#   - Importa cada CSV no destino, respeitando a ordem de dependência (FKs)
#   - NÃO migra usuários do auth.users (use Supabase Dashboard → Authentication
#     → Users → "Export" ou recadastre). Sem usuários, RLS bloqueia inserts
#     se as tabelas exigem user_id. Por isso o script desabilita triggers
#     durante o COPY usando session_replication_role=replica.
# ============================================================
set -euo pipefail

: "${SOURCE_URL:?defina SOURCE_URL}"
: "${TARGET_URL:?defina TARGET_URL}"

DUMP_DIR="${DUMP_DIR:-./dump}"
mkdir -p "$DUMP_DIR"

# Ordem importa: pais antes de filhos (FKs)
TABLES=(
  prospects
  prospect_imports
  prospect_interactions
  company_profiles
  company_addresses
  company_locations
  company_market_data
  company_scores
  company_visits
  company_enrichment_logs
  briefings
)

echo "==> 1/3  Exportando do CLOUD para $DUMP_DIR/*.csv"
for t in "${TABLES[@]}"; do
  exists=$(psql "$SOURCE_URL" -tAc \
    "select to_regclass('public.$t') is not null")
  if [ "$exists" != "t" ]; then
    echo "    - public.$t  (não existe na origem, pulando)"
    continue
  fi
  count=$(psql "$SOURCE_URL" -tAc "select count(*) from public.$t")
  echo "    - public.$t  ($count linhas)"
  psql "$SOURCE_URL" -c \
    "\copy (select * from public.$t) to '$DUMP_DIR/$t.csv' with csv header"
done

echo "==> 2/3  Validando schema no DESTINO"
for t in "${TABLES[@]}"; do
  ok=$(psql "$TARGET_URL" -tAc "select to_regclass('public.$t') is not null")
  if [ "$ok" != "t" ]; then
    echo "ERRO: public.$t não existe no destino."
    echo "      Aplique antes todas as migrations de supabase/migrations/."
    exit 1
  fi
done

echo "==> 3/3  Importando para o DESTINO (triggers/RLS desativados na sessão)"
for t in "${TABLES[@]}"; do
  csv="$DUMP_DIR/$t.csv"
  [ -f "$csv" ] || { echo "    - $t  (sem csv, pulando)"; continue; }
  rows=$(($(wc -l < "$csv") - 1))
  echo "    - public.$t  ($rows linhas)"
  psql "$TARGET_URL" -v ON_ERROR_STOP=1 <<SQL
begin;
set local session_replication_role = replica;
truncate public.$t restart identity cascade;
\copy public.$t from '$csv' with csv header
commit;
SQL
done

echo "==> OK. Migração concluída."
echo "Próximos passos:"
echo "  1. Atualize VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no projeto"
echo "     com as chaves do seu Supabase próprio."
echo "  2. Recadastre os usuários (auth.users não é migrado automaticamente)."
echo "  3. Teste login + listagem de leads/briefings."