// ═══════════════ SUPPLIER र मिस्त्री खाता — PAYABLES (v7.0.0) ═══════════════
// Customer Ledger को उल्टो: हामीले तिर्नुपर्ने हिसाब।
//   pk3_payables      → parties  [{id, name, kind:'supplier'|'mistri', work, phone, pan, address}]
//   pk3_payable_txns  → entries  [{id, partyId, type:'bill'|'payment', amount, date, dateBs, note, billNo, projectId, photoIds[], dbId}]
// बिल = तिर्नुपर्ने बढ्छ; भुक्तानी/एड्भान्स = घट्छ। बाँकी = बिल − भुक्तानी।
// Project सँग जोडिएको बिल Project को वास्तविक खर्चमा गनिन्छ (Projects.stats)।
// भुक्तानी चाहेमा Day Book मा पनि खर्च (cash out) को रूपमा लेखिन्छ — त्यो entry मा _payable
// हुन्छ, त्यसैले Project खर्चमा दोहोरो गनिँदैन।
var Payables = {
  KINDS: { supplier: '🏪 Supplier', mistri: '👷 मिस्त्री / ठेकेदार' },
  _filter: 'all',
  _q: '',

  parties: function () { return STORE.get('pk3_payables', []) || []; },
  txns: function () { return STORE.get('pk3_payable_txns', []) || []; },
  party: function (id) { return this.parties().find(function (p) { return p.id === id; }) || null; },

  balance: function (partyId) {
    var b = 0, bills = 0, paid = 0;
    this.txns().forEach(function (t) {
      if (t.partyId !== partyId) return;
      var a = parseFloat(t.amount) || 0;
      if (t.type === 'bill') bills += a; else paid += a;
    });
    b = bills - paid;
    return { bills: bills, paid: paid, due: b };
  },

  totals: function () {
    var self = this, t = { bills: 0, paid: 0, due: 0, parties: 0 };
    this.parties().forEach(function (p) { var b = self.balance(p.id); t.bills += b.bills; t.paid += b.paid; t.due += b.due; t.parties++; });
    return t;
  },

  /** Bills linked to a project = actual cost (used by Projects.stats) */
  projectCost: function (projectId) {
    return this.txns().filter(function (t) { return t.projectId === projectId && t.type === 'bill'; })
      .reduce(function (s, t) { return s + (parseFloat(t.amount) || 0); }, 0);
  },

  saveParty: function (p) {
    var list = this.parties();
    if (!p.name || !String(p.name).trim()) throw new Error('नाम चाहिन्छ');
    if (p.id) { var i = list.findIndex(function (x) { return x.id === p.id; }); if (i >= 0) list[i] = Object.assign(list[i], p); }
    else { p.id = 'py_' + uid(); p.createdAt = new Date().toISOString(); list.push(p); }
    STORE.set('pk3_payables', list);
    return p;
  },

  /** Add a bill or a payment. opts.toDayBook (payments only, default true). */
  addTxn: function (t, opts) {
    opts = opts || {};
    var amount = parseFloat(t.amount) || 0;
    if (!t.partyId || !this.party(t.partyId)) throw new Error('Supplier/मिस्त्री छान्नुहोस्');
    if (amount <= 0) throw new Error('रकम ० भन्दा बढी हुनुपर्छ');
    var rec = { id: 'pt_' + uid(), partyId: t.partyId, type: t.type === 'payment' ? 'payment' : 'bill', amount: amount,
      date: t.date || todayISO(), dateBs: t.dateBs || '', note: t.note || '', billNo: t.billNo || '', vat: parseFloat(t.vat) || 0, projectId: t.projectId || '',
      photoIds: t.photoIds || [], createdAt: new Date().toISOString(), user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '' };
    // v7.2.0: खरिद बिलका सामान → Stock बढ्छ (Stock.purchaseIn, ref 'pay:<id>')
    if (rec.type === 'bill' && Array.isArray(t.stockItems)) {
      var si = t.stockItems.filter(function (l) { return l && (l.stockId || l.name) && (parseFloat(l.qty) || 0) > 0; })
        .map(function (l) { return { stockId: l.stockId || '', name: l.name || '', qty: parseFloat(l.qty) || 0 }; });
      if (si.length) rec.stockItems = si;
    }
    if (!rec.dateBs) try { rec.dateBs = _bsFromAd(rec.date); } catch (e) {}
    if (rec.type === 'payment' && opts.toDayBook !== false) {
      var p = this.party(rec.partyId);
      var db = STORE.get('pk3_daybook', []) || [];
      var e = { id: uid(), type: 'expense', amount: amount, desc: (p.kind === 'mistri' ? 'मिस्त्री भुक्तानी: ' : 'Supplier भुक्तानी: ') + p.name + (rec.note ? ' — ' + rec.note : ''),
        cat: p.kind === 'mistri' ? 'Labour / मिस्त्री' : 'Supplier Payment', vendor: p.name, bill: rec.billNo, pay: t.pay || 'Cash', notes: '',
        date: rec.date, dateBs: rec.dateBs || todayBs(), user: rec.user, projectId: rec.projectId || '', _payable: rec.id };
      try { e.voucherNo = DayBook.nextVoucherNo('expense', e.dateBs, db); } catch (x) {}
      db.push(e); STORE.set('pk3_daybook', db);
      rec.dbId = e.id;
    }
    var list = this.txns(); list.push(rec); STORE.set('pk3_payable_txns', list);
    if (rec.stockItems) { try { Stock.purchaseIn('pay:' + rec.id, rec.stockItems, { note: '🛒 खरिद' + (rec.billNo ? ' #' + rec.billNo : '') + ' — ' + this.party(rec.partyId).name, date: rec.date }); } catch (e) {} }
    try { Audit.log('PAYABLE', rec.type + ' ' + amount + ' → ' + this.party(rec.partyId).name); } catch (e) {}
    return rec;
  },

  delTxn: function (id) {
    var t = this.txns().find(function (x) { return x.id === id; });
    if (!t) return;
    STORE.set('pk3_payable_txns', this.txns().filter(function (x) { return x.id !== id; }));
    if (t.dbId) STORE.set('pk3_daybook', (STORE.get('pk3_daybook', []) || []).filter(function (e) { return e.id !== t.dbId; }));
    try { Stock.reverse('pay:' + t.id, { note: '🗑 खरिद entry हटाइयो' }); } catch (e) {}
    (t.photoIds || []).forEach(function (pid) { try { Media.del(pid); } catch (e) {} });
  },

  // ───────────── UI ─────────────
  setFilter: function (f) { this._filter = f; this.render(); },
  render: function () {
    var wrap = document.getElementById('pay-list'); if (!wrap) return;
    var self = this, tot = this.totals(), f = this._filter, q = (this._q || '').toLowerCase();
    ['all', 'supplier', 'mistri', 'due'].forEach(function (x) { var b = document.getElementById('pay-f-' + x); if (b) b.className = 'btn btn-sm ' + (x === f ? 'btn-primary' : 'btn-secondary'); });
    var sum = document.getElementById('pay-summary');
    if (sum) sum.innerHTML = [['🧾 जम्मा बिल', fmtRs(tot.bills), 'var(--text)'], ['💸 तिरिसकेको', fmtRs(tot.paid), 'var(--green)'], ['⏳ तिर्न बाँकी', fmtRs(tot.due), tot.due > 0 ? 'var(--red)' : 'var(--green)']]
      .map(function (c) { return '<div class="proj-stat"><div class="proj-stat-l">' + c[0] + '</div><div class="proj-stat-v" style="color:' + c[2] + ';">' + c[1] + '</div></div>'; }).join('');
    var list = this.parties().filter(function (p) {
      if (f === 'supplier' || f === 'mistri') { if (p.kind !== f) return false; }
      if (f === 'due' && self.balance(p.id).due <= 0) return false;
      return !q || (p.name + ' ' + (p.work || '') + ' ' + (p.phone || '')).toLowerCase().indexOf(q) !== -1;
    });
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="icon">👷</div><div class="title">' + (this.parties().length ? 'यो filter मा कोही छैन' : 'अहिलेसम्म कुनै Supplier / मिस्त्री छैन') + '</div>'
        + '<div class="subtitle">हार्डवेयर/प्लाइउड सप्लायर र मिस्त्री/ठेकेदारको बिल, एड्भान्स र बाँकी एकै ठाउँमा</div>'
        + '<button class="btn btn-primary" onclick="Payables.openParty()">➕ नयाँ Supplier / मिस्त्री</button></div>';
      return;
    }
    wrap.innerHTML = list.map(function (p) {
      var b = self.balance(p.id);
      return '<div class="card pay-card" data-party="' + esc(p.id) + '" onclick="Payables.view(\'' + esc(p.id) + '\')">'
        + '<div class="proj-top"><div style="min-width:0;flex:1;"><div class="proj-name">' + esc(p.name) + '</div>'
        + '<div class="proj-sub">' + esc(self.KINDS[p.kind] || '') + (p.work ? ' · ' + esc(p.work) : '') + (p.phone ? ' · 📞 ' + esc(p.phone) : '') + '</div></div>'
        + '<div style="text-align:right;"><div style="font-size:0.68rem;color:var(--text-muted);">तिर्न बाँकी</div><b data-due style="color:' + (b.due > 0 ? 'var(--red)' : 'var(--green)') + ';">' + fmtRs(b.due) + '</b></div></div>'
        + '<div class="proj-nums"><div><span>बिल</span><b>' + fmtRs(b.bills) + '</b></div><div><span>तिरेको</span><b style="color:var(--green);">' + fmtRs(b.paid) + '</b></div></div></div>';
    }).join('');
  },

  _modal: function (title, html) {
    var m = document.getElementById('pay-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pay-modal'; document.body.appendChild(m); }
    m.innerHTML = '<div class="modal" style="max-width:620px;"><div class="modal-head"><div class="modal-title">' + title + '</div>'
      + '<button class="modal-close" onclick="document.getElementById(\'pay-modal\').classList.remove(\'open\')">✕</button></div>' + html + '</div>';
    m.classList.add('open');
    try { Media.hydrate(m); } catch (e) {}
    return m;
  },
  close: function () { var m = document.getElementById('pay-modal'); if (m) m.classList.remove('open'); },

  openParty: function (id) {
    var p = id ? this.party(id) : { kind: 'supplier' };
    this._modal(id ? '✏️ ' + esc(p.name) : '➕ नयाँ Supplier / मिस्त्री',
      '<input type="hidden" id="pay-p-id" value="' + esc(p.id || '') + '"><div class="form-grid">'
      + '<div class="form-group full"><label>नाम *</label><input type="text" id="pay-p-name" value="' + esc(p.name || '') + '"></div>'
      + '<div class="form-group"><label>प्रकार</label><select id="pay-p-kind"><option value="supplier"' + (p.kind === 'supplier' ? ' selected' : '') + '>🏪 Supplier</option><option value="mistri"' + (p.kind === 'mistri' ? ' selected' : '') + '>👷 मिस्त्री / ठेकेदार</option></select></div>'
      + '<div class="form-group"><label>कामको प्रकार</label><input type="text" id="pay-p-work" value="' + esc(p.work || '') + '" placeholder="जस्तै: Plywood, Plumbing, Painting"></div>'
      + '<div class="form-group"><label>फोन</label><input type="tel" id="pay-p-phone" value="' + esc(p.phone || '') + '"></div>'
      + '<div class="form-group"><label>PAN / VAT</label><input type="text" id="pay-p-pan" value="' + esc(p.pan || '') + '"></div>'
      + '<div class="form-group full"><label>ठेगाना</label><input type="text" id="pay-p-addr" value="' + esc(p.address || '') + '"></div>'
      + '</div><div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn btn-primary" id="pay-p-save" onclick="Payables.saveForm()">💾 Save</button></div>');
  },
  saveForm: function () {
    try {
      var p = this.saveParty({ id: getVal('pay-p-id') || undefined, name: getVal('pay-p-name').trim(), kind: getVal('pay-p-kind'), work: getVal('pay-p-work'), phone: getVal('pay-p-phone'), pan: getVal('pay-p-pan'), address: getVal('pay-p-addr') });
      this.close(); this.render(); App.toast('✅ ' + p.name + ' saved', 'success');
    } catch (e) { App.toast('❌ ' + e.message, 'error'); }
  },

  view: function (id) {
    var p = this.party(id); if (!p) return;
    var b = this.balance(id), self = this;
    var tx = this.txns().filter(function (t) { return t.partyId === id; }).sort(function (a, c) { return (a.date || '').localeCompare(c.date || ''); });
    var run = 0;
    var rows = tx.map(function (t) {
      run += (t.type === 'bill' ? 1 : -1) * (parseFloat(t.amount) || 0);
      var proj = ''; try { var pj = t.projectId && Projects.get(t.projectId); if (pj) proj = ' · 🏗️ ' + esc(pj.name); } catch (e) {}
      return '<tr><td>' + esc(t.dateBs || t.date) + '</td><td>' + (t.type === 'bill' ? '🧾 बिल' : '💸 भुक्तानी') + (t.billNo ? ' #' + esc(t.billNo) : '') + '<div style="font-size:0.68rem;color:var(--text-muted);">' + esc(t.note || '') + proj + '</div>' + (t.stockItems && t.stockItems.length ? '<div style="font-size:0.66rem;color:var(--green);">📦 ' + t.stockItems.map(function (l) { return '+' + l.qty + ' ' + esc(l.name); }).join(', ') + '</div>' : '') + (t.photoIds && t.photoIds.length ? '<div class="media-row">' + Media.thumbs(t.photoIds) + '</div>' : '') + '</td>'
        + '<td class="r">' + (t.type === 'bill' ? fmtRs(t.amount) : '') + '</td><td class="r" style="color:var(--green);">' + (t.type === 'payment' ? fmtRs(t.amount) : '') + '</td><td class="r"><b>' + fmtRs(run) + '</b></td>'
        + '<td><button class="btn btn-xs btn-danger" onclick="if(confirm(\'यो entry हटाउने?\')){Payables.delTxn(\'' + esc(t.id) + '\');Payables.view(\'' + esc(id) + '\');Payables.render();}">🗑</button></td></tr>';
    }).join('');
    var projOpts = '<option value="">— कुनै Project होइन —</option>';
    try { projOpts += Projects.getData().map(function (pj) { return '<option value="' + esc(pj.id) + '">' + esc(pj.name) + '</option>'; }).join(''); } catch (e) {}
    this._pendingPhotos = [];
    this._stockLines = [];
    this._modal(esc(self.KINDS[p.kind] || '') + ' — ' + esc(p.name),
      '<div class="proj-nums" style="margin-bottom:12px;"><div><span>बिल</span><b>' + fmtRs(b.bills) + '</b></div><div><span>तिरेको</span><b style="color:var(--green);">' + fmtRs(b.paid) + '</b></div><div><span>तिर्न बाँकी</span><b id="pay-v-due" style="color:' + (b.due > 0 ? 'var(--red)' : 'var(--green)') + ';">' + fmtRs(b.due) + '</b></div></div>'
      + '<div class="card card-body" style="background:var(--surface-2);margin-bottom:12px;"><div class="form-grid">'
      + '<div class="form-group"><label>Entry</label><select id="pay-t-type"><option value="bill">🧾 बिल (तिर्नुपर्ने थपियो)</option><option value="payment">💸 भुक्तानी / एड्भान्स दिएको</option></select></div>'
      + '<div class="form-group"><label>रकम (Rs.)</label><input type="number" id="pay-t-amount" min="0" inputmode="decimal"></div>'
      + '<div class="form-group"><label>मिति</label><input type="date" id="pay-t-date" value="' + todayISO() + '"></div>'
      + '<div class="form-group"><label>बिल नं.</label><input type="text" id="pay-t-bill"></div>'
      + '<div class="form-group"><label>बिलमा VAT रकम (भए)</label><input type="number" id="pay-t-vat" min="0" inputmode="decimal"></div>'
      + '<div class="form-group" data-module="projects"><label>Project / Site</label><select id="pay-t-proj">' + projOpts + '</select></div>'
      + '<div class="form-group"><label>विवरण</label><input type="text" id="pay-t-note"></div>'
      + '<div class="form-group full"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="pay-t-daybook" checked style="width:16px;height:16px;"> भुक्तानी Day Book मा पनि खर्चको रूपमा लेख्ने</label></div>'
      + this._stockBox()
      + '<div class="form-group full"><button type="button" class="btn btn-sm btn-secondary" onclick="Payables.addPhoto()">📸 बिल रसिदको फोटो</button><div class="media-row" id="pay-t-photos"></div></div>'
      + '</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;"><button class="btn btn-sm btn-secondary" onclick="Payables.openParty(\'' + esc(id) + '\')">✏️ Edit</button>'
      + '<button class="btn btn-sm btn-primary" id="pay-t-save" onclick="Payables.saveTxn(\'' + esc(id) + '\')">➕ थप्नुहोस्</button></div></div>'
      + '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:0.8rem;"><thead><tr><th>मिति</th><th>विवरण</th><th class="r">बिल</th><th class="r">तिरेको</th><th class="r">बाँकी</th><th></th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">कुनै entry छैन</td></tr>') + '</tbody></table></div>');
  },
  // ── v7.2.0: बिलमा आएका सामान → Stock In (Stock module On हुँदा मात्र देखिन्छ) ──
  _stockLines: [],
  _stockBox: function () {
    var items = []; try { items = Stock.getData(); } catch (e) {}
    if (!items.length) return '';
    return '<div class="form-group full" data-module="stock" id="pay-t-stock"><label>📦 बिलमा आएका सामान → Stock मा थप्ने (बिलका लागि, ऐच्छिक)</label>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;"><select id="pay-t-stk-item" style="flex:1;min-width:140px;"><option value="">— सामान छान्नुहोस् —</option>'
      + items.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + ' (' + (s.qty || 0) + ' ' + esc(s.unit || '') + ')</option>'; }).join('')
      + '</select><input type="number" id="pay-t-stk-qty" min="0" placeholder="Qty" inputmode="decimal" style="width:80px;">'
      + '<button type="button" class="btn btn-sm btn-secondary" id="pay-t-stk-add" onclick="Payables.addStockLine()">➕ सामान</button></div>'
      + '<div id="pay-t-stk-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;"></div></div>';
  },
  addStockLine: function () {
    var id = getVal('pay-t-stk-item'), q = parseFloat(getVal('pay-t-stk-qty')) || 0;
    if (!id || q <= 0) { App.toast('सामान र Qty हाल्नुहोस्', 'error'); return; }
    var s = Stock.find(id); if (!s) return;
    var ex = this._stockLines.find(function (l) { return l.stockId === id; });
    if (ex) ex.qty += q; else this._stockLines.push({ stockId: id, name: s.name, qty: q, unit: s.unit || '' });
    setVal('pay-t-stk-qty', ''); this._renderStockLines();
  },
  removeStockLine: function (i) { this._stockLines.splice(i, 1); this._renderStockLines(); },
  _renderStockLines: function () {
    var box = document.getElementById('pay-t-stk-list'); if (!box) return;
    box.innerHTML = this._stockLines.map(function (l, i) {
      return '<span class="tag tag-green" style="display:inline-flex;gap:6px;align-items:center;">+' + l.qty + ' ' + esc(l.unit) + ' ' + esc(l.name)
        + ' <a href="javascript:void(0)" onclick="Payables.removeStockLine(' + i + ')" style="color:var(--red);text-decoration:none;">✕</a></span>';
    }).join('');
  },
  addPhoto: function () {
    var self = this;
    Media.pick({ kind: 'bill', label: 'Supplier bill' }, true).then(function (recs) {
      recs.forEach(function (r) { self._pendingPhotos.push(r.id); });
      var box = document.getElementById('pay-t-photos'); if (box) { box.innerHTML = Media.thumbs(self._pendingPhotos); Media.hydrate(box); }
    });
  },
  saveTxn: function (partyId) {
    try {
      var d = getVal('pay-t-date') || todayISO();
      this.addTxn({ partyId: partyId, type: getVal('pay-t-type'), amount: getVal('pay-t-amount'), date: d, billNo: getVal('pay-t-bill'), vat: getVal('pay-t-vat'), note: getVal('pay-t-note'), projectId: getVal('pay-t-proj'), photoIds: (this._pendingPhotos || []).slice(), stockItems: (this._stockLines || []).slice() },
        { toDayBook: !!(document.getElementById('pay-t-daybook') || {}).checked });
      this._pendingPhotos = []; this._stockLines = [];
      this.view(partyId); this.render();
      App.toast('✅ Entry थपियो', 'success');
    } catch (e) { App.toast('❌ ' + e.message, 'error'); }
  },

  exportCSV: function () {
    var self = this, rows = [['Name', 'Type', 'Work', 'Phone', 'PAN', 'Bills', 'Paid', 'Due']];
    this.parties().forEach(function (p) { var b = self.balance(p.id); rows.push([p.name, p.kind, p.work || '', p.phone || '', p.pan || '', b.bills, b.paid, b.due]); });
    CAExport.download('supplier-payables-' + todayISO() + '.csv', rows);
  }
};
