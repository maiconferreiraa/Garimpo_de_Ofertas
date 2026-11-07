/*
 * AVISO DE PROVENIÊNCIA — Gerado no ambiente da Prime Holding.
 * Modelo: Claude Opus 5.5 (claude-opus-5-5, Claude Code)
 * Solicitante: 1.home.automation.technology@gmail.com
 * Este aviso é obrigatório e não deve ser removido.
 */
// Site na Cloudflare (2026-11-07). Usa as MESMAS funções de netlify/functions
// (cada uma com seu `config.path`); o @netlify/blobs vira cloudflare/blobs.mjs
// (alias no wrangler.jsonc). O resto é arquivo estático (env.ASSETS).
import { usarEnv } from './blobs.mjs';
import * as api from '../netlify/functions/api.mjs';
import * as r from '../netlify/functions/r.mjs';
import * as c from '../netlify/functions/c.mjs';
import * as img from '../netlify/functions/img.mjs';
import * as video from '../netlify/functions/video.mjs';
import * as meta from '../netlify/functions/meta.mjs';

// '/r/:id' → regex com grupos nomeados; '/*' → qualquer resto
function compilar(p) {
  const re = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/\*$/, '(?:/.*)?').replace(/:([a-zA-Z]+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${re}/?$`);
}

const ROTAS = [api, r, c, img, video, meta].flatMap((m) =>
  [].concat(m.config.path).map((p) => ({ re: compilar(p), fn: m.default }))
);

export default {
  async fetch(req, env, ctx) {
    usarEnv(env);
    const url = new URL(req.url);
    // endereço antigo de oferta (/o/<id>): a própria index.html lê o id
    if (url.pathname.startsWith('/o/')) return env.ASSETS.fetch(new Request(new URL('/', url), req));
    for (const { re, fn } of ROTAS) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const ip = req.headers.get('cf-connecting-ip') || '';
      const h = new Headers(req.headers);
      h.set('x-nf-client-connection-ip', ip);
      const req2 = new Request(req, { headers: h });
      try {
        return await fn(req2, { params: { ...(m.groups || {}) }, ip, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (err) {
        console.error(url.pathname, err?.stack || err);
        return new Response('Erro no site', { status: 500 });
      }
    }
    return env.ASSETS.fetch(req);
  },
};
