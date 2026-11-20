// ─── STAFF MODULE (v7.1.0: हाजिरी + तलब/पेश्की हिसाब) ─────────────────────
// Data (all synced + in backup):
//   pk3_staff      [{id,name,phone,role,payType:'daily'|'monthly',wage (दैनिक ज्याला),salary (मासिक तलब),
//                    joinDate,address,notes,peshki:[{id,amount,note,date}],payments:[{id,ym,amount,date,note,dbId}]}]
//   pk3_attendance {'YYYY-MM-DD' (AD): {staffId: 'present'|'half'|'absent'}}
// v7.0 and older kept attendance in pk3_tracker (device-only, never synced). On first use it is
// copied into pk3_attendance; pk3_tracker itself is left untouched.
// Payroll period = Nepali (BS) month.
//   Daily wage   → कमाइ = ज्याला × (Present + ½ Half Day)
//   Monthly      → कमाइ = तलब − (तलब ÷ महिनाका दिन) × (Absent + ½ Half Day)   (हाजिर नभरिएको दिन = काटिँदैन)
//   खुद तलब (Net Payable) = कमाइ − त्यो महिनाको पेश्की − त्यो महिनाको तलब भुक्तानी
var Staff = {
  _tab: 'hajir',
  ATT_KEY: 'pk3_attendance',
  STATUSES: ['present', 'half', 'absent'],
  getData: function(){ return STORE.get('pk3_staff',[])||[]; },
  setData: function(list){ STORE.set('pk3_staff', list); },
  get: function(id){ return this.getData().find(function(x){ return x.id===id; }) || null; },

  // ── dates ──
  _iso: function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },
  _today: function(){ return this._iso(new Date()); },
  _bsOfIso: function(iso){
    try { var p=String(iso).slice(0,10).split('-'); var b=adToBs(+p[0],+p[1],+p[2]); return b.y+'-'+String(b.m).padStart(2,'0'); } catch(e){ return ''; }
  },
  curYm: function(){ var b=currentBs(); return b.y+'-'+String(b.m).padStart(2,'0'); },
  /** BS month 'YYYY-MM' → {ym, label, days:[AD iso…]} */
  monthDays: function(ym){
    var p=String(ym||this.curYm()).split('-'), y=+p[0], m=+p[1];
    var row=(window.BS_MONTHS_DATA||[])[y-2000], dim=(row&&row[m])||30;
    var start=bsToAd(y,m,1), days=[];
    for(var i=0;i<dim;i++){ var d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i); days.push(this._iso(d)); }
    return { ym: y+'-'+String(m).padStart(2,'0'), label: bsMonthName(m)+' '+y, days: days };
  },

  // ── attendance ──
  attendance: function(){
    var att=STORE.get(this.ATT_KEY, null);
    if(att && typeof att==='object' && !Array.isArray(att)) return att;
    // one-time copy from the old device-only pk3_tracker {date:{staffId:status}, gps:[…]}
    att={};
    try {
      var old=STORE.get('pk3_tracker',{})||{};
      Object.keys(old).forEach(function(k){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(k) || !old[k] || typeof old[k]!=='object') return;
        att[k]={};
        Object.keys(old[k]).forEach(function(sid){ var v=old[k][sid]; if(Staff.STATUSES.indexOf(v)>=0) att[k][sid]=v; });
      });
    } catch(e){}
    STORE.set(this.ATT_KEY, att);
    return att;
  },
  statusOn: function(staffId, iso){ var a=this.attendance()[iso]; return (a && a[staffId]) || ''; },
  mark: function(staffId, status, iso){
    if(this.STATUSES.indexOf(status)<0 && status!=='') throw new Error('Invalid status');
    iso=iso||this._today();
    var att=this.attendance();
    if(!att[iso]) att[iso]={};
    if(status) att[iso][staffId]=status; else delete att[iso][staffId];
    STORE.set(this.ATT_KEY, att);
  },
  markAttendance: function(staffId, status){ this.mark(staffId, status, this._attDate()); this.render(); },
  markAll: function(status){
    var d=this._attDate(), self=this;
    this.getData().forEach(function(s){ if(!self.statusOn(s.id,d)) self.mark(s.id, status, d); });
    App.toast('✅ बाँकी सबैलाई '+this.label(status),'success'); this.render();
  },
  label: function(st){ return { present:'✅ Present', half:'🌓 Half Day', absent:'❌ Absent' }[st] || '—'; },
  _attDate: function(){ var v=getVal('stf-att-date'); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : this._today(); },

  // ── payroll ──
  payroll: function(staffId, ym){
    var s=typeof staffId==='object' ? staffId : this.get(staffId);
    var md=this.monthDays(ym);
    var out={ staffId: s?s.id:'', ym: md.ym, label: md.label, dim: md.days.length, present:0, half:0, absent:0, unmarked:0,
              payType: (s&&s.payType)||'daily', rate:0, earned:0, advance:0, paid:0, net:0 };
    if(!s) return out;
    var att=this.attendance();
    md.days.forEach(function(d){
      var st=att[d]&&att[d][s.id];
      if(st==='present') out.present++; else if(st==='half') out.half++; else if(st==='absent') out.absent++; else out.unmarked++;
    });
    var r2=function(n){ return Math.round(n*100)/100; };
    if(out.payType==='monthly'){
      out.rate=parseFloat(s.salary)||0;
      var perDay=out.dim ? out.rate/out.dim : 0;
      out.earned=Math.max(0, r2(out.rate - perDay*(out.absent + 0.5*out.half)));
    } else {
      out.rate=parseFloat(s.wage)||0;
      out.earned=r2(out.rate*(out.present + 0.5*out.half));
    }
    var inMonth=md.days.reduce(function(o,d){ o[d]=1; return o; },{});
    out.advance=r2((s.peshki||[]).reduce(function(t,p){ return t + (inMonth[String(p.date||'').slice(0,10)] ? (parseFloat(p.amount)||0) : 0); },0));
    out.paid=r2((s.payments||[]).reduce(function(t,p){ return t + (p.ym===md.ym ? (parseFloat(p.amount)||0) : 0); },0));
    out.net=r2(out.earned - out.advance - out.paid);
    return out;
  },
  payrollAll: function(ym){ var self=this; return this.getData().map(function(s){ var p=self.payroll(s, ym); p.name=s.name; p.role=s.role||''; return p; }); },

  /** Record a salary payment for BS month ym; also posts a Day Book expense (Staff Salary). */
  pay: function(staffId, ym, amount, note, opts){
    amount=parseFloat(amount)||0;
    if(amount<=0) throw new Error('रकम ० भन्दा बढी हुनुपर्छ');
    var list=this.getData(), idx=list.findIndex(function(x){ return x.id===staffId; });
    if(idx<0) throw new Error('Staff भेटिएन');
    var s=list[idx], md=this.monthDays(ym), today=this._today();
    var p={ id: uid(), ym: md.ym, amount: amount, date: today, note: note||'' };
    if(!opts || opts.toDayBook!==false){
      var db=STORE.get('pk3_daybook',[])||[];
      p.dbId=uid();
      db.unshift({ id:p.dbId, type:'expense', amount:amount, desc:'तलब - '+s.name+' ('+md.label+')'+(note?' — '+note:''), cat:'Staff Salary',
        date:today, dateBs:todayBs(), user:(window.currentUser&&currentUser.name)||'system', _staffPay:p.id });
      STORE.set('pk3_daybook', db);
    }
    s.payments=(s.payments||[]); s.payments.unshift(p);
    this.setData(list);
    try { Audit.log('STAFF','Salary paid: '+s.name+' '+md.label+' '+fmtRs(amount)); } catch(e){}
    return p;
  },
  delPayment: function(staffId, payId){
    var list=this.getData(), s=list.find(function(x){ return x.id===staffId; }); if(!s) return;
    var p=(s.payments||[]).find(function(x){ return x.id===payId; }); if(!p) return;
    s.payments=s.payments.filter(function(x){ return x.id!==payId; });
    this.setData(list);
    if(p.dbId) STORE.set('pk3_daybook', (STORE.get('pk3_daybook',[])||[]).filter(function(e){ return e.id!==p.dbId; }));
    try { Audit.log('STAFF','Salary payment removed: '+s.name+' '+fmtRs(p.amount)); } catch(e){}
  },

  // ── UI ──
  tab: function(t){
    this._tab=t;
    ['hajir','peshki','talab','tracker','list'].forEach(function(x){var b=document.getElementById('stf-tab-'+x),p=document.getElementById('stf-panel-'+x);if(b)b.className='btn btn-sm btn-'+(x===t?'primary':'secondary');if(p)p.style.display=x===t?'':'none';});
    this.render();
  },
  _fillMonthSel: function(){
    var ms=document.getElementById('stf-month-bs'), ys=document.getElementById('stf-year-bs');
    if(!ms || !ys) return;
    var cur=currentBs();
    if(!ys.options.length){
      var yh=''; for(var y=cur.y+1;y>=cur.y-3;y--) yh+='<option value="'+y+'"'+(y===cur.y?' selected':'')+'>'+y+'</option>';
      ys.innerHTML=yh;
    }
    if(ms.options.length<12){
      ms.innerHTML=BS_MONTHS.map(function(n,i){ return '<option value="'+(i+1)+'"'+(i+1===cur.m?' selected':'')+'>📅 '+n+'</option>'; }).join('');
    }
  },
  selYm: function(){
    this._fillMonthSel();
    var y=parseInt(getVal('stf-year-bs'),10), m=parseInt(getVal('stf-month-bs'),10);
    if(!y || !m) return this.curYm();
    return y+'-'+String(m).padStart(2,'0');
  },
  _wageText: function(s){ return (s.payType==='monthly') ? fmtRs(s.salary||0)+'/महिना' : fmtRs(s.wage||0)+'/दिन'; },

  render: function(){
    var self=this, staff=this.getData();
    this._fillMonthSel();
    var dEl=document.getElementById('stf-att-date'); if(dEl && !dEl.value) dEl.value=this._today();
    var day=this._attDate(), att=this.attendance()[day]||{};
    var cnt={present:0,half:0,absent:0};
    staff.forEach(function(s){ if(cnt[att[s.id]]!=null) cnt[att[s.id]]++; });
    var statsEl=document.getElementById('stf-stats');
    if(statsEl) statsEl.innerHTML=[
      ['👷 Total Staff', staff.length, 'text-accent'], ['✅ Present', cnt.present, 'text-green'],
      ['🌓 Half Day', cnt.half, 'text-yellow'], ['❌ Absent', cnt.absent, 'text-red']
    ].map(function(x){ return '<div class="stat-card"><div class="stat-label">'+x[0]+'</div><div class="stat-value '+x[2]+'">'+x[1]+'</div></div>'; }).join('');
    // Hajir list
    var hajirEl=document.getElementById('stf-hajir-list'); if(hajirEl){
      if(!staff.length) hajirEl.innerHTML='<div class="empty-state"><div class="icon">👷</div><div class="title">Staff छैन</div><button onclick="Staff.addModal()" class="btn btn-primary">+ Add Staff</button></div>';
      else hajirEl.innerHTML=staff.map(function(s){
        var st=att[s.id]||'';
        var b=function(k,txt,cls){ return '<button data-att="'+k+'" onclick="Staff.markAttendance(\''+s.id+'\',\''+k+'\')" class="btn btn-xs '+(st===k?cls:'btn-secondary')+'">'+txt+'</button>'; };
        return '<div class="card card-body stf-att-row" data-staff="'+esc(s.id)+'" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'+
        '<div style="display:flex;align-items:center;gap:10px;min-width:0;"><div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;">'+esc((s.name||'?').charAt(0))+'</div>'+
        '<div style="min-width:0;"><div style="font-weight:700;">'+esc(s.name)+'</div><div style="font-size:0.72rem;color:var(--text-muted);">'+esc(s.role||'')+' • '+self._wageText(s)+'</div></div></div>'+
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'+
        b('present','✅ Present','btn-success')+b('half','🌓 Half Day','btn-yellow')+b('absent','❌ Absent','btn-danger')+
        '</div></div>';
      }).join('');
    }
    // Peshki
    var peshkiSel=document.getElementById('peshki-staff'); if(peshkiSel) peshkiSel.innerHTML=staff.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>';}).join('');
    var peshkiList=staff.reduce(function(a,s){return a.concat((s.peshki||[]).map(function(p){return Object.assign({},p,{staffName:s.name,staffId:s.id});}));}, []);
    var pTb=document.getElementById('peshki-table'), noPeshki=document.getElementById('no-peshki');
    if(pTb){if(!peshkiList.length){pTb.innerHTML='';if(noPeshki)noPeshki.style.display='';}else{if(noPeshki)noPeshki.style.display='none'; pTb.innerHTML=peshkiList.map(function(p){return '<tr><td>'+esc(p.staffName)+'</td><td style="font-size:0.78rem;">'+fmtDisplayDate(p.date)+'</td><td>'+( esc(p.note)||'—')+'</td><td style="text-align:right;font-weight:700;color:var(--yellow);">'+fmtRs(p.amount)+'</td><td><button onclick="Staff.delPeshki(\''+p.staffId+'\',\''+p.id+'\')" class="btn btn-xs btn-danger">🗑</button></td></tr>';}).join('');}}
    this.renderTalab();
    // Full list
    var fullList=document.getElementById('stf-full-list'); if(fullList) fullList.innerHTML=!staff.length?'<div class="empty-state"><div class="icon">👷</div><div class="title">No staff</div></div>':'<div class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>ज्याला / तलब</th><th>Join Date</th><th></th></tr></thead><tbody>'+staff.map(function(s){return '<tr><td><b>'+esc(s.name)+'</b></td><td>'+esc(s.role||'')+'</td><td>'+esc(s.phone||'')+'</td><td>'+self._wageText(s)+'</td><td>'+fmtDisplayDate(s.joinDate)+'</td><td><div class="btn-group"><button onclick="Staff.edit(\''+s.id+'\')" class="btn btn-xs btn-secondary">✏️</button><button onclick="Staff.delStaff(\''+s.id+'\')" class="btn btn-xs btn-danger">🗑</button></div></td></tr>';}).join('')+'</tbody></table></div></div>';
  },

  renderTalab: function(){
    var el=document.getElementById('stf-talab-list'); if(!el) return;
    var ym=this.selYm(), rows=this.payrollAll(ym), md=this.monthDays(ym);
    if(!rows.length){ el.innerHTML='<div class="empty-state"><div class="icon">💰</div><div class="title">Staff छैन</div></div>'; return; }
    var tot=rows.reduce(function(t,r){ t.earned+=r.earned; t.advance+=r.advance; t.paid+=r.paid; t.net+=Math.max(0,r.net); return t; },{earned:0,advance:0,paid:0,net:0});
    el.innerHTML='<div class="stats-grid" style="margin-bottom:12px;">'
      +'<div class="stat-card"><div class="stat-label">📅 महिना</div><div class="stat-value" style="font-size:1.05rem;">'+esc(md.label)+'</div></div>'
      +'<div class="stat-card"><div class="stat-label">💼 कुल कमाइ</div><div class="stat-value text-accent" id="stf-tot-earned">'+fmtRs(tot.earned)+'</div></div>'
      +'<div class="stat-card"><div class="stat-label">💸 पेश्की कट्टा</div><div class="stat-value text-yellow">'+fmtRs(tot.advance)+'</div></div>'
      +'<div class="stat-card"><div class="stat-label">💰 तिर्न बाँकी (Net)</div><div class="stat-value text-red" id="stf-tot-net">'+fmtRs(tot.net)+'</div></div></div>'
      +'<div class="card"><div class="table-wrap"><table><thead><tr><th>Staff</th><th>दर</th><th style="text-align:center;">✅ / 🌓 / ❌</th><th style="text-align:right;">कमाइ</th><th style="text-align:right;">पेश्की</th><th style="text-align:right;">भुक्तानी</th><th style="text-align:right;">खुद तलब</th><th></th></tr></thead><tbody>'
      +rows.map(function(r){
        var neg=r.net<0;
        return '<tr data-payroll="'+esc(r.staffId)+'"><td><b>'+esc(r.name)+'</b><div style="font-size:0.68rem;color:var(--text-muted);">'+esc(r.role)+'</div></td>'
          +'<td style="font-size:0.76rem;white-space:nowrap;">'+fmtRs(r.rate)+(r.payType==='monthly'?'/महिना':'/दिन')+'</td>'
          +'<td style="text-align:center;font-size:0.78rem;white-space:nowrap;">'+r.present+' / '+r.half+' / '+r.absent+'</td>'
          +'<td style="text-align:right;white-space:nowrap;">'+fmtRs(r.earned)+'</td>'
          +'<td style="text-align:right;color:var(--yellow);white-space:nowrap;">'+(r.advance?'- '+fmtRs(r.advance):'—')+'</td>'
          +'<td style="text-align:right;color:var(--green);white-space:nowrap;">'+(r.paid?'- '+fmtRs(r.paid):'—')+'</td>'
          +'<td class="stf-net" style="text-align:right;font-weight:800;white-space:nowrap;color:'+(neg?'var(--yellow)':(r.net>0?'var(--red)':'var(--green)'))+';">'+fmtRs(Math.abs(r.net))+(neg?'<div style="font-size:0.62rem;font-weight:400;">पेश्की बढी</div>':'')+'</td>'
          +'<td><div class="btn-group">'+(r.net>0?'<button onclick="Staff.payModal(\''+r.staffId+'\')" class="btn btn-xs btn-success">💵 तलब दिनुस्</button>':'')
          +'<button onclick="Staff.history(\''+r.staffId+'\')" class="btn btn-xs btn-secondary" title="भुक्तानी इतिहास">📜</button></div></td></tr>';
      }).join('')
      +'</tbody></table></div></div>'
      +'<div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;line-height:1.5;">ℹ️ दैनिक ज्याला: ज्याला × (Present + ½ Half Day)। मासिक तलब: हाजिर नभरिएको दिन काटिँदैन, Absent र Half Day मात्र काटिन्छ। पेश्की उही महिनाको तलबबाट कट्टा हुन्छ।</div>';
  },

  _modal: function(title, bodyHtml){
    var m=document.getElementById('stf-pay-modal');
    if(!m){
      m=document.createElement('div'); m.className='modal-overlay'; m.id='stf-pay-modal';
      m.innerHTML='<div class="modal" style="max-width:460px;"><div class="modal-head"><div class="modal-title" id="stf-pay-title"></div><button class="modal-close" onclick="document.getElementById(\'stf-pay-modal\').classList.remove(\'open\')">✕</button></div><div id="stf-pay-body"></div></div>';
      document.body.appendChild(m);
    }
    setText('stf-pay-title', title);
    document.getElementById('stf-pay-body').innerHTML=bodyHtml;
    m.classList.add('open');
  },
  payModal: function(staffId){
    var s=this.get(staffId); if(!s) return;
    var r=this.payroll(s, this.selYm());
    this._modal('💵 तलब भुक्तानी — '+s.name,
      '<div style="font-size:0.82rem;margin-bottom:10px;line-height:1.6;">📅 '+esc(r.label)+'<br>कमाइ '+fmtRs(r.earned)+' − पेश्की '+fmtRs(r.advance)+' − भुक्तानी '+fmtRs(r.paid)+' = <b>'+fmtRs(r.net)+'</b></div>'
      +'<div class="form-group"><label>रकम (Rs.)</label><input type="number" id="stf-pay-amt" min="0" value="'+Math.max(0,r.net)+'"></div>'
      +'<div class="form-group"><label>Note</label><input type="text" id="stf-pay-note" placeholder="Cash / Bank / eSewa…"></div>'
      +'<div class="form-actions"><button class="btn btn-secondary" onclick="document.getElementById(\'stf-pay-modal\').classList.remove(\'open\')">Cancel</button>'
      +'<button class="btn btn-success" id="stf-pay-save" onclick="Staff.savePay(\''+staffId+'\',\''+r.ym+'\')">💾 भुक्तानी गर्नुस्</button></div>');
  },
  savePay: function(staffId, ym){
    try { this.pay(staffId, ym, getVal('stf-pay-amt'), getVal('stf-pay-note')); }
    catch(e){ App.toast(e.message,'error'); return; }
    document.getElementById('stf-pay-modal').classList.remove('open');
    App.toast('✅ तलब भुक्तानी Day Book मा पनि दर्ता भयो','success');
    this.render();
  },
  history: function(staffId){
    var s=this.get(staffId); if(!s) return;
    var md=function(ym){ var p=String(ym).split('-'); return bsMonthName(+p[1])+' '+p[0]; };
    var pays=s.payments||[];
    this._modal('📜 तलब इतिहास — '+s.name, !pays.length ? '<div class="empty-state" style="padding:20px;">भुक्तानी छैन</div>'
      : '<div class="table-wrap"><table><thead><tr><th>महिना</th><th>मिति</th><th style="text-align:right;">रकम</th><th></th></tr></thead><tbody>'
        + pays.map(function(p){ return '<tr><td>'+esc(md(p.ym))+'</td><td style="font-size:0.76rem;">'+fmtDisplayDate(p.date)+(p.note?'<div style="font-size:0.68rem;color:var(--text-muted);">'+esc(p.note)+'</div>':'')+'</td><td style="text-align:right;font-weight:700;">'+fmtRs(p.amount)+'</td>'
          +'<td><button class="btn btn-xs btn-danger" onclick="if(confirm(\'यो भुक्तानी हटाउने? Day Book entry पनि हट्छ।\')){Staff.delPayment(\''+s.id+'\',\''+p.id+'\');Staff.history(\''+s.id+'\');Staff.render();}">🗑</button></td></tr>'; }).join('')
        + '</tbody></table></div>');
  },

  togglePayType: function(){
    var monthly=getVal('stf-paytype')==='monthly';
    var w=document.getElementById('stf-wage-grp'), s=document.getElementById('stf-salary-grp');
    if(w) w.style.display=monthly?'none':''; if(s) s.style.display=monthly?'':'none';
  },
  addModal: function(){
    setVal('stf-edit-id',''); setVal('stf-name',''); setVal('stf-phone',''); setVal('stf-role',''); setVal('stf-wage',''); setVal('stf-salary',''); setVal('stf-paytype','daily'); setVal('stf-join',todayISO()); setVal('stf-address',''); setVal('stf-snotes','');
    setText('staff-modal-title','👷 Add Staff');
    this.togglePayType();
    document.getElementById('staff-modal').classList.add('open');
  },
  edit: function(id){
    var s=this.get(id); if(!s) return;
    setVal('stf-edit-id',s.id); setVal('stf-name',s.name||''); setVal('stf-phone',s.phone||''); setVal('stf-role',s.role||''); setVal('stf-wage',s.wage||''); setVal('stf-salary',s.salary||''); setVal('stf-paytype',s.payType||'daily'); setVal('stf-join',s.joinDate||''); setVal('stf-address',s.address||''); setVal('stf-snotes',s.notes||'');
    setText('staff-modal-title','✏️ Edit Staff');
    this.togglePayType();
    document.getElementById('staff-modal').classList.add('open');
  },
  save: function(){
    var name=getVal('stf-name'); if(!name){App.toast('नाम चाहिन्छ!','error');return;}
    var id=getVal('stf-edit-id')||uid(); var isEdit=!!getVal('stf-edit-id');
    var rec={id:id,name:name,phone:getVal('stf-phone'),role:getVal('stf-role'),payType:getVal('stf-paytype')==='monthly'?'monthly':'daily',
      wage:parseFloat(getVal('stf-wage'))||0,salary:parseFloat(getVal('stf-salary'))||0,joinDate:getVal('stf-join'),address:getVal('stf-address'),notes:getVal('stf-snotes'),peshki:[],payments:[]};
    var list=this.getData();
    if(isEdit){var idx=list.findIndex(function(x){return x.id===id;});if(idx>=0){rec=Object.assign({},list[idx],rec,{peshki:list[idx].peshki||[],payments:list[idx].payments||[]});list[idx]=rec;}else list.push(rec);}
    else list.push(rec);
    this.setData(list);
    Audit.log('STAFF',(isEdit?'Updated: ':'Added: ')+name);
    App.toast('✅ Staff saved!','success');
    document.getElementById('staff-modal').classList.remove('open');
    this.render();
  },
  addPeshki: function(){
    var staffId=getVal('peshki-staff'); if(!staffId)return;
    var amt=parseFloat(getVal('peshki-amt'))||0; if(!amt){App.toast('Amount छान्नुस्!','error');return;}
    var note=getVal('peshki-note');
    var list=this.getData(); var idx=list.findIndex(function(x){return x.id===staffId;});
    if(idx<0)return;
    if(!list[idx].peshki)list[idx].peshki=[];
    list[idx].peshki.unshift({id:uid(),amount:amt,note:note,date:this._today()});
    this.setData(list);
    // Add to daybook
    var db=STORE.get('pk3_daybook',[]); db.unshift({id:uid(),type:'expense',amount:amt,desc:'पेश्की - '+list[idx].name+(note?' ('+note+')':''),cat:'पेश्की',date:todayISO(),dateBs:todayBs(),user:(window.currentUser&&currentUser.name)||'system'}); STORE.set('pk3_daybook',db);
    App.toast('✅ पेश्की added!','success'); setVal('peshki-amt',''); setVal('peshki-note',''); this.render();
  },
  delPeshki: function(staffId,pId){ var list=this.getData(); var idx=list.findIndex(function(x){return x.id===staffId;}); if(idx<0)return; list[idx].peshki=(list[idx].peshki||[]).filter(function(p){return p.id!==pId;}); this.setData(list); this.render(); },
  delStaff: function(id){ if(!confirm('Delete staff?'))return; this.setData(this.getData().filter(function(x){return x.id!==id;})); this.render(); App.toast('🗑 Deleted','info'); }
};
