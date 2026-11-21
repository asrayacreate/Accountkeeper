// ═══════════════ NEW SECRET → HASH (v7.3.4, Super Admin) ═══════════════
// नयाँ Master Key र Super Admin password को SHA-256 hash यही phone/computer भित्रै बनाउँछ।
// असली key/password कहिल्यै save, sync, log वा कतै पठाइँदैन — hash मात्र देखाइन्छ, जुन repo मा राखिन्छ
// (License.MASTER_HASH र _RAW_USERS)। CLI बराबर: npm run hash-secret.
var SecretHash = {
  MIN: 12,
  _val: function (id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; },
  _clearInputs: function () { ['sh-key', 'sh-key2', 'sh-pw', 'sh-pw2'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; }); },
  /** Returns a Nepali problem message, or '' when the secret is strong enough. */
  check: function (s, label) {
    if (!s) return label + ' खाली छ';
    if (s.length < this.MIN) return label + ' कम्तीमा ' + this.MIN + ' अक्षरको हुनुपर्छ';
    if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return label + ' मा अक्षर र अंक दुवै चाहिन्छ';
    if (/^(.)\1+$/.test(s)) return label + ' एउटै अक्षर दोहोर्याएर बनाउनु हुँदैन';
    return '';
  },
  masterHash: function (key) { return _sha256(License._SALT + '|MASTER|' + License._clean(key)); },
  pwHash: function (pw) { return _pwHash(pw); },
  make: function () {
    var key = this._val('sh-key'), key2 = this._val('sh-key2'), pw = this._val('sh-pw'), pw2 = this._val('sh-pw2');
    var out = document.getElementById('sh-result');
    var err = this.check(License._clean(key), 'Master Key') || (License._clean(key) !== License._clean(key2) ? 'दुवै Master Key मिलेनन्' : '') ||
              this.check(pw, 'Password') || (pw !== pw2 ? 'दुवै Password मिलेनन्' : '') ||
              (License._clean(key) === License._clean(pw) ? 'Master Key र Password फरक हुनुपर्छ' : '') ||
              (License._isMaster(key) ? 'यो त अहिलेकै Master Key हो — नयाँ छान्नुहोस्' : '') ||
              (USERS_CONFIG.some(function (u) { return u.passHash === _pwHash(pw); }) ? 'यो त अहिलेकै Password हो — नयाँ छान्नुहोस्' : '');
    if (err) { if (out) { out.style.display = ''; out.innerHTML = '<div class="sh-err">❌ ' + esc(err) + '</div>'; } return null; }
    var r = { master: this.masterHash(key), password: this.pwHash(pw) };
    this._clearInputs();
    if (out) {
      var text = 'MASTER_HASH: ' + r.master + '\nPASSWORD_HASH: ' + r.password;
      out.style.display = '';
      out.innerHTML = '<div class="sh-ok">✅ Hash तयार भयो। असली key र password कागजमा सुरक्षित लेखेर राख्नुहोस् (यो app ले कतै राख्दैन)।</div>' +
        '<textarea id="sh-hashes" readonly rows="5" class="sh-hashes">' + esc(text) + '</textarea>' +
        '<button type="button" class="btn btn-sm btn-primary" id="sh-copy" onclick="SecretHash.copy()">📋 Hash Copy गर्नुहोस्</button>' +
        '<div class="sh-note">यी दुई hash मात्र पठाउनुहोस्। Hash बाट key/password पत्ता लगाउन सकिँदैन।</div>';
    }
    return r;
  },
  copy: function () {
    var t = document.getElementById('sh-hashes'); if (!t) return;
    var done = function () { try { App.toast('📋 Hash copy भयो', 'success'); } catch (e) {} };
    try { navigator.clipboard.writeText(t.value).then(done, function () { t.select(); document.execCommand('copy'); done(); }); }
    catch (e) { t.select(); try { document.execCommand('copy'); done(); } catch (x) {} }
  }
};
