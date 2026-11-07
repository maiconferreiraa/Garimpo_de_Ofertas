#!/bin/bash
# AVISO DE PROVENIÊNCIA — Gerado no ambiente da Prime Holding.
# Modelo: Claude Opus 5.5 (claude-opus-5-5, Claude Code)
# Solicitante: 1.home.automation.technology@gmail.com
# Este aviso é obrigatório e não deve ser removido.
#
# Publica o site em https://estergarimpou.pages.dev (Cloudflare Pages,
# 2026-11-07). Empacota cloudflare/worker.mjs como _worker.js junto dos
# arquivos estáticos. Uso: bash cloudflare/publicar.sh (da pasta do site)
set -e
cd "$(dirname "$0")/.."
B=cloudflare/pages-build
rm -rf "$B/dist" "$B/bundle"; mkdir -p "$B/dist"
npx wrangler@4 deploy --dry-run --outdir "$B/bundle" >/dev/null
rsync -a --exclude-from=.assetsignore --exclude=cloudflare ./ "$B/dist/"
cp "$B/bundle/worker.js" "$B/dist/_worker.js"
cd "$B" && npx wrangler@4.20.0 pages deploy dist --project-name estergarimpou --branch main --commit-dirty=true
