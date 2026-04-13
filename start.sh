#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   IBBI - Sistema de Gestao da Igreja   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERRO] Node.js nao encontrado. Instale em https://nodejs.org${NC}"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js $(node -v)"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERRO] npm nao encontrado.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} npm $(npm -v)"

# Verificar MongoDB
if command -v mongosh &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} MongoDB CLI disponivel"
elif command -v mongod &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} MongoDB disponivel"
else
    echo -e "${YELLOW}[AVISO] MongoDB CLI nao encontrado. Certifique-se de que o MongoDB esta rodando.${NC}"
fi

echo ""

# Verificar arquivo .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${YELLOW}[AVISO] Arquivo .env nao encontrado.${NC}"
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        echo -e "${YELLOW}Criando .env a partir do .env.example...${NC}"
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        echo -e "${YELLOW}>> Edite o arquivo .env com suas configuracoes antes de usar em producao.${NC}"
    else
        echo -e "${RED}[ERRO] .env.example tambem nao encontrado.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}[OK]${NC} Arquivo .env encontrado"

echo ""
echo -e "${BLUE}Instalando dependencias...${NC}"
echo ""

# Instalar dependencias raiz
echo -e "${YELLOW}>> Raiz do projeto${NC}"
cd "$PROJECT_DIR" && npm install
echo ""

# Instalar dependencias do backend
echo -e "${YELLOW}>> Backend${NC}"
cd "$PROJECT_DIR/backend" && npm install
echo ""

# Instalar dependencias do frontend
echo -e "${YELLOW}>> Frontend${NC}"
cd "$PROJECT_DIR/frontend" && npm install
echo ""

cd "$PROJECT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Dependencias instaladas com sucesso  ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Perguntar se deseja rodar o seed
echo -e "${YELLOW}Deseja executar o seed do banco de dados? (s/N)${NC}"
read -r run_seed
if [[ "$run_seed" =~ ^[sS]$ ]]; then
    echo -e "${BLUE}Executando seed...${NC}"
    npm run seed
    echo ""
fi

# Iniciar o projeto
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Iniciando o projeto...               ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Backend:${NC}  http://localhost:3001"
echo -e "${GREEN}Frontend:${NC} http://localhost:5173"
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para encerrar.${NC}"
echo ""

npm run dev
