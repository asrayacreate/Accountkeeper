// ─── DAYBOOK MODULE ───────────────────────────────────────────
var DayBook = {
  _filter: 'today',
  getData: function(){ return STORE.get('pk3_daybook',[])||[]; },
  nextVoucherNo: function(type, dateBs, list){
    list = list || this.getData();
    var yr = (dateBs && dateBs.slice(0,4)) || (todayBs().slice(0,4));
    var pre = (type==='income') ? 'INC' : 'EXP';
    var stem = pre+'-'+yr+'-';
    var max = 0;
    list.forEach(function(e){
      if(e && e.voucherNo && e.voucherNo.indexOf(stem)===0){
        var n = parseInt(e.voucherNo.slice(stem.length),10);
        if(!isNaN(n) && n>max) max=n;
      }
    });
    var num = String(max+1); while(num.length<4) num='0'+num;
    return stem+num;
  },
  backfillVouchers: function(){
    var list = this.getData(); var changed=false;
    var sorted = list.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    sorted.forEach(function(e){ if(e && !e.voucherNo){ e.voucherNo=DayBook.nextVoucherNo(e.type,e.dateBs,list); changed=true; } });
    if(changed) STORE.set('pk3_daybook', list);
  },
  setFilter: function(f){
    this._filter=f;
    ['today','week','month','all'].forEach(function(x){var b=document.getElementById('db-f-'+x);if(b)b.className='btn btn-sm btn-'+(x===f?'primary':'secondary');});
    this.render();
  },
  addModal: function(){
    var id=document.getElementById('db-edit-id'); if(id)id.value='';
    setVal('db-type','income'); setVal('db-amount',''); setVal('db-desc',''); setVal('db-cat',''); setVal('db-notes',''); setVal('db-vendor',''); setVal('db-bill',''); setVal('db-pay','Cash');
    setVal('db-date-inp',''); setText('db-date-inp-text','📅 मिति...');
    setText('db-modal-title','📒 Add Entry');
    this._photos = []; this._renderPhotos();
    try { Projects.fillSelect(''); } catch(e){}
    document.getElementById('db-modal').classList.add('open');
    setTimeout(function(){var a=document.getElementById('db-amount');if(a)a.focus();},200);
  },
  save: function(){
    var amount=parseFloat(getVal('db-amount')||0); if(!amount){App.toast('Amount छान्नुस्!','error');return;}
    var desc=getVal('db-desc'); if(!desc){App.toast('Description लेख्नुस्!','error');return;}
    var editId=getVal('db-edit-id'); var isEdit=!!editId; var id=editId||uid();
    var dateInp=getVal('db-date-inp')||todayBs(); var dateAd=todayISO();
    if(dateInp){try{var p=dateInp.split('-');var ad=bsToAd(parseInt(p[0]),parseInt(p[1]),parseInt(p[2]));dateAd=isoLocal(ad);}catch(e){}}
    var rec={id:id,type:getVal('db-type'),amount:amount,desc:desc,cat:getVal('db-cat'),vendor:getVal('db-vendor'),bill:getVal('db-bill'),pay:getVal('db-pay'),notes:getVal('db-notes'),date:dateAd,dateBs:dateInp||todayBs(),user:currentUser?currentUser.name:''};
    var _pj=getVal('db-project'); if(_pj) rec.projectId=_pj;
    if(this._photos && this._photos.length) rec.photoIds=this._photos.slice();   // v7.0.0 bill receipt photos
    var list=this.getData();
    if(isEdit){ var _old=list.find(function(x){return x.id===id;}); if(_old && _old._payable) rec._payable=_old._payable; }
    if(isEdit){ var _o=list.find(function(x){return x.id===id;}); rec.voucherNo=(_o&&_o.voucherNo)||DayBook.nextVoucherNo(rec.type,rec.dateBs,list); }
    else { rec.voucherNo=DayBook.nextVoucherNo(rec.type,rec.dateBs,list); }
    if(isEdit){var idx=list.findIndex(function(x){return x.id===id;});if(idx>=0)list[idx]=rec;else list.unshift(rec);}
    else list.unshift(rec);
    STORE.set('pk3_daybook',list);
    Audit.log('DAYBOOK',(isEdit?'Edited':'Added')+': '+desc+' Rs.'+amount);
    Activity.add((rec.type==='income'?'💰':'💸')+' '+rec.type+': '+desc+' — '+fmtRs(amount));
    App.toast('✅ Entry saved!','success');
    document.getElementById('db-modal').classList.remove('open');
    var _ts=document.getElementById('db-type'); if(_ts && _ts.parentElement) _ts.parentElement.style.display='';
    this.render();
    try { if(window.Expenses) Expenses.render(); } catch(e){}
    try { if(window.CashBook) CashBook.render(); } catch(e){}
  },
  render: function(){
    var list=this.getData(); var today=todayISO(); var week=new Date(); week.setDate(week.getDate()-7);
    if(this._filter==='today') list=list.filter(function(e){return e.date===today;});
    else if(this._filter==='week') list=list.filter(function(e){return e.date>=isoLocal(week);});
    else if(this._filter==='month') list=list.filter(function(e){return e.date&&e.date.slice(0,7)===today.slice(0,7);});
    var cf=getVal('db-cat-filter')||'';
    if(cf) list=list.filter(function(e){return e.cat===cf;});
    var inc=list.filter(function(e){return e.type==='income';}).reduce(function(s,e){return s+e.amount;},0);
    var exp=list.filter(function(e){return e.type==='expense';}).reduce(function(s,e){return s+e.amount;},0);
    var ret=list.filter(function(e){return e.type==='return';}).reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    setText('db-tot-i',fmtRs(inc)); setText('db-tot-e',fmtRs(exp));
    var net=inc-exp-ret; var netEl=document.getElementById('db-tot-net'); if(netEl){netEl.textContent=fmtRs(net); netEl.style.color=net>=0?'var(--green)':'var(--red)';}
    var tb=document.getElementById('db-table'), ne=document.getElementById('no-db');
    if(!list.length){tb.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    tb.innerHTML=list.map(function(e){return '<tr><td style="font-size:0.78rem;">'+(e.dateBs?bsStringToDisplay(e.dateBs):fmtDisplayDate(e.date))+'</td><td><span class="tag '+(e.type==='income'?'tag-green':'tag-red')+'">'+e.type+'</span></td><td style="font-size:0.78rem;">'+(e.cat||'—')+'</td><td style="font-size:0.82rem;">'+e.desc+'</td><td style="text-align:right;font-weight:700;color:'+(e.type==='income'?'var(--green)':'var(--red)')+';">'+fmtRs(e.amount)+'</td><td><div class="btn-group"><button onclick="DayBook.del(\''+e.id+'\')" class="btn btn-xs btn-danger">🗑</button></div></td></tr>';}).join('');
  },
  del: function(id){ if(!confirm('Delete?'))return; STORE.set('pk3_daybook',this.getData().filter(function(x){return x.id!==id;})); this.render(); App.toast('🗑 Deleted','info'); },
  // ── v7.0.0: bill / receipt photo (compressed) ──
  _photos: [],
  _renderPhotos: function(){ var b=document.getElementById('db-photos'); if(b){ b.innerHTML=Media.thumbs(this._photos,'DayBook._delPhoto'); Media.hydrate(b); } },
  addPhoto: function(){ var self=this; Media.pick({kind:'receipt',label:'Expense bill'},true).then(function(r){ r.forEach(function(x){ self._photos.push(x.id); }); self._renderPhotos(); }); },
  _delPhoto: function(id){ this._photos=this._photos.filter(function(x){ return x!==id; }); this._renderPhotos(); },
  edit: function(id){
    var e=this.getData().find(function(x){return x.id===id;});
    if(!e){ App.toast('Entry भेटिएन','error'); return; }
    setVal('db-edit-id',id);
    this._photos = (e.photoIds||[]).slice(); this._renderPhotos();
    setVal('db-type',e.type||'expense');
    setVal('db-amount',e.amount||'');
    setVal('db-desc',e.desc||'');
    setVal('db-cat',e.cat||'');
    setVal('db-vendor',e.vendor||'');
    setVal('db-bill',e.bill||'');
    setVal('db-pay',e.pay||'Cash');
    setVal('db-notes',e.notes||'');
    setVal('db-date-inp',e.dateBs||'');
    setText('db-date-inp-text', e.dateBs?bsStringToDisplay(e.dateBs):'📅 मिति...');
    setText('db-modal-title', (e.type==='income'?'📥 Sale सम्पादन':'📤 Expense सम्पादन'));
    try { Projects.fillSelect(e.projectId||''); } catch(err){}
    // show type selector when editing from generic Day Book; keep hidden nuance simple: always show on edit
    var _ts=document.getElementById('db-type'); if(_ts && _ts.parentElement) _ts.parentElement.style.display='';
    document.getElementById('db-modal').classList.add('open');
  },
  toggleExpenseFields: function(){
    var isExp = getVal('db-type')==='expense';
    ['db-vendor-grp','db-bill-grp','db-pay-grp'].forEach(function(g){
      var el=document.getElementById(g); if(el) el.style.display = isExp ? '' : 'none';
    });
  },
  print: function(){ window.print(); },
  // Professional voucher print (Book Keeper–style, single-entry) — for any income/expense entry
  printVoucher: function(id){
    var e = this.getData().find(function(x){return x.id===id;});
    if(!e){ App.toast('Entry भेटिएन','error'); return; }
    var co = STORE.get('pk3_settings', {}) || {};
    var cName = Company.name('');
    var cAddr = co.address || '';
    var cPhone = co.phone || '';
    var cPan = co.pan || co.vat || '';
    var isInc = e.type==='income';
    var vNo = e.voucherNo || (isInc?'INC':'EXP')+'-'+(e.dateBs?e.dateBs.slice(0,4):'') + '-—';
    var vType = isInc ? 'RECEIPT / आम्दानी भौचर' : 'PAYMENT / खर्च भौचर';
    var dAd = e.date || todayISO();
    var dBs = e.dateBs ? bsStringToDisplay(e.dateBs) : '';
    var party = e.vendor || (isInc?'—':'—');
    var partyLabel = isInc ? 'Received From / बाट प्राप्त' : 'Paid To / प्रापक';
    var amt = parseFloat(e.amount)||0;
    var amtWords = (typeof numToWords==='function') ? numToWords(amt) : '';

    var html = '<html><head><title>Voucher '+esc(vNo)+'</title><meta charset="utf-8">'
      + '<style>@page{margin:14mm;}'
      + 'body{font-family:Arial,"Noto Sans Devanagari",sans-serif;color:#111;margin:0;}'
      + '.v-wrap{max-width:720px;margin:0 auto;border:2px solid #222;padding:0;}'
      + '.v-head{text-align:center;padding:16px 18px 10px;border-bottom:2px solid #222;}'
      + '.v-co{font-size:20px;font-weight:800;letter-spacing:.5px;}'
      + '.v-sub{font-size:12px;color:#444;margin-top:3px;}'
      + '.v-title{margin-top:10px;display:inline-block;border:1.5px solid #222;border-radius:4px;padding:4px 16px;font-size:13px;font-weight:700;letter-spacing:.5px;}'
      + '.v-meta{display:flex;justify-content:space-between;padding:12px 18px;font-size:13px;border-bottom:1px dashed #999;}'
      + '.v-meta div{line-height:1.7;}'
      + '.v-label{color:#666;font-size:11px;}'
      + '.v-body{padding:14px 18px;}'
      + '.v-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee;font-size:13px;}'
      + '.v-amt-box{margin-top:14px;border:1.5px solid #222;border-radius:6px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:#f7f7f7;}'
      + '.v-amt-box .lbl{font-size:12px;color:#555;}'
      + '.v-amt-box .val{font-size:22px;font-weight:800;}'
      + '.v-words{font-size:12px;font-style:italic;color:#444;margin-top:6px;}'
      + '.v-narr{margin-top:14px;font-size:12px;}'
      + '.v-narr .lbl{color:#666;font-size:11px;display:block;margin-bottom:2px;}'
      + '.v-sign{display:flex;justify-content:space-between;margin-top:46px;padding:0 18px 18px;}'
      + '.v-sign div{text-align:center;font-size:12px;border-top:1px solid #333;padding-top:5px;width:170px;}'
      + '.v-foot{text-align:center;font-size:10px;color:#999;padding:8px;border-top:1px solid #ddd;}'
      + '</style></head><body>'
      + '<div class="v-wrap">'
      + '<div class="v-head"><div class="v-co">'+esc(cName)+'</div>'
      +   '<div class="v-sub">'+esc(cAddr)+(cPhone?' &nbsp;•&nbsp; '+esc(cPhone):'')+(cPan?' &nbsp;•&nbsp; PAN/VAT: '+esc(cPan):'')+'</div>'
      +   '<div class="v-title">'+esc(vType)+'</div></div>'
      + '<div class="v-meta">'
      +   '<div><span class="v-label">Voucher No</span><br><b>'+esc(vNo)+'</b></div>'
      +   '<div style="text-align:right;"><span class="v-label">Date</span><br><b>'+esc(dBs||dAd)+'</b>'+(dBs?'<br><span style="font-size:11px;color:#777;">'+esc(dAd)+' (AD)</span>':'')+'</div>'
      + '</div>'
      + '<div class="v-body">'
      +   '<div class="v-row"><span class="v-label">'+esc(partyLabel)+'</span><b>'+esc(party)+'</b></div>'
      +   '<div class="v-row"><span class="v-label">Category / शीर्षक</span><span>'+esc(e.cat||'—')+'</span></div>'
      +   (e.bill?'<div class="v-row"><span class="v-label">Bill / रसिद नं</span><span>'+esc(e.bill)+'</span></div>':'')
      +   '<div class="v-row"><span class="v-label">Payment Mode / भुक्तानी</span><span>'+esc(e.pay||'Cash')+'</span></div>'
      +   '<div class="v-row"><span class="v-label">Particulars / विवरण</span><b>'+esc(e.desc||'—')+'</b></div>'
      +   '<div class="v-amt-box"><span class="lbl">'+(isInc?'Amount Received / प्राप्त रकम':'Amount Paid / भुक्तानी रकम')+'</span><span class="val">'+fmtRs(amt)+'</span></div>'
      +   (amtWords?'<div class="v-words">In words: '+esc(amtWords)+'</div>':'')
      +   (e.notes?'<div class="v-narr"><span class="lbl">Narration / कैफियत</span>'+esc(e.notes)+'</div>':'')
      + '</div>'
      + '<div class="v-sign"><div>Prepared by</div><div>Authorized Signature</div></div>'
      + '<div class="v-foot">Swagatik • '+esc(cName)+'</div>'
      + '</div></body></html>';

    var w = window.open('', '_blank');
    if(!w){ App.toast('Popup blocked — allow popups','error'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(function(){ try{ w.print(); }catch(e){} }, 400);
  },
  // Real WA share (v5.1): sends the current filter's income/expense/net summary
  shareWA: function(){
    var co = STORE.get('pk3_settings',{})||{};
    var list = STORE.get('pk3_daybook',[])||[];
    var today = todayISO();
    var week = new Date(); week.setDate(week.getDate()-7);
    if(this._filter==='today') list=list.filter(function(e){return e.date===today;});
    else if(this._filter==='week') list=list.filter(function(e){return e.date>=isoLocal(week);});
    else if(this._filter==='month') list=list.filter(function(e){return e.date&&e.date.slice(0,7)===today.slice(0,7);});
    var inc = list.filter(function(e){return e.type==='income';}).reduce(function(s,e){return s+parseFloat(e.amount||0);},0);
    var exp = list.filter(function(e){return e.type==='expense';}).reduce(function(s,e){return s+parseFloat(e.amount||0);},0);
    var net = inc-exp;
    var fl = {today:'आज',week:'७ दिन',month:'यो महिना',all:'सबै'}[this._filter]||this._filter;
    var msg = '*📒 Day Book — '+fl+'*\n'
      + Company.name()+'\n'
      + '━━━━━━━━━━━━━━━\n'
      + '💰 Income: '+fmtRs(inc)+'\n'
      + '💸 Expense: '+fmtRs(exp)+'\n'
      + '📊 Net '+(net>=0?'Profit':'Loss')+': '+fmtRs(Math.abs(net))+'\n'
      + '🧾 Entries: '+list.length;
    if(typeof Wa!=='undefined'&&Wa.send) Wa.send('', msg);
    else window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
  }
};

