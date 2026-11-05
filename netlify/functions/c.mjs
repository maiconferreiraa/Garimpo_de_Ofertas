/*
 * AVISO DE PROVENIÊNCIA — Gerado no ambiente da Prime Holding.
 * Modelo: Claude Opus 5.5 (claude-opus-5-5, Claude Code)
 * Solicitante: 1.home.automation.technology@gmail.com
 * Este aviso é obrigatório e não deve ser removido.
 */
import { linksRastreados, contarClique, indique, agoraBrasil } from '../lib/comum.mjs';

// 🎁 Indique um amigo (pedido do usuário em 2026-11-05). Cada membro pede o
// link dele no privado da Ester Garimpou e recebe /c/<código>.
//   GET /c/<código>        → página "Fulano te convidou" com os 4 grupos
//   GET /c/<código>/<cat>  → conta 1 ponto pro código (1 por aparelho, e o
//                            mesmo aparelho só vale pra quem convidou
//                            primeiro) e manda pro convite do grupo
// Só o primeiro nome de quem convidou fica aqui; o número fica no PC.
const ROBOS = /bot|crawler|spider|facebookexternalhit|facebookcatalog|meta-externalagent|facebot|headless|lighthouse|whatsapp|telegram|preview|curl|wget|python|node-fetch|axios/i;
const GRUPOS = [
  ['diversos', '🛍️ Ofertas do dia', 'Ester Garimpou #10 — achadinhos de tudo'],
  ['ferramentas', '🔧 Ferramentas', 'Ferramentas Descontos & Cia'],
  ['moda', '💄 Moda & Beleza', 'Roupas, maquiagem e cuidados'],
  ['kids', '👶 Bebê & Kids', 'Tudo pros pequenos'],
];
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function pagina(codigo, nome) {
  const quem = nome ? `<b>${esc(nome)}</b> te convidou` : 'Você foi convidado(a)';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Convite — Ester Garimpou</title><meta name="robots" content="noindex">
<meta property="og:title" content="${nome ? `${esc(nome)} te convidou 🎁` : 'Convite 🎁'} — grupos de ofertas grátis">
<meta property="og:description" content="Achadinhos com desconto todo dia no WhatsApp. Entre de graça!">
<link rel="icon" href="/favicon-48.png">
<style>
:root{--fundo:#0a0a0c;--card:#17171c;--borda:#2a2a33;--texto:#fff;--sub:#a9a9b3;--laranja:#e05011;--verde:#25d366}
*{box-sizing:border-box;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--fundo);color:var(--texto);min-height:100vh;padding:28px 16px}
main{max-width:460px;margin:0 auto}
.topo{text-align:center;margin-bottom:22px}
.presente{font-size:54px}
h1{font-size:24px;margin:8px 0 6px;line-height:1.25}
.topo p{color:var(--sub);font-size:15px;line-height:1.45}
a.grupo{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--borda);border-radius:14px;padding:14px 16px;margin-bottom:10px;color:var(--texto);text-decoration:none}
a.grupo b{display:block;font-size:17px}
a.grupo span{color:var(--sub);font-size:13px}
a.grupo .entrar{margin-left:auto;background:var(--verde);color:#062b14;font-weight:700;border-radius:999px;padding:8px 14px;font-size:14px;white-space:nowrap}
.rodape{text-align:center;color:var(--sub);font-size:12px;margin-top:18px;line-height:1.5}
</style></head><body><main>
<div class="topo"><div class="presente">🎁</div><h1>${quem}<br>pros grupos de ofertas!</h1>
<p>Achadinhos com desconto de verdade, todo dia, no WhatsApp. É grátis e você sai quando quiser.</p></div>
${GRUPOS.map(([cat, titulo, sub]) => `<a class="grupo" href="/c/${esc(codigo)}/${cat}"><div><b>${titulo}</b><span>${esc(sub)}</span></div><span class="entrar">Entrar</span></a>`).join('')}
<p class="rodape">Ester Garimpou · grupos só de admins (sem spam de membros)<br>Ofertas com link de afiliado — você paga o mesmo preço.</p>
</main></body></html>`;
}

export default async (req, context) => {
  const codigo = String(context.params.codigo || '').toLowerCase();
  const cat = context.params.cat;
  if (!/^[a-z0-9]{4,8}$/.test(codigo)) return Response.redirect(new URL('/', req.url), 302);
  const store = indique();

  if (!cat) {
    const c = await store.get(`c:${codigo}`, { type: 'json' }).catch(() => null);
    return new Response(pagina(codigo, c?.nome), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  if (!GRUPOS.some(([k]) => k === cat)) return Response.redirect(new URL(`/c/${codigo}`, req.url), 302);
  const grupo = await linksRastreados().get(`grupo-${cat}`, { type: 'json' }).catch(() => null);
  const destino = grupo?.url || new URL('/', req.url).toString();
  const ua = req.headers.get('user-agent') || '';

  if (!ROBOS.test(ua)) {
    try {
      // aparelho = cookie próprio (ou IP + navegador, se o cookie não vier)
      const cookie = (req.headers.get('cookie') || '').match(/(?:^|;\s*)eg_v=([a-f0-9]{32})/)?.[1];
      const visitante = cookie || (await sha256(`${context.ip || ''}|${ua}`));
      const registrado = (await store.get(`c:${codigo}`, { type: 'json' })) !== null;
      if (registrado && !(await store.get(`v:${visitante}`))) {
        await store.setJSON(`v:${visitante}`, { codigo, em: Date.now() });
        const { dia } = agoraBrasil();
        const p = (await store.get(`p:${codigo}`, { type: 'json' })) || { total: 0, dias: {} };
        p.total += 1;
        p.dias[dia] = (p.dias[dia] || 0) + 1;
        await store.setJSON(`p:${codigo}`, p);
      }
      await contarClique(`grupo-${cat}`);
      await contarClique(`grupo-${cat}~indica`);
      return new Response(null, {
        status: 302,
        headers: { location: destino, 'cache-control': 'no-store', 'set-cookie': `eg_v=${visitante}; Max-Age=31536000; Path=/c; Secure; HttpOnly; SameSite=Lax` },
      });
    } catch {
      // contar é secundário — o convite nunca pode falhar por isso
    }
  }
  return new Response(null, { status: 302, headers: { location: destino, 'cache-control': 'no-store' } });
};

export const config = { path: ['/c/:codigo', '/c/:codigo/:cat'] };
