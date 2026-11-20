// ═══════════════ GOOGLE DRIVE SYNC (v7.0.0) — OAuth 2.0 PKCE, no server ═══════════════
// हरेक व्यवसायले आफ्नै Google Cloud "OAuth Client ID" राख्छ (Settings → ☁️ Google Drive Sync)।
// Data Drive को लुकेको "appDataFolder" मा मात्र जान्छ (scope: drive.appdata) — प्रयोगकर्ताका
// अरू फाइल app ले देख्दैन। Setup चरण: COMMERCIAL_LAUNCH.md → "Google Drive Sync"।
//
// Client type "Web application" को token exchange मा Google ले client_secret माग्छ; त्यसैले
// Settings मा optional "Client Secret" field छ (यो device मा मात्र बस्छ, कहिल्यै sync हुँदैन)।
var GDriveProvider = {
  id: 'gdrive', label: 'Google Drive', icon: '🟢',
  FILE: 'swagatik-backup.json',
  SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  API: 'https://www.googleapis.com/drive/v3',
  UPLOAD: 'https://www.googleapis.com/upload/drive/v3',

  _get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  _put: function (k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  cfg: function () { return this._get('pk3_gdrive_cfg') || {}; },
  saveCfg: function (c) { this._put('pk3_gdrive_cfg', { clientId: String(c.clientId || '').trim(), clientSecret: String(c.clientSecret || '').trim() }); },
  auth: function () { return this._get('pk3_gdrive_auth'); },
  isConfigured: function () { return /\.apps\.googleusercontent\.com$/.test(this.cfg().clientId || ''); },
  isConnected: function () { var a = this.auth(); return !!(a && a.refresh); },
  redirect: function () { return location.origin + location.pathname.replace(/index\.html$/, ''); },
  _b64url: function (buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },

  /** Build the Google consent URL (exposed for tests). */
  authUrl: async function () {
    var a = new Uint8Array(48); crypto.getRandomValues(a);
    var v = this._b64url(a.buffer);
    localStorage.setItem('pk3_gdrive_verifier', v);
    var ch = this._b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    return this.AUTH_URL + '?client_id=' + encodeURIComponent(this.cfg().clientId) + '&redirect_uri=' + encodeURIComponent(this.redirect())
      + '&response_type=code&scope=' + encodeURIComponent(this.SCOPE) + '&access_type=offline&prompt=consent'
      + '&code_challenge_method=S256&code_challenge=' + ch + '&state=gdrive';
  },
  connect: async function () {
    if (!this.isConfigured()) throw new Error('Google OAuth Client ID (….apps.googleusercontent.com) राख्नुहोस्');
    if (!(window.crypto && crypto.subtle)) throw new Error('https चाहिन्छ');
    location.href = await this.authUrl();
  },
  _tokenPost: async function (params) {
    var c = this.cfg();
    params.client_id = c.clientId;
    if (c.clientSecret) params.client_secret = c.clientSecret;
    var r = await fetch(this.TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error_description || j.error || ('HTTP ' + r.status));
    return j;
  },
  /** Returns 'connected' after a successful Google redirect, false when the URL is not ours. */
  handleRedirect: async function () {
    var q = new URLSearchParams(location.search);
    if (q.get('state') !== 'gdrive') return false;
    try { history.replaceState(null, '', this.redirect()); } catch (e) {}
    if (q.get('error') || !q.get('code')) throw new Error('Google Drive connect रद्द भयो');
    var j = await this._tokenPost({ code: q.get('code'), grant_type: 'authorization_code', code_verifier: localStorage.getItem('pk3_gdrive_verifier') || '', redirect_uri: this.redirect() });
    var prev = this.auth() || {};
    this._put('pk3_gdrive_auth', { access: j.access_token, refresh: j.refresh_token || prev.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000 });
    localStorage.removeItem('pk3_gdrive_verifier');
    try { App.toast('✅ Google Drive जोडियो', 'success'); } catch (e) {}
    return 'connected';
  },
  token: async function () {
    var a = this.auth(); if (!a || !a.refresh) throw new Error('Google Drive जोडिएको छैन');
    if (a.access && a.exp > Date.now() + 60000) return a.access;
    var j = await this._tokenPost({ grant_type: 'refresh_token', refresh_token: a.refresh });
    a.access = j.access_token; a.exp = Date.now() + (j.expires_in || 3600) * 1000; this._put('pk3_gdrive_auth', a);
    return a.access;
  },
  disconnect: function () {
    var a = this.auth();
    try { if (a && (a.refresh || a.access)) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(a.refresh || a.access), { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('pk3_gdrive_auth'); localStorage.removeItem('pk3_gdrive_file');
  },
  _api: async function (url, opt) {
    opt = opt || {}; opt.headers = opt.headers || {};
    opt.headers.Authorization = 'Bearer ' + await this.token();
    var r = await fetch(url, opt);
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (e) {} throw new Error('Google Drive HTTP ' + r.status + (t ? ' — ' + t.slice(0, 160) : '')); }
    return r;
  },
  remoteMeta: async function () {
    var q = encodeURIComponent("name='" + this.FILE + "' and trashed=false");
    var r = await this._api(this.API + '/files?spaces=appDataFolder&q=' + q + '&fields=files(id,version,modifiedTime)');
    var j = await r.json(), f = (j.files || [])[0];
    if (!f) { localStorage.removeItem('pk3_gdrive_file'); return null; }
    localStorage.setItem('pk3_gdrive_file', f.id);
    return { id: f.id, rev: String(f.version || f.modifiedTime) };
  },
  upload: async function (text) {
    var id = localStorage.getItem('pk3_gdrive_file'), r;
    if (id) {
      r = await this._api(this.UPLOAD + '/files/' + id + '?uploadType=media&fields=id,version', { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: text });
    } else {
      var b = 'swg' + Date.now();
      var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: this.FILE, parents: ['appDataFolder'] })
        + '\r\n--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--';
      r = await this._api(this.UPLOAD + '/files?uploadType=multipart&fields=id,version', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body });
    }
    var j = await r.json();
    localStorage.setItem('pk3_gdrive_file', j.id);
    return { rev: String(j.version) };
  },
  download: async function () {
    var id = localStorage.getItem('pk3_gdrive_file');
    if (!id) { var m = await this.remoteMeta(); if (!m) throw new Error('Drive मा backup छैन'); id = m.id; }
    var r = await this._api(this.API + '/files/' + id + '?alt=media');
    return r.text();
  }
};

var GDrive = SyncHub.register(new CloudSync(GDriveProvider));
GDrive.id = 'gdrive';
// Settings UI helpers
GDrive.saveConfig = function () {
  GDriveProvider.saveCfg({ clientId: getVal('gdrive-client-id'), clientSecret: getVal('gdrive-client-secret') });
  this.render();
  App.toast(GDriveProvider.isConfigured() ? '✅ Google Client ID सेभ भयो' : '❌ Client ID मिलेन (….apps.googleusercontent.com)', GDriveProvider.isConfigured() ? 'success' : 'error');
};
GDrive.connect = function () { GDriveProvider.connect().catch(function (e) { App.toast('❌ ' + e.message, 'error'); }); };
GDrive.renderConfig = function () {
  var c = GDriveProvider.cfg();
  setVal('gdrive-client-id', c.clientId || ''); setVal('gdrive-client-secret', c.clientSecret || '');
  var r = document.getElementById('gdrive-redirect'); if (r) r.textContent = GDriveProvider.redirect();
  this.render();
};
window.addEventListener('load', function () { try { GDrive.renderConfig(); GDrive.start(); } catch (e) { console.warn('GDrive', e); } });
