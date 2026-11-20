// ─── SMART REMINDERS + 1-CLICK AI WHATSAPP (v6.8.1) ───────────
var SmartRem = {
  _company: function(){
    var s = STORE.get('pk3_settings',{}) || {};
    return { name: s.companyName || 'Prerak Multipurpose Pvt. Ltd.', phone: s.phone1 || s.phone || '9855069733' };
  },
  _daysSince: function(iso){
    if(!iso) return 0;
    var d = new Date(String(iso).slice(0,10)+'T00:00:00'); if(isNaN(d)) return 0;
    var t = new Date(todayISO()+'T00:00:00');
    return Math.floor((t - d) / 86400000);
  },
  _sameDay: function(bs, ad){
    var tb = todayBs().slice(5), ta = todayISO().slice(5);
    if(bs && /^\d{4}-\d{2}-\d{2}$/.test(bs)) return bs.slice(5) === tb;
    if(ad && /^\d{4}-\d{2}-\d{2}$/.test(ad)) return ad.slice(5) === ta;
    return false;
  },
  items: function(){
    var real = (typeof SampleData!=='undefined' && SampleData.real) ? SampleData.real : function(a){ return a||[]; };
    var custs = real(STORE.get('pk3_customers',[])||[]);
    var fus   = real(STORE.get('pk3_followups',[])||[]);
    var quots = real(STORE.get('pk3_quotations',[])||[]);
    var ests  = real(STORE.get('pk3_estimates',[])||[]);
    var today = todayBs(), out = [], self = this;
    var byId = {}; custs.forEach(function(c){ if(c && c.id) byId[c.id] = c; });
    var fuCust = {};
    // 📅 Follow-ups: today + overdue (not done)
    fus.forEach(function(f){
      if(!f || f.status==='Done' || !f.fuDateBs) return;
      var cmp = compareBs(f.fuDateBs, today); if(cmp > 0) return;
      if(f.custId) fuCust[f.custId] = true;
      var c = byId[f.custId] || {};
      out.push({ type:'fu', ref:f.id, custId:f.custId||'', name:f.custName||c.name||'—', phone:f.custPhone||c.phone||'',
        overdue: cmp < 0, detail: (cmp<0?'⚠️ म्याद नाघेको ('+bsStringToDisplay(f.fuDateBs)+') · ':'आज · ')+(f.note||'') });
    });
    // customer-level FU date with no follow-up record
    custs.forEach(function(c){
      if(!c || !c.fuDateBs || fuCust[c.id]) return;
      var cmp = compareBs(c.fuDateBs, today); if(cmp > 0) return;
      if(fus.some(function(f){ return f && f.custId===c.id && f.status==='Done' && f.fuDateBs===c.fuDateBs; })) return;
      out.push({ type:'fu', ref:'', custId:c.id, name:c.name||'—', phone:c.phone||'', overdue: cmp<0,
        detail: (cmp<0?'⚠️ म्याद नाघेको ('+bsStringToDisplay(c.fuDateBs)+')':'आज Follow-up') });
    });
    // 🎂 Birthday / 💍 Anniversary
    custs.forEach(function(c){
      if(!c) return;
      if(self._sameDay(c.birthdayBs, c.birthday)) out.push({ type:'bday', ref:'', custId:c.id, name:c.name||'—', phone:c.phone||'', detail:'आज जन्मदिन' });
      if(self._sameDay(c.annivBs, c.anniv)) out.push({ type:'anniv', ref:'', custId:c.id, name:c.name||'—', phone:c.phone||'', detail:'आज विवाह वार्षिकोत्सव' });
    });
    // 🧾 Quotations / Estimates pending > 3 days
    quots.forEach(function(q){
      if(!q || (q.status && q.status!=='Pending')) return;
      var d = self._daysSince(q.date || q.created); if(d <= 3) return;
      var c = byId[q.custId] || {};
      out.push({ type:'quote', ref:q.id, src:'q', custId:q.custId||'', name:q.custName||c.name||'—', phone:q.custPhone||c.phone||'',
        detail: 'Quotation '+d+' दिनदेखि Pending'+(q.work?' · '+q.work:'')+(q.amount?' · '+fmtRs(q.amount):'') });
    });
    ests.forEach(function(e){
      if(!e || ['Draft','Pending','Sent'].indexOf(e.status||'Draft') < 0) return;
      var d = self._daysSince(e.date || e.created); if(d <= 3) return;
      var c = custs.find(function(x){ return x && ((e.phone && x.phone===e.phone) || (e.custName && x.name===e.custName)); }) || {};
      out.push({ type:'quote', ref:e.id, src:'e', custId:c.id||'', name:e.custName||c.name||'—', phone:e.phone||c.phone||'',
        detail: 'Estimate '+d+' दिनदेखि Pending'+(e.total?' · '+fmtRs(e.total):'') });
    });
    // 💰 Balance / Due > 0
    custs.forEach(function(c){
      if(!c || !c.id) return;
      var d = self.dueFor(c.id);
      if(d.total > 0.5) out.push({ type:'due', ref:'', custId:c.id, name:c.name||'—', phone:c.phone||'', amount:d.total,
        detail: 'बाँकी भुक्तानी' + (d.inv>0.5 && d.ledger>0.5 ? ' (Invoice '+fmtRs(d.inv)+' + Ledger '+fmtRs(d.ledger)+')' : (d.inv>0.5 ? ' · Invoice' : ' · Ledger')) });
    });
    return out;
  },
  key: function(it){ return it.type + '|' + (it.ref || it.custId || it.phone || it.name || ''); },
  // 💰 Due = unpaid invoice balances (− returned amount) + manual ledger (debit − credit, excluding auto return credits)
  dueFor: function(custId){
    var out = { inv: 0, ledger: 0, total: 0 };
    if(!custId) return out;
    (STORE.get('pk3_invoices',[])||[]).forEach(function(i){
      if(!i || i.custId!==custId || i._demo) return;
      if(i.status==='Paid' || i.status==='Cancelled') return;
      var b = (i.balance!=null && i.balance!=='') ? parseFloat(i.balance) : ((parseFloat(i.amount)||0) - (parseFloat(i.paid)||0));
      if(i._returned) b -= (parseFloat(i._returnedAmt)||0);
      if(b > 0.5) out.inv += b;
    });
    (STORE.get('pk3_ledger',[])||[]).forEach(function(t){
      if(!t || t.customerId!==custId || t._return || t._inv) return;   // _inv: auto-posted from an invoice (already counted above)
      out.ledger += (parseFloat(t.debit)||0) - (parseFloat(t.credit)||0);
    });
    out.inv = Math.round(out.inv*100)/100; out.ledger = Math.round(out.ledger*100)/100;
    out.total = Math.round((out.inv + out.ledger)*100)/100;
    return out;
  },
  stageFor: function(c){
    if(!c) return { stage:'New', auto:true };
    if(c.stage) return { stage:c.stage, auto:false };
    var id = c.id;
    var inv = (STORE.get('pk3_invoices',[])||[]).some(function(i){ return i && i.custId===id && i.status!=='Cancelled'; });
    var qs = (STORE.get('pk3_quotations',[])||[]).filter(function(q){ return q && q.custId===id; });
    var st = 'New';
    if(inv || qs.some(function(q){ return q.status==='Approved' || q.status==='Completed'; })) st = 'Confirmed';
    else if(qs.some(function(q){ return q.status==='Pending' || !q.status; })) st = 'Quoted';
    else if((STORE.get('pk3_followups',[])||[]).some(function(f){ return f && f.custId===id; })) st = 'Contacted';
    return { stage:st, auto:true };
  },
  _sentMap: function(){
    var all = STORE.get('pk3_wa_sent',{}) || {}, t = todayBs();
    return all[t] || {};
  },
  markSent: function(it){
    if(!it) return;
    var all = STORE.get('pk3_wa_sent',{}) || {}, t = todayBs();
    var keep = {}; keep[t] = all[t] || {};
    keep[t][this.key(it)] = new Date().toISOString();   // only today's log is kept
    STORE.set('pk3_wa_sent', keep);
  },
  sorted: function(){
    var list = this.items(), sent = this._sentMap(), self = this;
    list.forEach(function(it, i){ it.key = self.key(it); it.sent = sent[it.key] || ''; it._o = i; });
    return list.sort(function(a, b){ return (a.sent ? 1 : 0) - (b.sent ? 1 : 0) || a._o - b._o; });
  },
  _time: function(iso){ try { var d = new Date(iso); var h = d.getHours(), m = d.getMinutes(); var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2,'0') + ' ' + ap; } catch(e){ return ''; } },
  count: function(){ try { return this.sorted().filter(function(x){ return !x.sent; }).length; } catch(e){ return 0; } },
  // Minimize state (per device, today only). All-sent → auto-minimized unless opened after that.
  _minKey: 'swg_smart_min',
  _minPref: function(){ try { var p = JSON.parse(localStorage.getItem(this._minKey)||'null'); return (p && p.d===todayBs()) ? p : null; } catch(e){ return null; } },
  isMin: function(pending){
    var allDone = (pending===0), p = this._minPref();
    if(p && p.allDone===allDone) return !!p.min;
    return allDone;
  },
  toggleMin: function(){
    var pending = this.count(), cur = this.isMin(pending);
    try { localStorage.setItem(this._minKey, JSON.stringify({ d: todayBs(), min: !cur, allDone: pending===0 })); } catch(e){}
    this.render();
  },
  _tag: { fu:['📅 Follow-up','var(--yellow)'], bday:['🎂 Birthday','#ec4899'], anniv:['💍 Anniversary','#a855f7'], quote:['🧾 Pending Estimate','var(--accent)'], due:['💰 बाँकी','var(--red)'] },
  updateBell: function(){
    var badge = document.getElementById('notif-badge'); if(!badge) return;
    var unread = (STORE.get('pk3_notif',[])||[]).filter(function(n){ return !n.read; }).length;
    var n = this.count() + unread;
    badge.textContent = n > 99 ? '99+' : n;
    badge.className = 'notif-badge' + (n ? ' show' : '');
  },
  _rowsHTML: function(list, compact){
    var self = this;
    return list.map(function(it, i){
      var tg = self._tag[it.type] || ['🔔','var(--accent)'];
      if(it.type==='due') tg = ['💰 बाँकी: '+fmtRs(it.amount), 'var(--red)'];
      var sentB = it.sent ? '<span style="font-size:0.64rem;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid #22c55e;white-space:nowrap;">✅ पठाइसकियो '+self._time(it.sent)+'</span>' : '';
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border);flex-wrap:wrap;'+(it.sent?'opacity:0.55;':'')+'">'
        +'<span style="font-size:0.66rem;font-weight:700;padding:2px 8px;border-radius:12px;background:var(--surface-2);border:1px solid '+tg[1]+';color:'+tg[1]+';white-space:nowrap;">'+tg[0]+'</span>'
        +'<div style="flex:1;min-width:140px;"><div style="font-weight:700;font-size:0.86rem;">'+esc(it.name)+(it.phone?' <span style="font-weight:400;font-size:0.72rem;color:var(--text-muted);">'+esc(it.phone)+'</span>':'')+'</div>'
        +'<div style="font-size:0.72rem;color:'+(it.overdue?'var(--red)':'var(--text-muted)')+';">'+esc(it.detail||'')+'</div></div>'
        + sentB
        +'<button onclick="event.stopPropagation();AIWA.open('+i+')" class="btn btn-xs" style="background:'+(it.sent?'var(--surface-2);color:var(--text);border:1px solid var(--border)':'linear-gradient(135deg,#22c55e,#7c3aed);color:#fff')+';font-weight:700;white-space:nowrap;">'+(it.sent?'🔁 फेरि पठाउनुहोस्':'🤖 AI WhatsApp')+'</button>'
        +'</div>';
    }).join('');
  },
  render: function(){
    var list = []; try { list = this.sorted(); } catch(e){ console.warn('SmartRem', e); }
    AIWA._list = list;
    var pending = list.filter(function(x){ return !x.sent; }).length;
    var self = this;
    ['smart-rem-dash','smart-rem-fu'].forEach(function(id){
      var el = document.getElementById(id); if(!el) return;
      if(!list.length){ el.innerHTML = '<div class="card card-body" style="margin-bottom:12px;font-size:0.82rem;color:var(--text-muted);">🔔 आजको स्मार्ट रिमाइन्डर — आज केही बाँकी छैन ✅</div>'; return; }
      var counts = { fu:0, bday:0, anniv:0, quote:0, due:0 }; list.forEach(function(x){ counts[x.type] = (counts[x.type]||0) + 1; });
      var canMin = (id==='smart-rem-dash'), isMin = canMin && self.isMin(pending);
      el.innerHTML = '<div class="card" style="margin-bottom:12px;border:1.5px solid '+(pending?'rgba(249,115,22,0.35)':'rgba(34,197,94,0.35)')+';">'
        +'<div'+(canMin?' onclick="SmartRem.toggleMin()" title="'+(isMin?'खोल्नुहोस्':'सानो बनाउनुहोस्')+'"':'')+' style="padding:11px 14px;'+(isMin?'':'border-bottom:1px solid var(--border);')+'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;'+(canMin?'cursor:pointer;user-select:none;':'')+'">'
        +'<span style="font-weight:800;font-size:0.92rem;">🔔 आजको स्मार्ट रिमाइन्डर <span style="background:'+(pending?'var(--red)':'#22c55e')+';color:#fff;border-radius:10px;padding:1px 8px;font-size:0.7rem;margin-left:4px;">'+(pending?'बाँकी '+pending:'✅ सबै पठाइयो')+'</span>'+(list.length-pending?' <span style="font-size:0.7rem;font-weight:600;color:#22c55e;">✅ '+(list.length-pending)+' पठाइसकियो</span>':'')+'</span>'
        +'<span style="display:flex;align-items:center;gap:8px;"><span style="font-size:0.7rem;color:var(--text-muted);">📅 '+counts.fu+' · 🎂 '+counts.bday+' · 💍 '+counts.anniv+' · 🧾 '+counts.quote+' · 💰 '+counts.due+'</span>'
        +(canMin?'<button type="button" id="smart-rem-tog" onclick="event.stopPropagation();SmartRem.toggleMin()" aria-label="'+(isMin?'Expand':'Minimize')+'" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;width:30px;height:26px;cursor:pointer;font-size:0.9rem;line-height:1;">'+(isMin?'▾':'▴')+'</button>':'')
        +'</span></div>'
        +(isMin?'':'<div id="'+id+'-body" style="padding:2px 12px 6px;max-height:340px;overflow-y:auto;">'+self._rowsHTML(list)+'</div>')+'</div>';
    });
    this.updateBell();
  }
};

