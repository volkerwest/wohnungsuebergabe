'use strict';
/* Oberfläche. Text kommt immer als Text in die Seite, nie als HTML. */
const $app = document.getElementById('app');
function h(tag, props, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && k !== 'list' && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kinder.flat(Infinity)) if (c != null && c !== false) e.append(c);
  return e;
}
const ICON = {
  zurueck: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', kamera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  bild: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01', weg: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12', teilen: 'M12 15V4M8 8l4-4 4 4M6 12v8h12v-8',
  weiter: 'M9 5l7 7-7 7', haken: 'M5 12.5l4.5 4.5L19 7.5', schloss: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3', kreuz: 'M6 6l12 12M18 6L6 18', stift: 'M4 20l1-4L16 5l3 3L8 19z'
};
function icon(n) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
  const d = document.createElementNS('http://www.w3.org/2000/svg', 'path'); d.setAttribute('d', ICON[n]); s.append(d); return s;
}
const knopf = (text, fn, kl, ic) => h('button', { type: 'button', class: 'btn ' + (kl || ''), onclick: fn }, ic && icon(ic), text);

/* ---------- Dialoge ---------- */
function dialog(titel, inhalt, aktionen, kl) {
  return new Promise(ok => {
    const vorher = document.activeElement;
    const zu = w => { huelle.remove(); document.removeEventListener('keydown', taste); if (vorher && vorher.focus) vorher.focus({ preventScroll: true }); ok(w); };
    const taste = e => { if (e.key === 'Escape') zu(null); };
    const box = h('div', { class: 'dlg ' + (kl || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, tabindex: '-1' }, h('h2', {}, titel), inhalt && h('div', { class: 'dlg-inh' }, inhalt),
      h('div', { class: 'dlg-akt' }, aktionen.map(a => h('button', { type: 'button', class: 'btn ' + (a.kl || ''), onclick: () => zu(a.wert) }, a.text))));
    const huelle = h('div', { class: 'huelle', onclick: e => { if (e.target === huelle) zu(null); } }, box);
    document.addEventListener('keydown', taste); document.body.append(huelle); box.focus();
  });
}
const frage = (titel, text, ja, gefahr) => dialog(titel, h('p', {}, text), [{ text: 'Abbrechen', wert: false }, { text: ja, wert: true, kl: gefahr ? 'gefahr' : 'pri' }]);
const hinweis = (titel, text) => dialog(titel, h('p', {}, text), [{ text: 'OK', wert: true, kl: 'pri' }]);
let toastT;
function toast(t) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const e = h('div', { class: 'toast', role: 'status' }, t); document.body.append(e); clearTimeout(toastT); toastT = setTimeout(() => e.remove(), 2600);
}
const fehler = (e, was) => { console.error(e); hinweis('Das hat nicht geklappt', `${was} ${e && e.message ? e.message : ''}`.trim()); };

/* ---------- Speichern ---------- */
let P = null, abschnitt = 'daten', speicherT = null, kette = Promise.resolve();
let stand = '';
function zeigeStand(t) { stand = t; const e = document.getElementById('stand'); if (e) e.textContent = t; }
function speichern(sofort) {
  if (!P) return kette;
  P.geaendert = new Date().toISOString(); zeigeStand('Speichert …'); clearTimeout(speicherT);
  const tu = () => {
    speicherT = null; const p = JSON.parse(JSON.stringify(P));
    kette = kette.then(() => DB.sichere(p)).then(() => zeigeStand('Gespeichert')).catch(e => { zeigeStand('Nicht gespeichert'); fehler(e, 'Die Eingabe konnte nicht gespeichert werden.'); });
    return kette;
  };
  if (sofort) return tu();
  speicherT = setTimeout(tu, 350); return kette;
}
const jetztSichern = () => { if (speicherT) speichern(true); return kette; };
document.addEventListener('visibilitychange', () => { if (document.hidden) jetztSichern(); });
window.addEventListener('pagehide', jetztSichern);

/* ---------- Eingabefelder ---------- */
let feldNr = 0;
function feld(label, obj, key, opt) {
  const o = opt || {}, id = 'f' + (++feldNr);
  const gemein = { id, oninput: e => { obj[key] = e.target.value; speichern(); if (o.nach) o.nach(e.target.value); }, placeholder: o.platz || null, disabled: P && istUnterschrieben(P) };
  let ein;
  if (o.typ === 'lang') { ein = h('textarea', { ...gemein, rows: String(o.zeilen || 3) }); ein.value = obj[key] || ''; }
  else if (o.auswahl) {
    const werte = obj[key] && !o.auswahl.includes(obj[key]) ? [obj[key], ...o.auswahl] : o.auswahl;
    ein = h('select', gemein, o.leer != null && h('option', { value: '' }, o.leer), werte.map(w => h('option', { value: w }, w))); ein.value = obj[key] || '';
  } else {
    ein = h('input', { ...gemein, type: o.typ || 'text', inputmode: o.modus || null, autocomplete: 'off', autocapitalize: o.typ === 'email' ? 'none' : (o.gross || 'sentences'), autocorrect: o.roh ? 'off' : null, spellcheck: o.roh ? 'false' : null }); ein.value = obj[key] || '';
  }
  return h('div', { class: 'feld ' + (o.kl || '') }, h('label', { for: id }, label), ein);
}
const reihe = (...k) => h('div', { class: 'reihe' }, k);
const karte = (...k) => h('section', { class: 'karte' }, k);
const gesperrt = () => P && istUnterschrieben(P);

