import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Card, Button, Field, Modal, inputClass } from '../../components/ui';

const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fone = (n) => (String(n).length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n);

// Quem respondeu SAIR no WhatsApp: nenhuma mensagem sai para esses números até reativar.
export default function Descadastrados() {
  const [itens, setItens] = useState([]);
  const [todos, setTodos] = useState(false);
  const [novo, setNovo] = useState(null);
  const [reativar, setReativar] = useState(null);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => setItens((await api.get('/optout', { params: { todos: todos ? 1 : undefined } })).data), [todos]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const salvarNovo = async () => {
    setErro('');
    try {
      await api.post('/optout', novo);
      setNovo(null);
      load();
    } catch (e) { setErro(e.response?.data?.message || 'Falha ao registrar'); }
  };
  const confirmarReativacao = async () => {
    setErro('');
    try {
      await api.post(`/optout/${reativar._id}/reativar`, { justificativa: reativar.justificativa });
      setReativar(null);
      load();
    } catch (e) { setErro(e.response?.data?.message || 'Falha ao reativar'); }
  };

  return (
    <Card
      title="🔕 Descadastrados do WhatsApp"
      subtitle="Quem respondeu SAIR não recebe nenhuma mensagem (aniversário, jornada, avisos, escalas…) até enviar VOLTAR."
      action={<Button variant="outline" onClick={() => setNovo({ celular: '', motivo: '' })}>Registrar pedido</Button>}
    >
      <label className="text-xs text-slate-500 flex items-center gap-2 mb-3">
        <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Mostrar também quem já voltou
      </label>
      {!itens.length && <p className="text-sm text-slate-400">Ninguém descadastrado. 🙌</p>}
      <div className="divide-y divide-slate-100">
        {itens.map((o) => {
          const ultimo = o.historico?.[o.historico.length - 1];
          return (
            <div key={o._id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-ibbiNavy">{o.nome || 'Sem cadastro'} <span className="text-slate-500 font-normal">· {fone(o.chave)}</span></p>
                <p className="text-xs text-slate-500">
                  {o.ativo ? `Saiu em ${fmt(o.desde)}` : `Voltou em ${fmt(ultimo?.em)}`}
                  {ultimo?.detalhe ? ` · "${ultimo.detalhe}"` : ''}{ultimo?.por ? ` · por ${ultimo.por}` : ''}
                </p>
              </div>
              {o.ativo
                ? <Button variant="ghost" className="text-xs" onClick={() => setReativar({ ...o, justificativa: '' })}>Reativar…</Button>
                : <span className="text-xs text-emerald-700">✅ recebendo</span>}
            </div>
          );
        })}
      </div>

      {novo && (
        <Modal title="Registrar pedido para não receber mensagens" onClose={() => setNovo(null)} footer={<Button variant="danger" onClick={salvarNovo}>Descadastrar</Button>}>
          <div className="space-y-3">
            <Field label="Celular com DDD"><input className={inputClass} value={novo.celular} onChange={(e) => setNovo({ ...novo, celular: e.target.value })} placeholder="(71) 99999-9999" /></Field>
            <Field label="Como a pessoa pediu"><input className={inputClass} value={novo.motivo} onChange={(e) => setNovo({ ...novo, motivo: e.target.value })} placeholder="Ex.: pediu pessoalmente na secretaria" /></Field>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
        </Modal>
      )}

      {reativar && (
        <Modal title={`Reativar ${reativar.nome || fone(reativar.chave)}`} onClose={() => setReativar(null)} footer={<Button variant="gold" onClick={confirmarReativacao}>Reativar mensagens</Button>}>
          <p className="text-sm text-slate-600">
            Só reative se <strong>a própria pessoa pediu</strong> para voltar a receber. O mais simples é ela enviar <strong>VOLTAR</strong> no WhatsApp.
          </p>
          <div className="mt-3">
            <Field label="Como a pessoa pediu para voltar" hint="Fica registrado no histórico, com o seu nome.">
              <input className={inputClass} value={reativar.justificativa} onChange={(e) => setReativar({ ...reativar, justificativa: e.target.value })} placeholder="Ex.: pediu na recepção em 10/10" />
            </Field>
          </div>
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        </Modal>
      )}
    </Card>
  );
}
