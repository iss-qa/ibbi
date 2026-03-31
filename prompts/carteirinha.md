# Feature Spec — Carteirinha de Membro IBBI

## Contexto do projeto

Sistema de gestão eclesiástica **IBBI** (Igreja Batista Bíblica Israel).  
Stack: React + Vite + Tailwind CSS, backend Fastify + MongoDB.  
Autenticação com `useAuth()`. API client em `../services/api`.

---

## Objetivo

Criar a feature de **geração de carteirinha de membro** (cartão no padrão crédito: 85,6 × 53,98 mm), com frente e verso, em dois formatos de download: **PNG** e **PDF**, além de impressão direta.

---

## Dados da Igreja (constantes)

```js
const CHURCH = {
  name: 'IGREJA BATISTA BÍBLICA ISRAEL',
  shortName: 'IBBI',
  phone: '+55 71 3051-2535',
  email: 'ibbisede@gmail.com',
  cnpj: '15.185.408/0001-52',
};
```

---

## Componente: `CarteirinhaModal`

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `person` | `Object` | Objeto do membro (veja campos abaixo) |
| `onClose` | `Function` | Fecha o modal |

### Campos do membro (`person`)

Vêm do banco/API e **não precisam ser editados** no modal:

| Campo | Tipo | Exemplo |
|-------|------|---------|
| `_id` | string | `"6601abc..."` |
| `nome` | string | `"Ana Paula Ferreira"` |
| `dataNascimento` | string ISO | `"1990-03-15"` |
| `congregacao` | string | `"Sede"` |
| `dataBatismo` | string ISO | `"2015-06-01"` |
| `matricula` | number | `42` |
| `foto` | string (URL) | `"https://..."` (opcional) |

Campos **que precisam ser preenchidos no modal antes de gerar**:

| Campo | Tipo | Obrigatório | Opções |
|-------|------|-------------|--------|
| `tipoSanguineo` | string | ✅ | `A`, `B`, `AB`, `O` |
| `fatorRh` | string | ✅ | `+`, `-` |
| `alergias` | string | ❌ | Texto livre |
| `contatoEmergenciaNome` | string | ✅ | Texto livre |
| `contatoEmergenciaTel` | string | ✅ | Telefone |

---

## Fluxo de navegação — 2 steps

```
Step 1: HealthForm
  └─ Formulário com: tipoSanguineo, fatorRh, alergias, contatoEmergenciaNome, contatoEmergenciaTel
  └─ Validação: todos os campos obrigatórios devem estar preenchidos
  └─ Botão: "Visualizar Carteirinha →" → avança para Step 2

Step 2: Preview + Download
  └─ Toggle: Frente | Verso
  └─ Preview escalado (scale ~0.48) do card renderizado
  └─ Botões: PNG (lado ativo), PDF (frente+verso), Imprimir
```

---

## Design da Frente do Cartão

**Dimensões de render**: 856 × 540px (10× para qualidade). Escalar com `transform: scale(0.48)` para exibição.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [NAVY HEADER ─ 160px tall]                                  │
│  [Logo SVG]  CARTEIRA DE MEMBRO                  [Holo]     │
│              IGREJA BATISTA                                  │
│              BÍBLICA ISRAEL (dourado)                        │
├─────[GOLD LINE 6px]──────────────────────────────────────────┤
│                                                  ┌─────────┐ │
│  [Nº 000042]                                     │  FOTO   │ │
│                                                  │148×172px│ │
│  NOME (Cinzel 24px, uppercase, bold)             │borda ouro│ │
│                                                  └─────────┘ │
│  NASCIMENTO  CONGREGAÇÃO                                      │
│  BATISMO     MEMBRO DESDE                                     │
│                                                               │
├────[NAVY FOOTER ─ 52px]──────────────────────────────────────┤
│  CNPJ 15.185.408/0001-52    ● VÁLIDO INDEFINIDAMENTE (ouro)  │
└───────────────────────────────────────────────────────────────┘
```

### Cores

| Token | Hex |
|-------|-----|
| Navy principal | `#0a1f44` |
| Navy secundário | `#112b5e` |
| Ouro principal | `#c9a227` |
| Ouro claro | `#e8c547` |
| Fundo card | gradiente `#f8f6f0 → #ffffff → #f0ede4` |

### Fontes (Google Fonts)

```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- Título/Nome: **Cinzel** (serif formal)
- Corpo: **Barlow** (sans-serif limpo)
- Todos os valores de dados em **UPPERCASE + bold**

### Watermark de fundo

Grid 6×4 de logos SVG da IBBI com `opacity: 0.04`.

---

## Design do Verso do Cartão

**Fundo**: gradiente navy `#0a1f44 → #112b5e`