/* ---------- Fotos ---------- */
function fotoLeiste(ids, text) {
  const wrap = h('div', { class: 'fotos' });
  const malen = () => {
    wrap.replaceChildren();
    ids.forEach(id => {
      const im = h('img', { alt: 'Foto ansehen' }); fotoUrl(id).then(u => { if (u) im.src = u; });
      wrap.append(h('button', { type: 'button', class: 'thumb', onclick: () => fotoZeigen(ids, id, malen) }, im));
    });
    if (gesperrt()) return;
    const wahl = (kam, ic, t) => {
      const ein = h('input', { type: 'file', accept: 'image/*', multiple: !kam, class: 'vh', 'aria-label': t, onchange: e => nehmen(e.target) });
      if (kam) ein.setAttribute('capture', 'environment');
      return h('label', { class: 'btn foto' }, icon(ic), t, ein);
    };
    wrap.append(wahl(true, 'kamera', text || 'Foto'), wahl(false, 'bild', 'Mediathek'));
  };
  const nehmen = async ein => {
    const p = P, dateien = [...ein.files]; ein.value = '';
    for (const d of dateien) {
      toast('Foto wird gespeichert …');
      try { const f = await fotoAufnehmen(d); ids.push(f.id); if (P === p) await speichern(true); else await DB.sichere(p); } catch (e) { fehler(e, 'Das Foto wurde nicht gespeichert.'); break; }
    }
    if (dateien.length) toast(dateien.length > 1 ? dateien.length + ' Fotos gespeichert' : 'Foto gespeichert');
    malen();
  };
  malen(); return wrap;
}
async function fotoZeigen(ids, id, danach) {
  const f = await DB.foto(id), url = await fotoUrl(id); if (!f) return;
  const t = h('input', { type: 'text', placeholder: 'Beschriftung (freiwillig)', 'aria-label': 'Beschriftung', disabled: gesperrt() }); t.value = f.text || '';
  const akt = [{ text: 'Fertig', wert: 'ok', kl: 'pri' }]; if (!gesperrt()) akt.unshift({ text: 'Foto löschen', wert: 'weg', kl: 'gefahr' });
  const w = await dialog('Foto', [h('img', { class: 'gross', src: url, alt: '' }), h('p', { class: 'klein' }, 'Aufgenommen in der App: ' + zeitDe(f.zeit)), t], akt, 'breit');
  if (w === 'weg') {
    if (!await frage('Foto löschen?', 'Das Foto wird aus dem Protokoll entfernt. Das lässt sich nicht rückgängig machen.', 'Löschen', true)) return;
    ids.splice(ids.indexOf(id), 1); await speichern(true); await DB.fotoWeg(id); danach();
  } else if (!gesperrt() && t.value !== (f.text || '')) await DB.fotoSichern({ ...f, text: t.value });
}
const fotosWeg = async ids => { for (const id of ids) await DB.fotoWeg(id); };

/* ---------- Liste ---------- */
async function zeigeListe() {
  await jetztSichern(); P = null;
  let alle; try { alle = await DB.liste(); } catch (e) { $app.replaceChildren(h('main', { class: 'start' }, h('h1', {}, 'Wohnungsübergabe'), h('p', {}, 'Der Speicher des Geräts ist nicht erreichbar. Bitte den privaten Modus ausschalten und die App neu öffnen.'))); return; }
  alle.sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  const alleinstehend = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const imp = h('input', { type: 'file', accept: '.json,application/json,text/plain,.txt', class: 'vh', 'aria-label': 'Datei öffnen', onchange: async e => { const d = e.target.files[0]; e.target.value = ''; if (d) await importieren(d); } });
  $app.replaceChildren(h('main', { class: 'start' },
    h('header', { class: 'start-kopf' }, h('h1', {}, 'Wohnungsübergabe'), h('p', { class: 'leise' }, 'Alle Angaben und Fotos bleiben auf diesem Gerät.')),
    !alleinstehend && /iPhone|iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 && h('div', { class: 'tipp' }, h('b', {}, 'Bitte zuerst installieren. '), 'In Safari auf Teilen tippen, dann „Zum Home-Bildschirm“. Nur so bleiben die Daten sicher gespeichert und die App läuft ohne Netz.'),
    h('div', { class: 'start-akt' }, knopf('Neues Protokoll', neu, 'pri gross', 'plus'), h('label', { class: 'btn gross' }, 'Datei öffnen', imp)),
    alle.length ? h('ul', { class: 'liste' }, alle.map(p => {
      const st = istUnterschrieben(p) ? (p.personen.filter(x => x.name).every(x => p.unterschriften[x.id]) ? ['Unterschrieben', 'ok'] : ['Unterschrift fehlt noch', 'warn']) : ['In Arbeit', ''];
      return h('li', {}, h('button', { type: 'button', class: 'eintrag', onclick: () => gehe(p.id, 'daten') },
        h('span', { class: 'e-haupt' }, h('b', {}, p.objekt.strasse || 'Ohne Adresse'), h('span', { class: 'leise' }, [ARTEN[p.art], p.personen.filter(x => x.rolle.startsWith('Mieter')).map(x => x.name).filter(Boolean).join(', ')].filter(Boolean).join(' · '))),
        h('span', { class: 'e-neben' }, h('span', {}, datumDe(p.termin.datum)), h('span', { class: 'pille ' + st[1] }, st[0])), icon('weiter')));
    })) : h('p', { class: 'leer' }, 'Noch kein Protokoll angelegt.'),
    h('p', { class: 'fuss' }, 'Version 1.0.0')));
  scrollTo(0, 0);
}
async function neu() {
  const art = await dialog('Was soll protokolliert werden?', null, [{ text: 'Auszug: Wohnung zurücknehmen', wert: 'auszug', kl: 'pri' }, { text: 'Einzug: Wohnung übergeben', wert: 'einzug', kl: 'pri' }, { text: 'Abbrechen', wert: null }], 'stapel');
  if (!art) return;
  const p = neuesProtokoll(art);
  try { await DB.sichere(p); if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); gehe(p.id, 'daten'); } catch (e) { fehler(e, 'Das Protokoll konnte nicht angelegt werden.'); }
}
async function importieren(datei) {
  try {
    const { p, fotos } = await einlesen(datei); const alt = await DB.hole(p.id);
    if (alt) {
      const w = await dialog('Protokoll ist schon vorhanden', h('p', {}, `Auf diesem Gerät zuletzt geändert: ${zeitDe(alt.geaendert)}. In der Datei: ${zeitDe(p.geaendert)}.`), [{ text: 'Durch die Datei ersetzen', wert: 'neu', kl: 'gefahr' }, { text: 'Als Kopie anlegen', wert: 'kopie', kl: 'pri' }, { text: 'Abbrechen', wert: null }], 'stapel');
      if (!w) return;
      if (w === 'kopie') p.id = uid();
      else { for (const f of fotos) await DB.fotoSichern(f); await DB.sichere(p); await fotosWeg(alleFotoIds(alt)); toast('Ersetzt'); return zeigeListe(); }
    }
    for (const f of fotos) await DB.fotoSichern(f);
    await DB.sichere(p); toast('Protokoll geöffnet'); zeigeListe();
  } catch (e) { fehler(e, 'Die Datei konnte nicht geöffnet werden.'); }
}

