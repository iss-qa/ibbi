// Utilitários de UI: abre uma rota e coleta erros de JS, erros de console e respostas 5xx da API.
const path = require('path');
const { expect } = require('@playwright/test');

const sessao = (perfil) => path.join(__dirname, '../.auth', `${perfil}.json`);

// Ruído conhecido do navegador (recursos 4xx esperados, React Router future flags em dev)
const IGNORAR = [/Failed to load resource/, /React Router Future Flag/, /Download the React DevTools/];

const vigiar = (page) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORAR.some((r) => r.test(m.text()))) erros.push(`console: ${m.text().slice(0, 300)}`); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) erros.push(`api ${r.status()}: ${r.url()}`); });
  return erros;
};

const semErros = (erros, rota) => expect(erros, `erros em ${rota}:\n${erros.join('\n')}`).toEqual([]);

module.exports = { sessao, vigiar, semErros };
