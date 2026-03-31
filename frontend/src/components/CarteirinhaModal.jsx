import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import logoIbbi from '../assets/logo-ibbi.jpeg';

// Church constants
const CHURCH = {
  name: 'IGREJA BATISTA BÍBLICA ISRAEL',
  shortName: 'IBBI',
  phone: '+55 71 3051-2535',
  email: 'ibbisede@gmail.com',
  cnpj: '15.185.408/0001-52',
  site: 'bíblicaisrael.com.br',
};

// Color tokens
const COLORS = {
  navy: '#0a1f44',
  navyLight: '#112b5e',
  gold: '#c9a227',
  goldLight: '#e8c547',
  cardBg1: '#f8f6f0',
  cardBg2: '#ffffff',
  cardBg3: '#f0ede4',
};

// Format date to DD/MM/YYYY
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

// Generate a deterministic random membership number from person _id
// Uses a simple hash to produce a 6-digit number that is always the same for the same member
const generateMemberNumber = (person) => {
  if (person.matricula && person.matricula > 0) return String(person.matricula).padStart(6, '0');
  // Fallback: hash the _id string into a 6-digit number (100000–999999)
  const id = person._id || '';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 900000 + 100000;
  return String(num);
};

// Format phone for display
const fmtPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

// Mask phone input as user types
const maskPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Year from ISO date
const yearFrom = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.getFullYear();
};

// Resolve full photo URL
const resolvePhotoUrl = (fotoUrl) => {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('/uploads')) {
    const baseUrl = api.defaults.baseURL.replace('/api', '');
    return `${baseUrl}${fotoUrl}`;
  }
  return fotoUrl;
};

// Hologram badge removed per user request

// Watermark background using real logo
function WatermarkGrid() {
  const items = Array.from({ length: 24 });
  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)',
        opacity: 0.035, pointerEvents: 'none',
      }}
    >
      {items.map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={logoIbbi} alt="" style={{ width: 50, height: 50, objectFit: 'contain' }} />
        </div>
      ))}
    </div>
  );
}

