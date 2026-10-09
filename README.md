# PastorIA — Quem falta, faz falta.

Plataforma SaaS multi-tenant de retenção e cuidado de membros para igrejas: IA pastoral no WhatsApp da liderança, chamada e frequência, reengajamento de ausentes, aniversários automáticos, pedidos de oração, carteirinha, certificado, dashboard, EBD e acompanhamento do Projeto Amigo. Nasceu como o sistema interno da Igreja Batista Bíblica Israel (IBBI), hoje o tenant fundador.

Landing page em `/`, cadastro de igreja em `/cadastro`, planos em `/planos`.

## Visão Geral

Este repositório é um monorepo com:

- `frontend/`: aplicação React/Vite
- `backend/`: API Node.js/Express para execução tradicional
- `api/index.js`: entrada serverless usada em produção

O projeto atende três cenários principais:

- administração da membresia
- comunicação e automação via WhatsApp
- acompanhamento de visitantes e novos decididos

## Stack

### Frontend

- React 18
- Vite 5
- React Router DOM
- Tailwind CSS
- Axios
- Recharts
- html2canvas / jsPDF

### Backend / API

- Node.js
- Express
- Mongoose
- MongoDB
- JWT
- bcryptjs
- multer
- node-cron
- axios

### Integrações

- Evolution API para WhatsApp
- MongoDB via `MONGO_URI`
- reCAPTCHA v3 opcional no login

## Arquitetura

### Desenvolvimento

Em ambiente local, a arquitetura é separada:

- frontend em `http://localhost:5173`
- backend em `http://localhost:3001`

O frontend consome a API pelo arquivo [api.js](frontend/src/services/api.js), que em desenvolvimento aponta para `http://localhost:3001/api`.

### Produção

A produção roda no **EasyPanel**, a partir do [Dockerfile](Dockerfile), num único processo Node ([backend/server.js](backend/server.js)):

- o frontend é buildado na imagem (Vite) e servido como estático pelo próprio Express (`public/`)
- as rotas `/api/*` são atendidas pelo mesmo processo
- o scheduler (aniversários, jornada, campanhas), o monitor da Evolution e a fila anti-ban rodam junto (desligue com `DISABLE_SCHEDULER=true`)
- dependências do backend ficam em `backend/package.json`, que é o que a imagem instala
- as variáveis `VITE_*` do "Ambiente" do EasyPanel entram como build args do frontend
- mantenha **uma réplica** só: a fila e o scheduler ficam em memória

## Resposta Direta às Suas Perguntas

### Back-end hospedado onde?

No **EasyPanel** (VPS), pelo [Dockerfile](Dockerfile): API, front, scheduler e fila no mesmo container.

### A API é qual stack?

A API usa:

- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcryptjs

### E o front?

Vai na mesma imagem: o build do Vite é copiado para `public/` e servido pelo Express.

### Endereço do GitHub

