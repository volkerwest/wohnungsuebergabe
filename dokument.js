'use strict';
/* Baut aus einem Protokoll Blöcke. Vorschau und PDF zeigen dadurch genau dasselbe. */
const datumDe = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || ''); };
const zeitDe = iso => { const d = new Date(iso); if (!iso || isNaN(d)) return ''; const z = n => String(n).padStart(2, '0'); return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}, ${z(d.getHours())}:${z(d.getMinutes())} Uhr`; };
const adresse = p => [p.objekt.strasse, [p.objekt.plz, p.objekt.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');

async function bauDokument(p) {
  const b = [], fotos = []; let nrM = 0;
  const merke = async (ids, wo) => {
    const nrn = [];
    for (const id of ids) {
      const f = await DB.foto(id); if (!f) continue;
      fotos.push({ id, nr: fotos.length + 1, wo, text: f.text || '', zeit: f.zeit }); nrn.push(fotos.length);
    }
    return nrn.length ? (nrn.length > 1 ? 'Fotos ' : 'Foto ') + nrn.join(', ') : '';
  };
  const o = p.objekt, kv = r => r.filter(x => x[1]);
  b.push({ t: 'titel', text: p.art === 'auszug' ? 'Abnahmeprotokoll' : 'Übergabeprotokoll', sub: p.art === 'auszug' ? 'Rückgabe der Wohnung beim Auszug' : 'Übergabe der Wohnung beim Einzug' });
  b.push({ t: 'kv', rows: kv([
    ['Objekt', adresse(p)], ['Wohnung', [o.wohnung, o.lage].filter(Boolean).join(', ')],
    ['Termin', [datumDe(p.termin.datum), [p.termin.beginn, p.termin.ende].filter(Boolean).join(' bis ')].filter(Boolean).join(', ') + (p.termin.beginn || p.termin.ende ? ' Uhr' : '')],
    ['Mietbeginn', datumDe(p.miete.beginn)], ['Mietende', p.art === 'auszug' ? datumDe(p.miete.ende) : ''],
    ['Kaution', p.miete.kaution], ['Neue Anschrift des Mieters', p.art === 'auszug' ? p.miete.neueAnschrift : '']
  ]) });

  b.push({ t: 'h', text: 'Beteiligte' });
  b.push({ t: 'table', cols: [['Rolle', 0.19], ['Name', 0.23], ['Anschrift', 0.27], ['Kontakt', 0.31]],
    rows: p.personen.filter(x => x.name || x.email).map(x => [x.rolle, x.name, x.anschrift, [x.email, x.tel].filter(Boolean).join('\n')]) });

  if (p.zaehler.length) {
    const rows = [];
    for (const z of p.zaehler) rows.push([z.art + (z.ort ? '\n' + z.ort : ''), z.nummer, z.stand ? (z.stand + ' ' + z.einheit).trim() : 'nicht abgelesen', [z.bemerkung, await merke(z.fotos, 'Zähler ' + z.art + (z.nummer ? ', Nr. ' + z.nummer : ''))].filter(Boolean).join('\n')]);
    b.push({ t: 'h', text: 'Zählerstände' }, { t: 'table', cols: [['Zähler', 0.28], ['Zählernummer', 0.24], ['Stand', 0.22], ['Bemerkung', 0.26]], rows });
  }

  b.push({ t: 'h', text: 'Räume und Zustand' });
  for (const r of p.raeume) {
    b.push({ t: 'h2', text: r.name || 'Raum' });
    const gr = s => r.punkte.filter(x => x.status === s).map(x => x.name).join(', ');
    const zeilen = kv([['Ohne Mangel', gr('ok')], ['Mit Mangel', gr('mangel')], ['Nicht vorhanden', gr('entfaellt')], ['Nicht geprüft', gr('')], ['Bemerkung', r.bemerkung]]);
    if (zeilen.length) b.push({ t: 'kv', rows: zeilen });
    if (r.maengel.length) {
      const rows = [];
      for (const m of r.maengel) {
        nrM++;
        rows.push(['M' + nrM, (m.punkt ? m.punkt + ': ' : '') + (m.text || 'ohne Beschreibung') + nl(await merke(m.fotos, `${r.name}, Mangel M${nrM}${m.punkt ? ', ' + m.punkt : ''}`)),
          m.wer || 'offen', [m.frist ? 'bis ' + datumDe(m.frist) : '', m.kosten ? 'ca. ' + m.kosten + ' €' : ''].filter(Boolean).join('\n')]);
      }
      b.push({ t: 'table', cols: [['Nr.', 0.07], ['Mangel', 0.53], ['Beseitigung durch', 0.2], ['Frist / Kosten', 0.2]], rows });
    }
    const rf = await merke(r.fotos, r.name);
    if (rf) b.push({ t: 'p', text: 'Zustand: ' + rf });
  }
  if (!nrM) b.push({ t: 'p', text: 'Es wurden keine Mängel eingetragen.' });

  if (p.ergaenzungen || (p.fotosNeu && p.fotosNeu.length)) {
    b.push({ t: 'h', text: 'Ergänzungen bei der Übergabe' });
    if (p.ergaenzungen) b.push({ t: 'p', text: p.ergaenzungen });
    const ef = await merke(p.fotosNeu, 'Ergänzung bei der Übergabe'); if (ef) b.push({ t: 'p', text: ef });
  }
  const sl = p.schluessel.filter(s => s.anzahl || s.nummer || s.bemerkung);
  const sf = await merke(p.schluesselFotos, 'Schlüssel');
  if (sl.length || sf) {
    b.push({ t: 'h', text: p.art === 'auszug' ? 'Zurückgegebene Schlüssel' : 'Übergebene Schlüssel' });
    if (sl.length) b.push({ t: 'table', cols: [['Schlüssel', 0.34], ['Anzahl', 0.12], ['Nummer', 0.22], ['Bemerkung', 0.32]], rows: sl.map(s => [s.art, s.anzahl, s.nummer, s.bemerkung]) });
    if (sf) b.push({ t: 'p', text: sf });
  }
  const fs = p.feststellungen.filter(f => f.wert);
  if (fs.length) b.push({ t: 'h', text: 'Feststellungen' }, { t: 'table', cols: [['Punkt', 0.8], ['Ergebnis', 0.2]], rows: fs.map(f => [f.text, f.wert === 'ja' ? 'Ja' : 'Nein']) });
  if (p.vereinbarungen) b.push({ t: 'h', text: 'Vereinbarungen und Bemerkungen' }, { t: 'p', text: p.vereinbarungen });
  if (p.schlusstext) b.push({ t: 'h', text: 'Hinweise' }, { t: 'p', text: p.schlusstext });
  b.push({ t: 'h', text: 'Unterschriften' });
  b.push({ t: 'sign', items: p.personen.filter(x => x.name || p.unterschriften[x.id]).map(x => ({ name: x.name, rolle: x.rolle, u: p.unterschriften[x.id] || null })) });
  if (fotos.length) b.push({ t: 'h', text: 'Fotos', seite: true }, { t: 'fotos', items: fotos });
  return b;
}
const nl = s => (s ? '\n' + s : '');

function zeichneStriche(k, striche, b, h) {
  k.lineCap = k.lineJoin = 'round'; k.strokeStyle = '#0d1a59'; k.fillStyle = '#0d1a59';
  for (const z of striche) {
    if (z.length === 1) { k.beginPath(); k.arc(z[0][0] * b, z[0][1] * h, Math.max(1, b * 0.003), 0, 7); k.fill(); continue; }
    for (let i = 1; i < z.length; i++) {
      k.beginPath(); k.lineWidth = b * 0.0022 + b * 0.0042 * z[i][2];
      k.moveTo(z[i - 1][0] * b, z[i - 1][1] * h); k.lineTo(z[i][0] * b, z[i][1] * h); k.stroke();
    }
  }
}

const bauPdf = async (p, meldung) => { const d = await bauPdfDok(p, meldung); return d.fertig(d.titel); };
async function bauPdfDok(p, meldung) {
  const bloecke = await bauDokument(p), abdruck = await fingerabdruck(p);
  const d = new PDF_B.Dokument(), L = 50, R = d.B - 50, BR = R - L, UNTEN = d.H - 62;
  const grau = [0.38, 0.44, 0.48], petrol = [0.05, 0.37, 0.4];
  let y = 60;
  const platz = h => { if (y + h > UNTEN) { d.neueSeite(); y = 56; } };
  const absatz = (text, gr, opt) => { for (const z of PDF_B.umbruch(text, BR, gr, opt && opt.fett)) { platz(gr * 1.45); d.text(L, y + gr, z, gr, opt); y += gr * 1.45; } };
  const zeile = (zellen, breiten, gr, kopf, kopfzeile) => {
    const zl = zellen.map((t, i) => PDF_B.umbruch(t, breiten[i] - 8, gr, kopf));
    const lh = gr * 1.4; let rest = zl;
    /* Sehr lange Zellen laufen auf der nächsten Seite weiter. */
    while (rest.some(z => z.length)) {
      const n = Math.max(...rest.map(z => z.length));
      if (n * lh + 10 > UNTEN - y && (n <= 12 || UNTEN - y < 5 * lh)) { d.neueSeite(); y = 56; if (kopfzeile) kopfzeile(); }
      const passt = Math.max(1, Math.min(n, Math.floor((UNTEN - y - 10) / lh)));
      const h = passt * lh + 10;
      if (kopf) d.flaeche(L, y, BR, h, [0.92, 0.95, 0.95]);
      let x = L;
      rest.forEach((z, i) => { z.slice(0, passt).forEach((t, j) => d.text(x + 4, y + 5 + gr + j * lh - 0.5, t, gr, { fett: !!kopf, farbe: kopf ? grau : undefined })); x += breiten[i]; });
      y += h; d.linie(L, y, R, y, 0.4);
      rest = rest.map(z => z.slice(passt));
    }
  };
  let nrBlock = 0;
  for (const b of bloecke) {
    nrBlock++;
    if (b.t === 'titel') {
      d.flaeche(L, y - 4, 34, 3, petrol); y += 8;
      absatz(b.text, 22, { fett: true }); absatz(b.sub, 11, { farbe: grau }); y += 10;
    } else if (b.t === 'h') {
      if (b.seite) { d.neueSeite(); y = 56; } else { y += 14; platz(b.text === 'Unterschriften' ? 160 : 70); }
      absatz(b.text, 14, { fett: true, farbe: petrol }); y += 3;
    } else if (b.t === 'h2') {
      y += 8; platz(54); absatz(b.text, 11.5, { fett: true }); y += 1;
    } else if (b.t === 'kv') {
      for (const [k, v] of b.rows) {
        const zl = PDF_B.umbruch(v, BR - 140, 10.5); const kl = PDF_B.umbruch(k, 130, 10.5);
        for (let i = 0; i < Math.max(zl.length, kl.length); i++) {
          platz(16);
          if (kl[i]) d.text(L, y + 10.5, kl[i], 10.5, { farbe: grau });
          if (zl[i]) d.text(L + 140, y + 10.5, zl[i], 10.5);
          y += 15;
        }
      }
      y += 3;
    } else if (b.t === 'table') {
      const br = b.cols.map(c => c[1] * BR);
      const kopf = () => zeile(b.cols.map(c => c[0]), br, 9, true);
      platz(62); y += 2; kopf();
      for (const r of b.rows) zeile(r, br, 10, false, kopf);
      y += 4;
    } else if (b.t === 'p') { absatz(b.text, 10.5); y += 2; }
    else if (b.t === 'sign') {
      const sb = (BR - 24) / 2; let sp = 0, zeileY = 0;
      for (const it of b.items) {
        if (sp === 0) { platz(134); zeileY = y; }
        const x = L + sp * (sb + 24);
        if (it.u && !it.u.verweigert) {
          const bx = Math.min(sb, 78 / it.u.verh), hy = bx * it.u.verh;
          for (const z of it.u.striche) {
            if (z.length === 1) d.strich(x + z[0][0] * bx, zeileY + 80 - hy + z[0][1] * hy, x + z[0][0] * bx + 0.1, zeileY + 80 - hy + z[0][1] * hy, 1.4);
            for (let i = 1; i < z.length; i++) d.strich(x + z[i - 1][0] * bx, zeileY + 80 - hy + z[i - 1][1] * hy, x + z[i][0] * bx, zeileY + 80 - hy + z[i][1] * hy, bx * 0.0022 + bx * 0.0042 * z[i][2]);
          }
        } else if (it.u) {
          let yy = zeileY + 40; d.text(x, yy, 'Unterschrift verweigert', 10, { fett: true });
          for (const z of PDF_B.umbruch(it.u.grund, sb, 8.5).slice(0, 4)) { yy += 11; d.text(x, yy, z, 8.5); }
        }
        d.linie(x, zeileY + 84, x + sb, zeileY + 84, 0.7, [0.3, 0.35, 0.38]);
        d.text(x, zeileY + 96, PDF_B.umbruch(it.name, sb, 10.5, true)[0], 10.5, { fett: true });
        d.text(x, zeileY + 108, it.rolle, 9.5, { farbe: grau });
        d.text(x, zeileY + 119, it.u ? [it.u.ort, zeitDe(it.u.zeit)].filter(Boolean).join(', ') : 'noch nicht unterschrieben', 9.5, { farbe: grau });
        sp = 1 - sp; if (sp === 0) y = zeileY + 134;
      }
      if (sp === 1) y = zeileY + 134;
    } else if (b.t === 'fotos') {
      const viele = b.items.length > 40, fb = (BR - 16) / 2, fh = 200;
      for (let i = 0; i < b.items.length; i += 2) {
        if (meldung) meldung(`Foto ${i + 1} von ${b.items.length}`);
        const paar = []; let hoch = 0;
        for (const it of b.items.slice(i, i + 2)) {
          const f = await DB.foto(it.id); if (!f) continue;
          const j = await zuJpeg(new Blob([f.daten], { type: 'image/jpeg' }), viele ? 900 : 1200, viele ? 0.65 : 0.72), s = Math.min(fb / j.w, fh / j.h);
          paar.push({ it, j, s }); hoch = Math.max(hoch, j.h * s);
        }
        platz(hoch + 46);
        paar.forEach(({ it, j, s }, q) => {
          const x = L + q * (fb + 16); let yy = y + hoch + 12;
          d.bild(d.bildDazu(new Uint8Array(j.daten), j.w, j.h), x, y, j.w * s, j.h * s);
          for (const z of PDF_B.umbruch(`Foto ${it.nr}: ${it.wo}`, fb, 9.5, true).slice(0, 2)) { d.text(x, yy, z, 9.5, { fett: true }); yy += 12; }
          for (const z of PDF_B.umbruch([it.text, zeitDe(it.zeit)].filter(Boolean).join(' · '), fb, 9).slice(0, 2)) { d.text(x, yy, z, 9, { farbe: grau }); yy += 12; }
        });
        y += hoch + 52;
      }
    }
  }
  const n = d.seiten.length;
  d.seiten.forEach((s, i) => {
    d.s = s; d.linie(L, d.H - 46, R, d.H - 46, 0.4);
    d.text(L, d.H - 34, PDF_B.umbruch(`${adresse(p)}${p.objekt.wohnung ? ', ' + p.objekt.wohnung : ''} · ${datumDe(p.termin.datum)}`, BR - 80, 8)[0], 8, { farbe: grau });
    const t = `Seite ${i + 1} von ${n}`; d.text(R - PDF_B.breite(t, 8), d.H - 34, t, 8, { farbe: grau });
    d.text(L, d.H - 23, 'Prüfsumme ' + abdruck, 6, { farbe: [0.6, 0.64, 0.67] });
  });
  d.titel = `${p.art === 'auszug' ? 'Abnahmeprotokoll' : 'Übergabeprotokoll'} ${adresse(p)}`;
  return d;
}
function dateiname(p, endung) {
  const s = `${p.termin.datum || heute()}_${p.art === 'auszug' ? 'Abnahmeprotokoll' : p.art === 'einzug' ? 'Uebergabeprotokoll' : 'Abnahme-und-Uebergabe'}_${p.objekt.strasse || 'Wohnung'}`;
  return s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+$/, '') + '.' + endung;
}
