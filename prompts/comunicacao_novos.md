# IBBI — Prompt de Implementação: Grupos de Triagem, Comunicação WhatsApp e Projeto Amigo

## Contexto do Sistema

Sistema web da **Igreja Batista Bíblica Israel (IBBI)** — stack: **Next.js 14 + TypeScript + Tailwind + shadcn/ui** (frontend), **Fastify** (backend/API), **MongoDB** (banco de dados), **Evolution API** (WhatsApp). Estética do sistema: Navy (#1a2744) e Gold (#c8a84b). Autenticação baseada em roles: `master_admin`, `admin`, `lider`, `membro`.

Já existe no sistema: cadastro de membros, cadastro de novos decididos, cadastro de visitantes, tela de comunicações, menu lateral com navegação. O objetivo deste prompt é expandir essas funcionalidades com automação de WhatsApp e o sistema de Grupos de Triagem (Projeto Amigo).

---

## 1. BANCO DE DADOS — Novos Collections MongoDB

### 1.1 `grupos`
```json
{
  "_id": "ObjectId",
  "nome": "Triagem Novos Decididos",
  "tipo": "novos_decididos | visitantes | personalizado",
  "descricao": "Grupo responsável por acolher novos decididos",
  "membros": [
    {
      "membro_id": "ObjectId -> ref: membros",
      "nome": "string",
      "celular": "string",
      "whatsapp": "string",
      "cargo": "string",
      "ativo": true
    }
  ],
  "ativo": true,
  "congregacao_id": "ObjectId",
  "created_by": "ObjectId",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 1.2 `comunicacoes` (expandir collection existente ou criar nova)
```json
{
  "_id": "ObjectId",
  "tipo": "novo_decidido | visitante | aniversario | geral",
  "subtipo": "boas_vindas | notificacao_triagem | acompanhamento",
  "destinatario": {
    "tipo": "individuo | grupo_triagem",
    "id": "ObjectId",
    "nome": "string",
    "celular": "string"
  },
  "grupo_triagem_id": "ObjectId | null",
  "referencia_id": "ObjectId",
  "referencia_tipo": "novo_decidido | visitante",
  "mensagem": "string (texto enviado)",
  "status": "pendente | enviado | falhou",
  "erro": "string | null",
  "enviado_em": "Date | null",
  "created_at": "Date",
  "congregacao_id": "ObjectId"
}
```

### 1.3 `projeto_amigo_acoes` (ações de acompanhamento)
```json
{
  "_id": "ObjectId",
  "referencia_id": "ObjectId",
  "referencia_tipo": "novo_decidido | visitante",
  "responsavel_id": "ObjectId -> ref: membros",
  "tipo_acao": "ligacao | visita | culto_agendado | acompanhamento | outros",
  "descricao": "string",
  "data_agendada": "Date | null",
  "data_realizada": "Date | null",
  "status": "pendente | realizado | cancelado",
  "observacoes": "string",
  "grupo_triagem_id": "ObjectId",
  "created_by": "ObjectId",
  "created_at": "Date",
  "updated_at": "Date"
}
```

---

## 2. BACKEND — Rotas Fastify

### 2.1 Grupos de Triagem (`/api/triagem-grupos`)

```
GET    /api/triagem-grupos                    → Lista todos os grupos (admin+)
POST   /api/triagem-grupos                    → Cria novo grupo (master_admin, admin)
GET    /api/triagem-grupos/:id                → Detalhe do grupo
PUT    /api/triagem-grupos/:id                → Edita grupo
DELETE /api/triagem-grupos/:id                → Remove grupo (master_admin)
POST   /api/triagem-grupos/:id/membros        → Adiciona membro ao grupo
DELETE /api/triagem-grupos/:id/membros/:membroId → Remove membro do grupo
```

### 2.2 Comunicações WhatsApp (`/api/comunicacoes`)

```
GET    /api/comunicacoes                      → Lista comunicações com filtros (tipo, status, data)
GET    /api/comunicacoes/:id                  → Detalhe
POST   /api/comunicacoes/reenviar/:id         → Reenviar mensagem que falhou
```

### 2.3 Projeto Amigo — Ações (`/api/projeto-amigo`)

```
GET    /api/projeto-amigo/:referencia_tipo/:referencia_id   → Lista ações de um decidido/visitante
POST   /api/projeto-amigo                                   → Registra nova ação
PUT    /api/projeto-amigo/:id                               → Atualiza ação
DELETE /api/projeto-amigo/:id                               → Remove ação
```

### 2.4 Triggers (disparados internamente, não expostos diretamente)

Implementar como **hooks internos** chamados nos endpoints existentes de cadastro:

- `POST /api/novos-decididos` → ao final, acionar `triggerNvoDecididoWhatsApp(novoDecidido)`
- `POST /api/visitantes` → ao final, acionar `triggerVisitanteWhatsApp(visitante)`

---

## 3. SERVIÇO WHATSAPP — `src/services/whatsappService.ts`

### 3.1 Função principal de envio via Evolution API

```typescript
// Usar Evolution API já configurada no sistema
// Base URL e token já definidos em variáveis de ambiente:
// EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME

async function sendWhatsAppText(celular: string, mensagem: string): Promise<boolean>
async function sendWhatsAppImage(celular: string, imageUrl: string, caption: string): Promise<boolean>
```

### 3.2 Template: Mensagem para NOVO DECIDIDO (enviada diretamente ao número dele)

```
Shalom, [NOME]! 🙏

*Bem-vindo(a) à família de Deus!* 

Que alegria imensa ter você tomando essa decisão tão importante — aceitar Jesus Cristo como seu Senhor e Salvador é o passo mais transformador da vida!

_"Portanto, se alguém está em Cristo, é nova criatura. As coisas antigas já passaram; eis que surgiram coisas novas."_
— 2 Coríntios 5:17

Queremos que você saiba que não está sozinho(a) nessa caminhada. A *Igreja Batista Bíblica Israel* estará ao seu lado a cada passo!

📅 *Nossa Programação Semanal:*

🟡 *Domingo — 08h45 | EBD (Escola Bíblica Dominical)*
Aulas de ensino bíblico em grupos por faixa etária. É o momento de crescer no conhecimento da Palavra de Deus de forma prática e profunda. Venha aprender!

🟡 *Domingo — 19h00 | Culto de Louvor e Adoração*
Nosso culto dominical noturno, cheio de adoração, pregação da Palavra e comunhão.

🟡 *Terça-feira — 19h30 | Culto de Oração*
Um momento especial para buscar a Deus em oração, interceder uns pelos outros e fortalecer a fé. A oração move o coração de Deus!

🟡 *Quarta-feira — Reuniões das Uniões*
Encontros dos grupos: Jovens, Adolescentes, União Masculina, União Feminina e outros ministérios. Um espaço de comunhão, crescimento e missão junto com pessoas da sua faixa etária e interesses.

🟡 *Quinta-feira — 19h30 | Culto de Adoração*
Culto especial de adoração e edificação, com louvor e Palavra para fortalecer sua vida espiritual durante a semana.

📍 *Congregação:* [CONGREGACAO]

Você é muito especial para nós! Em breve, alguém de nossa equipe entrará em contato para apresentar nossa família e caminhar junto com você. 💛

_Que Deus te abençoe grandemente!_
*Igreja Batista Bíblica Israel — IBBI* 🕊️
```

**Variáveis do template:**
- `[NOME]` → nome do novo decidido
- `[CONGREGACAO]` → nome da congregação

---

### 3.3 Template: Notificação para Grupo de Triagem — NOVO DECIDIDO

```
🕊️ *Shalom, amados!*

O culto do dia *[DATA_CULTO]* — *[DIA_SEMANA]* — foi uma bênção! Deus está sendo glorificado! 🙌

Segue a lista de *Novos Decididos* para o cuidado pastoral:

[LISTA_DECIDIDOS]

---
🤝 *Projeto Amigo — IBBI*

Cada nome dessa lista representa uma alma preciosa que deu o primeiro passo rumo à eternidade. Agora é a nossa vez de agir com amor!

✅ _Ligue para ele(a) e apresente-se_
✅ _Agende um acompanhamento ou visita_
✅ _Convide para o próximo culto_
✅ _Ore por essa pessoa pelo nome_
✅ _Dê o suporte que ele(a) precisar_

Lembre-se: um gesto de cuidado hoje pode ser o fator que mantém esse irmão(ã) firme na fé e, futuramente, membro ativo da nossa família! 💛

_"Assim, quem plantar e quem regar são um só; mas cada um receberá a sua recompensa segundo o seu trabalho."_ — 1 Co 3:8

*Igreja Batista Bíblica Israel — IBBI* 🕊️
```

**Para cada decidido na lista, formatar assim:**
```
*[N]. [NOME_COMPLETO]*
📅 Decisão: [DATA_DECISAO]
⚤ Sexo: [SEXO]
📱 Celular: [CELULAR]
🏛️ Congregação: [CONGREGACAO]
[FOTO_URL se disponível]
---
```

> **Nota de implementação:** Enviar uma mensagem por decidido, ou montar a lista completa dependendo de quantos foram. Se mais de 3 decididos no mesmo dia, enviar mensagem introdutória + mensagens individuais separadas para cada um.

---

### 3.4 Template: Mensagem para VISITANTE (enviada diretamente ao número dele)

```
Shalom, [NOME]! 😊

*Que alegria ter você conosco!*

Foi uma honra receber sua visita à *Igreja Batista Bíblica Israel*! Esperamos que você tenha se sentido em casa, pois aqui você é sempre bem-vindo(a)!

_"Porque onde dois ou três estiverem reunidos em meu nome, ali estou no meio deles."_
— Mateus 18:20

Gostaríamos de te convidar para fazer parte da nossa programação:

📅 *Nossa Programação Semanal:*

🟡 *Domingo — 08h45 | EBD (Escola Bíblica Dominical)*
Aulas de ensino bíblico em grupos. Crescimento na Palavra de Deus de forma prática.

🟡 *Domingo — 19h00 | Culto de Louvor e Adoração*
Nosso culto dominical noturno, cheio de adoração e pregação da Palavra.

🟡 *Terça-feira — 19h30 | Culto de Oração*
Momento especial de buscar a Deus em oração e fortalecer a fé.

🟡 *Quarta-feira — Reuniões das Uniões*
Grupos de Jovens, Adolescentes, União Masculina, União Feminina e outros ministérios.

🟡 *Quinta-feira — 19h30 | Culto de Adoração*
Culto especial de adoração e edificação da vida espiritual.

📍 *Congregação:* [CONGREGACAO]

Você fez nossa família ainda mais completa com sua presença! Esperamos você novamente em breve. 🤗

_Deus te abençoe com abundância!_
*Igreja Batista Bíblica Israel — IBBI* 🕊️
```

---

### 3.5 Template: Notificação para Grupo de Triagem — VISITANTE

```
🌟 *Shalom, equipe de acolhimento!*

Temos visitantes novos registrados! 🙌

[LISTA_VISITANTES]

---
🤝 *Ações de Cuidado — Visitantes*

Cada visitante é uma porta aberta! Nosso objetivo é que cada visita seja a primeira de muitas e que, em breve, cada um deles faça parte da nossa família!

✅ _Entre em contato e agradeça a visita_
✅ _Convide para o próximo culto_
✅ _Agende um café ou momento de comunhão_
✅ _Ore por essa pessoa_
✅ _Apresente os grupos e ministérios_

_"O amor fraternal deve permanecer."_ — Hebreus 13:1

*Igreja Batista Bíblica Israel — IBBI* 🕊️
```

---

## 4. LÓGICA DE DISPARO — `src/services/triggerService.ts`

### 4.1 Trigger: Novo Decidido

```typescript
async function triggerNovoDecididoWhatsApp(novoDecidido: INovoDecidido) {
  // 1. Buscar grupo(s) de triagem do tipo "novos_decididos" ativos
  const grupos = await TriagemGrupo.find({ tipo: 'novos_decididos', ativo: true })

  // 2. Enviar mensagem de boas-vindas ao número do novo decidido (se tiver celular)
  if (novoDecidido.celular) {
    const msgBoasVindas = buildMsgBoasVindasDecidido(novoDecidido)
    const ok = await sendWhatsAppText(novoDecidido.celular, msgBoasVindas)
    await registrarComunicacao({
      tipo: 'novo_decidido',
      subtipo: 'boas_vindas',
      destinatario: { tipo: 'individuo', id: novoDecidido._id, nome: novoDecidido.nome, celular: novoDecidido.celular },
      referencia_id: novoDecidido._id,
      referencia_tipo: 'novo_decidido',
      mensagem: msgBoasVindas,
      status: ok ? 'enviado' : 'falhou'
    })
  }

  // 3. Para cada grupo de triagem, enviar notificação para cada membro
  for (const grupo of grupos) {
    const msgGrupo = buildMsgGrupoNovoDecidido(novoDecidido)
    for (const membro of grupo.membros.filter(m => m.ativo && m.whatsapp)) {
      const ok = await sendWhatsAppText(membro.whatsapp, msgGrupo)
      await registrarComunicacao({
        tipo: 'novo_decidido',
        subtipo: 'notificacao_triagem',
        destinatario: { tipo: 'individuo', id: membro.membro_id, nome: membro.nome, celular: membro.whatsapp },
        grupo_triagem_id: grupo._id,
        referencia_id: novoDecidido._id,
        referencia_tipo: 'novo_decidido',
        mensagem: msgGrupo,
        status: ok ? 'enviado' : 'falhou'
      })
    }
  }
}
```

### 4.2 Trigger: Visitante — implementar de forma análoga ao 4.1, usando templates de visitante e grupos do tipo `"visitantes"`.

---

## 5. FRONTEND — Telas a Implementar

### 5.1 Configurações → Grupos de Triagem

**Rota:** `/configuracoes/grupos-triagem`

**Acesso:** `master_admin`, `admin`

**Componentes:**
- Header com título "Grupos de Triagem" e botão "+ Novo Grupo"
- Cards ou tabela listando grupos existentes, com colunas: Nome, Tipo, Qtd. Membros, Status (ativo/inativo), Ações (editar, ver membros, desativar)
- **Modal/Drawer "Criar Grupo":**
  - Campo: Nome do grupo (obrigatório)
  - Campo: Tipo — select com opções: `Novos Decididos`, `Visitantes`, `Personalizado`
  - Campo: Descrição (opcional)
  - Botão Salvar
- **Modal/Drawer "Gerenciar Membros"** (ao clicar em um grupo):
  - Lista de membros do grupo com nome, cargo, celular, WhatsApp, botão remover
  - Input de busca para adicionar membro (busca na collection de membros cadastrados)
  - Ao selecionar membro da busca, adicionar ao grupo
  - Exibir aviso: "Esses membros receberão notificações por WhatsApp"

---

### 5.2 Menu Lateral — Atualização

Adicionar no menu lateral em **"Configurações"** o item:
- 📋 Grupos de Triagem → `/configuracoes/grupos-triagem`

---

### 5.3 Tela de Comunicações — Expansão

**Rota existente:** `/comunicacoes`

**Melhorias:**

- **Filtros:** tipo (Novo Decidido / Visitante / Aniversário / Geral), status (Enviado / Falhou / Pendente), data range
- **Tabela expandida com colunas:**
  - Data/Hora
  - Tipo (badge colorido: `novo_decidido` → gold, `visitante` → verde)
  - Subtipo (Boas-vindas / Notificação Triagem)
  - Destinatário
  - Grupo (se for notificação de triagem)
  - Status (badge: enviado → verde, falhou → vermelho)
  - Ações: Ver mensagem completa, Reenviar (se falhou)
- **Modal "Ver Mensagem"** → exibe o texto completo enviado e o timestamp
- **Botão "Reenviar"** → chama `POST /api/comunicacoes/reenviar/:id`
- **Cards de resumo no topo:**
  - Total enviados hoje
  - Total falhos (com destaque visual)
  - Novos decididos notificados (período)
  - Visitantes notificados (período)

---

### 5.4 Tela de Novos Decididos — Expansão (tab "Projeto Amigo")

Na tela de detalhe de um novo decidido, adicionar uma aba **"Projeto Amigo 🤝"**:

**Componentes:**
- Timeline de ações realizadas (ligação, visita, culto agendado, etc.)
- Botão "+ Registrar Ação"
- **Modal "Registrar Ação":**
  - Tipo de ação: select (`Ligação`, `Visita`, `Culto Agendado`, `Acompanhamento`, `Outros`)
  - Descrição (textarea)
  - Data agendada (opcional, date picker)
  - Responsável (select de membros da triagem)
  - Status: `Pendente` / `Realizado` / `Cancelado`
  - Observações
- **Status de conversão** (badge visual): `Visitante Regular` → `Em Acompanhamento` → `Pré-Candidato a Membro` → `Membro`

---

### 5.5 Tela de Visitantes — Expansão (tab "Acompanhamento")

Análoga à tela 5.4, mas com foco em reconverter o visitante em frequentador regular e potencial membro. Mesma estrutura de ações mas com contexto adaptado.

---

## 6. VALIDAÇÕES E REGRAS DE NEGÓCIO

1. **Celular obrigatório** para disparo? Não — se o campo `celular` estiver vazio, pular o envio direto ao decidido/visitante e apenas registrar na comunicação com status `"sem_numero"`. Nunca travar o cadastro por falta de celular.

2. **Grupo sem membros** → se o grupo existir mas não tiver membros ativos com WhatsApp, registrar log de comunicação com status `"sem_destinatarios"`.

3. **Envio assíncrono** → os disparos de WhatsApp **não devem bloquear** a resposta da API de cadastro. Usar `setImmediate()`, fila BullMQ, ou `Promise` sem await no retorno da rota.

4. **Retry automático** → se o envio falhar, reagendar para 5 minutos depois (máximo 3 tentativas via BullMQ).

5. **Número de telefone** → normalizar sempre para formato E.164 com DDI Brasil: `+55DDNÚMERO`. Remover caracteres especiais antes de enviar.

6. **Permissões:**
   - Criar/editar grupos: `master_admin`, `admin`
   - Visualizar grupos: `master_admin`, `admin`, `lider`
   - Ver comunicações: `master_admin`, `admin`, `lider`
   - Registrar ações no Projeto Amigo: qualquer membro autenticado que esteja no grupo

---

## 7. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# Evolution API (já deve existir no sistema)
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=seu_token_aqui
EVOLUTION_INSTANCE_NAME=ibbi

# BullMQ / Redis (para fila de envio assíncrono)
REDIS_URL=redis://localhost:6379
```

---

## 8. ESTRUTURA DE ARQUIVOS SUGERIDA

```
src/
├── models/
│   ├── TriagemGrupo.ts          (novo)
│   ├── Comunicacao.ts           (novo ou expandir existente)
│   └── ProjetoAmigoAcao.ts      (novo)
├── services/
│   ├── whatsappService.ts       (novo)
│   ├── triggerService.ts        (novo)
│   └── whatsappTemplates.ts     (novo — todos os templates de mensagem)
├── jobs/
│   └── whatsappQueue.ts         (BullMQ worker para envio assíncrono)
├── routes/
│   ├── triagem-grupos.ts        (novo)
│   ├── comunicacoes.ts          (expandir)
│   └── projeto-amigo.ts         (novo)
└── app/                         (Next.js pages)
    ├── configuracoes/
    │   └── grupos-triagem/
    │       └── page.tsx         (novo)
    ├── comunicacoes/
    │   └── page.tsx             (expandir)
    └── components/
        ├── TriagemGrupoModal.tsx
        ├── GerenciarMembrosGrupoDrawer.tsx
        ├── ProjetoAmigoTimeline.tsx
        ├── ProjetoAmigoAcaoModal.tsx
        └── ComunicacaoStatusBadge.tsx
```

---

## 9. FLUXO COMPLETO — DIAGRAMA DE SEQUÊNCIA

```
Usuário preenche form Novo Decidido
        │
        ▼
POST /api/novos-decididos
        │
        ├─ Salva no MongoDB → retorna 201 ao cliente (imediato)
        │
        └─ setImmediate → triggerNovoDecididoWhatsApp(novoDecidido)
                │
                ├── Monta template boas-vindas
                ├── Envia para celular do decidido via Evolution API
                ├── Registra em "comunicacoes" (boas_vindas)
                │
                ├── Busca grupos tipo "novos_decididos" ativos
                └── Para cada membro do grupo:
                        ├── Monta template notificação triagem
                        ├── Envia por WhatsApp via Evolution API
                        └── Registra em "comunicacoes" (notificacao_triagem)
```

---

## 10. COMPORTAMENTO DA UI AO CADASTRAR

Após salvar novo decidido ou visitante com sucesso:

1. Toast de sucesso: _"Cadastro realizado! Mensagem de boas-vindas enviada por WhatsApp."_
2. Se não tiver celular: Toast com aviso: _"Cadastro salvo. Nenhum número informado — mensagem não enviada."_
3. Na tela de comunicações, os registros aparecem em tempo real (polling a cada 30s ou WebSocket se disponível)

---

## 11. PADRÃO VISUAL — Componentes UI

Manter o padrão do sistema IBBI:
- **Cores:** Navy `#1a2744`, Gold `#c8a84b`, branco e cinza neutro
- **Badges de tipo:** `novo_decidido` → fundo gold/10, texto gold | `visitante` → fundo green/10, texto green
- **Badges de status:** `enviado` → verde | `falhou` → vermelho | `pendente` → amarelo | `sem_numero` → cinza
- **Ícones:** Usar Lucide React (MessageCircle, Users, Heart, Phone, Calendar, CheckCircle)
- **Tipografia:** Manter fonte do sistema existente

---

## 12. TESTES E VALIDAÇÕES

- Testar envio com número de teste antes de ativar em produção
- Validar se a instância Evolution API está conectada antes de disparar (endpoint `/instance/connectionState`)
- Log de todos os envios no console e no banco
- Painel de comunicações deve ser o "espelho" de tudo que foi enviado — nada deve ser enviado sem registro

---

*Gerado para o sistema IBBI — Igreja Batista Bíblica Israel*
*Versão 1.0 — Módulo: Triagem, Comunicação WhatsApp e Projeto Amigo*