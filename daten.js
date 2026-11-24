'use strict';
/* Datenmodell und Speicher. Alles bleibt in der Datenbank des Geräts. */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const ARTEN = { auszug: 'Abnahmeprotokoll (Auszug)', einzug: 'Übergabeprotokoll (Einzug)', beides: 'Abnahme und Übergabe' };
const ROLLEN = ['Vermieter', 'Vertretung Vermieter', 'Mieter (Auszug)', 'Mieter (Einzug)', 'Zeuge'];
const ZAEHLER = { 'Strom': 'kWh', 'Gas': 'm³', 'Kaltwasser': 'm³', 'Warmwasser': 'm³', 'Wärmemenge': 'kWh', 'Heizkostenverteiler': 'Einheiten', 'Sonstiger Zähler': '' };
const RAUMTYPEN = {
  'Zimmer': ['Decke', 'Wände', 'Fußboden', 'Fenster', 'Tür', 'Heizkörper', 'Steckdosen und Schalter'],
  'Flur': ['Decke', 'Wände', 'Fußboden', 'Wohnungstür', 'Gegensprechanlage', 'Steckdosen und Schalter'],
  'Küche': ['Decke', 'Wände und Fliesen', 'Fußboden', 'Fenster', 'Tür', 'Heizkörper', 'Spüle und Armatur', 'Herd und Geräte', 'Schränke', 'Steckdosen und Schalter'],
  'Bad': ['Decke', 'Wände und Fliesen', 'Fußboden', 'Fenster oder Lüfter', 'Tür', 'Heizkörper', 'WC', 'Waschbecken und Armatur', 'Dusche oder Wanne', 'Fugen und Silikon'],
  'Balkon': ['Boden', 'Geländer', 'Balkontür'],
  'Abstellraum': ['Decke', 'Wände', 'Fußboden', 'Tür', 'Steckdosen und Schalter'],
  'Allgemein': ['Haupthähne Wasser', 'Sicherungskasten', 'Rauchmelder', 'Klingel', 'Briefkasten'],
  'Keller': ['Geräumt und sauber', 'Tür und Schloss'],
  'Stellplatz': ['Geräumt und sauber', 'Zustand']
};
const FESTSTELLUNGEN = {
  auszug: ['Wohnung ist vollständig geräumt', 'Wohnung ist besenrein', 'Alle Schlüssel wurden zurückgegeben', 'Rauchmelder vorhanden und geprüft', 'Keller ist geräumt', 'Namensschilder wurden entfernt'],
  einzug: ['Wohnung ist geräumt und besenrein', 'Rauchmelder vorhanden und geprüft', 'Heizung wurde erklärt', 'Absperrhähne und Sicherungen wurden gezeigt', 'Wohnungsgeberbestätigung wurde übergeben', 'Hausordnung wurde übergeben']
};
const SCHLUSS = {
  auszug: 'Dieses Protokoll hält den Zustand fest, der bei der gemeinsamen Begehung festgestellt wurde. Mängel, die dabei nicht erkennbar waren, sind damit nicht erfasst. Die Rückgabe der Schlüssel allein beendet das Mietverhältnis nicht. Die Fotos im Anhang gehören zum Protokoll.',
  einzug: 'Dieses Protokoll hält den Zustand fest, der bei der gemeinsamen Begehung festgestellt wurde. Mängel, die dabei nicht erkennbar waren, sind damit nicht erfasst und sollen nach Entdeckung unverzüglich gemeldet werden. Die Fotos im Anhang gehören zum Protokoll.'
};
/* Schritte im Verlauf. auto: hakt sich selbst ab, sobald der Abschnitt vollständig ist. */
const VERLAUF = {
  vorher: [['Termin mit allen Beteiligten bestätigen', ''], ['Mietvertrag, altes Übergabeprotokoll und Schlüsselliste bereitlegen', ''], ['iPad und Stift laden, App einmal ohne Netz starten', ''], ['Namen und E-Mail-Adressen eintragen', 'personen', 'personen']],
  ort: [['Räume begehen, Mängel mit Foto festhalten', 'raeume', 'raeume'], ['Zähler ablesen und fotografieren', 'zaehler', 'zaehler'], ['Feststellungen durchgehen', 'sonstiges', 'sonstiges']],
  auszug: [['Schlüssel zurücknehmen und zählen', 'schluessel', 'schluesselAlt'], ['Abnahme gemeinsam durchlesen und unterschreiben', 'unterschrift', 'sig:auszug']],
  einzug: [['Schlüssel übergeben und zählen', 'schluessel', 'schluesselNeu'], ['Übergabe gemeinsam durchlesen und unterschreiben', 'unterschrift', 'sig:einzug']],
  nachher: [['PDF an alle Beteiligten schicken', 'versand', 'versand'], ['Sicherungsdatei ablegen', 'versand'], ['Zählerstände an Versorger und Hausverwaltung melden', '']]
};
function neuerVerlauf(art) {
  const st = (g, l) => l.map(x => ({ id: uid(), gruppe: g, text: x[0], ziel: x[1] || '', auto: x[2] || '', erledigt: '' }));
  const kaution = art === 'auszug' ? ['Kaution abrechnen'] : art === 'einzug' ? ['Kautionseingang prüfen'] : ['Kaution mit bisherigem Mieter abrechnen', 'Kautionseingang vom neuen Mieter prüfen'];
  return [...st('Vorher', VERLAUF.vorher),
    ...st('Begehung', VERLAUF.ort),
    ...(art !== 'einzug' ? st('Abnahme', VERLAUF.auszug) : []),
    ...(art !== 'auszug' ? st('Übergabe', [...(art === 'beides' ? [['Angaben und Ergänzungen des neuen Mieters eintragen', 'uebergabe']] : []), ...VERLAUF.einzug]) : []),
    ...st('Danach', [...VERLAUF.nachher, ...kaution.map(k => [k]), ...(art !== 'auszug' ? [['Wohnungsgeberbestätigung an neuen Mieter geben']] : [])])];
}
/* Welche Schriftstücke gehören zum Protokoll? Beim gemeinsamen Termin sind es zwei. */
const dokumente = p => (p.art === 'beides' ? ['auszug', 'einzug'] : [p.art]);
const personGehoert = (p, x, dok) => p.art !== 'beides' || (dok === 'auszug' ? x.rolle !== 'Mieter (Einzug)' : x.rolle !== 'Mieter (Auszug)');
const dokSigniert = (p, dok) => Object.keys(p.unterschriften).some(k => k.endsWith(':' + dok));
const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const neuerRaum = (name, typ) => ({ id: uid(), name, punkte: (RAUMTYPEN[typ] || []).map(n => ({ name: n, status: '' })), maengel: [], fotos: [], bemerkung: '' });
const neuerZaehler = art => ({ id: uid(), art, nummer: '', ort: '', stand: '', einheit: ZAEHLER[art] || '', bemerkung: '', fotos: [] });
const neuePerson = rolle => ({ id: uid(), rolle, name: '', email: '', tel: '', anschrift: '' });
const neuerSchluessel = art => ({ id: uid(), art, anzahl: '', anzahlNeu: '', nummer: '', bemerkung: '' });

