// v7.3.0 (#4): in-app "❓ मद्दत" — short Nepali guide for the main modules + laptop keyboard shortcuts.
//
// HelpGuide  — searchable modal (topbar ❓ / F1 / ?) that opens on the section for the current page.
//              Only modules this user may open (role + Settings → Modules) are listed. Text is generic:
//              no company name, phone, rate or service is written here (Commercial-ready rule).
// KeyShort   — global shortcuts. Navigation keys never fire while the user is typing in a field, or
//              while a form/modal is open; Ctrl+S (save) works inside fields because that is where you
//              finish a form. Nothing fires before login / licence activation.
var HelpGuide = {
  // page: where "खोल्नुहोस्" goes (App.navigate keeps role + module checks); pages: pages this section explains.
  SECTIONS: [
    { id: 'start', icon: '🚀', title: 'सुरु गर्ने (पहिलो पटक)', page: 'settings', pages: ['dashboard', 'settings'],
      steps: ['Settings → Company Info मा आफ्नो व्यवसायको नाम, ठेगाना, फोन, PAN/VAT भर्नुहोस् — बिल, Quotation र प्रिन्टमा यही आउँछ।',
              'Settings → Modules बाट नचाहिने फिचर बन्द गर्न सकिन्छ; मेनु छोटो र सजिलो हुन्छ।',
              'Settings → Print Settings मा कागजको साइज (A4/A5/थर्मल) र Payment QR राख्नुहोस्।'] },
    { id: 'customers', icon: '👥', title: 'ग्राहक (Customer)', page: 'customers', pages: ['customers', 'add-customer', 'ledger'],
      steps: ['Add Customer मा नाम र फोन भरेर Save गर्नुहोस्।',
              'माथिको खोज बाकस (Ctrl+K) मा नाम वा फोन लेखेर जुनसुकै पेजबाट ग्राहक खोल्न मिल्छ।',
              'Customer Ledger मा ग्राहकको लेनदेन र बाँकी हेर्न सकिन्छ।'] },
    { id: 'quotations', icon: '📋', title: 'Quotation / Estimate', page: 'quotations', pages: ['quotations', 'add-quotation', 'estimates-list', 'estimate-new', 'bakauta'],
      steps: ['New Quotation → ग्राहक छान्नुहोस् → Item, परिमाण, दर थप्नुहोस् → 💾 Save (Ctrl+S)।',
              'Preview बाट Print, PDF वा फोटो बनाएर WhatsApp मा पठाउन सकिन्छ।',
              'स्वीकृत Quotation लाई एकै क्लिकमा बिल (Invoice) मा बदल्न सकिन्छ।'] },
    { id: 'invoices', icon: '🧾', title: 'बिक्री बिल (Invoice / Tax Invoice)', page: 'invoices', pages: ['invoices'],
      steps: ['Sales → + New Invoice (Alt+N) → ग्राहक, Item र रकम भर्नुहोस् → Save (Ctrl+S)।',
              'VAT दर्ता भए बिलको किसिम Tax Invoice छान्नुहोस्; VAT आफैं हिसाब हुन्छ।',
              'गल्ती बिल मेटाउनुको सट्टा "रद्द (Cancel)" गर्नुहोस् — कारण सहित रेकर्ड रहन्छ।'] },
    { id: 'receivables', icon: '💰', title: 'बाँकी रकम र भुक्तानी रसिद', page: 'invoices', pages: [],
      steps: ['Sales पेजको "💰 बाँकी रकम" मा कसको कति बाँकी छ हेर्न सकिन्छ।',
              'ग्राहकले किस्ता तिर्दा भुक्तानी थप्नुहोस्; रसिद प्रिन्ट वा WhatsApp गर्न मिल्छ।',
              'WhatsApp रिमाइन्डर बटनले विनम्र सम्झना सन्देश तयार गर्छ।'] },
    { id: 'purchases', icon: '🛒', title: 'खरिद बिल, Input VAT र TDS', page: 'purchases', pages: ['purchases', 'dailyreport'],
      steps: ['Purchase → ➕ नयाँ खरिद बिल (Alt+P) → Supplier, बिल नं., Item भर्नुहोस्।',
              'Supplier को बिलमा VAT भए Input VAT र TDS कट्टी आफैं हिसाब हुन्छ।',
              'Daily Report → VAT Books बाट Sales/Purchase Book CSV मा निकाल्न सकिन्छ।'] },
    { id: 'stock', icon: '📦', title: 'Stock / सामान', page: 'stocklist', pages: ['stocklist'],
      steps: ['Stock मा Item, एकाइ, खरिद/बिक्री मूल्य र न्यूनतम मात्रा राख्नुहोस्।',
              'बिल बनाउँदा Stock घट्छ, खरिद बिलले बढ्छ; कम भएमा चेतावनी आउँछ।',
              'History बाट प्रत्येक घटबढ कहिले र किन भयो हेर्न सकिन्छ।'] },
    { id: 'daybook', icon: '📒', title: 'Day Book र खर्च', page: 'daybook', pages: ['daybook', 'expenses', 'cashbook', 'returns'],
      steps: ['Day Book मा दैनिक आम्दानी/खर्च लेख्नुहोस्।',
              'Expenses मा भाडा, बिजुली, यातायात जस्ता खर्च वर्ग अनुसार राख्नुहोस्।',
              'Cash Book ले दिनको सुरु र अन्तिम नगद देखाउँछ।'] },
    { id: 'payables', icon: '👷', title: 'Supplier / मिस्त्री खाता', page: 'payables', pages: ['payables'],
      steps: ['➕ नयाँ बाट Supplier वा मिस्त्री थप्नुहोस्।',
              'बिल (तिर्नुपर्ने) र भुक्तानी/एड्भान्स छुट्टाछुट्टै लेख्नुहोस्; बाँकी आफैं निस्कन्छ।'] },
    { id: 'staff', icon: '🧑‍🔧', title: 'Staff हाजिरी र तलब', page: 'staff', pages: ['staff', 'salesteam'],
      steps: ['Staff Log मा कर्मचारी थपेर दैनिक हाजिरी र एड्भान्स लेख्नुहोस्।',
              'महिनाको अन्त्यमा तलब हिसाब र भुक्तानी त्यहीँबाट गर्न सकिन्छ।'] },
    { id: 'reports', icon: '📊', title: 'रिपोर्ट', page: 'dailyreport', pages: ['account-summary', 'audit'],
      steps: ['Daily Report मा आजको बिक्री, खर्च र नगद एकै ठाउँमा देखिन्छ।',
              'Account Summary ले कुल आम्दानी, खर्च, बाँकी र नाफा देखाउँछ।'] },
    { id: 'backup', icon: '💾', title: 'Backup / Restore', page: 'backup', pages: ['backup'],
      steps: ['सबै डाटा यही device मा मात्र बस्छ — हप्तामा कम्तीमा एक पटक Backup गर्नुहोस्।',
              'Backup Now ले .json फाइल download गर्छ; सुरक्षित ठाउँ (Drive, Pen drive) मा राख्नुहोस्।',
              'नयाँ device मा Restore गर्दा त्यही फाइल छान्नुहोस्।'] },
    { id: 'print', icon: '🖨️', title: 'Print, Share र QR', page: 'qrcode', pages: ['qrcode', 'vcard', 'brochures', 'vatcalc'],
      steps: ['बिल वा Quotation को Preview बाट Print, PDF वा फोटो (PNG) बनाउन सकिन्छ।',
              'थर्मल प्रिन्टर भए Settings → Print Settings मा 58mm वा 80mm छान्नुहोस्।',
              'QR Code पेजबाट फोन, वेबसाइट वा भुक्तानी QR बनाउन सकिन्छ।'] }
  ],

  _q: '',
  _openId: null,

  _canSee: function (page) {
    try {
      if (typeof Modules !== 'undefined' && !Modules.pageAllowed(page)) return false;
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin' && currentUser.role !== 'superadmin'
          && typeof STAFF_PAGES !== 'undefined' && STAFF_PAGES.indexOf(page) === -1) return false;
    } catch (e) {}
    return true;
  },
  visibleSections: function () {
    var self = this;
    return this.SECTIONS.filter(function (s) { return self._canSee(s.page); });
  },
  sectionFor: function (page) {
    var list = this.visibleSections();
    for (var i = 0; i < list.length; i++) if (list[i].page === page || list[i].pages.indexOf(page) >= 0) return list[i];
    return null;
  },
  _match: function (s, q) {
    if (!q) return true;
    var hay = (s.title + ' ' + s.steps.join(' ') + ' ' + s.page + ' ' + s.pages.join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (w) { return !w || hay.indexOf(w) >= 0; });
  },
  _e: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },

  _ensure: function () {
    var m = document.getElementById('help-modal');
    if (m) return m;
    m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'help-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', 'मद्दत');
    m.innerHTML = '<div class="modal modal-lg help-modal-box">'
      + '<div class="modal-head"><div class="modal-title">❓ मद्दत — छोटो गाइड</div>'
      + '<button class="modal-close" id="help-close" title="बन्द (Esc)" onclick="HelpGuide.close()">✕</button></div>'
      + '<input type="search" id="help-search" placeholder="🔍 के गर्न खोज्दै हुनुहुन्छ? (जस्तै: बिल, stock, backup)" autocomplete="off" oninput="HelpGuide._q=this.value;HelpGuide.renderList()">'
      + '<div class="help-tabs"><button class="btn btn-sm btn-primary" id="help-tab-guide" onclick="HelpGuide.tab(\'guide\')">📚 गाइड</button>'
      + '<button class="btn btn-sm btn-secondary" id="help-tab-keys" onclick="HelpGuide.tab(\'keys\')">⌨️ किबोर्ड सर्टकट</button></div>'
      + '<div id="help-list"></div><div id="help-keys" style="display:none;"></div>'
      + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) HelpGuide.close(); });
    document.body.appendChild(m);
    return m;
  },
  isOpen: function () { var m = document.getElementById('help-modal'); return !!(m && m.classList.contains('open')); },
  open: function (opts) {
    opts = opts || {};
    var m = this._ensure();
    this._q = '';
    var s = document.getElementById('help-search'); if (s) s.value = '';
    var cur = this.sectionFor((window.App && App.currentPage) || 'dashboard');
    this._openId = cur ? cur.id : null;
    this.renderList();
    document.getElementById('help-keys').innerHTML = KeyShort.tableHtml();
    this.tab(opts.tab || 'guide');
    m.classList.add('open');
    return true;
  },
  close: function () { var m = document.getElementById('help-modal'); if (m) m.classList.remove('open'); },
  toggle: function () { if (this.isOpen()) this.close(); else this.open(); },
  tab: function (t) {
    var g = t !== 'keys';
    var l = document.getElementById('help-list'), k = document.getElementById('help-keys'), s = document.getElementById('help-search');
    if (l) l.style.display = g ? '' : 'none';
    if (s) s.style.display = g ? '' : 'none';
    if (k) k.style.display = g ? 'none' : '';
    var bg = document.getElementById('help-tab-guide'), bk = document.getElementById('help-tab-keys');
    if (bg) bg.className = 'btn btn-sm ' + (g ? 'btn-primary' : 'btn-secondary');
    if (bk) bk.className = 'btn btn-sm ' + (g ? 'btn-secondary' : 'btn-primary');
  },
  toggleSection: function (id) { this._openId = this._openId === id ? null : id; this.renderList(); },
  go: function (page) {
    this.close();
    if (window.App) App.navigate(page);
  },
  renderList: function () {
    var el = document.getElementById('help-list');
    if (!el) return;
    var self = this, q = (this._q || '').trim();
    var list = this.visibleSections().filter(function (s) { return self._match(s, q); });
    if (!list.length) { el.innerHTML = '<div class="help-empty">यस्तो विषय भेटिएन — अर्को शब्द प्रयोग गर्नुहोस्।</div>'; return; }
    el.innerHTML = list.map(function (s) {
      var open = q || self._openId === s.id;
      return '<div class="help-sec' + (open ? ' open' : '') + '" data-help="' + s.id + '">'
        + '<button class="help-sec-head" onclick="HelpGuide.toggleSection(\'' + s.id + '\')"><span>' + s.icon + ' ' + self._e(s.title) + '</span><span class="help-caret">' + (open ? '▾' : '▸') + '</span></button>'
        + (open ? '<div class="help-sec-body"><ol>' + s.steps.map(function (t) { return '<li>' + self._e(t) + '</li>'; }).join('') + '</ol>'
          + '<button class="btn btn-sm btn-secondary" onclick="HelpGuide.go(\'' + s.page + '\')">खोल्नुहोस् →</button></div>' : '')
        + '</div>';
    }).join('');
  },

  // Help / About page: shortcut card + button to the full guide (built once, from the same data).
  enhancePage: function () {
    var pg = document.getElementById('page-help');
    if (!pg || document.getElementById('help-page-keys')) return;
    var wrap = pg.firstElementChild || pg;
    var card = document.createElement('div');
    card.className = 'card card-body';
    card.id = 'help-page-keys';
    card.style.marginBottom = '14px';
    card.innerHTML = '<div class="section-head" style="margin-bottom:8px;"><div class="section-title">⌨️ किबोर्ड सर्टकट (ल्यापटप/कम्प्युटर)</div>'
      + '<button class="btn btn-sm btn-primary" onclick="HelpGuide.open()">📚 मोड्युल गाइड खोल्नुहोस्</button></div>'
      + KeyShort.tableHtml();
    var cards = wrap.querySelectorAll(':scope > .card');
    if (cards.length >= 2) wrap.insertBefore(card, cards[2] || null); else wrap.appendChild(card);
  }
};

