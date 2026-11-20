// ============================================================
// UTILITY: download text file helper
// ============================================================
function downloadText(content, filename, mime){
  var blob = new Blob([content], {type: mime||'text/plain'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================
// APP INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function(){
  // STEP 0 (v7.0.0): fresh-vs-existing detection + one-time safe migration. MUST run before
  // any default data is seeded, so a fresh device can be told apart from an existing one.
  try { Migrations.run(); } catch(e) { console.warn('v7 migration error:', e); }
  try { Modules.apply(); } catch(e) {}
  // STEP 1: Migrate any old bare keys → pk3_* keys
  try { migrateOldKeysToPk3(); } catch(e) { console.warn('migrate error:', e); }
  // STEP 2: Repair/seed business data (services, rates, templates)
  try { repairBusinessData(); } catch(e) { console.warn('repairBusinessData error:', e); }
  // STEP 3: Initialize remaining app data
  try { initAppDataSafe(); } catch(e) { console.warn('initAppDataSafe error:', e); }

  // Template integrity check: fix any templates with missing/empty names
  try {
    var _storedTpls = STORE.get('pk3_templates', null);
    if (_storedTpls && Array.isArray(_storedTpls) && _storedTpls.length > 0) {
      var _hasBroken = _storedTpls.some(function(t){ return !t || !t.name || t.name.trim() === ''; });
      if (_hasBroken) {
        // Merge: keep good user templates, restore defaults for broken ones
        var _good = _storedTpls.filter(function(t){ return t && t.name && t.name.trim() !== ''; });
        STORE.set('pk3_templates', _good.length > 0 ? _good : Followups._defTpl());
      }
    }
  } catch(e) {}

  // v5.4: पुराना customer लाई services[] मा सार्ने (एक पटक मात्र)
  try { Customers.migrateServices(); } catch(e){ console.warn('migrate', e); }
  try { Brand.apply(); } catch(e){ console.warn('brand', e); }

  // Start clock
  CRMClock.init();

  // Show uploaded company logo on login/sidebar/topbar (v4.3)
  try { applyBrandLogo(); } catch(e){}

  // Tooltips: Bootstrap was never loaded — using native title attribute instead.
  // (Removed dead bootstrap.Tooltip init.)

  // Boot: License gate first (v5.3) — activated भए फेरि key सोध्दैन
  if(typeof License!=='undefined' && !License.check()){
    // Not activated — license screen is shown; stop here until user activates
  } else {
    // Boot auth (handles session check + show login or app)
    Auth.init();
  }

  // (Dead sidebar-toggle/sidebar-overlay listeners removed in v4.9 —
  //  the working mobile toggle is #hamburger → App.toggleSidebar() with .sb-backdrop)

  // ── Global Escape: close any open .modal-overlay (better a11y) ──
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    var open = document.querySelector('.modal-overlay.open');
    if(open){
      open.classList.remove('open');
      e.stopPropagation();
    }
  });

  // Bottom nav clicks
  document.querySelectorAll('.bottom-nav-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var page = btn.getAttribute('data-page');
      if(page) App.navigate(page);
    });
  });

  // (Dead fab-main/fab-menu listener removed in v4.9 — real FAB uses the ⚡ button → fab-modal)

  // Global search shortcut Ctrl+K
  document.addEventListener('keydown', function(e){
    if((e.ctrlKey||e.metaKey) && e.key==='k'){
      e.preventDefault();
      var gs = document.getElementById('global-search');
      if(gs) gs.focus();
    }
  });

  // Global search input (v4.8 — styled results, click → customer detail)
  var globalSearch = document.getElementById('global-search');
  if(globalSearch){
    var gsHide = function(){ var el=document.getElementById('global-search-results'); if(el){el.style.display='none'; el.innerHTML='';} };
    globalSearch.addEventListener('input', function(){
      var q = this.value.trim().toLowerCase();
      var el = document.getElementById('global-search-results');
      if(!el) return;
      if(!q){ gsHide(); return; }
      var custs = STORE.get('pk3_customers',[])||[];
      var results = custs.filter(function(c){
        return (c.name||'').toLowerCase().indexOf(q)>=0 || String(c.phone||'').indexOf(q)>=0;
      }).slice(0,6);
      if(!results.length){
        el.innerHTML = '<div class="gsr-item" style="cursor:default;color:var(--text-muted);">कुनै customer भेटिएन — <span style="color:var(--accent);cursor:pointer;font-weight:700;" onclick="App.navigate(\'add-customer\');document.getElementById(\'global-search\').value=\'\';">+ Add गर्नुस्</span></div>';
        el.style.display='block';
        return;
      }
      el.innerHTML = results.map(function(c){
        return '<div class="gsr-item" onclick="App.navigate(\'customers\');setTimeout(function(){try{Customers.detail(\''+c.id+'\');}catch(e){}},300);document.getElementById(\'global-search\').value=\'\';var e=document.getElementById(\'global-search-results\');if(e){e.style.display=\'none\';e.innerHTML=\'\';}">'
          + '<b>'+esc(c.name||'')+'</b><span>'+esc(c.phone||'')+'</span></div>';
      }).join('');
      el.style.display='block';
    });
    globalSearch.addEventListener('keydown', function(e){
      if(e.key==='Escape'){ this.value=''; gsHide(); this.blur(); }
    });
    document.addEventListener('click', function(e){
      if(!e.target.closest('.gs-wrap')) gsHide();
    });
  }

  // Drag widgets init
  DragWidget.init();

  // Draggable Quick-Actions FAB (v5.0)
  try { FabDrag.init(); } catch(e){ console.warn('FabDrag error',e); }

  // (PWA install handler removed in v5.1 — meaningless on file://, used Bootstrap d-none)
});

