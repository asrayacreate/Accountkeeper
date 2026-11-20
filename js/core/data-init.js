// ─── APP MODULE ───────────────────────────────────────────────
// ─── SAFE DATA INITIALIZER ────────────────────────────────────────────────
function initDefaultRates() {
  try {
    var r = STORE.get('pk3_rates', null);
    var isEmpty = !r || typeof r !== 'object' || Object.keys(r).length === 0;
    // Also check if all categories are empty arrays
    if (!isEmpty) {
      var hasItems = Object.keys(r).some(function(k){ return Array.isArray(r[k]) && r[k].length > 0; });
      if (!hasItems) isEmpty = true;
    }
    if (isEmpty) RateList.resetDefaults(true);
  } catch(e) { console.warn('initDefaultRates error:', e); }
}
function initDefaultTemplates() {
  try {
    var t = STORE.get('pk3_templates', null);
    if (!t || !Array.isArray(t) || t.length === 0) {
      STORE.set('pk3_templates', Followups._defTpl());
    }
  } catch(e) { console.warn('initDefaultTemplates error:', e); }
}
function initWalkinTemplates() { initDefaultTemplates(); }
function initServiceCategories() {
  var r = STORE.get('pk3_rates', null);
  if (!r || Object.keys(r).length === 0) initDefaultRates();
}
function repairTemplates() {
  // Detect & repair: missing body, broken/replacement char, demo names, missing variables
  try {
    var stored = STORE.get('pk3_templates', null);
    var defaults = Followups._defTpl();

    // Case 1: missing entirely → use defaults
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
      STORE.set('pk3_templates', defaults);
      return;
    }

    // Detect if existing storage is broken (has replacement chars, demo phrases, or bare empty)
    var brokenCount = 0;
    var demoPhrases = ['prerak gautam','demo customer','test customer','sample','example name'];
    stored.forEach(function(t){
      if (!t) { brokenCount++; return; }
      var body = (t.text||t.body||t.message||'').toString();
      // Broken UTF-8 / replacement character
      if (body.indexOf('\uFFFD') !== -1 || body.indexOf('?') > -1 && body.split('?').length > 5) brokenCount++;
      // Empty body
      else if (!body.trim()) brokenCount++;
      // Hardcoded demo customer name
      else if (demoPhrases.some(function(p){ return body.toLowerCase().indexOf(p) !== -1; })) brokenCount++;
    });

    // If majority broken, replace all with fresh defaults (safer)
    if (brokenCount > stored.length / 2) {
      STORE.set('pk3_templates', defaults);
      return;
    }

    // Otherwise repair item-by-item
    var defByName = {};
    defaults.forEach(function(d){ defByName[(d.name||'').toLowerCase().trim()] = d; });
    var changed = false;
    var repaired = stored.map(function(t, i){
      if (!t) { changed = true; return defaults[i % defaults.length]; }
      var name = t.name || ('Template ' + (i+1));
      var body = (t.text || t.body || t.message || '').toString();
      var size = t.size || 'medium';
      var defMatch = defByName[name.toLowerCase().trim()];

      // Fix broken/empty body
      if (!body.trim() || body.indexOf('\uFFFD') !== -1) {
        changed = true;
        body = (defMatch && defMatch.text) ? defMatch.text : (defaults[i] ? defaults[i].text : defaults[0].text);
      }
      // Replace any hardcoded demo names with {name} variable
      demoPhrases.forEach(function(p){
        var re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
        if (re.test(body)) { body = body.replace(re, '{name}'); changed = true; }
      });
      // Migrate [name] → {name} for new variable system
      if (body.indexOf('[name]') !== -1) { body = body.split('[name]').join('{name}'); changed = true; }
      if (body.indexOf('[amount]') !== -1) { body = body.split('[amount]').join('{amount}'); changed = true; }

      return { name: name, text: body, size: size };
    });

    if (changed) STORE.set('pk3_templates', repaired);
  } catch(e) { console.warn('repairTemplates error:', e); }
}

