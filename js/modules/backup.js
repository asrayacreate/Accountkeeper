// ─── BACKUP MODULE ────────────────────────────────────────────
var Backup = {
  render: function(){
    var lastBk=STORE.get('lastBackup');
    var disp=lastBk?fmtDisplayDate(lastBk):'Never';
    setText('last-backup-time',disp);
    setText('settings-last-backup',disp);
  },
  exportJSON: function(){
    var data={};
    ['pk3_customers','pk3_quotations','pk3_followups','pk3_daybook','pk3_rates','pk3_walkins','pk3_staff','pk3_stock','pk3_stockHistory','pk3_sales','pk3_templates','pk3_bulkFolders','pk3_users','pk3_audit','pk3_invoices','pk3_ledger','pk3_notif','pk3_activity','pk3_company','pk3_settings','pk3_tracker','pk3_vcard','pk3_estimates','pk3_planner','pk3_brochures','pk3_qa_order','pk3_returns','pk3_cashbook_opening','pk3_projects','pk3_pay_qr','pk3_doc_terms'].forEach(function(k){data[k]=STORE.get(k,null);});
    data._meta={version:'v3.9 Final',date:todayISO(),exportedBy:currentUser?currentUser.name:'unknown'};
    var dateStr=new Date().toISOString().slice(0,10);
    var filename='swagatik-backup-'+dateStr+'.json';
    downloadFile(filename,JSON.stringify(data,null,2));
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
        Object.keys(data).forEach(function(k){if(k!=='_meta' && License._STORES.indexOf(k)===-1)STORE.set(k,data[k]);});
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
  ALL_KEYS: ['pk3_customers','pk3_quotations','pk3_followups','pk3_daybook','pk3_rates','pk3_walkins','pk3_staff','pk3_stock','pk3_stockHistory','pk3_sales','pk3_templates','pk3_bulkFolders','pk3_users','pk3_audit','pk3_invoices','pk3_ledger','pk3_notif','pk3_activity','pk3_company','pk3_settings','pk3_tracker','pk3_vcard','pk3_estimates','pk3_planner','pk3_qa_order','pk3_brochures','pk3_returns','pk3_cashbook_opening','pk3_projects','pk3_pay_qr','pk3_doc_terms'],

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
    try {
      var last = STORE.get('lastBackup', null);
      if(!last){ return; } // first run — don't nag
      var diff = Date.now() - new Date(last).getTime();
      var days = diff / (1000*60*60*24);
      if(days >= 1){
        setTimeout(function(){
          if(window.App && App.toast){
            App.toast('💾 '+Math.floor(days)+' दिनदेखि backup भएको छैन — Backup page बाट download गर्नुस्','warning',6000);
          }
        }, 3000);
      }
    } catch(e){}
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

