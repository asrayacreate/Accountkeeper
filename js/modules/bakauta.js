// ─── BAKAUTA MODULE ───────────────────────────────────────────
var Bakauta = {
  _rows: [],
  render: function(){ this.loadCatDropdown(); this.loadCustDatalist(); this.renderRows(); this.calc(); },
  loadCatDropdown: function(){ var rates=STORE.get('pk3_rates',{}); var sel=document.getElementById('bk-cat-auto'); if(sel){sel.innerHTML='<option value="">⚡ Auto from Category...</option>'+Object.keys(rates).map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');} },
  loadCustDatalist: function(){ var custs=Customers.getData(); var dl=document.getElementById('cust-name-list'); if(dl)dl.innerHTML=custs.map(function(c){return '<option value="'+c.name+'">';}).join(''); },
  autoLoad: function(){ var cat=getVal('bk-cat-auto'); if(!cat)return; var rates=STORE.get('pk3_rates',{}); if(!rates[cat])return; rates[cat].forEach(function(item){Bakauta._rows.push({name:item.name,qty:1,unit:item.unit||'sqft',rate:item.rate});});this.renderRows();this.calc(); },
  addRow: function(){ this._rows.push({name:'',qty:1,unit:'sqft',rate:0}); this.renderRows(); },
  renderRows: function(){
    var tb=document.getElementById('bk-rows'); if(!tb)return;
    tb.innerHTML=this._rows.map(function(r,i){
      return '<tr><td style="text-align:center;color:var(--text-muted);">'+(i+1)+'</td>'+
      '<td><input type="text" value="'+(r.name||'')+'" oninput="Bakauta._rows['+i+'].name=this.value" placeholder="विवरण" style="width:100%;min-width:100px;"></td>'+
      '<td><input type="text" value="'+(r.unit||'sqft')+'" oninput="Bakauta._rows['+i+'].unit=this.value" style="width:55px;text-align:right;"></td>'+
      '<td><input type="number" value="'+(r.qty||1)+'" oninput="Bakauta._rows['+i+'].qty=parseFloat(this.value)||0;Bakauta.calc();" style="width:55px;text-align:right;"></td>'+
      '<td><input type="number" value="'+(r.rate||0)+'" oninput="Bakauta._rows['+i+'].rate=parseFloat(this.value)||0;Bakauta.calc();" style="width:70px;text-align:right;"></td>'+
      '<td style="text-align:right;font-weight:700;">'+fmtRs((r.qty||0)*(r.rate||0))+'</td>'+
      '<td><button onclick="Bakauta._rows.splice('+i+',1);Bakauta.renderRows();Bakauta.calc();" class="btn btn-icon btn-sm btn-danger">✕</button></td></tr>';
    }).join('');
  },
  calc: function(){
    var sub=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0);
    var tax=parseFloat(getVal('bk-tax'))||0, disc=parseFloat(getVal('bk-disc'))||0, adv=parseFloat(getVal('bk-advance'))||0;
    var total=sub+sub*(tax/100)-disc;
    setText('bk-sub',fmtRs(sub)); setText('bk-total',fmtRs(total)); setText('bk-balance',fmtRs(total-adv));
  },
  pickFromRates: function(){ RateList._pickTarget='bakauta'; RateList._pickedItems=[]; RateList.renderPickModal(''); document.getElementById('rate-pick-modal').classList.add('open'); },
  clear: function(){ if(!confirm('Clear all?'))return; this._rows=[]; this.renderRows(); this.calc(); setVal('bk-name',''); setVal('bk-phone',''); setVal('bk-addr',''); setVal('bk-tax','0'); setVal('bk-disc','0'); setVal('bk-advance','0'); setVal('bk-remarks',''); },
  preview: function(){
    var co=STORE.get('pk3_settings',{});
    var sub=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0);
    var tax=parseFloat(getVal('bk-tax'))||0, disc=parseFloat(getVal('bk-disc'))||0, adv=parseFloat(getVal('bk-advance'))||0;
    var total=sub+sub*(tax/100)-disc;
    var html='<div style="padding:20px;font-family:sans-serif;"><div style="text-align:center;margin-bottom:14px;"><div style="font-size:1.3rem;font-weight:900;color:#f97316;">'+(co.companyName||'PRERAK MULTIPURPOSE')+'</div><div style="font-size:0.8rem;color:#666;">'+(co.address||'Hetauda-2')+'</div></div>';
    html+='<div style="margin-bottom:10px;"><b>Customer:</b> '+getVal('bk-name')+' | <b>Phone:</b> '+getVal('bk-phone')+'</div>';
    html+='<table style="width:100%;border-collapse:collapse;margin-bottom:10px;"><tr style="background:#f97316;color:#fff;"><th style="padding:5px;">SN</th><th style="padding:5px;text-align:left;">Item</th><th style="padding:5px;">Qty</th><th style="padding:5px;">Unit</th><th style="padding:5px;text-align:right;">Rate</th><th style="padding:5px;text-align:right;">Amount</th></tr>';
    this._rows.forEach(function(r,i){html+='<tr style="border-bottom:1px solid #eee;"><td style="padding:5px;text-align:center;">'+(i+1)+'</td><td style="padding:5px;">'+r.name+'</td><td style="padding:5px;text-align:center;">'+(r.qty||0)+'</td><td style="padding:5px;text-align:center;">'+(r.unit||'')+'</td><td style="padding:5px;text-align:right;">'+fmtRs(r.rate||0)+'</td><td style="padding:5px;text-align:right;font-weight:700;">'+fmtRs((r.qty||0)*(r.rate||0))+'</td></tr>';});
    html+='</table><div style="text-align:right;"><div>Subtotal: '+fmtRs(sub)+'</div>'+(disc?'<div>Discount: -'+fmtRs(disc)+'</div>':'')+(tax?'<div>Tax: +'+fmtRs(sub*(tax/100))+'</div>':'')+'<div style="font-size:1.1rem;font-weight:900;color:#f97316;border-top:2px solid #f97316;padding-top:4px;">Total: '+fmtRs(total)+'</div>'+(adv?'<div style="color:green;">Advance: '+fmtRs(adv)+'</div><div style="color:red;">Balance: '+fmtRs(total-adv)+'</div>':'')+'</div>';
    if(getVal('bk-remarks'))html+='<div style="margin-top:10px;font-size:0.82rem;"><b>Remarks:</b> '+getVal('bk-remarks')+'</div>';
    html+='</div>';
    document.getElementById('bk-preview-body').innerHTML=html;
    document.getElementById('bk-preview-modal').classList.add('open');
  },
  shareWA: function(){ var name=getVal('bk-name'); var total=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0); var msg='Estimate for '+name+'\nTotal: '+fmtRs(total)+'\nFrom PRERAK MULTIPURPOSE'; var phone=getVal('bk-phone'); if(phone)window.open('https://wa.me/977'+phone.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg),'_blank'); else App.toast('Phone number चाहिन्छ!','error'); },
  print: function(){ window.print(); },
  toQuotation: function(){
    var custs=Customers.getData(); var sel=document.getElementById('bk-toquot-cust'); if(sel) sel.innerHTML='<option value="">-- Customer --</option>'+custs.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
    document.getElementById('bk-toquot-modal').classList.add('open');
  },
  confirmToQuotation: function(){
    var custId=getVal('bk-toquot-cust'); if(!custId){App.toast('Customer छान्नुस्!','error');return;}
    Quotations._rows=this._rows.map(function(r){return {name:r.name,qty:r.qty||0,unit:r.unit||'sqft',rate:r.rate||0,amount:(r.qty||0)*(r.rate||0)};});
    setVal('q-cust',custId);
    document.getElementById('bk-toquot-modal').classList.remove('open');
    Quotations.initForm(); App.navigate('add-quotation');
    App.toast('✅ Items transferred to quotation!','success');
  },
  save: function(){
    var name=getVal('bk-name')||'Unnamed'; if(!this._rows.length){App.toast('Items add गर्नुस्!','error');return;}
    var total=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0);
    var rec={id:uid(),custName:name,phone:getVal('bk-phone'),addr:getVal('bk-addr'),date:todayISO(),dateBs:todayBs(),items:this._rows,tax:parseFloat(getVal('bk-tax'))||0,disc:parseFloat(getVal('bk-disc'))||0,advance:parseFloat(getVal('bk-advance'))||0,total:total,remarks:getVal('bk-remarks'),status:'Draft'};
    var list=STORE.get('pk3_estimates',[]); list.unshift(rec); STORE.set('pk3_estimates',list);
    App.toast('✅ Estimate saved!','success');
  },
  renderList: function(){
    var list=STORE.get('pk3_estimates',[]); var q=getVal('est-search').toLowerCase();
    if(q) list=list.filter(function(e){return (e.custName||'').toLowerCase().indexOf(q)>=0;});
    setText('est-count',list.length+' estimates');
    var tb=document.getElementById('est-table'); var ne=document.getElementById('no-est');
    if(!list.length){tb.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    var sc={'Draft':'tag-gray','Approved':'tag-green','Sent':'tag-blue','Rejected':'tag-red'};
    tb.innerHTML=list.map(function(e){return '<tr><td style="font-weight:600;">'+e.custName+'</td><td style="font-size:0.78rem;">'+(e.dateBs?bsStringToDisplay(e.dateBs):fmtDisplayDate(e.date))+'</td><td style="text-align:right;font-weight:700;">'+fmtRs(e.total)+'</td><td><span class="tag '+(sc[e.status]||'tag-gray')+'">'+e.status+'</span>'+(QuoteConvert.isConverted(e)?' '+QuoteConvert.badge(e):'')+'</td><td><div class="btn-group">'+(QuoteConvert.isConverted(e)?'':'<button onclick="QuoteConvert.fromEstimate(\''+e.id+'\')" class="btn btn-xs btn-success" data-convert="'+e.id+'" title="Convert to Invoice / Sale">✅ Invoice</button>')+'<button onclick="Bakauta.viewEst(\''+e.id+'\')" class="btn btn-xs btn-primary" title="View / Print">👁</button><button onclick="Bakauta.shareEstWA(\''+e.id+'\')" class="btn btn-xs btn-wa" title="WhatsApp">📱</button><button onclick="Bakauta.loadEst(\''+e.id+'\')" class="btn btn-xs btn-secondary" title="Edit">✏️</button><button onclick="Bakauta.delEst(\''+e.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button></div></td></tr>';}).join('');
  },
  // View saved estimate — v6.9.0 professional print/PDF layout + Convert to Invoice
  viewEst: function(id){
    var e=STORE.get('pk3_estimates',[]).find(function(x){return x.id===id;}); if(!e)return;
    var conv = QuoteConvert.isConverted(e);
    DocPrint.preview(DocPrint.fromEstimate(e), '👁 Estimate — '+(e.custName||''), [
      { label:'📱 WhatsApp', cls:'btn-wa', onClick:function(){ Bakauta.shareEstWA(id); } },
      conv ? { label:'✅ Converted · '+(e.convertedInvNum||''), id:'e-conv-btn', onClick:function(){ document.getElementById('view-modal').classList.remove('open'); App.navigate('invoices'); Invoices.preview(e.convertedInvId); } }
           : { label:'✅ Convert to Invoice / Sale', cls:'btn-success', id:'e-conv-btn', onClick:function(){ QuoteConvert.fromEstimate(id); } }
    ]);
  },
  shareEstWA: function(id){
    var e=STORE.get('pk3_estimates',[]).find(function(x){return x.id===id;}); if(!e)return;
    var co=STORE.get('pk3_settings',{})||{};
    var msg='*🧾 ESTIMATE '+(e.estNo||'')+'*\n'+(co.companyName||'PRERAK MULTIPURPOSE PVT LTD')+'\n\n'
      +'Customer: '+(e.custName||'')+'\n'+(e.title?'Project: '+e.title+'\n':'')
      +'Total: '+fmtRs(e.total)+'\n'
      +(e.advance>0?'Advance: '+fmtRs(e.advance)+'\nBalance: '+fmtRs((e.total||0)-(e.advance||0))+'\n':'')
      +'\n'+(co.phone1||'9855069733');
    var phone=(e.phone||'').replace(/[^0-9]/g,'');
    if(typeof Wa!=='undefined'&&Wa.send) Wa.send(e.phone||'', msg);
    else window.open('https://wa.me/'+(phone?'977'+phone:'')+'?text='+encodeURIComponent(msg),'_blank');
  },
  loadEst: function(id){ var e=STORE.get('pk3_estimates',[]).find(function(x){return x.id===id;}); if(!e)return; this._rows=e.items||[]; setVal('bk-name',e.custName||''); setVal('bk-phone',e.phone||''); setVal('bk-addr',e.addr||''); setVal('bk-tax',e.tax||0); setVal('bk-disc',e.disc||0); setVal('bk-advance',e.advance||0); setVal('bk-remarks',e.remarks||''); this.renderRows(); this.calc(); App.navigate('bakauta'); },
  delEst: function(id){ if(!confirm('Delete?'))return; STORE.set('pk3_estimates',STORE.get('pk3_estimates',[]).filter(function(x){return x.id!==id;})); this.renderList(); App.toast('🗑 Deleted','info'); }
};

