import { linksRastreados, cliques, vitrine, imagens, autorizado, json } from '../lib/comum.mjs';

// API usada pelo robô (escrita, com chave) e pela própria página (leitura
// pública da vitrine):
//   GET  /api/saude              → { ok: true }
//   GET  /api/vitrine            → ofertas recentes (público)
//   POST /api/links              → registra links rastreados   [chave]
//   POST /api/vitrine/oferta     → adiciona oferta na vitrine   [chave]
//   GET  /api/cliques            → contagem de cliques de todos [chave]
const MAX_OFERTAS = 40;
const VALIDADE_OFERTA_MS = 48 * 60 * 60 * 1000;

export default async (req) => {
  const { pathname } = new URL(req.url);
  const rota = `${req.method} ${pathname.replace(/\/+$/, '')}`;

  if (rota === 'GET /api/saude') return json({ ok: true });

  if (rota === 'GET /api/vitrine') {
    const lista = (await vitrine().get('ofertas', { type: 'json' })) || [];
    const limite = Date.now() - VALIDADE_OFERTA_MS;
    return json(lista.filter((o) => o.publicadoEm >= limite), 200, { 'cache-control': 'public, max-age=60' });
  }

  if (!(await autorizado(req))) return json({ erro: 'não autorizado' }, 401);

  if (rota === 'POST /api/links') {
    const { links = [] } = await req.json();
    const store = linksRastreados();
    for (const l of links) {
      if (l?.id && /^https?:\/\//.test(l.url || '')) await store.setJSON(l.id, { url: l.url, criadoEm: Date.now() });
    }
    return json({ ok: true, registrados: links.length });
  }

  if (rota === 'POST /api/vitrine/oferta') {
    const { oferta, imagemBase64 } = await req.json();
    if (!oferta?.id || !oferta.titulo) return json({ erro: 'oferta inválida' }, 400);
    if (imagemBase64) {
      const bytes = Uint8Array.from(atob(imagemBase64), (c) => c.charCodeAt(0));
      await imagens().set(oferta.id, bytes);
      oferta.imagem = `/img-oferta/${oferta.id}`;
    }
    const store = vitrine();
    const lista = ((await store.get('ofertas', { type: 'json' })) || []).filter((o) => o.id !== oferta.id);
    lista.unshift({ ...oferta, publicadoEm: Date.now() });
    await store.setJSON('ofertas', lista.slice(0, MAX_OFERTAS));
    return json({ ok: true });
  }

  if (rota === 'GET /api/cliques') {
    const store = cliques();
    const { blobs } = await store.list();
    const resultado = {};
    for (const b of blobs) resultado[b.key] = await store.get(b.key, { type: 'json' });
    return json(resultado);
  }

  return json({ erro: 'rota não encontrada' }, 404);
};

export const config = { path: '/api/*' };
