/* PWA service worker — registers only when hosted over http(s) (not file://).
   The separate sw.js + icon files must sit beside this HTML on the host for full offline/install.

   v7.3.0 — Smart update notice (SwUpdate):
   • नयाँ version को sw.js आएपछि ब्राउजरले त्यसलाई "waiting" मा राख्छ (sw.js ले अपडेटमा आफैं skipWaiting गर्दैन)।
   • एपले सानो ब्यानर देखाउँछ: "🔄 नयाँ अपडेट उपलब्ध छ — रिफ्रेश गर्नुहोस्"। थिचेपछि मात्र नयाँ version
     सक्रिय हुन्छ र पेज एक पटक reload हुन्छ — Ctrl+Shift+R थिच्नु पर्दैन, फारम भर्दाभर्दै अचानक reload हुँदैन।
   • पेज पहिल्यै नयाँ version मा छ (जस्तै साधारण reload पछि) भने ब्यानर नदेखाई चुपचाप सक्रिय गरिन्छ।
   • एप खुला रहँदा पनि हरेक ३० मिनेट र एपमा फर्किँदा अपडेट जाँचिन्छ। */
var SwUpdate = {
  CHECK_MS: 30 * 60 * 1000,
  _reg: null, _requested: false, _silent: false, _shown: false, _dismissed: false,

  /** Ask a (waiting) worker its version; resolves null when it does not answer. */
  _askVersion: function (worker) {
    return new Promise(function (res) {
      var done = false, fin = function (v) { if (!done) { done = true; res(v); } };
      try {
        var ch = new MessageChannel();
        ch.port1.onmessage = function (e) { fin(e.data && e.data.version || null); };
        worker.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
      } catch (e) { fin(null); }
      setTimeout(function () { fin(null); }, 2000);
    });
  },

  /** A new worker is installed and waiting to take over. */
  onWaiting: function (worker) {
    var self = this;
    if (!worker) return Promise.resolve();
    return this._askVersion(worker).then(function (ver) {
      var cur = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '';
      if (ver && cur && ver === cur) {
        // पेज नयाँ नै छ, पुरानो worker मात्र बाँकी → चुपचाप सक्रिय (reload चाहिँदैन)
        self._silent = true;
        try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        return;
      }
      self.show(ver);
    });
  },

  _watch: function (reg) {
    var self = this;
    this._reg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) this.onWaiting(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function () {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) self.onWaiting(reg.waiting || nw);
      });
    });
  },

  check: function () { try { if (this._reg) this._reg.update(); } catch (e) {} },

  /** Banner (built in JS so every page shows it; text is app-level, not company data). */
  show: function (ver, activated) {
    if (this._dismissed && !activated) return;
    this._shown = true;
    var el = document.getElementById('sw-update-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sw-update-banner';
      el.className = 'sw-update-banner';
      el.setAttribute('role', 'status');
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML =
      '<span class="sw-update-text">🔄 <b>नयाँ अपडेट उपलब्ध छ</b>' + (ver ? ' <span class="sw-update-ver">(v' + String(ver).replace(/[^\d.]/g, '') + ')</span>' : '') +
        ' — रिफ्रेश गर्नुहोस्। <small>तपाईंको डाटा सुरक्षित रहन्छ।</small></span>' +
      '<span class="sw-update-btns">' +
        '<button type="button" id="sw-update-refresh" class="btn btn-sm btn-primary" onclick="SwUpdate.apply()">🔄 रिफ्रेश गर्नुहोस्</button>' +
        '<button type="button" id="sw-update-later" class="btn btn-sm btn-secondary" onclick="SwUpdate.dismiss()" title="पछि">✕</button>' +
      '</span>';
    el.style.display = '';
  },
  dismiss: function () {
    this._dismissed = true;
    var el = document.getElementById('sw-update-banner');
    if (el) el.style.display = 'none';
  },

  /** User pressed "रिफ्रेश": save a recovery snapshot, activate the new worker, reload once. */
  apply: function () {
    var self = this;
    this._requested = true;
    try { if (window.Backup && Backup.autoSave) Backup.autoSave(); } catch (e) {}
    var w = this._reg && this._reg.waiting;
    if (w) {
      try { w.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
      // controllerchange ले reload गर्छ; केही कारणले नआए पनि ३ सेकेन्डमा reload
      setTimeout(function () { self._reload(); }, 3000);
    } else {
      this._reload();
    }
  },
  _reloaded: false,
  _reload: function () { if (this._reloaded) return; this._reloaded = true; location.reload(); },

  _hadController: false,
  onControllerChange: function () {
    // पहिलो install (पहिले कुनै worker थिएन) → clients.claim() मात्र, अपडेट होइन
    if (!this._hadController) { this._hadController = true; return; }
    if (this._requested) return this._reload();
    if (this._silent) { this._silent = false; return; }
    // अर्को ट्याबमा रिफ्रेश थिचियो → यो ट्याबको पेज पुरानो छ; बलपूर्वक reload नगरी ब्यानर देखाउने
    this._dismissed = false;
    this.show('', true);
  }
};

(function(){
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
      //  • updateViaCache:'none' → browser HTTP cache never hides a new sw.js
      //  • check for updates on load, every 30 min, and whenever the app comes back to the foreground
      //  • a new version waits until the user taps "रिफ्रेश गर्नुहोस्" (SwUpdate banner)
      SwUpdate._hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function(){ SwUpdate.onControllerChange(); });
      window.addEventListener('load', function(){
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function(reg){
          SwUpdate._watch(reg);
          SwUpdate.check();
          document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') SwUpdate.check(); });
          setInterval(function(){ if (document.visibilityState !== 'hidden') SwUpdate.check(); }, SwUpdate.CHECK_MS);
        }).catch(function(){ /* offline/unsupported: app still runs single-file */ });
      });
    }
  } catch(e) {}
})();
