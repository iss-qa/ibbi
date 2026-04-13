# IBBI — Sistema de Gestão de Membros

Sistema web fullstack para gestão de membros da Igreja Batista Bíblica Israel, com comunicação via WhatsApp, pedidos de oração, carteirinha, certificado, dashboard, EBD e fluxo de acompanhamento do Projeto Amigo.

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

O frontend consome a API pelo arquivo [api.js](/Users/isaiassilva/development/igreja/ibbi/frontend/src/services/api.js), que em desenvolvimento aponta para `http://localhost:3001/api`.

### Produção

Em produção, o projeto foi estruturado para rodar na Vercel com frontend e backend no mesmo deploy:

- o frontend é servido como aplicação estática
- as rotas `/api/*` são reescritas para [api/index.js](/Users/isaiassilva/development/igreja/ibbi/api/index.js)
- essa entrada sobe um app Express em modo serverless

Isso é definido em [vercel.json](/Users/isaiassilva/development/igreja/ibbi/vercel.json).

Em outras palavras:

- `frontend`: hospedado na Vercel
- `backend/api`: também hospedado na Vercel, como função serverless baseada em Express

Observação importante:
não encontrei no repositório evidência de outro provedor de hospedagem para a API em produção. Pelos arquivos atuais, a arquitetura publicada é Vercel para frontend e API.

## Resposta Direta às Suas Perguntas

### Back-end hospedado onde?

Pelos arquivos do projeto, o backend em produção está preparado para rodar na **Vercel**, via [api/index.js](/Users/isaiassilva/development/igreja/ibbi/api/index.js), com Express em modo serverless.

### A API é qual stack?

A API usa:

- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcryptjs

### Front no Vercel?

Sim. O repositório possui [vercel.json](/Users/isaiassilva/development/igreja/ibbi/vercel.json) e a estrutura do frontend foi organizada para build estático com Vite.

### Endereço do GitHub

- [https://github.com/iss-qa/ibbi](https://github.com/iss-qa/ibbi)

### Domínio público identificado no projeto

Foi encontrado no código o portal:

- [https://ibbi.issqa.com.br/login](https://ibbi.issqa.com.br/login)

Esse endereço aparece em [member.service.js](/Users/isaiassilva/development/igreja/ibbi/backend/src/services/member.service.js).

## Estrutura do Projeto

```text
ibbi/
├── api/
│   └── index.js                  # entrada serverless para produção (Vercel)
├── backend/
│   ├── server.js                 # backend tradicional para desenvolvimento/local
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
├── vercel.json                   # rewrites do deploy Vercel
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
  -> Vercel rewrite
  -> api/index.js
  -> Express
  -> Controllers / Services
  -> MongoDB + Evolution API
```

## Entradas Principais

### Frontend

- [App.jsx](/Users/isaiassilva/development/igreja/ibbi/frontend/src/App.jsx)
- [main.jsx](/Users/isaiassilva/development/igreja/ibbi/frontend/src/main.jsx)

### Backend local

- [server.js](/Users/isaiassilva/development/igreja/ibbi/backend/server.js)

### Backend produção/serverless

- [api/index.js](/Users/isaiassilva/development/igreja/ibbi/api/index.js)

## Banco de Dados

O projeto usa MongoDB e lê a conexão por:

- `MONGO_URI`

A conexão é centralizada em:

- [db.js](/Users/isaiassilva/development/igreja/ibbi/backend/src/config/db.js)

O repositório não fixa o provedor do banco no código, mas aceita tanto MongoDB local quanto MongoDB remoto por `mongodb+srv`.

### Banco configurado atualmente

- Produção: MongoDB Atlas
- Nome do banco em produção: `ibbi_prod`
- Ambiente local: MongoDB local
- Nome do banco local: `ibbi_local`

## Variáveis de Ambiente Essenciais

Baseado em [.env.example](/Users/isaiassilva/development/igreja/ibbi/.env.example):

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

- Vercel

### Backend

- Vercel Serverless Functions com Express

### Banco

- MongoDB externo configurado por variável de ambiente

### WhatsApp

- Evolution API externa

## Observações Úteis

- o backend local em [backend/server.js](/Users/isaiassilva/development/igreja/ibbi/backend/server.js) continua importante para desenvolvimento
- a produção usa [api/index.js](/Users/isaiassilva/development/igreja/ibbi/api/index.js), não `backend/server.js`
- a base do frontend em produção usa `/api`, sem precisar informar domínio manualmente
- existem aliases de rota para grupos, incluindo `/api/grupos`

## Resumo Executivo

Este projeto é um monorepo fullstack com React no frontend e Express/MongoDB no backend. Em desenvolvimento ele roda com dois processos separados; em produção ele foi adaptado para Vercel, onde o frontend estático e a API serverless convivem no mesmo deploy. O repositório Git é [iss-qa/ibbi](https://github.com/iss-qa/ibbi), e o domínio público identificado no código é [ibbi.issqa.com.br](https://ibbi.issqa.com.br/login).
