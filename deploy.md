# Deploy — Garimpo de Ofertas

Site 100% estático. Essa pasta inteira (`site/`) é o que precisa subir — nada
de build, nada de servidor.

Conteúdo:
- `index.html` — a página
- `img/` — todas as imagens (fotos dos produtos, logos dos grupos)
- `favicon-16.png` / `favicon-32.png` / `favicon-48.png` / `favicon-180.png` — ícone do site
- `robots.txt`

## Antes de subir

Em `index.html`, trocar todo `https://SEU-DOMINIO-AQUI` pelo domínio real
(3 ocorrências: `link rel="canonical"`, `og:url`, `og:image`). Sem isso o
preview de link no WhatsApp/Instagram não funciona — precisa ser URL
absoluta com o domínio de verdade, não caminho relativo.

Comando rápido depois de saber o domínio (rode dentro da pasta `site/`):

```bash
sed -i 's|https://SEU-DOMINIO-AQUI|https://SEUDOMINIOREAL.com.br|g' index.html
```

## Onde hospedar (qualquer uma serve, é só arquivo estático)

**Netlify (mais simples, sem terminal)**
1. netlify.com → arrastar a pasta `site/` inteira pra área de "Deploy manually"
2. Pronto, já sai com URL. Depois em Site settings → Domain management → Add custom domain

**Vercel**
```bash
cd site
npx vercel --prod
```
Depois `vercel domains add SEUDOMINIO.com.br`

**GitHub Pages**
1. Criar repo, colocar o conteúdo de `site/` na raiz (ou usar branch `gh-pages`)
2. Settings → Pages → escolher a branch
3. Settings → Pages → Custom domain

**Hospedagem tradicional (cPanel/FTP)**
Copiar o conteúdo de `site/` pra `public_html/` (ou pasta equivalente) via
FTP/File Manager. Não precisa de PHP nem banco de dados.

## Depois de subir

- Testar o preview do link mandando pra você mesmo no WhatsApp (o card com
  imagem só aparece depois que os 3 `SEU-DOMINIO-AQUI` acima forem trocados)
- Testar no celular de verdade: carrossel, botão flutuante (canto inferior
  direito) e os dois botões de entrar no grupo
