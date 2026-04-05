import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import logoIbbi from '../assets/logo-ibbi.jpeg';

/* ═══════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════ */
const C = {
  blue:      '#2b5c8a',
  blueDark:  '#1b3f63',
  blueLight: '#d6e4f0',
  gold:      '#c5a44e',
  goldLight: '#e0cc8a',
  cream:     '#faf7f0',
  creamDark: '#ede6d6',
  text:      '#1e1e1e',
  textMid:   '#3a3a3a',
  textSoft:  '#6b6b6b',
};

const W = 1600;
const H = 1130;

const MESES = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];

const fmtBatismo = (iso) => {
  if (!iso) return { dia: '___', mes: '____________', ano: '______' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dia: '___', mes: '____________', ano: '______' };
  return { dia: String(d.getUTCDate()), mes: MESES[d.getUTCMonth()], ano: String(d.getUTCFullYear()) };
};

/* ── shared inline font-face (works inside html2canvas) ── */
const fontCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
`;
const FF = "'Playfair Display', Georgia, serif";
const FB = "'Lora', Georgia, serif";

/* ═══════════════════════════════════════════
   SVG DECORATIONS
   ═══════════════════════════════════════════ */

// Elegant double-line border with small corner flourishes
function BorderFrame() {
  const m = 30;   // outer margin
  const m2 = 42;  // inner margin
  const r = 6;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
      {/* outer line */}
      <rect x={m} y={m} width={W-m*2} height={H-m*2} rx={r} fill="none" stroke={C.blue} strokeWidth="2" opacity="0.4"/>
      {/* inner line */}
      <rect x={m2} y={m2} width={W-m2*2} height={H-m2*2} rx={r-2} fill="none" stroke={C.blue} strokeWidth="0.8" opacity="0.25"/>

      {/* Corner flourishes — top-left */}
      <g opacity="0.45" stroke={C.blue} fill="none" strokeWidth="1.8">
        <path d={`M${m+8} ${m-2} C${m+8} ${m+25}, ${m+20} ${m+35}, ${m-2} ${m+35}`} />
        <path d={`M${m+18} ${m-2} C${m+18} ${m+15}, ${m+25} ${m+22}, ${m-2} ${m+22}`} />
        <circle cx={m+4} cy={m+4} r="3" fill={C.blue} opacity="0.5"/>
      </g>
      {/* top-right */}
      <g opacity="0.45" stroke={C.blue} fill="none" strokeWidth="1.8" transform={`translate(${W},0) scale(-1,1)`}>
        <path d={`M${m+8} ${m-2} C${m+8} ${m+25}, ${m+20} ${m+35}, ${m-2} ${m+35}`} />
        <path d={`M${m+18} ${m-2} C${m+18} ${m+15}, ${m+25} ${m+22}, ${m-2} ${m+22}`} />
        <circle cx={m+4} cy={m+4} r="3" fill={C.blue} opacity="0.5"/>
      </g>
      {/* bottom-left */}
      <g opacity="0.45" stroke={C.blue} fill="none" strokeWidth="1.8" transform={`translate(0,${H}) scale(1,-1)`}>
        <path d={`M${m+8} ${m-2} C${m+8} ${m+25}, ${m+20} ${m+35}, ${m-2} ${m+35}`} />
        <path d={`M${m+18} ${m-2} C${m+18} ${m+15}, ${m+25} ${m+22}, ${m-2} ${m+22}`} />
        <circle cx={m+4} cy={m+4} r="3" fill={C.blue} opacity="0.5"/>
      </g>
      {/* bottom-right */}
      <g opacity="0.45" stroke={C.blue} fill="none" strokeWidth="1.8" transform={`translate(${W},${H}) scale(-1,-1)`}>
        <path d={`M${m+8} ${m-2} C${m+8} ${m+25}, ${m+20} ${m+35}, ${m-2} ${m+35}`} />
        <path d={`M${m+18} ${m-2} C${m+18} ${m+15}, ${m+25} ${m+22}, ${m-2} ${m+22}`} />
        <circle cx={m+4} cy={m+4} r="3" fill={C.blue} opacity="0.5"/>
      </g>

      {/* Top center ornament */}
      <g transform={`translate(${W/2},${m})`} opacity="0.35" stroke={C.blue} fill={C.blue} strokeWidth="1.5">
        <path d="M0,-4 L4,0 L0,4 L-4,0Z" />
        <line x1="-80" y1="0" x2="-10" y2="0" strokeWidth="1"/>
        <line x1="10" y1="0" x2="80" y2="0" strokeWidth="1"/>
        <circle cx="-80" cy="0" r="2" /><circle cx="80" cy="0" r="2" />
      </g>
      {/* Bottom center ornament */}
      <g transform={`translate(${W/2},${H-m})`} opacity="0.35" stroke={C.blue} fill={C.blue} strokeWidth="1.5">
        <path d="M0,-4 L4,0 L0,4 L-4,0Z" />
        <line x1="-80" y1="0" x2="-10" y2="0" strokeWidth="1"/>
        <line x1="10" y1="0" x2="80" y2="0" strokeWidth="1"/>
        <circle cx="-80" cy="0" r="2" /><circle cx="80" cy="0" r="2" />
      </g>

      {/* Subtle wavy watermark */}
      {Array.from({length:14},(_,i) => {
        const y = 120 + i * 65;
        return <path key={i} d={`M0 ${y} Q${W*.13} ${y-8},${W*.25} ${y} T${W*.5} ${y} T${W*.75} ${y} T${W} ${y}`} stroke={C.blueLight} strokeWidth="1.5" fill="none" opacity="0.25"/>;
      })}
    </svg>
  );
}

// Gold accent divider
function Divider({ w = 350 }) {
  return (
    <div style={{ width: w, height: 2, margin: '0 auto', position: 'relative' }}>
      <div style={{ position:'absolute', inset:0, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, borderRadius: 1 }}/>
      <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%', background:C.gold, border:`2px solid ${C.cream}` }}/>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CERTIFICATE FRONT
   ═══════════════════════════════════════════ */
function CertificadoFront({ person }) {
  const { dia, mes, ano } = fmtBatismo(person.dataBatismo);
  return (
    <div style={{
      width: W, height: H, position:'relative', overflow:'hidden',
      background: `linear-gradient(160deg, #fffdf8, ${C.cream} 50%, ${C.creamDark})`,
    }}>
      <style>{fontCSS}</style>
      <BorderFrame />

      <div style={{
        position:'relative', zIndex:2, height:'100%',
        display:'flex', flexDirection:'column', alignItems:'center',
        padding: '70px 120px 55px',
      }}>
        {/* ── TITLE ── */}
        <h1 style={{
          fontFamily: FF, fontSize: 82, fontWeight: 800,
          color: C.blueDark, letterSpacing: 6,
          margin: 0, textAlign:'center', lineHeight: 1.05,
        }}>
          CERTIFICADO DE BATISMO
        </h1>

        <div style={{ margin: '25px 0' }}><Divider w={420}/></div>

        {/* ── VERSE ── */}
        <p style={{
          fontFamily: FB, fontStyle:'italic', fontSize: 30,
          color: C.textSoft, textAlign:'justify', maxWidth: 920,
          lineHeight: 1.7, margin: '0 0 10px',
        }}>
          "De sorte que estamos sepultados com Ele pelo batismo na morte; para que, como Cristo
          ressuscitou dos mortos pela glória do Pai, assim andemos nós também em novidade de vida"
          <span style={{ fontWeight: 600, fontStyle:'normal', color: C.blue }}> — Romanos 6.4</span>
        </p>

        {/* ── BODY ── */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', width:'100%',
        }}>
          {/* Church name */}
          <p style={{
            fontFamily: FB, fontSize: 30, color: C.textMid,
            textAlign:'center', margin: '0 0 40px', lineHeight: 1.6,
          }}>
            A{' '}
            <span style={{
              fontFamily: FF, fontWeight: 700, fontSize: 40,
              color: C.blueDark, letterSpacing: 2,
            }}>
              IGREJA BATISTA BÍBLICA ISRAEL <br />
            </span>
            {' '}certifica que
          </p>

          {/* Member name */}
          <div style={{ textAlign:'center', marginBottom: 50, width: '65%' }}>
            <p style={{
              fontFamily: FF, fontSize: 46, fontWeight: 700,
              color: C.blueDark, letterSpacing: 4,
              textTransform:'uppercase', margin:'0 0 8px', lineHeight: 1.15,
              wordBreak: 'break-word',
            }}>
              {person.nome}
            </p>
            <div style={{ height: 3, background: `linear-gradient(90deg, transparent 5%, ${C.gold} 30%, ${C.gold} 70%, transparent 95%)`, borderRadius: 2 }}/>
          </div>

          {/* Paragraph */}
          <p style={{
            fontFamily: FB, fontSize: 30, color: C.textMid,
            textAlign:'center', lineHeight: 2.1, maxWidth: 960,
          }}>
            Crendo e obedecendo as sagradas escrituras, seguindo a ordenança de Jesus
            Cristo, foi batizado nesta igreja, sob pública profissão de fé, em nome do Pai, do
            Filho e do Espírito Santo no dia <br />{' '}
            <strong style={{ color: C.blueDark }}>{dia}</strong> de{' '}
            <strong style={{ color: C.blueDark }}>{mes}</strong> de{' '}
            <strong style={{ color: C.blueDark }}>{ano}</strong>.
          </p>
        </div>

        {/* ── SIGNATURES ── */}
        <div style={{ display:'flex', justifyContent:'center', gap: 180, width:'100%' }}>
          {['Secretário(a)', 'Pastor'].map(label => (
            <div key={label} style={{ textAlign:'center', minWidth: 260 }}>
              <div style={{ height:1.5, background: `linear-gradient(90deg, transparent, ${C.textSoft}, transparent)`, marginBottom: 10 }}/>
              <span style={{ fontFamily: FF, fontSize: 30, color: C.textSoft, letterSpacing: 4, textTransform:'uppercase' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CERTIFICATE BACK (PACTO)
   ═══════════════════════════════════════════ */
function CertificadoVerso() {
  return (
    <div style={{
      width: W, height: H, position:'relative', overflow:'hidden',
      background: `linear-gradient(160deg, #fffdf8, ${C.cream} 50%, ${C.creamDark})`,
    }}>
      <style>{fontCSS}</style>
      <BorderFrame />

      <div style={{
        position:'relative', zIndex:2, height:'100%',
        display:'flex', flexDirection:'column', alignItems:'center',
        padding: '65px 110px 50px',
      }}>
        {/* ── TITLE ── */}
        <h1 style={{
          fontFamily: FF, fontSize: 56, fontWeight: 700,
          color: C.blueDark, letterSpacing: 14,
          textTransform:'uppercase', margin:'0 0 12px', textAlign:'center',
        }}>
          PACTO DAS IGREJAS BATISTAS
        </h1>

        <div style={{ margin: '0 0 25px' }}><Divider w={380}/></div>

        {/* ── INTRO (bold) ── */}
        <p style={{
          fontFamily: FB, fontWeight: 700, fontSize: 24,
          color: C.text, textAlign:'justify', maxWidth: 1150,
          lineHeight: 1.85, margin: '0 0 24px',
        }}>
          Tendo sido levados pelo Espírito Santo a aceitar a Jesus Cristo como único e suficiente
          Salvador, e batizados, sob profissão de fé, em nome do Pai, do Filho e do Espírito Santo,
          decidimo-nos, unânimes, como um corpo em Cristo, firmar, solene e alegremente, na presença
          de Deus e desta congregação, o seguinte Pacto:
        </p>

        {/* ── PACT TEXT ── */}
        <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'hidden' }}>
          <p style={{
            fontFamily: FB, fontSize: 22, color: C.textMid,
            textAlign:'justify', lineHeight: 1.95, maxWidth: 1200,
          }}>
            Comprometemo-nos a, auxiliados pelo Espírito Santo, andar sempre unidos no amor cristão;
            trabalhar para que esta Igreja cresça no conhecimento da Palavra, na santidade, no conforto
            mútuo e na espiritualidade; manter os seus cultos, suas doutrinas, suas ordenanças e sua
            disciplina; contribuir liberalmente para o sustento do ministério, para as despesas da Igreja,
            para o auxílio dos pobres e para a propaganda do Evangelho em todas as nações.
            Comprometemo-nos, também, a manter uma devoção particular; a evitar e condenar todos os
            vícios; a educar religiosamente nossos filhos; a procurar a salvação de todo o mundo, a começar
            dos nossos parentes, amigos e conhecidos; a ser corretos em nossas transações, fiéis em nossos
            compromissos, exemplares em nossa conduta e ser diligentes nos trabalhos seculares; evitar a
            detração, a difamação e a ira, sempre e em tudo visando à expansão do Reino do nosso Salvador.
            Além disso, comprometemo-nos a ter cuidado uns dos outros; a lembrarmo-nos uns dos outros
            nas orações; ajudar mutuamente nas enfermidades e necessidades; cultivar relações francas e a
            delicadeza no trato; estar prontos a perdoar as ofensas, buscando, quando possível, a paz com
            todos os homens. Finalmente, nos comprometemos a, quando sairmos desta localidade para
            outra, nos unirmos a uma outra Igreja da mesma fé e ordem, em que possamos observar os
            princípios da Palavra de Deus e o espírito deste Pacto. O Senhor nos abençoe e nos proteja
            para que sejamos fiéis e sinceros até a morte.
          </p>
        </div>

        {/* ── FOOTER WITH LOGO ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          gap: 16, marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${C.blueLight}`,
          width: 460,
        }}>
          <img src={logoIbbi} alt="IBBI" style={{
            width: 58, height: 58, borderRadius:'50%', objectFit:'cover',
            border: `2.5px solid ${C.gold}`, flexShrink: 0,
          }}/>
          <div>
            <p style={{
              fontFamily: FF, fontSize: 16, fontWeight: 700,
              color: C.blueDark, margin: 0, letterSpacing: 1.5,
            }}>
              IGREJA BATISTA BÍBLICA ISRAEL
            </p>
            <p style={{
              fontFamily: FB, fontSize: 18,
              color: C.textSoft, margin: '2px 0 0',
            }}>
              www.biblicaisrael.com.br &nbsp;|&nbsp; @biblicaisrael
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL (full-screen modern design)
   ═══════════════════════════════════════════ */
export default function CertificadoBatismoModal({ person, onClose, hideWhatsApp = false }) {
  const [side, setSide] = useState('front');
  const [downloading, setDownloading] = useState('');
  const [previewScale, setPreviewScale] = useState(0.38);
  const hiddenFrontRef = useRef(null);
  const hiddenBackRef = useRef(null);
  const previewRef = useRef(null);
  const firstName = person.nome?.split(' ')[0] || 'Membro';

  // Responsive scale: measure container width and scale cert (1600px) to fit
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setPreviewScale(Math.min(0.55, (w - 16) / W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const capture = useCallback(async (ref) => {
    if (!ref?.current) return null;
    return html2canvas(ref.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
  }, []);

  const handlePdf = async () => {
    setDownloading('pdf');
    try {
      const [f, b] = await Promise.all([capture(hiddenFrontRef), capture(hiddenBackRef)]);
      if (!f || !b) return;
      const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
      pdf.addImage(f.toDataURL('image/png'),'PNG',0,0,297,210);
      pdf.addPage('a4','landscape');
      pdf.addImage(b.toDataURL('image/png'),'PNG',0,0,297,210);
      pdf.save(`Certificado-Batismo-${firstName}.pdf`);
    } finally { setDownloading(''); }
  };

  const handlePrint = async () => {
    setDownloading('print');
    try {
      const [f, b] = await Promise.all([capture(hiddenFrontRef), capture(hiddenBackRef)]);
      if (!f || !b) return;
      const w = window.open('','_blank');
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html><head><title>Certificado - ${person.nome}</title>
        <style>body{margin:0;padding:0;background:#fff}img{width:297mm;height:210mm;display:block}
        @media print{img{page-break-after:always}img:last-child{page-break-after:auto}}</style>
        </head><body><img src="${f.toDataURL('image/png')}"/><img src="${b.toDataURL('image/png')}"/></body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 600);
    } finally { setDownloading(''); }
  };

  const handleWhatsApp = async () => {
    if (!person.celular) { alert('Membro não possui celular cadastrado.'); return; }
    setDownloading('whatsapp');
    try {
      const canvas = await capture(hiddenFrontRef);
      if (!canvas) throw new Error('Falha ao gerar imagem');
      await api.post('/messages/send-carteirinha', {
        personId: person._id,
        base64Image: canvas.toDataURL('image/png'),
        mensagem: `🙏 Paz do Senhor, *${person.nome}*!\n\nSegue seu *Certificado de Batismo* da Igreja Batista Bíblica Israel! 📜\n\nQue Deus continue abençoando sua caminhada conosco! 🙌\n\n_IGREJA BATISTA BÍBLICA ISRAEL_`,
      });
      alert('Certificado enviado com sucesso!');
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Erro ao enviar via WhatsApp.');
    } finally { setDownloading(''); }
  };

  const Spin = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full max-w-4xl max-h-[96vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Certificado de Batismo</h2>
            <p className="text-sm text-slate-400 mt-0.5">{person.nome}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 flex flex-col items-center gap-5">
          {/* Tab toggle */}
          <div className="inline-flex bg-slate-100 rounded-xl p-1.5 gap-1">
            {[{key:'front',label:'Frente'},{key:'back',label:'Verso'}].map(t => (
              <button
                key={t.key}
                onClick={() => setSide(t.key)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  side === t.key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Preview — responsive scale */}
          <div
            ref={previewRef}
            className="relative w-full rounded-2xl border border-slate-100 bg-slate-50/50 overflow-hidden"
            style={{ height: H * previewScale + 16 }}
          >
            <div style={{
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
              position: 'absolute',
              top: 8,
              left: '50%',
              marginLeft: -(W / 2),
            }}>
              {side === 'front' ? <CertificadoFront person={person}/> : <CertificadoVerso/>}
            </div>
          </div>

          {/* Hidden renders */}
          <div style={{ position:'fixed', left:-9999, top:-9999, pointerEvents:'none' }}>
            <div ref={hiddenFrontRef}><CertificadoFront person={person}/></div>
            <div ref={hiddenBackRef}><CertificadoVerso/></div>
          </div>

          <p className="text-xs text-slate-400">Formato A4 paisagem (297 × 210 mm)</p>

          {/* ── Actions ── */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 pb-2">
            <button
              onClick={handlePdf}
              disabled={!!downloading}
              className="flex items-center gap-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-3 rounded-xl transition shadow-sm"
            >
              {downloading === 'pdf' ? <Spin/> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              )}
              Baixar PDF
            </button>

            <button
              onClick={handlePrint}
              disabled={!!downloading}
              className="flex items-center gap-2.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-semibold px-5 py-3 rounded-xl transition shadow-sm"
            >
              {downloading === 'print' ? <Spin/> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              )}
              Imprimir
            </button>

            {!hideWhatsApp && person.celular && (
              <button
                onClick={handleWhatsApp}
                disabled={!!downloading}
                className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-3 rounded-xl transition shadow-sm"
              >
                {downloading === 'whatsapp' ? <Spin/> : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                )}
                Enviar via WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
