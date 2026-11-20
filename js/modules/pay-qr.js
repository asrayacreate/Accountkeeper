// ═══════════════════════════════════════════════════════════════════
// v6.9.0 MODULES
//   • DocPrint     — professional Quotation / Invoice / Estimate print & PDF
//                    (company header, PAN/VAT, BS + AD date, items, totals,
//                    Terms & Conditions, Payment QR)
//   • PayQR        — Payment QR image (eSewa / Fonepay / Bank) in Settings
//   • QuoteConvert — 1-click Quotation / Estimate → Invoice (Sale) + Ledger
//   • Projects     — Project / Site progress & profit tracker
// ═══════════════════════════════════════════════════════════════════

function _bsFromAd(iso){
  try { var p = String(iso||'').slice(0,10).split('-'); var b = adToBs(parseInt(p[0],10), parseInt(p[1],10), parseInt(p[2],10));
    return b.y+'-'+String(b.m).padStart(2,'0')+'-'+String(b.d).padStart(2,'0'); } catch(e){ return ''; }
}

// ─── PAYMENT QR + DEFAULT TERMS (Settings) ───────────────────────────
var PayQR = {
  get: function(){ return STORE.get('pk3_pay_qr', '') || ''; },
  terms: function(){ return STORE.get('pk3_doc_terms', '') || ''; },
  saveTerms: function(){ STORE.set('pk3_doc_terms', (getVal('set-doc-terms')||'').trim()); },
  // v7.1.0: picked QR is shown at once as a preview and kept here until the
  // user presses "💾 QR सेभ गर्नुहोस्" (or Save Payment Details / leaves Settings).
  _pending: null,
  MAX_SIDE: 600,          // px — QR stays sharp & scannable
  MAX_BYTES: 220*1024,    // data URL budget so localStorage / sync never chokes
  _status: function(msg, kind){
    var el = document.getElementById('set-payqr-status'); if(!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'ok' ? 'var(--green, #16a34a)' : kind === 'warn' ? '#d97706' : kind === 'err' ? 'var(--red, #dc2626)' : 'var(--text-muted)';
  },
  render: function(){
    var saved = this.get(), pend = this._pending, src = pend || saved;
    var $ = function(id){ return document.getElementById(id); };
    var img = $('set-payqr-img'), ph = $('set-payqr-ph'), del = $('set-payqr-del');
    if(img){ if(src){ if(img.getAttribute('src') !== src) img.src = src; } else img.removeAttribute('src'); img.style.display = src ? '' : 'none'; }
    if(ph) ph.style.display = src ? 'none' : '';
    if(del) del.style.display = (saved && !pend) ? '' : 'none';
    var show = function(id, on){ var e = $(id); if(e) e.style.display = on ? '' : 'none'; };
    show('set-payqr-save', !!pend); show('set-payqr-cancel', !!pend); show('set-payqr-badge', !!pend);
    var frame = $('set-payqr-frame'); if(frame) frame.style.borderColor = pend ? '#f59e0b' : (saved ? '#16a34a' : '');
    var pick = $('set-payqr-pick'); if(pick) pick.textContent = (src ? '🔄 अर्को QR छान्नुहोस्' : '📤 QR फोटो छान्नुहोस्');
    if(pend) this._status('👆 प्रिभ्यू ठीक छ भने "💾 QR सेभ गर्नुहोस्" थिच्नुहोस् ('+this._kb(pend)+')', 'warn');
    else if(saved) this._status('✅ QR सेभ भएको छ — Print, PDF र PNG बिलमा देखिन्छ', 'ok');
    else this._status('');
    var t = $('set-doc-terms'); if(t && document.activeElement !== t) t.value = this.terms();

    try { PrintFmt.render(); } catch(e){}
  },
  _kb: function(dataUrl){ return Math.max(1, Math.round(String(dataUrl||'').length*0.75/1024)) + ' KB'; },
  upload: function(event){
    var input = event && event.target, file = input && input.files && input.files[0];
    if(!file) return;
    try { input.value = ''; } catch(e){}
    var self = this;
    if(file.type && !/^image\//.test(file.type)){ self._status('❌ Image file मात्र छान्नुहोस् (PNG / JPG)', 'err'); App.toast('Image file मात्र छान्नुस् (PNG/JPG)','error'); return; }
    if(file.size > 30*1024*1024){ self._status('❌ फोटो धेरै ठूलो छ (max 30MB)', 'err'); App.toast('फोटो धेरै ठूलो छ (max 30MB)','error'); return; }
    self._status('⏳ QR तयार हुँदैछ…', 'warn');
    return self._compress(file).then(function(out){
      self._pending = out;
      self.render();
      return out;
    }, function(){
      self._pending = null; self.render();
      self._status('❌ यो फोटो पढ्न सकिएन (HEIC जस्तो फर्म्याट हुन सक्छ) — PNG/JPG वा QR को screenshot छान्नुहोस्', 'err');
      try { App.toast('❌ QR फोटो पढ्न सकिएन — PNG/JPG छान्नुहोस्','error'); } catch(e){}
    });
  },
  _decode: function(blobOrUrl){
    return new Promise(function(res, rej){
      var url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl), img = new Image();
      var done = function(){ if(typeof blobOrUrl !== 'string') try { URL.revokeObjectURL(url); } catch(e){} };
      img.onload = function(){ done(); (img.naturalWidth && img.naturalHeight) ? res(img) : rej(new Error('empty')); };
      img.onerror = function(){ done(); rej(new Error('decode')); };
      img.src = url;
    });
  },
  // Any size photo / screenshot → white-backed data URL ≤ MAX_SIDE px and ≤ MAX_BYTES.
  // PNG first (crisp); a big camera photo falls back to high-quality JPEG.
  _compress: function(src){
    var self = this;
    return this._decode(src).then(function(img){
      var draw = function(side){
        var r = Math.min(side/img.naturalWidth, side/img.naturalHeight, 1);
        var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth*r)); c.height = Math.max(1, Math.round(img.naturalHeight*r));
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,c.width,c.height);
        x.imageSmoothingEnabled = true; try { x.imageSmoothingQuality = 'high'; } catch(e){}
        x.drawImage(img, 0, 0, c.width, c.height);
        return c;
      };
      var c = draw(self.MAX_SIDE), out = c.toDataURL('image/png');
      var tries = [[self.MAX_SIDE, 0.92], [self.MAX_SIDE, 0.85], [480, 0.85], [400, 0.8]];
      for(var i = 0; i < tries.length && out.length > self.MAX_BYTES; i++){
        if(tries[i][0] !== c.width && tries[i][0] !== c.height) c = draw(tries[i][0]);
        out = c.toDataURL('image/jpeg', tries[i][1]);
      }
      return out;
    });
  },
  save: function(){
    var out = this._pending;
    if(!out){ this.render(); return !!this.get(); }
    var ok = STORE.set('pk3_pay_qr', out) !== false && this.get() === out;
    if(!ok){
      this.render();
      this._status('❌ सेभ भएन — फोन/ब्राउजरको storage भरिएको हुन सक्छ। Backup लिएर पुराना फोटो/डाटा हटाएर फेरि प्रयास गर्नुहोस्।', 'err');
      try { App.toast('❌ QR सेभ भएन — storage भरिएको हुन सक्छ','error'); } catch(e){}
      return false;
    }
    this._pending = null;
    this.render();
    try { App.toast('✅ Payment QR सेभ भयो — Quotation / Invoice print र PNG मा देखिन्छ','success'); } catch(e){}
    try { Audit.log('SETTINGS','Payment QR updated'); } catch(e){}
    return true;
  },
  cancel: function(){ this._pending = null; this.render(); },
  hasPending: function(){ return !!this._pending; },
  // Kept for older callers: compress + save straight away.
  _fromDataUrl: function(dataUrl, done){
    var self = this;
    return this._compress(dataUrl).then(function(out){ self._pending = out; self.save(); if(done) done(out); return out; },
      function(){ try { App.toast('❌ Image पढ्न सकिएन','error'); } catch(e){} });
  },
  remove: function(){
    if(!confirm('Payment QR हटाउने?')) return;
    STORE.del ? STORE.del('pk3_pay_qr') : localStorage.removeItem('pk3_pay_qr');
    this._pending = null;
    this.render();
    App.toast('🗑️ Payment QR हटाइयो','info');
  }
};

