// Echte Service-Worker-Aktivierung auf einem mit anderen Apps geteilten Ursprung.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright-core';
const root = resolve(new URL('..', import.meta.url).pathname);
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/probe.html') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Vorratsprobe</title>'); return; }
  const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({executablePath:process.env.CB_CHROMIUM, args:['--no-sandbox']});
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/probe.html`);
  const retained = ['private-brain-v89', 'sage-protokol-v12', 'workfloh-pdf-modell-v1', 'transformers-cache', 'workfloh-pdf-geteilt'];
  await page.evaluate(async names => {
    for (const name of [...names, 'workfloh-pdf-v1', 'workfloh-pdf-v104']) {
      await (await caches.open(name)).put('./nachweis', new Response('Originalbytes:' + name));
    }
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, {once:true}));
  }, retained);
  const result = await page.evaluate(async names => {
    const keys = await caches.keys(), bytes = {};
    for (const name of names) bytes[name] = await (await (await caches.open(name)).match('./nachweis'))?.text();
    return {keys, bytes};
  }, retained);
  for (const name of retained) {
    assert.ok(result.keys.includes(name), 'Vorrat muss erhalten bleiben: ' + name);
    assert.equal(result.bytes[name], 'Originalbytes:' + name, 'Inhalt muss bytegleich erhalten bleiben: ' + name);
  }
  assert.ok(!result.keys.includes('workfloh-pdf-v1') && !result.keys.includes('workfloh-pdf-v104'), 'Eigene alte App-Schalen werden entfernt');
  assert.ok(result.keys.some(k => /^workfloh-pdf-v\d+$/.test(k)), 'Aktuelle App-Schale existiert');
  console.log('6 Vorratsprüfungen bestanden: fremde Apps, Modelle und Dateieingang erhalten; eigene alte Schalen entfernt.');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