- [https://github.com/iss-qa/pastoria](https://github.com/iss-qa/pastoria)

### Domínio público

- [https://pastoria.issqa.com.br/login](https://pastoria.issqa.com.br/login)

Nas mensagens, o link do portal vem de `portalUrl()` em [brand.js](backend/src/tenancy/brand.js): `Tenant.branding.portalUrl` da igreja, senão `APP_URL`.

## Estrutura do Projeto

```text
pastoria/
├── backend/
│   ├── server.js                 # API + front estático + scheduler (dev e produção)
│   ├── package.json
│   └── src/
│       ├── config/               # conexão com banco e configs
│       ├── controllers/          # regras de negócio por domínio
│       ├── middlewares/          # auth, role, validações
│       ├── models/               # schemas Mongoose
│       ├── routes/               # rotas Express
│       ├── services/             # integrações e serviços de domínio
│       ├── templates/            # templates de mensagens WhatsApp
│       ├── utils/                # helpers e regras de acesso
│       └── scripts/              # seed e scripts utilitários
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── components/           # componentes reutilizáveis
│       ├── pages/                # páginas principais
│       ├── hooks/                # hooks de autenticação e dados
│       ├── services/             # cliente HTTP
│       ├── constants/            # enums/listas
│       └── assets/               # imagens e recursos visuais
├── tests/                        # testes Playwright
├── Dockerfile                    # imagem de produção (EasyPanel)
├── package.json                  # scripts do monorepo
└── README.md
```

## Principais Módulos Funcionais

- Autenticação e perfis de acesso
- Cadastro e manutenção de membros
- Carteirinha e certificado
- Comunicação via WhatsApp
- Pedidos de oração
- Dashboard geral
- EBD
- Projeto Amigo
- Convites e cadastros externos

## Fluxo de Requisição em Produção

```text
Navegador
  -> Frontend React/Vite
  -> /api/*
  -> EasyPanel (proxy HTTPS)
  -> backend/server.js (Express)
  -> Controllers / Services
  -> MongoDB + Evolution API
```

## Entradas Principais

### Frontend

- [App.jsx](frontend/src/App.jsx)
- [main.jsx](frontend/src/main.jsx)

### Backend local

- [server.js](backend/server.js)

### Backend produção/serverless

- [api/index.js](api/index.js)

## Banco de Dados

O projeto usa MongoDB e lê a conexão por:

- `MONGO_URI`

A conexão é centralizada em:

- [db.js](backend/src/config/db.js)

O repositório não fixa o provedor do banco no código, mas aceita tanto MongoDB local quanto MongoDB remoto por `mongodb+srv`.

### Banco configurado atualmente

- Produção: MongoDB Atlas
- Nome do banco em produção: `ibbi_prod`
- Ambiente local: MongoDB local
- Nome do banco local: `ibbi_local`

## Variáveis de Ambiente Essenciais

Baseado em [.env.example](.env.example):

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `DEFAULT_USER_PASSWORD`
- `SEED_MASTER_PASSWORD`
- `EVOLUTION_API_URL`
- `EVOLUTION_INSTANCE`
- `EVOLUTION_API_KEY`
- `EVOLUTION_ALLOW_SELF_SIGNED`
- `CHURCH_WHATSAPP_NUMBER`
- `MOCK_WHATSAPP_NUMBER`
- `FORCE_MOCK_RECIPIENT`
- `RECAPTCHA_SECRET_KEY`
- `RECAPTCHA_MIN_SCORE`
- `VITE_RECAPTCHA_SITE_KEY`
- `PORT`
- `NODE_ENV`

## Scripts

Na raiz do projeto:

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run seed
npm run build
npm run test
npm run test:api
npm run test:e2e
npm run test:health
```

## Segurança e Integrações

- autenticação com JWT
- senhas com bcrypt
- CORS configurado no backend
- rate limit nas rotas de autenticação
- integração WhatsApp encapsulada no backend
- frontend não expõe a API key da Evolution

## Rotas Principais da API

Exemplos:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/persons`
- `POST /api/persons`
- `GET /api/messages/log`
- `POST /api/messages/send-by-group`
- `POST /api/prayer/send`
- `GET /api/dashboard`
- `GET /api/projeto-amigo/dashboard`
- `GET /api/grupos`

## Deploy Atual Identificado no Repositório

### Frontend

- EasyPanel: build do Vite dentro da imagem, servido pelo Express

### Backend

- EasyPanel: container Node.js com Express ([Dockerfile](Dockerfile)), scheduler e fila no mesmo processo

### Banco

- MongoDB externo configurado por variável de ambiente

### WhatsApp

- Evolution API externa

## Observações Úteis

- [backend/server.js](backend/server.js) é a mesma entrada em desenvolvimento e em produção
- a base do frontend em produção usa `/api`, sem precisar informar domínio manualmente
- existem aliases de rota para grupos, incluindo `/api/grupos`

## Resumo Executivo

Este projeto é um monorepo fullstack com React no frontend e Express/MongoDB no backend. Em desenvolvimento ele roda com dois processos separados; em produção um único container no EasyPanel serve o frontend estático, a API, o scheduler e a fila. O repositório Git é [iss-qa/pastoria](https://github.com/iss-qa/pastoria), e o domínio público é [pastoria.issqa.com.br](https://pastoria.issqa.com.br/login). A IBBI é a igreja fundadora (tenant `ibbi`).