var KeyShort = {
  // keys: shown in the table; code: KeyboardEvent.code for Alt combos (works with Mac Option too).
  LIST: [
    { keys: ['F1'], alt: ['?'], label: 'यो मद्दत खोल्ने / बन्द गर्ने' },
    { keys: ['Ctrl', 'K'], alt: ['/'], label: 'ग्राहक खोज्ने' },
    { keys: ['Ctrl', 'S'], label: 'खुला फारम सेभ गर्ने (टाइप गर्दै गर्दा पनि चल्छ)' },
    { keys: ['Alt', 'N'], code: 'KeyN', label: 'नयाँ बिक्री बिल (Invoice)', run: function () { return KeyShort._openNew('invoices', function () { Invoices.create(); }); } },
    { keys: ['Alt', 'Q'], code: 'KeyQ', label: 'नयाँ Quotation', run: function () { return KeyShort._go('add-quotation'); } },
    { keys: ['Alt', 'C'], code: 'KeyC', label: 'नयाँ ग्राहक थप्ने', run: function () { return KeyShort._go('add-customer'); } },
    { keys: ['Alt', 'P'], code: 'KeyP', label: 'नयाँ खरिद बिल', run: function () { return KeyShort._openNew('purchases', function () { Purchases.open(); }); } },
    { keys: ['Alt', 'R'], code: 'KeyR', label: 'बाँकी रकम (Receivables)', run: function () { return KeyShort._openNew('invoices', function () { Receivables.open(); }); } },
    { keys: ['Alt', 'D'], code: 'KeyD', label: 'Dashboard मा जाने', run: function () { return KeyShort._go('dashboard'); } },
    { keys: ['Esc'], label: 'खुला झ्याल (popup) बन्द गर्ने' }
  ],
  _lastSave: 0,

  tableHtml: function () {
    var k = function (a) { return a.map(function (x) { return '<kbd>' + x + '</kbd>'; }).join(' + '); };
    return '<table class="help-keys-table"><tbody>' + this.LIST.map(function (s) {
      return '<tr><td class="help-keys-k">' + k(s.keys) + (s.alt ? ' <span class="help-or">वा</span> ' + k(s.alt) : '') + '</td><td>' + s.label + '</td></tr>';
    }).join('') + '</tbody></table>'
      + '<div class="help-note">Mac मा Ctrl को सट्टा ⌘ र Alt को सट्टा Option। कुनै field मा टाइप गर्दै गर्दा वा फारम खुला हुँदा अरू सर्टकट चल्दैनन् — काम हराउँदैन।</div>';
  },

  ready: function () {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    var hidden = function (id) { var el = document.getElementById(id); return !el || getComputedStyle(el).display === 'none' || el.classList.contains('hide'); };
    return hidden('login-screen') && hidden('license-screen');
  },
  isTyping: function (el) {
    el = el || document.activeElement;
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !/^(button|submit|reset|checkbox|radio|range|color|file|image)$/i.test(el.type || 'text');
  },
  openModal: function () {
    var all = document.querySelectorAll('.modal-overlay.open');
    return all.length ? all[all.length - 1] : null;
  },
  _go: function (page) { App.navigate(page); return App.currentPage === page; },
  // Opens the page first so role/module checks apply, then the form.
  _openNew: function (page, fn) {
    if (!this._go(page)) return false;
    try { fn(); } catch (e) { return false; }
    return true;
  },
  focusSearch: function () {
    var gs = document.getElementById('global-search');
    if (!gs || gs.offsetParent === null) {
      // Mobile hides the topbar search: use the page's own search box if it has one.
      var pg = document.querySelector('.page.active');
      gs = pg && pg.querySelector('input[type="search"], .search-wrap input');
    }
    if (gs) { gs.focus(); if (gs.select) gs.select(); return true; }
    return false;
  },

  // ── Ctrl+S: click the save button of the form the user is in ──
  SAVE_RE: /💾|\bsave\b|\bupdate\b|सेभ|सुरक्षित गर्नु/i,
  NOT_SAVE_RE: /backup|restore|ब्याकअप|cancel|रद्द|delete|मेटाउ/i,
  _visible: function (b) { return !b.disabled && !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length); },
  saveCandidates: function (scope) {
    var self = this;
    var explicit = [].slice.call(scope.querySelectorAll('[data-kb-save]')).filter(function (b) { return self._visible(b); });
    if (explicit.length) return explicit;
    return [].slice.call(scope.querySelectorAll('button, input[type="button"], input[type="submit"]')).filter(function (b) {
      var t = (b.textContent || b.value || '') + ' ' + (b.getAttribute('title') || '');
      return self._visible(b) && self.SAVE_RE.test(t) && !self.NOT_SAVE_RE.test(t);
    });
  },
  findSave: function () {
    var scope = this.openModal() || document.querySelector('.page.active');
    if (!scope) return { btn: null, why: 'none' };
    var c = this.saveCandidates(scope);
    if (!c.length) return { btn: null, why: 'none' };
    // Nearest save button to the field the user is in (e.g. one card of Settings).
    var a = document.activeElement;
    if (a && a !== document.body && scope.contains(a)) {
      for (var n = a.parentElement; n && n !== scope.parentElement; n = n.parentElement) {
        var near = c.filter(function (b) { return n.contains(b); });
        if (near.length) return { btn: near[0], why: 'focus' };
      }
    }
    // Same action repeated (top + bottom Save) counts as one.
    var acts = c.map(function (b) { return b.getAttribute('onclick') || b.id || b.textContent; });
    var uniq = acts.filter(function (x, i) { return acts.indexOf(x) === i; });
    if (uniq.length === 1) return { btn: c[0], why: 'single' };
    return { btn: null, why: 'many' };
  },
  save: function () {
    var now = Date.now();
    if (now - this._lastSave < 700) return false; // held key / double press must not save twice
    this._lastSave = now;
    var r = this.findSave();
    if (r.btn) { r.btn.click(); return true; }
    if (window.App) App.toast(r.why === 'many' ? '💾 कुन फारम सेभ गर्ने? पहिले त्यो फारमको कुनै field मा क्लिक गर्नुहोस्।' : '💾 यहाँ सेभ गर्ने फारम छैन।', 'info', 2500);
    return false;
  },

  handle: function (e) {
    if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    if (!this.ready()) return;
    var key = e.key, mod = e.ctrlKey || e.metaKey;
    var typing = this.isTyping(e.target);

    // Esc closes help first, even when it sits on top of another popup.
    if (key === 'Escape' && HelpGuide.isOpen()) { HelpGuide.close(); e.preventDefault(); e.stopPropagation(); return; }

    if (mod && !e.altKey && !e.shiftKey && (key === 's' || key === 'S')) {
      e.preventDefault(); // never the browser's "Save page as"
      if (!e.repeat) this.save();
      return;
    }
    if (key === 'F1') { e.preventDefault(); HelpGuide.toggle(); return; }
    if (typing) return;
    if (key === '?' && !mod && !e.altKey) { e.preventDefault(); HelpGuide.toggle(); return; }
    if (HelpGuide.isOpen()) return;
    if (key === '/' && !mod && !e.altKey && !this.openModal()) { if (this.focusSearch()) e.preventDefault(); return; }
    if (e.altKey && !mod && !e.shiftKey) {
      if (this.openModal()) return; // an open form is never left behind by a shortcut
      for (var i = 0; i < this.LIST.length; i++) {
        var s = this.LIST[i];
        if (s.code && s.code === e.code) { e.preventDefault(); s.run(); return; }
      }
    }
  },
  init: function () {
    if (this._bound) return;
    this._bound = true;
    var self = this;
    // Capture phase so Esc reaches help before the global "close first modal" handler.
    window.addEventListener('keydown', function (e) { try { self.handle(e); } catch (err) { console.warn('KeyShort', err); } }, true);
  }
};

(function () {
  function boot() { KeyShort.init(); try { HelpGuide.enhancePage(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
