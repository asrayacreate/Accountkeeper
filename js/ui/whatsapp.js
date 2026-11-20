// ═══════════════ UNIVERSAL WHATSAPP OPENER (v4.0.8) ═══════════════
// Single source of truth for opening WhatsApp. Handles:
//   • Phone cleanup (digits only, auto-prefix 977 if 10-digit)
//   • Popup-blocker detection — shows clear error if blocked
//   • Empty/invalid input — clear error message
//   • Optional URL copy fallback when popup blocked
window.Wa = {
  cleanPhone: function(phone){
    if(!phone) return '';
    var p = String(phone).replace(/[^0-9]/g, '');
    if(!p) return '';
    // Strip a leading 977 country code if it's followed by 10 digits (avoids 977977…)
    if(p.length === 13 && p.indexOf('977') === 0) p = p.slice(3);
    // 10-digit Nepali number → add country code
    if(p.length === 10) p = '977' + p;
    return p;
  },
  buildUrl: function(phone, msg){
    var p = this.cleanPhone(phone);
    var url = 'https://wa.me/' + p;
    if(msg) url += '?text=' + encodeURIComponent(msg);
    return url;
  },
  // Opens WhatsApp for a single recipient. Returns true on success.
  send: function(phone, msg, opts){
    opts = opts || {};
    if(!phone){
      if(!opts.silent) App.toast('❌ Phone number चाहिन्छ','error');
      return false;
    }
    var cleaned = this.cleanPhone(phone);
    if(!cleaned || cleaned.length < 10){
      if(!opts.silent) App.toast('❌ Phone number गलत छ: '+phone,'error');
      return false;
    }
    var url = this.buildUrl(phone, msg);
    var w;
    try { w = window.open(url, '_blank'); } catch(e){ w = null; }
    if(!w || w.closed || typeof w.closed === 'undefined'){
      // Popup blocked — offer clipboard fallback
      try {
        if(navigator.clipboard) navigator.clipboard.writeText(url);
      } catch(e){}
      if(!opts.silent){
        App.toast('⚠️ Popup blocked — link copy गरियो, paste गरेर खोल्नुस्','warning',5500);
      }
      return false;
    }
    if(!opts.silent && !opts.quiet) App.toast('📱 WhatsApp opening...','success',1500);
    return true;
  },
  // Bulk send with user confirmation. Each click of "Next" sends ONE message
  // — keeps every send tied to a real user gesture so popups aren't blocked.
  bulkSend: function(recipients, msgFn, opts){
    opts = opts || {};
    if(!recipients || !recipients.length){
      App.toast('कुनै recipient छैन','error');
      return;
    }
    var valid = recipients.filter(function(r){ return Wa.cleanPhone(r.phone||r); });
    if(!valid.length){
      App.toast('कुनै valid phone number छैन','error');
      return;
    }
    // Build modal: shows queue + Next button + Skip/Copy
    var existing = document.getElementById('wa-bulk-modal');
    if(existing) existing.remove();
    var m = document.createElement('div');
    m.id = 'wa-bulk-modal';
    m.className = 'modal-overlay open';
    var heading = opts.title || '📱 Bulk WhatsApp';
    var subtitle = valid.length + ' recipients — Next button थिच्दा एक एक गरी खुल्नेछ';
    m.innerHTML =
      '<div class="modal" style="max-width:480px;">'
        +'<div class="modal-head">'
          +'<div>'
            +'<div class="modal-title">'+heading+'</div>'
            +'<div class="modal-sub" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">'+subtitle+'</div>'
          +'</div>'
          +'<button class="modal-close" onclick="Wa._bulkClose()">✕</button>'
        +'</div>'
        +'<div id="wa-bulk-progress" style="background:var(--surface-2);border-radius:8px;padding:14px;margin-bottom:12px;text-align:center;"></div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap;">'
          +'<button class="btn btn-secondary" onclick="Wa._bulkClose()">Close</button>'
          +'<button id="wa-bulk-skip-btn" class="btn btn-secondary" onclick="Wa._bulkSkip()">Skip ⏭</button>'
          +'<button id="wa-bulk-next-btn" class="btn btn-wa" style="flex:1;" onclick="Wa._bulkNext()">📱 Send Next</button>'
        +'</div>'
      +'</div>';
    document.body.appendChild(m);
    Wa._bulk = { list: valid, idx: 0, msgFn: msgFn, sent: 0, skipped: 0 };
    Wa._bulkRender();
  },
  _bulkRender: function(){
    var st = Wa._bulk; if(!st) return;
    var prog = document.getElementById('wa-bulk-progress');
    var nextBtn = document.getElementById('wa-bulk-next-btn');
    if(!prog) return;
    if(st.idx >= st.list.length){
      prog.innerHTML = '<div style="font-size:1rem;font-weight:700;color:var(--green);">✅ Done!</div>'
        + '<div style="font-size:0.78rem;margin-top:5px;color:var(--text-muted);">Sent: '+st.sent+' • Skipped: '+st.skipped+'</div>';
      if(nextBtn){ nextBtn.textContent = '✅ Close'; nextBtn.onclick = function(){ Wa._bulkClose(); }; }
      var skip = document.getElementById('wa-bulk-skip-btn'); if(skip) skip.style.display='none';
      return;
    }
    var r = st.list[st.idx];
    var name = r.name || r.custName || '';
    var phone = r.phone || r.custPhone || r;
    prog.innerHTML = '<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:5px;">'+(st.idx+1)+' / '+st.list.length+'</div>'
      + '<div style="font-size:1.02rem;font-weight:700;margin-bottom:3px;">'+esc(name||phone)+'</div>'
      + (name?'<div style="font-size:0.78rem;color:var(--text-muted);">📞 '+esc(phone)+'</div>':'')
      + '<div style="margin-top:8px;font-size:0.7rem;color:var(--text-muted);">Sent: '+st.sent+' • Skipped: '+st.skipped+'</div>';
  },
  _bulkNext: function(){
    var st = Wa._bulk; if(!st) return;
    if(st.idx >= st.list.length){ Wa._bulkClose(); return; }
    var r = st.list[st.idx];
    var phone = r.phone || r.custPhone || r;
    var msg = (typeof st.msgFn === 'function') ? st.msgFn(r) : (st.msgFn || '');
    var ok = Wa.send(phone, msg, {quiet:true});
    if(ok) st.sent++; else st.skipped++;
    st.idx++;
    Wa._bulkRender();
  },
  _bulkSkip: function(){
    var st = Wa._bulk; if(!st) return;
    st.skipped++; st.idx++;
    Wa._bulkRender();
  },
  _bulkClose: function(){
    Wa._bulk = null;
    var m = document.getElementById('wa-bulk-modal');
    if(m) m.remove();
  }
};

