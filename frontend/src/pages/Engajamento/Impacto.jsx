import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { Button } from '../../components/ui';
import { useTenant } from '../../context/TenantContext';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (k) => { const [y, m] = k.split('-'); return `${MESES[Number(m) - 1]} de ${y}`; };
const mesAtual = () => new Date().toISOString().slice(0, 7);
const mesRel = (k, delta) => { const [y, m] = k.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return d.toISOString().slice(0, 7); };

const BLOCOS = [
  ['visitantesAcompanhados', '🌱', 'Visitantes acompanhados', 'jornada de 30 dias'],
  ['visitantesVoltaram', '🏠', 'Visitantes que voltaram', 'presença em EBD, encontro ou culto'],
  ['ausentesRecuperados', '💛', 'Ausentes recuperados', 'alertas de cuidado resolvidos'],
  ['acoesCuidado', '📞', 'Ações de cuidado', 'ligações, visitas, orações'],
  ['presencasRegistradas', '📋', 'Presenças registradas', 'EBD, encontros e cultos'],
  ['pedidosOracao', '🙏', 'Pedidos de oração', 'recebidos'],
  ['aniversariosFelicitados', '🎂', 'Aniversariantes felicitados', 'automaticamente'],
  ['voluntariosConfirmados', '🙋', 'Voluntários confirmados', 'nas escalas'],
  ['inscricoesEventos', '🎟️', 'Inscrições em eventos', 'pelo WhatsApp e pela web'],
  ['novosCadastros', '👥', 'Novos cadastros', 'pessoas'],
];

// Painel de impacto: o que o PastorIA fez pela igreja no mês (e a comparação com o anterior).
export default function Impacto() {
  const { tenant } = useTenant();
  const [mes, setMes] = useState(mesAtual());
  const [d, setD] = useState(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setD(null); api.get('/impacto', { params: { mes } }).then((r) => setD(r.data)).catch(() => {}); }, [mes]);

  const texto = d && [
    `📊 Impacto do PastorIA: ${nomeMes(d.atual.mes)} (${tenant?.nomeCurto || tenant?.nome || 'nossa igreja'})`,
    ...BLOCOS.filter(([k]) => d.atual[k]).map(([k, , l]) => `• ${l}: ${d.atual[k]}`),
    `• Horas de secretaria economizadas: ~${d.atual.horasEconomizadas}`,
    'Quem falta, faz falta. 🙌',
  ].join('\n');
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem clipboard */ } };

  return (
    <div>
      <Header title="Impacto do mês" subtitle="O cuidado que aconteceu, em números. Toda liderança recebe este resumo no dia 1º."
        action={(
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setMes(mesRel(mes, -1))}>←</Button>
            <span className="text-sm font-medium text-ibbiNavy capitalize w-40 text-center">{nomeMes(mes)}</span>
            <Button variant="outline" disabled={mes >= mesAtual()} onClick={() => setMes(mesRel(mes, 1))}>→</Button>
          </div>
        )} />
      {!d ? <p className="text-sm text-slate-500">Calculando…</p> : (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-ibbiNavy to-ibbiBlue text-white p-6 mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm">Horas de secretaria economizadas</p>
              <p className="font-display text-5xl text-ibbiGold">~{d.atual.horasEconomizadas}h</p>
              <p className="text-xs text-white/60 mt-1">estimativa: 2 min por mensagem automática, 15 min por chamada, 10 min por escala</p>
            </div>
            <Button variant="gold" onClick={copiar}>{copiado ? 'Copiado ✓' : '📋 Copiar para compartilhar'}</Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {BLOCOS.map(([k, ic, l, sub]) => {
              const v = d.atual[k]; const a = d.anterior[k]; const diff = v - a;
              return (
                <div key={k} className="bg-white rounded-2xl border border-stone-100 p-4">
                  <p className="text-2xl">{ic}</p>
                  <p className="mt-1 text-3xl font-semibold text-ibbiNavy tabular-nums">{v}</p>
                  <p className="text-sm text-slate-700">{l}</p>
                  <p className="text-xs text-slate-400">{sub}</p>
                  {(v || a) ? <p className={`mt-1 text-xs ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-slate-500' : 'text-slate-400'}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff)} vs. mês anterior</p> : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
