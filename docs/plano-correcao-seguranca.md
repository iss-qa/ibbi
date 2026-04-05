# Plano de Correcao de Seguranca e Endurecimento do Sistema IBBI

## Objetivo

Este documento consolida o plano de correcao de seguranca do sistema IBBI com foco em:

- eliminar exposicoes criticas de segredos e dados sensiveis;
- corrigir falhas de autorizacao, validacao e fluxo publico;
- manter o link de convite externo fixo, mas com aprovacao manual antes de liberar acesso;
- manter senha inicial padrao, mas forcar alteracao obrigatoria no primeiro login;
- organizar a execucao por etapas com criterio claro de conclusao.

## Decisoes Ja Definidas

- O link de convite externo continuara fixo, como hoje.
- O cadastro externo nao dara mais acesso imediato ao sistema.
- Todo membro vindo do link externo devera passar por aprovacao de `admin` ou `master`.
- Apos aprovado, o usuario podera entrar com senha inicial padrao.
- No primeiro login, a troca de senha sera obrigatoria antes de usar o sistema.
- A inclusao de `reCAPTCHA v3` na tela de login ficara na ultima etapa.

## Resultado Esperado

Ao final da implementacao:

1. Nenhum segredo real estara exposto no repositorio.
2. Nenhum cadastro externo criara acesso automatico.
3. Admin e master terao uma tela de aprovacao de novos cadastros.
4. Usuarios comuns nao conseguirao editar campos sensiveis fora do proprio escopo.
5. Logs, uploads, imagens e integracoes externas terao regras mais seguras.
6. O login passara a exigir troca de senha no primeiro acesso.
7. O login tera protecao adicional com `reCAPTCHA v3`.

---

## Etapa 1: Contencao imediata e saneamento de segredos

### Objetivo

Reduzir o risco imediato de comprometimento por vazamento de credenciais, segredos e dados reais.

### Acoes

1. Rotacionar imediatamente:
   - `JWT_SECRET`
   - `EVOLUTION_API_KEY`
   - senha do usuario master
   - quaisquer credenciais fixas usadas em scripts e testes
2. Substituir no `.env.example` todos os valores reais por placeholders seguros.
3. Remover do versionamento arquivos contendo dados reais de membros.
4. Remover credenciais hardcoded de testes e scripts auxiliares.
5. Revisar logs do backend para nao registrar `req.body` completo em erros.
6. Se o repositorio ja foi publicado ou compartilhado, considerar limpeza de historico Git para segredos e PII.

### Arquivos provaveis de intervencao

- `/Users/isaiassilva/development/igreja/ibbi/.env.example`
- `/Users/isaiassilva/development/igreja/ibbi/backend/server.js`
- `/Users/isaiassilva/development/igreja/ibbi/backend/src/scripts/seed.js`
- `/Users/isaiassilva/development/igreja/ibbi/frontend/playwright-login.mjs`
- `/Users/isaiassilva/development/igreja/ibbi/frontend/tests/member-validation.spec.js`
- `/Users/isaiassilva/development/igreja/ibbi/docs/churchcrm-export-20260315-222627.csv`

### Criterio de aceite

- Nenhum segredo real permanece versionado.
- Nenhum arquivo com dados reais de membros permanece no repositorio.
- Logs deixam de expor senha, imagem em base64 ou payload sensivel.

---

## Etapa 2: Endurecimento da autenticacao e primeiro acesso obrigatorio

### Objetivo

Manter o modelo de senha inicial fixa, mas impedir que a conta seja usada normalmente sem troca obrigatoria no primeiro login.

### Acoes

1. Adicionar no `User` os campos:
   - `mustChangePassword: Boolean`
   - `passwordChangedAt: Date`
   - opcionalmente `failedLoginAttempts: Number`
   - opcionalmente `lockedUntil: Date`
2. Ao criar usuario novo ou resetar senha:
   - definir senha padrao
   - marcar `mustChangePassword = true`
3. Alterar a resposta de login para informar que o usuario esta em `first-login flow` quando `mustChangePassword = true`.
4. Criar fluxo no frontend para troca obrigatoria de senha antes de acessar o sistema.
5. Ajustar a rota de troca de senha:
   - primeiro login: permite alterar senha sem pedir senha atual
   - conta ja ativa: exige senha atual
6. Reforcar protecao contra brute force:
   - reduzir o limite de tentativas no login
   - considerar bloqueio temporario por excesso de falhas

### Modelagem sugerida

#### `User`

```js
{
  nome: String,
  login: String,
  senha: String,
  role: String,
  personId: ObjectId,
  ativo: Boolean,
  mustChangePassword: { type: Boolean, default: true },
  passwordChangedAt: Date,
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
}
```

### Regras de negocio

- Usuario aprovado entra com senha padrao apenas uma vez.
- Sem trocar a senha, ele nao acessa dashboard, perfil ou demais rotas normais.
- Reset de senha por admin/master volta a marcar `mustChangePassword = true`.

### Criterio de aceite

