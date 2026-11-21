// ═══════════════ CLOUD SYNC — ADAPTER (PLUGIN) ARCHITECTURE (v7.0.0) ═══════════════
// एउटै data payload, धेरै cloud। हरेक cloud एउटा "provider" (adapter) हो:
//
//   provider = {
//     id, label, icon,
//     isConfigured()              → bool   (जस्तै Client ID राखिएको छ?)
//     isConnected()               → bool
//     connect() / handleRedirect() / disconnect()
//     remoteMeta()                → Promise<{rev} | null>     (cloud को file version)
//     upload(text)                → Promise<{rev}>
//     download()                  → Promise<string>
//   }
//
// CloudSync(provider) ले Dropbox जस्तै नियम दिन्छ: conflict जाँच (rev), auto-sync (३० सेकेन्ड),
// खाली device ले cloud को data overwrite नगर्ने सुरक्षा, Restore।
//
//  • Dropbox (js/modules/sync-dropbox.js) — v6.8 देखिको, जस्ताको तस्तै (SyncHub मा दर्ता मात्र)।
//  • Google Drive (js/modules/sync-gdrive.js) — OAuth PKCE, आफ्नै Client ID, hidden appDataFolder।
//  • Swagatik Cloud (Supabase) — js/modules/sync-supabase.js मा interface तयार; पछि जोड्न मात्र बाँकी।
var SyncData = {
  // Never leaves the device: sessions, cloud tokens, API keys, license backup, local caches
  SKIP: /^(pk3_dbx_|pk3_gdrive_|pk3_supa_|pk3_session$|pk3_ai_key$|pk3_oai_key$|pk3_gem_key$|pk3_gem_key2$|pk3_autosave_|pk3_lic_backup$|pk3_tracker$|pk3_fab_pos$|pk3_data_version$)/,
  collect: function () {
    var d = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('pk3_') === 0 && !this.SKIP.test(k)) d[k] = localStorage.getItem(k);
    }
    return d;
  },
  hash: function (d) {
    var keys = Object.keys(d).sort(), h = 2166136261;
    for (var i = 0; i < keys.length; i++) {
      var s = keys[i] + '\u0001' + d[keys[i]] + '\u0002';
      for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; }
    }
    return h.toString(36) + ':' + keys.length;
  },
  hasLocalData: function () {
    var ks = ['pk3_customers', 'pk3_quotations', 'pk3_invoices', 'pk3_daybook', 'pk3_estimates', 'pk3_followups', 'pk3_returns', 'pk3_ledger', 'pk3_stock', 'pk3_walkins', 'pk3_projects', 'pk3_payables'];
    for (var i = 0; i < ks.length; i++) {
      try { var v = JSON.parse(localStorage.getItem(ks[i]) || 'null'); if (v && (Array.isArray(v) ? v.length : Object.keys(v).length)) return true; } catch (e) {}
    }
    return false;
  },
  payload: function () { return JSON.stringify({ app: 'swagatik', v: 1, appVersion: APP_VERSION, at: new Date().toISOString(), data: this.collect() }); },
  /** Replace local data with a payload (keys missing in the payload are removed, like Dropbox restore). */
  apply: function (text) {
    var obj = JSON.parse(text);
    if (!obj || obj.app !== 'swagatik' || !obj.data) throw new Error('Backup फाइल मिलेन');
    var cur = this.collect(), k;
    for (k in cur) if (!(k in obj.data)) localStorage.removeItem(k);
    for (k in obj.data) if (!this.SKIP.test(k)) localStorage.setItem(k, obj.data[k]);
    return obj;
  }
};

