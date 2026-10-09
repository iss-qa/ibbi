# Campanha "Quem falta, faz falta" · Meta Ads, Google Ads e orgânico

Pacote pronto para subir: 3 variações de anúncio (textos + imagens em 4 formatos), 4 vídeos (3 ganchos para teste A/B + corte de 15s, cada um em 9:16 e 4:5) e as peças orgânicas de Instagram e WhatsApp.

- **Oferta:** 14 dias grátis, sem cartão, sem fidelidade
- **Público:** pastores e lideranças de igrejas evangélicas pequenas e médias
- **LP:** `https://pastoria.issqa.com.br/` (o botão leva a `/cadastro`)

---

## ⚠️ Regras da Meta (ler antes de subir)

Religião é **categoria sensível** na política de *Atributos pessoais* da Meta.

| ❌ Reprovado | ✅ Aprovado |
|---|---|
| "Você é pastor?" | "Para pastores e líderes…" |
| "Você está perdendo fiéis?" | "Quem faltou na EBD domingo passado?" (fala da situação, não da pessoa) |
| "Sua fé esfriou?" | "O PastorIA mostra quem está esfriando" (fala do produto) |

- Nunca afirme ou insinue a religião, a crença ou a condição de quem vê o anúncio.
- **Segmentação:** a Meta removeu os interesses ligados a religião em 2022. Use público **amplo (Advantage+)** com Brasil, 25–65 anos e idioma português. Some a isso o **remarketing** de quem visitou a LP e um **lookalike** de quem se cadastrou (quando houver ≥100).
- Os nomes nas conversas (Ana Souza, Carlos Lima, Júlia Reis, Pedro…) são **fictícios**.
- Versículo bíblico em anúncio é permitido. O que reprova é o texto que fala da fé de quem lê.

---

## Mapa de arquivos

### Imagens (`cards/`)

| Variação | Feed 4:5 (1080×1350) | Stories/Reels 9:16 (1080×1920) | Quadrado 1:1 (1080×1080) | Paisagem 1.91:1 (1200×628) |
|---|---|---|---|---|
| **V1 · A cadeira vazia** | `v1-cadeira-feed-4x5.png` | `v1-cadeira-story-9x16.png` | `v1-cadeira-quadrado-1x1.png` | `v1-cadeira-paisagem-191x1.png` |
| **V2 · O Barnabé** | `v2-barnabe-feed-4x5.png` | `v2-barnabe-story-9x16.png` | `v2-barnabe-quadrado-1x1.png` | `v2-barnabe-paisagem-191x1.png` |
| **V3 · Deixe as 99** | `v3-ovelhas-feed-4x5.png` | `v3-ovelhas-story-9x16.png` | `v3-ovelhas-quadrado-1x1.png` | `v3-ovelhas-paisagem-191x1.png` |

- Meta: feed 4:5 + stories 9:16 no mesmo anúncio (posicionamentos personalizados por recurso).
- Google Display/Demand Gen: quadrado 1:1 + paisagem 1.91:1.
- Nos stories, o terço de baixo fica livre de propósito, porque a Meta cobre essa área com o botão.

### Vídeos (`videos/`)

| Arquivo | Duração | Gancho (0–3s) | Uso |
|---|---|---|---|
| `qf-30s-gancho-a-9x16.mp4` / `-4x5.mp4` | 30s | "Tem alguém que não vem à igreja há três domingos." | Controle |
| `qf-30s-gancho-b-9x16.mp4` / `-4x5.mp4` | 30s | "Você sabe quem faltou na EBD domingo passado?" | Teste A/B |
| `qf-30s-gancho-c-9x16.mp4` / `-4x5.mp4` | 30s | "Esse banco ficou vazio por um mês inteiro." | Teste A/B |
| `qf-15s-9x16.mp4` / `-4x5.mp4` | 15s | "Três domingos sem vir." | Stories, remarketing, YouTube Shorts |
| `qf-30s-barnabe-9x16.mp4` / `-4x5.mp4` | 30s | "E se você pudesse perguntar quem está faltando?" | Variação V2 · O Barnabé (pergunta → nomes com o que fazer → mensagem enviada → "é só perguntar") |
| `qf-30s-ovelhas-9x16.mp4` / `-4x5.mp4` | 30s | Lucas 15:4 | Variação V3 · Deixe as 99 (a ovelha que se afasta → "esfriando" → alerta → a volta) |

- Cada vídeo tem também a versão `-sem-audio` (para trocar a locução) e uma capa `-capa.jpg`.
- O 4:5 é recortado do centro do 9:16, porque o layout guarda todo o conteúdo nessa área.
- **A locução é provisória** (voz Luciana do macOS, só como guia de tempo). Para veicular, grave um locutor seguindo `../copy/roteiros.md` e o roteiro abaixo e troque o áudio da versão `-sem-audio`. Tom: pastoral e acolhedor, com pausa depois de "três domingos".

