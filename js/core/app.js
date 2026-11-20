var App = {
  currentPage: 'dashboard',
  pageHistory: [],
  themes: ['dark','light','saffron','royal','midnight','forest'],
  init: function() {
    this.loadTheme();
    // Ensure all default data exists before rendering
    try { initAppDataSafe(); } catch(e) {}
    try { Dashboard.render(); } catch(e) { console.warn('Dashboard render error:',e); }
    try { CRMClock.init(); } catch(e) {}
    try { BSCal.init(); } catch(e) {}
    try { BSPicker.init(); } catch(e) {}
    try { Notif.init(); } catch(e) {}
    try { Customers.loadServices(); } catch(e) {}
    try { Quotations.loadServices && Quotations.loadServices(); } catch(e) {}
    try { Settings.render(); } catch(e) { console.warn('Settings render error:',e); }
    try { Planner.init(); } catch(e) { console.warn('Planner init error:',e); }
    try { Backup.initAutoSave(); } catch(e) { console.warn('AutoSave init error:',e); }
    try { applyBrandLogo(); } catch(e) { console.warn('BrandLogo error:',e); }
    this.updateBsDisplay();
    // Init bottom nav
    var bn = document.getElementById('bottom-nav');
    if(bn) bn.style.display='';
    var fy=STORE.get('pk3_settings',{}).fiscalYear||autoFiscalYear();
    setText('tb-fy','FY '+fy);
  },
  navigate: function(page) {
    // ═══════ SUPER ADMIN GATE (v4.0) — block direct access ═══════
    if(page === 'admin-dashboard'){
      // Must be admin or superadmin
      if(!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')){
        App.toast('🛑 यो पेज Super Admin लाई मात्र हो।','error',3500);
        return;
      }
      // Must have valid (non-expired) unlock — if not, route through gate
      if(!Auth.isSuperAdminUnlocked()){
        Auth.openSuperAdminGate();
        return;
      }
      // Unlocked — fall through to normal navigation below
    }
    // Role check (admin AND superadmin can access non-STAFF pages)
    if(currentUser && currentUser.role!=='admin' && currentUser.role!=='superadmin' && STAFF_PAGES.indexOf(page)===-1) {
      App.toast('🔒 Admin access only','error'); return;
    }
    if(page!=='ratelist' && typeof RateList!=='undefined') RateList._editMode=false;
    try{ if(typeof Notif!=='undefined') Notif.close(); }catch(e){}
    if(this.currentPage!==page) this.pageHistory.push(this.currentPage);
    if(this.pageHistory.length>20) this.pageHistory.shift();
    // Deactivate all pages
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    var pg=document.getElementById('page-'+page);
    if(!pg) { pg=document.getElementById('page-dashboard'); page='dashboard'; }
    pg.classList.add('active');
    this.currentPage=page;
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
    var _navPage = (page==='bakauta'||page==='estimate-new') ? 'estimate-choice' : page;
    var nv=document.querySelector('.nav-item[data-page="'+_navPage+'"]');
    if(nv) nv.classList.add('active');
    // Page title
    var titles={'dashboard':'Dashboard','customers':'Customer List','add-customer':'Add Customer',
      'ledger':'Customer Ledger','quotations':'Quotation List','add-quotation':'New Quotation',
      'invoices':'Sales / बिक्री (Invoice)','followups':'Follow-ups','add-followup':'Add Follow-up',
      'walkin':'Walk-in Greeting','qrcode':'QR Code','ratelist':'Rate List',
      'bakauta':'Quick Estimate','estimate-new':'Detailed Estimate (Pro)','estimates-list':'Saved Estimates',
      'vcard':'Visiting Card','brochures':'Brochures','ai-assistant':'AI Assistant','help':'Help / About','returns':'Sales Returns','cashbook':'Cash Book',
      'dailyreport':'Daily Report','daybook':'Day Book','expenses':'Expenses','staff':'Staff Log',
      'stocklist':'Stock','salesteam':'Sales Team','bulkmsg':'Bulk Message',
      'account-summary':'Account Summary','backup':'Backup & Restore','audit':'Audit Log',
      'settings':'Settings','projects':'Projects / Sites'};
    setText('page-title', titles[page]||page);
    // Back button
    var bb=document.getElementById('back-btn');
    if(bb) bb.className='back-btn'+(this.pageHistory.length?' show':'');
    // Update bottom nav
    var bnMap={'dashboard':'dashboard','customers':'customers','add-customer':'customers',
      'quotations':'quotations','add-quotation':'quotations','followups':'followups','add-followup':'followups','settings':'settings'};
    document.querySelectorAll('.bn-btn').forEach(function(b){b.classList.remove('active');});
    var bnKey=bnMap[page]||'dashboard';
    var bnEl=document.getElementById('bn-'+bnKey);
    if(bnEl) bnEl.classList.add('active');
    // Render page
    var renders={'projects':function(){Projects.render();},'expenses':function(){Expenses.render();},'cashbook':function(){CashBook.render();},'returns':function(){SalesReturns.render();},'customers':function(){Customers.render();},'quotations':function(){Quotations.render();},'followups':function(){Followups.render();},'planner':function(){Planner.render();},'daybook':function(){DayBook.render();},'ratelist':function(){RateList.render();},'staff':function(){Staff.render();},'stocklist':function(){Stock.render();},'salesteam':function(){SalesTeam.render();},'bulkmsg':function(){BulkMsg.render();},'account-summary':function(){AccountSummary.render();},'backup':function(){Backup.render();},'audit':function(){Audit.render();},'settings':function(){Settings.render();try{DBX.render();}catch(e){}},'add-customer':function(){Customers.initForm();},'add-quotation':function(){Quotations.initForm();},'add-followup':function(){Followups.initForm();},'invoices':function(){Invoices.render();},'ledger':function(){Ledger.render();},'bakauta':function(){Bakauta.render();},'estimates-list':function(){Bakauta.renderList();},'estimate-new':function(){Estimate.init();},'vcard':function(){VCard.render();},'brochures':function(){Brochure.render();},'ai-assistant':function(){AIAssistant.render();},'admin-dashboard':function(){AdminDash.render();},'dailyreport':function(){Reports.render();},'walkin':function(){Walkin.render();},'qrcode':function(){QR.render();},'vatcalc':function(){VatCalc.render();},'dashboard':function(){Dashboard.render();}};
    if(renders[page]) {
      try { renders[page](); }
      catch(e) { console.error('Page render error ['+page+']:', e); App.toast('⚠️ Page load error: '+e.message,'error'); }
    }
    // Close sidebar on mobile
    if(window.innerWidth<900) this.closeSidebar();
    // Scroll top
    var m=document.getElementById('main'); if(m) m.scrollTop=0;
  },
  goBack: function() {
    if(this.pageHistory.length) this.navigate(this.pageHistory.pop());
    else this.navigate('dashboard');
  },
  toggleSidebar: function() {
    var sb=document.getElementById('sidebar'), bd=document.getElementById('sb-backdrop');
    sb.classList.toggle('open'); bd.classList.toggle('show');
  },
  closeSidebar: function() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sb-backdrop').classList.remove('show');
  },
  toast: function(msg,type,dur) {
    if(STORE.get('pk3_settings',{}).muteTost) return;
    var tc=document.getElementById('toast-container');
    var t=document.createElement('div');
    t.className='toast'+(type?' '+type:'');
    t.textContent=msg;
    tc.appendChild(t);
    setTimeout(function(){t.classList.add('fade-out');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);},dur||3000);
  },
  showLogin: function() {
    var wel = document.getElementById('welcome-overlay');
    var log = document.getElementById('login-screen');
    if (wel) { wel.style.display = 'none'; wel.style.pointerEvents = 'none'; }
    if (log) { log.classList.remove('hide'); log.style.display = 'flex'; }
    setTimeout(function(){ var u = document.getElementById('login-user'); if (u) try { u.focus(); } catch(e){} }, 200);
  },
  saveSkipWelcome: function(v) { STORE.set('pk3_skipWelcome',v); },
  loadTheme: function() {
    var t=STORE.get('pk3_theme','dark');
    document.body.className='theme-'+t;
  },
  setTheme: function(t) { STORE.set('pk3_theme',t); document.body.className='theme-'+t; App.toast('🎨 Theme: '+t,'info'); },
  cycleTheme: function() {
    var cur=STORE.get('pk3_theme','dark');
    var i=this.themes.indexOf(cur); var n=this.themes[(i+1)%this.themes.length];
    this.setTheme(n);
  },
  updateBsDisplay: function() {
    var d=new Date(); var b=adToBs(d.getFullYear(),d.getMonth()+1,d.getDate());
    var bsStr='बि.सं. '+b.y+'/'+String(b.m).padStart(2,'0')+'/'+String(b.d).padStart(2,'0');
    setText('sb-bs',bsStr); setText('tb-bs',bsStr);
  },
  showCalc: function() { document.getElementById('calc-modal').classList.add('open'); CRMCalc.reset(); },
};

