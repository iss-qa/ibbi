# Projeto Amigo — PRD & Prompt de Desenvolvimento
> Sistema IBBI · Módulo de Acolhimento de Visitantes e Novos Decididos
> Stack: React + Vite + Tailwind · Backend: Fastify + MongoDB

---

## 1. Contexto geral

O módulo **Projeto Amigo** gerencia duas jornadas distintas de pessoas que chegam à igreja:

| Perfil | Definição | Urgência |
|---|---|---|
| **Visitante** | Pessoa que apareceu em um culto/evento sem fazer decisão pública | Contato em até 1 semana |
| **Novo Decidido** | Pessoa que fez decisão pública de fé em culto ou evento | Contato em até 48h |

Ambos compartilham o mesmo modelo `people` no MongoDB, diferenciados pelo campo `tipo`.

---

## 2. Tela Home — `/projeto-amigo`

### 2.1 Topbar de ações

```
[ Relatório ↓ ]  [ + Visitante ]  [ + Novo Decidido ]  [ 👥 Grupos ]
```

**Regras de comportamento:**

| Botão | Ação |
|---|---|
| `+ Visitante` | Abre `<ModalCadastro>` com `tipo = "visitante"` pré-selecionado e bloqueado |
| `+ Novo Decidido` | Abre `<ModalCadastro>` com `tipo = "novo decidido"` pré-selecionado e bloqueado |
| `👥 Grupos` | Abre `<ModalGrupos>` com lista de grupos + botão "Novo Grupo" |
| `Relatório ↓` | Dispara download do relatório mensal em PDF |

### 2.2 KPIs (linha superior)
- Visitantes no mês
- Novos decididos no mês
- Em acompanhamento ativo
- Sem amigo atribuído *(com badge de alerta vermelho)*
- Consolidados nos últimos 60 dias

### 2.3 Dual Track (dois cards lado a lado)
- Card **Visitantes**: funil 4 etapas + lista resumida (4 pessoas) + botão "Ver todos"
- Card **Novos Decididos**: funil 4 etapas + lista resumida (4 pessoas) + botão "Ver todos"

### 2.4 Seção inferior
- Alertas com ação direta (atribuir amigo, notificar)
- Gráfico de entradas por dia da semana (visitantes vs decididos)
- Feed de atividade recente
- Ranking de amigos responsáveis

---

## 3. Modal de Cadastro — `<ModalCadastro>`

### 3.1 Props de entrada

```ts
interface ModalCadastroProps {
  isOpen: boolean
  onClose: () => void
  tipoInicial: 'visitante' | 'novo decidido' | null
  // se null: exibe todos os tipos selecionáveis livremente
}
```

### 3.2 Layout do modal

```
┌─────────────────────────────────────────────────────────┐
│  [Foto]     Nome completo *                      [× fechar]
│  MUDAR      ────────────────────────────────────────────
│  FOTO       Tipo *                                       │
│             [ congregado ][ membro ][✓ visitante]        │
│             [ novo decidido ][ criança ]                 │
│                                                          │
│             Congregação *          Status                │
│             [ Sede ▾ ]             ATIVO ●               │
│  ─────────────────────────────────────────────────────  │
│  INFORMAÇÕES PESSOAIS                                    │
│                                                          │
│  [campos dinâmicos conforme tipo selecionado]            │
│                                                          │
│                                    [ Cancelar ][ Salvar ]│
└─────────────────────────────────────────────────────────┘
```

### 3.3 Campos base (todos os tipos)

| Campo | Tipo | Obrigatório |
|---|---|---|
| `nome` | text | ✅ |
| `tipo` | chip selector | ✅ |
| `congregacao` | select (Sede, Filial...) | ✅ |
| `status` | toggle (ativo/inativo) | ✅ |
| `sexo` | select (M/F/—) | ✅ |
| `celular` | tel (WhatsApp) | ✅ |
| `email` | email | — |
| `fotoUrl` | upload/câmera | — |

### 3.4 Campos dinâmicos por tipo

#### Tipo: `visitante`
```
- dataVisita *          → date (default: hoje)
- comoConheceu          → select [ Convite de amigo | Redes Sociais | Passou pela frente | Outro ]
- interesseArea         → multiselect [ EBD | Célula | Jovens | Louvor | Outro ]
- observacoes           → textarea
```

#### Tipo: `novo decidido`
```
- dataDecisao *         → date (default: hoje)
- tipoDecisao           → select [ Aceitou Jesus | Reconciliação | Reconsagração ]
- comoConheceu          → select
- batizoInteresse       → toggle (Tem interesse em batismo?)
- grupoIndicado         → select [ Adulto 1 | Adulto 2 | Jovens | Casais | Crianças ]
- amigoResponsavel      → busca de membro (people.tipo === 'membro')
- observacoes           → textarea
```

