// ─── v7.2.0: बाँकी रकम (Receivables) — 1-click WhatsApp reminder + किस्ता / आंशिक भुक्तानी रसिद ───
//   • Receivables.dueList()     customers with money still to collect (cancelled / demo bills never count)
//   • Receivables.remind(id)    one tap → polite Nepali WhatsApp reminder (template uses the user's own
//                               Company Settings through {company}, {phone1} … — nothing is hardcoded)
//   • Receivables.receive()     record a partial / installment payment on an invoice (inv.payments[]),
//                               keeps paid / balance / status and the Customer Ledger in step
//   • Receivables.showReceipt() Payment Receipt → Print / PDF (A4, A5, 80mm, 58mm) or PNG share (DocPrint / DocShare)
// Storage: inv.payments (inside pk3_invoices), pk3_due_wa_tpl (custom message, optional),
//          pk3_due_reminded {custId: ISO time of the last reminder}. All pk3_* → synced + backed up.
var Receivables = {
  TPL_KEY: 'pk3_due_wa_tpl',
  SENT_KEY: 'pk3_due_reminded',
  MODES: ['Cash', 'Bank Transfer', 'eSewa', 'Khalti', 'Fonepay / QR', 'Cheque', 'Other'],
  DEFAULT_TPL: 'नमस्ते {name} जी 🙏\n\n'
    + '{company} बाट विनम्र सम्झना: हाम्रो हिसाब अनुसार तपाईंको {amount} भुक्तानी बाँकी रहेको देखिन्छ।\n'
    + '{bills}\n\n'
    + 'तपाईंको सुविधा अनुसार भुक्तानी मिलाइदिनुहुन विनम्र अनुरोध गर्दछौं।'
    + '{payment_info}\n\n'
    + 'भुक्तानी भइसकेको भए यो सन्देश बेवास्ता गर्नुहोला। केही जिज्ञासा भए निःसंकोच सम्पर्क गर्नुहोला।\n\n'
    + 'धन्यवाद 🙏\n{company}\n📞 {company_phone}',

  _r2: function(n){ return Math.round((parseFloat(n) || 0) * 100) / 100; },
  _invs: function(){ return STORE.get('pk3_invoices', []) || []; },
  _isCxl: function(i){ return !!i && (i.status === 'Cancelled' || !!i.cancelled); },
  _days: function(iso){ try { return SmartRem._daysSince(iso); } catch(e){ return 0; } },

  // ── money helpers ──
  /** What the customer still owes on this bill (after any sales return). Cancelled → 0. */
  balanceOf: function(inv){
    if(!inv || this._isCxl(inv)) return 0;
    var b = (inv.balance != null && inv.balance !== '') ? parseFloat(inv.balance) || 0 : (parseFloat(inv.amount) || 0) - (parseFloat(inv.paid) || 0);
    if(inv._returned) b -= parseFloat(inv._returnedAmt) || 0;
    return this._r2(Math.max(0, b));
  },
  payments: function(inv){ return (inv && Array.isArray(inv.payments)) ? inv.payments : []; },
  /** Paid before installments were tracked (old bills / amount typed in the invoice form). */
  openingPaid: function(inv){
    var s = this.payments(inv).reduce(function(t, p){ return t + (parseFloat(p.amount) || 0); }, 0);
    return this._r2(Math.max(0, (parseFloat(inv && inv.paid) || 0) - s));
  },
  nextRcptNo: function(dateBs){
    var yr = (dateBs && String(dateBs).slice(0, 4)) || todayBs().slice(0, 4), stem = 'RCPT-' + yr + '-', max = 0;
    this._invs().forEach(function(i){
      (i && Array.isArray(i.payments) ? i.payments : []).forEach(function(p){
        var s = String(p.rcptNo || '');
        if(s.indexOf(stem) === 0){ var n = parseInt(s.slice(stem.length), 10); if(!isNaN(n) && n > max) max = n; }
      });
    });
    return stem + String(max + 1).padStart(4, '0');
  },
  _status: function(inv){
    var bal = this._r2((parseFloat(inv.amount) || 0) - (parseFloat(inv.paid) || 0));
    inv.balance = Math.max(0, bal);
    inv.status = (parseFloat(inv.paid) || 0) <= 0 ? 'Pending' : (bal > 0.5 ? 'Partial' : 'Paid');
  },

  /** Record an installment / partial payment. o = {amount, date(AD), mode, ref, note}. Returns {inv, pay}. */
  receive: function(invId, o){
    o = o || {};
    var list = this._invs(), inv = list.find(function(x){ return x && x.id === invId; });
    if(!inv) throw new Error('Invoice भेटिएन');
    if(this._isCxl(inv)) throw new Error('रद्द भएको बिलमा भुक्तानी लिन मिल्दैन');
    var amt = this._r2(o.amount), due = this.balanceOf(inv);
    if(!(amt > 0)) throw new Error('भुक्तानी रकम लेख्नुहोस्');
    if(due <= 0.5) throw new Error('यो बिलको पूरा भुक्तानी भइसकेको छ');
    if(amt > due + 0.5) throw new Error('बाँकी (' + fmtRs(due) + ') भन्दा बढी रकम लिन मिल्दैन');
    var date = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : todayISO();
    var dateBs = _bsFromAd(date) || todayBs();
    var by = (window.currentUser && currentUser.name) || '';
    var pay = { id: 'pay_' + uid(), rcptNo: this.nextRcptNo(dateBs), amount: amt, date: date, dateBs: dateBs,
      mode: this.MODES.indexOf(o.mode) >= 0 ? o.mode : 'Cash', ref: String(o.ref || '').trim(), note: String(o.note || '').trim(),
      by: by, at: new Date().toISOString() };
    inv.payments = this.payments(inv).concat([pay]);
    inv.paid = this._r2((parseFloat(inv.paid) || 0) + amt);
    this._status(inv);
    // Customer Ledger: only bills that already post ledger lines (_inv) get a matching credit line
    var led = STORE.get('pk3_ledger', []) || [];
    if(led.some(function(t){ return t && t._inv === inv.id && !t._cn && !t._pay; })){
      var narr = '💵 भुक्तानी प्राप्त — ' + inv.invNum + ' (' + pay.rcptNo + ', ' + pay.mode + ')';
      led.push({ id: 'lx_' + uid(), customerId: inv.custId, custName: inv.custName, date: dateBs, dateAd: date, narration: narr, desc: narr,
        debit: 0, credit: amt, _inv: inv.id, _pay: pay.id, created: pay.at });
      STORE.set('pk3_ledger', led);
    }
    STORE.set('pk3_invoices', list);
    try { Audit.log('PAYMENT', 'Received ' + fmtRs(amt) + ' — ' + inv.invNum + ' ' + (inv.custName || '') + ' (' + pay.rcptNo + ', ' + pay.mode + ')'); } catch(e){}
    try { Activity.add('💵 भुक्तानी ' + fmtRs(amt) + ' — ' + (inv.custName || '') + ' (' + inv.invNum + ')'); } catch(e){}
    return { inv: inv, pay: pay };
  },

  /** Undo a wrongly entered payment (its ledger line goes too). */
  removePayment: function(invId, payId){
    var list = this._invs(), inv = list.find(function(x){ return x && x.id === invId; });
    if(!inv) throw new Error('Invoice भेटिएन');
    var pay = this.payments(inv).find(function(p){ return p.id === payId; });
    if(!pay) throw new Error('भुक्तानी भेटिएन');
    if(this._isCxl(inv)) throw new Error('रद्द भएको बिलको भुक्तानी हटाउन मिल्दैन');
    inv.payments = this.payments(inv).filter(function(p){ return p.id !== payId; });
    inv.paid = this._r2(Math.max(0, (parseFloat(inv.paid) || 0) - (parseFloat(pay.amount) || 0)));
    this._status(inv);
    var led = STORE.get('pk3_ledger', []) || [], keep = led.filter(function(t){ return !(t && t._pay === payId); });
    if(keep.length !== led.length) STORE.set('pk3_ledger', keep);
    STORE.set('pk3_invoices', list);
    try { Audit.log('PAYMENT', 'Removed ' + fmtRs(pay.amount) + ' — ' + inv.invNum + ' (' + pay.rcptNo + ')'); } catch(e){}
    return inv;
  },

  // ── Payment Receipt (reuses DocPrint print sizes + DocShare PNG) ──
  receiptDoc: function(invId, payId){
    var inv = this._invs().find(function(x){ return x && x.id === invId; }); if(!inv) return null;
    var pays = this.payments(inv), idx = -1;
    pays.forEach(function(p, i){ if(p.id === payId) idx = i; });
    if(idx < 0) return null;
    var pay = pays[idx], open = this.openingPaid(inv), self = this;
    var before = this._r2(open + pays.slice(0, idx).reduce(function(t, p){ return t + (parseFloat(p.amount) || 0); }, 0));
    var after = this._r2(before + (parseFloat(pay.amount) || 0));
    var total = parseFloat(inv.amount) || 0, ret = inv._returned ? parseFloat(inv._returnedAmt) || 0 : 0;
    var bal = this._r2(Math.max(0, total - after - ret));
    var kista = idx + 1 + (open > 0.5 ? 1 : 0);
    var cust = (STORE.get('pk3_customers', []) || []).find(function(c){ return c && c.id === inv.custId; }) || {};
    var line = 'भुक्तानी प्राप्त — Invoice ' + (inv.invNum || '') + ' (किस्ता #' + kista + ') · ' + pay.mode + (pay.ref ? ' · Ref: ' + pay.ref : '');
    var rows = [{ label: 'Bill Total / बिल रकम', value: total }];
    if(before > 0) rows.push({ label: 'अघिल्लो भुक्तानी / Paid before', value: before });
    if(ret > 0) rows.push({ label: 'Sales Return / फिर्ता', value: ret });
    rows.push({ label: 'कुल भुक्तानी / Total paid', value: after, cls: 'ok' });
    rows.push({ label: 'Balance / बाँकी', value: bal, cls: 'bal' });
    return { kind: 'PAYMENT RECEIPT', kindNe: 'भुक्तानी रसिद', receipt: true, no: pay.rcptNo, dateAd: pay.date, dateBs: pay.dateBs,
      cust: { name: inv.custName || cust.name || '', phone: inv.custPhone || cust.phone || '', address: cust.address || '' },
      subject: 'Invoice ' + (inv.invNum || '') + ' को भुक्तानी', ref: inv.invNum || '',
      items: [{ name: line, qty: 1, unit: '', rate: parseFloat(pay.amount) || 0 }],
      sub: parseFloat(pay.amount) || 0, disc: 0, discP: 0, taxP: 0, taxAmt: 0, total: parseFloat(pay.amount) || 0,
      totalLabel: 'प्राप्त रकम', toLabel: 'Received from / ग्राहक', paidLabel: '', paid: 0, balance: bal, after: rows,
      notes: pay.note || '', terms: '', status: bal > 0.5 ? 'Partial' : 'Paid', noPay: bal <= 0.5, kista: kista };
  },
  showReceipt: function(invId, payId){
    var d = this.receiptDoc(invId, payId);
    if(!d){ App.toast('रसिद भेटिएन', 'error'); return; }
    var self = this;
    try { var vm = document.getElementById('view-modal'); if(vm && vm.parentNode) vm.parentNode.appendChild(vm); } catch(e){}   // above the बाँकी रकम panel
    DocPrint.preview(d, '🧾 Payment Receipt ' + d.no, [
      { label: '📱 WhatsApp म्यासेज', cls: 'btn-wa', id: 'rcv-rcpt-wa', onClick: function(){ self.receiptWA(invId, payId); } }
    ]);
  },
  receiptText: function(invId, payId){
    var d = this.receiptDoc(invId, payId); if(!d) return '';
    var n = (d.cust.name || '').trim();
    var t = (n ? 'नमस्ते ' + n + ' जी 🙏' : 'नमस्ते 🙏') + '\n\n'
      + '{company} मा तपाईंबाट मिति ' + (d.dateBs ? bsStringToDisplay(d.dateBs) : d.dateAd) + ' मा *' + fmtRs(d.total) + '* भुक्तानी प्राप्त भयो। धन्यवाद!\n\n'
      + '🧾 रसिद नं: ' + d.no + '\n'
      + '📄 Invoice: ' + d.ref + ' (किस्ता #' + d.kista + ')\n'
      + '💳 माध्यम: ' + d.items[0].name.split(' · ')[1] + '\n'
      + (d.balance > 0.5 ? '💰 बाँकी रकम: ' + fmtRs(d.balance) : '✅ यो बिलको पूरा भुक्तानी भयो') + '\n\n'
      + 'धन्यवाद 🙏\n{company}\n📞 {company_phone}';
    return Company.fill(t);
  },
  receiptWA: function(invId, payId){
    var d = this.receiptDoc(invId, payId); if(!d) return;
    this._wa(d.cust.phone, this.receiptText(invId, payId));
  },
  _wa: function(phone, text){
    if(typeof AIWA !== 'undefined' && AIWA._launch){
      var num = AIWA._waNumber(phone);
      if(!num) App.toast('⚠️ फोन नम्बर छैन — WhatsApp मा आफैं contact छान्नुहोस्', 'warning', 3500);
      AIWA._launch(AIWA.waUrl(num, text));
      return true;
    }
    return Wa.send(phone, text);
  },

  // ── Receivables list + reminder ──
  dueList: function(){
    var real = (typeof SampleData !== 'undefined' && SampleData.real) ? SampleData.real : function(a){ return a || []; };
    var custs = real(STORE.get('pk3_customers', []) || []), invs = this._invs(), self = this;
    var sent = STORE.get(this.SENT_KEY, {}) || {}, today = todayISO();
    var out = [];
    custs.forEach(function(c){
      if(!c || !c.id) return;
      var d = SmartRem.dueFor(c.id);
      if(d.total <= 0.5) return;
      var bills = invs.filter(function(i){ return i && i.custId === c.id && !i._demo && !self._isCxl(i) && i.status !== 'Paid' && self.balanceOf(i) > 0.5; })
        .map(function(i){
          var dueOn = i.dueDate || i.date || '';
          return { id: i.id, invNum: i.invNum || '', date: i.date || '', dateBs: i.dateBs || '', dueDate: i.dueDate || '', bal: self.balanceOf(i),
            overdue: !!(i.dueDate && i.dueDate < today), days: Math.max(0, self._days(dueOn)) };
        }).sort(function(a, b){ return (a.date || '').localeCompare(b.date || ''); });
      var od = bills.filter(function(b){ return b.overdue; });
      out.push({ custId: c.id, name: c.name || '—', phone: c.phone || '', total: d.total, inv: d.inv, ledger: d.ledger, bills: bills,
        overdue: od.length > 0, maxDays: bills.reduce(function(m, b){ return Math.max(m, b.days); }, 0), lastSent: sent[c.id] || '' });
    });
    return out.sort(function(a, b){ return (b.overdue - a.overdue) || (b.maxDays - a.maxDays) || (b.total - a.total); });
  },
  template: function(){ var t = STORE.get(this.TPL_KEY, ''); return (t && String(t).trim()) ? String(t) : this.DEFAULT_TPL; },
  saveTemplate: function(t){
    t = String(t || '').trim();
    if(!t || t === this.DEFAULT_TPL.trim()) STORE.del(this.TPL_KEY);
    else STORE.set(this.TPL_KEY, t);
  },
  _payInfo: function(){
    var co = DocPrint._co(), l = [];
    if(co.esewa) l.push('📱 eSewa: ' + co.esewa);
    if(co.khalti) l.push('💜 Khalti: ' + co.khalti);
    if(co.bank) l.push('🏦 ' + co.bank + (co.acc ? ' — A/C ' + co.acc : ''));
    return l.length ? '\n\nभुक्तानीका लागि:\n' + l.join('\n') : '';
  },
  message: function(row){
    if(!row) return '';
    var bills = row.bills.map(function(b){
      return '• बिल ' + b.invNum + (b.dateBs ? ' (' + bsStringToDisplay(b.dateBs) + ')' : '') + ' — ' + fmtRs(b.bal);
    });
    if(row.ledger > 0.5) bills.push('• अघिल्लो हिसाब — ' + fmtRs(row.ledger));
    var t = this.template();
    var v = { '{name}': (row.name || '').trim(), '{amount}': fmtRs(row.total), '{bills}': bills.join('\n'), '{payment_info}': this._payInfo(), '{days}': String(row.maxDays || 0) };
    Object.keys(v).forEach(function(k){ t = t.split(k).join(v[k]); });
    t = t.replace(/नमस्ते\s+जी/g, 'नमस्ते').replace(/\n{3,}/g, '\n\n');
    return Company.fill(t).trim();
  },
  /** One tap: open WhatsApp with the reminder for this customer. */
  remind: function(custId){
    var row = this.dueList().find(function(r){ return r.custId === custId; });
    if(!row){ App.toast('यो ग्राहकको बाँकी रकम छैन', 'info'); return false; }
    this._wa(row.phone, this.message(row));
    var sent = STORE.get(this.SENT_KEY, {}) || {}; sent[custId] = new Date().toISOString(); STORE.set(this.SENT_KEY, sent);
    try { SmartRem.markSent({ type: 'due', ref: '', custId: custId }); SmartRem.render(); } catch(e){}
    try { Activity.add('📲 बाँकी रकम रिमाइन्डर: ' + row.name + ' (' + fmtRs(row.total) + ')'); } catch(e){}
    try { Audit.log('WHATSAPP', 'Payment reminder sent to ' + row.name + ' ' + fmtRs(row.total)); } catch(e){}
    App.toast('📲 ' + row.name + ' लाई रिमाइन्डर खुल्यो', 'success', 2000);
    if(document.getElementById('rcv-modal') && document.getElementById('rcv-modal').classList.contains('open')) this.render();
    return true;
  },
  remindAI: function(custId){
    var row = this.dueList().find(function(r){ return r.custId === custId; }); if(!row) return;
    AIWA.open({ type: 'due', ref: '', custId: row.custId, name: row.name, phone: row.phone, amount: row.total });
  },

  // ── UI: बाँकी रकम panel ──
  _modal: function(id, title, maxW){
    var m = document.getElementById(id);
    if(!m){
      m = document.createElement('div'); m.className = 'modal-overlay'; m.id = id;
      m.innerHTML = '<div class="modal" style="max-width:' + (maxW || 640) + 'px;"><div class="modal-head"><div class="modal-title" id="' + id + '-title"></div>'
        + '<button class="modal-close" onclick="document.getElementById(\'' + id + '\').classList.remove(\'open\')">✕</button></div><div id="' + id + '-body"></div></div>';
      var vm = document.getElementById('view-modal');
      ((vm && vm.parentNode) || document.body).appendChild(m);   // same stacking layer as the bill preview
    }
    setText(id + '-title', title);
    return m;
  },
  _ago: function(iso){
    if(!iso) return '';
    var d = this._days(iso);
    return d <= 0 ? 'आज' : d + ' दिन अघि';
  },
  open: function(){
    this._modal('rcv-modal', '💰 बाँकी रकम / Receivables', 680).classList.add('open');
    this.render();
  },
  render: function(){
    var body = document.getElementById('rcv-modal-body'); if(!body) return;
    var list = this.dueList(), q = (getVal('rcv-search') || '').toLowerCase(), self = this;
    var tot = list.reduce(function(t, r){ return t + r.total; }, 0);
    var shown = q ? list.filter(function(r){ return (r.name + ' ' + r.phone + ' ' + r.bills.map(function(b){ return b.invNum; }).join(' ')).toLowerCase().indexOf(q) >= 0; }) : list;
    var rows = shown.map(function(r){
      var bills = r.bills.map(function(b){
        return '<span class="tag ' + (b.overdue ? 'tag-red' : 'tag-gray') + '" style="font-size:0.62rem;margin:2px 3px 0 0;">' + esc(b.invNum) + ' · ' + fmtRs(b.bal)
          + (b.overdue ? ' · ' + b.days + ' दिन नाघेको' : '') + '</span>';
      }).join('') + (r.ledger > 0.5 ? '<span class="tag tag-gray" style="font-size:0.62rem;margin:2px 3px 0 0;">Ledger · ' + fmtRs(r.ledger) + '</span>' : '');
      return '<div class="rcv-row" data-rcv-cust="' + esc(r.custId) + '" style="padding:10px 4px;border-bottom:1px solid var(--border);">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start;">'
          + '<div style="min-width:150px;flex:1;"><div style="font-weight:800;font-size:0.9rem;">' + esc(r.name)
            + (r.phone ? ' <span style="font-weight:400;font-size:0.72rem;color:var(--text-muted);">' + esc(r.phone) + '</span>' : ' <span style="font-size:0.68rem;color:var(--red);">⚠️ फोन छैन</span>') + '</div>'
            + '<div style="margin-top:2px;">' + bills + '</div>'
            + (r.lastSent ? '<div style="font-size:0.66rem;color:#22c55e;margin-top:3px;">✅ पछिल्लो रिमाइन्डर: ' + self._ago(r.lastSent) + '</div>' : '')
          + '</div>'
          + '<div style="text-align:right;"><div class="rcv-amt" style="font-weight:900;color:var(--red);font-size:1rem;">' + fmtRs(r.total) + '</div></div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;">'
          + '<button class="btn btn-xs btn-wa" data-rcv-wa="' + esc(r.custId) + '" onclick="Receivables.remind(\'' + r.custId + '\')" style="font-weight:700;">📲 WhatsApp रिमाइन्डर</button>'
          + (r.bills.length ? '<button class="btn btn-xs btn-success" data-rcv-pay="' + esc(r.custId) + '" onclick="Receivables.payModal(\'' + r.bills[0].id + '\',\'' + r.custId + '\')">💵 भुक्तानी लिनुहोस्</button>' : '')
          + '<button class="btn btn-xs btn-secondary" onclick="Receivables.remindAI(\'' + r.custId + '\')" title="AI ले म्यासेज लेखोस्">🤖 AI</button>'
          + '<button class="btn btn-xs btn-secondary" onclick="document.getElementById(\'rcv-modal\').classList.remove(\'open\');App.navigate(\'ledger\');try{Ledger.select(\'' + r.custId + '\');}catch(e){}">📒 Ledger</button>'
        + '</div></div>';
    }).join('');
    body.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
        + '<div class="stat-card" style="flex:1;min-width:140px;"><div class="stat-label">📥 जम्मा लिनुपर्ने</div><div class="stat-value" id="rcv-total" style="color:var(--red);font-size:1.2rem;">' + fmtRs(tot) + '</div></div>'
        + '<div class="stat-card" style="flex:1;min-width:140px;"><div class="stat-label">👥 ग्राहक</div><div class="stat-value" style="font-size:1.2rem;">' + list.length
          + ' <span style="font-size:0.7rem;color:var(--red);">(' + list.filter(function(r){ return r.overdue; }).length + ' म्याद नाघेको)</span></div></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">'
        + '<input type="text" id="rcv-search" placeholder="🔍 ग्राहक / बिल खोज्नुहोस्" value="' + esc(q) + '" oninput="Receivables.render()" style="flex:1;min-width:160px;">'
        + '<button class="btn btn-sm btn-secondary" id="rcv-tpl-btn" onclick="Receivables.tplToggle()">✏️ म्यासेज टेम्प्लेट</button>'
      + '</div>'
      + '<div id="rcv-tpl-box" style="display:none;margin-bottom:8px;"></div>'
      + (rows ? '<div id="rcv-list" style="max-height:58vh;overflow-y:auto;">' + rows + '</div>'
        : '<div class="empty-state" style="padding:28px;"><div class="icon">✅</div><div class="title">' + (q ? 'खोजेको भेटिएन' : 'कसैको बाँकी रकम छैन') + '</div></div>');
    var s = document.getElementById('rcv-search');
    if(s && q && document.activeElement !== s){ s.focus(); try { s.setSelectionRange(q.length, q.length); } catch(e){} }
  },
  tplToggle: function(){
    var box = document.getElementById('rcv-tpl-box'); if(!box) return;
    if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = '<div class="card card-body" style="padding:10px;">'
      + '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px;">Placeholders: {name} {amount} {bills} {payment_info} {days} {company} {company_phone} {phone1} {company_address}</div>'
      + '<textarea id="rcv-tpl" rows="9" style="width:100%;box-sizing:border-box;font-size:0.82rem;line-height:1.5;">' + esc(this.template()) + '</textarea>'
      + '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;"><button class="btn btn-sm btn-primary" id="rcv-tpl-save" onclick="Receivables.saveTemplate(getVal(\'rcv-tpl\'));App.toast(\'✅ टेम्प्लेट सेभ भयो\',\'success\');Receivables.tplToggle()">💾 Save</button>'
      + '<button class="btn btn-sm btn-secondary" onclick="setVal(\'rcv-tpl\',Receivables.DEFAULT_TPL)">↺ Default</button></div></div>';
  },

  // ── UI: receive payment (किस्ता) ──
  payModal: function(invId, custId){
    var invs = this._invs(), inv = invs.find(function(x){ return x && x.id === invId; }), self = this;
    if(!inv){ App.toast('Invoice भेटिएन', 'error'); return; }
    if(this._isCxl(inv)){ App.toast('रद्द भएको बिलमा भुक्तानी लिन मिल्दैन', 'error'); return; }
    custId = custId || inv.custId;
    var open = invs.filter(function(i){ return i && i.custId === custId && !i._demo && !self._isCxl(i) && self.balanceOf(i) > 0.5; });
    if(open.indexOf(inv) < 0) open.unshift(inv);
    this._modal('rcv-pay-modal', '💵 भुक्तानी लिनुहोस् / Receive Payment', 520);
    var bal = this.balanceOf(inv), pays = this.payments(inv), opening = this.openingPaid(inv);
    var hist = pays.map(function(p, i){
      return '<div class="rcv-hist-row" data-pay-id="' + esc(p.id) + '" style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);font-size:0.78rem;flex-wrap:wrap;">'
        + '<span style="flex:1;min-width:150px;"><b>' + esc(p.rcptNo) + '</b> · ' + esc(p.dateBs ? bsStringToDisplay(p.dateBs) : p.date) + ' · ' + esc(p.mode) + '</span>'
        + '<b style="color:var(--green);">' + fmtRs(p.amount) + '</b>'
        + '<button class="btn btn-xs btn-secondary" data-rcpt="' + esc(p.id) + '" onclick="Receivables.showReceipt(\'' + inv.id + '\',\'' + p.id + '\')">🧾 रसिद</button>'
        + '<button class="btn btn-xs btn-danger" title="गलत भुक्तानी हटाउनुहोस्" onclick="Receivables.confirmRemove(\'' + inv.id + '\',\'' + p.id + '\')">🗑</button></div>';
    }).join('');
    var sel = open.length > 1 ? '<div class="form-group"><label>बिल छान्नुहोस्</label><select id="rcv-pay-inv" onchange="Receivables.payModal(this.value,\'' + custId + '\')">'
      + open.map(function(i){ return '<option value="' + esc(i.id) + '"' + (i.id === inv.id ? ' selected' : '') + '>' + esc(i.invNum) + ' — बाँकी ' + fmtRs(self.balanceOf(i)) + '</option>'; }).join('') + '</select></div>' : '';
    document.getElementById('rcv-pay-modal-body').innerHTML =
      '<div style="font-size:0.84rem;line-height:1.6;margin-bottom:8px;"><b>' + esc(inv.invNum || '') + '</b> — ' + esc(inv.custName || '')
        + '<br>Total ' + fmtRs(inv.amount || 0) + ' • Paid <span style="color:var(--green);">' + fmtRs(inv.paid || 0) + '</span> • बाँकी <b id="rcv-pay-bal" style="color:var(--red);">' + fmtRs(bal) + '</b></div>'
      + sel
      + (bal > 0.5
        ? '<div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
          + '<div class="form-group"><label>रकम (Rs.) *</label><input type="number" id="rcv-pay-amt" min="0" step="any" value="' + bal + '"></div>'
          + '<div class="form-group"><label>मिति (AD)</label><input type="date" id="rcv-pay-date" value="' + todayISO() + '"></div>'
          + '<div class="form-group"><label>माध्यम</label><select id="rcv-pay-mode">' + this.MODES.map(function(m){ return '<option>' + m + '</option>'; }).join('') + '</select></div>'
          + '<div class="form-group"><label>Ref / Cheque No.</label><input type="text" id="rcv-pay-ref" placeholder="ऐच्छिक"></div>'
          + '<div class="form-group" style="grid-column:1/-1;"><label>कैफियत</label><input type="text" id="rcv-pay-note" placeholder="ऐच्छिक — उदा: दोस्रो किस्ता"></div>'
          + '</div>'
          + '<div class="form-actions"><button class="btn btn-secondary" onclick="document.getElementById(\'rcv-pay-modal\').classList.remove(\'open\')">पछाडि</button>'
          + '<button class="btn btn-success" id="rcv-pay-save" onclick="Receivables.savePay(\'' + inv.id + '\')">💾 भुक्तानी सेभ + रसिद</button></div>'
        : '<div style="padding:8px 10px;border-radius:8px;background:rgba(34,197,94,0.12);color:#22c55e;font-weight:700;font-size:0.82rem;">✅ यो बिलको पूरा भुक्तानी भइसकेको छ</div>')
      + ((pays.length || opening > 0.5) ? '<div style="margin-top:12px;"><div style="font-weight:800;font-size:0.82rem;margin-bottom:4px;">🧾 भुक्तानी इतिहास / किस्ता</div>'
        + (opening > 0.5 ? '<div style="font-size:0.74rem;color:var(--text-muted);padding:4px 0;">पहिले नै भुक्तानी (बिल बनाउँदा): ' + fmtRs(opening) + '</div>' : '')
        + '<div id="rcv-pay-hist">' + hist + '</div></div>' : '');
    document.getElementById('rcv-pay-modal').classList.add('open');
    setTimeout(function(){ var a = document.getElementById('rcv-pay-amt'); if(a){ a.focus(); try { a.select(); } catch(e){} } }, 120);
  },
  savePay: function(invId){
    var r;
    try { r = this.receive(invId, { amount: getVal('rcv-pay-amt'), date: getVal('rcv-pay-date'), mode: getVal('rcv-pay-mode'), ref: getVal('rcv-pay-ref'), note: getVal('rcv-pay-note') }); }
    catch(e){ App.toast(e.message, 'error'); return; }
    document.getElementById('rcv-pay-modal').classList.remove('open');
    App.toast('✅ ' + fmtRs(r.pay.amount) + ' भुक्तानी सेभ भयो — रसिद ' + r.pay.rcptNo, 'success', 3000);
    this._refresh();
    this.showReceipt(invId, r.pay.id);
  },
  confirmRemove: function(invId, payId){
    if(!confirm('यो भुक्तानी हटाउने? (गलत इन्ट्री मात्र हटाउनुहोस्)')) return;
    try { this.removePayment(invId, payId); } catch(e){ App.toast(e.message, 'error'); return; }
    App.toast('🗑 भुक्तानी हटाइयो', 'info');
    this._refresh();
    this.payModal(invId);
  },
  _refresh: function(){
    try { if(App.currentPage === 'invoices') Invoices.render(); } catch(e){}
    try { if(App.currentPage === 'ledger') Ledger.render(); } catch(e){}
    try { var m = document.getElementById('rcv-modal'); if(m && m.classList.contains('open')) this.render(); } catch(e){}
    try { SmartRem.render(); } catch(e){}
  }
};
