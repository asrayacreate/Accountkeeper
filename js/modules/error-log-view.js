// ═══════════════ ERROR LOG — Settings view (v7.2.0) ═══════════════
// Settings → "🐞 Error Log" card: हेर्नुहोस् (list), Copy (developer लाई पठाउन), खाली गर्नुहोस्।
// Data: ErrorLog (js/core/error-log.js) — यही device मा मात्र।
var ErrorLogView = {
  _open: false,
  _esc: function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  },
  _when: function (iso) {
    try { var d = new Date(iso); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; }
  },
  render: function () {
    if (typeof ErrorLog === 'undefined') return;
    var n = ErrorLog.count();
    var c = document.getElementById('errlog-count');
    if (c) {
      c.textContent = n ? n + ' वटा error रेकर्ड छन्' : 'कुनै error छैन ✅';
      c.style.color = n ? 'var(--red, #dc2626)' : 'var(--green, #16a34a)';
    }
    var box = document.getElementById('errlog-list');
    if (!box) return;
    box.style.display = this._open ? '' : 'none';
    var btn = document.getElementById('errlog-view-btn');
    if (btn) btn.textContent = this._open ? '🙈 Error Log लुकाउनुहोस्' : '👁 Error Log हेर्नुहोस्';
    if (!this._open) return;
    var arr = ErrorLog.list().slice().reverse(), self = this;
    box.innerHTML = arr.length ? arr.map(function (e) {
      return '<div class="errlog-item">' +
        '<div class="errlog-meta"><span class="errlog-type">' + self._esc(e.type) + '</span>' + (e.n > 1 ? ' <b>×' + e.n + '</b>' : '') +
          ' · ' + self._esc(self._when(e.t)) + (e.page ? ' · ' + self._esc(e.page) : '') + '</div>' +
        '<div class="errlog-msg">' + self._esc(e.msg) + '</div>' +
        (e.src ? '<div class="errlog-src">@ ' + self._esc(e.src) + '</div>' : '') +
      '</div>';
    }).join('') : '<div class="errlog-empty">कुनै error रेकर्ड भएको छैन ✅</div>';
  },
  toggle: function () { this._open = !this._open; this.render(); },
  copy: function () {
    var txt = ErrorLog.report();
    var ok = function () { try { App.toast('📋 Error Log copy भयो — WhatsApp / Email मा paste गर्नुहोस्', 'success', 4000); } catch (e) {} };
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.appendChild(ta); ta.select();
        var done = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        if (done) ok(); else App.toast('⚠️ Copy भएन — Error Log हेरेर हातैले select गर्नुहोस्', 'warning', 4500);
      } catch (e) {}
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
      else fallback();
    } catch (e) { fallback(); }
    return txt;
  },
  clear: function () {
    if (!ErrorLog.count()) return;
    if (!confirm('Error Log खाली गर्ने? (तपाईंको व्यापारको डाटा मेटिँदैन)')) return;
    ErrorLog.clear();
    try { App.toast('🗑 Error Log खाली भयो', 'info'); } catch (e) {}
    this.render();
  }
};
try { ErrorLog._onChange = function () { try { if (document.getElementById('page-settings') && document.getElementById('page-settings').classList.contains('active')) ErrorLogView.render(); } catch (e) {} }; } catch (e) {}
