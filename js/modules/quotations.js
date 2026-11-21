// ─── QUOTATIONS MODULE ────────────────────────────────────────
var Quotations = {
  _edit: null, _filter: 'all', _rows: [],
  getData: function() { return STORE.get('pk3_quotations',[])||[]; },
  setFilter: function(f) {
    this._filter=f;
    ['all','today','week','month'].forEach(function(x){var b=document.getElementById('qf-'+x);if(b)b.className='btn btn-sm btn-'+(x===f?'primary':'secondary');});
    this.render();
  },
  initForm: function() {
    if(!this._edit) {
      setVal('q-cust',''); setVal('q-work',''); setVal('q-subwork',''); setVal('q-status','Pending'); setVal('q-details',''); setVal('q-discount','0'); setVal('q-tax','0'); setVal('q-advance','0');
      this._rows=[]; this.renderRows(); this.calc();
      setText('add-quot-title','📝 New Quotation');
      setVal('q-amount','0');
    } else {
      var q=this._edit; this._edit=null;
      this._rows=q.items||[];
      setVal('q-cust',q.custId||''); setVal('q-work',q.work||''); setVal('q-subwork',q.subwork||'');
      setVal('q-status',q.status||'Pending'); setVal('q-details',q.details||'');
      setVal('q-discount',q.discount||0); setVal('q-tax',q.tax||0); setVal('q-advance',q.advance||0);
      setText('add-quot-title','✏️ Edit Quotation');
      this.renderRows(); this.calc();
    }
    this.loadCustDropdown();
    Customers.loadServices();
  },
  loadCustDropdown: function() {
    var custs=Customers.getData();
    var sel=document.getElementById('q-cust'); if(!sel)return;
    var cur=sel.value;
    sel.innerHTML='<option value="">-- Customer --</option>'+custs.map(function(c){
      var sv=Customers.getServices(c).map(function(x){return x.work;}).filter(Boolean);
      var tag=sv.length?(' — '+sv.slice(0,2).join(', ')+(sv.length>2?' +'+(sv.length-2):'')):'';
      return '<option value="'+esc(c.id)+'">'+esc(c.name)+' ('+esc(c.phone)+')'+esc(tag)+'</option>';
    }).join('');
    if(cur)sel.value=cur;
  },
  autoFillService: function() {
    var id=getVal('q-cust'), custs=Customers.getData();
    var c=custs.find(function(x){return x.id===id;}); if(!c) return;
    var self=this;
    // v5.4: धेरै service भए कुन हो भनेर सोध्छ, एउटा मात्र भए सिधै भर्छ
    Customers.pickService(c, function(svc){
      setVal('q-work', svc.work||'');
      self.loadSubService();
      setTimeout(function(){ setVal('q-subwork', svc.subwork||''); },100);
    });
  },
  loadSubService: function() {
    var work = document.getElementById('q-work');
    var sub  = document.getElementById('q-subwork');
    if (!sub || !work) return;
    var val = work.value;
    // ── FIX (v4.0.1): Preserve static optgroups when no service selected ──
    if (!sub._originalHTML) sub._originalHTML = sub.innerHTML;
    if (!val) { sub.innerHTML = sub._originalHTML; return; }
    sub.innerHTML = '<option value="">-- Select Sub Service --</option>';
    var subs = SERVICES_MAP[val] || [];
    subs.forEach(function(x) {
      var o = document.createElement('option');
      o.value = x; o.textContent = x;
      sub.appendChild(o);
    });
    var o = document.createElement('option');
    o.value = '__custom__'; o.textContent = '✏️ आफै लेख्नुस् (Custom)';
    sub.appendChild(o);
  },
  loadServices: function() {
    var svcs = STORE.get('pk3_services', null);
    if (!svcs || !Array.isArray(svcs) || !svcs.length) svcs = SERVICES_DATA || [];
    var sel = document.getElementById('q-work'); if(!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">-- Select Service --</option>';
    svcs.forEach(function(s){
      var name = (typeof s === 'string') ? s : (s.name || '');
      if (!name) return;
      var opt = document.createElement('option'); opt.value = name; opt.textContent = name; sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  },
  highlightSubSvc: function() {},
  addRow: function() { this._rows.push({name:'',qty:1,unit:'pcs',rate:0,amount:0}); this.renderRows(); },
  renderRows: function() {
    var tb=document.getElementById('q-rows'); if(!tb)return;
    var self=this;
    tb.innerHTML=this._rows.map(function(r,i){
      return '<tr><td><input type="text" value="'+( r.name||'')+'" oninput="Quotations._rows['+i+'].name=this.value" placeholder="Item..." style="width:100%;min-width:120px;"></td>'+
      '<td><input type="number" value="'+(r.qty||1)+'" oninput="Quotations._rows['+i+'].qty=parseFloat(this.value)||0;Quotations.calcRow('+i+')" style="width:60px;text-align:right;"></td>'+
      '<td><input type="text" value="'+(r.unit||'pcs')+'" oninput="Quotations._rows['+i+'].unit=this.value" style="width:55px;text-align:center;"></td>'+
      '<td><input type="number" value="'+(r.rate||0)+'" oninput="Quotations._rows['+i+'].rate=parseFloat(this.value)||0;Quotations.calcRow('+i+')" style="width:90px;text-align:right;"></td>'+
      '<td style="text-align:right;font-weight:600;">'+fmtRs((r.qty||1)*(r.rate||0))+'</td>'+
      '<td><button onclick="Quotations.delRow('+i+')" class="btn btn-icon btn-sm btn-danger">✕</button></td></tr>';
    }).join('');
  },
  calcRow: function(i) { var r=this._rows[i]; if(r){r.amount=(r.qty||0)*(r.rate||0);} this.calc(); this.renderRows(); },
  delRow: function(i) { this._rows.splice(i,1); this.renderRows(); this.calc(); },
  calc: function() {
    var sub=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0);
    var disc=parseFloat(getVal('q-discount'))||0;
    var tax=parseFloat(getVal('q-tax'))||0;
    var adv=parseFloat(getVal('q-advance'))||0;
    var afterDisc=sub-disc;
    var taxAmt=afterDisc*(tax/100);
    var total=afterDisc+taxAmt;
    var bal=total-adv;
    setText('q-subtotal',fmtRs(sub)); setText('q-total',fmtRs(total)); setText('q-balance',fmtRs(bal));
    // Live helpers: discount % of subtotal + tax amount in Rs
    var dp=document.getElementById('q-disc-pct');
    if(dp) dp.textContent=(sub>0&&disc>0)?'('+((disc/sub)*100).toFixed(1).replace(/\.0$/,'')+'%)':'';
    var ta=document.getElementById('q-tax-amt');
    if(ta) ta.textContent=(taxAmt>0)?'('+fmtRs(taxAmt)+')':'';
    setVal('q-amount',total);
  },
  pickFromRateList: function() {
    RateList._pickTarget='quotation'; RateList._pickedItems=[];
    RateList.renderPickModal('');
    document.getElementById('rate-pick-modal').classList.add('open');
  },
  previewNew: function() { this.save(true); },
  save: function(preview) {
    var custId=getVal('q-cust');
    if(!custId){App.toast('Customer छान्नुस्!','error');return;}
    var custs=Customers.getData(); var cust=custs.find(function(x){return x.id===custId;})||{};
    var id=this._edit?this._edit.id:uid();
    var isEdit=!!(this._edit);
    var total=parseFloat(getVal('q-amount'))||0;
    var adv=parseFloat(getVal('q-advance'))||0;
    var rec={id:id,custId:custId,custName:cust.name||'',custPhone:cust.phone||'',work:getVal('q-work'),subwork:getVal('q-subwork'),status:getVal('q-status'),details:getVal('q-details'),items:this._rows,discount:parseFloat(getVal('q-discount'))||0,tax:parseFloat(getVal('q-tax'))||0,advance:adv,amount:total,balance:total-adv,date:todayISO(),dateBs:todayBs(),created:todayISO()};
    var list=this.getData();
    if(isEdit){var idx=list.findIndex(function(x){return x.id===id;});if(idx>=0)list[idx]=rec;else list.unshift(rec);}else{list.unshift(rec);}
    STORE.set('pk3_quotations',list);
    // Add advance to daybook
    if(!isEdit&&adv>0){ try { var db=STORE.get('pk3_daybook',[]);db.unshift({id:uid(),type:'income',amount:adv,desc:'Quotation Advance - '+cust.name,cat:'Advance',date:todayISO(),dateBs:todayBs(),user:(currentUser&&currentUser.name)||'system'});STORE.set('pk3_daybook',db); } catch(e){} }
    try { Audit.log('QUOTATION',isEdit?'Edited: '+cust.name:'New: '+cust.name+' Rs.'+total); } catch(e){}
    try { Activity.add('📋 Quotation '+(isEdit?'updated':'created')+': '+cust.name+' — '+fmtRs(total)); } catch(e){}
    if(!preview){App.toast('✅ Quotation saved!','success');App.navigate('quotations');}
    else{this.showPreview(rec);}
  },
  // v6.9.0: professional print/PDF layout (DocPrint) + 1-click Convert to Invoice
  showPreview: function(q) {
    var conv = QuoteConvert.isConverted(q);
    DocPrint.preview(DocPrint.fromQuotation(q), '📋 Quotation — '+(q.custName||''), [
      { label:'📱 WhatsApp', cls:'btn-wa', onClick:function(){ Quotations.whatsapp(q.id); } },
      conv ? { label:'✅ Converted · '+(q.convertedInvNum||''), cls:'btn-secondary', id:'q-conv-btn', onClick:function(){ document.getElementById('view-modal').classList.remove('open'); App.navigate('invoices'); Invoices.preview(q.convertedInvId); } }
           : { label:'✅ Convert to Invoice / Sale', cls:'btn-success', id:'q-conv-btn', onClick:function(){ QuoteConvert.fromQuotation(q.id); } }
    ]);
  },
  whatsapp: function(id){
    var q = this.getData().find(function(x){ return x.id==id; });
    if(!q) return;
    var t = 'Quotation from '+Company.name()+'\nCustomer: '+( q.custName||'')+
            '\nTotal: '+fmtRs(q.amount||q.total||0)+
            '\nStatus: '+(q.status||'pending');
    var phone = (q.custPhone||'').replace(/[^0-9]/g,'');
    window.open('https://wa.me/977'+phone+'?text='+encodeURIComponent(t));
  },
  render: function() {
    var list=this.getData(); var today=todayISO(); var week=new Date(); week.setDate(week.getDate()-7);
    if(this._filter==='today') list=list.filter(function(q){return q.date===today;});
    else if(this._filter==='week') list=list.filter(function(q){return q.date>=isoLocal(week);});
    else if(this._filter==='month') list=list.filter(function(q){return q.date&&q.date.slice(0,7)===today.slice(0,7);});
    var tb=document.getElementById('quot-table'), ne=document.getElementById('no-quot');
    setText('q-filter-label',list.length+' quotations');
    if(!list.length){tb.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    var statusColors={'Pending':'tag-yellow','Approved':'tag-green','Completed':'tag-blue','Cancelled':'tag-red'};
    tb.innerHTML=list.map(function(q){return '<tr style="cursor:pointer;" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'" onclick="Quotations.preview(\''+q.id+'\')"><td><div style="font-weight:600;">'+q.custName+(q._demo?' <span style="background:#f59e0b;color:#000;font-size:0.56rem;font-weight:800;padding:1px 5px;border-radius:7px;">DEMO</span>':'')+'</div><div style="font-size:0.72rem;color:var(--text-muted);">'+q.custPhone+'</div></td><td style="font-size:0.82rem;">'+(q.work||'—')+'</td><td style="text-align:right;font-weight:700;">'+fmtRs(q.amount)+'</td><td style="text-align:right;color:var(--green);">'+fmtRs(q.advance||0)+'</td><td style="font-size:0.78rem;">'+(q.dateBs?bsStringToDisplay(q.dateBs):fmtDisplayDate(q.date))+'</td><td><span class="tag '+(statusColors[q.status]||'tag-gray')+'">'+q.status+'</span>'+(QuoteConvert.isConverted(q)?' '+QuoteConvert.badge(q):'')+(q._returned?' <span class="tag tag-gray" style="font-size:0.56rem;">↩️ Returned</span>':'')+'</td><td onclick="event.stopPropagation();"><div class="btn-group">'+(QuoteConvert.isConverted(q)?'':'<button onclick="event.stopPropagation();QuoteConvert.fromQuotation(\''+q.id+'\')" class="btn btn-xs btn-success" data-convert="'+q.id+'" title="Convert to Invoice / Sale">✅ Invoice</button>')+'<button onclick="event.stopPropagation();Quotations.preview(\''+q.id+'\')" class="btn btn-xs btn-secondary" title="Preview">👁</button><button onclick="event.stopPropagation();Quotations.edit(\''+q.id+'\')" class="btn btn-xs btn-secondary" title="Edit">✏️</button><button onclick="event.stopPropagation();SalesReturns.open(\'quotation\',\''+q.id+'\')" class="btn btn-xs" style="background:#7f1d1d;color:#fff;" title="Return / Refund">↩️</button><button onclick="event.stopPropagation();Quotations.del(\''+q.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button></div></td></tr>';}).join('');
  },
  preview: function(id) { var q=this.getData().find(function(x){return x.id===id;}); if(q) this.showPreview(q); },
  edit: function(id) { var q=this.getData().find(function(x){return x.id===id;}); if(!q)return; this._edit=q; App.navigate('add-quotation'); },
  del: function(id) { if(!confirm('Delete?'))return; STORE.set('pk3_quotations',this.getData().filter(function(x){return x.id!==id;})); App.toast('🗑 Deleted','info'); this.render(); }
};