/* ---------- Protokoll ---------- */
const ABSCHNITTE = [['daten', 'Wohnung und Termin'], ['personen', 'Beteiligte'], ['zaehler', 'Zählerstände'], ['raeume', 'Räume und Mängel'], ['schluessel', 'Schlüssel'], ['sonstiges', 'Feststellungen'], ['unterschrift', 'Unterschriften'], ['versand', 'PDF und E-Mail']];
function fertig(k) {
  const p = P;
  switch (k) {
    case 'daten': return !!(p.objekt.strasse && p.objekt.ort && p.termin.datum);
    case 'personen': return p.personen.length > 1 && p.personen.every(x => x.name);
    case 'zaehler': return p.zaehler.length > 0 && p.zaehler.every(z => z.stand);
    case 'raeume': return p.raeume.length > 0 && p.raeume.every(r => r.punkte.every(x => x.status));
    case 'schluessel': return p.schluessel.length > 0 && p.schluessel.every(s => s.anzahl);
    case 'sonstiges': return p.feststellungen.every(f => f.wert);
    case 'unterschrift': return istUnterschrieben(p) && p.personen.filter(x => x.name).every(x => p.unterschriften[x.id]);
    case 'versand': return !!p.pdfZeit;
  }
}
async function zeigeProtokoll(id, k) {
  if (!P || P.id !== id) { await jetztSichern(); P = await DB.hole(id); if (!P) return gehe(); P = pruefeProtokoll(P); stand = 'Gespeichert'; }
  abschnitt = ABSCHNITTE.some(a => a[0] === k) ? k : 'daten'; pdfDaten = null;
  malen(); scrollTo(0, 0);
}
function malen() {
  const i = ABSCHNITTE.findIndex(a => a[0] === abschnitt), n = ABSCHNITTE[i + 1];
  const nav = h('nav', { class: 'nav', 'aria-label': 'Abschnitte' }, ABSCHNITTE.map(([k, t]) => h('button', { type: 'button', class: k === abschnitt ? 'aktiv' : '', 'aria-current': k === abschnitt ? 'step' : null, onclick: () => gehe(P.id, k) }, h('span', { class: 'punkt' + (fertig(k) ? ' ok' : '') }, fertig(k) && icon('haken')), t)));
  const inhalt = ANSICHT[abschnitt]();
  $app.replaceChildren(
    h('header', { class: 'kopf' }, h('button', { type: 'button', class: 'rund', 'aria-label': 'Zur Übersicht', onclick: () => gehe() }, icon('zurueck')),
      h('div', { class: 'kopf-t' }, h('b', {}, P.objekt.strasse || ARTEN[P.art]), h('span', {}, P.art === 'auszug' ? 'Abnahme beim Auszug' : 'Übergabe beim Einzug')), h('span', { id: 'stand', class: 'stand' }, stand)),
    h('div', { class: 'rahmen' }, nav, h('main', { class: 'inhalt' }, h('h1', {}, ABSCHNITTE[i][1]),
      gesperrt() && i < 6 && h('div', { class: 'tipp' }, icon('schloss'), h('span', {}, 'Das Protokoll ist unterschrieben und gesperrt. '), knopf('Zum Ändern entsperren', entsperren, 'klein-b')),
      inhalt, n && h('div', { class: 'weiter' }, h('button', { type: 'button', class: 'btn pri gross', onclick: () => gehe(P.id, n[0]) }, 'Weiter: ' + n[1], icon('weiter'))))));
  const a = nav.querySelector('.aktiv'); if (a) nav.scrollLeft = a.offsetLeft - 24;
}
async function entsperren() {
  if (!await frage('Protokoll entsperren?', 'Alle vorhandenen Unterschriften werden gelöscht. Danach müssen alle neu unterschreiben.', 'Unterschriften löschen', true)) return;
  P.unterschriften = {}; P.pdfZeit = ''; pdfDaten = null; await speichern(true); malen();
}
const wegKnopf = (was, fn) => !gesperrt() && h('button', { type: 'button', class: 'rund weg', 'aria-label': was + ' entfernen', onclick: fn }, icon('weg'));
async function entferne(liste, e, was, fotos) {
  if (!await frage(was + ' entfernen?', 'Eingaben und Fotos dazu werden gelöscht.', 'Entfernen', true)) return;
  liste.splice(liste.indexOf(e), 1); await speichern(true); await fotosWeg(fotos || []); malen();
}
const letzter = sel => { const a = document.querySelectorAll(sel), e = a[a.length - 1]; if (e) { e.scrollIntoView({ block: 'center' }); const f = e.querySelector('input:not([type=file]),textarea'); if (f) f.focus(); } };

