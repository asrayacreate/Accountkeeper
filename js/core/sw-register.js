/* PWA service worker — registers only when hosted over http(s) (not file://).
   The separate sw.js + icon files must sit beside this HTML on the host for full offline/install. */
(function(){
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
      // v6.9.0: never get stuck on an old version —
      //  • updateViaCache:'none' → browser HTTP cache never hides a new sw.js
      //  • check for updates on load and whenever the app comes back to the foreground
      //  • when the new version takes over, reload once so the screen shows it
      var hadController = !!navigator.serviceWorker.controller, reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        if (!hadController || reloaded) return;
        reloaded = true;
        try { if (window.App && App.toast) App.toast('🔄 नयाँ version (v' + APP_VERSION + ' पछि) आयो — reload हुँदैछ…', 'info', 2500); } catch(e){}
        setTimeout(function(){ location.reload(); }, 800);
      });
      window.addEventListener('load', function(){
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function(reg){
          try { reg.update(); } catch(e){}
          document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') { try { reg.update(); } catch(e){} } });
        }).catch(function(){ /* offline/unsupported: app still runs single-file */ });
      });
    }
  } catch(e) {}
})();
