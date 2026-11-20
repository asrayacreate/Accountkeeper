// ═══════════════ COMMERCIAL LICENSE — SUPABASE CLIENT HOOK (v7.0.0) ═══════════════
// सार्वजनिक बिक्रीका लागि: वार्षिक / आजीवन License Key, म्याद (Expiry), Plan र Device Limit
// server (Supabase) ले जाँच्छ। Schema: supabase/license_schema.sql। Guide: COMMERCIAL_LAUNCH.md।
//
// LICENSE_CLOUD.enabled = false (default) → पुरानो offline license (v6.9) जस्ताको तस्तै चल्छ।
// true गरेपछि: offline key नमिलेमा server मा `activate_license` RPC बाट जाँचिन्छ, र हरेक
// २४ घण्टामा `check_license` ले renew/revoke/expiry मिलाउँछ। Internet नभए GRACE_DAYS सम्म चल्छ।
var LICENSE_CLOUD = {
  enabled: false,
  url: '',            // https://xxxx.supabase.co
  anonKey: '',        // public anon key (RPC functions are SECURITY DEFINER, tables are locked by RLS)
  GRACE_DAYS: 15,
  CHECK_EVERY_H: 24
};

var LicenseCloud = {
  enabled: function () { return !!(LICENSE_CLOUD.enabled && LICENSE_CLOUD.url && LICENSE_CLOUD.anonKey); },

  /** Stable random id for this browser/device (not personal data). */
  deviceId: function () {
    var id = localStorage.getItem('pk3_device_id');
    if (!id) {
      var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      id = 'dev_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      localStorage.setItem('pk3_device_id', id);
    }
    return id;
  },
  deviceName: function () {
    var ua = navigator.userAgent || '';
    return (/Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Device') + ' · ' + (/Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Browser');
  },

  _rpc: async function (fn, args) {
    var r = await fetch(LICENSE_CLOUD.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: LICENSE_CLOUD.anonKey, Authorization: 'Bearer ' + LICENSE_CLOUD.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    var j = await r.json().catch(function () { return null; });
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('HTTP ' + r.status));
    return Array.isArray(j) ? j[0] : j;   // {ok, reason, plan, company, expires_at, device_limit, devices_used}
  },

  /** First activation of a key on this device. */
  activate: function (company, key) {
    return this._rpc('activate_license', { p_key: key, p_company: company, p_device_id: this.deviceId(), p_device_name: this.deviceName(), p_app_version: APP_VERSION });
  },
  /** Periodic re-check (renewal, revoke, expiry, device removed). */
  check: function (key) {
    return this._rpc('check_license', { p_key: key, p_device_id: this.deviceId(), p_app_version: APP_VERSION });
  },

  REASONS: {
    not_found: 'License Key मिलेन', company_mismatch: 'Company Name मिलेन', expired: 'License को म्याद सकियो',
    revoked: 'यो License रद्द गरिएको छ', device_limit: 'Device सीमा पुगिसक्यो — पुरानो device हटाउन support मा सम्पर्क गर्नुहोस्'
  },
  reasonText: function (r) { return this.REASONS[r] || r || 'License जाँच असफल'; },

  /** Called on app start: re-validate cloud licenses once a day; offline grace. Never touches offline (v6) licenses. */
  verifyStored: async function () {
    if (!this.enabled()) return;
    var rec = License._load(); if (!rec || !rec.cloud) return;
    var last = rec.cloudCheckedAt ? new Date(rec.cloudCheckedAt).getTime() : 0;
    if (Date.now() - last < LICENSE_CLOUD.CHECK_EVERY_H * 3600e3) return;
    try {
      var res = await this.check(rec.key);
      if (res && res.ok) {
        rec.plan = res.plan || rec.plan; rec.expiry = res.expires_at || null; rec.cloudCheckedAt = new Date().toISOString();
        License._save(rec);
      } else {
        License._wipe();
        App.toast('⛔ ' + this.reasonText(res && res.reason) + ' — 📞 ' + SWAGATIK_VENDOR.supportPhone, 'error', 6000);
        setTimeout(function () { location.reload(); }, 2500);
      }
    } catch (e) {
      // offline / server down → allow until grace period ends
      if (last && Date.now() - last > LICENSE_CLOUD.GRACE_DAYS * 86400e3) {
        App.toast('⚠️ License जाँच गर्न internet चाहिन्छ (' + LICENSE_CLOUD.GRACE_DAYS + ' दिन भयो)', 'error', 6000);
      }
    }
  },

  /** License.activate() calls this when the offline check fails and the cloud is enabled. */
  activateFromScreen: function (company, key, err) {
    var self = this;
    if (err) { err.innerHTML = '⏳ License server मा जाँच हुँदैछ…'; err.style.display = 'block'; }
    return this.activate(company, key).then(function (res) {
      if (!res || !res.ok) {
        if (err) err.innerHTML = '❌ ' + self.reasonText(res && res.reason) + '<br><span style="opacity:.8;font-size:.72rem;">📞 ' + SWAGATIK_VENDOR.supportPhone + '</span>';
        return false;
      }
      License._save({ company: res.company || company.trim(), key: key, plan: res.plan || 'CLOUD', expiry: res.expires_at || null,
        activatedAt: new Date().toISOString(), device: self.deviceName(), cloud: true, cloudCheckedAt: new Date().toISOString(), deviceLimit: res.device_limit || null });
      if (err) err.style.display = 'none';
      License._afterActivate(company);
      return true;
    }).catch(function (e) {
      if (err) err.innerHTML = '❌ License server सम्म पुगिएन (' + esc(e.message) + ')। Internet जाँच्नुहोस्।';
      return false;
    });
  }
};
window.addEventListener('load', function () { setTimeout(function () { try { LicenseCloud.verifyStored(); } catch (e) {} }, 5000); });
