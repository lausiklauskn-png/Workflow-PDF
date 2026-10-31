/* Workfloh PDF — Briefkopf lesen (Pro-Umbau 14, Sitzung D, Klaus 2026-10-31).
   „Briefdatum, Absender, Empfänger, Kundennummer … danach sortieren“ · Nachtrag: „ein Thema vorschlagen“.

   Reine Rechnung: keine Oberfläche, kein Speicher, kein Netz. Quelle dieses Bausteins ist Workflow-PDF;
   Workflow PDF Pro, die WorkFlohs, BookLedgerPro, Private Brain Pro und die Familienakte kopieren ihn byte-1:1.

   Eingabe: die Zeilen eines Briefs (Textebene oder Texterkennung, Seite 1 zuerst; die letzte Seite für die
   Fußzeile darf dahinter stehen) und/oder ein Mailkopf { von, an, datum, betreff }.
   Ausgabe: { datum, absender, empfaenger, nummern[], betreff, wichtigkeit, thema } — jede Angabe mit Fundstelle
   ({ wert, fund, zeile }). Unsicher heißt leer (null), nie geraten. Von Hand geändert wird in der App
   (Feld { hand: true }); lesen() überschreibt nie, was dort steht — das entscheidet die App.

   Grenzen (benannt): Handschrift und schräge Scans liefern keine Zeilen · ein Brief ohne Kopf liefert nur, was
   beschriftet ist („Datum:“, „Kundennummer:“) · zwei verschiedene unbeschriftete Daten im Kopf → kein Datum ·
   Absender ohne Rücksendezeile, ohne Rechtsform und ohne Behördenwort wird nicht erkannt. */
