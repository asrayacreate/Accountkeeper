// ═══════════════ MOVE TO A NEW WEB ADDRESS (v7.3.1) ═══════════════
// पुरानो ठेगाना (जस्तै github.io) मा: Dashboard मा ब्यानर → "📦 डाटा नयाँ ठेगानामा सार्नुहोस्"
//   → नयाँ ठेगाना नयाँ tab मा खुल्छ → पूरा backup (फोटो सहित) सिधै browser भित्रै पठाइन्छ।
// नयाँ ठेगानामा: Backup.restoreData (summary confirm, सुरक्षा कपी, rollback) ले डाटा राख्छ।
// सुरक्षा: डाटा SWAGATIK_DEPLOY मा लेखिएका ठेगानाबीच मात्र जान्छ (postMessage targetOrigin + origin जाँच),
// license / login session / sync token / AI key कहिल्यै पठाइँदैन, पुरानो ठेगानाको डाटा मेटिँदैन।
var MoveOrigin = {
  MOVED_KEY: 'swagatik_moved_at',   // pk3_ होइन — backup सँगै नयाँ ठेगानामा नजाओस्
  PARAM: 'swg-transfer',
  _win: null, _data: null, _ready: false, _sent: false,

  _cfg: function () { return (typeof SWAGATIK_DEPLOY !== 'undefined' && SWAGATIK_DEPLOY) || {}; },
  _origin: function (u) { try { return new URL(u).origin; } catch (e) { return ''; } },
  primary: function () { return this._origin(this._cfg().primaryOrigin || ''); },
  legacy: function () { var self = this; return (this._cfg().legacyOrigins || []).map(function (u) { return self._origin(u); }).filter(Boolean); },
  isOld: function () { var p = this.primary(); return !!p && location.origin !== p && /^https?:$/.test(location.protocol); },
  movedAt: function () { try { return localStorage.getItem(this.MOVED_KEY) || ''; } catch (e) { return ''; } },
  newUrl: function () { return this.primary() + '/'; },

  // ── पुरानो ठेगाना: Dashboard ब्यानर ──
  render: function () {
    var box = document.getElementById('move-alert-dash');
    if (!box) return;
    if (!this.isOld() || typeof currentUser === 'undefined' || !currentUser) { box.innerHTML = ''; box.style.display = 'none'; return; }
    var url = esc(this.newUrl()), moved = this.movedAt();
    box.style.display = '';
    box.innerHTML = moved
      ? '<div class="backup-alert move-alert move-done" role="status">' +
          '<div class="backup-alert-text"><b>✅ यो device को डाटा नयाँ ठेगानामा सारियो</b>' +
          '<span>अब यो link प्रयोग गर्नुहोस्: <a href="' + url + '" target="_blank" rel="noopener">' + url + '</a> (Home screen मा पनि नयाँ app राख्नुहोस्)। यहाँको पुरानो डाटा सुरक्षित नै छ।</span></div>' +
          '<div class="backup-alert-btns">' +
            '<a class="btn btn-sm btn-primary" id="move-open-new" href="' + url + '" target="_blank" rel="noopener">🚀 नयाँ App खोल्नुहोस्</a>' +
            '<button type="button" class="btn btn-sm btn-secondary" id="move-again" onclick="MoveOrigin.start()">🔁 फेरि सार्नुहोस्</button>' +
          '</div></div>'
      : '<div class="backup-alert move-alert" role="alert">' +
          '<div class="backup-alert-text"><b>📦 App नयाँ ठेगानामा सर्दैछ</b>' +
          '<span>नयाँ ठेगाना: <b>' + url + '</b>। यो device को सबै डाटा एक click मा त्यहाँ सार्नुहोस्। यहाँको डाटा मेटिँदैन।</span>' +
          '<span id="move-status" class="move-status"></span></div>' +
          '<div class="backup-alert-btns">' +
            '<button type="button" class="btn btn-sm btn-primary" id="move-start" onclick="MoveOrigin.start()">📦 डाटा नयाँ ठेगानामा सार्नुहोस्</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" id="move-backup" onclick="Backup.exportJSON()">⬇️ Backup File पनि राख्नुहोस्</button>' +
          '</div></div>';
  },
  _status: function (t) { var s = document.getElementById('move-status'); if (s) s.textContent = t; },

  // ── पुरानो ठेगाना: पठाउने ──
  start: function () {
    var p = this.primary(), self = this;
    if (!p || !this.isOld()) return;
    // popup click भित्रै (synchronously) खोल्नुपर्छ, नत्र browser ले रोक्छ
    var win = window.open(this.newUrl() + '?' + this.PARAM + '=1', 'swagatik-move');
    if (!win) { App.toast('❌ नयाँ tab खुल्न सकेन — browser मा popup अनुमति दिएर फेरि थिच्नुहोस्।', 'error', 8000); return; }
    this._win = win; this._data = null; this._ready = false; this._sent = false;
    this._status('⏳ नयाँ ठेगाना खुल्दैछ… त्यहाँ "Restore" मा OK थिच्नुहोस्।');
    if (!this._listening) { window.addEventListener('message', function (e) { self._onSenderMsg(e); }); this._listening = true; }
    Backup.collect().then(function (data) { self._data = data; self._trySend(); });
  },
  _trySend: function () {
    if (this._sent || !this._ready || !this._data || !this._win) return;
    this._sent = true;
    try { this._win.postMessage({ type: 'swg-move-data', v: 1, data: this._data }, this.primary()); } catch (e) { this._sent = false; console.warn('MoveOrigin send failed', e); }
  },
  _onSenderMsg: function (e) {
    if (e.origin !== this.primary() || !this._win || e.source !== this._win) return;
    var d = e.data || {};
    if (d.type === 'swg-move-ready') { this._ready = true; this._trySend(); }
    else if (d.type === 'swg-move-done') {
      try { localStorage.setItem(this.MOVED_KEY, new Date().toISOString()); } catch (x) {}
      try { Audit.log('MOVE', 'Data moved to ' + this.primary()); } catch (x) {}
      App.toast('✅ डाटा नयाँ ठेगानामा सारियो!', 'success', 6000);
      this.render();
    } else if (d.type === 'swg-move-cancel') {
      this._sent = false;
      this._status('⚠️ नयाँ ठेगानामा Restore रद्द भयो। फेरि थिच्न सक्नुहुन्छ।');
    }
  },

  // ── नयाँ ठेगाना: लिने ──
  receiveInit: function () {
    var p = this.primary(), self = this;
    if (!p || location.origin !== p || !window.opener) return;
    if (new RegExp('[?&]' + this.PARAM + '=1(&|$)').test(location.search) === false) return;
    var olds = this.legacy().filter(function (o) { return o !== p; });
    if (!olds.length) return;
    var got = false;
    window.addEventListener('message', function (e) {
      if (got || e.source !== window.opener || olds.indexOf(e.origin) === -1) return;
      var d = e.data || {};
      if (d.type !== 'swg-move-data' || !d.data) return;
      got = true; clearInterval(timer);
      var from = e.origin;
      // URL बाट ?swg-transfer=1 हटाउने, ताकि reload पछि फेरि नमागोस्
      try { history.replaceState(null, '', location.pathname); } catch (x) {}
      Promise.resolve(Backup.restoreData(d.data, 'पुरानो ठेगाना (' + from + ')')).then(function (ok) {
        try { window.opener.postMessage({ type: ok ? 'swg-move-done' : 'swg-move-cancel' }, from); } catch (x) {}
      });
    });
    var ping = function () { olds.forEach(function (o) { try { window.opener.postMessage({ type: 'swg-move-ready' }, o); } catch (x) {} }); };
    var n = 0, timer = setInterval(function () { if (++n > 120 || !window.opener) return clearInterval(timer); ping(); }, 500);
    ping();
  }
};
document.addEventListener('DOMContentLoaded', function () { try { MoveOrigin.receiveInit(); } catch (e) {} });
