// ═══════════════ 📊 CA / VAT EXPORT (v7.0.0) ═══════════════
// Reports → "📊 CA / VAT Export": महिना वा आर्थिक वर्ष छानेर Sales Register, Expense Register,
// Supplier Payables र VAT Summary १-क्लिकमा डाउनलोड।
//  • CSV: UTF-8 BOM सहित → Excel मा नेपाली अक्षर नबिग्रिने।
//  • Excel (.xls): सबै register एउटै workbook का छुट्टाछुट्टै sheet मा (SpreadsheetML, UTF-8)।
//  • हरेक row मा वि.सं. र ई.सं. दुवै मिति; माथि कम्पनीको नाम र PAN/VAT।
var CAExport = {
  BOM: '﻿',

  // ── period ──
  _bsOf: function (rec) {
    if (rec.dateBs && /^\d{4}-\d{2}-\d{2}$/.test(rec.dateBs)) return rec.dateBs;
    var ad = String(rec.date || rec.dateAd || rec.created || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ad)) {
      try { var p = ad.split('-').map(Number), b = adToBs(p[0], p[1], p[2]); return b.y + '-' + String(b.m).padStart(2, '0') + '-' + String(b.d).padStart(2, '0'); } catch (e) {}
    }
    if (rec.dateBs) { var m = String(rec.dateBs).match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/); if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); }
    return '';
  },
  _adOf: function (rec) {
    var ad = String(rec.date || rec.dateAd || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ad)) return ad;
    var bs = this._bsOf(rec);
    if (bs) { try { var p = bs.split('-').map(Number), a = bsToAd(p[0], p[1], p[2]); return a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0'); } catch (e) {} }
    return '';
  },
  /** {kind:'month', y:2082, m:5} | {kind:'fy', y:2082} (= 2082/083, Shrawan–Ashadh) | {kind:'all'} → {from,to,label} in BS */
  range: function (p) {
    p = p || { kind: 'all' };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    if (p.kind === 'month') return { from: p.y + '-' + pad(p.m) + '-00', to: p.y + '-' + pad(p.m) + '-99', label: p.y + ' ' + (bsMonthName(p.m) || pad(p.m)) };
    if (p.kind === 'fy') return { from: p.y + '-04-00', to: (p.y + 1) + '-03-99', label: 'आ.व. ' + p.y + '/' + String(p.y + 1).slice(-3) };
    return { from: '0000', to: '9999', label: 'सबै' };
  },
  _in: function (rec, r) { var b = this._bsOf(rec); return !!b && b >= r.from && b <= r.to; },
  _n: function (v) { return Math.round((parseFloat(v) || 0) * 100) / 100; },

  // ── registers (arrays of rows; first row = header) ──
  salesRegister: function (p) {
    var r = this.range(p), self = this, custs = {};
    try { (STORE.get('pk3_customers', []) || []).forEach(function (c) { custs[c.id] = c; }); } catch (e) {}
    var rows = [['मिति (वि.सं.)', 'Date (AD)', 'Invoice No.', 'Customer', 'Customer PAN/VAT', 'Phone', 'Sub Total', 'Discount', 'Taxable Amount', 'VAT %', 'VAT Amount', 'Grand Total', 'Paid', 'Balance', 'Status']];
    (STORE.get('pk3_invoices', []) || []).filter(function (x) { return x && !x._demo && self._in(x, r); })
      .sort(function (a, b) { return self._bsOf(a).localeCompare(self._bsOf(b)); })
      .forEach(function (x) {
        var c = custs[x.custId] || {}, sub = self._n(x.subtotal != null ? x.subtotal : x.amount), disc = self._n(x.discAmt), vat = self._n(x.taxAmt);
        rows.push([self._bsOf(x), self._adOf(x), x.invNum || '', x.custName || c.name || '', c.pan || c.vat || '', x.custPhone || c.phone || '',
          sub, disc, self._n(sub - disc), self._n(x.taxP), vat, self._n(x.amount), self._n(x.paid), self._n(x.balance), x._returned ? 'Returned' : (x.status || '')]);
      });
    return rows;
  },

  expenseRegister: function (p) {
    var r = this.range(p), self = this;
    var rows = [['मिति (वि.सं.)', 'Date (AD)', 'Voucher No.', 'Category', 'Description', 'Vendor / Party', 'Bill No.', 'Payment Mode', 'Project', 'Amount']];
    var proj = {}; try { (STORE.get('pk3_projects', []) || []).forEach(function (x) { proj[x.id] = x.name; }); } catch (e) {}
    (STORE.get('pk3_daybook', []) || []).filter(function (e) { return e && e.type === 'expense' && !e._demo && self._in(e, r); })
      .sort(function (a, b) { return self._bsOf(a).localeCompare(self._bsOf(b)); })
      .forEach(function (e) {
        rows.push([self._bsOf(e), self._adOf(e), e.voucherNo || '', e.cat || '', e.desc || '', e.vendor || '', e.bill || '', e.pay || '', proj[e.projectId] || '', self._n(e.amount)]);
      });
    return rows;
  },

  payablesRegister: function (p) {
    var r = this.range(p), self = this;
    var parties = {}; (STORE.get('pk3_payables', []) || []).forEach(function (x) { parties[x.id] = x; });
    var rows = [['मिति (वि.सं.)', 'Date (AD)', 'Supplier / मिस्त्री', 'Type', 'PAN/VAT', 'Entry', 'Bill No.', 'Note', 'Bill Amount', 'VAT in Bill', 'Payment', 'Balance Due (party, all time)']];
    var due = {};
    try { Object.keys(parties).forEach(function (id) { due[id] = Payables.balance(id).due; }); } catch (e) {}
    (STORE.get('pk3_payable_txns', []) || []).filter(function (t) { return self._in(t, r); })
      .sort(function (a, b) { return self._bsOf(a).localeCompare(self._bsOf(b)); })
      .forEach(function (t) {
        var pt = parties[t.partyId] || {};
        rows.push([self._bsOf(t), self._adOf(t), pt.name || '', pt.kind === 'mistri' ? 'मिस्त्री/ठेकेदार' : 'Supplier', pt.pan || '', t.type === 'bill' ? 'Bill' : 'Payment',
          t.billNo || '', t.note || '', t.type === 'bill' ? self._n(t.amount) : 0, t.type === 'bill' ? self._n(t.vat) : 0, t.type === 'payment' ? self._n(t.amount) : 0, self._n(due[t.partyId])]);
      });
    return rows;
  },

  vatSummary: function (p) {
    var r = this.range(p), s = this.salesRegister(p).slice(1), pay = this.payablesRegister(p).slice(1), n = this._n;
    var taxable = 0, outVat = 0, exempt = 0, gross = 0;
    s.forEach(function (x) { if (x[14] === 'Returned') return; gross += x[11]; if (x[10] > 0) { taxable += x[8]; outVat += x[10]; } else exempt += x[8]; });
    var purchases = 0, inVat = 0;
    pay.forEach(function (x) { purchases += x[8]; inVat += x[9]; });
    var co = Company.get();
    return [['Item', 'Amount'], ['Company', co.name], ['PAN / VAT No.', co.pan], ['Period (वि.सं.)', r.label],
      ['Sales invoices', s.length], ['Taxable sales', n(taxable)], ['Output VAT (बिक्रीमा VAT)', n(outVat)], ['Non-taxable / exempt sales', n(exempt)], ['Total sales (incl. VAT)', n(gross)],
      ['Supplier bills (purchases)', n(purchases)], ['Input VAT (खरिदमा VAT — बिलमा लेखिएको)', n(inVat)], ['Net VAT payable (Output − Input)', n(outVat - inVat)]];
  },

  // ── file builders ──
  _cell: function (v) { var s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; },
  toCSV: function (rows, title) {
    var self = this, co = Company.get(), head = [];
    if (title) head = [[title], [co.name + (co.pan ? ' — PAN/VAT: ' + co.pan : '')], []];
    return this.BOM + head.concat(rows).map(function (r) { return r.map(function (c) { return self._cell(c); }).join(','); }).join('\r\n') + '\r\n';
  },
  _xmlEsc: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  toExcel: function (sheets) {
    var self = this;
    var x = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n'
      + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
      + '<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#FDE7D3" ss:Pattern="Solid"/></Style></Styles>';
    sheets.forEach(function (sh) {
      x += '<Worksheet ss:Name="' + self._xmlEsc(sh.name.slice(0, 31)) + '"><Table>';
      sh.rows.forEach(function (r, i) {
        x += '<Row>' + r.map(function (c) {
          var num = typeof c === 'number' && isFinite(c);
          return '<Cell' + (i === 0 ? ' ss:StyleID="h"' : '') + '><Data ss:Type="' + (num ? 'Number' : 'String') + '">' + self._xmlEsc(c) + '</Data></Cell>';
        }).join('') + '</Row>';
      });
      x += '</Table></Worksheet>';
    });
    return x + '</Workbook>';
  },
  download: function (name, rowsOrText, mime) {
    var text = typeof rowsOrText === 'string' ? rowsOrText : this.toCSV(rowsOrText);
    var blob = new Blob([text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 4000);
    this._last = { name: name, text: text };
    return text;
  },

  REGS: {
    sales: { fn: 'salesRegister', title: 'Sales Register', file: 'sales-register' },
    expense: { fn: 'expenseRegister', title: 'Expense Register', file: 'expense-register' },
    payables: { fn: 'payablesRegister', title: 'Supplier Payables', file: 'supplier-payables' },
    vat: { fn: 'vatSummary', title: 'VAT Summary', file: 'vat-summary' }
  },

  // ── UI (Reports page card) ──
  period: function () {
    var kind = getVal('ca-kind') || 'month', y = parseInt(getVal('ca-year'), 10), m = parseInt(getVal('ca-month'), 10);
    if (!y) { var t = todayBs().split('-'); y = parseInt(t[0], 10); m = m || parseInt(t[1], 10); }
    return kind === 'fy' ? { kind: 'fy', y: y } : kind === 'all' ? { kind: 'all' } : { kind: 'month', y: y, m: m || 1 };
  },
  _slug: function (p) { var r = this.range(p); return r.label.replace(/[^\wऀ-ॿ]+/g, '-'); },
  exportOne: function (key) {
    var p = this.period(), R = this.REGS[key], rows = this[R.fn](p);
    var text = this.download(R.file + '-' + this._slug(p) + '.csv', this.toCSV(rows, R.title + ' — ' + this.range(p).label));
    App.toast('✅ ' + R.title + ' (' + (rows.length - 1) + ' rows) डाउनलोड भयो', 'success');
    return text;
  },
  exportExcel: function () {
    var p = this.period(), self = this;
    var sheets = ['sales', 'expense', 'payables', 'vat'].map(function (k) { return { name: self.REGS[k].title, rows: self[self.REGS[k].fn](p) }; });
    var text = this.download('ca-vat-' + this._slug(p) + '.xls', this.toExcel(sheets), 'application/vnd.ms-excel');
    App.toast('✅ Excel workbook (४ sheet) डाउनलोड भयो', 'success');
    return text;
  },
  renderCard: function () {
    var box = document.getElementById('ca-export-card'); if (!box || box.getAttribute('data-ready')) return;
    var t = todayBs().split('-'), y = parseInt(t[0], 10), m = parseInt(t[1], 10);
    var fyStart = m >= 4 ? y : y - 1;
    var years = []; for (var i = y + 1; i >= y - 5; i--) years.push(i);
    box.setAttribute('data-ready', '1');
    box.innerHTML = '<div class="section-title">📊 CA / VAT Export</div>'
      + '<div style="font-size:0.72rem;color:var(--text-muted);margin:6px 0 10px;">CA / आन्तरिक राजस्व कार्यालयका लागि — वि.सं. र ई.सं. मिति, PAN/VAT र जम्मा रकम सहित। Excel मा नेपाली अक्षर ठीक देखिन्छ।</div>'
      + '<div class="form-grid"><div class="form-group"><label>अवधि</label><select id="ca-kind" onchange="document.getElementById(\'ca-month-grp\').style.display=this.value===\'month\'?\'\':\'none\'"><option value="month">महिना</option><option value="fy">आर्थिक वर्ष</option><option value="all">सबै</option></select></div>'
      + '<div class="form-group"><label>वर्ष (वि.सं.) — आ.व. को सुरु वर्ष</label><select id="ca-year">' + years.map(function (v) { return '<option value="' + v + '"' + (v === y ? ' selected' : '') + '>' + v + ' (आ.व. ' + v + '/' + String(v + 1).slice(-3) + ')</option>'; }).join('') + '</select></div>'
      + '<div class="form-group" id="ca-month-grp"><label>महिना</label><select id="ca-month">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (v) { return '<option value="' + v + '"' + (v === m ? ' selected' : '') + '>' + (bsMonthName(v) || v) + '</option>'; }).join('') + '</select></div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">'
      + '<button type="button" class="btn btn-sm btn-primary" onclick="CAExport.exportExcel()">📗 सबै — Excel (.xls)</button>'
      + '<button type="button" class="btn btn-sm btn-secondary" onclick="CAExport.exportOne(\'sales\')">🧾 Sales Register</button>'
      + '<button type="button" class="btn btn-sm btn-secondary" onclick="CAExport.exportOne(\'expense\')">📤 Expense Register</button>'
      + '<button type="button" class="btn btn-sm btn-secondary" data-module="payables" onclick="CAExport.exportOne(\'payables\')">👷 Supplier Payables</button>'
      + '<button type="button" class="btn btn-sm btn-secondary" onclick="CAExport.exportOne(\'vat\')">🧮 VAT Summary</button></div>'
      + '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;">आ.व. = साउन १ देखि असार मसान्तसम्म। (हाल: ' + fyStart + '/' + String(fyStart + 1).slice(-3) + ')</div>';
  }
};
