module.exports = {
  aniversario: (nome) => `🎂 *Feliz Aniversário, ${nome}!*\n\n_"Ensina-nos a contar os nossos dias..."_ (Sl 90:12)\n\nQue o Senhor continue a guiar seus passos! 🙏\n_Igreja Batista Bíblica Israel_`,

  aviso: (nome, texto) => `📢 *Aviso IBBI*\n\nOlá, ${nome}!\n\n${texto}\n\n_Igreja Batista Bíblica Israel_`,

  reuniao: (nome, data, local) => `📅 *Convite para Reunião*\n\nOlá, ${nome}!\n\nVocê está convidado(a) para nossa reunião:\n📆 Data: ${data}\n📍 Local: ${local}\n\nContamos com sua presença! 🙏\n_Igreja Batista Bíblica Israel_`,

  pedidoOracao: (remetente, mensagem, congregacao) => `🙏 *Pedido de Oração*\n\nDe: *${remetente}${congregacao ? ` - ${congregacao}` : ''}*\n\n${mensagem}\n\n_Recebido pelo sistema IBBI_`,

  personalizada: (nome, texto) => `Olá, ${nome}!\n\n${texto}\n\n_Igreja Batista Bíblica Israel_`,
};
