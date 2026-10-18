// Die Kennung (`id`) der App, gerechnet wie Chrome (Klaus 2026-10-18, chrome://webapks am Tablet).
// Chrome löst `id` gegen den URSPRUNG der start_url auf, nicht gegen den App-Ordner. Alle Apps
// liegen auf https://lausiklauskn-png.github.io/<Repo>/ — `"id": "./"` wird damit für JEDE App zu
// https://lausiklauskn-png.github.io/, und Chrome hält verschiedene Apps für EINE: „Diese App wurde
// bereits installiert", danach „App konnte nicht geöffnet werden". Zehn installierte Apps trugen
// genau diese Kennung, Workfloh PDF darunter.
import fs from 'node:fs';
const BASIS = 'https://lausiklauskn-png.github.io/Workflow-PDF/';   // Repo-Name wie im github.io-Pfad
const MANIFESTE = ['manifest.webmanifest'];
let gruen = 0, rot = 0;
const ok = (name, b, mehr) => { if (b) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (mehr !== undefined ? '  → ' + mehr : '')); } };

// so rechnet Chrome (W3C Manifest: id gegen den Ursprung der start_url)
function kennung(m, manifestUrl) {
  const start = new URL(m.start_url || '.', manifestUrl);
  return new URL(m.id !== undefined ? m.id : start.href, start.origin).href;
}
function bereich(m, manifestUrl) { return new URL(m.scope || '.', new URL(m.start_url || '.', manifestUrl)).href; }

// die Rechnung selbst, an festen Fällen — ohne sie wäre ein falscher Nachbau still grün
const mu = BASIS + 'manifest.webmanifest';
ok('Rechnung: "./" wird zur Wurzel des Ursprungs (der Befund)', kennung({ id: './', start_url: './' }, mu) === 'https://lausiklauskn-png.github.io/');
ok('Rechnung: "/Workflow-PDF/" bleibt im App-Ordner', kennung({ id: '/Workflow-PDF/', start_url: './' }, mu) === BASIS);
ok('Rechnung: ohne id gilt die start_url', kennung({ start_url: './' }, mu) === BASIS);
ok('Rechnung: der Bereich "./" ist der App-Ordner', bereich({ scope: './', start_url: './' }, mu) === BASIS);

for (const datei of MANIFESTE) {
  const m = JSON.parse(fs.readFileSync(datei, 'utf8'));
  const url = BASIS + datei;
  const id = kennung(m, url), sc = bereich(m, url);
  ok(datei + ': trägt eine eigene id', typeof m.id === 'string' && m.id.length > 0, m.id);
  ok(datei + ': die id liegt im Bereich der App, nicht an der Wurzel von github.io', id.startsWith(sc) && id !== 'https://lausiklauskn-png.github.io/', id + ' gegen ' + sc);
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
