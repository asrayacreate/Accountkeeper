// ═══════════════ BACKUP ALERT (v7.2.0) ═══════════════
// ७ दिनसम्म कुनै ब्याकअप नभए Dashboard को माथि सानो चेतावनी देखाउँछ।
// "ब्याकअप" भनेको यी मध्ये जुनसुकै सबैभन्दा पछिल्लो:
//   • Backup (.json) download / Restore      → STORE 'lastBackup'
//   • Dropbox sync                           → pk3_dbx_meta.last
//   • Google Drive / Swagatik Cloud sync     → pk3_<provider>_meta.last (CloudSync)
// "भोलि सम्झाउनुहोस्" ले यही device मा २४ घण्टा लुकाउँछ। Snooze / पहिलो पटक देखेको समय device-only
// key (pk3_ बिना) मा बस्छ, त्यसैले sync / backup फाइलमा जाँदैन।
var BackupAlert = {
  DAYS: 7,
  SNOOZE_KEY: 'swagatik_backup_snooze',
  SEEN_KEY: 'swagatik_backup_first_seen',
  DAY_MS: 24 * 60 * 60 * 1000,

  _ms: function (v) {
    if (v == null || v === '') return 0;
    var n = typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? parseInt(v, 10) : new Date(v).getTime());
    return isFinite(n) && n > 0 ? n : 0;
  },
  _meta: function (k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } },

  /** Every backup source with its last time (ms). */
  sources: function () {
    var self = this;
    return [
      { id: 'file', label: 'Backup फाइल (.json)', at: self._ms(STORE.get('lastBackup', null)) },
      { id: 'dropbox', label: 'Dropbox sync', at: self._ms(self._meta('pk3_dbx_meta').last) },
      { id: 'gdrive', label: 'Google Drive sync', at: self._ms(self._meta('pk3_gdrive_meta').last) },
      { id: 'supa', label: 'Swagatik Cloud sync', at: self._ms(self._meta('pk3_supa_meta').last) }
    ];
  },
  /** Most recent backup of any kind → {at, label} (at = 0 when never). */
  last: function () {
    var best = { at: 0, label: '' };
    this.sources().forEach(function (s) { if (s.at > best.at) best = s; });
    return best;
  },
  _hasData: function () {
    try { if (typeof SyncData !== 'undefined') return SyncData.hasLocalData(); } catch (e) {}
    return (STORE.get('pk3_customers', []) || []).length > 0;
  },
  _num: function (n) {
    var d = '०१२३४५६७८९';
    return String(n).replace(/[0-9]/g, function (c) { return d[+c]; });
  },

  /**
   * Is a backup reminder due right now?
   * → { due, days, never, last }
   *   never-backed-up device: counts from the first day this device was seen with data,
   *   so a brand-new install is not nagged on day one.
   */
  status: function (now) {
    now = now || Date.now();
    var last = this.last(), res = { due: false, days: 0, never: !last.at, last: last };
    if (last.at) {
      res.days = Math.floor((now - last.at) / this.DAY_MS);
      res.due = res.days >= this.DAYS;
      return res;
    }
    if (!this._hasData()) return res;
    var seen = 0;
    try { seen = parseInt(localStorage.getItem(this.SEEN_KEY) || '0', 10) || 0; } catch (e) {}
    if (!seen) { try { localStorage.setItem(this.SEEN_KEY, String(now)); } catch (e) {} return res; }
    res.days = Math.floor((now - seen) / this.DAY_MS);
    res.due = res.days >= this.DAYS;
    return res;
  },
  snoozed: function (now) {
    var until = 0;
    try { until = parseInt(localStorage.getItem(this.SNOOZE_KEY) || '0', 10) || 0; } catch (e) {}
    return until > (now || Date.now());
  },
  _allowed: function () {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    try { if (typeof Auth !== 'undefined' && Auth.can) return Auth.can('backup'); } catch (e) {}
    return true;
  },
  /** Should the banner show (due + allowed + not snoozed)? */
  shouldShow: function (now) {
    if (!this._allowed() || this.snoozed(now)) return false;
    return this.status(now).due;
  },

  message: function (st) {
    st = st || this.status();
    if (st.never) return 'तपाईंको डाटाको अहिलेसम्म कुनै ब्याकअप भएको छैन। फोन हराए वा बिग्रिए सबै डाटा जान सक्छ।';
    var when = '';
    try { when = fmtDisplayDate(new Date(st.last.at).toISOString()); } catch (e) {}
    return this._num(st.days) + ' दिनदेखि डाटाको ब्याकअप भएको छैन' +
      (when ? ' (पछिल्लो: ' + when + ', ' + st.last.label + ')' : '') + '। आजै ब्याकअप गर्नुहोस्।';
  },

  render: function () {
    try { if (window.StorageGuard) StorageGuard.render(); } catch (e) {}
    try { if (window.MoveOrigin) MoveOrigin.render(); } catch (e) {}
    var box = document.getElementById('backup-alert-dash');
    if (!box) return;
    if (!this.shouldShow()) { box.innerHTML = ''; box.style.display = 'none'; return; }
    var st = this.status();
    box.style.display = '';
    box.innerHTML =
      '<div class="backup-alert" role="alert">' +
        '<div class="backup-alert-text"><b>💾 ब्याकअप सम्झना</b><span id="backup-alert-msg">' + this.message(st) + '</span></div>' +
        '<div class="backup-alert-btns">' +
          '<button type="button" id="backup-alert-now" class="btn btn-sm btn-primary" onclick="BackupAlert.backupNow()">⬇️ अहिले Backup गर्नुहोस्</button>' +
          '<button type="button" id="backup-alert-later" class="btn btn-sm btn-secondary" onclick="BackupAlert.snooze()">⏰ भोलि सम्झाउनुहोस्</button>' +
        '</div>' +
      '</div>';
  },
  backupNow: function () {
    try { Backup.exportJSON(); } catch (e) { try { console.warn('Backup from alert failed:', e); } catch (_) {} }
    this.render();
  },
  snooze: function (hours) {
    try { localStorage.setItem(this.SNOOZE_KEY, String(Date.now() + (hours || 24) * 60 * 60 * 1000)); } catch (e) {}
    this.render();
  },

  /** A gentle one-time toast after login (replaces the old 1-day / 7-day toasts). */
  toastIfDue: function () {
    var self = this;
    setTimeout(function () {
      try {
        if (self._toasted || !self.shouldShow()) return;
        var dash = document.getElementById('page-dashboard');
        if (dash && dash.classList.contains('active')) return;   // Dashboard मा banner नै देखिन्छ
        self._toasted = true;
        if (window.App && App.toast) App.toast('💾 ' + self.message(), 'warning', 6000);
      } catch (e) {}
    }, 3000);
  }
};
