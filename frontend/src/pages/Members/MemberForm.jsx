import { useRef, useState } from 'react';
import { CONGREGACOES } from '../../constants/congregacoes';
import { formatPhoneBR } from '../../utils/phoneMask';
import api from '../../services/api';

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

const fieldClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2.5 sm:py-1.5 text-lg sm:text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-300 min-h-[44px] sm:min-h-[32px] sm:h-8';

const labelClass = 'block text-xs font-medium text-slate-500 mb-1';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

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

export default function MemberForm({ initialData, onSubmit, onCancel, lockedCongregacao }) {
  const [form, setForm] = useState({
    ...initialState,
    ...initialData,
    congregacao: lockedCongregacao || initialData?.congregacao || initialState.congregacao,
  });
  const [uploading, setUploading] = useState(false);
  const isCompactTipo = form.tipo === 'visitante' || form.tipo === 'novo decidido';
  
  // Inicializa o preview tratando URLs relativas
  const getInitialPreview = () => {
    if (!initialData?.fotoUrl) return '';
    if (initialData.fotoUrl.startsWith('/uploads')) {
      const baseUrl = api.defaults.baseURL.replace('/api', '');
      return `${baseUrl}${initialData.fotoUrl}`;
    }
    return initialData.fotoUrl;
  };
  
  const [preview, setPreview] = useState(getInitialPreview());
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, congregacao: lockedCongregacao || form.congregacao });
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
      const response = await api.post('/uploads/person-photo', data);
      
      if (response.data.url) {
        // Salva a URL relativa (ex: /uploads/123.jpg) no estado do formulário
        const relativeUrl = response.data.url;
        handleChange('fotoUrl', relativeUrl);
        
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

      {/* ── Header: Foto + Nome ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-4 sm:px-6 pt-5 pb-4 w-full max-w-full overflow-x-hidden">
        {/* Foto */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoUpload(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-blue-300 hover:bg-blue-50 transition group focus:outline-none focus:ring-2 focus:ring-blue-200"
            title="Clique para enviar foto"
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
          <span className="text-[10px] text-slate-400 font-medium">Foto</span>
        </div>

        {/* Nome */}
        <div className="flex-1 w-full min-w-0">
          <label className="block text-xs font-medium text-slate-500 mb-1">Nome completo</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-300"
            placeholder="Nome e sobrenome"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 mt-4 w-full">
            <div className="min-w-0">
              <label className={labelClass}>Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTipoChange(t)}
                    className={`px-3 py-1 rounded-full text-xs border transition font-medium ${form.tipo === t
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Congregação">
              <select className={fieldClass} value={lockedCongregacao || form.congregacao} onChange={(e) => handleChange('congregacao', e.target.value)} disabled={Boolean(lockedCongregacao)}>
                {CONGREGACOES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 mx-6" />

      {/* ── Informações Pessoais ────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-3 pb-3 w-full max-w-full overflow-x-hidden">
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
              <select className={fieldClass} value={form.sexo} onChange={(e) => handleChange('sexo', e.target.value)}>
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
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
              <Field label="Nascimento">
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dataNascimento}
                  onChange={(e) => handleChange('dataNascimento', e.target.value)}
                />
              </Field>
              <Field label="Sexo">
                <select className={fieldClass} value={form.sexo} onChange={(e) => handleChange('sexo', e.target.value)}>
                  <option value="">—</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </Field>
              <Field label="Estado civil">
                <select className={fieldClass} value={form.estadoCivil} onChange={(e) => handleChange('estadoCivil', e.target.value)}>
                  <option value="">—</option>
                  <option value="solteiro(a)">solteiro(a)</option>
                  <option value="casado(a)">casado(a)</option>
                  <option value="divorciado(a)">divorciado(a)</option>
                  <option value="viúvo(a)">viúvo(a)</option>
                  <option value="separado(a)">separado(a)</option>
                  <option value="união estável">união estável</option>
                </select>
              </Field>
              <Field label="Grupo">
                <select className={fieldClass} value={form.grupo} onChange={(e) => handleChange('grupo', e.target.value)}>
                  <option value="">—</option>
                  <option value="criança">criança</option>
                  <option value="adolescente">adolescente</option>
                  <option value="jovem">jovem</option>
                  <option value="adulto 1">adulto 1</option>
                  <option value="adulto 2">adulto 2</option>
                  <option value="idoso">idoso</option>
                  <option value="ancião">ancião</option>
                </select>
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
          <div className="px-4 sm:px-6 pt-3 pb-3 w-full max-w-full overflow-x-hidden">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">Perfil na igreja</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 mb-4 sm:mb-3 w-full">
          <Field label="Ministério">
            <input
              className={fieldClass}
              placeholder="Ex: louvor, jovens..."
              value={form.ministerio}
              onChange={(e) => handleChange('ministerio', e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select className={fieldClass} value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="ativo">ativo</option>
              <option value="inativo">inativo</option>
            </select>
          </Field>
            </div>

            {form.status === 'inativo' && (
              <div className="mb-3">
                <Field label="Motivo da inativação">
                  <select
                    className={fieldClass}
                    value={form.motivoInativacao}
                    onChange={(e) => handleChange('motivoInativacao', e.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="falecimento">falecimento</option>
                    <option value="desvio doutrinário">desvio doutrinário</option>
                    <option value="mudança de endereço">mudança de endereço</option>
                    <option value="desconhecido">desconhecido</option>
                    <option value="outro">outro</option>
                  </select>
                </Field>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-sm text-slate-600 font-medium transition select-none">
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
              {form.batizado && (
                <div className="flex items-center gap-2">
                  <label className={labelClass + ' mb-0'}>Data do batismo</label>
                  <input
                    type="date"
                    className={fieldClass + ' w-auto'}
                    value={form.dataBatismo}
                    onChange={(e) => handleChange('dataBatismo', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-4 sm:px-6 py-4 bg-slate-50 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10 mt-auto w-full max-w-full overflow-x-hidden">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 sm:py-2 rounded-lg border border-slate-200 text-base sm:text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 transition min-h-[44px] w-full sm:w-auto"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="px-5 py-3 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base sm:text-sm font-medium transition min-h-[44px] w-full sm:w-auto"
        >
          Salvar membro
        </button>
      </div>
    </form>
  );
}
