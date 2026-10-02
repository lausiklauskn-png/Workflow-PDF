/* Workfloh PDF — Service Worker.
   Cacht die SCHALE (App-Dateien), niemals Dokumente: die liegen in IndexedDB.
   Wer eine Datei aus SCHALE ändert, erhöht CACHE_VERSION — sonst liefert der
   Worker die alte Fassung weiter. */
const CACHE_VERSION = 'workfloh-pdf-v72';
/* Suche nach Bedeutung: transformers.js (und seine wasm-Dateien) kommt von jsDelivr, in fester
   Fassung. Das bleibt in EIGENEM Vorrat, damit die Suche offline weiterläuft und ein Cache-Bump
   der Schale nicht jedes Mal Megabytes neu holt. Das Modell selbst legt transformers.js in seinem
   eigenen Vorrat ab („transformers-cache"). Beide überstehen ein neues CACHE_VERSION. */
const MODELL_VORRAT = 'workfloh-pdf-modell-v1';
const MODELL_PREFIX = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/';
const BLEIBT = [MODELL_VORRAT, 'transformers-cache'];
const SCHALE = [
  './', './index.html', './impressum.html', './manifest.webmanifest',
  './assets/style.css?v=35', './assets/db.js?v=5', './assets/suche.js?v=2', './assets/bedeutung.js?v=2', './assets/zip.js?v=1', './assets/erkennung.js?v=5', './assets/blatt.js?v=1', './assets/scan-bild.js?v=6', './assets/scanner.js?v=12', './assets/export.js?v=7', './assets/html-export.js?v=2', './assets/uebersetzung.js?v=12', './assets/sprache-texte.js?v=33', './assets/sprache.js?v=1', './assets/sprechen.js?v=3', './assets/schieber.js?v=1', './assets/eingang.js?v=2', './assets/pruefer-formate.js?v=1', './assets/pruefer-mail.js?v=1', './assets/pruefer-anhang.js?v=2', './assets/schluesseltresor.js?v=1', './assets/sicherung.js?v=1', './assets/app.js?v=55',
  './vendor/pdfjs/pdf.min.js', './vendor/pdfjs/pdf.worker.min.js', './vendor/pdf-lib.min.js', './vendor/qrcode.js', './vendor/fontkit.umd.min.js', './vendor/fonts/NotoSans-Regular.ttf',
  './icons/w-floh-160.png', './icons/favicon-32.png?v=1', './icons/favicon-64.png?v=1',
  './icons/icon-192.png?v=1', './icons/icon-512.png?v=1', './icons/icon-512-maskable.png?v=1', './icons/apple-touch-icon.png?v=1'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => Promise.all(SCHALE.map(u => c.add(u).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE_VERSION && !BLEIBT.includes(n)).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method === 'GET' && r.url.startsWith(MODELL_PREFIX)) {                       // Programm fürs Sprachmodell: feste Fassung, Vorrat zuerst
    e.respondWith(caches.open(MODELL_VORRAT).then(c => c.match(r).then(m => m || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;   // KI-Anfragen nie anfassen
  if (new URL(r.url).pathname.includes('/Workfloh-PDF-Page/')) return;             // Erklärvideo der Webseite: nie in den Vorrat (groß, Range-Antworten 206)
  if (r.mode === 'navigate') {                                                      // Seite: Netz zuerst, offline aus dem Vorrat
    e.respondWith(fetch(r).then(res => { const k = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(r, k)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
    if (res.ok) { const k = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(r, k)); }
    return res;
  })));
});
