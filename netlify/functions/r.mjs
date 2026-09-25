import { linksRastreados, cliques, agoraBrasil } from '../lib/comum.mjs';

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
      const { dia, hora } = agoraBrasil();
      const store = cliques();
      const atual = (await store.get(id, { type: 'json' })) || { total: 0, dias: {}, horas: {} };
      atual.total += 1;
      atual.dias[dia] = (atual.dias[dia] || 0) + 1;
      atual.horas[hora] = (atual.horas[hora] || 0) + 1;
      await store.setJSON(id, atual);
    } catch {
      // contar é secundário — o redirecionamento nunca pode falhar por isso
    }
  }
  return new Response(null, { status: 302, headers: { location: link.url, 'cache-control': 'no-store' } });
};

export const config = { path: '/r/:id' };
