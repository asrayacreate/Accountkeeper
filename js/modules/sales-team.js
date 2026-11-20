// ─── SALES TEAM MODULE ───────────────────────────────────────
var SalesTeam = {
  _tab: 'list',
  getData: function(){ return STORE.get('pk3_sales',[]); },
  tab: function(t){ this._tab=t; ['list','tracker','perf'].forEach(function(x){var b=document.getElementById('sls-tab-'+x),p=document.getElementById('sls-panel-'+x);if(b)b.className='btn btn-sm btn-'+(x===t?'primary':'secondary');if(p)p.style.display=x===t?'':'none';}); this.render(); },
  render: function(){
    var list=this.getData(), custs=Customers.getData();
    var totalCust=0, totalAdv=0;
    list.forEach(function(s){var myCusts=custs.filter(function(c){return c.sales===s.name;});totalCust+=myCusts.length;totalAdv+=myCusts.reduce(function(a,c){return a+(c.advance||0);},0);});
    setText('st-total-cust',totalCust); setText('st-total-adv',fmtRs(totalAdv));
    var grid=document.getElementById('sales-team-grid'),ne=document.getElementById('no-sales');
    if(!list.length){if(grid)grid.innerHTML='';if(ne)ne.style.display='';return;} if(ne)ne.style.display='none';
    if(grid) grid.innerHTML=list.map(function(s){
      var myCusts=custs.filter(function(c){return c.sales===s.name;});
      var myAdv=myCusts.reduce(function(a,c){return a+(c.advance||0);},0);
      return '<div class="card card-body"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div><div style="font-weight:700;">'+s.name+'</div><div style="font-size:0.72rem;color:var(--text-muted);">'+s.role+'</div></div><button onclick="SalesTeam.del(\''+s.id+'\')" class="btn btn-xs btn-danger">🗑</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div class="stat-card c-blue" style="padding:8px;"><div class="stat-label">Customers</div><div class="stat-value" style="font-size:1.2rem;">'+myCusts.length+'</div></div><div class="stat-card c-green" style="padding:8px;"><div class="stat-label">Advance</div><div class="stat-value sm text-green" style="font-size:0.9rem;">'+fmtRs(myAdv)+'</div></div></div>'+( s.target?'<div style="margin-top:8px;font-size:0.78rem;color:var(--text-muted);">Target: '+fmtRs(s.target)+'</div>':'')+'</div>';
    }).join('');
  },
  addModal: function(){ setVal('stm-edit-id',''); setVal('stm-name',''); setVal('stm-phone',''); setVal('stm-role','Sales Executive'); setVal('stm-target',''); setVal('stm-notes',''); setText('stm-modal-title','🎯 Add Sales Member'); document.getElementById('stm-modal').classList.add('open'); },
  save: function(){ var name=getVal('stm-name'); if(!name){App.toast('नाम चाहिन्छ!','error');return;} var id=getVal('stm-edit-id')||uid(); var rec={id:id,name:name,phone:getVal('stm-phone'),role:getVal('stm-role'),target:parseFloat(getVal('stm-target'))||0,notes:getVal('stm-notes')}; var list=this.getData(); var idx=list.findIndex(function(x){return x.id===id;}); if(idx>=0)list[idx]=rec;else list.push(rec); STORE.set('pk3_sales',list); Audit.log('SALES_TEAM','Added: '+name); App.toast('✅ Saved!','success'); document.getElementById('stm-modal').classList.remove('open'); this.render(); },
  del: function(id){ if(!confirm('Delete?'))return; STORE.set('pk3_sales',this.getData().filter(function(x){return x.id!==id;})); this.render(); },
  trackerOn: function(){ if(navigator.geolocation){navigator.geolocation.getCurrentPosition(function(pos){var d=STORE.get('pk3_tracker',{});if(!d.gps)d.gps=[];d.gps.push({user:(currentUser&&currentUser.name)||'system',lat:pos.coords.latitude,lng:pos.coords.longitude,time:new Date().toISOString()});STORE.set('pk3_tracker',d);App.toast('📍 Location saved','success');});}else{App.toast('Geolocation not supported','error');} },
  trackerOff: function(){ App.toast('📍 Tracking stopped','info'); },
  trackerClear: function(){ var d=STORE.get('pk3_tracker',{}); d.gps=[]; STORE.set('pk3_tracker',d); App.toast('🗑 Tracker cleared','info'); }
};

