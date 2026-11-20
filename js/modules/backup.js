// ─── BACKUP MODULE ────────────────────────────────────────────
var Backup = {
  render: function(){
    var lastBk=STORE.get('lastBackup');
    var disp=lastBk?fmtDisplayDate(lastBk):'Never';
    // v7.2.0: Dropbox / Google Drive sync पनि ब्याकअप हो — जुन पछिल्लो हो त्यही देखाउने
    try { var lb=BackupAlert.last(); if(lb.at) disp=fmtDisplayDate(new Date(lb.at).toISOString())+' · '+lb.label; } catch(e){}
    setText('last-backup-time',disp);
    setText('settings-last-backup',disp);
    try { BackupAlert.render(); } catch(e){}
    try { ErrorLogView.render(); } catch(e){}
  },
  exportJSON: function(){
    var data={};
    // v7.0.0: one list (ALL_KEYS) + every other pk3_ data key, so new modules are never left out
    var keys = Backup.ALL_KEYS.slice();
    try { for (var _i=0; _i<localStorage.length; _i++){ var _k=localStorage.key(_i); if(_k && _k.indexOf('pk3_')===0 && keys.indexOf(_k)===-1 && !/^(pk3_session|pk3_dbx_|pk3_gdrive_|pk3_autosave_|pk3_ai_key|pk3_oai_key|pk3_gem_key|pk3_license|pk3_lic_backup)/.test(_k)) keys.push(_k); } } catch(e){}
    keys.forEach(function(k){ var v=STORE.get(k,null); if(v!==null) data[k]=v; });
    data._meta={version:APP_VERSION,date:todayISO(),exportedBy:currentUser?currentUser.name:'unknown',company:Company.name('')};
    var dateStr=new Date().toISOString().slice(0,10);
    var filename='swagatik-backup-'+dateStr+'.json';
    // v7.0.0: site / bill photos (IndexedDB) travel inside the same backup file
    var done=function(){ downloadFile(filename,JSON.stringify(data,null,2)); };
    try { Media.exportAll().then(function(m){ if(m && Object.keys(m).length) data._media=m; done(); }).catch(done); } catch(e){ done(); }
    var now=new Date().toISOString();
    STORE.set('lastBackup',now);
    this.render();
    Audit.log('BACKUP','Backup exported: '+filename);
    App.toast('✅ Backup downloaded!','success');
  },
  exportCSV: function(){
    var custs=Customers.getData();
    var header='Name,Phone,Address,Service,Sub-Service,Advance,Salesperson,Issue Date,FU Date,Created\n';
    var rows=custs.map(function(c){return [c.name,c.phone,(c.address||'').replace(/,/g,';'),'"'+Customers.getServices(c).map(function(x){return x.work;}).filter(Boolean).join('; ')+'"','"'+Customers.getServices(c).map(function(x){return x.subwork;}).filter(Boolean).join('; ')+'"',c.advance||0,c.sales||'',c.issueDateBs||'',c.fuDateBs||'',c.created||''].join(',');}).join('\n');
    downloadCSV('customers-'+todayISO()+'.csv',header+rows);
    App.toast('✅ CSV downloaded!','success');
  },
  importJSON: function(e){
    var file=e.target.files[0]; if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var data=JSON.parse(ev.target.result);
        // Validate
        if(!data||typeof data!=='object'){App.toast('❌ Invalid backup file','error');return;}
        var requiredKeys=['pk3_customers','pk3_quotations'];
        var missing=requiredKeys.filter(function(k){return !(k in data);});
        if(missing.length){App.toast('❌ Invalid backup: missing '+missing.join(', '),'error');return;}
        if(!confirm('Restore backup? Current data will be replaced.\nExported: '+(data._meta?data._meta.date:'unknown')))return;
        var _licSafe = License._load();
        Object.keys(data).forEach(function(k){if(k!=='_meta' && k!=='_media' && License._STORES.indexOf(k)===-1)STORE.set(k,data[k]);});
        if(data._media){ try { Media.importAll(data._media); } catch(e){} }
        // v7.0.0: a v6 backup (no pk3_business) is migrated again on reload, like an old device
        if(!('pk3_business' in data)){ localStorage.removeItem('pk3_business'); localStorage.removeItem('pk3_v7_migrated'); }
        if(_licSafe) License._save(_licSafe);   // restore पछि पनि license बाँच्छ
        STORE.set('lastBackup',new Date().toISOString());
        Audit.log('RESTORE','Backup restored from '+file.name);
        App.toast('✅ Data restored!','success');
        setTimeout(function(){window.location.reload();},1000);
      }catch(err){App.toast('❌ File parse error: '+err.message,'error');}
    };
    reader.readAsText(file);
    e.target.value='';
  },
  clearAll: function(){
    if(!confirm('⚠️ ALL data permanently delete गर्नुहुन्छ? यो action undo हुँदैन!'))return;
    if(!confirm('CONFIRM: सबै data delete गर्नुहुन्छ?'))return;
    ['pk3_customers','pk3_quotations','pk3_followups','pk3_daybook','pk3_rates','pk3_walkins','pk3_staff','pk3_stock','pk3_sales','pk3_templates','pk3_invoices','pk3_ledger','pk3_audit','pk3_vcard','pk3_estimates','pk3_activity','pk3_notif','pk3_projects'].forEach(function(k){STORE.del(k);});
    App.toast('🗑 All data cleared','info');
    setTimeout(function(){window.location.reload();},1000);
  },
  sendEmail: function(){ var co=STORE.get('pk3_settings',{}); var email=co.email||''; window.location.href='mailto:'+email+'?subject=Swagatik Backup&body=Please find the backup attached.'; App.toast('📧 Email app opened','info'); },

  // ═══════════════ AUTO-SAVE SYSTEM (v4.1) ═══════════════
  // Data already lives in localStorage (survives refresh/close). This adds:
  //  • A rolling in-browser snapshot for recovery
  //  • A "download backup on exit" safety reminder
  //  • Daily auto-backup nudge so the document file कहिल्यै हराउँदैन
  ALL_KEYS: ['pk3_customers','pk3_quotations','pk3_followups','pk3_daybook','pk3_rates','pk3_walkins','pk3_staff','pk3_stock','pk3_stockHistory','pk3_sales','pk3_templates','pk3_bulkFolders','pk3_users','pk3_audit','pk3_invoices','pk3_ledger','pk3_notif','pk3_activity','pk3_company','pk3_settings','pk3_tracker','pk3_vcard','pk3_estimates','pk3_planner','pk3_qa_order','pk3_brochures','pk3_returns','pk3_cashbook_opening','pk3_projects','pk3_pay_qr','pk3_doc_terms','pk3_business','pk3_modules','pk3_payables','pk3_payable_txns'],

  _snapshot: function(){
    var data={};
    Backup.ALL_KEYS.forEach(function(k){ var v=STORE.get(k,null); if(v!==null) data[k]=v; });
    data._meta={version:'auto',date:new Date().toISOString()};
    return data;
  },

  autoSave: function(){
    // Save a recovery snapshot inside localStorage (separate key)
    try {
      var snap=Backup._snapshot();
      localStorage.setItem('pk3_autosave_snapshot', JSON.stringify(snap));
      localStorage.setItem('pk3_autosave_time', new Date().toISOString());
    } catch(e){ /* quota — skip silently, real data still saved */ }
  },

  initAutoSave: function(){
    // 1. Snapshot every 45 seconds while working
    if(Backup._autoTimer) clearInterval(Backup._autoTimer);
    Backup._autoTimer = setInterval(function(){ Backup.autoSave(); }, 45000);
    // 2. Snapshot immediately on load
    Backup.autoSave();
    // 3. Save on tab close / navigate away (data safety)
    window.addEventListener('beforeunload', function(){ Backup.autoSave(); });
    // 4. Daily backup reminder — if no download backup in 24h+, gently nudge
    Backup._checkDailyBackup();
  },

  _checkDailyBackup: function(){
    // v7.2.0: पुरानो "हरेक दिन" toast हटाइयो — अब ७ दिनसम्म कुनै ब्याकअप (फाइल वा Dropbox/Drive sync) नभए मात्र
    // सम्झाइन्छ: Dashboard मा banner, अरू page मा एक पटक toast (js/modules/backup-alert.js)।
    try { if(window.BackupAlert) BackupAlert.toastIfDue(); } catch(e){}
  },

  // Recovery: check if a newer snapshot exists than current data (after a crash)
  hasRecovery: function(){
    try {
      var t = localStorage.getItem('pk3_autosave_time');
      return !!t;
    } catch(e){ return false; }
  }
};

// ═══════════════ END BACKUP + AUTOSAVE ═══════════════