const ANSICHT = {
  daten: () => [
    karte(h('h2', {}, 'Wohnung'), feld('Straße und Hausnummer', P.objekt, 'strasse', { gross: 'words' }),
      reihe(feld('PLZ', P.objekt, 'plz', { modus: 'numeric', kl: 'schmal' }), feld('Ort', P.objekt, 'ort', { gross: 'words' })),
      reihe(feld('Wohnungsnummer', P.objekt, 'wohnung'), feld('Lage', P.objekt, 'lage', { platz: 'z. B. 2. OG links' }))),
    karte(h('h2', {}, 'Termin'), reihe(feld('Datum', P.termin, 'datum', { typ: 'date' }), feld('Beginn', P.termin, 'beginn', { typ: 'time' }), feld('Ende', P.termin, 'ende', { typ: 'time' }))),
    karte(h('h2', {}, 'Mietverhältnis'), reihe(feld('Mietbeginn', P.miete, 'beginn', { typ: 'date' }), P.art === 'auszug' && feld('Mietende', P.miete, 'ende', { typ: 'date' })),
      feld('Kaution', P.miete, 'kaution', { platz: 'z. B. 900 €, Rückzahlung nach Abrechnung' }),
      P.art === 'auszug' && feld('Neue Anschrift des Mieters', P.miete, 'neueAnschrift', { gross: 'words' }))
  ],
  personen: () => [
    P.personen.map(x => {
      return karte(h('div', { class: 'karte-kopf pers' }, h('h2', {}, x.name || x.rolle), wegKnopf('Person', () => entferne(P.personen, x, 'Person'))),
        reihe(feld('Rolle', x, 'rolle', { auswahl: ROLLEN }), feld('Name', x, 'name', { gross: 'words', roh: true })),
        reihe(feld('E-Mail', x, 'email', { typ: 'email', roh: true }), feld('Telefon', x, 'tel', { typ: 'tel' })), feld('Anschrift', x, 'anschrift', { gross: 'words' }));
    }),
    !gesperrt() && knopf('Person hinzufügen', () => { P.personen.push(neuePerson(P.art === 'auszug' ? 'Mieter (Auszug)' : 'Mieter (Einzug)')); speichern(); malen(); letzter('.karte'); }, '', 'plus'),
    h('p', { class: 'klein' }, 'Alle Angaben hier stehen im PDF, das jeder Empfänger bekommt.')
  ],
  zaehler: () => [
    P.zaehler.map(z => karte(h('div', { class: 'karte-kopf' }, h('h2', {}, z.art), wegKnopf('Zähler', () => entferne(P.zaehler, z, 'Zähler', z.fotos))),
      reihe(feld('Stand', z, 'stand', { modus: 'decimal', kl: 'stark' }), feld('Einheit', z, 'einheit', { kl: 'schmal', roh: true, gross: 'none' })),
      reihe(feld('Zählernummer', z, 'nummer', { roh: true, gross: 'characters' }), feld('Wo', z, 'ort', { platz: 'z. B. Keller, Bad' })),
      feld('Bemerkung', z, 'bemerkung'), fotoLeiste(z.fotos, 'Zähler fotografieren'))),
    !gesperrt() && h('div', { class: 'knopfzeile' }, Object.keys(ZAEHLER).map(a => knopf(a, () => { P.zaehler.push(neuerZaehler(a)); speichern(); malen(); letzter('.karte'); }, '', 'plus')))
  ],
  raeume: () => {
    const raum = h('select', { 'aria-label': 'Art des Raums' }, Object.keys(RAUMTYPEN).map(t => h('option', { value: t }, t)));
    return [P.raeume.map(raumKarte), !gesperrt() && h('div', { class: 'knopfzeile' }, raum, knopf('Raum hinzufügen', () => { P.raeume.push(neuerRaum(raum.value, raum.value)); speichern(); malen(); letzter('.karte'); }, '', 'plus'))];
  },
  schluessel: () => [
    karte(P.schluessel.map(s => h('div', { class: 'schl' }, feld('Schlüssel', s, 'art'), feld('Anzahl', s, 'anzahl', { modus: 'numeric', kl: 'mini' }), feld('Nummer', s, 'nummer', { roh: true, gross: 'characters' }), feld('Bemerkung', s, 'bemerkung'), wegKnopf('Schlüssel', () => { P.schluessel.splice(P.schluessel.indexOf(s), 1); speichern(); malen(); }))),
      !gesperrt() && knopf('Schlüssel hinzufügen', () => { P.schluessel.push(neuerSchluessel('')); speichern(); malen(); letzter('.schl'); }, '', 'plus')),
    karte(h('h2', {}, 'Fotos der Schlüssel'), fotoLeiste(P.schluesselFotos, 'Foto'))
  ],
  sonstiges: () => [
    karte(P.feststellungen.map(f => h('div', { class: 'fest' }, h('span', {}, f.text), wahl([['ja', 'Ja'], ['nein', 'Nein']], f, 'wert', f.text), wegKnopf('Punkt', () => { P.feststellungen.splice(P.feststellungen.indexOf(f), 1); speichern(); malen(); }))),
      !gesperrt() && knopf('Punkt hinzufügen', async () => {
        const t = h('input', { type: 'text', 'aria-label': 'Text' });
        if (await dialog('Neuer Punkt', t, [{ text: 'Abbrechen', wert: false }, { text: 'Hinzufügen', wert: true, kl: 'pri' }]) && t.value.trim()) { P.feststellungen.push({ id: uid(), text: t.value.trim(), wert: '' }); speichern(); malen(); }
      }, '', 'plus')),
    karte(feld('Vereinbarungen und Bemerkungen', P, 'vereinbarungen', { typ: 'lang', zeilen: 6 })),
    karte(feld('Hinweise am Ende des Protokolls', P, 'schlusstext', { typ: 'lang', zeilen: 6 }))
  ],
  unterschrift: () => [
    h('div', { class: 'knopfzeile' }, knopf('Protokoll gemeinsam durchlesen', vorschau, 'gross')),
    offenes(),
    P.personen.filter(x => x.name || P.unterschriften[x.id]).map(x => {
      const u = P.unterschriften[x.id]; let bild = null;
      if (u && !u.verweigert) { const c = h('canvas', { class: 'sig-klein', width: 900, height: Math.round(900 * u.verh) }); zeichneStriche(c.getContext('2d'), u.striche, c.width, c.height); bild = c; }
      return karte(h('div', { class: 'karte-kopf' }, h('div', {}, h('h2', {}, x.name), h('span', { class: 'leise' }, x.rolle)), u && h('span', { class: 'pille ' + (u.verweigert ? 'warn' : 'ok') }, u.verweigert ? 'Verweigert' : 'Unterschrieben')),
        bild, u && h('p', { class: 'klein' }, [u.ort, zeitDe(u.zeit)].filter(Boolean).join(', ') + (u.grund ? ' · ' + u.grund : '')),
        !u && h('div', { class: 'knopfzeile' }, knopf('Unterschreiben', () => unterschreiben(x), 'pri', 'stift'), knopf('Unterschrift verweigert', () => verweigert(x))));
    }),
    !P.personen.some(x => x.name) && h('p', { class: 'leer' }, 'Bitte zuerst unter „Beteiligte“ die Namen eintragen.'),
    gesperrt() ? h('div', { class: 'tipp' }, icon('schloss'), h('span', {}, 'Das Protokoll ist gesperrt, damit nach der Unterschrift nichts mehr geändert wird. '), knopf('Zum Ändern entsperren', entsperren, 'klein-b'))
      : h('p', { class: 'klein' }, 'Mit der ersten Unterschrift wird das Protokoll gesperrt.')
  ],
  versand: () => {
    const box = h('div', {});
    const adr = P.personen.filter(x => /@/.test(x.email)).map(x => x.email.trim()).filter((e, i, a) => a.indexOf(e) === i);
    const ohne = P.personen.filter(x => x.name && !/@/.test(x.email)).map(x => x.name);
    const los = async () => {
      const kn = box.querySelector('button'); if (kn) kn.disabled = true; const p = P;
      const m = h('p', { class: 'leise', role: 'status' }, 'PDF wird erstellt …'); box.append(m);
      try {
        await jetztSichern();
        const blob = await bauPdf(p, t => { m.textContent = 'PDF wird erstellt: ' + t; }); if (P !== p || abschnitt !== 'versand') return;
        pdfDaten = new File([blob], dateiname(p, 'pdf'), { type: 'application/pdf' });
        P.pdfZeit = new Date().toISOString(); await speichern(true); zeigePdf();
      } catch (e) { m.remove(); if (kn) kn.disabled = false; fehler(e, 'Das PDF konnte nicht erstellt werden.'); }
    };
    const zeigePdf = () => {
      const mb = (pdfDaten.size / 1048576).toFixed(1).replace('.', ',');
      box.replaceChildren(h('div', { class: 'stapel-v' }, h('p', {}, h('b', {}, pdfDaten.name), h('span', { class: 'leise' }, ` · ${mb} MB`)),
        pdfDaten.size > 18e6 && h('div', { class: 'tipp' }, 'Das PDF ist groß. Manche Postfächer nehmen nur bis 20 MB an. Apple Mail bietet dann „Mail Drop“ an.'),
        h('ol', { class: 'schritte' },
          h('li', {}, h('div', {}, adr.length ? [h('span', { class: 'adr' }, adr.join(', ')), knopf('Adressen kopieren', async () => { try { await navigator.clipboard.writeText(adr.join(', ')); toast('Adressen kopiert'); } catch (e) { hinweis('Bitte von Hand kopieren', adr.join(', ')); } })] : 'Keine E-Mail-Adresse eingetragen.')),
          h('li', {}, h('div', {}, h('span', {}, 'PDF teilen, Mail auswählen, Adressen bei „An“ einsetzen, senden.'), knopf('Per E-Mail senden', () => teilen(pdfDaten, betreff(), mailtext()), 'pri gross', 'teilen')))),
        h('div', { class: 'knopfzeile' }, knopf('PDF sichern', () => laden(pdfDaten)), knopf('Neu erstellen', () => { pdfDaten = null; malen(); }))));
    };
    if (pdfDaten) zeigePdf(); else box.append(knopf('PDF erstellen', los, 'pri gross'));
    return [
      !fertig('unterschrift') && h('div', { class: 'tipp' }, 'Es fehlen noch Unterschriften. Das PDF lässt sich trotzdem als Entwurf erstellen.'),
      ohne.length > 0 && h('div', { class: 'tipp' }, 'Ohne E-Mail-Adresse: ' + ohne.join(', ')),
      karte(h('h2', {}, 'Protokoll verschicken'), box, h('div', { class: 'knopfzeile' }, knopf('Vorschau ansehen', vorschau))),
      karte(h('h2', {}, 'Weitergeben und sichern'), h('p', { class: 'klein' }, 'Die Sicherungsdatei enthält alles samt Fotos. Damit wechselt das Protokoll zum Beispiel per AirDrop vom iPhone aufs iPad: dort „Datei öffnen“ tippen.'),
        h('div', { class: 'knopfzeile' }, knopf('Sicherungsdatei erstellen', async e => {
          const b = e.currentTarget; b.disabled = true;
          try { await jetztSichern(); const blob = await exportieren(P); const f = new File([blob], dateiname(P, 'json'), { type: 'application/json' }); b.replaceWith(knopf('Sicherungsdatei teilen', () => teilen(f, 'Sicherung ' + betreff()), 'pri', 'teilen')); } catch (x) { b.disabled = false; fehler(x, 'Die Sicherung konnte nicht erstellt werden.'); }
        }), P.art === 'auszug' && knopf('Einzugsprotokoll daraus anlegen', einzugAnlegen))),
      karte(h('h2', {}, 'Löschen'), h('div', { class: 'knopfzeile' }, knopf('Protokoll löschen', async () => {
        if (!await frage('Protokoll endgültig löschen?', 'Alle Angaben, Fotos und Unterschriften werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.', 'Endgültig löschen', true)) return;
        await jetztSichern(); const p = P; P = null; await DB.weg(p.id); await fotosWeg(alleFotoIds(p)); gehe();
      }, 'gefahr', 'weg')))
    ];
  }
};
let pdfDaten = null;
const betreff = () => `${P.art === 'auszug' ? 'Abnahmeprotokoll' : 'Übergabeprotokoll'} ${adresse(P)}, ${datumDe(P.termin.datum)}`;
const mailtext = () => `Guten Tag,\n\nanbei das ${P.art === 'auszug' ? 'Abnahmeprotokoll' : 'Übergabeprotokoll'} der Wohnung ${adresse(P)} vom ${datumDe(P.termin.datum)}.\n\nMit freundlichen Grüßen\n${(P.personen.find(x => /Vermieter/.test(x.rolle)) || {}).name || ''}`;

