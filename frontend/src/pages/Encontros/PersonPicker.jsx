import { useEffect, useState } from 'react';
import api from '../../services/api';
import { inputClass } from '../../components/ui';

// Busca de pessoa por nome (usa /persons, já filtrado pelas congregações do usuário).
export default function PersonPicker({ onPick, placeholder = 'Buscar pessoa pelo nome', congregacao }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      api.get('/persons', { params: { search: q, limit: 8, status: 'ativo', ...(congregacao ? { congregacao } : {}) } })
        .then((r) => setResults(r.data.items || []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, congregacao]);
  return (
    <div className="relative">
      <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {results.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((p) => (
            <li key={p._id}>
              <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { onPick(p); setQ(''); setResults([]); }}>
                {p.nome} <span className="text-xs text-slate-400">· {p.congregacao}{p.celular ? ` · ${p.celular}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
