// ─── BULK MESSAGE MODULE ──────────────────────────────────────
var BulkMsg = {
  render: function(){
    var folders=STORE.get('pk3_bulkFolders',[]); var templates=STORE.get('pk3_templates',null); if(!templates||!Array.isArray(templates)||!templates.length) templates=DEFAULT_TEMPLATES||Followups._defTpl();
    // Folders
    var fb=document.getElementById('bulk-folders'); if(fb) fb.innerHTML=folders.length?folders.map(function(f){return '<div class="card card-body" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:600;">📁 '+f.name+'</span><button onclick="BulkMsg.delFolder(\''+f.id+'\')" class="btn btn-xs btn-danger">🗑</button></div>';}).join(''):'<div style="color:var(--text-muted);font-size:0.82rem;padding:8px;">No folders yet</div>';
    // Templates
    var tb = document.getElementById('bulk-templates');
    if (tb) {
      tb.innerHTML = '';
      (templates||[]).forEach(function(t, i){
        if (!t) return;
        var div = document.createElement('div');
        div.className = 'template-item';
        div.style.cssText = 'margin-bottom:6px;cursor:pointer;padding:8px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);';
        var hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
        var nm = document.createElement('strong');
        nm.style.cssText = 'font-size:0.82rem;color:var(--text);';
        nm.textContent = t.name || ('Template '+(i+1));
        var del = document.createElement('button');
        del.className = 'btn btn-xs btn-danger';
        del.textContent = '🗑';
        del.onclick = function(e){ e.stopPropagation(); BulkMsg.delTemplate(i); };
        hdr.appendChild(nm); hdr.appendChild(del);
        var preview = document.createElement('div');
        preview.style.cssText = 'font-size:0.73rem;color:var(--text-muted);margin-top:4px;';
        preview.textContent = (t.text||'').slice(0,80) + (t.text&&t.text.length>80?'…':'');
        div.appendChild(hdr); div.appendChild(preview);
        div.addEventListener('click', function(){
          // Bulk msg uses generic fallback (no specific customer selected)
          var filled = fillTemplate(t, null);
          var el = document.getElementById('bulk-msg-text');
          if(el) { el.value = filled; el.focus(); }
          var preview = document.getElementById('bulk-msg-preview');
          if(preview) preview.textContent = filled;
        });
        tb.appendChild(div);
      });
    }
    // Recipients
    // v5.4: id-based checkbox + esc() + search support
    var custs = Customers.getData();
    var recip = document.getElementById('bulk-recipients');
    if (recip) {
      recip.innerHTML = '';
      custs.forEach(function (c) {
        var lab = document.createElement('label');
        lab.className = 'bulk-rec';
        lab.setAttribute('data-search', ((c.name || '') + ' ' + (c.phone || '')).toLowerCase());
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'bulk_recip';
        cb.value = c.id;                 // फोन होइन, id — डुप्लिकेट फोन भए पनि सही चल्छ
        cb.setAttribute('data-phone', c.phone || '');
        cb.style.accentColor = 'var(--accent)';
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' ' + (c.name || '')));
        var sp = document.createElement('span');
        sp.style.cssText = 'color:var(--text-muted);font-size:0.72rem;';
        sp.textContent = ' (' + (c.phone || '') + ')';
        lab.appendChild(sp);
        recip.appendChild(lab);
      });
    }
    // Service filter dropdown भर्ने
    var sf = document.getElementById('bulk-svc-filter');
    if (sf) {
      var seen = {};
      custs.forEach(function (c) {
        Customers.getServices(c).forEach(function (x) { if (x.work) seen[x.work] = (seen[x.work] || 0) + 1; });
      });
      var keys = Object.keys(seen).sort();
      sf.innerHTML = '<option value="">🔧 By Service...</option>' + keys.map(function (k) {
        return '<option value="' + esc(k) + '">' + esc(k) + ' (' + seen[k] + ')</option>';
      }).join('');
    }
    this.filterRecipients();
    this.updateCount();
  },
  // ─── v5.4: search-aware recipient selection ───
  _rows: function () { return Array.prototype.slice.call(document.querySelectorAll('#bulk-recipients .bulk-rec')); },
  _visibleBoxes: function () {
    return this._rows().filter(function (r) { return r.style.display !== 'none'; })
                       .map(function (r) { return r.querySelector('input[name="bulk_recip"]'); })
                       .filter(Boolean);
  },
  _allBoxes: function () {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="bulk_recip"]'));
  },
  _isFiltered: function () { return !!(getVal('bulk-search') || '').trim(); },

  // नाम / फोन ले live filter — check गरिसकेको छान्ने मिट्दैन
  filterRecipients: function () {
    var q = (getVal('bulk-search') || '').trim().toLowerCase();
    this._rows().forEach(function (r) {
      var hay = r.getAttribute('data-search') || r.textContent.toLowerCase();
      r.style.display = (!q || hay.indexOf(q) >= 0) ? '' : 'none';
    });
    this.updateCount();
  },

  updateCount: function () {
    var checked = document.querySelectorAll('input[name="bulk_recip"]:checked').length;
    var txt = checked + ' selected';
    if (this._isFiltered()) txt += ' (' + this._visibleBoxes().length + ' shown)';
    setText('bulk-count', txt);
  },

  // search चालू छ भने देखिएका मात्र — नत्र सबै
  selectAll: function () {
    var boxes = this._isFiltered() ? this._visibleBoxes() : this._allBoxes();
    boxes.forEach(function (c) { c.checked = true; });
    this.updateCount();
    if (this._isFiltered()) App.toast('✅ ' + boxes.length + ' जना थपिए', 'success');
  },

  deselectAll: function () {
    this._allBoxes().forEach(function (c) { c.checked = false; });
    var sf = document.getElementById('bulk-svc-filter'); if (sf) sf.value = '';
    this.updateCount();
  },

  // dropdown बाट service छान्दा — services[] भित्र खोज्छ (prompt हटाइयो)
  selectByService: function () {
    var sf = document.getElementById('bulk-svc-filter');
    var svc = sf ? sf.value : '';
    if (!svc) return;
    var custs = Customers.getData(), n = 0;
    var byId = {}; custs.forEach(function (c) { byId[c.id] = c; });
    this._allBoxes().forEach(function (inp) {
      var c = byId[inp.value];
      if (c && Customers.hasService(c, svc)) { inp.checked = true; n++; }
    });
    this.updateCount();
    App.toast(n ? ('✅ ' + svc + ' — ' + n + ' जना छानिए') : ('ℹ️ ' + svc + ' को customer भेटिएन'), n ? 'success' : 'info');
  },
  sendWA: function(){
    var msg=getVal('bulk-msg-text');
    if(!msg){App.toast('Message लेख्नुस्!','error');return;}
    var checked = Array.from(document.querySelectorAll('input[name="bulk_recip"]:checked'));
    if(!checked.length){App.toast('Recipients छान्नुस्!','error');return;}
    // v5.4: checkbox को value अब customer id हो (डुप्लिकेट फोन safe)
    var custs = Customers.getData();
    var recipients = checked.map(function(el){
      var cust = custs.find(function(x){ return x.id === el.value; });
      var ph = cust ? cust.phone : (el.getAttribute('data-phone') || el.value);
      return { phone: ph, name: cust ? cust.name : ph, cust: cust };
    }).filter(function(r){ return r.phone; });
    if(!recipients.length){ App.toast('❗ छानिएका customer को फोन नम्बर छैन','error'); return; }
    // Personalize message per recipient if it has placeholders
    Wa.bulkSend(recipients, function(r){
      if(typeof fillTemplate === 'function' && r.cust){
        return fillTemplate({text: msg}, r.cust);
      }
      return msg.replace(/\{name\}/g, r.name || '');
    }, { title: '📱 Bulk WhatsApp ('+recipients.length+')' });
    try { Audit.log('BULK','Bulk WA initiated for '+recipients.length+' recipients'); } catch(e){}
  },
  sendSMS: function(){ App.toast('SMS: contacts copied — use your SMS app','info'); this.copy(); },
  copy: function(){ var phones=Array.from(document.querySelectorAll('input[name="bulk_recip"]:checked')).map(function(c){return c.getAttribute('data-phone')||c.value;}).filter(Boolean).join(','); if(navigator.clipboard)navigator.clipboard.writeText(phones); App.toast('📋 '+phones.split(',').length+' numbers copied!','success'); },
  addFolder: function(){ var n=prompt('Folder name:'); if(!n)return; var f=STORE.get('pk3_bulkFolders',[]); f.push({id:uid(),name:n}); STORE.set('pk3_bulkFolders',f); this.render(); },
  delFolder: function(id){ STORE.set('pk3_bulkFolders',STORE.get('pk3_bulkFolders',[]).filter(function(f){return f.id!==id;})); this.render(); },
  addTemplate: function(){ var n=prompt('Template name:'); if(!n)return; var t=prompt('Template text:'); if(!t)return; var list=STORE.get('pk3_templates',Followups._defTpl()); list.push({name:n,text:t}); STORE.set('pk3_templates',list); this.render(); },
  delTemplate: function(i){ var list=STORE.get('pk3_templates',Followups._defTpl()); list.splice(i,1); STORE.set('pk3_templates',list); this.render(); },
  restoreDefaults: function(){ STORE.set('pk3_templates',Followups._defTpl()); this.render(); App.toast('✅ Default templates restored','success'); }
};

