/* PastorIA — service worker (PWA dos líderes).
 * - Nunca guarda /api (dados sempre frescos; nada de uma sessão aparece em outra).
 * - Navegação: rede primeiro; sem internet, mostra a página offline.
 * - Arquivos estáticos com hash (/assets/*) e ícones: cache primeiro.
 * Ao publicar uma versão nova, troque VERSAO para limpar o cache antigo.
 */
const VERSAO = 'pastoria-v1';
const OFFLINE = '/offline.html';
const PRECACHE = [OFFLINE, '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSAO).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VERSAO).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
  }
});
