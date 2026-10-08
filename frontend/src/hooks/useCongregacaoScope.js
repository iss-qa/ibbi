import useAuth from './useAuth';
import { CONGREGACOES } from '../constants/congregacoes';

/**
 * Escopo de congregações do usuário logado.
 * - master (e telas públicas): todas as congregações da igreja
 * - admin: as liberadas pelo master (congregacoesPermitidas); com uma só, o filtro fica travado
 */
export default function useCongregacaoScope() {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return { options: CONGREGACOES, locked: '' };
  const permitidas = user.congregacoesPermitidas?.length
    ? user.congregacoesPermitidas
    : (user.congregacao ? [user.congregacao] : []);
  return { options: permitidas, locked: permitidas.length === 1 ? permitidas[0] : '' };
}
