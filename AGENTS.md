# AGENTS.md — Igreja Batista Bíblica Israel (IBBI)
> Arquivo de contexto para agentes de IA e IDEs inteligentes (Cursor, Windsurf, Copilot, etc.)
> Mantenha este arquivo na raiz do monorepo.

---

## 🏛️ Visão Geral do Projeto

**Nome:** Sistema de Gestão de Membros — Igreja Batista Bíblica Israel (IBBI)
**Tipo:** Aplicação web fullstack — monorepo
**Objetivo:** CRUD completo de membros da igreja com painel de comunicação automatizado via WhatsApp (Evolution API)

---

## 🗂️ Estrutura do Monorepo

```
ibbi-system/
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
JWT_SECRET=ibbi_secret_key_2026
JWT_EXPIRES_IN=7d

# Evolution API — WhatsApp
EVOLUTION_API_URL=https://evo2.wastezero.com.br
EVOLUTION_INSTANCE=Isaias
EVOLUTION_API_KEY=26ACA0213352-4CD3-83CE-F3586D857FE9

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
- Senha: `Is@i@s1989`
- Role: `master`

**Regra de login — usuários comuns:**
- Login: primeiro nome em lowercase (ex: membro "João Pedro Silva" → login `joao`)
- Senha padrão: `IBBI2026`

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

> **Demais colunas do CSV devem ser ignoradas.**

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
2. **Delay de 30s entre mensagens em lote é OBRIGATÓRIO** — nunca remover ou reduzir
3. **Senhas sempre em hash bcrypt** — nunca retornar `senha` em nenhum response da API
4. **Virtual `idade`** — nunca persistir no banco, sempre calcular em runtime
5. **Hook pre-save no Person:** se `batizado = true` → `tipo = 'membro'`
6. **Se `status = 'inativo'`** → campo `motivoInativacao` é obrigatório
7. **O número de celular** sempre armazenado apenas com dígitos (sem máscara), com DDD
8. **Log de mensagens** — todo envio (individual ou em lote) deve gerar registro na collection `messages`
9. **Seed script** deve ser idempotente — não duplicar registros se executado mais de uma vez
10. **Templates de mensagens** ficam APENAS em `messages.templates.js` — nunca hardcodar mensagens nos controllers
11. **Aulas EBD** só podem ser criadas em datas domingo (dayOfWeek === 0)
12. **Índice único composto** { data, classe } na collection ebd_aulas
13. **Presença pré-populada** com todos os ativos do grupo, presente = true por padrão
14. **Chamada bloqueada** para edição após 7 dias — exceto master

---

## 📞 Contatos e Referências do Projeto

| Item | Valor |
|---|---|
| WhatsApp Instância (dev/teste) | Isaias |
| WhatsApp Igreja (pedidos de oração) | 5571996838735 |
| MongoDB | `mongodb://localhost:27017/ibbi_local` |
| Evolution API Base URL | `https://evo2.wastezero.com.br` |
| Usuário master | login: `Isaias` / senha: `Is@i@s1989` |
| Senha padrão usuários comuns | `IBBI2026` |

---

*Última atualização: gerado automaticamente — manter sincronizado com o estado atual do projeto.*