function neuesProtokoll(art) {
  const jetzt = new Date().toISOString(), doks = dokumente({ art });
  return {
    id: uid(), art, erstellt: jetzt, geaendert: jetzt,
    objekt: { strasse: '', plz: '', ort: '', wohnung: '', lage: '' },
    termin: { datum: heute(), beginn: '', ende: '' },
    miete: { beginn: '', ende: '', kaution: '', neueAnschrift: '' },
    mieteNeu: { beginn: '', kaution: '' },
    personen: [neuePerson('Vermieter'), ...doks.map(d => neuePerson(d === 'auszug' ? 'Mieter (Auszug)' : 'Mieter (Einzug)'))],
    zaehler: ['Strom', 'Kaltwasser', 'Warmwasser'].map(neuerZaehler),
    raeume: [['Flur', 'Flur'], ['Wohnzimmer', 'Zimmer'], ['Schlafzimmer', 'Zimmer'], ['Küche', 'Küche'], ['Bad', 'Bad'], ['Balkon', 'Balkon'], ['Keller', 'Keller']].map(r => neuerRaum(r[0], r[1])),
    schluessel: ['Haustür', 'Wohnungstür', 'Briefkasten', 'Keller'].map(neuerSchluessel),
    schluesselFotos: [],
    feststellungen: doks.flatMap(d => FESTSTELLUNGEN[d].map(t => ({ id: uid(), text: t, wert: '', fuer: d }))),
    vereinbarungen: '', schlusstext: SCHLUSS[doks[0]],
    vereinbarungenNeu: '', schlusstextNeu: SCHLUSS.einzug, ergaenzungen: '', fotosNeu: [],
    verlauf: neuerVerlauf(art), unterschriften: {}, pdfZeiten: {}
  };
}