**Roteiro (30s):** gancho (0–3s) → "Ninguém percebe. Não por falta de amor. Por falta de tempo." → alerta do Barnabé no WhatsApp → chamada · relatório · aniversários → a cadeira vazia volta a ser ocupada ("Obrigada por lembrar de mim. Domingo estou aí!") → logo + "Teste grátis por 14 dias" + URL.

### Orgânico (`cards/`)

| Arquivo | Onde | Sticker / ação |
|---|---|---|
| `ig-feed-pergunta.png` | Feed do Instagram | Legenda abaixo, CTA "Comenta CUIDADO" |
| `ig-story-1-enquete.png` | Stories 1/3 | **Enquete** na área livre acima de "Vote aqui em cima": "Sim, tudo anotado" / "Sinceramente… não" |
| `ig-story-2-caixinha.png` | Stories 2/3 | **Caixa de perguntas**: "Qual é o maior desafio de acompanhar sua igreja?" |
| `ig-story-3-link.png` | Stories 3/3 | **Link**: "Testar grátis" → URL com `utm_source=instagram&utm_medium=stories` |
| `wa-status-1/2/3.png` | Status do WhatsApp (nesta ordem) | Texto no 3º: "Responda QUERO VER" |

---

## Anúncios: textos por variação

UTM padrão: `?utm_source={meta|google}&utm_medium=paid&utm_campaign=quem-falta&utm_content={v1|v2|v3|video-a|video-b|video-c|video-15}`

### V1 · A cadeira vazia (PAS) · imagens `v1-*` · vídeos com gancho A
- **Título Meta:** Quem falta, faz falta.
- **Títulos Google (≤30):** Saiba Quem Parou de Vir · Cuidado Pastoral com IA · 14 Dias Grátis, Sem Cartão
- **Descrição Google (≤90):** Alertas no WhatsApp quando um membro começa a faltar. Chamada, aniversários e mais.
- **Botão:** Cadastre-se
- **Texto principal:**

> Domingo passado, alguém da igreja não veio. No anterior também. 🪑
>
> Ninguém percebeu. Quando alguém notar, já serão dois meses, e a conversa vai ser muito mais difícil.
>
> Não é falta de amor da liderança. É falta de tempo para acompanhar cada nome.
>
> O PastorIA acompanha a frequência da EBD, dos cultos e das células e avisa a liderança no WhatsApp quando alguém começa a se afastar. Ele também sugere a mensagem certa para mandar.
>
> ✅ Alerta automático de faltas seguidas
> ✅ Chamada pelo WhatsApp em segundos
> ✅ Aniversários e acompanhamento de visitantes no automático
>
> 🐑 PastorIA: Quem falta, faz falta.
> Teste 14 dias grátis. Sem cartão, sem fidelidade. 👇

### V2 · O Barnabé (AIDA) · imagens `v2-*` · vídeo `qf-30s-barnabe` (ou o gancho B)
- **Título Meta:** Um assistente pastoral no seu WhatsApp
- **Títulos Google:** Assistente Pastoral com IA · Gestão de Igreja no WhatsApp · Chamada da EBD em Segundos
- **Descrição Google:** Pergunte "quem está faltando?" e receba a lista na hora. Sem planilha e sem app novo.
- **Botão:** Saiba mais
- **Texto principal:**

> 📲 "Barnabé, quem está faltando há 3 semanas?"
> Em segundos chega a lista com nomes e uma sugestão para cada um: ligar, visitar ou orar.
>
> Esse é o PastorIA, a IA pastoral que funciona onde a liderança já está: no WhatsApp.
>
> 👉 Presença da EBD registrada com uma mensagem: "2 e 4"
> 👉 Relatório da semana pronto no domingo
> 👉 Visitantes recebem boas-vindas e convites nos dias certos
> 👉 Aniversariantes recebem parabéns sem ninguém precisar lembrar
>
> Menos planilha e mais pastoreio.
> 🐑 Comece hoje: 14 dias grátis, sem cartão.

### V3 · Deixe as 99 (propósito) · imagens `v3-*` · vídeo `qf-30s-ovelhas` (ou o gancho C)
- **Título Meta:** Nenhuma ovelha esquecida.
- **Títulos Google:** Nenhuma Ovelha Esquecida · Retenção de Membros da Igreja · Feito por Igreja, p/ Igrejas
- **Descrição Google:** Saiba quem está esfriando antes que ele vá embora. Teste grátis por 14 dias, sem cartão.
- **Botão:** Cadastre-se
- **Texto principal:**

