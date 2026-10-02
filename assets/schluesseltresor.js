/*
 * schluesseltresor.js — DER SCHLÜSSEL DES NUTZERS, IM BROWSER.
 *
 * ══ WARUM DAS EINE EIGENE DATEI IST ════════════════════════════════════════
 *
 * Klaus hat am 2026-09-04 entschieden: „kostenlos"/Abo nur für ihn, jeder
 * andere bringt seinen **eigenen Schlüssel im Browser** mit. Damit liegt in
 * der Seite ein **bezahlter Zugang, der einem Fremden gehört** — und für
 * fremdes Geld haftet man strenger als für eigenes.
 *
 * Dieselbe Bauart wie `zeit.js`, und aus demselben Grund: die Gegenprobe fährt
 * mit `WERKSTATT_OHNE_BROWSER=1`, und ein Wächter, der nur im Browser lebt,
 * ist **immer** „nicht gefangen" (Gegenprobe-Art 5). Was sich nachrechnen
 * lässt, gehört an eine Stelle, die überall läuft. Gemessen am 2026-09-05:
 * `crypto.subtle`, `btoa` und `atob` gibt es in Node 22 — diese Datei ist
 * damit **vollständig ohne Browser prüfbar**, Verschlüsselung eingeschlossen.
 *
 * ══ WAS HIER ENTSCHIEDEN WIRD ══════════════════════════════════════════════
 *
 * Die Datei trennt, was schon zweimal auseinandergelaufen ist:
 *
 *   WO der Schlüssel liegt   →  die Ablage, hineingereicht (unten)
 *   WAS mit ihm gilt         →  hier, an einer Stelle
 *
 * Dieselbe Naht wie Ablage und Baum vom 2026-09-04. Kein Speicher kennt die
 * Regeln, und die Regeln kennen keinen Speicher.
 *
 * ⚠ DREI AUFLAGEN, DIE NICHT VERHANDELBAR SIND. Sie stehen ausführlich in
 * `docs/BYOK_BEDINGUNGEN.md`; hier steht, wo sie im Code sitzen:
 *
 * 1. **Nie im Klartext abgelegt.** `github.io` ist eine GETEILTE Adresse:
 *    IndexedDB und `localStorage` gehören dem Ursprung, nicht der App — jede
 *    der ~21 Geschwister-Apps läse mit. Dieselbe Falle wie beim DB-Suffix, nur
 *    mit einem bezahlten Zugang darin. Deshalb gibt es hier **keinen Pfad, der
 *    den rohen Schlüssel schreibt**: `einlegen` verschlüsselt, bevor es die
 *    Ablage überhaupt anfasst.
 * 2. **Das Passwort bleibt im Arbeitsspeicher.** Nicht in `localStorage`,
 *    nicht in der Ablage — dort läge es im Klartext, und dann wäre die
 *    Verschlüsselung Zierde. Der Preis: einmal je Besuch eingeben.
 * 3. **Der Schlüssel kommt NIE in eine Rückgabe, die nicht er selbst ist.**
 *    Kein Hinweis, keine Fehlermeldung, kein Protokoll trägt ihn. Was in eine
 *    Meldung gerät, landet früher oder später in einer Datei.
 */
