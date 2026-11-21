// ═══════════════ DATA SAFETY (v7.3.0) ═══════════════
// १. StorageGuard — ब्राउजरको localStorage (प्रायः ५MB जति) भरिन लागेमा पहिले नै चेतावनी:
//      • ७५%+ : Dashboard मा पहेँलो ब्यानर (ब्याकअप लिन सम्झाउँछ, २४ घण्टा snooze गर्न मिल्छ)
//      • ९०%+ : रातो ब्यानर (snooze हुँदैन) + login पछि एक पटक toast
//      • कुनै save नै असफल भयो (STORE.set → quota) भने तुरुन्तै रातो toast + Error Log मा record
//      • Backup पेजमा "📦 Storage" मिटर: कति भरियो, सबैभन्दा ठूला ५ भाग
//    साँचो सीमा (quota) यही device मा एक पटक नापिन्छ (swagatik_ls_quota, ७ दिन)।
// २. RestoreGuard — Backup Restore (र Dropbox/Drive बाट Restore) गर्नुअघि:
//      • के-के बदलिन्छ भनेर सारांशसहित पुष्टिकरण (ग्राहक/बिल संख्या, backup मिति, version)
//      • हालको सम्पूर्ण डाटाको "सुरक्षा कपी" IndexedDB (swagatik-safety) मा — पछिल्ला ३ वटा
//      • Restore लेख्दा बीचमै असफल भए पुरानो डाटा आफैं फर्काइन्छ (rollback)
//      • Backup पेजमा "↩️ Restore अघिको डाटा फर्काउनुहोस्" (Undo) बटन
//    IndexedDB नचले सुरक्षा कपी .json फाइलमा download हुन्छ।
// Device-only keys use the swagatik_ prefix so they never go into sync or backup files.