- Todo usuario novo ou resetado e obrigado a trocar senha no primeiro acesso.
- Usuario sem troca concluida nao consegue usar o sistema normalmente.

---

## Etapa 3: Novo fluxo do convite externo com status pendente

### Objetivo

Manter o link fixo atual, mas transformar o cadastro externo em solicitacao pendente de aprovacao, sem criacao imediata de acesso.

### Acoes

1. Manter o token/link fixo do convite externo.
2. Alterar o endpoint publico para:
   - nao criar `User`
   - nao liberar acesso
   - nao enviar credenciais automaticamente
3. Criar uma nova collection para solicitacoes externas, por exemplo `RegistrationRequest`.
4. Persistir os dados enviados pelo visitante com `status = 'pending'`.
5. Armazenar tambem metadados de revisao:
   - `reviewedBy`
   - `reviewedAt`
   - `reviewNote`
   - `approvedPersonId`
   - `approvedUserId`
6. Ajustar a resposta do frontend publico para informar:
   - cadastro recebido
   - em analise
   - aguardar aprovacao da administracao

### Modelagem sugerida

```js
{
  nome: String,
  celular: String,
  congregacao: String,
  fotoUrl: String,
  submittedData: Object,
  status: String, // pending, approved, rejected
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: ObjectId,
  reviewNote: String,
  approvedPersonId: ObjectId,
  approvedUserId: ObjectId,
}
```

### Fluxo esperado

1. Visitante acessa o link fixo.
2. Preenche o formulario externo.
3. Sistema cria uma solicitacao pendente.
4. Admin ou master revisa.
5. Ao aprovar:
   - cria `Person`
   - cria `User`
   - define senha inicial padrao
   - marca `mustChangePassword = true`
6. Ao rejeitar:
   - registra motivo
   - mantem historico da solicitacao

### Criterio de aceite

- Link fixo continua funcionando.
- Nenhum cadastro externo gera conta ativa sem aprovacao manual.

---

## Etapa 4: Criacao da tela de aprovacao para admin e master

### Objetivo

Dar ao `admin` e ao `master` uma interface segura para revisar e aprovar solicitacoes externas.

### Acoes

1. Criar nova pagina no frontend, por exemplo:
   - `Aprovacoes`
   - `Cadastros Pendentes`
2. Exibir lista de pedidos com:
   - nome
   - celular
   - congregacao
   - data de envio
   - status
3. Permitir busca e filtro por:
   - nome
   - congregacao
   - status
   - periodo
4. Ao abrir um pedido, mostrar:
   - todos os dados enviados
   - foto enviada
   - possiveis duplicidades por nome/celular
   - comparacao com cadastro ja existente, se houver
5. Oferecer acoes:
   - `Aprovar`
   - `Rejeitar`
   - opcionalmente `Solicitar ajuste`
6. Na aprovacao:
   - permitir revisar os dados antes de confirmar
   - permitir corrigir campos antes de criar `Person` e `User`
7. Na rejeicao:
   - exigir motivo
   - salvar historico

### Regras de permissao

- `master` pode ver e aprovar tudo.
- `admin` deve ver apenas o escopo autorizado do sistema.
- Se houver regra por congregacao, aplicar essa regra tambem nas solicitacoes.

### Back-end necessario

- rota para listar solicitacoes
- rota para ver detalhe
- rota para aprovar
- rota para rejeitar
- auditoria de quem aprovou/rejeitou

### Criterio de aceite

- Admin/master conseguem revisar, aprovar e rejeitar sem atuar manualmente no banco.

---

## Etapa 5: Correcao de autorizacao, escopo e mass assignment

### Objetivo

Eliminar alteracoes indevidas de campos sensiveis e reforcar o isolamento por role e por congregacao.

### Acoes

1. Substituir `payload = { ...req.body }` por allowlists de campos permitidos.
2. Definir allowlist por role:
   - `user`: edita apenas campos seguros do proprio perfil
   - `admin`: edita membros dentro do proprio escopo
   - `master`: tem privilegios ampliados
3. Bloquear para `user` comum a edicao de campos como:
   - `status`
   - `motivoInativacao`
   - `tipo`
   - `batizado`
   - `dataBatismo`
   - `congregacao`
   - `matricula`
   - qualquer flag administrativa
4. Aplicar validacao de escopo em rotas hoje sensiveis, incluindo:
   - `updateHealth`
   - logs de mensagens
   - reenvio de mensagens
   - envio de carteirinha
   - envio manual de aniversarios
5. Garantir que `admin` nao veja nem manipule dados de outras congregacoes, salvo regra explicita.
6. Revisar EBD e demais areas para garantir o mesmo padrao de escopo.

### Criterio de aceite

- Usuario comum nao consegue promover o proprio cadastro, mudar status ou alterar campos administrativos.
- Admin nao consegue ler ou disparar acoes fora do proprio escopo.

---

## Etapa 6: Uploads, imagens, SSRF e protecao de dados pessoais

### Objetivo

Fechar vetores de abuso em upload de fotos, geracao de imagens e exposicao indevida de PII.

### Acoes

