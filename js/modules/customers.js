// ─── CUSTOMERS MODULE ─────────────────────────────────────────
var Customers = {
  _edit: null,
  _dupId: null,
  getData: function() { return STORE.get('pk3_customers',[])||[]; },
  // ═══════════ MULTI-SERVICE ENGINE (v5.4) ═══════════
  // Data model: c.services = [{work:'UPVC', subwork:'UPVC Windows'}, ...]
  // पुरानो c.work / c.subwork पनि services[0] सँग sync भइरहन्छ — त्यसैले
  // पुराना सबै code (quotation, export, AI, dashboard) भाँचिँदैनन्।

  // कुनै पनि customer record बाट services array निकाल्ने — एउटै पढ्ने बाटो
  getServices: function (c) {
    if (!c) return [];
    if (Array.isArray(c.services) && c.services.length) {
      return c.services.filter(function (s) { return s && (s.work || s.subwork); });
    }
    if (c.work || c.subwork) return [{ work: c.work || '', subwork: c.subwork || '' }];
    return [];
  },

  // ─── Customer list मा service chip हरू (२ वटा + "+N") ───
  serviceChips: function (c) {
    var arr = this.getServices(c);
    if (!arr.length) return '<div style="font-size:0.82rem;color:var(--text-muted);">—</div>';
    var shown = arr.slice(0, 2), extra = arr.length - shown.length;
    var html = '<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;">';
    shown.forEach(function (x) {
      var label = x.work || x.subwork;
      html += '<span title="' + esc((x.work || '') + (x.subwork ? ' / ' + x.subwork : '')) + '" '
           +  'style="display:inline-block;font-size:0.68rem;background:rgba(249,115,22,0.12);'
           +  'border:1px solid rgba(249,115,22,0.3);color:var(--accent);border-radius:20px;'
           +  'padding:1px 8px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;">'
           +  esc(label) + '</span>';
    });
    if (extra > 0) {
      html += '<span style="font-size:0.68rem;color:var(--text-muted);font-weight:700;">+' + extra + '</span>';
    }
    html += '</div>';
    if (shown.length === 1 && shown[0].subwork) {
      html += '<div style="font-size:0.68rem;color:var(--text-muted);">' + esc(shown[0].subwork) + '</div>';
    }
    return html;
  },

  // ─── Detail modal मा एउटा line मा सबै service ───
  serviceLine: function (c) {
    var arr = this.getServices(c);
    if (!arr.length) return '—';
    return arr.map(function (x) {
      return esc(x.work || '') + (x.subwork ? ' <span style="color:var(--text-muted);">/ ' + esc(x.subwork) + '</span>' : '');
    }).join('<br>');
  },

  // ─── Quotation/Estimate लाई service छान्ने popup ───
  // एउटा मात्र service भए popup नआई सिधै callback चल्छ
  pickService: function (c, cb) {
    var arr = this.getServices(c);
    if (!arr.length) { cb({ work: '', subwork: '' }); return; }
    if (arr.length === 1) { cb(arr[0]); return; }

    var ov = document.getElementById('svc-pick-modal');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'svc-pick-modal';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;'
                       + 'display:flex;align-items:center;justify-content:center;padding:20px;';
      document.body.appendChild(ov);
    }
    ov.innerHTML = '';
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;'
                       + 'padding:20px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);';
    var head = document.createElement('div');
    head.innerHTML = '<div style="font-size:0.95rem;font-weight:800;margin-bottom:2px;">🔧 कुन service को हो?</div>'
                   + '<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:14px;">'
                   + esc(c.name || '') + ' सँग ' + arr.length + ' वटा service छन्</div>';
    card.appendChild(head);

    arr.forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:7px;padding:11px 13px;'
                      + 'background:var(--surface-2);border:1px solid var(--border);border-radius:10px;'
                      + 'color:var(--text);cursor:pointer;font-size:0.85rem;';
      b.innerHTML = '<b>' + esc(x.work || '—') + '</b>'
                  + (x.subwork ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + esc(x.subwork) + '</div>' : '');
      b.onmouseover = function () { b.style.borderColor = 'var(--accent)'; };
      b.onmouseout = function () { b.style.borderColor = 'var(--border)'; };
      b.onclick = function () { ov.remove(); cb(x); };
      card.appendChild(b);
    });

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-sm btn-secondary';
    cancel.style.cssText = 'width:100%;margin-top:6px;';
    cancel.textContent = '✕ रद्द';
    cancel.onclick = function () { ov.remove(); };
    card.appendChild(cancel);

    ov.appendChild(card);
  },

  // Service हरूलाई खोज/तुलनाको लागि एउटै string मा
  serviceText: function (c) {
    return this.getServices(c).map(function (s) {
      return (s.work || '') + ' ' + (s.subwork || '');
    }).join(' ');
  },

  // customer सँग दिइएको service छ कि छैन
  hasService: function (c, term) {
    if (!term) return false;
    return this.serviceText(c).toLowerCase().indexOf(String(term).toLowerCase()) >= 0;
  },

  // ─── Boot मा एक पटक मात्र migration ───────────────────────
  migrateServices: function () {
    try {
      if (STORE.get('pk3_services_migrated', false) === true) return;
      var list = this.getData(), changed = 0;
      list.forEach(function (c) {
        if (!c) return;
        if (!Array.isArray(c.services) || !c.services.length) {
          if (c.work || c.subwork) {
            c.services = [{ work: c.work || '', subwork: c.subwork || '' }];
            changed++;
          } else {
            c.services = [];
          }
        }
      });
      STORE.set('pk3_customers', list);
      STORE.set('pk3_services_migrated', true);
      // services[] migration done
    } catch (e) { console.warn('service migration failed', e); }
  },

  // ─── UI: service row हरू ──────────────────────────────────
  _rowSeq: 0,

  renderServiceRows: function (services) {
    var box = document.getElementById('c-services-list');
    if (!box) return;
    box.innerHTML = '';
    this._rowSeq = 0;
    var arr = (services && services.length) ? services : [{ work: '', subwork: '' }];
    var self = this;
    arr.forEach(function (s) { self.addServiceRow(s.work, s.subwork, true); });
    this.syncLegacyFields();
  },

  addServiceRow: function (work, subwork, silent) {
    var box = document.getElementById('c-services-list');
    if (!box) return;
    var n = this._rowSeq++;
    var row = document.createElement('div');
    row.className = 'svc-row';
    row.setAttribute('data-row', n);
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:10px;';

    // Main Service
    var d1 = document.createElement('div');
    d1.innerHTML = '<label style="font-size:0.7rem;color:var(--text-muted);display:block;margin-bottom:4px;">🔧 Main Service</label>';
    var selW = document.createElement('select');
    selW.className = 'svc-work';
    selW.style.cssText = 'width:100%;';
    selW.appendChild(new Option('-- Select Service --', ''));
    SERVICES_DATA.forEach(function (s) { selW.appendChild(new Option(s.name, s.name)); });
    // पुरानो record मा भएको तर list मा नभएको service भए थप्ने
    if (work && !SERVICES_MAP[work]) selW.appendChild(new Option(work + ' (पुरानो)', work));
    selW.value = work || '';
    d1.appendChild(selW);

    // Sub Service
    var d2 = document.createElement('div');
    d2.innerHTML = '<label style="font-size:0.7rem;color:var(--text-muted);display:block;margin-bottom:4px;">📌 Sub Service</label>';
    var selS = document.createElement('select');
    selS.className = 'svc-sub';
    selS.style.cssText = 'width:100%;';
    d2.appendChild(selS);
    var txtS = document.createElement('input');
    txtS.type = 'text'; txtS.className = 'svc-sub-text';
    txtS.placeholder = 'आफ्नै लेख्नुस्...';
    txtS.style.cssText = 'width:100%;margin-top:6px;display:none;';
    d2.appendChild(txtS);

    // Remove button
    var d3 = document.createElement('div');
    var rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'btn btn-xs btn-danger';
    rm.textContent = '✕'; rm.title = 'यो service हटाउने';
    rm.onclick = function () { Customers.removeServiceRow(row); };
    d3.appendChild(rm);

    row.appendChild(d1); row.appendChild(d2); row.appendChild(d3);
    box.appendChild(row);

    // wire events
    selW.addEventListener('change', function () {
      Customers.fillSubOptions(row);
      Customers.syncLegacyFields();
    });
    selS.addEventListener('change', function () {
      txtS.style.display = (selS.value === '__custom__') ? '' : 'none';
      Customers.showSubItems(row);
      Customers.syncLegacyFields();
    });
    txtS.addEventListener('input', function () { Customers.syncLegacyFields(); });

    this.fillSubOptions(row, subwork);
    this.updateRemoveButtons();
    if (!silent) this.syncLegacyFields();
    return row;
  },

  removeServiceRow: function (row) {
    var box = document.getElementById('c-services-list');
    if (!box) return;
    if (box.querySelectorAll('.svc-row').length <= 1) {
      // अन्तिम row हटाउने होइन — खाली मात्र गर्ने
      var w = row.querySelector('.svc-work'), s = row.querySelector('.svc-sub'), t = row.querySelector('.svc-sub-text');
      if (w) w.value = ''; if (t) { t.value = ''; t.style.display = 'none'; }
      this.fillSubOptions(row);
      this.syncLegacyFields();
      return;
    }
    row.remove();
    this.updateRemoveButtons();
    this.syncLegacyFields();
  },

  updateRemoveButtons: function () {
    var box = document.getElementById('c-services-list'); if (!box) return;
    var rows = box.querySelectorAll('.svc-row');
    rows.forEach(function (r) {
      var b = r.querySelector('button');
      if (b) b.style.opacity = rows.length <= 1 ? '0.4' : '1';
    });
  },

  // एउटा row को Sub Service dropdown भर्ने (पुरानो loadSubService को row version)
  fillSubOptions: function (row, preselect) {
    var selW = row.querySelector('.svc-work');
    var selS = row.querySelector('.svc-sub');
    var txtS = row.querySelector('.svc-sub-text');
    if (!selW || !selS) return;
    var work = selW.value;
    selS.innerHTML = '';
    selS.appendChild(new Option('-- Select Sub Service --', ''));

    if (!work) {
      // Main नछानेसम्म सबै sub group देखाउने
      SERVICES_DATA.forEach(function (s) {
        var g = document.createElement('optgroup'); g.label = s.name;
        s.subs.forEach(function (x) { g.appendChild(new Option(x, x)); });
        selS.appendChild(g);
      });
    } else {
      (SERVICES_MAP[work] || []).forEach(function (x) { selS.appendChild(new Option(x, x)); });
    }
    selS.appendChild(new Option('✏️ आफै लेख्नुस् (Custom)', '__custom__'));

    if (preselect) {
      var found = false;
      for (var i = 0; i < selS.options.length; i++) {
        if (selS.options[i].value === preselect) { found = true; break; }
      }
      if (found) {
        selS.value = preselect;
        if (txtS) txtS.style.display = 'none';
      } else {
        // custom / पुरानो sub — text box मा राख्ने
        selS.value = '__custom__';
        if (txtS) { txtS.value = preselect; txtS.style.display = ''; }
      }
    }
    this.showSubItems(row);
  },

  // Form बाट services array पढ्ने
  collectServices: function () {
    var box = document.getElementById('c-services-list');
    if (!box) return [];
    var out = [];
    box.querySelectorAll('.svc-row').forEach(function (r) {
      var w = (r.querySelector('.svc-work') || {}).value || '';
      var s = (r.querySelector('.svc-sub') || {}).value || '';
      var t = (r.querySelector('.svc-sub-text') || {}).value || '';
      if (s === '__custom__') s = t.trim();
      w = w.trim(); s = (s || '').trim();
      if (!w && !s) return;
      // duplicate जोडी नराख्ने
      var dup = out.some(function (o) { return o.work === w && o.subwork === s; });
      if (!dup) out.push({ work: w, subwork: s });
    });
    return out;
  },

  // hidden c-work / c-subwork लाई services[0] सँग मिलाउने
  syncLegacyFields: function () {
    var arr = this.collectServices();
    setVal('c-work', arr.length ? arr[0].work : '');
    setVal('c-subwork', arr.length ? arr[0].subwork : '');
    setVal('c-subwork-text', '');
  },

  save: function() {
    var name=getVal('c-name'), phone=getVal('c-phone');
    if(!name){ App.toast('नाम अनिवार्य छ!','error'); var ne=document.getElementById('c-name'); if(ne){ne.focus();ne.style.borderColor='var(--red)';setTimeout(function(){ne.style.borderColor='';},2000);} return; }
    var list=this.getData();
    var id=getVal('c-edit-id')||uid();
    var isEdit=!!getVal('c-edit-id');
    var adv=parseFloat(getVal('c-advance'))||0;
    // Safe photo read — element may not exist
    var photoEl=document.getElementById('c-photo-preview');
    var photo = (photoEl && photoEl.src && photoEl.src.indexOf('data:')===0) ? photoEl.src : (photoEl ? (photoEl.getAttribute('src')||'') : '');
    var _svcs = this.collectServices();
    var _w0 = _svcs.length ? _svcs[0].work : '';
    var _s0 = _svcs.length ? _svcs[0].subwork : '';
    var rec={id:id,name:name,phone:phone,address:getVal('c-address'),services:_svcs,work:_w0,subwork:_s0,notes:getVal('c-notes'),stage:getVal('c-stage'),sales:getVal('c-sales'),salesRole:getVal('c-sales-role'),advance:adv,total:parseFloat(getVal('c-total'))||0,issueDate:getVal('c-issue'),issueDateBs:getVal('c-issue-bs'),fuDate:getVal('c-fu'),fuDateBs:getVal('c-fu-bs'),birthday:getVal('c-bday'),birthdayBs:getVal('c-bday-bs'),anniv:getVal('c-anniv'),annivBs:getVal('c-anniv-bs'),photo:photo,created:isEdit?(list.find(function(x){return x.id===id;})||{}).created||todayISO():todayISO(),updated:todayISO()};
    if(isEdit) { var idx=list.findIndex(function(x){return x.id===id;}); if(idx>=0)list[idx]=rec; else list.unshift(rec); }
    else { list.unshift(rec); }
    STORE.set('pk3_customers',list);
    // Add advance to daybook if new
    if(!isEdit && adv>0) {
      try {
        var db=STORE.get('pk3_daybook',[]); db.unshift({id:uid(),type:'income',amount:adv,desc:'Advance - '+name,cat:'Advance',date:todayISO(),dateBs:todayBs(),user:(currentUser&&currentUser.name)||'system'}); STORE.set('pk3_daybook',db);
      } catch(e){ console.warn('daybook advance error',e); }
    }
    try { Audit.log('CUSTOMER',isEdit?'Edited: '+name:'Added: '+name); } catch(e){}
    try { Activity.add('👤 Customer '+( isEdit?'updated':'added')+': '+name); } catch(e){}
    App.toast('✅ Customer saved!','success');
    App.navigate('customers');
  },
  initForm: function() {
    if(!this._edit) {
      setVal('c-edit-id',''); setVal('c-name',''); setVal('c-phone',''); setVal('c-address',''); setVal('c-work',''); setVal('c-subwork',''); setVal('c-subwork-text',''); this.renderServiceRows([]); setVal('c-notes',''); setVal('c-stage',''); setVal('c-sales',''); setVal('c-sales-role',''); setVal('c-advance',''); setVal('c-total','');
      setVal('c-issue',''); setText('c-issue-text','📅 Issue मिति छान्नुस्...');
      setVal('c-fu',''); setText('c-fu-text','📅 Follow-up मिति...');
      setVal('c-bday',''); setText('c-bday-text','📅 Birthday...');
      setVal('c-anniv',''); setText('c-anniv-text','📅 Anniversary...');
      var pp=document.getElementById('c-photo-preview'); if(pp){pp.style.display='none';pp.src='';}
      setText('add-cust-title','➕ Add New Customer');
      hide('c-dup-alert');
      document.getElementById('c-dup-alert').style.display='none';
      // ── PREFILL FROM WALKIN SEARCH (v4.0.9): searched name/number auto-fills ──
      if(this._prefillNew){
        if(this._prefillNew.name)  setVal('c-name',  this._prefillNew.name);
        if(this._prefillNew.phone) setVal('c-phone', this._prefillNew.phone);
        this._prefillNew = null;
        setTimeout(function(){ var el=document.getElementById(getVal('c-name')?'c-phone':'c-name'); if(el) el.focus(); }, 150);
      }
    } else {
      var c=this._edit; this._edit=null;
      // v5.4: पुरानो single-service record पनि getServices() ले सम्हाल्छ
      this.renderServiceRows(this.getServices(c));
      setVal('c-edit-id',c.id); setVal('c-name',c.name); setVal('c-phone',c.phone); setVal('c-address',c.address||''); setVal('c-work',c.work||''); setVal('c-notes',c.notes||''); setVal('c-stage',c.stage||''); setVal('c-sales',c.sales||''); setVal('c-sales-role',c.salesRole||''); setVal('c-advance',c.advance||''); setVal('c-total',c.total||'');
      if(c.issueDate){setVal('c-issue',c.issueDate);if(c.issueDateBs){setVal('c-issue-bs',c.issueDateBs);setText('c-issue-text',bsStringToDisplay(c.issueDateBs));}}
      if(c.fuDate){setVal('c-fu',c.fuDate);if(c.fuDateBs){setVal('c-fu-bs',c.fuDateBs);setText('c-fu-text',bsStringToDisplay(c.fuDateBs));}}
      if(c.birthday){setVal('c-bday',c.birthday);if(c.birthdayBs){setVal('c-bday-bs',c.birthdayBs);setText('c-bday-text',bsStringToDisplay(c.birthdayBs));}}
      if(c.photo){var pp=document.getElementById('c-photo-preview');if(pp){pp.src=c.photo;pp.style.display='block';}}
      setText('add-cust-title','✏️ Edit Customer');
    }
    this.loadServices(); this.loadSalesDatalist();
    // v5.4: service row आफैं wire हुन्छन् — पुरानो c-work wiring चाहिँदैन
  },
  // v5.4: quotation को Main Service dropdown मात्र भर्ने (customer form अब row-based)
  loadServices: function() {
    var svcs = STORE.get('pk3_services', null);
    if (!svcs || !Array.isArray(svcs) || svcs.length === 0) svcs = SERVICES_DATA || [];
    var qs = document.getElementById('q-work');
    if (qs && qs.options.length <= 1) {
      svcs.forEach(function(s){
        var name = (typeof s === 'string') ? s : (s.name || '');
        if (!name) return;
        var opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        qs.appendChild(opt);
      });
    }
  },
  // पुरानो API — अरू code ले बोलाए पनि नभाँचोस् भनेर राखिएको
  loadSubService: function() { /* v5.4: हरेक row आफ्नै fillSubOptions() चलाउँछ */ },
  highlightSub: function() {},
  toggleCustomSub: function() {},

  // कुन row मा click भयो, त्यसै row को rate item हरू तल देखाउने
  showSubItems: function(row) {
    var wrap = document.getElementById('c-sub-items');
    if (!wrap) return;
    var work = '', sub = '';
    if (row && row.querySelector) {
      work = (row.querySelector('.svc-work') || {}).value || '';
      sub  = (row.querySelector('.svc-sub')  || {}).value || '';
      if (sub === '__custom__') sub = (row.querySelector('.svc-sub-text') || {}).value || '';
    } else {
      var first = document.querySelector('#c-services-list .svc-row');
      if (first) return this.showSubItems(first);
    }
    var rates = STORE.get('pk3_rates', {}) || {};
    if (!sub || !work || !rates[work]) { wrap.style.display = 'none'; return; }
    var items = rates[work].filter(function(i){
      return i && i.name && i.name.toLowerCase().indexOf(sub.toLowerCase()) >= 0;
    });
    if (!items.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    setText('c-sub-items-title', sub + ' — Related Items');
    var listEl = document.getElementById('c-sub-items-list');
    if (listEl) listEl.innerHTML = items.map(function(i){
      return '<span class="chip-item">' + esc(i.name) + ' — Rs.' + i.rate + '/' + esc(i.unit || '') + '</span>';
    }).join('');
  },
  loadSalesDatalist: function() {
    var dl=document.getElementById('sales-datalist'); if(!dl)return;
    var names = {};
    // 1. SalesTeam module entries
    (STORE.get('pk3_sales',[])||[]).forEach(function(s){ if(s&&s.name) names[s.name.trim()]=1; });
    // 2. Staff module entries
    (STORE.get('pk3_staff',[])||[]).forEach(function(s){ if(s&&s.name) names[s.name.trim()]=1; });
    // 3. Salesperson names already used on existing customers (v4.0.9)
    //    — एक पटक हालेपछि अर्को पटक click गर्दा popup मा देखिन्छ
    (STORE.get('pk3_customers',[])||[]).forEach(function(c){ if(c&&c.sales&&c.sales.trim()) names[c.sales.trim()]=1; });
    var list = Object.keys(names).sort();
    dl.innerHTML=list.map(function(n){return '<option value="'+n.replace(/"/g,'&quot;')+'">';}).join('');
  },
  checkDuplicate: function(phone) {
    if(phone.length<10) { document.getElementById('c-dup-alert').style.display='none'; return; }
    var list=this.getData(), editId=getVal('c-edit-id');
    var dup=list.find(function(c){return c.phone===phone&&c.id!==editId;});
    if(dup) {
      this._dupId=dup.id;
      document.getElementById('c-dup-info').textContent=dup.name+' — '+dup.address+' ('+fmtDisplayDate(dup.created)+')';
      document.getElementById('c-dup-alert').style.display='';
    } else {
      this._dupId=null;
      document.getElementById('c-dup-alert').style.display='none';
    }
  },
  editExisting: function() {
    if(!this._dupId) return;
    var c=this.getData().find(function(x){return x.id===Customers._dupId;});
    if(!c) return;
    this._edit=c; App.navigate('add-customer');
  },
  addrSuggest: function(val) {
    if(!val||val.length<2){document.getElementById('addr-dropdown').style.display='none';return;}
    // Deduplicated list of Nepal cities/districts (88 unique entries, sorted)
    var areas=['Achham','Arghakanchi','Baglung','Baitadi','Bajhang','Bajura','Banke','Bara','Bardiya','Bhaktapur','Bhojpur','Birgunj','Birtamode','Biratnagar','Butwal','Chitwan','Dadeldhura','Dailekh','Damak','Dang','Darchula','Dhading','Dhankuta','Dhanusha','Dharan','Dolakha','Dolpa','Doti','Ghorahi','Gorkha','Gulmi','Hetauda','Hetauda-1','Hetauda-2','Hetauda-3','Hetauda-2','Hetauda-5','Hetauda-6','Hetauda-7','Hetauda-8','Humla','Ilam','Itahari','Jajarkot','Janakpur','Jhapa','Jumla','Kailali','Kalikot','Kanchanpur','Kapilvastu','Kaski','Kathmandu','Kavrepalanchok','Khotang','Lahan','Lalitpur','Lamjung','Mahendranagar','Mahottari','Makwanpur','Manang','Mechinagar','Morang','Mugu','Mustang','Myagdi','Narayanghat','Nawalpur','Nepalgunj','Nuwakot','Okhaldhunga','Palpa','Panchthar','Parasi','Parsa','Pokhara','Pyuthan','Rajbiraj','Ramechhap','Rasuwa','Rautahat','Rolpa','Rukum','Rupandehi','Salyan','Sankhuwasabha','Saptari','Sarlahi','Sindhuli','Sindhupalchok','Siraha','Solukhumbu','Sunsari','Surkhet','Syangja','Tanahu','Taplejung','Terhathum','Tulsipur','Udayapur','Urlabari','Waling'];
    var lower=val.toLowerCase();
    var matches=areas.filter(function(a){return a.toLowerCase().indexOf(lower)===0;}).slice(0,6);
    var dd=document.getElementById('addr-dropdown');
    if(!matches.length){dd.style.display='none';return;}
    dd.innerHTML=matches.map(function(a){return '<div onclick="setVal(\'c-address\',\''+a+'\');document.getElementById(\'addr-dropdown\').style.display=\'none\';" style="padding:8px 14px;cursor:pointer;font-size:0.88rem;" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">'+a+'</div>';}).join('');
    dd.style.display='';
  },
  addCustomAddr: function() { var a=prompt('नयाँ ठेगाना लेख्नुस्:'); if(a){setVal('c-address',a);} },
  toggleVoiceRecord: function() { App.toast('🎤 Voice recording — browser permissions needed','info'); },
  render: function() {
    var list=this.getData(), q=getVal('cust-search').toLowerCase(), sort=getVal('cust-sort')||'recent';
    if(q) list=list.filter(function(c){return (c.name+c.phone+(c.address||'')+' '+Customers.serviceText(c)).toLowerCase().indexOf(q)>=0;});
    if(sort==='name') list=list.slice().sort(function(a,b){return a.name.localeCompare(b.name);});
    else if(sort==='advance') list=list.slice().sort(function(a,b){return (b.advance||0)-(a.advance||0);});
    var tb=document.getElementById('cust-table'); var ne=document.getElementById('no-custs');
    if(!list.length){tb.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    var today=todayBs();
    tb.innerHTML=list.map(function(c){
      var fuClass=''; var fuBadge='';
      if(c.fuDateBs){var cmp=compareBs(c.fuDateBs,today);if(cmp<0)fuClass=' style="color:var(--red)"';else if(cmp===0)fuClass=' style="color:var(--accent)"';}
      // Whole row clickable to expand details — buttons use stopPropagation
      return '<tr id="cr-'+c.id+'" onclick="Customers.detail(\''+c.id+'\')" style="cursor:pointer;" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'"><td><div style="display:flex;align-items:center;gap:8px;">'+(c.photo?'<img src="'+c.photo+'" class="photo-thumb sm">':'<div style="width:36px;height:36px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9rem;">'+((c.name||'?').charAt(0))+'</div>')+
      '<div><div style="font-weight:700;font-size:0.88rem;">'+c.name+(c._demo?' <span style="background:#f59e0b;color:#000;font-size:0.58rem;font-weight:800;padding:1px 6px;border-radius:8px;vertical-align:middle;">DEMO</span>':'')+'</div><div style="font-size:0.72rem;color:var(--text-muted);">'+c.phone+'</div></div></div></td>'+
      '<td>'+Customers.serviceChips(c)+
      (c.advance?'<div style="font-size:0.7rem;color:var(--green);">💰 '+fmtRs(c.advance)+'</div>':'')+'</td>'+
      '<td><div style="font-size:0.78rem;"'+fuClass+'>'+(c.issueDateBs?bsStringToDisplay(c.issueDateBs):'—')+'</div>'+
      (c.fuDateBs?'<div style="font-size:0.7rem;"'+fuClass+'> 🔔 '+bsStringToDisplay(c.fuDateBs)+'</div>':'')+'</td>'+
      '<td onclick="event.stopPropagation();"><div class="btn-group"><button onclick="event.stopPropagation();Customers.detail(\''+c.id+'\')" class="btn btn-xs btn-secondary" title="View details">👁</button><button onclick="event.stopPropagation();Customers.edit(\''+c.id+'\')" class="btn btn-xs btn-secondary" title="Edit">✏️</button><button onclick="event.stopPropagation();PartyStatement.open(\'customer\',\''+c.id+'\')" class="btn btn-xs btn-secondary" title="खाता विवरण (Statement)">📄</button><button onclick="event.stopPropagation();Customers.addFollowup(\''+c.id+'\')" class="btn btn-xs btn-yellow" title="Add follow-up">🔔</button><button onclick="event.stopPropagation();AIAssistant.openFor(\''+c.id+'\')" class="btn btn-xs" style="background:#7c3aed;color:#fff;" title="AI मा खोल्नुहोस्">🤖</button><button onclick="event.stopPropagation();Customers.del(\''+c.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button></div></td></tr>'+
      '<tr class="expand-row" id="cr-expand-'+c.id+'" style="display:none;"><td colspan="4"><div class="expand-inner" id="cr-exp-body-'+c.id+'"></div></td></tr>';
    }).join('');
  },
  collapseAll: function() { document.querySelectorAll('[id^="cr-expand-"]').forEach(function(r){r.style.display='none';}); },
  detail: function(id) {
    var c=this.getData().find(function(x){return x.id===id;}); if(!c) return;
    var row=document.getElementById('cr-expand-'+id);
    if(row.style.display==='table-row'){row.style.display='none';return;}
    // Close any other open expansions first
    document.querySelectorAll('[id^="cr-expand-"]').forEach(function(r){r.style.display='none';});
    row.style.display='table-row';
    var body=document.getElementById('cr-exp-body-'+id);
    var quotations=STORE.get('pk3_quotations',[]).filter(function(q){return q.custId===id||q.custName===c.name;});
    var followups =STORE.get('pk3_followups',[]).filter(function(f){return f.custId===id||f.custName===c.name;});
    var invoices  =STORE.get('pk3_invoices',[]).filter(function(i){return i.custId===id||i.custName===c.name;});
    var phoneClean = (c.phone||'').replace(/[^0-9]/g,'');
    body.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:0.82rem;margin-bottom:10px;">'+
      '<div><b>📍 Address:</b> '+(c.address||'—')+'</div>'+
      '<div><b>💼 Service:</b> '+Customers.serviceLine(c)+'</div>'+
      '<div><b>📝 Notes:</b> '+(c.notes||'—')+'</div>'+
      '<div><b>👤 Sales:</b> '+(c.sales||'—')+'</div>'+
      '<div><b>💰 Advance:</b> '+fmtRs(c.advance||0)+'</div>'+
      '<div><b>📊 Total:</b> '+fmtRs(c.total||0)+'</div>'+
      (c.birthdayBs?'<div><b>🎂 Birthday:</b> '+bsStringToDisplay(c.birthdayBs)+'</div>':'')+
      (c.annivBs?'<div><b>💍 Anniversary:</b> '+bsStringToDisplay(c.annivBs)+'</div>':'')+
      '</div>'+
      // Related records summary
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'+
        '<span style="background:var(--blue-soft);color:var(--blue);padding:3px 10px;border-radius:12px;font-size:0.72rem;font-weight:600;">📋 '+quotations.length+' Quotations</span>'+
        '<span style="background:var(--green-soft);color:var(--green);padding:3px 10px;border-radius:12px;font-size:0.72rem;font-weight:600;">🧾 '+invoices.length+' Invoices</span>'+
        '<span style="background:var(--yellow-soft);color:var(--yellow);padding:3px 10px;border-radius:12px;font-size:0.72rem;font-weight:600;">🔔 '+followups.length+' Follow-ups</span>'+
      '</div>'+
      // Action buttons row
      '<div class="btn-group" style="display:flex;flex-wrap:wrap;gap:6px;">'+
        '<button onclick="event.stopPropagation();Customers.edit(\''+id+'\')" class="btn btn-sm btn-primary" title="Edit customer">✏️ Edit</button>'+
        '<button onclick="event.stopPropagation();Customers.addFollowup(\''+id+'\')" class="btn btn-sm btn-yellow" title="Add follow-up">🔔 Follow-up</button>'+
        '<button onclick="event.stopPropagation();AIAssistant.openFor(\''+id+'\')" class="btn btn-sm" style="background:#7c3aed;color:#fff;" title="AI Assistant मा यो customer खोल्नुहोस्">🤖 AI मा खोल्नुहोस्</button>'+
        '<button onclick="event.stopPropagation();AIWA.open({type:\'fu\',ref:\'\',custId:\''+id+'\'})" class="btn btn-sm" style="background:linear-gradient(135deg,#22c55e,#7c3aed);color:#fff;" title="AI WhatsApp">🤖 AI WhatsApp</button>'+
        '<button onclick="event.stopPropagation();App.navigate(\'add-quotation\');setTimeout(function(){setVal(\'q-cust\',\''+id+'\');Quotations.autoFillService&&Quotations.autoFillService();},200);" class="btn btn-sm btn-secondary" title="New quotation">📋 New Quote</button>'+
        (phoneClean?'<button onclick="event.stopPropagation();Wa.send(\''+c.phone+'\')" class="btn btn-sm btn-wa" title="WhatsApp">📱 WhatsApp</button>':'')+
        (phoneClean?'<button onclick="event.stopPropagation();window.open(\'tel:'+c.phone+'\')" class="btn btn-sm btn-secondary" title="Call">📞 Call</button>':'')+
        '<button onclick="event.stopPropagation();Customers.del(\''+id+'\')" class="btn btn-sm btn-danger" title="Delete customer">🗑 Delete</button>'+
      '</div>';
  },
  edit: function(id) {
    var c=this.getData().find(function(x){return x.id===id;}); if(!c) return;
    this._edit=c; App.navigate('add-customer');
  },
  del: function(id) {
    if(!confirm('Customer delete गर्नुहुन्छ?')) return;
    var c=this.getData().find(function(x){return x.id===id;});
    STORE.set('pk3_customers',this.getData().filter(function(x){return x.id!==id;}));
    Audit.log('CUSTOMER','Deleted: '+(c?c.name:''));
    App.toast('🗑 Deleted','info'); this.render();
  },
  addFollowup: function(id) {
    var c=this.getData().find(function(x){return x.id===id;}); if(!c) return;
    Followups._prefillCust=id; App.navigate('add-followup');
  }
};

