const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

const TIPOS_GRUPO = ['ebd', 'uniao_feminina', 'uniao_masculina', 'uniao_jovens', 'uniao_adolescentes', 'uniao_criancas', 'louvor', 'ministerio', 'celula', 'outro'];

const PessoaRefSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  nome: { type: String, trim: true },
  celular: { type: String, trim: true },
  papel: { type: String, trim: true }, // líderes: Presidente, Secretária, Regente…
  desde: { type: Date, default: Date.now },
  manual: { type: Boolean }, // membro adicionado à mão (a revisão pelos critérios não sugere removê-lo)
}, { _id: false });

// Grupo que se reúne periodicamente (uniões, louvor, células). Frequência → retenção.
const GrupoEncontroSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true }, // União Feminina
  tipo: { type: String, enum: TIPOS_GRUPO, default: 'outro' },
  congregacao: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  diaSemana: { type: Number, min: 0, max: 6, default: 3 }, // 3 = quarta
  horario: { type: String, default: '19:30' },
  local: { type: String, trim: true },
  // Critérios para montar a lista de membros automaticamente
  criterios: {
    sexo: { type: String, enum: ['Masculino', 'Feminino', null], default: null },
    idadeMin: { type: Number },
    idadeMax: { type: Number },
    tipos: { type: [String], default: [] }, // membro, congregado…
  },
  membros: [PessoaRefSchema],
  lideres: [PessoaRefSchema],
  // Após o horário do encontro, o assistente pede a chamada aos líderes no WhatsApp
  convocarChamada: { type: Boolean, default: false },
  horaChamada: { type: String, default: '21:30' },
  // Classes da EBD cujas aulas contam como encontro deste grupo (ex.: União de Jovens ← Jovens).
  // A chamada continua sendo feita na EBD; aqui ela aparece como um dos encontros do grupo.
  ebdClasses: { type: [String], default: [] },
  ebdClasse: { type: String }, // legado (grupos 'EBD — <classe>' da v1, removidos na migração)
  ativo: { type: Boolean, default: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

GrupoEncontroSchema.index({ tenantId: 1, congregacao: 1, nome: 1 }, { unique: true });
GrupoEncontroSchema.plugin(tenantPlugin);

module.exports = mongoose.models.GrupoEncontro || mongoose.model('GrupoEncontro', GrupoEncontroSchema);
module.exports.TIPOS_GRUPO = TIPOS_GRUPO;