/* Eingelesene Dateien auf das erwartete Format bringen. */
function pruefeProtokoll(x) {
  if (!x || typeof x !== 'object' || !ARTEN[x.art]) throw new Error('Das ist keine Datei aus dieser App.');
  const s = v => (v == null ? '' : String(v));
  const liste = v => (Array.isArray(v) ? v.filter(e => e && typeof e === 'object') : []);
  const ids = v => (Array.isArray(v) ? v.map(String) : []);
  const felder = (o, ks) => Object.fromEntries(ks.map(k => [k, s(o && o[k])]));
  const p = neuesProtokoll(x.art);
  p.id = s(x.id) || uid(); p.erstellt = s(x.erstellt) || p.erstellt; p.geaendert = s(x.geaendert) || p.geaendert;
  p.objekt = felder(x.objekt, ['strasse', 'plz', 'ort', 'wohnung', 'lage']);
  p.termin = felder(x.termin, ['datum', 'beginn', 'ende']);
  p.miete = felder(x.miete, ['beginn', 'ende', 'kaution', 'neueAnschrift']);
  p.mieteNeu = felder(x.mieteNeu, ['beginn', 'kaution']);
  p.personen = liste(x.personen).map(o => ({ id: s(o.id) || uid(), ...felder(o, ['rolle', 'name', 'email', 'tel', 'anschrift']) }));
  p.zaehler = liste(x.zaehler).map(o => ({ id: s(o.id) || uid(), ...felder(o, ['art', 'nummer', 'ort', 'stand', 'einheit', 'bemerkung']), fotos: ids(o.fotos) }));
  p.raeume = liste(x.raeume).map(o => ({
    id: s(o.id) || uid(), ...felder(o, ['name', 'bemerkung']), fotos: ids(o.fotos),
    punkte: liste(o.punkte).map(q => ({ name: s(q.name), status: ['ok', 'mangel', 'entfaellt'].includes(q.status) ? q.status : '' })),
    maengel: liste(o.maengel).map(m => ({ id: s(m.id) || uid(), ...felder(m, ['punkt', 'text', 'wer', 'frist', 'kosten']), fotos: ids(m.fotos) }))
  }));
  p.schluessel = liste(x.schluessel).map(o => ({ id: s(o.id) || uid(), ...felder(o, ['art', 'anzahl', 'anzahlNeu', 'nummer', 'bemerkung']) }));
  p.schluesselFotos = ids(x.schluesselFotos); p.fotosNeu = ids(x.fotosNeu);
  p.feststellungen = liste(x.feststellungen).map(o => ({ id: s(o.id) || uid(), text: s(o.text), wert: ['ja', 'nein'].includes(o.wert) ? o.wert : '', fuer: ['auszug', 'einzug', 'beide'].includes(o.fuer) ? o.fuer : dokumente(p)[0] }));
  p.vereinbarungen = s(x.vereinbarungen); p.schlusstext = s(x.schlusstext);
  p.vereinbarungenNeu = s(x.vereinbarungenNeu); p.ergaenzungen = s(x.ergaenzungen); if (x.schlusstextNeu != null) p.schlusstextNeu = s(x.schlusstextNeu);
  if (Array.isArray(x.verlauf)) p.verlauf = liste(x.verlauf).map(o => ({ id: s(o.id) || uid(), ...felder(o, ['gruppe', 'text', 'ziel', 'auto', 'erledigt']) }));
  for (const d of dokumente(p)) { const z = x.pdfZeiten ? s(x.pdfZeiten[d]) : s(x.pdfZeit); if (z) p.pdfZeiten[d] = z; }
  p.unterschriften = {};
  for (const [k, u] of Object.entries(x.unterschriften || {})) {
    const [pid, dok] = k.includes(':') ? k.split(':') : [k, p.art]; /* bis 1.0.0 ohne Schriftstück gespeichert */
    if (!u || !p.personen.some(q => q.id === pid) || !dokumente(p).includes(dok)) continue;
    p.unterschriften[pid + ':' + dok] = {
      zeit: s(u.zeit), ort: s(u.ort), verweigert: !!u.verweigert, grund: s(u.grund), verh: Number(u.verh) || 0.4,
      striche: (Array.isArray(u.striche) ? u.striche : []).map(z => (Array.isArray(z) ? z : []).filter(Array.isArray).map(q => [+q[0] || 0, +q[1] || 0, +q[2] || 0.5]))
    };
  }
  return p;
}
const alleFotoIds = p => [...p.zaehler.flatMap(z => z.fotos), ...p.raeume.flatMap(r => [...r.maengel.flatMap(m => m.fotos), ...r.fotos]), ...p.schluesselFotos, ...(p.fotosNeu || [])];
const istUnterschrieben = p => Object.keys(p.unterschriften).length > 0;

