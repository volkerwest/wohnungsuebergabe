'use strict';
/* Kleiner PDF-Schreiber ohne Fremdbibliothek: A4, Helvetica, JPEG-Bilder, Linien. */
const PDF_B = (() => {
  const N = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const EXTRA = { 'ß': 611, '€': 556, '§': 556, '°': 400, '²': 333, '³': 333, '–': 556, '—': 1000, '•': 350, '„': [333, 500], '“': [333, 500], '”': [333, 500], '‚': [222, 278], '‘': [222, 278], '’': [222, 278], '…': 1000, '·': 278, '×': 584, '½': 834, '¼': 834, 'æ': 889, 'Æ': 1000, 'ø': [556, 611], 'Ø': 778, 'œ': 944, 'Œ': 1000, '™': 1000, '©': 737, '®': 737, '±': 584, 'µ': 556, '«': 556, '»': 556, '‰': 1000, ' ': 278 };
  const W = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
  const code = c => { const n = c.codePointAt(0); if (n >= 32 && n < 127) return n; if (n >= 0xa0 && n <= 0xff) return n; return W[c] || 0; };
  const geht = s => { for (const c of s) if (!code(c)) return false; return true; };
  const hex = s => { let r = ''; for (const c of s) r += code(c).toString(16).padStart(2, '0'); return r; };
  const n2 = x => (Math.round(x * 100) / 100).toString();
  let mess = null;
  const ctxFuer = () => (mess || (mess = document.createElement('canvas').getContext('2d')));
  function breite(s, gr, fett) {
    if (!geht(s)) { const k = ctxFuer(); k.font = (fett ? 'bold ' : '') + '100px Helvetica, Arial, sans-serif'; return k.measureText(s).width * gr / 100; }
    const T = fett ? B : N; let b = 0;
    for (const c of s) {
      const n = c.codePointAt(0);
      if (n < 127) b += T[n - 32];
      else if (EXTRA[c]) b += Array.isArray(EXTRA[c]) ? EXTRA[c][fett ? 1 : 0] : EXTRA[c];
      else { const g = c.normalize('NFD').charCodeAt(0); b += (g >= 32 && g < 127) ? T[g - 32] : 556; }
    }
    return b * gr / 1000;
  }
  function umbruch(text, maxB, gr, fett) {
    const aus = [];
    const rein = String(text == null ? '' : text).replace(/\r/g, '').replace(/\t/g, ' ').normalize('NFC');
    for (const absatz of rein.split('\n')) {
      let zeile = '';
      for (let wort of absatz.split(' ')) {
        const probe = zeile ? zeile + ' ' + wort : wort;
        if (breite(probe, gr, fett) <= maxB) { zeile = probe; continue; }
        if (zeile) aus.push(zeile);
        while (breite(wort, gr, fett) > maxB && Array.from(wort).length > 1) {
          const z = Array.from(wort); let i = z.length;
          while (i > 1 && breite(z.slice(0, i).join(''), gr, fett) > maxB) i--;
          aus.push(z.slice(0, i).join('')); wort = z.slice(i).join('');
        }
        zeile = wort;
      }
      aus.push(zeile);
    }
    return aus;
  }

  class Dokument {
    constructor() { this.B = 595.28; this.H = 841.89; this.seiten = []; this.bilder = []; this.neueSeite(); }
    neueSeite() { this.s = { ops: [], bilder: new Set() }; this.seiten.push(this.s); }
    farbe(f) { return f.map(x => n2(x)).join(' '); }
    text(x, y, s, gr, opt) {
      const { fett = false, farbe = [0.1, 0.13, 0.16] } = opt || {};
      s = String(s); if (!s) return;
      if (!geht(s)) { this.textBild(x, y, s, gr, fett, farbe); return; }
      this.s.ops.push('BT /' + (fett ? 'F2' : 'F1') + ` ${n2(gr)} Tf ${this.farbe(farbe)} rg ${n2(x)} ${n2(this.H - y)} Td <${hex(s)}> Tj ET`);
    }
    /* Zeichen, die Helvetica nicht kennt (z. B. ł, ş), werden als Bild gesetzt. */
    textBild(x, y, s, gr, fett, farbe) {
      const f = 4, b = breite(s, gr, fett) + 2, h = gr * 1.4;
      const c = document.createElement('canvas'); c.width = Math.ceil(b * f); c.height = Math.ceil(h * f);
      const k = c.getContext('2d'); k.fillStyle = '#fff'; k.fillRect(0, 0, c.width, c.height);
      k.fillStyle = `rgb(${farbe.map(v => Math.round(v * 255)).join(',')})`;
      k.font = (fett ? 'bold ' : '') + gr * f + 'px Helvetica, Arial, sans-serif'; k.textBaseline = 'alphabetic';
      k.fillText(s, 0, gr * f);
      const roh = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
      const a = new Uint8Array(roh.length); for (let i = 0; i < roh.length; i++) a[i] = roh.charCodeAt(i);
      this.bild(this.bildDazu(a, c.width, c.height), x, y - gr, b, h);
    }
    linie(x1, y1, x2, y2, st = 0.5, farbe = [0.75, 0.78, 0.8]) {
      this.s.ops.push(`${this.farbe(farbe)} RG ${n2(st)} w ${n2(x1)} ${n2(this.H - y1)} m ${n2(x2)} ${n2(this.H - y2)} l S`);
    }
    strich(x1, y1, x2, y2, st) {
      this.s.ops.push(`1 J 1 j 0.05 0.1 0.35 RG ${n2(st)} w ${n2(x1)} ${n2(this.H - y1)} m ${n2(x2)} ${n2(this.H - y2)} l S`);
    }
    flaeche(x, y, b, h, farbe) { this.s.ops.push(`${this.farbe(farbe)} rg ${n2(x)} ${n2(this.H - y - h)} ${n2(b)} ${n2(h)} re f`); }
    bildDazu(bytes, w, h) { this.bilder.push({ bytes, w, h }); return this.bilder.length - 1; }
    bild(i, x, y, b, h) {
      this.s.bilder.add(i);
      this.s.ops.push(`q ${n2(b)} 0 0 ${n2(h)} ${n2(x)} ${n2(this.H - y - h)} cm /I${i} Do Q`);
    }
    fertig(titel) {
      const enc = new TextEncoder(), teile = [], pos = []; let laenge = 0;
      const raus = d => { const u = typeof d === 'string' ? enc.encode(d) : d; teile.push(u); laenge += u.length; };
      const obj = (nr, ...inh) => { pos[nr] = laenge; raus(`${nr} 0 obj\n`); inh.forEach(raus); raus('\nendobj\n'); };
      raus('%PDF-1.4\n'); raus(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
      const b0 = 6, s0 = b0 + this.bilder.length, anz = this.seiten.length;
      obj(1, '<< /Type /Catalog /Pages 2 0 R /Lang (de-DE) >>');
      obj(2, `<< /Type /Pages /Count ${anz} /Kids [${this.seiten.map((_, i) => `${s0 + 2 * i} 0 R`).join(' ')}] >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      let t16 = 'FEFF'; for (let i = 0; i < titel.length; i++) t16 += titel.charCodeAt(i).toString(16).padStart(4, '0');
      obj(5, `<< /Title <${t16}> /Producer (Wohnungsuebergabe) >>`);
      this.bilder.forEach((b, i) => obj(b0 + i, `<< /Type /XObject /Subtype /Image /Width ${b.w} /Height ${b.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${b.bytes.length} >>\nstream\n`, b.bytes, '\nendstream'));
      this.seiten.forEach((s, i) => {
        const x = [...s.bilder].map(k => `/I${k} ${b0 + k} 0 R`).join(' ');
        obj(s0 + 2 * i, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.B} ${this.H}] /Contents ${s0 + 2 * i + 1} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${x} >> >> >>`);
        const st = enc.encode(s.ops.join('\n'));
        obj(s0 + 2 * i + 1, `<< /Length ${st.length} >>\nstream\n`, st, '\nendstream');
      });
      const n = s0 + 2 * anz, x = laenge;
      raus(`xref\n0 ${n}\n0000000000 65535 f \n`);
      for (let i = 1; i < n; i++) raus(String(pos[i]).padStart(10, '0') + ' 00000 n \n');
      raus(`trailer\n<< /Size ${n} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${x}\n%%EOF\n`);
      return new Blob(teile, { type: 'application/pdf' });
    }
  }
  return { Dokument, breite, umbruch };
})();
