// ═══════════════ 📏 SITE MEASUREMENT → QUOTATION (v7.0.0) ═══════════════
// Quotation / Estimate मै "📏 नाप (Sq.ft) जोड्नुहोस्" मिनी-क्यालकुलेटर:
//   लम्बाइ × चौडाइ/उचाइ (फिट वा इन्च, वा फिट+इन्च "5'6") × संख्या → जम्मा Sq.ft
//   × Rate List को दर → सिधै Quotation item मा थपिन्छ।
// Module: "measurement" (Settings → Modules बाट On/Off)।
var Measure = {
  _lines: [],

  /** "5'6", "5 6", "5.5", "66in" → feet (number). unit = 'ft' | 'in' */
  toFeet: function (v, unit) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return 0;
    var m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|फिट)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|इन्च)?$/);
    if (m) return parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0);
    m = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|इन्च)$/);
    if (m) return parseFloat(m[1]) / 12;
    m = s.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);       // "5 6" = 5ft 6in
    if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 12;
    var n = parseFloat(s);
    if (!isFinite(n)) return 0;
    return unit === 'in' ? n / 12 : n;
  },

  /** sq.ft for one line {l, w, qty, unit} — rounded to 2 decimals */
  area: function (line) {
    var l = this.toFeet(line.l, line.unit), w = this.toFeet(line.w, line.unit), q = parseFloat(line.qty);
    if (!isFinite(q) || q <= 0) q = 1;
    return Math.round(l * w * q * 100) / 100;
  },
  total: function (lines) { var self = this; return Math.round((lines || this._lines).reduce(function (s, x) { return s + self.area(x); }, 0) * 100) / 100; },

  _rateOptions: function () {
    var rates = STORE.get('pk3_rates', {}) || {}, out = [];
    Object.keys(rates).forEach(function (cat) {
      (rates[cat] || []).forEach(function (it) { if (it && it.name) out.push({ cat: cat, name: it.name, rate: parseFloat(it.rate) || 0, unit: it.unit || '' }); });
    });
    return out;
  },

  open: function () {
    if (typeof Modules !== 'undefined' && !Modules.isOn('measurement')) { App.toast('🎛️ Site Measurement बन्द छ — Settings → Modules', 'info'); return; }
    this._lines = [{ l: '', w: '', qty: 1, unit: 'ft', label: '' }];
    var m = document.getElementById('measure-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'measure-modal'; document.body.appendChild(m); }
    var opts = this._rateOptions();
    m.innerHTML = '<div class="modal" style="max-width:640px;"><div class="modal-head"><div class="modal-title">📏 नाप (Sq.ft) जोड्नुहोस्</div>'
      + '<button class="modal-close" onclick="Measure.close()">✕</button></div>'
      + '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">फिट वा इन्चमा लेख्नुहोस्। फिट+इन्च: <b>5\'6</b> वा <b>5 6</b>। एउटै item का धेरै भाग (झ्याल, भित्ता…) छुट्टाछुट्टै row मा।</div>'
      + '<div class="form-grid"><div class="form-group full"><label>Item / Rate List बाट</label><select id="ms-item" onchange="Measure.pickRate()"><option value="">— आफैं लेख्नुहोस् —</option>'
      + opts.map(function (o, i) { return '<option value="' + i + '">' + esc(o.cat + ' › ' + o.name + ' — ' + fmtRs(o.rate) + '/' + o.unit) + '</option>'; }).join('') + '</select></div>'
      + '<div class="form-group"><label>Item नाम</label><input type="text" id="ms-name" placeholder="जस्तै: UPVC Window"></div>'
      + '<div class="form-group"><label>दर (Rs. प्रति Sq.ft)</label><input type="number" id="ms-rate" min="0" inputmode="decimal" oninput="Measure.refresh()"></div></div>'
      + '<div style="overflow-x:auto;margin-top:6px;"><table class="data-table" style="width:100%;font-size:0.8rem;"><thead><tr><th>भाग</th><th>लम्बाइ</th><th>चौडाइ/उचाइ</th><th>एकाइ</th><th>Qty</th><th class="r">Sq.ft</th><th></th></tr></thead><tbody id="ms-rows"></tbody></table></div>'
      + '<button type="button" class="btn btn-sm btn-secondary" style="margin-top:6px;" onclick="Measure.addLine()">+ अर्को नाप</button>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--surface-2);">'
      + '<div style="font-size:0.85rem;">जम्मा: <b id="ms-total">0</b> Sq.ft × <b id="ms-rate-show">Rs. 0</b> = <b id="ms-amount" style="color:var(--accent);">Rs. 0</b></div>'
      + '<button type="button" class="btn btn-primary" id="ms-add" onclick="Measure.addToQuotation()">✅ Quotation मा थप्नुहोस्</button></div></div>';
    m.classList.add('open');
    this.renderLines();
  },
  close: function () { var m = document.getElementById('measure-modal'); if (m) m.classList.remove('open'); },

  pickRate: function () {
    var i = getVal('ms-item'), o = this._rateOptions()[i];
    if (o) { setVal('ms-name', o.name); setVal('ms-rate', o.rate); }
    this.refresh();
  },
  addLine: function () { this._lines.push({ l: '', w: '', qty: 1, unit: (this._lines[this._lines.length - 1] || {}).unit || 'ft', label: '' }); this.renderLines(); },
  delLine: function (i) { this._lines.splice(i, 1); if (!this._lines.length) this._lines.push({ l: '', w: '', qty: 1, unit: 'ft' }); this.renderLines(); },
  set: function (i, k, v) { if (this._lines[i]) this._lines[i][k] = v; this.refresh(); },

  renderLines: function () {
    var tb = document.getElementById('ms-rows'); if (!tb) return;
    var self = this;
    tb.innerHTML = this._lines.map(function (x, i) {
      var inp = function (k, w, ph, type) { return '<input type="' + (type || 'text') + '" data-ms="' + k + '-' + i + '" value="' + esc(x[k] == null ? '' : String(x[k])) + '" placeholder="' + ph + '" oninput="Measure.set(' + i + ',\'' + k + '\',this.value)" style="width:' + w + 'px;">'; };
      return '<tr><td>' + inp('label', 80, 'भाग') + '</td><td>' + inp('l', 64, "5'6") + '</td><td>' + inp('w', 64, '4') + '</td>'
        + '<td><select data-ms="unit-' + i + '" onchange="Measure.set(' + i + ',\'unit\',this.value)"><option value="ft"' + (x.unit === 'ft' ? ' selected' : '') + '>फिट</option><option value="in"' + (x.unit === 'in' ? ' selected' : '') + '>इन्च</option></select></td>'
        + '<td>' + inp('qty', 44, '1', 'number') + '</td><td class="r" data-ms-area="' + i + '">' + self.area(x) + '</td>'
        + '<td><button type="button" class="btn btn-xs btn-danger" onclick="Measure.delLine(' + i + ')">✕</button></td></tr>';
    }).join('');
    this.refresh();
  },
  refresh: function () {
    var self = this;
    this._lines.forEach(function (x, i) { var c = document.querySelector('[data-ms-area="' + i + '"]'); if (c) c.textContent = self.area(x); });
    var t = this.total(), r = parseFloat(getVal('ms-rate')) || 0;
    setText('ms-total', t); setText('ms-rate-show', fmtRs(r)); setText('ms-amount', fmtRs(Math.round(t * r * 100) / 100));
  },

  /** Build the quotation row: qty = total sq.ft, unit = sqft, rate, and a note with the measurements */
  buildRow: function (name, rate, lines) {
    var self = this, t = this.total(lines);
    var note = lines.filter(function (x) { return self.area(x) > 0; }).map(function (x) {
      return (x.label ? x.label + ': ' : '') + x.l + ' × ' + x.w + (x.unit === 'in' ? ' in' : ' ft') + ((parseFloat(x.qty) || 1) > 1 ? ' × ' + x.qty : '') + ' = ' + self.area(x);
    }).join('; ');
    return { name: name + (note ? ' (' + note + ')' : ''), qty: t, unit: 'sqft', rate: rate, amount: Math.round(t * rate * 100) / 100, measure: lines };
  },

  addToQuotation: function () {
    var name = (getVal('ms-name') || '').trim(), rate = parseFloat(getVal('ms-rate')) || 0, t = this.total();
    if (!t) { App.toast('❌ नाप लेख्नुहोस् (लम्बाइ र चौडाइ)', 'error'); return; }
    if (!name) { App.toast('❌ Item नाम लेख्नुहोस् वा Rate List बाट छान्नुहोस्', 'error'); return; }
    var row = this.buildRow(name, rate, JSON.parse(JSON.stringify(this._lines)));
    var Q = Quotations;
    // replace a single empty starter row, otherwise append
    if (Q._rows.length === 1 && !String(Q._rows[0].name || '').trim() && !(parseFloat(Q._rows[0].rate) > 0)) Q._rows = [];
    Q._rows.push(row);
    Q.renderRows(); Q.calc();
    this.close();
    App.toast('📏 ' + t + ' Sq.ft × ' + fmtRs(rate) + ' = ' + fmtRs(row.amount) + ' थपियो', 'success', 3000);
  }
};
