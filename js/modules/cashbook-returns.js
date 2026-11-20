// ─── SAMPLE / DEMO DATA MODULE (v6.0.8) ───────────────────────────
// नयाँ user लाई app भरिएको जस्तो देखाउन demo customer/quotation।
// सबै record मा _demo:true — DEMO badge देखिन्छ, तर totals/counts बाट बाहिर।
// Helper SampleData.real(arr) ले demo हटाएर गन्ती-योग्य list दिन्छ।

// ─── SALES RETURNS / REFUNDS MODULE (v6.1.0) ──────────────────────
// Invoice वा Quotation लाई Returned/Refunded mark गर्ने।
// प्रभाव: (1) record status = 'Returned', (2) customer ledger मा CREDIT
//         (उसले तिर्नुपर्ने घट्छ / फिर्ता भएको पैसा देखिन्छ),
//         (3) daybook मा return entry — reports ले net income बाट घटाउँछ।
// सबै return record pk3_returns मा — reports/cashbook ले पढ्छ।

// ─── CASH BOOK MODULE (v6.1.0) ────────────────────────────────────
// Day Book = entry log. Cash Book = bank passbook जस्तो:
// हरेक transaction मा cash-in / cash-out + चल्दो balance (running balance)।
// Approach A: सबै daybook entry पढ्छ (income=IN, expense/return=OUT)।
// Date-range filter + opening balance।
var CashBook = {
  _from: '',   // ISO date
  _to: '',
  _opening: 0,

  render: function(){
    var el = document.getElementById('cashbook-body');
    if(!el) return;

    // load opening balance (persisted)
    try { this._opening = parseFloat(STORE.get('pk3_cashbook_opening', 0)) || 0; } catch(e){ this._opening = 0; }
    var opEl = document.getElementById('cb-opening');
    if(opEl && document.activeElement!==opEl) opEl.value = this._opening;

    var all = STORE.get('pk3_daybook', []) || [];

    // date range filter (compare on ISO date field)
    var from = this._from, to = this._to;
    var list = all.filter(function(d){
      var iso = d.date || d.dateAd || '';
      if(from && iso < from) return false;
      if(to && iso > to) return false;
      return true;
    });

    // sort chronological (oldest first) for running balance
    list.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });

    var totalIn = 0, totalOut = 0;
    var bal = this._opening;
    var rowsHtml = list.map(function(d){
      var amt = parseFloat(d.amount)||0;
      var isIn = (d.type==='income');
      var isOut = (d.type==='expense' || d.type==='return');
      // treat anything not clearly income as out only if expense/return; skip non-cash types (text/list/etc)
      if(!isIn && !isOut) return '';
      if(isIn){ totalIn += amt; bal += amt; }
      else    { totalOut += amt; bal -= amt; }
      var dstr = d.dateBs ? bsStringToDisplay(d.dateBs) : (d.date||'');
      return '<tr>'
        + '<td style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;">'+dstr+'</td>'
        + '<td style="font-size:0.8rem;">'+esc(d.desc||d.cat||'—')
          + (d.type==='return' ? ' <span class="tag tag-gray" style="font-size:0.56rem;">RETURN</span>' : '')
          + '</td>'
        + '<td style="text-align:right;color:var(--green);white-space:nowrap;">'+(isIn?(fmtRs(amt)):'')+'</td>'
        + '<td style="text-align:right;color:var(--red);white-space:nowrap;">'+(isOut?(fmtRs(amt)):'')+'</td>'
        + '<td style="text-align:right;font-weight:700;white-space:nowrap;color:'+(bal>=0?'var(--text)':'var(--red)')+';">'+fmtRs(bal)+'</td>'
        + '</tr>';
    }).filter(Boolean).join('');

    var closing = bal;

    // summary chips
    var st = document.getElementById('cb-summary');
    if(st){
      st.innerHTML =
        '<div class="stat-card"><div class="stat-label">Opening</div><div class="stat-value" style="color:var(--text-muted);">'+fmtRs(this._opening)+'</div></div>'
        + '<div class="stat-card"><div class="stat-label">कुल IN</div><div class="stat-value" style="color:var(--green);">'+fmtRs(totalIn)+'</div></div>'
        + '<div class="stat-card"><div class="stat-label">कुल OUT</div><div class="stat-value" style="color:var(--red);">'+fmtRs(totalOut)+'</div></div>'
        + '<div class="stat-card"><div class="stat-label">Closing Balance</div><div class="stat-value" style="color:'+(closing>=0?'var(--green)':'var(--red)')+';">'+fmtRs(closing)+'</div></div>';
    }

    if(!rowsHtml){
      el.innerHTML = '<div class="empty-state" style="padding:30px;"><div class="icon">\U0001f4d7</div><div>यो अवधिमा cash transaction छैन</div></div>';
      return;
    }
    el.innerHTML = '<div style="overflow-x:auto;"><table style="width:100%;min-width:520px;"><thead><tr>'
      + '<th>मिति</th><th>विवरण</th><th style="text-align:right;">IN</th><th style="text-align:right;">OUT</th><th style="text-align:right;">Balance</th>'
      + '</tr></thead><tbody>'
      + '<tr style="background:var(--surface-2);"><td colspan="4" style="font-size:0.74rem;color:var(--text-muted);">Opening Balance</td>'
        + '<td style="text-align:right;font-weight:700;">'+fmtRs(this._opening)+'</td></tr>'
      + rowsHtml
      + '<tr style="background:var(--surface-2);font-weight:800;"><td colspan="2">Closing Balance</td>'
        + '<td style="text-align:right;color:var(--green);">'+fmtRs(totalIn)+'</td>'
        + '<td style="text-align:right;color:var(--red);">'+fmtRs(totalOut)+'</td>'
        + '<td style="text-align:right;color:'+(closing>=0?'var(--green)':'var(--red)')+';">'+fmtRs(closing)+'</td></tr>'
      + '</tbody></table></div>';
  },

  setFrom: function(v){ this._from = v; this.render(); },
  setTo: function(v){ this._to = v; this.render(); },
  setOpening: function(v){
    var n = parseFloat(v)||0;
    try { STORE.set('pk3_cashbook_opening', n); } catch(e){}
    this._opening = n;
    this.render();
  },
  clearFilter: function(){
    this._from=''; this._to='';
    var f=document.getElementById('cb-from'), t=document.getElementById('cb-to');
    if(f) f.value=''; if(t) t.value='';
    this.render();
  }
};


