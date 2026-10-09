import { useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import WhatsAppCentral from '../WhatsAppCentral';
import CommunicationPanel from './CommunicationPanel';
import Descadastrados from './Descadastrados';

const ABAS = [
  { id: 'conversas', label: 'Conversas', desc: 'Histórico por pessoa e envio direto' },
  { id: 'envios', label: 'Envios e histórico', desc: 'Envio por grupo, congregação, individual, falhas e orações' },
  { id: 'sair', label: 'Descadastrados (SAIR)', desc: 'Quem pediu para não receber mensagens' },
];

// Central WhatsApp: une a Comunicação (envios em massa + histórico) e as conversas por pessoa.
export default function CommunicationHub() {
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((a) => a.id === params.get('aba')) ? params.get('aba') : 'conversas';

  return (
    <div>
      <Header title="Central WhatsApp" subtitle="Tudo o que a igreja envia e conversa pelo WhatsApp, em um só lugar" />
      <div className="flex gap-1 mb-4 overflow-x-auto" role="tablist" aria-label="Seções da Central WhatsApp">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setParams(a.id === 'conversas' ? {} : { aba: a.id })}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap text-left ${aba === a.id ? 'bg-ibbiNavy text-white' : 'bg-white text-slate-600 border border-stone-100 hover:bg-slate-50'}`}
            title={a.desc}
          >
            {a.label}
          </button>
        ))}
      </div>
      {aba === 'conversas' && <WhatsAppCentral embedded />}
      {aba === 'envios' && <CommunicationPanel embedded />}
      {aba === 'sair' && <Descadastrados />}
    </div>
  );
}
