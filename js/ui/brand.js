// ─── AUTH MODULE ──────────────────────────────────────────────
var currentUser = null;
// ═══════════ WHITE-LABEL BRANDING (v5.6) ═══════════
// Company name/logo settings बाट सबै UI chrome मा पुर्‍याउने — title, manifest,
// sidebar, login, license screen। File अर्को company लाई बेच्दा तिनकै नाम देखिन्छ।
// ═══════════ ESTIMATE ENTRY CHOICE (v5.8) ═══════════
// एउटै entry point — "Quick" वा "Detailed" छान्ने, अनि existing flow मा जाने।
// दुवै flow आफ्नै ठाउँमा उस्तै छन् — केवल सुरुको ढोका एउटा भयो।
var EstimateChoice = {
  open: function () {
    var ov = document.getElementById('est-choice-modal');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'est-choice-modal';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
      document.body.appendChild(ov);
    }
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.4);">'
      + '<div style="text-align:center;margin-bottom:6px;font-size:1.15rem;font-weight:900;">✨ नयाँ Estimate</div>'
      + '<div style="text-align:center;font-size:0.78rem;color:var(--text-muted);margin-bottom:20px;">कस्तो estimate बनाउने?</div>'
      + '<div style="display:grid;gap:12px;">'

      // Quick
      + '<button type="button" onclick="EstimateChoice.pick(\'bakauta\')" style="text-align:left;padding:16px;background:var(--surface-2);border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
        + '<div style="display:flex;align-items:center;gap:12px;">'
        + '<div style="font-size:1.8rem;">🧾</div>'
        + '<div style="flex:1;"><div style="font-weight:800;font-size:0.98rem;color:var(--text);">Quick Estimate</div>'
        + '<div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">छिटो हिसाब — item, qty, rate हालेर तुरुन्तै जोड। Rough/internal काम।</div></div>'
        + '<div style="font-size:1.2rem;color:var(--text-muted);">›</div>'
        + '</div></button>'

      // Detailed
      + '<button type="button" onclick="EstimateChoice.pick(\'estimate-new\')" style="text-align:left;padding:16px;background:var(--surface-2);border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
        + '<div style="display:flex;align-items:center;gap:12px;">'
        + '<div style="font-size:1.8rem;">✨</div>'
        + '<div style="flex:1;"><div style="font-weight:800;font-size:0.98rem;color:var(--text);">Detailed Estimate (Pro)</div>'
        + '<div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;line-height:1.4;">पूरा estimate — customer, discount/tax, terms सहित professional कागज।</div></div>'
        + '<div style="font-size:1.2rem;color:var(--text-muted);">›</div>'
        + '</div></button>'

      + '</div>'
      + '<div style="text-align:center;margin-top:16px;">'
        + '<button onclick="document.getElementById(\'est-choice-modal\').remove()" class="btn btn-sm btn-secondary">✕ रद्द</button>'
        + '<button onclick="EstimateChoice.close();App.navigate(\'estimates-list\')" class="btn btn-sm btn-secondary" style="margin-left:6px;">📂 Saved Estimates</button>'
      + '</div>'
      + '</div>';
  },

  close: function () {
    var ov = document.getElementById('est-choice-modal');
    if (ov) ov.remove();
  },

  pick: function (page) {
    this.close();
    App.navigate(page);
  }
};

