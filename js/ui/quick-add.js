// ═══════════════ FLOATING + QUICK ADD र 🎙 VOICE ENTRY (v7.1.0) ═══════════════
// • तल दायाँको ＋ बटन (पहिलेको ⚡ FAB — अझै drag गरेर सार्न मिल्छ) → Quick Add sheet:
//   New Sale (Invoice), Expense, Walk-in, Quotation, Follow-up, Customer, Day Book, Calculator।
//   Module Off वा role/permission नभएका विकल्प आफैँ लुक्छन्।
// • Voice: Expense / Note / Remark लेख्ने ठाउँमा 🎙 बटन — Browser को Web Speech API
//   (ne-NP / en-US, निःशुल्क)। Browser ले support नगरे बटन धमिलो हुन्छ र थिच्दा
//   "कीबोर्डको 🎤 प्रयोग गर्नुहोस्" भन्छ — app कहिल्यै बिग्रिँदैन।
//   नयाँ field मा voice चाहियो भने HTML मा data-voice राखे पुग्छ।

var QuickAdd = {
  ITEMS: [
    { id: 'sale',      icon: '🧾', label: 'New Sale',   sub: 'Invoice / बिल',     page: 'invoices',      perm: 'invoice_add',   run: function () { App.navigate('invoices'); Invoices.create(); } },
    { id: 'expense',   icon: '💸', label: 'Expense',    sub: 'खर्च लेख्ने',         page: 'expenses',      perm: 'daybook_add',   run: function () { Expenses.openAdd(); } },
    { id: 'walkin',    icon: '🚶', label: 'Walk-in',    sub: 'पसलमा आएका ग्राहक', page: 'walkin',        module: 'walkin',      run: function () { App.navigate('walkin'); } },
    { id: 'quotation', icon: '📝', label: 'Quotation',  sub: 'नयाँ कोटेशन',       page: 'add-quotation', module: 'quotations', perm: 'quotation_add', run: function () { App.navigate('add-quotation'); } },
    { id: 'followup',  icon: '🔔', label: 'Follow-up',  sub: 'सम्झना / फलो-अप',   page: 'add-followup',  perm: 'followup_add',  run: function () { App.navigate('add-followup'); } },
    { id: 'customer',  icon: '➕', label: 'Customer',   sub: 'नयाँ ग्राहक',        page: 'add-customer',  perm: 'customer_add',  run: function () { App.navigate('add-customer'); } },
    { id: 'daybook',   icon: '📒', label: 'Day Book',   sub: 'आम्दानी / खर्च',     page: 'daybook',       perm: 'daybook_add',   run: function () { DayBook.addModal(); } },
    { id: 'calc',      icon: '🧮', label: 'Calculator', sub: 'हिसाब',             run: function () { App.showCalc(); } }
  ],

  allowed: function (it) {
    try { if (it.module && typeof Modules !== 'undefined' && !Modules.isOn(it.module)) return false; } catch (e) {}
    try {
      if (it.page && typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin' && currentUser.role !== 'superadmin'
        && typeof STAFF_PAGES !== 'undefined' && STAFF_PAGES.indexOf(it.page) === -1) return false;
    } catch (e) {}
    try { if (it.perm && typeof Auth !== 'undefined' && Auth.can && !Auth.can(it.perm)) return false; } catch (e) {}
    return true;
  },

  visibleItems: function () { var self = this; return this.ITEMS.filter(function (it) { return self.allowed(it); }); },

  render: function () {
    var grid = document.getElementById('qadd-grid');
    if (grid) {
      grid.innerHTML = this.visibleItems().map(function (it) {
        return '<button type="button" class="qadd-item" data-qadd="' + it.id + '" onclick="QuickAdd.go(\'' + it.id + '\')">'
          + '<span class="qadd-ic">' + it.icon + '</span><span class="qadd-tx"><b>' + esc(it.label) + '</b><small>' + esc(it.sub) + '</small></span></button>';
      }).join('');
    }
    var vl = document.getElementById('qadd-voice-lang');
    if (vl) {
      var cur = Voice.lang();
      vl.innerHTML = '<span>🎙 बोलेर लेख्ने भाषा:</span>'
        + Voice.LANGS.map(function (l) { return '<button type="button" class="btn btn-xs ' + (l.code === cur ? 'btn-primary' : 'btn-secondary') + '" onclick="Voice.setLang(\'' + l.code + '\');QuickAdd.render();">' + l.label + '</button>'; }).join('')
        + (Voice.supported() ? '' : '<small class="qadd-muted">यो browser मा voice छैन — कीबोर्डको 🎤 प्रयोग गर्नुहोस्</small>');
    }
  },

  open: function () {
    this.render();
    var m = document.getElementById('fab-modal'); if (m) m.classList.add('open');
  },
  close: function () { var m = document.getElementById('fab-modal'); if (m) m.classList.remove('open'); },

  go: function (id) {
    var it = this.ITEMS.find(function (x) { return x.id === id; });
    this.close();
    if (!it) return;
    if (!this.allowed(it)) { try { App.toast('🔒 यो विकल्प तपाईंको लागि खुला छैन', 'error'); } catch (e) {} return; }
    try { it.run(); } catch (e) { console.warn('QuickAdd', id, e); }
  }
};

