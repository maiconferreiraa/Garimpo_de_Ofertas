/*
 * AVISO DE PROVENIÊNCIA — Gerado no ambiente da Prime Holding.
 * Modelo: Claude Opus 5.5 (claude-opus-5-5, Claude Code)
 * Solicitante: 1.home.automation.technology@gmail.com
 * Este aviso é obrigatório e não deve ser removido.
 */
import { getStore } from '@netlify/blobs';

// ⚡ Resposta NA HORA no Instagram (pedido do usuário em 2026-11-05: "a
// resposta deve ser mais rápida, senão a pessoa desiste da compra").
// O aviso da Meta (comentário "quero", toque no botão, resposta ao story)
// chega aqui e a própria função já responde pela Graph API — 1 a 2 s, sem
// esperar o robô do PC buscar os avisos. Mesmo fluxo do robô
// (src/instagramComentarios.js): botão "Quero o link" → confere se segue →
// "Quase lá" com "Já segui" ou link em BOTÃO + cartões dos grupos (a conta
// está com restrição de links: texto com URL é recusado no direct).
// O robô manda pra cá (POST /webhook/meta/config, com a chave) o token da
// página, o App Secret, os links dos posts e os grupos; sem isso a função
// só guarda o aviso, como antes, e o robô responde sozinho.

const configStore = () => getStore({ name: 'meta-config', consistency: 'strong' });
const feitos = () => getStore({ name: 'meta-feito', consistency: 'strong' });
const GRAPH = 'https://graph.facebook.com/v21.0';
const PEDIU = /\b(quero+|qro+|kero+)\b/i;
const DIA = 24 * 60 * 60 * 1000;

export const lerConfig = async () => (await configStore().get('ig', { type: 'json' })) || null;
export const gravarConfig = (c) => configStore().setJSON('ig', { ...c, em: Date.now() });

