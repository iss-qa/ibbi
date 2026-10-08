# PastorIA · Prompts para IA generativa

Use estes prompts em ferramentas de imagem (Midjourney, Ideogram, Flux, DALL·E), vídeo (Veo, Sora, Runway, Kling, Higgsfield), voz (ElevenLabs) e texto (Claude).

**Regras de marca para qualquer peça gerada**
- Paleta: navy `#0a1f44`, dourado `#c9a227`, azul royal `#0b4dbf`, creme `#f7f3ea`.
- Tipografia: Playfair Display nos títulos e Inter no corpo. Aplique o texto depois, no Canva ou no Figma: geradores de imagem erram letras em português.
- Clima: luz quente de manhã de domingo, igreja brasileira real e simples (cadeiras plásticas ou bancos de madeira, ventilador de teto), pessoas diversas, sem estética norte-americana de megaigreja.
- Evite: robôs, cérebros digitais, hologramas, cruz brilhando "sci-fi", rostos de pessoas reais identificáveis e logos de terceiros.
- Imagens com gente gerada por IA: não apresente como depoimento ou foto de membro real.

---

## 1. Imagens (fundo para os cards e anúncios)

**1.1 · Cadeira vazia (dor)**
```
Cinematic photo of a single empty plastic chair in a simple Brazilian evangelical church during Sunday morning service, other chairs occupied by blurred people, warm golden sunlight through a window, shallow depth of field, soft film grain, navy blue and warm gold color grading, lots of negative space on top for text, 4:5 vertical, photorealistic, 35mm
```

**1.2 · O líder percebe**
```
Brazilian church small-group leader in his 40s, casual shirt, sitting in a church hall after Sunday school, looking at his smartphone with a gentle concerned expression, warm morning light, bokeh of people talking in the background, navy and gold tones, documentary photography style, natural, candid, 4:5
```

**1.3 · O reencontro (resolução)**
```
Two Brazilian men hugging warmly at the entrance of a simple neighborhood church on a sunny Sunday morning, one younger returning after weeks away, smiles, other members greeting in background, golden hour light, emotional but natural, documentary style, navy and warm gold color grade, 4:5 vertical
```

**1.4 · Mensagem que chega**
```
Close-up of a young Brazilian woman at home in the afternoon reading a kind message on her phone and smiling softly, cozy living room, warm window light, phone screen out of focus (no readable text), shallow depth of field, navy and gold palette, photorealistic
```

**1.5 · Ovelha e cajado (conceitual, fundo de versículo)**
```
Minimalist editorial illustration of a shepherd's crook in warm gold and a small white sheep, deep navy blue background with subtle grid texture, soft glow, elegant, flat vector with light grain, lots of empty space, no text
```

**1.6 · Aniversário**
```
Simple homemade birthday cake with candles on a church fellowship table, Brazilian church kitchen, warm light, friends clapping out of focus, festive but humble, navy and gold accents, 4:5, photorealistic
```

Parâmetros no Midjourney: `--ar 4:5 --style raw --v 7` (feed) · `--ar 9:16` (stories) · `--ar 1.91:1` (LinkedIn e capa de link).

---

## 2. Vídeo (Veo, Sora, Runway, Kling, Higgsfield)

**2.1 · Cadeira vazia, 3 domingos (8s, 9:16)**
```
Locked-off cinematic shot of an empty chair in a simple Brazilian church. Time-lapse across three Sunday mornings: light shifts, people around the chair change clothes and sit down, but the chair stays empty. Warm golden sunlight, dust in the air, soft piano mood. Navy and gold color grading. Vertical 9:16, 8 seconds, no text.
```

**2.2 · Líder recebe o alerta (6s)**
```
Medium shot, a Brazilian Sunday-school leader in his 40s stands in a church hallway after class, phone vibrates, he looks at it, pauses, then taps the screen with a small determined nod. Handheld documentary feel, warm light, shallow depth of field. Vertical 9:16, 6 seconds.
```

**2.3 · A volta (8s)**
```
A young Brazilian man in his twenties walks into a small neighborhood church on Sunday morning, hesitates at the door, an older leader sees him, smiles and walks over to hug him. Other members wave. Golden morning light, slow motion at the hug, emotional, natural, documentary. Vertical 9:16, 8 seconds.
```

