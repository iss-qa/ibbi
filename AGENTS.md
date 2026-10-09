# AGENTS.md — PastorIA
> Arquivo de contexto para agentes de IA e IDEs inteligentes (Cursor, Windsurf, Copilot, etc.)
> Mantenha este arquivo na raiz do monorepo.

---

## 🏛️ Visão Geral do Projeto

**Nome do produto:** PastorIA — slogan: *"Quem falta, faz falta."*
**Tipo:** Aplicação web fullstack SaaS multi-tenant — monorepo
**Objetivo:** retenção e cuidado de membros para igrejas: IA pastoral no WhatsApp da liderança, chamada/frequência, reengajamento de ausentes, aniversários e gestão de pessoas. A IBBI é o tenant fundador (cliente), não mais o nome do sistema.

**Marca (frontend):** tokens Tailwind `brandNavy/brandGold/brandBlue/brandCream` (mesma paleta dos antigos `ibbi*`, que seguem em uso nas telas internas). Wordmark em `components/landing/Logo.jsx`. Assistente padrão: "Barnabé" (configurável por igreja).

---

## 🗂️ Estrutura do Monorepo

```
pastoria/
├── AGENTS.md                        ← este arquivo
├── package.json                     ← scripts raiz (concurrently)
├── .env                             ← variáveis de ambiente (NÃO versionar)
├── .env.example                     ← modelo do .env (versionar)
│
├── backend/                         ← Node.js + Express + Mongoose
│   ├── server.js
│   ├── package.json
│   └── src/
│       ├── config/
│       │   └── db.js                ← conexão MongoDB
│       ├── models/
│       │   ├── Person.model.js
│       │   ├── User.model.js
│       │   ├── Message.model.js
│       │   └── EbdAula.model.js
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── person.controller.js
│       │   ├── user.controller.js
│       │   ├── message.controller.js
│       │   └── ebd.controller.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── person.routes.js
│       │   ├── user.routes.js
│       │   ├── message.routes.js
│       │   └── ebd.routes.js
│       ├── middlewares/
│       │   ├── auth.middleware.js   ← verifica JWT
│       │   └── role.middleware.js   ← verifica role (master/admin/user)
│       ├── services/
│       │   ├── whatsapp.service.js  ← toda integração Evolution API
│       │   └── scheduler.service.js ← cron jobs (aniversários)
│       ├── templates/
│       │   └── messages.templates.js ← templates de mensagens WhatsApp
│       └── scripts/
│           └── seed.js              ← importa CSV + cria usuário master
│
└── frontend/                        ← React 18 + Vite + TailwindCSS
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── assets/
        │   └── logo-ibbi.png
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── Members/
        │   │   ├── MemberList.jsx
        │   │   ├── MemberForm.jsx
        │   │   └── MemberDetail.jsx
        │   ├── Communication/
        │   │   ├── CommunicationPanel.jsx
        │   │   ├── SendByGroup.jsx
        │   │   ├── SendByCongregation.jsx
        │   │   ├── SendIndividual.jsx
        │   │   └── MessageLog.jsx
        │   ├── PrayerRequest.jsx    ← disponível para user comum
        │   └── Users/
        │       └── UserManagement.jsx ← apenas master
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── Header.jsx
        │   ├── MemberCard.jsx
        │   ├── BirthdayWidget.jsx
        │   ├── MessageQueue.jsx     ← progresso de envio em lote
        │   └── ProtectedRoute.jsx
        ├── hooks/
        │   ├── useAuth.js
        │   └── useMembers.js
        └── services/
            └── api.js               ← axios instance para o backend
```

---

## ⚙️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + Vite + TailwindCSS |
| Back-end | Node.js + Express.js |
| Banco de Dados | MongoDB local |
| ODM | Mongoose |
| Autenticação | JWT + bcryptjs |
| WhatsApp | Evolution API v2 |
| Agendamento | node-cron |
| Fila de Mensagens | Fila FIFO em memória com delay controlado |
| Variáveis de Ambiente | dotenv |
| HTTP Client (front) | axios |
| Concorrência dev | concurrently |

---

## 🔐 Variáveis de Ambiente — `.env`

> **NUNCA** commitar o `.env` real. Usar `.env.example` no repositório.

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/ibbi_local

# JWT
JWT_SECRET=<gere 32+ caracteres aleatórios — ex.: openssl rand -hex 32>
JWT_EXPIRES_IN=7d

# Evolution API — WhatsApp
EVOLUTION_API_URL=https://evo2.wastezero.com.br
EVOLUTION_INSTANCE=Isaias
EVOLUTION_API_KEY=<chave da instância — nunca versionar>

# WhatsApp da Igreja (recebe pedidos de oração e será substituído)
CHURCH_WHATSAPP_NUMBER=5571996838735

