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
  render: function(){
    var src = this.get();
    var img = document.getElementById('set-payqr-img'), ph = document.getElementById('set-payqr-ph'), del = document.getElementById('set-payqr-del');
    if(img){ img.src = src || ''; img.style.display = src ? '' : 'none'; }
    if(ph) ph.style.display = src ? 'none' : '';
    if(del) del.style.display = src ? '' : 'none';
    var t = document.getElementById('set-doc-terms'); if(t && document.activeElement !== t) t.value = this.terms();

    try { PrintFmt.render(); } catch(e){}
  },
  // Resize to max 600px (QR stays sharp & scannable) and store as PNG data URL
  upload: function(event){
    var file = event && event.target && event.target.files && event.target.files[0];
    if(!file) return;
    if(!/^image\//.test(file.type)){ App.toast('Image file मात्र छान्नुस् (PNG/JPG)','error'); return; }
    if(file.size > 10*1024*1024){ App.toast('फोटो धेरै ठूलो छ (max 10MB)','error'); return; }
    var self = this, reader = new FileReader();
    reader.onload = function(e){ self._fromDataUrl(e.target.result); };
    reader.readAsDataURL(file);
    try { event.target.value = ''; } catch(e){}
  },
  _fromDataUrl: function(dataUrl, done){
    var self = this, img = new Image();
    img.onload = function(){
      var max = 600, r = Math.min(max/img.width, max/img.height, 1);
      var c = document.createElement('canvas'); c.width = Math.round(img.width*r); c.height = Math.round(img.height*r);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,c.width,c.height);
      x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
      var out = c.toDataURL('image/png');
      STORE.set('pk3_pay_qr', out);
      self.render();
      try { App.toast('✅ Payment QR सेभ भयो — Quotation / Invoice print मा देखिन्छ','success'); } catch(e){}
      try { Audit.log('SETTINGS','Payment QR updated'); } catch(e){}
      if(done) done(out);
    };
    img.onerror = function(){ App.toast('❌ Image पढ्न सकिएन','error'); };
    img.src = dataUrl;
  },
  remove: function(){
    if(!confirm('Payment QR हटाउने?')) return;
    STORE.del ? STORE.del('pk3_pay_qr') : localStorage.removeItem('pk3_pay_qr');
    this.render();
    App.toast('🗑️ Payment QR हटाइयो','info');
  }
};

