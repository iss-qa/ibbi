import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { Button } from '../components/ui';

const SUGESTOES = [
  'Quem faz aniversário esta semana?',
  'Quem está faltando na EBD há 3 semanas ou mais?',
  'Resumo da frequência do último domingo',
  'Novo aluno na aula de Jovens: Samuel, 22 anos, masculino',
  'Na aula de Jovens de hoje vieram Pedro, Maria e Lucas',
];

// Formatação do WhatsApp (*negrito*, _itálico_) → HTML seguro.
const renderWhatsApp = (text) => String(text || '')
  .split('\n')
  .map((line, i) => {
    const parts = line.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((p, j) => {
      if (/^\*[^*]+\*$/.test(p)) return <strong key={j}>{p.slice(1, -1)}</strong>;
      if (/^_[^_]+_$/.test(p)) return <em key={j}>{p.slice(1, -1)}</em>;
      return p;
    });
    return <p key={i} className="min-h-[1em]">{parts}</p>;
  });

export default function Assistant() {
  const { tenant, hasFeature } = useTenant();
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [imagem, setImagem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const nome = tenant?.ia?.nomeAssistente || 'Eliézer';

  useEffect(() => {
    api.get('/assistant/history').then(({ data }) => setHistory(data.history || [])).catch(() => {});
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, loading]);

  const send = async (texto = input) => {
    const mensagem = texto.trim();
    if ((!mensagem && !imagem) || loading) return;
    setError('');
    setHistory((h) => [...h, { role: 'user', text: imagem ? `[imagem] ${mensagem}` : mensagem }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/assistant/chat', { mensagem, imagem });
      setHistory((h) => [...h, { role: 'assistant', text: data.resposta }]);
      setImagem(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Não foi possível falar com o assistente.');
    } finally {
      setLoading(false);
    }
  };

  const onFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Imagem acima de 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setImagem(reader.result);
    reader.readAsDataURL(file);
  };

  const clear = async () => {
    await api.delete('/assistant/history');
    setHistory([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)]">
      <Header
        title={`Assistente ${nome}`}
        subtitle="O mesmo assistente que atende a liderança no WhatsApp: chamada da EBD, cadastro de visitantes, aniversariantes e cuidado pastoral."
        action={history.length > 0 && <Button variant="ghost" onClick={clear}>Nova conversa</Button>}
      />

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-stone-100 p-4 space-y-3">
        {history.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm mb-4">Experimente pedir:</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {SUGESTOES.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="text-sm px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700">{s}</button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-6">
              Dica: a liderança pode fazer tudo isso pelo WhatsApp da igreja, sem abrir o sistema.
            </p>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-ibbiBlue text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
              {renderWhatsApp(m.text)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-500 rounded-2xl px-4 py-2 text-sm">{nome} está pensando…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {imagem && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <img src={imagem} alt="Anexo" className="w-12 h-12 object-cover rounded" />
          <span>Imagem anexada</span>
          <button type="button" className="text-red-600" onClick={() => setImagem(null)}>remover</button>
        </div>
      )}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {hasFeature('multimodal') && (
          <label className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer text-sm flex items-center" title="Anexar foto (ficha de visitante, foto da turma)">
            📎
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        )}
        <input
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Fale com ${nome}...`}
          disabled={loading}
        />
        <Button type="submit" disabled={loading || (!input.trim() && !imagem)}>Enviar</Button>
      </form>
    </div>
  );
}
