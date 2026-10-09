// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central) com valor e identificador.
// Sem gateway: o pagamento cai direto na chave da igreja; a liderança confirma no painel.
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const campo = (id, valor) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

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
 * nome ≤ 25 e cidade ≤ 15 caracteres, sem acento (limites do padrão).
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
    campo('59', semAcento(nome).toUpperCase().slice(0, 25)),
    campo('60', semAcento(cidade).toUpperCase().slice(0, 15)),
    campo('62', campo('05', id)),
    '6304',
  ].join('');
  return payload + crc16(payload);
};

module.exports = { pixCopiaECola, crc16 };
