// ─── STAFF MODULE ─────────────────────────────────────────────
var Staff = {
  _tab: 'hajir',
  getData: function(){ return STORE.get('pk3_staff',[])||[]; },
  tab: function(t){
    this._tab=t;
    ['hajir','peshki','talab','tracker','list'].forEach(function(x){var b=document.getElementById('stf-tab-'+x),p=document.getElementById('stf-panel-'+x);if(b)b.className='btn btn-sm btn-'+(x===t?'primary':'secondary');if(p)p.style.display=x===t?'':'none';});
    this.render();
  },
  render: function(){
    var staff=this.getData();
    // Stats
    var statsEl=document.getElementById('stf-stats'); if(statsEl) statsEl.innerHTML='<div class="stat-card"><div class="stat-label">👷 Total Staff</div><div class="stat-value text-accent">'+staff.length+'</div></div>';
    // Hajir list
    var hajirEl=document.getElementById('stf-hajir-list'); if(hajirEl){
      if(!staff.length){hajirEl.innerHTML='<div class="empty-state"><div class="icon">👷</div><div class="title">Staff नछ</div><button onclick="Staff.addModal()" class="btn btn-primary">+ Add Staff</button></div>';return;}
      var today=todayISO();
      var attendance=STORE.get('pk3_tracker',{});
      hajirEl.innerHTML=staff.map(function(s){
        var att=attendance[today]&&attendance[today][s.id]||'absent';
        return '<div class="card card-body" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">'+
        '<div style="display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">'+((s.name||'?').charAt(0))+'</div>'+
        '<div><div style="font-weight:700;">'+s.name+'</div><div style="font-size:0.72rem;color:var(--text-muted);">'+s.role+'</div></div></div>'+
        '<div style="display:flex;gap:6px;align-items:center;">'+
        '<button onclick="Staff.markAttendance(\''+s.id+'\',\'present\')" class="btn btn-xs '+(att==='present'?'btn-success':'btn-secondary')+'">✅ Present</button>'+
        '<button onclick="Staff.markAttendance(\''+s.id+'\',\'absent\')" class="btn btn-xs '+(att==='absent'?'btn-danger':'btn-secondary')+'">❌ Absent</button>'+
        '<button onclick="Staff.delStaff(\''+s.id+'\')" class="btn btn-xs btn-danger">🗑</button></div></div>';
      }).join('');
    }
    // Fill peshki staff dropdown
    var peshkiSel=document.getElementById('peshki-staff'); if(peshkiSel) peshkiSel.innerHTML=staff.map(function(s){return '<option value="'+s.id+'">'+s.name+'</option>';}).join('');
    // Peshki table
    var peshkiList=STORE.get('pk3_staff',[]).reduce(function(a,s){return a.concat((s.peshki||[]).map(function(p){return Object.assign({},p,{staffName:s.name,staffId:s.id});}));}, []);
    var pTb=document.getElementById('peshki-table'), noPeshki=document.getElementById('no-peshki');
    if(pTb){if(!peshkiList.length){pTb.innerHTML='';if(noPeshki)noPeshki.style.display='';}else{if(noPeshki)noPeshki.style.display='none'; pTb.innerHTML=peshkiList.map(function(p){return '<tr><td>'+p.staffName+'</td><td style="font-size:0.78rem;">'+fmtDisplayDate(p.date)+'</td><td>'+( p.note||'—')+'</td><td style="text-align:right;font-weight:700;color:var(--yellow);">'+fmtRs(p.amount)+'</td><td><button onclick="Staff.delPeshki(\''+p.staffId+'\',\''+p.id+'\')" class="btn btn-xs btn-danger">🗑</button></td></tr>';}).join('');}}
    // Full list
    var fullList=document.getElementById('stf-full-list'); if(fullList) fullList.innerHTML=!staff.length?'<div class="empty-state"><div class="icon">👷</div><div class="title">No staff</div></div>':'<div class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Daily Wage</th><th>Join Date</th><th></th></tr></thead><tbody>'+staff.map(function(s){return '<tr><td><b>'+s.name+'</b></td><td>'+s.role+'</td><td>'+s.phone+'</td><td>'+fmtRs(s.wage||0)+'</td><td>'+fmtDisplayDate(s.joinDate)+'</td><td><button onclick="Staff.delStaff(\''+s.id+'\')" class="btn btn-xs btn-danger">🗑</button></td></tr>';}).join('')+'</tbody></table></div></div>';
  },
  markAttendance: function(staffId, status){
    var today=todayISO(); var att=STORE.get('pk3_tracker',{});
    if(!att[today])att[today]={};
    att[today][staffId]=status;
    STORE.set('pk3_tracker',att);
    this.render();
  },
  addModal: function(){
    setVal('stf-edit-id',''); setVal('stf-name',''); setVal('stf-phone',''); setVal('stf-role',''); setVal('stf-wage',''); setVal('stf-join',todayISO()); setVal('stf-address',''); setVal('stf-snotes','');
    setText('staff-modal-title','👷 Add Staff');
    document.getElementById('staff-modal').classList.add('open');
  },
  save: function(){
    var name=getVal('stf-name'); if(!name){App.toast('नाम चाहिन्छ!','error');return;}
    var id=getVal('stf-edit-id')||uid(); var isEdit=!!getVal('stf-edit-id');
    var rec={id:id,name:name,phone:getVal('stf-phone'),role:getVal('stf-role'),wage:parseFloat(getVal('stf-wage'))||0,joinDate:getVal('stf-join'),address:getVal('stf-address'),notes:getVal('stf-snotes'),peshki:[]};
    var list=this.getData();
    if(isEdit){var idx=list.findIndex(function(x){return x.id===id;});if(idx>=0){rec.peshki=list[idx].peshki||[];list[idx]=rec;}else list.push(rec);}
    else list.push(rec);
    STORE.set('pk3_staff',list);
    Audit.log('STAFF','Added: '+name);
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
    list[idx].peshki.unshift({id:uid(),amount:amt,note:note,date:todayISO()});
    STORE.set('pk3_staff',list);
    // Add to daybook
    var db=STORE.get('pk3_daybook',[]); db.unshift({id:uid(),type:'expense',amount:amt,desc:'पेश्की - '+list[idx].name+(note?' ('+note+')':''),cat:'पेश्की',date:todayISO(),dateBs:todayBs(),user:(currentUser&&currentUser.name)||'system'}); STORE.set('pk3_daybook',db);
    App.toast('✅ पेश्की added!','success'); setVal('peshki-amt',''); setVal('peshki-note',''); this.render();
  },
  delPeshki: function(staffId,pId){ var list=this.getData(); var idx=list.findIndex(function(x){return x.id===staffId;}); if(idx<0)return; list[idx].peshki=(list[idx].peshki||[]).filter(function(p){return p.id!==pId;}); STORE.set('pk3_staff',list); this.render(); },
  delStaff: function(id){ if(!confirm('Delete staff?'))return; STORE.set('pk3_staff',this.getData().filter(function(x){return x.id!==id;})); this.render(); App.toast('🗑 Deleted','info'); }
};