# Servidor
PORT=3001
NODE_ENV=development
```

---

## 🗃️ Models — Mongoose

### Person.model.js

```js
// Campos obrigatórios e seus tipos
{
  nome:           String,   // concatenação: Nome + Segundo Nome + Sobrenome (do CSV)
  sexo:           String,   // enum: ['Masculino', 'Feminino']
  dataNascimento: Date,     // aniversário — idade é virtual calculado
  email:          String,
  celular:        String,   // número WhatsApp — usado em TODOS os envios
  tipo:           String,   // enum: ['membro','congregado','visitante','novo decidido','criança']
  grupo:          String,   // enum: ['criança','adolescente','jovem','adulto 1','adulto 2','idoso','ancião']
  estadoCivil:    String,   // enum: ['solteiro(a)','casado(a)','divorciado(a)','viúvo(a)','separado(a)','união estável']
  batizado:       Boolean,  // se true → tipo = 'membro' automaticamente
  dataBatismo:    Date,     // exibir apenas se batizado = true
  congregacao:    String,   // enum: ver seção Congregações abaixo
  status:         String,   // enum: ['ativo','inativo'] — default: 'ativo'
  motivoInativacao: String, // enum: ['falecimento','desvio doutrinário','mudança de endereço','desconhecido','outro']
                            // obrigatório apenas quando status = 'inativo'
  endereco:       String,   // concatenação: Endereço + Complemento + Cidade + Estado + CEP (do CSV)
  ministerio:     String,
}
// Virtual: idade = ano atual - ano de dataNascimento (não persiste no banco)
// Hook pre-save: se batizado = true → this.tipo = 'membro'
```

### User.model.js

```js
{
  nome:      String,
  login:     String,   // único — primeiro nome lowercase para users comuns
  senha:     String,   // hash bcrypt salt 10 — NUNCA retornar no response
  role:      String,   // enum: ['master','admin','user'] — default: 'user'
  personId:  ObjectId, // ref: 'Person' — vincula ao membro correspondente
  ativo:     Boolean,  // default: true
  createdAt: Date,
}
```

### Message.model.js

```js
{
  tipo:          String,   // enum: ['aniversario','aviso','reunião','ata','documento','convite','oracao','personalizada']
  destinatarios: [{ nome: String, celular: String }],
  conteudo:      String,
  status:        String,   // enum: ['pendente','enviando','concluido','erro']
  enviadoPor:    ObjectId, // ref: 'User'
  criadoEm:      Date,
  concluidoEm:   Date,
  erros:         [{ celular: String, motivo: String }],
}
```

---

## 👥 Roles e Permissões

| Funcionalidade | `user` | `admin` | `master` |
|---|:---:|:---:|:---:|
| Ver/editar próprios dados | ✅ | ✅ | ✅ |
| Enviar pedido de oração | ✅ | ✅ | ✅ |
| CRUD completo de membros | ❌ | ✅ | ✅ |
| Painel de comunicação WA | ❌ | ✅ | ✅ |
| Ver log de mensagens | ❌ | ✅ | ✅ |
| Gerenciar usuários | ❌ | ❌ | ✅ |
| Promover usuário a admin | ❌ | ❌ | ✅ |

**Usuário master fixo (seed):**
- Nome: `Isaias Santos Silva`
- Login: `Isaias`
- Senha: configurada via `SEED_MASTER_PASSWORD` no `.env`
- Role: `master`

**Regra de login — usuários comuns:**
- Login: primeiro nome em lowercase (ex: membro "João Pedro Silva" → login `joao`)
- **Não existe senha padrão compartilhada.** Toda conta nova/resetada recebe senha provisória aleatória (`config/defaults.js` → `applyTempPassword`), válida por 7 dias e trocada no primeiro acesso. A antiga `DEFAULT_USER_PASSWORD`/`IBBI2026` é recusada no login de contas que ainda não trocaram a senha (`TEMP_PASSWORD_EXPIRED` → líder gera nova em Usuários → Resetar senha).

**Segurança (não regredir):**
- Updates nunca recebem `{...req.body}`: sempre allowlist de campos. O plugin de tenancy recusa qualquer operador que toque `tenantId`; `server.js` remove chaves `$…` do corpo.
- URL/mídia vinda de usuário ou igreja → `utils/url-guard.js` (só https, bloqueia rede interna, sem redirect). Evolution interna (Docker): liberar o host em `OUTBOUND_ALLOWED_HOSTS`.
- `webhookToken` só em `GET /api/tenant/webhook-info` (master); rotação em `POST /api/tenant/webhook-info/rotate`. `GET /api/tenant` para admin/user devolve só o resumo (`serializeForMember`).
- Celular é identidade no WhatsApp: membro não altera o próprio; celular/status de admin/master só o master altera (web e agente).
- Endpoints por id checam a congregação do admin (`findAccessiblePerson`, `applyScopedCongregacaoFilter`).

---

## 📱 Integração Evolution API — WhatsApp

> **REGRA CRÍTICA:** Toda comunicação com a Evolution API deve passar **exclusivamente pelo back-end**.
> O front-end NUNCA chama a Evolution API diretamente. A API Key nunca é exposta ao cliente.

### Endpoint de envio de texto

```
POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}
Headers:
  Content-Type: application/json
  apikey: {EVOLUTION_API_KEY}
Body:
  {
    "number": "55{celular}",   // ex: 5571999998888
    "text": "mensagem aqui"
  }
