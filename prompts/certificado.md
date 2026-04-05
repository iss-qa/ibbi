# IBBI Sistema — Prompt de Desenvolvimento: Ajustes de Funcionalidades

> **Contexto:** Sistema de gestão da Igreja Batista Bíblica Israel (IBBI).
> Os ajustes abaixo envolvem controle de acesso por role (`admin` / `user`), novas opções de menu para o perfil `user`, geração de carteirinha de membro e certificado de batismo.
> Implemente cada ajuste respeitando rigorosamente as regras de acesso por role e por tipo de membro descritas neste documento.

---

## 1. Botão "Sair" no Menu (role: `user`)

### Requisito
Adicionar a opção **"Sair"** ao menu lateral do usuário com role `user`.

### Posicionamento
- Deve ser o **último item do menu**, imediatamente abaixo de "Pedido de Oração".

### Comportamento
1. Ao clicar em "Sair", exibir um **modal de confirmação** centralizado com a mensagem:
   > *"Deseja realmente sair do sistema?"*
2. O modal deve conter dois botões:
   - **"Sim"** → efetua o logout e redireciona para a tela de login.
   - **"Não"** → fecha o modal e mantém o usuário na tela atual (nenhuma ação realizada).
3. **Não realizar logout sem a confirmação explícita do usuário.**

---

## 2. Restrição de Geração de Carteirinha por Tipo de Membro

### Requisito
A geração da carteirinha do membro **não deve estar disponível** para os seguintes tipos:

| Tipo           | Pode gerar carteirinha? |
|----------------|-------------------------|
| Membro         | ✅ Sim                  |
| Congregado     | ❌ Não                  |
| Criança        | ❌ Não                  |
| Novo Decidido  | ❌ Não                  |
| Visitante      | ❌ Não                  |

### Implementação
- No painel **admin**, na listagem de membros, o botão/ação de gerar carteirinha deve estar **desabilitado ou oculto** para os tipos não permitidos.
- Aplicar essa restrição em todos os pontos do sistema onde a carteirinha pode ser gerada.

---

## 3. Menu "Carteirinha" para role `user` (somente tipo Membro)

### Requisito
Adicionar ao menu lateral do usuário com role `user` a opção **"Carteirinha"**, com as seguintes regras de visibilidade:

| Tipo do usuário logado | Exibe "Carteirinha" no menu? |
|------------------------|------------------------------|
| Membro                 | ✅ Sim                        |
| Congregado             | ❌ Não                        |
| Criança                | ❌ Não                        |
| Novo Decidido          | ❌ Não                        |
| Visitante              | ❌ Não                        |

### Posicionamento no menu
- O item "Carteirinha" deve ficar acima do item "Pedido de Oração" 

### Comportamento ao acessar "Carteirinha"
1. O membro logado visualiza **sua própria carteirinha** — frente e verso — na mesma tela.
2. **Isolamento total de dados:** cada membro visualiza exclusivamente sua própria carteirinha. O sistema deve buscar a carteirinha com base no `id` do usuário autenticado na sessão, **jamais por parâmetro de URL ou input externo manipulável**. João não pode acessar a carteirinha de Maria e vice-versa.

### Ações disponíveis para o membro (role `user`)

| Ação                  | Disponível?                                          |
|-----------------------|------------------------------------------------------|
| Baixar como Imagem    | ✅ Sim                                               |
| Baixar como PDF       | ✅ Sim                                               |
| Imprimir              | ✅ Sim                                               |
| Enviar via WhatsApp   | ❌ **Não** — remover completamente para role `user`  |

> O botão "Enviar via WhatsApp" é exclusivo do painel admin. Para role `user` ele não deve aparecer em nenhuma circunstância.

---

## 4. Certificado de Batismo

### 4.1 Acesso via Painel Admin — Coluna de Ações

#### Regra de exibição
- Na tabela de membros, a ação **"Certificado de Batismo"** deve aparecer na coluna de ações **somente para membros que possuem o campo `data_batismo` preenchido**.
- Membros sem data de batismo não exibem essa ação.

#### Comportamento ao clicar (admin)
1. Exibir a **frente** do certificado no tamanho padrão (formato paisagem A4 — 29,7 × 21 cm).
2. Exibir o **verso** do certificado logo abaixo da frente na mesma tela ou modal.
3. Ações disponíveis para o admin:

| Ação                | Disponível? |
|---------------------|-------------|
| Baixar como PDF     | ✅ Sim      |
| Imprimir            | ✅ Sim      |
| Enviar via WhatsApp | ✅ Sim      |

---

### 4.2 Acesso via Menu para role `user` — Opção "Certificado"