**2.4 · Produto em movimento (image-to-video)**
Envie `cards/feed-04-conversa.png` como imagem inicial:
```
Subtle camera push-in toward the phone, soft floating light particles, gentle glow pulses from the bottom-right, the phone slightly tilts in 3D. Keep all text and UI perfectly still and sharp. 5 seconds, seamless loop.
```

Montagem sugerida de um Reels de 30s: 2.1 → 2.2 → trecho do `pastoria-chamada-9x16-sem-audio.mp4` (chat) → 2.3 → os últimos 4s do `pastoria-manifesto-9x16-sem-audio.mp4` (CTA), com a locução do roteiro "A cadeira".

---

## 3. Voz (ElevenLabs ou outro TTS de qualidade)

**Configuração:** português do Brasil · estabilidade 45–55% · similaridade 75% · estilo 20–30%.

**Descrição de voz (Voice Design)**
```
Brazilian Portuguese male voice, 45-55 years old, warm, calm, pastoral and trustworthy, like a caring senior pastor speaking to other pastors. Medium-low pitch, unhurried pace, clear diction, slight smile in the voice, no radio announcer exaggeration.
```

**Alternativa feminina**
```
Brazilian Portuguese female voice, 35-45 years old, warm and gentle, confident, like a ministry leader who cares deeply for people. Natural conversational pace, soft but clear.
```

Textos: `copy/roteiros.md`. Troque os WAVs gerados pelo `say` gravando cada frase separadamente, com os mesmos cortes dos `segments`.

**Trilha (Suno, Udio ou banco royalty-free)**
```
Instrumental, 40 seconds, gentle worship-inspired ambient: soft felt piano, warm pads, light acoustic guitar harmonics, 70 BPM, hopeful and tender, builds slightly at the end, no vocals, no drums until the last 8 seconds.
```

---

## 4. Texto (para gerar variações com o Claude)

**4.1 · Legendas em lote**
```
Você é redator de uma marca cristã chamada PastorIA: assistente de IA no WhatsApp que ajuda igrejas a fazer a chamada da EBD e dos grupos, perceber quem está faltando, sugerir mensagens de cuidado (sempre aprovadas pela liderança) e lembrar aniversários. Slogan: "Quem falta, faz falta." Tom: pastoral, acolhedor, direto, sem jargão de tecnologia e sem prometer crescimento numérico. Público: pastores e líderes de igrejas evangélicas brasileiras.

Escreva 10 legendas de Instagram com até 600 caracteres cada. Varie os ângulos: dor da cadeira vazia, versículo (Lucas 15, João 21:17, Ezequiel 34:16), bastidor do líder no domingo, economia de tempo na chamada, aniversários, objeção "IA falando com a igreja?". Cada uma deve ter gancho na 1ª linha, até 2 emojis, CTA "teste 14 dias grátis, link na bio" e 5 hashtags.
```

**4.2 · Anúncios**
```
Crie 8 variações de anúncio para Meta Ads do PastorIA (descrição acima). Formato: texto principal (≤125 caracteres), título (≤40), descrição (≤30). Metade com o ângulo de dor ("perde um domingo de cada vez"), metade com o ângulo prático ("chamada da EBD em 8 segundos no WhatsApp"). Sem promessas absolutas e sem mencionar números de membros de igrejas reais.
```

**4.3 · Roteiros de Reels**
```
Escreva 5 roteiros de Reels de 20–30s para o PastorIA, cada um com: gancho falado nos 2 primeiros segundos, 4–6 cenas (o que aparece na tela e o texto na tela), locução e CTA final. Formatos: (1) POV do líder no domingo, (2) "3 sinais de que alguém está se afastando da sua igreja", (3) antes/depois da chamada no caderno, (4) pastor respondendo "IA vai substituir o pastor?", (5) trend de áudio com legenda.
```

**4.4 · Respostas a objeções (para comentários e DMs)**
```
Liste as 10 objeções mais prováveis de pastores ao PastorIA (custo, privacidade de dados, "IA não tem espírito", risco de banimento no WhatsApp, a liderança não é tecnológica, já usamos outro sistema etc.) e escreva, para cada uma, uma resposta de até 3 frases, humilde e verdadeira, usando estes fatos: toda mensagem a membro passa por aprovação da liderança; os dados de cada igreja ficam isolados e as credenciais criptografadas; os envios em lote respeitam intervalo e limites anti-banimento; funciona pelo WhatsApp que a liderança já usa; tem 14 dias grátis sem cartão; as congregações são ilimitadas.
```