> "Qual de vós, possuindo cem ovelhas e perdendo uma delas, não deixa as noventa e nove e vai após a perdida?" (Lc 15:4)
>
> Numa igreja com 50, 200 ou 1.000 pessoas, é humanamente impossível notar sozinho quem está esfriando.
>
> O PastorIA nasceu dentro de uma igreja local para resolver isso:
> 📉 Mostra quem está esfriando antes de sumir de vez
> 💛 Avisa a liderança e ajuda a trazer cada pessoa de volta
> 🙏 Organiza pedidos de oração e intercessores
>
> Todas as congregações numa única assinatura.
> 🐑 PastorIA: Quem falta, faz falta.

---

## Estrutura sugerida no Gerenciador de Anúncios

1. **Campanha:** Vendas/Cadastros, orçamento Advantage+ (CBO). Evento: `CompleteRegistration` (**Pixel ainda não instalado na LP**, ver pendências).
2. **Conjunto 1 · Amplo (Brasil, 25–65):** V1, V2 e V3 em imagem + vídeos A, B e C. Deixe rodar ~7 dias ou ~50 conversões antes de mexer.
3. **Conjunto 2 · Remarketing (visitou a LP, 30 dias):** vídeo de 15s + V2 (prova do produto).
4. **Corte:** depois de ~1.000 impressões, pause o criativo com CPC acima de 2x a média do conjunto. Entre os vídeos, mantenha o gancho com maior *hook rate* (visualizações de 3s ÷ impressões).
5. **Google:** campanha de Pesquisa com os títulos e descrições acima (palavras-chave: "sistema para igreja", "chamada ebd", "gestão de membros igreja", "software igreja whatsapp") + Demand Gen com as imagens 1:1/1.91:1 e o vídeo de 15s.

---

## Orgânico: textos

### Instagram · feed (`ig-feed-pergunta.png`)
> **Quantas pessoas saíram da sua igreja sem dizer tchau?** 🪑
>
> Ninguém sai de uma vez. Primeiro falta um domingo. Depois dois. Depois some da EBD, da célula, do grupo. Quando a liderança percebe, a ponte já ficou longa demais.
>
> Foi para isso que criamos o PastorIA: ele acompanha a frequência e avisa no WhatsApp quem está começando a se afastar, a tempo de uma ligação, uma visita, uma oração.
>
> 💬 Comenta "CUIDADO" que a gente te mostra como funciona.
> 🔗 Teste grátis por 14 dias: link na bio.
>
> Quem falta, faz falta. 🐑
>
> #PastorIA #QuemFaltaFazFalta #GestaoDeIgreja #LiderancaCrista #EBD #CuidadoPastoral #IgrejaLocal #Celulas

### WhatsApp · lista de transmissão (só para quem aceitou receber)
> Graça e paz, {nome}! 🙏
>
> Uma pergunta rápida: na sua igreja, alguém percebe quando um membro falta 3 domingos seguidos?
>
> Criamos o PastorIA para isso. Ele acompanha a frequência da EBD, dos cultos e das células e te avisa aqui no WhatsApp quando alguém começa a se afastar, já com uma sugestão de mensagem.
>
> 🎁 14 dias grátis, sem cartão: https://pastoria.issqa.com.br/?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=quem-falta
>
> Prefere ver funcionando antes? Responda QUERO VER que eu te mostro em 5 minutos. 😊
>
> Para não receber mais, responda SAIR.

### WhatsApp · Status (3 publicações, nesta ordem)
1. `wa-status-1.png`: "3 domingos sem vir… e ninguém percebeu."
2. `wa-status-2.png`: "Agora o WhatsApp avisa a liderança 👆"
3. `wa-status-3.png`: "Teste grátis por 14 dias: responde QUERO VER 👇"

---

## Pendências antes de veicular

- [ ] **Pixel da Meta e tag do Google Ads na LP** (`PageView` + `CompleteRegistration` no `/cadastro` concluído). Sem isso a Meta não consegue otimizar para cadastro.
- [ ] Locução definitiva gravada por um locutor (a atual é TTS).
- [ ] Confirmar se `pastoria.issqa.com.br` é o domínio final da campanha (ele aparece no fim do vídeo e no Status 3).
- [ ] Conta de anúncios verificada e página do Facebook/Instagram do PastorIA vinculada.

## Regenerar

Da raiz do repositório:
```bash
node marketing/src/render-cards.js campanha     # todos os PNGs desta pasta (fonte: src/campanha.html)
node marketing/src/render-videos.js campanha    # os 6 vídeos, 9:16 + 4:5 (fontes: src/video-quemfalta.html, video-barnabe.html, video-ovelhas.html)
node marketing/src/render-videos.js qf-b        # só um (qf-a | qf-b | qf-c | qf-15)
```
As ilustrações (cadeiras e ovelhas) estão em `src/illus.js`. Os textos da narração estão em `QF_HOOKS` e `VIDEOS['qf-*']` em `src/render-videos.js`, e a duração de cada cena se ajusta à locução.
