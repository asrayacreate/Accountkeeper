// ============================================================
// Swagatik — JavaScript Core
// ============================================================
// CHANGELOG (v3.9 → v4.0):
//   ✅ Fixed CSS bug breaking input widths (width:100%);)
//   ✅ Fixed Pending quotation count (case mismatch Pending/pending)
//   ✅ Fixed Today's Advance stat (type+cat filter)
//   ✅ Fixed Greet username (Auth.currentUser → currentUser)
//   ✅ Fixed Tests role check
//   ✅ Removed duplicate BS-Date-Picker DOM (invalid duplicate IDs)
//   ✅ Calculator ± and % buttons now functional
//   ✅ Replaced eval() with safer Function() evaluator
//   ✅ Address suggestions deduplicated (133 → 88 unique)
//   ✅ Removed dead Bootstrap.Tooltip code
//   ✅ Passwords now base64-encoded (NOT cryptographic — see warning)
//   ✅ AI Assistant temporarily shows "Coming Soon" (needs API key proxy)
//   ✅ PWA: Added install support, offline fallback, manifest
//   ✅ Auto-backup reminder every 7 days
//   ✅ Global error boundary so one module crash won't kill the app
//   ✅ Better keyboard a11y (Esc closes modals, focus trap)
// ============================================================

// ─── SHA-256 (v6.9.0) — synchronous, pure JS, works on file:// too ──────────
// Used so that passwords and the license master key are stored only as
// one-way hashes. Output = lowercase hex, identical to Node's
// crypto.createHash('sha256') (see scripts/hash-secret.mjs).
function _sha256(str){
  var bytes = unescape(encodeURIComponent(String(str)));
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var l = bytes.length, words = [], i;
  for (i = 0; i < l; i++) words[i >> 2] |= (bytes.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
  var nBlocks = (((l + 8) >> 6) + 1) * 16;
  words[nBlocks - 1] = l * 8;
  for (i = 0; i < nBlocks; i++) words[i] = words[i] | 0;
  var w = new Array(64);
  for (var b = 0; b < nBlocks; b += 16) {
    var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (var t = 0; t < 64; t++) {
      if (t < 16) w[t] = words[b + t];
      else {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & bb) ^ (a & c) ^ (bb & c);
      var t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  var out = '';
  for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
  return out;
}

// ─── SECURITY NOTE (v6.9.0) ──────────────────────────────────
// Passwords are stored ONLY as salted SHA-256 hashes — the real password is
// no longer written anywhere in this file. This hides it from casual viewers
// of the public source. Limits of a server-less app: a determined person can
// still guess short/common passwords offline against the hash, or edit the JS
// copy they downloaded. Use a long password (12+ chars) for the Super Admin.
//
// To set a new password hash:  npm run hash-secret -- password "NewPass"
// (or in the browser console:  _encodePw('NewPass')) and paste it below.
// ─────────────────────────────────────────────────────────────

// ─── USERS CONFIG (SHA-256 password hashes) ──────────────────
var _RAW_USERS = [
  // user, sha256('SWG-PW-v1|' + password), display name, role
  // SINGLE USER MODE (pre-public): only the superadmin login is active.
  // admin / staff logins are intentionally disabled for now — add back later.
  ['punya', '002351efdb4518ab820439efbae7246d329b3388a70e3a186230f1e6efb608e7', 'Punya Gautam', 'superadmin']
];
var USERS_CONFIG = _RAW_USERS.map(function(r){
  return {user:r[0], passHash:r[1], name:r[2], role:r[3]};
});
function _pwHash(p){ return _sha256('SWG-PW-v1|' + String(p == null ? '' : p)); }
// Helper for super-admin to create a password hash later
window._encodePw = function(p){ return _pwHash(p); };

// Staff-accessible pages (role='staff' can access these)
var STAFF_PAGES = ['dashboard','customers','add-customer','followups','add-followup',
  'quotations','add-quotation','daybook','walkin','qrcode','ratelist','bakauta',
  'estimate-new','estimates-list','vcard','brochures','ai-assistant','bulkmsg','settings'];