function wahl(werte, obj, key, name) {
  const g = h('div', { class: 'wahl', role: 'group', 'aria-label': name });
  const mal = () => g.replaceChildren(...werte.map(([w, t]) => h('button', { type: 'button', class: 'w-' + w + (obj[key] === w ? ' an' : ''), 'aria-pressed': String(obj[key] === w), disabled: gesperrt(), onclick: () => { obj[key] = obj[key] === w ? '' : w; speichern(); mal(); g.dispatchEvent(new CustomEvent('gewaehlt', { detail: obj[key] })); } }, t)));
  mal(); return g;
}
const offen = new Set();
function raumKarte(r) {
  const z = h('span', { class: 'leise' });
  const zaehle = () => { const o = r.punkte.filter(x => !x.status).length; z.textContent = [r.maengel.length ? r.maengel.length + (r.maengel.length === 1 ? ' Mangel' : ' Mängel') : '', o ? o + ' offen' : 'geprüft'].filter(Boolean).join(' · '); };
  zaehle();
  if (!offen.has(r.id)) return h('button', { type: 'button', class: 'eintrag raum', onclick: () => { offen.add(r.id); malenHier(); } }, h('span', { class: 'e-haupt' }, h('b', {}, r.name || 'Raum')), h('span', { class: 'e-neben' }, z), icon('weiter'));
  return karte(h('div', { class: 'karte-kopf' }, h('button', { type: 'button', class: 'titel-kn', 'aria-expanded': 'true', onclick: () => { offen.delete(r.id); malenHier(); } }, h('h2', {}, r.name || 'Raum'), z), wegKnopf('Raum', () => entferne(P.raeume, r, 'Raum', [...r.fotos, ...r.maengel.flatMap(m => m.fotos)]))),
    feld('Bezeichnung', r, 'name'),
    !gesperrt() && r.punkte.some(x => !x.status) && knopf('Alle offenen Punkte ohne Mangel', () => { r.punkte.forEach(x => { if (!x.status) x.status = 'ok'; }); speichern(); malenHier(); }, '', 'haken'),
    h('div', { class: 'punkte' }, r.punkte.map(x => {
      const w = wahl([['ok', 'OK'], ['mangel', 'Mangel'], ['entfaellt', 'Entfällt']], x, 'status', x.name);
      w.addEventListener('gewaehlt', e => {
        if (e.detail === 'mangel' && !r.maengel.some(m => m.punkt === x.name)) { r.maengel.push({ id: uid(), punkt: x.name, text: '', wer: '', frist: '', kosten: '', fotos: [] }); speichern(); malenHier(); const m = document.getElementById('m' + r.maengel[r.maengel.length - 1].id); if (m) { m.scrollIntoView({ block: 'center' }); m.querySelector('textarea').focus(); } }
        else zaehle();
      });
      return h('div', { class: 'fest' }, h('span', {}, x.name), w);
    })),
    r.maengel.map(m => h('div', { class: 'mangel', id: 'm' + m.id }, h('div', { class: 'karte-kopf' }, h('h3', {}, 'Mangel' + (m.punkt ? ': ' + m.punkt : '')), wegKnopf('Mangel', async () => {
      if (!await frage('Mangel entfernen?', 'Beschreibung und Fotos dazu werden gelöscht.', 'Entfernen', true)) return;
      r.maengel.splice(r.maengel.indexOf(m), 1); const q = r.punkte.find(x => x.name === m.punkt); if (q && q.status === 'mangel' && !r.maengel.some(y => y.punkt === m.punkt)) q.status = '';
      await speichern(true); await fotosWeg(m.fotos); malenHier();
    })),
      feld('Beschreibung', m, 'text', { typ: 'lang', zeilen: 2 }),
      reihe(feld('Beseitigung durch', m, 'wer', { auswahl: ['Mieter', 'Vermieter', 'Nachmieter übernimmt'], leer: 'offen' }), feld('Frist', m, 'frist', { typ: 'date' }), feld('Kosten ca. (€)', m, 'kosten', { modus: 'decimal' })),
      fotoLeiste(m.fotos, 'Mangel fotografieren'))),
    !gesperrt() && knopf('Weiteren Mangel eintragen', () => { r.maengel.push({ id: uid(), punkt: '', text: '', wer: '', frist: '', kosten: '', fotos: [] }); speichern(); malenHier(); }, '', 'plus'),
    feld('Bemerkung zum Raum', r, 'bemerkung', { typ: 'lang', zeilen: 2 }),
    h('h3', {}, 'Fotos vom Raum'), fotoLeiste(r.fotos, 'Raum fotografieren'));
}
function malenHier() { const y = scrollY; malen(); scrollTo(0, y); }
function offenes() {
  const l = ABSCHNITTE.slice(0, 6).filter(([k]) => !fertig(k));
  return !gesperrt() && l.length ? h('div', { class: 'tipp' }, h('span', {}, 'Noch nicht vollständig: '), l.map(([k, t]) => knopf(t, () => gehe(P.id, k), 'klein-b'))) : null;
}

