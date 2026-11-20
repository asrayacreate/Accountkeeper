// ═══════════════ BUSINESS ONBOARDING / SETUP WIZARD (v7.0.0) ═══════════════
// नयाँ प्रयोगकर्ताले पहिलो पटक login गरेपछि (वा Settings → 🧙 Setup Wizard) :
//   चरण १ — कम्पनीको विवरण (नाम, फोन, ठेगाना, इमेल, PAN/VAT)
//   चरण २ — व्यवसायको प्रकार → Rate List, Services, WhatsApp Templates र Modules आफैं सेट।
// पहिले नै data भएको प्रयोगकर्ताको Rate/Template/Service कहिल्यै overwrite हुँदैन —
// नयाँ category/template मात्र थपिन्छ।
var SetupWizard = {
  _type: '',
  _step: 1,

  shouldAutoOpen: function () {
    var b = STORE.get('pk3_business', {}) || {};
    return !!b.fresh && !b.setupDone && !b.skipped;
  },

  maybeAutoOpen: function () {
    try { if (this.shouldAutoOpen()) this.open(); } catch (e) { console.warn('wizard', e); }
  },

  open: function () {
    var b = STORE.get('pk3_business', {}) || {};
    this._type = b.type || '';
    this._step = 1;
    var m = document.getElementById('setup-wizard-modal');
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = 'setup-wizard-modal';
      document.body.appendChild(m);
    }
    this._render();
    m.classList.add('open');
  },

  close: function () {
    var m = document.getElementById('setup-wizard-modal');
    if (m) m.classList.remove('open');
  },

  skip: function () {
    var b = STORE.get('pk3_business', {}) || {};
    b.skipped = true;
    STORE.set('pk3_business', b);
    this.close();
    App.toast('पछि Settings → 🧙 Setup Wizard बाट गर्न सकिन्छ', 'info', 3500);
  },

  _render: function () {
    var m = document.getElementById('setup-wizard-modal');
    if (!m) return;
    var c = Company.get();
    var head = '<div class="modal-head"><div><div class="modal-title">🧙 Setup Wizard — ' + (this._step === 1 ? 'चरण १/२: तपाईंको व्यवसाय' : 'चरण २/२: व्यवसायको प्रकार') + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">यो विवरण Quotation, Invoice, Visiting Card, Brochure, Print/PDF र WhatsApp सन्देशमा जान्छ।</div></div>'
      + '<button type="button" class="btn btn-sm btn-secondary" onclick="SetupWizard.skip()">पछि गर्छु</button></div>';
    var body;
    if (this._step === 1) {
      var f = function (id, label, val, type, full) {
        return '<div class="form-group' + (full ? ' full' : '') + '"><label>' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" value="' + esc(val || '') + '"></div>';
      };
      body = '<div class="form-grid">'
        + f('wz-co-name', 'कम्पनी / पसलको नाम *', c.name, 'text', true)
        + f('wz-co-phone1', 'फोन १ *', c.phone1, 'tel')
        + f('wz-co-phone2', 'फोन २', c.phone2, 'tel')
        + f('wz-co-address', 'ठेगाना', c.address, 'text', true)
        + f('wz-co-email', 'इमेल', c.email, 'email')
        + f('wz-co-pan', 'PAN / VAT नम्बर', c.pan)
        + f('wz-co-tagline', 'Tagline (छोटो नारा)', c.tagline, 'text', true)
        + '</div><div id="wz-err" style="display:none;color:var(--red);font-size:0.78rem;margin-top:8px;"></div>'
        + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button type="button" class="btn btn-primary" onclick="SetupWizard.next()">अर्को ➡️</button></div>';
    } else {
      var self = this;
      body = '<div id="wz-types" style="display:grid;gap:8px;">' + BusinessProfiles.list().map(function (p) {
        var sel = self._type === p.id;
        return '<button type="button" data-wz-type="' + p.id + '" onclick="SetupWizard.pick(\'' + p.id + '\')" class="btn" style="justify-content:flex-start;text-align:left;gap:12px;padding:12px 14px;border-radius:12px;'
          + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';background:' + (sel ? 'var(--accent-soft, rgba(249,115,22,0.12))' : 'var(--surface-2)') + ';color:var(--text);">'
          + '<span style="font-size:1.6rem;">' + p.icon + '</span><span><span style="display:block;font-weight:800;font-size:0.9rem;">' + esc(p.label) + '</span>'
          + '<span style="display:block;font-size:0.72rem;color:var(--text-muted);font-weight:400;">' + esc(p.hint) + '</span></span></button>';
      }).join('') + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:10px;line-height:1.6;">'
        + (Migrations.hasRealData() ? '🔒 तपाईंको हालको Rate List, Services र Templates जस्ताको तस्तै रहन्छन् — नयाँ मात्र थपिन्छन्।' : 'छानेको व्यवसाय अनुसार सुरुवाती Rate List, Services, WhatsApp Templates र Modules सेट हुन्छन् (पछि Settings बाट जे पनि बदल्न मिल्छ)।')
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px;"><button type="button" class="btn btn-secondary" onclick="SetupWizard.back()">⬅️ पछाडि</button>'
        + '<button type="button" id="wz-finish" class="btn btn-primary" onclick="SetupWizard.finish()"' + (this._type ? '' : ' disabled') + '>✅ सुरु गरौं</button></div>';
    }
    m.innerHTML = '<div class="modal" style="max-width:560px;width:100%;max-height:92vh;overflow-y:auto;">' + head + body + '</div>';
  },

  next: function () {
    var name = (getVal('wz-co-name') || '').trim(), ph = (getVal('wz-co-phone1') || '').trim();
    var err = document.getElementById('wz-err');
    if (!name || !ph) { if (err) { err.textContent = '❌ कम्पनीको नाम र फोन १ अनिवार्य छ।'; err.style.display = 'block'; } return; }
    var s = STORE.get('pk3_settings', {}) || {};
    s.companyName = name; s.phone1 = ph;
    s.phone2 = (getVal('wz-co-phone2') || '').trim();
    s.address = (getVal('wz-co-address') || '').trim();
    s.email = (getVal('wz-co-email') || '').trim();
    s.pan = (getVal('wz-co-pan') || '').trim();
    s.tagline = (getVal('wz-co-tagline') || '').trim();
    if (!s.fiscalYear) try { s.fiscalYear = autoFiscalYear(); } catch (e) {}
    STORE.set('pk3_settings', s);
    try { Settings.render(); } catch (e) {}
    try { Brand.apply(); } catch (e) {}
    this._step = 2;
    this._render();
  },

  back: function () { this._step = 1; this._render(); },

  pick: function (id) { this._type = id; this._render(); },

  finish: function () {
    if (!this._type) return;
    var r = this.applyProfile(this._type);
    this.close();
    try { Settings.render(); } catch (e) {}
    try { Modules.apply(); Modules.render(); } catch (e) {}
    try { Customers.loadServices(); } catch (e) {}
    try { Dashboard.render(); } catch (e) {}
    App.toast('✅ ' + BusinessProfiles.get(this._type).label + ' — सेटअप पूरा! ' + (r.added ? '(' + r.added + ' नयाँ थपियो)' : ''), 'success', 3500);
  },

  /**
   * Apply a business profile. Fresh device (no real data yet) → profile defaults replace the
   * seeded construction defaults. Existing data → merge only (nothing is overwritten).
   * @returns {{mode:'replace'|'merge', added:number}}
   */
  applyProfile: function (type) {
    var b = STORE.get('pk3_business', {}) || {};
    var replace = !!b.fresh && !Migrations.hasRealData();
    var added = 0;
    var rates = BusinessProfiles.rates(type), svcs = BusinessProfiles.services(type), tpls = BusinessProfiles.templates(type);
    if (replace) {
      STORE.set('pk3_rates', rates);
      STORE.set('pk3_services', svcs);
      STORE.set('pk3_templates', tpls);
      Modules.setAll(BusinessProfiles.modules(type));
    } else {
      var cur = STORE.get('pk3_rates', {}) || {};
      Object.keys(rates).forEach(function (cat) { if (!cur[cat]) { cur[cat] = rates[cat]; added++; } });
      STORE.set('pk3_rates', cur);
      var cs = STORE.get('pk3_services', []) || [];
      var names = cs.map(function (x) { return x && x.name; });
      svcs.forEach(function (x) { if (names.indexOf(x.name) === -1) { cs.push(x); added++; } });
      STORE.set('pk3_services', cs);
      var ct = STORE.get('pk3_templates', []) || [];
      var tn = ct.map(function (x) { return x && x.name; });
      tpls.forEach(function (x) { if (tn.indexOf(x.name) === -1) { ct.push(x); added++; } });
      STORE.set('pk3_templates', ct);
      if (localStorage.getItem('pk3_modules') === null) Modules.setAll(BusinessProfiles.modules(type));
    }
    b.type = type; b.setupDone = true; b.fresh = false; b.skipped = false; b.setupAt = new Date().toISOString();
    STORE.set('pk3_business', b);
    try { Audit.log('SETTINGS', 'Setup Wizard: ' + type + ' (' + (replace ? 'new' : 'merge') + ')'); } catch (e) {}
    return { mode: replace ? 'replace' : 'merge', added: added };
  }
};
