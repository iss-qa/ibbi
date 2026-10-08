// Datas "de calendário" no fuso da igreja, independentes do fuso do servidor.
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const zonedParts = (timeZone = 'America/Bahia', date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
    isoDate,
    hhmm: `${parts.hour}:${parts.minute}`,
  };
};

const addDaysIso = (isoDate, days) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Domingo mais recente (hoje, se for domingo) no fuso informado.
const lastSundayIso = (timeZone) => {
  const now = zonedParts(timeZone);
  return addDaysIso(now.isoDate, -now.weekday);
};

// Mesma convenção do ebd.controller (ensureSunday): meio-dia do horário do servidor.
const aulaDateFromIso = (isoDate) => new Date(`${isoDate}T12:00:00`);

// Intervalo que cobre o dia inteiro (tolerante a aulas gravadas em horários diferentes).
const dayRangeFromIso = (isoDate) => {
  const start = new Date(`${isoDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { $gte: start, $lt: end };
};

const isoWeekKey = (isoDate) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const formatBr = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const isoToBr = (isoDate) => isoDate.split('-').reverse().join('/');

module.exports = {
  zonedParts,
  addDaysIso,
  lastSundayIso,
  aulaDateFromIso,
  dayRangeFromIso,
  isoWeekKey,
  formatBr,
  isoToBr,
};
