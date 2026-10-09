// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central) com valor e identificador.
// Sem gateway: o pagamento cai direto na chave da igreja; a liderança confirma no painel.
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const campo = (id, valor) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;
// Corta no limite do campo sem partir palavra ("IGREJA BATISTA BIBLICA ISRAEL" → "IGREJA BATISTA BIBLICA").
const cortaPalavra = (s, max) => {
  if (s.length <= max) return s;
  const corte = s.slice(0, max + 1).lastIndexOf(' ');
  return (corte > 0 ? s.slice(0, corte) : s.slice(0, max)).trim();
};

// CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF), exigido no campo 63.
const crc16 = (payload) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * @param {object} p { chave, nome, cidade, valor?, txid?, descricao? }
 * nome ≤ 25 e cidade ≤ 15 caracteres, sem acento (limites do padrão; nome maior é cortado na palavra).
 */
const pixCopiaECola = ({ chave, nome, cidade, valor, txid, descricao }) => {
  if (!chave || !nome || !cidade) throw new Error('Configure a chave Pix, o nome e a cidade do recebedor');
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', String(chave).trim())
    + (descricao ? campo('02', semAcento(descricao).slice(0, 40)) : '');
  const id = semAcento(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const payload = [
    campo('00', '01'),
    campo('26', conta),
    campo('52', '0000'),
    campo('53', '986'),
    valor ? campo('54', Number(valor).toFixed(2)) : '',
    campo('58', 'BR'),
    campo('59', cortaPalavra(semAcento(nome).toUpperCase().trim(), 25)),
    campo('60', semAcento(cidade).toUpperCase().slice(0, 15)),
    campo('62', campo('05', id)),
    '6304',
  ].join('');
  return payload + crc16(payload);
};

// Chave Pix no formato do DICT: CPF/CNPJ só dígitos, celular +55DDDNÚMERO, e-mail e aleatória em minúsculas.
// Retorna null se a chave não bate com o tipo (CPF e celular têm 11 dígitos: o tipo desfaz a dúvida).
const TIPOS_CHAVE = ['cpf', 'cnpj', 'celular', 'email', 'aleatoria'];
const normalizarChavePix = (tipo, chave) => {
  const bruta = String(chave || '').trim();
  const digitos = bruta.replace(/\D/g, '');
  if (tipo === 'cpf') return digitos.length === 11 ? digitos : null;
  if (tipo === 'cnpj') return digitos.length === 14 ? digitos : null;
  if (tipo === 'celular') {
    const local = digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos;
    return local.length === 10 || local.length === 11 ? `+55${local}` : null;
  }
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruta) && bruta.length <= 77 ? bruta.toLowerCase() : null;
  if (tipo === 'aleatoria') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bruta) ? bruta.toLowerCase() : null;
  return null;
};

module.exports = { pixCopiaECola, crc16, cortaPalavra, normalizarChavePix, TIPOS_CHAVE };