var StorageGuard = {
  WARN: 0.75, CRIT: 0.90,
  DEFAULT_QUOTA: 5000000,            // characters (key + value), conservative browser default
  QUOTA_KEY: 'swagatik_ls_quota',
  SNOOZE_KEY: 'swagatik_storage_snooze',
  _failAt: 0, _toasted: false,

  /** Characters used by localStorage (key + value, UTF-16 units). */
  used: function (skipKey) {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k === skipKey) continue;
        n += k.length + (localStorage.getItem(k) || '').length;
      }
    } catch (e) {}
    return n;
  },
  quota: function () {
    try {
      var q = JSON.parse(localStorage.getItem(this.QUOTA_KEY) || 'null');
      if (q && q.chars > 1000) return q.chars;
    } catch (e) {}
    return this.DEFAULT_QUOTA;
  },
  /**
   * Measure the real quota once: binary-search the largest extra string that still fits,
   * remove it immediately. Cached for 7 days on this device.
   */
  measure: function (force) {
    try {
      var q = JSON.parse(localStorage.getItem(this.QUOTA_KEY) || 'null');
      if (!force && q && q.at && Date.now() - q.at < 7 * 864e5) return q.chars;
    } catch (e) {}
    var probe = '__swagatik_quota_probe__', lo = 0, hi = 11000000, used = this.used(probe), step = 20000;
    try {
      while (hi - lo > step) {
        var mid = Math.floor((lo + hi) / 2);
        try { localStorage.setItem(probe, 'x'.repeat(mid)); lo = mid; }
        catch (e) { hi = mid; }
        finally { try { localStorage.removeItem(probe); } catch (e2) {} }
      }
    } catch (e) { return this.quota(); }
    var chars = used + lo + probe.length;
    if (chars < 100000) return this.quota();
    try { localStorage.setItem(this.QUOTA_KEY, JSON.stringify({ chars: chars, at: Date.now() })); } catch (e) {}
    return chars;
  },
  /** → {used, quota, pct (0..1), level: 'ok'|'warn'|'crit'} */
  status: function () {
    var u = this.used(), q = this.quota(), pct = q ? u / q : 0;
    return { used: u, quota: q, pct: pct, level: pct >= this.CRIT ? 'crit' : pct >= this.WARN ? 'warn' : 'ok' };
  },
  /** Is there room to keep the in-browser auto-save copy (a full duplicate of the data)? */
  roomForAutosave: function () {
    var data = this.used('pk3_autosave_snapshot');
    return data * 2 < this.quota() * 0.7;
  },

  _num: function (n) { var d = '०१२३४५६७८९'; return String(n).replace(/[0-9]/g, function (c) { return d[+c]; }); },
  _mb: function (chars) { return (chars * 2 / 1048576).toFixed(2) + ' MB'; },
  LABELS: {
    pk3_customers: 'ग्राहक', pk3_quotations: 'कोटेसन', pk3_invoices: 'बिल', pk3_daybook: 'Daybook',
    pk3_ledger: 'खाता (Ledger)', pk3_audit: 'Audit log', pk3_activity: 'Activity', pk3_stock: 'Stock',
    pk3_stockHistory: 'Stock इतिहास', pk3_estimates: 'Estimate', pk3_rates: 'Rate list', pk3_company: 'Company (logo सहित)',
    pk3_brochures: 'Brochure', pk3_vcard: 'Visiting card', pk3_autosave_snapshot: 'Auto-save कपी', pk3_followups: 'Follow-up',
    pk3_walkins: 'Walk-in', pk3_templates: 'Message template', pk3_settings: 'Settings', pk3_purchases: 'Purchase बिल', pk3_pay_qr: 'Payment QR', swagatik_error_log: 'Error log'
  },
  /** Biggest keys → [{key, label, chars}] */
  top: function (n) {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k) continue;
        out.push({ key: k, label: this.LABELS[k] || k, chars: k.length + (localStorage.getItem(k) || '').length });
      }
    } catch (e) {}
    out.sort(function (a, b) { return b.chars - a.chars; });
    return out.slice(0, n || 5);
  },

  _allowed: function () { try { return BackupAlert._allowed(); } catch (e) { return typeof currentUser !== 'undefined' && !!currentUser; } },
  snoozed: function (now) {
    var until = 0;
    try { until = parseInt(localStorage.getItem(this.SNOOZE_KEY) || '0', 10) || 0; } catch (e) {}
    return until > (now || Date.now());
  },
  shouldShow: function () {
    if (!this._allowed()) return false;
    var st = this.status();
    if (st.level === 'crit') return true;
    return st.level === 'warn' && !this.snoozed();
  },
  message: function (st) {
    st = st || this.status();
    var pct = this._num(Math.round(st.pct * 100));
    if (st.level === 'crit') return 'ब्राउजरको डाटा भण्डार ' + pct + '% भरियो! भरिएपछि नयाँ डाटा सेभ हुँदैन। तुरुन्तै Backup लिनुहोस् र पुराना Audit log / फोटो हटाउनुहोस्।';
    return 'ब्राउजरको डाटा भण्डार ' + pct + '% भरिसक्यो। सुरक्षाका लागि आजै Backup लिनुहोस्।';
  },

  /** Banner inside #storage-alert-dash (rendered with BackupAlert: Dashboard + Backup page). */
  render: function () {
    var box = document.getElementById('storage-alert-dash');
    if (box) {
      if (!this.shouldShow()) { box.innerHTML = ''; box.style.display = 'none'; }
      else {
        var st = this.status(), crit = st.level === 'crit';
        box.style.display = '';
        box.innerHTML =
          '<div class="backup-alert storage-alert' + (crit ? ' storage-crit' : '') + '" role="alert">' +
            '<div class="backup-alert-text"><b>📦 ' + (crit ? 'डाटा भण्डार लगभग भरियो' : 'डाटा भण्डार भरिँदैछ') + '</b>' +
              '<span id="storage-alert-msg">' + this.message(st) + '</span></div>' +
            '<div class="backup-alert-btns">' +
              '<button type="button" id="storage-alert-backup" class="btn btn-sm btn-primary" onclick="StorageGuard.backupNow()">⬇️ अहिले Backup गर्नुहोस्</button>' +
              '<button type="button" id="storage-alert-details" class="btn btn-sm btn-secondary" onclick="App.navigate(\'backup\')">📊 विवरण</button>' +
              (crit ? '' : '<button type="button" id="storage-alert-later" class="btn btn-sm btn-secondary" onclick="StorageGuard.snooze()">⏰ भोलि</button>') +
            '</div>' +
          '</div>';
      }
    }
    this.renderMeter();
  },
  renderMeter: function () {
    var el = document.getElementById('storage-meter');
    if (!el) return;
    var st = this.status(), pct = Math.min(100, Math.round(st.pct * 100));
    var color = st.level === 'crit' ? '#dc2626' : st.level === 'warn' ? '#f59e0b' : '#16a34a';
    var rows = this.top(5).map(function (t) {
      return '<div class="storage-row"><span>' + esc(t.label) + '</span><span>' + StorageGuard._mb(t.chars) + '</span></div>';
    }).join('');
    el.innerHTML =
      '<div class="storage-bar"><div id="storage-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
      '<div class="storage-sum" id="storage-sum">' + this._num(pct) + '% प्रयोग भयो — ' + this._mb(st.used) + ' / ' + this._mb(st.quota) + '</div>' +
      '<div class="storage-top">' + rows + '</div>';
  },
  backupNow: function () {
    try { Backup.exportJSON(); } catch (e) { try { console.warn('Backup from storage alert failed:', e); } catch (_) {} }
    this.render();
  },
  snooze: function (hours) {
    try { localStorage.setItem(this.SNOOZE_KEY, String(Date.now() + (hours || 24) * 3600000)); } catch (e) {}
    this.render();
  },

  /** Called by STORE.set when a write throws (quota full). */
  onWriteFail: function (key, err) {
    var now = Date.now();
    // पहिले Auto-save कपी (डाटाकै दोहोरो प्रति) हटाएर ठाउँ खाली गर्ने
    try { localStorage.removeItem('pk3_autosave_snapshot'); } catch (e) {}
    try { if (window.ErrorLog && ErrorLog.add) ErrorLog.add('storage', 'Save असफल (' + key + '): ' + (err && (err.name || err.message) || 'quota')); } catch (e) {}
    if (now - this._failAt < 60000) return;
    this._failAt = now;
    try { if (window.App && App.toast) App.toast('❌ डाटा भण्डार भरियो — "' + (this.LABELS[key] || key) + '" सेभ हुन सकेन। तुरुन्तै Backup लिनुहोस् र Backup पेजमा ठाउँ खाली गर्नुहोस्।', 'error', 8000); } catch (e) {}
    try { this.render(); } catch (e) {}
  },

  /** After login: measure the real quota in the background, then warn once if needed. */
  init: function () {
    var self = this;
    setTimeout(function () {
      try { self.measure(); } catch (e) {}
      try {
        self.render();
        var st = self.status();
        if (!self._toasted && st.level !== 'ok' && self.shouldShow() && window.App && App.toast) {
          self._toasted = true;
          App.toast('📦 ' + self.message(st), st.level === 'crit' ? 'error' : 'warning', 7000);
        }
      } catch (e) {}
    }, 4000);
  }
};

