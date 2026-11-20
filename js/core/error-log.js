// ═══════════════ ERROR LOG (v7.2.0) ═══════════════
// वास्तविक ट्रायलमा आउने bug / error यही device मा रेकर्ड हुन्छ, ताकि Settings → "Error Log हेर्नुहोस् / Copy"
// बाट तुरुन्तै देखाउन वा developer लाई पठाउन सकियोस्।
//
//  • के रेकर्ड हुन्छ: window error, unhandled Promise rejection, console.error, र Error object सहितको console.warn
//    (धेरै module ले try/catch भित्र console.warn('… error:', e) गर्छन् — ती लुकेका bug पनि यहाँ आउँछन्)।
//  • कहाँ बस्छ: localStorage 'swagatik_error_log' मा मात्र। नाम pk3_ ले सुरु नहुने भएकाले यो
//    Dropbox / Google Drive sync र Backup (.json) फाइलमा कहिल्यै जाँदैन — यही device मा मात्र रहन्छ।
//  • आकार सीमित: बढीमा MAX entries, हरेक सन्देश/stack छोट्याइन्छ, लगातार एउटै error दोहोरिए count मात्र बढ्छ।
//  • यो फाइल सबैभन्दा पहिले load हुन्छ र अरू कुनै module मा भर पर्दैन; आफैं कहिल्यै throw गर्दैन।
var ErrorLog = (function () {
  var KEY = 'swagatik_error_log';
  var MAX = 60, MSG_MAX = 400, STACK_MAX = 1200, MAX_BYTES = 60000;
  var _writing = false;

  function cut(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }
  function list() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function save(arr) {
    try {
      var s = JSON.stringify(arr);
      while (arr.length > 1 && s.length > MAX_BYTES) { arr.shift(); s = JSON.stringify(arr); }
      localStorage.setItem(KEY, s);
    } catch (e) {
      // storage भरियो — पुराना आधा हटाएर फेरि प्रयास; नभए चुपचाप छोड्ने (app कहिल्यै नरोकियोस्)
      try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-Math.floor(MAX / 4)))); } catch (_) {}
    }
  }
  function text(a) {
    if (a == null) return String(a);
    if (a instanceof Error) return (a.name && a.name !== 'Error' ? a.name + ': ' : '') + a.message;
    if (typeof a === 'object') {
      if (a.message) return String(a.message);
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }
    return String(a);
  }
  function currentPage() {
    try { var p = document.querySelector('.page.active'); return p ? p.id.replace(/^page-/, '') : ''; } catch (e) { return ''; }
  }

  /** Add one entry. type: error | promise | console | manual */
  function add(type, msg, extra) {
    if (_writing) return;              // console.error भित्रबाट फेरि नआओस्
    _writing = true;
    try {
      extra = extra || {};
      var e = {
        t: new Date().toISOString(),
        type: type || 'error',
        msg: cut(msg || 'Unknown error', MSG_MAX),
        src: extra.src ? cut(extra.src, 160) : '',
        stack: extra.stack ? cut(extra.stack, STACK_MAX) : '',
        page: currentPage(),
        v: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''),
        n: 1
      };
      var arr = list(), last = arr[arr.length - 1];
      if (last && last.type === e.type && last.msg === e.msg && last.src === e.src) {
        last.n = (last.n || 1) + 1; last.t = e.t; last.page = e.page;
      } else {
        arr.push(e);
        if (arr.length > MAX) arr = arr.slice(-MAX);
      }
      save(arr);
      try { if (window.ErrorLog && ErrorLog._onChange) ErrorLog._onChange(); } catch (_) {}
    } catch (_) {}
    _writing = false;
  }

  function fromArgs(type, args) {
    var parts = [], stack = '';
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a instanceof Error && !stack) stack = a.stack || '';
      parts.push(text(a));
    }
    add(type, parts.join(' '), { stack: stack });
  }

  // ── listeners ──
  try {
    window.addEventListener('error', function (ev) {
      try {
        // <img>/<script> load failure (resource error) — message छैन, target मात्र हुन्छ
        if (ev && !ev.message && ev.target && ev.target !== window) {
          var t = ev.target, tag = String(t.tagName || '').toLowerCase(), url = t.src || t.href || '';
          // JS / CSS फाइल नखुल्नु मात्र bug हो। खाली <img src=""> (Logo / QR placeholder) वा फोटो नखुल्नु होइन।
          if (tag !== 'script' && tag !== 'link') return;
          if (!url || /^(data|blob):/.test(url)) return;
          add('resource', 'Load failed: <' + tag + '> ' + cut(url, 200));
          return;
        }
        var src = ev && ev.filename ? ev.filename.split('/').pop().split('?')[0] + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0) : '';
        add('error', (ev && ev.message) || 'Unknown error', { src: src, stack: ev && ev.error && ev.error.stack });
      } catch (_) {}
    }, true);
    window.addEventListener('unhandledrejection', function (ev) {
      try {
        var r = ev && ev.reason;
        add('promise', 'Unhandled Promise: ' + text(r), { stack: r && r.stack });
      } catch (_) {}
    });
  } catch (_) {}

  try {
    var _err = console.error, _warn = console.warn;
    console.error = function () {
      try { fromArgs('console', arguments); } catch (_) {}
      return _err.apply(console, arguments);
    };
    console.warn = function () {
      try {
        for (var i = 0; i < arguments.length; i++) if (arguments[i] instanceof Error) { fromArgs('warn', arguments); break; }
      } catch (_) {}
      return _warn.apply(console, arguments);
    };
  } catch (_) {}

  // ── report text (Copy / WhatsApp / email मा पठाउन) ──
  function report() {
    var arr = list();
    var head = [
      'Swagatik Error Log',
      'App: v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'),
      'Copied: ' + new Date().toISOString(),
      'Device: ' + (navigator.userAgent || ''),
      'Screen: ' + (window.innerWidth || 0) + 'x' + (window.innerHeight || 0) + (navigator.onLine === false ? ' (offline)' : ''),
      'Entries: ' + arr.length,
      '────────────────────────'
    ];
    if (!arr.length) return head.concat(['कुनै error रेकर्ड भएको छैन ✅']).join('\n');
    var lines = arr.slice().reverse().map(function (e, i) {
      return (i + 1) + '. [' + e.t + '] ' + e.type.toUpperCase() + (e.n > 1 ? ' ×' + e.n : '') +
        (e.page ? ' · page: ' + e.page : '') + (e.v ? ' · v' + e.v : '') + '\n   ' + e.msg +
        (e.src ? '\n   @ ' + e.src : '') +
        (e.stack ? '\n   ' + e.stack.split('\n').slice(0, 6).join('\n   ') : '');
    });
    return head.concat(lines).join('\n');
  }

  return {
    KEY: KEY, MAX: MAX,
    list: list,
    add: add,
    count: function () { return list().length; },
    clear: function () { try { localStorage.removeItem(KEY); } catch (_) {} try { if (ErrorLog._onChange) ErrorLog._onChange(); } catch (_) {} },
    report: report,
    _onChange: null
  };
})();
