// ═══════════════ MODULES / फिचर व्यवस्थापन (v7.0.0) ═══════════════
// Settings → "Modules / फिचर व्यवस्थापन" बाट हरेक व्यवसायले आफूलाई चाहिने फिचर On/Off गर्छ।
// Off गरिएको फिचरका मेनु, ड्यासबोर्ड कार्ड र सेक्सनहरू लुक्छन् (data-module="…")।
// Data कहिल्यै मेटिँदैन — फेरि On गरेपछि सबै पहिलेजस्तै देखिन्छ।
//
// HTML: <div data-module="stock">…</div>  (space-separated list = कुनै एक Off भए लुक्छ)
// CSS : html[data-mod-off~="stock"] [data-module~="stock"] { display:none !important }
var Modules = {
  KEY: 'pk3_modules',
  LIST: [
    { id: 'projects',    icon: '🏗️', label: 'Projects / Sites',              hint: 'Project/Site को progress, खर्च र नाफा' },
    { id: 'measurement', icon: '📏', label: 'Site Measurement (Sq.ft)',      hint: 'Quotation मा नाप (Sq.ft) क्यालकुलेटर' },
    { id: 'payables',    icon: '👷', label: 'Supplier र मिस्त्री खाता',        hint: 'Supplier / ठेकेदारलाई तिर्नुपर्ने हिसाब (Payables)' },
    { id: 'stock',       icon: '📦', label: 'Stock / Items',                 hint: 'सामानको stock र मौज्दात' },
    { id: 'quotations',  icon: '📋', label: 'Quotations / Estimates',        hint: 'Quotation, Estimate र Bakauta' },
    { id: 'walkin',      icon: '🚶', label: 'Walk-in Greeting',              hint: 'पसल/showroom मा आउने ग्राहकलाई स्वागत सन्देश' },
    { id: 'ai',          icon: '🤖', label: 'AI Assistant',                  hint: 'AI बाट message / post / analysis' },
    { id: 'staff',       icon: '🧑‍🔧', label: 'Staff हाजिरी र तलब',            hint: 'दैनिक हाजिरी, पेश्की र मासिक खुद तलब (Payroll)' }
  ],
  // Pages that belong to a module (navigation is blocked while the module is Off)
  PAGES: {
    projects: ['projects'],
    payables: ['payables'],
    stock: ['stocklist'],
    quotations: ['quotations', 'add-quotation', 'bakauta', 'estimate-new', 'estimates-list'],
    walkin: ['walkin'],
    ai: ['ai-assistant'],
    staff: ['staff']
  },

  /** {id: true|false} — missing ids default to On (so existing users keep every feature). */
  state: function () {
    var s = {};
    try { s = STORE.get(this.KEY, {}) || {}; } catch (e) {}
    var out = {};
    this.LIST.forEach(function (m) { out[m.id] = s[m.id] !== false; });
    return out;
  },
  isOn: function (id) { return this.state()[id] !== false; },

  set: function (id, on) {
    var s = {};
    try { s = STORE.get(this.KEY, {}) || {}; } catch (e) {}
    s[id] = !!on;
    STORE.set(this.KEY, s);
    this.apply();
    try { Audit.log('SETTINGS', 'Module ' + id + ' → ' + (on ? 'On' : 'Off')); } catch (e) {}
  },

  setAll: function (map) {
    var s = {};
    this.LIST.forEach(function (m) { s[m.id] = map && map[m.id] === false ? false : true; });
    STORE.set(this.KEY, s);
    this.apply();
  },

  /** Hide/show everything tagged with data-module. Safe to call any time. */
  apply: function () {
    var st = this.state();
    var off = Object.keys(st).filter(function (k) { return !st[k]; });
    try { document.documentElement.setAttribute('data-mod-off', off.join(' ')); } catch (e) {}
    // Hide sidebar section headers whose items are all hidden
    try {
      document.querySelectorAll('#sidebar .nav-section').forEach(function (sec) {
        var el = sec.nextElementSibling, any = false, n = 0;
        while (el && !el.classList.contains('nav-section')) {
          if (el.classList.contains('nav-item')) { n++; if (getComputedStyle(el).display !== 'none') any = true; }
          el = el.nextElementSibling;
        }
        if (n) sec.style.display = any ? '' : 'none';
      });
    } catch (e) {}
    // If the open page belongs to a module that is now Off, go home
    try {
      if (window.App && App.currentPage && !this.pageAllowed(App.currentPage)) App.navigate('dashboard');
    } catch (e) {}
  },

  pageAllowed: function (page) {
    var st = this.state();
    for (var id in this.PAGES) if (!st[id] && this.PAGES[id].indexOf(page) !== -1) return false;
    return true;
  },

  moduleOfPage: function (page) {
    for (var id in this.PAGES) if (this.PAGES[id].indexOf(page) !== -1) return id;
    return '';
  },

  // ── Settings card ──
  render: function () {
    var box = document.getElementById('set-modules-list');
    if (!box) return;
    var st = this.state();
    box.innerHTML = this.LIST.map(function (m) {
      return '<label class="mod-row" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);cursor:pointer;">'
        + '<span style="display:flex;gap:10px;align-items:center;min-width:0;"><span style="font-size:1.2rem;">' + m.icon + '</span>'
        + '<span style="min-width:0;"><span style="display:block;font-weight:700;font-size:0.84rem;">' + esc(m.label) + '</span>'
        + '<span style="display:block;font-size:0.7rem;color:var(--text-muted);">' + esc(m.hint) + '</span></span></span>'
        + '<input type="checkbox" data-mod-toggle="' + m.id + '" ' + (st[m.id] ? 'checked' : '') + ' onchange="Modules.set(\'' + m.id + '\', this.checked)" style="width:20px;height:20px;accent-color:var(--accent);flex-shrink:0;">'
        + '</label>';
    }).join('');
  }
};