### Layout

```
┌────[GOLD LINE 6px]───────────────────────────────────────────┐
│  INFORMAÇÕES           SAÚDE & EMERGÊNCIA (ouro)   [❤ ícone]│
├──────────────────────────────────────────────────────────────┤
│  [GRUPO SANG]  [ALERGIAS]         [BATISMO]                  │
│   A +           PENICILINA         01/06/2015                │
│   (destaque ouro)                                            │
├──────────────────────────────────────────────────────────────┤
│  🚨 EMERGÊNCIA — AVISAR:                                     │
│  ┌──────────────────────┬──────────────────────┐            │
│  │ NOME                 │ TELEFONE             │            │
│  │ MARIA APARECIDA      │ (71) 99999-0000      │            │
│  └──────────────────────┴──────────────────────┘            │
├────[DARK FOOTER]─────────────────────────────────────────────┤
│  📞 +55 71 3051-2535   ✉ ibbisede@gmail.com   🌐 ibbi...   │
└──────────────────────────────────────────────────────────────┘
```

---

## Logo SVG IBBI (componente)

Desenhar em SVG puro (sem imagem externa):

```
- Cúpula dourada com cruz no topo
- Estrutura de templo/prédio em navy abaixo
- Bíblia aberta como base (navy)
- Círculo dourado ao redor
- Viewbox 0 0 80 80
```

---

## Lógica de Download

### PNG
```js
// Usa html2canvas com scale: 3 no ref do card ativo (frente ou verso)
// Nomeia: Carteirinha-IBBI-[PrimeiroNome]-[side].png
```

### PDF
```js
// Captura frente E verso (ambos renderizados em div oculta fora da tela)
// new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] })
// Página 1: frente | Página 2 (addPage): verso
// Nomeia: Carteirinha-IBBI-[PrimeiroNome].pdf
```

### Impressão
```js
// Abre window.open('', '_blank')
// Insere ambas as imagens como <img style="width: 85.6mm; height: 53.98mm">
// @media print { gap: 10mm; }
// setTimeout(() => window.print(), 500)
```

**Dica:** renderizar frente e verso em `position: absolute; left: -9999px` para captura do PDF enquanto o usuário vê apenas o lado ativo.

---

## Dependências NPM a instalar

```bash
npm install html2canvas jspdf
```

---

## Integração com o Dashboard/Lista de Membros

No componente de lista de membros (`Membros.jsx` ou similar), adicionar botão **"🪪 Gerar Carteirinha"** por linha da tabela:

```jsx
import CarteirinhaModal from '../components/CarteirinhaModal';

// No estado:
const [carteirinhaPerson, setCarteirinhaPerson] = useState(null);

// No botão da linha:
<button onClick={() => setCarteirinhaPerson(membro)}>🪪</button>

// Após a tabela:
{carteirinhaPerson && (
  <CarteirinhaModal
    person={carteirinhaPerson}
    onClose={() => setCarteirinhaPerson(null)}
  />
)}
```

---

## Endpoint Backend (Fastify) — Salvar dados de saúde

Criar rota para persistir os dados de saúde no documento do membro:

```
PATCH /api/members/:id/health
Body: {
  tipoSanguineo: string,
  fatorRh: string,
  alergias: string,
  contatoEmergenciaNome: string,
  contatoEmergenciaTel: string
}
```

No modal, após `onSubmit(form)` do step 1, chamar:
```js
await api.patch(`/members/${person._id}/health`, form);
```

Isso garante que na próxima vez que o membro abrir a carteirinha os dados já venham preenchidos (pular o step 1 se todos os campos obrigatórios já existirem).

### Lógica de skip do step 1

```js
// No CarteirinhaModal:
const missingHealth = !person.tipoSanguineo || !person.contatoEmergenciaNome || !person.contatoEmergenciaTel;
const [step, setStep] = useState(missingHealth ? 'form' : 'preview');
```

---

## Acessibilidade e UX

- Indicador de loading nos botões de download (`disabled + animate-pulse`)
- Label "Tamanho padrão cartão de crédito (85,6 × 54 mm)" abaixo do preview
- Step indicator visual (círculos numerados) no header do modal
- Botão "←" no step 2 para voltar ao formulário

---

## Arquivo de implementação

O componente completo já está em:
```
/components/CarteirinhaModal.jsx
```

Importar e usar conforme integração acima.