var AIWA = {
  _list: [], _cur: null, _dirty: false, _seq: 0, _styleIdx: 0, _waWin: null,
  mode: function(){ var m = STORE.get('pk3_wa_mode','desktop'); return (m==='web') ? 'web' : 'desktop'; },
  setMode: function(m){ STORE.set('pk3_wa_mode', m==='web' ? 'web' : 'desktop'); App.toast('✅ WhatsApp: '+(m==='web'?'WhatsApp Web':'Desktop App'),'success',1800); },
  waUrl: function(num, text){
    var q = (num ? 'phone=' + num + '&' : '') + 'text=' + encodeURIComponent(text);
    return this.mode()==='web' ? 'https://web.whatsapp.com/send?' + q : 'whatsapp://send?' + q;
  },
  _launch: function(url){
    if(url.indexOf('whatsapp://')===0){
      // Custom protocol: hand off to the installed app without opening a new tab
      var a = document.createElement('a'); a.href = url; a.style.display = 'none';
      document.body.appendChild(a); try { a.click(); } catch(e){ location.href = url; }
      setTimeout(function(){ try{ a.remove(); }catch(e){} }, 1000);
    } else {
      // Reuse the same WhatsApp Web tab: held handle first, then the named target 'swagatik_wa'
      var wnd = null;
      try { if(this._waWin && !this._waWin.closed){ this._waWin.location.href = url; wnd = this._waWin; } } catch(e){ wnd = null; }
      if(!wnd) wnd = window.open(url, 'swagatik_wa');
      if(wnd) this._waWin = wnd;
      try { if(wnd) wnd.focus(); } catch(e){}
    }
  },
  _cust: function(it){
    var custs = STORE.get('pk3_customers',[])||[];
    return custs.find(function(c){ return c && c.id===it.custId; })
      || custs.find(function(c){ return c && it.phone && c.phone===it.phone; }) || {};
  },
  _occ: {
    fu:'Follow-up (कुराकानी अगाडि बढाउन सम्झना)', bday:'जन्मदिनको शुभकामना', anniv:'विवाह वार्षिकोत्सवको शुभकामना',
    quote:'Pending Quotation/Estimate बारे विनम्र सम्झना', due:'बाँकी भुक्तानी (Payment Reminder) — विनम्र, सम्मानजनक, दबाब नदिने',
    walkin:'शोरुम/कार्यालयमा आउनुभएकोमा धन्यवाद (Walk-in Welcome)', quoteready:'Quotation तयार भएको जानकारी',
    complete:'काम सम्पन्न भएको जानकारी + धन्यवाद + review अनुरोध', greet:'नयाँ Lead लाई स्वागत र परिचय'
  },
  _label: { fu:'Follow-up', bday:'Birthday', anniv:'Anniversary', quote:'Estimate', due:'Payment Reminder', walkin:'Walk-in', quoteready:'Quotation Ready', complete:'Work Complete', greet:'Lead Greeting' },
  _ctx: function(it){
    var c = this._cust(it), co = SmartRem._company();
    var svcs = (typeof Customers!=='undefined' && Customers.getServices) ? Customers.getServices(c) : [];
    var svc = svcs.map(function(s){ return [s.work, s.subwork].filter(Boolean).join(' - '); }).filter(Boolean).join(', ');
    var extra = '', amount = '';
    if(it.type==='fu' && it.ref){ var f = (STORE.get('pk3_followups',[])||[]).find(function(x){ return x.id===it.ref; }); if(f) extra = f.note || ''; }
    if(it.type==='quote'){
      var q = it.src==='e' ? (STORE.get('pk3_estimates',[])||[]).find(function(x){ return x.id===it.ref; }) : (STORE.get('pk3_quotations',[])||[]).find(function(x){ return x.id===it.ref; });
      if(q){ if(!svc && q.work) svc = [q.work, q.subwork].filter(Boolean).join(' - '); amount = q.amount || q.total || ''; extra = q.details || q.remarks || ''; }
    }
    if(it.type==='quoteready' && c.id){
      var lq = (STORE.get('pk3_quotations',[])||[]).filter(function(x){ return x && x.custId===c.id; })[0];
      if(lq){ amount = lq.amount || ''; if(!svc && lq.work) svc = [lq.work, lq.subwork].filter(Boolean).join(' - '); }
    }
    var due = c.id ? SmartRem.dueFor(c.id) : { total:0 };
    if(it.type==='due') amount = it.amount || due.total;
    var stg = c.id ? SmartRem.stageFor(c) : null;
    return { name: it.name || c.name || '', phone: it.phone || c.phone || '', service: svc, notes: c.notes || '', extra: extra, amount: amount,
      due: due.total, stage: stg ? stg.stage : '', type: it.type, company: co.name, coPhone: co.phone, address: c.address || '' };
  },
  template: function(x){
    var n = (x.name || '').trim(), svc = x.service || '', sig = '\n\nधन्यवाद 🙏\n' + x.company + '\n📞 ' + x.coPhone;
    var hi = (n ? 'नमस्ते ' + n + ' जी 🙏' : 'नमस्ते 🙏') + '\n\n';
    if(x.type==='bday') return '🎂 जन्मदिनको हार्दिक मंगलमय शुभकामना' + (n ? ', ' + n + ' जी' : '') + '!\n\nतपाईंको जीवन सुख, शान्ति, सुस्वास्थ्य र समृद्धिले भरिपूर्ण रहोस्। हामीमाथि राख्नुभएको विश्वासका लागि हृदयदेखि आभार।' + sig;
    if(x.type==='anniv') return '💍 वैवाहिक वार्षिकोत्सवको हार्दिक शुभकामना' + (n ? ', ' + n + ' जी' : '') + '!\n\nतपाईंहरूको दाम्पत्य जीवन सधैं प्रेम, खुसी र सफलताले भरिएको रहोस्।' + sig;
    if(x.type==='quote') return hi + 'हामीले पठाएको ' + (svc || 'काम') + ' को Quotation' + (x.amount ? ' (' + fmtRs(x.amount) + ')' : '') + ' बारे तपाईंको विचार जान्न चाहन्छौं। केही परिवर्तन वा थप जानकारी चाहिएमा निःसंकोच भन्नुहोला — हामी तपाईंको बजेट अनुसार मिलाउन तयार छौं।' + sig;
    if(x.type==='due') return hi + x.company + ' बाट विनम्र सम्झना: तपाईंको ' + (svc ? svc + ' को ' : '') + 'बाँकी भुक्तानी ' + fmtRs(x.amount) + ' रहेको छ। सुविधा अनुसार भुक्तानी मिलाइदिनुहुन अनुरोध गर्दछौं। भुक्तानी भइसकेको भए यो म्यासेज बेवास्ता गर्नुहोला, र कुनै जिज्ञासा भए निःसंकोच सम्पर्क गर्नुहोला।' + sig;
    if(x.type==='walkin') return hi + x.company + ' मा पाल्नुभएकोमा हार्दिक धन्यवाद! ' + (svc ? svc + ' सम्बन्धी ' : '') + 'तपाईंलाई चाहिने जानकारी, नमुना र उचित मूल्यका लागि हामी सधैं तयार छौं। केही जिज्ञासा भए निःसंकोच सम्पर्क गर्नुहोला।' + sig;
    if(x.type==='quoteready') return hi + 'तपाईंको ' + (svc || 'काम') + ' को Quotation तयार भएको छ' + (x.amount ? ' (कुल ' + fmtRs(x.amount) + ')' : '') + '। हेरेर कुनै परिवर्तन चाहिए भन्नुहोला, हामी मिलाउन तयार छौं।' + sig;
    if(x.type==='complete') return hi + 'तपाईंको ' + (svc || 'काम') + ' सम्पन्न भएको जानकारी गराउँदा खुसी लागेको छ। हामीमाथि विश्वास गर्नुभएकोमा धन्यवाद! कामबारे तपाईंको प्रतिक्रिया (review) पाए हामीलाई अझ राम्रो गर्न सहयोग हुनेछ।' + sig;
    if(x.type==='greet') return hi + x.company + ' मा सम्पर्क गर्नुभएकोमा धन्यवाद! हामी Construction, Interior र Prefab Homes सम्बन्धी सेवा दिन्छौं। ' + (svc ? svc + ' बारे ' : '') + 'तपाईंको आवश्यकता बुझेर उत्तम सल्लाह र मूल्य दिन चाहन्छौं। कहिले कुरा गर्दा सजिलो हुन्छ?' + sig;
    return hi + x.company + ' बाट सम्झना गर्दैछौं। तपाईंको ' + (svc || 'काम') + ' सम्बन्धी कुराकानी अगाडि बढाउन चाहन्छौं। तपाईंलाई कहिले सम्पर्क गर्दा सजिलो हुन्छ? केही जिज्ञासा भए निःसंकोच भन्नुहोला।' + sig;
  },
  // Shared AI prompt builder (used by AI WhatsApp + Walk-in)
  _prompt: function(x, topic, style){
    var system = 'You write short, warm, polite WhatsApp messages in Nepali (Devanagari script) for ' + x.company + ', a construction, interior and prefab-homes company in Hetauda, Nepal. Rules: 40-80 words; respectful (use "जी", "हजुर"); natural and personal, not pushy; 1-2 fitting emojis max; never invent prices, dates, discounts or promises not given; if an amount is given write it exactly as given; for payment reminders be courteous, never threatening; if no customer name is given, greet without a name; no placeholders like [name]; no hashtags. End with exactly two lines: "धन्यवाद 🙏" then "' + x.company + ' — 📞 ' + x.coPhone + '". Output ONLY the message text.';
    var amtLabel = x.type==='due' ? 'बाँकी रकम (ठ्याक्कै यही लेख्नुहोस्)' : 'Quotation रकम';
    var user = 'अवसर/विषय: ' + topic + '\nग्राहकको नाम: ' + (x.name || '(नाम थाहा छैन)')
      + (x.service ? '\nसेवा/काम: ' + x.service : '')
      + (x.amount ? '\n' + amtLabel + ': ' + fmtRs(x.amount) : '')
      + (x.type!=='due' && x.due > 0.5 ? '\n(सन्दर्भका लागि मात्र — ग्राहकको बाँकी रकम: ' + fmtRs(x.due) + '; विषय भुक्तानी नभए म्यासेजमा नलेख्नुहोस्)' : '')
      + (x.stage ? '\nLead Stage: ' + x.stage : '')
      + (x.address ? '\nठेगाना: ' + x.address : '')
      + (x.notes ? '\nग्राहक नोट: ' + x.notes : '')
      + (x.extra ? '\nथप विवरण: ' + x.extra : '')
      + (style ? '\nलेखाइको शैली: ' + style : '');
    return { system: system, user: user };
  },
  _ensureModal: function(){
    if(document.getElementById('aiwa-modal')) return;
    var d = document.createElement('div');
    d.id = 'aiwa-modal';
    d.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;align-items:center;justify-content:center;padding:16px;';
    d.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:100%;max-width:520px;max-height:92vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,0.5);">'
      +'<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-weight:800;font-size:0.95rem;">🤖 AI WhatsApp</div><div id="aiwa-to" style="font-size:0.74rem;color:var(--text-muted);"></div></div>'
        +'<button onclick="AIWA.close()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text);">✖</button></div>'
      +'<div style="padding:12px 16px;">'
        +'<div id="aiwa-status" style="font-size:0.74rem;margin-bottom:8px;color:var(--text-muted);"></div>'
        +'<textarea id="aiwa-text" rows="9" oninput="AIWA._dirty=true" style="width:100%;box-sizing:border-box;border:1.5px solid var(--border);border-radius:8px;padding:10px;font-size:0.86rem;line-height:1.55;background:var(--surface-2);color:var(--text);resize:vertical;"></textarea>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">'
          +'<button id="aiwa-send" onclick="AIWA.send()" class="btn btn-sm" style="background:#22c55e;color:#fff;font-weight:800;flex:1;min-width:180px;">📲 WhatsApp मा पठाउनुहोस्</button>'
          +'<button id="aiwa-regen" onclick="AIWA.regen()" class="btn btn-sm btn-secondary">🔄 AI फेरि लेखोस्</button>'
          +'<button onclick="AIWA.copy()" class="btn btn-sm btn-secondary">📋 Copy</button>'
        +'</div></div></div>';
    d.addEventListener('click', function(e){ if(e.target === d) AIWA.close(); });
    document.body.appendChild(d);
  },
  open: function(idxOrItem){
    var it = (typeof idxOrItem === 'object') ? idxOrItem : this._list[idxOrItem];
    if(!it){ App.toast('Customer भेटिएन','error'); return; }
    this._ensureModal();
    this._cur = it; this._dirty = false;
    var x = this._ctx(it);
    document.getElementById('aiwa-to').textContent = '📌 ' + (this._label[x.type]||'') + ' · 👤 ' + (x.name||'—') + (x.phone ? ' · 📞 ' + x.phone : ' · ⚠️ फोन नम्बर छैन');
    document.getElementById('aiwa-text').value = this.template(x);
    document.getElementById('aiwa-modal').style.display = 'flex';
    try{ if(typeof Notif!=='undefined') Notif.close(); }catch(e){}
    this.regen(true);
  },
  _styles: ['न्यानो र आत्मीय', 'छोटो र सिधा', 'औपचारिक र सम्मानजनक', 'उत्साहजनक र सकारात्मक', 'मित्रवत् र सहज'],
  regen: async function(auto){
    var it = this._cur; if(!it) return;
    var st = document.getElementById('aiwa-status'), ta = document.getElementById('aiwa-text');
    var btn = document.getElementById('aiwa-regen');
    var x = this._ctx(it), self = this;
    var pick = (typeof AIAssistant!=='undefined' && AIAssistant._pickProvider) ? AIAssistant._pickProvider() : null;
    var manual = !auto;
    var setBtn = function(busy){ if(btn){ btn.disabled = busy; btn.textContent = busy ? '⏳ लेख्दैछ…' : '🔄 AI फेरि लेखोस्'; btn.style.opacity = busy ? '0.6' : ''; } };
    if(!pick){ st.innerHTML = manual ? '<span style="color:var(--red);">❌ AI key छैन — Settings → AI Assistant Settings मा Gemini key हाल्नुहोस्। अहिले रेडीमेड टेम्प्लेट छ।</span>' : '📝 रेडीमेड टेम्प्लेट तयार छ (AI key छैन — Settings → AI मा Gemini key हाल्न सक्नुहुन्छ)'; return; }
    if(!navigator.onLine){ st.innerHTML = manual ? '<span style="color:var(--red);">❌ Internet छैन — AI ले लेख्न सकेन। रेडीमेड टेम्प्लेट छ।</span>' : '📝 Internet छैन — रेडीमेड टेम्प्लेट तयार छ'; return; }
    var seq = ++this._seq;
    if(manual) this._styleIdx = (this._styleIdx + 1) % this._styles.length;
    var style = this._styles[this._styleIdx];
    setBtn(true);
    st.innerHTML = manual ? '⏳ AI ले नयाँ म्यासेज लेख्दैछ… (शैली: ' + style + ')' : '🤖 AI ले म्यासेज लेख्दैछ… (तबसम्म टेम्प्लेट प्रयोग गर्न सक्नुहुन्छ)';
    var pp = this._prompt(x, this._occ[x.type] || x.type, style);
    var system = pp.system, user = pp.user;
    var prev = (ta.value || '').trim();
    if(manual && prev) user += '\n\nपहिलेको म्यासेज (यो नदोहोर्याउनुहोस् — शब्द, सुरुवात र बनावट फरक बनाएर नयाँ म्यासेज लेख्नुहोस्):\n' + prev;
    var r;
    try { r = await AIAssistant._callAI(pick, system, user); } catch(e){ r = { error: e.message || 'unknown' }; }
    if(seq !== this._seq || this._cur !== it) return;
    setBtn(false);
    if(r && r.text && r.text.trim()){
      if(!manual && this._dirty){ st.innerHTML = '✅ AI म्यासेज तयार भयो, तर तपाईंले सच्याइरहनुभएकाले बदलिएन। "🔄 AI फेरि लेखोस्" थिचे नयाँ आउँछ।'; return; }
      ta.value = r.text.trim(); this._dirty = false;
      st.innerHTML = '✅ ' + (manual ? 'नयाँ म्यासेज तयार (शैली: ' + esc(style) + ')' : 'AI ले लेख्यो') + ' — ' + esc(pick.label) + '। चाहे सच्याएर पठाउनुहोस्।';
      try { ta.style.transition = 'box-shadow .3s'; ta.style.boxShadow = '0 0 0 2px #22c55e'; setTimeout(function(){ ta.style.boxShadow = ''; }, 900); } catch(e){}
    } else {
      st.innerHTML = '<span style="color:var(--red);">❌ AI चलेन: ' + esc((r && r.error) || 'unknown') + '</span>' + (manual ? ' — बक्सको म्यासेज जस्ताको तस्तै छ।' : ' — रेडीमेड टेम्प्लेट तयार छ।');
    }
  },
  _waNumber: function(p){
    var d = String(p||'').replace(/\D/g,'');
    if(!d) return '';
    if(d.indexOf('00')===0) d = d.slice(2);
    if(d.length===10 && d.charAt(0)==='9') d = '977' + d;
    else if(d.length===11 && d.charAt(0)==='0') d = '977' + d.slice(1);
    return d;
  },
  send: function(){
    var it = this._cur; if(!it) return;
    var x = this._ctx(it), num = this._waNumber(x.phone);
    var text = (document.getElementById('aiwa-text').value||'').trim();
    if(!text){ App.toast('म्यासेज खाली छ','error'); return; }
    var url = this.waUrl(num, text);
    if(!num) App.toast('⚠️ फोन नम्बर छैन — WhatsApp मा आफैं contact छान्नुहोस्','warning',3500);
    this._launch(url);
    try { SmartRem.markSent(it); SmartRem.render(); if(Notif._open) Notif.renderList(); } catch(e){}
    try { App.toast('✅ '+(x.name||'')+' — पठाइसकियो भनेर मार्क गरियो','success',2200); } catch(e){}
    try { Activity.add('📲 AI WhatsApp: ' + (x.name||'') + ' (' + (this._label[x.type]||x.type) + ')'); } catch(e){}
    try { Audit.log('WHATSAPP','AI WhatsApp sent to ' + (x.name||'') ); } catch(e){}
    this.close();
  },
  copy: function(){
    var t = document.getElementById('aiwa-text').value || '';
    try { navigator.clipboard.writeText(t); App.toast('📋 Copy भयो','success'); } catch(e){ App.toast('Copy भएन','error'); }
  },
  close: function(){ var m = document.getElementById('aiwa-modal'); if(m) m.style.display = 'none'; this._seq++; this._cur = null; var b = document.getElementById('aiwa-regen'); if(b){ b.disabled = false; b.textContent = '🔄 AI फेरि लेखोस्'; b.style.opacity = ''; } },
  // From Follow-up Tracker card
  openFollowup: function(fid){
    var f = (STORE.get('pk3_followups',[])||[]).find(function(x){ return x.id===fid; });
    if(!f){ App.toast('Follow-up भेटिएन','error'); return; }
    this.open({ type:'fu', ref:f.id, custId:f.custId||'', name:f.custName||'', phone:f.custPhone||'', detail:f.note||'' });
  }
};

