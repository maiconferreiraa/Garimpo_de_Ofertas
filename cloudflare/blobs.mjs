/*
 * AVISO DE PROVENIÊNCIA — Gerado no ambiente da Prime Holding.
 * Modelo: Claude Opus 5.5 (claude-opus-5-5, Claude Code)
 * Solicitante: 1.home.automation.technology@gmail.com
 * Este aviso é obrigatório e não deve ser removido.
 */
// Migração Netlify → Cloudflare (2026-11-07, a Netlify tirou o site do ar por
// limite de uso). Imita o `getStore` do @netlify/blobs pra as funções não
// mudarem: dados pequenos no banco D1 (env.DB, tabela kv) e imagens/vídeo no
// KV (env.ARQUIVOS), que aceita arquivos de até 25 MB.
let ENV = null;
// Plano grátis: no máximo 50 consultas ao D1 por acesso. As rotas que fazem
// list() + get() de cada item (cliques, pontos do Indique) leem tudo numa
// consulta só e o get() seguinte sai deste cache (vale só pro acesso atual).
let CACHE = new Map();
export function usarEnv(env) {
  ENV = env;
  CACHE = new Map();
}

const BINARIOS = new Set(['imagens', 'videos']);

function emD1(nome) {
  const db = () => ENV.DB;
  return {
    async get(chave, { type } = {}) {
      const ck = `${nome}\u0000${chave}`;
      const r = CACHE.has(ck) ? { valor: CACHE.get(ck) } : await db().prepare('SELECT valor FROM kv WHERE loja = ? AND chave = ?').bind(nome, String(chave)).first();
      CACHE.delete(ck);
      if (!r) return null;
      if (type === 'json') {
        try { return JSON.parse(r.valor); } catch { return null; }
      }
      return r.valor;
    },
    async set(chave, valor) {
      const texto = typeof valor === 'string' ? valor : new TextDecoder().decode(valor);
      await db().prepare('INSERT INTO kv (loja, chave, valor) VALUES (?, ?, ?) ON CONFLICT(loja, chave) DO UPDATE SET valor = excluded.valor').bind(nome, String(chave), texto).run();
    },
    async setJSON(chave, valor) {
      await this.set(chave, JSON.stringify(valor));
    },
    async delete(chave) {
      await db().prepare('DELETE FROM kv WHERE loja = ? AND chave = ?').bind(nome, String(chave)).run();
    },
    async list({ prefix = '' } = {}) {
      const { results } = await db().prepare("SELECT chave, valor FROM kv WHERE loja = ? AND chave LIKE ? ESCAPE '\\' ORDER BY chave")
        .bind(nome, prefix.replace(/[\\%_]/g, (c) => `\\${c}`) + '%').all();
      for (const x of results) CACHE.set(`${nome}\u0000${x.chave}`, x.valor);
      return { blobs: results.map((r) => ({ key: r.chave })) };
    },
  };
}

function emKV(nome) {
  const kv = () => ENV.ARQUIVOS;
  const k = (chave) => `${nome}/${chave}`;
  return {
    async get(chave, { type } = {}) {
      return kv().get(k(chave), { type: type === 'json' ? 'json' : type === 'arrayBuffer' ? 'arrayBuffer' : 'text' });
    },
    async set(chave, valor) {
      await kv().put(k(chave), valor);
    },
    async setJSON(chave, valor) {
      await kv().put(k(chave), JSON.stringify(valor));
    },
    async delete(chave) {
      await kv().delete(k(chave));
    },
    async list({ prefix = '' } = {}) {
      const blobs = [];
      let cursor;
      do {
        const r = await kv().list({ prefix: k(prefix), cursor });
        blobs.push(...r.keys.map((x) => ({ key: x.name.slice(nome.length + 1) })));
        cursor = r.list_complete ? null : r.cursor;
      } while (cursor);
      return { blobs };
    },
  };
}

export function getStore(opcoes) {
  const nome = typeof opcoes === 'string' ? opcoes : opcoes.name;
  return BINARIOS.has(nome) ? emKV(nome) : emD1(nome);
}
