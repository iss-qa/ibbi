const Person = require('../models/Person.model');
const AutomationRun = require('../models/AutomationRun.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const campanha = require('./campanha.service');
const { getTenant } = require('../tenancy/context');
const { zonedParts } = require('../utils/time');

/**
 * Lembrete dos cultos da agenda semanal (Tenant.cultosProgramados), `lembreteMin` minutos antes:
 *  - para quem pediu ("LEMBRETE" → Person.lembreteCulto), via campanha (fila anti-ban, descadastrados fora);
 *  - e/ou uma única mensagem no grupo de avisos da igreja (grupoJid), se configurado.
 * Antecedência padrão de 3h: o envio individual é gradual (≈50 mensagens/hora).
 */
const minutos = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const runLembretes = async (now) => {
  const tenant = getTenant();
  const agora = now.hour * 60 + now.minute;
  let disparados = 0;
  for (const c of tenant?.cultosProgramados || []) {
    if (!c.ativo || c.diaSemana !== now.weekday) continue;
    const alvo = minutos(c.horario) - (c.lembreteMin || 180);
    if (agora < alvo || agora > minutos(c.horario)) continue; // janela: do horário do lembrete até o início
    if (!(await AutomationRun.claim(`lembrete-culto:${c._id}:${now.isoDate}`, 'lembrete'))) continue;
    const dados = { titulo: c.titulo, horario: c.horario, congregacao: c.congregacao, liveUrl: c.liveUrl };
    if (c.grupoJid) {
      await whatsapp.sendText(c.grupoJid, templates.lembreteCulto(dados).replace(/\{nome\}/g, 'igreja'), { bulk: true })
        .catch((err) => console.error('[LEMBRETE] Grupo:', err.message));
    }
    const filtro = { lembreteCulto: true };
    if (c.congregacao) filtro.congregacao = c.congregacao;
    const pessoas = await Person.find({ ...filtro, status: 'ativo' }).select('_id').lean();
    if (pessoas.length) {
      await campanha.criar({
        tipo: 'lembrete', titulo: `Lembrete: ${c.titulo} ${now.isoDate.split('-').reverse().join('/')}`,
        texto: templates.lembreteCulto(dados), publico: { pessoas: pessoas.map((p) => p._id), descricao: 'quem pediu LEMBRETE' },
      });
    }
    disparados += 1;
  }
  return disparados;
};

module.exports = { runLembretes };
