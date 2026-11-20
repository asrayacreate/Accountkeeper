// ═══════════════ LICENSE SYSTEM (v5.3) — ONE-TIME ACTIVATION ═══════════════
// नियम:
//  • Key एक पटक हाले पछि — expire नभएसम्म फेरि कहिल्यै सोधिँदैन।
//  • MASTER KEY (source मा hash मात्र) → PRERAK MULTIPURPOSE PVT LTD को lifetime key।
//    कुनै पनि company name सँग खुल्छ, कहिल्यै expire हुँदैन। (आफ्नै लागि — गोप्य राख्नुस्)
//  • अरू customer लाई: Super Admin → 🔐 License & Key Generator बाट key बनाउनुस्।
//    generated key customer को company name + expiry date सँग बाँधिन्छ —
//    अर्को company मा चल्दैन, expiry बदल्न पनि मिल्दैन (hash भाँचिन्छ)।
var License = {
  // ╔══════════════════════════════════════════════════════════════╗
  // ║  BUILT-IN ACTIVATION — यी एउटा line मात्र बद्लिन्छ                 ║
  // ╠══════════════════════════════════════════════════════════════╣
  // ║  यो file प्रेरक को आफ्नै लागि pre-activated छ — कहिल्यै key       ║
  // ║  माग्दैन। browser/mobile/PC जे मा खोले पनि सिधै login आउछ।      ║
  // ║                                                                    ║
  // ║  ग्राहकलाई बेच्ने copy बनाउँदा — तलको BUILT_IN लाई यस्तो     ║
  // ║  बनाउनुस्:   BUILT_IN: { company:'', key:'' },                    ║
  // ║  त्यसपछि ग्राहकले आफ्नो key एक पटक हाल्नुपर्छ।                 ║
  // ╚══════════════════════════════════════════════════════════════╝
  BUILT_IN: { company: '', key: '' },   // blank — everyone (incl. Prerak) activates via key; founder-bootstrap available for first run

  _SALT: 'PRK-2083-MKWNPR',        // salt — नबदल्नुस् (बदले पुराना key हरू काम गर्दैनन्)
  // v6.9.0: Owner master key अब source मा लेखिँदैन — यसको SHA-256 hash मात्र राखिन्छ।
  // नयाँ master key राख्न:  npm run hash-secret -- master "NEW-KEY"  → आएको hash यहाँ टाँस्नुहोस्।
  MASTER_HASH: '4d735e0460407c6adfa847fed6f59df53b128a68e43acd4d6f7b4f5949fa3222',
  MASTER_COMPANY: 'PRERAK MULTIPURPOSE PVT LTD',
  _STORES: ['pk3_license', 'pk3_lic_backup', 'prerak_activation'],
  _EPOCH: Date.UTC(2024, 0, 1),
  _DAY: 86400000,
  _expiredFlag: false,

  PLANS: [
    { code: 'T15',  label: '🎁 Trial — 15 दिन', days: 15 },
    { code: 'D30',  label: '📅 1 महिना',        days: 30 },
    { code: 'M6',   label: '📅 6 महिना',        days: 182 },
    { code: 'Y1',   label: '📅 1 वर्ष',          days: 365 },
    { code: 'Y2',   label: '📅 2 वर्ष',          days: 730 },
    { code: 'Y3',   label: '📅 3 वर्ष',          days: 1095 },
    { code: 'LIFE', label: '♾️ Lifetime (कहिल्यै expire हुँदैन)', days: 0 }
  ],

  // ─── helpers ────────────────────────────────────────────────
  _norm: function (s) {
    return String(s || '').trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  },

  // Deterministic 12-hex signature of (company + expiry-code + salt)
  _sig: function (company, expCode) {
    var str = this._norm(company) + '|' + String(expCode || '').toUpperCase() + '|' + this._SALT;
    var h1 = 0x811c9dc5, h2 = 0x1000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0; h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 + c * (i + 7)) >>> 0; h2 = (h2 ^ (h2 << 5)) >>> 0;
    }
    return (('00000000' + h1.toString(16)).slice(-8) + ('0000' + (h2 & 0xffff).toString(16)).slice(-4)).toUpperCase();
  },

  // v5.2 legacy key (company-only, lifetime) — पुराना key हरू पनि चल्छन्
  _hashLegacy: function (company) {
    var str = (company || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' + this._SALT;
    var h1 = 0x811c9dc5, h2 = 0x1000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0; h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 + c * (i + 7)) >>> 0; h2 = (h2 ^ (h2 << 5)) >>> 0;
    }
    var hex = (('00000000' + h1.toString(16)).slice(-8) + ('0000' + (h2 & 0xffff).toString(16)).slice(-4)).toUpperCase();
    return 'PRERAK-' + hex.slice(0, 4) + '-' + hex.slice(4, 8) + '-' + hex.slice(8, 12);
  },

  // expiry date  ⇄  4-char base36 code (key भित्रै लुकेको हुन्छ)
  _dateToCode: function (d) {
    var days = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - this._EPOCH) / this._DAY);
    if (days < 0) days = 0;
    return ('000' + days.toString(36).toUpperCase()).slice(-4);
  },
  _codeToDate: function (code) {
    if (!code || String(code).toUpperCase() === 'LIFE') return null;
    var days = parseInt(String(code).toUpperCase(), 36);
    if (isNaN(days)) return null;
    return new Date(this._EPOCH + days * this._DAY);
  },

  _clean: function (k) { return String(k || '').toUpperCase().replace(/\s+/g, '').trim(); },

  // v6.9.0: master key check by hash. Accepts 'KEY', 'PRERAK-KEY', 'PRERAK-MASTER-KEY'.
  _isMaster: function (key) {
    key = this._clean(key);
    if (!key) return false;
    var cands = [key];
    if (key.indexOf('PRERAK-MASTER-') === 0) cands.push(key.slice(14));
    else if (key.indexOf('PRERAK-') === 0) cands.push(key.slice(7));
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] && _sha256(this._SALT + '|MASTER|' + cands[i]) === this.MASTER_HASH) return true;
    }
    return false;
  },

  // ─── key generation (seller side) ───────────────────────────
  // generate('Ram Traders', 365)  →  { key:'PRERAK-XXXX-XXXX-XXXX', expiry:Date|null }
  generate: function (company, days) {
    var expCode = 'LIFE', expiry = null;
    if (days && days > 0) {
      expiry = new Date(Date.now() + days * this._DAY);
      expCode = this._dateToCode(expiry);
    }
    var sig = this._sig(company, expCode);
    return {
      company: String(company || '').trim(),
      key: 'PRERAK-' + expCode + '-' + sig.slice(0, 4) + '-' + sig.slice(4, 8),
      expCode: expCode,
      expiry: expiry,
      days: days || 0
    };
  },

  // ─── key validation ─────────────────────────────────────────
  // returns { ok, plan:'MASTER'|'CUSTOMER'|'LEGACY', expiry:Date|null, reason }
  validate: function (company, key) {
    key = this._clean(key);
    if (!key) return { ok: false, reason: 'empty' };

    // SINGLE KEY MODE (pre-public): only the MASTER key activates, any company name, lifetime.
    // FOUNDER / CUSTOMER / LEGACY key paths are intentionally disabled for now — add back later.
    if (this._isMaster(key)) {
      return { ok: true, plan: 'MASTER', expiry: null };
    }
    return { ok: false, reason: 'mismatch' };
  },

  // v7.0.0: a stored record activated by the license server (LicenseCloud) is trusted when its
  // device signature is intact; expiry/plan come from the server and are re-checked daily.
  _validateRec: function (lic) {
    if (lic && lic.cloud && typeof LicenseCloud !== 'undefined' && LicenseCloud.enabled() && lic.sig === this._recSig(lic)) {
      return { ok: true, plan: lic.plan || 'CLOUD', expiry: lic.expiry || null, cloud: true };
    }
    return this.validate(lic.company, lic.key);
  },

  // ─── storage: 3 ठाउँमा save → एउटा मेटिए पनि license बाँच्छ ──
  _recSig: function (r) {
    return this._sig((r.company || '') + '#' + (r.key || '') + '#' + (r.expiry || 'LIFE'), 'REC');
  },
  _save: function (rec) {
    rec.sig = this._recSig(rec);
    var json = JSON.stringify(rec);
    this._STORES.forEach(function (k) { try { localStorage.setItem(k, json); } catch (e) {} });
    try { sessionStorage.setItem('pk3_license', json); } catch (e) {}
    return rec;
  },
  _load: function () {
    var rec = null, self = this;
    this._STORES.forEach(function (k) {
      if (rec) return;
      try { var v = localStorage.getItem(k); if (v) rec = JSON.parse(v); } catch (e) {}
    });
    if (!rec) { try { var s = sessionStorage.getItem('pk3_license'); if (s) rec = JSON.parse(s); } catch (e) {} }
    if (rec && rec.key) {
      // self-heal: हराएका copy हरू फेरि लेख्ने
      try {
        var json = JSON.stringify(rec);
        this._STORES.forEach(function (k) { try { if (!localStorage.getItem(k)) localStorage.setItem(k, json); } catch (e) {} });
      } catch (e) {}
    }
    return rec;
  },
  _wipe: function () {
    this._STORES.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    try { sessionStorage.removeItem('pk3_license'); } catch (e) {}
  },

  // ─── status ─────────────────────────────────────────────────
  // BUILT_IN सही छ भने storage चाहिँदैन — file आफैं activated हुन्छ।
  // (file:// मा localStorage मेटिए/block भए पनि key फेरि सोध्दैन)
  builtIn: function () {
    var b = this.BUILT_IN;
    if (!b || !b.key) return null;
    var v = this.validate(b.company, b.key);
    if (!v.ok) return null;
    if (v.expiry && new Date() > new Date(v.expiry)) return null;
    return { company: b.company || this.MASTER_COMPANY, key: b.key, plan: v.plan, expiry: v.expiry };
  },

  isActivated: function () {
    if (this.builtIn()) return true;
    try {
      var lic = this._load();
      if (!lic || !lic.key) return false;
      var v = this._validateRec(lic);
      if (!v.ok) return false;                       // key/company बिग्रियो
      if (!v.expiry) return true;                    // lifetime / master
      if (new Date() > new Date(v.expiry)) { this._expiredFlag = true; return false; }
      return true;
    } catch (e) { return false; }
  },

  status: function () {
    var bi = this.builtIn();
    if (bi) {
      var bexp = bi.expiry ? new Date(bi.expiry) : null;
      return {
        active: true, builtIn: true, company: bi.company, key: bi.key, plan: bi.plan,
        lifetime: !bexp, expiry: bexp,
        daysLeft: bexp ? Math.ceil((bexp - new Date()) / this._DAY) : null,
        activatedAt: null
      };
    }
    var lic = this._load();
    if (!lic || !lic.key) return { active: false };
    var v = this._validateRec(lic);
    if (!v.ok) return { active: false, broken: true, company: lic.company };
    var exp = v.expiry ? new Date(v.expiry) : null;
    var left = exp ? Math.ceil((exp - new Date()) / this._DAY) : null;
    return {
      active: !exp || left > 0,
      company: lic.company || this.MASTER_COMPANY,
      key: lic.key,
      plan: v.plan,
      lifetime: !exp,
      expiry: exp,
      daysLeft: left,
      activatedAt: lic.activatedAt || null
    };
  },

  daysLeft: function () { var s = this.status(); return s.daysLeft; },

  // ─── activate (login screen बाट) ────────────────────────────
  activate: function () {
    var company = (document.getElementById('license-company') || {}).value || '';
    var key = this._clean((document.getElementById('license-key') || {}).value || '');
    var err = document.getElementById('license-err');
    var isMaster = this._isMaster(key);

    if (isMaster && !company.trim()) company = this.MASTER_COMPANY;

    if (!company.trim() || !key) {
      if (err) { err.innerHTML = '❌ Company Name र License Key दुवै भर्नुस्'; err.style.display = 'block'; }
      return;
    }

    var v = this.validate(company, key);
    if (!v.ok && typeof LicenseCloud !== 'undefined' && LicenseCloud.enabled()) {   // v7.0.0: commercial keys
      LicenseCloud.activateFromScreen(company, key, err);
      return;
    }
    if (!v.ok) {
      if (err) { err.innerHTML = '❌ License Key वा Company Name मिलेन।<br><span style="opacity:.8;font-size:.72rem;">Key किन्न / renew गर्न 📞 ' + SWAGATIK_VENDOR.supportPhone + '</span>'; err.style.display = 'block'; }
      return;
    }
    if (v.expiry && new Date() > new Date(v.expiry)) {
      if (err) { err.innerHTML = '⏰ यो key को म्याद सकियो। नयाँ key लिन 📞 ' + SWAGATIK_VENDOR.supportPhone + ''; err.style.display = 'block'; }
      return;
    }

    this._save({
      company: company.trim(),
      key: key,
      plan: v.plan,
      expiry: v.expiry ? new Date(v.expiry).toISOString() : null,
      activatedAt: new Date().toISOString(),
      device: (navigator.userAgent || '').slice(0, 80),
      viaBootstrap: !!v.bootstrap
    });
    // Self-disable the founder bootstrap key once a REAL (non-bootstrap) key is stored on this device.
    if (!v.bootstrap) { try { localStorage.setItem('pk3_bootstrap_used', '1'); } catch (e) {} }

    this._afterActivate(company, v.expiry);
  },

  // Shared by offline keys and LicenseCloud keys
  _afterActivate: function (company, expiry) {
    var ls = document.getElementById('license-screen'); if (ls) ls.style.display = 'none';

    // Company name settings मा खाली भए भर्ने
    try {
      var s = STORE.get('pk3_settings', {}) || {};
      if (!s.companyName) { s.companyName = company.trim(); STORE.set('pk3_settings', s); }
    } catch (e) {}

    var msg = expiry
      ? '✅ Activate भयो — म्याद: ' + new Date(expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '✅ Activate भयो — Lifetime License 🎉';
    try { if (window.App && App.toast) setTimeout(function () { App.toast(msg, 'success', 5000); }, 600); } catch (e) {}

    if (typeof Auth !== 'undefined' && Auth.init) Auth.init();
  },

  // ─── boot gate ──────────────────────────────────────────────
  // Activated भए true फर्काउँछ र screen देखाउँदैन — त्यसैले हरेक पटक key सोध्दैन।
  check: function () {
    if (this.isActivated()) { this._maybeWarn(); return true; }
    var ls = document.getElementById('license-screen');
    var login = document.getElementById('login-screen');
    var err = document.getElementById('license-err');
    if (this._expiredFlag && err) {
      err.innerHTML = '⏰ License को म्याद सकियो। Renew गर्न 📞 ' + SWAGATIK_VENDOR.supportPhone + '';
      err.style.display = 'block';
    }
    if (login) login.style.display = 'none';
    if (ls) ls.style.display = 'flex';
    var ci = document.getElementById('license-company');
    var prev = this._load();
    if (ci && prev && prev.company) ci.value = prev.company;
    setTimeout(function () { var k = document.getElementById('license-key'); if (k) k.focus(); }, 200);
    return false;
  },

  // म्याद सकिन ३० दिन बाँकी हुँदा माथि पहेँलो पट्टी — तर काम रोक्दैन
  _maybeWarn: function () {
    var s = this.status();
    if (!s.active || s.lifetime || s.daysLeft === null) return;
    if (s.daysLeft > 30) return;
    var bar = document.getElementById('lic-warn-bar');
    if (!bar) return;
    var urgent = s.daysLeft <= 7;
    bar.style.background = urgent ? '#7f1d1d' : '#78350f';
    bar.innerHTML = (urgent ? '🚨 ' : '⏳ ') + 'License म्याद ' + s.daysLeft + ' दिन बाँकी (' +
      s.expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ') — Renew: 📞 ' + SWAGATIK_VENDOR.supportPhone +
      '<span onclick="this.parentNode.style.display=\'none\'" style="float:right;cursor:pointer;padding:0 6px;">✕</span>';
    bar.style.display = 'block';
  },

  // ─── super admin: license हटाउने (नयाँ key हाल्न) ────────────
  deactivate: function () {
    if (this.builtIn()) {
      alert('ℹ️ यो file मा BUILT-IN activation अन छ — त्यसैले key सोध्दैन।\n\n' +
            'ग्राहक copy बनाउन HTML file मा यो line खोजेर खाली बनाउनुस्:\n\n' +
            "BUILT_IN: { company: '', key: '' },");
      return;
    }
    if (!confirm('⚠️ License हटाउने? अर्को पटक app खोल्दा फेरि key माग्नेछ।')) return;
    this._wipe();
    try { if (window.App && App.toast) App.toast('🔓 License हटाइयो — reload हुँदैछ...', 'info'); } catch (e) {}
    setTimeout(function () { window.location.reload(); }, 900);
  },

  info: function () { var s = this.status(); console.table(s); return s; }
};
// Console helper (seller): PRERAK_KEY('Ram Traders', 365)
window.PRERAK_KEY = function (company, days) { return License.generate(company, days); };

