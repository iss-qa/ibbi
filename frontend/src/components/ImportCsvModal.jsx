import { useRef, useState } from 'react';
import api from '../services/api';
import { Modal, Button } from './ui';

const RESULT_STYLE = {
  ok: 'bg-emerald-50 text-emerald-700',
  criado: 'bg-emerald-50 text-emerald-700',
  ignorado: 'bg-amber-50 text-amber-700',
  erro: 'bg-red-50 text-red-700',
};
const RESULT_LABEL = { ok: 'será criado', criado: 'criado', ignorado: 'ignorado', erro: 'erro' };

// Importação de pessoas por CSV em 3 passos: arquivo → prévia (dryRun) → importar.
export default function ImportCsvModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const downloadTemplate = async () => {
    const { data } = await api.get('/persons/import-template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-pessoas.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const send = async (dryRun) => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/persons/import-csv${dryRun ? '?dryRun=1' : ''}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (dryRun) setPreview(data);
      else { setResult(data); onImported?.(data); }
    } catch (err) {
      const d = err?.response?.data;
      setError(d?.message ? `${d.message}${d.colunas ? ` Colunas encontradas: ${d.colunas.join(', ')}` : ''}` : 'Falha ao processar o arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const pickFile = (f) => {
    setFile(f || null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const data = result || preview;
  const r = data?.resumo;

  return (
    <Modal
      title={result ? 'Importação concluída' : 'Importar pessoas por CSV'}
      onClose={onClose}
      wide
      footer={result ? (
        <Button variant="primary" onClick={onClose}>Fechar</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {!preview && <Button variant="primary" disabled={!file || loading} onClick={() => send(true)}>{loading ? 'Analisando…' : 'Analisar arquivo'}</Button>}
          {preview && <Button variant="gold" disabled={loading || !r?.criados} onClick={() => send(false)}>{loading ? 'Importando…' : `Importar ${r?.criados || 0} pessoa(s)`}</Button>}
        </>
      )}
    >
      {!data && (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 text-slate-600 space-y-1.5">
            <p><strong className="text-ibbiNavy">1.</strong> Baixe o modelo e preencha uma pessoa por linha (só a coluna <code>nome</code> é obrigatória).</p>
            <p><strong className="text-ibbiNavy">2.</strong> Datas em <code>dd/mm/aaaa</code>; celular com DDD; <code>batizado</code> = sim/não.</p>
            <p><strong className="text-ibbiNavy">3.</strong> Exportações do ChurchCRM e planilhas com cabeçalhos parecidos também são aceitas. Pessoas já cadastradas são ignoradas.</p>
            <button type="button" onClick={downloadTemplate} className="text-ibbiBlue font-medium hover:underline">⬇ Baixar modelo CSV</button>
          </div>

          <label
            className="block border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-ibbiGold/60 hover:bg-stone-50 transition"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
          >
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            {file ? (
              <span className="text-ibbiNavy font-medium">{file.name} <span className="text-slate-400 font-normal">({Math.ceil(file.size / 1024)} KB)</span></span>
            ) : (
              <span className="text-slate-500">Arraste o arquivo CSV aqui ou <span className="text-ibbiBlue font-medium">clique para escolher</span></span>
            )}
          </label>
          {error && <p className="text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </div>
      )}

      {data && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              [result ? 'Criadas' : 'Serão criadas', r.criados, 'text-emerald-700'],
              ['Ignoradas', r.ignorados, 'text-amber-700'],
              ['Com erro', r.erros, 'text-red-700'],
              ['Avisos', r.avisos, 'text-slate-600'],
            ].map(([label, n, cls]) => (
              <div key={label} className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
                <p className={`text-2xl font-semibold tabular-nums ${cls}`}>{n}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {data.colunas?.ignoradas?.length > 0 && (
            <p className="text-xs text-slate-500">Colunas não reconhecidas (ignoradas): {data.colunas.ignoradas.join(', ')}</p>
          )}
          {error && <p className="text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="border border-stone-100 rounded-xl overflow-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Linha</th>
                  <th className="px-2 py-1.5 text-left">Nome</th>
                  <th className="px-2 py-1.5 text-left hidden sm:table-cell">Celular</th>
                  <th className="px-2 py-1.5 text-left hidden sm:table-cell">Congregação</th>
                  <th className="px-2 py-1.5 text-left">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {data.linhas.map((l) => (
                  <tr key={l.linha} className="align-top">
                    <td className="px-2 py-1.5 text-slate-400 tabular-nums">{l.linha}</td>
                    <td className="px-2 py-1.5 text-slate-700">{l.nome || <em className="text-slate-400">sem nome</em>}</td>
                    <td className="px-2 py-1.5 text-slate-500 hidden sm:table-cell">{l.celular || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-500 hidden sm:table-cell">{l.congregacao || '—'}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 ${RESULT_STYLE[l.resultado]}`}>{RESULT_LABEL[l.resultado]}</span>
                      {l.motivo && <span className="block text-slate-500 mt-0.5">{l.motivo}</span>}
                      {l.avisos?.map((a) => <span key={a} className="block text-amber-700 mt-0.5">⚠ {a}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.linhasOmitidas > 0 && <p className="text-xs text-slate-400">… e mais {data.linhasOmitidas} linha(s) não exibidas.</p>}
          {!result && (
            <button type="button" className="text-xs text-ibbiBlue hover:underline" onClick={() => pickFile(null)}>Escolher outro arquivo</button>
          )}
        </div>
      )}
    </Modal>
  );
}
