'use strict';
/* Vorbereiteter Termin für den ersten Start. Diese Datei ist öffentlich: hier stehen nie Namen, Kontakte,
   Mietdaten oder Mängel. Persönliches wird auf dem Gerät über „Daten einfügen“ ergänzt. */
const STARTVORLAGE = 'leipziger-17b';
function startVorlage() {
  const p = neuesProtokoll('beides');
  p.id = STARTVORLAGE;
  Object.assign(p.objekt, { strasse: 'Leipziger Straße 17b', plz: '04509', ort: 'Delitzsch' });
  p.termin.datum = '';
  p.personen.splice(1, 0, neuePerson('Vermieter'));
  p.zaehler = ['Strom', 'Kaltwasser', 'Warmwasser', 'Wärmemenge'].map(neuerZaehler);
  p.zaehler[3].einheit = 'MWh';
  p.raeume = [['Flur', 'Flur'], ['Wohnzimmer', 'Zimmer'], ['Schlafbereich', 'Zimmer'], ['Essbereich', 'Zimmer'], ['Küche', 'Küche'], ['Speisekammer', 'Abstellraum'], ['Bad', 'Bad'], ['Balkon', 'Balkon'], ['Keller', 'Keller'], ['Allgemein', 'Allgemein']].map(r => neuerRaum(r[0], r[1]));
  p.raeume[4].punkte.push({ name: 'Lüftung', status: '' });
  return p;
}
/* Legt die Vorlage genau einmal an. Wer sie löscht, bekommt sie nicht wieder. */
async function vorbereiten() {
  try { if (localStorage.getItem('vorlage') === STARTVORLAGE) return; } catch (e) { return; }
  try {
    const alle = await DB.liste();
    if (!alle.some(p => p.id === STARTVORLAGE || (p.art === 'beides' && p.objekt && p.objekt.strasse === 'Leipziger Straße 17b'))) await DB.sichere(startVorlage());
    localStorage.setItem('vorlage', STARTVORLAGE);
  } catch (e) { console.warn(e); }
}

/* „Daten einfügen“: eine Angabe je Zeile, Teile mit | getrennt. Mehrfaches Einfügen legt nichts doppelt an. */
function datenEinfuegen(p, text) {
  let n = 0; const unklar = [], tag = s => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s; };
  const EINZELN = { 'wohnung': ['objekt', 'wohnung'], 'lage': ['objekt', 'lage'], 'datum': ['termin', 'datum', 1], 'beginn': ['termin', 'beginn'], 'ende': ['termin', 'ende'], 'mietbeginn': ['miete', 'beginn', 1], 'mietende': ['miete', 'ende', 1], 'kaution': ['miete', 'kaution'], 'neue anschrift': ['miete', 'neueAnschrift'], 'mietbeginn neu': ['mieteNeu', 'beginn', 1], 'kaution neu': ['mieteNeu', 'kaution'] };
  for (const roh of String(text).split('\n')) {
    if (!roh.trim()) continue;
    const t = roh.split('|').map(x => x.trim()), k = t[0].toLowerCase(), e = EINZELN[k];
    if (e && t[1]) { p[e[0]][e[1]] = e[2] ? tag(t[1]) : t[1]; n++; }
    else if (k === 'person' && ROLLEN.includes(t[1]) && t[2]) {
      let x = p.personen.find(q => q.name === t[2]) || p.personen.find(q => q.rolle === t[1] && !q.name);
      if (!x) { x = neuePerson(t[1]); p.personen.push(x); }
      x.rolle = t[1]; x.name = t[2]; if (t[3]) x.email = t[3]; if (t[4]) x.tel = t[4]; if (t[5]) x.anschrift = t[5]; n++;
    } else if (k === 'mangel' && t[1] && t[3]) {
      let r = p.raeume.find(q => q.name === t[1]); if (!r) { r = neuerRaum(t[1], ''); p.raeume.push(r); }
      let q = r.punkte.find(y => y.name === t[2]); if (!q && t[2]) { q = { name: t[2], status: '' }; r.punkte.push(q); }
      if (!r.maengel.some(m => m.text === t[3])) { r.maengel.push({ id: uid(), punkt: t[2], text: t[3], wer: '', frist: '', kosten: '', fotos: [] }); if (q) q.status = 'mangel'; }
      n++;
    } else if (k === 'schritt' && t[2]) {
      if (!p.verlauf.some(s => s.text === t[2])) { const i = p.verlauf.map(s => s.gruppe).lastIndexOf(t[1]), s = { id: uid(), gruppe: t[1], text: t[2], ziel: '', auto: '', erledigt: '' }; if (i < 0) p.verlauf.push(s); else p.verlauf.splice(i + 1, 0, s); }
      n++;
    } else if (k === 'feststellung' && ['auszug', 'einzug', 'beide'].includes(t[1]) && t[2]) {
      if (!p.feststellungen.some(f => f.text === t[2])) p.feststellungen.push({ id: uid(), text: t[2], wert: '', fuer: p.art === 'beides' ? t[1] : p.art });
      n++;
    } else if (k === 'vereinbarung' && t[1]) { if (!p.vereinbarungen.includes(t[1])) p.vereinbarungen = [p.vereinbarungen, t[1]].filter(Boolean).join('\n'); n++; }
    else unklar.push(roh.trim());
  }
  return { n, unklar };
}