// ─── TEMPLATE VARIABLE REPLACEMENT ─────────────────────────────────────────
function fillTemplate(template, customer) {
  if (!template) return '';
  var body = (template.text || template.body || template.message || '').toString();
  var co = STORE.get('pk3_settings', {}) || {};
  var c = customer || {};
  var demoNames = ['demo','test','prerak gautam','sample','example'];
  var rawName = (c.name || '').trim();
  var safeName = (!rawName || demoNames.indexOf(rawName.toLowerCase()) !== -1) ? 'ग्राहक' : rawName;
  var vars = {
    '{name}':    safeName,
    '{phone}':   c.phone || '',
    '{service}': (function(){ try { var a = Customers.getServices(c).map(function(x){return x.work;}).filter(Boolean); return a.length ? a.join(', ') : (c.work || c.service || 'तपाईंको काम'); } catch(e){ return c.work || c.service || 'तपाईंको काम'; } })(),
    '{address}': c.address || '',
    '{amount}':  c.amount || c.balance || ''
  };
  // v7.0.0: company placeholders come only from the user's own Company Settings
  try { var cv = Company.vars(); Object.keys(cv).forEach(function(k){ if(!(k in vars)) vars[k] = cv[k] || ''; }); } catch(e) {}
  // Also support [name] legacy format
  Object.keys(vars).forEach(function(k){
    var v = vars[k];
    body = body.split(k).join(v);
    var legacy = k.replace('{','[').replace('}',']');
    body = body.split(legacy).join(v);
  });
  // Clean up double spaces, trailing whitespace per line
  body = body.split('\n').map(function(l){ return l.replace(/  +/g,' ').replace(/\s+$/,''); }).join('\n');
  try { body = Company.tidy(body); } catch(e) {}
  return body;
}

// Filter templates by size: 'short' | 'medium' | 'full' | null (all)
function getTemplatesBySize(size) {
  var all = STORE.get('pk3_templates', null) || Followups._defTpl();
  if (!size || size === 'all') return all;
  if (size === 'full') return all;  // 'full' = all available
  return all.filter(function(t){ return !t.size || t.size === size; });
}

// ─── DEFAULT BUSINESS DATA ──────────────────────────────────────────────────
var SERVICES_DATA = [
  {name:'Construction / Civil Work', subs:['House Construction','RCC Work','Foundation Work','Brick Work','Plaster Work','Slab Casting','Column / Beam Work','Flooring','Renovation','Turnkey Project']},
  {name:'Interior Design', subs:['Full Interior Setup','Modular Kitchen','Wardrobe','TV Unit','Wall Panel','Partition Work','False Ceiling Design','Lighting Setup','Furniture','Office Interior']},
  {name:'UPVC', subs:['UPVC Windows','UPVC Door','UPVC Sliding Window','UPVC Sliding Door','UPVC Partition','UPVC Fixed Window','Glass Work']},
  {name:'Aluminum', subs:['Aluminum Window','Aluminum Door','Aluminum Sliding Window','Aluminum Partition','ACP Panel','Aluminum Railing','Glass Work']},
  {name:'Gypsum / False Ceiling', subs:['False Ceiling','POP Design','Grid Ceiling','Gypsum Partition','Ceiling Light Setup','PVC Ceiling']},
  {name:'Plumbing', subs:['Pipe Fitting','Bathroom Setup','Water Tank Installation','Sanitary Work','Drainage','Water Supply']},
  {name:'Electrical', subs:['Wiring','Lighting Setup','Switch Board Installation','MCB/DB Setup','Inverter Wiring','Fan Installation']},
  {name:'Painting / Finishing', subs:['Interior Painting','Exterior Painting','Texture Work','Putty Work','Polish','Waterproofing']},
  {name:'Tile / Marble / Granite', subs:['Floor Tiles','Wall Tiles','Marble Work','Granite Work','Bathroom Tile','Kitchen Tile','Stair Granite']},
  {name:'Truss / Roofing', subs:['Roof Truss','CG Sheet Roofing','Steel Structure','Polycarbonate Sheet','Shed Work']},
  {name:'Solar / Water Heater', subs:['Solar Panel','Solar Water Heater','Water Purifier','Chimney','Cooking Stove']},
  {name:'Prefab / WPC', subs:['Prefab House','WPC Door','WPC Panel','Prefab Wall','Partition Work']},
  {name:'Repair / Renovation', subs:['House Renovation','Repair Work','Maintenance','Bathroom Renovation','Kitchen Renovation','Leakage Repair']}
];
// Object lookup for fast sub-service access
var SERVICES_MAP = (function(){
  var m = {};
  SERVICES_DATA.forEach(function(s){ m[s.name] = s.subs; });
  // Backward compatibility: old records saved with combined "UPVC / Aluminum"
  m['UPVC / Aluminum'] = ['UPVC Windows','UPVC Door','Sliding Door','Aluminum Window','Aluminum Door','Aluminum Partition','Glass Work','ACP Panel'];
  return m;
})();

