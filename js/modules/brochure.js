// ============================================================
// JS PART L: Brochure, Ledger, Reports modules
// ============================================================

// ─── BROCHURE MODULE (v4.0.4 — A4 templates, editable, scrollable, emoji-rich) ──
var Brochure = {
  _editId: null,
  _data: null,
  // Pre-built A4 brochure templates (ready-made, fully editable)
  TEMPLATES: [
    {
      id: 'home-services',
      name: '🏠 Home Services (Combo)',
      icon: '🏠',
      preview: '#f97316',
      data: {
        title: '🏠 PRERAK Home Solutions',
        tagline: '✨ Quality • Trust • Experience ✨',
        intro: 'तपाईंको सपनाको घर हाम्रो जिम्मेवारी 🏗️\nUPVC, Gypsum, Interior — सबै एकै ठाउँमा!',
        services: [
          {emoji:'🪟', name:'UPVC Windows & Doors', desc:'Premium German tech, lifetime warranty, sound + heat proof'},
          {emoji:'🏠', name:'Gypsum False Ceiling', desc:'Modern designs, LED lighting, POP cornice work'},
          {emoji:'🛋️', name:'Interior Design', desc:'Modular kitchen, wardrobes, full home interior'},
          {emoji:'🎨', name:'Painting & Texture', desc:'Exterior weather shield, interior emulsion, designs'},
          {emoji:'🪨', name:'Tile / Marble / Granite', desc:'Italian marble, vitrified tiles, anti-skid bathroom'},
          {emoji:'⚡', name:'Electrical & Plumbing', desc:'Wiring, switchboards, CP fittings, water tank setup'}
        ],
        whyUs: '✅ 100+ Happy Customers in Hetauda\n✅ On-time delivery guarantee\n✅ Free site visit & estimate\n✅ Genuine material with bill\n✅ Skilled team with 10+ years experience',
        offer: '🎁 Special Offer: Free Site Visit + 5% Discount on Combo Booking!',
        cta: '📞 Call Today: 9855069733'
      }
    },
    {
      id: 'upvc-special',
      name: '🪟 UPVC Specialist',
      icon: '🪟',
      preview: '#06b6d4',
      data: {
        title: '🪟 PRERAK UPVC Doors & Windows',
        tagline: '🌟 German Profile • Premium Quality 🌟',
        intro: 'अब तपाईंको घरमा पनि European-grade UPVC! 🏠\nNo termite • No rust • Sound proof + Heat proof',
        services: [
          {emoji:'🪟', name:'UPVC Sliding Window', desc:'Smooth sliding, mosquito mesh option, 5mm-8mm glass'},
          {emoji:'🚪', name:'UPVC Casement Window', desc:'Side-hung, top-hung, tilt-and-turn variants'},
          {emoji:'🚪', name:'UPVC Main Door', desc:'Reinforced steel core, 3-point lock, decorative panels'},
          {emoji:'🪟', name:'Fixed Glass Window', desc:'Maximum light, double-glazed option, energy efficient'},
          {emoji:'🧱', name:'UPVC Partition', desc:'Office/home partitions, glass + UPVC combo'}
        ],
        whyUs: '✅ German VEKA / Encraft profiles\n✅ 10-year warranty on profile\n✅ Lead-free, eco-friendly\n✅ Custom colors: White, Wood-grain, Grey\n✅ Free measurement & installation',
        offer: '🎁 Sample showroom visit free! Compare with aluminum & wood.',
        cta: '📞 Quote: 9855069733 / 9801069733'
      }
    },
    {
      id: 'interior',
      name: '🛋️ Interior Design',
      icon: '🛋️',
      preview: '#a855f7',
      data: {
        title: '🛋️ PRERAK Interior Design',
        tagline: '✨ Style your space, beautifully ✨',
        intro: 'तपाईंको घर/अफिस लाई आधुनिक रूप दिनुहोस्! 🏡\nFull turnkey solutions — design देखि furniture सम्म',
        services: [
          {emoji:'🍳', name:'Modular Kitchen', desc:'L-shape, U-shape, parallel — laminate/acrylic/PU'},
          {emoji:'👔', name:'Wardrobe', desc:'Sliding/openable, mirror finish, internal organizer'},
          {emoji:'📺', name:'TV Unit', desc:'Wall-mount, LED back-light, hidden storage'},
          {emoji:'🛏️', name:'Bedroom Set', desc:'Bed, side tables, dressing unit, study table'},
          {emoji:'🏢', name:'Office Interior', desc:'Workstations, cabin, reception, conference room'},
          {emoji:'💡', name:'Lighting Design', desc:'Cove lighting, spot, decorative chandeliers'}
        ],
        whyUs: '✅ 3D design preview before work\n✅ Branded materials (Greenply, Century, Asian)\n✅ Fixed timeline contract\n✅ 1-year service warranty\n✅ EMI option available',
        offer: '🎁 Free 3D design on confirmation!',
        cta: '📞 Visit Showroom: Hetauda-2 | 9855069733'
      }
    },
    {
      id: 'blank',
      name: '📄 Blank A4 (write your own)',
      icon: '📄',
      preview: '#64748b',
      data: {
        title: 'Your Title Here',
        tagline: 'Subtitle / tagline',
        intro: 'Write your introduction here...',
        services: [
          {emoji:'⭐', name:'Service 1', desc:'Description'},
          {emoji:'⭐', name:'Service 2', desc:'Description'},
          {emoji:'⭐', name:'Service 3', desc:'Description'}
        ],
        whyUs: '✅ Reason 1\n✅ Reason 2\n✅ Reason 3',
        offer: '🎁 Special offer here',
        cta: '📞 Contact: '
      }
    }
  ],
  EMOJI_LIB: ['🏠','🏗️','🪟','🚪','🛋️','🍳','👔','📺','🛏️','🏢','💡','🎨','🪨','⚡','🔧','🌟','✨','🎁','📞','📍','✅','⭐','🔥','💎','🌿','☀️','🌧️','💰','📋','📝'],

  getStore: function(){ return STORE.get('pk3_brochures', []) || []; },
  setStore: function(list){ STORE.set('pk3_brochures', list); },

  render: function(){
    // Make sure list view is active, editor hidden
    var listV = document.getElementById('brochures-list-view');
    var edV   = document.getElementById('brochures-editor');
    if(listV) listV.style.display = '';
    if(edV)   edV.style.display = 'none';

    var list = this.getStore();
    var grid = document.getElementById('brochures-grid');
    var empty = document.getElementById('brochures-empty');
    if(!grid) return;
    if(!list.length){
      grid.innerHTML = '';
      if(empty) empty.style.display = '';
      return;
    }
    if(empty) empty.style.display = 'none';
    grid.innerHTML = list.map(function(b){
      var d = b.data || {};
      return '<div class="card" style="cursor:pointer;overflow:hidden;border:2px solid var(--border);" onclick="Brochure.editBrochure(\''+b.id+'\')">'
        +'<div style="background:linear-gradient(135deg,'+(b.color||'#f97316')+',rgba(0,0,0,0.3));padding:18px 14px;color:#fff;text-align:center;">'
          +'<div style="font-size:1.8rem;margin-bottom:4px;">'+(b.icon||'📄')+'</div>'
          +'<div style="font-weight:800;font-size:0.92rem;line-height:1.2;">'+esc(d.title||b.name||'Brochure')+'</div>'
        +'</div>'
        +'<div style="padding:10px 12px;">'
          +'<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">'+esc(d.tagline||'')+'</div>'
          +'<div style="font-size:0.68rem;color:var(--text-dim);">'+(b.updated||b.created||'')+'</div>'
          +'<div class="btn-group" style="margin-top:8px;" onclick="event.stopPropagation();">'
            +'<button onclick="event.stopPropagation();Brochure.editBrochure(\''+b.id+'\')" class="btn btn-xs btn-secondary" title="Edit">✏️</button>'
            +'<button onclick="event.stopPropagation();Brochure.printBrochure(\''+b.id+'\')" class="btn btn-xs btn-primary" title="Print/PDF">🖨️</button>'
            +'<button onclick="event.stopPropagation();Brochure.shareBrochure(\''+b.id+'\')" class="btn btn-xs btn-wa" title="WhatsApp">📱</button>'
            +'<button onclick="event.stopPropagation();Brochure.delBrochure(\''+b.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button>'
          +'</div>'
        +'</div>'
      +'</div>';
    }).join('');
  },

  newBrochure: function(){
    // Show template picker
    var existing = document.getElementById('brochure-tpl-modal');
    if(existing) existing.remove();
    var m = document.createElement('div');
    m.className = 'modal-overlay open';
    m.id = 'brochure-tpl-modal';
    m.innerHTML =
      '<div class="modal" style="max-width:640px;">'
      +'<div class="modal-head">'
        +'<div class="modal-title">📄 Choose A4 Template</div>'
        +'<button class="modal-close" onclick="document.getElementById(\'brochure-tpl-modal\').remove()">✕</button>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;padding:6px 0;">'
        + this.TEMPLATES.map(function(t){
            return '<div onclick="Brochure._createFromTemplate(\''+t.id+'\')" style="cursor:pointer;border:2px solid var(--border);border-radius:10px;overflow:hidden;transition:transform 0.15s,border-color 0.15s;" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'\'">'
              +'<div style="background:linear-gradient(135deg,'+t.preview+',rgba(0,0,0,0.3));padding:30px 14px;text-align:center;color:#fff;">'
                +'<div style="font-size:2.6rem;margin-bottom:6px;">'+t.icon+'</div>'
                +'<div style="font-weight:800;font-size:0.85rem;line-height:1.2;">'+esc(t.name)+'</div>'
              +'</div>'
              +'<div style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted);text-align:center;">A4 size · Editable · Print-ready</div>'
            +'</div>';
          }).join('')
      +'</div>'
      +'</div>';
    document.body.appendChild(m);
  },

  _createFromTemplate: function(tplId){
    var tpl = this.TEMPLATES.find(function(t){return t.id===tplId;});
    if(!tpl) return;
    var newId = 'b_' + Date.now().toString(36);
    var brochure = {
      id: newId,
      tplId: tplId,
      icon: tpl.icon,
      color: tpl.preview,
      name: tpl.name,
      data: JSON.parse(JSON.stringify(tpl.data)), // deep clone
      created: new Date().toISOString().slice(0,10),
      updated: new Date().toISOString().slice(0,10)
    };
    var list = this.getStore();
    list.push(brochure);
    this.setStore(list);
    var modal = document.getElementById('brochure-tpl-modal');
    if(modal) modal.remove();
    try { Audit.log('BROCHURE','Created from template: '+tpl.name); } catch(e){}
    this.editBrochure(newId);
  },

  editBrochure: function(id){
    var list = this.getStore();
    var b = list.find(function(x){return x.id===id;});
    if(!b){ App.toast('Brochure not found','error'); return; }
    this._editId = id;
    this._data = JSON.parse(JSON.stringify(b.data));
    // Switch views
    var listV = document.getElementById('brochures-list-view');
    var edV   = document.getElementById('brochures-editor');
    if(listV) listV.style.display = 'none';
    if(edV)   edV.style.display = '';
    // Set title
    var t = document.getElementById('brochure-editor-title');
    if(t) t.textContent = '✏️ ' + (b.name || 'Brochure');
    this._renderForm();
    this._renderPreview();
  },

  backToList: function(){
    this._editId = null;
    this._data = null;
    this.render();
  },

  _renderForm: function(){
    var d = this._data || {};
    var form = document.getElementById('brochure-form');
    if(!form) return;
    var emojiBar = '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;font-size:1rem;line-height:1;">'
      + this.EMOJI_LIB.map(function(e){
          return '<span onclick="Brochure._insertEmojiAt(\''+e+'\')" style="cursor:pointer;padding:4px 6px;border-radius:5px;background:var(--surface-2);" title="Insert '+e+'">'+e+'</span>';
        }).join('')
      + '</div>';
    var html = ''
      + '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">🎨 Quick Emoji (click to copy)</div>'
      + emojiBar
      + '<div class="form-group" style="margin-bottom:10px;"><label>📋 Title</label><input type="text" id="br-title" value="'+esc(d.title||'')+'" oninput="Brochure._updateField(\'title\',this.value)"></div>'
      + '<div class="form-group" style="margin-bottom:10px;"><label>✨ Tagline</label><input type="text" id="br-tagline" value="'+esc(d.tagline||'')+'" oninput="Brochure._updateField(\'tagline\',this.value)"></div>'
      + '<div class="form-group" style="margin-bottom:10px;"><label>📝 Intro Text</label><textarea id="br-intro" rows="3" oninput="Brochure._updateField(\'intro\',this.value)">'+esc(d.intro||'')+'</textarea></div>'
      // ── SERVICE MIXER (v4.0.5): pull services from any template ──
      + '<div class="form-group" style="margin-bottom:10px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;"><label style="margin:0;">⭐ Services / Features</label>'
        + '<button type="button" onclick="Brochure.openServiceMixer()" class="btn btn-xs" style="background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-weight:700;padding:3px 10px;font-size:0.7rem;">🎯 Mix from Other Templates</button></div>'
        + '<div id="br-services-list">'+this._renderServicesList()+'</div>'
        + '<button type="button" onclick="Brochure._addService()" class="btn btn-xs btn-secondary" style="margin-top:6px;">+ Add Service</button>'
      + '</div>'
      + '<div class="form-group" style="margin-bottom:10px;"><label>✅ Why Choose Us</label><textarea id="br-whyus" rows="5" oninput="Brochure._updateField(\'whyUs\',this.value)">'+esc(d.whyUs||'')+'</textarea></div>'
      + '<div class="form-group" style="margin-bottom:10px;"><label>🎁 Special Offer</label><input type="text" id="br-offer" value="'+esc(d.offer||'')+'" oninput="Brochure._updateField(\'offer\',this.value)"></div>'
      + '<div class="form-group" style="margin-bottom:10px;"><label>📞 Call to Action</label><input type="text" id="br-cta" value="'+esc(d.cta||'')+'" oninput="Brochure._updateField(\'cta\',this.value)"></div>'
      // ── CUSTOM SECTIONS (v4.0.5): add unlimited extra blocks ──
      + '<div style="border-top:2px dashed var(--border);margin:14px 0 10px;padding-top:10px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">'
          + '<label style="margin:0;">🧩 Custom Content Blocks</label>'
          + '<div style="display:flex;gap:4px;flex-wrap:wrap;">'
            + '<button type="button" onclick="Brochure._addCustomBlock(\'text\')" class="btn btn-xs btn-secondary" style="font-size:0.68rem;padding:3px 7px;">+ Text</button>'
            + '<button type="button" onclick="Brochure._addCustomBlock(\'image\')" class="btn btn-xs btn-secondary" style="font-size:0.68rem;padding:3px 7px;">+ Image</button>'
            + '<button type="button" onclick="Brochure._addCustomBlock(\'list\')" class="btn btn-xs btn-secondary" style="font-size:0.68rem;padding:3px 7px;">+ List</button>'
            + '<button type="button" onclick="Brochure._addCustomBlock(\'quote\')" class="btn btn-xs btn-secondary" style="font-size:0.68rem;padding:3px 7px;">+ Quote</button>'
          + '</div>'
        + '</div>'
        + '<div id="br-custom-blocks">'+this._renderCustomBlocks()+'</div>'
      + '</div>';
    form.innerHTML = html;
  },

  // ── CUSTOM CONTENT BLOCKS (v4.0.5) ──
  _renderCustomBlocks: function(){
    var d = this._data || {};
    var blocks = d.customBlocks || [];
    if(!blocks.length){
      return '<div style="color:var(--text-muted);font-size:0.74rem;padding:10px;text-align:center;background:var(--surface-2);border-radius:6px;">No custom blocks yet. Click + Text / + Image / + List / + Quote above.</div>';
    }
    return blocks.map(function(b, i){
      var typeIcon = {text:'📝',image:'🖼️',list:'📋',quote:'💬'}[b.type] || '🧩';
      var inner = '';
      if(b.type === 'text'){
        inner = '<input type="text" value="'+esc(b.heading||'')+'" placeholder="Heading (optional)" oninput="Brochure._updateBlock('+i+',\'heading\',this.value)" style="font-size:0.78rem;padding:5px;margin-bottom:5px;">'
              + '<textarea rows="3" placeholder="Block content..." oninput="Brochure._updateBlock('+i+',\'content\',this.value)" style="font-size:0.78rem;padding:5px;width:100%;">'+esc(b.content||'')+'</textarea>';
      } else if(b.type === 'image'){
        inner = '<input type="text" value="'+esc(b.caption||'')+'" placeholder="Caption (optional)" oninput="Brochure._updateBlock('+i+',\'caption\',this.value)" style="font-size:0.78rem;padding:5px;margin-bottom:5px;">'
              + '<div style="display:flex;gap:6px;align-items:flex-start;">'
              + '<input type="file" accept="image/*" onchange="Brochure._uploadBlockImage('+i+', event)" style="flex:1;font-size:0.72rem;padding:4px;background:var(--surface-3);border-radius:5px;">'
              + (b.image?'<img src="'+b.image+'" style="width:50px;height:50px;border-radius:5px;object-fit:cover;cursor:pointer;border:1px solid var(--border);" onclick="RateList.previewImageFull(this.src)">':'')
              + '</div>';
      } else if(b.type === 'list'){
        inner = '<input type="text" value="'+esc(b.heading||'')+'" placeholder="List heading" oninput="Brochure._updateBlock('+i+',\'heading\',this.value)" style="font-size:0.78rem;padding:5px;margin-bottom:5px;">'
              + '<textarea rows="4" placeholder="One item per line — emoji सहित लेख्न सकिन्छ&#10;✅ Item 1&#10;✅ Item 2" oninput="Brochure._updateBlock('+i+',\'content\',this.value)" style="font-size:0.78rem;padding:5px;width:100%;">'+esc(b.content||'')+'</textarea>';
      } else if(b.type === 'quote'){
        inner = '<textarea rows="2" placeholder="Customer testimonial / quote text" oninput="Brochure._updateBlock('+i+',\'content\',this.value)" style="font-size:0.78rem;padding:5px;margin-bottom:5px;width:100%;">'+esc(b.content||'')+'</textarea>'
              + '<input type="text" value="'+esc(b.author||'')+'" placeholder="— Author / Customer name" oninput="Brochure._updateBlock('+i+',\'author\',this.value)" style="font-size:0.78rem;padding:5px;">';
      }
      return '<div style="background:var(--surface-2);border-radius:8px;padding:8px;margin-bottom:6px;border-left:3px solid var(--accent);">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
          + '<div style="font-size:0.74rem;font-weight:700;color:var(--accent);">'+typeIcon+' '+b.type.toUpperCase()+' BLOCK #'+(i+1)+'</div>'
          + '<div style="display:flex;gap:3px;">'
            + (i>0?'<button type="button" onclick="Brochure._moveBlock('+i+',-1)" class="btn btn-xs btn-secondary" style="padding:2px 6px;font-size:0.65rem;" title="Move up">▲</button>':'')
            + (i<blocks.length-1?'<button type="button" onclick="Brochure._moveBlock('+i+',1)" class="btn btn-xs btn-secondary" style="padding:2px 6px;font-size:0.65rem;" title="Move down">▼</button>':'')
            + '<button type="button" onclick="Brochure._delCustomBlock('+i+')" class="btn btn-xs btn-danger" style="padding:2px 6px;font-size:0.65rem;">×</button>'
          + '</div>'
        + '</div>'
        + inner
      + '</div>';
    }).join('');
  },

  _addCustomBlock: function(type){
    if(!this._data) return;
    if(!this._data.customBlocks) this._data.customBlocks = [];
    var defaults = {
      text: {type:'text', heading:'', content:''},
      image: {type:'image', caption:'', image:''},
      list: {type:'list', heading:'', content:''},
      quote: {type:'quote', content:'', author:''}
    };
    this._data.customBlocks.push(defaults[type] || defaults.text);
    this._renderForm(); this._renderPreview();
  },

  _updateBlock: function(idx, key, value){
    if(!this._data || !this._data.customBlocks || !this._data.customBlocks[idx]) return;
    this._data.customBlocks[idx][key] = value;
    this._renderPreview();
  },

  _delCustomBlock: function(idx){
    if(!this._data || !this._data.customBlocks) return;
    if(!confirm('Delete this block?')) return;
    this._data.customBlocks.splice(idx, 1);
    this._renderForm(); this._renderPreview();
  },

  _moveBlock: function(idx, dir){
    if(!this._data || !this._data.customBlocks) return;
    var b = this._data.customBlocks;
    var ni = idx + dir;
    if(ni < 0 || ni >= b.length) return;
    var tmp = b[idx]; b[idx] = b[ni]; b[ni] = tmp;
    this._renderForm(); this._renderPreview();
  },

  _uploadBlockImage: function(idx, event){
    var file = event.target.files && event.target.files[0];
    if(!file) return;
    if(!/^image\//.test(file.type)){ App.toast('Image only','error'); return; }
    if(file.size > 4*1024*1024){ App.toast('Image too large (max 4MB)','error'); return; }
    var reader = new FileReader();
    var self = this;
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var canvas = document.createElement('canvas');
        var maxSize = 700;
        var ratio = Math.min(maxSize/img.width, maxSize/img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        if(self._data.customBlocks && self._data.customBlocks[idx]){
          self._data.customBlocks[idx].image = dataUrl;
          self._renderForm(); self._renderPreview();
          App.toast('🖼️ Image attached','success',1500);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  // ── SERVICE MIXER (v4.0.5): pick services from any template ──
  openServiceMixer: function(){
    var existing = document.getElementById('br-mixer-modal');
    if(existing) existing.remove();
    var allServices = [];
    this.TEMPLATES.forEach(function(t){
      if(t.id === 'blank') return;
      (t.data.services||[]).forEach(function(s){
        allServices.push({tpl:t.name, tplIcon:t.icon, color:t.preview, emoji:s.emoji, name:s.name, desc:s.desc});
      });
    });
    var current = this._data && this._data.services || [];
    var currentNames = current.map(function(s){return (s.name||'').toLowerCase();});
    var m = document.createElement('div');
    m.className = 'modal-overlay open';
    m.id = 'br-mixer-modal';
    m.innerHTML =
      '<div class="modal" style="max-width:580px;">'
      +'<div class="modal-head">'
        +'<div>'
          +'<div class="modal-title">🎯 Service Mixer</div>'
          +'<div class="modal-sub" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">'+allServices.length+' services available — pick any combination</div>'
        +'</div>'
        +'<button class="modal-close" onclick="document.getElementById(\'br-mixer-modal\').remove()">✕</button>'
      +'</div>'
      +'<div style="max-height:55vh;overflow-y:auto;margin-bottom:12px;">'
        + allServices.map(function(s, i){
            var checked = currentNames.indexOf((s.name||'').toLowerCase()) >= 0;
            return '<label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:6px;margin-bottom:4px;cursor:pointer;border-left:3px solid '+s.color+';">'
              + '<input type="checkbox" '+(checked?'checked':'')+' data-svc="'+i+'" style="margin-top:3px;flex-shrink:0;accent-color:var(--accent);">'
              + '<div style="flex:1;min-width:0;">'
                + '<div style="font-size:0.84rem;font-weight:600;"><span style="margin-right:5px;">'+esc(s.emoji||'⭐')+'</span>'+esc(s.name||'')+'</div>'
                + '<div style="font-size:0.7rem;color:var(--text-muted);line-height:1.4;">'+esc(s.desc||'')+'</div>'
                + '<div style="font-size:0.62rem;color:'+s.color+';font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin-top:2px;">'+esc(s.tplIcon)+' '+esc(s.tpl)+'</div>'
              + '</div>'
            + '</label>';
          }).join('')
      +'</div>'
      +'<div class="form-actions" style="display:flex;gap:8px;flex-wrap:wrap;">'
        +'<button class="btn btn-secondary" onclick="document.getElementById(\'br-mixer-modal\').remove()">Cancel</button>'
        +'<button class="btn btn-primary" style="flex:1;background:linear-gradient(135deg,#a855f7,#7c3aed);" onclick="Brochure._applyServiceMixer()">✔ Apply Selection</button>'
      +'</div>'
      +'</div>';
    document.body.appendChild(m);
    // Stash the available list so apply can read it
    this._mixerAll = allServices;
  },

  _applyServiceMixer: function(){
    var modal = document.getElementById('br-mixer-modal');
    if(!modal || !this._mixerAll) return;
    var picked = [];
    modal.querySelectorAll('input[type="checkbox"][data-svc]:checked').forEach(function(cb){
      var idx = parseInt(cb.getAttribute('data-svc'));
      var s = Brochure._mixerAll[idx];
      if(s) picked.push({emoji:s.emoji, name:s.name, desc:s.desc});
    });
    if(!picked.length){ App.toast('कुनै service छानिएन','warning'); return; }
    if(!this._data) this._data = {};
    this._data.services = picked;
    this._mixerAll = null;
    modal.remove();
    this._renderForm();
    this._renderPreview();
    App.toast('🎯 '+picked.length+' services applied','success');
  },

  _renderServicesList: function(){
    var d = this._data || {};
    var svcs = d.services || [];
    return svcs.map(function(s, i){
      return '<div style="display:flex;gap:5px;margin-bottom:5px;background:var(--surface-2);padding:6px;border-radius:6px;">'
        + '<input type="text" value="'+esc(s.emoji||'⭐')+'" oninput="Brochure._updateService('+i+',\'emoji\',this.value)" style="width:36px;text-align:center;font-size:0.95rem;padding:5px;">'
        + '<input type="text" value="'+esc(s.name||'')+'" placeholder="Service name" oninput="Brochure._updateService('+i+',\'name\',this.value)" style="flex:1;font-size:0.78rem;padding:5px;">'
        + '<input type="text" value="'+esc(s.desc||'')+'" placeholder="Description" oninput="Brochure._updateService('+i+',\'desc\',this.value)" style="flex:2;font-size:0.78rem;padding:5px;">'
        + '<button type="button" onclick="Brochure._delService('+i+')" class="btn btn-xs btn-danger" style="padding:3px 7px;">×</button>'
      + '</div>';
    }).join('') || '<div style="color:var(--text-muted);font-size:0.78rem;padding:6px;">No services yet — click "+ Add Service"</div>';
  },

  _updateField: function(field, value){
    if(!this._data) return;
    this._data[field] = value;
    this._renderPreview();
  },
  _updateService: function(i, key, value){
    if(!this._data || !this._data.services || !this._data.services[i]) return;
    this._data.services[i][key] = value;
    this._renderPreview();
  },
  _addService: function(){
    if(!this._data) return;
    if(!this._data.services) this._data.services = [];
    this._data.services.push({emoji:'⭐', name:'New Service', desc:'Description'});
    this._renderForm();
    this._renderPreview();
  },
  _delService: function(i){
    if(!this._data || !this._data.services) return;
    this._data.services.splice(i, 1);
    this._renderForm();
    this._renderPreview();
  },
  _insertEmojiAt: function(emoji){
    // Try to insert into the focused input/textarea
    var el = document.activeElement;
    if(!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')){
      // Fall back: copy to clipboard
      if(navigator.clipboard) navigator.clipboard.writeText(emoji);
      App.toast('📋 '+emoji+' copied — paste anywhere','info',1500);
      return;
    }
    var start = el.selectionStart || 0;
    var end = el.selectionEnd || 0;
    el.value = el.value.slice(0,start) + emoji + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + emoji.length;
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.focus();
  },

  _renderPreview: function(){
    var d = this._data || {};
    var co = STORE.get('pk3_settings', {}) || {};
    var prev = document.getElementById('brochure-live-preview');
    if(!prev) return;
    // Find color from current brochure
    var list = this.getStore();
    var b = list.find(function(x){return x.id===Brochure._editId;});
    var color = (b && b.color) || '#f97316';
    var logo = co.logo || '';
    // A4 ~ 595×842 px at 72dpi → scale to ~360 wide for preview
    var scale = 0.55;
    var html =
      '<div style="width:595px;min-height:842px;background:#fff;color:#222;font-family:Arial,Helvetica,sans-serif;padding:40px 36px;box-sizing:border-box;transform:scale('+scale+');transform-origin:top left;box-shadow:0 4px 18px rgba(0,0,0,0.3);" id="brochure-page">'
      // Header band
      +'<div style="background:linear-gradient(135deg,'+color+',rgba(0,0,0,0.4));padding:24px 22px;border-radius:14px;color:#fff;display:flex;align-items:center;gap:14px;margin-bottom:22px;">'
        + (logo ? '<img src="'+logo+'" style="width:70px;height:70px;border-radius:10px;background:#fff;object-fit:contain;padding:4px;flex-shrink:0;">' : '<div style="width:70px;height:70px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:2.2rem;flex-shrink:0;">🏢</div>')
        +'<div style="flex:1;min-width:0;">'
          +'<div style="font-size:1.6rem;font-weight:900;line-height:1.15;margin-bottom:4px;">'+esc(d.title||'Title')+'</div>'
          +'<div style="font-size:0.92rem;opacity:0.92;">'+esc(d.tagline||'')+'</div>'
        +'</div>'
      +'</div>'
      // Intro
      +'<div style="font-size:0.92rem;line-height:1.65;color:#333;margin-bottom:22px;white-space:pre-wrap;">'+esc(d.intro||'')+'</div>'
      // Services grid
      +'<div style="background:#f8f8fc;border-radius:12px;padding:16px;margin-bottom:18px;">'
        +'<div style="font-size:1rem;font-weight:800;color:'+color+';margin-bottom:10px;">⭐ Services / Features</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
        +(d.services||[]).map(function(s){
          return '<div style="background:#fff;border-radius:8px;padding:10px;border-left:3px solid '+color+';">'
            +'<div style="font-size:0.92rem;font-weight:700;margin-bottom:3px;"><span style="font-size:1.1rem;margin-right:5px;">'+esc(s.emoji||'⭐')+'</span>'+esc(s.name||'')+'</div>'
            +'<div style="font-size:0.78rem;color:#555;line-height:1.4;">'+esc(s.desc||'')+'</div>'
          +'</div>';
        }).join('')
        +'</div>'
      +'</div>'
      // Why us
      +(d.whyUs?'<div style="background:'+color+'22;border:2px dashed '+color+';border-radius:10px;padding:14px 16px;margin-bottom:16px;">'
        +'<div style="font-size:0.95rem;font-weight:800;color:'+color+';margin-bottom:6px;">💡 Why Choose Us</div>'
        +'<div style="font-size:0.84rem;line-height:1.7;white-space:pre-wrap;color:#333;">'+esc(d.whyUs)+'</div>'
      +'</div>':'')
      // Offer
      +(d.offer?'<div style="background:linear-gradient(90deg,#fef3c7,#fde68a);border-radius:10px;padding:12px 16px;margin-bottom:16px;text-align:center;font-weight:800;font-size:0.95rem;color:#92400e;">'+esc(d.offer)+'</div>':'')
      // Custom Content Blocks (v4.0.5)
      + this._renderPreviewCustomBlocks(color)
      // Footer
      +'<div style="border-top:2px solid '+color+';padding-top:14px;margin-top:auto;text-align:center;">'
        +'<div style="font-size:1.05rem;font-weight:900;color:'+color+';">'+esc(d.cta||'')+'</div>'
        +'<div style="font-size:0.78rem;color:#666;margin-top:6px;">'+esc(co.companyName||'PRERAK MULTIPURPOSE PVT LTD')+' • '+esc(co.address||'Hetauda-2, Makwanpur')+'</div>'
        +'<div style="font-size:0.74rem;color:#888;margin-top:2px;">📞 '+esc(co.phone1||'9855069733')+(co.phone2?' / '+esc(co.phone2):'')+(co.email?' • '+esc(co.email):'')+'</div>'
      +'</div>'
      +'</div>';
    prev.innerHTML = html;
    // Adjust preview container size for the scaled page
    prev.style.width = (595*scale + 16) + 'px';
  },

  // ── CUSTOM BLOCKS RENDERER (v4.0.5): used by both preview and print ──
  _renderPreviewCustomBlocks: function(color){
    var d = this._data || {};
    var blocks = d.customBlocks || [];
    if(!blocks.length) return '';
    return blocks.map(function(b){
      if(b.type === 'text'){
        if(!b.heading && !b.content) return '';
        return '<div style="background:#fafbfc;border-left:4px solid '+color+';border-radius:8px;padding:12px 14px;margin-bottom:14px;">'
          + (b.heading?'<div style="font-size:0.95rem;font-weight:800;color:'+color+';margin-bottom:5px;">'+esc(b.heading)+'</div>':'')
          + (b.content?'<div style="font-size:0.86rem;line-height:1.65;color:#333;white-space:pre-wrap;">'+esc(b.content)+'</div>':'')
        + '</div>';
      } else if(b.type === 'image'){
        if(!b.image && !b.caption) return '';
        return '<div style="text-align:center;margin-bottom:14px;">'
          + (b.image?'<img src="'+b.image+'" style="max-width:100%;max-height:300px;border-radius:10px;border:2px solid '+color+'33;">':'')
          + (b.caption?'<div style="font-size:0.78rem;color:#666;margin-top:6px;font-style:italic;">'+esc(b.caption)+'</div>':'')
        + '</div>';
      } else if(b.type === 'list'){
        if(!b.heading && !b.content) return '';
        var items = (b.content||'').split('\n').filter(function(x){return x.trim();});
        return '<div style="background:'+color+'15;border-radius:8px;padding:12px 14px;margin-bottom:14px;">'
          + (b.heading?'<div style="font-size:0.95rem;font-weight:800;color:'+color+';margin-bottom:7px;">📋 '+esc(b.heading)+'</div>':'')
          + (items.length?'<ul style="margin:0;padding-left:18px;font-size:0.84rem;line-height:1.65;color:#333;">'+items.map(function(x){return '<li style="margin-bottom:3px;">'+esc(x.trim())+'</li>';}).join('')+'</ul>':'')
        + '</div>';
      } else if(b.type === 'quote'){
        if(!b.content) return '';
        return '<div style="background:linear-gradient(135deg,'+color+'22,'+color+'08);border-left:5px solid '+color+';border-radius:8px;padding:14px 18px;margin-bottom:14px;font-style:italic;">'
          + '<div style="font-size:0.92rem;line-height:1.65;color:#333;">"'+esc(b.content)+'"</div>'
          + (b.author?'<div style="font-size:0.78rem;color:'+color+';font-weight:700;margin-top:6px;text-align:right;">— '+esc(b.author)+'</div>':'')
        + '</div>';
      }
      return '';
    }).join('');
  },

  save: function(){
    if(!this._editId || !this._data){ App.toast('Nothing to save','warning'); return; }
    var list = this.getStore();
    var idx = list.findIndex(function(x){return x.id===Brochure._editId;});
    if(idx < 0){ App.toast('Brochure not found','error'); return; }
    list[idx].data = JSON.parse(JSON.stringify(this._data));
    list[idx].updated = new Date().toISOString().slice(0,10);
    this.setStore(list);
    try { Audit.log('BROCHURE','Saved: '+(this._data.title||'Untitled')); } catch(e){}
    App.toast('💾 Brochure saved','success');
  },

  delBrochure: function(id){
    if(!confirm('Delete this brochure?')) return;
    var list = this.getStore().filter(function(x){return x.id!==id;});
    this.setStore(list);
    try { Audit.log('BROCHURE','Deleted'); } catch(e){}
    App.toast('🗑 Deleted','info');
    this.render();
  },

  printBrochure: function(id){
    // Save first, then print preview
    var b;
    if(id){
      b = this.getStore().find(function(x){return x.id===id;});
    } else if(this._editId){
      this.save();
      b = this.getStore().find(function(x){return x.id===Brochure._editId;});
    }
    if(!b){ App.toast('Brochure not found','error'); return; }
    var co = STORE.get('pk3_settings', {}) || {};
    var d = b.data || {};
    var color = b.color || '#f97316';
    var logo = co.logo || '';
    var w = window.open('', '_blank', 'width=820,height=1000');
    if(!w){ App.toast('Popup blocked — allow popups to print','error'); return; }
    var doc = w.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+esc(d.title||'Brochure')+'</title>'
      +'<style>'
        +'@page{size:A4;margin:0}'
        +'*{box-sizing:border-box;margin:0;padding:0}'
        +'body{font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff}'
        +'.page{width:210mm;min-height:297mm;padding:18mm 16mm;background:#fff}'
        +'.header{background:linear-gradient(135deg,'+color+',rgba(0,0,0,0.4));padding:20px;border-radius:12px;color:#fff;display:flex;align-items:center;gap:14px;margin-bottom:18px}'
        +'.header img,.header .logo{width:70px;height:70px;border-radius:10px;background:#fff;padding:4px;object-fit:contain}'
        +'.header .logo{background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:2rem}'
        +'.header h1{font-size:1.6rem;line-height:1.2;margin-bottom:3px}'
        +'.header .tag{font-size:0.92rem;opacity:0.92}'
        +'.intro{font-size:0.95rem;line-height:1.65;margin-bottom:20px;white-space:pre-wrap}'
        +'.services{background:#f8f8fc;border-radius:12px;padding:16px;margin-bottom:16px}'
        +'.services h2{font-size:1rem;color:'+color+';margin-bottom:10px}'
        +'.svc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
        +'.svc{background:#fff;border-radius:8px;padding:10px;border-left:3px solid '+color+'}'
        +'.svc .nm{font-size:0.92rem;font-weight:700;margin-bottom:3px}'
        +'.svc .em{font-size:1.1rem;margin-right:5px}'
        +'.svc .ds{font-size:0.78rem;color:#555;line-height:1.4}'
        +'.why{background:'+color+'22;border:2px dashed '+color+';border-radius:10px;padding:14px 16px;margin-bottom:14px}'
        +'.why h3{font-size:0.95rem;color:'+color+';margin-bottom:6px}'
        +'.why pre{font-family:inherit;font-size:0.85rem;line-height:1.7;white-space:pre-wrap}'
        +'.offer{background:linear-gradient(90deg,#fef3c7,#fde68a);border-radius:10px;padding:12px 16px;margin-bottom:14px;text-align:center;font-weight:800;color:#92400e}'
        +'.cb-text{background:#fafbfc;border-left:4px solid '+color+';border-radius:8px;padding:12px 14px;margin-bottom:12px}'
        +'.cb-text h4{font-size:0.95rem;font-weight:800;color:'+color+';margin-bottom:5px}'
        +'.cb-text pre{font-family:inherit;font-size:0.86rem;line-height:1.65;color:#333;white-space:pre-wrap}'
        +'.cb-image{text-align:center;margin-bottom:12px}'
        +'.cb-image img{max-width:100%;max-height:300px;border-radius:10px;border:2px solid '+color+'33}'
        +'.cb-image .cap{font-size:0.78rem;color:#666;margin-top:6px;font-style:italic}'
        +'.cb-list{background:'+color+'15;border-radius:8px;padding:12px 14px;margin-bottom:12px}'
        +'.cb-list h4{font-size:0.95rem;font-weight:800;color:'+color+';margin-bottom:7px}'
        +'.cb-list ul{margin:0;padding-left:18px;font-size:0.84rem;line-height:1.65;color:#333}'
        +'.cb-quote{background:linear-gradient(135deg,'+color+'22,'+color+'08);border-left:5px solid '+color+';border-radius:8px;padding:14px 18px;margin-bottom:12px;font-style:italic}'
        +'.cb-quote .q{font-size:0.92rem;line-height:1.65;color:#333}'
        +'.cb-quote .a{font-size:0.78rem;color:'+color+';font-weight:700;margin-top:6px;text-align:right}'
        +'.foot{border-top:2px solid '+color+';padding-top:14px;text-align:center}'
        +'.foot .cta{font-size:1.05rem;font-weight:900;color:'+color+';margin-bottom:5px}'
        +'.foot .info{font-size:0.78rem;color:#666;line-height:1.5}'
      +'</style></head><body>'
      +'<div class="page">'
        +'<div class="header">'
          + (logo ? '<img src="'+logo+'">' : '<div class="logo">🏢</div>')
          +'<div><h1>'+esc(d.title||'Title')+'</h1><div class="tag">'+esc(d.tagline||'')+'</div></div>'
        +'</div>'
        +'<div class="intro">'+esc(d.intro||'')+'</div>'
        +'<div class="services">'
          +'<h2>⭐ Services / Features</h2>'
          +'<div class="svc-grid">'
          + (d.services||[]).map(function(s){
            return '<div class="svc"><div class="nm"><span class="em">'+esc(s.emoji||'⭐')+'</span>'+esc(s.name||'')+'</div><div class="ds">'+esc(s.desc||'')+'</div></div>';
          }).join('')
          +'</div>'
        +'</div>'
        + (d.whyUs?'<div class="why"><h3>💡 Why Choose Us</h3><pre>'+esc(d.whyUs)+'</pre></div>':'')
        + (d.offer?'<div class="offer">'+esc(d.offer)+'</div>':'')
        // Custom Blocks (v4.0.5)
        + (d.customBlocks||[]).map(function(b){
            if(b.type === 'text' && (b.heading||b.content)){
              return '<div class="cb-text">'
                + (b.heading?'<h4>'+esc(b.heading)+'</h4>':'')
                + (b.content?'<pre>'+esc(b.content)+'</pre>':'')
              + '</div>';
            } else if(b.type === 'image' && (b.image||b.caption)){
              return '<div class="cb-image">'
                + (b.image?'<img src="'+b.image+'">':'')
                + (b.caption?'<div class="cap">'+esc(b.caption)+'</div>':'')
              + '</div>';
            } else if(b.type === 'list' && (b.heading||b.content)){
              var items = (b.content||'').split('\n').filter(function(x){return x.trim();});
              return '<div class="cb-list">'
                + (b.heading?'<h4>📋 '+esc(b.heading)+'</h4>':'')
                + (items.length?'<ul>'+items.map(function(x){return '<li>'+esc(x.trim())+'</li>';}).join('')+'</ul>':'')
              + '</div>';
            } else if(b.type === 'quote' && b.content){
              return '<div class="cb-quote">'
                + '<div class="q">"'+esc(b.content)+'"</div>'
                + (b.author?'<div class="a">— '+esc(b.author)+'</div>':'')
              + '</div>';
            }
            return '';
          }).join('')
        +'<div class="foot">'
          +'<div class="cta">'+esc(d.cta||'')+'</div>'
          +'<div class="info">'+esc(co.companyName||'PRERAK MULTIPURPOSE PVT LTD')+' • '+esc(co.address||'Hetauda-2, Makwanpur')+'</div>'
          +'<div class="info">📞 '+esc(co.phone1||'9855069733')+(co.phone2?' / '+esc(co.phone2):'')+(co.email?' • '+esc(co.email):'')+'</div>'
        +'</div>'
      +'</div>'
      +'<script>setTimeout(function(){window.print();},500);<\/script>'
      +'</body></html>');
    doc.close();
  },

  shareBrochure: function(id){
    var b = id ? this.getStore().find(function(x){return x.id===id;}) : (this._editId ? this.getStore().find(function(x){return x.id===Brochure._editId;}) : null);
    if(!b){ App.toast('Brochure not found','error'); return; }
    var d = b.data || {};
    var msg = '*'+(d.title||'Brochure')+'*\n_'+(d.tagline||'')+'_\n\n'
      + (d.intro||'')+'\n\n'
      + '⭐ *Services:*\n'
      + (d.services||[]).map(function(s){ return (s.emoji||'⭐')+' '+s.name+(s.desc?' — '+s.desc:''); }).join('\n')
      + '\n\n' + (d.whyUs ? '✅ *Why Us:*\n'+d.whyUs+'\n\n' : '')
      + (d.offer ? '🎁 '+d.offer+'\n\n' : '')
      + (d.cta || '');
    var phone = prompt('Send to phone (10 digits, blank for general):');
    if(phone === null) return;
    var p = (phone||'').replace(/[^0-9]/g,'');
    var url = 'https://wa.me/'+(p?'977'+p:'')+'?text='+encodeURIComponent(msg);
    window.open(url, '_blank');
  },

  // Legacy aliases (kept for any other code that calls them)
  shareImage: function(){ this.shareBrochure(); },
  print: function(){ this.printBrochure(); }
};

