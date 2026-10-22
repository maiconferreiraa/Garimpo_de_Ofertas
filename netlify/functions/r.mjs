import { linksRastreados, contarClique } from '../lib/comum.mjs';

// Link rastreado dos posts: /r/<id> → conta o clique e manda pro link de
// afiliado de verdade (302). Id desconhecido cai na página inicial, nunca
// numa página de erro.
const ROBOS = /bot|crawler|spider|facebookexternalhit|facebookcatalog|meta-externalagent|facebot|headless|lighthouse|whatsapp|telegram|preview|curl|wget|python|node-fetch|axios/i;

// Clique de anúncio (?o=anuncio) só conta se veio de gente: a Meta põe
// ?fbclid= em todo clique de verdade, e o navegador do app do Facebook/
// Instagram se identifica (FBAN/FBAV/Instagram). Sem nenhum dos dois é a
// própria Meta abrindo o link pra revisar o anúncio (2026-10-22: o conjunto
// de Ferramentas, PAUSADO, somou 10 "entradas" na revisão). Esses vão pra
// "<id>~anuncio-robo", só pra conferência — o painel não soma.
const APP_META = /FBAN|FBAV|FB_IAB|Instagram/;
const ehGenteDoAnuncio = (req) => new URL(req.url).searchParams.has('fbclid') || APP_META.test(req.headers.get('user-agent') || '');

export default async (req, context) => {
  const id = context.params.id;
  const link = await linksRastreados().get(id, { type: 'json' });
  if (!link?.url) return Response.redirect(new URL('/', req.url), 302);

  if (!ROBOS.test(req.headers.get('user-agent') || '')) {
    try {
      await contarClique(id);
      // ?o=<origem>: de onde a pessoa veio (ex.: "compartilhe", a mensagem
      // de compartilhar nos grupos) — contado à parte em "<id>~<origem>".
      const origem = new URL(req.url).searchParams.get('o');
      if (origem && /^[a-z0-9-]{1,20}$/.test(origem)) {
        await contarClique(origem === 'anuncio' && !ehGenteDoAnuncio(req) ? `${id}~anuncio-robo` : `${id}~${origem}`);
      }
    } catch {
      // contar é secundário — o redirecionamento nunca pode falhar por isso
    }
  }
  // ?c=<canal> (tg, ig, fb, site): mesmo produto, com a marca do canal no
  // link de afiliado, pra saber qual canal vende. Sem ?c (WhatsApp) ou canal
  // desconhecido → destino padrão; link sem canais → o original.
  const canal = new URL(req.url).searchParams.get('c');
  const destino = link.canais?.[canal] || link.canais?.padrao || link.url;
  return new Response(null, { status: 302, headers: { location: destino, 'cache-control': 'no-store' } });
};

export const config = { path: '/r/:id' };

