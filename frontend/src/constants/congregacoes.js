// Lista de congregações da igreja logada. O array é preenchido em tempo de execução
// pelo TenantContext (Tenant.congregacoes) — mutado no lugar para que os componentes
// que importam CONGREGACOES continuem funcionando sem alteração.
// Valores iniciais: lista histórica da IBBI (tenant fundador).
export const CONGREGACOES = [
  'Sede',
  'São Cristóvão',
  'Vida Nova',
  'PQ São Paulo 1',
  'PQ São Paulo 2',
  'Capelão',
  'Bairro da Paz',
  'Dona Lindu',
  'Portão',
  'Olindina-BA',
  'Crisópolis-BA',
  'São Felipe-BA',
  'São Sebastião do Passé - BA',
];

export const setCongregacoes = (lista) => {
  if (!Array.isArray(lista) || !lista.length) return;
  CONGREGACOES.splice(0, CONGREGACOES.length, ...lista);
};