function CloudSync(provider) {
  this.p = provider;
  this._busy = false; this._timer = null; this._warn = '';
  this.META_KEY = 'pk3_' + provider.id + '_meta';
}
CloudSync.prototype = {
  meta: function () { try { return JSON.parse(localStorage.getItem(this.META_KEY) || '{}') || {}; } catch (e) { return {}; } },
  setMeta: function (patch) { var m = this.meta(); for (var k in patch) m[k] = patch[k]; localStorage.setItem(this.META_KEY, JSON.stringify(m)); },
  toast: function (m, t) { try { App.toast(m, t || 'success', 3500); } catch (e) {} },
  _reload: function () { location.reload(); },

  push: async function (force) {
    if (this._busy) return false; this._busy = true;
    try {
      var text = SyncData.payload(), h = SyncData.hash(SyncData.collect()), m = this.meta();
      var remote = await this.p.remoteMeta();
      if (remote && m.rev && remote.rev !== m.rev && !force) { this._warn = '⚠️ अर्को device मा data बदलिएको छ — पहिले Restore वा Sync Now गर्नुहोस्'; this.render(); return false; }
      if (remote && !m.rev && !force) { this._warn = '⚠️ ' + this.p.label + ' मा अर्को data छ'; this.render(); return false; }
      var res = await this.p.upload(text);
      this.setMeta({ rev: res.rev, hash: h, last: Date.now(), hadData: SyncData.hasLocalData() });
      this._warn = ''; this.render(); return true;
    } catch (e) { this._warn = '⚠️ Sync असफल: ' + e.message; this.render(); return false; }
    finally { this._busy = false; }
  },
  pull: async function () {
    if (this._busy) return false; this._busy = true;
    try {
      var remote = await this.p.remoteMeta();
      if (!remote) { this.toast(this.p.label + ' मा backup भेटिएन', 'error'); return false; }
      SyncData.apply(await this.p.download());
      this.setMeta({ rev: remote.rev, hash: SyncData.hash(SyncData.collect()), last: Date.now(), hadData: true });
      this._warn = '';
      this.toast('✅ ' + this.p.label + ' बाट data फर्कियो — पुनः लोड हुँदैछ…');
      var self = this; setTimeout(function () { self._reload(); }, 1200);
      return true;
    } catch (e) { this._warn = '⚠️ Restore असफल: ' + e.message; this.render(); return false; }
    finally { this._busy = false; }
  },
  afterConnect: async function () {
    try {
      var remote = await this.p.remoteMeta();
      if (!remote) { this.setMeta({ rev: '', hash: '' }); await this.push(true); this.toast('✅ पहिलो backup ' + this.p.label + ' मा सेभ भयो'); return; }
      if (!SyncData.hasLocalData()) { await this.pull(); return; }
      if (confirm(this.p.label + ' मा पहिल्यै backup छ।\n\nOK = त्यहाँबाट Restore (यहाँको data बदलिन्छ)\nCancel = अर्को विकल्प')) { await this.pull(); return; }
      if (confirm('यहाँको अहिलेको data ले ' + this.p.label + ' को backup Overwrite गर्ने?')) { this.setMeta({ rev: remote.rev }); await this.push(true); return; }
      this.disconnect(true);
    } catch (e) { this.toast('❌ ' + e.message, 'error'); }
    this.render();
  },
  syncNow: async function () {
    if (!this.p.isConnected()) return this.toast('पहिले ' + this.p.label + ' जोड्नुहोस्', 'error');
    if (!navigator.onLine) return this.toast('Internet छैन', 'error');
    var remote = await this.p.remoteMeta().catch(function () { return null; });
    var m = this.meta();
    if (remote && m.rev && remote.rev !== m.rev) {
      if (SyncData.hash(SyncData.collect()) === m.hash) return this.pull();
      if (confirm('दुवै ठाउँमा data बदलिएको छ।\nOK = ' + this.p.label + ' को data राख्ने\nCancel = यहाँको data राख्ने')) return this.pull();
      var ok = await this.push(true); if (ok) this.toast('✅ ' + this.p.label + ' मा सेभ भयो'); return;
    }
    var ok2 = await this.push(false); if (ok2) this.toast('✅ ' + this.p.label + ' मा सेभ भयो'); else if (this._warn) this.toast(this._warn, 'error');
  },
  restoreNow: async function () {
    if (!this.p.isConnected()) return this.toast('पहिले ' + this.p.label + ' जोड्नुहोस्', 'error');
    if (!confirm(this.p.label + ' को backup बाट Restore गर्ने?\nयहाँको अहिलेको data बदलिन्छ।\n(अहिलेको data को सुरक्षा कपी पहिले सेभ हुन्छ)')) return;
    try { if (window.RestoreGuard) await RestoreGuard.snapshot(this.p.label + ' Restore'); } catch (e) {}
    await this.pull();
  },
  disconnect: function (silent) {
    if (!silent && !confirm(this.p.label + ' disconnect गर्ने? (data मेटिँदैन)')) return;
    try { this.p.disconnect(); } catch (e) {}
    localStorage.removeItem(this.META_KEY); this._warn = '';
    this.render(); if (!silent) this.toast(this.p.label + ' disconnect भयो');
  },
  tick: async function () {
    if (!this.p.isConnected() || this._busy || !navigator.onLine) return;
    try {
      var m = this.meta(), h = SyncData.hash(SyncData.collect()), changed = (h !== m.hash);
      var remote = await this.p.remoteMeta();
      if (remote && m.rev && remote.rev !== m.rev) {
        if (!changed) { await this.pull(); return; }
        this._warn = '⚠️ अर्को device मा पनि data बदलिएको छ — Sync Now थिचेर छान्नुहोस्'; this.render(); return;
      }
      if (!changed) return;
      if (!SyncData.hasLocalData() && m.hadData) { this._warn = '⚠️ यहाँको data खाली देखियो — Auto-sync रोकिएको छ।'; this.render(); return; }
      await this.push(false);
    } catch (e) { /* transient */ }
  },
  start: function () {
    var self = this;
    Promise.resolve(this.p.handleRedirect ? this.p.handleRedirect() : false).then(function (justConnected) {
      if (justConnected === 'connected') return self.afterConnect();
    }).catch(function (e) { self.toast('❌ ' + e.message, 'error'); }).then(function () {
      self.render();
      if (self.p.isConnected()) setTimeout(function () { self.tick(); }, 3000);
    });
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(function () { self.tick(); }, 30000);
  },
  render: function () {
    var id = this.p.id, el = document.getElementById(id + '-status'); if (!el) return;
    var on = this.p.isConnected(), m = this.meta(), cfg = this.p.isConfigured();
    el.innerHTML = on
      ? '<span style="color:var(--green);font-weight:700;">● जोडिएको</span> — Auto-Sync चालु<br><span style="color:var(--text-muted);font-size:0.72rem;">पछिल्लो sync: ' + (m.last ? new Date(m.last).toLocaleString() : '—') + '</span>'
      : (cfg ? '<span style="color:var(--text-muted);">○ जोडिएको छैन</span>' : '<span style="color:var(--text-muted);">○ पहिले Client ID राख्नुहोस्</span>');
    var w = document.getElementById(id + '-warn'); if (w) { w.style.display = this._warn ? '' : 'none'; w.textContent = this._warn; }
    var show = function (x, v) { var e = document.getElementById(id + '-btn-' + x); if (e) e.style.display = v ? '' : 'none'; };
    show('connect', !on && cfg); show('sync', on); show('restore', on); show('disc', on);
  }
};

// Registry of every sync provider (Settings shows one card per provider)
var SyncHub = {
  _list: [],
  register: function (engineOrAdapter) { this._list.push(engineOrAdapter); return engineOrAdapter; },
  list: function () { return this._list.slice(); },
  get: function (id) { return this._list.find(function (x) { return x.id === id; }) || null; }
};
