import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/landing/Logo';

// Termos de Uso e Política de Privacidade do PastorIA (versão em backend/src/config/legal.js).
// Ao alterar o texto de forma relevante, atualize VERSAO aqui e TERMOS_VERSAO no backend:
// as igrejas aceitam de novo no primeiro acesso.
export const VERSAO = '2026-10-08';
const VIGENCIA = '8 de outubro de 2026';
const CONTATO = import.meta.env.VITE_CONTACT_EMAIL || 'privacidade@pastoria.com.br';

const Secao = ({ n, titulo, children }) => (
  <section className="mt-8">
    <h2 className="font-display text-xl text-brandNavy">{n}. {titulo}</h2>
    <div className="mt-2 space-y-3 text-slate-700 leading-relaxed">{children}</div>
  </section>
);

function Pagina({ titulo, children }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${titulo} | PastorIA`;
    window.scrollTo(0, 0);
    return () => { document.title = prev; };
  }, [titulo]);
  return (
    <div className="min-h-screen bg-brandCream">
      <header className="bg-brandNavy">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" aria-label="PastorIA — início"><Logo light /></Link>
          <nav className="flex gap-4 text-sm text-white/80">
            <Link to="/termos" className="hover:text-white">Termos</Link>
            <Link to="/privacidade" className="hover:text-white">Privacidade</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">PastorIA</p>
        <h1 className="font-display text-3xl sm:text-4xl text-brandNavy mt-2">{titulo}</h1>
        <p className="text-sm text-slate-500 mt-2">Versão {VERSAO} · vigente a partir de {VIGENCIA}</p>
        <article className="mt-6 bg-white rounded-2xl border border-stone-100 p-6 sm:p-10">{children}</article>
        <p className="mt-6 text-center text-sm text-slate-500"><Link to="/" className="hover:text-brandNavy">← Voltar para a página inicial</Link></p>
      </main>
    </div>
  );
}

export function Termos() {
  return (
    <Pagina titulo="Termos de Uso">
      <p className="text-slate-700 leading-relaxed">
        Estes Termos regem o uso da plataforma <strong>PastorIA</strong> (o "Serviço") pela igreja ou organização religiosa
        que se cadastra (a "Igreja") e por seus usuários (pastores, líderes, secretaria e membros com acesso). Ao criar a
        conta ou usar o Serviço, a Igreja declara ter lido e aceito estes Termos e a <Link to="/privacidade" className="text-brandBlue underline">Política de Privacidade</Link>.
      </p>
      <Secao n={1} titulo="O que é o Serviço">
        <p>O PastorIA é um software de gestão de pessoas e cuidado pastoral: cadastro de membros e visitantes, frequência (EBD, encontros e cultos), aniversários, jornada de acolhimento, escalas, pedidos de oração, relatórios e um assistente de inteligência artificial que conversa com a liderança pelo WhatsApp.</p>
      </Secao>
      <Secao n={2} titulo="Conta, acesso e responsabilidades da Igreja">
        <p>A Igreja é responsável por manter os dados de acesso em sigilo, definir quem tem acesso (papéis master, administrador e membro) e pela veracidade das informações cadastradas.</p>
        <p>A Igreja é a <strong>controladora</strong> dos dados das pessoas que cadastra e deve ter base legal para tratá-los, incluindo, quando necessário, o consentimento das pessoas para receber mensagens, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      </Secao>
      <Secao n={3} titulo="Uso do WhatsApp e mensagens">
        <p>As mensagens são enviadas pelo número de WhatsApp da própria Igreja, conectado ao Serviço. A Igreja se compromete a:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>enviar mensagens apenas a pessoas que têm relação com a igreja e esperam esse contato;</li>
          <li>não usar o Serviço para spam, propaganda político-partidária, venda de listas ou conteúdo ilícito, ofensivo ou discriminatório;</li>
          <li>respeitar as políticas do WhatsApp e da Meta.</li>
        </ul>
        <p><strong>Descadastro:</strong> quem responder <strong>SAIR</strong> deixa de receber qualquer mensagem do Serviço até enviar <strong>VOLTAR</strong>. A Igreja não deve contornar esse bloqueio, e só deve reativar um número quando a própria pessoa pedir.</p>
        <p>O Serviço aplica intervalos e limites de envio para reduzir o risco de bloqueio, mas o número pertence à Igreja, e restrições aplicadas pelo WhatsApp não são de responsabilidade do PastorIA.</p>
      </Secao>
      <Secao n={4} titulo="Inteligência artificial">
        <p>O assistente usa modelos de IA de terceiros para entender mensagens, transcrever áudios, ler fotos de fichas e escrever textos. As respostas podem conter erros: decisões pastorais e envios a membros dependem de aprovação da liderança, e a Igreja deve revisar o que for enviado em seu nome.</p>
      </Secao>
      <Secao n={5} titulo="Planos, teste grátis e pagamento">
        <p>Os planos, limites e preços estão na página de planos. O teste grátis dura 14 dias, sem cartão. Após o teste, o uso continua mediante assinatura. Faturas vencidas podem levar à suspensão do acesso após o prazo informado na cobrança; os dados não são apagados pela suspensão.</p>
        <p>A Igreja pode cancelar a qualquer momento, sem multa. O cancelamento vale ao fim do período já pago.</p>
      </Secao>
      <Secao n={6} titulo="Disponibilidade e suporte">
        <p>Trabalhamos para manter o Serviço disponível, mas pode haver interrupções para manutenção ou por falhas de terceiros (provedores de nuvem, WhatsApp, IA). O suporte é prestado pelos canais informados no Serviço.</p>
      </Secao>
      <Secao n={7} titulo="Propriedade e dados da Igreja">
        <p>O software, a marca e os materiais do PastorIA pertencem aos seus titulares. Os dados cadastrados pela Igreja pertencem à Igreja, que pode exportá-los a qualquer momento (por exemplo, a planilha de pessoas).</p>
      </Secao>
      <Secao n={8} titulo="Encerramento">
        <p>Após o cancelamento, os dados ficam disponíveis para exportação por 30 dias e depois são excluídos ou anonimizados, salvo obrigação legal de guarda.</p>
        <p>Podemos suspender contas que violem estes Termos, em especial por envio abusivo de mensagens.</p>
      </Secao>
      <Secao n={9} titulo="Responsabilidade">
        <p>O Serviço é uma ferramenta de apoio. Não substitui o acompanhamento pastoral, aconselhamento profissional ou serviços de emergência. Em situação de risco à vida, ligue 188 (CVV) ou 192 (SAMU).</p>
      </Secao>
      <Secao n={10} titulo="Alterações e foro">
        <p>Podemos atualizar estes Termos; mudanças relevantes serão avisadas no Serviço e exigirão novo aceite. Fica eleito o foro do domicílio da Igreja, nos termos da lei.</p>
        <p>Contato: <a href={`mailto:${CONTATO}`} className="text-brandBlue underline">{CONTATO}</a>.</p>
      </Secao>
    </Pagina>
  );
}

export function Privacidade() {
  return (
    <Pagina titulo="Política de Privacidade">
      <p className="text-slate-700 leading-relaxed">
        Esta Política explica como os dados pessoais são tratados no <strong>PastorIA</strong>, em conformidade com a
        Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>
      <Secao n={1} titulo="Quem é responsável pelos dados">
        <p>Os dados de membros, visitantes e demais pessoas cadastradas pertencem à <strong>Igreja</strong>, que é a <strong>controladora</strong>: ela decide quem cadastrar e para quê. O <strong>PastorIA</strong> atua como <strong>operador</strong>: trata esses dados apenas para prestar o Serviço, conforme as instruções da Igreja.</p>
        <p>Para os dados de cadastro da própria Igreja e dos seus usuários (nome, email, telefone, pagamento), o PastorIA é controlador.</p>
      </Secao>
      <Secao n={2} titulo="Quais dados tratamos">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Cadastro:</strong> nome, sexo, data de nascimento, celular, email, endereço, estado civil, foto, congregação, ministério.</li>
          <li><strong>Vida na igreja:</strong> tipo (membro, visitante…), batismo, frequência em aulas, encontros e cultos, escalas de serviço, grupos.</li>
          <li><strong>Cuidado pastoral:</strong> alertas de ausência, ações de cuidado (ligação, visita, oração), motivos informados pela pessoa e pedidos de oração.</li>
          <li><strong>Conversas no WhatsApp</strong> com o número da Igreja (texto, áudio transcrito, imagens enviadas).</li>
          <li><strong>Dados técnicos:</strong> registros de acesso, IP e uso do Serviço.</li>
        </ul>
        <p><strong>Dados sensíveis:</strong> a participação em uma igreja revela convicção religiosa, e pedidos de oração podem conter informações de saúde ou da vida íntima. Esses dados recebem proteção reforçada, acesso restrito à liderança e não são usados para nenhuma outra finalidade.</p>
      </Secao>
      <Secao n={3} titulo="Para que usamos">
        <p>Para os serviços que a Igreja contratou: organizar o cadastro, registrar frequência, enviar mensagens de aniversário, acolhimento, avisos e cuidado, gerar relatórios, responder à liderança pelo assistente e emitir cobranças. Não vendemos dados, não fazemos publicidade com eles e não os usamos para treinar modelos de IA.</p>
      </Secao>
      <Secao n={4} titulo="Com quem compartilhamos">
        <p>Somente com fornecedores necessários ao funcionamento, sob obrigação de confidencialidade:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>hospedagem e banco de dados em nuvem;</li>
          <li>WhatsApp (Meta) e o provedor de conexão do número da Igreja;</li>
          <li>provedores de inteligência artificial (Google e/ou Anthropic) para processar as mensagens enviadas ao assistente;</li>
          <li>envio de emails e gateway de pagamento.</li>
        </ul>
        <p>Alguns desses fornecedores podem processar dados fora do Brasil, com as salvaguardas previstas na LGPD.</p>
      </Secao>
      <Secao n={5} titulo="Por quanto tempo guardamos">
        <p>Enquanto a Igreja usar o Serviço. Após o cancelamento, os dados ficam disponíveis para exportação por 30 dias e depois são excluídos ou anonimizados, salvo obrigação legal de guarda. Conversas antigas do assistente podem ser apagadas antes, para minimizar dados.</p>
      </Secao>
      <Secao n={6} titulo="Direitos de quem é cadastrado">
        <p>Toda pessoa cadastrada pode pedir à sua igreja: confirmação e acesso aos dados, correção, anonimização ou exclusão, portabilidade, informação sobre compartilhamento e revogação do consentimento.</p>
        <p><strong>Para parar de receber mensagens no WhatsApp, basta responder SAIR.</strong> O bloqueio é imediato e vale até a pessoa enviar VOLTAR.</p>
        <p>Pedidos sobre os dados devem ser feitos à igreja; se preferir, escreva para <a href={`mailto:${CONTATO}`} className="text-brandBlue underline">{CONTATO}</a> e encaminharemos.</p>
      </Secao>
      <Secao n={7} titulo="Segurança">
        <p>Isolamento dos dados de cada igreja, acesso por papel (master, administrador, membro), senhas com hash, credenciais do WhatsApp criptografadas, conexões HTTPS e registros de acesso. Em caso de incidente de segurança relevante, a Igreja e as autoridades serão comunicadas nos termos da lei.</p>
      </Secao>
      <Secao n={8} titulo="Crianças e adolescentes">
        <p>O cadastro de menores deve ser feito pela Igreja com o consentimento de um dos pais ou responsável, no melhor interesse da criança e do adolescente.</p>
      </Secao>
      <Secao n={9} titulo="Alterações e contato">
        <p>Esta Política pode ser atualizada; a versão vigente fica sempre nesta página. Encarregado de dados (DPO): <a href={`mailto:${CONTATO}`} className="text-brandBlue underline">{CONTATO}</a>.</p>
      </Secao>
    </Pagina>
  );
}