```

### Regras anti-banimento — OBRIGATÓRIAS

```
- Delay MÍNIMO de 30 segundos entre cada mensagem em envio em lote
- Nunca disparar mais de 1 mensagem simultânea
- Fila FIFO: processar uma por vez, aguardar delay, processar próxima
- Em caso de erro em um envio: registrar o erro, continuar para o próximo
- Exibir progresso em tempo real: "Enviado X de Y mensagens"
- Permitir cancelar fila em andamento
- Registrar TODOS os envios (sucesso ou erro) na collection messages
```

### Serviço de fila — `whatsapp.service.js`

```js
// Estrutura esperada do serviço:
// sendSingle(celular, mensagem)          → envia para um número
// sendBatch(destinatarios, mensagem)     → enqueue + processa com delay 30s
// cancelQueue()                          → cancela fila em andamento
// getQueueStatus()                       → retorna { total, enviado, erro, status }
```

---

## 🎂 Cron Job — Aniversários

```
Arquivo: backend/src/services/scheduler.service.js
Frequência: diariamente às 08:00 (cron: '0 8 * * *')
Lógica:
  1. Buscar todos os Person com dataNascimento.dia == hoje.dia && dataNascimento.mes == hoje.mes
  2. Filtrar: status = 'ativo' e celular preenchido
  3. Para cada um: montar mensagem com template 'aniversario'
  4. Enfileirar no whatsapp.service (respeitar delay 30s)
  5. Salvar log na collection messages
```

---

## 📝 Templates de Mensagens — `messages.templates.js`

```js
// Todos os templates ficam neste arquivo
// Variáveis entre chaves: {nome}, {congregacao}, {data}, {local}

aniversario(nome)
aviso(nome, texto)
reuniao(nome, data, local)
pedidoOracao(remetente, mensagem)
personalizada(nome, texto)

// Template de aniversário (não alterar sem autorização):
// 🎂 *Feliz Aniversário, {nome}!*
// "Ensina-nos a contar os nossos dias..." (Sl 90:12)
// Que o Senhor continue a guiar seus passos! 🙏
// _Igreja Batista Bíblica Israel_
```

---

## 🏘️ Congregações — Enum válido

```
'Sede', 'Periperi', 'Cajazeiras', 'Fazenda Grande',
'Mussurunga', 'Paripe', 'Plataforma', 'São Cristóvão', 'Valéria'
```
> ⚠️ Confirmar lista completa com a imagem de congregações fornecida pelo cliente.

---

## 📥 Importação CSV — Mapeamento de Campos

| Coluna no CSV | Campo na Collection `persons` | Observação |
|---|---|---|
| Nome + Segundo Nome + Sobrenome | `nome` | Concatenar 3 colunas com espaço |
| Sexo | `sexo` | Mapear para 'Masculino'/'Feminino' |
| DataNascimento | `dataNascimento` | Converter para Date |
| Email | `email` | |
| Celular | `celular` | Limpar máscara, manter só dígitos |
| Classificacao | `tipo` | Mapear para enum do model |
| Grupo | `grupo` | Mapear para enum do model |
| EstadoCivil | `estadoCivil` | Mapear para enum do model |
| Batizado | `batizado` | Boolean |
| MembershipDate | `dataBatismo` | Converter para Date |
| Congregacao | `congregacao` | Mapear para enum do model |
| Status | `status` | 'ativo'/'inativo' |
| Endereco + Complemento + Cidade + Estado + CEP | `endereco` | Concatenar com vírgulas |
| Ministerio | `ministerio` | |

> **Demais colunas do CSV devem ser ignoradas.** Implementação atual: `services/person-import.service.js` (aceita também o modelo simplificado do PastorIA — ver seção *Importação de pessoas*).

---

## 🎨 Identidade Visual

- **Paleta:** extraída da logomarca IBBI (arquivo em `/frontend/src/assets/logo-ibbi.png`)
- **Cores sugeridas base:** azul royal + dourado + branco
- **Tipografia:** Playfair Display (títulos) + Inter (corpo)
- **UI:** sidebar fixa, cards com sombra suave, tabelas com hover, badges coloridos por tipo/status
- **Responsividade:** mobile-first, breakpoints Tailwind padrão
- **Tema:** claro (padrão) com suporte a tema escuro

---

## 🛣️ Rotas da API — Backend

```
Auth
  POST   /api/auth/login
  GET    /api/auth/me

Persons (requer auth)
  GET    /api/persons              → lista com filtros e paginação
  GET    /api/persons/:id
  POST   /api/persons              → admin/master
  PUT    /api/persons/:id          → admin/master
  DELETE /api/persons/:id          → master
  POST   /api/persons/import-csv   → master

Messages (requer admin/master)
  POST   /api/messages/send-individual
  POST   /api/messages/send-by-group
  POST   /api/messages/send-by-congregation
  POST   /api/messages/send-birthday     → uso interno do cron
  GET    /api/messages/log
  GET    /api/messages/queue-status
  POST   /api/messages/cancel-queue

Prayer (requer auth — qualquer role)
  POST   /api/prayer/send          → envia pedido ao número da igreja

Users (requer admin/master)
  GET    /api/users
  PUT    /api/users/:id/role       → promover/rebaixar admin
  PUT    /api/users/:id/status     → ativar/inativar usuário

Dashboard (requer auth)
  GET    /api/dashboard

Invitations (requer admin/master)
  POST   /api/invitations          → gera link externo

Public
  POST   /api/public/invitations/:token/submit

Uploads (requer admin/master)
  POST   /api/uploads/person-photo

Export (requer admin/master)
  GET    /api/export/persons

