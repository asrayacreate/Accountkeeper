// ═══════════════ DROPBOX SYNC (v6.8.1) — OAuth2 PKCE, no server ═══════════════
var DBX = {
  KEY: 'okopfgpojy47x4o',
  FILE: '/swagatik-backup.json',
  SKIP: /^(pk3_dbx_|pk3_session$|pk3_ai_key$|pk3_oai_key$|pk3_gem_key$|pk3_gem_key2$|pk3_autosave_|pk3_lic_backup$|pk3_tracker$|pk3_fab_pos$|pk3_data_version$)/,
  _busy: false, _timer: null, _warn: '',
  _reload: function(){ location.reload(); },
  _errText: async function(r, label){
    var txt = ''; try { txt = await r.text(); } catch(e){}
    var sum = txt;
    try { var j = JSON.parse(txt); sum = j.error_summary || (j.error && (j.error['.tag'] || JSON.stringify(j.error))) || j.error_description || txt; } catch(e){}
    sum = String(sum || '').trim().slice(0, 300);
    return { status: r.status, summary: sum, message: label + ' HTTP ' + r.status + (sum ? ' — ' + sum : '') };
  },
  _sleep: function(ms){ return new Promise(function(res){ setTimeout(res, ms); }); },
  redirect: function(){ return location.origin + location.pathname.replace(/index\.html$/, ''); },
  _get: function(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } },
  _put: function(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  auth: function(){ return this._get('pk3_dbx_auth'); },
  meta: function(){ return this._get('pk3_dbx_meta') || {}; },
  setMeta: function(patch){ var m = this.meta(); for (var k in patch) m[k] = patch[k]; this._put('pk3_dbx_meta', m); },
  connected: function(){ var a = this.auth(); return !!(a && a.refresh); },
  toast: function(m, t){ try { App.toast(m, t || 'success', 3500); } catch(e){ console.log(m); } },
  _b64url: function(buf){ var s = ''; var b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  _rand: function(n){ var a = new Uint8Array(n); crypto.getRandomValues(a); return this._b64url(a.buffer); },

  // ── 1. CONNECT ──
  connect: async function(){
    try {
      if (!(window.crypto && crypto.subtle)) { this.toast('❌ यो browser मा Dropbox चल्दैन (https चाहिन्छ)', 'error'); return; }
      var v = this._rand(48);
      localStorage.setItem('pk3_dbx_verifier', v);
      var ch = this._b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
      var url = 'https://www.dropbox.com/oauth2/authorize?client_id=' + this.KEY
        + '&response_type=code&token_access_type=offline&code_challenge_method=S256&code_challenge=' + ch
        + '&redirect_uri=' + encodeURIComponent(this.redirect());
      location.href = url;
    } catch(e){ this.toast('❌ Connect भएन: ' + e.message, 'error'); }
  },
  _tokenPost: async function(params){
    var r = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString() });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.error || ('HTTP ' + r.status));
    return j;
  },
  handleRedirect: async function(){
    var q = new URLSearchParams(location.search);
    if (!q.get('code') && !q.get('error')) return false;
    var code = q.get('code'), err = q.get('error');
    try { history.replaceState(null, '', this.redirect()); } catch(e){}
    if (err || !code) { this.toast('❌ Dropbox connect रद्द भयो', 'error'); return true; }
    try {
      var j = await this._tokenPost({ code: code, grant_type: 'authorization_code', client_id: this.KEY,
        code_verifier: localStorage.getItem('pk3_dbx_verifier') || '', redirect_uri: this.redirect() });
      this._put('pk3_dbx_auth', { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 14400) * 1000 });
      localStorage.removeItem('pk3_dbx_verifier');
      this.toast('✅ Dropbox जोडियो');
      await this.afterConnect();
    } catch(e){ this.toast('❌ Dropbox login असफल: ' + e.message, 'error'); }
    return true;
  },
  token: async function(){
    var a = this.auth(); if (!a || !a.refresh) throw new Error('Dropbox जोडिएको छैन');
    if (a.access && a.exp > Date.now() + 60000) return a.access;
    var j = await this._tokenPost({ grant_type: 'refresh_token', refresh_token: a.refresh, client_id: this.KEY });
    a.access = j.access_token; a.exp = Date.now() + (j.expires_in || 14400) * 1000; this._put('pk3_dbx_auth', a);
    return a.access;
  },

  // ── 2. DROPBOX API ──
  _meta: async function(path){
    var t = await this.token();
    var r = await fetch('https://api.dropboxapi.com/2/files/get_metadata', { method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path }) });
    if (!r.ok) { var e = await this._errText(r, 'Metadata'); if (r.status === 409 && /not_found/.test(e.summary)) return null; throw new Error(e.message); }
    return await r.json();
  },
  _download: async function(path){
    var t = await this.token();
    var r = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Dropbox-API-Arg': JSON.stringify({ path: path }) } });
    if (!r.ok) { var e = await this._errText(r, 'Download'); if (r.status === 409 && /not_found/.test(e.summary)) return null; throw new Error(e.message); }
    return await r.text();
  },
  _upload: async function(path, text){
    var arg = JSON.stringify({ path: path, mode: { '.tag': 'overwrite' }, autorename: false, mute: true, strict_conflict: false });
    var body = new Blob([text], { type: 'application/octet-stream' });
    var last = null;
    for (var attempt = 0; attempt < 4; attempt++) {
      var t = await this.token();
      var r = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
        headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': arg }, body: body });
      if (r.ok) return await r.json();
      last = await this._errText(r, 'Upload');
      try { console.warn('Dropbox upload error:', path, last.status, last.summary); } catch(e){}
      // Retry transient errors: write-lock contention / rate limit / server busy
      if (r.status === 429 || r.status >= 500 || /too_many_write_operations|too_many_requests|internal_error/.test(last.summary)) {
        await this._sleep(1500 * (attempt + 1)); continue;
      }
      break;
    }
    throw new Error(last ? last.message : 'Upload failed');
  },

  // ── 3. DATA ──
  collect: function(){
    var d = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('pk3_') === 0 && !this.SKIP.test(k)) d[k] = localStorage.getItem(k);
    }
    return d;
  },
  _hash: function(d){
    var keys = Object.keys(d).sort(), h = 2166136261;
    for (var i = 0; i < keys.length; i++) {
      var s = keys[i] + '\u0001' + d[keys[i]] + '\u0002';
      for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; }
    }
    return h.toString(36) + ':' + keys.length;
  },
  hasLocalData: function(){
    var ks = ['pk3_customers','pk3_quotations','pk3_invoices','pk3_daybook','pk3_estimates','pk3_followups','pk3_returns','pk3_ledger','pk3_stock','pk3_walkins','pk3_projects'];
    for (var i = 0; i < ks.length; i++) {
      try { var v = JSON.parse(localStorage.getItem(ks[i]) || 'null');
        if (v && (Array.isArray(v) ? v.length : Object.keys(v).length)) return true; } catch(e){}
    }
    return false;
  },

  // ── 4. PUSH / PULL ──
  push: async function(force){
    if (this._busy) return false; this._busy = true;
    try {
      var d = this.collect(), h = this._hash(d), m = this.meta();
      var remote = await this._meta(this.FILE);
      if (remote && m.rev && remote.rev !== m.rev && !force) {
        this._warn = '⚠️ दोस्रो device मा data बदलिएको छ — पहिले "Dropbox बाट Restore" वा Sync Now गर्नुहोस्';
        this.render(); return false;
      }
      if (remote && !m.rev && !force) { this._warn = '⚠️ Dropbox मा अर्को data छ'; this.render(); return false; }
      var payload = JSON.stringify({ app: 'swagatik', v: 1, at: new Date().toISOString(), data: d });
      var res = await this._upload(this.FILE, payload);
      var today = new Date().toISOString().slice(0, 10);
      var patch = { rev: res.rev, hash: h, last: Date.now(), hadData: this.hasLocalData() };
      if (m.daily !== today) {
        try { await this._sleep(1500); await this._upload('/history/swagatik-' + today + '.json', payload); patch.daily = today; } catch(e){ try { console.warn('DBX history', e.message); } catch(x){} }
      }
      this.setMeta(patch); this._warn = ''; this.render(); return true;
    } catch(e){ this._warn = '⚠️ Sync असफल: ' + e.message; this.render(); try { console.warn('DBX push', e); } catch(x){} return false; }
    finally { this._busy = false; }
  },
  pull: async function(){
    if (this._busy) return false; this._busy = true;
    try {
      var remote = await this._meta(this.FILE);
      if (!remote) { this.toast('Dropbox मा backup भेटिएन', 'error'); return false; }
      var txt = await this._download(this.FILE);
      var obj = JSON.parse(txt);
      if (!obj || obj.app !== 'swagatik' || !obj.data) throw new Error('Backup फाइल मिलेन');
      var cur = this.collect(), k;
      for (k in cur) if (!(k in obj.data)) localStorage.removeItem(k);
      for (k in obj.data) if (!this.SKIP.test(k)) localStorage.setItem(k, obj.data[k]);
      this.setMeta({ rev: remote.rev, hash: this._hash(this.collect()), last: Date.now(), hadData: true });
      this._warn = '';
      this.toast('✅ Dropbox बाट data फर्कियो — पुनः लोड हुँदैछ…');
      var self2 = this; setTimeout(function(){ self2._reload(); }, 1200);
      return true;
    } catch(e){ this._warn = '⚠️ Restore असफल: ' + e.message; this.render(); this.toast('❌ ' + e.message, 'error'); return false; }
    finally { this._busy = false; }
  },
  afterConnect: async function(){
    try {
      var remote = await this._meta(this.FILE);
      if (!remote) { this.setMeta({ rev: '', hash: '' }); await this.push(true); this.toast('✅ पहिलो backup Dropbox मा सेभ भयो'); return; }
      if (!this.hasLocalData()) { await this.pull(); return; }
      if (confirm('Dropbox मा पहिल्यै backup छ।\n\nOK = Dropbox बाट Restore (यहाँको अहिलेको data बदलिन्छ)\nCancel = अर्को विकल्प')) { await this.pull(); return; }
      if (confirm('यहाँको अहिलेको data ले Dropbox को पुरानो backup Overwrite गर्ने?\n\n(पुरानो backup /history फोल्डरमा दैनिक copy मा बाँकी हुन्छ)\n\nOK = Overwrite    Cancel = Dropbox जोड्ने काम रद्द')) {
        this.setMeta({ rev: remote.rev }); await this.push(true); return;
      }
      this.disconnect(true);
    } catch(e){ this.toast('❌ ' + e.message, 'error'); }
    this.render();
  },
  syncNow: async function(){
    if (!this.connected()) return this.toast('पहिले Dropbox जोड्नुहोस्', 'error');
    if (!navigator.onLine) return this.toast('Internet छैन — जोडिएपछि आफैं sync हुन्छ', 'error');
    var remote = await this._meta(this.FILE).catch(function(){ return null; });
    var m = this.meta(), d = this.collect();
    if (remote && m.rev && remote.rev !== m.rev) {
      if (this._hash(d) === m.hash) { return this.pull(); }
      if (confirm('दुवै ठाउँमा data बदलिएको छ।\nOK = Dropbox को data राख्ने (यहाँको बदलिन्छ)\nCancel = यहाँको data राख्ने (Dropbox मा overwrite)')) return this.pull();
      var ok = await this.push(true); if (ok) this.toast('✅ Dropbox मा सेभ भयो'); return;
    }
    var ok2 = await this.push(false); if (ok2) this.toast('✅ Dropbox मा सेभ भयो'); else if (this._warn) this.toast(this._warn, 'error');
  },
  restoreNow: async function(){
    if (!this.connected()) return this.toast('पहिले Dropbox जोड्नुहोस्', 'error');
    if (!confirm('Dropbox को backup बाट Restore गर्ने?\nयहाँको अहिलेको data बदलिन्छ।')) return;
    await this.pull();
  },
  disconnect: function(silent){
    if (!silent && !confirm('Dropbox disconnect गर्ने? (data मेटिँदैन, Auto-sync मात्र बन्द हुन्छ)')) return;
    var a = this.auth();
    try { if (a && a.access) fetch('https://api.dropboxapi.com/2/auth/token/revoke', { method: 'POST', headers: { 'Authorization': 'Bearer ' + a.access } }); } catch(e){}
    localStorage.removeItem('pk3_dbx_auth'); localStorage.removeItem('pk3_dbx_meta'); this._warn = '';
    this.render(); if (!silent) this.toast('Dropbox disconnect भयो');
  },

  // ── 5. AUTO-SYNC ──
  tick: async function(){
    if (!this.connected() || this._busy || !navigator.onLine) return;
    try {
      var m = this.meta(), d = this.collect(), h = this._hash(d), changed = (h !== m.hash);
      var remote = await this._meta(this.FILE);
      if (remote && m.rev && remote.rev !== m.rev) {
        if (!changed) { await this.pull(); return; }
        this._warn = '⚠️ दोस्रो device मा पनि data बदलिएको छ — Sync Now थिचेर छान्नुहोस्'; this.render(); return;
      }
      if (!changed) return;
      if (!this.hasLocalData() && m.hadData) { this._warn = '⚠️ यहाँको data खाली देखियो — Auto-sync रोकिएको छ। "Dropbox बाट Restore" थिच्नुहोस्'; this.render(); return; }
      await this.push(false);
    } catch(e){ /* offline / transient — retry next tick */ }
  },
  start: function(){
    var self = this;
    this.handleRedirect().then(function(){
      self.render();
      if (self.connected()) setTimeout(function(){ self.tick(); }, 2500);
    });
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(function(){ self.tick(); }, 30000);
    window.addEventListener('online', function(){ setTimeout(function(){ self.tick(); }, 1500); });
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') self.tick(); });
  },

  // ── 6. UI ──
  render: function(){
    var el = document.getElementById('dbx-status'); if (!el) return;
    var on = this.connected(), m = this.meta();
    var last = m.last ? new Date(m.last).toLocaleString() : '—';
    el.innerHTML = on
      ? '<span style="color:var(--green);font-weight:700;">● जोडिएको</span> — Auto-Sync चालु<br><span style="color:var(--text-muted);font-size:0.72rem;">पछिल्लो sync: ' + last + '</span>'
      : '<span style="color:var(--text-muted);">○ जोडिएको छैन</span>';
    var w = document.getElementById('dbx-warn'); if (w) { w.style.display = this._warn ? '' : 'none'; w.textContent = this._warn; }
    var show = function(id, v){ var e = document.getElementById(id); if (e) e.style.display = v ? '' : 'none'; };
    show('dbx-btn-connect', !on); show('dbx-btn-sync', on); show('dbx-btn-restore', on); show('dbx-btn-disc', on);
  }
};
window.addEventListener('load', function(){ try { DBX.start(); } catch(e){ console.warn('DBX', e); } });
