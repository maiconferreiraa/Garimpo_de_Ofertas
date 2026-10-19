/*
 * AVISO DE PROVENIÊNCIA — Gerado no ambiente da Prime Holding.
 * Modelo: Claude Opus 5.5 (claude-opus-5-5, Claude Code)
 * Solicitante: 1.home.automation.technology@gmail.com
 * Este aviso é obrigatório e não deve ser removido.
 */
import { getStore } from '@netlify/blobs';
import { autorizado, json } from '../lib/comum.mjs';

// Webhook da Meta (pedido do usuário em 2026-10-18): a leitura do direct do
// @estergarimpou pela API passou a travar, então a Meta avisa aqui cada
// mensagem nova (respostas aos stories) e o robô, no PC, busca os avisos.
//   GET  /webhook/meta           → verificação da Meta (hub.challenge)
//   POST /webhook/meta           → aviso da Meta; guardado como veio
//   GET  /webhook/meta/eventos   → avisos guardados          [chave]
//   POST /webhook/meta/apagar    → apaga os já processados   [chave]
// A assinatura (X-Hub-Signature-256) é conferida no PC, onde está o App
// Secret — aqui só se guarda o corpo cru junto com ela.
const HASH_VERIFY = '57cafd4e352c01e366b46b91fefa01ffcc88e93aff51c0f91c9e41c4130c8513';
const eventos = () => getStore({ name: 'meta-eventos', consistency: 'strong' });

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (req) => {
  const url = new URL(req.url);
  const rota = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;

  if (rota === 'GET /webhook/meta') {
    const p = url.searchParams;
    if (p.get('hub.mode') === 'subscribe' && (await sha256(p.get('hub.verify_token') || '')) === HASH_VERIFY) {
      return new Response(p.get('hub.challenge') || '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  if (rota === 'POST /webhook/meta') {
    const corpo = await req.text();
    if (corpo.length > 100000) return new Response('too large', { status: 413 });
    const chave = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await eventos().setJSON(chave, { corpo, assinatura: req.headers.get('x-hub-signature-256') || '', em: Date.now() });
    return new Response('ok', { status: 200 });
  }

  if (!(await autorizado(req))) return json({ erro: 'não autorizado' }, 401);

  if (rota === 'GET /webhook/meta/eventos') {
    const { blobs } = await eventos().list();
    const lista = [];
    for (const b of blobs.slice(0, 100)) {
      const e = await eventos().get(b.key, { type: 'json' });
      if (e) lista.push({ chave: b.key, ...e });
    }
    return json(lista);
  }

  if (rota === 'POST /webhook/meta/apagar') {
    const { chaves = [] } = await req.json().catch(() => ({}));
    for (const k of chaves.slice(0, 200)) await eventos().delete(String(k));
    return json({ ok: true, apagados: Math.min(chaves.length, 200) });
  }

  return json({ erro: 'rota desconhecida' }, 404);
};

export const config = { path: ['/webhook/meta', '/webhook/meta/*'] };