/* Im Übergabeprotokoll wäre „Mieter“ missverständlich: gemeint ist dort der bisherige. */
const werBeiEinzug = w => ({ 'Mieter': 'bisheriger Mieter', 'Nachmieter übernimmt': 'neuer Mieter' }[w] || w);
/* Ein Schriftstück aus dem Protokoll. Beim gemeinsamen Termin sieht jeder Mieter nur, was ihn betrifft. */
function sicht(p, dok) {
  const q = JSON.parse(JSON.stringify(p)), sig = {};
  for (const [k, u] of Object.entries(q.unterschriften)) { const [pid, d] = k.split(':'); if (d === dok) sig[pid] = u; }
  q.unterschriften = sig;
  if (p.art === 'beides') {
    q.art = dok;
    q.personen = q.personen.filter(x => personGehoert(p, x, dok));
    q.feststellungen = q.feststellungen.filter(f => f.fuer === dok || f.fuer === 'beide');
    if (dok === 'einzug') {
      q.miete = { beginn: q.mieteNeu.beginn, ende: '', kaution: q.mieteNeu.kaution, neueAnschrift: '' };
      q.vereinbarungen = q.vereinbarungenNeu; q.schlusstext = q.schlusstextNeu;
      q.schluessel.forEach(x => { x.anzahl = x.anzahlNeu; });
      q.raeume.forEach(r => r.maengel.forEach(m => { m.kosten = ''; m.wer = werBeiEinzug(m.wer); }));
    } else { q.ergaenzungen = ''; q.fotosNeu = []; }
  }
  q.schluessel.forEach(x => { delete x.anzahlNeu; });
  ['mieteNeu', 'vereinbarungenNeu', 'schlusstextNeu', 'verlauf', 'pdfZeiten', 'geaendert'].forEach(k => { delete q[k]; });
  return q;
}

const DB = (() => {
  let verb = null;
  const auf = () => verb || (verb = new Promise((ok, f) => {
    const r = indexedDB.open('wohnungsuebergabe', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('protokolle', { keyPath: 'id' }); r.result.createObjectStore('fotos', { keyPath: 'id' }); };
    r.onsuccess = () => { r.result.onclose = r.result.onversionchange = () => { verb = null; }; ok(r.result); };
    r.onerror = () => { verb = null; f(r.error); };
  }));
  const tu = async (store, modus, fn, zweiter) => {
    const db = await auf();
    try {
      return await new Promise((ok, f) => {
        const t = db.transaction(store, modus); const q = fn(t.objectStore(store));
        t.oncomplete = () => ok(q && q.result); t.onerror = t.onabort = () => f(t.error || new Error('Speichern nicht möglich'));
      });
    } catch (e) {
      /* iOS trennt die Verbindung gelegentlich, wenn die App im Hintergrund war. */
      if (!zweiter && e && e.name === 'InvalidStateError') { verb = null; return tu(store, modus, fn, true); }
      throw e;
    }
  };
  return {
    liste: () => tu('protokolle', 'readonly', s => s.getAll()),
    hole: id => tu('protokolle', 'readonly', s => s.get(id)),
    sichere: p => tu('protokolle', 'readwrite', s => s.put(JSON.parse(JSON.stringify(p)))),
    weg: id => tu('protokolle', 'readwrite', s => s.delete(id)),
    foto: id => tu('fotos', 'readonly', s => s.get(id)),
    fotoSichern: f => tu('fotos', 'readwrite', s => s.put(f)),
    fotoWeg: id => tu('fotos', 'readwrite', s => s.delete(id))
  };
})();

