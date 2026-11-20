// ─── AI ASSISTANT MODULE ──────────────────────────────────────
var AIAssistant = {
  _mode: 'lead',
  _loading: false,
  _hist: [],
  _lastLeadData: null,
  _lastOutputText: '',

  _prompts: {
    lead: 'You are a lead analyst for Prerak Multipurpose Pvt. Ltd., a construction company in Nepal (Hetauda-2, Makwanpur). Analyze the pasted customer message (from Facebook/TikTok/WhatsApp/inquiry) and extract structured lead data. Respond ONLY with a valid JSON object (no markdown, no extra text) with these exact keys: name, phone, location, service, urgency (High/Medium/Low), budget_hint, followup_msg (short Nepali WhatsApp message to send), crm_note (1-2 line internal note). If a field is unknown write "N/A".',
    reply: 'You are a professional customer service representative for Prerak Multipurpose Pvt. Ltd., Nepal. Write a SHORT, warm, professional reply in Nepali (Devanagari) to the pasted customer message. Structure: 1) Greeting with name if known 2) Acknowledge their query 3) Offer solution or next step 4) Call-to-action (site visit / call / quotation). Keep it under 6 lines. Tone: helpful, confident, not salesy.',
    followup: 'You are a sales executive at Prerak Multipurpose Pvt. Ltd., Nepal. Write a friendly, non-pushy follow-up WhatsApp message in Nepali for the pasted customer context. Include: reference to previous discussion, soft check-in, value reminder (free site visit / free estimate), and a gentle CTA. Max 6 lines. Do NOT use pressure tactics.',
    estimate: 'You are a construction estimator for Prerak Multipurpose Pvt. Ltd. Based on the pasted project description or customer requirement, suggest a structured estimate outline. Format: PROJECT TYPE header, then a list of ITEMS with columns: Item | Unit | Approx Qty | Note. Then add: Rate Note (what rates to confirm), Special Considerations, Quotation Remarks. Do NOT invent final amounts unless rates are provided. Respond in a mix of English and Nepali.',
    competitor: 'You are a marketing strategist for Prerak Multipurpose Pvt. Ltd., Nepal. Analyze the pasted competitor post/offer/ad. Extract: 1) Service offered 2) Pricing hint 3) Marketing angle/style 4) Strengths 5) Weaknesses/gaps. Then suggest a BETTER post idea for Prerak Multipurpose highlighting: UPVC, Gypsum, Interior, full renovation, free site visit. Use Nepali language and strong CTA. Be specific and actionable.'
  },

  _modeConfig: {
    lead:       { icon:'🔍', label:'Analyze Lead',        btnLabel:'Analyze',           ph:'यहाँ Facebook / TikTok / WhatsApp / Inquiry को text paste गर्नुस्...' },
    reply:      { icon:'💬', label:'Customer Reply',      btnLabel:'Generate Reply',     ph:'Customer को message वा query यहाँ paste गर्नुस्...' },
    followup:   { icon:'📞', label:'Follow-up Message',   btnLabel:'Generate Follow-up', ph:'Previous conversation summary वा customer details paste गर्नुस्...' },
    estimate:   { icon:'🧾', label:'Estimate Suggest',    btnLabel:'Suggest Estimate',   ph:'Project description paste गर्नुस्। जस्तै: "3 room interior, UPVC 5 windows, gypsum ceiling..."' },
    competitor: { icon:'📊', label:'Competitor / Market', btnLabel:'Analyze',            ph:'Competitor को post, offer, वा ad text यहाँ paste गर्नुस्...' }
  },

  render: function(){
    var pg = document.getElementById('page-ai-assistant');
    if(!pg) return;
    var modeKeys = ['lead','reply','followup','estimate','competitor'];
    var modeBtns = modeKeys.map(function(k){
      var c = AIAssistant._modeConfig[k];
      return '<button id="ai-mode-btn-'+k+'" onclick="AIAssistant.setMode(\''+k+'\')" class="ai-mode-btn" style="flex:1;min-width:110px;padding:8px 6px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#fff;font-size:0.73rem;font-weight:600;cursor:pointer;transition:all .18s;">'+c.icon+'<br><span style="font-size:0.68rem;opacity:.85;">'+c.label+'</span></button>';
    }).join('');

    pg.innerHTML = '<div style="max-width:800px;margin:0 auto;">'

      // ── Header ──
      +'<div style="background:linear-gradient(135deg,#1a0533 0%,#2d0a5e 60%,#0f172a 100%);border-radius:14px;margin-bottom:12px;overflow:hidden;">'
        +'<div style="padding:16px 18px 10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">'
          +'<div><div style="font-size:1.15rem;font-weight:800;color:#fff;letter-spacing:-.3px;">🤖 AI Sales Assistant</div>'
          +'<div style="font-size:0.7rem;color:rgba(255,255,255,.5);margin-top:2px;">Powered by AI (Gemini / Claude / OpenAI) · PRERAK MULTIPURPOSE PVT LTD</div></div>'
          +'<div id="ai-status-badge" style="font-size:0.68rem;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);">Ready</div>'
        +'</div>'
        +'<div style="padding:0 12px 14px;display:flex;gap:7px;flex-wrap:wrap;">'+modeBtns+'</div>'
      +'</div>'

      // ── Input card ──
      +'<div class="card" style="margin-bottom:12px;">'
        +'<div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">'
          +'<div id="ai-mode-label" style="font-weight:700;font-size:0.88rem;color:var(--accent);">🔍 Analyze Lead</div>'
          +'<div style="display:flex;gap:6px;">'
            +'<button onclick="AIAssistant.clearInput()" style="padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);font-size:0.7rem;cursor:pointer;">🗑️ Clear</button>'
            +'<button onclick="AIAssistant.pasteClipboard()" style="padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);font-size:0.7rem;cursor:pointer;">📋 Paste</button>'
          +'</div>'
        +'</div>'
        +'<div style="padding:12px 14px;">'
          +AIAssistant._custPickerHTML()
          +'<textarea id="ai-customer-input" rows="5" style="width:100%;box-sizing:border-box;resize:vertical;border:1.5px solid var(--border);border-radius:8px;padding:10px;font-size:0.84rem;background:var(--surface-2);color:var(--text);outline:none;" placeholder="यहाँ text paste गर्नुस्..."></textarea>'
          +'<div style="margin-top:10px;display:flex;align-items:center;gap:10px;">'
            +'<button onclick="AIAssistant.analyze()" id="ai-send-btn" style="padding:10px 22px;border-radius:8px;border:none;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-weight:700;font-size:0.84rem;cursor:pointer;">⚡ <span id="ai-btn-label">Analyze</span></button>'
            +'<div id="ai-spinner" style="display:none;font-size:0.78rem;color:var(--text-muted);">🤖 AI thinking...</div>'
          +'</div>'
        +'</div>'
      +'</div>'

      // ── Output card ──
      +'<div class="card" id="ai-output-card" style="margin-bottom:12px;display:none;">'
        +'<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">'
          +'<div style="font-weight:700;font-size:0.85rem;">✨ AI Output</div>'
          +'<div style="display:flex;gap:6px;">'
            +'<button onclick="AIAssistant.copyOutput()" style="padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);font-size:0.7rem;cursor:pointer;">📋 Copy</button>'
            +'<button id="ai-addcrm-btn" onclick="AIAssistant.addToCRM()" style="display:none;padding:3px 12px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-size:0.7rem;font-weight:600;cursor:pointer;">➕ Add to CRM</button>'
          +'</div>'
        +'</div>'
        +'<div id="ai-output-body" style="padding:14px;"></div>'
      +'</div>'

      // ── Session history ──
      +'<div class="card" style="margin-bottom:12px;">'
        +'<div onclick="AIAssistant.toggleHistory()" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">'
          +'<div style="font-weight:600;font-size:0.8rem;color:var(--text-muted);">💬 Session History <span id="ai-hist-count" style="background:var(--accent);color:#fff;border-radius:10px;padding:1px 7px;font-size:0.68rem;margin-left:5px;">0</span></div>'
          +'<span id="ai-hist-toggle" style="font-size:0.75rem;color:var(--text-muted);">▼</span>'
        +'</div>'
        +'<div id="ai-chat-log" style="display:none;max-height:280px;overflow-y:auto;border-top:1px solid var(--border);"></div>'
      +'</div>'

      +'</div>';

    this.setMode(this._mode);
  },

  setMode: function(mode){
    this._mode = mode;
    var cfg = this._modeConfig[mode];
    var lbl = document.getElementById('ai-mode-label');
    if(lbl) lbl.textContent = cfg.icon+' '+cfg.label;
    var bl = document.getElementById('ai-btn-label');
    if(bl) bl.textContent = cfg.btnLabel;
    var ta = document.getElementById('ai-customer-input');
    if(ta) ta.placeholder = cfg.ph;
    if(ta && this._selCust && ta.value === this._lastFill){ ta.value = this._custContext(this._selCust, mode); this._lastFill = ta.value; }
    Object.keys(this._modeConfig).forEach(function(k){
      var btn = document.getElementById('ai-mode-btn-'+k);
      if(!btn) return;
      if(k===mode){ btn.style.background='rgba(124,58,237,0.65)'; btn.style.borderColor='#a78bfa'; }
      else { btn.style.background='rgba(255,255,255,0.07)'; btn.style.borderColor='rgba(255,255,255,0.15)'; }
    });
    var oc = document.getElementById('ai-output-card');
    if(oc) oc.style.display='none';
  },

  clearInput: function(){
    var ta = document.getElementById('ai-customer-input');
    if(ta){ ta.value=''; ta.focus(); }
  },

  pasteClipboard: async function(){
    try{
      var t = await navigator.clipboard.readText();
      var ta = document.getElementById('ai-customer-input');
      if(ta){ ta.value=t; ta.focus(); }
    } catch(e){ showToast('Clipboard denied — manually paste गर्नुस्','warning'); }
  },

  // ── Customer auto-fill (v6.8.1) ──
  _selCust: '', _lastFill: '',
  _custPickerHTML: function(){
    var custs = (STORE.get('pk3_customers',[])||[]).filter(function(c){ return c && c.name; });
    var opts = custs.map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===AIAssistant._selCust?' selected':'')+'>'+esc(c.name)+(c.phone?' — '+esc(c.phone):'')+'</option>'; }).join('');
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">'
      +'<label style="font-size:0.76rem;font-weight:700;white-space:nowrap;">👤 Customer छान्नुहोस्</label>'
      +'<select id="ai-cust-sel" onchange="AIAssistant.fillCustomer(this.value)" style="flex:1;min-width:180px;padding:6px 8px;font-size:0.8rem;">'
      +'<option value="">— Customer नछानी आफैं लेख्नुहोस् —</option>'+opts+'</select></div>'
      +'<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:8px;"><span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">⚡ १-क्लिक WhatsApp:</span>'
      +[['walkin','🚶 Walk-in'],['due','💰 Payment Reminder'],['quoteready','📋 Quotation Ready'],['complete','✅ Work Complete'],['greet','👋 Lead Greeting']].map(function(q){
        return '<button type="button" onclick="AIAssistant.quickTask(\''+q[0]+'\')" style="padding:4px 10px;border-radius:14px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:0.72rem;cursor:pointer;">'+q[1]+'</button>';
      }).join('')+'</div>';
  },
  _custContext: function(id, mode){
    var c = (STORE.get('pk3_customers',[])||[]).find(function(x){ return x && x.id===id; });
    if(!c) return '';
    var svcs = Customers.getServices(c).map(function(s){ return [s.work, s.subwork].filter(Boolean).join(' - '); }).filter(Boolean);
    var fus = (STORE.get('pk3_followups',[])||[]).filter(function(f){ return f && f.custId===id; }).slice(0,3);
    var qs = (STORE.get('pk3_quotations',[])||[]).filter(function(q){ return q && q.custId===id; }).slice(0,2);
    var head = {
      lead: 'तलको customer को विवरण analyze गरेर lead data निकाल्नुहोस्:',
      reply: 'तलको customer लाई शिष्ट जवाफ लेख्नुहोस्:',
      followup: 'तलको customer लाई follow-up WhatsApp म्यासेज लेख्नुहोस्:',
      estimate: 'तलको customer को आवश्यकता अनुसार estimate सुझाउनुहोस्:',
      competitor: 'तलको customer को सेवा क्षेत्र (service) मा हेटौंडाको बजार र प्रतिस्पर्धा विश्लेषण गर्नुहोस्:',
      _closing: 'तलको customer को Lead Stage र बाँकी रकम हेरेर deal close गर्ने/भुक्तानी लिने उत्तम अर्को कदम सुझाउनुहोस्:'
    }[mode || this._mode] || '';
    var lines = [head, '', 'नाम: '+c.name];
    var stg = SmartRem.stageFor(c), due = SmartRem.dueFor(id);
    lines.push('Lead Stage: '+stg.stage+(stg.auto?' (auto)':''));
    lines.push('बाँकी रकम (Due): '+(due.total>0.5 ? fmtRs(due.total)+(due.inv>0.5&&due.ledger>0.5?' [Invoice '+fmtRs(due.inv)+' + Ledger '+fmtRs(due.ledger)+']':'') : 'छैन (Rs.0)'));
    var lastFu = (STORE.get('pk3_followups',[])||[]).filter(function(f){ return f && f.custId===id && f.note; }).sort(function(a,b){ return compareBs(b.fuDateBs||'', a.fuDateBs||''); })[0];
    if(lastFu) lines.push('पछिल्लो नोट: '+lastFu.note+(lastFu.fuDateBs?' ('+bsStringToDisplay(lastFu.fuDateBs)+')':''));
    if(c.phone) lines.push('फोन: '+c.phone);
    if(c.address) lines.push('ठेगाना: '+c.address);
    if(svcs.length) lines.push('सेवा: '+svcs.join(', '));
    if(c.total) lines.push('कुल काम रकम: '+fmtRs(c.total));
    if(c.advance) lines.push('Advance: '+fmtRs(c.advance));
    if(c.notes) lines.push('नोट: '+c.notes);
    if(c.fuDateBs) lines.push('Follow-up मिति: '+bsStringToDisplay(c.fuDateBs));
    fus.forEach(function(f){ if(f.note) lines.push('Follow-up नोट ('+(f.status||'')+'): '+f.note); });
    qs.forEach(function(q){ lines.push('Quotation: '+[q.work,q.subwork].filter(Boolean).join(' - ')+(q.amount?' · '+fmtRs(q.amount):'')+' · '+(q.status||'')); });
    return lines.join('\n');
  },
  quickTask: function(type){
    var id = this._selCust || '';
    var c = id ? (STORE.get('pk3_customers',[])||[]).find(function(x){ return x && x.id===id; }) : null;
    if(type==='due' && c){
      var d = SmartRem.dueFor(c.id);
      if(d.total <= 0.5){ App.toast('ℹ️ '+c.name+' को बाँकी रकम छैन (Rs.0)','info',3000); }
      AIWA.open({ type:'due', ref:'', custId:c.id, name:c.name, phone:c.phone||'', amount:d.total });
      return;
    }
    if(type==='due' && !c){ App.toast('💰 Payment Reminder का लागि पहिले Customer छान्नुहोस्','warning',3000); return; }
    AIWA.open({ type:type, ref:'', custId:c?c.id:'', name:c?c.name:'', phone:c?(c.phone||''):'' });
  },
  fillCustomer: function(id){
    this._selCust = id || '';
    var ta = document.getElementById('ai-customer-input'); if(!ta) return;
    if(!id){ if(ta.value === this._lastFill) ta.value = ''; this._lastFill = ''; return; }
    ta.value = this._custContext(id, this._mode); this._lastFill = ta.value;
  },
  openFor: function(id){
    this._selCust = id;
    App.navigate('ai-assistant');
    var self = this;
    setTimeout(function(){
      var sel = document.getElementById('ai-cust-sel'); if(sel) sel.value = id;
      self.fillCustomer(id);
      try { App.toast('🤖 Customer भरियो — ५ मध्ये जुनसुकै ट्याब छानेर चलाउनुहोस्','success',3000); } catch(e){}
    }, 120);
  },

  // ── Provider selection (v6.8.1): model chooses provider; falls back to whichever key exists ──
  _pickProvider: function(){
    var aiS = STORE.get('pk3_ai_settings',{}) || {};
    var gemMain = (STORE.get('pk3_gem_key','')||'').trim(), gemBackup = (STORE.get('pk3_gem_key2','')||'').trim();
    var keys = { anthropic:(STORE.get('pk3_ai_key','')||'').trim(), gemini:(gemMain || gemBackup), openai:(STORE.get('pk3_oai_key','')||'').trim() };
    var defs = { anthropic:'claude-sonnet-4-6', gemini:'gemini-3.8-flash', openai:'gpt-4o-mini' };
    var labels = { anthropic:'Anthropic Claude', gemini:'Google Gemini', openai:'OpenAI' };
    var model = aiS.model || '';
    if(/^gemini-2\.5/.test(model)) model = 'gemini-3.8-flash';
    var prov = /^gemini/.test(model) ? 'gemini' : (/^gpt|^o\d/.test(model) ? 'openai' : 'anthropic');
    if(!keys[prov]){
      var order = ['gemini','anthropic','openai'], found = null;
      for(var i=0;i<order.length;i++){ if(keys[order[i]]){ found = order[i]; break; } }
      if(!found) return null;
      prov = found; model = defs[prov];
    }
    if(!model) model = defs[prov];
    var pick = { provider:prov, key:keys[prov], model:model, label:labels[prov]+' ('+model+')' };
    // v6.9.0: Backup Gemini key — used automatically when the main key hits 429 / quota
    if(prov==='gemini'){
      if(!gemMain && gemBackup) pick.label += ' — Backup Key';
      else if(gemBackup && gemBackup!==gemMain) pick.backupKey = gemBackup;
    }
    return pick;
  },
  _TIMEOUT_MS: 25000,
  _fetchT: async function(url, opts, msOverride){
    var ctl = (typeof AbortController!=='undefined') ? new AbortController() : null;
    var ms = msOverride || this._TIMEOUT_MS, timer;
    var o = {}; for(var k in (opts||{})) o[k]=opts[k]; if(ctl) o.signal = ctl.signal;
    var timeout = new Promise(function(_, rej){ timer = setTimeout(function(){ try{ if(ctl) ctl.abort(); }catch(e){} var er=new Error('TIMEOUT'); er.isTimeout=true; rej(er); }, ms); });
    try { return await Promise.race([fetch(url, o), timeout]); }
    catch(e){ if(e && (e.isTimeout || e.name==='AbortError')){ var t=new Error('TIMEOUT'); t.isTimeout=true; throw t; } throw e; }
    finally { clearTimeout(timer); }
  },
  _callAI: async function(pick, system, input, callOpts){
    var self = this;
    var co = callOpts || {}, tms = co.timeoutMs || self._TIMEOUT_MS, maxTok = co.maxTokens || 8192;
    try{
      var res, data;
      if(pick.provider==='gemini'){
        var gemCall = async function(model, noThink){
          var r = await self._fetchT('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(pick.key),{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              systemInstruction:{ parts:[{ text: system }] },
              contents:[{ role:'user', parts:[{ text: input }] }],
              generationConfig: noThink ? { maxOutputTokens: maxTok } : { maxOutputTokens: maxTok, thinkingConfig:{ thinkingLevel:'low' } }
            })
          }, tms);
          var d = {}; try { d = await r.json(); } catch(e){}
          // Older/other models may reject thinkingLevel → retry once without it
          if(!noThink && !r.ok && r.status===400 && /thinking/i.test((d.error&&d.error.message)||'')) return gemCall(model, true);
          return { res:r, data:d };
        };
        var g = await gemCall(pick.model);
        var gErr = (g.data.error && g.data.error.message) || '';
        // Model retired / not found → ask Google which Flash model is current, retry once, remember it
        if((!g.res.ok || g.data.error) && (g.res.status===404 || /no longer available|not found|is not supported|update your code/i.test(gErr))){
          var newer = (gErr.match(/models\/(gemini-[a-z0-9.\-]+)/gi)||[]).map(function(x){ return x.replace(/^models\//i,''); }).filter(function(m){ return m!==pick.model; })[0];
          if(!newer){
            try {
              var lr = await self._fetchT('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(pick.key), {}, tms);
              var ld = await lr.json();
              var flash = (ld.models||[]).filter(function(m){
                return /^models\/gemini-[\d.]+-flash$/.test(m.name) && (m.supportedGenerationMethods||[]).indexOf('generateContent')>=0;
              }).map(function(m){ return m.name.replace('models/',''); });
              flash.sort(function(a,b){ return parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]); });
              newer = flash[0];
            } catch(e){}
          }
          if(newer){
            g = await gemCall(newer);
            if(g.res.ok && !g.data.error){
              try { var st = STORE.get('pk3_ai_settings',{})||{}; st.model = newer; STORE.set('pk3_ai_settings', st); } catch(e){}
              pick.model = newer; pick.label = 'Google Gemini ('+newer+')';
            }
          }
        }
        // v6.9.0: free-tier limit (429 / quota) → try the Backup Gemini key once
        var isQuota = function(gg){ var m = (gg.data && gg.data.error && (gg.data.error.message + ' ' + (gg.data.error.status||''))) || ''; return gg.res.status===429 || /quota|rate.?limit|RESOURCE_EXHAUSTED|exceeded/i.test(m); };
        if(isQuota(g)){
          if(pick.backupKey){
            var mainKey = pick.key;
            pick.key = pick.backupKey;
            var g2 = await gemCall(pick.model);
            if(!isQuota(g2)){
              g = g2; pick.label = 'Google Gemini ('+pick.model+') — Backup Key';
            } else {
              pick.key = mainKey;
              return { error: '🔑 मुख्य र Backup दुवै Gemini key को निःशुल्क सीमा (429 / Quota) सकियो। केही समयपछि फेरि प्रयास गर्नुहोस् — अहिलेलाई रेडीमेड नेपाली टेम्प्लेट प्रयोग गर्नुहोस्।', quota: true };
            }
          } else {
            return { error: '🔑 Gemini key को निःशुल्क सीमा (429 / Quota) सकियो। Settings → AI Assistant Settings मा "Backup Gemini API Key" थप्नुहोस्, वा केही समयपछि प्रयास गर्नुहोस्। अहिलेलाई रेडीमेड नेपाली टेम्प्लेट प्रयोग गर्नुहोस्।', quota: true };
          }
        }
        res = g.res; data = g.data;
        if(!res.ok || data.error) return { error: (data.error && data.error.message) || ('Gemini HTTP '+res.status) };
        var c = data.candidates && data.candidates[0];
        var txt = c && c.content && c.content.parts ? c.content.parts.filter(function(p){ return !p.thought; }).map(function(p){ return p.text||''; }).join('') : '';
        if(!txt){
          var why = (data.promptFeedback && data.promptFeedback.blockReason) || (c && c.finishReason) || 'empty';
          return { error: 'Gemini ले उत्तर दिएन ('+why+')' };
        }
        return { text: txt };
      }
      if(pick.provider==='openai'){
        res = await self._fetchT('https://api.openai.com/v1/chat/completions',{
          method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+pick.key},
          body:JSON.stringify({ model:pick.model, max_tokens:1400, messages:[{role:'system',content:system},{role:'user',content:input}] })
        }, tms);
        data = await res.json();
        if(!res.ok || data.error) return { error: (data.error && data.error.message) || ('OpenAI HTTP '+res.status) };
        return { text: data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '' };
      }
      res = await self._fetchT('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key': pick.key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body:JSON.stringify({ model: pick.model, max_tokens:1400, system: system, messages:[{role:'user',content:input}] })
      }, tms);
      data = await res.json();
      if(!res.ok || data.error) return { error: (data.error && data.error.message) || ('Anthropic HTTP '+res.status) };
      return { text: (data.content&&data.content[0]&&data.content[0].text) || '' };
    } catch(e){
      if(e && e.isTimeout) return { error: '⏱️ '+Math.round(tms/1000)+' सेकेन्डभित्र '+(pick.label||'AI')+' बाट जवाफ आएन (Timeout)। Internet जाँचेर फेरि प्रयास गर्नुहोस्।' };
      return { error: e.message || 'network' };
    }
  },

  analyze: async function(){
    var input = (document.getElementById('ai-customer-input')||{}).value || '';
    var ob = document.getElementById('ai-output-body');
    var card = document.getElementById('ai-output-card');
    var sendBtn = document.getElementById('ai-send-btn');
    var spinner = document.getElementById('ai-spinner');
    var badge = document.getElementById('ai-status-badge');
    var acb = document.getElementById('ai-addcrm-btn');
    if(acb) acb.style.display='none';

    // BYOK: read the customer's own key (saved in Settings → pk3_ai_key)
    var aiPick = this._pickProvider();
    var apiKey = aiPick ? aiPick.key : '';

    // No key yet → friendly setup prompt (NOT a dead "coming soon")
    if(!apiKey){
      if(card) card.style.display='';
      if(spinner) spinner.style.display='none';
      if(badge){ badge.textContent='Setup needed'; badge.style.background='rgba(234,179,8,.25)'; }
      if(ob){
        ob.innerHTML =
          '<div style="padding:22px 16px;text-align:center;">'
          +'<div style="font-size:2.2rem;margin-bottom:8px;">🤖</div>'
          +'<div style="font-size:1.02rem;font-weight:800;color:var(--accent);margin-bottom:8px;">AI Assistant सक्रिय गर्नुहोस्</div>'
          +'<div style="font-size:0.83rem;color:var(--text-muted);line-height:1.7;max-width:460px;margin:0 auto 14px;">'
          +'AI Assistant ले customer message बाट lead बनाउन, estimate draft गर्न, र प्रतिस्पर्धी विश्लेषण जस्ता काममा मद्दत गर्छ।<br><br>'
          +'यो चलाउन तपाईंको <b>आफ्नै API key</b> (Google Gemini — निःशुल्क, वा Anthropic / OpenAI) चाहिन्छ — तपाईंको आफ्नै account र billing (Prerak को कुनै key संलग्न हुँदैन)।'
          +'</div>'
          +'<button onclick="App.navigate(\'settings\')" class="btn btn-sm btn-primary">⚙️ Settings मा key हाल्नुहोस्</button>'
          +'</div>';
      }
      if(sendBtn) sendBtn.disabled=false;
      this._loading=false;
      return;
    }

    // Key present → real Anthropic call with the customer's own key
    if(!input.trim()){ App.toast('कृपया केही text हाल्नुहोस्','warning'); return; }
    if(this._loading) return;
    this._loading=true;
    if(card) card.style.display='';
    if(ob) ob.innerHTML='<div style="padding:14px;color:var(--text-muted);">🤖 Analyzing...</div>';
    if(sendBtn) sendBtn.disabled=true;
    if(spinner) spinner.style.display='';
    if(badge){ badge.textContent='Working...'; badge.style.background='rgba(255,255,255,.15)'; }
    var mode = this._mode;
    var aiS  = STORE.get('pk3_ai_settings',{}) || {};
    try{
      var aiRes = await this._callAI(aiPick, this._prompts[mode], input);
      if(aiRes.error){
        var em = aiRes.error;
        if(ob) ob.innerHTML='<div style="color:var(--red);padding:14px;line-height:1.6;">❌ '+esc(em)+'<br><br><span style="font-size:0.76rem;color:var(--text-muted);">('+esc(aiPick.label)+') API key सही छ कि र Internet छ कि जाँच्नुहोस्।</span></div>';
        if(badge){ badge.textContent='Error'; badge.style.background='rgba(220,38,38,.3)'; }
        this._loading=false; if(sendBtn) sendBtn.disabled=false; if(spinner) spinner.style.display='none';
        return;
      }
      var reply = aiRes.text || 'Error: no response';

      this._hist.push({mode:mode,input:input.slice(0,100)+(input.length>100?'...':''),output:reply,ts:Date.now()});
      this._updateHistoryUI();

      if(mode==='lead'){
        this._renderLeadOutput(reply);
        if(acb) acb.style.display='';
      } else if(mode==='estimate'){
        this._renderEstimateOutput(reply);
      } else if(mode==='competitor'){
        this._renderSectionsOutput(reply);
      } else {
        this._renderTextOutput(reply, this._modeConfig[mode].icon+' '+this._modeConfig[mode].label);
      }

      if(badge){ badge.textContent='✅ Done'; badge.style.background='rgba(22,163,74,.3)'; }
      setTimeout(function(){ var b=document.getElementById('ai-status-badge'); if(b){b.textContent='Ready';b.style.background='rgba(255,255,255,.15)';} },2500);

    } catch(e){
      if(ob) ob.innerHTML='<div style="color:var(--red);padding:14px;line-height:1.6;">❌ Error: '+esc(e.message||'network')+'<br><br><span style="font-size:0.76rem;color:var(--text-muted);">Internet जडान र API key जाँच्नुहोस्।</span></div>';
      if(badge){ badge.textContent='Error'; badge.style.background='rgba(220,38,38,.3)'; }
    }
    this._loading=false;
    if(sendBtn) sendBtn.disabled=false;
    if(spinner) spinner.style.display='none';
  },

  _renderLeadOutput: function(raw){
    var ob = document.getElementById('ai-output-body');
    if(!ob) return;
    var d = {};
    try{ d = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
    catch(e){ ob.innerHTML='<pre style="white-space:pre-wrap;font-size:.82rem;">'+esc(raw)+'</pre>'; return; }
    this._lastLeadData = d;
    var urgColor = {High:'#dc2626',Medium:'#d97706',Low:'#16a34a'};
    var fields=[
      {k:'name',       ico:'👤',lbl:'Name'},
      {k:'phone',      ico:'📞',lbl:'Phone'},
      {k:'location',   ico:'📍',lbl:'Location'},
      {k:'service',    ico:'🏠',lbl:'Required Service'},
      {k:'urgency',    ico:'⚡',lbl:'Urgency'},
      {k:'budget_hint',ico:'💰',lbl:'Budget Hint'}
    ];
    var rows = fields.map(function(f){
      var v = d[f.k]||'N/A';
      var clr = f.k==='urgency'&&urgColor[v] ? 'color:'+urgColor[v]+';font-weight:700;' : '';
      return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);">'
        +'<div style="width:130px;min-width:130px;font-size:.73rem;color:var(--text-muted);">'+f.ico+' '+f.lbl+'</div>'
        +'<div style="flex:1;font-size:.84rem;font-weight:600;'+clr+'">'+esc(v)+'</div>'
        +'</div>';
    }).join('');
    var fm = d.followup_msg||''; var cn = d.crm_note||'';
    ob.innerHTML = '<div style="margin-bottom:12px;">'+rows+'</div>'
      +(fm?'<div style="background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.2);border-radius:8px;padding:12px;margin-bottom:8px;">'
          +'<div style="font-size:.7rem;font-weight:700;color:#2563eb;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">📱 Suggested Follow-up WhatsApp</div>'
          +'<div style="font-size:.84rem;line-height:1.65;white-space:pre-wrap;">'+esc(fm)+'</div>'
          +'<button onclick="AIAssistant._copyField(\''+encodeURIComponent(fm)+'\')" style="margin-top:8px;padding:3px 10px;border-radius:6px;border:1px solid #2563eb;background:transparent;color:#2563eb;font-size:.7rem;cursor:pointer;">📋 Copy</button>'
          +'</div>':'')
      +(cn?'<div style="background:var(--surface-2);border-radius:8px;padding:10px 12px;font-size:.78rem;color:var(--text-muted);"><strong style="color:var(--text);">📝 CRM Note: </strong>'+esc(cn)+'</div>':'');
  },

  _renderTextOutput: function(text, title){
    var ob = document.getElementById('ai-output-body');
    if(!ob) return;
    this._lastOutputText = text;
    ob.innerHTML = '<div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.18);border-radius:8px;padding:14px;">'
      +'<div style="font-size:.7rem;font-weight:700;color:#7c3aed;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">'+esc(title)+'</div>'
      +'<div style="font-size:.88rem;line-height:1.75;white-space:pre-wrap;color:var(--text);">'+esc(text)+'</div>'
      +'</div>';
  },

  _renderEstimateOutput: function(text){
    var ob = document.getElementById('ai-output-body');
    if(!ob) return;
    this._lastOutputText = text;
    var lines = text.split('\n');
    var html = '';
    lines.forEach(function(line){
      if(!line.trim()){ html+='<div style="height:5px;"></div>'; return; }
      if(line.match(/^#{1,3}\s/) || (line===line.toUpperCase()&&line.trim().length>3&&!/^\|/.test(line))){
        html+='<div style="font-weight:800;font-size:.86rem;color:var(--accent);margin:10px 0 4px;border-bottom:1px solid var(--border);padding-bottom:3px;">'+esc(line.replace(/^#+\s*/,''))+'</div>';
      } else if(line.match(/^\|/)){
        html+='<div style="font-family:monospace;font-size:.76rem;background:var(--surface-2);padding:3px 8px;border-radius:3px;white-space:pre;overflow-x:auto;">'+esc(line)+'</div>';
      } else if(line.match(/^[-•*]\s|^\d+\.\s/)){
        html+='<div style="padding:2px 0 2px 14px;font-size:.82rem;position:relative;"><span style="position:absolute;left:0;color:var(--accent);">•</span>'+esc(line.replace(/^[-•*]\s+|^\d+\.\s+/,''))+'</div>';
      } else {
        html+='<div style="font-size:.83rem;line-height:1.6;">'+esc(line)+'</div>';
      }
    });
    ob.innerHTML = '<div>'+html+'</div>';
  },

  _renderSectionsOutput: function(text){
    var ob = document.getElementById('ai-output-body');
    if(!ob) return;
    this._lastOutputText = text;
    var lines = text.split('\n');
    var html = '';
    var inBetter = false;
    lines.forEach(function(line){
      if(!line.trim()){ html+='<div style="height:5px;"></div>'; return; }
      var isBetter = /better post|suggest.*prerak|prerak.*post|हाम्रो/i.test(line);
      if(isBetter) inBetter = true;
      if(line.match(/^\d+\)|^#{1,3}\s|\*\*.*\*\*/)){
        if(inBetter&&/^\d+\)/.test(line)&&parseInt(line)<5) inBetter=false;
        var cleaned = line.replace(/^\d+\)\s*|\*\*/g,'').replace(/#{1,3}\s/,'');
        html+='<div style="font-weight:800;font-size:.86rem;color:'+(inBetter?'#16a34a':'var(--accent)')+';margin:10px 0 4px;border-bottom:1px solid var(--border);padding-bottom:3px;">'+esc(cleaned)+'</div>';
      } else if(line.match(/^[-•*]\s/)){
        html+='<div style="padding:2px 0 2px 14px;font-size:.82rem;position:relative;"><span style="position:absolute;left:0;color:var(--accent);">•</span>'+esc(line.replace(/^[-•*]\s+/,''))+'</div>';
      } else {
        html+='<div style="font-size:.83rem;line-height:1.65;'+(inBetter?'color:var(--text);':'')+'">'+esc(line)+'</div>';
      }
    });
    ob.innerHTML = '<div>'+html+'</div>';
  },

  copyOutput: function(){
    var ob = document.getElementById('ai-output-body');
    var text = ob ? (ob.innerText||ob.textContent) : '';
    if(navigator.clipboard) navigator.clipboard.writeText(text);
    showToast('Output copied!','success');
  },

  _copyField: function(encoded){
    var text = decodeURIComponent(encoded);
    if(navigator.clipboard) navigator.clipboard.writeText(text);
    showToast('Copied!','success');
  },

  addToCRM: function(){
    var d = this._lastLeadData;
    if(!d){ showToast('No lead data found','warning'); return; }
    var name  = (d.name&&d.name!='N/A') ? d.name  : '';
    var phone = (d.phone&&d.phone!='N/A')? d.phone : '';
    var note  = [d.crm_note, d.service&&d.service!='N/A'?'Service: '+d.service:'', d.urgency&&d.urgency!='N/A'?'Urgency: '+d.urgency:''].filter(Boolean).join(' | ');
    App.navigate('add-customer');
    setTimeout(function(){
      setVal('c-name', name);
      setVal('c-phone', phone);
      setVal('c-note', note);
      if(d.location&&d.location!='N/A') setVal('c-address', d.location);
      showToast('Lead data loaded — save गर्नुस्!','success');
    },350);
  },

  toggleHistory: function(){
    var log = document.getElementById('ai-chat-log');
    var tog = document.getElementById('ai-hist-toggle');
    if(!log) return;
    var shown = log.style.display!=='none';
    log.style.display = shown?'none':'';
    if(tog) tog.textContent = shown?'▼':'▲';
  },

  _updateHistoryUI: function(){
    var cnt = document.getElementById('ai-hist-count');
    if(cnt) cnt.textContent = this._hist.length;
    var log = document.getElementById('ai-chat-log');
    if(!log) return;
    var icons = {lead:'🔍',reply:'💬',followup:'📞',estimate:'🧾',competitor:'📊'};
    log.innerHTML = this._hist.slice().reverse().map(function(h){
      return '<div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:.77rem;">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:3px;">'
          +'<span style="font-weight:600;">'+(icons[h.mode]||'🤖')+' '+h.mode+'</span>'
          +'<span style="color:var(--text-muted);">'+h.time+'</span>'
        +'</div>'
        +'<div style="color:var(--text-muted);margin-bottom:4px;">'+esc(h.input)+'</div>'
        +'<div style="line-height:1.5;white-space:pre-wrap;">'+esc(h.output.slice(0,250))+(h.output.length>250?'…':'')+'</div>'
        +'</div>';
    }).join('');
  }
};

