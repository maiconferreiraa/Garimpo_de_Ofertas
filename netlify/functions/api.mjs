import { linksRastreados, cliques, vitrine, imagens, autorizado, json, contarClique } from '../lib/comum.mjs';

// API usada pelo robô (escrita, com chave) e pela própria página (leitura
// pública da vitrine):
//   GET  /api/saude              → { ok: true }
//   GET  /api/vitrine            → ofertas recentes (público)
//   GET  /api/oferta/<id>        → uma oferta, pra página /o/<id> (público)
//   POST /api/visita             → conta visita vinda de uma origem (público)
//   POST /api/links              → registra links rastreados   [chave]
//   POST /api/vitrine/oferta     → adiciona oferta na vitrine   [chave]
//   GET  /api/cliques            → contagem de cliques de todos [chave]
// Cada oferta fica no site pelo tempo que o link da plataforma vale (pedido
// do usuário em 2026-09-29): Shopee 7 dias, Mercado Livre (e o resto) 24h,
// contadas do horário em que saiu. Vale pra vitrine e pra página /o/<id>.
// A página mostra em páginas de 8, passando pro lado.
const MAX_OFERTAS = 1000;
const HORA_MS = 60 * 60 * 1000;
const VALIDADE_POR_PLATAFORMA_MS = { shopee: 7 * 24 * HORA_MS };
const VALIDADE_PADRAO_MS = 24 * HORA_MS;

function expiraEm(o) {
  return o.publicadoEm + (VALIDADE_POR_PLATAFORMA_MS[o.plataforma] ?? VALIDADE_PADRAO_MS);
}

function ofertaValida(o) {
  return Date.now() < expiraEm(o);
}

export default async (req) => {
  const { pathname } = new URL(req.url);
  const rota = `${req.method} ${pathname.replace(/\/+$/, '')}`;

  if (rota === 'GET /api/saude') return json({ ok: true });

  if (rota === 'GET /api/vitrine') {
    const lista = (await vitrine().get('ofertas', { type: 'json' })) || [];
    return json(lista.filter(ofertaValida).map((o) => ({ ...o, expiraEm: expiraEm(o) })), 200, { 'cache-control': 'public, max-age=60' });
  }

  // Página de uma oferta só (/o/<id>, link do status do WhatsApp). Cada
  // oferta fica guardada também avulsa ("o-<id>"), porque a lista só tem
  // as 40 mais recentes e o robô posta bem mais que isso por dia.
  const mOferta = pathname.match(/^\/api\/oferta\/([a-f0-9]{12})\/?$/);
  if (req.method === 'GET' && mOferta) {
    const store = vitrine();
    const oferta = (await store.get(`o-${mOferta[1]}`, { type: 'json' }))
      || ((await store.get('ofertas', { type: 'json' })) || []).find((o) => o.id === mOferta[1]);
    if (!oferta || !ofertaValida(oferta)) return json({ erro: 'oferta não encontrada' }, 404);
    return json({ ...oferta, expiraEm: expiraEm(oferta) }, 200, { 'cache-control': 'public, max-age=300' });
  }

  // Visita que chegou por um link com origem (?c=compartilhe) — a página
  // manda 1x por visitante. Fica em "visita-<origem>" junto dos cliques.
  if (rota === 'POST /api/visita') {
    try {
      const { origem } = await req.json();
      if (/^[a-z0-9-]{1,20}$/.test(origem || '')) await contarClique(`visita-${origem}`);
    } catch {}
    return json({ ok: true });
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
    await store.setJSON(`o-${oferta.id}`, { ...oferta, publicadoEm: Date.now() });
    await store.setJSON('ofertas', lista.filter(ofertaValida).slice(0, MAX_OFERTAS));
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
