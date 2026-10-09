import { useState } from 'react';
import { inputClass } from '../../components/ui';

// Lista de grupos do WhatsApp conectado, com busca (um número pode participar de centenas de grupos).
export default function GrupoSelect({ grupos, onSelect }) {
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const visiveis = grupos.filter((g) => !termo || String(g.nome || '').toLowerCase().includes(termo));

  if (!grupos.length) return <p className="text-xs text-slate-500">Nenhum grupo encontrado. O número da igreja precisa participar do grupo.</p>;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <input
        className={`${inputClass} rounded-none border-0 border-b`}
        placeholder={`Buscar entre ${grupos.length} grupos…`}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar grupo"
      />
      <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
        {visiveis.slice(0, 50).map((g) => (
          <li key={g.jid}>
            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between gap-2" onClick={() => onSelect(g)}>
              <span className="truncate">👥 {g.nome || g.jid}</span>
              {g.participantes ? <span className="text-xs text-slate-400 whitespace-nowrap">{g.participantes} pessoas</span> : null}
            </button>
          </li>
        ))}
        {visiveis.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Nenhum grupo com “{busca}”.</li>}
        {visiveis.length > 50 && <li className="px-3 py-2 text-xs text-slate-400">Mostrando 50 de {visiveis.length}. Refine a busca.</li>}
      </ul>
    </div>
  );
}
