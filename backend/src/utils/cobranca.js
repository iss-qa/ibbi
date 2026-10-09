// Dados de cobrança da igreja (boleto exige CNPJ/CPF + endereço completo). Allowlist e validação
// compartilhadas entre Configurações (master) e o painel da plataforma.
const CAMPOS_ENDERECO = ['cep', 'logradouro', 'numero', 'complemento', 'bairro'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Retorna { set, erro } com os campos a gravar (só os presentes no corpo).
const dadosCobranca = (body = {}) => {
  const set = {};
  if ('documento' in body) {
    const doc = String(body.documento || '').replace(/\D/g, '');
    if (doc && ![11, 14].includes(doc.length)) return { erro: 'CNPJ/CPF inválido: informe 14 (CNPJ) ou 11 (CPF) dígitos.' };
    set.documento = doc || undefined;
  }
  if ('emailCobranca' in body) {
    const email = String(body.emailCobranca || '').trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { erro: 'Email de cobrança inválido.' };
    set.emailCobranca = email || undefined;
  }
  if (body.endereco && typeof body.endereco === 'object') {
    const e = {};
    CAMPOS_ENDERECO.forEach((k) => {
      const v = String(body.endereco[k] ?? '').trim().slice(0, 120);
      if (v) e[k] = k === 'cep' ? v.replace(/\D/g, '').slice(0, 8) : v;
    });
    if (e.cep && e.cep.length !== 8) return { erro: 'CEP inválido: informe 8 dígitos.' };
    set.endereco = e;
  }
  return { set };
};

module.exports = { dadosCobranca, CAMPOS_ENDERECO };
