const Person = require('../models/Person.model');
const { applyScopedCongregacaoFilter } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');

const exportCsv = async (req, res) => {
  const { search, tipo, grupo, congregacao, status } = req.query;
  const filter = {};
  if (tipo) filter.tipo = tipo;
  if (grupo) filter.grupo = grupo;
  if (status) filter.status = status;
  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { nome: new RegExp(safe, 'i') },
      { tipo: new RegExp(safe, 'i') },
      { grupo: new RegExp(safe, 'i') },
    ];
  }

  const scopedFilter = await applyScopedCongregacaoFilter(req.user, filter, congregacao);

  const persons = await Person.find(scopedFilter).sort({ nome: 1 });

  const header = [
    'nome',
    'sexo',
    'dataNascimento',
    'email',
    'celular',
    'tipo',
    'grupo',
    'estadoCivil',
    'batizado',
    'dataBatismo',
    'congregacao',
    'status',
    'motivoInativacao',
    'endereco',
    'ministerio',
  ];

  const rows = persons.map((p) => [
    p.nome || '',
    p.sexo || '',
    p.dataNascimento ? p.dataNascimento.toISOString().slice(0, 10) : '',
    p.email || '',
    p.celular || '',
    p.tipo || '',
    p.grupo || '',
    p.estadoCivil || '',
    p.batizado ? 'true' : 'false',
    p.dataBatismo ? p.dataBatismo.toISOString().slice(0, 10) : '',
    p.congregacao || '',
    p.status || '',
    p.motivoInativacao || '',
    p.endereco || '',
    p.ministerio || '',
  ]);

  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [header.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="membros.csv"');
  res.send(csv);
};

module.exports = { exportCsv };
