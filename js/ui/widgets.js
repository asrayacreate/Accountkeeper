
function fmtK(n){
  n = parseFloat(n)||0;
  if(n>=100000) return (n/100000).toFixed(1)+'L';
  if(n>=1000)   return (n/1000).toFixed(0)+'K';
  return n.toFixed(0);
}

var BSCal = {
  _year: 0, _month: 0,
  init: function(){
    var today = todayBS().split('-');
    this._year = parseInt(today[0]||2083);
    this._month = parseInt(today[1]||1);
    this.render();
  },
  render: function(){
    var el = document.getElementById('bscal-grid');
    if(!el) return;
    this._populateSelects();
    // Show today's AD device date as a small subtitle
    var devEl = document.getElementById('bscal-device-date');
    if(devEl){
      var nowAd = new Date();
      var adStr = nowAd.toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
      devEl.textContent = '🌐 ' + adStr;
    }
    var _bsRow = BS_MONTHS_DATA[this._year - 2000];
    var days = (_bsRow && _bsRow[this._month]) ? _bsRow[this._month] : 30;
    var todayBS_ = todayBS();
    // ── COMPACT MODE (v4.0.3): smaller cells, tighter padding ──
    var inFullModal = !!document.querySelector('#bscal-full-modal.open');
    var cellSize = inFullModal ? '40px' : '28px';
    var fontSize = inFullModal ? '0.95rem' : '0.7rem';
    var headFontSize = inFullModal ? '0.78rem' : '0.6rem';
    var cellPad = inFullModal ? '8px 0' : '4px 0';
    var gap = inFullModal ? '4px' : '2px';
    var headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:'+gap+';margin-bottom:2px;">';
    headers.forEach(function(h, i){
      var color = i===0 ? 'var(--red)' : (i===6 ? 'var(--blue)' : 'var(--text-muted)');
      html += '<div style="font-size:'+headFontSize+';font-weight:700;text-align:center;padding:3px 0;color:'+color+';letter-spacing:0.2px;">'+h+'</div>';
    });
    html += '</div>';
    // Get first weekday for this BS month (using AD conversion)
    var ad = bsToAd(this._year, this._month, 1);
    var firstDow = ad ? ad.getDay() : 0;
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:'+gap+';">';
    // Empty cells before day 1
    for(var i=0; i<firstDow; i++){ html += '<div></div>'; }
    // Day cells
    for(var d=1; d<=days; d++){
      var key = this._year+'-'+(this._month<10?'0':'')+this._month+'-'+(d<10?'0':'')+d;
      var isToday = key === todayBS_;
      var dow = (firstDow + d - 1) % 7;
      var dayColor = dow===0 ? 'var(--red)' : (dow===6 ? 'var(--blue)' : 'var(--text)');
      var style = 'cursor:pointer;text-align:center;padding:'+cellPad+';border-radius:5px;font-size:'+fontSize+';font-weight:600;transition:all 0.15s;line-height:1;min-height:'+cellSize+';display:flex;align-items:center;justify-content:center;';
      if(isToday){
        style += 'background:var(--accent);color:#fff;font-weight:800;box-shadow:0 1px 4px var(--accent-glow);';
      } else {
        style += 'color:'+dayColor+';background:var(--surface-2);';
      }
      html += '<div onclick="BSCal.selectDay(\''+key+'\')" '
            + (isToday ? 'data-today="1" ' : '')
            + 'style="'+style+'">'+d+'</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  },
  prev: function(){ this._month--; if(this._month<1){ this._month=12; this._year--; } this.render(); this._renderFull(); },
  next: function(){ this._month++; if(this._month>12){ this._month=1; this._year++; } this.render(); this._renderFull(); },
  selectDay: function(date){
    if(window.showToast) showToast('📅 Selected: '+date,'info');
    else if(window.App && App.toast) App.toast('📅 Selected: '+date,'info');
  },
  goToday: function(){
    var t = todayBs().split('-');
    this._year=parseInt(t[0]); this._month=parseInt(t[1]);
    this.render(); this._renderFull();
  },
  prevYear: function(){ this._year--; this.render(); this._renderFull(); },
  nextYear: function(){ this._year++; this.render(); this._renderFull(); },
  jumpTo: function(){
    var mSel = document.getElementById('bscal-month-sel');
    var ySel = document.getElementById('bscal-year-sel');
    if(mSel && mSel.value) this._month = parseInt(mSel.value);
    if(ySel && ySel.value) this._year  = parseInt(ySel.value);
    this.render(); this._renderFull();
  },
  // ── FULL CALENDAR (v4.0.3): opens a large modal version ──
  openFull: function(){
    var m = document.getElementById('bscal-full-modal');
    if(!m){ this._buildFullModal(); m = document.getElementById('bscal-full-modal'); }
    m.classList.add('open');
    this._renderFull();
  },
  closeFull: function(){
    var m = document.getElementById('bscal-full-modal');
    if(m) m.classList.remove('open');
  },
  _buildFullModal: function(){
    var m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'bscal-full-modal';
    m.innerHTML =
      '<div class="modal" style="max-width:520px;">'
      +'<div class="modal-head">'
        +'<div class="modal-title">📅 Nepali Calendar (Full View)</div>'
        +'<button class="modal-close" onclick="BSCal.closeFull()">✕</button>'
      +'</div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;gap:6px;flex-wrap:wrap;">'
        +'<div style="display:flex;gap:4px;">'
          +'<button onclick="BSCal.prevYear()" class="btn btn-sm btn-secondary" style="padding:5px 10px;">«</button>'
          +'<button onclick="BSCal.prev()" class="btn btn-sm btn-secondary" style="padding:5px 10px;">◀</button>'
        +'</div>'
        +'<div id="bscal-full-title" style="font-weight:800;font-size:1rem;color:var(--accent);"></div>'
        +'<div style="display:flex;gap:4px;">'
          +'<button onclick="BSCal.next()" class="btn btn-sm btn-secondary" style="padding:5px 10px;">▶</button>'
          +'<button onclick="BSCal.nextYear()" class="btn btn-sm btn-secondary" style="padding:5px 10px;">»</button>'
        +'</div>'
      +'</div>'
      +'<div id="bscal-full-grid" style="padding:6px 4px;"></div>'
      +'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">'
        +'<button onclick="BSCal.goToday()" class="btn btn-sm btn-primary">📅 आज</button>'
        +'<button onclick="BSCal.closeFull()" class="btn btn-sm btn-secondary">Close</button>'
      +'</div>'
      +'</div>';
    document.body.appendChild(m);
  },
  _renderFull: function(){
    var grid = document.getElementById('bscal-full-grid');
    var title = document.getElementById('bscal-full-title');
    if(!grid) return;
    if(title){
      var monthName = (typeof BS_MONTHS!=='undefined' && BS_MONTHS[this._month-1]) ? BS_MONTHS[this._month-1] : ('Month '+this._month);
      title.textContent = monthName + ' ' + this._year;
    }
    // Reuse render logic by temporarily redirecting target
    // Render into the full grid: replicate the same drawing but bigger
    var _bsRow = BS_MONTHS_DATA[this._year - 2000];
    var days = (_bsRow && _bsRow[this._month]) ? _bsRow[this._month] : 30;
    var todayBS_ = todayBS();
    var headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:4px;">';
    headers.forEach(function(h, i){
      var color = i===0 ? 'var(--red)' : (i===6 ? 'var(--blue)' : 'var(--text-muted)');
      html += '<div style="font-size:0.78rem;font-weight:700;text-align:center;padding:6px 0;color:'+color+';">'+h+'</div>';
    });
    html += '</div>';
    var ad = bsToAd(this._year, this._month, 1);
    var firstDow = ad ? ad.getDay() : 0;
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;">';
    for(var i=0; i<firstDow; i++){ html += '<div></div>'; }
    for(var d=1; d<=days; d++){
      var key = this._year+'-'+(this._month<10?'0':'')+this._month+'-'+(d<10?'0':'')+d;
      var isToday = key === todayBS_;
      var dow = (firstDow + d - 1) % 7;
      var dayColor = dow===0 ? 'var(--red)' : (dow===6 ? 'var(--blue)' : 'var(--text)');
      var style = 'cursor:pointer;text-align:center;padding:10px 0;border-radius:8px;font-size:0.95rem;font-weight:600;min-height:40px;display:flex;align-items:center;justify-content:center;';
      style += isToday ? 'background:var(--accent);color:#fff;font-weight:800;box-shadow:0 2px 8px var(--accent-glow);'
                       : 'color:'+dayColor+';background:var(--surface-2);';
      html += '<div onclick="BSCal.selectDay(\''+key+'\')" style="'+style+'">'+d+'</div>';
    }
    html += '</div>';
    grid.innerHTML = html;
  },
  _populateSelects: function(){
    var mSel = document.getElementById('bscal-month-sel');
    var ySel = document.getElementById('bscal-year-sel');
    if(mSel && !mSel.options.length){
      BS_MONTHS.forEach(function(m,i){ var o=document.createElement('option'); o.value=i+1; o.text=m; mSel.appendChild(o); });
    }
    if(mSel) mSel.value = this._month;
    if(ySel){
      if(!ySel.options.length){ for(var y=2070;y<=2090;y++){ var o=document.createElement('option'); o.value=y; o.text=y; ySel.appendChild(o); } }
      ySel.value = this._year;
    }
  }
};

var CRMClock = {
  _timer: null,
  init: function(){
    this.tick();
    this._timer = setInterval(function(){ CRMClock.tick(); }, 1000);
  },
  tick: function(){
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    var ampm = h>=12?'PM':'AM';
    h = h%12||12;
    var str = (h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s+' '+ampm;
    var el = document.getElementById('crm-clock');
    if(el) el.textContent = str;
    var el2 = document.getElementById('sidebar-clock');
    if(el2) el2.textContent = str;
  },
  destroy: function(){ if(this._timer){ clearInterval(this._timer); this._timer=null; } }
};

// ============================================================
// JS PART N: BSPicker, CRMCalc, Photo, DragWidget, LangToggle, Greet
// ============================================================

var BSPicker = {
  _target: null,
  _title: '',
  _year: 0,
  _month: 0,

  open: function(targetId, title) {
    this._target = targetId;
    this._title = title || '📅 मिति छान्नुस्';
    // Init year/month from existing value or today
    var today = todayBs().split('-');
    var existing = document.getElementById(targetId);
    var existingVal = existing ? existing.value : '';
    if (existingVal && /^\d{4}-\d{2}-\d{2}$/.test(existingVal)) {
      var parts = existingVal.split('-');
      this._year = parseInt(parts[0]);
      this._month = parseInt(parts[1]);
    } else {
      this._year = parseInt(today[0]);
      this._month = parseInt(today[1]);
    }
    var titleEl = document.getElementById('bs-picker-title');
    if (titleEl) titleEl.textContent = this._title;
    var ov = document.getElementById('bs-picker-overlay');
    if (ov) { ov.style.display = 'flex'; }
    this._buildSelects();
    this._renderGrid();
  },

  close: function() {
    var ov = document.getElementById('bs-picker-overlay');
    if (ov) ov.style.display = 'none';
    this._target = null;
  },

  _overlayClick: function(e) {
    if (e.target === document.getElementById('bs-picker-overlay')) this.close();
  },

  _buildSelects: function() {
    var mSel = document.getElementById('bs-picker-month-sel');
    var ySel = document.getElementById('bs-picker-year-sel');
    if (mSel) {
      mSel.innerHTML = '';
      BS_MONTHS.forEach(function(m, i) {
        var o = document.createElement('option'); o.value = i+1; o.textContent = m;
        mSel.appendChild(o);
      });
      mSel.value = this._month;
    }
    if (ySel) {
      ySel.innerHTML = '';
      for (var y = 2070; y <= 2090; y++) {
        var o = document.createElement('option'); o.value = y; o.textContent = y;
        ySel.appendChild(o);
      }
      ySel.value = this._year;
    }
  },

  _jumpToSel: function() {
    var mSel = document.getElementById('bs-picker-month-sel');
    var ySel = document.getElementById('bs-picker-year-sel');
    if (mSel && mSel.value) this._month = parseInt(mSel.value);
    if (ySel && ySel.value) this._year = parseInt(ySel.value);
    this._renderGrid();
  },

  _renderGrid: function() {
    var el = document.getElementById('bs-picker-grid');
    if (!el) return;
    var _bsRow = BS_MONTHS_DATA[this._year - 2000]; var days = (_bsRow && _bsRow[this._month]) ? _bsRow[this._month] : 30;
    var ad = bsToAd(this._year, this._month, 1);
    var firstDow = ad ? ad.getDay() : 0;
    var todayKey = todayBs();
    var target = this._target;
    var existing = document.getElementById(target);
    var existingVal = existing ? existing.value : '';

    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d, i) {
      html += '<div style="font-size:0.68rem;font-weight:700;padding:4px 0;color:'+(i===0?'var(--red)':i===6?'var(--blue)':'var(--text-muted)')+';">'+d+'</div>';
    });
    for (var i = 0; i < firstDow; i++) html += '<div></div>';
    for (var d = 1; d <= days; d++) {
      var key = this._year + '-' + (this._month<10?'0':'') + this._month + '-' + (d<10?'0':'') + d;
      var isToday = key === todayKey;
      var isSel   = key === existingVal;
      var dayOfWeek = (firstDow + d - 1) % 7;
      var dayColor  = dayOfWeek === 0 ? 'var(--red)' : dayOfWeek === 6 ? 'var(--blue)' : 'var(--text)';
      html += '<div onclick="BSPicker._pick(\''+key+'\')" style="cursor:pointer;padding:5px 2px;border-radius:6px;font-size:0.82rem;'
        + (isSel ? 'background:var(--accent);color:#fff;font-weight:700;'
           : isToday ? 'background:rgba(124,58,237,0.15);font-weight:700;color:var(--accent);'
           : 'color:'+dayColor+';')
        + '">'+d+'</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  },

  _prev: function() {
    this._month--;
    if (this._month < 1) { this._month = 12; this._year--; }
    var mSel = document.getElementById('bs-picker-month-sel');
    var ySel = document.getElementById('bs-picker-year-sel');
    if (mSel) mSel.value = this._month;
    if (ySel) ySel.value = this._year;
    this._renderGrid();
  },

  _next: function() {
    this._month++;
    if (this._month > 12) { this._month = 1; this._year++; }
    var mSel = document.getElementById('bs-picker-month-sel');
    var ySel = document.getElementById('bs-picker-year-sel');
    if (mSel) mSel.value = this._month;
    if (ySel) ySel.value = this._year;
    this._renderGrid();
  },

  _pick: function(bsDate) {
    // 1. Set hidden input
    if (this._target) {
      var el = document.getElementById(this._target);
      if (el) el.value = bsDate;
      // 2. Update visible text span (display as DD/MM/YYYY BS)
      var textEl = document.getElementById(this._target + '-text');
      if (textEl) {
        var _dp = bsDate.split('-');
        var _disp = _dp.length === 3 ? _dp[2]+'/'+_dp[1]+'/'+_dp[0] : bsDate;
        textEl.textContent = _disp;
        textEl.style.color = 'var(--text)';
      }
      // 3. Mark display div as having value
      var dispEl = document.getElementById(this._target + '-disp');
      if (dispEl) dispEl.classList.add('has-value');
      // 4. Also set BS companion if present
      var bsEl = document.getElementById(this._target + '-bs');
      if (bsEl) bsEl.value = bsDate;
      // 5. Convert to AD and set if there's an AD field
      try {
        var parts = bsDate.split('-');
        var adDate = bsToAd(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
        if (adDate) {
          var adStr = adDate.toISOString().slice(0, 10);
          var adEl = document.getElementById(this._target + '-ad');
          if (adEl) adEl.value = adStr;
          // If the target itself is an AD-format date field, set it too
          if (this._target === 'db-date-inp' || this._target === 'est-date') {
            if (el) el.value = adStr;
          }
        }
      } catch(e) {}
    }
    App.toast('📅 ' + bsDate, 'success', 1500);
    this.close();
  },

  _pickToday: function() {
    this._pick(todayBs());
  },

  init: function() {
    window.BSPicker = this;
    // Expose close on overlay for keyboard ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { BSPicker.close(); }
    });
  }
};

var CRMCalc = {
  _expr: '',
  _display: function(){
    var el = document.getElementById('calc-display');
    if(el){
      // calc-display is a <div> — use textContent (value only works on inputs)
      if('value' in el && el.tagName==='INPUT') el.value = this._expr||'0';
      else el.textContent = this._expr||'0';
    }
  },
  _safeEval: function(expr){
    // Allow only digits, operators, decimal point, and parentheses
    var clean = String(expr).replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
    if(!/^[\d+\-*/.()\s%]*$/.test(clean)) throw new Error('Invalid');
    // Convert standalone "%" into "/100" (e.g. 50%2 → 50/100*2 is unusual; here we treat
    // "X%" as percent of total; safest: convert "%" before operator into "/100*")
    clean = clean.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
    // Use Function constructor in strict mode (no access to outer scope vars)
    var result = (new Function('"use strict"; return ('+clean+')'))();
    if(!isFinite(result)) throw new Error('Math error');
    return result;
  },
  press: function(v){
    if(v==='C'){ this._expr=''; this._hideVat(); }
    else if(v==='='){
      try { this._expr = String(this._safeEval(this._expr) || 0); }
      catch(e){ this._expr='Error'; }
    }
    else if(v==='⌫'){ this._expr=this._expr.slice(0,-1); }
    else if(v==='±'){
      // Toggle sign of last number in expression
      var m = this._expr.match(/(.*?)(-?\d+\.?\d*)$/);
      if(m){
        var head=m[1], num=m[2];
        if(num.charAt(0)==='-') this._expr = head + num.slice(1);
        else if(head && /[+\-*/]$/.test(head)) this._expr = head + '(-' + num + ')';
        else this._expr = '-' + num;
      }
    }
    else { if(this._expr==='Error') this._expr=''; this._expr+=v; }
    this._display();
  },
  getResult: function(){ try{return this._safeEval(this._expr);}catch(e){return parseFloat(this._expr)||0;} },
  reset: function(){ this._expr=''; this._display(); this._hideVat(); },

  // ─── VAT QUICK CALC (v4.6) — Nepal 13% ───
  // 'add'  → display value मा VAT थपिन्छ  (5000 → 5650)
  // 'incl' → display value भित्रैबाट VAT निकालिन्छ (5000 → शुद्ध 4424.78)
  _hideVat: function(){ var b=document.getElementById('calc-vat-result'); if(b){b.style.display='none';b.innerHTML='';} },
  vat: function(mode){
    var v = this.getResult();
    if(!v || v <= 0 || !isFinite(v)){ App.toast('पहिले रकम type गर्नुस्','warning',1800); return; }
    var r = 13, f = r/100;
    var pre, vatAmt, total;
    if(mode === 'incl'){
      total = v;
      pre = v / (1 + f);
      vatAmt = total - pre;
      // Display shows the extracted शुद्ध मूल्य
      this._expr = String(Math.round(pre*100)/100);
    } else {
      pre = v;
      vatAmt = v * f;
      total = pre + vatAmt;
      // Display shows the VAT-added total
      this._expr = String(Math.round(total*100)/100);
    }
    this._display();
    pre = Math.round(pre*100)/100; vatAmt = Math.round(vatAmt*100)/100; total = Math.round(total*100)/100;
    var box = document.getElementById('calc-vat-result');
    if(box){
      var tag = mode==='incl'
        ? '<span style="font-size:0.62rem;background:rgba(168,85,247,0.18);color:#a855f7;padding:2px 8px;border-radius:10px;font-weight:700;">📦 VAT भित्रै (13%)</span>'
        : '<span style="font-size:0.62rem;background:rgba(34,197,94,0.18);color:var(--green);padding:2px 8px;border-radius:10px;font-weight:700;">➕ VAT थपियो (13%)</span>';
      box.innerHTML = '<div style="margin-bottom:6px;">'+tag+'</div>'
        + '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--text-muted);">शुद्ध मूल्य</span><b>'+fmtRs(pre)+'</b></div>'
        + '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span style="color:var(--text-muted);">VAT (13%)</span><b style="color:#eab308;">'+fmtRs(vatAmt)+'</b></div>'
        + '<div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--border);margin-top:3px;"><b>जम्मा</b><b style="color:var(--green);">'+fmtRs(total)+'</b></div>'
        + '<div style="text-align:right;margin-top:6px;"><button onclick="App.navigate(\'vatcalc\');document.getElementById(\'calc-modal\').classList.remove(\'open\');" class="btn btn-xs btn-secondary">⛶ Full VAT Calculator</button></div>';
      box.style.display = '';
    }
  }
};

// ─── CALCULATOR KEYBOARD SUPPORT (v4.7) ──────────────────────────
// Works ONLY while the calculator modal is open. Laptop/desktop keyboard:
//   0-9 .        → numbers        |  + - * /  → operators (×÷ auto)
//   Enter or =   → equals         |  Backspace → ⌫ delete one
//   Delete or C  → clear          |  %         → percent
//   V → ➕ VAT थप्ने (+13%)        |  B → 📦 VAT भित्रै (extract)
document.addEventListener('keydown', function(e){
  var modal = document.getElementById('calc-modal');
  if(!modal || !modal.classList.contains('open')) return;
  // Safety: don't hijack typing if focus is inside an input/textarea/select
  var tag = (document.activeElement && document.activeElement.tagName) || '';
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  var k = e.key;
  if(/^[0-9]$/.test(k))            { CRMCalc.press(k);    e.preventDefault(); }
  else if(k === '.')               { CRMCalc.press('.');  e.preventDefault(); }
  else if(k === '+')               { CRMCalc.press('+');  e.preventDefault(); }
  else if(k === '-')               { CRMCalc.press('-');  e.preventDefault(); }
  else if(k === '*')               { CRMCalc.press('×');  e.preventDefault(); }
  else if(k === '/')               { CRMCalc.press('÷');  e.preventDefault(); }
  else if(k === '%')               { CRMCalc.press('%');  e.preventDefault(); }
  else if(k === 'Enter' || k==='=' ){ CRMCalc.press('=');  e.preventDefault(); }
  else if(k === 'Backspace')       { CRMCalc.press('⌫');  e.preventDefault(); }
  else if(k === 'Delete' || k==='c' || k==='C'){ CRMCalc.press('C'); e.preventDefault(); }
  else if(k === 'v' || k === 'V')  { CRMCalc.vat('add');  e.preventDefault(); }
  else if(k === 'b' || k === 'B')  { CRMCalc.vat('incl'); e.preventDefault(); }
});

// ─── DRAGGABLE FAB (v5.0) ─────────────────────────────────────────
// The ⚡ Quick-Actions button can be dragged anywhere so it never covers
// content. A short tap (no real movement) still opens the Quick Actions.
// Position is saved per-device in localStorage.
var FabDrag = {
  _moved: false,
  init: function(){
    var fab = document.getElementById('fab-btn');
    if(!fab) return;
    // Restore saved position
    this._restore(fab);
    var startX, startY, origX, origY, dragging=false;
    var self = this;

    function place(x, y){
      // Keep within viewport (with 6px margin), 54px button
      var vw = window.innerWidth, vh = window.innerHeight, sw = fab.offsetWidth || 54, sz = fab.offsetHeight || 54, mg = 6;
      x = Math.max(mg, Math.min(x, vw - sw - mg));
      y = Math.max(mg, Math.min(y, vh - sz - mg));
      fab.style.left = x + 'px';
      fab.style.top = y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    }

    function pointerStart(cx, cy){
      dragging = true; self._moved = false;
      var r = fab.getBoundingClientRect();
      startX = cx; startY = cy; origX = r.left; origY = r.top;
      fab.classList.add('dragging');
    }
    function pointerMove(cx, cy){
      if(!dragging) return;
      var dx = cx - startX, dy = cy - startY;
      if(Math.abs(dx) > 4 || Math.abs(dy) > 4) self._moved = true;
      place(origX + dx, origY + dy);
    }
    function pointerEnd(){
      if(!dragging) return;
      dragging = false;
      fab.classList.remove('dragging');
      if(self._moved){
        // Save new position
        var r = fab.getBoundingClientRect();
        try { STORE.set('pk3_fab_pos', {x:r.left, y:r.top}); } catch(e){}
      } else {
        // Treated as a tap → open Quick Add (v7.1.0)
        if(typeof QuickAdd!=='undefined') QuickAdd.open();
        else { var m = document.getElementById('fab-modal'); if(m) m.classList.add('open'); }
      }
    }

    // Mouse
    fab.addEventListener('mousedown', function(e){ e.preventDefault(); pointerStart(e.clientX, e.clientY); });
    document.addEventListener('mousemove', function(e){ if(dragging){ e.preventDefault(); pointerMove(e.clientX, e.clientY); } });
    document.addEventListener('mouseup', function(){ pointerEnd(); });
    // Touch
    fab.addEventListener('touchstart', function(e){ var t=e.touches[0]; pointerStart(t.clientX, t.clientY); }, {passive:true});
    document.addEventListener('touchmove', function(e){ if(dragging){ var t=e.touches[0]; pointerMove(t.clientX, t.clientY); e.preventDefault(); } }, {passive:false});
    document.addEventListener('touchend', function(){ pointerEnd(); });

    // Re-clamp on window resize/orientation change
    window.addEventListener('resize', function(){ self._restore(fab); });
  },
  _restore: function(fab){
    var pos = null;
    try { pos = STORE.get('pk3_fab_pos', null); } catch(e){}
    if(pos && typeof pos.x === 'number'){
      var vw = window.innerWidth, vh = window.innerHeight, sw = fab.offsetWidth || 54, sz = fab.offsetHeight || 54, mg = 6;
      var x = Math.max(mg, Math.min(pos.x, vw - sw - mg));
      var y = Math.max(mg, Math.min(pos.y, vh - sz - mg));
      fab.style.left = x + 'px';
      fab.style.top = y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    }
    // else: keep default CSS position (right:18px; bottom:78px)
  },
  reset: function(){
    try { STORE.set('pk3_fab_pos', null); } catch(e){}
    var fab = document.getElementById('fab-btn');
    if(fab){
      fab.style.left = ''; fab.style.top = '';
      fab.style.right = ''; fab.style.bottom = '';
    }
    var m = document.getElementById('fab-modal');
    if(m) m.classList.remove('open');
    if(window.App && App.toast) App.toast('📍 ＋ Quick Add button मूल ठाउँमा फर्कियो','success',1800);
  }
};

var Photo = {
  _current: null,
  // Handle file input change — resize to keep localStorage small, then preview
  handle: function(event, previewId, labelId){
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if(!file){ return; }
    if(file.size > 8*1024*1024){ App.toast('फोटो धेरै ठूलो छ (max 8MB)','error'); return; }
    var reader = new FileReader();
    reader.onload = function(ev){
      var img = new Image();
      img.onload = function(){
        // Resize so the longest side is <= 500px (keeps base64 small)
        var max = 500, w = img.width, h = img.height;
        if(w > h && w > max){ h = Math.round(h*max/w); w = max; }
        else if(h >= w && h > max){ w = Math.round(w*max/h); h = max; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        Photo._current = dataUrl;
        var pv = document.getElementById(previewId);
        if(pv){ pv.src = dataUrl; pv.style.display = 'block'; }
        var lb = document.getElementById(labelId);
        if(lb){ lb.textContent = '✅ Photo added — फेरि click गरेर बदल्नुस्'; }
        App.toast('📷 Photo added','success',1500);
      };
      img.onerror = function(){ App.toast('फोटो load हुन सकेन','error'); };
      img.src = ev.target.result;
    };
    reader.onerror = function(){ App.toast('फोटो पढ्न सकेन','error'); };
    reader.readAsDataURL(file);
  },
  capture: function(targetId){
    var input = document.createElement('input');
    input.type='file'; input.accept='image/*'; input.capture='environment';
    input.onchange = function(e){
      var file = e.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        Photo._current = ev.target.result;
        if(targetId){
          var el=document.getElementById(targetId);
          if(el && el.tagName==='IMG') el.src=ev.target.result;
        }
        showToast('Photo captured','success');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }
};

var DragWidget = {
  _dragging: null,
  _sx: 0, _sy: 0, _ox: 0, _oy: 0,
  init: function(){
    // HTML5 drag for .drag-widget elements
    document.querySelectorAll('.drag-widget').forEach(function(w){
      w.setAttribute('draggable','true');
      w.addEventListener('dragstart',function(e){ e.dataTransfer.setData('text/plain',w.id); });
    });
    document.querySelectorAll('.drop-zone').forEach(function(z){
      z.addEventListener('dragover',function(e){ e.preventDefault(); z.classList.add('drag-over'); });
      z.addEventListener('dragleave',function(){ z.classList.remove('drag-over'); });
      z.addEventListener('drop',function(e){
        e.preventDefault(); z.classList.remove('drag-over');
        var id=e.dataTransfer.getData('text/plain');
        var el=document.getElementById(id);
        if(el) z.appendChild(el);
      });
    });
  },
  startDrag: function(e, id){
    var el = document.getElementById(id); if(!el) return;
    this._dragging = el;
    var rect = el.getBoundingClientRect();
    this._ox = e.clientX - rect.left; this._oy = e.clientY - rect.top;
    el.style.position='fixed'; el.style.zIndex='9999';
    var self = this;
    function onMove(ev){ if(!self._dragging) return; self._dragging.style.left=(ev.clientX-self._ox)+'px'; self._dragging.style.top=(ev.clientY-self._oy)+'px'; }
    function onUp(){ self._dragging=null; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  },
  startTouch: function(e, id){
    var el = document.getElementById(id); if(!el) return;
    this._dragging = el;
    var t = e.touches[0];
    var rect = el.getBoundingClientRect();
    this._ox = t.clientX - rect.left; this._oy = t.clientY - rect.top;
    el.style.position='fixed'; el.style.zIndex='9999';
    var self = this;
    function onMove(ev){ var tt=ev.touches[0]; if(!self._dragging) return; self._dragging.style.left=(tt.clientX-self._ox)+'px'; self._dragging.style.top=(tt.clientY-self._oy)+'px'; ev.preventDefault(); }
    function onEnd(){ self._dragging=null; document.removeEventListener('touchmove',onMove); document.removeEventListener('touchend',onEnd); }
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('touchend',onEnd);
  }
};

// (LangToggle module removed in v4.9 — had 0 references and no button in the UI)

var Greet = {
  get: function(){
    var h = new Date().getHours();
    if(h<5)  return {t:'शुभ रात्री', e:'🌙'};
    if(h<12) return {t:'शुभ प्रभात', e:'🌅'};
    if(h<17) return {t:'नमस्कार', e:'☀️'};
    if(h<20) return {t:'शुभ सन्ध्या', e:'🌆'};
    return {t:'शुभ रात्री', e:'🌙'};
  },
  render: function(){
    var el = document.getElementById('dash-greet');
    if(!el) return;
    var user = (typeof currentUser!=='undefined' && currentUser) ? currentUser.name : 'User';
    var g = this.get();
    el.innerHTML = g.e + ' ' + g.t + ', <span style="color:var(--accent);">' + esc(user) + '</span>!';
  },
  checkBirthdays: function(){
    // Check if any customer has birthday today and show toast
    try {
      var custs = STORE.get('pk3_customers', []) || [];
      var today = todayBs().slice(5); // MM-DD
      custs.forEach(function(c){
        if(c.dob && c.dob.slice(5) === today){
          App.toast('🎂 Birthday: '+c.name+' today!', 'info', 5000);
        }
      });
    } catch(e){}
  }
};