var RestoreGuard = {
  DB: 'swagatik-safety', STORE_NAME: 'snapshots', KEEP: 3,
  _mem: [],
  // Never part of a snapshot: login session, license (kept separately by License), the probe/quota
  SKIP: /^(pk3_session$|pk3_license$|pk3_lic_backup$|pk3_autosave_|swagatik_ls_quota$|__swagatik)/,

  _skip: function (k) {
    if (this.SKIP.test(k)) return true;
    try { if (typeof License !== 'undefined' && License._STORES && License._STORES.indexOf(k) !== -1) return true; } catch (e) {}
    return false;
  },
  /** Raw copy of everything restore can touch → {key: rawString} */
  collect: function () {
    var d = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k.indexOf('pk3_') === 0 || k === 'lastBackup') && !this._skip(k)) d[k] = localStorage.getItem(k);
    }
    return d;
  },
  _open: function () {
    var self = this;
    return new Promise(function (res) {
      try {
        if (!window.indexedDB) return res(null);
        var rq = indexedDB.open(self.DB, 1);
        rq.onupgradeneeded = function () { var db = rq.result; if (!db.objectStoreNames.contains(self.STORE_NAME)) db.createObjectStore(self.STORE_NAME, { keyPath: 'id' }); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  },
  _all: function () {
    var self = this;
    return this._open().then(function (db) {
      if (!db) return self._mem.slice();
      return new Promise(function (res) {
        try {
          var rq = db.transaction(self.STORE_NAME, 'readonly').objectStore(self.STORE_NAME).getAll();
          rq.onsuccess = function () { res((rq.result || []).concat(self._mem)); };
          rq.onerror = function () { res(self._mem.slice()); };
        } catch (e) { res(self._mem.slice()); }
      });
    }).then(function (list) { return list.sort(function (a, b) { return b.at - a.at; }); });
  },
  _put: function (rec) {
    var self = this;
    return this._open().then(function (db) {
      if (!db) return false;
      return new Promise(function (res) {
        try {
          var tx = db.transaction(self.STORE_NAME, 'readwrite'), st = tx.objectStore(self.STORE_NAME);
          st.put(rec);
          tx.oncomplete = function () { res(true); };
          tx.onerror = tx.onabort = function () { res(false); };
        } catch (e) { res(false); }
      });
    });
  },
  _del: function (id) {
    var self = this;
    this._mem = this._mem.filter(function (s) { return s.id !== id; });
    return this._open().then(function (db) {
      if (!db) return;
      return new Promise(function (res) {
        try { var tx = db.transaction(self.STORE_NAME, 'readwrite'); tx.objectStore(self.STORE_NAME).delete(id); tx.oncomplete = tx.onerror = function () { res(); }; }
        catch (e) { res(); }
      });
    });
  },

  /**
   * Save a safety copy of the current data before something overwrites it.
   * Resolves {ok, id, where: 'idb'|'file'|'memory'}. Never rejects.
   */
  snapshot: function (reason) {
    var self = this;
    var rec = { id: 'snap_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), reason: reason || 'Restore',
                appVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''), data: this.collect() };
    return this._put(rec).then(function (ok) {
      if (ok) {
        return self._all().then(function (list) {
          var stored = list.filter(function (s) { return self._mem.indexOf(s) === -1; });
          return Promise.all(stored.slice(self.KEEP).map(function (s) { return self._del(s.id); }));
        }).then(function () { return { ok: true, id: rec.id, where: 'idb' }; });
      }
      // IndexedDB छैन → memory + .json फाइल download (हराउन नदिने)
      self._mem = [rec];
      var file = false;
      try {
        var out = {}; for (var k in rec.data) { try { out[k] = JSON.parse(rec.data[k]); } catch (e) { out[k] = rec.data[k]; } }
        out._meta = { version: rec.appVersion, date: new Date(rec.at).toISOString().slice(0, 10), safety: rec.reason };
        downloadFile('swagatik-safety-before-restore-' + new Date(rec.at).toISOString().slice(0, 10) + '.json', JSON.stringify(out));
        file = true;
      } catch (e) {}
      return { ok: true, id: rec.id, where: file ? 'file' : 'memory' };
    }).catch(function () { return { ok: false }; });
  },
  latest: function () { return this._all().then(function (l) { return l[0] || null; }); },

  /**
   * Write many raw values; if any write fails, put every touched key back as it was.
   * @param {object} writes {key: rawString|null}  (null = remove)
   * → {ok, failedKey}
   */
  applyRaw: function (writes) {
    var before = {}, k, failed = null;
    for (k in writes) before[k] = localStorage.getItem(k);
    try { localStorage.removeItem('pk3_autosave_snapshot'); } catch (e) {}   // duplicate copy → free space first
    for (k in writes) {
      try { if (writes[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, writes[k]); }
      catch (e) { failed = k; break; }
    }
    if (failed === null) return { ok: true };
    for (k in before) {
      try { if (before[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, before[k]); } catch (e) {}
    }
    try { if (window.ErrorLog && ErrorLog.add) ErrorLog.add('storage', 'Restore rollback: ' + failed + ' लेख्न सकिएन'); } catch (e) {}
    return { ok: false, failedKey: failed };
  },

  _count: function (v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return 0; } }
    return Array.isArray(v) ? v.length : 0;
  },
  /** Plain Nepali summary: backup vs. now (customers, invoices, quotations, daybook). */
  summary: function (data) {
    var self = this, rows = [['pk3_customers', 'ग्राहक'], ['pk3_invoices', 'बिल'], ['pk3_quotations', 'कोटेसन'], ['pk3_daybook', 'Daybook']];
    var n = StorageGuard._num, warn = [];
    var lines = rows.map(function (r) {
      var b = self._count(data[r[0]]), c = self._count(localStorage.getItem(r[0]));
      if (b < c) warn.push(r[1]);
      return '  • ' + r[1] + ': Backup मा ' + n(b) + ' | अहिले ' + n(c);
    });
    var meta = data._meta || {};
    var head = 'Backup मिति: ' + (meta.date || 'थाहा छैन') + (meta.version ? '  (v' + meta.version + ')' : '');
    var extra = '';
    if (warn.length) extra += '\n⚠️ Backup मा अहिलेभन्दा कम ' + warn.join(', ') + ' छन् — अहिलेका नयाँ entry हराउन सक्छन्।';
    if (meta.version && typeof APP_VERSION !== 'undefined' && this._newer(meta.version, APP_VERSION)) extra += '\n⚠️ यो Backup नयाँ version (v' + meta.version + ') को हो — पहिले एप अपडेट गर्नुहोस्।';
    return head + '\n' + lines.join('\n') + extra;
  },
  _newer: function (a, b) {
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; }
    return false;
  },

  /** Backup page: show the Undo card when a safety copy exists. */
  render: function () {
    var box = document.getElementById('restore-undo-box');
    if (!box) return;
    this.latest().then(function (s) {
      if (!s) { box.style.display = 'none'; box.innerHTML = ''; return; }
      var when = '';
      try { when = new Date(s.at).toLocaleString('en-IN'); } catch (e) {}
      box.style.display = '';
      box.innerHTML = '<div style="font-weight:700;margin-bottom:6px;">🛟 Restore अघिको सुरक्षा कपी</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;" id="restore-undo-info">' + esc(s.reason) + ' अघि सेभ गरिएको — ' + esc(when) + '</div>' +
        '<button type="button" id="restore-undo-btn" class="btn btn-sm btn-secondary" onclick="RestoreGuard.undo()">↩️ Restore अघिको डाटा फर्काउनुहोस्</button>';
    });
  },

  /** Put back the latest safety copy (itself protected by a fresh copy first). */
  undo: function () {
    var self = this;
    return this.latest().then(function (s) {
      if (!s) { try { App.toast('सुरक्षा कपी भेटिएन', 'error'); } catch (e) {} return false; }
      var when = ''; try { when = new Date(s.at).toLocaleString('en-IN'); } catch (e) {}
      if (!confirm('↩️ ' + when + ' को सुरक्षा कपी फर्काउने?\n(' + s.reason + ' अघिको डाटा)\n\nअहिलेको डाटाको पनि नयाँ सुरक्षा कपी पहिले बनाइन्छ।')) return false;
      var licSafe = null; try { licSafe = License._load(); } catch (e) {}
      return self._del(s.id).then(function () { return self.snapshot('Undo'); }).then(function () {
        var writes = {}, cur = self.collect(), k;
        for (k in cur) if (!(k in s.data)) writes[k] = null;
        for (k in s.data) writes[k] = s.data[k];
        var r = self.applyRaw(writes);
        try { if (licSafe) License._save(licSafe); } catch (e) {}
        if (!r.ok) { try { App.toast('❌ फर्काउन सकिएन — डाटा जस्ताको तस्तै छ', 'error', 6000); } catch (e) {} return false; }
        try { Audit.log('RESTORE', 'Restore undo: safety copy of ' + when); } catch (e) {}
        try { App.toast('✅ Restore अघिको डाटा फर्कियो — पुनः लोड हुँदैछ…', 'success'); } catch (e) {}
        setTimeout(function () { self._reload(); }, 1000);
        return true;
      });
    });
  },
  _reload: function () { location.reload(); }
};
