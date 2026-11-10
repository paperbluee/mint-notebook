const base = new URL(self.registration.scope);
const prefix = 'mint-notebook-pages:' + base.pathname + ':';
// Bump the cache version when the notebook's offline files change.
const cacheName = prefix + '1';
const files = [
  './', 'style.css', 'app.js', 'words.js', 'cet4.js', 'mint.svg',
  'pwa.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'ecdict-license.txt'
].map(path => new URL(path, base).href);
const assets = new Set(files);
const indexPage = new URL('index.html', base).href;

async function prepareCache() {
  const cache = await caches.open(cacheName);
  const hits = await Promise.all(files.map(path => cache.match(path)));
  if (!hits.every(Boolean)) {
    await cache.addAll(files.map(path => new Request(path, {cache:'reload', redirect:'error'})));
  }
}

self.addEventListener('install', event => {
  event.waitUntil(prepareCache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  url.search = '';
  url.hash = '';
  const key = url.href === indexPage ? base.href : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(key)) ?? fetch(request);
  })());
});

self.addEventListener('message', event => {
  const port = event.ports[0];
  if (event.data !== 'mint:prepare-offline' || !port) return;
  event.waitUntil(prepareCache().then(
    () => port.postMessage(true),
    () => port.postMessage(false)
  ));
});