// ═══════════ COMPANY INTRO VISUAL CARD (v5.6) ═══════════
// Company Introduction लाई सुन्दर styled card मा देखाउने — WhatsApp मा
// screenshot लिएर वा Print/PDF गरेर पठाउन मिल्ने। Text-only भन्दा आकर्षक।
var IntroCard = {
  SERVICES: [
    { icon: '🏗️', t: 'Construction, Civil Work & Renovation' },
    { icon: '🏠', t: 'Prefab Wall / Homes' },
    { icon: '🔩', t: 'Truss Works / Roofing' },
    { icon: '🪟', t: 'UPVC / Aluminum Window & Door' },
    { icon: '🎨', t: 'Gypsum / False Ceiling' },
    { icon: '🛋️', t: 'Interior Design & Decoration' },
    { icon: '🍽️', t: 'Modular Kitchen & Furniture' },
    { icon: '🧱', t: 'Tiles / Marble / Parquet Flooring' },
    { icon: '🖌️', t: 'Painting / Texture Work' },
    { icon: '🚪', t: 'WPC Door & Panel' },
    { icon: '☀️', t: 'Solar Water Heater & Panel' },
    { icon: '🔥', t: 'Chimney / Cooking Stove' },
    { icon: '💧', t: 'Water Purifier Installation' }
  ],

  open: function () {
    var co = STORE.get('pk3_settings', {}) || {};
    var name = (co.companyName || 'PRERAK MULTIPURPOSE PVT LTD');
    var tagline = co.tagline || 'Building Your Dreams';
    var addr = co.address || 'Hetauda-2, Kantirajpath, Makwanpur';
    var ph1 = co.phone1 || '9855069733';
    var ph2 = co.phone2 || '9801069733';
    var email = co.email || 'prerakconstrucion21@gmail.com';
    var logo = co.logo || '';

    var svcHtml = this.SERVICES.map(function (s) {
      return '<div style="display:flex;align-items:center;gap:9px;padding:7px 11px;background:#fff7ed;'
        + 'border:1px solid #fed7aa;border-radius:9px;font-size:13px;color:#7c2d12;">'
        + '<span style="font-size:16px;">' + s.icon + '</span>'
        + '<span style="font-weight:600;">' + esc(s.t) + '</span></div>';
    }).join('');

    var logoBlock = logo
      ? '<img src="' + logo + '" style="width:76px;height:76px;object-fit:contain;background:#fff;border-radius:14px;padding:5px;">'
      : '<div style="width:76px;height:76px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:40px;">🏗️</div>';

    var card =
      '<div id="intro-card-print" style="width:520px;max-width:100%;margin:0 auto;background:linear-gradient(160deg,#ea580c,#c2410c);border-radius:20px;padding:4px;font-family:\'Segoe UI\',system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,0.3);">'
      + '<div style="background:#fff;border-radius:17px;overflow:hidden;">'
      // header
      + '<div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:22px 24px;display:flex;align-items:center;gap:16px;color:#fff;">'
      + logoBlock
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:20px;font-weight:900;line-height:1.2;">' + esc(name) + '</div>'
      + '<div style="font-size:12px;opacity:0.95;margin-top:3px;font-style:italic;">"' + esc(tagline) + '"</div>'
      + '</div></div>'
      // services heading
      + '<div style="padding:20px 24px 8px;">'
      + '<div style="font-size:15px;font-weight:800;color:#c2410c;margin-bottom:12px;display:flex;align-items:center;gap:7px;">✨ हाम्रा सेवाहरू / Our Services</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">' + svcHtml + '</div>'
      + '</div>'
      // trust strip
      + '<div style="margin:14px 24px;padding:11px;background:#fffbeb;border-radius:10px;text-align:center;font-size:12.5px;font-weight:700;color:#92400e;">'
      + '⭐ Quality Work &nbsp;•&nbsp; 💰 Best Price &nbsp;•&nbsp; ⏱️ On-time Delivery</div>'
      // contact
      + '<div style="background:#1f2937;color:#fff;padding:16px 24px;font-size:12.5px;line-height:1.9;">'
      + '<div>📞 ' + esc(ph1) + (ph2 ? ' | ' + esc(ph2) : '') + '</div>'
      + '<div>📍 ' + esc(addr) + '</div>'
      + (email ? '<div>✉️ ' + esc(email) + '</div>' : '')
      + '</div>'
      + '</div></div>';

    var ov = document.getElementById('intro-card-modal');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'intro-card-modal';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10001;overflow:auto;padding:20px;';
      document.body.appendChild(ov);
    }
    ov.innerHTML =
      '<div style="max-width:540px;margin:0 auto;">'
      + card
      + '<div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap;">'
      + '<button onclick="IntroCard.shareImage()" class="btn btn-sm" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:700;">📤 Share (फोटो)</button>'
      + '<button onclick="IntroCard.downloadImage()" class="btn btn-sm" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:700;">🖼️ Image Download</button>'
      + '<button onclick="IntroCard.print()" class="btn btn-secondary btn-sm">🖨️ Print / PDF</button>'
      + '<button onclick="IntroCard.copyText()" class="btn btn-secondary btn-sm">📋 Text</button>'
      + '<button onclick="IntroCard.shareWA()" class="btn btn-wa btn-sm">📱 WhatsApp Text</button>'
      + '<button onclick="document.getElementById(\'intro-card-modal\').remove()" class="btn btn-secondary btn-sm">✕ बन्द</button>'
      + '</div>'
      + '<div style="text-align:center;color:#cbd5e1;font-size:11px;margin-top:10px;">💡 <b>“📤 Share”</b> → WhatsApp छानेर → contact मा फोटो सिधै पठाउनुहोस् (नयाँ फोनमा)। नभए “🖼️ Image Download” → WhatsApp मा 📎 बाट attach।</div>'
      + '</div>';
  },

  _textVersion: function () {
    var co = STORE.get('pk3_settings', {}) || {};
    var name = (co.companyName || 'PRERAK MULTIPURPOSE PVT LTD');
    var lines = ['🙏 ' + name + ' मा हार्दिक स्वागत छ!', '', 'हाम्रा सेवाहरू:'];
    this.SERVICES.forEach(function (s) { lines.push('✅ ' + s.t); });
    lines.push('', 'Quality Work • Best Price • On-time Delivery');
    lines.push('📞 ' + (co.phone1 || '9855069733') + (co.phone2 ? ' | ' + co.phone2 : ''));
    lines.push('📍 ' + (co.address || 'Hetauda-2, Kantirajpath, Makwanpur'));
    if (co.email) lines.push('✉️ ' + co.email);
    lines.push('', '"' + (co.tagline || 'Building Your Dreams') + '"');
    return lines.join('\n');
  },

  copyText: function () {
    var txt = this._textVersion();
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { App.toast('📋 Copy भयो', 'success'); });
      else { var t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); App.toast('📋 Copy भयो', 'success'); }
    } catch (e) { App.toast('Copy भएन', 'error'); }
  },

  shareWA: function () {
    window.open('https://wa.me/?text=' + encodeURIComponent(this._textVersion()), '_blank');
  },

  // Card लाई साँच्चै PNG image बनाउने — offline, library बिना (SVG foreignObject → canvas)
  // Card लाई native canvas मा चित्रेर PNG बनाउने — हरेक mobile browser मा चल्छ
  // (foreignObject/SVG को भर पर्दैन — त्यो धेरै फोनमा भाँचिन्छ)
  // Card लाई native canvas मा चित्रेर canvas object फर्काउने (image बनाउने साझा engine)
  _buildCanvas: function () {
    try {
      var co = STORE.get('pk3_settings', {}) || {};
      var name = (co.companyName || 'PRERAK MULTIPURPOSE PVT LTD');
      var tagline = co.tagline || 'Building Your Dreams';
      var addr = co.address || 'Hetauda-2, Kantirajpath, Makwanpur';
      var ph1 = co.phone1 || '9855069733';
      var ph2 = co.phone2 || '';
      var email = co.email || '';
      var svcs = this.SERVICES;

      var S = 2;                       // resolution scale
      var W = 560;                     // logical width
      var pad = 22;
      var colGap = 12, rowH = 46;
      var cols = 2;
      var rows = Math.ceil(svcs.length / cols);

      // compute height
      var headerH = 96;
      var svcTop = headerH + 52;
      var svcBlockH = rows * (rowH + 8);
      var trustH = 44;
      var contactLines = 1 + 1 + (email ? 1 : 0);
      var contactH = 18 + contactLines * 22 + 14;
      var H = svcTop + svcBlockH + 18 + trustH + 18 + contactH + 16;

      var cv = document.createElement('canvas');
      cv.width = W * S; cv.height = H * S;
      var x = cv.getContext('2d');
      x.scale(S, S);

      function rr(cx, cy, cw, ch, r) {
        x.beginPath();
        x.moveTo(cx + r, cy);
        x.arcTo(cx + cw, cy, cx + cw, cy + ch, r);
        x.arcTo(cx + cw, cy + ch, cx, cy + ch, r);
        x.arcTo(cx, cy + ch, cx, cy, r);
        x.arcTo(cx, cy, cx + cw, cy, r);
        x.closePath();
      }
      function fitText(str, maxW, fontPx) {
        x.font = '600 ' + fontPx + 'px "Segoe UI",system-ui,Arial,sans-serif';
        if (x.measureText(str).width <= maxW) return [str];
        var words = str.split(' '), lines = [], cur = '';
        for (var i = 0; i < words.length; i++) {
          var tryLine = cur ? cur + ' ' + words[i] : words[i];
          if (x.measureText(tryLine).width > maxW && cur) { lines.push(cur); cur = words[i]; }
          else cur = tryLine;
        }
        if (cur) lines.push(cur);
        return lines;
      }

      // background
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);

      // outer orange frame
      x.fillStyle = '#ea580c'; rr(0, 0, W, H, 18); x.fill();
      x.fillStyle = '#ffffff'; rr(4, 4, W - 8, H - 8, 15); x.fill();

      // header band
      var grad = x.createLinearGradient(0, 0, W, headerH);
      grad.addColorStop(0, '#f97316'); grad.addColorStop(1, '#ea580c');
      x.fillStyle = grad;
      x.save(); rr(4, 4, W - 8, headerH, 15); x.clip();
      x.fillRect(4, 4, W - 8, headerH); x.restore();

      // logo box
      x.fillStyle = '#ffffff'; rr(pad, 20, 62, 62, 12); x.fill();
      x.fillStyle = '#ea580c'; x.font = '34px "Segoe UI Emoji",system-ui,Arial'; x.textBaseline = 'middle'; x.textAlign = 'center';
      x.fillText('🏗️', pad + 31, 52);

      // company name + tagline
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#ffffff';
      var nameLines = fitText(name, W - pad - 100, 20);
      x.font = '900 20px "Segoe UI",system-ui,Arial,sans-serif';
      var ny = nameLines.length > 1 ? 40 : 48;
      nameLines.slice(0, 2).forEach(function (ln, i) { x.fillText(ln, pad + 78, ny + i * 22); });
      x.font = 'italic 12px "Segoe UI",system-ui,Arial,sans-serif';
      x.fillStyle = 'rgba(255,255,255,0.95)';
      x.fillText('"' + tagline + '"', pad + 78, (nameLines.length > 1 ? 84 : 68));

      // services heading
      x.fillStyle = '#c2410c';
      x.font = '800 15px "Segoe UI",system-ui,Arial,sans-serif';
      x.fillText('✨ हाम्रा सेवाहरू / Our Services', pad, headerH + 34);

      // service cells
      var cellW = (W - pad * 2 - colGap) / cols;
      svcs.forEach(function (s, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var cx = pad + c * (cellW + colGap);
        var cy = svcTop + r * (rowH + 8);
        x.fillStyle = '#fff7ed'; rr(cx, cy, cellW, rowH, 9); x.fill();
        x.strokeStyle = '#fed7aa'; x.lineWidth = 1; rr(cx, cy, cellW, rowH, 9); x.stroke();
        x.fillStyle = '#7c2d12';
        x.font = '18px "Segoe UI Emoji",system-ui,Arial'; x.textBaseline = 'middle';
        x.fillText(s.icon, cx + 11, cy + rowH / 2);
        var tl = fitText(s.t, cellW - 44, 12.5);
        x.font = '600 12.5px "Segoe UI",system-ui,Arial,sans-serif';
        if (tl.length === 1) { x.fillText(tl[0], cx + 38, cy + rowH / 2); }
        else { x.fillText(tl[0], cx + 38, cy + rowH / 2 - 8); x.fillText(tl[1], cx + 38, cy + rowH / 2 + 8); }
      });
      x.textBaseline = 'alphabetic';

      // trust strip
      var trustY = svcTop + svcBlockH + 10;
      x.fillStyle = '#fffbeb'; rr(pad, trustY, W - pad * 2, trustH, 10); x.fill();
      x.fillStyle = '#92400e'; x.font = '700 12.5px "Segoe UI",system-ui,Arial,sans-serif';
      x.textAlign = 'center';
      x.fillText('⭐ Quality Work   •   💰 Best Price   •   ⏱️ On-time Delivery', W / 2, trustY + trustH / 2 + 4);
      x.textAlign = 'left';

      // contact block (dark)
      var contactY = trustY + trustH + 16;
      x.fillStyle = '#1f2937'; rr(4, contactY, W - 8, H - contactY - 4, 0);
      // manual bottom rounding
      x.save(); rr(4, contactY - 8, W - 8, H - contactY, 0); x.restore();
      x.fillRect(4, contactY, W - 8, H - contactY - 4);
      // re-round bottom corners
      x.fillStyle = '#ffffff';
      x.fillStyle = '#e5e7eb'; x.font = '12.5px "Segoe UI Emoji","Segoe UI",system-ui,Arial';
      x.fillStyle = '#ffffff';
      var cyy = contactY + 26;
      x.fillText('📞 ' + ph1 + (ph2 ? '  |  ' + ph2 : ''), pad, cyy); cyy += 22;
      x.fillText('📍 ' + addr, pad, cyy); cyy += 22;
      if (email) { x.fillText('✉️ ' + email, pad, cyy); }

      // canvas तयार भयो — फर्काउने
      return { cv: cv, name: name };
    } catch (e) { console.error("intro canvas", e); return null; }
  },

  // फोटो save (download) गर्ने
  downloadImage: function () {
    var r = this._buildCanvas();
    if (!r || !r.cv) { this._imageFallback(); return; }
    var self = this, cv = r.cv;
    var nm = ((r.name || "company").replace(/[^a-zA-Z0-9]+/g, "_")).slice(0, 30) + "_intro.png";
    App.toast("🖼️ Image बन्दैछ...", "info", 1000);
    var save = function (blob) {
      if (!blob) { self._imageFallback(); return; }
      try {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = nm;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        App.toast("✅ फोटो save भयो — अब WhatsApp मा 📎 बाट पठाउनुहोस्", "success", 5000);
      } catch (e) { self._openImageInNewTab(blob); }
    };
    try {
      if (cv.toBlob) cv.toBlob(save, "image/png");
      else { var d = cv.toDataURL("image/png"); var a2 = document.createElement("a"); a2.href = d; a2.download = nm; document.body.appendChild(a2); a2.click(); document.body.removeChild(a2); App.toast("✅ फोटो save भयो", "success", 4000); }
    } catch (e) { self._imageFallback(); }
  },

  // Native Share — फोटो सिधै WhatsApp/अन्य app मा पठाउने (नयाँ फोनमा)
  shareImage: function () {
    var self = this;
    var r = this._buildCanvas();
    if (!r || !r.cv) { this._imageFallback(); return; }
    var cv = r.cv;
    var nm = ((r.name || "company").replace(/[^a-zA-Z0-9]+/g, "_")).slice(0, 30) + "_intro.png";
    var txt = this._textVersion();
    // canvas → blob → File → navigator.share
    var doShare = function (blob) {
      if (!blob) { self.downloadImage(); return; }
      var canShareFiles = false;
      try {
        var testFile = new File([blob], nm, { type: "image/png" });
        canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [testFile] }));
        if (navigator.share && canShareFiles) {
          navigator.share({ files: [testFile], text: txt, title: "Company Introduction" })
            .then(function () { App.toast("✅ पठाइयो", "success", 2000); })
            .catch(function (err) { if (String(err).indexOf("AbortError") < 0) self.downloadImage(); });
          return;
        }
      } catch (e) {}
      // share असम्भव भए — download मा झर्ने
      App.toast("ℹ️ यो फोनमा सिधै share भएन — फोटो save गर्दैछु", "info", 2500);
      self.downloadImage();
    };
    App.toast("📤 Share तयार हुँदैछ...", "info", 1000);
    try {
      if (cv.toBlob) cv.toBlob(doShare, "image/png");
      else self.downloadImage();
    } catch (e) { self.downloadImage(); }
  },

  _openImageInNewTab: function (blob) {
    try {
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      App.toast('📷 फोटो नयाँ tab मा खुल्यो — थिचेर save गर्नुहोस्, अनि WhatsApp मा पठाउनुहोस्', 'info', 6000);
    } catch (e) { this._imageFallback(); }
  },

  _imageFallback: function () {
    App.toast('⚠️ यो browser मा image बनेन — “🖨️ Print / PDF” बाट save गर्नुहोस् वा screenshot लिनुहोस्', 'warning', 6000);
  },

  print: function () {
    var el = document.getElementById('intro-card-print');
    if (!el) return;
    var w = window.open('', '_blank');
    w.document.write('<html><head><title>Company Introduction</title>'
      + '<meta charset="utf-8"><style>@page{margin:0;size:auto;}body{margin:0;padding:24px;background:#fff;display:flex;justify-content:center;}</style>'
      + '</head><body>' + el.outerHTML + '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
  }
};