(function () {
  'use strict';

  const MONATE = { januar: 1, jan: 1, jänner: 1, februar: 2, feb: 2, märz: 3, maerz: 3, mär: 3, mrz: 3, april: 4, apr: 4, mai: 5,
    juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11,
    dezember: 12, dez: 12 };
  const KOPF_ZEILEN = 40;

  const sauber = s => String(s == null ? '' : s).replace(/­/g, '').replace(/[ \t ]+/g, ' ').trim();
  const falte = s => sauber(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  const iso = (j, m, t) => `${String(j).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
  function gueltig(j, m, t) {
    if (!(j >= 1900 && j <= 2100 && m >= 1 && m <= 12 && t >= 1 && t <= 31)) return false;
    const d = new Date(Date.UTC(j, m - 1, t));
    return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t;
  }
  const jahr4 = j => (j < 100 ? (j < 70 ? 2000 + j : 1900 + j) : j);

  /** Alle Daten in einer Zeile: [{ wert: 'JJJJ-MM-TT', text }]. */
  function datenIn(zeile) {
    const s = sauber(zeile), aus = [];
    let m;
    const r1 = /(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?![\d.]*\d)/g;
    while ((m = r1.exec(s))) { const j = jahr4(+m[3]); if (gueltig(j, +m[2], +m[1])) aus.push({ wert: iso(j, +m[2], +m[1]), text: m[0] }); }
    const r2 = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
    while ((m = r2.exec(s))) if (gueltig(+m[1], +m[2], +m[3])) aus.push({ wert: iso(+m[1], +m[2], +m[3]), text: m[0] });
    const r3 = /(?<!\d)(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]{3,9})\.?\s+(\d{4})(?!\d)/g;
    while ((m = r3.exec(s))) { const mo = MONATE[m[2].toLowerCase()]; if (mo && gueltig(+m[3], mo, +m[1])) aus.push({ wert: iso(+m[3], mo, +m[1]), text: m[0] }); }
    return aus;
  }

  const DATUM_ETIKETT = /^(?:datum|date|briefdatum|schreiben vom)\s*[:.]?\s*/i;
  const ORT_DEN = /^[A-ZÄÖÜ][\wäöüßÄÖÜ .\-/()]{1,40},\s*(?:den\s+|am\s+)?/;
  const KEIN_BRIEFDATUM = /(geburt|geb\.|f[aä]llig|zahlbar|bis zum|bis sp[aä]testens|frist|leistungs|liefer|zeitraum|vom .* bis|g[uü]ltig|termin|ablauf|eingang)/i;

  function datumLesen(zeilen) {
    // 1. beschriftet („Datum: …“) oder „Ort, den …“ — sicher
    for (let i = 0; i < zeilen.length; i++) {
      const z = sauber(zeilen[i]);
      const etikett = DATUM_ETIKETT.exec(z);
      const ortDen = ORT_DEN.exec(z);
      if (etikett || ortDen) {
        const rest = z.slice((etikett || ortDen)[0].length);
        const d = datenIn(rest);
        if (d.length && rest.indexOf(d[0].text) <= 2) return { wert: d[0].wert, fund: z, zeile: i };
      }
    }
    // 2. unbeschriftet im Kopf: nur wenn es genau EIN Datum gibt und die Zeile nicht nach Frist/Geburt klingt
    const kandidaten = new Map();
    zeilen.slice(0, KOPF_ZEILEN).forEach((zeile, i) => {
      const z = sauber(zeile); if (KEIN_BRIEFDATUM.test(z)) return;
      for (const d of datenIn(z)) if (!kandidaten.has(d.wert)) kandidaten.set(d.wert, { wert: d.wert, fund: z, zeile: i });
    });
    return kandidaten.size === 1 ? [...kandidaten.values()][0] : null;
  }

  /* ---------- Nummern im Kopf ---------- */
  const NUMMERN = [
    ['kundennummer', /(?:kunden[\s-]?(?:nummer|nr\.?)|kd\.?[\s-]?nr\.?|kundennr\.?|ihre kundennummer|customer (?:no|number)\.?)/i],
    ['rechnungsnummer', /(?:rechnungs[\s-]?(?:nummer|nr\.?)|rechnung (?:nr\.?|nummer)|rg\.?[\s-]?nr\.?|invoice (?:no|number)\.?)/i],
    ['auftragsnummer', /(?:auftrags[\s-]?(?:nummer|nr\.?)|bestell[\s-]?(?:nummer|nr\.?)|order (?:no|number)\.?)/i],
    ['vertragsnummer', /(?:vertrags[\s-]?(?:nummer|nr\.?)|vertrag (?:nr\.?|nummer)|zähler[\s-]?(?:nummer|nr\.?))/i],
    ['versicherungsnummer', /(?:versicherungs[\s-]?(?:schein[\s-]?)?(?:nummer|nr\.?)|policen[\s-]?(?:nummer|nr\.?)|vers\.?[\s-]?nr\.?|mitglieds[\s-]?(?:nummer|nr\.?))/i],
    ['aktenzeichen', /(?:aktenzeichen|gesch[aä]ftszeichen|az\.|steuernummer|st\.?[\s-]?nr\.?)/i],
    ['unser-zeichen', /unser(?:e)? zeichen/i],
    ['ihr-zeichen', /ihr(?:e)? zeichen/i],
  ];
  const WERT = /^[\s:.#-]*([A-Za-z0-9][A-Za-z0-9./\-]*(?: ?[0-9][A-Za-z0-9./\-]*){0,3})/;

  function nummernLesen(zeilen) {
    const aus = [], gesehen = new Set();
    zeilen.forEach((zeile, i) => {
      const z = sauber(zeile);
      for (const [art, muster] of NUMMERN) {
        const re = new RegExp(muster.source, 'gi'); let m;
        while ((m = re.exec(z))) {
          const rest = z.slice(m.index + m[0].length);
          const w = WERT.exec(rest); if (!w) continue;
          const wert = w[1].replace(/[.\-/]+$/, '').trim();
          if (!/\d/.test(wert) || wert.replace(/\D/g, '').length < 3 || wert.length > 32) continue;
          const schluessel = art + '|' + wert;
          if (gesehen.has(schluessel)) continue; gesehen.add(schluessel);
          aus.push({ art, wert, fund: z, zeile: i });
        }
      }
    });
    return aus;
  }

  /* ---------- Betreff ---------- */
  function betreffLesen(zeilen) {
    for (let i = 0; i < zeilen.length; i++) {
      const z = sauber(zeilen[i]); const m = /^(?:betreff|betr\.|subject|re|aw|wg|fwd?)\s*:\s*(.+)$/i.exec(z);
      if (m && m[1].length >= 3) return { wert: m[1].slice(0, 200), fund: z, zeile: i };
    }
    return null;
  }

  /* ---------- Absender und Empfänger ---------- */
  const RECHTSFORM = /\b(?:GmbH(?: & Co\.? KG)?|mbH|AG|KG|KGaA|OHG|GbR|UG(?: \(haftungsbeschränkt\))?|e\.\s?V\.|e\.\s?K\.|eG|SE|Ltd\.?|Inc\.?|S\.A\.|B\.V\.)(?=$|[\s,·|])/;
  const STELLE = /\b(?:Finanzamt|Stadt(?:verwaltung|werke)?|Gemeinde|Landratsamt|Landkreis|Bezirksamt|Amtsgericht|Landgericht|Jobcenter|Agentur für Arbeit|Bundesagentur|Krankenkasse|AOK|Barmer|Techniker Krankenkasse|DAK|Deutsche Rentenversicherung|Versicherung|Sparkasse|Volksbank|Bank|Praxis|Klinikum|Krankenhaus|Universität|Schule|Kita|Kanzlei|Notar(?:iat)?|Rechtsanw[aä]lt)/;
  const PLZ_ORT = /(?:^|\s)(?:D-)?\d{5}\s+[A-ZÄÖÜ][\wäöüß.\-]+/;
  const STRASSE = /[A-Za-zÄÖÜäöüß.\-]+(?:stra(?:ss|ß)e|str\.|weg|gasse|platz|allee|ring|damm|ufer|chaussee|steig)\s*\d+\s*[a-z]?\b|\bPostfach\s+\d+/i;
  const ANREDE_ZEILE = /^(?:Herrn?|Frau|Familie|Eheleute|Firma|An)\b\.?\s*$/i;

  function ruecksendezeile(zeilen) {
    for (let i = 0; i < Math.min(zeilen.length, KOPF_ZEILEN); i++) {
      const z = sauber(zeilen[i]);
      const teile = z.split(/\s*(?:·|•|\||–| - )\s*/).filter(Boolean);
      if (teile.length >= 2 && PLZ_ORT.test(z) && teile[0].length >= 3 && teile[0].length <= 80 && !/\d{5}/.test(teile[0])) {
        // „Postfach 1234 · …“ oder „Werkstraße 4 · …“ ist eine Rücksendezeile ohne Namen: Anschriftfeld ja, Absender nein.
        return { i, name: STRASSE.test(teile[0]) ? null : teile[0], fund: z };
      }
    }
    return null;
  }

  function anschriftfeld(zeilen, ab) {
    // Die erste „PLZ Ort“-Zeile nach der Rücksendezeile (oder im Kopf) schließt das Anschriftfeld; davor stehen bis zu 5 Zeilen.
    for (let i = ab; i < Math.min(zeilen.length, KOPF_ZEILEN); i++) {
      const z = sauber(zeilen[i]);
      if (!/^(?:D-)?\d{5}\s+\S/.test(z)) continue;
      const block = [];
      for (let k = i - 1; k >= Math.max(ab, i - 5); k--) { const v = sauber(zeilen[k]); if (!v) break; block.unshift({ v, k }); }
      if (!block.length) continue;
      if (!block.some(b => STRASSE.test(b.v))) continue;
      return { block, plz: { v: z, k: i } };
    }
    return null;
  }

  function personAusBlock(block) {
    const zeilen = block.filter(b => !STRASSE.test(b.v));
    for (let j = 0; j < zeilen.length; j++) {
      const v = zeilen[j].v;
      if (ANREDE_ZEILE.test(v)) { if (zeilen[j + 1]) return { wert: zeilen[j + 1].v, fund: v + ' ' + zeilen[j + 1].v, zeile: zeilen[j + 1].k }; continue; }
      const ohne = v.replace(/^(?:Herrn?|Frau|Familie|Eheleute|Firma)\s+/i, '');
      if (ohne.length >= 3) return { wert: ohne, fund: v, zeile: zeilen[j].k };
    }
    return null;
  }

  function mailName(s) {
    const t = sauber(s); if (!t) return null;
    const m = /^"?([^"<]+?)"?\s*<([^>]+)>/.exec(t);
    return m ? m[1].trim() : t.replace(/^mailto:/i, '');
  }

  function absenderLesen(zeilen, rueck, mail) {
    if (mail && mail.von) { const n = mailName(mail.von); if (n) return { wert: n, fund: 'Von: ' + sauber(mail.von), zeile: -1 }; }
    for (let i = 0; i < zeilen.length; i++) {
      const m = /^(?:absender|von|from)\s*:\s*(.+)$/i.exec(sauber(zeilen[i]));
      if (m) return { wert: mailName(m[1]), fund: sauber(zeilen[i]), zeile: i };
    }
    if (rueck && rueck.name) return { wert: rueck.name, fund: rueck.fund, zeile: rueck.i };
    // Kopf: die erste Zeile mit Rechtsform oder Behördenwort; sonst die Fußzeile (letzte Zeilen).
    const kopf = zeilen.slice(0, 8).map((v, i) => ({ v: sauber(v), i }));
    const fuss = zeilen.slice(-8).map((v, k) => ({ v: sauber(v), i: zeilen.length - 8 + k })).filter(x => x.i >= 8);
    for (const x of kopf.concat(fuss)) {
      if (!x.v || x.v.length > 80) continue;
      const teil = x.v.split(/\s*(?:·|•|\||–| - |,)\s*/)[0];
      if (RECHTSFORM.test(teil) || STELLE.test(teil)) return { wert: teil, fund: x.v, zeile: x.i };
    }
    return null;
  }

  function empfaengerLesen(zeilen, rueck, mail, namen) {
    let e = null;
    if (mail && mail.an) { const n = mailName(String(mail.an).split(',')[0]); if (n) e = { wert: n, fund: 'An: ' + sauber(mail.an), zeile: -1 }; }
    if (!e) { const feld = anschriftfeld(zeilen, rueck ? rueck.i + 1 : 0); if (feld) e = personAusBlock(feld.block); }
    if (e && Array.isArray(namen) && namen.length) {
      const f = falte(e.wert);
      const bekannt = namen.find(n => { const g = falte(n); return g && (f.includes(g) || g.includes(f)); });
      if (bekannt) e.bekannt = bekannt;
    }
    return e;
  }

  /* ---------- Wichtigkeit ---------- */
  const WICHTIG = [
    [3, /letzte (?:mahnung|zahlungserinnerung|erinnerung)|k[uü]ndigung|vollstreckung|inkasso|mahnbescheid|pf[aä]ndung|sperrung (?:ihres|des)|gerichtliches? mahnverfahren/i],
    [2, /\bmahnung\b|zahlungserinnerung|\berinnerung\b|\bfrist\b|fristablauf|bis sp[aä]testens|innerhalb von \d+ tagen|widerspruch|anh[oö]rung/i],
    [1, /zahlungsziel|zahlbar (?:bis|innerhalb)|f[aä]llig (?:am|bis)|bitte (?:[uü]berweisen|zahlen)|rechnungsbetrag/i],
  ];
  function wichtigkeitLesen(zeilen) {
    for (const [stufe, muster] of WICHTIG) {
      for (let i = 0; i < zeilen.length; i++) { const z = sauber(zeilen[i]); const m = muster.exec(z); if (m) return { stufe, wort: m[0], fund: z, zeile: i }; }
    }
    return { stufe: 0, wort: '', fund: '', zeile: -1 };
  }

  /* ---------- Thema ---------- */
  // Privat: die 18 Lebensbereiche der Familienakte (lib/family-categories.ts dort ist die Quelle der Namen).
  const THEMEN_PRIVAT = [
    ['Familie & persönliche Dokumente', ['personalausweis', 'reisepass', 'geburtsurkunde', 'heiratsurkunde', 'standesamt', 'meldebescheinigung', 'familienbuch']],
    ['Finanzen & Konten', ['kontoauszug', 'girokonto', 'depot', 'kreditkarte', 'darlehen', 'kredit', 'iban', 'sparkonto', 'bausparvertrag']],
    ['Versicherungen', ['versicherung', 'versicherungsschein', 'police', 'beitragsrechnung', 'schadenmeldung', 'haftpflicht', 'hausrat']],
    ['Steuern & Behörden', ['finanzamt', 'steuerbescheid', 'einkommensteuer', 'steuernummer', 'bescheid', 'behörde', 'landratsamt', 'bürgeramt', 'grundsteuer']],
    ['Haus & Wohnung', ['mietvertrag', 'miete', 'nebenkostenabrechnung', 'vermieter', 'hausverwaltung', 'eigentümerversammlung', 'wohnung']],
    ['Energie & Versorgung', ['strom', 'gas', 'fernwärme', 'wasser', 'abfall', 'stadtwerke', 'zählerstand', 'abschlag', 'jahresabrechnung']],
    ['Garten & Grundstück', ['garten', 'grundstück', 'baum', 'hecke', 'grundbuch', 'flurstück']],
    ['Einkäufe, Rechnungen & Garantien', ['rechnung', 'garantie', 'gewährleistung', 'kaufbeleg', 'bestellung', 'lieferschein', 'quittung']],
    ['Gesundheit & Pflege', ['arzt', 'praxis', 'befund', 'diagnose', 'rezept', 'krankenkasse', 'pflegegrad', 'pflegekasse', 'klinik', 'krankenhaus', 'arztbrief']],
    ['Rente, Arbeit & Sozialversicherung', ['rentenversicherung', 'rente', 'gehaltsabrechnung', 'lohnabrechnung', 'arbeitgeber', 'arbeitsvertrag', 'sozialversicherung', 'jobcenter', 'agentur für arbeit']],
    ['Auto & Mobilität', ['kfz', 'fahrzeug', 'zulassung', 'tüv', 'hauptuntersuchung', 'werkstatt', 'kennzeichen', 'führerschein', 'pkw']],
    ['Motorrad', ['motorrad', 'krad']],
    ['Technik, Geräte & Reparaturen', ['reparatur', 'gerät', 'computer', 'handy', 'smartphone', 'drucker', 'kundendienst', 'servicetechniker']],
    ['Verträge & Abonnements', ['vertrag', 'abonnement', 'abo', 'mitgliedschaft', 'laufzeit', 'mobilfunk', 'internetanschluss', 'zeitschrift']],
    ['Erbschaft, Vollmachten & Vorsorge', ['testament', 'erbschein', 'nachlass', 'vollmacht', 'vorsorgevollmacht', 'patientenverfügung', 'betreuungsverfügung', 'notar']],
    ['Reisen & Freizeit', ['reise', 'buchungsbestätigung', 'hotel', 'flug', 'urlaub', 'ticket', 'verein']],
    ['Korrespondenz', []],
    ['Archiv', []],
  ];

  function themaLesen(zeilen, themen) {
    const liste = Array.isArray(themen) && themen.length ? themen : THEMEN_PRIVAT;
    const text = ' ' + zeilen.map(falte).join(' \n ') + ' ';
    let best = null, zweit = 0;
    for (const [name, woerter] of liste) {
      let n = 0, erstes = '';
      for (const w of woerter) {
        const g = falte(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(?:^|[^a-z0-9])' + g + '(?=[a-z]{0,12}(?:[^a-z0-9]|$))', 'g');
        const k = (text.match(re) || []).length; if (k && !erstes) erstes = w; n += k;
      }
      if (!n) continue;
      if (!best || n > best.n) { zweit = best ? best.n : 0; best = { wert: name, n, wort: erstes }; }
      else if (n > zweit) zweit = n;
    }
    // Unsicher (Gleichstand mit einem anderen Thema): leer, nie geraten.
    if (!best || best.n === zweit) return null;
    return { wert: best.wert, wort: best.wort, treffer: best.n };
  }

  /** Alles lesen. zeilen: Array von Strings; opt: { mail, namen, themen }. */
  function lesen(zeilen, opt) {
    const o = opt || {};
    const z = (Array.isArray(zeilen) ? zeilen : String(zeilen || '').split(/\r?\n/)).map(sauber).filter((v, i, a) => v || (a[i - 1] && a[i + 1]));
    const mail = o.mail || null;
    const rueck = ruecksendezeile(z);
    let datum = datumLesen(z);
    if (!datum && mail && mail.datum) {
      const d = mail.datum instanceof Date ? mail.datum : new Date(mail.datum);
      if (!isNaN(d)) datum = { wert: iso(d.getFullYear(), d.getMonth() + 1, d.getDate()), fund: 'Datum der Mail', zeile: -1 };
    }
    let betreff = betreffLesen(z);
    if (!betreff && mail && mail.betreff) betreff = { wert: sauber(mail.betreff).slice(0, 200), fund: 'Betreff der Mail', zeile: -1 };
    return {
      v: 1,
      datum,
      absender: absenderLesen(z, rueck, mail),
      empfaenger: empfaengerLesen(z, rueck, mail, o.namen),
      nummern: nummernLesen(z),
      betreff,
      wichtigkeit: wichtigkeitLesen(z),
      thema: themaLesen(z.concat(betreff ? [betreff.wert] : []), o.themen),
    };
  }

  /** Zeilen aus dem Seitentext der Bibliothek (Seiten → [Wort, x, y, b, h] in Prozent) nach Lage zusammensetzen. */
  function zeilenAusSeiten(seiten, maxSeiten) {
    const aus = [];
    const liste = Array.isArray(seiten) ? seiten : [];
    const nehmen = liste.length <= (maxSeiten || 2) ? liste : [liste[0], liste[liste.length - 1]];
    for (const items of nehmen) {
      const stuecke = (Array.isArray(items) ? items : []).map(it => Array.isArray(it) ? { s: it[0], x: +it[1] || 0, y: +it[2] || 0, h: +it[4] || 1 } : { s: it && it.str, x: +(it && it.x) || 0, y: +(it && it.y) || 0, h: +(it && it.h) || 1 })
        .filter(t => typeof t.s === 'string' && t.s.trim());
      stuecke.sort((a, b) => a.y - b.y || a.x - b.x);
      let zeile = [], y0 = null, h0 = 1;
      const schliessen = () => { if (zeile.length) { zeile.sort((a, b) => a.x - b.x); aus.push(zeile.map(t => t.s).join(' ')); } zeile = []; };
      for (const t of stuecke) {
        if (y0 !== null && Math.abs(t.y - y0) > Math.max(0.35, Math.min(h0, t.h) * 0.5)) schliessen();
        if (!zeile.length) { y0 = t.y; h0 = t.h; }
        zeile.push(t);
      }
      schliessen();
    }
    return aus;
  }

  /* ---------- Sortieren und Gruppieren ---------- */
  const leer = v => v == null || v === '';
  /** Briefdatum (sonst Eingangsdatum, neueste zuerst) → Absender → Kundennummer → Wichtigkeit (höchste zuerst). */
  function vergleich(a, b) {
    const da = (a.briefkopf && a.briefkopf.datum && a.briefkopf.datum.wert) || String(a.createdAt || '').slice(0, 10);
    const db = (b.briefkopf && b.briefkopf.datum && b.briefkopf.datum.wert) || String(b.createdAt || '').slice(0, 10);
    if (da !== db) return da < db ? 1 : -1;
    const abs = x => falte((x.briefkopf && x.briefkopf.absender && x.briefkopf.absender.wert) || '');
    const sa = abs(a), sb = abs(b);
    if (sa !== sb) return leer(sa) ? 1 : leer(sb) ? -1 : sa.localeCompare(sb, 'de');
    const kd = x => { const n = ((x.briefkopf && x.briefkopf.nummern) || []).find(n => n.art === 'kundennummer'); return n ? n.wert : ''; };
    const ka = kd(a), kb = kd(b);
    if (ka !== kb) return leer(ka) ? 1 : leer(kb) ? -1 : ka.localeCompare(kb, 'de', { numeric: true });
    const w = x => (x.briefkopf && x.briefkopf.wichtigkeit && x.briefkopf.wichtigkeit.stufe) || 0;
    return w(b) - w(a);
  }
  /** Gruppen nach 'thema' oder 'absender': [{ name, docs }], „Ohne …“ zuletzt. */
  function gruppen(docs, nach) {
    const m = new Map();
    for (const d of docs || []) {
      const b = d.briefkopf || {};
      const name = (nach === 'absender' ? b.absender && b.absender.wert : b.thema && b.thema.wert) || '';
      if (!m.has(name)) m.set(name, []);
      m.get(name).push(d);
    }
    return [...m.entries()].sort((x, y) => (x[0] ? 0 : 1) - (y[0] ? 0 : 1) || x[0].localeCompare(y[0], 'de')).map(([name, liste]) => ({ name, docs: liste }));
  }

  const API = { lesen, zeilenAusSeiten, datenIn, datumLesen, nummernLesen, betreffLesen, absenderLesen, empfaengerLesen, wichtigkeitLesen, themaLesen,
    vergleich, gruppen, THEMEN_PRIVAT, FASSUNG: 1 };
  if (typeof window !== 'undefined') { window.WFP = window.WFP || {}; window.WFP.Briefkopf = API; }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof globalThis !== 'undefined') globalThis.__WFP_BRIEFKOPF = API;
})();