var DEFAULT_RATES = {
  'UPVC / Aluminum': [
    {name:'UPVC Window (Single Glass)',rate:600,unit:'sqft'},{name:'UPVC Window (Double Glass)',rate:1200,unit:'sqft'},
    {name:'UPVC Sliding Window',rate:800,unit:'sqft'},{name:'UPVC Door',rate:1400,unit:'sqft'},
    {name:'Aluminum Sliding Window',rate:850,unit:'sqft'},{name:'Aluminum Door',rate:1100,unit:'sqft'},
    {name:'Aluminum Composite Panel (ACP)',rate:120,unit:'sqft'},{name:'Aluminum Partition',rate:280,unit:'sqft'}
  ],
  'Gypsum / False Ceiling': [
    {name:'Gypsum Ceiling Normal',rate:120,unit:'sqft'},{name:'Gypsum Ceiling Designer',rate:180,unit:'sqft'},
    {name:'Gypsum Partition',rate:160,unit:'sqft'},{name:'PVC Ceiling',rate:110,unit:'sqft'},
    {name:'Ceiling Light Setup',rate:2500,unit:'point'}
  ],
  'Interior Design': [
    {name:'Modular Kitchen',rate:3500,unit:'sqft'},{name:'Wardrobe',rate:2200,unit:'sqft'},
    {name:'TV Unit',rate:1800,unit:'sqft'},{name:'Wall Panel',rate:350,unit:'sqft'},
    {name:'Full Interior Package',rate:0,unit:'custom'}
  ],
  'Construction / Civil Work': [
    {name:'RCC Work',rate:450,unit:'sqft'},{name:'Brick Work',rate:55,unit:'sqft'},
    {name:'Plaster Work',rate:45,unit:'sqft'},{name:'New House Construction',rate:2800,unit:'sqft'},
    {name:'Turnkey Construction',rate:3500,unit:'sqft'}
  ],
  'Plumbing': [
    {name:'Bathroom Fitting',rate:15000,unit:'set'},{name:'Pipeline Work',rate:150,unit:'rft'},
    {name:'Water Tank Setup',rate:5000,unit:'job'},{name:'Sanitary Installation',rate:12000,unit:'set'}
  ],
  'Electrical': [
    {name:'House Wiring',rate:90,unit:'sqft'},{name:'Light Point',rate:800,unit:'point'},
    {name:'MCB/DB Setup',rate:5000,unit:'set'},{name:'Fan Installation',rate:800,unit:'point'}
  ],
  'Painting / Finishing': [
    {name:'Interior Paint',rate:35,unit:'sqft'},{name:'Exterior Paint',rate:45,unit:'sqft'},
    {name:'Putty Work',rate:30,unit:'sqft'},{name:'Texture Paint',rate:90,unit:'sqft'}
  ],
  'Tile / Marble / Granite': [
    {name:'Floor Tile Fixing',rate:80,unit:'sqft'},{name:'Wall Tile Fixing',rate:90,unit:'sqft'},
    {name:'Marble Fixing',rate:120,unit:'sqft'},{name:'Granite Fixing',rate:150,unit:'sqft'}
  ],
  'Truss / Roofing': [
    {name:'Metal Truss',rate:350,unit:'sqft'},{name:'Roofing Sheet',rate:180,unit:'sqft'},
    {name:'Shed Work',rate:300,unit:'sqft'}
  ],
  'Solar / Water Heater': [
    {name:'Solar Water Heater',rate:45000,unit:'set'},{name:'Solar Panel Setup',rate:0,unit:'custom'},
    {name:'Water Purifier Installation',rate:2500,unit:'job'},{name:'Chimney Installation',rate:2500,unit:'job'}
  ]
};

