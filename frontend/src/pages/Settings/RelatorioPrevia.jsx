import { useState } from 'react';
import api from '../../services/api';
import { Button } from '../../components/ui';
import { WA, formatWa } from '../../components/WhatsAppThread';

// Prévia do relatório semanal (dados reais da semana; sem chamadas, um exemplo). Não envia nada.
export default function RelatorioPrevia() {
  const [previa, setPrevia] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const abrir = async () => {
    if (previa) { setPrevia(null); return; }
    setCarregando(true);
    setErro('');
    try {
      setPrevia((await api.get('/tenant/relatorio-semanal/previa')).data);
    } catch (e) {
      setErro(e.response?.data?.message || 'Não foi possível gerar a prévia.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={abrir} disabled={carregando}>
        {carregando ? 'Gerando…' : previa ? 'Fechar prévia' : 'Ver como fica o relatório'}
      </Button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {previa && (
        <div className="rounded-xl p-3" style={{ background: WA.bg }}>
          {previa.origem === 'exemplo' && (
            <p className="text-[11px] text-center text-slate-600 bg-white/70 rounded-md px-2 py-1 mb-2">
              Exemplo com dados fictícios: ainda não há chamadas registradas nesta semana.
            </p>
          )}
          <div className="max-w-md rounded-lg rounded-tl-none shadow-sm px-3 py-2 text-[13px] leading-relaxed text-slate-800" style={{ background: WA.in }}>
            {formatWa(previa.texto)}
          </div>
        </div>
      )}
    </div>
  );
}