#### Tipo: `congregado` / `membro`
```
- dataNascimento        → date
- estadoCivil           → select
- endereco              → text
- ministerio            → select
- dataBatismo           → date
- dataMembresia         → date (apenas membro)
- matricula             → auto-gerado (readonly)
```

#### Tipo: `criança`
```
- dataNascimento *      → date
- responsavel1          → busca de membro (pai/mãe)
- responsavel2          → busca de membro (opcional)
- restricoesAlimentares → text
- observacoesMedicas    → text
```

### 3.5 Comportamento ao abrir com `tipoInicial`

```tsx
// Quando tipoInicial é passado:
// 1. O chip do tipo correspondente vem pré-selecionado
// 2. O seletor de tipo fica DESABILITADO (readonly visual)
// 3. Um badge discreto indica "Cadastro rápido de [tipo]"
// 4. Os campos dinâmicos do tipo já aparecem expandidos

// Quando tipoInicial é null:
// - Todos os chips ficam habilitados
// - Campos dinâmicos aparecem após seleção do tipo
```

### 3.6 Validação e submit

```ts
// Antes de salvar:
// - Se tipo === 'visitante'    → dataVisita obrigatória
// - Se tipo === 'novo decidido' → dataDecisao + tipoDecisao obrigatórios
// - celular: validar formato BR (11 dígitos)
// - nome: mínimo 3 caracteres

// POST /api/people
// body: { ...formData, createdAt: now, updatedAt: now, matricula: autoGen }

// Após salvar com sucesso:
// - Fechar modal
// - Toast "✓ [Nome] cadastrado com sucesso"
// - Atualizar lista da tela home sem reload (SWR revalidate / React Query invalidate)
// - Se novo decidido: disparar alerta visual "Lembre de atribuir um amigo!"
```

---

## 4. Modal de Grupos — `<ModalGrupos>`

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Grupos de Acompanhamento              [ + Novo Grupo ] │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ Novos Decididos G1   │  │ Visitantes Abril      │    │
│  │ Sede  [Novos Decid.] │  │ Sede  [Visitantes]    │    │
│  │ Grupo de triagem...  │  │ Acompanhamento de...  │    │
│  │ 👥 3 membros ● Ativo │  │ 👥 5 membros ● Ativo  │    │
│  │ ─────────────────── │  │ ─────────────────────│    │
│  │ 👤 Membros  ✏ Editar │  │ 👤 Membros  ✏ Editar  │    │
│  └──────────────────────┘  └──────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Card de grupo

Cada card exibe:
- Nome do grupo
- Tags: congregação + tipo (badge colorido)
- Descrição (truncada em 2 linhas)
- Contador de membros + status (Ativo/Inativo)
- Ações: `Membros` | `Editar` | `🗑 Excluir`

### 4.3 Tipos de grupo (badges)

| Tipo | Cor |
|---|---|
| Novos Decididos | Âmbar |
| Visitantes | Teal |
| EBD | Azul |
| Célula | Verde |
| Discipulado | Roxo |

### 4.4 Sub-modal: Novo Grupo

Ao clicar em `+ Novo Grupo` dentro do modal de grupos:

```
Campos:
- nomeGrupo *      → text
- tipo *           → select [ Novos Decididos | Visitantes | EBD | Célula | Discipulado ]
- congregacao *    → select
- descricao        → textarea
- lider            → busca de membro
- status           → toggle (ativo)

POST /api/groups
```

---

## 5. Endpoints da API

### 5.1 People

```
GET    /api/people
       ?tipo=visitante|novo decidido|membro|...
       ?status=ativo|inativo
       ?congregacao=Sede|...
       ?semAmigo=true          → retorna apenas sem amigoResponsavel
       ?page=1&limit=20

POST   /api/people             → cadastro (modal)
PATCH  /api/people/:id         → atualização parcial
DELETE /api/people/:id         → exclusão (soft delete: status = 'inativo')

GET    /api/people/aniversariantes?dias=7&data=YYYY-MM-DD
GET    /api/people/alertas      → sem amigo + sem contato há X dias
```

### 5.2 Groups

```
GET    /api/groups
       ?tipo=novos decididos|visitantes|...
       ?congregacao=Sede

POST   /api/groups
PATCH  /api/groups/:id
DELETE /api/groups/:id

GET    /api/groups/:id/members
POST   /api/groups/:id/members  → { peopleId }
DELETE /api/groups/:id/members/:peopleId
```

### 5.3 Atividades de acompanhamento

```
GET    /api/activities?peopleId=xxx&limit=20
POST   /api/activities
       body: { peopleId, tipo, descricao, responsavelId, data }

PATCH  /api/activities/:id     → marcar checklist como concluído
```

### 5.4 Dashboard/KPIs

```
GET    /api/dashboard/projeto-amigo
       ?mes=04&ano=2026
       → retorna: visitantesMes, decididosMes, emAcompanhamento,
                  semAmigo, consolidados, entradaPorDia[]
```