#### Regra de visibilidade no menu
- Adicionar ao menu lateral do role `user` a opção **"Certificado"**.
- Exibir essa opção **somente se** o usuário logado possuir o campo `data_batismo` preenchido.
- Membros sem data de batismo **não veem essa opção no menu**.

#### Posicionamento no menu
- Abaixo de "Carteirinha" (quando visível) e acima de "Sair".

#### Comportamento
1. O membro visualiza seu próprio certificado — frente e verso.
2. **Isolamento de dados:** o certificado é carregado com base no `id` do usuário autenticado na sessão.
3. Ações disponíveis para o membro (role `user`):

| Ação                | Disponível?                                         |
|---------------------|-----------------------------------------------------|
| Visualizar imagem   | ✅ Sim                                              |
| Baixar como PDF     | ✅ Sim                                              |
| Imprimir            | ✅ Sim                                              |
| Enviar via WhatsApp | ❌ **Não** — não exibir para role `user`            |

---

### 4.3 Layout do Certificado — FRENTE

> **Referência obrigatória:** arquivo `docs/certificado_de_batismo_-_rgb.pdf` (página 1).
> Reproduzir com máxima fidelidade visual — dimensões, cores, tipografia, ornamentos e disposição dos elementos.

#### Dimensões e orientação
- Formato **paisagem (landscape)** — proporção A4 (29,7 × 21 cm).
- Cor de fundo: **creme/off-white** (`#fdf8f0` ou equivalente fiel ao PDF).

#### Bordas ornamentais decorativas (azul — `#3a6fa0` ou fiel ao PDF)
- **Canto superior esquerdo:** motivo de folhagem/ramo com espiral voltado para dentro.
- **Canto superior direito:** espelhado horizontalmente em relação ao canto esquerdo.
- **Canto inferior esquerdo:** motivo diferente — círculos concêntricos com espirais.
- **Canto inferior direito:** espelhado horizontalmente.
- **Centro do topo:** ornamento decorativo horizontal tipo arabesco/scroll em azul.
- **Centro da base:** mesmo ornamento do topo, espelhado verticalmente.

> Utilizar SVG inline ou assets importados para reproduzir os ornamentos. Não substituir por bordas CSS simples.

#### Marca d'água de fundo
- Linhas onduladas horizontais em azul claro/translúcido cobrindo a área central do certificado, conforme o PDF.

#### Título
- Texto: **`CERTIFICADO DE BATISMO`**
- Tipografia: serif bold, caixa alta, tamanho ~42–48pt.
- Cor: azul (`#3a6fa0`).
- Alinhamento: centralizado.

#### Versículo (abaixo do título)
- Texto em itálico, ~11pt, centralizado:
  > *"De sorte que estamos sepultados com Ele pelo batismo na morte; para que, como Cristo ressucitou dos mortos pela glória do Pai, assim andemos nós também em novidade de vida" — **Romanos 6.4***

#### Corpo do Certificado

**Linha da Igreja (preenchida automaticamente):**
```
A  IGREJA BATISTA BÍBLICA ISRAEL  certifica que
```
- "A" à esquerda, seguido de linha sublinhada com o nome da igreja em **caixa alta e negrito**, encerrando com "certifica que" à direita.

**Linha do Nome do Membro (preenchida automaticamente):**
- Linha sublinhada longa e centralizada com o **nome completo do membro em CAIXA ALTA**.

**Parágrafo do certificado (preenchido automaticamente):**
```
Crendo e obedecendo as sagradas escrituras, seguindo a ordenança de Jesus
Cristo, foi batizado nesta igreja, sob pública profissão de fé, em nome do Pai, do
Filho e do Espírito Santo no dia [DIA] de [MÊS POR EXTENSO] de [ANO].
```
- Alinhamento: centralizado.
- Os campos de data são preenchidos automaticamente a partir do campo `data_batismo` do membro.
- Formato: dia como número (`15`), mês por extenso em português (`março`), ano com 4 dígitos (`2021`).
- Exemplo: `no dia **15** de **março** de **2021**.`

#### Assinaturas (rodapé)
- Dois blocos simétricos centralizados:
  - Esquerda: linha sublinhada + label `Secretário`
  - Direita: linha sublinhada + label `Pastor`

---

### 4.4 Layout do Certificado — VERSO

> **Referência obrigatória:** arquivo `docs/certificado_de_batismo_-_rgb.pdf` (página 2).
> Mesma identidade visual da frente: fundo creme, bordas ornamentais azuis, ornamentos de arabesco no topo e na base, linhas onduladas como marca d'água.

#### Título
- Texto: **`PACTO DAS IGREJAS BATISTAS`**
- Tipografia: serif, caixa alta, espaçamento entre letras ampliado (letter-spacing), cor azul.
- Alinhamento: centralizado.

