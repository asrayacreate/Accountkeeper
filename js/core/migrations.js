// ═══════════════ v7.0.0 DATA MIGRATION (safe, one-time, never deletes) ═══════════════
// Runs on every start BEFORE repairBusinessData(). Rules:
//  • पुरानो (v6.x) device: सबै data जस्ताको तस्तै। business type = construction (पहिलेजस्तै),
//    Setup Wizard आफैं देखिँदैन, सबै Modules On।
//  • Company Settings खाली भएका field मात्र भरिन्छ — v6.9 ले print/message मा जे देखाउँथ्यो त्यही,
//    ताकि पुरानो प्रयोगकर्ताको Quotation/Invoice मा कुनै फरक नपरोस्।
//  • Saved message templates मा पुराना hardcoded कम्पनी नाम/फोन/ठेगाना → {company} आदि placeholder।
//    (पहिलेको copy pk3_v7_backup_templates मा राखिन्छ।)
//  • नयाँ device: pk3_business.fresh = true → login पछि Setup Wizard खुल्छ।
var Migrations = {
  // v6.x builds seeded these values into pk3_company and used them as print fallbacks.
  // Used ONLY to (a) recognise text that v6 wrote into saved templates and (b) keep the
  // original owner's v6 output identical. Never used as a default for anyone else.
  V6_LEGACY: {
    name: 'PRERAK MULTIPURPOSE PVT LTD',
    names: ['PRERAK MULTIPURPOSE PVT LTD', 'Prerak Multipurpose Pvt. Ltd.', 'PRERAK MULTIPURPOSE', 'Prerak Multipurpose'],
    address: 'Hetauda-2, Makwanpur',
    addressLong: 'Hetauda-2, Kantirajpath, Makwanpur',
    phone1: '9855069733',
    phone2: '9801069733',
    email: 'prerakconstrucion21@gmail.com'
  },

  _hasRealRecords: function (key) {
    try {
      var a = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(a) && a.some(function (r) { return r && !r._demo; });
    } catch (e) { return false; }
  },

  /** true on a device that never ran Swagatik before (only a license / sample flag at most). */
  isFreshInstall: function () {
    if (localStorage.getItem('pk3_data_version') !== null) return false;
    if (localStorage.getItem('pk3_rates') !== null) return false;
    var keys = ['pk3_customers', 'pk3_quotations', 'pk3_invoices', 'pk3_daybook', 'pk3_estimates', 'pk3_ledger'];
    for (var i = 0; i < keys.length; i++) if (this._hasRealRecords(keys[i])) return false;
    try { var s = JSON.parse(localStorage.getItem('pk3_settings') || '{}') || {}; if (s.companyName) return false; } catch (e) {}
    return true;
  },

  hasRealData: function () {
    var self = this;
    return ['pk3_customers', 'pk3_quotations', 'pk3_invoices', 'pk3_estimates', 'pk3_daybook'].some(function (k) { return self._hasRealRecords(k); });
  },

  run: function () {
    var now = new Date().toISOString();
    var biz = STORE.get('pk3_business', null);
    if (!biz || typeof biz !== 'object') {
      if (this.isFreshInstall()) {
        STORE.set('pk3_business', { type: '', setupDone: false, fresh: true, createdAt: now });
      } else {
        STORE.set('pk3_business', { type: 'construction', setupDone: true, legacy: true, migratedAt: now });
      }
    }
    if (!localStorage.getItem('pk3_v7_migrated')) {
      biz = STORE.get('pk3_business', {}) || {};
      if (biz.legacy) {
        try { this.v7CompanySettings(); } catch (e) { console.warn('v7 company migration', e); }
        try { this.v7Templates(); } catch (e) { console.warn('v7 template migration', e); }
      }
      localStorage.setItem('pk3_v7_migrated', now);
    }
  },

  /** Fill ONLY empty company fields with what v6.9 was already showing on this device. */
  v7CompanySettings: function () {
    var s = STORE.get('pk3_settings', {}) || {};
    var lic = {}, oldCo = {};
    try { lic = JSON.parse(localStorage.getItem('pk3_license') || '{}') || {}; } catch (e) {}
    oldCo = STORE.get('pk3_company', {}) || {};
    var L = this.V6_LEGACY, changed = false;
    var licCo = String(lic.company || '').trim();
    var isOriginalOwner = !licCo || licCo.toUpperCase() === L.name;
    if (!String(s.companyName || '').trim()) {
      var n = licCo || oldCo.name || '';
      if (n) { s.companyName = n; changed = true; }
    }
    if (isOriginalOwner) {
      // v6.9 printed these whenever the field was empty — keep the owner's documents identical
      if (!s.address) { s.address = oldCo.address || L.address; changed = true; }
      if (!s.phone1) { s.phone1 = L.phone1; changed = true; }
      if (!s.phone2) { s.phone2 = L.phone2; changed = true; }
      if (!s.email) { s.email = L.email; changed = true; }
      if (!s.tagline) { s.tagline = 'Building Your Dreams 🏠'; changed = true; }
    }
    if (changed) STORE.set('pk3_settings', s);
  },

  /** Replace v6 hardcoded company text inside saved templates with placeholders. */
  v7Templates: function () {
    var t = STORE.get('pk3_templates', null);
    if (!Array.isArray(t) || !t.length) return;
    var out = JSON.parse(JSON.stringify(t)), changed = false;
    out.forEach(function (x) {
      if (!x) return;
      ['text', 'body', 'message'].forEach(function (f) {
        if (typeof x[f] !== 'string') return;
        var n = Migrations.placeholderize(x[f]);
        if (n !== x[f]) { x[f] = n; changed = true; }
      });
    });
    if (changed) {
      if (!localStorage.getItem('pk3_v7_backup_templates')) STORE.set('pk3_v7_backup_templates', t);
      STORE.set('pk3_templates', out);
    }
  },

  placeholderize: function (text) {
    var L = this.V6_LEGACY, s = String(text);
    // longest first
    L.names.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (n) { s = s.split(n).join('{company}'); });
    s = s.split(L.phone1 + ' | ' + L.phone2).join('{phone1} | {phone2}')
         .split(L.phone1 + ' / ' + L.phone2).join('{phone1} / {phone2}')
         .split(L.phone1).join('{phone1}').split(L.phone2).join('{phone2}')
         .split(L.addressLong).join('{company_address}').split(L.address).join('{company_address}')
         .split(L.email).join('{email}');
    return s;
  }
};
