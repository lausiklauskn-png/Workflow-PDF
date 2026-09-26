/* Workfloh PDF — Service Worker.
   Cacht die SCHALE (App-Dateien), niemals Dokumente: die liegen in IndexedDB.
   Wer eine Datei aus SCHALE ändert, erhöht CACHE_VERSION — sonst liefert der
   Worker die alte Fassung weiter. */
const CACHE_VERSION = 'workfloh-pdf-v26';
const SCHALE = [
  './', './index.html', './impressum.html', './manifest.webmanifest',
  './assets/style.css?v=8', './assets/db.js?v=2', './assets/erkennung.js?v=4', './assets/blatt.js?v=1', './assets/export.js?v=7', './assets/html-export.js?v=2', './assets/uebersetzung.js?v=9', './assets/app.js?v=25',
  './vendor/pdfjs/pdf.min.js', './vendor/pdfjs/pdf.worker.min.js', './vendor/pdf-lib.min.js', './vendor/qrcode.js', './vendor/fontkit.umd.min.js', './vendor/fonts/NotoSans-Regular.ttf',
  './icons/w-floh-160.png', './icons/favicon-32.png?v=1', './icons/favicon-64.png?v=1',
  './icons/icon-192.png?v=1', './icons/icon-512.png?v=1', './icons/icon-512-maskable.png?v=1', './icons/apple-touch-icon.png?v=1'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => Promise.all(SCHALE.map(u => c.add(u).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;   // KI-Anfragen nie anfassen
  if (r.mode === 'navigate') {                                                      // Seite: Netz zuerst, offline aus dem Vorrat
    e.respondWith(fetch(r).then(res => { const k = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(r, k)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
    if (res.ok) { const k = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(r, k)); }
    return res;
  })));
});
