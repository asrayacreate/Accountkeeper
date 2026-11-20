// ═══════════════ SWAGATIK CLOUD (SUPABASE) — READY INTERFACE (v7.0.0) ═══════════════
// भविष्यमा आफ्नै "Swagatik Cloud" (Supabase) जोड्न तयार adapter। Google Drive / Dropbox जस्तै
// यो पनि CloudSync provider हो — UI मा अहिले देखिँदैन (SUPABASE_CLOUD.enabled = false)।
// जोड्ने बेला: supabase/license_schema.sql को "sync_snapshots" table बनाउनुहोस्, यहाँ URL र
// anon key राख्नुहोस्, enabled = true गर्नुहोस्, र login (Supabase Auth magic link) थप्नुहोस्।
// Row Level Security ले एउटा व्यवसायले अर्कोको data कहिल्यै देख्न सक्दैन।
var SUPABASE_CLOUD = {
  enabled: false,
  url: '',          // e.g. https://xxxx.supabase.co   (Settings → API)
  anonKey: ''       // public anon key (RLS protects the rows)
};

var SupabaseProvider = {
  id: 'supa', label: 'Swagatik Cloud', icon: '☁️',
  _session: function () { try { return JSON.parse(localStorage.getItem('pk3_supa_session') || 'null'); } catch (e) { return null; } },
  isConfigured: function () { return !!(SUPABASE_CLOUD.enabled && SUPABASE_CLOUD.url && SUPABASE_CLOUD.anonKey); },
  isConnected: function () { var s = this._session(); return !!(this.isConfigured() && s && s.access_token); },
  connect: async function () { throw new Error('Swagatik Cloud छिट्टै आउँदैछ'); },
  handleRedirect: async function () {
    // Supabase magic-link returns #access_token=…&refresh_token=… — stored device-only
    if (!this.isConfigured() || location.hash.indexOf('access_token=') === -1) return false;
    var h = new URLSearchParams(location.hash.slice(1));
    localStorage.setItem('pk3_supa_session', JSON.stringify({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), exp: Date.now() + (parseInt(h.get('expires_in'), 10) || 3600) * 1000 }));
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    return 'connected';
  },
  disconnect: function () { localStorage.removeItem('pk3_supa_session'); },
  _h: function () { var s = this._session() || {}; return { apikey: SUPABASE_CLOUD.anonKey, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }; },
  remoteMeta: async function () {
    var r = await fetch(SUPABASE_CLOUD.url + '/rest/v1/sync_snapshots?select=rev&order=updated_at.desc&limit=1', { headers: this._h() });
    if (!r.ok) throw new Error('Swagatik Cloud HTTP ' + r.status);
    var j = await r.json(); return j[0] ? { rev: String(j[0].rev) } : null;
  },
  upload: async function (text) {
    var rev = String(Date.now());
    var r = await fetch(SUPABASE_CLOUD.url + '/rest/v1/sync_snapshots', { method: 'POST', headers: Object.assign(this._h(), { Prefer: 'resolution=merge-duplicates' }), body: JSON.stringify({ rev: rev, payload: JSON.parse(text) }) });
    if (!r.ok) throw new Error('Swagatik Cloud HTTP ' + r.status);
    return { rev: rev };
  },
  download: async function () {
    var r = await fetch(SUPABASE_CLOUD.url + '/rest/v1/sync_snapshots?select=payload&order=updated_at.desc&limit=1', { headers: this._h() });
    if (!r.ok) throw new Error('Swagatik Cloud HTTP ' + r.status);
    var j = await r.json(); if (!j[0]) throw new Error('Cloud मा backup छैन');
    return JSON.stringify(j[0].payload);
  }
};
var SwagatikCloud = SyncHub.register(new CloudSync(SupabaseProvider));
SwagatikCloud.id = 'supa';