(function (welt) {
  "use strict";

  /* ══ TEIL 1 · DIE FORM ══════════════════════════════════════════════════
   *
   * Anlass (Klaus 2026-08-20): `read -rsp` zeigt beim Tippen nichts an. Klaus
   * hat in die unsichtbare Eingabe die ganze Befehlszeile eingefuegt — die
   * Variable trug danach `cd ~/Kimhub && read -rsp …`, 141 Zeichen lang. Die
   * API meldete `401 invalid x-api-key`, und an DIESER Meldung sucht man
   * lange: sie sagt „ungueltig", nicht „das ist gar kein Schluessel".
   *
   * Hier wird nur die FORM geprueft. Ob der Schluessel gilt, weiss allein die
   * API — das steht auch in der Ausgabe, damit niemand „sieht gut aus" fuer
   * „funktioniert" haelt.
   *
   * ⚠ DIESE PRÜFUNG STAND BIS ZUM 2026-09-05 IN `schicht/schluessel.mjs` UND
   * IST HIERHER GEZOGEN — nicht kopiert. Der Browser braucht sie genauso wie
   * Node, und zwei Fassungen derselben Prüfung wären eine Drift-Quelle mit
   * Ansage: dann nähme die Kommandozeile einen Schlüssel an, den die Seite
   * ablehnt, und niemand wüsste, welche recht hat. `schicht/schluessel.mjs`
   * ist seitdem die **ES-Modul-Tür** auf diesen Raum und hält seine
   * Export-Namen unverändert.
   */
  var VORSILBE = "sk-ant-";
  var MINDEST_LAENGE = 40;

  /**
   * @returns {{ok:boolean, grund:string, hinweis:string, laenge:number}}
   * Der Schluessel selbst kommt NIE in die Rueckgabe. Was hier hineingeraet,
   * landet frueher oder spaeter in einem Protokoll.
   */
  function pruefeForm(roh) {
    var wert = String(roh == null ? "" : roh);
    var laenge = wert.length;
    var anfang = wert.slice(0, 12).replace(/[^\x20-\x7e]/g, "·");

    if (!laenge)
      return { ok: false, laenge: laenge, grund: "leer",
        hinweis: "Es ist gar nichts angekommen. Bei `read -rsp` sieht man beim " +
                 "Tippen nichts — das ist Absicht, macht es aber leicht, die " +
                 "Eingabe zu verpassen." };

    if (wert !== wert.trim())
      return { ok: false, laenge: laenge, grund: "Leerzeichen aussen",
        hinweis: "Am Anfang oder Ende steht ein Leerzeichen oder Zeilenumbruch. " +
                 "Beim Einfügen aus der Zwischenablage passiert das oft." };

    if (/\s/.test(wert))
      return { ok: false, laenge: laenge, grund: "enthält Leerzeichen",
        hinweis: "Ein Schlüssel hat keine Leerzeichen. Angekommen ist etwas mit " +
                 laenge + " Zeichen, das mit „" + anfang + "…\" beginnt — das sieht nach " +
                 "einer Befehlszeile aus, nicht nach einem Schlüssel." };

    if (wert.slice(0, VORSILBE.length) !== VORSILBE)
      return { ok: false, laenge: laenge, grund: "falscher Anfang",
        hinweis: "Ein Anthropic-Schlüssel beginnt mit „" + VORSILBE + "\". Angekommen ist " +
                 "etwas, das mit „" + anfang + "…\" beginnt." };

    if (laenge < MINDEST_LAENGE)
      return { ok: false, laenge: laenge, grund: "zu kurz",
        hinweis: "Nur " + laenge + " Zeichen — beim Einfügen ist etwas verlorengegangen." };

    return { ok: true, laenge: laenge, grund: "",
      hinweis: "Die Form stimmt (" + laenge + " Zeichen). Ob er GILT, weiss nur die API — " +
               "das sagt dir erst der nächste Aufruf." };
  }

  /* ══ TEIL 2 · DAS SCHLOSS ════════════════════════════════════════════════
   *
   * KOPIERT, NICHT ERFUNDEN. Dieselben Zahlen und dasselbe Paket-Format wie
   * der Buchhaltungs-Tresor in `ansicht.js`, der sie seinerseits aus
   * `BookLedgerPro/src/core/crypto.js` hat: AES-GCM-256, PBKDF2-SHA256 mit
   * 600 000 Runden, selbstbeschreibendes Paket `{v,salt,iv,ct}` in base64url.
   *
   * ⚠ UND GENAU DESHALB IST DAS EINE ZWEITE STELLE MIT DENSELBEN ZAHLEN —
   * die Sorte Doppelung, vor der die Verfassung warnt („eine Zahl, EINE
   * Stelle"). Den Buchhaltungs-Tresor umzubauen wäre der grössere Eingriff
   * gewesen: er hängt an vielen gewachsenen Wächtern, und ein Fehler dort
   * kostet Klaus seine Zahlen.
   *
   * Bewacht wird deshalb die ZUSICHERUNG statt der Zeile:
   * `tests/smoke_schluesseltresor.mjs` vergleicht diese vier Zahlen mit denen
   * in `ansicht.js` und fällt um, sobald eine von beiden sich bewegt. Ein
   * still von 600 000 auf 1 000 gesenkter Wert wäre eine Verschlüsselung, die
   * nur noch so **aussieht** — und der Vergleich fängt ihn auf beiden Seiten.
   */
  var FASSUNG = 1;
  var RUNDEN = 600000;
  var SALZ_BYTES = 16;
  var IV_BYTES = 12;

  function zufall(n) {
    var b = new Uint8Array(n);
    welt.crypto.getRandomValues(b);
    return b;
  }
  function bytesZuB64u(bytes) {
    var bin = "", arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64uZuBytes(str) {
    var pad = str.length % 4 === 0 ? "" : new Array(5 - (str.length % 4)).join("=");
    var bin = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + pad);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  var enc = new TextEncoder(), dec = new TextDecoder();

  function ableiten(passwort, salz) {
    return welt.crypto.subtle
      .importKey("raw", enc.encode(passwort), "PBKDF2", false, ["deriveKey"])
      .then(function (basis) {
        return welt.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salz, iterations: RUNDEN, hash: "SHA-256" },
          basis, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }

  /** Klartext → selbstbeschreibendes Paket. Dasselbe Format wie BLP. */
  function zu(passwort, klartext) {
    var salz = zufall(SALZ_BYTES), iv = zufall(IV_BYTES);
    return ableiten(passwort, salz).then(function (k) {
      return welt.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, enc.encode(klartext));
    }).then(function (ct) {
      return { v: FASSUNG, salt: bytesZuB64u(salz), iv: bytesZuB64u(iv),
               ct: bytesZuB64u(new Uint8Array(ct)) };
    });
  }

  /**
   * Paket → Klartext. Falsches Passwort wirft — AES-GCM prüft mit.
   *
   * ⚠ ERST DIE FASSUNG, DANN DAS PASSWORT — dieselbe Reihenfolge und derselbe
   * Grund wie im Buchhaltungs-Tresor: ohne die Prüfung scheitert ein Paket aus
   * einer künftigen Fassung an der Entschlüsselung, und die Seite meldete
   * „falsches Passwort". Der Nutzer suchte den Fehler dann bei sich und tippte
   * einen richtigen Schlüssel immer wieder ein. **Eine Auskunft, die in die
   * falsche Richtung zeigt, ist teurer als gar keine.**
   */
  function auf(passwort, paket) {
    if (!istPaketForm(paket)) return Promise.reject(new Error("kein-paket"));
    if (paket.v !== FASSUNG) return Promise.reject(new Error("fassung"));
    return ableiten(passwort, b64uZuBytes(paket.salt)).then(function (k) {
      return welt.crypto.subtle.decrypt({ name: "AES-GCM", iv: b64uZuBytes(paket.iv) },
                                        k, b64uZuBytes(paket.ct));
    }).then(function (pt) { return dec.decode(new Uint8Array(pt)); });
  }

  /* Zwei Fragen, nicht eine — „sieht aus wie ein Paket" und „kann ich es
     öffnen" sind verschieden. Wer sie zusammenwirft, hat für ein Paket aus
     einer künftigen Fassung nur noch falsche Antworten. */
  function istPaketForm(d) {
    return !!(d && typeof d.v === "number" && typeof d.salt === "string" &&
              typeof d.iv === "string" && typeof d.ct === "string");
  }
  function istPaket(d) { return istPaketForm(d) && d.v === FASSUNG; }

  /* ══ TEIL 3 · DIE ABLAGE-NAHT ════════════════════════════════════════════
   *
   * Der Tresor weiss NICHT, wo sein Paket liegt. Er bekommt eine Ablage
   * hineingereicht — im Browser die IndexedDB-Schicht aus `ansicht.js`
   * (`idbSchreib`/`idbLies`/`idbLoesch`), in einer Probe eine `Map`.
   *
   * Dieselbe Form wie die Ablage-Naht des Spinds vom 2026-09-04, und aus
   * demselben Grund: **die Politik bleibt im portablen Teil.** Keine Ablage
   * kennt die Form-Prüfung, keine kennt die Verschlüsselung. Sie schreibt und
   * liest, sonst nichts.
   *
   *   ablage = { schreib(k, v) -> Promise, lies(k) -> Promise, loesch(k) -> Promise }
   */
  var FACH = "byok_schluessel";

  /**
   * Schlüssel prüfen, verschlüsseln, ablegen — in dieser Reihenfolge.
   *
   * ⚠ DIE FORM WIRD VOR DEM VERSCHLIESSEN GEPRÜFT, NICHT DANACH. Sonst
   * wandert eine versehentlich eingefügte Befehlszeile verschlüsselt in die
   * Ablage, der Nutzer hält seinen Schlüssel für gespeichert — und erfährt es
   * erst beim nächsten Besuch, wenn die API mit `401` antwortet. Der Fehler
   * wäre dann von einem falschen Passwort nicht mehr zu unterscheiden.
   *
   * ⚠ UND DER ROHE SCHLÜSSEL BERÜHRT DIE ABLAGE NIE. Es gibt hier keinen
   * Zweig, der ihn ungeschützt weiterreicht — `zu()` läuft, bevor `schreib`
   * überhaupt gerufen wird. Auf einer geteilten Adresse läse ihn sonst jede
   * Geschwister-App mit.
   */
  function einlegen(ablage, passwort, schluessel) {
    var f = pruefeForm(schluessel);
    if (!f.ok) return Promise.reject(Object.assign(new Error("form"), { pruefung: f }));
    if (!passwort) return Promise.reject(new Error("kein-passwort"));
    return zu(passwort, schluessel).then(function (paket) {
      return ablage.schreib(FACH, paket).then(function () { return true; });
    });
  }

  /**
   * Paket holen und aufschliessen.
   *
   * Drei Ausgänge, und sie werden **unterschieden statt geraten** — jeder
   * andere Name führte den Nutzer in die falsche Richtung:
   *   „leer"     — es liegt gar nichts da (erster Besuch, anderer Browser)
   *   „fassung"  — es liegt etwas Neueres da, als diese Seite kennt
   *   „passwort" — es liegt das Richtige da, aber das Wort passt nicht
   */
  function holen(ablage, passwort) {
    return ablage.lies(FACH).then(function (paket) {
      if (!paket) return Promise.reject(new Error("leer"));
      if (!istPaketForm(paket)) return Promise.reject(new Error("leer"));
      if (paket.v !== FASSUNG) return Promise.reject(new Error("fassung"));
      return auf(passwort, paket).catch(function () {
        return Promise.reject(new Error("passwort"));
      });
    });
  }

  /** Liegt überhaupt etwas da? Ohne Passwort zu beantworten — die Seite muss
   *  wissen, ob sie nach einem fragen soll, bevor sie eines hat. */
  function liegtEtwas(ablage) {
    return ablage.lies(FACH).then(function (p) { return istPaketForm(p); },
                                  function () { return false; });
  }

  /** Weg damit. Der einzige Weg zurück, wenn das Passwort verloren ist —
   *  es gibt kein Zurücksetzen, das ist der Preis echter Verschlüsselung. */
  function werfen(ablage) {
    return ablage.loesch(FACH).then(function () { return true; },
                                    function () { return false; });
  }

  /* ══ DER WEG NACH DRAUSSEN IST DAS GLOBAL — UND NUR DAS ══════════════════
   *
   * `module.exports` läuft in diesem Depot NIE: `package.json` trägt
   * `"type": "module"`, also ist jede `.js` ein ES-Modul und `module` gibt es
   * dort nicht — die Zeile würde stillschweigend übersprungen. Ein `export`
   * ginge auch nicht: die Seite lädt diese Datei mit einem gewöhnlichen
   * `<script>`, und das verträgt keine Export-Anweisung.
   *
   * Also EIN Weg für beide Welten. Eine Probe importiert die Datei und liest
   * das Objekt von hier — damit misst sie genau den Pfad, den auch der Browser
   * nimmt, statt einen zweiten, der nur für Tests existiert.
   */
  if (welt) welt.WERKSTATT_SCHLUESSEL = {
    VORSILBE: VORSILBE, MINDEST_LAENGE: MINDEST_LAENGE, pruefeForm: pruefeForm,
    FASSUNG: FASSUNG, RUNDEN: RUNDEN, SALZ_BYTES: SALZ_BYTES, IV_BYTES: IV_BYTES,
    zu: zu, auf: auf, istPaketForm: istPaketForm, istPaket: istPaket,
    FACH: FACH, einlegen: einlegen, holen: holen, liegtEtwas: liegtEtwas, werfen: werfen,
  };
})(typeof window !== "undefined" ? window
   : (typeof globalThis !== "undefined" ? globalThis : null));