// ===== CARD FRONT =====
function CardFront({ person, photoUrl }) {
  const memberNumber = generateMemberNumber(person);
  return (
    <div
      style={{
        width: 856, height: 540, fontFamily: 'Arial, sans-serif', position: 'relative',
        background: `linear-gradient(135deg, ${COLORS.cardBg1}, ${COLORS.cardBg2} 50%, ${COLORS.cardBg3})`,
        overflow: 'hidden', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <WatermarkGrid />

      {/* Navy Header */}
      <div
        style={{
          height: 160, background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`,
          display: 'flex', alignItems: 'center', padding: '0 40px', gap: 24, position: 'relative',
        }}
      >
        {/* Real logo */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
          background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `3px solid ${COLORS.gold}`,
        }}>
          <img src={logoIbbi} alt="IBBI" style={{ width: 100, height: 100, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ color: COLORS.gold, fontSize: 25, fontFamily: 'Arial, sans-serif', fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', margin: 0 }}>
            Carteira de Membro
          </p>
          <p style={{ color: '#ffffff', fontSize: 35, fontFamily: 'Arial, sans-serif', fontWeight: 700, margin: '4px 0 0', lineHeight: 1.15 }}>
            IGREJA BATISTA BÍBLICA ISRAEL
          </p>
        </div>
      </div>

      {/* Gold line */}
      <div style={{ height: 6, background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldLight}, ${COLORS.gold})` }} />

      {/* Content area */}
      {/* paddingRight: 272px reserva espaço para a foto absoluta */}
      <div style={{ padding: '10px 272px 0 40px', position: 'relative', zIndex: 1 }}>
        {/* Matrícula */}
        <p style={{ fontSize: 20, color: COLORS.navy, fontWeight: 600, opacity: 0.55, margin: '0 0 1px', letterSpacing: 0, fontFamily: 'Arial, sans-serif' }}>
          Nº {memberNumber}
        </p>

        {/* Nome */}
        <h2
          style={{
            fontFamily: 'Arial, sans-serif', fontSize: 35, fontWeight: 700,
            color: COLORS.navy, textTransform: 'uppercase', margin: '0 0 8px',
            lineHeight: 1.15, letterSpacing: 0.3,
            wordBreak: 'break-word',
          }}
        >
          {person.nome}
        </h2>

        {/* Data grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
          <div>
            <p style={{ fontSize: 15, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 4px', fontFamily: 'Arial, sans-serif' }}>Nascimento</p>
            <p style={{ fontSize: 25, color: COLORS.navy, fontWeight: 700, margin: 0, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{fmtDate(person.dataNascimento)}</p>
          </div>
          <div>
            <p style={{ fontSize: 15, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 4px', fontFamily: 'Arial, sans-serif' }}>Congregação</p>
            <p style={{ fontSize: 25, color: COLORS.navy, fontWeight: 700, margin: 0, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{person.congregacao || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 15, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 4px', fontFamily: 'Arial, sans-serif' }}>Batismo</p>
            <p style={{ fontSize: 25, color: COLORS.navy, fontWeight: 700, margin: 0, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{fmtDate(person.dataBatismo)}</p>
          </div>
          <div>
            <p style={{ fontSize: 15, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 4px', fontFamily: 'Arial, sans-serif' }}>Membro Desde</p>
            <p style={{ fontSize: 25, color: COLORS.navy, fontWeight: 700, margin: 0, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{yearFrom(person.dataBatismo)}</p>
          </div>
        </div>

      </div>

      {/* Foto — posição absoluta, ocupa toda a área lateral direita */}
      {/* top: 174 = 160 header + 6 goldline + 8px gap | bottom: 72 = 64 footer + 8px gap */}
      <div style={{
        position: 'absolute', top: 174, right: 36, bottom: 72, width: 222,
        borderRadius: 14, border: `3.5px solid ${COLORS.gold}`,
        overflow: 'hidden', background: '#f5f5f5', zIndex: 2,
      }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={person.nome}
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${COLORS.navy}15, ${COLORS.navy}08)` }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke={COLORS.navy} strokeWidth="1.2" opacity="0.35">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
      </div>

      {/* Gold accent line decoration */}
      <div style={{ position: 'absolute', bottom: 68, left: 40, right: 275, height: 1, background: `linear-gradient(90deg, ${COLORS.gold}44, transparent)` }} />

      {/* Navy Footer */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
          background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px',
        }}
      >
        <p style={{ color: '#ffffffcc', fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: 0.5, fontFamily: 'Arial, sans-serif' }}>
          CNPJ {CHURCH.cnpj}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.gold }} />
          <p style={{ color: COLORS.gold, fontSize: 20, margin: 0, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
            Válido Indefinidamente
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== CARD BACK =====
function CardBack({ person }) {
  return (
    <div
      style={{
        width: 856, height: 540, fontFamily: 'Barlow, sans-serif', position: 'relative',
        background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`,
        overflow: 'hidden', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)', color: '#fff',
      }}
    >
      {/* Top gold line */}
      <div style={{ height: 6, background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldLight}, ${COLORS.gold})` }} />

      {/* Header */}
      <div style={{ padding: '24px 40px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>

          <h3 style={{ fontSize: 35, fontFamily: 'Arial, serif', fontWeight: 700, color: '#fff', margin: 0 }}>
            Saúde & Emergência
          </h3>
          <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 3, margin: '0 0 6px' }}>
            Informações
          </p>
        </div>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${COLORS.gold}33` }}>
          <span style={{ fontSize: 28 }}>❤️</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: '0 40px', height: 1, background: `linear-gradient(90deg, ${COLORS.gold}55, transparent)` }} />

      {/* Health info cards */}
      <div style={{ padding: '15px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Blood type */}
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 10px' }}>Tipo Sanguíneo</p>
          <p style={{ fontSize: 45, fontWeight: 700, color: COLORS.gold, margin: 0, fontFamily: 'Cinzel, serif' }}>
            {person.tipoSanguineo || '—'}{person.fatorRh || ''}
          </p>
        </div>
        {/* Allergies */}
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 10px' }}>Alergias</p>
          <p style={{ fontSize: 25, fontWeight: 600, color: '#fff', margin: 0, textTransform: 'uppercase', wordBreak: 'break-word' }}>
            {person.alergias || 'NENHUMA'}
          </p>
        </div>
        {/* Batismo */}
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 10px' }}>Batismo</p>
          <p style={{ fontSize: 25, fontWeight: 600, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
            {fmtDate(person.dataBatismo)}
          </p>
        </div>
      </div>

      {/* Emergency section */}
      <div style={{ margin: '0 40px', padding: '14px 0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <span style={{ fontSize: 25 }}>🚨</span>
          <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, margin: 0 }}>
            Emergência — Avisar
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${COLORS.gold}44` }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px 24px', borderRight: `1px solid ${COLORS.gold}33` }}>
            <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 8px' }}>Nome</p>
            <p style={{ fontSize: 25, fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
              {person.contatoEmergenciaNome || '—'}
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px 30px' }}>
            <p style={{ fontSize: 20, color: COLORS.gold, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 8px' }}>Telefone</p>
            <p style={{ fontSize: 25, fontWeight: 700, color: '#fff', margin: 0 }}>
              {fmtPhone(person.contatoEmergenciaTel) || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 40, padding: '0 40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📞</span>
          <p style={{ fontSize: 22, color: '#ffffffcc', margin: 0, fontWeight: 600 }}>{CHURCH.phone}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>✉️</span>
          <p style={{ fontSize: 22, color: '#ffffffcc', margin: 0, fontWeight: 600 }}>{CHURCH.email}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌐</span>
          <p style={{ fontSize: 22, color: '#ffffffcc', margin: 0, fontWeight: 600 }}>{CHURCH.site}</p>
        </div>
      </div>
    </div>
  );
}

// ===== HEALTH FORM (Step 1 - Optional) =====
function HealthForm({ person, onComplete, onCancel }) {
  const [form, setForm] = useState({
    tipoSanguineo: person.tipoSanguineo || '',
    fatorRh: person.fatorRh || '',
    alergias: person.alergias || '',
    contatoEmergenciaNome: person.contatoEmergenciaNome || '',
    contatoEmergenciaTel: person.contatoEmergenciaTel ? fmtPhone(person.contatoEmergenciaTel) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handlePhoneChange = (e) => {
    set('contatoEmergenciaTel', maskPhone(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        contatoEmergenciaTel: form.contatoEmergenciaTel.replace(/\D/g, ''),
      };
      await api.patch(`/persons/${person._id}/health`, payload);
      onComplete({ ...person, ...payload });
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao salvar dados de saúde');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <span className="text-lg mt-0.5">💡</span>
        <div>
          <p className="text-sm font-medium text-amber-800">Dados de Saúde & Emergência</p>
          <p className="text-xs text-amber-600 mt-1">Preencha para que o verso da carteirinha exiba suas informações médicas e contato de emergência.</p>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipo Sanguíneo</label>
          <select className={inputCls} value={form.tipoSanguineo} onChange={(e) => set('tipoSanguineo', e.target.value)}>
            <option value="">Selecione</option>
            {['A', 'B', 'AB', 'O'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Fator Rh</label>
          <select className={inputCls} value={form.fatorRh} onChange={(e) => set('fatorRh', e.target.value)}>
            <option value="">Selecione</option>
            <option value="+">+ (Positivo)</option>
            <option value="-">- (Negativo)</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Alergias</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="Nenhuma alergia conhecida"
          value={form.alergias}
          onChange={(e) => set('alergias', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Contato de Emergência</label>
          <input
            className={inputCls}
            placeholder="Nome completo"
            value={form.contatoEmergenciaNome}
            onChange={(e) => set('contatoEmergenciaNome', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Telefone Emergência</label>
          <input
            className={inputCls}
            placeholder="(71) 99999-0000"
            value={form.contatoEmergenciaTel}
            onChange={handlePhoneChange}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
        >
          {saving ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>
          ) : null}
          Salvar e Visualizar →
        </button>
      </div>
    </form>
  );
}

// ===== MAIN MODAL =====
export default function CarteirinhaModal({ person, onClose }) {
  // Always go directly to preview — health form is optional via "Verso" click
  const [step, setStep] = useState('preview');
  const [side, setSide] = useState('front');
  const [personData, setPersonData] = useState(person);
  const [downloading, setDownloading] = useState('');
  const [healthWarning, setHealthWarning] = useState(false);

  const frontRef = useRef(null);
  const backRef = useRef(null);
  const hiddenFrontRef = useRef(null);
  const hiddenBackRef = useRef(null);

  const photoUrl = resolvePhotoUrl(personData.fotoUrl);

  // Check if health data is present
  const hasHealthData = personData.tipoSanguineo || personData.contatoEmergenciaNome || personData.contatoEmergenciaTel;

  const handleHealthComplete = (updatedPerson) => {
    setPersonData(updatedPerson);
    setStep('preview');
    setSide('back');
    setHealthWarning(false);
  };

  // Handle clicking "Verso" tab
  const handleVersoClick = () => {
    if (!hasHealthData) {
      setHealthWarning(true);
      // Show warning briefly then redirect to health form
      setTimeout(() => {
        setStep('form');
        setHealthWarning(false);
      }, 1800);
      return;
    }
    setSide('back');
  };

  // Capture card as canvas
  const captureCard = useCallback(async (ref) => {
    if (!ref?.current) return null;
    return html2canvas(ref.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });
  }, []);

  const firstName = personData.nome?.split(' ')[0] || 'Membro';

  // Download PNG — usa as refs hidden (sem escala CSS) para gerar imagem em alta resolução
  const handlePng = async () => {
    setDownloading('png');
    try {
      const ref = side === 'front' ? hiddenFrontRef : hiddenBackRef;
      const canvas = await captureCard(ref);
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `Carteirinha-IBBI-${firstName}-${side === 'front' ? 'frente' : 'verso'}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading('');
    }
  };

  // Download PDF
  const handlePdf = async () => {
    setDownloading('pdf');
    try {
      const [frontCanvas, backCanvas] = await Promise.all([
        captureCard(hiddenFrontRef),
        captureCard(hiddenBackRef),
      ]);
      if (!frontCanvas || !backCanvas) return;

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] });
      pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 53.98);
      pdf.addPage([85.6, 53.98], 'landscape');
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 53.98);
      pdf.save(`Carteirinha-IBBI-${firstName}.pdf`);
    } finally {
      setDownloading('');
    }
  };

  // Print
  const handlePrint = async () => {
    setDownloading('print');
    try {
      const [frontCanvas, backCanvas] = await Promise.all([
        captureCard(hiddenFrontRef),
        captureCard(hiddenBackRef),
      ]);
      if (!frontCanvas || !backCanvas) return;

      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Carteirinha IBBI - ${personData.nome}</title>
          <style>
            body { margin: 0; padding: 20mm; display: flex; flex-direction: column; align-items: center; gap: 10mm; background: #fff; }
            img { width: 85.6mm; height: 53.98mm; border-radius: 4mm; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
            @media print { body { padding: 10mm; } img { box-shadow: none; } }
          </style>
        </head>
        <body>
          <img src="${frontCanvas.toDataURL('image/png')}" />
          <img src="${backCanvas.toDataURL('image/png')}" />
        </body>
        </html>
      `);
      win.document.close();
      setTimeout(() => win.print(), 600);
    } finally {
      setDownloading('');
    }
  };

  // Share via WhatsApp — envia direto pelo Backend via Evolution API
  const handleWhatsApp = async () => {
    const celular = personData.celular;
    if (!celular) {
      alert('Membro não possui número de celular cadastrado.');
      return;
    }
    
    setDownloading('whatsapp');

    const messageText =
      `🙏 Paz do Senhor, *${personData.nome}*!\n\n` +
      `É com alegria que compartilhamos sua *Carteirinha de Membro* da Igreja Batista Bíblica Israel! 🪪\n\n` +
      `Sua matrícula é *Nº ${generateMemberNumber(personData)}*.\n\n` +
      `Que Deus continue abençoando sua caminhada conosco! 🙌\n\n` +
      `_${CHURCH.name}_`;

    try {
      // Generates the card front as PNG base64
      const canvas = await captureCard(hiddenFrontRef);
      if (!canvas) throw new Error('Falha ao gerar a imagem do cartão');
      
      const base64Image = canvas.toDataURL('image/png');

      await api.post('/messages/send-carteirinha', {
        personId: personData._id,
        base64Image,
        mensagem: messageText
      });
      
      alert('🎉 Carteirinha enviada com sucesso para o membro!');
    } catch (err) {
      console.error('Erro ao enviar carteirinha:', err);
      alert(err?.response?.data?.message || err.message || 'Erro ao enviar carteirinha via WhatsApp.');
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {step === 'form' && (
              <button
                onClick={() => { setStep('preview'); setSide('front'); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                ←
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                {/* Step indicators */}
                <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${step === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  🪪
                </div>
                {step === 'form' && (
                  <>
                    <div className="w-6 h-0.5 bg-slate-200" />
                    <div className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center bg-blue-600 text-white">
                      ❤️
                    </div>
                  </>
                )}
              </div>
              <h2 className="text-base font-semibold text-slate-800">
                {step === 'form' ? 'Dados de Saúde' : 'Carteirinha de Membro'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'form' ? 'Preencha para exibir no verso da carteirinha' : personData.nome}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'form' ? (
            <HealthForm person={personData} onComplete={handleHealthComplete} onCancel={() => { setStep('preview'); setSide('front'); }} />
          ) : (
            <div className="p-6 flex flex-col items-center gap-4">
              {/* Health warning toast */}
              {healthWarning && (
                <div className="w-full bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3 animate-pulse">
                  <span className="text-lg">⚠️</span>
                  <p className="text-sm text-amber-700 font-medium">Preencha os dados de Saúde para visualizar o verso da carteirinha.</p>
                </div>
              )}

              {/* Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setSide('front')}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition ${side === 'front' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Frente
                </button>
                <button
                  onClick={handleVersoClick}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition ${side === 'back' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Verso
                </button>
              </div>

              {/* Preview area */}
              <div className="relative w-full flex justify-center overflow-hidden" style={{ height: 280 }}>
                <div style={{ transform: 'scale(0.48)', transformOrigin: 'top center' }}>
                  {side === 'front' ? (
                    <div ref={frontRef}>
                      <CardFront person={personData} photoUrl={photoUrl} />
                    </div>
                  ) : (
                    <div ref={backRef}>
                      <CardBack person={personData} />
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden renders for PDF/Print capture — always rendered */}
              <div style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none' }}>
                <div ref={hiddenFrontRef}>
                  <CardFront person={personData} photoUrl={photoUrl} />
                </div>
                <div ref={hiddenBackRef}>
                  <CardBack person={personData} />
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-1">
                Tamanho padrão cartão de crédito (85,6 × 54 mm)
              </p>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  onClick={handlePng}
                  disabled={!!downloading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  {downloading === 'png' ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  )}
                  Baixar Imagem
                </button>

                <button
                  onClick={handlePdf}
                  disabled={!!downloading}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  {downloading === 'pdf' ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  )}
                  Baixar PDF
                </button>

                <button
                  onClick={handlePrint}
                  disabled={!!downloading}
                  className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-100 text-slate-600 text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  {downloading === 'print' ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  )}
                  Imprimir
                </button>

                {personData.celular && (
                  <button
                    onClick={handleWhatsApp}
                    disabled={!!downloading}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
                  >
                    {downloading === 'whatsapp' ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    )}
                    Enviar via WhatsApp
                  </button>
                )}
              </div>

              {/* Edit health data link */}
              {hasHealthData && (
                <button
                  onClick={() => setStep('form')}
                  className="text-xs text-slate-400 hover:text-blue-600 transition mt-1"
                >
                  ✏️ Editar dados de saúde
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