var Brand = {
  // ── PRODUCT identity (Swagatik) — यो app कै नाम हो, फिक्स।
  //    Purchasing company को नाम (pk3_settings.companyName) अलग हो — त्यो
  //    invoice/quotation/estimate/document मा मात्र देखिन्छ, यहाँ होइन। ──
  PRODUCT: 'Swagatik',
  PRODUCT_NP: 'स्वागतिक',
  TAGLINE: 'Smart Business CRM',

  // product name (चrome को लागि — sidebar/title/login/license)
  name: function () { return this.PRODUCT; },

  apply: function () {
    var P = this.PRODUCT;
    var NP = this.PRODUCT_NP;

    // <title> — clean Latin wordmark
    try { document.title = P + ' — ' + this.TAGLINE; } catch (e) {}

    // sidebar app name (Latin wordmark + small Nepali subtitle)
    var sb = document.getElementById('brand-sidebar-name');
    if (sb) sb.textContent = P;
    // sidebar sub = purchasing company's own name (dynamic from settings)
    var subEl = document.getElementById('sb-company-sub');
    if (subEl) {
      var coName = '';
      try { coName = ((STORE.get('pk3_settings', {}) || {}).companyName || '').trim(); } catch (e) {}
      subEl.textContent = coName || NP;
    }

    // login brand
    var lb = document.getElementById('brand-login-name');
    if (lb) lb.textContent = P;

    // login subtitle (Nepali under the logo)
    var lsub = document.getElementById('brand-login-sub');
    if (lsub) lsub.textContent = NP;

    // license screen header
    var lic = document.getElementById('brand-license-name');
    if (lic) lic.textContent = P;

    // apple web-app title meta
    try {
      var m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (m) m.setAttribute('content', P);
    } catch (e) {}

    // PWA manifest → product name
    try { this.updateManifest(); } catch (e) {}
  },

  updateManifest: function () {
    var link = document.getElementById('pk-manifest');
    if (!link || typeof window.manifest === 'undefined') return;
    if (location.protocol==='http:'||location.protocol==='https:') return;
    window.manifest.name = this.PRODUCT + ' — ' + this.TAGLINE;
    window.manifest.short_name = this.PRODUCT;
    var blob = 'data:application/manifest+json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(window.manifest));
    link.setAttribute('href', blob);
  }
};

