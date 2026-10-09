// Presenças vindas da chamada (EBD e encontros): só os campos conhecidos.
// "outros" leva o motivo digitado pelo líder (até 200 caracteres); nas demais justificativas ele some.
const MOTIVO_MAX = 200;

const sanitizePresencas = (lista) => (Array.isArray(lista) ? lista : []).map((p) => {
  const presente = Boolean(p?.presente);
  const justificativa = presente ? '' : String(p?.justificativa || '').trim().slice(0, 40);
  const motivo = justificativa.toLowerCase() === 'outros' ? String(p?.motivo || '').trim().slice(0, MOTIVO_MAX) : '';
  return {
    personId: p?.personId,
    nome: p?.nome,
    presente,
    justificativa: justificativa || undefined,
    motivo: motivo || undefined,
  };
});

module.exports = { sanitizePresencas, MOTIVO_MAX };
