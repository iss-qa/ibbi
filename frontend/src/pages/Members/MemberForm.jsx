import { useRef, useState, useEffect } from 'react';
import { CONGREGACOES } from '../../constants/congregacoes';
import { formatPhoneBR } from '../../utils/phoneMask';
import api from '../../services/api';
import doveDefault from '../../assets/dove_ia.png';
import CustomSelect from '../../components/CustomSelect';

const initialState = {
  nome: '',
  sexo: '',
  dataNascimento: '',
  email: '',
  celular: '',
  tipo: 'congregado',
  grupo: '',
  estadoCivil: '',
  batizado: false,
  dataBatismo: '',
  congregacao: 'Sede',
  status: 'ativo',
  motivoInativacao: '',
  endereco: '',
  ministerio: '',
  fotoUrl: '',
  dataVisita: '',
  dataDecisao: '',
};

const TIPOS = ['congregado', 'membro', 'visitante', 'novo decidido', 'criança'];

const MINISTERIOS = {
  'Ministério Pastoral': ['Pastor', 'Pastor Auxiliar', 'Evangelista', 'Missionário'],
  'Ministério de Louvor — Levitas': ['Levita — Vocais (Voz)', 'Levita — Instrumentos (Músico)', 'Levita — Sonoplastia / Técnico de Som', 'Levita — Projeção / Mídia', 'Levita — Transmissão / Live'],
  'Ministério Diaconal': ['Diácono', 'Diaconisa'],
  'Ministério da Palavra': ['Professor de Escola Bíblica Dominical (EBD)', 'Líder de Célula / Grupo', 'Obreiro / Obreria'],
  'Ministério com Crianças e Jovens': ['Líder do Ministério Infantil', 'Professor de Crianças', 'Líder de Jovens / Adolescentes', 'Auxiliar de Jovens'],
  'Ministério de Oração e Intercessão': ['Intercessor', 'Líder de Oração'],
  'Missões e Evangelismo': ['Evangelista Local', 'Missionário'],
  'Apoio e Administração': ['Secretário(a) da Igreja', 'Tesoureiro(a)', 'Porteiro / Recepcionista', 'Auxiliar de Limpeza / Zeladoria']
};

const fieldClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2.5 sm:py-2 text-[16px] sm:text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-300 min-h-[44px] sm:min-h-[36px]';

const labelClass = 'block text-xs font-medium text-slate-500 mb-1';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

