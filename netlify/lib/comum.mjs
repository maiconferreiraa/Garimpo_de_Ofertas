import { getStore } from '@netlify/blobs';

// Só o robô (robo_ml_afiliados, no PC) escreve aqui — ele manda a chave em
// "Authorization: Bearer <chave>". A chave de verdade fica só no PC
// (data/site-token.json); aqui no repositório vai apenas o SHA-256 dela.
const HASH_CHAVE = '3cb002dc988dfc92d77e6e2310b4548c41883dff6673693837bd3f94617f538f';

export const linksRastreados = () => getStore({ name: 'links', consistency: 'strong' });
export const cliques = () => getStore({ name: 'cliques', consistency: 'strong' });
export const vitrine = () => getStore({ name: 'vitrine', consistency: 'strong' });
export const imagens = () => getStore({ name: 'imagens' });

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function autorizado(req) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  return Boolean(m) && (await sha256(m[1])) === HASH_CHAVE;
}

export function json(dados, status = 200, extra = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

// Data/hora no fuso de Brasília — o relatório de cliques é por dia e por
// hora local, não UTC.
export function agoraBrasil() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: partes.hour };
}
