// ─── RATE LIST MODULE ─────────────────────────────────────────
var RateList = {
  _pickTarget: null, _pickedItems: [], _editMode: false,
  getData: function(){ return STORE.get('pk3_rates',{}); },
  openManager: function(){
    if(!(typeof Auth!=='undefined' && Auth.isSuperAdmin && Auth.isSuperAdmin())){ App.toast('\ud83d\udd12 Super Admin \u0932\u0947 \u092e\u093e\u0924\u094d\u0930','error',3000); return; }
    this._editMode=true; App.navigate('ratelist'); this.render();
  },
  exitManager: function(){ this._editMode=false; this.render(); App.toast('\u2705 Edit mode \u092c\u0928\u094d\u0926','success',1800); },
  // ── ACCESS CONTROL (v4.0.9): only Super Admin can modify rates ──
  _canEdit: function(){ return this._editMode && ((typeof Auth!=='undefined' && Auth.isSuperAdmin) ? Auth.isSuperAdmin() : false); },
  _guard: function(){
    if(this._canEdit()) return true;
    App.toast('🔒 Rate Edit गर्न: Settings → Rate List Edit (Super Admin)','error',3200);
    return false;
  },
  // Category color palette for the beautiful template
  _catColor: function(cat){
    var palette = ['#f97316','#8b5cf6','#06b6d4','#22c55e','#eab308','#f43f5e','#3b82f6','#14b8a6','#a855f7','#f59e0b'];
    var h = 0; for(var i=0;i<cat.length;i++){ h = (h*31 + cat.charCodeAt(i)) >>> 0; }
    return palette[h % palette.length];
  },
  render: function(){
    var rates=this.getData();
    if(!rates||Object.keys(rates).length===0){this.resetDefaults(true);rates=this.getData();}
    var q=getVal('rl-search').toLowerCase();
    var cats=Object.keys(rates);
    var canEdit = this._canEdit();
    // Toggle page-level admin buttons / view-only badge
    var adminBtns = document.getElementById('rl-admin-btns');
    if(adminBtns) adminBtns.style.display = canEdit ? '' : 'none';
    var voBadge = document.getElementById('rl-viewonly-badge');
    if(voBadge) voBadge.style.display = canEdit ? 'none' : '';
    var emptyMsg=document.getElementById('rate-list-empty-msg'), cont=document.getElementById('rate-list-container');
    if(!cats.length){emptyMsg.style.display='';cont.innerHTML='';return;} emptyMsg.style.display='none';
    cont.innerHTML=cats.map(function(cat){
      var items=rates[cat];
      if(q) items=items.filter(function(i){return (i.name+cat).toLowerCase().indexOf(q)>=0;});
      if(!items.length&&q) return '';
      var color = RateList._catColor(cat);
      // Category header buttons — Super Admin only
      var catBtns = canEdit
        ? '<div class="btn-group"><button onclick="event.stopPropagation();RateList.addItemToCategory(\''+cat.replace(/'/g,"\\'")+'\')" class="btn btn-xs" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.35);">+ Add</button>'+
          '<button onclick="event.stopPropagation();RateList.delCategory(\''+cat.replace(/'/g,"\\'")+'\')" class="btn btn-xs" style="background:rgba(0,0,0,0.25);color:#fff;border:1px solid rgba(255,255,255,0.25);">🗑</button></div>'
        : '<span style="font-size:0.9rem;opacity:0.85;">▾</span>';
      return '<div class="rate-cat-wrap" style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.12);">'
        +'<div class="rate-cat-head" onclick="var b=this.parentElement.querySelector(\'.rate-cat-body\');b.style.display=b.style.display===\'none\'?\'block\':\'none\';" '
          +'style="background:linear-gradient(135deg,'+color+','+color+'cc);color:#fff;padding:11px 15px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">'
          +'<span class="rate-cat-title" style="font-weight:800;font-size:0.92rem;display:flex;align-items:center;gap:8px;">📁 '+esc(cat)
            +'<span style="background:rgba(255,255,255,0.25);padding:1px 9px;border-radius:12px;font-size:0.7rem;font-weight:700;">'+items.length+'</span></span>'
          + catBtns
        +'</div>'
        +'<div class="rate-cat-body" style="background:var(--surface);">'
          +'<table style="width:100%;"><thead><tr style="background:var(--surface-2);">'
            +'<th style="width:52px;padding:8px;">📷</th><th style="padding:8px;">Item</th><th style="text-align:right;padding:8px;">Rate</th><th style="padding:8px;">Unit</th>'
            +(canEdit?'<th style="width:80px;"></th>':'')
          +'</tr></thead><tbody>'
          + items.map(function(item,i){
            var imgCell = item.image
              ? '<img src="'+item.image+'" alt="" onclick="event.stopPropagation();RateList.previewImageFull(this.src)" style="width:44px;height:44px;border-radius:8px;object-fit:cover;cursor:pointer;border:2px solid '+color+'44;" title="Click to enlarge">'
              : '<div style="width:44px;height:44px;border-radius:8px;background:'+color+'18;display:flex;align-items:center;justify-content:center;color:'+color+';font-size:1.05rem;">📷</div>';
            var actCell = canEdit
              ? '<td><div class="btn-group"><button onclick="RateList.editItem(\''+cat.replace(/'/g,"\\'")+'\','+i+')" class="btn btn-xs btn-secondary" title="Edit">✏️</button><button onclick="RateList.delItem(\''+cat.replace(/'/g,"\\'")+'\','+i+')" class="btn btn-xs btn-danger" title="Delete">🗑</button></div></td>'
              : '';
            return '<tr style="border-bottom:1px solid var(--border-soft,var(--border));">'
              +'<td style="padding:7px 8px;">'+imgCell+'</td>'
              +'<td style="padding:7px 8px;font-weight:600;font-size:0.86rem;">'+esc(item.name)+(item.detail?'<div style="font-weight:400;font-size:0.7rem;color:var(--text-muted);margin-top:2px;line-height:1.35;">'+esc(item.detail)+'</div>':'')+'</td>'
              +'<td style="text-align:right;padding:7px 8px;font-weight:800;color:'+color+';font-size:0.9rem;">'+fmtRs(item.rate)+'</td>'
              +'<td style="padding:7px 8px;color:var(--text-muted);font-size:0.78rem;">'+esc(item.unit||'')+'</td>'
              + actCell
            +'</tr>';
          }).join('')
        +'</tbody></table></div></div>';
    }).join('');
  },
  addCategory: function(){ if(!this._guard())return; var name=prompt('Category नाम:'); if(!name)return; var r=this.getData(); if(!r[name])r[name]=[]; STORE.set('pk3_rates',r); try{Audit.log('RATES','Category added: '+name);}catch(e){} this.render(); },
  delCategory: function(cat){ if(!this._guard())return; if(!confirm('Delete category "'+cat+'"?'))return; var r=this.getData(); delete r[cat]; STORE.set('pk3_rates',r); try{Audit.log('RATES','Category deleted: '+cat);}catch(e){} this.render(); },
  cleanEmpty: function(){ if(!this._guard())return; var r=this.getData(); Object.keys(r).forEach(function(cat){if(!r[cat].length)delete r[cat];}); STORE.set('pk3_rates',r); this.render(); App.toast('✅ Empty categories cleaned','success'); },
  addItem: function(){
    if(!this._guard())return;
    var rates=this.getData(); var cats=Object.keys(rates);
    var catSel=document.getElementById('rl-item-cat');
    if(catSel) catSel.innerHTML='<option value="">-- Category --</option>'+cats.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
    setVal('rl-edit-id',''); setVal('rl-item-name',''); setVal('rl-item-rate',''); setVal('rl-item-unit','sqft'); setVal('rl-item-detail',''); setVal('rl-item-image','');
    this._resetImagePreview();
    setText('rate-modal-title','💰 Add Rate Item');
    document.getElementById('rate-modal').classList.add('open');
  },
  addItemToCategory: function(cat){ if(!this._guard())return; this.addItem(); setTimeout(function(){setVal('rl-item-cat',cat);},100); },
  editItem: function(cat,idx){
    if(!this._guard())return;
    var rates=this.getData(); var item=rates[cat][idx]; if(!item)return;
    var catSel=document.getElementById('rl-item-cat');
    if(catSel) catSel.innerHTML='<option value="'+cat+'">'+cat+'</option>';
    setVal('rl-item-detail', item.detail || ''); setVal('rl-edit-id',cat+'::'+idx); setVal('rl-item-name',item.name); setVal('rl-item-rate',item.rate); setVal('rl-item-unit',item.unit||'');
    setVal('rl-item-image', item.image || '');
    if(item.image){
      var img = document.getElementById('rl-item-image-img');
      var prev = document.getElementById('rl-item-image-preview');
      if(img) img.src = item.image;
      if(prev) prev.style.display = '';
    } else {
      this._resetImagePreview();
    }
    setText('rate-modal-title','✏️ Edit Rate Item');
    document.getElementById('rate-modal').classList.add('open');
  },
  // ── IMAGE HANDLING (v4.0.4) ──
  handleImageUpload: function(event){
    var file = event.target.files && event.target.files[0];
    if(!file) return;
    if(!/^image\//.test(file.type)){ App.toast('Image file मात्र छान्नुस्','error'); return; }
    if(file.size > 5*1024*1024){ App.toast('Image too large (max 5MB)','error'); return; }
    var reader = new FileReader();
    reader.onload = function(e){
      // Compress: draw on canvas resized to max 600px, then re-encode as JPEG
      var img = new Image();
      img.onload = function(){
        var canvas = document.createElement('canvas');
        var maxSize = 600;
        var ratio = Math.min(maxSize/img.width, maxSize/img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        setVal('rl-item-image', dataUrl);
        var imgEl = document.getElementById('rl-item-image-img');
        var prev = document.getElementById('rl-item-image-preview');
        if(imgEl) imgEl.src = dataUrl;
        if(prev) prev.style.display = '';
        App.toast('📷 Image attached','success',1500);
      };
      img.onerror = function(){ App.toast('Image load failed','error'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },
  removeImage: function(){
    setVal('rl-item-image','');
    this._resetImagePreview();
    var fileInp = document.getElementById('rl-item-image-file');
    if(fileInp) fileInp.value = '';
  },
  _resetImagePreview: function(){
    var img = document.getElementById('rl-item-image-img');
    var prev = document.getElementById('rl-item-image-preview');
    if(img) img.src = '';
    if(prev) prev.style.display = 'none';
    var fileInp = document.getElementById('rl-item-image-file');
    if(fileInp) fileInp.value = '';
  },
  previewImageFull: function(src){
    var modal = document.getElementById('img-preview-modal');
    var img = document.getElementById('img-preview-full');
    if(modal && img){ img.src = src; modal.classList.add('open'); }
  },
  saveItem: function(){
    if(!this._guard())return;
    var name=getVal('rl-item-name'), rate=parseFloat(getVal('rl-item-rate'))||0, unit=getVal('rl-item-unit')||'sqft', cat=getVal('rl-item-cat');
      var detail=(getVal('rl-item-detail')||'').trim();
    var image = getVal('rl-item-image') || '';
    if(!name){App.toast('Item नाम चाहिन्छ!','error');return;}
    if(!cat){App.toast('Category छान्नुस्!','error');return;}
    var rates=this.getData(); if(!rates[cat])rates[cat]=[];
    var editId=getVal('rl-edit-id');
    var rec = {name:name,rate:rate,unit:unit};
    if(detail) rec.detail = detail;
    if(image) rec.image = image;
    if(editId){var p=editId.split('::');rates[p[0]][parseInt(p[1])]=rec;}
    else rates[cat].push(rec);
    STORE.set('pk3_rates',rates); document.getElementById('rate-modal').classList.remove('open'); this.render(); App.toast('✅ Rate saved!','success');
  },
  delItem: function(cat,idx){ if(!this._guard())return; if(!confirm('Delete?'))return; var r=this.getData(); var nm=(r[cat]&&r[cat][idx])?r[cat][idx].name:''; r[cat].splice(idx,1); STORE.set('pk3_rates',r); try{Audit.log('RATES','Item deleted: '+nm);}catch(e){} this.render(); },
  resetDefaults: function(force){
    // Auto-seed (force=true from app init) is allowed for everyone;
    // MANUAL reset from the button is Super Admin only.
    if(!force && !this._guard()) return;
    if(!force && !confirm('Default rates load गर्नुहुन्छ? हाल भएको data रहन्छ, नयाँ categories थपिन्छन्।')) return;
    var r = this.getData() || {};
    var defaults = {
      'UPVC Windows & Doors': [{name:'UPVC Window (Standard)',rate:4500,unit:'sqft'},{name:'UPVC Window (Premium)',rate:5500,unit:'sqft'},{name:'UPVC Door (Single)',rate:18000,unit:'piece'},{name:'UPVC Door (Double)',rate:32000,unit:'piece'},{name:'UPVC Slide Door',rate:22000,unit:'piece'},{name:'UPVC Fixed Window',rate:3800,unit:'sqft'},{name:'UPVC Casement Window',rate:5200,unit:'piece'}],
      'Aluminum Works': [{name:'Aluminum Window',rate:3800,unit:'sqft'},{name:'Aluminum Door',rate:14000,unit:'piece'},{name:'Aluminum Partition',rate:2800,unit:'sqft'},{name:'Aluminum Cladding',rate:220,unit:'sqft'},{name:'Aluminum Railing',rate:1800,unit:'rft'}],
      'Gypsum Ceiling': [{name:'Gypsum False Ceiling (Plain)',rate:85,unit:'sqft'},{name:'Gypsum False Ceiling (Design)',rate:130,unit:'sqft'},{name:'Gypsum Partition',rate:120,unit:'sqft'},{name:'Gypsum Cornice',rate:45,unit:'rft'},{name:'POP Work',rate:35,unit:'sqft'},{name:'Grid Ceiling (T-Bar)',rate:70,unit:'sqft'}],
      'Interior Work': [{name:'Paint Work (2 coat)',rate:25,unit:'sqft'},{name:'Texture Paint',rate:55,unit:'sqft'},{name:'Wallpaper Fixing',rate:35,unit:'sqft'},{name:'Tile Fixing (Floor)',rate:40,unit:'sqft'},{name:'Tile Fixing (Wall)',rate:55,unit:'sqft'},{name:'Wooden Flooring',rate:180,unit:'sqft'},{name:'Vinyl Flooring',rate:120,unit:'sqft'},{name:'Wardrobe (per sqft)',rate:2200,unit:'sqft'},{name:'Kitchen Cabinet',rate:2500,unit:'sqft'}],
      'Construction': [{name:'Brick Masonry',rate:4500,unit:'cubic ft'},{name:'RCC Work',rate:7500,unit:'cubic ft'},{name:'Plastering (Internal)',rate:28,unit:'sqft'},{name:'Plastering (External)',rate:35,unit:'sqft'},{name:'Concrete (M20)',rate:9000,unit:'cubic m'},{name:'Formwork',rate:45,unit:'sqft'}],
      'Plumbing': [{name:'CP Fitting (per point)',rate:3500,unit:'point'},{name:'CPVC Pipe (1 inch)',rate:85,unit:'rft'},{name:'GI Pipe (1 inch)',rate:120,unit:'rft'},{name:'Water Tank (1000L)',rate:12000,unit:'piece'},{name:'Sanitary Fitting (WC set)',rate:8500,unit:'set'},{name:'Washbasin + Fitting',rate:6500,unit:'set'}],
      'Electrical': [{name:'Wiring (per point)',rate:1200,unit:'point'},{name:'DB Board (8 way)',rate:4500,unit:'piece'},{name:'MCB (16A)',rate:350,unit:'piece'},{name:'Switch Board (6 module)',rate:1800,unit:'piece'},{name:'Light Fitting (basic)',rate:800,unit:'piece'},{name:'Fan Fitting',rate:600,unit:'piece'}],
      'Painting': [{name:'Wall Paint (Emulsion)',rate:22,unit:'sqft'},{name:'Wall Paint (Oil Base)',rate:35,unit:'sqft'},{name:'Enamel Paint (Wood)',rate:45,unit:'sqft'},{name:'Exterior Paint (Weather Shield)',rate:40,unit:'sqft'},{name:'Primer Coat',rate:12,unit:'sqft'}],
      'Tile & Marble': [{name:'Floor Tile (Ceramic)',rate:38,unit:'sqft'},{name:'Floor Tile (Vitrified)',rate:55,unit:'sqft'},{name:'Wall Tile',rate:50,unit:'sqft'},{name:'Marble Flooring',rate:220,unit:'sqft'},{name:'Granite Flooring',rate:180,unit:'sqft'},{name:'Tile Grouting',rate:8,unit:'sqft'}],
      'Solar System': [{name:'Solar Panel (1kW System)',rate:90000,unit:'set'},{name:'Solar Panel (2kW System)',rate:170000,unit:'set'},{name:'Solar Panel (5kW System)',rate:400000,unit:'set'},{name:'Solar Battery (100Ah)',rate:25000,unit:'piece'},{name:'Solar Inverter (1kW)',rate:35000,unit:'piece'},{name:'Solar Inverter (2kW)',rate:60000,unit:'piece'}],
      'Truss Work': [{name:'Steel Truss (Light)',rate:350,unit:'sqft'},{name:'Steel Truss (Heavy)',rate:520,unit:'sqft'},{name:'Aluminum Truss',rate:280,unit:'sqft'},{name:'Purlin (MS)',rate:180,unit:'rft'},{name:'Roofing Sheet (Color)',rate:85,unit:'sqft'}],
      'Renovation': [{name:'Room Renovation (per sqft)',rate:450,unit:'sqft'},{name:'Bathroom Renovation',rate:85000,unit:'set'},{name:'Kitchen Renovation',rate:120000,unit:'set'},{name:'Full Home Renovation (per sqft)',rate:800,unit:'sqft'},{name:'False Ceiling + Paint',rate:180,unit:'sqft'}]
    };
    Object.keys(defaults).forEach(function(cat){ if(!r[cat] || !r[cat].length) r[cat] = defaults[cat]; });
    STORE.set('pk3_rates', r);
    try { this.render(); } catch(e) {}
    try { App.toast('✅ Default rates loaded!','success'); } catch(e) {}
  },
  renderPickModal: function(q){
    var rates=this.getData(); var lower=(q||'').toLowerCase();
    var html='';
    Object.keys(rates).forEach(function(cat){
      var items=rates[cat].filter(function(i){return !lower||((i.name||'').toLowerCase().indexOf(lower)>=0)||cat.toLowerCase().indexOf(lower)>=0;});
      if(!items.length)return;
      html+='<div style="margin-bottom:8px;"><div style="font-size:0.7rem;color:var(--accent);font-weight:700;text-transform:uppercase;padding:4px 0;">'+cat+'</div>';
      html+=items.map(function(item){
        var checked=RateList._pickedItems.some(function(p){return p.name===item.name;});
        return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.85rem;">'+
          '<input type="checkbox" '+(checked?'checked':'')+' onchange="RateList.togglePick(\''+item.name+'\','+item.rate+',\''+item.unit+'\')" style="accent-color:var(--accent);">'+
          esc(item.name)+' — <span style="font-weight:700;">'+fmtRs(item.rate)+'</span>/'+esc(item.unit)+(item.detail?'<div style="font-size:0.68rem;color:var(--text-muted);font-weight:400;margin-top:1px;">'+esc(item.detail)+'</div>':'')+'</label>';
      }).join('');
      html+='</div>';
    });
    document.getElementById('rate-pick-list').innerHTML=html||'<div class="empty-state" style="padding:20px;"><div>No items found</div></div>';
    setText('rate-pick-count',this._pickedItems.length);
  },
  togglePick: function(name,rate,unit){
    var idx=this._pickedItems.findIndex(function(p){return p.name===name;});
    if(idx>=0) this._pickedItems.splice(idx,1);
    else this._pickedItems.push({name:name,rate:rate,unit:unit,qty:1,amount:rate});
    setText('rate-pick-count',this._pickedItems.length);
  },
  addPickedItems: function(){
    if(!this._pickedItems.length){App.toast('Items छान्नुस्!','error');return;}
    if(this._pickTarget==='quotation'){this._pickedItems.forEach(function(item){Quotations._rows.push({name:item.name,qty:1,unit:item.unit||'sqft',rate:item.rate,amount:item.rate});});Quotations.renderRows();Quotations.calc();}
    else if(this._pickTarget==='bakauta'){this._pickedItems.forEach(function(item){Bakauta._rows.push({name:item.name,qty:1,unit:item.unit||'sqft',rate:item.rate,amount:item.rate});});Bakauta.renderRows();Bakauta.calc();}
    else if(this._pickTarget==='estimate'){this._pickedItems.forEach(function(item){Estimate._rows.push({name:item.name,qty:1,unit:item.unit||'sqft',rate:item.rate,amount:item.rate});});Estimate.renderRows();Estimate.calc();}
    else if(this._pickTarget==='invoice'){this._pickedItems.forEach(function(item){Invoices._rows.push({name:item.name,qty:1,unit:item.unit||'pcs',rate:item.rate,amount:item.rate});});Invoices.renderRows();Invoices.calc();}
    var _n=this._pickedItems.length;
    this._pickedItems=[];
    document.getElementById('rate-pick-modal').classList.remove('open');
    App.toast('✅ '+_n+' items added','success');
  }
};

