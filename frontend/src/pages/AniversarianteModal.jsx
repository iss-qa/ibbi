// AniversarianteModal.jsx
// Birthday card modal — balões animados, fontes maiores, foto do membro

import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

// ─── Versículos ───────────────────────────────────────────────────────────────
const VERSICULOS = [
  { ref: 'Salmos 118:24' },
  { ref: 'Jeremias 29:11' },
  { ref: 'Números 6:24-25' },
  { ref: 'Salmos 33:22' },
  { ref: 'Isaías 41:10' },
  { ref: 'Filipenses 4:13' },
];

// ─── CSS de animação dos balões (injetado uma vez) ────────────────────────────
const BALLOON_CSS = `
@keyframes baloao-float-1 {
  0%   { transform: translateY(0px) rotate(-4deg); }
  50%  { transform: translateY(-14px) rotate(3deg); }
  100% { transform: translateY(0px) rotate(-4deg); }
}
@keyframes baloao-float-2 {
  0%   { transform: translateY(0px) rotate(3deg); }
  50%  { transform: translateY(-10px) rotate(-2deg); }
  100% { transform: translateY(0px) rotate(3deg); }
}
@keyframes baloao-float-3 {
  0%   { transform: translateY(0px) rotate(-2deg); }
  50%  { transform: translateY(-18px) rotate(5deg); }
  100% { transform: translateY(0px) rotate(-2deg); }
}
`;

function injectBalloonCSS() {
  if (!document.getElementById('balloon-keyframes')) {
    const style = document.createElement('style');
    style.id = 'balloon-keyframes';
    style.textContent = BALLOON_CSS;
    document.head.appendChild(style);
  }
}

// ─── Balões decorativos SVG — animados ────────────────────────────────────────
function Baloes({ style = {}, animated = true }) {
  const a = animated;
  return (
    <div style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
      {/* Balão 1 — dourado */}
      <svg
        width="42" height="60" viewBox="0 0 42 60" fill="none"
        style={{
          position: 'absolute', left: 0, top: 0,
          animation: a ? 'baloao-float-1 3.6s ease-in-out infinite' : undefined,
          transformOrigin: '21px 58px',
        }}
      >
        <ellipse cx="21" cy="22" rx="18" ry="20" fill="#e8c547" opacity="0.92" />
        {/* reflexo */}
        <ellipse cx="13" cy="14" rx="5" ry="7" fill="white" opacity="0.22" />
        {/* nozinho */}
        <path d="M21 42 Q20 44 21 46 Q22 44 21 42Z" fill="#c9a227" />
        {/* barbante */}
        <path d="M21 46 Q19 52 18 58" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M21 46 Q23 50 22 56" stroke="#c9a227" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.45" />
      </svg>

      {/* Balão 2 — branco translúcido */}
      <svg
        width="34" height="50" viewBox="0 0 34 50" fill="none"
        style={{
          position: 'absolute', left: 34, top: 10,
          animation: a ? 'baloao-float-2 4.2s ease-in-out infinite 0.8s' : undefined,
          transformOrigin: '17px 48px',
        }}
      >
        <ellipse cx="17" cy="18" rx="14" ry="16" fill="white" opacity="0.28" />
        <ellipse cx="11" cy="11" rx="4" ry="5" fill="white" opacity="0.18" />
        <path d="M17 34 Q16 40 15 47" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>

      {/* Balão 3 — dourado escuro */}
      <svg
        width="30" height="44" viewBox="0 0 30 44" fill="none"
        style={{
          position: 'absolute', left: 62, top: 6,
          animation: a ? 'baloao-float-3 5s ease-in-out infinite 1.4s' : undefined,
          transformOrigin: '15px 42px',
        }}
      >
        <ellipse cx="15" cy="16" rx="12" ry="14" fill="#c9a227" opacity="0.72" />
        <ellipse cx="9" cy="10" rx="3" ry="4" fill="white" opacity="0.18" />
        <path d="M15 30 Q14 36 13 41" stroke="#a07c1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

// ─── Avatar: foto ou bolo ─────────────────────────────────────────────────────
function Avatar({ person, size = 200, fontSize = '80px' }) {
  const [imgError, setImgError] = useState(false);
  const hasPhoto = person.foto && !imgError;

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #c9a227, #e8c547, #a07c1a)',
      padding: '3px',
      boxShadow: '0 0 48px rgba(201,162,39,0.30)',
      flexShrink: 0,
    }}>
      <div style={{
        width: '100%', height: '100%',
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#0d2255',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, lineHeight: 1,
      }}>
        {hasPhoto ? (
          <img
            src={person.foto}
            alt={person.nome}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          />
        ) : (
          <span>🎂</span>
        )}
      </div>
    </div>
  );
}

