import { videos } from '../lib/comum.mjs';

// Vídeo do reel do dia, guardado pelo robô em POST /api/video. O Instagram
// baixa daqui pra publicar o reel (a API dele só aceita URL pública).
export default async () => {
  const dados = await videos().get('reel', { type: 'arrayBuffer' });
  if (!dados) return new Response('vídeo não encontrado', { status: 404 });
  return new Response(dados, {
    headers: { 'content-type': 'video/mp4', 'content-length': String(dados.byteLength), 'cache-control': 'public, max-age=300' },
  });
};

export const config = { path: '/video/reel.mp4' };