1. Impedir que `fotoUrl` aceite URL arbitraria externa.
2. Permitir apenas:
   - imagem enviada por upload controlado
   - caminho interno previamente validado
3. Revisar o endpoint publico de upload de foto para:
   - validar extensao e tipo real do arquivo
   - impor tamanho e formato permitidos
   - rejeitar conteudos suspeitos
4. Revisar o retorno atual em `data:` base64 e preferir armazenamento controlado.
5. Proteger endpoints de geracao de imagem por:
   - autenticacao
   - ou URL assinada temporaria
6. Impedir enumeracao simples de IDs em endpoints de imagem.
7. Revisar telas e respostas que mostram credenciais para evitar exibicao desnecessaria de senha padrao.

### Criterio de aceite

- Nao existe caminho para SSRF via foto.
- Upload publico fica limitado a imagem segura e validada.
- Endpoints de imagem nao expoem dados livremente.

---

## Etapa 7: Hardening geral da aplicacao e atualizacao de dependencias

### Objetivo

Melhorar a postura geral de seguranca da aplicacao e reduzir exposicoes por biblioteca.

### Acoes

1. Atualizar dependencias vulneraveis apontadas pelo `npm audit`.
2. Revisar especialmente:
   - `express`
   - `vite`
   - arvores que trazem `lodash`
   - arvores que trazem `picomatch`
3. Adicionar `helmet` no backend.
4. Configurar headers importantes:
   - `Content-Security-Policy`
   - `X-Frame-Options`
   - `X-Content-Type-Options`
   - `Referrer-Policy`
5. Revisar `cors` para trabalhar com origens explicitas e previsiveis.
6. Validar variaveis de ambiente na inicializacao do servidor.
7. Desligar `EVOLUTION_ALLOW_SELF_SIGNED` em producao.
8. Considerar migracao futura do JWT de `localStorage` para cookie `HttpOnly`.

### Testes a incluir

- fluxo de cadastro pendente
- aprovacao e rejeicao
- primeiro login com troca obrigatoria
- bloqueio de edicao indevida por role
- escopo por congregacao
- protecao de uploads

### Criterio de aceite

- Dependencias criticas revisadas.
- Backend sobe com validacao de ambiente.
- Headers de seguranca ativos.

---

## Etapa 8: Inclusao do reCAPTCHA v3 na tela de login

### Objetivo

Adicionar protecao automatizada contra abuso e tentativa massiva de login, conforme sua orientacao de deixar esta etapa por ultimo.

### Acoes

1. Integrar `reCAPTCHA v3` na tela de login do frontend.
2. Enviar o token do captcha junto da requisicao de autenticacao.
3. No backend, validar o token com a API do Google antes de processar login.
4. Definir score minimo aceitavel.
5. Em caso de score baixo:
   - negar login
   - ou exigir nova tentativa
6. Registrar score e resultado de validacao para monitoramento.

### Observacao recomendada

Mesmo ficando por ultimo na implementacao, e recomendado reaproveitar a mesma estrategia de `reCAPTCHA v3` tambem no formulario publico do convite externo em uma etapa posterior.

### Criterio de aceite

- O login somente e processado com token valido e score aceitavel.

---

## Ordem recomendada de execucao

1. Etapa 1: Contencao imediata e saneamento de segredos
2. Etapa 2: Endurecimento da autenticacao e primeiro acesso obrigatorio
3. Etapa 3: Novo fluxo do convite externo com status pendente
4. Etapa 4: Criacao da tela de aprovacao para admin e master
5. Etapa 5: Correcao de autorizacao, escopo e mass assignment
6. Etapa 6: Uploads, imagens, SSRF e protecao de dados pessoais
7. Etapa 7: Hardening geral da aplicacao e atualizacao de dependencias
8. Etapa 8: Inclusao do reCAPTCHA v3 na tela de login

---

## Backlog resumido por area

### Backend

- sanitizacao e rotacao de segredos
- nova model `RegistrationRequest`
- novas rotas de aprovacao/rejeicao
- ajuste no login e primeiro acesso
- allowlists por role para `Person`
- validacao de escopo em rotas sensiveis
- endurecimento de upload e imagem
- headers de seguranca e validacao de env

### Frontend

- fluxo de primeiro login com troca obrigatoria
- nova tela de aprovacao de cadastros
- ajuste do formulario externo para status pendente
- remocao de exibicao indevida de credenciais
- integracao do `reCAPTCHA v3` no login

### Dados e Operacao

- rotacao de chaves e senhas
- limpeza de arquivos sensiveis do repositorio
- revisao de historico Git, se necessario
- definicao de politicas de aprovacao

---

## Observacoes finais

- Este plano respeita a decisao de manter o link externo fixo.
- A seguranca desse link passa a depender de um fluxo de aprovacao manual e de um backend que nunca libera acesso automaticamente.
- A senha inicial fixa continua possivel, desde que sempre acompanhada de `mustChangePassword = true`.
- O ideal e que as etapas 1 a 5 sejam tratadas como prioridade alta.

