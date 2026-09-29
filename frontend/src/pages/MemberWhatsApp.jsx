import { useEffect, useState } from 'react';
import api from '../services/api';
import TenantLogo from '../components/TenantLogo';
import WhatsAppThread from '../components/WhatsAppThread';
import logo from '../assets/logo-ibbi.jpeg';
import { useTenant } from '../context/TenantContext';

// Membro: vê apenas as mensagens enviadas para o próprio WhatsApp.
export default function MemberWhatsApp() {
  const { tenant } = useTenant();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/me/whatsapp').then((r) => setData(r.data)).catch(() => setData({ itens: [] }));
  }, []);

  const nome = tenant?.nomeCurto || 'Igreja';
  return (
    <div className="max-w-3xl mx-auto">
      <div className="pl-12 md:pl-0 mb-4">
        <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">Meu WhatsApp</h1>
        <p className="text-xs md:text-sm text-slate-500">Tudo o que a {nome} enviou para o seu WhatsApp{data?.celular ? ` (${data.celular})` : ''}, e suas conversas com o assistente.</p>
      </div>
      <div className="rounded-2xl overflow-hidden shadow-soft border border-black/5 h-[calc(100vh-11rem)] min-h-[420px]">
        <WhatsAppThread
          loading={!data}
          itens={data?.itens || []}
          emptyText={data && !data.celular ? 'Cadastre seu celular em Meu perfil para ver suas mensagens aqui.' : 'Ainda não há mensagens da igreja para você.'}
          header={(
            <div className="flex items-center gap-3">
              <TenantLogo tenant={tenant} fallback={logo} className="w-10 h-10" />
              <div className="min-w-0">
                <p className="font-semibold leading-tight truncate">{tenant?.nome || nome} <span title="Conta da igreja">✔︎</span></p>
                <p className="text-xs text-white/75">Assistente {data?.assistente || ''} · mensagens automáticas da igreja</p>
              </div>
            </div>
          )}
          footer={<div className="flex-1 rounded-full bg-white px-4 py-2 text-sm text-slate-400">Para responder, use o seu WhatsApp — esta tela é um espelho das mensagens.</div>}
        />
      </div>
    </div>
  );
}
