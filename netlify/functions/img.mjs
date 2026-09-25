import { imagens } from '../lib/comum.mjs';

// Fotos das ofertas da vitrine (enviadas pelo robô junto com cada oferta).
export default async (req, context) => {
  const img = await imagens().get(context.params.id, { type: 'arrayBuffer' });
  if (!img) return new Response('Não encontrada', { status: 404 });
  return new Response(img, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800, immutable' },
  });
};

export const config = { path: '/img-oferta/:id' };
