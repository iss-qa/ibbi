// Template de email de Feliz Aniversário — identidade visual da IBBI
// (azul marinho + dourado, igual ao cartão). A imagem do cartão é embutida
// via CID (cid:cartao-aniversario), anexada pelo remetente.

const CID_CARTAO = 'cartao-aniversario';

const birthdayEmailSubject = (nome) => `🎂 Feliz Aniversário, ${nome.split(' ')[0]}!`;

const birthdayEmailHtml = (person) => {
  const primeiroNome = (person.nome || '').split(' ')[0] || 'Membro';

  return `
  <div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="background:linear-gradient(155deg,#0a1f44 0%,#112b5e 55%,#0e2450 100%);border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(8,22,49,0.18);">

        <!-- Cabeçalho -->
        <div style="padding:28px 32px 8px;text-align:center;">
          <div style="display:inline-block;padding:8px 22px;border:1px solid rgba(212,175,55,0.5);border-radius:999px;color:#d4af37;font-size:13px;letter-spacing:0.22em;text-transform:uppercase;font-weight:bold;">
            IBBI
          </div>
        </div>

        <!-- Cartão (imagem embutida) -->
        <div style="padding:20px 24px 0;text-align:center;">
          <img src="cid:${CID_CARTAO}" alt="Cartão de Aniversário de ${primeiroNome}" width="520" style="width:100%;max-width:520px;height:auto;border-radius:16px;display:block;margin:0 auto;" />
        </div>

        <!-- Mensagem -->
        <div style="padding:28px 36px 8px;text-align:center;">
          <p style="margin:0 0 6px;color:#d4af37;font-size:14px;letter-spacing:0.18em;text-transform:uppercase;font-weight:bold;">✦ Parabéns ✦</p>
          <h1 style="margin:0 0 18px;color:#ffffff;font-size:34px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;">${primeiroNome}</h1>
          <p style="margin:0 auto;max-width:440px;color:#cdd8ef;font-size:16px;line-height:1.7;font-style:italic;">
            Feliz aniversário! Que o Senhor continue guiando seus passos com graça,
            paz e alegria em cada novo dia. 🙏
          </p>
        </div>

        <!-- Versículo -->
        <div style="padding:18px 36px 28px;text-align:center;">
          <div style="display:inline-block;padding:14px 26px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;">
            <p style="margin:0;color:#d4af37;font-size:14px;font-weight:bold;">
              📖 "Este é o dia que o Senhor fez; nele nos alegraremos e exultaremos."
            </p>
            <p style="margin:6px 0 0;color:#9fb0d4;font-size:13px;">Salmos 118:24</p>
          </div>
        </div>

        <!-- Rodapé -->
        <div style="padding:18px 24px 26px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
          <p style="margin:0;color:#9fb0d4;font-size:13px;font-style:italic;">Com carinho,</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:15px;font-weight:bold;">Igreja Batista Bíblica Israel</p>
        </div>
      </div>

      <p style="text-align:center;color:#94a3b8;font-size:11px;margin:18px 0 0;">
        Mensagem enviada automaticamente pelo sistema IBBI.
      </p>
    </div>
  </div>`;
};

const birthdayEmailText = (person) => {
  const primeiroNome = (person.nome || '').split(' ')[0] || 'Membro';
  return (
    `Feliz Aniversário, ${primeiroNome}!\n\n` +
    `Que o Senhor continue guiando seus passos com graça, paz e alegria em cada novo dia.\n\n` +
    `"Este é o dia que o Senhor fez; nele nos alegraremos e exultaremos." (Salmos 118:24)\n\n` +
    `Com carinho,\nIgreja Batista Bíblica Israel`
  );
};

module.exports = { birthdayEmailSubject, birthdayEmailHtml, birthdayEmailText, CID_CARTAO };
