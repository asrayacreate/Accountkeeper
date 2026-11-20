// ─── 1-CLICK QUOTATION / ESTIMATE → INVOICE (SALE) ───────────────────
var QuoteConvert = {
  _invExists: function(id){ return !!id && Invoices.getData().some(function(i){ return i.id===id; }); },
  isConverted: function(rec){ return !!(rec && rec.convertedInvId && this._invExists(rec.convertedInvId)); },
  badge: function(rec){
    return '<span class="tag tag-green" data-converted style="font-size:0.62rem;white-space:nowrap;" title="'+esc(rec.convertedInvNum||'')+'">✅ Converted'+(rec.convertedInvNum?' · '+esc(rec.convertedInvNum):'')+'</span>';
  },
  // Find the customer for an estimate (estimates store name/phone, not an id); create one if new
  _custFor: function(name, phone, addr){
    var custs = Customers.getData();
    var digits = function(p){ return String(p||'').replace(/\D/g,'').slice(-10); };
    var c = (phone && custs.find(function(x){ return x && digits(x.phone) && digits(x.phone)===digits(phone); }))
         || (name && custs.find(function(x){ return x && (x.name||'').trim().toLowerCase()===String(name).trim().toLowerCase(); }));
    if(c) return c;
    c = { id: uid(), name: String(name||'Customer').trim(), phone: phone||'', address: addr||'', services: [], notes: 'Estimate बाट Invoice बनाउँदा स्वतः थपिएको', created: todayISO(), updated: todayISO() };
    custs.unshift(c); STORE.set('pk3_customers', custs);
    try { Audit.log('CUSTOMER','Auto-added from estimate: '+c.name); } catch(e){}
    return c;
  },
  _build: function(d, cust, src){
    var items = d.items.filter(function(r){ return (r.name||'').trim() || r.rate; })
      .map(function(r){ return { name:(r.name||'').trim(), qty:r.qty, unit:r.unit||'', rate:r.rate, amount:r.qty*r.rate }; });
    var total = Math.round(d.total*100)/100, paid = Math.max(0, d.paid||0);
    var bal = Math.round((total - paid)*100)/100;
    var dateAd = todayISO();
    return {
      id: uid(), invNum: Invoices.nextNum(), custId: cust.id, custName: cust.name||'', custPhone: cust.phone||'',
      items: items, subtotal: d.sub, discP: d.sub>0 ? (d.disc/d.sub*100) : 0, discAmt: d.disc, taxP: d.taxP, taxAmt: d.taxAmt,
      amount: total, paid: paid, balance: bal,
      status: paid<=0 ? 'Pending' : (paid < total-0.5 ? 'Partial' : 'Paid'),
      dueDate: '', terms: d.terms || PayQR.terms() || '',
      desc: items.map(function(r){ return r.name; }).filter(Boolean).slice(0,3).join(', '),
      date: dateAd, dateBs: _bsFromAd(dateAd), created: new Date().toISOString(),
      fromQuote: { type: src.type, id: src.id, no: src.no || '' }
    };
  },
  // Sale = Debit; advance already received = Credit. Tagged _inv so dues are not counted twice
  _postLedger: function(inv){
    var led = STORE.get('pk3_ledger', []) || [];
    var base = { customerId: inv.custId, custName: inv.custName, date: inv.dateBs, dateAd: inv.date, _inv: inv.id, created: new Date().toISOString() };
    var e1 = Object.assign({ id:'lx_'+uid(), narration:'🧾 Sale — '+inv.invNum+' ('+(inv.fromQuote.type==='estimate'?'Estimate':'Quotation')+' बाट)', debit: inv.amount, credit: 0 }, base);
    e1.desc = e1.narration; led.push(e1);
    if(inv.paid > 0){
      var e2 = Object.assign({ id:'lx_'+uid(), narration:'💰 अग्रिम प्राप्त — '+inv.invNum, debit: 0, credit: inv.paid }, base);
      e2.desc = e2.narration; led.push(e2);
    }
    STORE.set('pk3_ledger', led);
  },
  _finish: function(inv, label){
    inv.stockTracked = true;   // v7.2.0: sale moves stock
    var list = Invoices.getData(); list.unshift(inv); STORE.set('pk3_invoices', list);
    this._postLedger(inv);
    try { Stock.warnLow(Stock.syncInvoice(inv)); } catch(e){}
    try { Audit.log('INVOICE','Converted '+label+' → '+inv.invNum+' '+inv.custName+' '+fmtRs(inv.amount)); } catch(e){}
    try { Activity.add('🧾 '+label+' → Invoice '+inv.invNum+' — '+inv.custName); } catch(e){}
    App.toast('✅ Invoice '+inv.invNum+' बन्यो र Customer Ledger मा पोस्ट भयो','success',3500);
    return inv;
  },
  fromQuotation: function(id, silent){
    var list = Quotations.getData(), q = list.find(function(x){ return x.id===id; });
    if(!q){ App.toast('Quotation भेटिएन','error'); return null; }
    if(this.isConverted(q)){ App.toast('ℹ️ यो Quotation पहिल्यै Invoice '+(q.convertedInvNum||'')+' मा Converted छ','warning',3500); return null; }
    if(!silent && !confirm('यो Quotation लाई Invoice / Sale मा बदल्ने?\n\n'+(q.custName||'')+' — '+fmtRs(q.amount)+'\nसबै item, VAT र advance सहित Invoice बन्छ र Customer Ledger मा पोस्ट हुन्छ।')) return null;
    var cust = Customers.getData().find(function(c){ return c.id===q.custId; }) || { id:q.custId, name:q.custName, phone:q.custPhone };
    var d = DocPrint.fromQuotation(q);
    var inv = this._build(d, cust, { type:'quotation', id:q.id, no:d.no });
    q.convertedInvId = inv.id; q.convertedInvNum = inv.invNum; q.convertedAt = new Date().toISOString();
    if(!q.status || q.status==='Pending') q.status = 'Approved';
    STORE.set('pk3_quotations', list);
    this._finish(inv, 'Quotation');
    try { document.getElementById('view-modal').classList.remove('open'); } catch(e){}
    try { if(App.currentPage==='quotations') Quotations.render(); } catch(e){}
    return inv;
  },
  fromEstimate: function(id, silent){
    var list = STORE.get('pk3_estimates', []) || [], e = list.find(function(x){ return x.id===id; });
    if(!e){ App.toast('Estimate भेटिएन','error'); return null; }
    if(this.isConverted(e)){ App.toast('ℹ️ यो Estimate पहिल्यै Invoice '+(e.convertedInvNum||'')+' मा Converted छ','warning',3500); return null; }
    if(!silent && !confirm('यो Estimate लाई Invoice / Sale मा बदल्ने?\n\n'+(e.custName||'')+' — '+fmtRs(e.total))) return null;
    var cust = this._custFor(e.custName, e.phone, e.addr);
    var d = DocPrint.fromEstimate(e);
    var inv = this._build(d, cust, { type:'estimate', id:e.id, no:d.no });
    e.convertedInvId = inv.id; e.convertedInvNum = inv.invNum; e.convertedAt = new Date().toISOString(); e.status = 'Approved';
    STORE.set('pk3_estimates', list);
    this._finish(inv, 'Estimate');
    try { document.getElementById('view-modal').classList.remove('open'); } catch(e2){}
    try { if(App.currentPage==='estimates-list') Bakauta.renderList(); } catch(e3){}
    return inv;
  },
  // When an invoice is deleted: remove its auto ledger lines and free the source to convert again
  onInvoiceDeleted: function(invId){
    if(!invId) return;
    STORE.set('pk3_ledger', (STORE.get('pk3_ledger',[])||[]).filter(function(t){ return !(t && t._inv===invId); }));
    [['pk3_quotations'],['pk3_estimates']].forEach(function(k){
      var l = STORE.get(k[0],[])||[], ch = false;
      l.forEach(function(x){ if(x && x.convertedInvId===invId){ delete x.convertedInvId; delete x.convertedInvNum; delete x.convertedAt; ch = true; } });
      if(ch) STORE.set(k[0], l);
    });
  }
};