/* ---------- Vorschau ---------- */
async function vorschau() {
  await jetztSichern();
  const bl = await bauDokument(P), k = h('div', { class: 'blatt' });
  for (const b of bl) {
    if (b.t === 'titel') k.append(h('h1', {}, b.text), h('p', { class: 'leise' }, b.sub));
    else if (b.t === 'h') k.append(h('h2', {}, b.text));
    else if (b.t === 'h2') k.append(h('h3', {}, b.text));
    else if (b.t === 'p') k.append(h('p', { class: 'vt' }, b.text));
    else if (b.t === 'kv') k.append(h('dl', {}, b.rows.map(([a, w]) => [h('dt', {}, a), h('dd', {}, w)])));
    else if (b.t === 'table') k.append(h('div', { class: 'tab' }, h('table', {}, h('thead', {}, h('tr', {}, b.cols.map(c => h('th', {}, c[0])))), h('tbody', {}, b.rows.map(r => h('tr', {}, r.map(z => h('td', { class: 'vt' }, z))))))));
    else if (b.t === 'sign') k.append(h('div', { class: 'vsig' }, b.items.map(it => {
      const c = h('canvas', { width: 600, height: it.u && !it.u.verweigert ? Math.round(600 * it.u.verh) : 120 }); if (it.u && !it.u.verweigert) zeichneStriche(c.getContext('2d'), it.u.striche, c.width, c.height);
      return h('div', {}, c, h('b', {}, it.name), h('span', { class: 'leise' }, it.rolle), h('span', { class: 'leise' }, it.u ? (it.u.verweigert ? 'Unterschrift verweigert. ' + it.u.grund : zeitDe(it.u.zeit)) : 'noch nicht unterschrieben'));
    })));
    else if (b.t === 'fotos') k.append(h('div', { class: 'vfotos' }, b.items.map(it => { const im = h('img', { alt: '', loading: 'lazy' }); fotoUrl(it.id).then(u => { im.src = u; }); return h('figure', {}, im, h('figcaption', {}, `Foto ${it.nr}: ${it.wo}` + (it.text ? ' · ' + it.text : ''))); })));
  }
  await dialog('Vorschau', k, [{ text: 'Schließen', wert: true, kl: 'pri' }], 'voll');
}