const calculateAge = (birthday) => {
  if (!birthday) return null;
  const birthDate = new Date(birthday + 'T12:00:00Z');
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const determineGroup = (age) => {
  if (age === null || isNaN(age)) return '';
  if (age <= 9) return 'criança';
  if (age <= 17) return 'adolescente';
  if (age <= 35) return 'jovem';
  if (age <= 50) return 'adulto 1';
  if (age <= 60) return 'adulto 2';
  if (age <= 75) return 'idoso';
  return 'ancião';
};

async function optimizeImage(file) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });

    if (!blob) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function MemberForm({ initialData, onSubmit, onCancel, lockedCongregacao, readOnly, isSelfEdit, isExternal, highlightPhoto = false }) {
  const [form, setForm] = useState({
    ...initialState,
    ...initialData,
    congregacao: lockedCongregacao || initialData?.congregacao || initialState.congregacao,
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isCompactTipo = form.tipo === 'visitante' || form.tipo === 'novo decidido';
  
  // Inicializa o preview tratando URLs relativas
  const getInitialPreview = () => {
    if (!initialData?.fotoUrl) return doveDefault;
    if (initialData.fotoUrl.startsWith('/uploads')) {
      const baseUrl = api.defaults.baseURL.replace('/api', '');
      return `${baseUrl}${initialData.fotoUrl}`;
    }
    return initialData.fotoUrl;
  };
  
  const [preview, setPreview] = useState(getInitialPreview());
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const photoFieldRef = useRef(null);
  const [photoHighlighted, setPhotoHighlighted] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const currentAge = calculateAge(form.dataNascimento);

  // Auto-preenche o grupo se houver mudança de idade
  useEffect(() => {
    if (currentAge !== null && !isNaN(currentAge)) {
      const autoGroup = determineGroup(currentAge);
      if (autoGroup && form.grupo !== autoGroup) {
        setForm((prev) => ({ ...prev, grupo: autoGroup }));
      }
    }
  }, [currentAge]);

  useEffect(() => {
    if (!highlightPhoto) return;

    setPhotoHighlighted(true);
    photoFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timer = setTimeout(() => {
      setPhotoHighlighted(false);
    }, 3200);

    return () => clearTimeout(timer);
  }, [highlightPhoto]);

  const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com']);
  const normalizeNameInput = (name) => {
    if (!name) return name;
    return name.trim().replace(/\s+/g, ' ').toLowerCase()
      .split(' ')
      .map((w, i) => {
        if (i > 0 && LOWERCASE_WORDS.has(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'dataNascimento') {
        const age = calculateAge(value);
        const autoGroup = determineGroup(age);
        if (autoGroup) next.grupo = autoGroup;
      }
      return next;
    });
  };

  const handleTipoChange = (tipo) => {
    setForm((prev) => {
      if (tipo === 'visitante') {
        return {
          ...prev,
          tipo,
          email: '',
          grupo: '',
          estadoCivil: '',
          batizado: false,
          dataBatismo: '',
          endereco: '',
          ministerio: '',
          dataDecisao: '',
          status: 'ativo',
          motivoInativacao: '',
        };
      }

      if (tipo === 'novo decidido') {
        return {
          ...prev,
          tipo,
          email: '',
          grupo: '',
          estadoCivil: '',
          batizado: false,
          dataBatismo: '',
          endereco: '',
          ministerio: '',
          dataVisita: '',
          status: 'ativo',
          motivoInativacao: '',
        };
      }

      return {
        ...prev,
        tipo,
        dataVisita: '',
        dataDecisao: '',
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Photo required validation
    if (!form.fotoUrl) {
      setPhotoHighlighted(true);
      photoFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPhotoError(true);
      setTimeout(() => setPhotoHighlighted(false), 3200);
      return;
    }
    setPhotoError(false);

    setSubmitting(true);
    try {
      await onSubmit?.({ ...form, congregacao: lockedCongregacao || form.congregacao });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    const optimizedFile = await optimizeImage(file);
    const previewUrl = URL.createObjectURL(optimizedFile);
    setPreview(previewUrl);
    const data = new FormData();
    data.append('file', optimizedFile);
    setUploading(true);
    try {
      const endpoint = isExternal ? '/uploads/person-photo/public' : '/uploads/person-photo';
      const response = await api.post(endpoint, data);
      
      if (response.data.url) {
        const relativeUrl = response.data.url;
        handleChange('fotoUrl', relativeUrl);
        setPhotoError(false);
        
        // Para o preview, compõe com o baseUrl se necessário
        const baseUrl = api.defaults.baseURL.replace('/api', '');
        setPreview(relativeUrl.startsWith('data:image/') ? relativeUrl : `${baseUrl}${relativeUrl}`);
      }
    } catch (err) {
      console.error('Erro no upload:', err);
      alert(err?.response?.data?.message || 'Erro ao fazer upload da foto. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0 w-full max-w-full overflow-x-hidden">
      <fieldset disabled={readOnly} className="w-full flex-1 flex flex-col">
      {/* ── Header: Foto + Nome ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-4 sm:px-6 pt-5 pb-4 w-full max-w-full">
        {/* Foto */}
        <div
          ref={photoFieldRef}
          className={`flex flex-col items-center gap-1 shrink-0 rounded-2xl px-3 py-2 transition-all duration-300 ${
            photoHighlighted
              ? photoError
                ? 'bg-red-50/80 ring-4 ring-red-300 shadow-lg shadow-red-100 animate-shake'
                : 'photo-highlight bg-amber-50/80 ring-4 ring-amber-200 shadow-lg shadow-amber-100'
              : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoUpload(e.target.files[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePhotoUpload(e.target.files[0])}
          />
          <div className="relative group cursor-pointer" onClick={() => !readOnly && fileInputRef.current?.click()} title={readOnly ? "Foto do Membro" : "Clique para alterar a foto"}>
            <button
              type="button"
              className="w-20 h-20 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-blue-300 hover:bg-blue-50 transition focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={readOnly}
            >
              {uploading ? (
                <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              ) : preview ? (
                <img src={preview} alt="Foto" className="w-full h-full object-cover rounded-full" />
              ) : (
                <svg className="w-6 h-6 text-slate-300 group-hover:text-blue-400 transition" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.5" />
                  <path strokeLinecap="round" d="M3 20c0-4 3.5-7 9-7s9 3 9 7" />
                </svg>
              )}
            </button>
            {!readOnly && (
              <div className="absolute -bottom-2 -right-2 bg-blue-100 hover:bg-blue-200 text-blue-700 p-1.5 rounded-full shadow-sm transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="mt-1 flex flex-col items-center gap-1">
              <span className={`text-[10px] font-medium uppercase tracking-widest text-center transition-colors ${
                photoError ? 'text-red-600 font-bold' : photoHighlighted ? 'text-amber-700' : 'text-slate-500'
              }`}>
                {photoError ? 'Foto obrigatória' : 'Mudar Foto'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                >
                  Galeria
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  Câmera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nome */}
        <div className="flex-1 w-full min-w-0">
          <label className="block text-xs font-medium text-slate-500 mb-1">Nome completo</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-300"
            placeholder="Nome e sobrenome"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            onBlur={() => handleChange('nome', normalizeNameInput(form.nome))}
            required
          />

          {initialData?.userCredentials && (
            <div className="mt-2.5 p-2.5 bg-stone-50 border border-stone-200 rounded-lg flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <div>
                <span className="text-[11px] text-stone-500 font-medium mr-1.5 uppercase tracking-wider">Usuário:</span>
                <span className="text-sm font-semibold text-stone-700">{initialData.userCredentials.login}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[1fr_minmax(0,1fr)_max-content] gap-4 sm:gap-3 mt-4 w-full items-start">
            <div className="min-w-0">
              <label className={labelClass}>Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map((t) => {
                  const isRestrictedDowngrade = isSelfEdit && 
                    ['membro', 'congregado', 'criança'].includes(initialData?.tipo) && 
                    ['visitante', 'novo decidido'].includes(t);
                  
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isRestrictedDowngrade}
                      onClick={() => handleTipoChange(t)}
                      className={`px-3 py-1 rounded-full text-xs border transition font-medium ${
                        isRestrictedDowngrade 
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400'
                          : form.tipo === t
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                      }`}
                      title={isRestrictedDowngrade ? 'Você não pode rebaixar seu próprio status para visitante.' : null}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Congregação">
              <CustomSelect
                value={lockedCongregacao || form.congregacao}
                onChange={(v) => handleChange('congregacao', v)}
                disabled={Boolean(lockedCongregacao)}
                options={CONGREGACOES.map((c) => ({ value: c, label: c }))}
              />
            </Field>

            <div className="flex flex-col sm:items-end justify-start min-w-0">
              <label className={labelClass}>Status</label>
              <div className="flex items-center gap-3 bg-white border border-slate-200 px-3 py-1.5 rounded-lg h-[44px] sm:h-[32px]">
                <span className={`text-xs font-medium uppercase tracking-wider ${form.status === 'ativo' ? 'text-blue-600' : 'text-slate-400'}`}>
                  {form.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  type="button"
                  role="switch"
                  disabled={readOnly}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-100 ${form.status === 'ativo' ? 'bg-blue-600' : 'bg-slate-300'}`}
                  onClick={() => handleChange('status', form.status === 'ativo' ? 'inativo' : 'ativo')}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.status === 'ativo' ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {form.status === 'inativo' && (
            <div className="mt-3 w-full">
              <Field label="Motivo da inativação">
                <CustomSelect
                  value={form.motivoInativacao}
                  onChange={(v) => handleChange('motivoInativacao', v)}
                  placeholder="Selecione"
                  options={[
                    { value: 'falecimento', label: 'Falecimento' },
                    { value: 'desvio doutrinário', label: 'Desvio doutrinário' },
                    { value: 'mudança de endereço', label: 'Mudança de endereço' },
                    { value: 'desconhecido', label: 'Desconhecido' },
                    { value: 'outro', label: 'Outro' },
                  ]}
                />
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 mx-6" />

      {/* ── Informações Pessoais ────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-3 pb-3 w-full overflow-hidden">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">Informações pessoais</p>
        {isCompactTipo ? (
          <div className="grid grid-cols-1 gap-4 sm:gap-3 mb-4 sm:mb-3 w-full">
            {form.tipo === 'visitante' && (
              <Field label="Data da visita">
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dataVisita}
                  onChange={(e) => handleChange('dataVisita', e.target.value)}
                />
              </Field>
            )}
            {form.tipo === 'novo decidido' && (
              <Field label="Data da decisão">
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dataDecisao}
                  onChange={(e) => handleChange('dataDecisao', e.target.value)}
                />
              </Field>
            )}
            <Field label="Sexo">
              <CustomSelect
                value={form.sexo}
                onChange={(v) => handleChange('sexo', v)}
                options={[
                  { value: 'Masculino', label: 'Masculino' },
                  { value: 'Feminino', label: 'Feminino' },
                ]}
              />
            </Field>
            <Field label="Celular (WhatsApp)">
              <input
                type="tel"
                className={fieldClass}
                placeholder="(00) 00000-0000"
                value={formatPhoneBR(form.celular)}
                onChange={(e) => handleChange('celular', e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-3 mb-4 sm:mb-3 w-full">
              <Field label={<>Nascimento {currentAge !== null && !isNaN(currentAge) ? <span className="text-slate-400 font-normal ml-0.5 lowercase">({currentAge} anos)</span> : null}</>}>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dataNascimento}
                  onChange={(e) => handleChange('dataNascimento', e.target.value)}
                />
              </Field>
              <Field label="Sexo">
                <CustomSelect
                  value={form.sexo}
                  onChange={(v) => handleChange('sexo', v)}
                  options={[
                    { value: 'Masculino', label: 'Masculino' },
                    { value: 'Feminino', label: 'Feminino' },
                  ]}
                />
              </Field>
              <Field label="Estado civil">
                <CustomSelect
                  value={form.estadoCivil}
                  onChange={(v) => handleChange('estadoCivil', v)}
                  options={[
                    { value: 'solteiro(a)', label: 'Solteiro(a)' },
                    { value: 'casado(a)', label: 'Casado(a)' },
                    { value: 'divorciado(a)', label: 'Divorciado(a)' },
                    { value: 'viúvo(a)', label: 'Viúvo(a)' },
                    { value: 'separado(a)', label: 'Separado(a)' },
                    { value: 'união estável', label: 'União estável' },
                  ]}
                />
              </Field>
              <Field label="Grupo">
                <CustomSelect
                  value={form.grupo}
                  onChange={(v) => handleChange('grupo', v)}
                  options={[
                    { value: 'criança', label: 'Criança — 0 a 9 anos' },
                    { value: 'adolescente', label: 'Adolescente — 10 a 17 anos' },
                    { value: 'jovem', label: 'Jovem — 18 a 35 anos' },
                    { value: 'adulto 1', label: 'Adulto 1 — 36 a 50 anos' },
                    { value: 'adulto 2', label: 'Adulto 2 — 51 a 60 anos' },
                    { value: 'idoso', label: 'Idoso — 61 a 75 anos' },
                    { value: 'ancião', label: 'Ancião — acima de 76 anos' },
                  ]}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 mb-4 sm:mb-3 w-full">
              <Field label="Email">
                <input
                  type="email"
                  className={fieldClass}
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </Field>
              <Field label="Celular (WhatsApp)">
                <input
                  type="tel"
                  className={fieldClass}
                  placeholder="(00) 00000-0000"
                  value={formatPhoneBR(form.celular)}
                  onChange={(e) => handleChange('celular', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Endereço">
              <input
                className={fieldClass}
                placeholder="Rua, número, bairro"
                value={form.endereco}
                onChange={(e) => handleChange('endereco', e.target.value)}
              />
            </Field>
          </>
        )}
      </div>

      {!isCompactTipo && (
        <>
          <div className="border-t border-slate-100 mx-6" />

          {/* ── Perfil na Igreja ────────────────────────────────── */}
          <div className="px-4 sm:px-6 pt-3 pb-3 w-full overflow-hidden">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">Perfil na igreja</p>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-3 mb-4 sm:mb-3 w-full">
              <div className="flex-1 w-full sm:min-w-[200px]">
                <Field label="Ministério">
                  <CustomSelect
                    value={form.ministerio}
                    onChange={(v) => handleChange('ministerio', v)}
                    placeholder="— Nenhum —"
                    options={[
                      { value: '', label: '— Nenhum —' },
                      ...Object.entries(MINISTERIOS).map(([grupo, opcoes]) => ({
                        group: grupo,
                        options: opcoes.map((op) => ({ value: op, label: op })),
                      })),
                    ]}
                  />
                </Field>
              </div>

              <div className="shrink-0 flex items-center h-[44px] sm:h-[32px]">
                <label className="flex items-center gap-2 px-3 h-full rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-sm text-slate-600 font-medium transition select-none">
                  <input
                    type="checkbox"
                    className="accent-blue-600 w-3.5 h-3.5"
                    checked={form.batizado}
                    onChange={(e) => handleChange('batizado', e.target.checked)}
                  />
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Batizado?
                </label>
              </div>

              {form.batizado && (
                <div className="flex-1 w-full sm:min-w-[150px]">
                  <Field label="Data do batismo">
                    <input
                      type="date"
                      className={fieldClass}
                      value={form.dataBatismo}
                      onChange={(e) => handleChange('dataBatismo', e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </>
      )}

       </fieldset>
      {/* ── Footer ─────────────────────────────────────────── */}
      {!readOnly && (
        <div className="border-t border-slate-100 px-4 sm:px-6 py-4 bg-slate-50 flex justify-end sticky bottom-0 z-10 mt-auto w-full overflow-hidden">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-3 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-base sm:text-sm font-medium transition min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Enviando dados...
              </>
            ) : 'Salvar'}
          </button>
        </div>
      )}
    </form>
  );
}
