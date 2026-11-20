// ─── DAILY PLANNER & NOTES MODULE (v4.0.6) ────────────────────────
// Notification-enabled, daily/weekly planner with WhatsApp integration
var Planner = {
  _filter: 'today',
  _notifInterval: null,
  CATEGORIES: {
    other:    {icon:'📋', label:'Other',     color:'#94a3b8'},
    wa:       {icon:'📱', label:'WhatsApp',  color:'#22c55e'},
    call:     {icon:'📞', label:'Call',      color:'#3b82f6'},
    meeting:  {icon:'🏢', label:'Meeting',   color:'#8b5cf6'},
    visit:    {icon:'🚗', label:'Visit',     color:'#f97316'},
    delivery: {icon:'📦', label:'Delivery',  color:'#06b6d4'},
    payment:  {icon:'💰', label:'Payment',   color:'#eab308'},
    reminder: {icon:'🔔', label:'Reminder',  color:'#a855f7'}
  },
  PRIORITIES: {
    urgent: {icon:'🔴', label:'Urgent', color:'#ef4444'},
    normal: {icon:'🟡', label:'Normal', color:'#eab308'},
    low:    {icon:'🟢', label:'Low',    color:'#22c55e'}
  },

  getData: function(){ return STORE.get('pk3_planner',[]) || []; },
  setData: function(list){ try { var ok = STORE.set('pk3_planner', list); return ok !== false; } catch(e){ console.error('Planner save failed', e); return false; } },

  // ── INITIALIZATION ──
  init: function(){
    // Start the due-task checker (runs every 60s)
    if(this._notifInterval) clearInterval(this._notifInterval);
    var self = this;
    this._notifInterval = setInterval(function(){ self.checkDueTasks(); }, 60000);
    // Update notification button state
    this._updateNotifButton();
    // Update sidebar badge
    this.updateBadge();
  },

  // ── NOTIFICATION PERMISSION ──
  requestNotificationPermission: function(){
    if(!('Notification' in window)){
      App.toast('यो browser ले notification support गर्दैन','error');
      return;
    }
    if(Notification.permission === 'granted'){
      App.toast('🔔 Notifications पहिले नै enabled छन्','info');
      this._updateNotifButton();
      return;
    }
    if(Notification.permission === 'denied'){
      App.toast('⚠️ Browser settings बाट notifications allow गर्नुस्','warning',4500);
      return;
    }
    Notification.requestPermission().then(function(result){
      Planner._updateNotifButton();
      if(result === 'granted'){
        App.toast('✅ Notifications enabled','success');
        new Notification('Swagatik 🔔', {body:'Daily Planner notifications enabled!', icon:''});
      } else {
        App.toast('Notification permission denied','warning');
      }
    });
  },

  _updateNotifButton: function(){
    var btn = document.getElementById('pl-notif-btn');
    if(!btn) return;
    if(!('Notification' in window)){
      btn.textContent = '⚠️ Not supported';
      btn.disabled = true;
      return;
    }
    if(Notification.permission === 'granted'){
      btn.textContent = '🔔 Enabled';
      btn.className = 'btn btn-sm btn-success';
      btn.title = 'Browser notifications are active';
    } else if(Notification.permission === 'denied'){
      btn.textContent = '🔕 Blocked';
      btn.className = 'btn btn-sm btn-danger';
      btn.title = 'Enable in browser settings';
    } else {
      btn.textContent = '🔔 Enable Alerts';
      btn.className = 'btn btn-sm btn-secondary';
    }
  },

  // ── BACKGROUND DUE-TASK CHECKER ──
  checkDueTasks: function(){
    var list = this.getData();
    var todayBs_ = todayBs();
    var now = new Date();
    var nowHHMM = (now.getHours()<10?'0':'') + now.getHours() + ':' + (now.getMinutes()<10?'0':'') + now.getMinutes();
    var dirty = false;
    list.forEach(function(t){
      if(t.status === 'done') return;
      if(!t.reminder) return;
      if(t.notified) return;
      if(t.dateBs !== todayBs_) return;
      if(!t.time) return;
      // Fire if scheduled time is now or earlier (and not yet notified)
      if(t.time <= nowHHMM){
        Planner._fireNotification(t);
        t.notified = true;
        dirty = true;
      }
    });
    if(dirty) this.setData(list);
  },

  _fireNotification: function(t){
    var cat = this.CATEGORIES[t.category] || this.CATEGORIES.other;
    var title = cat.icon + ' ' + (t.title || 'Task Reminder');
    var body  = (t.time?'⏰ '+t.time+'  ':'') + (t.content||'') + (t.custName?'\n👤 '+t.custName:'');
    // Browser notification (if granted)
    try {
      if('Notification' in window && Notification.permission === 'granted'){
        var n = new Notification(title, {body:body, tag:'pl-'+t.id, requireInteraction:true});
        n.onclick = function(){ window.focus(); App.navigate('planner'); n.close(); };
      }
    } catch(e){}
    // In-app toast as fallback / supplement
    if(window.App && App.toast){
      App.toast('🔔 ' + title + ' — ' + (t.content||'').slice(0,40), 'info', 6000);
    }
    // Audio cue (gentle beep using WebAudio — works without an audio file)
    try {
      var ctx = new (window.AudioContext||window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } catch(e){}
  },

  // ── BADGE (sidebar count of pending today's tasks) ──
  updateBadge: function(){
    var list = this.getData();
    var todayBs_ = todayBs();
    var pending = list.filter(function(t){
      return t.status !== 'done' && t.dateBs === todayBs_;
    }).length;
    var badge = document.getElementById('pl-badge');
    if(badge){
      if(pending > 0){ badge.textContent = pending; badge.style.display = ''; }
      else            { badge.style.display = 'none'; }
    }
  },

  // ── FILTER & RENDER ──
  filter: function(view){
    this._filter = view;
    ['today','tomorrow','week','overdue','all','done'].forEach(function(f){
      var btn = document.getElementById('pl-f-'+f);
      if(btn){
        btn.className = 'btn btn-sm ' + (f===view ? 'btn-primary' : 'btn-secondary');
      }
    });
    this.render();
  },

  _todayDisplay: function(){
    var ad = new Date();
    var bs = todayBs();
    var bsParts = bs.split('-');
    var bsMonth = (typeof BS_MONTHS !== 'undefined' && BS_MONTHS[parseInt(bsParts[1])-1]) ? BS_MONTHS[parseInt(bsParts[1])-1] : ('Month '+bsParts[1]);
    var adStr = ad.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'short',year:'numeric'});
    return '🌐 ' + adStr + '   |   📅 ' + bsParts[2] + ' ' + bsMonth + ' ' + bsParts[0];
  },

  render: function(){
    try { this.renderTemplates(); } catch(e){}
    // Update header date display
    var disp = document.getElementById('pl-today-display');
    if(disp) disp.innerHTML = this._todayDisplay();
    // Populate customer dropdown
    this._populateCustDropdown();

    var list = this.getData();
    var todayBs_ = todayBs();
    var view = this._filter || 'today';
    var filtered = [];
    if(view === 'today'){
      filtered = list.filter(function(t){return t.dateBs === todayBs_ && t.status !== 'done';});
    } else if(view === 'tomorrow'){
      // Compute tomorrow BS by adding 1 day to AD then converting
      var tmr = new Date(); tmr.setDate(tmr.getDate()+1);
      var tmrBs = (typeof adToBs === 'function') ? adToBs(tmr) : todayBs_;
      filtered = list.filter(function(t){return t.dateBs === tmrBs && t.status !== 'done';});
    } else if(view === 'week'){
      // Next 7 days (BS dates)
      var weekDates = [];
      for(var i=0;i<7;i++){
        var d = new Date(); d.setDate(d.getDate()+i);
        var b = (typeof adToBs === 'function') ? adToBs(d) : null;
        if(b) weekDates.push(b);
      }
      filtered = list.filter(function(t){return weekDates.indexOf(t.dateBs)>=0 && t.status!=='done';});
    } else if(view === 'overdue'){
      filtered = list.filter(function(t){return t.status!=='done' && t.dateBs && compareBs(t.dateBs, todayBs_)<0;});
    } else if(view === 'done'){
      filtered = list.filter(function(t){return t.status === 'done';});
    } else { // all
      filtered = list.slice();
    }

    // Update count chips
    var countToday = list.filter(function(t){return t.dateBs===todayBs_ && t.status!=='done';}).length;
    var tmrDate = new Date(); tmrDate.setDate(tmrDate.getDate()+1);
    var tmrBsKey = (typeof adToBs === 'function') ? adToBs(tmrDate) : null;
    var countTmr = tmrBsKey ? list.filter(function(t){return t.dateBs===tmrBsKey && t.status!=='done';}).length : 0;
    var countOver = list.filter(function(t){return t.status!=='done' && t.dateBs && compareBs(t.dateBs, todayBs_)<0;}).length;
    var setCnt = function(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; };
    setCnt('pl-cnt-today', countToday);
    setCnt('pl-cnt-tomorrow', countTmr);
    setCnt('pl-cnt-overdue', countOver);

    var listEl = document.getElementById('pl-list');
    var emptyEl = document.getElementById('pl-empty');
    if(!listEl) return;
    if(!filtered.length){
      listEl.innerHTML = '';
      if(emptyEl) emptyEl.style.display = '';
      return;
    }
    if(emptyEl) emptyEl.style.display = 'none';

    // Sort: by date asc, then time asc
    filtered.sort(function(a,b){
      var d = (a.dateBs||'').localeCompare(b.dateBs||'');
      if(d !== 0) return d;
      return (a.time||'00:00').localeCompare(b.time||'00:00');
    });

    // Group by date
    var groups = {};
    filtered.forEach(function(t){
      var key = t.dateBs || 'no-date';
      if(!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    var html = '';
    Object.keys(groups).forEach(function(dateKey){
      var dateLabel = Planner._dateLabel(dateKey, todayBs_);
      html += '<div style="margin-bottom:14px;">'
        + '<div style="font-size:0.78rem;font-weight:800;color:var(--accent);margin-bottom:6px;padding:5px 10px;background:var(--surface-2);border-radius:6px;display:inline-block;">'+dateLabel+'</div>';
      groups[dateKey].forEach(function(t){
        html += Planner._cardHtml(t, todayBs_);
      });
      html += '</div>';
    });
    listEl.innerHTML = html;
  },

  _dateLabel: function(dateKey, todayBs_){
    if(dateKey === 'no-date') return '📌 No date';
    if(dateKey === todayBs_) return '📅 आज (Today) — ' + bsStringToDisplay(dateKey);
    var cmp = compareBs(dateKey, todayBs_);
    if(cmp < 0) return '⚠️ ' + bsStringToDisplay(dateKey) + ' (Overdue)';
    // Tomorrow check
    var tmr = new Date(); tmr.setDate(tmr.getDate()+1);
    var tmrBs = (typeof adToBs === 'function') ? adToBs(tmr) : null;
    if(tmrBs && dateKey === tmrBs) return '⏭️ भोलि (Tomorrow) — ' + bsStringToDisplay(dateKey);
    return '📅 ' + bsStringToDisplay(dateKey);
  },

  _cardHtml: function(t, todayBs_){
    var cat = this.CATEGORIES[t.category] || this.CATEGORIES.other;
    var pri = this.PRIORITIES[t.priority] || this.PRIORITIES.normal;
    var done = t.status === 'done';
    var overdue = !done && t.dateBs && compareBs(t.dateBs, todayBs_) < 0;
    var border = done ? 'var(--green)' : (overdue ? 'var(--red)' : pri.color);
    var bg = done ? 'var(--surface-2)' : 'var(--surface)';
    var opacity = done ? '0.65' : '1';
    var phoneClean = (t.custPhone||'').replace(/[^0-9]/g,'');
    var waMsg = encodeURIComponent((t.title||'') + (t.content?'\n\n'+t.content:''));
    var waBtn = phoneClean
      ? '<button onclick="event.stopPropagation();window.open(\'https://wa.me/977'+phoneClean+'?text='+waMsg+'\',\'_blank\')" class="btn btn-xs btn-wa" title="WhatsApp '+t.custName+'">📱 WA</button>'
      : (t.category==='wa' ? '<button onclick="event.stopPropagation();window.open(\'https://wa.me/?text='+waMsg+'\',\'_blank\')" class="btn btn-xs btn-wa" title="WhatsApp">📱 WA</button>' : '');
    return '<div style="background:'+bg+';border:1px solid var(--border);border-left:4px solid '+border+';border-radius:10px;padding:11px 14px;margin-bottom:6px;opacity:'+opacity+';">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">'
        + '<div style="flex:1;min-width:200px;">'
          + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">'
            + (t.time?'<span style="font-size:0.74rem;font-weight:700;color:var(--accent);background:var(--surface-2);padding:2px 8px;border-radius:10px;">⏰ '+t.time+'</span>':'')
            + '<span style="font-size:0.72rem;background:'+cat.color+'22;color:'+cat.color+';padding:2px 8px;border-radius:10px;font-weight:700;">'+cat.icon+' '+cat.label+'</span>'
            + (t.priority==='urgent'?'<span style="font-size:0.7rem;background:#ef444422;color:#ef4444;padding:2px 8px;border-radius:10px;font-weight:700;">🔴 Urgent</span>':'')
            + (t.notified?'<span style="font-size:0.65rem;color:var(--text-muted);" title="Notification fired">🔔</span>':'')
          + '</div>'
          + '<div style="font-size:0.92rem;font-weight:700;'+(done?'text-decoration:line-through;color:var(--text-muted);':'')+'">'+esc(t.title||'(Untitled)')+'</div>'
          + (t.content?'<div style="font-size:0.78rem;color:var(--text-muted);margin-top:3px;white-space:pre-wrap;">'+esc(t.content)+'</div>':'')
          + (t.custName?'<div style="font-size:0.74rem;color:var(--text-muted);margin-top:4px;">👤 '+esc(t.custName)+(t.custPhone?' • '+esc(t.custPhone):'')+'</div>':'')
        + '</div>'
        + '<div class="btn-group" style="display:flex;gap:4px;flex-wrap:wrap;">'
          + '<button onclick="Planner.toggleDone(\''+t.id+'\')" class="btn btn-xs '+(done?'btn-secondary':'btn-success')+'" title="'+(done?'Mark pending':'Mark done')+'">'+(done?'↩':'✅')+'</button>'
          + waBtn
          + '<button onclick="Planner.edit(\''+t.id+'\')" class="btn btn-xs btn-secondary" title="Edit">✏️</button>'
          + '<button onclick="Planner.del(\''+t.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  },

  // ── DROPDOWN HELPERS ──
  _populateCustDropdown: function(){
    var sel = document.getElementById('pl-cust');
    if(!sel) return;
    var custs = (STORE.get('pk3_customers',[])||[]);
    sel.innerHTML = '<option value="">— None —</option>'
      + custs.map(function(c){
          return '<option value="'+c.id+'">'+esc(c.name)+(c.phone?' ('+esc(c.phone)+')':'')+'</option>';
        }).join('');
  },

  // ── ADD / EDIT MODAL ──
  openAddModal: function(){
    setVal('pl-edit-id','');
    setVal('pl-title','');
    setVal('pl-content','');
    var t = todayBs();
    setVal('pl-date', t);
    var dt = document.getElementById('pl-date-text');
    if(dt) dt.textContent = '📅 ' + bsStringToDisplay(t) + ' (आज)';
    var now = new Date();
    var nextHr = ((now.getHours()+1)<10?'0':'') + (now.getHours()+1) + ':00';
    setVal('pl-time', nextHr);
    setVal('pl-category','other');
    setVal('pl-priority','normal');
    setVal('pl-cust','');
    var rem = document.getElementById('pl-reminder'); if(rem) rem.checked = true;
    setText('pl-modal-title','📝 New Task');
    this._populateCustDropdown();
    document.getElementById('pl-modal').classList.add('open');
  },

  edit: function(id){
    var t = this.getData().find(function(x){return x.id===id;});
    if(!t){ App.toast('Task not found','error'); return; }
    setVal('pl-edit-id', t.id);
    setVal('pl-title', t.title||'');
    setVal('pl-content', t.content||'');
    setVal('pl-date', t.dateBs||todayBs());
    var dt = document.getElementById('pl-date-text');
    if(dt) dt.textContent = '📅 ' + bsStringToDisplay(t.dateBs||todayBs());
    setVal('pl-time', t.time||'09:00');
    setVal('pl-category', t.category||'other');
    setVal('pl-priority', t.priority||'normal');
    this._populateCustDropdown();
    setVal('pl-cust', t.custId||'');
    var rem = document.getElementById('pl-reminder'); if(rem) rem.checked = (t.reminder !== false);
    setText('pl-modal-title','✏️ Edit Task');
    document.getElementById('pl-modal').classList.add('open');
  },

  // ── READY-MADE TASK TEMPLATES (v5.9) ──
  TEMPLATES: [
    { icon:'📞', title:'Follow-up call',        cat:'call',     time:'10:00', pr:'normal' },
    { icon:'💰', title:'Payment reminder',       cat:'payment',  time:'11:00', pr:'urgent' },
    { icon:'🚗', title:'Site visit / measurement', cat:'visit',   time:'14:00', pr:'normal' },
    { icon:'📦', title:'Delivery',                cat:'delivery', time:'12:00', pr:'normal' },
    { icon:'📱', title:'WhatsApp reply',          cat:'wa',       time:'09:30', pr:'normal' },
    { icon:'🏢', title:'Client meeting',          cat:'meeting',  time:'15:00', pr:'normal' },
    { icon:'🔧', title:'Installation work',       cat:'visit',    time:'10:00', pr:'normal' },
    { icon:'🔔', title:'Quotation follow-up',     cat:'reminder', time:'11:30', pr:'normal' }
  ],

  renderTemplates: function(){
    var box = document.getElementById('pl-templates');
    if(!box) return;
    box.innerHTML = this.TEMPLATES.map(function(t, i){
      return '<button type="button" onclick="Planner.addTemplate('+i+')" '
        + 'style="display:inline-flex;align-items:center;gap:5px;font-size:0.74rem;padding:5px 11px;'
        + 'background:var(--surface-2);border:1px solid var(--border);border-radius:20px;color:var(--text);'
        + 'cursor:pointer;white-space:nowrap;" '
        + 'onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
        + t.icon + ' ' + esc(t.title) + '</button>';
    }).join('');
  },

  addTemplate: function(i){
    var tpl = this.TEMPLATES[i];
    if(!tpl) return;
    var rec = {
      id: 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),
      title: tpl.title,
      content: '',
      dateBs: todayBs(),
      time: tpl.time || '09:00',
      category: tpl.cat || 'other',
      priority: tpl.pr || 'normal',
      status: 'pending',
      custId: '', custName: '', custPhone: '',
      reminder: true,
      notified: false,
      created: new Date().toISOString()
    };
    var list = this.getData();
    list.push(rec);
    var ok = this.setData(list);
    try { Audit.log('PLANNER','Template task added: '+tpl.title); } catch(e){}
    App.toast(ok===false ? '⚠️ Save असफल — फेरि प्रयास' : ('✅ '+tpl.title+' थपियो'), ok===false?'error':'success', 1600);
    this.render();
    this.updateBadge();
  },

  quickAdd: function(){
    var title = getVal('pl-quick-title').trim();
    if(!title){ App.toast('Task title चाहिन्छ','error'); return; }
    var time = getVal('pl-quick-time') || '09:00';
    var cat = getVal('pl-quick-cat') || 'other';
    var rec = {
      id: 'p_'+Date.now().toString(36),
      title: title,
      content: '',
      dateBs: todayBs(),
      time: time,
      category: cat,
      priority: 'normal',
      status: 'pending',
      custId: '',
      custName: '',
      custPhone: '',
      reminder: true,
      notified: false,
      created: new Date().toISOString()
    };
    var list = this.getData();
    list.push(rec);
    this.setData(list);
    setVal('pl-quick-title','');
    try { Audit.log('PLANNER','Quick task added: '+title); } catch(e){}
    App.toast('✅ Task added','success',1500);
    this.render();
    this.updateBadge();
  },

  save: function(){
    var title = getVal('pl-title').trim();
    if(!title){ App.toast('Title चाहिन्छ','error'); return; }
    var custId = getVal('pl-cust');
    var custName = '', custPhone = '';
    if(custId){
      var c = (STORE.get('pk3_customers',[])||[]).find(function(x){return x.id===custId;});
      if(c){ custName = c.name; custPhone = c.phone; }
    }
    var editId = getVal('pl-edit-id');
    var list = this.getData();
    var rec = {
      title: title,
      content: getVal('pl-content'),
      dateBs: getVal('pl-date') || todayBs(),
      time: getVal('pl-time') || '09:00',
      category: getVal('pl-category') || 'other',
      priority: getVal('pl-priority') || 'normal',
      custId: custId,
      custName: custName,
      custPhone: custPhone,
      reminder: !!(document.getElementById('pl-reminder')||{}).checked,
      notified: false  // reset on edit so reminders fire again
    };
    if(editId){
      var idx = list.findIndex(function(x){return x.id===editId;});
      if(idx >= 0){
        // Preserve status, id, created
        rec.id = list[idx].id;
        rec.status = list[idx].status || 'pending';
        rec.created = list[idx].created;
        rec.updated = new Date().toISOString();
        list[idx] = rec;
        try { Audit.log('PLANNER','Task edited: '+title); } catch(e){}
      }
    } else {
      rec.id = 'p_'+Date.now().toString(36);
      rec.status = 'pending';
      rec.created = new Date().toISOString();
      list.push(rec);
      try { Audit.log('PLANNER','Task added: '+title); } catch(e){}
    }
    this.setData(list);
    document.getElementById('pl-modal').classList.remove('open');
    App.toast('💾 Saved','success');
    this.render();
    this.updateBadge();
  },

  toggleDone: function(id){
    var list = this.getData();
    var t = list.find(function(x){return x.id===id;});
    if(!t) return;
    t.status = (t.status === 'done') ? 'pending' : 'done';
    t.completedAt = (t.status === 'done') ? new Date().toISOString() : null;
    this.setData(list);
    try { Audit.log('PLANNER',(t.status==='done'?'Done':'Reopened')+': '+t.title); } catch(e){}
    App.toast(t.status==='done' ? '✅ Done!' : '↩ Reopened','success',1500);
    this.render();
    this.updateBadge();
  },

  del: function(id){
    if(!confirm('Delete this task?')) return;
    var list = this.getData().filter(function(x){return x.id!==id;});
    this.setData(list);
    try { Audit.log('PLANNER','Task deleted'); } catch(e){}
    App.toast('🗑 Deleted','info',1500);
    this.render();
    this.updateBadge();
  }
};

