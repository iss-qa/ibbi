import { useEffect, useState } from 'react';

// "Instalar app" (PWA): Android/desktop usam o prompt do navegador; no iPhone, mostra o passo a passo.
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const ehIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export default function InstalarApp() {
  const [prompt, setPrompt] = useState(null);
  const [dica, setDica] = useState(false);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (instalado() || (!prompt && !ehIos())) return null;
  const instalar = async () => {
    if (prompt) { prompt.prompt(); await prompt.userChoice.catch(() => {}); setPrompt(null); } else setDica((v) => !v);
  };
  return (
    <div className="mt-4">
      <button type="button" onClick={instalar} className="w-full text-left px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20">📲 Instalar o app no celular</button>
      {dica && <p className="mt-2 text-xs text-white/70 leading-relaxed">No iPhone: toque em <strong>Compartilhar</strong> (□↑) e depois em <strong>Adicionar à Tela de Início</strong>.</p>}
    </div>
  );
}
