// ─── STOCK MODULE ─────────────────────────────────────────────
var Stock = {
  _curId: null,
  getData: function(){ return STORE.get('pk3_stock',[])||[]; },
  render: function(){
    var list=this.getData(); var q=getVal('stk-search').toLowerCase();
    if(q) list=list.filter(function(s){return (s.name+s.cat).toLowerCase().indexOf(q)>=0;});
    // Alert bar
    var lowStock=list.filter(function(s){return Stock.isLow(s);});
    var alertBar=document.getElementById('stk-alert-bar');
    if(lowStock.length&&alertBar){alertBar.style.display='';alertBar.textContent='⚠️ Low stock: '+lowStock.map(function(s){return s.name+'('+s.qty+')';}).join(', ');}
    else if(alertBar)alertBar.style.display='none';
    var tb=document.getElementById('stk-table'); var ne=document.getElementById('no-stk');
    if(!list.length){tb.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    // Populate categories datalist
    var cats=[...new Set(list.map(function(s){return s.cat;}))];
    var dl=document.getElementById('stk-cat-list');if(dl)dl.innerHTML=cats.map(function(c){return '<option>'+c+'</option>';}).join('');
    tb.innerHTML=list.map(function(s){
      var margin=s.selling>0?Math.round((s.selling-s.purchase)/s.selling*100):0;
      var isLow=Stock.isLow(s);
      return '<tr><td>'+(s.photo?'<img src="'+s.photo+'" class="photo-thumb sm">':'<div style="width:36px;height:36px;border-radius:7px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">📦</div>')+'</td>'+
      '<td><div style="font-weight:700;">'+s.name+'</div>'+(s.barcode?'<div style="font-size:0.68rem;color:var(--text-muted);">'+s.barcode+'</div>':'')+'</td>'+
      '<td style="font-size:0.8rem;">'+(s.cat||'—')+'</td>'+
      '<td style="text-align:right;font-weight:700;color:'+(isLow?'var(--red)':'var(--text)')+';">'+(s.qty||0)+' '+(s.unit||'')+'<div style="font-size:0.64rem;font-weight:500;color:var(--text-muted);">सीमा '+Stock.minOf(s)+'</div></td>'+
      '<td style="text-align:right;">'+fmtRs(s.purchase||0)+'</td>'+
      '<td style="text-align:right;">'+fmtRs(s.selling||0)+'</td>'+
      '<td style="text-align:right;color:var(--green);">'+margin+'%</td>'+
      '<td><div class="btn-group"><button onclick="Stock.history(\''+s.id+'\')" class="btn btn-xs btn-secondary">📊</button><button onclick="Stock.editModal(\''+s.id+'\')" class="btn btn-xs btn-secondary">✏️</button><button onclick="Stock.del(\''+s.id+'\')" class="btn btn-xs btn-danger">🗑</button></div></td></tr>';
    }).join('');
  },
  addModal: function(){
    setVal('stk-edit-id',''); setVal('stk-name',''); setVal('stk-cat',''); setVal('stk-qty',''); setVal('stk-unit','pcs'); setVal('stk-purchase',''); setVal('stk-selling',''); setVal('stk-min','5'); setVal('stk-barcode',''); setVal('stk-notes','');
    setText('stk-modal-title','📦 Add Stock Item');
    document.getElementById('stk-modal').classList.add('open');
  },
  editModal: function(id){
    var s=this.getData().find(function(x){return x.id===id;}); if(!s)return;
    setVal('stk-edit-id',s.id); setVal('stk-name',s.name); setVal('stk-cat',s.cat||''); setVal('stk-qty',s.qty||0); setVal('stk-unit',s.unit||'pcs'); setVal('stk-purchase',s.purchase||0); setVal('stk-selling',s.selling||0); setVal('stk-min',Stock.minOf(s)); setVal('stk-barcode',s.barcode||''); setVal('stk-notes',s.notes||'');
    setText('stk-modal-title','✏️ Edit Stock Item');
    document.getElementById('stk-modal').classList.add('open');
  },
  save: function(){
    var name=getVal('stk-name'); if(!name){App.toast('नाम चाहिन्छ!','error');return;}
    var id=getVal('stk-edit-id')||uid(); var isEdit=!!getVal('stk-edit-id');
    var rec={id:id,name:name,cat:getVal('stk-cat'),qty:parseFloat(getVal('stk-qty'))||0,unit:getVal('stk-unit')||'pcs',purchase:parseFloat(getVal('stk-purchase'))||0,selling:parseFloat(getVal('stk-selling'))||0,minQty:(function(v){ v=parseFloat(v); return isNaN(v)||v<0 ? Stock.DEFAULT_MIN : v; })(getVal('stk-min')),barcode:getVal('stk-barcode'),notes:getVal('stk-notes'),history:[]};
    var list=this.getData();
    if(isEdit){var idx=list.findIndex(function(x){return x.id===id;});if(idx>=0){rec.history=list[idx].history||[];list[idx]=rec;}else list.push(rec);}
    else list.push(rec);
    STORE.set('pk3_stock',list);
    Audit.log('STOCK',(isEdit?'Edited':'Added')+': '+name);
    App.toast('✅ Stock saved!','success');
    document.getElementById('stk-modal').classList.remove('open');
    this.render();
  },
  history: function(id){
    this._curId=id;
    var s=this.getData().find(function(x){return x.id===id;}); if(!s)return;
    setText('stk-hist-title','📦 '+s.name+' — Stock History');
    var hist=s.history||[];
    document.getElementById('stk-hist-list').innerHTML=hist.length?'<table><thead><tr><th>Date</th><th>Type</th><th style="text-align:right;">Qty</th><th>Note</th></tr></thead><tbody>'+hist.map(function(h){return '<tr><td>'+fmtDisplayDate(h.date)+'</td><td><span class="tag '+(h.type==='in'?'tag-green':'tag-red')+'">'+h.type+'</span></td><td style="text-align:right;">'+(h.type==='in'?'+':h.type==='adj'?'= ':'-')+h.qty+'</td><td>'+esc(h.note||'—')+(h.auto?' <span class="tag tag-blue" style="font-size:0.6rem;">auto</span>':'')+'</td></tr>';}).join('')+'</tbody></table>':'<div class="empty-state" style="padding:20px;">No history yet</div>';
    document.getElementById('stk-history-modal').classList.add('open');
  },
  adjustStock: function(){
    var type=getVal('stk-adj-type')||'in'; var note=getVal('stk-adj-note')||''; var id=this._curId; if(!id)return;
    var qty=parseFloat(getVal('stk-adj-qty'));
    // v7.3.0 audit: a negative qty turned "in" into a silent decrease; "= set" to 0 must still be allowed
    if(isNaN(qty) || qty<0 || (!qty && type!=='adj')){App.toast('Qty enter गर्नुस् (० भन्दा बढी)!','error');return;}
    var list=this.getData(); var idx=list.findIndex(function(x){return x.id===id;}); if(idx<0)return;
    var s=list[idx]; if(!s.history)s.history=[];
    var cur=parseFloat(s.qty)||0, r3=function(n){ return Math.round(n*1000)/1000; };
    if(type==='in')s.qty=r3(cur+qty);
    else if(type==='out'){
      // "out" never goes below 0; history records what was actually taken out, so it adds up to the qty
      var take=Math.min(qty, Math.max(cur,0));
      if(take<qty) App.toast('⚠️ मौज्दात '+cur+' मात्र छ — '+take+' मात्र घटाइयो','warning',3500);
      if(!take) return;
      s.qty=r3(cur-take); qty=take;
    }
    else s.qty=qty;
    s.history.unshift({date:todayISO(),type:type,qty:qty,note:note});
    STORE.set('pk3_stock',list);
    this.history(id);
    App.toast('✅ Stock adjusted!','success');
    this.render();
  },
  del: function(id){ if(!confirm('Delete?'))return; STORE.set('pk3_stock',this.getData().filter(function(x){return x.id!==id;})); this.render(); App.toast('🗑 Deleted','info'); },
  scanBarcode: function(){ App.toast('📷 Barcode scanner — camera access needed','info'); },

  // ═══ v7.2.0: Low Stock limit + Sale/Purchase मा स्वतः घटबढ (auto stock movement) ═══
  // • हरेक item को minQty = Low Stock Limit (खाली भए 5; 0 पनि मान्य)।
  // • बिक्री (Invoice) सेभ हुँदा मिल्ने नामको stock घट्छ; खरिद (Supplier बिल / Purchase Bill) मा बढ्छ।
  // • हरेक movement item.history मा {ref, auto:true} सहित लेखिन्छ। Stock.post(ref, …) idempotent छ:
  //   एउटै ref (जस्तै 'inv:<id>') फेरि post गर्दा फरक मात्र लाग्छ — बिल edit/cancel/delete मा
  //   दोहोरो घटबढ हुँदैन। Stock.reverse(ref) ले सबै उल्टाउँछ।
  // • Settings → Modules मा "Stock / Items" Off भए कुनै auto घटबढ हुँदैन।
  // • पुराना (v7.2 भन्दा अघिका) बिलहरूले stock छुँदैनन् — inv.stockTracked भएका नयाँ बिल मात्र।
  DEFAULT_MIN: 5,
  minOf: function(s){
    var m = s ? s.minQty : null;
    if(m===null || m===undefined || m==='') return this.DEFAULT_MIN;
    m = parseFloat(m); return isNaN(m) ? this.DEFAULT_MIN : m;
  },
  isLow: function(s){ return !!s && (parseFloat(s.qty)||0) <= this.minOf(s); },
  /** Low-stock items (sample/demo rows excluded), lowest first. */
  lowItems: function(){
    var self=this, list=this.getData();
    try{ if(typeof SampleData!=='undefined' && SampleData.real) list=SampleData.real(list); }catch(e){}
    return list.filter(function(s){ return self.isLow(s); })
      .sort(function(a,b){ return ((parseFloat(a.qty)||0)-self.minOf(a)) - ((parseFloat(b.qty)||0)-self.minOf(b)); });
  },
  autoOn: function(){ try{ return typeof Modules==='undefined' || Modules.isOn('stock'); }catch(e){ return true; } },
  _key: function(v){ return String(v||'').trim().toLowerCase().replace(/\s+/g,' '); },
  /** Find a stock item by id or (case-insensitive) name. */
  find: function(idOrName, list){
    list = list || this.getData(); var k=this._key(idOrName); if(!k) return null;
    return list.find(function(s){ return s.id===idOrName; }) || list.find(function(s){ return Stock._key(s.name)===k; }) || null;
  },
  /** Net qty already applied by `ref` to one item (+in, −out). */
  _applied: function(s, ref){
    return (s.history||[]).reduce(function(t,h){
      if(!h || h.ref!==ref) return t;
      var q=parseFloat(h.qty)||0; return t + (h.type==='in' ? q : -q);
    },0);
  },
  /**
   * Make the stock effect of document `ref` equal to `lines` (idempotent).
   * @param ref   unique id, e.g. 'inv:<invoiceId>', 'pay:<txnId>', 'pur:<purchaseId>'
   * @param lines [{name|stockId, qty}] — rows whose name doesn't match a stock item are ignored
   * @param dir   'out' (sale: घट्छ) | 'in' (purchase: बढ्छ)
   * @param opts  {note, date, force} — force ignores the Modules On/Off switch
   * @return {changed:[{id,name,delta,qty}], unmatched:[names], low:[items]}
   */
  post: function(ref, lines, dir, opts){
    opts=opts||{}; var res={changed:[],unmatched:[],low:[]};
    if(!ref || (!opts.force && !this.autoOn())) return res;
    var self=this, list=this.getData(), sign = dir==='in' ? 1 : -1, want={};
    (lines||[]).forEach(function(l){
      if(!l) return;
      var q=parseFloat(l.qty)||0; if(!q) return;
      var s=self.find(l.stockId||l.name, list);
      if(!s){ if(String(l.name||'').trim()) res.unmatched.push(String(l.name).trim()); return; }
      want[s.id]=(want[s.id]||0)+sign*q;
    });
    var date=opts.date||todayISO(), note=opts.note||'';
    list.forEach(function(s){
      var target=want[s.id]||0, cur=self._applied(s, ref), d=Math.round((target-cur)*1000)/1000;
      if(!d) return;
      if(!s.history) s.history=[];
      s.qty=Math.round(((parseFloat(s.qty)||0)+d)*1000)/1000;
      s.history.unshift({date:date,type:d>0?'in':'out',qty:Math.abs(d),note:note,ref:ref,auto:true});
      res.changed.push({id:s.id,name:s.name,delta:d,qty:s.qty});
      if(d<0 && self.isLow(s)) res.low.push(s);
    });
    if(res.changed.length){
      STORE.set('pk3_stock',list);
      try{ Audit.log('STOCK','Auto '+ref+': '+res.changed.map(function(c){ return c.name+' '+(c.delta>0?'+':'')+c.delta; }).join(', ')); }catch(e){}
    }
    return res;
  },
  /** Undo everything `ref` did to stock (bill cancelled / entry deleted). */
  reverse: function(ref, opts){ return this.post(ref, [], 'out', Object.assign({force:true}, opts||{})); },
  /** Purchase hook (Supplier bill, Purchase Bill …): stock बढ्छ. */
  purchaseIn: function(ref, lines, opts){ return this.post(ref, lines, 'in', opts); },

  /** Sale hook: bring an invoice's stock effect in line with its items / status. */
  syncInvoice: function(inv){
    if(!inv || !inv.stockTracked) return {changed:[],unmatched:[],low:[]};
    var ref='inv:'+inv.id;
    var cancelled = (typeof Invoices!=='undefined' && Invoices.isCancelled) ? Invoices.isCancelled(inv) : inv.status==='Cancelled';
    if(cancelled) return this.reverse(ref, {note:'❌ '+(inv.invNum||'')+' रद्द'});
    return this.post(ref, inv.items||[], 'out', {note:'🧾 बिक्री '+(inv.invNum||'')+(inv.custName?' — '+inv.custName:''), date:inv.date});
  },
  /** Toast after a sale when something went low. */
  warnLow: function(res){
    if(!res || !res.low || !res.low.length) return;
    try{ App.toast('⚠️ Low Stock: '+res.low.map(function(s){ return s.name+' ('+(s.qty||0)+' '+(s.unit||'')+')'; }).join(', '),'warning',4500); }catch(e){}
  },

  // ── Dashboard warning card (#dash-lowstock, data-module="stock") ──
  renderDashAlert: function(){
    var box=document.getElementById('dash-lowstock'); if(!box) return;
    var low=this.lowItems();
    if(!low.length){ box.innerHTML=''; box.style.display='none'; return; }
    var self=this, shown=low.slice(0,6), more=low.length-shown.length;
    box.style.display='';
    box.innerHTML='<div class="card" onclick="App.navigate(\'stocklist\')" style="cursor:pointer;margin-bottom:14px;border:1px solid rgba(248,113,113,0.45);background:var(--red-soft);">'
      +'<div style="padding:11px 14px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">'
      +'<div style="font-weight:800;color:var(--red);font-size:0.9rem;">⚠️ Low Stock — '+low.length+' सामान सकिन लागेको</div>'
      +'<span class="btn btn-xs btn-secondary">📦 Stock हेर्नुहोस्</span></div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">'
      +shown.map(function(s){
        var q=parseFloat(s.qty)||0;
        return '<span data-low-item="'+esc(s.id)+'" style="font-size:0.74rem;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--surface);border:1px solid rgba(248,113,113,0.4);color:'+(q<=0?'var(--red)':'var(--text)')+';">'
          +esc(s.name)+': '+q+' '+esc(s.unit||'')+' <span style="font-weight:500;color:var(--text-muted);">(सीमा '+self.minOf(s)+')</span></span>';
      }).join('')
      +(more>0?'<span style="font-size:0.74rem;color:var(--text-muted);padding:3px 4px;">+'+more+' अरू</span>':'')
      +'</div></div></div>';
  }
};

