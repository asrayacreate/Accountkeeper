// ============================================================
// GLOBAL ERROR BOUNDARY — one module crash won't kill the app
// ============================================================
window.addEventListener('error', function(e){
  try {
    var msg = (e && e.message) ? e.message : 'Unknown error';
    var src = (e && e.filename) ? (' @ '+e.filename.split('/').pop()+':'+e.lineno) : '';
    console.warn('[GlobalError]', msg, src);
    // Show a small toast but never throw further
    if(window.App && App.toast) App.toast('⚠️ '+msg.slice(0,80),'error',4000);
  } catch(_){}
  return true;
});
window.addEventListener('unhandledrejection', function(e){
  try {
    var reason = e && e.reason && (e.reason.message || e.reason);
    console.warn('[UnhandledPromise]', reason);
  } catch(_){}
});

// ============================================================
// OFFLINE / ONLINE INDICATOR
// ============================================================
(function(){
  function makeBadge(){
    var b = document.createElement('div');
    b.id = 'pk-net-badge';
    b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);'
      +'z-index:99999;padding:5px 14px;border-radius:20px;font-size:0.72rem;'
      +'font-weight:700;color:#fff;background:#dc2626;box-shadow:0 4px 12px rgba(0,0,0,0.3);'
      +'display:none;letter-spacing:0.3px;';
    b.textContent = '📡 Offline — local mode';
    document.body.appendChild(b);
    return b;
  }
  function update(){
    var b = document.getElementById('pk-net-badge') || makeBadge();
    b.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  // Defer so body is present
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', update);
  else update();
})();

// AUTO-BACKUP REMINDER — v7.2.0 देखि js/modules/backup-alert.js (BackupAlert) ले गर्छ।
// (पुरानो pk3_lastBackupNudge toast ले वास्तविक backup मिति हेर्दैनथ्यो, त्यसैले हटाइयो।)

// ============================================================
// (kept simple so user can install on Chrome/Edge/Android)
// ============================================================