EBD (requer auth)
  GET    /api/ebd
  GET    /api/ebd/:id
  POST   /api/ebd                    → admin/master
  PUT    /api/ebd/:id                → admin/master
  PUT    /api/ebd/:id/presencas      → admin/master
  DELETE /api/ebd/:id                → master
  GET    /api/ebd/domingo/:date
  GET    /api/ebd/relatorio/classe/:grupo
  GET    /api/ebd/relatorio/pessoa/:id
  GET    /api/ebd/relatorio/geral
```

---

## 🚀 Scripts de Desenvolvimento

```bash
# Raiz do monorepo — rodar tudo junto
npm run dev

# Apenas backend (porta 3001)
npm run dev:backend

# Apenas frontend (porta 5173)
npm run dev:frontend

# Importar CSV e criar usuário master
npm run seed

# Build de produção do frontend
npm run build
```

---

## ⚠️ Regras e Convenções para o Agente

1. **A API Key da Evolution NUNCA deve aparecer no código do frontend** — sempre via variável de ambiente no backend
2. **Anti-banimento é OBRIGATÓRIO** — todo envio iniciado pela igreja passa por `services/whatsapp/antiban.js` (`sendText(..., { bulk: true })`, fila ou `whatsapp.paceBulk()`): intervalo aleatório 45–90s (piso de 30s, nunca reduzir), janela 08h–21h, limites por hora/dia, pausa a cada 20, bloqueio de duplicadas e "digitando…". Nunca use `setTimeout` fixo para espaçar envios
3. **Senhas sempre em hash bcrypt** — nunca retornar `senha` em nenhum response da API
4. **Virtual `idade`** — nunca persistir no banco, sempre calcular em runtime
5. **Hook pre-save no Person:** se `batizado = true` → `tipo = 'membro'`
6. **Se `status = 'inativo'`** → campo `motivoInativacao` é obrigatório
7. **O número de celular** sempre armazenado apenas com dígitos (sem máscara), com DDD
8. **Log de mensagens** — todo envio (individual ou em lote) deve gerar registro na collection `messages`
9. **Seed script** deve ser idempotente — não duplicar registros se executado mais de uma vez
10. **Templates de mensagens** ficam APENAS em `messages.templates.js` — nunca hardcodar mensagens nos controllers
11. **Aulas EBD** só podem ser criadas em datas domingo (dayOfWeek === 0)
12. **Índice único composto** { tenantId, data, classe, congregacao } na collection ebdaulas
13. **Presença pré-populada** com todos os ativos do grupo, presente = true por padrão
14. **Chamada bloqueada** para edição após 7 dias — exceto master
15. **Dependência nova do backend vai em `backend/package.json`** — é o que o [Dockerfile](Dockerfile) instala na imagem de produção (EasyPanel). Produção = um processo Node (`backend/server.js`) servindo a API, o front buildado (`public/`), o scheduler e a fila; não há mais deploy na Vercel.

---

## 🎨 Layout e UX (telas internas)

- **Shell** (`App.jsx`): menu lateral flutuante arredondado (`Sidebar.jsx`, sticky no desktop, gaveta no celular com Esc/backdrop) + barra superior fixa com o botão de menu **só no celular**. Páginas não precisam de recuo para o botão (nada de `pl-12`). Conteúdo limitado a `max-w-[1440px]`.
- **Nunca** use `overflow-x: hidden` em `html/body/#root` ou ancestrais do menu: quebra o `position: sticky`. Use `overflow-x: clip` (`overflow-x-clip`).
- **Fundo por igreja:** token Tailwind `bg-app` (CSS var `--app-bg-rgb`, padrão creme). `Tenant.branding.corFundo` (#rrggbb, só tons claros — validado no front e em `tenant.controller`) é aplicado pelo `TenantContext`. O menu lateral continua `ibbiNavy` sempre. Configurações → Aparência.
- **Rotas com `React.lazy`**: toda página nova entra em `App.jsx` como `lazy(() => import(...))` (o bundle inicial caiu de 1,8 MB para ~240 KB). Fontes carregadas só no `index.html` (sem `@import` no CSS).
- **Componentes** (`components/ui.jsx`): `Card`/`KpiCard` (`rounded-2xl`), `Tabs` (pílulas roláveis, a ativa entra na tela sozinha), `Modal` (folha de baixo no celular), `Button`, `Field`, `Toggle`, `inputClass`. Prefira-os a classes soltas.
- **Configurações** (`Settings/TenantSettings.jsx`): abas Igreja · Aparência · WhatsApp · Anti-bloqueio · Automações · Liderança · Líderes de EBD · Assistente IA, com `?aba=` na URL. A barra flutuante "Alterações não salvas" compara `buildPayload(form)` com o tenant salvo — campo novo salvo pelo botão entra em `buildPayload`.
- Responsivo de 320px a 1920px: tabela sempre dentro de `overflow-x-auto` (ou cartões abaixo de `sm`), `min-w-0`/`truncate`/`break-words` em textos longos, grids com fallback de 1 coluna.

## 🧹 Manutenção de dados

- `node backend/src/scripts/audit-test-users.js [saida.csv]` (com `MONGO_URI` do ambiente): **somente leitura**; lista igrejas, masters e usuários/pessoas com cara de teste (nomes das suítes, sufixo `Mn…`, telefones `000…`, igrejas de teste/demo) em `TESTE` / `REVISAR`. Exclusão só depois de revisar a lista.
- Operador da plataforma ≠ master da igreja: `PlatformUser` (`PLATFORM_ADMIN_EMAIL/PASSWORD`, painel `/platform`) é o administrador geral do SaaS; `User.role = 'master'` é o dono de **uma** igreja.

## 🌐 Landing page e cadastro público

- `/` → `frontend/src/pages/Landing/` (Nav, Hero com `ChatDemo`, Sections, Plans). Animações em CSS puro (`index.css`, bloco "Landing page") + `hooks/useReveal.js` / `components/landing/Reveal.jsx` (reveal por scroll, respeita `prefers-reduced-motion`). Sem lib de animação.
- `/cadastro` → `pages/Signup.jsx`: cria a igreja via `POST /api/public/signup` e mostra login + senha temporária; `?plano=` pré-seleciona o plano.
- Provisionamento (tenant + master) centralizado em `backend/src/tenancy/provision.service.js`, usado pelo painel da plataforma e pelo cadastro público. Email de boas-vindas em `templates/welcome-email.template.js`; aviso para `ALERT_EMAIL`/`PLATFORM_ADMIN_EMAIL`.
- `VITE_CONTACT_WHATSAPP` (opcional): número para o botão "Falar com a equipe" do plano Rede.
- **Marca:** SVGs e PNGs em `frontend/public/brand/` (marca 16→1024px, horizontal/vertical, claro/escuro), `favicon.svg`/`favicon.ico`/`apple-touch-icon.png`/`icon-192|512.png`, `og-image.png` e `site.webmanifest`. Regenerar PNGs: renderizar os SVGs com Playwright (ver `frontend/public/brand/*.svg`). Nas telas React use `components/landing/Logo.jsx`; a logo da IBBI (`assets/logo-ibbi.jpeg`) só como fallback do tenant fundador em `TenantLogo`, carteirinha e certificado.

## 📥 Importação de pessoas (CSV)

- `GET /api/persons/import-template` (master) baixa o modelo; `POST /api/persons/import-csv` (master, multipart `file`, máx. 5 MB / 5000 linhas). `?dryRun=1` só valida e devolve a prévia.
- Lógica em `backend/src/services/person-import.service.js`: cabeçalhos casados sem acento/caixa via `HEADER_ALIASES` (modelo PastorIA **e** export do ChurchCRM: `Nome+Segundo Nome+Sobrenome`, `Gênero`, `Data de Aniversário`, `Classificação`, `MembershipDate`…); separador `,` ou `;` detectado; datas `dd/mm/aaaa` ou ISO; congregação validada contra `Tenant.congregacoes` (sem match → "Não atribuído" + aviso); enums tolerantes a gênero ("casada" → `casado(a)`); `applyPersonBusinessRules` (batizado ⇒ membro, grupo pela idade); duplicados ignorados pela mesma regra do cadastro manual (`buildDuplicateQuery`) e dentro do arquivo. Idempotente.
- Tela: botão "Importar CSV" (master) em `Members/MemberList.jsx` → `components/ImportCsvModal.jsx` (arquivo → prévia → importar).

## 🏢 Multi-tenant (SaaS)

- **Modelo:** banco compartilhado, coluna `tenantId` em todas as collections da igreja. A IBBI é o tenant fundador (`slug: ibbi`, plano Multiplicar, isento).
- **Contexto:** `backend/src/tenancy/context.js` (AsyncLocalStorage). `auth.middleware` e `tenant.middleware` executam a requisição dentro de `runWithTenant`.
- **Isolamento automático:** `backend/src/tenancy/plugin.js` injeta `{ tenantId }` em toda query/aggregate/save. **Falha fechado**: sem tenant no contexto a operação lança erro. Rotinas de plataforma usam `runAsPlatform`.
- **Novo model de igreja?** Sempre `Schema.plugin(tenantPlugin)` e índices únicos compostos com `tenantId`.
- **Jobs/crons/webhooks** (fora de requisição) precisam de `runWithTenant(tenant, fn)` explícito. `setImmediate`/promises herdam o contexto.
- **Migração:** `tenancy/bootstrap.js` roda na subida (idempotente): cria o tenant fundador, carimba `tenantId` em docs legados e troca índices únicos globais.
- **Login:** `POST /api/auth/login { login, senha, igreja }` — igreja = slug (ou header `X-Tenant`, subdomínio, `DEFAULT_TENANT_SLUG`). JWT carrega `tid`. Login é único **por igreja**.
- **Textos da igreja:** nunca hardcodar "IBBI" — usar `tenancy/brand.js` (`churchName()`, `churchShort()`, `portalUrl()`).
- **Congregações:** por igreja em `Tenant.congregacoes` (o enum saiu do Person). No front, `CONGREGACOES` é preenchido pelo `TenantContext`.

## 💳 Planos e billing

- Catálogo em `backend/src/config/plans.js` (Semente R$47 até 100 pessoas · Crescer R$99 até 300 · Multiplicar R$197 até 1.000 · Rede acima de 1.000, sob consulta; anual = 10x mensal). `faixa`/`extras` aparecem em `components/PlanCards.jsx` (cada plano lista só o que soma ao anterior). Congregações ilimitadas: 1 igreja = 1 cobrança.
- Limites por plano: pessoas ativas, mensagens WhatsApp/mês, interações de IA/mês (`usage.service` + `UsageCounter`).
- `billing.service.runBillingCycle` (cron 06:00 BRT): fim de trial → fatura → vencida → inadimplente (3 dias) → suspensa (15 dias). Igreja suspensa recebe 402 `TENANT_SUSPENDED` (exceto `/api/tenant/*`).
- Gateway opcional **Asaas** (`ASAAS_API_KEY`), webhook `POST /api/webhooks/asaas`.
- Painel da plataforma: `/platform` (front) e `/api/platform/*` (JWT `aud: platform`, model `PlatformUser`).

## 🤖 IA e WhatsApp

- **Provider por igreja** (`services/whatsapp.service.js`): `evolution` (não oficial, QR) ou `cloud` (API Oficial da Meta). Credenciais criptografadas (`utils/crypto.js`). Tenant com `whatsapp.useEnvFallback` usa `EVOLUTION_*` do `.env`.
- **Interruptor do WhatsApp** (`Tenant.whatsapp.ativo`, Configurações → WhatsApp, `PUT /api/tenant/whatsapp/ativo`, master): desligado = nada sai (`WhatsAppDesativadoError`, code `WHATSAPP_DESATIVADO`, checado em `guardaOptOut` e na fila), webhooks de entrada ignorados e `isConfigured()` falso (scheduler, monitor e avisos pulam a igreja). Vale na hora (também em memória), cancela a fila e não reapresenta o número. Não mexe na instância da Evolution.
- **Fila FIFO por igreja**, delay de 30s mantido. Na API Oficial, mensagens proativas fora da janela de 24h usam templates aprovados (`whatsapp.cloud.templates`).
- **Agente** (`services/ai/agent.service.js` + `tools.js`): Claude via `@anthropic-ai/sdk`, modelo em `AI_MODEL`. Papéis: `lider` (master/admin com celular, `Tenant.lideranca`, `Tenant.ebdLideres`), `membro`, `desconhecido` — cada um com ferramentas próprias.
- **Entrada:** webhooks `POST /api/webhooks/evolution/:slug?token=` e `GET|POST /api/webhooks/whatsapp` → `ai/inbound.service.js` (dedup por messageId, atalhos sem IA para "1 3 5" e "enviar", áudio → transcrição, imagem → visão).
- **Reengajamento** (`services/engagement.service.js`): após cada chamada, calcula faltas consecutivas, abre `CareAlert`, gera mensagem com IA (fallback: template) e envia ou pede aprovação ao líder; ao atingir `semanasAlerta` avisa a liderança. Retorno do membro fecha o alerta.
- **Automações** (`scheduler.service.js`, tick a cada 5 min por igreja no fuso dela): aniversários + aviso à liderança, convocação da chamada no domingo, varredura de ausências, relatório semanal.
- Toda ferramenta que envia mensagem a membro exige aprovação explícita do líder (`confirmado: true`).
- **Menu do líder guiado** (`services/ai/flows.js`, sem IA): 👥 1 Pesquisar (ficha + foto) · 2 Cadastrar · 3 Editar | 📋 4 Registrar presença (EBD: congregação → classe; Uniões: grupo → novo encontro/anteriores/resumir) · 5 Resumir encontro | 💛 6 Grupos (membros, frequência, ausentes 3+, números) · 7 Quem está faltando (ligar/visitar/orar com confirmação "foi feito?", mensagem, encaminhar a obreiro) · 8 Aviso (grupo → mensagem → prévia) · 9 Aniversariantes (semana/mês, com bodas e batismo) · 10 Relatório da semana (avaliação: ≥90% elogio, <50% preocupação em negrito) · 11 Pedidos de oração (fazer/ver). Opções 2 e 3 viram pedido ao agente. Criar/editar grupos e adicionar/remover membros: **só na web** (tools com `channels: ['web']`). `menu`/`MENU` a qualquer momento.
- **Assistente por igreja:** `Tenant.ia.nomeAssistente` (padrão *Barnabé*), catálogo com apresentação bíblica em `config/assistentes.js` (`GET /api/public/assistentes`); nome fora do catálogo usa Lucas 15:4.
- **Pedidos de oração:** model `PedidoOracao` (portal e WhatsApp, via `services/prayer.service.js`); repassados ao WhatsApp da igreja quando configurado. Liderança lista em `GET /api/prayer` e marca `PUT /api/prayer/:id/status` (novo/orado/arquivado); tela `/prayer` (admin/master: lista + modo leitura + novo pedido). Pedidos antigos (log `Message.tipo=oracao`) importados uma vez na subida.
- **Jornada do visitante** (`services/jornada.service.js`, model `Jornada`, feature `jornadaVisitante` — Crescer+): começa sozinha em todo cadastro de visitante/novo decidido (`trigger.service`, aprovação de cadastro, check-in). Etapas sem IA: d1 obrigado pela visita/decisão · d2 pedido de oração (d1/d2 desligáveis em `automacoes.jornada.primeirosDias`) · d3 como foi · d7 convite à união certa (`grupoSugerido` por sexo/idade) · d14 EBD (classe da idade) · d21 visitante "te esperamos" (pulada se voltou) / novo decidido convite ao batismo · d30 resumo à liderança (`notifyLeadership`). "Voltou" = presença em EBD, encontro ou culto depois do dia da visita (`buscarRetorno`). `runJornadas` 1x/dia (scheduler, `automacoes.jornada.hora`, padrão 10:00) envia só a etapa vencida mais recente (atrasadas = `pulada`). Tela `/jornada`; WhatsApp menu 12. Respostas da pessoa → agente registra pedido de contato.
- **Relatório semanal** (`scheduler.runWeeklyReport`): estrutura fixa em `templates.relatorioSemanalLideranca` (EBD por classe + variação, quem precisa de contato com ação sugerida, esfriando, retornos, aniversariantes); a IA escreve só a "Sugestão da semana" (`generators.relatorioSemanal`, reserva `sugestaoPadrao`). Prévia sem envio: `GET /api/tenant/relatorio-semanal/previa` (dados fictícios se a semana não tem chamada).
- **Esfriamento** (`engagement.computeStreaks` → `esfriando`): ≥75% nos 4 registros anteriores e ≤50% nos 4 últimos, com menos de 2 faltas seguidas. Aparece em `overview().esfriando`, no menu 7 (📉) e no relatório da semana.
- **Presença no culto** (`services/culto.service.js`, model `Culto`, feature `checkinCulto` — todos os planos): QR → `wa.me/<numeroInstancia>?text=CHEGUEI <código>`. Tratado **sem IA** em `inbound.preAtendimento` (antes da trava de plano): conhecido = presença; desconhecido = pede nome (`checkin_nome`) → cadastra visitante (boas-vindas + jornada). Check-in não gera falta. Tela `/cultos` (QR, telão, presença manual); WhatsApp menu 4 → 3 (envia o QR ao líder).
- **Escalas de voluntários** (`services/escala.service.js`, model `Escala`, feature `escalas` — todos os planos): convite pela fila anti-ban com "1 Confirmo / 2 Não posso" (conversa do voluntário no estado `escala_convite`, respondida sem IA em `preAtendimento`); recusa → responsável recebe sugestões (mesma função > já serviu no ministério > ministério no cadastro; livres na data) e escolhe pelo número (`escala_substituto`); lembrete na véspera (`automacoes.escalas.lembreteHora`, padrão 18:00) + aviso ao responsável dos pendentes. Tela `/escalas`; WhatsApp menu 13.
- Rotas (admin/master, escopo de congregação): `GET|POST /api/cultos`, `GET /api/cultos/:id`, `POST /api/cultos/:id/encerrar|presencas` · `GET|POST /api/escalas`, `POST /api/escalas/:id/convites|itens`, `GET /api/escalas/:id/sugestoes`, `DELETE /api/escalas/:id[/itens/:itemId]` · `GET /api/jornadas`, `PUT /api/jornadas/:id/cancelar`. Montadas em `/api` com auth **por rota** (`routes/servico.routes.js`) — nunca `router.use(auth)` nesse router, senão bloqueia webhooks e rotas públicas registrados depois.
- `DISABLE_SCHEDULER=true` sobe só a API (sem automações nem monitor) — use em QA para não disparar mensagens.
- **Bodas e batismo:** `Person.dataCasamento`; `scheduler.sendAnniversaryMessages` envia parabéns de casamento e de batismo no dia (junto dos aniversários, 1x/dia).
- **Resumo de encontro:** relato por texto ou áudio (≤ 2 min, `media.seconds`) → IA organiza (`generateText`) → líder aprova → `Encontro.resumo` (`status: agendado`, `enviarEm` = +1h) → `scheduler.runResumosEncontro` envia aos membros com celular, em ordem aleatória, pela fila anti-ban; log `Message.tipo = resumo_encontro`.
- **Cadastro pelo WhatsApp** exige confirmação (`cadastrar_pessoa` com `confirmado`), repetindo o número e alertando celular com 10 dígitos. Boas-vindas vão para o celular da pessoa (em `FORCE_MOCK_RECIPIENT=true`, para o número de teste). Foto: `editar_pessoa.usarUltimaFoto` ou foto enviada com a ficha aberta.
- `criar_grupo_encontro`/`editar_grupo_encontro` só no canal `web` (Assistente da plataforma); no WhatsApp o agente orienta a usar a web.
- Modo teste "conversa consigo mesmo" (`WHATSAPP_SELF_CHAT_TEST`) aceita texto, **áudio e foto**; imagens enviadas pelo bot são marcadas como eco (`isOwnImageEcho`).

### Rotas novas

```
Tenant (auth)            GET /api/tenant · PUT /api/tenant/settings · GET /api/tenant/billing · PUT /api/tenant/billing/plan
                         GET /api/tenant/whatsapp/status · POST /api/tenant/whatsapp/test · GET /api/tenant/webhook-info
Cuidado (admin/master)   GET /api/care/overview · GET /api/care/alerts · PUT /api/care/alerts/:id
                         POST /api/care/alerts/:id/generate · POST /api/care/alerts/:id/send · POST /api/care/process-aula/:id
Assistente (admin/master) POST /api/assistant/chat · GET|DELETE /api/assistant/history
Webhooks                 POST /api/webhooks/evolution/:slug · GET|POST /api/webhooks/whatsapp · POST /api/webhooks/asaas
Plataforma               /api/platform/* (auth, metrics, tenants, invoices, billing/run, plans)
Public                   GET /api/public/plans · GET /api/public/tenants/:slug · GET /api/public/invitations/:token/tenant
                         GET /api/public/signup/slug/:slug · POST /api/public/signup (cadastro da LP → tenant em trial + master; rate limit 5/h/IP, honeypot `website`)
```

## 🔕 Descadastro (SAIR), termos e onboarding

- **SAIR é absoluto:** `services/optout.service.js` + model `OptOut` (por igreja, histórico saiu/voltou). Palavras: sair, parar, stop, descadastrar, remover, "não quero receber"… ("cancelar" sozinho e frases longas NÃO contam). Após o SAIR só sai a confirmação (`sendText(..., { ignorarOptOut: true })`); mensagens do número são registradas e **ignoradas** (nem menu, nem IA, nem check-in) até ele enviar **VOLTAR**.
- **Trava central** em `whatsapp.service` (`guardaOptOut` → `OptOutError` code `OPT_OUT`) em sendText/Image/Audio/Buttons/Contact/Proactive e na fila. Todo envio novo passa por ela automaticamente; nunca use `ignorarOptOut` fora da confirmação do SAIR.
- Liderança: `GET|POST /api/optout`, `POST /api/optout/:id/reativar` (justificativa ≥ 10 caracteres; só com pedido da pessoa). Aba "Descadastrados (SAIR)" na Central de WhatsApp; selo 🔕 em Pessoas. Campanhas marcam descadastrados como `bloqueado`.
- Mensagens proativas (jornada, avisos, resumos, campanhas) levam o rodapé `rodapeSair` (o template de aniversário não foi alterado).
- **Termos:** `config/legal.js` (`TERMOS_VERSAO`), páginas `/termos` e `/privacidade`, aceite no cadastro (com IP) e em `POST /api/tenant/termos/aceitar`. Mudou o texto? Suba a versão: as igrejas veem o aceite pendente. Texto precisa de revisão jurídica.
- **Onboarding:** `services/onboarding.service.js` (etapas termos, igreja, congregações, liderança, WhatsApp, pessoas ≥ 10, grupos, automações, assistente/teste); conclui sozinho. Tela `/primeiros-passos`, banner no Dashboard. Rotas `GET /api/tenant/onboarding`, `POST /onboarding/confirmar|dispensar`.

## 📣 Engajamento e venda

- **Campanhas graduais** (`Campanha` + `campanha.service`): lotes de 30 por tick do scheduler, pausa até 08h do dia seguinte no limite diário, retomada após reinício. Usadas por sermão (menu 14), divulgação de eventos e lembretes. Rotas `/api/campanhas*`.
- **Eventos** (`Evento` + `evento.service`): `INSCREVER <código>` no WhatsApp, lista de espera, Pix estático (`utils/pix.js`, BR Code com CRC16) se `Tenant.pix` configurado: nome do recebedor guarda até 60 (no BR Code vão 25, cortados na palavra) e a cidade é a de `Tenant.cidade` (Dados da igreja). Rotas `/api/eventos*`. Menu 15.
- **Intercessores:** `Person.intercessor`; pedidos **não confidenciais** vão aos intercessores (só o primeiro nome). Pedido sem a flag `confidencial` é confidencial. Acompanhamento em 7 dias. Avisos em segundo plano (nunca segure a resposta HTTP esperando a fila).
- **Lembretes de culto:** `Tenant.cultosProgramados` + opt-in `LEMBRETE` / `PARAR LEMBRETE` (`Person.lembreteCulto`).
- **Células:** `Encontro.relatorio` (visitantes/decisões perguntados após a chamada) e painel `/api/celulas/painel`. **Impacto do mês:** `impacto.service` (`/api/impacto`, menu 16, envio dia 1 às 09h).
- **Indicação:** código = slug (`?ref=`), +7 dias de teste para a indicada e 1 mês de crédito para quem indicou na 1ª fatura paga (idempotente).
- **Demo:** só com `DEMO_ENABLED=true` (+ `VITE_DEMO_ENABLED=true` no front). Slug `demo`, somente leitura (403 `DEMO_READONLY`), `POST /api/public/demo`. A limpeza só apaga models com `tenantPlugin` e sempre filtra por `tenantId`.
- **PWA:** `public/sw.js` (nunca guarda `/api` nem `/uploads`), `offline.html`, atalhos no manifesto, botão "Instalar app".

## 🧪 Suíte E2E completa (`tests/full`)

- `npm run test:full` (API + UI) ou `npm run test:full:api`. Sobe sozinho: WhatsApp falso (3199), backend de teste (3191, banco **`pastoria_e2e`**, recriado a cada execução, sem scheduler/IA/email/gateway) e Vite (4191). Relatório em `tests/full/report`.
- O seed se recusa a rodar em banco que não termine em `_e2e`; todas as variáveis do `.env` real são zeradas. Telefones de teste começam com `000`.
- O piso anti-ban de 30s vale também nos testes (mensagens de lote demoram); só a pausa a cada 20 e os limites hora/dia são afrouxados no ambiente de teste.

---

## 📞 Contatos e Referências do Projeto

| Item | Valor |
|---|---|
| WhatsApp Instância (dev/teste) | Isaias |
| WhatsApp Igreja (pedidos de oração) | 5571996838735 |
| MongoDB | `mongodb://localhost:27017/ibbi_local` |
| Evolution API Base URL | `https://evo2.wastezero.com.br` |
| Usuário master | login: `Isaias` / senha: via `SEED_MASTER_PASSWORD` no `.env` |
| Senha padrão usuários comuns | via `DEFAULT_USER_PASSWORD` no `.env` |

---

*Última atualização: gerado automaticamente — manter sincronizado com o estado atual do projeto.*