var SalesReturns = {
  getData: function(){ return STORE.get('pk3_returns', []) || []; },
  setData: function(list){ STORE.set('pk3_returns', list); },

  // कुनै source (invoice/quotation) पहिल्यै returned छ?
  isReturned: function(srcType, srcId){
    return this.getData().some(function(r){ return r.srcType===srcType && r.srcId===srcId; });
  },

  // Return modal खोल्ने — source object (invoice वा quotation) दिनुहोस्
  open: function(srcType, srcId){
    var src = srcType==='invoice'
      ? (Invoices.getData().find(function(x){return x.id===srcId;}))
      : (Quotations.getData().find(function(x){return x.id===srcId;}));
    if(!src){ App.toast('Record भेटिएन','error'); return; }
    if(this.isReturned(srcType, srcId)){ App.toast('ℹ️ यो पहिल्यै return भइसक्यो','info'); return; }
    var amt = parseFloat(src.amount||src.grand||0) || 0;
    var name = src.custName || 'General';
    var num = src.invNum || src.id;
    this._pending = { srcType: srcType, srcId: srcId, custId: src.custId||'general', custName: name, num: num, maxAmt: amt };

    var m = document.getElementById('return-modal');
    if(!m){ this._injectModal(); m = document.getElementById('return-modal'); }
    document.getElementById('return-title').textContent = '↩️ Return / Refund — ' + (srcType==='invoice'?'Invoice':'Quotation') + ' ' + num;
    document.getElementById('return-cust').textContent = name;
    document.getElementById('return-amount').value = amt;
    document.getElementById('return-amount').setAttribute('max', amt);
    document.getElementById('return-reason').value = '';
    document.getElementById('return-hint').textContent = 'मूल रकम: '+fmtRs(amt) + ' — आंशिक refund भए रकम घटाउनुहोस्';
    m.classList.add('open');
  },

  _injectModal: function(){
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="modal" id="return-modal">'
      + '<div class="modal-box" style="max-width:440px;">'
      + '<div class="modal-head"><h3 id="return-title" style="font-size:1rem;">Return / Refund</h3>'
      + '<button class="modal-x" onclick="document.getElementById(\'return-modal\').classList.remove(\'open\')">&times;</button></div>'
      + '<div class="modal-body">'
      + '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px;">Customer: <b id="return-cust" style="color:var(--text);"></b></div>'
      + '<div class="form-group"><label>Refund रकम (Rs.)</label><input type="number" id="return-amount" min="0" step="any"><div id="return-hint" style="font-size:0.68rem;color:var(--text-muted);margin-top:4px;"></div></div>'
      + '<div class="form-group"><label>कारण (Reason)</label><textarea id="return-reason" rows="2" placeholder="जस्तै: ग्राहकले रद्द गर्‍यो, सामान फिर्ता..."></textarea></div>'
      + '<div style="display:flex;gap:8px;margin-top:14px;">'
      + '<button class="btn btn-sm" style="background:#7f1d1d;color:#fff;flex:1;" onclick="SalesReturns.confirm()">↩️ Return पक्का गर्नुहोस्</button>'
      + '<button class="btn btn-sm btn-ghost" onclick="document.getElementById(\'return-modal\').classList.remove(\'open\')">रद्द</button>'
      + '</div></div></div></div>';
    document.body.appendChild(d.firstChild);
  },

  confirm: function(){
    var p = this._pending;
    if(!p){ return; }
    var amt = parseFloat((document.getElementById('return-amount')||{}).value)||0;
    var reason = ((document.getElementById('return-reason')||{}).value||'').trim();
    if(amt<=0){ App.toast('❌ रकम हाल्नुहोस्','error'); return; }
    if(amt>p.maxAmt+0.5){ App.toast('❌ रकम मूल भन्दा बढी हुन सक्दैन','error'); return; }

    // 1) return record
    var rec = {
      id: 'rt_'+Date.now().toString(36),
      srcType: p.srcType, srcId: p.srcId,
      num: p.num, customerId: p.custId, custName: p.custName,
      amount: amt, reason: reason,
      date: todayISO(), dateBs: todayBs(),
      user: (currentUser && currentUser.name) || 'system'
    };
    var rlist = this.getData(); rlist.unshift(rec); this.setData(rlist);

    // 2) flag source as returned — do NOT touch original status
    //    (status stays Pending/Approved/etc so statMap, color-maps & dropdowns keep working)
    try {
      if(p.srcType==='invoice'){
        var inv = Invoices.getData(); var ix=inv.findIndex(function(x){return x.id===p.srcId;});
        if(ix>=0){ inv[ix]._returned=true; inv[ix]._returnedAmt=amt; STORE.set('pk3_invoices',inv); }
      } else {
        var q = Quotations.getData(); var qx=q.findIndex(function(x){return x.id===p.srcId;});
        if(qx>=0){ q[qx]._returned=true; q[qx]._returnedAmt=amt; STORE.set('pk3_quotations',q); }
      }
    } catch(e){ console.warn('return flag', e); }

    // 3) customer ledger — CREDIT (उसले तिर्नुपर्ने घट्छ / फिर्ता)
    try {
      var led = STORE.get('pk3_ledger', []) || [];
      led.push({
        id: 'lx_'+Date.now().toString(36),
        customerId: p.custId, custName: p.custName,
        date: todayBs(), dateAd: todayISO(),
        narration: 'Return/Refund — '+p.num+(reason?(' ('+reason+')'):''),
        desc: 'Return/Refund — '+p.num,
        debit: 0, credit: amt,
        _return: true,
        created: new Date().toISOString()
      });
      STORE.set('pk3_ledger', led);
    } catch(e){ console.warn('return ledger', e); }

    // 4) daybook — return entry so reports subtract from net income
    try {
      var db = STORE.get('pk3_daybook', []) || [];
      db.unshift({
        id: uid(), type: 'return', amount: amt,
        desc: 'Sales Return — '+p.num+(reason?(' ('+reason+')'):''),
        cat: 'Sales Return',
        date: todayISO(), dateBs: todayBs(),
        _return: true,
        user: (currentUser && currentUser.name) || 'system'
      });
      STORE.set('pk3_daybook', db);
    } catch(e){ console.warn('return daybook', e); }

    try { Audit.log('RETURN', 'Return Rs '+amt+' — '+p.num+' ('+p.custName+')'); } catch(e){}
    try { Activity.add('↩️ Sales return: '+p.num+' — '+fmtRs(amt)); } catch(e){}

    var m=document.getElementById('return-modal'); if(m) m.classList.remove('open');
    App.toast('↩️ Return record गरियो — '+fmtRs(amt),'success',3500);
    this._pending = null;

    // refresh whatever view is open
    try { if(typeof Invoices!=='undefined' && Invoices.render) Invoices.render(); } catch(e){}
    try { if(typeof Quotations!=='undefined' && Quotations.render) Quotations.render(); } catch(e){}
    try { App.navigate('returns'); } catch(e){}
  },

  // Returns list page
  render: function(){
    var el = document.getElementById('returns-list');
    if(!el) return;
    var list = this.getData();
    var total = list.reduce(function(s,r){ return s + (parseFloat(r.amount)||0); }, 0);
    var tot = document.getElementById('returns-total');
    if(tot) tot.textContent = fmtRs(total);
    if(!list.length){
      el.innerHTML = '<div class="empty-state" style="padding:30px;"><div class="icon">↩️</div><div>कुनै return/refund छैन</div></div>';
      return;
    }
    el.innerHTML = '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr>'
      + '<th>मिति</th><th>Ref</th><th>Customer</th><th>कारण</th><th style="text-align:right;">रकम</th><th></th>'
      + '</tr></thead><tbody>'
      + list.map(function(r){
          return '<tr>'
            + '<td style="font-size:0.74rem;color:var(--text-muted);">'+(r.dateBs?bsStringToDisplay(r.dateBs):(r.date||''))+'</td>'
            + '<td style="font-size:0.78rem;"><span class="tag tag-gray">'+esc(r.srcType==='invoice'?'INV':'QUO')+'</span> '+esc(r.num||'')+'</td>'
            + '<td>'+esc(r.custName||'General')+'</td>'
            + '<td style="font-size:0.76rem;color:var(--text-muted);">'+esc(r.reason||'—')+'</td>'
            + '<td style="text-align:right;font-weight:700;color:var(--red);white-space:nowrap;">'+fmtRs(r.amount||0)+'</td>'
            + '<td><button onclick="SalesReturns.undo(\''+r.id+'\')" class="btn btn-xs" style="background:var(--surface-2);" title="Undo this return">✕</button></td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  },

  // Undo a return — reverses status, removes ledger credit + daybook entry
  undo: function(id){
    if(!confirm('यो return हटाउने? Ledger र report असर उल्टिनेछ।')) return;
    var list = this.getData();
    var r = list.find(function(x){return x.id===id;});
    if(!r) return;
    // clear the returned flag — original status was never changed, so nothing to restore
    try {
      if(r.srcType==='invoice'){
        var inv=Invoices.getData(); var ix=inv.findIndex(function(x){return x.id===r.srcId;});
        if(ix>=0){ delete inv[ix]._returned; delete inv[ix]._returnedAmt; STORE.set('pk3_invoices',inv); }
      } else {
        var q=Quotations.getData(); var qx=q.findIndex(function(x){return x.id===r.srcId;});
        if(qx>=0){ delete q[qx]._returned; delete q[qx]._returnedAmt; STORE.set('pk3_quotations',q); }
      }
    } catch(e){}
    // remove the ledger credit we added (match by narration + amount + return flag)
    try {
      var led=STORE.get('pk3_ledger',[])||[];
      led = led.filter(function(t){ return !(t._return && t.customerId===r.customerId && Math.abs((parseFloat(t.credit)||0)-(parseFloat(r.amount)||0))<0.5 && (t.desc||'').indexOf(r.num)>=0); });
      STORE.set('pk3_ledger', led);
    } catch(e){}
    // remove the daybook return entry
    try {
      var db=STORE.get('pk3_daybook',[])||[];
      db = db.filter(function(d){ return !(d._return && Math.abs((parseFloat(d.amount)||0)-(parseFloat(r.amount)||0))<0.5 && (d.desc||'').indexOf(r.num)>=0); });
      STORE.set('pk3_daybook', db);
    } catch(e){}
    // remove return record
    this.setData(list.filter(function(x){return x.id!==id;}));
    try { Audit.log('RETURN','Return undone — '+r.num); } catch(e){}
    App.toast('Return हटाइयो','info');
    this.render();
  }
};