// v7.0.0: DEFAULT_TEMPLATES is now a getter (see js/core/business-profiles.js) that returns the
// templates of the chosen business type, with {company}/{phone1}/… placeholders — no hardcoded company.

function migrateOldKeysToPk3() {
  // Copy data from old bare keys → pk3_* keys if pk3_* is missing
  var migrations = [
    { old: 'rates',     pk3: 'pk3_rates',     isObj: true  },
    { old: 'templates', pk3: 'pk3_templates',  isObj: false },
    { old: 'services',  pk3: 'pk3_services',   isObj: false },
    { old: 'settings',  pk3: 'pk3_settings',   isObj: true  },
    { old: 'customers', pk3: 'pk3_customers',  isObj: false },
    { old: 'quotations',pk3: 'pk3_quotations', isObj: false },
    { old: 'followups', pk3: 'pk3_followups',  isObj: false },
    { old: 'daybook',   pk3: 'pk3_daybook',    isObj: false },
    { old: 'staff',     pk3: 'pk3_staff',      isObj: false },
    { old: 'stock',     pk3: 'pk3_stock',      isObj: false }
  ];
  var migrated = [];
  migrations.forEach(function(m){
    try {
      var oldRaw = localStorage.getItem(m.old);
      var pk3Raw = localStorage.getItem(m.pk3);
      if (oldRaw && !pk3Raw) {
        // Old key exists but pk3 key is missing → copy
        var oldVal = JSON.parse(oldRaw);
        var valid = m.isObj ? (oldVal && typeof oldVal === 'object' && !Array.isArray(oldVal) && Object.keys(oldVal).length > 0)
                            : (Array.isArray(oldVal) && oldVal.length > 0);
        if (valid) {
          localStorage.setItem(m.pk3, oldRaw);  // copy raw JSON string
          migrated.push(m.old + ' → ' + m.pk3);
        }
      }
    } catch(e) {}
  });
  // (migration log removed for production)
}

