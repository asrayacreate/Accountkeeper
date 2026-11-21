// ─── AUDIT MODULE ─────────────────────────────────────────────
var Audit = {
  getData: function(){ return STORE.get('pk3_audit',[]); },
  log: function(action,details){ var list=this.getData(); list.unshift({id:uid(),time:new Date().toISOString(),user:currentUser?currentUser.name:'System',action:action,details:details}); if(list.length>500)list=list.slice(0,500); STORE.set('pk3_audit',list); },
  render: function(){
    var list=this.getData(); var q=getVal('audit-search').toLowerCase();
    if(q) list=list.filter(function(a){return (a.user+a.action+a.details).toLowerCase().indexOf(q)>=0;});
    var tb=document.getElementById('audit-table'), ne=document.getElementById('no-audit');
    if(!list.length){tb.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    tb.innerHTML=list.map(function(a){var tm=a.time||a.date||''; var _np=Audit.npt(tm); var dpart=_np.date; var tpart=_np.time; return '<tr><td style="font-size:0.72rem;">'+dpart+' '+tpart+'</td><td style="font-size:0.78rem;">'+esc(a.user||'')+'</td><td><span class="tag tag-blue" style="font-size:0.65rem;">'+esc(a.action||'')+'</span></td><td style="font-size:0.78rem;">'+esc(a.details||'')+'</td></tr>';}).join('');
  },
  // v7.3.2: समय नेपाली समय (NPT, Asia/Kathmandu) मा — stored value UTC ISO नै रहन्छ
  npt: function(tm){
    if(!tm) return {date:'',time:''};
    var d=new Date(tm);
    if(isNaN(d.getTime()) || String(tm).length<16) return {date:fmtDisplayDate(String(tm).slice(0,10)),time:''};
    try {
      var o={timeZone:'Asia/Kathmandu'};
      return {
        date:d.toLocaleDateString('en-IN',{timeZone:o.timeZone,day:'2-digit',month:'short',year:'numeric'}),
        time:d.toLocaleTimeString('en-GB',{timeZone:o.timeZone,hour:'2-digit',minute:'2-digit',hour12:false})+' NPT'
      };
    } catch(e){
      var n=new Date(d.getTime()+345*60000);   // UTC+5:45
      return {date:fmtDisplayDate(n.toISOString().slice(0,10)),time:n.toISOString().slice(11,16)+' NPT'};
    }
  },
  clear: function(){ if(!confirm('Audit log clear गर्नुहुन्छ?'))return; STORE.set('pk3_audit',[]); this.render(); App.toast('🗑 Audit cleared','info'); },
  export: function(){ var data=JSON.stringify(this.getData(),null,2); downloadFile('audit-'+todayISO()+'.json',data); App.toast('✅ Audit exported!','success'); }
};

// ─── ACTIVITY MODULE ──────────────────────────────────────────
var Activity = {
  getData: function(){ return STORE.get('pk3_activity',[]); },
  add: function(text){ var list=this.getData(); list.unshift({text:text,time:new Date().toISOString()}); if(list.length>100)list=list.slice(0,100); STORE.set('pk3_activity',list); }
};

// ─── NOTIFICATION MODULE ──────────────────────────────────────
var Notif = {
  _open: false,
  init: function(){
    var list=STORE.get('pk3_notif',[]); var badge=document.getElementById('notif-badge');
    var unread=list.filter(function(n){return !n.read;}).length;
    if(badge){badge.textContent=unread;badge.className='notif-badge'+(unread?' show':'');}
    // Check followups for today
    var today=todayBs(); var futodos=Followups.getData().filter(function(f){return f.fuDateBs===today&&f.status!=='Done';});
    if(futodos.length){futodos.forEach(function(f){var exists=list.find(function(n){return n.ref===f.id;});if(!exists){list.unshift({id:uid(),text:'🔔 Follow-up today: '+f.custName,time:new Date().toISOString(),read:false,ref:f.id});}});}
    STORE.set('pk3_notif',list);
    try{ SmartRem.updateBell(); }catch(e){}
  },
  toggle: function(){
    this._open=!this._open;
    var panel=document.getElementById('notif-panel');
    if(panel) panel.className='notif-panel'+(this._open?' open':'');
    if(this._open) this.renderList();
    this._bindOutside();
  },
  close: function(){
    if(!this._open) return;
    this._open=false;
    var panel=document.getElementById('notif-panel'); if(panel) panel.className='notif-panel';
  },
  _bound: false,
  _bindOutside: function(){
    if(this._bound) return; this._bound = true;
    var self = this;
    var handler = function(e){
      if(!self._open) return;
      var panel = document.getElementById('notif-panel'), btn = document.getElementById('notif-btn');
      var t = e.target;
      if(panel && panel.contains(t)) return;
      if(btn && btn.contains(t)) return;                 // the bell itself toggles
      var m = document.getElementById('aiwa-modal'); if(m && m.contains(t)) return;
      self.close();
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, { capture:true, passive:true });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') self.close(); });
  },
  renderList: function(){
    var list=STORE.get('pk3_notif',[]); var cont=document.getElementById('np-list');
    if(!cont)return;
    var smart=[]; try{ smart=SmartRem.sorted(); AIWA._list=smart; }catch(e){}
    var smartHTML = smart.length ? '<div style="padding:8px 12px 4px;font-weight:800;font-size:0.8rem;">🔔 आजको स्मार्ट रिमाइन्डर (बाँकी '+smart.filter(function(x){return !x.sent;}).length+' / '+smart.length+')</div><div style="padding:0 10px 6px;">'+SmartRem._rowsHTML(smart)+'</div>' : '';
    if(!list.length){cont.innerHTML=smartHTML||'<div class="np-empty">कुनै notification छैन 🎉</div>';try{SmartRem.updateBell();}catch(e){}return;}
    cont.innerHTML=smartHTML+list.slice(0,20).map(function(n){return '<div class="np-item '+(n.read?'':'')+'"><div class="np-dot"></div><div><div style="font-size:0.82rem;">'+n.text+'</div><div style="font-size:0.68rem;color:var(--text-muted);">'+fmtDisplayDate((n.time||'').slice(0,10))+'</div></div></div>';}).join('');
    // Mark all read
    list.forEach(function(n){n.read=true;}); STORE.set('pk3_notif',list);
    try{ SmartRem.updateBell(); }catch(e){ var badge=document.getElementById('notif-badge'); if(badge){badge.textContent='0';badge.className='notif-badge';} }
  },
  clearAll: function(){ STORE.set('pk3_notif',[]); document.getElementById('np-list').innerHTML='<div class="np-empty">कुनै notification छैन 🎉</div>'; App.toast('🗑 Notifications cleared','info'); },
  toast: function(msg,type,dur){ App.toast(msg,type,dur); }
};

