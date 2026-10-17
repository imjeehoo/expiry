// Minimal dependency-free .xlsx writer (single sheet, uncompressed zip).
// Cells: string -> inline string, number -> number, {date:[y,m,d]} -> real Excel date.
(function (global) {
  'use strict';

  const enc = new TextEncoder();

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Store-only zip. files: [{name, data: Uint8Array}]
  function zip(files) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(8, 0, true); // stored
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, f.data);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, dosTime, true);
      cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, size, true);
      cen.setUint32(24, size, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);

      offset += 30 + name.length + size;
    }

    const cenSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);

    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

  function colName(i) {
    let s = '';
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  function excelSerial(y, m, d) {
    return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
  }

  // rows: array of arrays; first row is the header. widths: column widths in chars.
  function build(rows, { sheetName = 'Sheet1', widths = [] } = {}) {
    const lastCol = colName(Math.max(...rows.map((r) => r.length)) - 1);
    const sheetRows = rows
      .map((row, r) => {
        const cells = row
          .map((v, c) => {
            const ref = colName(c) + (r + 1);
            const s = r === 0 ? ' s="1"' : '';
            if (v === null || v === undefined || v === '') return '';
            if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
            if (v && v.date) return `<c r="${ref}" s="2"><v>${excelSerial(...v.date)}</v></c>`;
            return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
          })
          .join('');
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join('');

    const cols = widths.length
      ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';

    const sheet =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      cols +
      `<sheetData>${sheetRows}</sheetData>` +
      (rows.length > 1 ? `<autoFilter ref="A1:${lastCol}${rows.length}"/>` : '') +
      `</worksheet>`;

    const styles =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>` +
      `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
      `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="3">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
      `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
      `</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`;

    const files = {
      '[Content_Types].xml':
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
      '_rels/.rels':
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
      'xl/workbook.xml':
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        (rows.length > 1
          ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(sheetName)}'!$A$1:$${lastCol}$${rows.length}</definedName></definedNames>`
          : '') +
        `</workbook>`,
      'xl/_rels/workbook.xml.rels':
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
      'xl/worksheets/sheet1.xml': sheet,
      'xl/styles.xml': styles,
    };

    return zip(Object.entries(files).map(([name, xml]) => ({ name, data: enc.encode(xml) })));
  }

  // ---------- reader ----------
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }

  // Returns { name: Uint8Array } for every entry in the zip (stored or deflated).
  async function unzip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Not a zip file');
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const dec = new TextDecoder();
    const out = {};
    for (let i = 0; i < count; i++) {
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const xlen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const raw = u8.subarray(start, start + csize);
      out[name] = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  const isDateFormat = (code) => /[ymd]/i.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, ''));

  function colIndex(ref) {
    let n = 0;
    for (const ch of ref.replace(/\d/g, '')) n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
  }

  function fromSerial(n) {
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return { date: [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()] };
  }

  // Reads the first sheet. Returns rows of strings / numbers / {date:[y,m,d]}.
  async function parse(buf) {
    const files = await unzip(buf);
    const dec = new TextDecoder();
    const xml = (name) => {
      if (!files[name]) return null;
      return new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml');
    };
    const text = (n) => [...n.getElementsByTagName('t')].map((t) => t.textContent).join('');

    const wb = xml('xl/workbook.xml');
    if (!wb) throw new Error('Not an xlsx file');
    const rels = xml('xl/_rels/workbook.xml.rels');
    const first = wb.getElementsByTagName('sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    let target = 'worksheets/sheet1.xml';
    for (const r of rels ? rels.getElementsByTagName('Relationship') : []) {
      if (r.getAttribute('Id') === rid) target = r.getAttribute('Target');
    }
    const sheetPath = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const sheet = xml(sheetPath);
    if (!sheet) throw new Error('Sheet not found');

    const sst = xml('xl/sharedStrings.xml');
    const shared = sst ? [...sst.getElementsByTagName('si')].map(text) : [];

    const customFmt = {};
    const styles = xml('xl/styles.xml');
    if (styles) for (const f of styles.getElementsByTagName('numFmt')) customFmt[f.getAttribute('numFmtId')] = f.getAttribute('formatCode');
    const xfIsDate = [];
    if (styles) {
      const xfs = styles.getElementsByTagName('cellXfs')[0];
      for (const xf of xfs ? xfs.getElementsByTagName('xf') : []) {
        const id = +xf.getAttribute('numFmtId');
        xfIsDate.push(BUILTIN_DATE_FMTS.has(id) || (customFmt[id] !== undefined && isDateFormat(customFmt[id])));
      }
    }

    const rows = [];
    for (const row of sheet.getElementsByTagName('row')) {
      const r0 = +row.getAttribute('r') - 1;
      const cells = [];
      for (const c of row.getElementsByTagName('c')) {
        const ref = c.getAttribute('r');
        const type = c.getAttribute('t');
        const vEl = c.getElementsByTagName('v')[0];
        const v = vEl ? vEl.textContent : null;
        let val = null;
        if (type === 'inlineStr') val = text(c);
        else if (v === null) val = null;
        else if (type === 's') val = shared[+v] ?? '';
        else if (type === 'str' || type === 'e') val = v;
        else if (type === 'b') val = v === '1' ? 1 : 0;
        else {
          const n = parseFloat(v);
          val = xfIsDate[+c.getAttribute('s') || 0] ? fromSerial(n) : n;
        }
        cells[ref ? colIndex(ref) : cells.length] = val;
      }
      rows[isNaN(r0) ? rows.length : r0] = Array.from(cells, (x) => (x === undefined ? null : x));
    }
    return Array.from(rows, (r) => r || []);
  }

  global.XLSX = { build, parse };
})(typeof window !== 'undefined' ? window : globalThis);