// ─── Cartão Portrait ──────────────────────────────────────────────────────────
function CardPortrait({ person, versiculoRef, animated }) {
  const firstName = person.nome.split(' ')[0];
  const birthDate = new Date(person.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

  return (
    <div style={{
      width: '540px',
      minHeight: '860px',
      background: 'linear-gradient(155deg, #0a1f44 0%, #112b5e 55%, #0e2450 100%)',
      fontFamily: "'Playfair Display', Georgia, serif",
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      borderRadius: '32px',
    }}>
      {/* Balões — canto superior esquerdo */}
      <Baloes style={{ top: 16, left: 18 }} animated={animated} />
      {/* Balões — canto superior direito (espelhados) */}
      <div style={{ position: 'absolute', top: 16, right: 18, transform: 'scaleX(-1)', pointerEvents: 'none' }}>
        <Baloes animated={animated} />
      </div>

      {/* Glare */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(201,162,39,0.07)', pointerEvents: 'none' }} />

      {/* Gold top border */}
      <div style={{ width: 'calc(100% - 48px)', height: '3px', background: 'linear-gradient(90deg, transparent, #c9a227, #e8c547, #c9a227, transparent)', borderRadius: '0 0 4px 4px', marginTop: 0 }} />

      {/* Church tag */}
      <div style={{ marginTop: '44px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '1px', background: 'rgba(201,162,39,0.45)' }} />
        <span style={{ color: '#c9a227', fontSize: '20px', letterSpacing: '5px', fontFamily: 'sans-serif', fontWeight: 700 }}>IBBI</span>
        <div style={{ width: '32px', height: '1px', background: 'rgba(201,162,39,0.45)' }} />
      </div>

      {/* Avatar */}
      <div style={{ marginTop: '24px' }}>
        <Avatar person={person} size={220} fontSize="80px" />
      </div>

      {/* Parabéns + Nome + Data */}
      <div style={{ marginTop: '28px', textAlign: 'center', padding: '0 48px' }}>
        <p style={{ color: '#c9a227', fontSize: '20px', letterSpacing: '6px', fontFamily: 'sans-serif', fontWeight: 700, margin: '0 0 10px' }}>
          ✦ PARABÉNS ✦
        </p>
        <h1 style={{ color: 'white', fontSize: '66px', fontWeight: 700, lineHeight: 1.05, textShadow: '0 4px 24px rgba(201,162,39,0.2)', margin: 0 }}>
          {firstName}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '14px' }}>
          <div style={{ height: '1px', width: '36px', background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.5))' }} />
          <span style={{ color: '#c9a227', fontSize: '20px', fontFamily: 'sans-serif', letterSpacing: '2px', fontWeight: 600 }}>
            {birthDate}
          </span>
          <div style={{ height: '1px', width: '36px', background: 'linear-gradient(90deg, rgba(201,162,39,0.5), transparent)' }} />
        </div>
      </div>

      {/* Mensagem */}
      <div style={{
        margin: '28px 36px 0',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '20px',
        padding: '26px 28px',
        border: '1px solid rgba(201,162,39,0.20)',
        width: 'calc(100% - 72px)',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.92)',
          fontSize: '22px',
          lineHeight: 1.8,
          fontStyle: 'italic',
          margin: 0,
        }}>
          Feliz aniversário! Que o Senhor continue guiando seus passos com graça, paz e alegria em cada novo dia. 🙏
        </p>
      </div>

      {/* Versículo */}
      <div style={{ margin: '22px 36px 0', width: 'calc(100% - 72px)', boxSizing: 'border-box', textAlign: 'center' }}>
        <p style={{ color: '#c9a227', fontSize: '20px', fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '2px', margin: 0 }}>
          📖 {versiculoRef}
        </p>
      </div>

      {/* Footer banner */}
      <div style={{
        margin: '26px 36px 36px',
        width: 'calc(100% - 72px)',
        background: 'linear-gradient(90deg, #c9a227, #e8c547, #c9a227)',
        borderRadius: '50px',
        padding: '14px 0',
        textAlign: 'center',
        boxShadow: '0 6px 28px rgba(201,162,39,0.3)',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}>
        <span style={{ color: '#2254ecff', fontSize: '20px', fontWeight: 800, letterSpacing: '4px', fontFamily: 'sans-serif' }}>
          FELIZ ANIVERSÁRIO
        </span>
      </div>
    </div>
  );
}

// ─── Cartão Landscape ─────────────────────────────────────────────────────────
function CardLandscape({ person, versiculoRef, animated }) {
  const firstName = person.nome.split(' ')[0];
  const birthDate = new Date(person.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

  return (
    <div style={{
      width: '900px',
      height: '500px',
      background: 'linear-gradient(135deg, #0a1f44 0%, #112b5e 55%, #0e2450 100%)',
      fontFamily: "'Playfair Display', Georgia, serif",
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',
      borderRadius: '28px',
    }}>
      {/* Glare */}
      <div style={{ position: 'absolute', top: -60, left: '30%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(201,162,39,0.05)', pointerEvents: 'none' }} />

      {/* Left gold border */}
      <div style={{ width: '4px', background: 'linear-gradient(180deg, transparent, #c9a227, #e8c547, #c9a227, transparent)', flexShrink: 0 }} />

      {/* Left panel */}
      <div style={{
        width: '330px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px',
        borderRight: '1px solid rgba(201,162,39,0.15)',
        position: 'relative',
      }}>
        <Baloes style={{ top: 10, left: 8 }} animated={animated} />

        {/* Church tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <div style={{ width: '20px', height: '1px', background: 'rgba(201,162,39,0.4)' }} />
          <span style={{ color: '#c9a227', fontSize: '20px', letterSpacing: '4px', fontFamily: 'sans-serif', fontWeight: 700 }}>IBBI</span>
          <div style={{ width: '20px', height: '1px', background: 'rgba(201,162,39,0.4)' }} />
        </div>

        {/* Avatar */}
        <Avatar person={person} size={200} fontSize="60px" />

        {/* Name */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <p style={{ color: '#c9a227', fontSize: '20px', letterSpacing: '5px', fontFamily: 'sans-serif', fontWeight: 700, margin: '0 0 8px' }}>✦ PARABÉNS ✦</p>
          <h1 style={{ color: 'white', fontSize: '66px', fontWeight: 700, margin: 0, lineHeight: 1.1, textShadow: '0 2px 16px rgba(201,162,39,0.2)' }}>
            {firstName}
          </h1>
          <p style={{ color: '#c9a227', fontSize: '20px', fontFamily: 'sans-serif', letterSpacing: '2px', fontWeight: 600, margin: '8px 0 0' }}>
            {birthDate}
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '36px 44px', gap: '22px' }}>
        {/* Message */}
        <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '25px', lineHeight: 1.85, fontFamily: 'arial-serif', margin: 0 }}>
          Feliz aniversário! Que o Senhor continue guiando seus passos com graça, paz e alegria em cada novo dia. 🙏
        </p>

        {/* Divider */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, rgba(201,162,39,0.4), transparent)' }} />

        {/* Versículo */}
        <p style={{ color: '#c9a227', fontSize: '20px', fontFamily: 'arial-serif', fontWeight: 700, letterSpacing: '2px', margin: 0 }}>
          📖 {versiculoRef}
        </p>

        {/* Footer */}
        <div style={{
          background: 'linear-gradient(90deg, #c9a227, #e8c547, #c9a227)',
          borderRadius: '50px',
          padding: '13px 0',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(201,162,39,0.28)',
        }}>
          <span style={{ color: '#135bd9ff', fontSize: '20px', fontWeight: 800, letterSpacing: '4px', fontFamily: 'arial-serif' }}>
            FELIZ ANIVERSÁRIO
          </span>
        </div>
      </div>

      {/* Right gold border */}
      <div style={{ width: '4px', background: 'linear-gradient(180deg, transparent, #c9a227, #e8c547, #c9a227, transparent)', flexShrink: 0 }} />
    </div>
  );
}

