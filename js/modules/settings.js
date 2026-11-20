// ─── SETTINGS MODULE ─────────────────────────────────────────
var Settings = {
  render: function(){
    var s=STORE.get('pk3_settings',{});
    setVal('set-co-name',s.companyName||'');
    setVal('set-co-tagline',s.tagline||'');
    setVal('set-co-address',s.address||'');
    setVal('set-co-phone1',s.phone1||'');
    setVal('set-co-phone2',s.phone2||'');
    setVal('set-co-web',s.website||'');
    setVal('set-co-email',s.email||'');
    setVal('set-co-fy',s.fiscalYear||autoFiscalYear());
    setVal('set-co-pan',s.pan||'');
    setVal('set-bank-name',s.bankName||'');
    setVal('set-bank-acc',s.bankAcc||'');
    setVal('set-esewa',s.esewa||'');
    setVal('set-khalti',s.khalti||'');
    var notifEl=document.getElementById('set-notif'); if(notifEl)notifEl.checked=!!s.notifications;
    var bdayEl=document.getElementById('set-bday'); if(bdayEl)bdayEl.checked=!!s.bdayReminders;
    var muteEl=document.getElementById('set-mute'); if(muteEl)muteEl.checked=!!s.muteTost;
    var welEl=document.getElementById('set-welcome'); if(welEl)welEl.checked=(STORE.get('pk3_showWelcome',false)===true);
    // ── Render company logo (v4.0.4) ──
    this._renderLogo(s.logo || '');
    var aiKey=STORE.get('pk3_ai_key',''); setVal('set-ai-key',aiKey);
    var oaiKey=STORE.get('pk3_oai_key',''); setVal('set-oai-key',oaiKey);
    setVal('set-gem-key',STORE.get('pk3_gem_key',''));
    setVal('set-gem-key2',STORE.get('pk3_gem_key2',''));
    try { PayQR.render(); } catch(e){}
    try{ setVal('set-wa-mode', AIWA.mode()); }catch(e){}
    var aiSettings=STORE.get('pk3_ai_settings',{}); setVal('set-ai-lang',aiSettings.lang||'nepali'); if(/^gemini-2\.5/.test(aiSettings.model||'')){ aiSettings.model='gemini-3.8-flash'; STORE.set('pk3_ai_settings',aiSettings); } setVal('set-ai-model',aiSettings.model||'claude-sonnet-4-6');
    // Templates
    this.renderTemplates();
    this.renderBusiness();
    Backup.render();
  },
  // ── COMPANY LOGO (v4.0.4): edit / add / delete ──
  _renderLogo: function(dataUrl){
    var img = document.getElementById('set-logo-img');
    var ph  = document.getElementById('set-logo-placeholder');
    var del = document.getElementById('set-logo-del-btn');
    if(dataUrl){
      if(img){ img.src = dataUrl; img.style.display = ''; }
      if(ph)  ph.style.display = 'none';
      if(del) del.style.display = '';
    } else {
      if(img){ img.src = ''; img.style.display = 'none'; }
      if(ph)  ph.style.display = '';
      if(del) del.style.display = 'none';
    }
    // Also refresh the app-wide brand spots (sidebar / topbar / login) — v4.3
    try { applyBrandLogo(dataUrl); } catch(e){}
  },
  uploadLogo: function(event){
    var file = event.target.files && event.target.files[0];
    if(!file) return;
    if(!/^image\//.test(file.type)){ App.toast('Image file मात्र छान्नुस् (PNG/JPG)','error'); return; }
    // 10MB limit — phone photos are big; we resize to 400px anyway so final size stays tiny
    if(file.size > 10*1024*1024){ App.toast('फोटो धेरै ठूलो छ (max 10MB)','error'); return; }
    App.toast('⏳ Logo upload हुँदैछ...','info',1200);
    var reader = new FileReader();
    var self = this;
    reader.onload = function(e){
      // Compress: max 400px, PNG to preserve transparency
      var img = new Image();
      img.onload = function(){
        var canvas = document.createElement('canvas');
        var maxSize = 400;
        var ratio = Math.min(maxSize/img.width, maxSize/img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Use PNG to keep transparency for logos
        var dataUrl = canvas.toDataURL('image/png');
        var s = STORE.get('pk3_settings',{}) || {};
        s.logo = dataUrl;
        STORE.set('pk3_settings', s);
        self._renderLogo(dataUrl);
        try { Audit.log('SETTINGS','Company logo updated'); } catch(e){}
        App.toast('🖼️ Logo updated','success',2000);
      };
      img.onerror = function(){ App.toast('Image load failed','error'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    // Clear file input so same file can be picked again
    event.target.value = '';
  },
  deleteLogo: function(){
    if(!confirm('Logo हटाउनुहुन्छ?')) return;
    var s = STORE.get('pk3_settings',{}) || {};
    delete s.logo;
    STORE.set('pk3_settings', s);
    this._renderLogo('');
    try { Audit.log('SETTINGS','Company logo removed'); } catch(e){}
    App.toast('🗑️ Logo removed','info',2000);
  },
  save: function(){
    var existing = STORE.get('pk3_settings',{}) || {};
    var s={website:getVal('set-co-web'),companyName:getVal('set-co-name'),tagline:getVal('set-co-tagline'),address:getVal('set-co-address'),phone1:getVal('set-co-phone1'),phone2:getVal('set-co-phone2'),email:getVal('set-co-email'),fiscalYear:getVal('set-co-fy'),pan:getVal('set-co-pan'),bankName:getVal('set-bank-name'),bankAcc:getVal('set-bank-acc'),esewa:getVal('set-esewa'),khalti:getVal('set-khalti'),notifications:document.getElementById('set-notif')?document.getElementById('set-notif').checked:false,bdayReminders:document.getElementById('set-bday')?document.getElementById('set-bday').checked:false,muteTost:document.getElementById('set-mute')?document.getElementById('set-mute').checked:false};
    // Preserve logo (set via uploadLogo, not via inputs)
    if(existing.logo) s.logo = existing.logo;
    // v7.0.0: keep every other saved key (e.g. introServices) — the form only overrides its own fields
    Object.keys(existing).forEach(function(k){ if(!(k in s)) s[k] = existing[k]; });
    if(!document.getElementById('set-co-web')) s.website = existing.website || '';
    STORE.set('pk3_settings',s);
    try { Brand.apply(); } catch(e){}
    var fy=s.fiscalYear; var fyEl=document.getElementById('tb-fy'); if(fyEl)fyEl.textContent='FY '+fy;
  },
  // v7.0.0: business type label + modules list in Settings
  renderBusiness: function(){
    try {
      var t = Company.businessType();
      setText('set-business-type', t ? (BusinessProfiles.get(t).icon + ' ' + BusinessProfiles.get(t).label) : 'छानिएको छैन');
    } catch(e){}
    try { Modules.render(); } catch(e){}
  },
  // Explicit Save button handler — same data write but with clear user feedback
  toggleWelcome: function(on){
    STORE.set('pk3_showWelcome', !!on);
    App.toast(on ? '🕉️ स्वागत screen अब login अघि देखिनेछ' : '✅ स्वागत screen बन्द — सिधै login', 'success', 2500);
  },
  saveManual: function(which){
    this.save();
    try { Audit.log('SETTINGS', (which==='payment'?'Payment details':'Company info')+' saved'); } catch(e){}
    var label = which==='payment' ? 'Payment details' : 'Company information';
    App.toast('✅ '+label+' saved!','success',2200);
  },
  saveAI: function(){
    STORE.set('pk3_ai_key',getVal('set-ai-key'));
    STORE.set('pk3_oai_key',getVal('set-oai-key'));
    STORE.set('pk3_gem_key',(getVal('set-gem-key')||'').trim());
    STORE.set('pk3_gem_key2',(getVal('set-gem-key2')||'').trim());
    STORE.set('pk3_ai_settings',{lang:getVal('set-ai-lang'),model:getVal('set-ai-model')});
  },
  toggleNotifications: function(v){ if(v&&Notification.permission!=='granted'){Notification.requestPermission();} this.save(); },
  renderTemplates: function(){
    var templates=STORE.get('pk3_templates',null); if(!templates||!Array.isArray(templates)||!templates.length) templates=DEFAULT_TEMPLATES||Followups._defTpl();
    var cont=document.getElementById('tpl-manager-list'); if(!cont)return;
    cont.innerHTML = '';
    (templates||[]).forEach(function(t, i){
      if (!t) return;
      var row = document.createElement('div');
      row.style.cssText = 'background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;';
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var title = document.createElement('div');
      title.style.cssText = 'font-weight:600;font-size:0.82rem;color:var(--text);';
      title.textContent = t.name || ('Template '+(i+1));
      var sub = document.createElement('div');
      sub.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin-top:2px;';
      sub.textContent = (t.text||'').slice(0,80) + ((t.text||'').length>80?'…':'');
      info.appendChild(title); info.appendChild(sub);
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-xs btn-secondary'; editBtn.textContent = '✏️';
      editBtn.onclick = function(){ Settings.editTemplate(i); };
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-xs btn-danger'; delBtn.textContent = '🗑';
      delBtn.onclick = function(){ Settings.delTemplate(i); };
      btns.appendChild(editBtn); btns.appendChild(delBtn);
      row.appendChild(info); row.appendChild(btns);
      cont.appendChild(row);
    });
  },
  addTemplate: function(){ var n=prompt('Template name:'); if(!n)return; var t=prompt('Template text (use [name], [amount] as placeholders):'); if(!t)return; var list=STORE.get('pk3_templates',Followups._defTpl()); list.push({name:n,text:t}); STORE.set('pk3_templates',list); this.renderTemplates(); App.toast('✅ Template added!','success'); },
  delTemplate: function(i){ var list=STORE.get('pk3_templates',Followups._defTpl()); list.splice(i,1); STORE.set('pk3_templates',list); this.renderTemplates(); },
  editTemplate: function(i){
    var list=STORE.get('pk3_templates',Followups._defTpl());
    var t=list[i]; if(!t) return;
    var n=prompt('Template name:',t.name); if(n===null) return;
    var tx=prompt('Template text:',t.text); if(tx===null) return;
    list[i]={name:n,text:tx}; STORE.set('pk3_templates',list); this.renderTemplates();
    App.toast('✅ Template updated','success');
  },
  resetTemplates: function(){ STORE.set('pk3_templates',Followups._defTpl()); this.renderTemplates(); App.toast('✅ Templates reset','success'); },
  restoreDefaults: function(){
    if(!confirm('⚠️ Confirm: Default rates, templates, service categories restore गर्ने?\n(User data — customers, quotations — safe रहन्छ)')) return;
    STORE.set('pk3_templates', Followups._defTpl());
    RateList.resetDefaults(true);
    App.toast('✅ Default rates & templates restored!','success');
    this.render();
  }
};