async function hmacHex(segredo, texto) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function graph(caminho, { metodo = 'GET', params = {}, corpo } = {}) {
  const u = new URL(`${GRAPH}/${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, metodo === 'GET'
    ? { signal: AbortSignal.timeout(8000) }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(8000) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error?.message || `HTTP ${res.status}`);
  return d;
}

const enviar = (c, recipient, message) => graph(`${c.pageId}/messages`, { metodo: 'POST', corpo: { access_token: c.pageToken, recipient, message } });
const comBotao = (text, title, payload) => ({ attachment: { type: 'template', payload: { template_type: 'button', text, buttons: [{ type: 'postback', title, payload }] } } });

function msgLink(c, midia) {
  const url = midia.link || `https://${c.site}`;
  const texto = midia.link ? `Oi! 😊 Aqui está o que você pediu:${midia.titulo ? `\n\n🛍️ ${midia.titulo}` : ''}` : 'Oi! 😊 Essa oferta está no nosso site, junto com as outras de hoje 👇';
  return { attachment: { type: 'template', payload: { template_type: 'button', text: texto.slice(0, 640), buttons: [{ type: 'web_url', url, title: midia.link ? 'Ver oferta 🛒' : 'Abrir o site 👥' }] } } };
}

function msgConvite(c) {
  const grupos = c.grupos || [];
  if (!grupos.length) return { attachment: { type: 'template', payload: { template_type: 'button', text: '👥 Ofertas assim todo dia nos nossos grupos grátis do WhatsApp', buttons: [{ type: 'web_url', url: `https://${c.site}`, title: 'Ver os grupos 👥' }] } } };
  return { attachment: { type: 'template', payload: { template_type: 'generic', elements: grupos.map((g) => ({ title: g.nome, subtitle: 'Grupo grátis no WhatsApp — ofertas novas todo dia', buttons: [{ type: 'web_url', url: g.url, title: 'Entrar no grupo' }] })) } } };
}

// Marca "já feito" ANTES de responder (a Meta reenvia o aviso se demorar);
// se a resposta falhar, desmarca e o robô do PC tenta.
async function reservar(chave) {
  if (await feitos().get(chave)) return false;
  await feitos().setJSON(chave, { em: Date.now() });
  return true;
}

async function segue(c, igsid) {
  try {
    const p = await graph(igsid, { params: { fields: 'is_user_follow_business', access_token: c.pageToken } });
    return p.is_user_follow_business !== false;
  } catch {
    return true; // na dúvida, não perde a venda
  }
}

async function entregar(c, igsid, tipo, id) {
  const midia = (tipo === 's' ? c.stories : c.midias)?.find((m) => m.id === id) || { id };
  const chaveSeguir = `seguir:${igsid}`;
  const s = (await feitos().get(chaveSeguir, { type: 'json' })) || { vezes: 0 };
  if (c.seguirAntes && s.vezes < (c.seguirMax || 2) && !(await segue(c, igsid))) {
    await enviar(c, { id: igsid }, comBotao(`Quase lá! 😊 O link é pra quem segue o @${c.perfil}.\n\nToca em "Seguir" lá no perfil e depois no botão aqui embaixo 👇`, 'Já segui ✅', `SEGUI:${tipo}:${id}`));
    await feitos().setJSON(chaveSeguir, { vezes: s.vezes + 1, em: Date.now() });
    return 'pediu-seguir';
  }
  await enviar(c, { id: igsid }, msgLink(c, midia));
  if (c.conviteGrupos) await enviar(c, { id: igsid }, msgConvite(c)).catch(() => {});
  await feitos().delete(chaveSeguir);
  return 'link';
}

async function comentario(c, v) {
  if (!v?.id || v.from?.id === c.igId || !PEDIU.test(v.text || '')) return null;
  if (!(await reservar(`c:${v.id}`))) return null;
  const midia = c.midias?.find((m) => m.id === v.media?.id) || { id: v.media?.id };
  try {
    if (c.seguirAntes) {
      const titulo = midia.titulo ? `: ${midia.titulo.slice(0, 60)}` : '';
      try {
        await enviar(c, { comment_id: v.id }, comBotao(`Oi! 😊 Vi que você quer o link${titulo}.\n\nToca no botão aqui embaixo que eu te mando 👇`, 'Quero o link 🛒', `LINK:c:${midia.id}`));
      } catch {
        await enviar(c, { comment_id: v.id }, msgLink(c, midia)); // botão recusado → link direto (em botão)
      }
    } else {
      await enviar(c, { comment_id: v.id }, msgLink(c, midia));
    }
  } catch (err) {
    await feitos().delete(`c:${v.id}`);
    throw err;
  }
  await graph(`${v.id}/replies`, { metodo: 'POST', corpo: { access_token: c.pageToken, message: 'Te mandei o link no privado! 📩' } }).catch(() => {});
  return v.id;
}

async function mensagem(c, m) {
  if (!m?.sender?.id || m.sender.id === c.igId || Date.now() - (m.timestamp || Date.now()) > DIA) return null;
  const msg = m.message || (m.postback ? { mid: m.postback.mid || `pb:${m.sender.id}:${m.timestamp}`, quick_reply: { payload: m.postback.payload } } : null);
  if (!msg || msg.is_echo || !msg.mid) return null;
  const botao = String(msg.quick_reply?.payload || '').match(/^(LINK|SEGUI):([cs]):(.+)$/);
  const storyId = msg.reply_to?.story?.id;
  let tipo;
  let id;
  if (botao) [tipo, id] = [botao[2], botao[3]];
  else if (storyId && PEDIU.test(msg.text || '')) [tipo, id] = ['s', storyId];
  else return null;
  if (!(await reservar(`m:${msg.mid}`))) return null;
  try {
    await entregar(c, m.sender.id, tipo, id);
  } catch (err) {
    await feitos().delete(`m:${msg.mid}`);
    throw err;
  }
  return msg.mid;
}

// Responde o que der a partir do corpo cru do aviso. Devolve o que foi
// tratado, pra o robô do PC não responder de novo.
export async function responderNaHora(corpo, assinatura) {
  const c = await lerConfig();
  if (!c?.ativo || !c.appSecret || !c.pageToken) return null;
  if (`sha256=${await hmacHex(c.appSecret, corpo)}` !== assinatura) return null;
  let dados;
  try { dados = JSON.parse(corpo); } catch { return null; }
  const tratado = { comentarios: [], mids: [], erros: [] };
  for (const entrada of dados.entry || []) {
    for (const ch of entrada.changes || []) {
      if (ch.field !== 'comments') continue;
      try { const id = await comentario(c, ch.value); if (id) tratado.comentarios.push(id); } catch (err) { tratado.erros.push(String(err.message).slice(0, 200)); }
    }
    for (const m of entrada.messaging || []) {
      try { const mid = await mensagem(c, m); if (mid) tratado.mids.push(mid); } catch (err) { tratado.erros.push(String(err.message).slice(0, 200)); }
    }
  }
  return tratado;
}
