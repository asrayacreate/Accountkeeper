// ═══════════════ PHOTOS / BILL RECEIPTS — compressed media store (v7.0.0) ═══════════════
// फोटो ब्राउजरमै सानो बनाइन्छ (max 800px, ~80–120KB, WebP वा JPEG) र IndexedDB मा राखिन्छ —
// localStorage (५MB सीमा) र Dropbox sync भारी हुँदैन। Record मा फोटोको id मात्र बस्छ।
// Backup (.json) मा "_media" भित्र फोटो पनि जान्छ, restore गर्दा फर्किन्छ।
var Media = {
  DB: 'swagatik-media', STORE_NAME: 'photos', MAX_PX: 800, TARGET_KB: 120,
  _db: null, _mem: {},

  _open: function () {
    var self = this;
    if (this._db) return Promise.resolve(this._db);
    return new Promise(function (res) {
      try {
        if (!window.indexedDB) return res(null);
        var rq = indexedDB.open(self.DB, 1);
        rq.onupgradeneeded = function () { var db = rq.result; if (!db.objectStoreNames.contains(self.STORE_NAME)) db.createObjectStore(self.STORE_NAME, { keyPath: 'id' }); };
        rq.onsuccess = function () { self._db = rq.result; res(self._db); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  },
  _tx: function (mode, fn) {
    var self = this;
    return this._open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (res, rej) {
        var tx = db.transaction(self.STORE_NAME, mode), st = tx.objectStore(self.STORE_NAME), out;
        var r = fn(st); if (r && 'onsuccess' in r) r.onsuccess = function () { out = r.result; };
        tx.oncomplete = function () { res(out); }; tx.onerror = function () { rej(tx.error); };
      });
    });
  },

  put: function (rec) { var self = this; return this._tx('readwrite', function (st) { if (!st) { self._mem[rec.id] = rec; return null; } return st.put(rec); }).then(function () { return rec.id; }); },
  get: function (id) { var self = this; return this._tx('readonly', function (st) { return st ? st.get(id) : null; }).then(function (r) { return r || self._mem[id] || null; }); },
  del: function (id) { var self = this; delete this._mem[id]; return this._tx('readwrite', function (st) { return st ? st.delete(id) : null; }); },
  all: function () { var self = this; return this._tx('readonly', function (st) { return st ? st.getAll() : null; }).then(function (r) { return (r || []).concat(Object.keys(self._mem).map(function (k) { return self._mem[k]; })); }); },

  /** Compress an image File/Blob → {dataUrl, bytes, w, h, type}. */
  compress: function (file, opt) {
    opt = opt || {};
    var max = opt.max || this.MAX_PX, target = (opt.targetKB || this.TARGET_KB) * 1024;
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('read')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { rej(new Error('image')); };
        img.onload = function () {
          var r = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * r)), h = Math.max(1, Math.round(img.height * r));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
          var webp = c.toDataURL('image/webp', 0.8).indexOf('data:image/webp') === 0;
          var type = webp ? 'image/webp' : 'image/jpeg', q = 0.82, url, bytes;
          for (var i = 0; i < 8; i++) {
            url = c.toDataURL(type, q);
            bytes = Math.round((url.length - url.indexOf(',') - 1) * 3 / 4);
            if (bytes <= target || q <= 0.4) break;
            q -= 0.08;
          }
          res({ dataUrl: url, bytes: bytes, w: w, h: h, type: type });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  },

  /** Compress + save. meta: {kind, owner, label} → Promise<record> */
  addFile: function (file, meta) {
    var self = this;
    if (!file || !/^image\//.test(file.type || '')) return Promise.reject(new Error('फोटो (image) मात्र छान्नुहोस्'));
    return this.compress(file).then(function (c) {
      var rec = { id: 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), dataUrl: c.dataUrl, bytes: c.bytes, w: c.w, h: c.h, type: c.type,
        kind: (meta && meta.kind) || '', owner: (meta && meta.owner) || '', label: (meta && meta.label) || '', at: new Date().toISOString() };
      return self.put(rec).then(function () { return rec; });
    });
  },

  /** Opens the camera/gallery picker; resolves with saved record(s). */
  pick: function (meta, multiple) {
    var self = this;
    return new Promise(function (res) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; if (multiple) inp.multiple = true;
      inp.onchange = function () {
        var files = Array.prototype.slice.call(inp.files || []);
        if (!files.length) return res([]);
        App.toast('⏳ फोटो सानो बनाएर सेभ हुँदैछ…', 'info', 1500);
        Promise.all(files.map(function (f) { return self.addFile(f, meta); })).then(res).catch(function (e) { App.toast('❌ ' + e.message, 'error'); res([]); });
      };
      inp.click();
    });
  },

  /** Fill <img data-media-id="…"> elements inside root. */
  hydrate: function (root) {
    var self = this;
    (root || document).querySelectorAll('img[data-media-id]').forEach(function (im) {
      if (im.getAttribute('src')) return;
      self.get(im.getAttribute('data-media-id')).then(function (r) { if (r) im.src = r.dataUrl; else im.alt = '(फोटो छैन)'; });
    });
  },

  thumbs: function (ids, onDel) {
    return (ids || []).map(function (id) {
      return '<span class="media-thumb"><img data-media-id="' + esc(id) + '" alt="photo" onclick="Media.view(\'' + esc(id) + '\')">'
        + (onDel ? '<button type="button" class="media-del" title="हटाउनुहोस्" onclick="event.stopPropagation();' + onDel + '(\'' + esc(id) + '\')">✕</button>' : '') + '</span>';
    }).join('');
  },

  view: function (id) {
    this.get(id).then(function (r) {
      if (!r) return;
      var ov = document.createElement('div');
      ov.className = 'modal-overlay open'; ov.style.zIndex = '10050';
      ov.onclick = function () { ov.remove(); };
      ov.innerHTML = '<img src="' + r.dataUrl + '" style="max-width:96vw;max-height:90vh;border-radius:10px;background:#fff;">';
      document.body.appendChild(ov);
    });
  },

  // ── Backup helpers ──
  exportAll: function () { return this.all().then(function (l) { var o = {}; l.forEach(function (r) { o[r.id] = r; }); return o; }); },
  importAll: function (obj) {
    var self = this;
    return Promise.all(Object.keys(obj || {}).map(function (k) { var r = obj[k]; if (r && r.id && r.dataUrl) return self.put(r); }));
  }
};
