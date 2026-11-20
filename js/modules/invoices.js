// ─── INVOICES MODULE ─────────────────────────────────────────
var Invoices = {
  _cur: null,
  _rows: [],
  _editId: null,
  _curPreviewId: null,
  getData: function(){ return STORE.get('pk3_invoices',[])||[]; },

  // ── Invoice number: year-prefixed, gap-safe (scans max, not list[0]) ──
  nextNum: function(){
    var list=this.getData();
    var yr=(new Date().getFullYear());
    var prefix='INV-'+yr+'-';
    var max=0;
    list.forEach(function(x){
      var s=String(x.invNum||'');
      var m=s.match(/(\d+)\s*$/);          // trailing number in any format
      if(m){ var n=parseInt(m[1],10); if(n>max) max=n; }
    });
    return prefix+String(max+1).padStart(3,'0');
  },

  // ── recompute totals from rows + discount + tax ──
  calc: function(){
    var sub=0;
    this._rows.forEach(function(r){ r.amount=(parseFloat(r.qty)||0)*(parseFloat(r.rate)||0); sub+=r.amount; });

    // Discount: percent OR flat Rs. (toggle via inv-disc-mode)
    var discMode = getVal('inv-disc-mode')||'percent';
    var discInput = parseFloat(getVal('inv-disc'))||0;
    if(discInput<0) discInput=0;
    var discAmt, discP;
    if(discMode==='flat'){
      discAmt = discInput>sub ? sub : discInput;   // cannot exceed subtotal
      discP = sub>0 ? (discAmt/sub*100) : 0;
    } else {
      if(discInput>100) discInput=100;
      discP = discInput;
      discAmt = sub*discP/100;
    }

    var taxP=parseFloat(getVal('inv-tax'));
    if(isNaN(taxP)) taxP=13;
    if(taxP<0) taxP=0;
    var taxable=sub-discAmt;
    var taxAmt=taxable*taxP/100;
    var grandRaw=taxable+taxAmt;

    // Round-off (toggle via inv-roundoff checkbox) — to nearest rupee
    var roundOn = (function(){ var el=document.getElementById('inv-roundoff'); return el? el.checked : true; })();
    var grand = roundOn ? Math.round(grandRaw) : grandRaw;
    var roundDiff = grand - grandRaw;

    var paid=parseFloat(getVal('inv-paid-inp'))||0;
    if(paid<0) paid=0;
    var bal=grand-paid;

    setText('inv-sum-sub', fmtRs(sub));
    setText('inv-sum-disc', '- '+fmtRs(discAmt));
    setText('inv-sum-tax', '+ '+fmtRs(taxAmt));
    var roundEl=document.getElementById('inv-sum-round');
    if(roundEl) roundEl.textContent = (roundDiff>=0?'+ ':'- ')+fmtRs(Math.abs(roundDiff));
    var roundRow=document.getElementById('inv-sum-round-row');
    if(roundRow) roundRow.style.display = (roundOn && Math.abs(roundDiff)>0.009) ? 'flex' : 'none';
    setText('inv-sum-grand', fmtRs(grand));
    setText('inv-sum-bal', fmtRs(bal));

    // Amount in words
    var wordsEl=document.getElementById('inv-sum-words');
    if(wordsEl) wordsEl.textContent = (typeof numToWords==='function') ? numToWords(grand) : '';

    // Overpayment warning
    var warnEl=document.getElementById('inv-paid-warn');
    if(warnEl) warnEl.style.display = (paid>grand+0.5) ? '' : 'none';

    // Auto-status: set the dropdown (not just a hint) based on paid vs grand
    var st=document.getElementById('inv-status-inp');
    if(st && !st.dataset.userset){
      var auto = paid<=0 ? 'Pending' : (paid<grand-0.5 ? 'Partial' : 'Paid');
      // only auto-change among the money-driven statuses; leave Overdue/Cancelled if user picked them
      if(['Pending','Partial','Paid'].indexOf(st.value)>=0) st.value=auto;
    }
    var hint=document.getElementById('inv-status-hint');
    if(hint){
      var autoH = paid<=0 ? 'Pending' : (paid<grand-0.5 ? 'Partial' : 'Paid');
      hint.textContent='(भुक्तानी अनुसार: '+autoH+')';
    }

    return {sub:sub,discP:discP,discMode:discMode,discAmt:discAmt,taxP:taxP,taxAmt:taxAmt,grand:grand,grandRaw:grandRaw,roundOff:roundDiff,paid:paid,bal:bal};
  },

  addRow: function(name,qty,unit,rate){
    this._rows.push({name:name||'',qty:qty||1,unit:unit||'pcs',rate:rate||0,amount:0});
    this.renderRows();
  },
  removeRow: function(i){ this._rows.splice(i,1); this.renderRows(); this.calc(); },

  renderRows: function(){
    var tb=document.getElementById('inv-rows'); if(!tb) return;
    if(!this._rows.length){
      tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:14px;font-size:0.8rem;">कुनै item छैन — "➕ Item" थिच्नुहोस् वा Rate List बाट छान्नुहोस्</td></tr>';
      return;
    }
    // shared datalists (built once): units + rate-list item names
    if(!document.getElementById('inv-units-dl')){
      var dl=document.createElement('datalist'); dl.id='inv-units-dl';
      ['pcs','थान','sq.ft','वर्ग फिट','r.ft','running ft','sq.m','kg','बोरा','bag','ट्रिप','trip','ltr','set','दिन','घण्टा','job','lump sum'].forEach(function(u){ var o=document.createElement('option'); o.value=u; dl.appendChild(o); });
      document.body.appendChild(dl);
    }
    // rebuild items datalist from current rate list each render (cheap)
    var idl=document.getElementById('inv-items-dl');
    if(idl) idl.remove();
    idl=document.createElement('datalist'); idl.id='inv-items-dl';
    try{
      var rates=STORE.get('pk3_rates',{})||{};
      Object.keys(rates).forEach(function(cat){
        (rates[cat]||[]).forEach(function(it){
          if(it&&it.name){ var o=document.createElement('option'); o.value=it.name; o.label=cat+' • Rs.'+(it.rate||0); idl.appendChild(o); }
        });
      });
    }catch(e){}
    document.body.appendChild(idl);

    tb.innerHTML=this._rows.map(function(r,i){
      return '<tr>'
        +'<td><input type="text" list="inv-items-dl" value="'+esc(r.name||'')+'" oninput="Invoices._rows['+i+'].name=this.value" onchange="Invoices.autofillRate('+i+')" placeholder="विवरण" style="width:100%;min-width:120px;"></td>'
        +'<td><input type="number" value="'+(r.qty||1)+'" min="0" oninput="Invoices._rows['+i+'].qty=Math.max(0,parseFloat(this.value)||0);Invoices.calc()" style="width:56px;text-align:center;"></td>'
        +'<td><input type="text" list="inv-units-dl" value="'+esc(r.unit||'pcs')+'" oninput="Invoices._rows['+i+'].unit=this.value" style="width:62px;text-align:center;"></td>'
        +'<td><input type="number" value="'+(r.rate||0)+'" min="0" oninput="Invoices._rows['+i+'].rate=Math.max(0,parseFloat(this.value)||0);Invoices.calc()" style="width:80px;text-align:right;"></td>'
        +'<td style="text-align:right;font-weight:700;white-space:nowrap;">'+fmtRs((parseFloat(r.qty)||0)*(parseFloat(r.rate)||0))+'</td>'
        +'<td><button onclick="Invoices.removeRow('+i+')" class="btn btn-icon btn-xs" style="background:var(--red);color:#fff;" title="हटाउनुस्">✕</button></td>'
        +'</tr>';
    }).join('');
  },

  // When an item name matches a rate-list entry, auto-fill its rate + unit (only if rate is still 0/blank)
  autofillRate: function(i){
    var r=this._rows[i]; if(!r||!r.name) return;
    if(parseFloat(r.rate)>0) return;   // don't overwrite a rate the user typed
    try{
      var rates=STORE.get('pk3_rates',{})||{}, found=null;
      Object.keys(rates).some(function(cat){
        return (rates[cat]||[]).some(function(it){
          if(it&&it.name&&it.name.toLowerCase()===r.name.toLowerCase()){ found=it; return true; }
          return false;
        });
      });
      if(found){ r.rate=parseFloat(found.rate)||0; if(found.unit) r.unit=found.unit; this.renderRows(); this.calc(); }
    }catch(e){}
  },

  pickFromRateList: function(){
    if(typeof RateList==='undefined'){ App.toast('Rate list उपलब्ध छैन','error'); return; }
    RateList._pickTarget='invoice'; RateList._pickedItems=[];
    RateList.renderPickModal('');
    document.getElementById('rate-pick-modal').classList.add('open');
  },

  create: function(){ this._openForm(null); },
  edit: function(id){
    var inv=this.getData().find(function(x){ return x.id===id; });
    if(inv && this.isCancelled(inv)){ App.toast('❌ रद्द (CANCELLED) बिल edit गर्न मिल्दैन','error'); return; }
    this._openForm(id);
  },

  _openForm: function(id){
    var custs=Customers.getData();
    var inv = id ? this.getData().find(function(x){return x.id===id;}) : null;
    this._editId = inv ? inv.id : null;

    // seed rows
    if(inv && Array.isArray(inv.items) && inv.items.length){
      this._rows = inv.items.map(function(r){ return {name:r.name||'',qty:r.qty||1,unit:r.unit||'pcs',rate:r.rate||0,amount:0}; });
    } else if(inv){
      // legacy single-amount invoice → one row so nothing is lost
      this._rows = [{name:inv.desc||'Amount',qty:1,unit:'',rate:parseFloat(inv.amount)||0,amount:0}];
    } else {
      this._rows = [];
    }

    var custOpts='<option value="">-- Customer छान्नुस् --</option>'+custs.map(function(c){
      return '<option value="'+esc(c.id)+'"'+(inv&&inv.custId===c.id?' selected':'')+'>'+esc(c.name)+' ('+esc(c.phone)+')</option>';
    }).join('');

    var todayBsStr = (typeof todayBs==='function')?todayBs():'';
    var invNum = inv ? (inv.invNum||this.nextNum()) : this.nextNum();
    var dueVal = inv&&inv.dueDate ? inv.dueDate : '';
    var terms = inv&&inv.terms ? inv.terms : (STORE.get('pk3_settings',{})||{}).invTerms || '';
    var discV = inv&&inv.discP!=null ? inv.discP : 0;
    var taxV  = inv&&inv.taxP!=null ? inv.taxP : 13;
    var paidV = inv ? (parseFloat(inv.paid)||0) : 0;

    var coName = Company.name('');
    var coAddr = Company.get().address;
    var invBsStr = (typeof todayBs==='function') ? todayBs() : '';
    if(inv && inv.dateBs) invBsStr = inv.dateBs;

    var html='<div class="inv-doc">'
      // ── document header band ──
      +'<div class="inv-doc-head">'
        +'<div class="inv-doc-co"><div class="inv-doc-co-name">'+esc(coName)+'</div><div class="inv-doc-co-addr">'+esc(coAddr)+'</div></div>'
        +'<div class="inv-doc-badge">'+(inv?'INVOICE / बिल':'SALE / बिक्री बिल')+'</div>'
      +'</div>'

      // ── meta strip: invoice no / dates / customer (Book Keeper style) ──
      +'<div class="inv-doc-meta">'
        +'<div class="inv-mcell"><span class="inv-mlbl">Bill To / ग्राहक *</span><select id="inv-cust-sel" class="inv-fld">'+custOpts+'</select></div>'
        +'<div class="inv-mcell"><span class="inv-mlbl">Invoice No / बिल नं</span><input type="text" id="inv-num-inp" class="inv-fld" value="'+esc(invNum)+'"></div>'
        +'<div class="inv-mcell"><span class="inv-mlbl">Date / मिति (AD)</span><input type="date" id="inv-date-inp" class="inv-fld" value="'+(inv&&inv.date?String(inv.date).slice(0,10):new Date().toISOString().slice(0,10))+'"></div>'
        +'<div class="inv-mcell"><span class="inv-mlbl">मिति (BS)</span><input type="text" id="inv-date-bs-inp" class="inv-fld" value="'+esc(invBsStr)+'" placeholder="2083-04-17"></div>'
        +'<div class="inv-mcell"><span class="inv-mlbl">Due Date / भुक्तानी मिति</span><input type="date" id="inv-due-inp" class="inv-fld" value="'+esc(dueVal)+'"></div>'
      +'</div>'

      // ── items table (professional, like the Account|Amount grid) ──
      +'<div class="inv-items-head"><span>📋 Items / सामान-सेवा</span>'
        +'<div class="inv-items-btns"><button type="button" onclick="Invoices.addRow()" class="btn btn-xs btn-primary">➕ Item</button>'
        +'<button type="button" onclick="Invoices.pickFromRateList()" class="btn btn-xs btn-secondary">📖 Rate List</button></div>'
      +'</div>'
      +'<div class="inv-table-wrap"><table class="inv-table"><thead><tr>'
        +'<th style="text-align:left;">Particulars / विवरण</th><th style="width:64px;">Qty</th><th style="width:64px;">Unit</th><th style="width:96px;">Rate</th><th style="width:110px;text-align:right;">Amount</th><th style="width:34px;"></th>'
      +'</tr></thead><tbody id="inv-rows"></tbody></table></div>'

      // ── two-column footer: narration/terms (left) + totals (right) ──
      +'<div class="inv-doc-foot">'
        +'<div class="inv-foot-left">'
          +'<div class="inv-fld-group"><label class="inv-mlbl">Discount <select id="inv-disc-mode" onchange="Invoices.calc()" style="font-size:0.66rem;padding:1px 3px;border-radius:4px;"><option value="percent">%</option><option value="flat">Rs.</option></select></label><input type="number" id="inv-disc" value="'+discV+'" min="0" oninput="Invoices.calc()" class="inv-fld"></div>'
          +'<div class="inv-fld-group"><label class="inv-mlbl">VAT / Tax (%)</label><input type="number" id="inv-tax" value="'+taxV+'" min="0" oninput="Invoices.calc()" class="inv-fld"></div>'
          +'<div class="inv-fld-group"><label class="inv-mlbl">Paid (Rs.)</label><input type="number" id="inv-paid-inp" value="'+paidV+'" min="0" oninput="Invoices.calc()" class="inv-fld"><span id="inv-paid-warn" style="display:none;font-size:0.64rem;color:var(--red);margin-top:2px;">⚠️ Grand भन्दा बढी</span></div>'
          +'<div class="inv-fld-group"><label class="inv-mlbl">Status <span id="inv-status-hint" style="font-weight:400;color:var(--text-muted);font-size:0.7rem;"></span></label><select id="inv-status-inp" class="inv-fld" onchange="this.dataset.userset=1">'
            +['Pending','Partial','Paid','Overdue'].map(function(s){return '<option'+(inv&&inv.status===s?' selected':'')+'>'+s+'</option>';}).join('')
          +'</select></div>'
          +'<div class="inv-fld-group" style="grid-column:1/-1;"><label class="inv-mlbl">Narration / Payment Terms / कैफियत</label><textarea id="inv-terms-inp" placeholder="उदा: भुक्तानी १५ दिनभित्र। ग्यारेन्टी १ वर्ष।" class="inv-fld" style="min-height:52px;resize:vertical;">'+esc(terms)+'</textarea></div>'
        +'</div>'
        +'<div class="inv-foot-right">'
          +'<div class="inv-tot-row"><span>Subtotal</span><b id="inv-sum-sub">Rs. 0</b></div>'
          +'<div class="inv-tot-row muted"><span>Discount</span><span id="inv-sum-disc">- Rs. 0</span></div>'
          +'<div class="inv-tot-row muted"><span>Tax / VAT</span><span id="inv-sum-tax">+ Rs. 0</span></div>'
          +'<div class="inv-tot-row muted" id="inv-sum-round-row" style="display:none;"><span>Round Off</span><span id="inv-sum-round">+ Rs. 0</span></div>'
          +'<label class="inv-tot-row muted" style="cursor:pointer;align-items:center;gap:6px;"><span><input type="checkbox" id="inv-roundoff" checked onchange="Invoices.calc()" style="vertical-align:middle;"> Round to nearest Rs.</span></label>'
          +'<div class="inv-tot-grand"><span>Grand Total</span><b id="inv-sum-grand">Rs. 0</b></div>'
          +'<div id="inv-sum-words" style="font-size:0.68rem;font-style:italic;color:var(--text-muted);padding:4px 0;border-bottom:1px dashed var(--border);margin-bottom:4px;"></div>'
          +'<div class="inv-tot-row" style="margin-top:6px;"><span style="color:var(--text-muted);">Balance Due</span><b id="inv-sum-bal" style="color:var(--red);">Rs. 0</b></div>'
        +'</div>'
      +'</div>'

      // ── action bar ──
      +'<div class="inv-doc-actions"><button class="btn btn-secondary" onclick="document.getElementById(\'inv-edit-modal\').classList.remove(\'open\')">Cancel</button>'
        +'<button class="btn btn-success" onclick="Invoices.saveNew()">💾 '+(inv?'Update':'Save')+' Invoice</button></div>'
    +'</div>';

    setText('inv-edit-title', inv ? ('✏️ Edit Invoice '+(inv.invNum||'')) : '🧾 New Invoice');
    document.getElementById('inv-edit-body').innerHTML=html;
    this.renderRows();
    this.calc();
    document.getElementById('inv-edit-modal').classList.add('open');
    setTimeout(function(){ var f=document.getElementById('inv-cust-sel'); if(f) f.focus(); }, 150);
  },

  saveNew: function(){
    var custId=getVal('inv-cust-sel'), custs=Customers.getData(), cust=custs.find(function(x){return x.id===custId;})||{};
    if(!custId){ App.toast('Customer छान्नुस्!','error'); return; }
    var items=this._rows.filter(function(r){ return (r.name||'').trim()||r.rate; })
      .map(function(r){ return {name:(r.name||'').trim(),qty:parseFloat(r.qty)||0,unit:r.unit||'',rate:parseFloat(r.rate)||0,amount:(parseFloat(r.qty)||0)*(parseFloat(r.rate)||0)}; });
    if(!items.length){ App.toast('कम्तिमा १ item राख्नुस्!','error'); return; }
    // guard: at least one item must have a real amount
    var anyAmt=items.some(function(x){ return x.amount>0; });
    if(!anyAmt){ App.toast('कम्तिमा १ item को रकम (qty × rate) हुनुपर्छ!','error'); return; }
    // duplicate invoice number check (ignore the invoice being edited)
    var invNumVal=(getVal('inv-num-inp')||'').trim();
    if(invNumVal){
      var dupe=this.getData().some(function(x){ return x.id!==(Invoices._editId||null) && String(x.invNum||'').trim().toLowerCase()===invNumVal.toLowerCase(); });
      if(dupe){ if(!confirm('Invoice नम्बर "'+invNumVal+'" पहिल्यै छ। फेरि प्रयोग गर्ने?')) return; }
    }
    var t=this.calc();
    var adDate=getVal('inv-date-inp')||todayISO();
    var bsDate='';
    try{ var p=adDate.split('-'); var b=adToBs(parseInt(p[0]),parseInt(p[1]),parseInt(p[2])); bsDate=b.y+'-'+String(b.m).padStart(2,'0')+'-'+String(b.d).padStart(2,'0'); }catch(e){ bsDate=(typeof todayBs==='function')?todayBs():''; }
    var _manualBs=getVal('inv-date-bs-inp'); if(_manualBs && _manualBs.trim()) bsDate=_manualBs.trim();

    var rec={
      id: this._editId || uid(),
      invNum: getVal('inv-num-inp')||this.nextNum(),
      custId: custId, custName: cust.name||'', custPhone: cust.phone||'',
      items: items,
      subtotal: t.sub, discP: t.discP, discAmt: t.discAmt, taxP: t.taxP, taxAmt: t.taxAmt,
      amount: t.grand,                       // grand total — legacy field kept in sync
      paid: t.paid, balance: t.bal,
      status: getVal('inv-status-inp')||'Pending',
      dueDate: getVal('inv-due-inp')||'',
      terms: getVal('inv-terms-inp')||'',
      desc: items.map(function(r){return r.name;}).filter(Boolean).slice(0,3).join(', '),  // legacy summary
      date: adDate, dateBs: bsDate
    };

    var list=this.getData();
    if(this._editId){
      var idx=list.findIndex(function(x){return x.id===rec.id;});
      if(idx>=0){ rec.created=list[idx].created; list[idx]=rec; }
      else list.unshift(rec);
      Audit.log('INVOICE','Updated: '+rec.invNum);
    } else {
      rec.created=new Date().toISOString();
      list.unshift(rec);
      Audit.log('INVOICE','Created: '+rec.invNum+' '+cust.name);
      try{ Activity.add('🧾 Invoice created: '+rec.invNum+' — '+cust.name); }catch(e){}
    }
    STORE.set('pk3_invoices',list);
    App.toast(this._editId?'✅ Invoice updated!':'✅ Invoice saved!','success');
    this._editId=null; this._rows=[];
    document.getElementById('inv-edit-modal').classList.remove('open');
    this.render();
  },

  render: function(){
    var list=this.getData(), q=getVal('inv-search').toLowerCase();
    // auto-flag overdue (unpaid + past due date)
    var today=new Date().toISOString().slice(0,10);
    list.forEach(function(i){
      if(i.dueDate && (parseFloat(i.balance)||0)>0.5 && i.status!=='Paid' && i.status!=='Cancelled' && i.dueDate<today){
        i._overdue=true;
      } else i._overdue=false;
    });
    if(q) list=list.filter(function(i){return (i.custName+i.invNum+(i.desc||'')).toLowerCase().indexOf(q)>=0;});
    var tb=document.getElementById('inv-table'), ne=document.getElementById('no-inv');
    if(!tb) return;
    if(!list.length){tb.innerHTML='';if(ne)ne.style.display='';return;} if(ne)ne.style.display='none';
    var sc={'Pending':'tag-yellow','Partial':'tag-blue','Paid':'tag-green','Overdue':'tag-red','Cancelled':'tag-gray'};
    tb.innerHTML=list.map(function(i){
      if(Invoices.isCancelled(i)) return Invoices._cancelledRow(i);
      var bal = i.balance!=null ? i.balance : ((parseFloat(i.amount)||0)-(parseFloat(i.paid)||0));
      var stt = i._overdue ? 'Overdue' : (i.status||'Pending');
      var due = i.dueDate ? '<div style="font-size:0.66rem;color:'+(i._overdue?'var(--red)':'var(--text-muted)')+';">Due: '+fmtDisplayDate(i.dueDate)+'</div>' : '';
      return '<tr style="cursor:pointer;"'
        +' onclick="Invoices.preview(\''+i.id+'\')">'
        +'<td style="font-weight:700;">'+esc(i.invNum||'')+due+'</td>'
        +'<td>'+esc(i.custName||'')+'<div style="font-size:0.7rem;color:var(--text-muted);">'+esc(i.custPhone||'')+'</div></td>'
        +'<td style="font-size:0.76rem;">'+esc(i.desc||'—')+(i.fromQuote?'<div><span class="tag tag-blue" style="font-size:0.56rem;">📋 '+(i.fromQuote.type==='estimate'?'Estimate':'Quotation')+' बाट</span></div>':'')+'</td>'
        +'<td style="text-align:right;white-space:nowrap;">'+fmtRs(i.amount||0)+'</td>'
        +'<td style="text-align:right;color:var(--green);white-space:nowrap;">'+fmtRs(i.paid||0)+'</td>'
        +'<td style="text-align:right;font-weight:700;color:'+(bal>0?'var(--red)':'var(--green)')+';white-space:nowrap;">'+fmtRs(bal)+'</td>'
        +'<td><span class="tag '+(sc[stt]||'tag-gray')+'">'+stt+'</span>'+(i._returned?' <span class="tag tag-gray" style="font-size:0.56rem;">↩️ Returned</span>':'')+'</td>'
        +'<td style="font-size:0.72rem;color:var(--text-muted);">'+(i.dateBs?bsStringToDisplay(i.dateBs):fmtDisplayDate(i.date))+'</td>'
        +'<td><div class="btn-group"><button onclick="event.stopPropagation();Invoices.edit(\''+i.id+'\')" class="btn btn-xs btn-secondary">✏️</button>'
          +'<button onclick="event.stopPropagation();SalesReturns.open(\'invoice\',\''+i.id+'\')" class="btn btn-xs" style="background:#7f1d1d;color:#fff;" title="Return / Refund">↩️</button>'
          +'<button onclick="event.stopPropagation();Invoices.cancelModal(\''+i.id+'\')" class="btn btn-xs" data-inv-cancel="'+esc(i.id)+'" style="background:var(--red);color:#fff;" title="Cancel Invoice / बिल रद्द">❌</button></div></td>'
        +'</tr>';
    }).join('');
  },

  // v6.9.0: professional print/PDF layout with Payment QR (DocPrint)
  preview: function(id){
    var inv=this.getData().find(function(x){return x.id===id;}); if(!inv)return;
    this._curPreviewId = id;
    var cxl=this.isCancelled(inv);
    DocPrint.preview(DocPrint.fromInvoice(inv), '🧾 Invoice '+(inv.invNum||'')+(cxl?' — ❌ CANCELLED':''), cxl ? [] : [
      { label:'✏️ Edit', onClick:function(){ document.getElementById('view-modal').classList.remove('open'); Invoices.edit(id); } },
      { label:'📱 WhatsApp', cls:'btn-wa', onClick:function(){ Invoices.shareWA(id); } },
      { label:'❌ Cancel Invoice', cls:'btn-danger', id:'inv-prev-cancel', onClick:function(){ document.getElementById('view-modal').classList.remove('open'); Invoices.cancelModal(id); } }
    ]);
  },

  // v7.1.0: a real invoice is never deleted (bill numbers must stay unbroken) — it is cancelled with a reason.
  // Only sample/demo invoices can still be deleted.
  del: function(id){
    var inv=this.getData().find(function(x){ return x.id===id; }); if(!inv) return;
    if(!inv._demo){ App.toast('ℹ️ बिल नम्बर नटुटोस् भनेर Invoice delete हुँदैन — कारणसहित Cancel गर्नुहोस्','warning',3500); return this.cancelModal(id); }
    return this._hardDelete(id);
  },
  _hardDelete: function(id){ if(!confirm('Invoice delete गर्ने?'))return; STORE.set('pk3_invoices',this.getData().filter(function(x){return x.id!==id;})); try{ QuoteConvert.onInvoiceDeleted(id); }catch(e){} Audit.log('INVOICE','Deleted'); this.render(); App.toast('Invoice deleted','info'); },

  // ═══ v7.1.0: Invoice Cancel (बिल रद्द) + Credit Note — audit safe ═══
  // • Number stays used (nextNum scans every invoice, cancelled too), record stays in history with a CANCELLED badge.
  // • Reason is mandatory. Original totals are kept in inv.cancelled for the audit trail.
  // • Customer Ledger: if the invoice posted ledger lines (_inv), a Credit Note line reverses the sale;
  //   an optional refund of the paid amount posts a ledger debit + Day Book "Sales Return" entry.
  isCancelled: function(inv){ return !!inv && (inv.status==='Cancelled' || !!inv.cancelled); },
  active: function(list){ var self=this; return (list||this.getData()).filter(function(i){ return i && !self.isCancelled(i); }); },

  cancel: function(id, reason, opts){
    opts=opts||{};
    reason=String(reason||'').trim();
    if(reason.length<3) throw new Error('रद्द गर्नुको कारण अनिवार्य छ (कम्तिमा ३ अक्षर)');
    var list=this.getData(), inv=list.find(function(x){ return x.id===id; });
    if(!inv) throw new Error('Invoice भेटिएन');
    if(this.isCancelled(inv)) throw new Error('यो बिल पहिल्यै रद्द भइसकेको छ');
    var amount=parseFloat(inv.amount)||0, paid=parseFloat(inv.paid)||0;
    var bal=(inv.balance!=null&&inv.balance!=='') ? (parseFloat(inv.balance)||0) : amount-paid;
    var refund=!!opts.refund && paid>0;
    var now=new Date().toISOString(), by=(window.currentUser&&currentUser.name)||'system';
    var today=(typeof Staff!=='undefined'&&Staff._today) ? Staff._today() : todayISO(), todayB=(typeof todayBs==='function')?todayBs():'';
    inv.cancelled={ at: now, by: by, reason: reason, prevStatus: inv.status||'Pending', amount: amount, paid: paid, balance: bal, refund: refund };
    inv.status='Cancelled';
    inv.balance=0;
    // Customer Ledger adjustment
    var led=STORE.get('pk3_ledger',[])||[];
    var mine=led.filter(function(t){ return t && t._inv===id; });
    var base={ customerId: inv.custId, custName: inv.custName, date: todayB, dateAd: today, _inv: id, created: now };
    if(mine.length){
      var sale=mine.reduce(function(t,x){ return t+(x._cn?0:(parseFloat(x.debit)||0)); },0);
      if(sale>0){
        var cn=Object.assign({ id:'lx_'+uid(), narration:'❌ Credit Note — '+inv.invNum+' रद्द ('+reason+')', debit:0, credit:sale, _cn:true }, base);
        cn.desc=cn.narration; led.push(cn);
      }
    }
    if(refund){
      if(mine.length){
        var rf=Object.assign({ id:'lx_'+uid(), narration:'↩️ रकम फिर्ता — '+inv.invNum+' (रद्द)', debit:paid, credit:0, _cn:true }, base);
        rf.desc=rf.narration; led.push(rf);
      }
      var db=STORE.get('pk3_daybook',[])||[];
      inv.cancelled.dbId=uid();
      db.unshift({ id:inv.cancelled.dbId, type:'return', amount:paid, desc:'↩️ बिल रद्द, रकम फिर्ता — '+inv.invNum+' '+(inv.custName||''), cat:'Sales Return',
        date:today, dateBs:todayB, user:by, _invCancel:id });
      STORE.set('pk3_daybook', db);
    }
    if(mine.length || refund) STORE.set('pk3_ledger', led);
    STORE.set('pk3_invoices', list);
    // free the source quotation / estimate so it can be converted again (the cancelled bill stays in history)
    [['pk3_quotations'],['pk3_estimates']].forEach(function(k){
      var l=STORE.get(k[0],[])||[], ch=false;
      l.forEach(function(x){ if(x && x.convertedInvId===id){ delete x.convertedInvId; delete x.convertedInvNum; delete x.convertedAt; ch=true; } });
      if(ch) STORE.set(k[0], l);
    });
    try { Audit.log('INVOICE','Cancelled: '+inv.invNum+' '+(inv.custName||'')+' '+fmtRs(amount)+' — कारण: '+reason); } catch(e){}
    try { Activity.add('❌ Invoice cancelled: '+inv.invNum+' — '+reason); } catch(e){}
    return inv;
  },

  cancelModal: function(id){
    var inv=this.getData().find(function(x){ return x.id===id; }); if(!inv) return;
    if(this.isCancelled(inv)){ App.toast('यो बिल पहिल्यै रद्द भइसकेको छ','info'); return; }
    var paid=parseFloat(inv.paid)||0;
    var m=document.getElementById('inv-cxl-modal');
    if(!m){
      m=document.createElement('div'); m.className='modal-overlay'; m.id='inv-cxl-modal';
      m.innerHTML='<div class="modal" style="max-width:480px;"><div class="modal-head"><div class="modal-title">❌ Cancel Invoice / बिल रद्द</div><button class="modal-close" onclick="document.getElementById(\'inv-cxl-modal\').classList.remove(\'open\')">✕</button></div><div id="inv-cxl-body"></div></div>';
      document.body.appendChild(m);
    }
    document.getElementById('inv-cxl-body').innerHTML=
      '<div style="font-size:0.84rem;line-height:1.6;margin-bottom:10px;"><b>'+esc(inv.invNum||'')+'</b> — '+esc(inv.custName||'')+'<br>Total '+fmtRs(inv.amount||0)+' • Paid '+fmtRs(paid)+'</div>'
      +'<div style="font-size:0.74rem;background:var(--yellow-soft);color:var(--text);padding:8px 10px;border-radius:8px;margin-bottom:10px;">ℹ️ बिल मेटिँदैन — CANCELLED ब्याजसहित इतिहासमा रहन्छ र बिल नम्बर क्रम टुट्दैन। Customer Ledger को बाँकी स्वतः मिलाइन्छ।</div>'
      +'<div class="form-group"><label>रद्द गर्नुको कारण * (अनिवार्य)</label><textarea id="inv-cxl-reason" style="min-height:60px;" placeholder="उदा: ग्राहकले अर्डर रद्द गर्नुभयो / गलत बिल बन्यो"></textarea></div>'
      +(paid>0?'<label style="display:flex;gap:8px;align-items:center;font-size:0.8rem;margin-bottom:10px;cursor:pointer;text-transform:none;letter-spacing:0;"><input type="checkbox" id="inv-cxl-refund"> भुक्तानी भएको '+fmtRs(paid)+' ग्राहकलाई फिर्ता दिइयो (Day Book मा Return दर्ता हुन्छ)</label>':'')
      +'<div class="form-actions"><button class="btn btn-secondary" onclick="document.getElementById(\'inv-cxl-modal\').classList.remove(\'open\')">पछाडि</button>'
      +'<button class="btn btn-danger" id="inv-cxl-confirm" onclick="Invoices.confirmCancel(\''+id+'\')">❌ बिल रद्द गर्नुस्</button></div>';
    m.classList.add('open');
    setTimeout(function(){ var r=document.getElementById('inv-cxl-reason'); if(r) r.focus(); }, 100);
  },
  confirmCancel: function(id){
    var rf=document.getElementById('inv-cxl-refund');
    try { var inv=this.cancel(id, getVal('inv-cxl-reason'), { refund: !!(rf&&rf.checked) }); }
    catch(e){ App.toast(e.message,'error'); var r=document.getElementById('inv-cxl-reason'); if(r) r.focus(); return; }
    document.getElementById('inv-cxl-modal').classList.remove('open');
    App.toast('❌ '+inv.invNum+' रद्द भयो — रेकर्ड इतिहासमा सुरक्षित छ','success',3500);
    this.render();
    try { if(App.currentPage==='ledger') Ledger.render(); } catch(e){}
  },
  _cancelledRow: function(i){
    var c=i.cancelled||{}, amt=c.amount!=null?c.amount:(parseFloat(i.amount)||0);
    var tip='रद्द: '+(c.reason||'—')+(c.at?' • '+String(c.at).slice(0,10):'')+(c.by?' • '+c.by:'');
    return '<tr class="inv-cancelled" data-inv-id="'+esc(i.id)+'" style="cursor:pointer;opacity:0.7;" onclick="Invoices.preview(\''+i.id+'\')">'
      +'<td style="font-weight:700;text-decoration:line-through;">'+esc(i.invNum||'')+'</td>'
      +'<td>'+esc(i.custName||'')+'<div style="font-size:0.7rem;color:var(--text-muted);">'+esc(i.custPhone||'')+'</div></td>'
      +'<td style="font-size:0.74rem;color:var(--red);">❌ '+esc(c.reason||'Cancelled')+'</td>'
      +'<td style="text-align:right;white-space:nowrap;text-decoration:line-through;">'+fmtRs(amt)+'</td>'
      +'<td style="text-align:right;color:var(--text-muted);white-space:nowrap;">'+fmtRs(i.paid||0)+'</td>'
      +'<td style="text-align:right;white-space:nowrap;">'+fmtRs(0)+'</td>'
      +'<td><span class="tag tag-red" title="'+esc(tip)+'">CANCELLED</span>'+(c.refund?' <span class="tag tag-gray" style="font-size:0.56rem;">↩️ फिर्ता</span>':'')+'</td>'
      +'<td style="font-size:0.72rem;color:var(--text-muted);">'+(i.dateBs?bsStringToDisplay(i.dateBs):fmtDisplayDate(i.date))+'</td>'
      +'<td></td></tr>';
  },

  shareWA: function(id){
    var inv = this.getData().find(function(x){ return x.id===id; });
    if(!inv){ App.toast('Invoice not found','error'); return; }
    var co = STORE.get('pk3_settings',{})||{};
    var bal = inv.balance != null ? inv.balance : ((parseFloat(inv.amount)||0)-(parseFloat(inv.paid)||0));
    var itemLines = (Array.isArray(inv.items)?inv.items:[]).map(function(r){ return '• '+(r.name||'')+' — '+(r.qty||0)+(r.unit?' '+r.unit:'')+' × '+fmtRs(r.rate||0)+' = '+fmtRs((parseFloat(r.qty)||0)*(parseFloat(r.rate)||0)); }).join('\n');
    var msg = '*🧾 Invoice '+(inv.invNum||'')+'*\n'
      + Company.name()+'\n\n'
      + 'Customer: '+(inv.custName||'')+'\n'
      + (itemLines?itemLines+'\n\n':'')
      + 'Total: '+fmtRs(inv.amount||0)+'\n'
      + 'Paid: '+fmtRs(inv.paid||0)+'\n'
      + 'Balance Due: '+fmtRs(bal)+'\n'
      + 'Status: '+(inv.status||'Pending')
      + (inv.dueDate?'\nDue Date: '+fmtDisplayDate(inv.dueDate):'')
      + (co.esewa?'\n\neSewa: '+co.esewa:'')
      + (co.bankName?'\nBank: '+co.bankName+' - '+(co.bankAcc||''):'');
    if(typeof Wa!=='undefined' && Wa.send){ Wa.send(inv.custPhone, msg); }
    else { var p=(inv.custPhone||'').replace(/[^0-9]/g,''); window.open('https://wa.me/'+(p?'977'+p:'')+'?text='+encodeURIComponent(msg),'_blank'); }
  },

  print: function(id){
    var inv = this.getData().find(function(x){ return x.id===(id || Invoices._curPreviewId); });
    if(inv) return DocPrint.print(DocPrint.fromInvoice(inv), 'Invoice '+(inv.invNum||''));
    window.print();
  }
};

