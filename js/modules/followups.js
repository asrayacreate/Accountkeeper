// ─── FOLLOWUPS MODULE ─────────────────────────────────────────
var Followups = {
  _filter: 'all', _prefillCust: null,
  getData: function(){ return STORE.get('pk3_followups',[])||[]; },
  initForm: function(){
    this.loadCustDropdown();
    this.loadTemplateChips();
    if(!this._prefillCust){ setVal('fu-edit-id',''); setVal('fu-cust',''); setVal('fu-note',''); setVal('fu-priority','Normal'); setVal('fu-msg',''); setVal('fu-date-inp',''); setText('fu-date-inp-text','📅 मिति छान्नुस्...'); setText('add-fu-title','🔔 New Follow-up'); }
    else{ setVal('fu-cust',this._prefillCust); this._prefillCust=null; }
  },
  loadCustDropdown: function(){
    var custs=Customers.getData(); var sel=document.getElementById('fu-cust'); if(!sel)return;
    sel.innerHTML='<option value="">-- Customer छान्नुस् --</option>'+custs.map(function(c){return '<option value="'+c.id+'">'+c.name+' ('+c.phone+')</option>';}).join('');
  },
  loadTemplateChips: function(){
    var templates=STORE.get('pk3_templates',null); if(!templates||!Array.isArray(templates)||!templates.length) templates=DEFAULT_TEMPLATES||Followups._defTpl();
    var chips=document.getElementById('fu-chips'); if(!chips) return;
    chips.innerHTML = '';
    templates.slice(0,6).forEach(function(t){
      if(!t||!t.name) return;
      var span = document.createElement('span');
      span.className = 'chip-item';
      span.style.cssText = 'font-size:0.75rem;cursor:pointer;display:inline-flex;align-items:center;';
      span.textContent = t.name;
      span.addEventListener('click', function(){
        // Find selected customer from form
        var custId = getVal('fu-cust');
        var cust = custId ? Customers.getData().find(function(c){return c.id===custId;}) : null;
        var filled = fillTemplate(t, cust);
        var el = document.getElementById('fu-msg');
        if(el) { el.value = filled; el.focus(); }
      });
      chips.appendChild(span);
    });
  },
  // v7.0.0: default templates come from the chosen business profile (js/core/business-profiles.js)
  _defTpl: function(){ return BusinessProfiles.templates(Company.businessType()); },
  save: function(){
    var custId=getVal('fu-cust');
    if(!custId){
      App.toast('❌ Customer छान्नुस्!','error',3000);
      var sel = document.getElementById('fu-cust'); if(sel){ sel.focus(); sel.style.borderColor='var(--red)'; setTimeout(function(){sel.style.borderColor='';},2000); }
      return;
    }
    var fuDate=getVal('fu-date-inp');
    var fuDateBs=getVal('fu-date-inp-bs');
    // If user picked via BSPicker, fu-date-inp has the BS date string — use it as fuDateBs too
    if(!fuDateBs && fuDate && /^\d{4}-\d{2}-\d{2}$/.test(fuDate)) fuDateBs = fuDate;
    if(!fuDate && !fuDateBs){
      App.toast('❌ मिति छान्नुस्! "📅 मिति छान्नुस्..." मा click गर्नुस्','error',3500);
      var dp = document.querySelector('[onclick*="BSPicker.open(\'fu-date-inp\'"]');
      if(dp){ dp.style.borderColor='var(--red)'; setTimeout(function(){dp.style.borderColor='';},2000); }
      return;
    }
    var custs=Customers.getData(); var cust=custs.find(function(x){return x.id===custId;})||{};
    var id=getVal('fu-edit-id')||uid(); var isEdit=!!getVal('fu-edit-id');
    var rec={id:id,custId:custId,custName:cust.name||'',custPhone:cust.phone||'',note:getVal('fu-note'),priority:getVal('fu-priority'),msg:getVal('fu-msg'),fuDate:fuDate||fuDateBs,fuDateBs:fuDateBs,status:'Pending',created:todayISO()};
    var list=this.getData();
    if(isEdit){var idx=list.findIndex(function(x){return x.id===id;});if(idx>=0)list[idx]=rec;else list.unshift(rec);}
    else list.unshift(rec);
    STORE.set('pk3_followups',list);
    // Update customer FU date
    var clist=Customers.getData(); var ci=clist.findIndex(function(x){return x.id===custId;});
    if(ci>=0){clist[ci].fuDate=rec.fuDate;clist[ci].fuDateBs=rec.fuDateBs;STORE.set('pk3_customers',clist);}
    try { Audit.log('FOLLOWUP',isEdit?'Edited: '+cust.name:'Added: '+cust.name+' on '+rec.fuDateBs); } catch(e){}
    try { Activity.add('🔔 Follow-up '+(isEdit?'updated':'added')+': '+cust.name); } catch(e){}
    App.toast('✅ Follow-up '+(isEdit?'updated':'saved')+'!','success');
    App.navigate('followups');
  },
  filter: function(f){
    this._filter=f;
    ['all','today','upcoming','overdue','done'].forEach(function(x){var b=document.getElementById('fu-f-'+x);if(b)b.className='btn btn-sm btn-'+(x===f?'primary':'secondary');});
    this.render();
  },
  render: function(){
    try{ SmartRem.render(); }catch(e){}
    var list=this.getData().slice().sort(function(a,b){return compareBs(a.fuDateBs,b.fuDateBs);});
    var today=todayBs();
    if(this._filter==='today') list=list.filter(function(f){return f.fuDateBs===today&&f.status!=='Done';});
    else if(this._filter==='upcoming') list=list.filter(function(f){return compareBs(f.fuDateBs,today)>0&&f.status!=='Done';});
    else if(this._filter==='overdue') list=list.filter(function(f){return compareBs(f.fuDateBs,today)<0&&f.status!=='Done';});
    else if(this._filter==='done') list=list.filter(function(f){return f.status==='Done';});
    else if(this._filter==='all') list=list.filter(function(f){return f.status!=='Done';});
    var cont=document.getElementById('fu-list'); var ne=document.getElementById('no-fu');
    var badge=document.getElementById('fu-badge');
    var todayCount=this.getData().filter(function(f){return f.fuDateBs===today&&f.status!=='Done';}).length;
    if(badge){badge.textContent=todayCount;badge.style.display=todayCount?'':'none';}
    if(!list.length){cont.innerHTML='';ne.style.display='';return;} ne.style.display='none';
    var pmap={'Urgent':'tag-red','High':'tag-yellow','🔥 Hot Lead':'tag-red','❄️ Cold Lead':'tag-blue'};
    cont.innerHTML=list.map(function(f){
      var cmp=compareBs(f.fuDateBs,today); var cls='fu-card '+(cmp<0&&f.status!=='Done'?'overdue':cmp===0?'today':'upcoming')+(f.status==='Done'?' done':'');
      return '<div class="'+cls+'" onclick="Followups.toggle(\''+f.id+'\')">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'+
        '<div><div style="font-weight:700;">'+f.custName+'</div><div style="font-size:0.75rem;color:var(--text-muted);">'+f.custPhone+'</div></div>'+
        '<span class="tag '+(pmap[f.priority]||'tag-gray')+'" style="font-size:0.65rem;">'+f.priority+'</span></div>'+
        '<div style="font-size:0.82rem;margin-top:6px;">'+( f.note||'—')+'</div>'+
        (f.msg?'<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;font-style:italic;">💬 '+(f.msg.length>60?f.msg.slice(0,60)+'…':f.msg)+'</div>':'')+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px;">'+
        '<span style="font-size:0.75rem;color:var(--text-muted);">📅 '+(f.fuDateBs?bsStringToDisplay(f.fuDateBs):fmtDisplayDate(f.fuDate))+'</span>'+
        '<div class="btn-group" style="flex-wrap:wrap;gap:4px;">'+
        '<button onclick="event.stopPropagation();Followups.markDone(\''+f.id+'\')" class="btn btn-xs '+(f.status==='Done'?'btn-secondary':'btn-success')+'" title="'+(f.status==='Done'?'Mark pending':'Mark done')+'">'+(f.status==='Done'?'↩ Undo':'✅ Done')+'</button>'+
        '<button onclick="event.stopPropagation();Followups.edit(\''+f.id+'\')" class="btn btn-xs btn-secondary" title="Edit">✏️ Edit</button>'+
        '<button onclick="event.stopPropagation();Followups.sendWA(\''+f.id+'\')" class="btn btn-xs btn-wa" title="WhatsApp with greeting picker">📱 WA</button>'+
        '<button onclick="event.stopPropagation();AIWA.openFollowup(\''+f.id+'\')" class="btn btn-xs" style="background:linear-gradient(135deg,#22c55e,#7c3aed);color:#fff;font-weight:700;" title="AI ले नेपाली WhatsApp म्यासेज लेख्छ">🤖 AI WhatsApp</button>'+
        '<button onclick="event.stopPropagation();Followups.del(\''+f.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button></div></div></div>';
    }).join('');
  },
  toggle: function(id){},
  // ── EDIT (v4.0.5): pre-fill add-followup form with existing record ──
  edit: function(id){
    var f = this.getData().find(function(x){return x.id===id;});
    if(!f){ App.toast('Follow-up not found','error'); return; }
    // Stash record for initForm to read after navigation
    Followups._editRec = f;
    App.navigate('add-followup');
    // After navigation, the page-add-followup is shown. Wait a tick, then fill.
    setTimeout(function(){
      var rec = Followups._editRec; if(!rec) return;
      // Make sure dropdown is loaded first
      Followups.loadCustDropdown();
      Followups.loadTemplateChips();
      setVal('fu-edit-id', rec.id);
      setVal('fu-cust', rec.custId || '');
      setVal('fu-note', rec.note || '');
      setVal('fu-priority', rec.priority || 'Normal');
      setVal('fu-msg', rec.msg || '');
      setVal('fu-date-inp', rec.fuDate || '');
      setVal('fu-date-inp-bs', rec.fuDateBs || '');
      var dt = document.getElementById('fu-date-inp-text');
      if(dt) dt.textContent = rec.fuDateBs ? bsStringToDisplay(rec.fuDateBs) : (rec.fuDate?fmtDisplayDate(rec.fuDate):'📅 मिति छान्नुस्...');
      setText('add-fu-title','✏️ Edit Follow-up — '+(rec.custName||'Customer'));
      Followups._editRec = null;
    }, 200);
  },
  markDone: function(id){
    var list=this.getData(); var f=list.find(function(x){return x.id===id;});
    if(f){f.status=f.status==='Done'?'Pending':'Done'; STORE.set('pk3_followups',list); this.render();}
  },
  // ── SEND WA WITH GREETING PICKER (v4.0.5) ──
  sendWA: function(id){
    var f=this.getData().find(function(x){return x.id===id;}); if(!f)return;
    var phone=f.custPhone.replace(/[^0-9]/g,'');
    if(!phone){ App.toast('Phone number missing','error'); return; }
    var customer = Customers.getData().find(function(c){return c.id===f.custId;}) || {name:f.custName, phone:f.custPhone};
    // Build picker modal
    var existing = document.getElementById('fu-greet-picker-modal');
    if(existing) existing.remove();
    var templates = STORE.get('pk3_templates',null) || (typeof DEFAULT_TEMPLATES!=='undefined'?DEFAULT_TEMPLATES:Followups._defTpl()) || [];
    var defaultMsg = f.msg || ('नमस्ते '+f.custName+'! '+Company.name()+' बाट follow-up।');
    var m = document.createElement('div');
    m.className = 'modal-overlay open';
    m.id = 'fu-greet-picker-modal';
    m.innerHTML =
      '<div class="modal" style="max-width:540px;">'
      +'<div class="modal-head">'
        +'<div>'
          +'<div class="modal-title">📱 WhatsApp Greeting</div>'
          +'<div class="modal-sub" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">To: <strong>'+esc(f.custName)+'</strong> ('+esc(f.custPhone)+')</div>'
        +'</div>'
        +'<button class="modal-close" onclick="document.getElementById(\'fu-greet-picker-modal\').remove()">✕</button>'
      +'</div>'
      +'<div style="margin-bottom:10px;">'
        +'<label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;">📝 Choose Greeting Template</label>'
        +'<select id="fu-gp-tpl" onchange="Followups._gpPickTpl(this.value,\''+f.id+'\')" style="width:100%;margin-top:4px;">'
          +'<option value="-1">— Use saved follow-up message —</option>'
          + templates.map(function(t,i){
              var n = (t.name||'Template '+(i+1)).replace(/</g,'&lt;');
              return '<option value="'+i+'">'+n+'</option>';
            }).join('')
        +'</select>'
      +'</div>'
      +'<div style="margin-bottom:12px;">'
        +'<label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;">💬 Message (editable)</label>'
        +'<textarea id="fu-gp-msg" rows="8" style="width:100%;margin-top:4px;font-size:0.84rem;">'+esc(defaultMsg)+'</textarea>'
        +'<div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px;">Tip: {name}, {phone}, {service}, {company} placeholders auto-fill</div>'
      +'</div>'
      +'<div class="form-actions" style="display:flex;gap:8px;flex-wrap:wrap;">'
        +'<button class="btn btn-secondary" onclick="document.getElementById(\'fu-greet-picker-modal\').remove()">Cancel</button>'
        +'<button class="btn btn-primary" onclick="Followups._gpSaveMsg(\''+f.id+'\')">💾 Save to Follow-up</button>'
        +'<button class="btn btn-wa" onclick="Followups._gpSend(\''+f.id+'\')" style="flex:1;">📱 Send WhatsApp</button>'
      +'</div>'
      +'</div>';
    document.body.appendChild(m);
    // Save customer reference for placeholder filling
    Followups._gpCust = customer;
  },
  _gpPickTpl: function(idx, fuId){
    var i = parseInt(idx);
    var ta = document.getElementById('fu-gp-msg');
    if(!ta) return;
    if(i < 0){
      // Restore saved msg from the follow-up
      var f = this.getData().find(function(x){return x.id===fuId;});
      ta.value = (f && f.msg) || ('नमस्ते '+(f?f.custName:'')+'!');
      return;
    }
    var templates = STORE.get('pk3_templates',null) || (typeof DEFAULT_TEMPLATES!=='undefined'?DEFAULT_TEMPLATES:Followups._defTpl()) || [];
    var t = templates[i] || templates[0];
    var cust = Followups._gpCust || {};
    var filled = (typeof fillTemplate === 'function') ? fillTemplate(t, cust) : (t.text||'').replace(/\{name\}/g, cust.name||'Customer');
    ta.value = filled;
  },
  _gpSaveMsg: function(fuId){
    var ta = document.getElementById('fu-gp-msg');
    if(!ta) return;
    var list = this.getData();
    var idx = list.findIndex(function(x){return x.id===fuId;});
    if(idx < 0){ App.toast('Follow-up not found','error'); return; }
    list[idx].msg = ta.value;
    STORE.set('pk3_followups', list);
    try { Audit.log('FOLLOWUP','Message updated for '+list[idx].custName); } catch(e){}
    App.toast('💾 Message saved to follow-up','success');
    this.render();
  },
  _gpSend: function(fuId){
    var ta = document.getElementById('fu-gp-msg');
    if(!ta) return;
    var msg = ta.value;
    if(!msg.trim()){ App.toast('Message empty','error'); return; }
    var f = this.getData().find(function(x){return x.id===fuId;});
    if(!f){ App.toast('Follow-up not found','error'); return; }
    // Save the message back so next time it's pre-filled
    var list = this.getData();
    var idx = list.findIndex(function(x){return x.id===fuId;});
    if(idx >= 0){ list[idx].msg = msg; STORE.set('pk3_followups', list); }
    try { Audit.log('FOLLOWUP','WA sent to '+f.custName); } catch(e){}
    var modal = document.getElementById('fu-greet-picker-modal');
    if(modal) modal.remove();
    if(Wa.send(f.custPhone, msg)) this.render();
  },
  del: function(id){ if(!confirm('Delete?'))return; STORE.set('pk3_followups',this.getData().filter(function(x){return x.id!==id;})); this.render(); App.toast('🗑 Deleted','info'); },

  // ── BULK GREETING (v4.0.4): send a message to every customer at once ──
  openGreetAll: function(){
    var custs = (STORE.get('pk3_customers',[])||[]).filter(function(c){return c && c.phone && String(c.phone).replace(/[^0-9]/g,'').length>=7;});
    if(!custs.length){ App.toast('कुनै customer छैन — पहिले add गर्नुस्','warning'); return; }
    var templates = STORE.get('pk3_templates',null) || (typeof DEFAULT_TEMPLATES!=='undefined'?DEFAULT_TEMPLATES:[]) || Followups._defTpl();
    var existing = document.getElementById('greet-all-modal');
    if(existing) existing.remove();
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'greet-all-modal';
    var defaultMsg = (templates[0] && (templates[0].text||templates[0].body||templates[0].message)) || 'नमस्ते {name}! {company} बाट तपाईंलाई शुभकामना।';
    m.innerHTML =
      '<div class="modal" style="max-width:580px;">'
      +'<div class="modal-head">'
        +'<div>'
          +'<div class="modal-title">🎉 Greet All Customers</div>'
          +'<div class="modal-sub" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">तल customer छानेर WhatsApp greeting पठाउनुस्</div>'
        +'</div>'
        +'<button class="modal-close" onclick="document.getElementById(\'greet-all-modal\').remove()">✕</button>'
      +'</div>'
      // Template picker
      +'<div style="margin-bottom:10px;">'
        +'<label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;">📝 Choose Template</label>'
        +'<select id="ga-tpl" onchange="Followups._gaPickTpl(this.value)" style="width:100%;margin-top:4px;">'
          + templates.map(function(t,i){ var n=(t.name||'Template '+(i+1)).replace(/</g,'&lt;'); return '<option value="'+i+'">'+n+'</option>'; }).join('')
        +'</select>'
      +'</div>'
      // Message editor
      +'<div style="margin-bottom:10px;">'
        +'<label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;">💬 Message (use {name}, {phone}, {service}, {company})</label>'
        +'<textarea id="ga-msg" rows="4" oninput="Followups._gaPreview()" style="width:100%;margin-top:4px;font-size:0.85rem;">'+defaultMsg.replace(/</g,'&lt;')+'</textarea>'
      +'</div>'
      // Quick filters (bulk-select helpers)
      +'<div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
        +'<span style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Quick select:</span>'
        +'<button type="button" class="btn btn-xs btn-secondary" onclick="Followups._gaSelect(\'all\')">✅ All</button>'
        +'<button type="button" class="btn btn-xs btn-secondary" onclick="Followups._gaSelect(\'none\')">⬜ None</button>'
        +'<button type="button" class="btn btn-xs btn-secondary" onclick="Followups._gaSelect(\'recent\')">🕐 Recent 30d</button>'
        +'<button type="button" class="btn btn-xs btn-secondary" onclick="Followups._gaSelect(\'advance\')">💰 With Advance</button>'
      +'</div>'
      // Individual customer checklist
      +'<div style="margin-bottom:8px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
          +'<label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;">👥 Select Customers</label>'
          +'<span id="ga-count" style="font-size:0.72rem;font-weight:700;color:var(--accent);"></span>'
        +'</div>'
        +'<input type="text" id="ga-search" placeholder="🔍 नाम/नम्बर खोज्नुस्..." oninput="Followups._gaRenderList()" style="width:100%;margin-bottom:6px;font-size:0.8rem;padding:6px 10px;">'
        +'<div id="ga-cust-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px;background:var(--surface-2);"></div>'
      +'</div>'
      // Live preview
      +'<div style="background:var(--surface-2);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.78rem;max-height:110px;overflow-y:auto;" id="ga-preview"></div>'
      // Actions
      +'<div class="form-actions" style="display:flex;gap:8px;flex-wrap:wrap;">'
        +'<button class="btn btn-secondary" onclick="document.getElementById(\'greet-all-modal\').remove()">Cancel</button>'
        +'<button class="btn btn-wa" onclick="Followups._gaSend()" style="flex:1;">📱 Send WhatsApp</button>'
      +'</div>'
      +'</div>';
    document.body.appendChild(m);
    m.classList.add('open');
    // Selection state — start with ALL selected
    Followups._gaSelected = {};
    custs.forEach(function(c){ Followups._gaSelected[c.id||c.phone] = true; });
    Followups._gaRenderList();
    Followups._gaPreview();
  },
  _gaAllCustomers: function(){
    return (STORE.get('pk3_customers',[])||[]).filter(function(c){return c && c.phone && String(c.phone).replace(/[^0-9]/g,'').length>=7;});
  },
  _gaRenderList: function(){
    var box = document.getElementById('ga-cust-list');
    if(!box) return;
    if(!Followups._gaSelected) Followups._gaSelected = {};
    var q = (getVal('ga-search')||'').toLowerCase();
    var custs = Followups._gaAllCustomers();
    if(q) custs = custs.filter(function(c){ return (c.name||'').toLowerCase().indexOf(q)>=0 || String(c.phone).indexOf(q)>=0; });
    if(!custs.length){ box.innerHTML='<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.8rem;">कुनै customer भेटिएन</div>'; return; }
    box.innerHTML = custs.map(function(c){
      var key = c.id||c.phone;
      var checked = Followups._gaSelected[key] ? 'checked' : '';
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.82rem;" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">'
        +'<input type="checkbox" '+checked+' onchange="Followups._gaToggle(\''+String(key).replace(/'/g,"\\'")+'\',this.checked)" style="width:16px;height:16px;cursor:pointer;">'
        +'<div style="flex:1;min-width:0;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.name||'(no name)')+'</div>'
        +'<div style="font-size:0.7rem;color:var(--text-muted);">'+esc(c.phone)+(c.advance>0?' · 💰 Adv':'')+'</div></div>'
      +'</label>';
    }).join('');
    Followups._gaUpdateCount();
  },
  _gaToggle: function(key, val){
    if(!Followups._gaSelected) Followups._gaSelected = {};
    Followups._gaSelected[key] = val;
    Followups._gaUpdateCount();
    Followups._gaPreview();
  },
  _gaSelect: function(mode){
    if(!Followups._gaSelected) Followups._gaSelected = {};
    var custs = Followups._gaAllCustomers();
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
    custs.forEach(function(c){
      var key = c.id||c.phone;
      if(mode==='all') Followups._gaSelected[key] = true;
      else if(mode==='none') Followups._gaSelected[key] = false;
      else if(mode==='recent'){ var d=c.created||c.updated; Followups._gaSelected[key] = d ? (new Date(d)>=cutoff) : false; }
      else if(mode==='advance') Followups._gaSelected[key] = parseFloat(c.advance||0)>0;
    });
    Followups._gaRenderList();
    Followups._gaPreview();
  },
  _gaUpdateCount: function(){
    var n = Followups._gaGetSelected().length;
    var el = document.getElementById('ga-count');
    if(el) el.textContent = n + ' selected';
  },
  _gaGetSelected: function(){
    if(!Followups._gaSelected) return [];
    return Followups._gaAllCustomers().filter(function(c){ return Followups._gaSelected[c.id||c.phone]; });
  },
  _gaPickTpl: function(idx){
    var templates = STORE.get('pk3_templates',null) || (typeof DEFAULT_TEMPLATES!=='undefined'?DEFAULT_TEMPLATES:[]) || Followups._defTpl();
    var t = templates[parseInt(idx)] || templates[0];
    var ta = document.getElementById('ga-msg');
    if(ta) ta.value = (t && (t.text||t.body||t.message)) || '';
    Followups._gaPreview();
  },
  _gaPreview: function(){
    var custs = Followups._gaGetSelected();
    var msg = (document.getElementById('ga-msg')||{}).value || '';
    var box = document.getElementById('ga-preview');
    if(!box) return;
    if(!custs.length){
      box.innerHTML = '<div style="text-align:center;padding:8px;color:var(--text-muted);">'
        + '<div style="font-size:1.4rem;margin-bottom:4px;">⬜</div>'
        + '<div style="font-weight:600;">कुनै customer select गरिएको छैन</div>'
        + '<div style="font-size:0.72rem;margin-top:4px;">माथि checkbox वा "Quick select" प्रयोग गर्नुस्</div>'
        + '</div>';
      return;
    }
    var first = custs[0];
    var preview = (typeof fillTemplate === 'function') ? fillTemplate({text:msg}, first) : msg.replace(/\{name\}/g, first.name||'Customer');
    if(!preview || !preview.trim()) preview = '(message खाली छ — माथि लेख्नुस्)';
    box.innerHTML = '<div style="font-weight:700;margin-bottom:6px;color:var(--accent);">📋 '+custs.length+' customers selected</div>'
      + '<div style="font-size:0.72rem;margin-bottom:6px;color:var(--text-muted);">👤 Sample: <strong style="color:var(--text);">'+esc(first.name||'(no name)')+'</strong> · '+esc(first.phone)+'</div>'
      + '<div style="font-weight:600;font-size:0.7rem;color:var(--text-muted);margin-bottom:3px;">PREVIEW:</div>'
      + '<div style="background:var(--surface);padding:9px 11px;border-radius:6px;white-space:pre-wrap;font-size:0.8rem;color:var(--text);border-left:3px solid var(--accent);">'+esc(preview)+'</div>';
  },
  _gaSend: function(){
    var custs = Followups._gaGetSelected();
    var msg = (document.getElementById('ga-msg')||{}).value || '';
    if(!custs.length){ App.toast('कुनै customer select गर्नुस्','warning'); return; }
    if(!msg.trim()){ App.toast('Message खाली छ','error'); return; }
    var m=document.getElementById('greet-all-modal'); if(m) m.remove();
    Wa.bulkSend(custs, function(c){
      if(typeof fillTemplate === 'function') return fillTemplate({text: msg}, c);
      return msg.replace(/\{name\}/g, c.name||'Customer').replace(/\{phone\}/g, c.phone||'');
    }, { title: '🎉 Greet ('+custs.length+' customers)' });
    try { Audit.log('GREETING','Bulk greeting sent to '+custs.length+' selected customers'); } catch(e){}
  }
};

