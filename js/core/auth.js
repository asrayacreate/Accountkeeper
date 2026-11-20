var Auth = {
  init: function() {
    var saved = STORE.get('pk3_session');
    if(saved && saved.user) {
      // v6.9.0: session keeps only the hash. Old sessions ({user, pass}) are upgraded once.
      var ph = saved.ph || (saved.pass != null ? _pwHash(saved.pass) : '');
      var found = USERS_CONFIG.find(function(u){return u.user===saved.user&&u.passHash===ph;});
      if(found) {
        if(saved.pass != null) STORE.set('pk3_session',{user:found.user,ph:found.passHash});
        currentUser=found; this._showApp(); return;
      }
    }
    // Welcome (ॐ नमः शिवाय) screen is now OPT-IN — default OFF, go straight to login.
    var showWelcome = STORE.get('pk3_showWelcome', false);
    if(!showWelcome){
      var _w=document.getElementById('welcome-overlay'); if(_w){ _w.style.display='none'; _w.style.pointerEvents='none'; }
      var _l=document.getElementById('login-screen'); if(_l){ _l.classList.remove('hide'); _l.style.display='flex'; }
    }
    // else welcome screen shows (user enabled it in Settings)
  },
  login: function() {
    var u=getVal('login-user'), p=getVal('login-pass');
    var ph=_pwHash(p);
    var found=USERS_CONFIG.find(function(x){return x.user===u&&x.passHash===ph;});
    var err=document.getElementById('login-err');
    if(!found) { err.classList.add('show'); return; }
    err.classList.remove('show');
    currentUser=found;
    if(document.getElementById('remember-me').checked) STORE.set('pk3_session',{user:found.user,ph:found.passHash});
    this._showApp();
    Audit.log('LOGIN','User logged in: '+found.name+' ('+found.role+')');
  },
  logout: function() {
    if(!confirm('Logout गर्नुहुन्छ?')) return;
    // Clear Super Admin unlock so next user can't inherit it
    try { this.lockSuperAdmin(); } catch(e){}
    // Clear in-memory state
    currentUser=null; STORE.del('pk3_session');
    // Stop any running timers (clock, etc.) to prevent ghost intervals after reload
    try { if(CRMClock && CRMClock.destroy) CRMClock.destroy(); } catch(e){}
    // Show toast briefly, then do a clean reload — this is the most reliable
    // way to reset all module state (Dashboard, Customers, etc.) without leaving
    // ghost listeners or half-rendered DOM. Fixes the "page load error after logout".
    App.toast('👋 Logout भयो','info');
    setTimeout(function(){
      try {
        // Hide UI immediately while reload happens
        var ls = document.getElementById('login-screen'); if(ls) ls.classList.remove('hide');
        var mn = document.getElementById('main');         if(mn) mn.style.display='none';
        var hb = document.getElementById('hamburger');    if(hb) hb.style.display='none';
        var sb = document.getElementById('sidebar');      if(sb) sb.classList.remove('open');
        var bd = document.getElementById('sb-backdrop');  if(bd) bd.classList.remove('show');
      } catch(e){}
      // Force a clean reload — fastest, most reliable reset
      window.location.reload();
    }, 400);
  },
  _showApp: function() {
    document.getElementById('login-screen').classList.add('hide');
    document.getElementById('welcome-overlay').style.display='none';
    document.getElementById('main').style.display='';
    // First-run only: seed sample data on a genuinely empty install (self-limits via flag)
    try { if (window.SampleData) SampleData.maybeAutoSeed(); } catch(e){}
    // ── STEP 1: Super Admin sidebar visibility (exact spec) ──
    var sa = document.getElementById('nav-superadmin-link');
    if(sa){
      if(currentUser.role === 'staff'){
        sa.style.display = 'none';
      } else {
        sa.style.display = 'flex';
      }
    }
    // Admin Panel link follows same rule
    var adminLink = document.getElementById('nav-admin-link');
    if(adminLink){
      if(currentUser.role === 'staff') adminLink.style.display = 'none';
      else                              adminLink.style.display = 'flex';
    }
    // Set username display
    setText('sb-user', currentUser.name);
    // Role badge
    var rb=document.getElementById('sb-role-badge');
    if(rb) rb.innerHTML='<span class="role-badge '+currentUser.role+'">'+currentUser.role.toUpperCase()+'</span>';
    // Hide admin-only nav items for staff (BUT show them for superadmin too)
    document.querySelectorAll('.nav-item[data-role="admin"]').forEach(function(el){
      el.style.display = (currentUser.role==='admin' || currentUser.role==='superadmin')?'':'none';
    });
    // Update role badge with color
    var roleColors = {superadmin:'#a78bfa',admin:'var(--accent)',staff:'var(--green)'};
    if(rb) rb.innerHTML='<span class="role-badge" style="background:'+(roleColors[currentUser.role]||'var(--accent)')+';color:#fff;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:700;">'+currentUser.role.toUpperCase()+'</span>';
    setText('dash-username', currentUser.name);
    App.init();
    Greet.checkBirthdays();
    // ── SAFETY (v4.0.2/4.0.6): re-assert Super Admin & Admin Panel visibility
    // after init in case any module re-rendered the sidebar mid-init.
    // Uses setProperty important so it cannot be overridden again.
    setTimeout(function(){
      if(!currentUser) return;
      var isAdminLike2 = (currentUser.role==='admin' || currentUser.role==='superadmin');
      var sa = document.getElementById('nav-superadmin-link');
      if(sa){
        if(isAdminLike2) sa.style.setProperty('display','flex','important');
        else             sa.style.setProperty('display','none','important');
      }
      var ap = document.getElementById('nav-admin-link');
      if(ap){
        if(isAdminLike2) ap.style.setProperty('display','flex','important');
        else             ap.style.setProperty('display','none','important');
      }
      // Also re-show admin-only items for superadmin
      if(currentUser.role==='superadmin'){
        document.querySelectorAll('.nav-item[data-role="admin"]').forEach(function(el){
          el.style.display = '';
        });
      }
    }, 300);
  },
  togglePw: function() {
    var inp=document.getElementById('login-pass');
    inp.type=inp.type==='password'?'text':'password';
  },
  openUsersModal: function() {
    if(!currentUser || (currentUser.role!=='admin' && currentUser.role!=='superadmin')){
      App.toast('🔒 Admin only','error'); return;
    }
    var body=document.getElementById('users-modal-body');
    body.innerHTML='<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">Credentials are managed in code. Current users:</div>'+
      USERS_CONFIG.map(function(u){ return '<div style="padding:10px;background:var(--surface-2);border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">'+
        '<div><strong>'+u.name+'</strong><div style="font-size:0.72rem;color:var(--text-muted);">@'+u.user+' • '+u.role+'</div></div>'+
        '<span class="role-badge '+u.role+'">'+u.role.toUpperCase()+'</span></div>';}).join('');
    document.getElementById('users-modal').classList.add('open');
  },

  // ═══════════════ SUPER ADMIN GATE ═══════════════
  // Session flag is in-memory only — re-locks on refresh/logout.
  superAdminUnlocked: false,

  isSuperAdminUnlocked: function() {
    return Auth.superAdminUnlocked === true;
  },

  openSuperAdminGate: function() {
    if(!currentUser){
      alert('Please login first');
      return;
    }
    if(currentUser.role === 'staff'){
      alert('Access denied');
      return;
    }
    var m = document.getElementById('superadmin-gate-modal');
    if(!m) return;
    var inp = document.getElementById('superadmin-pass');
    if(inp) inp.value = '';
    var err = document.getElementById('superadmin-gate-err');
    if(err) err.style.display = 'none';
    m.style.display = 'flex';
    setTimeout(function(){ var i=document.getElementById('superadmin-pass'); if(i) i.focus(); }, 100);
  },

  verifySuperAdminPassword: function() {
    var input = (document.getElementById('superadmin-pass')||{}).value || '';
    var correct = currentUser ? currentUser.passHash : null;
    var err = document.getElementById('superadmin-gate-err');
    if(input && correct && _pwHash(input) === correct){
      Auth.superAdminUnlocked = true;
      var m = document.getElementById('superadmin-gate-modal');
      if(m) m.style.display = 'none';
      var inp = document.getElementById('superadmin-pass'); if(inp) inp.value = '';
      try { Audit.log('SECURITY','Super Admin unlocked by '+currentUser.user); } catch(e){}
      App.navigate('admin-dashboard');
    } else {
      if(err) err.style.display = 'block';
      try { Audit.log('SECURITY','Failed Super Admin verification by '+(currentUser?currentUser.user:'?')); } catch(e){}
      alert('Wrong password');
    }
  },

  lockSuperAdmin: function() {
    Auth.superAdminUnlocked = false;
    var m = document.getElementById('superadmin-gate-modal');
    if(m) m.style.display = 'none';
    var inp = document.getElementById('superadmin-pass'); if(inp) inp.value = '';
    var err = document.getElementById('superadmin-gate-err'); if(err) err.style.display = 'none';
  },

  // Backward-compat alias for any code still calling closeSuperAdminGate
  closeSuperAdminGate: function() { Auth.lockSuperAdmin(); }
  // ═══════════════ END SUPER ADMIN GATE ═══════════════
};

