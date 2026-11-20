// ─── PROJECT / SITE PROGRESS & PROFIT TRACKER ────────────────────────
var Projects = {
  STAGES: [
    { k:'Measurement',    ne:'नाप-जाँच',        pct:5,   color:'#64748b' },
    { k:'Design',         ne:'डिजाइन',          pct:15,  color:'#8b5cf6' },
    { k:'Material Order', ne:'सामग्री अर्डर',     pct:30,  color:'#0ea5e9' },
    { k:'Work Running',   ne:'काम चालु',         pct:50,  color:'#f97316' },
    { k:'Handover',       ne:'हस्तान्तरण',        pct:90,  color:'#eab308' },
    { k:'Completed',      ne:'सम्पन्न',          pct:100, color:'#22c55e' }
  ],
  _filter: 'active',
  getData: function(){ return STORE.get('pk3_projects', []) || []; },
  setData: function(l){ STORE.set('pk3_projects', l); },
  get: function(id){ return this.getData().find(function(p){ return p.id===id; }) || null; },
  stage: function(k){ return this.STAGES.find(function(s){ return s.k===k; }) || this.STAGES[0]; },
  // Money for one project — from Day Book entries tagged with projectId
  stats: function(p){
    var db = (STORE.get('pk3_daybook', []) || []).filter(function(e){ return e && e.projectId===p.id; });
    var received = db.filter(function(e){ return e.type==='income'; }).reduce(function(s,e){ return s+(parseFloat(e.amount)||0); }, 0);
    var expense  = db.filter(function(e){ return e.type==='expense'; }).reduce(function(s,e){ return s+(parseFloat(e.amount)||0); }, 0);
    var budget = parseFloat(p.budget)||0;
    return { budget: budget, received: received, expense: expense,
      profit: budget - expense,          // अनुमानित नाफा/घाटा = कुल बजेट − साइट खर्च
      cash: received - expense,          // हातमा: प्राप्त − खर्च
      due: Math.max(0, budget - received), // लिन बाँकी
      entries: db };
  },
  setFilter: function(f){ this._filter = f; this.render(); },
  render: function(){
    var wrap = document.getElementById('proj-list'); if(!wrap) return;
    var all = this.getData(), self = this, f = this._filter;
    ['active','completed','all'].forEach(function(x){ var b = document.getElementById('proj-f-'+x); if(b) b.className = 'btn btn-sm '+(x===f?'btn-primary':'btn-secondary'); });
    var list = all.filter(function(p){ return f==='all' ? true : (f==='completed' ? p.stage==='Completed' : p.stage!=='Completed'); });
    // summary
    var tot = { budget:0, received:0, expense:0, profit:0 };
    all.filter(function(p){ return p.stage!=='Completed'; }).forEach(function(p){ var s = self.stats(p); tot.budget+=s.budget; tot.received+=s.received; tot.expense+=s.expense; tot.profit+=s.profit; });
    var sum = document.getElementById('proj-summary');
    if(sum) sum.innerHTML = [['🏗️ चालु Projects', String(all.filter(function(p){ return p.stage!=='Completed'; }).length), 'var(--accent)'],
        ['💼 जम्मा बजेट', fmtRs(tot.budget), 'var(--text)'], ['💰 प्राप्त', fmtRs(tot.received), 'var(--green)'],
        ['💸 खर्च', fmtRs(tot.expense), 'var(--red)'], ['📈 अनुमानित नाफा', fmtRs(tot.profit), tot.profit>=0?'var(--green)':'var(--red)']]
      .map(function(c){ return '<div class="proj-stat"><div class="proj-stat-l">'+c[0]+'</div><div class="proj-stat-v" style="color:'+c[2]+';">'+c[1]+'</div></div>'; }).join('');
    if(!list.length){
      wrap.innerHTML = '<div class="empty-state"><div class="icon">🏗️</div><div class="title">'+(all.length?'यो filter मा कुनै project छैन':'अहिलेसम्म कुनै Project / Site छैन')+'</div>'
        + '<div class="subtitle">निर्माण / इन्टेरियर कामको Stage, प्रगति, बजेट, प्राप्त रकम र खर्च एकै ठाउँमा ट्र्याक गर्नुहोस्।</div>'
        + '<button class="btn btn-primary" onclick="Projects.openForm()">➕ नयाँ Project</button></div>';
      return;
    }
    wrap.innerHTML = list.map(function(p){
      var s = self.stats(p), st = self.stage(p.stage), pct = Math.max(0, Math.min(100, parseInt(p.progress,10)||0));
      return '<div class="card proj-card" data-proj="'+esc(p.id)+'" onclick="Projects.view(\''+esc(p.id)+'\')">'
        + '<div class="proj-top"><div style="min-width:0;flex:1;"><div class="proj-name">'+esc(p.name)+'</div>'
          + '<div class="proj-sub">'+(p.custName?'👤 '+esc(p.custName)+' · ':'')+(p.site?'📍 '+esc(p.site):'')+'</div></div>'
          + '<span class="proj-stage" style="background:'+st.color+'22;color:'+st.color+';border-color:'+st.color+'66;">'+esc(st.k)+' · '+esc(st.ne)+'</span></div>'
        + '<div class="proj-bar"><div style="width:'+pct+'%;background:'+st.color+';"></div></div>'
        + '<div class="proj-pct">प्रगति '+pct+'%</div>'
        + '<div class="proj-nums">'
          + '<div><span>बजेट</span><b>'+fmtRs(s.budget)+'</b></div>'
          + '<div><span>प्राप्त</span><b style="color:var(--green);">'+fmtRs(s.received)+'</b></div>'
          + '<div><span>खर्च</span><b style="color:var(--red);">'+fmtRs(s.expense)+'</b></div>'
          + '<div><span>'+(s.profit>=0?'अनुमानित नाफा':'अनुमानित घाटा')+'</span><b data-profit style="color:'+(s.profit>=0?'var(--green)':'var(--red)')+';">'+fmtRs(Math.abs(s.profit))+'</b></div>'
        + '</div></div>';
    }).join('');
  },
  _ensureModal: function(){
    if(document.getElementById('proj-modal')) return;
    var d = document.createElement('div'); d.className = 'modal-overlay'; d.id = 'proj-modal';
    d.innerHTML = '<div class="modal" style="max-width:620px;"><div class="modal-head"><div class="modal-title" id="proj-modal-title">🏗️ Project</div>'
      + '<button class="modal-close" onclick="document.getElementById(\'proj-modal\').classList.remove(\'open\')">✕</button></div><div id="proj-modal-body"></div></div>';
    document.body.appendChild(d);
  },
  openForm: function(id){
    this._ensureModal();
    var p = id ? this.get(id) : null, self = this;
    var custs = Customers.getData();
    var stOpts = this.STAGES.map(function(s){ return '<option value="'+s.k+'"'+(p&&p.stage===s.k?' selected':'')+'>'+s.k+' — '+s.ne+'</option>'; }).join('');
    var cOpts = '<option value="">-- Customer (optional) --</option>' + custs.map(function(c){ return '<option value="'+esc(c.id)+'"'+(p&&p.custId===c.id?' selected':'')+'>'+esc(c.name)+(c.phone?' ('+esc(c.phone)+')':'')+'</option>'; }).join('');
    setText('proj-modal-title', p ? '✏️ Project सम्पादन' : '🏗️ नयाँ Project / Site');
    document.getElementById('proj-modal-body').innerHTML = '<div class="form-grid">'
      + '<input type="hidden" id="pj-id" value="'+esc(p?p.id:'')+'">'
      + '<div class="form-group full"><label>Project / Site नाम *</label><input type="text" id="pj-name" value="'+esc(p?p.name:'')+'" placeholder="जस्तै: राम निवास — Kitchen & Wardrobe"></div>'
      + '<div class="form-group"><label>Customer</label><select id="pj-cust">'+cOpts+'</select></div>'
      + '<div class="form-group"><label>📍 Site / ठेगाना</label><input type="text" id="pj-site" value="'+esc(p?p.site||'':'')+'" placeholder="Hetauda-4"></div>'
      + '<div class="form-group"><label>Stage</label><select id="pj-stage" onchange="Projects._stageChanged()">'+stOpts+'</select></div>'
      + '<div class="form-group"><label>प्रगति % <b id="pj-prog-v">'+(p?parseInt(p.progress,10)||0:5)+'%</b></label><input type="range" id="pj-prog" min="0" max="100" step="5" value="'+(p?parseInt(p.progress,10)||0:5)+'" oninput="document.getElementById(\'pj-prog-v\').textContent=this.value+\'%\'" style="width:100%;"></div>'
      + '<div class="form-group"><label>💼 जम्मा बजेट / Contract (Rs.)</label><input type="number" id="pj-budget" min="0" value="'+(p?p.budget||'':'')+'" placeholder="0"></div>'
      + '<div class="form-group"><label>📅 सुरु मिति (BS)</label><input type="text" id="pj-start" value="'+esc(p?p.startBs||'':todayBs())+'" placeholder="2083-08-04"></div>'
      + '<div class="form-group full"><label>📝 Notes</label><textarea id="pj-notes" rows="2">'+esc(p?p.notes||'':'')+'</textarea></div>'
      + '</div><div class="form-actions"><button class="btn btn-secondary" onclick="document.getElementById(\'proj-modal\').classList.remove(\'open\')">Cancel</button>'
      + '<button class="btn btn-primary" id="pj-save" onclick="Projects.save()">💾 Save</button></div>';
    document.getElementById('proj-modal').classList.add('open');
    setTimeout(function(){ var n = document.getElementById('pj-name'); if(n) n.focus(); }, 120);
  },
  _stageChanged: function(){
    var st = this.stage(getVal('pj-stage')), r = document.getElementById('pj-prog');
    if(r && (parseInt(r.value,10)||0) < st.pct || st.k==='Completed'){ r.value = st.pct; setText('pj-prog-v', st.pct+'%'); }
  },
  save: function(){
    var name = (getVal('pj-name')||'').trim(); if(!name){ App.toast('Project नाम लेख्नुहोस्!','error'); return; }
    var id = getVal('pj-id'), list = this.getData(), old = id ? list.find(function(x){ return x.id===id; }) : null;
    var custId = getVal('pj-cust'), cust = Customers.getData().find(function(c){ return c.id===custId; }) || {};
    var rec = { id: id || uid(), name: name, custId: custId||'', custName: cust.name||'', custPhone: cust.phone||'', site: getVal('pj-site')||'',
      stage: getVal('pj-stage')||'Measurement', progress: Math.max(0, Math.min(100, parseInt(getVal('pj-prog'),10)||0)),
      budget: Math.max(0, parseFloat(getVal('pj-budget'))||0), startBs: getVal('pj-start')||'', notes: getVal('pj-notes')||'',
      created: old ? old.created : new Date().toISOString(), updated: new Date().toISOString() };
    if(old && old.stage !== rec.stage){ rec.log = (old.log||[]).concat([{ at: new Date().toISOString(), from: old.stage, to: rec.stage }]); }
    else rec.log = old ? old.log||[] : [];
    if(old){ list[list.indexOf(old)] = rec; } else list.unshift(rec);
    this.setData(list);
    try { Audit.log('PROJECT',(old?'Updated: ':'Created: ')+name+' ['+rec.stage+' '+rec.progress+'%]'); } catch(e){}
    document.getElementById('proj-modal').classList.remove('open');
    App.toast('✅ Project सेभ भयो','success');
    this.render();
    return rec;
  },
  del: function(id){
    var p = this.get(id); if(!p) return;
    if(!confirm('Project "'+p.name+'" मेटाउने?\n(Day Book का खर्च/आम्दानी entry मेटिँदैनन् — project tag मात्र हट्छ)')) return;
    this.setData(this.getData().filter(function(x){ return x.id!==id; }));
    var db = STORE.get('pk3_daybook',[])||[], ch = false;
    db.forEach(function(e){ if(e && e.projectId===id){ delete e.projectId; ch = true; } });
    if(ch) STORE.set('pk3_daybook', db);
    try { Audit.log('PROJECT','Deleted: '+p.name); } catch(e){}
    document.getElementById('view-modal').classList.remove('open');
    this.render();
  },
  view: function(id){
    var p = this.get(id); if(!p) return;
    var s = this.stats(p), st = this.stage(p.stage), pct = parseInt(p.progress,10)||0;
    var rows = s.entries.slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); }).map(function(e){
      return '<tr><td style="font-size:0.74rem;white-space:nowrap;">'+esc(e.dateBs?bsStringToDisplay(e.dateBs):e.date||'')+'</td><td>'+esc(e.desc||'')+(e.cat?'<div style="font-size:0.66rem;color:var(--text-muted);">'+esc(e.cat)+'</div>':'')+'</td>'
        + '<td style="text-align:right;white-space:nowrap;color:'+(e.type==='income'?'var(--green)':'var(--red)')+';">'+(e.type==='income'?'+ ':'- ')+fmtRs(e.amount)+'</td></tr>';
    }).join('');
    var stepper = this.STAGES.map(function(x){ var done = Projects.STAGES.indexOf(x) <= Projects.STAGES.indexOf(st);
      return '<span class="proj-step'+(done?' on':'')+'" style="'+(done?'background:'+x.color+';border-color:'+x.color+';':'')+'" title="'+x.k+'">'+esc(x.ne)+'</span>'; }).join('');
    var html = '<div class="proj-view">'
      + '<div style="font-size:1.05rem;font-weight:800;">'+esc(p.name)+'</div>'
      + '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;">'+(p.custName?'👤 '+esc(p.custName)+' ':'')+(p.site?'· 📍 '+esc(p.site)+' ':'')+(p.startBs?'· 📅 '+esc(bsStringToDisplay(p.startBs)):'')+'</div>'
      + '<div class="proj-steps">'+stepper+'</div>'
      + '<div class="proj-bar" style="margin-top:10px;"><div style="width:'+pct+'%;background:'+st.color+';"></div></div><div class="proj-pct">प्रगति '+pct+'% — '+esc(st.k)+'</div>'
      + '<div class="proj-nums" style="margin:12px 0;">'
        + '<div><span>💼 बजेट</span><b>'+fmtRs(s.budget)+'</b></div><div><span>💰 प्राप्त</span><b style="color:var(--green);">'+fmtRs(s.received)+'</b></div>'
        + '<div><span>💸 साइट खर्च</span><b style="color:var(--red);">'+fmtRs(s.expense)+'</b></div><div><span>⏳ लिन बाँकी</span><b>'+fmtRs(s.due)+'</b></div>'
        + '<div><span>'+(s.profit>=0?'📈 अनुमानित नाफा':'📉 अनुमानित घाटा')+'</span><b id="pv-profit" style="color:'+(s.profit>=0?'var(--green)':'var(--red)')+';">'+fmtRs(Math.abs(s.profit))+'</b></div>'
        + '<div><span>💵 हातमा (प्राप्त − खर्च)</span><b style="color:'+(s.cash>=0?'var(--green)':'var(--red)')+';">'+fmtRs(s.cash)+'</b></div>'
      + '</div>'
      + '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px;">अनुमानित नाफा = जम्मा बजेट − साइट खर्च। खर्च/आम्दानी Day Book मा पनि देखिन्छ।</div>'
      + '<div class="btn-group" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">'
        + '<button class="btn btn-sm btn-danger" onclick="Projects.addEntry(\''+esc(p.id)+'\',\'expense\')">➖ साइट खर्च</button>'
        + '<button class="btn btn-sm btn-success" onclick="Projects.addEntry(\''+esc(p.id)+'\',\'income\')">➕ भुक्तानी प्राप्त</button>'
        + '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'view-modal\').classList.remove(\'open\');Projects.openForm(\''+esc(p.id)+'\')">✏️ Stage / प्रगति</button>'
        + '<button class="btn btn-sm btn-secondary" onclick="Projects.del(\''+esc(p.id)+'\')">🗑</button>'
      + '</div>'
      + (rows ? '<div class="table-wrap" style="overflow-x:auto;"><table style="width:100%;"><thead><tr><th>मिति</th><th>विवरण</th><th style="text-align:right;">रकम</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
              : '<div style="font-size:0.8rem;color:var(--text-muted);padding:10px 0;">अहिलेसम्म कुनै खर्च / भुक्तानी entry छैन।</div>')
      + (p.notes ? '<div style="margin-top:10px;font-size:0.78rem;"><b>Notes:</b> '+esc(p.notes)+'</div>' : '')
      + '</div>';
    setText('view-modal-title', '🏗️ '+p.name);
    document.getElementById('view-modal-body').innerHTML = html;
    document.getElementById('view-modal').classList.add('open');
  },
  // Quick site expense / payment → real Day Book entry tagged with the project
  addEntry: function(id, type, amount, desc, cat){
    var p = this.get(id); if(!p) return null;
    if(amount == null){
      var a = prompt((type==='expense'?'➖ साइट खर्च रकम (Rs.)':'➕ प्राप्त रकम (Rs.)')+' — '+p.name+':'); if(a === null) return null;
      amount = parseFloat(a);
      if(!(amount > 0)){ App.toast('सही रकम लेख्नुहोस्','error'); return null; }
      desc = prompt('विवरण:', type==='expense' ? 'Material / ज्याला' : 'Payment received') || (type==='expense'?'Site expense':'Payment received');
    }
    var list = STORE.get('pk3_daybook',[])||[];
    var rec = { id: uid(), type: type, amount: amount, desc: desc + ' — 🏗️ ' + p.name, cat: cat || (type==='expense' ? 'Raw Material' : 'Sales/Payment Received'),
      vendor:'', bill:'', pay:'Cash', notes:'', date: todayISO(), dateBs: todayBs(), user: currentUser ? currentUser.name : '', projectId: p.id };
    rec.voucherNo = DayBook.nextVoucherNo(type, rec.dateBs, list);
    list.unshift(rec); STORE.set('pk3_daybook', list);
    try { Audit.log('PROJECT',(type==='expense'?'Expense ':'Payment ')+fmtRs(amount)+' — '+p.name); } catch(e){}
    App.toast('✅ '+(type==='expense'?'खर्च':'भुक्तानी')+' थपियो — '+fmtRs(amount),'success');
    if(document.getElementById('view-modal').classList.contains('open')) this.view(id);
    this.render();
    return rec;
  },
  // Day Book modal helper: fill the 🏗️ Project dropdown
  fillSelect: function(selected){
    var sel = document.getElementById('db-project'); if(!sel) return;
    var list = this.getData();
    sel.innerHTML = '<option value="">— कुनै Project होइन —</option>' + list.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.name)+(p.stage==='Completed'?' (Completed)':'')+'</option>'; }).join('');
    sel.value = selected || '';
    var grp = document.getElementById('db-project-grp'); if(grp) grp.style.display = list.length ? '' : 'none';
  }
};
