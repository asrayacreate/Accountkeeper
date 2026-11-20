// ─── STOCK MODULE ─────────────────────────────────────────────
var Stock = {
  _curId: null,
  getData: function(){ return STORE.get('pk3_stock',[])||[]; },
  render: function(){
    var list=this.getData(); var q=getVal('stk-search').toLowerCase();
    if(q) list=list.filter(function(s){return (s.name+s.cat).toLowerCase().indexOf(q)>=0;});
    // Alert bar
    var lowStock=list.filter(function(s){return s.qty<=(s.minQty||5);});
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
      var isLow=s.qty<=(s.minQty||5);
      return '<tr><td>'+(s.photo?'<img src="'+s.photo+'" class="photo-thumb sm">':'<div style="width:36px;height:36px;border-radius:7px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">📦</div>')+'</td>'+
      '<td><div style="font-weight:700;">'+s.name+'</div>'+(s.barcode?'<div style="font-size:0.68rem;color:var(--text-muted);">'+s.barcode+'</div>':'')+'</td>'+
      '<td style="font-size:0.8rem;">'+(s.cat||'—')+'</td>'+
      '<td style="text-align:right;font-weight:700;color:'+(isLow?'var(--red)':'var(--text)')+';">'+(s.qty||0)+' '+(s.unit||'')+'</td>'+
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
    setVal('stk-edit-id',s.id); setVal('stk-name',s.name); setVal('stk-cat',s.cat||''); setVal('stk-qty',s.qty||0); setVal('stk-unit',s.unit||'pcs'); setVal('stk-purchase',s.purchase||0); setVal('stk-selling',s.selling||0); setVal('stk-min',s.minQty||5); setVal('stk-barcode',s.barcode||''); setVal('stk-notes',s.notes||'');
    setText('stk-modal-title','✏️ Edit Stock Item');
    document.getElementById('stk-modal').classList.add('open');
  },
  save: function(){
    var name=getVal('stk-name'); if(!name){App.toast('नाम चाहिन्छ!','error');return;}
    var id=getVal('stk-edit-id')||uid(); var isEdit=!!getVal('stk-edit-id');
    var rec={id:id,name:name,cat:getVal('stk-cat'),qty:parseFloat(getVal('stk-qty'))||0,unit:getVal('stk-unit')||'pcs',purchase:parseFloat(getVal('stk-purchase'))||0,selling:parseFloat(getVal('stk-selling'))||0,minQty:parseFloat(getVal('stk-min'))||5,barcode:getVal('stk-barcode'),notes:getVal('stk-notes'),history:[]};
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
    document.getElementById('stk-hist-list').innerHTML=hist.length?'<table><thead><tr><th>Date</th><th>Type</th><th style="text-align:right;">Qty</th><th>Note</th></tr></thead><tbody>'+hist.map(function(h){return '<tr><td>'+fmtDisplayDate(h.date)+'</td><td><span class="tag '+(h.type==='in'?'tag-green':'tag-red')+'">'+h.type+'</span></td><td style="text-align:right;">'+(h.type==='in'?'+':'-')+h.qty+'</td><td>'+(h.note||'—')+'</td></tr>';}).join('')+'</tbody></table>':'<div class="empty-state" style="padding:20px;">No history yet</div>';
    document.getElementById('stk-history-modal').classList.add('open');
  },
  adjustStock: function(){
    var qty=parseFloat(getVal('stk-adj-qty'))||0; if(!qty){App.toast('Qty enter गर्नुस्!','error');return;}
    var type=getVal('stk-adj-type')||'in'; var note=getVal('stk-adj-note')||''; var id=this._curId; if(!id)return;
    var list=this.getData(); var idx=list.findIndex(function(x){return x.id===id;}); if(idx<0)return;
    var s=list[idx]; if(!s.history)s.history=[];
    if(type==='in')s.qty=(s.qty||0)+qty;
    else if(type==='out')s.qty=Math.max(0,(s.qty||0)-qty);
    else s.qty=qty;
    s.history.unshift({date:todayISO(),type:type,qty:qty,note:note});
    STORE.set('pk3_stock',list);
    this.history(id);
    App.toast('✅ Stock adjusted!','success');
    this.render();
  },
  del: function(id){ if(!confirm('Delete?'))return; STORE.set('pk3_stock',this.getData().filter(function(x){return x.id!==id;})); this.render(); App.toast('🗑 Deleted','info'); },
  scanBarcode: function(){ App.toast('📷 Barcode scanner — camera access needed','info'); }
};

