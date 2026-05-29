#!/usr/bin/env bash
# Auto-commit e push ao final de cada sessão do Claude Code
set -euo pipefail

REPO="/home/xandy/dev-x/total-control-app"
cd "$REPO"

# Verifica se há mudanças em arquivos rastreados
if git diff --quiet && git diff --staged --quiet; then
  exit 0  # nada a commitar
fi

# Adiciona arquivos rastreados E novos arquivos de código do Front-end e supabase
git add -u
git add Front-end/components/*.tsx Front-end/lib/*.ts Front-end/services/*.ts Front-end/hooks/*.ts supabase/migrations/*.sql 2>/dev/null || true

# Verifica de novo após o add
if git diff --staged --quiet; then
  exit 0
fi

DATE=$(date '+%d/%m/%Y %H:%M')
git commit -m "chore: auto-save $DATE

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin main

echo '{"systemMessage": "✅ Código salvo e enviado para o GitHub automaticamente."}'
