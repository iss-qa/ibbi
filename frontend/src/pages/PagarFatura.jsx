import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import Logo from '../components/landing/Logo';
import { Button, brl, fmtDate, fmtDateTime } from '../components/ui';

const POLL_MS = 5000;

// Página pública de pagamento da fatura (link do email): Pix com QR e copia e cola, boleto quando
// houver, e confirmação automática. Sem login — o token do link é a autorização.
export default function PagarFatura() {
  const { token } = useParams();
  const [f, setF] = useState(null);
  const [erro, setErro] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const pediuPix = useRef(false);

  const carregar = (gerarPix = false) => (gerarPix ? api.post(`/public/faturas/${token}/pix`) : api.get(`/public/faturas/${token}`))
    .then(({ data }) => { setF(data); setErro(null); return data; })
    .catch((err) => setErro(err?.response?.status === 404 ? 'Fatura não encontrada. Confira o link do email.' : (err?.response?.data?.message || 'Não foi possível carregar a fatura.')));

  useEffect(() => { document.title = 'Pagar fatura · PastorIA'; }, []);

  useEffect(() => {
    carregar().then((data) => {
      // Em aberto e sem Pix válido (expirou ou ainda não foi gerado): gera na hora
      if (data && ['pendente', 'vencido'].includes(data.status) && !data.pix && data.gatewayAtivo && !pediuPix.current) {
        pediuPix.current = true;
        setGerando(true);
        carregar(true).finally(() => setGerando(false));
      }
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const aberta = f && ['pendente', 'vencido'].includes(f.status);
  useEffect(() => {
    if (!aberta || !f?.pix) return undefined;
    const id = setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, POLL_MS);
    return () => clearInterval(id);
  }, [aberta, f?.pix]); // eslint-disable-line react-hooks/exhaustive-deps

  const copiar = async (texto, qual) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 2500);
    } catch { /* sem permissão: o texto fica selecionável na tela */ }
  };

  return (
    <div className="min-h-screen bg-app flex flex-col items-center px-4 py-8">
      <div className="mb-6"><Logo /></div>
      <main className="w-full max-w-md bg-white rounded-2xl shadow-soft overflow-hidden">
        {!f && !erro && <p className="p-8 text-center text-sm text-slate-500" aria-busy="true">Carregando a fatura…</p>}
        {erro && <p className="p-8 text-center text-sm text-red-600">{erro}</p>}

        {f && (
          <>
            <div className="bg-ibbiNavy px-6 py-5 text-white">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ibbiGold font-semibold">Fatura da assinatura</p>
              <p className="font-display text-xl mt-1 break-words">{f.igreja}</p>
              <p className="text-sm text-white/70 break-words">{f.descricao}</p>
            </div>

            <div className="px-6 pt-5 text-center">
              <p className="font-display text-4xl text-ibbiNavy tabular-nums">{brl(f.valor)}</p>
              <p className="text-sm text-slate-500 mt-1">Vencimento {fmtDate(f.vencimento)}</p>
              {f.status === 'vencido' && (
                <p className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                  Vencida há {f.diasAtraso} {f.diasAtraso === 1 ? 'dia' : 'dias'}. Pague para manter (ou liberar) o acesso — a liberação é automática.
                </p>
              )}
            </div>

            {f.status === 'pago' && (
              <div className="px-6 py-8 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="font-display text-xl text-ibbiNavy mt-3">Pagamento confirmado</p>
                <p className="text-sm text-slate-600 mt-1">{f.pagoEm ? `Recebido em ${fmtDateTime(f.pagoEm)}. ` : ''}Obrigado!</p>
              </div>
            )}

            {f.status === 'cancelado' && <p className="px-6 py-8 text-center text-sm text-slate-500">Esta fatura foi cancelada. Nada a pagar.</p>}

            {aberta && (
              <div className="px-6 py-5 space-y-5">
                {gerando && <p className="text-center text-sm text-slate-500">Gerando o Pix…</p>}
                {!gerando && !f.pix && <p className="text-center text-sm text-slate-500">O Pix desta fatura não está disponível agora. Fale com o suporte do PastorIA.</p>}
                {f.pix && (
                  <div className="flex flex-col items-center gap-3">
                    <p className="font-medium text-ibbiNavy">Pague com Pix</p>
                    <img src={f.pix.qrCode} alt="QR Code do Pix" className="w-56 h-56 rounded-xl border border-slate-100" />
                    <div className="w-full">
                      <label htmlFor="pix-copia-cola" className="text-xs font-medium text-slate-600">Pix copia e cola</label>
                      <div className="mt-1 flex gap-2">
                        <input id="pix-copia-cola" readOnly value={f.pix.brCode} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" />
                        <Button className="shrink-0" onClick={() => copiar(f.pix.brCode, 'pix')}>{copiado === 'pix' ? 'Copiado!' : 'Copiar'}</Button>
                      </div>
                    </div>
                    <p className="w-full flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900" role="status" aria-live="polite">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" aria-hidden="true" />
                      Aguardando o pagamento… esta página atualiza sozinha.
                    </p>
                  </div>
                )}
                {f.boleto?.digitable && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="font-medium text-ibbiNavy text-center">Ou pague com boleto</p>
                    <div className="mt-2 flex gap-2">
                      <input readOnly value={f.boleto.digitable} onFocus={(e) => e.target.select()} aria-label="Linha digitável do boleto" className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" />
                      <Button variant="outline" className="shrink-0" onClick={() => copiar(f.boleto.digitable, 'boleto')}>{copiado === 'boleto' ? 'Copiado!' : 'Copiar'}</Button>
                    </div>
                    {f.boleto.imagem && <img src={f.boleto.imagem} alt="Código de barras do boleto" className="mt-3 w-full h-auto" />}
                    <p className="text-xs text-slate-500 mt-2 text-center">O boleto leva até 3 dias úteis para compensar; o Pix confirma na hora.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <p className="text-xs text-slate-400 mt-6 text-center">PastorIA · Quem falta, faz falta.</p>
    </div>
  );
}