/* Bild verkleinern: spart Speicher, dreht richtig herum und entfernt Standortdaten. */
async function zuJpeg(quelle, kante, guete) {
  const url = URL.createObjectURL(quelle);
  try {
    const img = new Image();
    await new Promise((ok, f) => { img.onload = ok; img.onerror = () => f(new Error('Das Bild konnte nicht gelesen werden.')); img.src = url; });
    const f = Math.min(1, kante / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
    const k = c.getContext('2d'); k.fillStyle = '#fff'; k.fillRect(0, 0, c.width, c.height); k.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok, fe) => c.toBlob(b => (b ? ok(b) : fe(new Error('Das Bild konnte nicht verarbeitet werden.'))), 'image/jpeg', guete));
    const erg = { daten: await blob.arrayBuffer(), w: c.width, h: c.height };
    c.width = c.height = 0;
    return erg;
  } finally { URL.revokeObjectURL(url); }
}
async function fotoAufnehmen(datei) {
  const j = await zuJpeg(datei, 1800, 0.8);
  const f = { id: uid(), ...j, zeit: new Date().toISOString(), text: '' };
  await DB.fotoSichern(f); return f;
}
const fotoCache = new Map();
async function fotoUrl(id) {
  if (fotoCache.has(id)) return fotoCache.get(id);
  const f = await DB.foto(id); if (!f) return '';
  const u = URL.createObjectURL(new Blob([f.daten], { type: 'image/jpeg' })); fotoCache.set(id, u); return u;
}
const b64aus = buf => new Promise((ok, f) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = () => f(r.error); r.readAsDataURL(new Blob([buf])); });
const b64ein = s => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; };
async function exportieren(p) {
  const teile = [`{"format":"wohnungsuebergabe","version":1,"protokoll":${JSON.stringify(p)},"fotos":[`]; let erst = true;
  for (const id of alleFotoIds(p)) {
    const f = await DB.foto(id); if (!f) continue;
    teile.push((erst ? '' : ',') + JSON.stringify({ id, w: f.w, h: f.h, zeit: f.zeit, text: f.text, jpg: await b64aus(f.daten) })); erst = false;
  }
  teile.push(']}');
  return new Blob(teile, { type: 'application/json' });
}
/* Fotos bekommen beim Kopieren eigene Kennungen, damit Löschen nur eine Kopie trifft. */
function neueFotoIds(p, karte) {
  const t = a => a.map(i => karte.get(i)).filter(Boolean);
  p.zaehler.forEach(z => { z.fotos = t(z.fotos); });
  p.raeume.forEach(r => { r.fotos = t(r.fotos); r.maengel.forEach(m => { m.fotos = t(m.fotos); }); });
  p.schluesselFotos = t(p.schluesselFotos); p.fotosNeu = t(p.fotosNeu || []);
}
async function fotosKopieren(p) {
  const karte = new Map();
  for (const id of alleFotoIds(p)) { const f = await DB.foto(id); if (f) { const n = uid(); await DB.fotoSichern({ ...f, id: n }); karte.set(id, n); } }
  neueFotoIds(p, karte);
}
async function einlesen(datei) {
  let d; try { d = JSON.parse(await datei.text()); } catch (e) { throw new Error('Die Datei lässt sich nicht lesen.'); }
  if (!d || d.format !== 'wohnungsuebergabe') throw new Error('Das ist keine Datei aus dieser App.');
  const p = pruefeProtokoll(d.protokoll), karte = new Map(), fotos = [];
  for (const f of (Array.isArray(d.fotos) ? d.fotos : [])) {
    if (!f || typeof f.jpg !== 'string') continue;
    const id = uid(); let daten; try { daten = b64ein(f.jpg); } catch (e) { continue; }
    fotos.push({ id, daten, w: +f.w || 1, h: +f.h || 1, zeit: String(f.zeit || ''), text: String(f.text || '') });
    karte.set(String(f.id), id);
  }
  neueFotoIds(p, karte);
  return { p, fotos };
}
/* p ist eine sicht(). Fingerabdruck von Inhalt, Fotos und Unterschriften; steht im PDF. Ändert sich etwas, ändert er sich mit. */
async function fingerabdruck(p) {
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  let s = JSON.stringify(p);
  for (const id of alleFotoIds(p)) { const f = await DB.foto(id); if (f) s += hex(await crypto.subtle.digest('SHA-256', f.daten)) + (f.text || ''); }
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
