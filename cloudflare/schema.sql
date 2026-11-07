-- Migração Netlify → Cloudflare (2026-11-07): uma tabela chave/valor por "loja"
CREATE TABLE IF NOT EXISTS kv (loja TEXT NOT NULL, chave TEXT NOT NULL, valor TEXT, PRIMARY KEY (loja, chave));