---

## 6. Schema MongoDB — coleção `people` (campos adicionais)

```js
{
  // campos base (já existentes)
  _id, nome, sexo, dataNascimento, email, celular,
  tipo, grupo, estadoCivil, batizado, dataBatismo,
  congregacao, status, endereco, ministerio,
  fotoUrl, matricula, createdAt, updatedAt,

  // campos Projeto Amigo (novos)
  projetoAmigo: {
    etapa:            String,  // 'triagem'|'acolhimento'|'integracao'|'consolidacao'|'discipulado'
    amigoId:          ObjectId, // ref: people._id
    dataDecisao:      Date,    // apenas novo decidido
    dataVisita:       Date,    // apenas visitante
    tipoDecisao:      String,  // 'aceitou jesus'|'reconciliacao'|'reconsagracao'
    batizoInteresse:  Boolean,
    comoConheceu:     String,
    grupoId:          ObjectId, // ref: groups._id
    ultimoContato:    Date,
    totalContatos:    Number,
    checklistEtapa:   [{ id: String, feito: Boolean, feitoPor: ObjectId, feitoEm: Date }],
    observacoes:      String,
  }
}
```

---

## 7. Schema MongoDB — coleção `groups`

```js
{
  _id, nome, tipo, congregacao, descricao,
  liderId: ObjectId,  // ref: people._id
  status: String,     // 'ativo'|'inativo'
  createdAt, updatedAt
}
```

---

## 8. Schema MongoDB — coleção `activities`

```js
{
  _id,
  peopleId:      ObjectId,  // ref: people._id
  responsavelId: ObjectId,  // ref: people._id
  tipo:          String,    // 'whatsapp'|'ligacao'|'visita'|'culto'|'ebd'|'celula'
  descricao:     String,
  data:          Date,
  createdAt:     Date
}
```

---

## 9. Componentes React

```
src/
├── pages/
│   └── ProjetoAmigo/
│       ├── index.tsx               ← rota /projeto-amigo (home)
│       ├── components/
│       │   ├── KpiRow.tsx
│       │   ├── DualTrack.tsx
│       │   │   ├── TrackCard.tsx   ← reutilizável p/ visitante e decidido
│       │   │   └── FunnelBar.tsx
│       │   ├── AlertasList.tsx
│       │   ├── WeekChart.tsx
│       │   ├── ActivityFeed.tsx
│       │   └── AmigosRanking.tsx
│       └── modals/
│           ├── ModalCadastro.tsx   ← prop: tipoInicial
│           ├── ModalGrupos.tsx     ← lista de grupos + novo grupo
│           └── ModalDetalhe.tsx    ← detalhe do membro (etapas, checklist, histórico)
```

---

## 10. Fluxo de abertura dos modais

```
Home
 ├── [+ Visitante]       → openModal('cadastro', { tipoInicial: 'visitante' })
 ├── [+ Novo Decidido]   → openModal('cadastro', { tipoInicial: 'novo decidido' })
 ├── [👥 Grupos]         → openModal('grupos')
 │    └── [+ Novo Grupo] → openModal('novoGrupo')  ← empilhado sobre grupos
 └── Clique em pessoa    → openModal('detalhe', { peopleId })
      └── [Avançar etapa] → PATCH /api/people/:id
```

---

## 11. Alertas automáticos (regras de negócio)

| Condição | Severidade | Ação sugerida |
|---|---|---|
| Novo decidido sem `amigoId` por mais de 48h | 🔴 Urgente | Botão "Atribuir" |
| Visitante sem `amigoId` por mais de 7 dias | 🔴 Urgente | Botão "Atribuir" |
| `ultimoContato` há mais de 5 dias (decidido) | 🟡 Atenção | Botão "Notificar amigo" |
| `ultimoContato` há mais de 10 dias (visitante) | 🟡 Atenção | Botão "Notificar amigo" |
| Etapa sem avanço há mais de 15 dias | 🟠 Alerta | Botão "Ver situação" |

Esses alertas são calculados no endpoint `GET /api/people/alertas` e exibidos na home em tempo real.

---

## 12. Notas de implementação

- O campo `tipo` no `<ModalCadastro>` usa chips clicáveis (não radio/select nativo). Quando `tipoInicial` é passado via prop, os chips ficam `pointer-events: none` e o chip selecionado tem aparência diferente (borda + cor de fundo).
- O modal de grupos é um overlay centralizado com `z-index` superior ao da página, mas pode ter um sub-modal de "Novo Grupo" empilhado acima dele com `z-index` ainda maior.
- Ao salvar um novo decidido sem amigo, o sistema deve disparar automaticamente um item de alerta na lista.
- O `grupoId` em `projetoAmigo` não é o mesmo que `grupo` no campo raiz (que representa o grupo etário: "adulto 1", "jovens" etc). São campos distintos.