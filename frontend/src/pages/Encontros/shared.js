export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const ATIVIDADES = [
  ['culto', 'Culto'], ['ensaio', 'Ensaio'], ['reuniao', 'Reunião'], ['estudo', 'Estudo bíblico'], ['oracao', 'Oração'],
  ['evangelismo', 'Evangelismo'], ['visita', 'Visita'], ['confraternizacao', 'Confraternização'], ['outro', 'Outro'],
];
export const atividadeLabel = (v) => (v === 'aula_ebd' ? 'Aula da EBD' : ATIVIDADES.find(([k]) => k === v)?.[1] || 'Encontro');

// Modelos prontos: preenchem nome e critérios de membros.
export const TIPOS = [
  { id: 'uniao_feminina', label: 'União Feminina', criterios: { sexo: 'Feminino', idadeMin: 18 } },
  { id: 'uniao_masculina', label: 'União Masculina', criterios: { sexo: 'Masculino', idadeMin: 18 } },
  { id: 'uniao_jovens', label: 'União de Jovens', criterios: { idadeMin: 18, idadeMax: 35 }, ebdClasses: ['Jovens'] },
  { id: 'uniao_adolescentes', label: 'União de Adolescentes', criterios: { idadeMin: 12, idadeMax: 17 }, ebdClasses: ['Adolescentes'] },
  { id: 'uniao_criancas', label: 'União de Crianças', criterios: { idadeMax: 11 }, ebdClasses: ['Crianças'] },
  { id: 'louvor', label: 'Ministério de Louvor', criterios: {} },
  { id: 'celula', label: 'Célula / Pequeno grupo', criterios: {} },
  { id: 'outro', label: 'Outro', criterios: {} },
];

export const EBD_CLASSES = ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'];

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
