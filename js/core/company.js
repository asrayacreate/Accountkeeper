// ═══════════════ COMPANY PROFILE (v7.0.0 — Multi-Business / Commercial Ready) ═══════════════
// एउटै ठाउँ: footer, quotation, invoice, visiting card, brochure, print/PDF, message template
// र AI message — सबैले कम्पनीको विवरण यहीँबाट मात्र लिन्छन् (Settings → Company Information)।
// कुनै पनि कम्पनीको नाम / ठेगाना / फोन code मा hardcode गर्नु हुँदैन।
//
// "Swagatik" = यो software को brand (app name + login screen) मात्र। त्यसको support/renew
// contact SWAGATIK_VENDOR मा छ — यो प्रयोगकर्ताको कम्पनी होइन, software बेच्ने vendor हो।
var SWAGATIK_VENDOR = {
  brand: 'Swagatik',
  product: 'Swagatik — Smart Business CRM',
  supportPhone: '9855069733',   // License किन्ने / renew गर्ने vendor support (COMMERCIAL_LAUNCH.md हेर्नुहोस्)
  website: ''
};

var Company = {
  // Raw settings object (pk3_settings)
  _s: function () { try { return STORE.get('pk3_settings', {}) || {}; } catch (e) { return {}; } },

  /** Normalised company profile. Empty strings when not set — never another company's data. */
  get: function () {
    var s = this._s();
    var t = function (v) { return (v == null ? '' : String(v)).trim(); };
    return {
      name: t(s.companyName),
      tagline: t(s.tagline),
      address: t(s.address),
      phone1: t(s.phone1),
      phone2: t(s.phone2),
      email: t(s.email),
      website: t(s.website),
      pan: t(s.pan),
      logo: s.logo || '',
      fiscalYear: t(s.fiscalYear)
    };
  },

  /** Company name, or a neutral fallback when the user has not filled it yet. */
  name: function (fallback) {
    var n = this.get().name;
    if (n) return n;
    return fallback !== undefined ? fallback : 'हाम्रो व्यवसाय';
  },

  /** "98xxxxxxx / 98xxxxxxx" (only the numbers that exist) */
  phones: function (sep) {
    var c = this.get();
    return [c.phone1, c.phone2].filter(Boolean).join(sep || ' / ');
  },

  isConfigured: function () { return !!this.get().name; },

  /** Services shown on the Company Intro card / {services_list}: user's own list, else the business profile's. */
  introServices: function () {
    var s = this._s();
    if (Array.isArray(s.introServices) && s.introServices.length) return s.introServices;
    try { return BusinessProfiles.current().intro; } catch (e) { return []; }
  },

  /** Business type chosen in the Setup Wizard ('' when not chosen yet) */
  businessType: function () {
    try { return (STORE.get('pk3_business', {}) || {}).type || ''; } catch (e) { return ''; }
  },

  /** Placeholder map used by every message template / AI prompt. */
  vars: function () {
    var c = this.get();
    return {
      '{company}': c.name || this.name(),
      '{company_address}': c.address,
      '{company_phone}': this.phones(),
      '{phone1}': c.phone1,
      '{phone2}': c.phone2,
      '{email}': c.email,
      '{website}': c.website,
      '{tagline}': c.tagline,
      '{pan}': c.pan,
      '{services_list}': this.introServices().map(function (x) { return '✅ ' + x.t; }).join('\n')
    };
  },

  /** Replace company placeholders in any text, then tidy lines that became empty (e.g. "📞 " with no phone). */
  fill: function (text) {
    var out = String(text == null ? '' : text);
    var v = this.vars();
    Object.keys(v).forEach(function (k) { out = out.split(k).join(v[k] || ''); });
    return Company.tidy(out);
  },

  /** Remove leftover separators when a value was empty: "📞  / " → "", "📞 98 / " → "📞 98" */
  tidy: function (text) {
    return String(text).split('\n').map(function (l) {
      var x = l.replace(/\s*[\/|]\s*$/, '').replace(/^(\s*(?:📞|📍|✉️|🌐|📧)\s*)[\/|]\s*/, '$1');
      return (/^\s*(?:📞|📍|✉️|🌐|📧)\s*$/.test(x) || /^\s*""\s*$/.test(x) || /^\s*—\s*$/.test(x)) ? null : x;
    }).filter(function (l) { return l !== null; }).join('\n');
  },

  /** One line "Name • Address • Phones" for AI prompts (no invented data). */
  aiContext: function () {
    var c = this.get();
    var type = '';
    try { type = BusinessProfiles.get(this.businessType()).aiDescription || ''; } catch (e) {}
    var parts = [c.name || 'the business'];
    if (type) parts.push(type);
    if (c.address) parts.push('located at ' + c.address);
    return parts.join(', ');
  }
};