/* ---------- Unterschrift ---------- */
function unterschreiben(x) {
  const striche = []; let akt = null, stiftDa = false, aktivId = null;
  const c = h('canvas', { class: 'sig', 'aria-label': 'Unterschriftsfeld' }), k = c.getContext('2d');
  const ok = h('button', { type: 'button', class: 'btn pri gross', disabled: true }, 'Unterschrift übernehmen');
  const ort = h('input', { type: 'text', 'aria-label': 'Ort' }); ort.value = P.objekt.ort || '';
  const neu = () => { k.clearRect(0, 0, c.width, c.height); zeichneStriche(k, striche, c.width, c.height); };
  const groesse = () => { const r = c.getBoundingClientRect(), f = Math.min(3, devicePixelRatio || 1); if (!r.width) return; c.width = Math.round(r.width * f); c.height = Math.round(r.height * f); verh = r.height / r.width; neu(); };
  let verh = 0.4;
  const pkt = e => { const r = c.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), e.pointerType === 'pen' && e.pressure ? Math.min(1, e.pressure) : 0.45].map(v => Math.round(v * 1e4) / 1e4); };
  const laenge = () => striche.reduce((s, z) => s + z.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - z[i - 1][0], (q[1] - z[i - 1][1]) * verh) : 0), 0), 0);
  c.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'pen' && !stiftDa) {
      /* Stift erkannt: Handballen und Finger zählen ab jetzt nicht mehr, auch nicht ein gerade begonnener Fingerstrich. */
      stiftDa = true; if (akt) { striche.pop(); akt = null; aktivId = null; neu(); }
    }
    if ((e.pointerType === 'touch' && stiftDa) || aktivId !== null) return;
    aktivId = e.pointerId; try { c.setPointerCapture(e.pointerId); } catch (x) { /* ohne Belang */ }
    akt = [pkt(e)]; striche.push(akt);
  });
  c.addEventListener('pointermove', e => {
    if (e.pointerId !== aktivId || !akt) return; e.preventDefault();
    const l = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const q of (l.length ? l : [e])) { akt.push(pkt(q)); zeichneStriche(k, [akt.slice(-2)], c.width, c.height); }
  });
  const ende = e => { if (e.pointerId !== aktivId) return; if (akt && akt.length === 1) neu(); akt = null; aktivId = null; ok.disabled = laenge() < 0.12; };
  c.addEventListener('pointerup', ende); c.addEventListener('pointercancel', ende);
  ['touchstart', 'touchmove', 'contextmenu', 'selectstart'].forEach(t => c.addEventListener(t, e => e.preventDefault(), { passive: false }));
  const zu = () => { huelle.remove(); ro.disconnect(); document.documentElement.classList.remove('fest'); };
  ok.addEventListener('click', async () => {
    ok.disabled = true;
    P.unterschriften[x.id] = { zeit: new Date().toISOString(), ort: ort.value.trim(), striche, verh, verweigert: false, grund: '' };
    P.pdfZeit = ''; pdfDaten = null; await speichern(true); zu(); malenHier(); toast('Unterschrift gespeichert');
  });
  const huelle = h('div', { class: 'sig-huelle', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Unterschrift ' + x.name },
    h('div', { class: 'sig-kopf' }, h('div', {}, h('h2', {}, x.name), h('span', {}, `${x.rolle} · ${P.art === 'auszug' ? 'Abnahmeprotokoll' : 'Übergabeprotokoll'} ${P.objekt.strasse}`)), h('button', { type: 'button', class: 'rund', 'aria-label': 'Schließen', onclick: zu }, icon('kreuz'))),
    h('p', { class: 'sig-text' }, 'Ich habe das Protokoll gelesen. Es gibt den festgestellten Zustand richtig wieder.'),
    h('div', { class: 'sig-feld' }, c, h('div', { class: 'sig-linie' }, 'Hier unterschreiben')),
    h('div', { class: 'sig-fuss' }, h('label', { class: 'sig-ort' }, 'Ort', ort), knopf('Löschen', () => { striche.length = 0; akt = null; neu(); ok.disabled = true; }), ok));
  document.documentElement.classList.add('fest'); document.body.append(huelle);
  const ro = new ResizeObserver(groesse); ro.observe(c); groesse();
}
async function verweigert(x) {
  const t = h('textarea', { rows: '3', 'aria-label': 'Grund', placeholder: 'Grund' });
  if (!await dialog('Unterschrift verweigert', [h('p', {}, `${x.name} unterschreibt nicht. Das wird im Protokoll vermerkt.`), t], [{ text: 'Abbrechen', wert: false }, { text: 'Vermerken', wert: true, kl: 'pri' }])) return;
  P.unterschriften[x.id] = { zeit: new Date().toISOString(), ort: P.objekt.ort, striche: [], verh: 0.4, verweigert: true, grund: t.value.trim() };
  P.pdfZeit = ''; pdfDaten = null; await speichern(true); malenHier();
}

