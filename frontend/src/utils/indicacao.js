// Código de indicação (?ref=) guardado ao chegar pela landing, para o cadastro usar depois.
const KEY = 'pastoria_ref';

export const capturarRef = (search) => {
  const ref = new URLSearchParams(search).get('ref');
  if (!ref) return;
  try { localStorage.setItem(KEY, String(ref).toLowerCase().slice(0, 40)); } catch { /* sem storage */ }
};

export const refAtual = (search) => {
  const daUrl = new URLSearchParams(search).get('ref');
  if (daUrl) return String(daUrl).toLowerCase().slice(0, 40);
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};

export const limparRef = () => { try { localStorage.removeItem(KEY); } catch { /* sem storage */ } };
