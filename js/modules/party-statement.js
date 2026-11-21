// ─── v7.3.0: ग्राहक / सप्लायर खाता विवरण (Party Ledger / Khata Statement) ───
//   PartyStatement.build({kind:'customer'|'supplier', id, from, to})
//     → Opening Balance, every bill / receipt / payment line with a Running Balance, totals and Closing Balance.
//   PartyStatement.open(kind, id)   screen with period filter (यो महिना / गत महिना / आर्थिक वर्ष / सबै / कस्टम मिति)
//   Print / PDF (A4, A5), photo (PNG) → Web Share (WhatsApp) or download, WhatsApp text summary, CSV.
//
// Read-only: it never writes to storage. Numbers come from the same places the rest of the app already uses,
// so the all-time closing balance equals SmartRem.dueFor (customers) and Payables.balance (suppliers):
//   Customer: invoices (bill = Dr, paid at billing + each installment in inv.payments = Cr, sales return = Cr)
//             + manual Customer Ledger lines. Ledger lines auto-posted from an invoice (_inv) or a return (_return)
//             are skipped because the invoice already counts them. Cancelled bills are listed but never counted.
//   Supplier: Payables entries (pk3_payable_txns) — purchase bills = Cr (तिर्नुपर्ने), payments / advances = Dr.
// Company details only come from Company Settings (DocPrint._co / Company.fill) — nothing is hardcoded.
var PartyStatement = {
  MAX_PNG_ROWS: 350,
  PERIODS: [['month', 'यो महिना'], ['lastmonth', 'गत महिना'], ['fy', 'यो आर्थिक वर्ष'], ['all', 'सबै'], ['custom', 'कस्टम मिति']],
  _s: null,        // current screen state {kind, id, period, from, to}
  _png: null,      // {st, blob, p} prepared photo for the current statement

  _r2: function(n){ return Math.round((parseFloat(n) || 0) * 100) / 100; },
  _iso: function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _real: function(a){ return (typeof SampleData !== 'undefined' && SampleData.real) ? SampleData.real(a || []) : (a || []); },

  // ── dates ──
  /** Any stored date → 'YYYY-MM-DD' (AD). Ledger lines sometimes keep only a BS date. */
  adOf: function(s){
    if(!s) return '';
    s = String(s).slice(0, 10).replace(/\//g, '-');
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if(!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    if(y >= 2060){ try { return this._iso(bsToAd(y, mo, d)); } catch(e){ return ''; } }   // BS year (AD is ~57 years smaller)
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  },
  bsOf: function(iso){ try { return iso ? _bsFromAd(iso) : ''; } catch(e){ return ''; } },
  _bsAd: function(y, m, d){ return this._iso(bsToAd(y, m, d)); },
  _dayBefore: function(iso){ var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() - 1); return this._iso(d); },

  /** Period → {from, to, label} in AD. todayB (BS 'YYYY-MM-DD') can be passed for tests. */
  period: function(key, from, to, todayB){
    var b = String(todayB || todayBs()).split('-'), y = +b[0], m = +b[1], self = this;
    var monthRange = function(yy, mm){
      var ny = mm === 12 ? yy + 1 : yy, nm = mm === 12 ? 1 : mm + 1;
      return { from: self._bsAd(yy, mm, 1), to: self._dayBefore(self._bsAd(ny, nm, 1)), label: bsMonthName(mm) + ' ' + yy };
    };
    if(key === 'month'){ var r = monthRange(y, m); r.label = 'यो महिना — ' + r.label; return r; }
    if(key === 'lastmonth'){ var r2 = monthRange(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1); r2.label = 'गत महिना — ' + r2.label; return r2; }
    if(key === 'fy'){   // Nepali fiscal year: 1 Shrawan → end of Asar
      var sy = m >= 4 ? y : y - 1;
      return { from: this._bsAd(sy, 4, 1), to: this._dayBefore(this._bsAd(sy + 1, 4, 1)), label: 'आर्थिक वर्ष ' + sy + '/' + String(sy + 1).slice(-2) };
    }
    if(key === 'custom'){
      var f = this.adOf(from), t = this.adOf(to);
      if(f && t && f > t){ var x = f; f = t; t = x; }
      return { from: f, to: t, label: (f || t) ? 'मिति ' + (f ? this.bsOf(f) : '…') + ' देखि ' + (t ? this.bsOf(t) : '…') + ' सम्म' : 'सबै कारोबार' };
    }
    return { from: '', to: '', label: 'सबै कारोबार' };
  },

  // ── data ──
  party: function(kind, id){
    if(kind === 'supplier'){
      var p = null; try { p = Payables.party(id); } catch(e){}
      return p ? { id: p.id, name: p.name || '', phone: p.phone || '', address: p.address || '', pan: p.pan || '', sub: p.work || '' } : null;
    }
    var c = (STORE.get('pk3_customers', []) || []).find(function(x){ return x && x.id === id; });
    return c ? { id: c.id, name: c.name || '', phone: c.phone || '', address: c.address || '', pan: c.pan || c.vat || '', sub: '' } : null;
  },
  parties: function(kind){
    var l = kind === 'supplier' ? (function(){ try { return Payables.parties(); } catch(e){ return []; } })() : this._real(STORE.get('pk3_customers', []) || []);
    return l.filter(function(x){ return x && x.id; }).slice().sort(function(a, b){ return String(a.name || '').localeCompare(String(b.name || '')); });
  },

  /** Every line for one party (unsorted, all dates). Row: {date, ref, desc, bill, pay, info, o} */
  entries: function(kind, id){
    var out = [], self = this, seq = 0;
    var add = function(r){ r.bill = self._r2(r.bill); r.pay = self._r2(r.pay); r.seq = seq++; out.push(r); };
    if(kind === 'supplier'){
      var txns = []; try { txns = Payables.txns(); } catch(e){}
      txns.forEach(function(t){
        if(!t || t.partyId !== id) return;
        var a = parseFloat(t.amount) || 0, bill = t.type === 'bill';
        add({ date: self.adOf(t.date) || self.adOf(t.dateBs), ref: t.billNo || '', o: bill ? 0 : 1,
          desc: (bill ? '🧾 खरिद बिल' : '💸 भुक्तानी / एड्भान्स') + (t.note ? ' — ' + t.note : ''),
          bill: bill ? a : 0, pay: bill ? 0 : a });
      });
      return out;
    }
    var invs = STORE.get('pk3_invoices', []) || [];
    var rets = STORE.get('pk3_returns', []) || [];
    invs.forEach(function(inv){
      if(!inv || inv.custId !== id || inv._demo) return;
      var d = self.adOf(inv.date) || self.adOf(inv.dateBs), no = inv.invNum || '';
      if(inv.status === 'Cancelled' || inv.cancelled){
        add({ date: d, ref: no, o: 0, info: true, bill: 0, pay: 0,
          desc: '❌ रद्द बिल (' + fmtRs(inv.amount) + ') — हिसाबमा गनिँदैन' + (inv.cancelled && inv.cancelled.reason ? ' · ' + inv.cancelled.reason : '') });
        return;
      }
      add({ date: d, ref: no, o: 0, desc: '🧾 बिल' + (inv.desc ? ' — ' + inv.desc : ''), bill: parseFloat(inv.amount) || 0, pay: 0 });
      var pays = Array.isArray(inv.payments) ? inv.payments : [];
      var sumP = pays.reduce(function(s, p){ return s + (parseFloat(p && p.amount) || 0); }, 0);
      var first = self._r2(Math.max(0, (parseFloat(inv.paid) || 0) - sumP));
      if(first > 0) add({ date: d, ref: no, o: 1, desc: '💵 बिल बनाउँदा भुक्तानी प्राप्त', bill: 0, pay: first });
      pays.forEach(function(p){
        if(!p) return;
        add({ date: self.adOf(p.date) || self.adOf(p.dateBs) || d, ref: p.rcptNo || no, o: 1,
          desc: '💵 भुक्तानी प्राप्त — ' + no + (p.mode ? ' (' + p.mode + ')' : ''), bill: 0, pay: parseFloat(p.amount) || 0 });
      });
      if(inv._returned && (parseFloat(inv._returnedAmt) || 0) > 0){
        var r = rets.find(function(x){ return x && x.srcType === 'invoice' && x.srcId === inv.id; });
        add({ date: (r && (self.adOf(r.date) || self.adOf(r.dateBs))) || d, ref: no, o: 2,
          desc: '↩️ बिक्री फिर्ता (Sales Return)' + (r && r.reason ? ' — ' + r.reason : ''), bill: 0, pay: parseFloat(inv._returnedAmt) || 0 });
      }
    });
    var led = []; try { led = Ledger.getData(); } catch(e){ led = STORE.get('pk3_ledger', []) || []; }
    led.forEach(function(t){
      if(!t || t.customerId !== id || t._inv || t._return) return;   // already counted from the invoice
      add({ date: self.adOf(t.dateAd) || self.adOf(t.date), ref: '', o: 1, desc: '📒 ' + (t.narration || t.desc || 'Ledger entry'),
        bill: parseFloat(t.debit) || 0, pay: parseFloat(t.credit) || 0 });
    });
    return out;
  },

  /** o = {kind, id, from, to, label}. Balance = bills − receipts/payments (customer: लिनुपर्ने, supplier: तिर्नुपर्ने). */
  build: function(o){
    o = o || {};
    var kind = o.kind === 'supplier' ? 'supplier' : 'customer', self = this;
    var party = this.party(kind, o.id);
    if(!party) return null;
    var from = this.adOf(o.from), to = this.adOf(o.to);
    var all = this.entries(kind, party.id).sort(function(a, b){
      return (a.date || '').localeCompare(b.date || '') || a.o - b.o || a.seq - b.seq;
    });
    var opening = 0, run, rows = [], tb = 0, tp = 0;
    all.forEach(function(r){ if(from && (r.date || '') < from) opening += r.bill - r.pay; });
    opening = this._r2(opening); run = opening;
    all.forEach(function(r){
      var d = r.date || '';
      if(from && d < from) return;
      if(to && d && d > to) return;
      run = self._r2(run + r.bill - r.pay); tb += r.bill; tp += r.pay;
      rows.push({ date: d, dateBs: self.bsOf(d), ref: r.ref, desc: r.desc, bill: r.bill, pay: r.pay, info: !!r.info, balance: run });
    });
    return {
      kind: kind, party: party, from: from, to: to, fromBs: this.bsOf(from), toBs: this.bsOf(to),
      label: o.label || (from || to ? '' : 'सबै कारोबार'),
      opening: opening, rows: rows, totalBill: this._r2(tb), totalPay: this._r2(tp), closing: this._r2(run),
      count: rows.filter(function(r){ return !r.info; }).length,
      generatedBs: todayBs(), generatedAd: todayISO()
    };
  },

  // ── wording ──
  L: function(kind){
    return kind === 'supplier'
      ? { who: 'सप्लायर / Supplier', bill: 'बिल (Cr)', pay: 'भुक्तानी (Dr)', billT: 'जम्मा खरिद बिल', payT: 'जम्मा भुक्तानी', pos: 'तिर्नुपर्ने', neg: 'अग्रिम दिएको', posS: 'Cr', negS: 'Dr' }
      : { who: 'ग्राहक / Customer', bill: 'बिल (Dr)', pay: 'प्राप्त (Cr)', billT: 'जम्मा बिल', payT: 'जम्मा प्राप्त', pos: 'लिनुपर्ने', neg: 'अग्रिम / बढी प्राप्त', posS: 'Dr', negS: 'Cr' };
  },
  balTxt: function(kind, n){
    var L = this.L(kind); n = this._r2(n);
    if(Math.abs(n) < 0.005) return fmtRs(0);
    return fmtRs(Math.abs(n)) + ' ' + (n > 0 ? L.posS : L.negS);
  },
  balWord: function(kind, n){ var L = this.L(kind); return Math.abs(n) < 0.5 ? 'हिसाब बराबर' : (n > 0 ? L.pos : L.neg); },
  _dateTxt: function(r){ return r.dateBs ? r.dateBs.replace(/-/g, '/') : (r.date || '—'); },
  periodTxt: function(st){
    if(!st.from && !st.to) return st.label || 'सबै कारोबार';
    return (st.label ? st.label + ' · ' : '') + (st.fromBs || '…').replace(/-/g, '/') + ' — ' + (st.toBs || '…').replace(/-/g, '/') + ' (BS)';
  },

  // ── HTML (screen preview + print) ──
  html: function(st){
    var co = DocPrint._co(), L = this.L(st.kind), self = this, p = st.party;
    var c = function(n){ return n ? fmtRs(n) : ''; };
    var rows = st.rows.map(function(r){
      return '<tr' + (r.info ? ' class="pst-info"' : '') + '><td>' + esc(self._dateTxt(r)) + '</td><td>' + esc(r.desc) + (r.ref ? '<div class="pst-ref">' + esc(r.ref) + '</div>' : '') + '</td>'
        + '<td class="r">' + c(r.bill) + '</td><td class="r ok">' + c(r.pay) + '</td><td class="r b">' + (r.info ? '' : esc(self.balTxt(st.kind, r.balance))) + '</td></tr>';
    }).join('');
    var tile = function(l, v, cls, attr){ return '<div class="pst-tile' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b' + (attr ? ' ' + attr : '') + '>' + v + '</b></div>'; };
    return '<div class="pst-doc">'
      + '<style>.pst-doc{font-family:"Segoe UI","Noto Sans Devanagari","Nirmala UI",Arial,sans-serif;color:#1f2937;background:#fff;padding:18px;max-width:900px;margin:0 auto;font-size:13px;}'
      + '.pst-doc .pst-head{display:flex;justify-content:space-between;gap:12px;border-bottom:4px solid #f97316;padding-bottom:10px;margin-bottom:12px;}'
      + '.pst-doc .pst-co{font-size:20px;font-weight:900;color:#c2410c;}.pst-doc .pst-sm{font-size:11.5px;color:#4b5563;}'
      + '.pst-doc .pst-title{text-align:right;font-weight:900;font-size:18px;color:#111827;}.pst-doc .pst-title div{font-weight:400;font-size:13px;color:#6b7280;}'
      + '.pst-doc .pst-boxes{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;}.pst-doc .pst-box{flex:1;min-width:200px;border:1px solid #e5e7eb;border-radius:10px;padding:8px 12px;}'
      + '.pst-doc .pst-lbl{font-size:10.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;}.pst-doc .pst-nm{font-size:16px;font-weight:800;color:#111827;}'
      + '.pst-doc .pst-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}.pst-doc .pst-tile{background:#f9fafb;border-radius:10px;padding:8px 10px;}'
      + '.pst-doc .pst-tile span{display:block;font-size:10.5px;color:#6b7280;}.pst-doc .pst-tile b{font-size:14px;color:#111827;}.pst-doc .pst-tile.cl{background:#fff7ed;}.pst-doc .pst-tile.cl b{color:#c2410c;}'
      + '.pst-doc table{width:100%;border-collapse:collapse;font-size:12.5px;}.pst-doc th{background:#fff7ed;color:#9a3412;text-align:left;padding:7px 8px;border-bottom:2px solid #fdba74;}'
      + '.pst-doc td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;}.pst-doc .r{text-align:right;white-space:nowrap;}.pst-doc .b{font-weight:700;}.pst-doc .ok{color:#15803d;}'
      + '.pst-doc .pst-ref{font-size:10.5px;color:#9ca3af;}.pst-doc .pst-info td{color:#9ca3af;font-style:italic;}.pst-doc .pst-op td{background:#f9fafb;font-weight:700;}'
      + '.pst-doc .pst-tot td{border-top:2px solid #e5e7eb;font-weight:800;}.pst-doc .pst-cl td{background:#fff7ed;font-weight:900;color:#c2410c;font-size:14px;}'
      + '.pst-doc .pst-foot{margin-top:14px;text-align:center;font-size:10.5px;color:#9ca3af;}'
      + '@media (max-width:560px){.pst-doc .pst-tiles{grid-template-columns:repeat(2,1fr);}.pst-doc{padding:10px;}}</style>'
      + '<div class="pst-head"><div>' + (co.logo ? '<img src="' + esc(co.logo) + '" alt="" style="max-height:52px;max-width:120px;display:block;margin-bottom:4px;">' : '')
      + '<div class="pst-co">' + esc(co.name) + '</div>'
      + (co.address ? '<div class="pst-sm">📍 ' + esc(co.address) + '</div>' : '') + (co.phone ? '<div class="pst-sm">📞 ' + esc(co.phone) + '</div>' : '')
      + (co.pan ? '<div class="pst-sm"><b>PAN / VAT: ' + esc(co.pan) + '</b></div>' : '') + '</div>'
      + '<div class="pst-title">ACCOUNT STATEMENT<div>खाता विवरण</div></div></div>'
      + '<div class="pst-boxes"><div class="pst-box"><div class="pst-lbl">' + L.who + '</div><div class="pst-nm" data-pst-party>' + esc(p.name) + '</div>'
      + (p.phone ? '<div class="pst-sm">📞 ' + esc(p.phone) + '</div>' : '') + (p.address ? '<div class="pst-sm">📍 ' + esc(p.address) + '</div>' : '')
      + (p.pan ? '<div class="pst-sm">PAN / VAT: ' + esc(p.pan) + '</div>' : '') + '</div>'
      + '<div class="pst-box"><div class="pst-lbl">अवधि / Period</div><div style="font-weight:700;" data-pst-period>' + esc(this.periodTxt(st)) + '</div>'
      + '<div class="pst-sm">बनाएको मिति: ' + esc(String(st.generatedBs).replace(/-/g, '/')) + ' (' + esc(st.generatedAd) + ')</div></div></div>'
      + '<div class="pst-tiles">' + tile('Opening Balance', esc(this.balTxt(st.kind, st.opening))) + tile(L.billT, fmtRs(st.totalBill)) + tile(L.payT, fmtRs(st.totalPay))
      + tile('Closing — ' + this.balWord(st.kind, st.closing), esc(this.balTxt(st.kind, st.closing)), 'cl', 'data-pst-closing') + '</div>'
      + '<div style="overflow-x:auto;"><table><thead><tr><th>मिति (BS)</th><th>विवरण</th><th class="r">' + L.bill + '</th><th class="r">' + L.pay + '</th><th class="r">ब्यालेन्स</th></tr></thead><tbody>'
      + '<tr class="pst-op"><td>' + esc(st.fromBs ? st.fromBs.replace(/-/g, '/') : '—') + '</td><td>Opening Balance (अघिल्लो बाँकी)</td><td></td><td></td><td class="r">' + esc(this.balTxt(st.kind, st.opening)) + '</td></tr>'
      + (rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:16px;">यो अवधिमा कुनै कारोबार छैन</td></tr>')
      + '<tr class="pst-tot"><td></td><td>जम्मा (' + st.count + ' कारोबार)</td><td class="r">' + fmtRs(st.totalBill) + '</td><td class="r ok">' + fmtRs(st.totalPay) + '</td><td></td></tr>'
      + '<tr class="pst-cl"><td></td><td>Closing Balance — ' + this.balWord(st.kind, st.closing) + '</td><td></td><td></td><td class="r">' + esc(this.balTxt(st.kind, st.closing)) + '</td></tr>'
      + '</tbody></table></div>'
      + '<div class="pst-foot">' + esc(co.name) + ' · Generated by Swagatik</div></div>';
  },

  print: function(st, size){
    if(!st) return null;
    size = size === 'A5' ? 'A5' : 'A4';
    var w = window.open('', '_blank');
    if(!w){ App.toast('❌ Popup block भयो — browser मा popup allow गर्नुहोस्', 'error', 4000); return null; }
    var page = size === 'A5' ? '@page{size:A5;margin:7mm;}' : '@page{size:A4;margin:10mm;}';
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc('खाता विवरण — ' + st.party.name) + '</title>'
      + '<style>' + page + 'body{margin:0;background:#fff;}@media print{.pst-doc{max-width:none;padding:0;}' + (size === 'A5' ? '.pst-doc{font-size:11px;}' : '') + '}</style></head><body data-print-size="' + size + '">'
      + this.html(st) + '<script>window.onload=function(){setTimeout(function(){try{window.print();}catch(e){}},350);};<\/script></body></html>');
    w.document.close();
    return w;
  },

  csvRows: function(st){
    var L = this.L(st.kind), self = this;
    var rows = [['Date (BS)', 'Date (AD)', 'Ref', 'Particulars', L.bill, L.pay, 'Balance']];
    rows.push([st.fromBs, st.from, '', 'Opening Balance', '', '', this.balTxt(st.kind, st.opening)]);
    st.rows.forEach(function(r){ rows.push([r.dateBs, r.date, r.ref, r.desc, r.bill || '', r.pay || '', r.info ? '' : self.balTxt(st.kind, r.balance)]); });
    rows.push(['', '', '', 'Total', st.totalBill, st.totalPay, '']);
    rows.push([st.toBs, st.to, '', 'Closing Balance', '', '', this.balTxt(st.kind, st.closing)]);
    return rows;
  },
  fileBase: function(st){
    return ('Statement-' + st.party.name + '-' + (st.toBs || st.generatedBs)).replace(/[^A-Za-z0-9ऀ-ॿ_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  },
  exportCSV: function(st){
    if(!st) return '';
    return CAExport.download(this.fileBase(st) + '.csv', CAExport.toCSV(this.csvRows(st), 'खाता विवरण — ' + st.party.name + ' — ' + this.periodTxt(st)));
  },

  waText: function(st){
    var L = this.L(st.kind), n = (st.party.name || '').trim();
    var head = (n ? 'नमस्ते ' + n + ' जी 🙏' : 'नमस्ते 🙏') + '\n\n';
    var body = Company.fill('{company} को खाता विवरण') + ' (' + this.periodTxt(st) + '):\n\n'
      + '▫️ Opening Balance: ' + this.balTxt(st.kind, st.opening) + '\n'
      + '▫️ ' + L.billT + ': ' + fmtRs(st.totalBill) + '\n'
      + '▫️ ' + L.payT + ': ' + fmtRs(st.totalPay) + '\n'
      + '✅ *Closing Balance: ' + this.balTxt(st.kind, st.closing) + '* (' + this.balWord(st.kind, st.closing) + ')\n\n'
      + (st.kind === 'customer' && st.closing > 0.5 ? 'पूरा विवरण फोटोमा पठाइएको छ। केही फरक देखिए जानकारी दिनुहोला।\n\n' : 'पूरा विवरण फोटोमा पठाइएको छ।\n\n')
      + Company.fill('धन्यवाद 🙏\n{company}\n📞 {company_phone}');
    return head + body;
  },
  sendWA: function(st){
    if(!st) return;
    var text = this.waText(st);
    try { if(typeof Receivables !== 'undefined' && Receivables._wa) return Receivables._wa(st.party.phone, text); } catch(e){}
    return Wa.send(st.party.phone, text);
  },

  // ── PNG photo (canvas, offline) → Web Share (WhatsApp) / download ──
  render: function(st){
    var self = this, co = DocPrint._co();
    return DocShare._img(co.logo).then(function(logo){
      var probe = document.createElement('canvas'); probe.width = probe.height = 1;
      var h = Math.ceil(self._draw(probe.getContext('2d'), st, co, logo));
      var c = document.createElement('canvas'); c.width = DocShare.W; c.height = h;
      var x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      self._draw(x, st, co, logo);
      return c;
    });
  },
  toBlob: function(st){
    return this.render(st).then(function(c){
      return new Promise(function(res, rej){
        if(c.toBlob) return c.toBlob(function(b){ b ? res(b) : rej(new Error('toBlob')); }, 'image/png');
        var bin = atob(c.toDataURL('image/png').split(',')[1]), a = new Uint8Array(bin.length);
        for(var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        res(new Blob([a], { type: 'image/png' }));
      });
    });
  },
  prepare: function(st){
    var slot = { st: st, blob: null };
    this._png = slot;
    slot.p = this.toBlob(st).then(function(b){ slot.blob = b; return b; }, function(){ return null; });
    return slot.p;
  },
  // → Promise<'shared'|'downloaded'|'cancelled'|'error'>
  share: function(st){
    var name = this.fileBase(st) + '.png', slot = this._png && this._png.st === st ? this._png : null;
    var go = function(blob){
      if(!blob) throw new Error('no image');
      var file = null; try { file = new File([blob], name, { type: 'image/png' }); } catch(e){}
      if(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
        return navigator.share({ files: [file], title: name, text: 'खाता विवरण — ' + st.party.name + ' — ' + Company.name('') }).then(function(){ return 'shared'; }, function(err){
          if(err && err.name === 'AbortError') return 'cancelled';
          DocShare.download(blob, name); return 'downloaded';
        });
      }
      DocShare.download(blob, name);
      return 'downloaded';
    };
    var run;
    if(slot && slot.blob){ try { run = Promise.resolve(go(slot.blob)); } catch(e){ run = Promise.reject(e); } }
    else { try { App.toast('⏳ फोटो बन्दैछ…', 'info', 1200); } catch(e){} run = (slot ? slot.p : this.toBlob(st)).then(go); }
    return run.catch(function(){ try { App.toast('❌ फोटो बनाउन सकिएन', 'error'); } catch(e){} return 'error'; });
  },

  // Draws the statement; returns the height used (called once to measure, once to paint).
  _draw: function(ctx, st, co, logo){
    var W = DocShare.W, P = 48, F = DocShare.FONT, y = P, self = this, L = this.L(st.kind), p = st.party;
    var font = function(sz, wt){ ctx.font = (wt || 400) + ' ' + sz + 'px ' + F; };
    var text = function(s, x, yy, sz, wt, col, al){ font(sz, wt); ctx.fillStyle = col || '#1f2937'; ctx.textAlign = al || 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(s), x, yy); };
    var wrap = function(s, maxW, sz, wt){
      font(sz, wt); var out = [];
      String(s == null ? '' : s).split('\n').forEach(function(par){
        var line = '';
        par.split(/\s+/).forEach(function(w){
          var t = line ? line + ' ' + w : w;
          if(ctx.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t;
          while(ctx.measureText(line).width > maxW && line.length > 1){ var n = line.length; while(n > 1 && ctx.measureText(line.slice(0, n)).width > maxW) n--; out.push(line.slice(0, n)); line = line.slice(n); }
        });
        out.push(line);
      });
      return out;
    };
    var para = function(s, x, yy, maxW, sz, wt, col, lh, al){ var Ls = wrap(s, maxW, sz, wt); Ls.forEach(function(l, i){ text(l, x, yy + i * lh, sz, wt, col, al); }); return Ls.length * lh; };
    var rect = function(x, yy, w, h, fill){ ctx.fillStyle = fill; ctx.fillRect(x, yy, w, h); };
    var ORANGE = '#f97316', DARK = '#c2410c', GREY = '#4b5563', MUTED = '#9ca3af';

    // header
    var lx = P, top = y;
    if(logo){ var ls = 110, r = Math.min(ls / logo.width, ls / logo.height); ctx.drawImage(logo, P, y, logo.width * r, logo.height * r); lx = P + ls + 20; }
    text('ACCOUNT STATEMENT', W - P, y, 34, 900, '#111827', 'right');
    text('खाता विवरण', W - P, y + 44, 24, 400, '#6b7280', 'right');
    var cw = W - P - 380 - lx;
    y += para(co.name, lx, y, cw, 38, 900, DARK, 46);
    var contact = [co.address ? '📍 ' + co.address : '', co.phone ? '📞 ' + co.phone : ''].filter(Boolean).join('  •  ');
    if(contact) y += para(contact, lx, y + 4, cw, 21, 400, GREY, 29);
    if(co.pan) y += para('PAN / VAT No: ' + co.pan, lx, y + 4, cw, 21, 700, GREY, 29);
    y = Math.max(y + 8, top + (logo ? 118 : 0), top + 84);
    rect(P, y + 4, W - 2 * P, 6, ORANGE); y += 30;

    // party | period
    var gap = 20, rw = 400, lw = W - 2 * P - rw - gap, bt = y, pad = 16, ly = bt + pad, ry = bt + pad, rx = P + lw + gap;
    text(L.who.toUpperCase(), P + pad, ly, 18, 700, MUTED); ly += 28;
    ly += para(p.name || '—', P + pad, ly, lw - 2 * pad, 30, 800, '#111827', 38);
    if(p.phone) ly += para('📞 ' + p.phone, P + pad, ly, lw - 2 * pad, 22, 400, '#1f2937', 30);
    if(p.address) ly += para('📍 ' + p.address, P + pad, ly, lw - 2 * pad, 22, 400, '#1f2937', 30);
    if(p.pan) ly += para('PAN / VAT No: ' + p.pan, P + pad, ly, lw - 2 * pad, 22, 700, '#1f2937', 30);
    text('अवधि / PERIOD', rx + pad, ry, 18, 700, MUTED); ry += 28;
    ry += para(this.periodTxt(st), rx + pad, ry, rw - 2 * pad, 22, 800, '#111827', 30);
    ry += para('बनाएको: ' + String(st.generatedBs).replace(/-/g, '/') + ' (' + st.generatedAd + ')', rx + pad, ry + 4, rw - 2 * pad, 19, 400, GREY, 26) + 4;
    var bh = Math.max(ly, ry) - bt + pad - 4;
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.strokeRect(P, bt, lw, bh); ctx.strokeRect(rx, bt, rw, bh);
    y = bt + bh + 22;

    // summary tiles
    var tiles = [['Opening Balance', this.balTxt(st.kind, st.opening)], [L.billT, fmtRs(st.totalBill)], [L.payT, fmtRs(st.totalPay)], ['Closing — ' + this.balWord(st.kind, st.closing), this.balTxt(st.kind, st.closing)]];
    var tw = (W - 2 * P - 3 * 14) / 4;
    tiles.forEach(function(t, i){
      var x = P + i * (tw + 14), cl = i === 3;
      rect(x, y, tw, 92, cl ? '#fff7ed' : '#f9fafb');
      para(t[0], x + 14, y + 12, tw - 28, 18, 400, '#6b7280', 24);
      text(t[1], x + 14, y + 52, 24, 800, cl ? DARK : '#111827');
    });
    y += 92 + 22;

    // table
    var cols = [{ k: 'मिति (BS)', w: 150, al: 'left' }, { k: 'विवरण', w: 0, al: 'left' }, { k: L.bill, w: 165, al: 'right' }, { k: L.pay, w: 165, al: 'right' }, { k: 'ब्यालेन्स', w: 195, al: 'right' }];
    cols[1].w = W - 2 * P - cols.reduce(function(s, c){ return s + c.w; }, 0);
    var cx = P; cols.forEach(function(c){ c.x = cx; cx += c.w; });
    var at = function(c){ return c.al === 'right' ? c.x + c.w - 10 : c.x + 10; };
    rect(P, y, W - 2 * P, 50, '#fff7ed'); rect(P, y + 47, W - 2 * P, 3, '#fdba74');
    cols.forEach(function(c){ text(c.k, at(c), y + 13, 20, 800, '#9a3412', c.al); });
    y += 50;
    var line = function(cells, o){
      o = o || {};
      var D = wrap(cells[1], cols[1].w - 20, 21, o.wt || 400), refL = cells[5] ? 1 : 0, rh = D.length * 28 + refL * 24 + 18;
      if(o.bg) rect(P, y, W - 2 * P, rh, o.bg);
      var col = o.col || '#1f2937';
      text(cells[0], at(cols[0]), y + 10, 19, o.wt || 400, o.info ? MUTED : GREY);
      D.forEach(function(l, j){ text(l, at(cols[1]), y + 9 + j * 28, 21, o.wt || 400, o.info ? MUTED : col); });
      if(refL) text(cells[5], at(cols[1]), y + 9 + D.length * 28, 17, 400, MUTED);
      if(cells[2]) text(cells[2], at(cols[2]), y + 10, 20, o.wt || 400, col, 'right');
      if(cells[3]) text(cells[3], at(cols[3]), y + 10, 20, o.wt || 400, o.col || '#15803d', 'right');
      if(cells[4]) text(cells[4], at(cols[4]), y + 10, 20, o.bwt || 800, o.col || '#111827', 'right');
      rect(P, y + rh - 2, W - 2 * P, 2, '#f1f5f9');
      y += rh;
    };
    var c = function(n){ return n ? fmtRs(n) : ''; };
    line([st.fromBs ? st.fromBs.replace(/-/g, '/') : '—', 'Opening Balance (अघिल्लो बाँकी)', '', '', this.balTxt(st.kind, st.opening)], { bg: '#f9fafb', wt: 700 });
    var rows = st.rows, skipped = 0;
    if(rows.length > this.MAX_PNG_ROWS){ skipped = rows.length - this.MAX_PNG_ROWS; rows = rows.slice(-this.MAX_PNG_ROWS); }
    if(skipped) line(['', '… पहिलेका ' + skipped + ' लाइन फोटोमा अटेनन् — पूरा विवरण Print / PDF मा हेर्नुहोस्', '', '', ''], { info: true });
    if(!rows.length) line(['', 'यो अवधिमा कुनै कारोबार छैन', '', '', ''], { info: true });
    rows.forEach(function(r){ line([self._dateTxt(r), r.desc, c(r.bill), c(r.pay), r.info ? '' : self.balTxt(st.kind, r.balance), r.ref], { info: r.info }); });
    rect(P, y, W - 2 * P, 3, '#e5e7eb');
    line(['', 'जम्मा (' + st.count + ' कारोबार)', fmtRs(st.totalBill), fmtRs(st.totalPay), ''], { wt: 800 });
    line(['', 'Closing Balance — ' + this.balWord(st.kind, st.closing), '', '', this.balTxt(st.kind, st.closing)], { bg: '#fff7ed', wt: 900, col: DARK, bwt: 900 });
    y += 26;
    rect(P, y, W - 2 * P, 2, '#eeeeee'); y += 14;
    y += para(co.name + '  •  Generated by Swagatik', W / 2, y, W - 2 * P, 19, 400, MUTED, 26, 'center');
    return y + P - 10;
  },

  // ── screen ──
  current: function(){
    var s = this._s; if(!s || !s.id) return null;
    var pr = this.period(s.period, s.from, s.to);
    return this.build({ kind: s.kind, id: s.id, from: pr.from, to: pr.to, label: pr.label });
  },
  _modal: function(){
    var m = document.getElementById('pst-modal');
    if(!m){
      m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pst-modal'; m.style.zIndex = '260';
      document.body.appendChild(m);
    }
    return m;
  },
  close: function(){ var m = document.getElementById('pst-modal'); if(m) m.classList.remove('open'); },

  /** Open the statement screen. kind 'customer' | 'supplier'; id optional (party can be chosen on the screen). */
  open: function(kind, id){
    kind = kind === 'supplier' ? 'supplier' : 'customer';
    var prev = this._s || {};
    this._s = { kind: kind, id: id || '', period: prev.period || 'fy', from: prev.from || '', to: prev.to || '' };
    var m = this._modal(), self = this;
    var sizeOpts = ['A4', 'A5'].map(function(k){ return '<option value="' + k + '">📄 ' + k + '</option>'; }).join('');
    m.innerHTML = '<div class="modal" style="max-width:960px;">'
      + '<div class="modal-head"><div class="modal-title">📄 खाता विवरण (Party Statement)</div><button class="modal-close" onclick="PartyStatement.close()">✕</button></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">'
      + '<select id="pst-kind" style="width:auto;flex:0 0 auto;" onchange="PartyStatement.setKind(this.value)"><option value="customer">👤 ग्राहक</option><option value="supplier">🏪 सप्लायर / मिस्त्री</option></select>'
      + '<select id="pst-party" style="flex:1;min-width:180px;" onchange="PartyStatement.setParty(this.value)"></select></div>'
      + '<div id="pst-periods" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
      + this.PERIODS.map(function(p){ return '<button type="button" class="btn btn-sm btn-secondary" data-period="' + p[0] + '" onclick="PartyStatement.setPeriod(\'' + p[0] + '\')">' + p[1] + '</button>'; }).join('') + '</div>'
      + '<div id="pst-custom" style="display:none;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">'
      + '<label style="font-size:0.8rem;">देखि <input type="date" id="pst-from" style="width:auto;" onchange="PartyStatement.setCustom()"></label>'
      + '<label style="font-size:0.8rem;">सम्म <input type="date" id="pst-to" style="width:auto;" onchange="PartyStatement.setCustom()"></label>'
      + '<span id="pst-custom-bs" style="font-size:0.75rem;color:var(--text-muted);"></span></div>'
      + '<div id="pst-body" style="border-radius:10px;background:#fff;overflow-x:auto;"></div>'
      + '<div id="pst-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:12px;">'
      + '<select id="pst-size" class="btn btn-sm btn-secondary" style="width:auto;flex:0 0 auto;font-size:0.78rem;padding:6px 8px;min-height:0;height:auto;">' + sizeOpts + '</select>'
      + '<button class="btn btn-sm btn-primary" id="pst-print" onclick="PartyStatement.doPrint()">🖨️ Print / PDF</button>'
      + '<button class="btn btn-sm btn-wa" id="pst-png" onclick="PartyStatement.doShare()" style="white-space:normal;line-height:1.25;">📲 फोटो (PNG) — WhatsApp शेयर / डाउनलोड</button>'
      + '<button class="btn btn-sm btn-wa" id="pst-wa" onclick="PartyStatement.doWA()">📱 WhatsApp म्यासेज</button>'
      + '<button class="btn btn-sm btn-secondary" id="pst-csv" onclick="PartyStatement.doCSV()">📊 CSV</button></div></div>';
    try { var ps = PrintFmt.get(); document.getElementById('pst-size').value = ps === 'A5' ? 'A5' : 'A4'; } catch(e){}
    document.getElementById('pst-kind').value = kind;
    m.classList.add('open');
    this._fillParties();
    this.refresh();
    return m;
  },
  _fillParties: function(){
    var sel = document.getElementById('pst-party'); if(!sel) return;
    var s = this._s, list = this.parties(s.kind);
    sel.innerHTML = '<option value="">— ' + (s.kind === 'supplier' ? 'सप्लायर / मिस्त्री' : 'ग्राहक') + ' छान्नुहोस् —</option>'
      + list.map(function(p){ return '<option value="' + esc(p.id) + '">' + esc(p.name || '') + (p.phone ? ' (' + esc(p.phone) + ')' : '') + '</option>'; }).join('');
    sel.value = s.id || '';
    if(sel.value !== (s.id || '')) s.id = '';
  },
  setKind: function(k){ this._s.kind = k === 'supplier' ? 'supplier' : 'customer'; this._s.id = ''; this._fillParties(); this.refresh(); },
  setParty: function(id){ this._s.id = id || ''; this.refresh(); },
  setPeriod: function(p){
    this._s.period = p;
    if(p === 'custom' && !this._s.from && !this._s.to){ var pr = this.period('month'); this._s.from = pr.from; this._s.to = pr.to; }
    this.refresh();
  },
  setCustom: function(){ this._s.from = getVal('pst-from'); this._s.to = getVal('pst-to'); this._s.period = 'custom'; this.refresh(); },
  refresh: function(){
    var s = this._s, body = document.getElementById('pst-body'); if(!body) return null;
    document.querySelectorAll('#pst-periods [data-period]').forEach(function(b){ b.className = 'btn btn-sm ' + (b.getAttribute('data-period') === s.period ? 'btn-primary' : 'btn-secondary'); });
    var cu = document.getElementById('pst-custom');
    if(cu){
      cu.style.display = s.period === 'custom' ? 'flex' : 'none';
      setVal('pst-from', s.from); setVal('pst-to', s.to);
      setText('pst-custom-bs', s.period === 'custom' ? this.period('custom', s.from, s.to).label : '');
    }
    var st = this.current();
    document.querySelectorAll('#pst-actions button').forEach(function(b){ b.disabled = !st; });
    if(!st){
      this._png = null;
      body.innerHTML = '<div class="empty-state" style="padding:30px;background:var(--surface);"><div class="icon">📄</div><div class="title">माथिबाट ' + (s.kind === 'supplier' ? 'सप्लायर / मिस्त्री' : 'ग्राहक') + ' छान्नुहोस्</div>'
        + '<div class="subtitle">Opening Balance, सबै बिल, प्राप्त / भुक्तानी, Running Balance र Closing Balance एकै ठाउँमा</div></div>';
      return null;
    }
    body.innerHTML = this.html(st);
    this._st = st;
    this.prepare(st);   // ready ahead so the share sheet opens straight from the tap on mobile
    return st;
  },
  doPrint: function(){ if(this._st) this.print(this._st, getVal('pst-size')); },
  doShare: function(){ return this._st ? this.share(this._st) : null; },
  doWA: function(){ if(this._st) this.sendWA(this._st); },
  doCSV: function(){ if(this._st){ this.exportCSV(this._st); try { App.toast('📊 CSV डाउनलोड भयो', 'success'); } catch(e){} } }
};