// ─── Modal Principal ──────────────────────────────────────────────────────────
export default function AniversarianteModal({ person, onClose }) {
  const [format, setFormat] = useState('portrait');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const cardRef = useRef(null);
  // Hidden card sem animação para captura fiel
  const hiddenCardRef = useRef(null);

  const versiculoRef = VERSICULOS[
    (person._id?.charCodeAt(person._id.length - 1) || 0) % VERSICULOS.length
  ]?.ref || 'Salmos 118:24';

  useEffect(() => {
    // Fonte
    if (!document.getElementById('playfair-font')) {
      const link = document.createElement('link');
      link.id = 'playfair-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap';
      document.head.appendChild(link);
    }
    // Animações dos balões
    injectBalloonCSS();
  }, []);

  const captureHiddenCard = async () => {
    if (!hiddenCardRef.current) return null;
    return html2canvas(hiddenCardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
  };

  const downloadImage = async () => {
    try {
      setDownloading(true);
      const canvas = await captureHiddenCard();
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Aniversario-${person.nome.split(' ')[0]}-${format}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Erro ao baixar imagem. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsApp = async () => {
    const firstName = person.nome.split(' ')[0];
    const messageText =
      `🎂 *Feliz Aniversário, ${firstName}!*\n\n` +
      `"Ensina-nos a contar os nossos dias, para que alcancemos coração sábio." (${versiculoRef})\n\n` +
      `Que o Senhor continue a guiar seus passos! 🙏\n_Igreja Batista Bíblica Israel_`;

    try {
      setSending(true);
      setError(null);
      const canvas = await captureHiddenCard();

      if (canvas && navigator.canShare) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], `Aniversario-${firstName}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ text: messageText, files: [file] });
          setSending(false);
          return;
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') { setSending(false); return; }
    }

    const celular = person.celular;
    if (celular) {
      const phone = celular.startsWith('55') ? celular : `55${celular}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, '_blank');
    }
    setSending(false);
  };

  const previewScale = format === 'portrait' ? 0.55 : 0.70;
  const cardHeight = format === 'portrait' ? 860 : 500;
  const previewHeight = Math.ceil(cardHeight * previewScale) + 16;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto"
      onClick={onClose}
    >
      {/* X fixo */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[9999] w-10 h-10 flex items-center justify-center rounded-full bg-white/90 shadow-lg text-slate-600 hover:bg-white hover:text-slate-900 transition"
        title="Fechar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      <div
        className="bg-white rounded-2xl shadow-2xl w-full my-6 overflow-hidden relative"
        style={{ maxWidth: format === 'landscape' ? '980px' : '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">🎂 Cartão de Aniversário</h2>
            <p className="text-xs text-slate-400 mt-0.5">{person.nome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Toggle de formato */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5 w-max mx-auto gap-1">
            {[
              { id: 'portrait', label: '📱 Portrait', sub: 'Mobile / Instagram' },
              { id: 'landscape', label: '🖥️ Landscape', sub: 'TV / Telão' },
            ].map(({ id, label, sub }) => (
              <button
                key={id}
                onClick={() => setFormat(id)}
                className={`px-5 py-2.5 rounded-lg text-sm transition-all ${format === id
                  ? 'bg-white shadow-sm text-slate-800 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <span className="block">{label}</span>
                <span className="block text-[10px] font-normal opacity-60">{sub}</span>
              </button>
            ))}
          </div>

          {/* Preview animado */}
          <div
            className="flex justify-center items-start bg-slate-50 rounded-xl overflow-hidden"
            style={{ height: previewHeight }}
          >
            <div
              ref={cardRef}
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top center',
                flexShrink: 0,
              }}
            >
              {format === 'portrait' ? (
                <CardPortrait person={person} versiculoRef={versiculoRef} animated={true} />
              ) : (
                <CardLandscape person={person} versiculoRef={versiculoRef} animated={true} />
              )}
            </div>
          </div>

          {/* Hidden card — sem animação, tamanho real, para captura correta */}
          <div style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none' }}>
            <div ref={hiddenCardRef}>
              {format === 'portrait' ? (
                <CardPortrait person={person} versiculoRef={versiculoRef} animated={false} />
              ) : (
                <CardLandscape person={person} versiculoRef={versiculoRef} animated={false} />
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm mt-4 text-center bg-red-50 py-2 px-4 rounded-lg">
              {error}
            </p>
          )}

          {/* Indicador de foto */}
          {person.foto && (
            <p className="text-xs text-center text-emerald-600 mt-3 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Foto do membro incluída no cartão
            </p>
          )}

          {/* Ações */}
          <div className="flex gap-3 justify-end mt-5">
            <button
              onClick={downloadImage}
              disabled={downloading || sending}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition text-sm disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar Imagem
                </>
              )}
            </button>

            <button
              onClick={handleWhatsApp}
              disabled={sending || downloading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition text-sm disabled:opacity-50"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Gerando...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.557 4.116 1.532 5.845L.057 23.571l5.882-1.541A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.502-5.196-1.38l-.374-.22-3.89 1.02 1.04-3.796-.242-.39A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                  Enviar via WhatsApp
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}