function repairBusinessData() {
  var DATA_VERSION = 5;  // bumped: forces pk3_services reseed  // bump this to force re-seed on next load
  var storedVer = STORE.get('pk3_data_version', 0);
  var forceRepair = (storedVer < DATA_VERSION);

  // ── A. RATES ──────────────────────────────────────────────────────────────
  var rates = STORE.get('pk3_rates', null);
  var ratesOk = rates && typeof rates === 'object' && !Array.isArray(rates);
  if (ratesOk && !forceRepair) {
    var keys = Object.keys(rates);
    var hasItems = keys.some(function(k){ return Array.isArray(rates[k]) && rates[k].length > 0; });
    var numericKeys = keys.length > 0 && keys.every(function(k){ return !isNaN(Number(k)); });
    if (!hasItems || numericKeys) ratesOk = false;
  }
  if (!ratesOk || forceRepair) {
    var merged = (ratesOk && !forceRepair) ? JSON.parse(JSON.stringify(rates)) : {};
    Object.keys(DEFAULT_RATES).forEach(function(cat){
      if (!merged[cat] || !Array.isArray(merged[cat]) || !merged[cat].length) {
        merged[cat] = DEFAULT_RATES[cat];
      }
    });
    STORE.set('pk3_rates', merged);
    // rate list repaired
  }

  // ── B. SERVICES ──────────────────────────────────────────────────────────
  var svcs = STORE.get('pk3_services', null);
  var svcsOk = svcs && Array.isArray(svcs) && svcs.length > 0
               && svcs.every(function(s){ return s && typeof s.name === 'string' && s.name.trim(); });
  if (!svcsOk || forceRepair) {
    STORE.set('pk3_services', SERVICES_DATA);
    // services repaired
  }

  // ── C. TEMPLATES ─────────────────────────────────────────────────────────
  var tpls = STORE.get('pk3_templates', null);
  var tplsOk = tpls && Array.isArray(tpls) && tpls.length > 0
               && tpls.every(function(t){ return t && t.name && (t.text||t.body||t.message||'').trim(); });
  if (!tplsOk || forceRepair) {
    // Preserve user templates that have both name AND body
    var goodUser = (tpls && Array.isArray(tpls))
      ? tpls.filter(function(t){
          if (!t || !t.name) return false;
          var body = (t.text||t.body||t.message||'').trim();
          return body.length > 0;
        })
      : [];
    // Merge: defaults first, then user-added ones not already in defaults
    var defNames = DEFAULT_TEMPLATES.map(function(d){ return d.name; });
    var userExtra = goodUser.filter(function(t){ return defNames.indexOf(t.name) === -1; });
    STORE.set('pk3_templates', DEFAULT_TEMPLATES.concat(userExtra));
    // templates repaired
  }

  // ── D. Mark version ───────────────────────────────────────────────────────
  STORE.set('pk3_data_version', DATA_VERSION);
  // business data repair complete
}

// One-time migration: earlier builds overwrote status='Returned' (broke statMap/color-maps).
// Convert any such records to the _returned flag and restore a sane status.
function migrateReturnedStatus() {
  ['pk3_invoices','pk3_quotations'].forEach(function(key){
    try {
      var list = STORE.get(key, []) || [];
      var changed = false;
      list.forEach(function(rec){
        if (rec && rec.status === 'Returned') {
          rec._returned = true;
          // give back a valid status so charts/tags work; default Pending
          rec.status = (key==='pk3_invoices') ? 'Pending' : 'Pending';
          changed = true;
        }
      });
      if (changed) STORE.set(key, list);
    } catch(e){}
  });
}

function initAppDataSafe() {
  try { migrateReturnedStatus(); } catch(e) {}
  try { if(window.DayBook && DayBook.backfillVouchers) DayBook.backfillVouchers(); } catch(e) {}
  // Note: repairBusinessData() and migrateOldKeysToPk3() are called before this in DOMContentLoaded
  try { initDefaultTemplates(); } catch(e) {}
  try { repairTemplates(); } catch(e) {}
  try { initDefaultRates(); } catch(e) {}
  try {
    if (!STORE.get('pk3_customers', null)) STORE.set('pk3_customers', []);
    if (!STORE.get('pk3_quotations', null)) STORE.set('pk3_quotations', []);
    if (!STORE.get('pk3_followups', null)) STORE.set('pk3_followups', []);
    if (!STORE.get('pk3_daybook', null)) STORE.set('pk3_daybook', []);
    if (!STORE.get('pk3_invoices', null)) STORE.set('pk3_invoices', []);
    if (!STORE.get('pk3_staff', null)) STORE.set('pk3_staff', []);
    if (!STORE.get('pk3_stock', null)) STORE.set('pk3_stock', []);
    if (!STORE.get('pk3_walkins', null)) STORE.set('pk3_walkins', []);
    if (!STORE.get('pk3_estimates', null)) STORE.set('pk3_estimates', []);
    if (!STORE.get('pk3_activity', null)) STORE.set('pk3_activity', []);
    if (!STORE.get('pk3_audit', null)) STORE.set('pk3_audit', []);
    // v7.0.0: pk3_company is no longer seeded with any company's details (Company Settings = pk3_settings)
    if (!STORE.get('pk3_settings', null)) STORE.set('pk3_settings', {});
  } catch(e) { console.warn('initAppDataSafe error:', e); }
}

