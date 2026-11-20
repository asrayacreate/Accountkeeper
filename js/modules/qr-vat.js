// ─── QR MODULE ────────────────────────────────────────────────
var QR = {
  render: function(){
    // Pre-fill with company contact URL if empty so the page isn't blank
    var inp = document.getElementById('qr-url');
    if(inp && !inp.value){
      var co = STORE.get('pk3_settings',{})||{};
      var phone = (co.phone1||'9855069733').replace(/[^0-9]/g,'');
      // Default to a WhatsApp link for the business
      inp.value = 'https://wa.me/977'+phone;
    }
  },
  generate: function(){
    var url=getVal('qr-url'); if(!url){ App.toast('URL वा text राख्नुस्','error'); return; }
    var wrap=document.getElementById('qr-canvas-wrap'); if(!wrap) return; wrap.innerHTML='';
    if(window.QRCode){ try{new QRCode(wrap,{text:url,width:180,height:180});}catch(e){wrap.innerHTML='<div>QR generated for: '+url+'</div>';} }
    else {
      // Fallback: use a public QR image API
      var img=document.createElement('img');
      img.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(url);
      img.alt='QR Code'; img.style.cssText='width:180px;height:180px;border-radius:8px;background:#fff;padding:8px;';
      img.onerror=function(){ wrap.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);">QR: '+esc(url)+'</div>'; };
      wrap.appendChild(img);
    }
    App.toast('✅ QR generated!','success');
  },
  startScan: function(){ App.toast('📷 Scanner — browser camera needed','info'); },
  stopScan: function(){}
};

