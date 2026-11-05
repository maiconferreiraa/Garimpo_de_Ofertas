import { linksRastreados, cliques, vitrine, imagens, videos, indique, autorizado, json, contarClique } from '../lib/comum.mjs';

// API usada pelo robô (escrita, com chave) e pela própria página (leitura
// pública da vitrine):
//   GET  /api/saude              → { ok: true }
//   GET  /api/vitrine            → ofertas recentes (público)
//   GET  /api/oferta/<id>        → uma oferta, pra página /o/<id> (público)
//   POST /api/visita             → conta visita vinda de uma origem (público)
//   POST /api/links              → registra links rastreados   [chave]
//   POST /api/vitrine/oferta     → adiciona oferta na vitrine   [chave]
//   POST /api/vitrine/remover    → tira ofertas (esgotou/subiu) [chave]
//   POST /api/vitrine/preco      → corrige o preço de uma oferta [chave]
//   POST /api/video              → guarda o vídeo do reel do dia [chave]
//   GET  /api/cliques            → contagem de cliques de todos [chave]
//   POST /api/indique/registrar  → código + primeiro nome de quem indica [chave]
//   GET  /api/indique/pontos     → pontos de cada código (indique um amigo) [chave]
//   GET  /api/indique/cadastros  → nome + WhatsApp de quem gerou link no site [chave]
//   POST /api/indique/gerar      → gera o link de convite (público, ver /indique)
//   GET  /api/indique/meus/<cód> → pontos de um código (público)
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

  // 🎁 Indique um amigo pelo site (2026-11-05: "a pessoa já clicar no link e
  // ele gerar o seu link automático"). Público: nome + WhatsApp → código.
  // O mesmo número sempre recebe o mesmo código. Até 5 cadastros por
  // aparelho/IP por dia. O número fica num store privado (só o robô lê, com
  // a chave) e serve só pra avisar quem ganhar e conferir se está no grupo.
  if (rota === 'POST /api/indique/gerar') {
    let corpo = {};
    try { corpo = await req.json(); } catch {}
    const nome = String(corpo.nome || '').replace(/[^\p{L}\s'-]/gu, ' ').trim().split(/\s+/)[0]?.slice(0, 20) || '';
    let numero = String(corpo.numero || '').replace(/\D/g, '');
    if (numero.length === 10 || numero.length === 11) numero = `55${numero}`;
    if (!nome) return json({ erro: 'Escreva seu primeiro nome.' }, 400);
    if (!/^55\d{10,11}$/.test(numero)) return json({ erro: 'Confira o WhatsApp com DDD, ex.: (31) 99999-9999.' }, 400);
    const store = indique();
    const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '';
    const chaveIp = `ip:${(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)).then((b) => [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('')))}:${new Date().toISOString().slice(0, 10)}`;
    const existente = await store.get(`n:${numero}`);
    if (existente) return json({ codigo: existente, novo: false });
    const vezes = Number(await store.get(chaveIp)) || 0;
    if (vezes >= 5) return json({ erro: 'Muitos cadastros por aqui hoje. Tente amanhã.' }, 429);
    const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
    let codigo;
    do codigo = Array.from({ length: 5 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
    while (await store.get(`c:${codigo}`));
    await store.setJSON(`c:${codigo}`, { nome, em: Date.now(), origem: 'site' });
    await store.set(`n:${numero}`, codigo);
    await store.setJSON(`cad:${codigo}`, { nome, numero, em: Date.now() });
    await store.set(chaveIp, String(vezes + 1));
    return json({ codigo, novo: true });
  }

  // Pontos de um código (a própria pessoa vê na página /indique)
  const mPontos = pathname.match(/^\/api\/indique\/meus\/([a-z0-9]{4,8})\/?$/);
  if (req.method === 'GET' && mPontos) {
    const p = await indique().get(`p:${mPontos[1]}`, { type: 'json' });
    return json({ total: p?.total || 0 }, 200, { 'cache-control': 'no-store' });
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
    let comCanais = 0;
    for (const l of links) {
      if (!l?.id || !/^https?:\/\//.test(l.url || '')) continue;
      // canais: destino do mesmo produto marcado por canal (ver r.mjs)
      const canais = {};
      for (const [c, u] of Object.entries(l.canais || {})) if (/^[a-z]{1,10}$/.test(c) && /^https:\/\//.test(u || '')) canais[c] = u;
      await store.setJSON(l.id, { url: l.url, criadoEm: Date.now(), ...(Object.keys(canais).length ? { canais } : {}) });
      if (Object.keys(canais).length) comCanais++;
    }
    return json({ ok: true, registrados: links.length, comCanais });
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

  // Faxina (faxinaVitrine.js no robô): produto que saiu do ar ou subiu de
  // preço sai da lista e da página /o/<id>.
  if (rota === 'POST /api/vitrine/remover') {
    const { ids = [] } = await req.json();
    const fora = new Set(ids.filter((id) => /^[a-f0-9]{12}$/.test(id)));
    const store = vitrine();
    const lista = (await store.get('ofertas', { type: 'json' })) || [];
    await store.setJSON('ofertas', lista.filter((o) => !fora.has(o.id)));
    for (const id of fora) await store.delete(`o-${id}`);
    return json({ ok: true, removidas: fora.size });
  }

  // Mesmo produto ficou mais barato depois do post: só troca o preço (a
  // data de publicação e a validade continuam as do post).
  if (rota === 'POST /api/vitrine/preco') {
    const { id, preco, precoDe } = await req.json();
    if (!/^[a-f0-9]{12}$/.test(id || '') || !(Number(preco) > 0)) return json({ erro: 'dados inválidos' }, 400);
    const store = vitrine();
    const trocar = (o) => ({ ...o, preco: Number(preco), precoDe: Number(precoDe) > Number(preco) ? Number(precoDe) : o.precoDe });
    const lista = (await store.get('ofertas', { type: 'json' })) || [];
    await store.setJSON('ofertas', lista.map((o) => (o.id === id ? trocar(o) : o)));
    const avulsa = await store.get(`o-${id}`, { type: 'json' });
    if (avulsa) await store.setJSON(`o-${id}`, trocar(avulsa));
    return json({ ok: true });
  }

  // Vídeo do reel do dia (reels.js no robô): o Instagram só aceita vídeo
  // por URL pública. Guarda um só (o de hoje substitui o de ontem) e serve
  // em /video/reel.mp4 (netlify/functions/video.mjs).
  if (rota === 'POST /api/video') {
    const { videoBase64 } = await req.json();
    if (!videoBase64) return json({ erro: 'vídeo vazio' }, 400);
    const bytes = Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0));
    await videos().set('reel', bytes);
    return json({ ok: true, caminho: `/video/reel.mp4?v=${Date.now()}`, bytes: bytes.length });
  }

  // 🎁 Indique um amigo (2026-11-05) — ver c.mjs
  if (rota === 'POST /api/indique/registrar') {
    const { codigo, nome, numero } = await req.json();
    if (!/^[a-z0-9]{4,8}$/.test(codigo || '')) return json({ erro: 'código inválido' }, 400);
    await indique().setJSON(`c:${codigo}`, { nome: String(nome || '').slice(0, 20), em: Date.now() });
    // mesmo número no site depois → mesmo código (pediu primeiro pelo privado)
    if (/^55\d{10,11}$/.test(numero || '')) await indique().set(`n:${numero}`, codigo);
    return json({ ok: true });
  }

  if (rota === 'GET /api/indique/cadastros') {
    const store = indique();
    const { blobs } = await store.list({ prefix: 'cad:' });
    const resultado = {};
    for (const b of blobs) resultado[b.key.slice(4)] = await store.get(b.key, { type: 'json' });
    return json(resultado);
  }

  if (rota === 'GET /api/indique/pontos') {
    const store = indique();
    const { blobs } = await store.list({ prefix: 'p:' });
    const resultado = {};
    for (const b of blobs) resultado[b.key.slice(2)] = await store.get(b.key, { type: 'json' });
    return json(resultado);
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