#### Parágrafo introdutório (negrito, centralizado, ~12pt)
> Tendo sido levados pelo Espírito Santo a aceitar a Jesus Cristo como único e suficiente Salvador, e batizados, sob profissão de fé, em nome do Pai, do Filho e do Espírito Santo, decidimo-nos, unânimes, como um corpo em Cristo, firmar, solene e alegremente, na presença de Deus e desta congregação, o seguinte Pacto:

#### Texto do Pacto (corpo, centralizado, ~10pt)
Reproduzir integralmente:

> Comprometemo-nos a, auxiliados pelo Espírito Santo, andar sempre unidos no amor cristão; trabalhar para que esta Igreja cresça no conhecimento da Palavra, na santidade, no conforto mútuo e na espiritualidade; manter os seus cultos, suas doutrinas, suas ordenanças e sua disciplina; contribuir liberalmente para o sustento do ministério, para as despesas da Igreja, para o auxílio dos pobres e para a propaganda do Evangelho em todas as nações. Comprometemo-nos, também, a manter uma devoção particular; a evitar e condenar todos os vícios; a educar religiosamente nossos filhos; a procurar a salvação de todo o mundo, a começar dos nossos parentes, amigos e conhecidos; a ser corretos em nossas transações, fiéis em nossos compromissos, exemplares em nossa conduta e ser diligentes nos trabalhos seculares; evitar a detração, a difamação e a ira, sempre e em tudo visando à expansão do Reino do nosso Salvador. Além disso, comprometemo-nos a ter cuidado uns dos outros; a lembrarmo-nos uns dos outros nas orações; ajudar mutuamente nas enfermidades e necessidades; cultivar relações francas e a delicadeza no trato; estar prontos a perdoar as ofensas, buscando, quando possível, a paz com todos os homens. Finalmente, nos comprometemos a, quando sairmos desta localidade para outra, nos unirmos a uma outra Igreja da mesma fé e ordem, em que possamos observar os princípios da Palavra de Deus e o espírito deste Pacto. O Senhor nos abençoe e nos proteja para que sejamos fiéis e sinceros até a morte.

#### Rodapé do verso
- Texto pequeno, alinhado à direita, itálico, azul:
  ```
  www.igrejabatista.net | @memoriadosbatistas
  ```

---

## 5. Resumo de Permissões por Role e Tipo

### Itens visíveis no menu — role `user`

| Item do Menu      | Membro (c/ batismo) | Membro (s/ batismo) | Congregado | Criança | Novo Decidido | Visitante |
|-------------------|:-------------------:|:-------------------:|:----------:|:-------:|:-------------:|:---------:|
| Perfil            | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pedido de Oração  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Carteirinha       | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Certificado       | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sair              | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Ações disponíveis por role

| Funcionalidade              | Admin | User (Membro) |
|-----------------------------|:-----:|:-------------:|
| Gerar carteirinha           | ✅    | ✅ (só a própria) |
| Baixar carteirinha (imagem) | ✅    | ✅ |
| Baixar carteirinha (PDF)    | ✅    | ✅ |
| Imprimir carteirinha        | ✅    | ✅ |
| WhatsApp — carteirinha      | ✅    | ❌ |
| Ver certificado batismo     | ✅    | ✅ (só o próprio) |
| Baixar certificado (PDF)    | ✅    | ✅ |
| Imprimir certificado        | ✅    | ✅ |
| WhatsApp — certificado      | ✅    | ❌ |

---

## 6. Observações Gerais de Implementação

1. **Segurança (backend obrigatório):** Todas as operações de visualização de carteirinha e certificado para role `user` devem ser validadas no **backend**. O `id` do recurso deve ser derivado do token/sessão do usuário autenticado, nunca de parâmetro de URL ou corpo da requisição enviado pelo cliente.

2. **Formatação da data no certificado:** Formatar o campo `data_batismo` separando dia (número), mês (por extenso em pt-BR) e ano (4 dígitos). Ex.: `15 de março de 2021`.

3. **Fidelidade visual do certificado:** O HTML/CSS renderizado deve reproduzir fielmente o modelo do PDF de referência. Os ornamentos decorativos dos cantos e do centro devem ser implementados com SVG inline — não substituir por bordas CSS genéricas. Cores, fontes e espaçamentos devem respeitar o PDF.

4. **Tamanho padrão do certificado:** Renderizar em proporção A4 paisagem. No modo impressão/PDF, garantir que frente e verso caibam cada um em uma única página, sem cortes.

5. **Modal de confirmação de logout:** Deve ser implementado como um componente de modal global, impedindo interação com o restante da tela enquanto estiver aberto.