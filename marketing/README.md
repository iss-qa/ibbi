# PastorIA · Kit de divulgação

Material gerado a partir da landing page (`frontend/src/pages/Landing/`), com a mesma marca, os mesmos textos e os mesmos planos.

| Pasta | Conteúdo |
|---|---|
| `cards/` | 12 cards de feed (1080×1350), 3 stories (1080×1920) e 1 banner de LinkedIn ou capa de link (1200×627) |
| `videos/` | 2 Reels 9:16 em MP4 com narração, versões sem áudio e capas JPG |
| `audios/` | spot de 30s, spot de 15s e áudio de indicação para WhatsApp |
| `copy/legendas-e-posts.md` | legendas por card, carrossel, stories, LinkedIn, WhatsApp, email, anúncios e calendário de 2 semanas |
| `copy/roteiros.md` | roteiros dos vídeos e áudios, e 2 roteiros para gravar com pessoas |
| `prompts/prompts-ia.md` | prompts de imagem, vídeo, voz, trilha e texto |
| `src/` | fontes em HTML e scripts para regenerar tudo |

## Regenerar
Rode a partir da raiz do repositório. É preciso ter Playwright com o Chromium em cache, ffmpeg e a voz `Luciana` do macOS.
```bash
node marketing/src/render-cards.js                  # todos os PNGs
node marketing/src/render-videos.js                 # áudios e os 2 vídeos
node marketing/src/render-videos.js chamada         # só um vídeo (manifesto | chamada | audios)
VOICE=Flo node marketing/src/render-videos.js       # outra voz do sistema
```
Para editar um card, altere `src/cards.html`. Para mudar a narração, edite `segments` em `src/render-videos.js`: a duração de cada cena se ajusta à locução.

## Antes de publicar
- **A locução é provisória** (TTS do macOS) e a trilha é um acorde sintetizado. Para a versão final, grave um locutor ou use os prompts de `prompts/`, mantendo os mesmos cortes.
- Os nomes nas conversas (Pr. Marcos, Bruno etc.) são fictícios, como na landing.
- Revise se o card `feed-10-origem` pode citar a Igreja Batista Bíblica Israel nominalmente (a landing já cita).
- Troque "link na bio" pela URL de produção do `/cadastro`.
