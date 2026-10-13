import { linksRastreados, contarClique } from '../lib/comum.mjs';

// Link rastreado dos posts: /r/<id> → conta o clique e manda pro link de
// afiliado de verdade (302). Id desconhecido cai na página inicial, nunca
// numa página de erro.
const ROBOS = /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|preview|curl|wget/i;

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
      if (origem && /^[a-z0-9-]{1,20}$/.test(origem)) await contarClique(`${id}~${origem}`);
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

