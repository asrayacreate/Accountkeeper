// ─── WALK-IN MODULE ───────────────────────────────────────────
var Walkin = {
  _size: 'medium',
  _selectedCust: null,
  setSize: function(s){
    this._size = s;
    ['short','medium','full'].forEach(function(k){
      var b = document.getElementById('wi-size-'+k);
      if(b) b.className = 'btn btn-xs '+(k===s?'btn-primary':'btn-secondary');
    });
    this.render();
  },
  render: function(){
    // Load templates — always from pk3_templates, fallback to defaults
    var templates = STORE.get('pk3_templates', null);
    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      templates = DEFAULT_TEMPLATES || Followups._defTpl();
      STORE.set('pk3_templates', templates);
    }
    // Ensure every template has a non-empty body
    templates = templates.filter(function(t){ return t && t.name && (t.text||t.body||t.message||'').trim(); });

    var chips = document.getElementById('wi-chips');
    if (!chips) return;
    chips.innerHTML = '';

    var self = this;
    templates.forEach(function(t){
      var span = document.createElement('span');
      span.className = 'chip-item';
      span.style.cssText = 'display:inline-flex;align-items:center;padding:5px 12px;border-radius:20px;font-size:0.78rem;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface-2);color:var(--text);white-space:nowrap;margin:2px;';
      span.textContent = t.name;
      var body = (t.text || t.body || t.message || '').trim();
      span.title = body.slice(0, 100);
      span.addEventListener('click', function(){
        self._tplName = t.name;
        var filled = fillTemplate(t, self._selectedCust);
        var el = document.getElementById('wi-msg');
        if (el) {
          el.value = filled;
          el.focus();
          el.dispatchEvent(new Event('input'));
        }
      });
      chips.appendChild(span);
    });
  },
  search: function(val,force){
    if(!val||(!force&&val.length<3)){document.getElementById('walkin-suggest').style.display='none';document.getElementById('wi-result').innerHTML='';return;}
    var custs=Customers.getData(); var lower=val.toLowerCase();
    var matches=custs.filter(function(c){return (c.name+c.phone).toLowerCase().indexOf(lower)>=0;}).slice(0,5);
    var sugg=document.getElementById('walkin-suggest');
    var digits = val.replace(/[^0-9]/g,'');
    var isPhone = digits.length >= 7;
    // Build "not found" action options (used in both dropdown and result area)
    var q = val.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    var notFoundOpts = ''
      + '<div onclick="Walkin.addNewFromSearch(\''+q+'\')" style="padding:9px 14px;cursor:pointer;font-size:0.84rem;color:var(--accent);font-weight:600;border-top:1px solid var(--border);" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">➕ नयाँ Customer add गर्नुस् — "'+esc(val)+'"</div>'
      + (isPhone ? '<div onclick="Walkin.useRawNumber(\''+digits+'\')" style="padding:9px 14px;cursor:pointer;font-size:0.84rem;color:var(--green);font-weight:600;border-top:1px solid var(--border);" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">📱 यही नम्बरमा greeting पठाउनुस् — '+digits+'</div>' : '');
    var rowHtml = function(c){return '<div onclick="Walkin.selectCust(\''+c.id+'\')" style="padding:8px 14px;cursor:pointer;font-size:0.85rem;" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">'+esc(c.name)+' — '+esc(c.phone)+'</div>';};
    if(matches.length&&!force){
      sugg.style.display='';
      sugg.innerHTML=matches.map(rowHtml).join('') + notFoundOpts;
    } else if(!matches.length && !force){
      // Live typing, nothing found — still show action options
      sugg.style.display='';
      sugg.innerHTML='<div style="padding:8px 14px;font-size:0.78rem;color:var(--text-muted);">कुनै customer मिलेन</div>' + notFoundOpts;
    } else {
      sugg.style.display='none';
      if(force){
        if(matches.length===1){this.selectCust(matches[0].id);}
        else if(matches.length>1){sugg.style.display='';sugg.innerHTML=matches.map(rowHtml).join('') + notFoundOpts;}
        else{
          document.getElementById('wi-result').innerHTML='<div style="padding:14px;background:var(--surface-2);border-radius:10px;text-align:center;">'
            +'<div style="color:var(--text-muted);margin-bottom:10px;">😕 "'+esc(val)+'" — Customer फेला परेन</div>'
            +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
            +'<button onclick="Walkin.addNewFromSearch(\''+q+'\')" class="btn btn-sm btn-primary">➕ नयाँ Customer Add</button>'
            +(isPhone?'<button onclick="Walkin.useRawNumber(\''+digits+'\')" class="btn btn-sm btn-wa">📱 सिधै Greeting पठाउनुस्</button>':'')
            +'</div></div>';
        }
      }
    }
  },
  // ── ADD FROM SEARCH (v4.0.9): pre-fill searched text into Add Customer form ──
  addNewFromSearch: function(query){
    var digits = String(query).replace(/[^0-9]/g,'');
    var isPhone = digits.length >= 7;
    Customers._prefillNew = isPhone ? {phone: digits} : {name: query};
    App.navigate('add-customer');
  },
  // ── DIRECT GREETING (v4.0.9): send to any number without saving customer / follow-up ──
  useRawNumber: function(phone){
    document.getElementById('walkin-suggest').style.display='none';
    this._selectedCust = { id:'', name:'ग्राहक', phone: phone };
    var ph = document.getElementById('wi-phone'); if(ph) ph.value = phone;
    var res=document.getElementById('wi-result');
    res.innerHTML='<div class="card card-body" style="margin-top:10px;">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'+
      '<div style="width:48px;height:48px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;">📱</div>'+
      '<div><div style="font-size:1.05rem;font-weight:800;">नयाँ नम्बर</div><div style="font-size:0.85rem;color:var(--text-muted);">'+esc(phone)+'</div><div style="font-size:0.72rem;color:var(--green);">Direct greeting — follow-up बिना</div></div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
      '<button onclick="Walkin.send(\'wa\')" class="btn btn-sm btn-wa">📱 WhatsApp पठाउनुस्</button>'+
      '<button onclick="Walkin.addNewFromSearch(\''+phone+'\')" class="btn btn-sm btn-secondary">➕ Customer पनि Add गर्नुस्</button>'+
      '</div></div>';
    // Fill greeting template with generic name
    var _tpls=STORE.get('pk3_templates',null); if(!_tpls||!_tpls.length){_tpls=Followups._defTpl();STORE.set('pk3_templates',_tpls);}
    var msg=_tpls[0]; if(msg) setVal('wi-msg', fillTemplate(msg, {name:'', phone:phone}));
    App.toast('✅ Template ready — message check गरेर पठाउनुस्','success',2500);
  },
  selectCust: function(id){
    document.getElementById('walkin-suggest').style.display='none';
    var c=Customers.getData().find(function(x){return x.id===id;}); if(!c)return;
    this._selectedCust = c;
    // Sync search field with phone so Walkin.send can read it consistently
    var ph = document.getElementById('wi-phone'); if(ph) ph.value = c.phone || '';
    var res=document.getElementById('wi-result');
    res.innerHTML='<div class="card card-body" style="margin-top:10px;">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'+(c.photo?'<img src="'+c.photo+'" class="photo-thumb">':'<div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;font-weight:700;">'+((c.name||'?').charAt(0))+'</div>')+
      '<div><div style="font-size:1.1rem;font-weight:800;">'+c.name+'</div><div style="font-size:0.8rem;color:var(--text-muted);">'+c.phone+'</div><div style="font-size:0.78rem;color:var(--accent);">'+esc(Customers.getServices(c).map(function(x){return x.work;}).filter(Boolean).join(' · '))+'</div></div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
      '<button onclick="Walkin.send(\'wa\')" class="btn btn-sm btn-wa">📱 WhatsApp</button>'+
      '<button onclick="App.navigate(\'add-quotation\');setTimeout(function(){setVal(\'q-cust\',\''+c.id+'\');},200);" class="btn btn-sm btn-primary">📋 Quote</button>'+
      '<button onclick="Followups._prefillCust=\''+c.id+'\';App.navigate(\'add-followup\');" class="btn btn-sm btn-yellow">🔔 Follow-up</button>'+
      '</div></div>';
    var _tpls=STORE.get('pk3_templates',null); if(!_tpls||!_tpls.length){_tpls=Followups._defTpl();STORE.set('pk3_templates',_tpls);} var msg=_tpls[0]; if(msg) setVal('wi-msg', fillTemplate(msg, c));
    // Log visit
    var visits=STORE.get('pk3_walkins',[]); visits.unshift({id:uid(),custId:c.id,custName:c.name,phone:c.phone,time:new Date().toISOString()}); if(visits.length>200)visits=visits.slice(0,200); STORE.set('pk3_walkins',visits);
  },
  send: function(type){
    var msg=getVal('wi-msg'); if(!msg){App.toast('Message लेख्नुस्!','error');return;}
    // Prefer selected customer's phone; fall back to search field
    var phone = '';
    if(this._selectedCust && this._selectedCust.phone) phone = this._selectedCust.phone;
    else phone = getVal('wi-phone');
    if(type==='wa'){
      if(!Wa.send(phone, msg)) return;
    }
    else if(type==='sms'){
      var clean = Wa.cleanPhone(phone);
      if(!clean){ App.toast('Phone number चाहिन्छ!','error'); return; }
      window.open('sms:+'+clean+'?body='+encodeURIComponent(msg));
    }
    else if(type==='copy'){if(navigator.clipboard)navigator.clipboard.writeText(msg); App.toast('📋 Copied!','success');}
  },
  log: function(){ App.toast('📝 Visit logged!','success'); },
  _tplName: '', _aiBusy: false,
  _AI_TIMEOUT_MS: 35000,
  _fallback: function(c){
    var tpls = STORE.get('pk3_templates',null); if(!tpls || !tpls.length){ try{ tpls = Followups._defTpl(); }catch(e){ tpls = []; } }
    var name = this._tplName, t = null;
    if(name) t = tpls.find(function(x){ return x && x.name===name; });
    if(!t) t = tpls[0];
    var cust = (c && c.name) ? c : { name:'', phone:(c&&c.phone)||'' };
    if(t){ try { var f = fillTemplate(t, cust); if(f && f.trim()) return f.trim(); } catch(e){} }
    try { return AIWA.template(AIWA._ctx({ type:'walkin', ref:'', custId:(c&&c.id)||'', name:(c&&c.name&&c.name!=='ग्राहक')?c.name:'', phone:(c&&c.phone)||'' })); } catch(e){ return ''; }
  },
  aiWrite: async function(){
    if(this._aiBusy) return;
    var ta = document.getElementById('wi-msg'), st = document.getElementById('wi-ai-status'), btn = document.getElementById('wi-ai-btn');
    var c = this._selectedCust || {};
    var draft = (ta.value || '').trim();
    var self = this;
    var useFallback = function(why){
      if(!draft){
        var fb = self._fallback(c);
        if(fb){ ta.value = fb; try { ta.dispatchEvent(new Event('input')); } catch(e){} }
        st.innerHTML = '<span style="color:var(--red);">❌ ' + esc(why) + '</span> — 📝 "' + esc(self._tplName || 'Welcome') + '" को रेडीमेड म्यासेज भरियो।';
      } else {
        st.innerHTML = '<span style="color:var(--red);">❌ ' + esc(why) + '</span> — बक्सको म्यासेज जस्ताको तस्तै छ।';
      }
    };
    var pick = (typeof AIAssistant!=='undefined' && AIAssistant._pickProvider) ? AIAssistant._pickProvider() : null;
    if(!pick){ useFallback('AI key छैन (Settings → AI Assistant Settings मा Gemini key हाल्नुहोस्)'); return; }
    if(!navigator.onLine){ useFallback('Internet छैन'); return; }
    var it = { type:'walkin', ref:'', custId:c.id||'', name:(c.name && c.name!=='ग्राहक') ? c.name : '', phone:c.phone||getVal('wi-phone')||'' };
    var x = AIWA._ctx(it);
    var topic = this._tplName || 'Walk-in Welcome';
    var isPay = /payment|भुक्तानी|बाँकी/i.test(topic);
    // Short prompt → faster Gemini response
    var system = 'Write a short polite WhatsApp message in Nepali (Devanagari) for ' + Company.aiContext() + '. 30-60 words, respectful, 1 emoji max, no invented facts or prices, no placeholders. End with: धन्यवाद 🙏 / ' + x.company + (x.coPhone ? ' — 📞 ' + x.coPhone : '') + '. Output only the message.';
    var user = 'विषय: ' + topic
      + (x.name ? '\nनाम: ' + x.name : '')
      + (x.service ? '\nसेवा: ' + x.service : '')
      + (isPay && x.due > 0.5 ? '\nबाँकी रकम (ठ्याक्कै): ' + fmtRs(x.due) : '')
      + (draft ? '\nयो ड्राफ्ट छोटो र राम्रो बनाउनुहोस्:\n' + draft.slice(0, 600) : '');
    this._aiBusy = true;
    if(btn){ btn.disabled = true; btn.textContent = '⏳ AI ले लेख्दैछ…'; }
    st.innerHTML = '⏳ AI ले "' + esc(topic) + '" म्यासेज ' + (draft ? 'सुधार्दैछ' : 'लेख्दैछ') + '… (' + Math.round(this._AI_TIMEOUT_MS/1000) + ' सेकेन्डसम्म)';
    var r; try { r = await AIAssistant._callAI(pick, system, user, { timeoutMs: this._AI_TIMEOUT_MS, maxTokens: 2048 }); } catch(e){ r = { error: e.message }; }
    this._aiBusy = false;
    if(btn){ btn.disabled = false; btn.textContent = '🤖 AI ले लेख्नुहोस् / सुधार्नुहोस्'; }
    if(r && r.text && r.text.trim()){
      ta.value = r.text.trim();
      try { ta.dispatchEvent(new Event('input')); } catch(e){}
      st.innerHTML = '✅ AI (' + esc(pick.label) + ') ले ' + (draft ? 'सुधार्यो' : 'लेख्यो') + ' — तलबाट WhatsApp / SMS / Copy गर्नुहोस्।';
    } else {
      useFallback('AI चलेन: ' + ((r && r.error) || 'unknown'));
    }
  },
  addTemplate: function(){
    var n=prompt('Template name:'); if(!n) return;
    var t=prompt('Message text:'); if(!t) return;
    var list=STORE.get('pk3_templates',null)||Followups._defTpl();
    list.push({name:n.trim(),text:t.trim()});
    STORE.set('pk3_templates',list); this.render();
    App.toast('✅ Template added','success');
  },
  resetTemplates: function(){
    if(!confirm('Walk-in templates reset गर्ने?\nसबै custom templates हट्नेछन्।')) return;
    STORE.set('pk3_templates', Followups._defTpl());
    this.render();
    App.toast('✅ Default templates restored','success');
  },
  showLog: function(){
    var visits=STORE.get('pk3_walkins',[]).slice(0,50);
    document.getElementById('greet-modal-body').innerHTML=visits.length?'<div class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Time</th></tr></thead><tbody>'+visits.map(function(v){return '<tr><td>'+v.custName+'</td><td>'+v.phone+'</td><td style="font-size:0.75rem;">'+fmtDisplayDate((v.time||'').slice(0,10))+' '+(v.time||'').slice(11,16)+'</td></tr>';}).join('')+'</tbody></table></div></div>':'<div class="empty-state" style="padding:20px;">No walk-in history</div>';
    document.getElementById('greet-modal').classList.add('open');
  }
};