var Voice = {
  KEY: 'pk3_voice_lang',
  LANGS: [{ code: 'ne-NP', label: 'नेपाली' }, { code: 'en-US', label: 'English' }],
  // Known note/remark/description fields. Any element with data-voice also gets a mic.
  TARGETS: ['db-desc', 'db-notes', 'dash-db-desc', 'c-notes', 'q-details', 'fu-note', 'bk-remarks', 'ltx-desc',
            'stk-notes', 'stk-adj-note', 'stf-snotes', 'stm-notes', 'peshki-note', 'pl-content', 'inv-cxl-reason'],
  _rec: null, _active: null,

  Ctor: function () { return window.SpeechRecognition || window.webkitSpeechRecognition || null; },
  supported: function () { return !!this.Ctor(); },
  lang: function () { var l = ''; try { l = STORE.get(this.KEY, '') || ''; } catch (e) {} return l === 'en-US' ? 'en-US' : 'ne-NP'; },
  setLang: function (code) {
    try { STORE.set(this.KEY, code === 'en-US' ? 'en-US' : 'ne-NP'); } catch (e) {}
    try { App.toast('🎙 Voice भाषा: ' + (code === 'en-US' ? 'English' : 'नेपाली'), 'success', 1400); } catch (e) {}
  },

  /** Add a 🎙 button next to every target field not yet wired. Returns number added. */
  scan: function (root) {
    root = root || document;
    var self = this, n = 0, els = [];
    this.TARGETS.forEach(function (id) { var e = document.getElementById(id); if (e) els.push(e); });
    try { Array.prototype.push.apply(els, root.querySelectorAll('[data-voice]')); } catch (e) {}
    els.forEach(function (el) {
      if (!el || el.getAttribute('data-voice-ready') || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      el.setAttribute('data-voice-ready', '1');
      var wrap = document.createElement('span');
      wrap.className = 'voice-wrap' + (el.tagName === 'TEXTAREA' ? ' ta' : '');
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'voice-btn no-print' + (self.supported() ? '' : ' off');
      b.textContent = '🎙';
      b.title = self.supported() ? 'बोलेर लेख्नुहोस् (Voice)' : 'Voice यो browser मा छैन';
      b.setAttribute('aria-label', 'Voice entry');
      b.setAttribute('data-voice-for', el.id || '');
      b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); self.toggle(el, b); });
      wrap.appendChild(b);
      n++;
    });
    return n;
  },

  toggle: function (el, btn) {
    if (this._active && this._active.el === el) { this.stop(); return; }
    this.start(el, btn);
  },

  start: function (el, btn) {
    var C = this.Ctor(), self = this;
    if (!C) {
      try { App.toast('🎙 यो browser ले Voice support गर्दैन। मोबाइल कीबोर्डको 🎤 थिचेर बोल्न सक्नुहुन्छ।', 'info', 3500); } catch (e) {}
      try { el.focus(); } catch (e) {}
      return false;
    }
    this.stop();
    var rec;
    try { rec = new C(); } catch (e) { try { App.toast('🎙 Voice सुरु हुन सकेन', 'error'); } catch (x) {} return false; }
    rec.lang = this.lang();
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    var base = el.value || '', finalTxt = '';
    function join(a, b) { a = a || ''; b = (b || '').trim(); if (!b) return a; return a && !/\s$/.test(a) ? a + ' ' + b : a + b; }
    rec.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt = join(finalTxt, t); else interim = join(interim, t);
      }
      el.value = join(join(base, finalTxt), interim);
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {}
    };
    rec.onerror = function (e) {
      var code = e && e.error, msg = '🎙 Voice: ' + code;
      if (code === 'not-allowed' || code === 'service-not-allowed') msg = '🎙 माइक अनुमति (permission) दिनुहोस्';
      else if (code === 'network') msg = '🎙 Voice लाई internet चाहिन्छ — अहिले टाइप गर्नुहोस्';
      else if (code === 'no-speech') msg = '🎙 आवाज सुनिएन, फेरि प्रयास गर्नुहोस्';
      else if (code === 'language-not-supported') msg = '🎙 यो भाषा support छैन — Quick Add मा English छान्नुहोस्';
      if (code !== 'aborted') { try { App.toast(msg, 'info', 3000); } catch (x) {} }
    };
    rec.onend = function () {
      el.value = join(base, finalTxt) || el.value;
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {}
      self._cleanup();
    };
    this._rec = rec; this._active = { el: el, btn: btn };
    if (btn) btn.classList.add('rec');
    try { rec.start(); } catch (e) { this._cleanup(); return false; }
    try { App.toast('🎙 बोल्नुहोस्… (' + (rec.lang === 'en-US' ? 'English' : 'नेपाली') + ')', 'info', 1600); } catch (e) {}
    return true;
  },

  stop: function () {
    if (this._rec) { try { this._rec.stop(); } catch (e) {} }
    this._cleanup();
  },
  _cleanup: function () {
    if (this._active && this._active.btn) this._active.btn.classList.remove('rec');
    this._rec = null; this._active = null;
  },

  init: function () {
    var self = this, t = null;
    this.scan();
    try {
      new MutationObserver(function () {
        if (t) return;
        t = setTimeout(function () { t = null; self.scan(); }, 250);
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
};

(function () {
  function boot() {
    try { Voice.init(); } catch (e) { console.warn('Voice', e); }
    try { QuickAdd.render(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
