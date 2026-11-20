// ═══════════════ 🛒 PURCHASE BILL / खरिद बिल + INPUT VAT + TDS (v7.2.0) ═══════════════
//   pk3_purchases → [{ id, billNo, date, dateBs, partyId, supplierName, supplierPan,
//                      items:[{name, qty, unit, rate, amount, stockId?}],
//                      subtotal, discAmt, nonTaxable, taxable, vatP, vatAmt, total,
//                      tdsType, tdsP, tdsAmt, netPayable, paid, payMode, projectId, note,
//                      payTxnId, paidTxnId, created, updated, user }]
// • हरेक खरिद बिल Supplier खाता (Payables) मा पनि "बिल" बनेर जान्छ (TDS कट्टी पछिको रकम = Supplier लाई तिर्नुपर्ने)।
//   नयाँ Supplier को नाम लेखे आफैं Supplier खाता खुल्छ। तुरुन्त तिरेको रकम "भुक्तानी" (Day Book खर्च) बन्छ।
// • Input VAT = करयोग्य रकम × VAT%।  TDS = करयोग्य रकम (VAT बाहेक) × TDS%।
// • Stock: Stock.purchaseIn('pur:<id>', items) — Stock module भए आफैं stock बढ्छ; हटाउँदा Stock.reverse('pur:<id>')।
// • अरू module का लागि hook:
//     Purchases.onChange(function (ev) { … })          ← सिधै function दर्ता
//     window.addEventListener('swagatik:purchase', function (e) { e.detail … })
//   ev / e.detail = { action: 'create'|'update'|'delete', purchase: <record>, prev: <old record or null> }
//   purchase.items[] मा name, qty, unit, rate, amount र (Stock मा उही नामको सामान भए) stockId हुन्छ।
var Purchases = {
  KEY: 'pk3_purchases',
  // Common TDS presets (rates are editable on every bill — confirm with your CA)
  TDS: {
    none:     { label: 'TDS छैन', rate: 0 },
    service:  { label: 'सेवा शुल्क — VAT दर्ता भएको (1.5%)', rate: 1.5 },
    service15:{ label: 'सेवा शुल्क — VAT दर्ता नभएको (15%)', rate: 15 },
    contract: { label: 'ठेक्का / Contract (1.5%)', rate: 1.5 },
    rent:     { label: 'घर/भाडा (10%)', rate: 10 },
    commission:{ label: 'कमिसन (15%)', rate: 15 },
    custom:   { label: 'अन्य (दर आफैं लेख्ने)', rate: 0 }
  },
  _hooks: [],
  _rows: [],
  _editId: null,
  _q: '',

  r2: function (v) { return Math.round((parseFloat(v) || 0) * 100) / 100; },
  getData: function () { return STORE.get(this.KEY, []) || []; },
  get: function (id) { return this.getData().find(function (x) { return x.id === id; }) || null; },

  onChange: function (fn) { if (typeof fn === 'function') this._hooks.push(fn); },
  _emit: function (action, rec, prev) {
    var ev = { action: action, purchase: rec ? JSON.parse(JSON.stringify(rec)) : null, prev: prev ? JSON.parse(JSON.stringify(prev)) : null };
    this._hooks.forEach(function (fn) { try { fn(ev); } catch (e) { console.warn('Purchases hook', e); } });
    try { window.dispatchEvent(new CustomEvent('swagatik:purchase', { detail: ev })); } catch (e) {}
  },

  /** Pure maths — {subtotal, discAmt, nonTaxable, taxable, vatAmt, total, tdsAmt, netPayable} */
  compute: function (b) {
    var r2 = this.r2;
    var items = (b.items || []).map(function (r) { return { name: String(r.name || '').trim(), qty: parseFloat(r.qty) || 0, unit: r.unit || '', rate: parseFloat(r.rate) || 0, stockId: r.stockId || '' }; });
    items.forEach(function (r) { r.amount = r2(r.qty * r.rate); });
    var subtotal = r2(items.reduce(function (s, r) { return s + r.amount; }, 0));
    var discAmt = Math.min(Math.max(r2(b.discAmt), 0), subtotal);
    var nonTaxable = Math.min(Math.max(r2(b.nonTaxable), 0), r2(subtotal - discAmt));
    var vatP = b.vatP === '' || b.vatP == null || isNaN(parseFloat(b.vatP)) ? 13 : Math.max(parseFloat(b.vatP), 0);
    var taxable = vatP > 0 ? r2(subtotal - discAmt - nonTaxable) : 0;
    if (vatP === 0) nonTaxable = r2(subtotal - discAmt);
    var vatAmt = r2(taxable * vatP / 100);
    var total = r2(subtotal - discAmt + vatAmt);
    var tdsP = Math.max(parseFloat(b.tdsP) || 0, 0);
    var tdsAmt = r2((taxable + nonTaxable) * tdsP / 100);
    return { items: items, subtotal: subtotal, discAmt: discAmt, nonTaxable: nonTaxable, taxable: taxable, vatP: vatP, vatAmt: vatAmt, total: total, tdsP: tdsP, tdsAmt: tdsAmt, netPayable: r2(total - tdsAmt) };
  },

  _stockIdFor: function (name) {
    if (!name) return '';
    try {
      var n = name.toLowerCase(), s = (STORE.get('pk3_stock', []) || []).find(function (x) { return x && String(x.name || '').trim().toLowerCase() === n; });
      return s ? s.id : '';
    } catch (e) { return ''; }
  },

  _party: function (b) {
    if (b.partyId) { var p = Payables.party(b.partyId); if (p) return p; }
    var name = String(b.supplierName || '').trim();
    if (!name) throw new Error('Supplier को नाम चाहिन्छ');
    var ex = Payables.parties().find(function (x) { return String(x.name || '').trim().toLowerCase() === name.toLowerCase(); });
    if (ex) { if (b.supplierPan && !ex.pan) Payables.saveParty({ id: ex.id, name: ex.name, pan: b.supplierPan }); return ex; }
    return Payables.saveParty({ name: name, kind: 'supplier', pan: b.supplierPan || '', phone: b.supplierPhone || '' });
  },

  /** Create (no id) or update (id) a purchase bill. Returns the saved record. */
  save: function (b) {
    var self = this, c = this.compute(b);
    c.items = c.items.filter(function (r) { return r.name || r.amount; });
    if (!c.items.length || c.total <= 0) throw new Error('कम्तिमा १ सामानको रकम (qty × rate) चाहिन्छ');
    var party = this._party(b);
    var list = this.getData(), prev = b.id ? list.find(function (x) { return x.id === b.id; }) : null;
    if (b.id && !prev) throw new Error('Purchase bill भेटिएन');
    var date = b.date || todayISO(), dateBs = b.dateBs || '';
    if (!dateBs) try { dateBs = _bsFromAd(date); } catch (e) {}
    c.items.forEach(function (r) { if (!r.stockId) r.stockId = self._stockIdFor(r.name); });
    var paid = Math.min(Math.max(this.r2(b.paid), 0), c.netPayable);
    var tdsType = this.TDS[b.tdsType] ? b.tdsType : (c.tdsP > 0 ? 'custom' : 'none');
    var rec = Object.assign({}, prev || {}, {
      billNo: String(b.billNo || '').trim(), date: date, dateBs: dateBs,
      partyId: party.id, supplierName: party.name, supplierPan: String(b.supplierPan || party.pan || '').trim(),
      items: c.items, subtotal: c.subtotal, discAmt: c.discAmt, nonTaxable: c.nonTaxable, taxable: c.taxable,
      vatP: c.vatP, vatAmt: c.vatAmt, total: c.total, tdsType: tdsType, tdsP: c.tdsP, tdsAmt: c.tdsAmt, netPayable: c.netPayable,
      paid: paid, payMode: b.payMode || 'Cash', projectId: b.projectId || '', note: String(b.note || '').trim(),
      user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : ''
    });
    if (prev) { this._unpost(prev); rec.updated = new Date().toISOString(); }
    else { rec.id = 'pb_' + uid(); rec.created = new Date().toISOString(); }
    // Supplier खाता: bill (net of TDS) + optional payment now
    var memo = 'खरिद बिल' + (rec.billNo ? ' #' + rec.billNo : '') + (rec.tdsAmt ? ' (TDS ' + rec.tdsAmt + ' कट्टी)' : '');
    var bill = Payables.addTxn({ partyId: party.id, type: 'bill', amount: rec.netPayable, date: date, dateBs: dateBs, billNo: rec.billNo, vat: rec.vatAmt, note: memo, projectId: rec.projectId });
    rec.payTxnId = bill.id; rec.paidTxnId = '';
    if (paid > 0) { var pay = Payables.addTxn({ partyId: party.id, type: 'payment', amount: paid, date: date, dateBs: dateBs, billNo: rec.billNo, note: 'खरिद बिल भुक्तानी', projectId: rec.projectId, pay: rec.payMode }); rec.paidTxnId = pay.id; }
    this._tagTxns(rec);
    if (prev) { var i = list.findIndex(function (x) { return x.id === rec.id; }); list[i] = rec; }
    else list.unshift(rec);
    STORE.set(this.KEY, list);
    try { Audit.log('PURCHASE', (prev ? 'Updated' : 'Created') + ': ' + (rec.billNo || rec.id) + ' ' + rec.supplierName + ' ' + rec.total); } catch (e) {}
    this._stockIn(rec);
    this._emit(prev ? 'update' : 'create', rec, prev);
    return rec;
  },

  // Stock बढाउने (Stock module को purchaseIn भए मात्र; ref 'pur:<id>' ले edit मा दोहोरिँदैन)
  _stockIn: function (rec) {
    try {
      if (typeof Stock === 'undefined' || typeof Stock.purchaseIn !== 'function') return;
      Stock.purchaseIn('pur:' + rec.id, rec.items.filter(function (r) { return r.qty > 0; }).map(function (r) { return { stockId: r.stockId || '', name: r.name, qty: r.qty }; }),
        { note: '🛒 खरिद' + (rec.billNo ? ' #' + rec.billNo : '') + ' — ' + rec.supplierName, date: rec.date });
    } catch (e) { console.warn('Stock purchaseIn', e); }
  },

  // Mark the Payables entries so the CA export never counts them twice
  _tagTxns: function (rec) {
    var tx = STORE.get('pk3_payable_txns', []) || [], ch = false;
    tx.forEach(function (t) { if (t.id === rec.payTxnId || t.id === rec.paidTxnId) { t.purchaseId = rec.id; ch = true; } });
    if (ch) STORE.set('pk3_payable_txns', tx);
  },
  _unpost: function (rec) {
    [rec.payTxnId, rec.paidTxnId].forEach(function (id) { if (id) try { Payables.delTxn(id); } catch (e) {} });
  },

  del: function (id) {
    var rec = this.get(id); if (!rec) return false;
    this._unpost(rec);
    STORE.set(this.KEY, this.getData().filter(function (x) { return x.id !== id; }));
    try { Audit.log('PURCHASE', 'Deleted: ' + (rec.billNo || rec.id) + ' ' + rec.supplierName); } catch (e) {}
    try { if (typeof Stock !== 'undefined' && typeof Stock.reverse === 'function') Stock.reverse('pur:' + rec.id, { note: '🗑 खरिद बिल हटाइयो' }); } catch (e) {}
    this._emit('delete', rec, rec);
    return true;
  },

  totals: function (list) {
    var r2 = this.r2, t = { count: 0, total: 0, taxable: 0, vat: 0, tds: 0 };
    (list || this.getData()).forEach(function (p) { t.count++; t.total += p.total || 0; t.taxable += p.taxable || 0; t.vat += p.vatAmt || 0; t.tds += p.tdsAmt || 0; });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  },

  // ───────────── UI ─────────────
  render: function () {
    var wrap = document.getElementById('pur-list'); if (!wrap) return;
    var q = (this._q || '').toLowerCase(), all = this.getData();
    var list = all.filter(function (p) { return !q || ((p.supplierName || '') + ' ' + (p.billNo || '') + ' ' + (p.supplierPan || '')).toLowerCase().indexOf(q) !== -1; });
    var cur = (typeof todayBs === 'function' ? todayBs() : '').slice(0, 7);
    var mon = all.filter(function (p) { return String(p.dateBs || '').slice(0, 7) === cur; });
    var t = this.totals(mon);
    var sum = document.getElementById('pur-summary');
    if (sum) sum.innerHTML = [['🛒 यो महिनाको खरिद', fmtRs(t.total), 'var(--text)'], ['🧾 Input VAT', fmtRs(t.vat), 'var(--green)'], ['✂️ TDS कट्टी', fmtRs(t.tds), '#b45309']]
      .map(function (c) { return '<div class="proj-stat"><div class="proj-stat-l">' + c[0] + '</div><div class="proj-stat-v" style="color:' + c[2] + ';">' + c[1] + '</div></div>'; }).join('');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="icon">🛒</div><div class="title">' + (all.length ? 'खोजमा केही भेटिएन' : 'अहिलेसम्म कुनै खरिद बिल छैन') + '</div>'
        + '<div class="subtitle">Supplier को बिल, Input VAT र TDS कट्टी एकै ठाउँमा — CA लाई Purchase Book सजिलै</div>'
        + '<button class="btn btn-primary" onclick="Purchases.open()">➕ नयाँ खरिद बिल</button></div>';
      return;
    }
    wrap.innerHTML = '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:0.8rem;"><thead><tr><th>मिति</th><th>बिल नं.</th><th>Supplier</th><th class="r">करयोग्य</th><th class="r">VAT</th><th class="r">TDS</th><th class="r">जम्मा</th><th></th></tr></thead><tbody>'
      + list.map(function (p) {
        return '<tr data-pur="' + esc(p.id) + '"><td>' + esc(p.dateBs || p.date) + '</td><td><b>' + esc(p.billNo || '—') + '</b></td><td>' + esc(p.supplierName) + (p.supplierPan ? '<div style="font-size:0.66rem;color:var(--text-muted);">PAN ' + esc(p.supplierPan) + '</div>' : '') + '</td>'
          + '<td class="r">' + fmtRs(p.taxable) + '</td><td class="r">' + fmtRs(p.vatAmt) + '</td><td class="r" style="color:#b45309;">' + (p.tdsAmt ? fmtRs(p.tdsAmt) : '—') + '</td><td class="r"><b>' + fmtRs(p.total) + '</b></td>'
          + '<td><div class="btn-group"><button class="btn btn-xs btn-secondary" onclick="Purchases.open(\'' + esc(p.id) + '\')">✏️</button>'
          + '<button class="btn btn-xs btn-danger" onclick="if(confirm(\'यो खरिद बिल हटाउने? Supplier खाताको entry पनि हट्छ।\')){Purchases.del(\'' + esc(p.id) + '\');Purchases.render();}">🗑</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  },

  _modal: function (title, html) {
    var m = document.getElementById('pur-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pur-modal'; document.body.appendChild(m); }
    m.innerHTML = '<div class="modal" style="max-width:720px;"><div class="modal-head"><div class="modal-title">' + title + '</div>'
      + '<button class="modal-close" onclick="Purchases.close()">✕</button></div>' + html + '</div>';
    m.classList.add('open');
    return m;
  },
  close: function () { var m = document.getElementById('pur-modal'); if (m) m.classList.remove('open'); },

  open: function (id) {
    var p = id ? this.get(id) : null, self = this;
    this._editId = p ? p.id : null;
    this._rows = p ? p.items.map(function (r) { return { name: r.name, qty: r.qty, unit: r.unit, rate: r.rate, stockId: r.stockId || '' }; }) : [{ name: '', qty: 1, unit: 'pcs', rate: 0 }];
    var parties = []; try { parties = Payables.parties().filter(function (x) { return x.kind !== 'mistri'; }); } catch (e) {}
    var projOpts = '<option value="">— कुनै Project होइन —</option>';
    try { projOpts += Projects.getData().map(function (pj) { return '<option value="' + esc(pj.id) + '"' + (p && p.projectId === pj.id ? ' selected' : '') + '>' + esc(pj.name) + '</option>'; }).join(''); } catch (e) {}
    var tds = p ? p.tdsType || 'none' : 'none';
    this._modal(p ? '✏️ खरिद बिल ' + esc(p.billNo || '') : '🛒 नयाँ खरिद बिल (Purchase Bill)',
      '<datalist id="pur-sup-dl">' + parties.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc(x.pan ? 'PAN ' + x.pan : (x.work || '')) + '</option>'; }).join('') + '</datalist>'
      + '<div class="form-grid">'
      + '<div class="form-group"><label>Supplier *</label><input type="text" id="pur-sup" list="pur-sup-dl" value="' + esc(p ? p.supplierName : '') + '" onchange="Purchases.onSupplier()" placeholder="नाम लेख्नुहोस् वा छान्नुहोस्"></div>'
      + '<div class="form-group"><label>Supplier PAN / VAT No.</label><input type="text" id="pur-pan" inputmode="numeric" maxlength="15" value="' + esc(p ? p.supplierPan : '') + '"></div>'
      + '<div class="form-group"><label>Supplier को बिल नं. *</label><input type="text" id="pur-billno" value="' + esc(p ? p.billNo : '') + '"></div>'
      + '<div class="form-group"><label>मिति</label><input type="date" id="pur-date" value="' + esc(p ? p.date : todayISO()) + '"></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px;"><b style="font-size:0.84rem;">📦 सामान / सेवा</b><button type="button" class="btn btn-xs btn-primary" onclick="Purchases.addRow()">➕ Item</button></div>'
      + '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:0.8rem;"><thead><tr><th>विवरण</th><th>Qty</th><th>Unit</th><th>Rate</th><th class="r">रकम</th><th></th></tr></thead><tbody id="pur-rows"></tbody></table></div>'
      + '<div class="form-grid" style="margin-top:10px;">'
      + '<div class="form-group"><label>Discount (Rs.)</label><input type="number" id="pur-disc" min="0" value="' + (p ? p.discAmt || 0 : 0) + '" oninput="Purchases.calc()"></div>'
      + '<div class="form-group"><label>VAT %</label><input type="number" id="pur-vatp" min="0" value="' + (p ? p.vatP : 13) + '" oninput="Purchases.calc()"></div>'
      + '<div class="form-group"><label>VAT नलाग्ने रकम (Rs.)</label><input type="number" id="pur-nontax" min="0" value="' + (p ? (p.vatP > 0 ? p.nonTaxable || 0 : 0) : 0) + '" oninput="Purchases.calc()"></div>'
      + '<div class="form-group"><label>TDS कट्टी</label><select id="pur-tds-type" onchange="Purchases.onTdsType()">' + Object.keys(this.TDS).map(function (k) { return '<option value="' + k + '"' + (k === tds ? ' selected' : '') + '>' + esc(self.TDS[k].label) + '</option>'; }).join('') + '</select></div>'
      + '<div class="form-group"><label>TDS %</label><input type="number" id="pur-tdsp" min="0" step="0.5" value="' + (p ? p.tdsP || 0 : 0) + '" oninput="Purchases.calc()"></div>'
      + '<div class="form-group"><label>अहिले तिरेको (Rs.)</label><input type="number" id="pur-paid" min="0" value="' + (p ? p.paid || 0 : 0) + '" oninput="Purchases.calc()"></div>'
      + '<div class="form-group"><label>भुक्तानी माध्यम</label><select id="pur-paymode">' + ['Cash', 'Bank', 'eSewa', 'Khalti', 'Cheque'].map(function (m) { return '<option' + (p && p.payMode === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>'
      + '<div class="form-group" data-module="projects"><label>Project / Site</label><select id="pur-proj">' + projOpts + '</select></div>'
      + '<div class="form-group full"><label>कैफियत</label><input type="text" id="pur-note" value="' + esc(p ? p.note : '') + '"></div>'
      + '</div>'
      + '<div class="card card-body" id="pur-sum" style="background:var(--surface-2);margin-top:10px;font-size:0.84rem;"></div>'
      + '<div style="font-size:0.66rem;color:var(--text-muted);margin-top:6px;">TDS दर आफ्नो CA सँग पुष्टि गर्नुहोस्। TDS कट्टी पछिको रकम Supplier खातामा "तिर्नुपर्ने" मा जान्छ।</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;"><button class="btn btn-secondary" onclick="Purchases.close()">Cancel</button><button class="btn btn-success" id="pur-save" onclick="Purchases.saveForm()">💾 Save</button></div>');
    this.renderRows(); this.calc();
  },
  onSupplier: function () {
    var n = getVal('pur-sup').toLowerCase(), pan = document.getElementById('pur-pan');
    if (!pan || pan.value) return;
    try { var x = Payables.parties().find(function (y) { return String(y.name || '').toLowerCase() === n; }); if (x && x.pan) pan.value = x.pan; } catch (e) {}
  },
  onTdsType: function () {
    var k = getVal('pur-tds-type'), t = this.TDS[k];
    if (t && k !== 'custom') setVal('pur-tdsp', String(t.rate));
    this.calc();
  },
  addRow: function () { this._rows.push({ name: '', qty: 1, unit: 'pcs', rate: 0 }); this.renderRows(); this.calc(); },
  removeRow: function (i) { this._rows.splice(i, 1); this.renderRows(); this.calc(); },
  renderRows: function () {
    var tb = document.getElementById('pur-rows'); if (!tb) return;
    var dl = document.getElementById('pur-items-dl');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'pur-items-dl'; document.body.appendChild(dl); }
    try { dl.innerHTML = (STORE.get('pk3_stock', []) || []).map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join(''); } catch (e) {}
    tb.innerHTML = this._rows.map(function (r, i) {
      return '<tr><td><input type="text" list="pur-items-dl" data-pr="name-' + i + '" value="' + esc(r.name || '') + '" oninput="Purchases._rows[' + i + '].name=this.value" style="width:100%;min-width:120px;"></td>'
        + '<td><input type="number" data-pr="qty-' + i + '" value="' + (r.qty || 0) + '" min="0" oninput="Purchases._rows[' + i + '].qty=this.value;Purchases.calc()" style="width:60px;"></td>'
        + '<td><input type="text" value="' + esc(r.unit || '') + '" oninput="Purchases._rows[' + i + '].unit=this.value" style="width:56px;"></td>'
        + '<td><input type="number" data-pr="rate-' + i + '" value="' + (r.rate || 0) + '" min="0" oninput="Purchases._rows[' + i + '].rate=this.value;Purchases.calc()" style="width:84px;"></td>'
        + '<td class="r" data-pr="amt-' + i + '">' + fmtRs((parseFloat(r.qty) || 0) * (parseFloat(r.rate) || 0)) + '</td>'
        + '<td><button type="button" class="btn btn-xs btn-danger" onclick="Purchases.removeRow(' + i + ')">✕</button></td></tr>';
    }).join('');
  },
  _formBill: function () {
    return { id: this._editId || undefined, supplierName: getVal('pur-sup'), supplierPan: getVal('pur-pan').replace(/\s+/g, ''), billNo: getVal('pur-billno'), date: getVal('pur-date') || todayISO(),
      items: this._rows, discAmt: getVal('pur-disc'), vatP: getVal('pur-vatp'), nonTaxable: getVal('pur-nontax'), tdsType: getVal('pur-tds-type'), tdsP: getVal('pur-tdsp'),
      paid: getVal('pur-paid'), payMode: getVal('pur-paymode'), projectId: getVal('pur-proj'), note: getVal('pur-note') };
  },
  calc: function () {
    var box = document.getElementById('pur-sum'); if (!box) return null;
    var c = this.compute(this._formBill());
    c.items.forEach(function (r, i) { var el = document.querySelector('[data-pr="amt-' + i + '"]'); if (el) el.textContent = fmtRs(r.amount); });
    var line = function (a, b, st) { return '<div style="display:flex;justify-content:space-between;padding:3px 0;' + (st || '') + '"><span>' + a + '</span><b>' + b + '</b></div>'; };
    box.innerHTML = line('Subtotal', fmtRs(c.subtotal))
      + (c.discAmt ? line('Discount', '- ' + fmtRs(c.discAmt)) : '')
      + (c.nonTaxable ? line('VAT नलाग्ने', fmtRs(c.nonTaxable)) : '')
      + line('करयोग्य रकम (Taxable)', '<span data-pur-taxable>' + fmtRs(c.taxable) + '</span>')
      + line('Input VAT (' + c.vatP + '%)', '<span data-pur-vat>' + fmtRs(c.vatAmt) + '</span>', 'color:var(--green);')
      + line('बिलको जम्मा', '<span data-pur-total>' + fmtRs(c.total) + '</span>', 'border-top:1px solid var(--border);margin-top:4px;padding-top:6px;font-size:1rem;')
      + (c.tdsAmt ? line('TDS कट्टी (' + c.tdsP + '%)', '- <span data-pur-tds>' + fmtRs(c.tdsAmt) + '</span>', 'color:#b45309;') : '')
      + line('Supplier लाई तिर्नुपर्ने', '<span data-pur-net>' + fmtRs(c.netPayable) + '</span>')
      + '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">' + esc(numToWordsNe(c.total)) + '</div>';
    return c;
  },
  saveForm: function () {
    try {
      var b = this._formBill();
      if (!b.billNo) throw new Error('Supplier को बिल नं. लेख्नुहोस्');
      var dup = this.getData().find(function (x) { return x.id !== b.id && x.billNo && x.billNo.toLowerCase() === b.billNo.toLowerCase() && String(x.supplierName || '').toLowerCase() === b.supplierName.toLowerCase(); });
      if (dup && !confirm('यो Supplier को बिल नं. "' + b.billNo + '" पहिल्यै छ। फेरि थप्ने?')) return;
      var rec = this.save(b);
      this.close(); this.render();
      App.toast('✅ खरिद बिल ' + (rec.billNo || '') + ' save भयो — Input VAT ' + fmtRs(rec.vatAmt), 'success');
    } catch (e) { App.toast('❌ ' + e.message, 'error'); }
  }
};
