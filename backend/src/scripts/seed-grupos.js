/**
 * Seed: Grupos default do Projeto Amigo com atividades por etapa.
 *
 * Uso:  npm run seed:grupos
 *
 * Cria grupos-modelo para TODAS as congregações.
 * Pode ser executado várias vezes — pula grupos que já existem (por nome+congregacao).
 * Grupos são marcados como isDefault=true e ocultados na visão "Todos".
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const TriagemGrupo = require('../models/TriagemGrupo.model');

// ─── Congregações ────────────────────────────────────────────────────────────
const CONGREGACOES = [
  'Sede', 'São Cristóvão', 'Vida Nova', 'PQ São Paulo 1', 'PQ São Paulo 2',
  'Capelão', 'Bairro da Paz', 'Dona Lindu', 'Portão',
  'Olindina-BA', 'Crisópolis-BA', 'São Felipe-BA', 'São Sebastião do Passé - BA',
];

// ─── Templates de atividades por etapa ───────────────────────────────────────
const ATIVIDADES = {
  triagem: [
    { titulo: '1. Contato inicial por telefone', descricao: 'Ligar dentro de 24h. Apresentar-se, parabenizar pela decisão/visita, perguntar como está. Anotar impressões.', categoria: 'contato_inicial', ordem: 1 },
    { titulo: '2. Mensagem de boas-vindas por WhatsApp', descricao: 'Enviar saudação pessoal, versículo de encorajamento, horários dos cultos e contato para dúvidas.', categoria: 'mensagem', ordem: 2 },
    { titulo: '3. Preencher ficha de cadastro', descricao: 'Registrar dados completos no sistema: nome, telefone, endereço, data de nascimento.', categoria: 'contato_inicial', ordem: 3 },
    { titulo: '4. Entregar kit de boas-vindas', descricao: 'Preparar e entregar: Bíblia (se necessário), folheto da igreja, carta do pastor, informações sobre EBD e grupos.', categoria: 'acolhimento', ordem: 4 },
    { titulo: '5. Designar amigo/acompanhante', descricao: 'Atribuir um membro como "amigo" responsável pelo acompanhamento. Registrar no sistema.', categoria: 'acolhimento', ordem: 5 },
  ],
  acolhimento: [
    { titulo: '1. Primeira visita ao lar', descricao: 'Agendar visita, levar material de boas-vindas. Conversar sobre a experiência na igreja, orar junto.', categoria: 'visitacao', ordem: 1 },
    { titulo: '2. Acompanhar ao culto', descricao: 'Encontrar na entrada, sentar junto, apresentar a membros e líderes.', categoria: 'acolhimento', ordem: 2 },
    { titulo: '3. Apresentação aos líderes', descricao: 'Apresentar ao pastor, diáconos e líderes de ministérios. Ouvir interesses e habilidades.', categoria: 'integracao', ordem: 3 },
    { titulo: '4. Convite para evento social', descricao: 'Convidar para chá, almoço comunitário ou confraternização. Apresentar a outras famílias.', categoria: 'acolhimento', ordem: 4 },
    { titulo: '5. Segundo contato por WhatsApp', descricao: 'Após 1 semana: perguntar como está, enviar devocional curto, reforçar convite para próximo culto.', categoria: 'mensagem', ordem: 5 },
    { titulo: '6. Segunda visita de acompanhamento', descricao: 'Visita após 2-3 semanas. Conversar sobre conexão com outros membros. Orar juntos.', categoria: 'visitacao', ordem: 6 },
  ],
  integracao: [
    { titulo: '1. Inscrição na EBD', descricao: 'Matricular na classe adequada, apresentar ao professor, entregar material didático.', categoria: 'integracao', ordem: 1 },
    { titulo: '2. Inclusão em grupo de célula', descricao: 'Identificar grupo mais próximo, apresentar ao líder, acompanhar na primeira reunião.', categoria: 'integracao', ordem: 2 },
    { titulo: '3. Acompanhar frequência nos cultos', descricao: 'Verificar presença nos cultos regulares. Sentar junto quando possível.', categoria: 'acompanhamento', ordem: 3 },
    { titulo: '4. Identificar dons e ministérios', descricao: 'Conversar sobre dons e talentos. Apresentar ministérios disponíveis. Auxiliar na escolha.', categoria: 'integracao', ordem: 4 },
    { titulo: '5. Envolver em atividade prática', descricao: 'Convidar para mutirão, ação social ou apoio logístico em evento. Criar senso de pertencimento.', categoria: 'integracao', ordem: 5 },
    { titulo: '6. Avaliação de integração (30 dias)', descricao: 'Avaliar: frequência, participação em grupo, envolvimento em ministério. Reportar ao pastor.', categoria: 'acompanhamento', ordem: 6 },
  ],
  estudo_biblico: [
    { titulo: '1. Inscrição no curso de discipulado', descricao: 'Verificar turma aberta, inscrever, informar datas e horários, garantir material.', categoria: 'integracao', ordem: 1 },
    { titulo: '2. Matrícula na classe de novos decididos', descricao: 'Matricular na classe específica da EBD. Acompanhar na primeira aula.', categoria: 'integracao', ordem: 2 },
    { titulo: '3. Participação na EBD semanal', descricao: 'Acompanhar frequência e compreensão dos estudos. Oferecer apoio se necessário.', categoria: 'acompanhamento', ordem: 3 },
    { titulo: '4. Estudo bíblico em grupo', descricao: 'Incluir em grupo de estudo semanal. Garantir Bíblia e materiais.', categoria: 'integracao', ordem: 4 },
    { titulo: '5. Plano de leitura bíblica pessoal', descricao: 'Criar plano de leitura diária. Enviar lembretes semanais por WhatsApp.', categoria: 'mensagem', ordem: 5 },
    { titulo: '6. Avaliação de aprendizado', descricao: 'Ao final do ciclo, conversar sobre aprendizado, dúvidas e aplicação no dia a dia.', categoria: 'acompanhamento', ordem: 6 },
  ],
  consolidacao: [
    { titulo: '1. Acompanhamento mensal (1º semestre)', descricao: 'Encontros mensais sobre crescimento espiritual, desafios e participação na igreja.', categoria: 'acompanhamento', ordem: 1 },
    { titulo: '2. Preparação para batismo', descricao: 'Conversar sobre significado, inscrever na classe, acompanhar aulas preparatórias.', categoria: 'acompanhamento', ordem: 2 },
    { titulo: '3. Cerimônia de batismo', descricao: 'Acompanhar no dia, apoiar nos preparativos, convidar familiares, celebrar.', categoria: 'acolhimento', ordem: 3 },
    { titulo: '4. Carta de transferência', descricao: 'Para membros de outra igreja: auxiliar na documentação e formalização da membresia.', categoria: 'outro', ordem: 4 },
    { titulo: '5. Acompanhamento trimestral (2º ano)', descricao: 'Avaliar maturidade espiritual, envolvimento nos ministérios, relacionamentos.', categoria: 'acompanhamento', ordem: 5 },
    { titulo: '6. Apoio pastoral em crises', descricao: 'Estar atento a dificuldades. Encaminhar para aconselhamento quando necessário.', categoria: 'acompanhamento', ordem: 6 },
    { titulo: '7. Avaliação para membresia plena', descricao: 'Após 1-2 anos, avaliar fidelidade, participação e frutos. Encaminhar para reconhecimento.', categoria: 'acompanhamento', ordem: 7 },
  ],
  membro_pleno: [
    { titulo: '1. Capacitação para liderança', descricao: 'Inscrever em escola de líderes ou treinamento ministerial. Mentorar com líder experiente.', categoria: 'integracao', ordem: 1 },
    { titulo: '2. Assumir função no ministério', descricao: 'Transição para função ativa: líder de célula, professor EBD, equipe de louvor, etc.', categoria: 'integracao', ordem: 2 },
    { titulo: '3. Treinamento de obreiro/diácono', descricao: 'Curso de diaconato, acompanhar diácono experiente, aprender rotinas do culto.', categoria: 'integracao', ordem: 3 },
    { titulo: '4. Preparação da Santa Ceia', descricao: 'Organizar: compra de pão e vinho/suco, preparação da mesa, distribuição, limpeza.', categoria: 'outro', ordem: 4 },
    { titulo: '5. Mentoria de novos membros', descricao: 'Atribuir novos decididos/visitantes para acompanhar como "amigo".', categoria: 'acompanhamento', ordem: 5 },
    { titulo: '6. Missões e ações sociais', descricao: 'Participar de evangelismo, visitas a hospitais/asilos, campanhas de arrecadação.', categoria: 'outro', ordem: 6 },
    { titulo: '7. Avaliação anual de crescimento', descricao: 'Reunião anual com liderança: frutos, satisfação, desafios, próximos passos.', categoria: 'acompanhamento', ordem: 7 },
  ],
};

// ─── Grupos default (nomes limpos — a badge de etapa já identifica) ──────────
const GRUPOS_DEFAULT = [
  // Triagem
  { nome: 'Novos Decididos', tipo: 'novos_decididos', etapa: 'triagem', descricao: 'Cadastro, ficha de contato e boas-vindas aos novos decididos.' },
  { nome: 'Visitantes', tipo: 'visitantes', etapa: 'triagem', descricao: 'Recepção e cadastro dos visitantes. Contato inicial e convite para retorno.' },
  // Acolhimento
  { nome: 'Visitas e Integração Inicial', tipo: 'novos_decididos', etapa: 'acolhimento', descricao: 'Visitas ao lar, acompanhamento ao culto e apresentação aos líderes.' },
  { nome: 'Visitantes Recorrentes', tipo: 'visitantes', etapa: 'acolhimento', descricao: 'Acompanhamento de visitantes que retornaram. Fortalecimento do vínculo.' },
  // Integração
  { nome: 'EBD e Células', tipo: 'novos_decididos', etapa: 'integracao', descricao: 'Inscrição na EBD, grupo de célula, frequência nos cultos e ministérios.' },
  { nome: 'Dons e Ministérios', tipo: 'personalizado', etapa: 'integracao', descricao: 'Identificação de dons e talentos. Direcionamento para ministérios.' },
  // Estudo Bíblico
  { nome: 'Classe de Novos Decididos', tipo: 'novos_decididos', etapa: 'estudo_biblico', descricao: 'Curso de discipulado e classe de novos decididos na EBD.' },
  { nome: 'Estudo Bíblico em Grupo', tipo: 'personalizado', etapa: 'estudo_biblico', descricao: 'Grupos de estudo bíblico semanal e plano de leitura.' },
  // Consolidação
  { nome: 'Preparação para Batismo', tipo: 'novos_decididos', etapa: 'consolidacao', descricao: 'Acompanhamento de 1-2 anos, preparação e classe de batismo.' },
  { nome: 'Transferência e Membresia', tipo: 'personalizado', etapa: 'consolidacao', descricao: 'Carta de transferência, formalização de membresia e acompanhamento.' },
  // Membro Pleno
  { nome: 'Líderes e Obreiros', tipo: 'personalizado', etapa: 'membro_pleno', descricao: 'Capacitação para liderança, treinamento de obreiros e diáconos.' },
  { nome: 'Missões e Mentoria', tipo: 'personalizado', etapa: 'membro_pleno', descricao: 'Mentoria de novos membros, missões e ações sociais.' },
];

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI não configurada');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB.\n');

  let created = 0;
  let skipped = 0;

  for (const cong of CONGREGACOES) {
    console.log(`── ${cong} ──`);
    for (const grupoDef of GRUPOS_DEFAULT) {
      const exists = await TriagemGrupo.findOne({
        nome: grupoDef.nome,
        congregacao: cong,
        isDefault: true,
      });

      if (exists) {
        skipped += 1;
        continue;
      }

      const atividades = (ATIVIDADES[grupoDef.etapa] || []).map((a) => ({ ...a }));

      await TriagemGrupo.create({
        ...grupoDef,
        congregacao: cong,
        isDefault: true,
        ativo: true,
        membros: [],
        acompanhados: [],
        atividades,
      });

      console.log(`  [OK] "${grupoDef.nome}" — ${atividades.length} ativ.`);
      created += 1;
    }
  }

  // Atualizar grupos default antigos da Sede (com nomes longos) para isDefault=true
  const oldDefaults = await TriagemGrupo.find({
    congregacao: 'Sede',
    nome: { $regex: /^(Triagem —|Acolhimento —|Integração —|Discipulado —|Consolidação —|Membro Pleno —)/ },
  });
  if (oldDefaults.length > 0) {
    for (const g of oldDefaults) {
      await TriagemGrupo.deleteOne({ _id: g._id });
      console.log(`  [DEL] Removido antigo: "${g.nome}"`);
    }
  }

  console.log(`\nSeed finalizado. Criados: ${created} | Ignorados: ${skipped}`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('Erro no seed:', err);
  mongoose.disconnect();
  process.exit(1);
});