/* ---------- Teilen ---------- */
function laden(f) { const u = URL.createObjectURL(f), a = h('a', { href: u, download: f.name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
async function teilen(f, titel, text) {
  let d = { files: [f], title: titel }; if (text) d.text = text;
  if (navigator.canShare && !navigator.canShare(d) && f.type === 'application/json') d = { files: [new File([f], f.name + '.txt', { type: 'text/plain' })], title: titel };
  if (navigator.canShare && navigator.canShare(d)) { try { await navigator.share(d); } catch (e) { if (e.name !== 'AbortError') laden(f); } } else laden(f);
}
async function einzugAnlegen() {
  if (!await frage('Einzugsprotokoll anlegen?', 'Wohnung, Zähler, Räume, Mängel und Fotos werden übernommen. Mieterdaten, Anschriften und Unterschriften des bisherigen Mieters nicht.', 'Anlegen')) return;
  try {
    await jetztSichern();
    const a = pruefeProtokoll(JSON.parse(JSON.stringify(P))), n = neuesProtokoll('einzug');
    n.objekt = a.objekt; n.termin = { datum: a.termin.datum, beginn: '', ende: '' }; n.zaehler = a.zaehler; n.raeume = a.raeume; n.schluessel = a.schluessel.map(s => ({ ...s, id: uid(), anzahl: '', bemerkung: '' }));
    n.raeume.forEach(r => r.maengel.forEach(m => { m.kosten = ''; }));
    n.personen = [...a.personen.filter(x => /Vermieter/.test(x.rolle)).map(x => ({ ...x, id: uid() })), neuePerson('Mieter (Einzug)')];
    await fotosKopieren(n); await DB.sichere(n); gehe(n.id, 'personen'); toast('Einzugsprotokoll angelegt');
  } catch (e) { fehler(e, 'Das Einzugsprotokoll konnte nicht angelegt werden.'); }
}

/* ---------- Wege ---------- */
function gehe(id, k) { const z = id ? `#/${id}/${k}` : '#/'; if (location.hash === z) weg(); else location.hash = z; }
function weg() {
  document.querySelectorAll('.huelle,.sig-huelle').forEach(e => e.remove()); document.documentElement.classList.remove('fest');
  const m = /^#\/([^/]+)\/(\w+)/.exec(location.hash); if (m) zeigeProtokoll(m[1], m[2]); else zeigeListe();
}
window.addEventListener('hashchange', weg);
weg();
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(e => console.warn(e));
