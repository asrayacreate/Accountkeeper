// ============================================================
// JS PART M: Dashboard, BSCal, CRMClock modules
// ============================================================

var Dashboard = {
  _metric: 'income',
  render: function(){
    try{ BackupAlert.render(); }catch(e){}
    try{ SmartRem.render(); }catch(e){}
    try{
      var custs    = SampleData.real(STORE.get('pk3_customers',[])||[]);
      var quots    = SampleData.real(STORE.get('pk3_quotations',[])||[]);
      var followups= SampleData.real(STORE.get('pk3_followups',[])||[]);
      var db       = SampleData.real(STORE.get('pk3_daybook',[])||[]);
      var staff    = SampleData.real(STORE.get('pk3_staff',[])||[]);
      var stock    = SampleData.real(STORE.get('pk3_stock',[])||[]);
      var walkins  = SampleData.real(STORE.get('pk3_walkins',[])||[]);
      var activity = SampleData.real(STORE.get('pk3_activity',[])||[]);
      var today    = todayBs();
      var todayISO_= todayISO();

      // ── Stat cards ──
      setText('s-cust', custs.length);
      setText('s-quotes', quots.length);
      var pending = quots.filter(function(q){var s=(q.status||'').toLowerCase(); return s==='pending'||s==='';}).length;
      setText('s-ongoing', pending);
      var todayIncome = db.filter(function(d){return d.date===todayISO_&&(d.type==='income'||d.type==='receipt');}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      // Advance: stored as type='income' with cat='Advance' (see Customers.save)
      var todayAdv    = db.filter(function(d){return d.date===todayISO_&&(d.type==='advance'||d.cat==='Advance');}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      setText('s-income', fmtRs(todayIncome));
      setText('s-advance', fmtRs(todayAdv));
      var fuToday  = followups.filter(function(f){return (f.nextDate||f.date||'')===todayBs();}).length;
      var fuOverdue= followups.filter(function(f){var d=(f.nextDate||f.date||''); return d<todayBs()&&f.status!=='done';}).length;
      setText('s-today', fuToday);
      setText('s-overdue', fuOverdue);
      // ── आजको Snapshot: daily P&L + due tracking (v5.9) ──
      try {
        var _tIncome = db.filter(function(d){return d.date===todayISO_&&(d.type==='income'||d.type==='receipt'||d.type==='advance');}).reduce(function(a,d){return a+(parseFloat(d.amount)||0);},0);
        var _tExpense = db.filter(function(d){return d.date===todayISO_&&(d.type==='expense'||d.type==='payment');}).reduce(function(a,d){return a+(parseFloat(d.amount)||0);},0);
        var _tNet = _tIncome - _tExpense;
        setText('snap-income', fmtRs(_tIncome));
        setText('snap-expense', fmtRs(_tExpense));
        var _netEl = document.getElementById('snap-net');
        if(_netEl){ _netEl.textContent = fmtRs(Math.abs(_tNet)); _netEl.style.color = _tNet>=0 ? 'var(--green)' : 'var(--red)'; }
        var _sd = document.getElementById('snap-date'); if(_sd) _sd.textContent = bsStringToDisplay(today);
        // due chips: followups today/overdue + planner today/overdue
        var _plList = (typeof Planner!=='undefined') ? Planner.getData() : [];
        var _plToday = _plList.filter(function(t){return t.dateBs===today && t.status!=='done';}).length;
        var _plOver  = _plList.filter(function(t){return t.dateBs<today && t.status!=='done';}).length;
        var _chips = [];
        if(fuToday)   _chips.push(['#eab308','\U0001f4c5 FU आज: '+fuToday,'followups']);
        if(fuOverdue) _chips.push(['#ef4444','\u23f0 FU बाँकी: '+fuOverdue,'followups']);
        if(_plToday)  _chips.push(['#3b82f6','\U0001f4dd Task आज: '+_plToday,'planner']);
        if(_plOver)   _chips.push(['#ef4444','\u23f0 Task बाँकी: '+_plOver,'planner']);
        var _dueEl = document.getElementById('snap-due');
        if(_dueEl){
          if(!_chips.length){ _dueEl.innerHTML = '<span style="font-size:0.74rem;color:var(--green);">\u2705 आज केही बाँकी छैन</span>'; }
          else _dueEl.innerHTML = _chips.map(function(c){ return '<span onclick="App.navigate(\''+c[2]+'\')" style="cursor:pointer;font-size:0.72rem;font-weight:700;padding:4px 11px;border-radius:20px;background:'+c[0]+'18;color:'+c[0]+';border:1px solid '+c[0]+'44;">'+c[1]+'</span>'; }).join('');
        }
        this._snapCache = {income:_tIncome, expense:_tExpense, net:_tNet, fuToday:fuToday, fuOverdue:fuOverdue, plToday:_plToday, plOver:_plOver};
      } catch(e){ console.warn('snapshot', e); }
      setText('s-staff', staff.length);
      var lowStock = (typeof Stock!=='undefined' && Stock.isLow) ? stock.filter(function(s){return Stock.isLow(s);}).length : 0;
      setText('s-lowstock', lowStock);
      try{ Stock.renderDashAlert(); }catch(e){}

      // ── Dash username ──
      if(currentUser) setText('dash-username', currentUser.name||'User');

      // ── Clock & date ──
      var now = new Date();
      var h=now.getHours(),m=now.getMinutes(),s=now.getSeconds();
      var ap=h>=12?'PM':'AM'; h=h%12||12;
      setText('dash-clock',(h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s+' '+ap);
      setText('dash-date-sub','बि.सं. '+today);

      // ── DayBook summary ──
      var dbToday = db.filter(function(d){return d.date===todayISO_;});
      var dbInc = dbToday.filter(function(d){return d.type==='income'||d.type==='receipt';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      var dbExp = dbToday.filter(function(d){return d.type==='expense'||d.type==='payment';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      setText('dash-db-income', fmtRs(dbInc));
      setText('dash-db-expense', fmtRs(dbExp));
      var netEl = document.getElementById('dash-db-net');
      if(netEl){netEl.textContent=fmtRs(Math.abs(dbInc-dbExp)); netEl.style.color=(dbInc-dbExp)>=0?'var(--green)':'var(--red)';}
      var dbListEl = document.getElementById('dash-db-list');
      if(dbListEl) dbListEl.innerHTML = dbToday.slice(-6).reverse().map(function(d){
        return '<tr><td style="font-size:0.72rem;">'+esc(d.narration||d.description||'-')+'</td><td style="text-align:right;font-size:0.72rem;color:'+(d.type==='income'||d.type==='receipt'?'var(--green)':'var(--red)')+';">'+fmtRs(parseFloat(d.amount||0))+'</td></tr>';
      }).join('');

      // ── Recent customers ──
      var custEl = document.getElementById('dash-custs');
      if(custEl){
        var recent = custs.slice(-5).reverse();
        custEl.innerHTML = '';
        if (!recent.length) {
          custEl.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.82rem;">No customers yet</div>';
        } else {
          recent.forEach(function(c){
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);';
            // Avatar
            var av = document.createElement('div');
            av.style.cssText = 'width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.85rem;flex-shrink:0;';
            av.textContent = (c.name||'?').charAt(0).toUpperCase();
            // Info
            var info = document.createElement('div');
            info.style.cssText = 'flex:1;min-width:0;';
            var nm = document.createElement('div');
            nm.style.cssText = 'font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);';
            nm.textContent = c.name || 'ग्राहक';
            var sub = document.createElement('div');
            sub.style.cssText = 'font-size:0.7rem;color:var(--text-muted);display:flex;gap:6px;flex-wrap:wrap;';
            var phoneSpan = document.createElement('span'); phoneSpan.textContent = c.phone || '—';
            var _svcTxt = Customers.getServices(c).map(function(x){return x.work;}).filter(Boolean).join(' · ') || c.service || '';
            var serviceSpan = document.createElement('span'); serviceSpan.style.color='var(--accent)'; serviceSpan.textContent = _svcTxt;
            sub.appendChild(phoneSpan); if(_svcTxt) sub.appendChild(serviceSpan);
            info.appendChild(nm); info.appendChild(sub);
            // Action buttons
            var actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
            if (c.phone) {
              var waBtn = document.createElement('button');
              waBtn.className = 'btn btn-xs btn-wa'; waBtn.textContent = '📱';
              waBtn.title = 'WhatsApp';
              waBtn.onclick = function(){
                var ph = (c.phone||'').replace(/[^0-9]/g,'');
                var msg = fillTemplate(Followups._defTpl()[0], c);
                window.open('https://wa.me/977'+ph+'?text='+encodeURIComponent(msg), '_blank');
              };
              actions.appendChild(waBtn);
            }
            var viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-xs btn-secondary'; viewBtn.textContent = '👁️';
            viewBtn.title = 'View';
            viewBtn.onclick = function(){ App.navigate('customers'); };
            actions.appendChild(viewBtn);
            row.appendChild(av); row.appendChild(info); row.appendChild(actions);
            custEl.appendChild(row);
          });
        }
      }

      // ── Today follow-ups ──
      var fuEl = document.getElementById('dash-fu');
      if(fuEl){
        var dueFu = followups.filter(function(f){return (f.nextDate||f.date||'')<=todayBs()&&f.status!=='done';}).slice(0,6);
        fuEl.innerHTML = '';
        if (!dueFu.length) {
          fuEl.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.82rem;">✅ No due follow-ups</div>';
        } else {
          dueFu.forEach(function(f){
            var overdue = (f.nextDate||f.date||'') < todayBs();
            var row = document.createElement('div');
            row.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--border);';
            // Top row: name + status badge
            var top = document.createElement('div');
            top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px;';
            var nm = document.createElement('div');
            nm.style.cssText = 'font-size:0.82rem;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            nm.textContent = f.custName || 'ग्राहक';
            var badge = document.createElement('span');
            badge.style.cssText = 'font-size:0.66rem;padding:2px 8px;border-radius:10px;color:#fff;flex-shrink:0;background:'+(overdue?'var(--red)':'var(--yellow)');
            badge.textContent = overdue ? 'Overdue' : 'Today';
            top.appendChild(nm); top.appendChild(badge);
            // Middle: phone + date
            var mid = document.createElement('div');
            mid.style.cssText = 'display:flex;gap:8px;font-size:0.7rem;color:var(--text-muted);margin-top:2px;';
            if (f.phone || f.custPhone) { var p = document.createElement('span'); p.textContent = '📞 '+(f.phone||f.custPhone); mid.appendChild(p); }
            var d = document.createElement('span'); d.textContent = '📅 '+(f.nextDate||f.date||''); mid.appendChild(d);
            // Note
            var noteText = f.note || f.reason || '';
            row.appendChild(top); row.appendChild(mid);
            if (noteText) {
              var note = document.createElement('div');
              note.style.cssText = 'font-size:0.72rem;color:var(--text);margin-top:3px;font-style:italic;opacity:0.85;';
              note.textContent = '"' + noteText.slice(0,80) + (noteText.length>80?'…':'') + '"';
              row.appendChild(note);
            }
            fuEl.appendChild(row);
          });
        }
      }

      // ── Activity ──
      this.renderActivity(activity);

      // ── Daily Planner widget (v4.0.7) ──
      this.plRender();

      // ── Business Overview Round Chart (v4.1) ──
      try { this.renderRoundChart(); } catch(e){ console.warn('RoundChart error',e); }

      // ── Greeting line (v4.8) ──
      try { Greet.render(); } catch(e){}

      // ── Rate list preview ──
      this.renderRateList();

      // ── Brochures ──
      var brocEl = document.getElementById('dash-brochure-list');
      if(brocEl){
        var brocs = STORE.get('pk3_templates',[])||[];
        brocEl.innerHTML = brocs.length ? brocs.slice(0,3).map(function(b){
          return '<div style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:0.82rem;font-weight:600;">'+esc(b.name||b.title||'Template')+'</div>';
        }).join('') : '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No templates yet</div>';
      }

      // ── Charts ──
      this.renderSummaryCharts(db, custs, quots);
      this.renderTotalChart();
      // ── v7.1.0: 6-month Sales vs Expense, Receivables vs Payables, Top 5 ──
      try { if(typeof DashCharts!=='undefined') DashCharts.render(); } catch(e){ console.warn('DashCharts', e); }
    } catch(e){ console.error('Dashboard.render error:',e); }
  },

  renderRateList: function(){
    var el = document.getElementById('dash-rate-list');
    if(!el) return;
    var rates = STORE.get('pk3_rates',null);
    if(!rates || Object.keys(rates).length===0){ RateList.resetDefaults(true); rates = STORE.get('pk3_rates',{}); }
    var q = (getVal('dash-rl-search')||'').toLowerCase();
    var rows = [];
    Object.keys(rates).forEach(function(cat){
      (rates[cat]||[]).forEach(function(item){
        if(!q || (item.name||'').toLowerCase().includes(q) || cat.toLowerCase().includes(q)){
          rows.push({cat:cat, name:item.name||'', rate:item.rate||0, unit:item.unit||''});
        }
      });
    });
    el.innerHTML = rows.slice(0,20).map(function(r){
      return '<tr>'
        +'<td style="font-size:0.72rem;color:var(--text-muted);">'+esc(r.cat)+'</td>'
        +'<td style="font-size:0.78rem;font-weight:600;">'+esc(r.name)+'</td>'
        +'<td style="font-size:0.78rem;text-align:right;color:var(--green);">'+fmtRs(r.rate)+'/'+esc(r.unit)+'</td>'
        +'</tr>';
    }).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">No rates found</td></tr>';
  },

  renderActivity: function(activity){
    var el = document.getElementById('dash-activity');
    if(!el) return;
    var list = (activity||[]).slice(-8).reverse();
    el.innerHTML = list.length ? list.map(function(a){
      return '<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.76rem;">'
        +'<span style="color:var(--accent);flex-shrink:0;">•</span>'
        +'<span style="flex:1;">'+esc(a.text||a)+'</span>'
        +'<span style="color:var(--text-muted);flex-shrink:0;font-size:0.68rem;">'+esc(a.time||'')+'</span>'
        +'</div>';
    }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:10px;font-size:0.8rem;">No recent activity</div>';
  },

  clearActivity: function(){
    if(!confirm('Clear all activity log?')) return;
    STORE.set('pk3_activity',[]);
    this.renderActivity([]);
    App.toast('Activity cleared','success');
  },

  // ─── DASHBOARD PLANNER WIDGET (v4.0.7) ──────────────────────────
  _plTab: 'today',  // current tab: today | tomorrow | overdue

  // आजको सारांश notification (v5.9)
  notifyToday: function(){
    var c = this._snapCache || {};
    var netTxt = (c.net>=0?'नाफा ':'घाटा ') + fmtRs(Math.abs(c.net||0));
    var dueBits = [];
    if(c.fuToday)   dueBits.push(c.fuToday+' FU आज');
    if(c.fuOverdue) dueBits.push(c.fuOverdue+' FU बाँकी');
    if(c.plToday)   dueBits.push(c.plToday+' task आज');
    if(c.plOver)    dueBits.push(c.plOver+' task बाँकी');
    var body = 'Income '+fmtRs(c.income||0)+' • Expense '+fmtRs(c.expense||0)+' • '+netTxt
             + (dueBits.length ? '\n\u23f0 '+dueBits.join(', ') : '\n\u2705 आज केही बाँकी छैन');
    var coName = (STORE.get('pk3_settings',{})||{}).companyName || 'CRM';
    if(('Notification' in window) && Notification.permission==='granted'){
      try { new Notification('\U0001f4c5 '+coName+' — आजको रिपोर्ट', {body:body, icon:''}); App.toast('\U0001f514 Notification पठाइयो','success',1600); }
      catch(e){ App.toast(body.replace(/\n/g,'  '),'info',5000); }
    } else if(('Notification' in window) && Notification.permission!=='denied'){
      Notification.requestPermission().then(function(r){ if(r==='granted') Dashboard.notifyToday(); else App.toast(body.replace(/\n/g,'  '),'info',5000); });
    } else {
      App.toast(body.replace(/\n/g,'  '),'info',5000);
    }
  },

  plTab: function(tab){
    this._plTab = tab;
    ['today','tomorrow','overdue'].forEach(function(t){
      var btn = document.getElementById('dash-pl-tab-'+t);
      if(btn) btn.className = 'btn btn-xs ' + (t===tab ? 'btn-primary' : 'btn-secondary');
    });
    this.plRender();
  },

  plRender: function(){
    if(typeof Planner === 'undefined') return;
    var list = Planner.getData();
    var todayBs_ = todayBs();
    // Compute tomorrow BS
    var tmr = new Date(); tmr.setDate(tmr.getDate()+1);
    var tmrBs = (typeof adToBs === 'function') ? adToBs(tmr) : todayBs_;
    // Counts
    var countToday = list.filter(function(t){return t.dateBs===todayBs_ && t.status!=='done';}).length;
    var countTmr   = list.filter(function(t){return t.dateBs===tmrBs && t.status!=='done';}).length;
    var countOver  = list.filter(function(t){return t.status!=='done' && t.dateBs && compareBs(t.dateBs, todayBs_)<0;}).length;
    var totalToday = countToday;  // header pill = today's pending
    var setTxt = function(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; };
    setTxt('dash-pl-count', totalToday);
    setTxt('dash-pl-tab-today-cnt', countToday);
    setTxt('dash-pl-tab-tomorrow-cnt', countTmr);
    setTxt('dash-pl-tab-overdue-cnt', countOver);
    // Notification status indicator
    var nStat = document.getElementById('dash-pl-notif-status');
    var nBtn  = document.getElementById('dash-pl-notif-btn');
    if(nStat && nBtn){
      if(!('Notification' in window)){
        nStat.textContent = '· alerts unsupported';
        nBtn.style.display = 'none';
      } else if(Notification.permission === 'granted'){
        nStat.textContent = '· 🔔 alerts on';
        nStat.style.color = 'var(--green)';
        nBtn.style.display = 'none';
      } else if(Notification.permission === 'denied'){
        nStat.textContent = '· 🔕 alerts blocked';
        nStat.style.color = 'var(--red)';
        nBtn.style.display = 'none';
      } else {
        nStat.textContent = '';
        nBtn.style.display = '';
      }
    }
    // Filter based on current tab
    var view = this._plTab || 'today';
    var filtered = [];
    if(view === 'today')        filtered = list.filter(function(t){return t.dateBs===todayBs_ && t.status!=='done';});
    else if(view === 'tomorrow') filtered = list.filter(function(t){return t.dateBs===tmrBs && t.status!=='done';});
    else                          filtered = list.filter(function(t){return t.status!=='done' && t.dateBs && compareBs(t.dateBs, todayBs_)<0;});
    // Sort by time
    filtered.sort(function(a,b){return (a.time||'00:00').localeCompare(b.time||'00:00');});
    var listEl = document.getElementById('dash-pl-list');
    if(!listEl) return;
    if(!filtered.length){
      var emptyMsg = view==='today' ? '🌟 आजको कुनै task छैन — माथिबाट थप्नुस्'
                   : view==='tomorrow' ? '✨ भोलिको कुनै task छैन'
                   : '🎉 कुनै task overdue छैन — सबै up to date!';
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.84rem;padding:18px 12px;">'+emptyMsg+'</div>';
      return;
    }
    var cats = Planner.CATEGORIES || {};
    listEl.innerHTML = filtered.slice(0, 8).map(function(t){
      var cat = cats[t.category] || cats.other || {icon:'📋', label:'Other', color:'#94a3b8'};
      var phoneClean = (t.custPhone||'').replace(/[^0-9]/g,'');
      var waMsg = encodeURIComponent((t.title||'') + (t.content?'\n\n'+t.content:''));
      var waBtn = phoneClean
        ? '<button onclick="event.stopPropagation();window.open(\'https://wa.me/977'+phoneClean+'?text='+waMsg+'\',\'_blank\')" class="btn btn-xs btn-wa" title="WhatsApp" style="padding:3px 8px;font-size:0.7rem;">📱</button>'
        : '';
      var overdue = t.dateBs && compareBs(t.dateBs, todayBs_) < 0;
      var border = overdue ? 'var(--red)' : (t.priority==='urgent' ? '#ef4444' : cat.color);
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface);border-left:3px solid '+border+';border-radius:6px;margin-bottom:5px;font-size:0.8rem;">'
        + '<button onclick="Dashboard.plToggleDone(\''+t.id+'\')" class="btn btn-xs btn-success" style="padding:3px 8px;font-size:0.72rem;flex-shrink:0;" title="Mark done">✅</button>'
        + (t.time?'<span style="font-size:0.7rem;font-weight:700;color:var(--accent);background:var(--surface-2);padding:2px 6px;border-radius:6px;flex-shrink:0;">⏰ '+t.time+'</span>':'')
        + '<span style="font-size:0.74rem;background:'+cat.color+'22;color:'+cat.color+';padding:2px 6px;border-radius:6px;font-weight:700;flex-shrink:0;">'+cat.icon+'</span>'
        + '<div style="flex:1;min-width:0;overflow:hidden;">'
          + '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(t.priority==='urgent'?'color:#ef4444;':'')+'">'+esc(t.title||'')+'</div>'
          + (t.custName?'<div style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 '+esc(t.custName)+'</div>':'')
        + '</div>'
        + waBtn
        + '<button onclick="Planner.edit(\''+t.id+'\');App.navigate(\'planner\');" class="btn btn-xs btn-secondary" style="padding:3px 8px;font-size:0.7rem;flex-shrink:0;" title="Edit">✏️</button>'
      + '</div>';
    }).join('') + (filtered.length > 8 ? '<div style="text-align:center;padding:6px;"><button onclick="App.navigate(\'planner\')" class="btn btn-xs btn-secondary">+ '+(filtered.length-8)+' more — Open full planner →</button></div>' : '');
  },

  plQuickAdd: function(){
    if(typeof Planner === 'undefined') return;
    var title = getVal('dash-pl-quick-title').trim();
    if(!title){ App.toast('Task title चाहिन्छ','error'); return; }
    var time = getVal('dash-pl-quick-time') || '09:00';
    var cat = getVal('dash-pl-quick-cat') || 'other';
    // Decide date by current tab: tomorrow → tomorrow's BS, else today
    var dateBs;
    if(this._plTab === 'tomorrow'){
      var tmr = new Date(); tmr.setDate(tmr.getDate()+1);
      dateBs = (typeof adToBs === 'function') ? adToBs(tmr) : todayBs();
    } else {
      dateBs = todayBs();
    }
    var rec = {
      id: 'p_'+Date.now().toString(36),
      title: title,
      content: '',
      dateBs: dateBs,
      time: time,
      category: cat,
      priority: 'normal',
      status: 'pending',
      custId: '', custName: '', custPhone: '',
      reminder: true,
      notified: false,
      created: new Date().toISOString()
    };
    var list = Planner.getData();
    list.push(rec);
    Planner.setData(list);
    setVal('dash-pl-quick-title','');
    try { Audit.log('PLANNER','Quick task from dashboard: '+title); } catch(e){}
    App.toast('✅ Task added','success',1500);
    this.plRender();
    Planner.updateBadge();
  },

  plToggleDone: function(id){
    if(typeof Planner === 'undefined') return;
    Planner.toggleDone(id);
    this.plRender();
  },

  // ─── BUSINESS OVERVIEW ROUND CHART (v4.1) ──────────────────────
  // Pure SVG donut — income vs expense vs advance, center shows net profit/loss.
  // Legend chips show customers / followups / quotations counts.
  renderRoundChart: function(){
    var box = document.getElementById('dash-round-chart');
    if(!box) return;
    var period = getVal('rc-period') || 'all';
    var monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    var inRange = function(iso){
      if(period==='all') return true;
      if(!iso) return false;
      var d = new Date(iso); return !isNaN(d.getTime()) && d >= monthStart;
    };
    var custs = (STORE.get('pk3_customers',[])||[]).filter(function(c){return inRange(c.created||c.updated);});
    var fus   = (STORE.get('pk3_followups',[])||[]).filter(function(f){return f.status!=='Done';});
    var quots = (STORE.get('pk3_quotations',[])||[]).filter(function(q){return inRange(q.date||q.created);});
    var db    = (STORE.get('pk3_daybook',[])||[]).filter(function(d){return inRange(d.date||d.dateAd);});
    var income  = db.filter(function(d){return d.type==='income';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
    var expense = db.filter(function(d){return d.type==='expense';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
    var advance = custs.reduce(function(s,c){return s+parseFloat(c.advance||0);},0);
    var net = income - expense;
    var segs = [
      {label:'💰 Income',  val:income,  color:'#22c55e'},
      {label:'💸 Expense', val:expense, color:'#ef4444'},
      {label:'💵 Advance', val:advance, color:'#eab308'}
    ].filter(function(s){return s.val>0;});
    var total = segs.reduce(function(s,x){return s+x.val;},0);
    var svg;
    if(total <= 0){
      svg = '<div style="width:190px;height:190px;border-radius:50%;border:14px solid var(--surface-2);display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-muted);">'
        +'<div style="font-size:1.6rem;">📊</div><div style="font-size:0.68rem;margin-top:4px;">Data छैन</div></div>';
    } else {
      // Build SVG donut: r=70, circumference = 2πr
      var r=70, cx=95, cy=95, circ=2*Math.PI*r, offset=0;
      var circles = segs.map(function(s){
        var frac = s.val/total;
        var len = frac*circ;
        var el = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="26" '
          +'stroke-dasharray="'+len.toFixed(2)+' '+(circ-len).toFixed(2)+'" stroke-dashoffset="'+(-offset).toFixed(2)+'" '
          +'stroke-linecap="butt" transform="rotate(-90 '+cx+' '+cy+')"><title>'+s.label+': '+fmtRs(s.val)+' ('+Math.round(frac*100)+'%)</title></circle>';
        offset += len;
        return el;
      }).join('');
      svg = '<svg width="190" height="190" viewBox="0 0 190 190" style="flex-shrink:0;">'
        + '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--surface-2)" stroke-width="26"></circle>'
        + circles
        + '<text x="'+cx+'" y="'+(cy-8)+'" text-anchor="middle" style="font-size:11px;fill:var(--text-muted);font-weight:600;">Net '+(net>=0?'Profit':'Loss')+'</text>'
        + '<text x="'+cx+'" y="'+(cy+13)+'" text-anchor="middle" style="font-size:15px;font-weight:800;fill:'+(net>=0?'#22c55e':'#ef4444')+';">'+fmtRs(Math.abs(net))+'</text>'
        + '</svg>';
    }
    // Legend + count chips
    var legendRows = segs.map(function(s){
      var pct = total>0 ? Math.round(s.val/total*100) : 0;
      return '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;">'
        +'<span style="width:12px;height:12px;border-radius:3px;background:'+s.color+';flex-shrink:0;"></span>'
        +'<span style="flex:1;">'+s.label+'</span>'
        +'<span style="font-weight:700;">'+fmtRs(s.val)+'</span>'
        +'<span style="color:var(--text-muted);font-size:0.7rem;min-width:34px;text-align:right;">'+pct+'%</span>'
      +'</div>';
    }).join('');
    var countChips = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">'
      +'<span onclick="App.navigate(\'customers\')" style="cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:4px 10px;font-size:0.72rem;">👥 Customers: <b>'+custs.length+'</b></span>'
      +'<span onclick="App.navigate(\'followups\')" style="cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:4px 10px;font-size:0.72rem;">📅 Follow-ups: <b>'+fus.length+'</b></span>'
      +'<span onclick="App.navigate(\'quotations\')" style="cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:4px 10px;font-size:0.72rem;">📋 Quotations: <b>'+quots.length+'</b></span>'
      +'</div>';
    box.innerHTML = svg
      + '<div style="flex:1;min-width:220px;max-width:340px;display:flex;flex-direction:column;gap:7px;">'
      + (legendRows || '<div style="color:var(--text-muted);font-size:0.8rem;">Income/Expense/Advance data थपेपछि chart देखिन्छ</div>')
      + countChips
      + '</div>';
  },

  addQuickEntry: function(){
    var type = getVal('dash-db-type')||'income';
    var amt  = parseFloat(getVal('dash-db-amt')||0);
    var desc = getVal('dash-db-desc')||'Quick entry';
    if(!amt){ App.toast('Amount लेख्नुस्','error'); return; }
    var db = STORE.get('pk3_daybook',[])||[];
    db.push({id:uid(),date:todayISO(),type:type,amount:amt,narration:desc,created:new Date().toISOString()});
    STORE.set('pk3_daybook',db);
    setVal('dash-db-amt',''); setVal('dash-db-desc','');
    App.toast('✅ Entry added','success');
    this.render();
    addActivity(type+' entry: Rs.'+amt);
  },

  renderSummaryCharts: function(db, custs, quots){
    // Income vs Expense 7 days
    var cashEl = document.getElementById('dash-summary-cash');
    if(cashEl){
      var days7 = []; for(var i=6;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);days7.push(isoLocal(d));}
      var rows = days7.map(function(d){
        var inc = db.filter(function(x){return x.date===d&&(x.type==='income'||x.type==='receipt');}).reduce(function(s,x){return s+parseFloat(x.amount||0);},0);
        var exp = db.filter(function(x){return x.date===d&&(x.type==='expense'||x.type==='payment');}).reduce(function(s,x){return s+parseFloat(x.amount||0);},0);
        return {d:d.slice(5),inc:inc,exp:exp};
      });
      var maxV = Math.max.apply(null, rows.map(function(r){return Math.max(r.inc,r.exp);})) || 1;
      cashEl.innerHTML = '<div style="display:flex;align-items:flex-end;gap:4px;height:120px;padding:4px 0;">'
        +rows.map(function(r){
          var ih = Math.round((r.inc/maxV)*100); var eh = Math.round((r.exp/maxV)*100);
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">'
            +'<div style="width:100%;display:flex;gap:1px;align-items:flex-end;height:90px;">'
            +'<div style="flex:1;background:var(--green);border-radius:3px 3px 0 0;height:'+ih+'%;min-height:2px;" title="Income: '+fmtRs(r.inc)+'"></div>'
            +'<div style="flex:1;background:var(--red);border-radius:3px 3px 0 0;height:'+eh+'%;min-height:2px;" title="Expense: '+fmtRs(r.exp)+'"></div>'
            +'</div>'
            +'<div style="font-size:0.6rem;color:var(--text-muted);">'+r.d+'</div>'
            +'</div>';
        }).join('')+'</div>'
        +'<div style="display:flex;gap:12px;font-size:0.7rem;padding:4px 0;">'
        +'<span><span style="color:var(--green);">■</span> Income</span>'
        +'<span><span style="color:var(--red);">■</span> Expense</span>'
        +'</div>';
    }
    // Customers by service
    var svcEl = document.getElementById('dash-summary-svc');
    if(svcEl){
      var svcMap = {};
      var _svcTotal = 0;
      custs.forEach(function(c){
        var arr = Customers.getServices(c).map(function(x){return x.work;}).filter(Boolean);
        if(!arr.length) arr = [c.service || 'Other'];
        arr.forEach(function(s){ svcMap[s]=(svcMap[s]||0)+1; _svcTotal++; });
      });
      var svcKeys = Object.keys(svcMap).sort(function(a,b){return svcMap[b]-svcMap[a];}).slice(0,5);
      var total = custs.length||1;
      svcEl.innerHTML = svcKeys.length ? svcKeys.map(function(k){
        var pct = Math.round((svcMap[k]/(_svcTotal||total||1))*100);
        return '<div style="margin-bottom:6px;">'
          +'<div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:2px;"><span>'+esc(k)+'</span><span>'+svcMap[k]+' ('+pct+'%)</span></div>'
          +'<div style="background:var(--surface-2);border-radius:4px;height:6px;"><div style="background:var(--accent);border-radius:4px;height:100%;width:'+pct+'%;"></div></div>'
          +'</div>';
      }).join('') : '<div style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px;">No data</div>';
    }
    // Quotation status (handle both stored "Pending"/"Approved" and lowercase)
    var quotEl = document.getElementById('dash-summary-quot');
    if(quotEl){
      var statMap = {Pending:0,Approved:0,Completed:0,Cancelled:0};
      quots.forEach(function(q){
        var s = (q.status||'Pending');
        // Normalise capitalisation: pending → Pending
        var norm = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        if(statMap[norm]!==undefined) statMap[norm]++;
        else statMap['Pending']++;
      });
      var statColors = {Pending:'var(--yellow)',Approved:'var(--green)',Completed:'var(--blue)',Cancelled:'var(--red)'};
      quotEl.innerHTML = Object.keys(statMap).map(function(k){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem;">'
          +'<span>'+k+'</span>'
          +'<span style="font-weight:700;color:'+statColors[k]+';">'+statMap[k]+'</span>'
          +'</div>';
      }).join('');
    }
    // Sales performance
    var spEl = document.getElementById('dash-sales-perf');
    if(spEl){
      var months = {}; var now = new Date();
      for(var i=2;i>=0;i--){var d=new Date(now.getFullYear(),now.getMonth()-i,1); var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); months[key]=0;}
      quots.forEach(function(q){var m=(q.date||q.created||'').slice(0,7); if(months[m]!==undefined) months[m]+=parseFloat(q.total||q.amount||0);});
      var keys=Object.keys(months); var maxM=Math.max.apply(null,Object.values(months))||1;
      spEl.innerHTML='<div style="display:flex;align-items:flex-end;gap:8px;height:100px;padding:4px 0;">'
        +keys.map(function(k){var h=Math.round((months[k]/maxM)*80);return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;"><div style="width:100%;background:var(--accent);border-radius:4px 4px 0 0;height:'+h+'px;min-height:3px;" title="'+fmtRs(months[k])+'"></div><div style="font-size:0.62rem;color:var(--text-muted);">'+k.slice(5)+'</div></div>';}).join('')
        +'</div>';
    }
  },

  setTotalMetric: function(metric){
    this._metric = metric;
    ['income','expense','sale','customer','advance','quotation'].forEach(function(m){
      var btn = document.getElementById('dtm-'+m);
      if(btn) btn.className = 'btn btn-xs '+(m===metric?'btn-success':'btn-secondary');
    });
    this.renderTotalChart();
  },

  renderTotalChart: function(){
    var el = document.getElementById('dash-total-chart');
    var sumEl = document.getElementById('dash-total-summary');
    if(!el) return;
    var period = parseInt(getVal('dash-total-period')||30);
    var metric = this._metric||'income';
    var db = STORE.get('pk3_daybook',[])||[];
    var custs = STORE.get('pk3_customers',[])||[];
    var quots = STORE.get('pk3_quotations',[])||[];
    var days = []; var now = new Date();
    for(var i=period-1;i>=0;i--){var d=new Date(now); d.setDate(d.getDate()-i); days.push(isoLocal(d));}
    var vals = days.map(function(day){
      if(metric==='income') return db.filter(function(d){return d.date===day&&(d.type==='income'||d.type==='receipt');}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      if(metric==='expense') return db.filter(function(d){return d.date===day&&(d.type==='expense'||d.type==='payment');}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      if(metric==='advance') return db.filter(function(d){return d.date===day&&d.type==='advance';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
      if(metric==='customer') return custs.filter(function(c){return (c.created||'').slice(0,10)===day;}).length;
      if(metric==='quotation') return quots.filter(function(q){return (q.date||q.created||'').slice(0,10)===day;}).length;
      return 0;
    });
    var maxV = Math.max.apply(null,vals)||1;
    var total = vals.reduce(function(s,v){return s+v;},0);
    var avg = total/days.length;
    el.innerHTML = '<div style="display:flex;align-items:flex-end;gap:2px;height:180px;padding:4px 0;">'
      +vals.map(function(v,i){
        var h = Math.round((v/maxV)*160);
        var isToday = i===period-1;
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;" title="'+days[i]+': '+v+'">'
          +'<div style="width:100%;background:'+(isToday?'var(--accent)':'rgba(124,58,237,0.4)')+';border-radius:2px 2px 0 0;height:'+h+'px;min-height:1px;transition:height .3s;"></div>'
          +'</div>';
      }).join('')+'</div>'
      +(period<=30?'<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-muted);padding:2px 0;"><span>'+days[0].slice(5)+'</span><span>'+days[days.length-1].slice(5)+'</span></div>':'');
    if(sumEl){
      var metricColors = {income:'var(--green)',expense:'var(--red)',customer:'var(--blue)',quotation:'var(--accent)',advance:'var(--purple)',sale:'var(--cyan)'};
      sumEl.innerHTML = [
        {label:'Total',val: metric==='customer'||metric==='quotation' ? total : fmtRs(total)},
        {label:'Daily Avg',val: metric==='customer'||metric==='quotation' ? avg.toFixed(1) : fmtRs(avg)},
        {label:'Peak',val: metric==='customer'||metric==='quotation' ? Math.max.apply(null,vals) : fmtRs(Math.max.apply(null,vals))},
        {label:'Days',val:period}
      ].map(function(s){
        return '<div style="text-align:center;padding:6px;"><div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;">'+s.label+'</div>'
          +'<div style="font-weight:700;font-size:0.82rem;color:'+(metricColors[metric]||'var(--text)')+';">'+s.val+'</div></div>';
      }).join('');
    }
  }
};
