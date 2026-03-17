# IBBI — Sistema de Gestão de Membros

Sistema web completo para gerenciamento de membros e comunicação via WhatsApp (Evolution API).

## Pré-requisitos

- Node.js 18+
- MongoDB local em `mongodb://localhost:27017/ibbi_local`

## Configuração

1. Copie e ajuste as variáveis de ambiente:

```bash
cp .env.example .env
```

2. Instale dependências:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Rodar em desenvolvimento

```bash
npm run dev
```

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

## Importar dados (seed)

```bash
npm run seed
```

O seed cria o usuário master e importa o CSV em `docs/churchcrm-export-20260315-222627.csv`.

## Credenciais padrão

Master (admin master):
- Usuário: `Isaias`
- Senha: `Is@i@s1989`

Administrador:
- Usuário: `elisa`
- Senha: `IBBI2026`

Usuário comum (exemplo):
- Usuário: `joao`
- Senha: `IBBI2026`

## Build do Frontend

```bash
npm run build
```

## Rotas principais

- `POST /api/auth/login`
- `GET /api/persons`
- `POST /api/persons/import-csv`
- `POST /api/messages/send-by-group`
- `POST /api/messages/send-by-congregation`
- `POST /api/prayer/send`

## Observações

- A API Key da Evolution **nunca** é exposta no frontend.
- O envio em lote respeita o delay mínimo de 30s entre mensagens.


mongoDB atlas - logado com conta ibbisede
https://cloud.mongodb.com/v2/680e4da27be50a66a3cbac5f#/overview


ibbi_db
janio052829@IBBI


mongodb+srv://ibbi_db:janio052829@IBBI@ibbicluster.yrebnpd.mongodb.net/?appName=ibbicluster