// ─── VAT CALCULATOR MODULE (v4.5) ─────────────────────────────────
// Two clear modes:
//   add  → रकममा VAT थपिन्छ  (5000 → +650 → 5650)
//   incl → रकमभित्रै VAT छ, निकालिन्छ (5000 भित्रै → शुद्ध 4424.78 + VAT 575.22)
var VatCalc = {
  _mode: 'add',

  render: function(){
    this.setMode(this._mode || 'add');
  },

  _rate: function(){
    var r = parseFloat(getVal('vc2-rate'));
    return (isNaN(r) || r < 0) ? 0 : r;
  },

  setRate: function(r){
    setVal('vc2-rate', r);
    this.calc();
  },

  setMode: function(mode){
    this._mode = mode;
    var addBtn = document.getElementById('vc2-mode-add');
    var inclBtn = document.getElementById('vc2-mode-incl');
    if(addBtn)  addBtn.className  = 'btn ' + (mode==='add'  ? 'btn-primary' : 'btn-secondary');
    if(inclBtn) inclBtn.className = 'btn ' + (mode==='incl' ? 'btn-primary' : 'btn-secondary');
    // Re-apply the inline padding lost by className swap
    [addBtn, inclBtn].forEach(function(b){ if(b){ b.style.padding='12px 8px'; b.style.fontWeight='800'; b.style.fontSize='0.86rem'; b.style.lineHeight='1.3'; } });
    var lbl = document.getElementById('vc2-amt-label');
    var amt = document.getElementById('vc2-amt');
    var hint = document.getElementById('vc2-hint');
    if(mode === 'add'){
      if(lbl) lbl.textContent = '💵 रकम (VAT बिनाको)';
      if(amt) amt.placeholder = 'जस्तै: 5000';
      if(hint) hint.innerHTML = '➕ <b>VAT थप्ने:</b> हजुरको रकम VAT <b>बिनाको</b> हो। जस्तै 5000 हाल्दा → VAT 650 थपिएर जम्मा <b>Rs 5,650</b> हुन्छ।';
    } else {
      if(lbl) lbl.textContent = '📦 रकम (VAT भित्रै समावेश)';
      if(amt) amt.placeholder = 'जस्तै: 5000 (भित्रै VAT)';
      if(hint) hint.innerHTML = '📦 <b>VAT भित्रै:</b> हजुरको रकम<b>भित्रै VAT समावेश</b> छ। जस्तै 5000 हाल्दा → शुद्ध मूल्य <b>Rs 4,424.78</b> + VAT <b>Rs 575.22</b> = 5000 (बिल बनाउन शुद्ध रकम चाहिन्छ भने यही mode)।';
    }
    this.calc();
  },

  _values: function(){
    var r = this._rate();
    var amt = parseFloat(getVal('vc2-amt'));
    if(isNaN(amt) || amt <= 0) return null;
    var f = r / 100;
    var pre, vat, total;
    if(this._mode === 'incl'){
      total = amt;
      pre = f > 0 ? amt / (1 + f) : amt;
      vat = total - pre;
    } else {
      pre = amt;
      vat = amt * f;
      total = pre + vat;
    }
    return {rate:r, pre:Math.round(pre*100)/100, vat:Math.round(vat*100)/100, total:Math.round(total*100)/100};
  },

  calc: function(){
    var box = document.getElementById('vc2-breakdown');
    if(!box) return;
    var v = this._values();
    if(!v){
      box.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:26px 10px;"><div style="font-size:2rem;margin-bottom:6px;">🧮</div><div style="font-size:0.82rem;">माथि रकम हाल्नुस्</div></div>';
      return;
    }
    var modeTag = this._mode === 'incl'
      ? '<span style="font-size:0.66rem;background:rgba(168,85,247,0.15);color:var(--accent);padding:2px 8px;border-radius:10px;font-weight:700;">📦 VAT भित्रै</span>'
      : '<span style="font-size:0.66rem;background:rgba(34,197,94,0.15);color:var(--green);padding:2px 8px;border-radius:10px;font-weight:700;">➕ VAT थपिएको</span>';
    box.innerHTML =
      '<div style="margin-bottom:8px;">'+modeTag+'</div>'
      + '<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:0.88rem;"><span style="color:var(--text-muted);">शुद्ध मूल्य (VAT बिना)</span><b>'+fmtRs(v.pre)+'</b></div>'
      + '<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:0.88rem;"><span style="color:var(--text-muted);">VAT ('+v.rate+'%)</span><b style="color:#eab308;">'+(this._mode==='incl'?'भित्रै ':'+ ')+fmtRs(v.vat)+'</b></div>'
      + '<div style="display:flex;justify-content:space-between;padding:12px 0;font-size:1.05rem;"><span style="font-weight:700;">जम्मा (VAT सहित)</span><b style="color:var(--green);font-size:1.25rem;">'+fmtRs(v.total)+'</b></div>';
  },

  clear: function(){
    setVal('vc2-amt','');
    setVal('vc2-rate','13');
    this.setMode('add');
  },

  _summaryText: function(){
    var v = this._values();
    if(!v) return '🧮 VAT Calculator — रकम हालिएको छैन';
    var modeLine = this._mode === 'incl' ? '(रकमभित्रै VAT समावेश)' : '(रकममा VAT थपिएको)';
    return '🧮 VAT Calculation (Nepal '+v.rate+'%)\n'
      + modeLine + '\n'
      + '━━━━━━━━━━━━━━━\n'
      + 'शुद्ध मूल्य: '+fmtRs(v.pre)+'\n'
      + 'VAT ('+v.rate+'%): '+fmtRs(v.vat)+'\n'
      + 'जम्मा: '+fmtRs(v.total)+'\n'
      + '— PRERAK MULTIPURPOSE PVT LTD';
  },

  copyAll: function(){
    var t = this._summaryText();
    if(navigator.clipboard) navigator.clipboard.writeText(t);
    App.toast('📋 Copy भयो','success',1500);
  },

  shareWA: function(){
    var t = this._summaryText();
    if(typeof Wa !== 'undefined' && Wa.send) Wa.send('', t, {silent:true}) || window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');
    else window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');
  }
}

