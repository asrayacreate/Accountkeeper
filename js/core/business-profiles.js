// ═══════════════ BUSINESS PROFILES + SETUP WIZARD DATA (v7.0.0) ═══════════════
// नयाँ प्रयोगकर्ताले Setup Wizard मा छानेको व्यवसाय अनुसार सुरुवाती Services, Rate List,
// WhatsApp Message Templates र Modules सेट हुन्छन्। सबै template मा कम्पनीको विवरण
// placeholder ({company}, {phone1}, {phone2}, {company_address}, {email}, {tagline},
// {services_list}) बाट आउँछ — कुनै कम्पनीको नाम/फोन यहाँ लेखिँदैन।
//
// Loaded after data-init.js (uses SERVICES_DATA and DEFAULT_RATES for "construction").

var COMMON_TEMPLATES = [
  {name:'🏢 Company Introduction', text:'नमस्ते {name} जी! 🙏\n{company} मा हार्दिक स्वागत छ!\n\nहाम्रा सेवाहरू:\n{services_list}\n\nQuality • Best Price • On-time Service\n📞 {phone1} | {phone2}\n📍 {company_address}\n✉️ {email}\n\n"{tagline}"\nतपाईंको सेवामा सदैव तत्पर! 🙏'},
  {name:'🚪 Walk-in Welcome', size:'short', text:'नमस्कार {name} जी 🙏\n{company} मा हार्दिक स्वागत छ।\nहाम्रोमा आउनुभएकोमा धन्यवाद। केही आवश्यक परे सम्पर्क गर्नुहोला।\n📞 {phone1} / {phone2}\n📍 {company_address}'},
  {name:'📞 Follow-up', size:'medium', text:'नमस्कार {name} जी 🙏\nपहिले भएको कुराकानी अनुसार {service} सम्बन्धी follow-up गर्न सम्पर्क गरेको हुँ।\nथप जानकारी चाहिए जानकारी दिनुहोला।\n📞 {phone1} / {phone2}'},
  {name:'✅ Quotation Ready', size:'medium', text:'नमस्कार {name} जी 🙏\nतपाईंको {service} सम्बन्धी quotation/estimate तयार भएको छ।\nकृपया हेरेर कुनै सुधार वा थप जानकारी चाहिएको भए बताइदिनुहोस्।\n📞 {phone1} / {phone2}'},
  {name:'💰 Payment Reminder', size:'short', text:'नमस्कार {name} जी 🙏\nतपाईंको {service} सम्बन्धी बाँकी payment सम्झाउन यो सन्देश पठाइएको हो।\nकृपया समय मिलाएर payment update गरिदिनुहोला।\n📞 {phone1}\n— {company}'},
  {name:'⭐ Review Request', size:'short', text:'नमस्कार {name} जी 🙏\nहामीसँग सेवा लिनुभएकोमा धन्यवाद।\nहाम्रो काम मन परेमा कृपया feedback/review दिनुहोला।\n— {company}'},
  {name:'🤝 Referral Request', size:'short', text:'नमस्कार {name} जी 🙏\nहाम्रो सेवा मन परेको भए आफन्त/साथीहरूलाई {company} सिफारिस गरिदिनुहोला।\n📞 {phone1}'},
  {name:'🎁 Discount Offer', size:'short', text:'नमस्कार {name} जी 🙏\n{company} मा अहिले विशेष offer उपलब्ध छ।\nथप जानकारीका लागि सम्पर्क गर्नुहोस्।\n📞 {phone1}'},
  {name:'🪔 Dashain/Tihar शुभकामना', size:'short', text:'नमस्कार {name} जी 🙏\nविजया दशमी, शुभ दीपावली तथा छठ पर्वको हार्दिक मंगलमय शुभकामना।\n{company} परिवार।'}
];

// Construction / Interior — the original v6.9 defaults, now with placeholders.
var CONSTRUCTION_TEMPLATES = [
{name:'🏢 Company Introduction', text:'नमस्ते {name} जी! 🙏\n{company} मा हार्दिक स्वागत छ!\n\nहाम्रा सेवाहरू:\n{services_list}\n\nQuality Work • Best Price • On-time Delivery\n📞 {phone1} | {phone2}\n📍 {company_address}\n✉️ {email}\n\n"{tagline}"\nतपाईंको सेवामा सदैव तत्पर! 🙏'},
    {name:'🚪 Walk-in Welcome (Short)', size:'short', text:'नमस्कार {name} जी 🙏\n{company} मा स्वागत छ।\nघर निर्माण, इन्टेरियर, UPVC/Aluminum, Gypsum, Plumbing, Electrical, Painting तथा Renovation सम्बन्धी सल्लाह, site visit र estimate का लागि हामी उपलब्ध छौं।\n📞 {phone1} / {phone2}'},
    {name:'🚪 Walk-in Welcome (Medium)', size:'medium', text:'नमस्कार {name} जी 🙏\n{company} मा हार्दिक स्वागत छ।\nहाम्रो showroom/सेवाबारे चासो देखाउनुभएकोमा धन्यवाद।\n\nहामी उपलब्ध सेवा:\n• घर तथा भवन निर्माण\n• इन्टेरियर डिजाइन\n• UPVC/Aluminum झ्याल–ढोका\n• Gypsum/False Ceiling\n• Plumbing, Electrical, Painting\n• Renovation तथा Finishing\n\nSite visit वा estimate का लागि सम्पर्क गर्नुहोस्।\n📞 {phone1} / {phone2}\n📍 {company_address}'},
    {name:'🏠 Site Visit', size:'medium', text:'नमस्कार {name} जी 🙏\nतपाईंको {service} सम्बन्धी site visit / measurement का लागि हामी उपलब्ध छौं।\nकृपया location र उपयुक्त समय पठाइदिनुहोस्।\n📞 {phone1} / {phone2}'},
    {name:'✅ Quotation Ready', size:'medium', text:'नमस्कार {name} जी 🙏\nतपाईंको {service} सम्बन्धी quotation/estimate तयार भएको छ।\nकृपया हेरेर कुनै सुधार वा थप जानकारी चाहिएको भए बताइदिनुहोस्।\n📞 {phone1} / {phone2}'},
    {name:'📞 Follow-up', size:'medium', text:'नमस्कार {name} जी 🙏\nपहिले भएको कुराकानी अनुसार {service} सम्बन्धी follow-up गर्न सम्पर्क गरेको हुँ।\nथप सल्लाह, site visit वा estimate आवश्यक भए जानकारी दिनुहोला।\n📞 {phone1}'},
    {name:'💰 Payment Reminder', size:'short', text:'नमस्कार {name} जी 🙏\nतपाईंको {service} सम्बन्धी बाँकी payment सम्झाउन यो सन्देश पठाइएको हो।\nकृपया समय मिलाएर payment update गरिदिनुहोला।\n📞 {phone1}'},
    {name:'🎉 Work Complete', size:'short', text:'नमस्कार {name} जी 🙏\nतपाईंको {service} सम्बन्धी काम सम्पन्न भएको जानकारी गराउँदछौं।\nहामीलाई विश्वास गर्नुभएकोमा धन्यवाद।\nFeedback दिनुहोला।\n📞 {phone1}'},
    {name:'🌟 Lead Greeting', size:'medium', text:'नमस्कार {name} जी 🙏\n{company} बाट सम्पर्क गरेको हुँ।\nतपाईंलाई construction, interior, UPVC/Aluminum, gypsum वा renovation सम्बन्धी सेवा चाहिएको भए हामी site visit र estimate मा सहयोग गर्न तयार छौं।\n📞 {phone1} / {phone2}'},
    {name:'🔥 Hot Lead', size:'short', text:'नमस्कार {name} जी 🙏\nतपाईंको काम urgent देखिएकोले हामी छिटो site visit/estimate मिलाउन तयार छौं।\nकृपया location र उपयुक्त समय पठाइदिनुहोस्।\n📞 {phone1} / {phone2}'},
    {name:'☀️ Warm Lead Reminder', size:'short', text:'नमस्कार {name} जी 🙏\nपहिले तपाईंले {service} सम्बन्धी सोधपुछ गर्नुभएको थियो।\nअझै estimate वा site visit आवश्यक भए हामी सहयोग गर्न तयार छौं।\n📞 {phone1}'},
    {name:'❄️ Cold Lead', size:'short', text:'नमस्कार {name} जी 🙏\nभविष्यमा construction, interior, UPVC/Aluminum, gypsum वा renovation सम्बन्धी आवश्यकता परे {company} लाई सम्झनुहोला।\n📞 {phone1}'},
    {name:'🪟 Service: UPVC/Aluminum', size:'medium', text:'नमस्कार {name} जी 🙏\nहामी UPVC/Aluminum झ्याल–ढोका, sliding window, partition तथा glass work सम्बन्धी काम गर्छौं।\nतपाईंको आवश्यकता अनुसार measurement, design suggestion र estimate उपलब्ध गराउन सक्छौं।\n📞 {phone1}'},
    {name:'🏗️ Service: Gypsum', size:'medium', text:'नमस्कार {name} जी 🙏\nहामी gypsum ceiling, false ceiling, partition, TV unit, lighting setup तथा interior finishing सम्बन्धी काम गर्छौं।\nतपाईंको room/site अनुसार design र estimate तयार गर्न सकिन्छ।\n📞 {phone1}'},
    {name:'🛋️ Interior Consultation', size:'medium', text:'नमस्कार {name} जी 🙏\nतपाईंको घर/office interior design, modular kitchen, wardrobe, ceiling, lighting तथा finishing सम्बन्धी सल्लाह र estimate का लागि हामी तयार छौं।\n📞 {phone1} / {phone2}'},
    {name:'🏛️ Construction Consultation', size:'medium', text:'नमस्कार {name} जी 🙏\nघर तथा भवन निर्माण, planning, estimate, material suggestion र turnkey construction सम्बन्धी परामर्शका लागि {company} लाई सम्झनुहोस्।\n📞 {phone1} / {phone2}'},
    {name:'🪔 Dashain/Tihar शुभकामना', size:'short', text:'नमस्कार {name} जी 🙏\nविजया दशमी, शुभ दीपावली तथा छठ पर्वको हार्दिक मंगलमय शुभकामना।\n{company} परिवार।'},
    {name:'🎁 Discount Offer', size:'short', text:'नमस्कार {name} जी 🙏\n{company} मा construction, interior, UPVC/Aluminum, gypsum तथा renovation सेवामा विशेष offer उपलब्ध छ।\nथप जानकारीका लागि सम्पर्क गर्नुहोस्।\n📞 {phone1}'},
    {name:'🛍️ Festival Sale', size:'medium', text:'नमस्कार {name} जी 🙏\nचाडपर्वको अवसरमा घर निर्माण, interior design, UPVC/Aluminum, gypsum र renovation सेवामा विशेष छुट उपलब्ध छ।\nआफ्नो कामको estimate का लागि आजै सम्पर्क गर्नुहोस्।\n📞 {phone1} / {phone2}'},
    {name:'⭐ Review Request', size:'short', text:'नमस्कार {name} जी 🙏\nहामीसँग सेवा लिनुभएकोमा धन्यवाद।\nहाम्रो काम मन परेमा कृपया feedback/review दिनुहोला।\nतपाईंको सुझावले हामीलाई अझ राम्रो सेवा दिन सहयोग गर्छ।\n📞 {phone1}'},
    {name:'🤝 Referral Request', size:'short', text:'नमस्कार {name} जी 🙏\nहाम्रो सेवा मन परेको भए construction, interior वा renovation चाहिने आफन्त/साथीहरूलाई {company} सिफारिस गरिदिनुहोला।\n📞 {phone1}'}
];

function _tpl(extra) {
  // profile-specific first, then common ones whose names are not already used
  var names = extra.map(function (t) { return t.name; });
  return extra.concat(COMMON_TEMPLATES.filter(function (t) { return names.indexOf(t.name) === -1; }));
}

var BUSINESS_PROFILES = {
  construction: {
    id: 'construction', icon: '🏗️', label: 'निर्माण / इन्टेरियर / मोड्युलर फर्निचर',
    hint: 'Construction, Interior, UPVC, Gypsum, Modular Kitchen, Renovation',
    aiDescription: 'a construction, interior and modular furniture business in Nepal',
    services: function () { return SERVICES_DATA; },
    rates: function () { return DEFAULT_RATES; },
    templates: function () { return CONSTRUCTION_TEMPLATES; },
    intro: [
      { icon: '🏗️', t: 'Construction, Civil Work & Renovation' }, { icon: '🏠', t: 'Prefab Wall / Homes' },
      { icon: '🔩', t: 'Truss Works / Roofing' }, { icon: '🪟', t: 'UPVC / Aluminum Window & Door' },
      { icon: '🎨', t: 'Gypsum / False Ceiling' }, { icon: '🛋️', t: 'Interior Design & Decoration' },
      { icon: '🍽️', t: 'Modular Kitchen & Furniture' }, { icon: '🧱', t: 'Tiles / Marble / Parquet Flooring' },
      { icon: '🖌️', t: 'Painting / Texture Work' }, { icon: '🚪', t: 'WPC Door & Panel' },
      { icon: '☀️', t: 'Solar Water Heater & Panel' }, { icon: '🔥', t: 'Chimney / Cooking Stove' },
      { icon: '💧', t: 'Water Purifier Installation' }
    ],
    modules: { projects: true, measurement: true, payables: true, stock: true, quotations: true, walkin: true, ai: true }
  },

  hardware: {
    id: 'hardware', icon: '🔩', label: 'हार्डवेयर / सप्लायर',
    hint: 'Cement, Rod, Plywood, Sanitary, Electrical, Paint, Tools',
    aiDescription: 'a hardware and building-material supplier in Nepal',
    services: function () { return [
      { name: 'Cement & Steel', subs: ['Cement', 'TMT Rod', 'Binding Wire', 'GI Wire'] },
      { name: 'Plywood & Board', subs: ['Plywood', 'MDF Board', 'Laminate Sheet', 'Veneer', 'Edge Band'] },
      { name: 'Sanitary & Pipes', subs: ['CPVC Pipe', 'PVC Pipe', 'GI Pipe', 'Fittings', 'Water Tank', 'Bath Fittings'] },
      { name: 'Electrical Items', subs: ['Wire', 'Switch / Socket', 'MCB / DB', 'LED Light', 'Fan'] },
      { name: 'Paint & Chemicals', subs: ['Emulsion Paint', 'Enamel', 'Primer', 'Putty', 'Waterproofing'] },
      { name: 'Tools & Hardware', subs: ['Hand Tools', 'Power Tools', 'Hinges / Handles', 'Screws / Nails', 'Locks'] }
    ]; },
    rates: function () { return {
      'Cement & Steel': [{ name: 'Cement (OPC)', rate: 850, unit: 'bag' }, { name: 'Cement (PPC)', rate: 780, unit: 'bag' }, { name: 'TMT Rod 12mm', rate: 105, unit: 'kg' }, { name: 'Binding Wire', rate: 150, unit: 'kg' }],
      'Plywood & Board': [{ name: 'Plywood 18mm (8x4)', rate: 3200, unit: 'sheet' }, { name: 'MDF Board 18mm', rate: 2600, unit: 'sheet' }, { name: 'Laminate 1mm', rate: 1500, unit: 'sheet' }],
      'Sanitary & Pipes': [{ name: 'CPVC Pipe 1"', rate: 450, unit: 'length' }, { name: 'PVC Pipe 4"', rate: 950, unit: 'length' }, { name: 'Water Tank 1000L', rate: 14500, unit: 'piece' }],
      'Electrical Items': [{ name: 'Wire 2.5mm (90m)', rate: 4200, unit: 'coil' }, { name: 'MCB 16A', rate: 350, unit: 'piece' }, { name: 'LED Bulb 12W', rate: 250, unit: 'piece' }],
      'Paint & Chemicals': [{ name: 'Interior Emulsion', rate: 3800, unit: '10 ltr' }, { name: 'Wall Putty', rate: 1100, unit: '20 kg' }]
    }; },
    templates: function () { return _tpl([
      { name: '📦 Order Ready', size: 'short', text: 'नमस्कार {name} जी 🙏\nतपाईंको अर्डर तयार भएको छ। पसलबाट लैजान वा delivery का लागि सम्पर्क गर्नुहोस्।\n📞 {phone1} / {phone2}\n— {company}' },
      { name: '🚚 Delivery Update', size: 'short', text: 'नमस्कार {name} जी 🙏\nतपाईंको सामान आज delivery का लागि निस्किएको छ। कृपया site मा कोही उपलब्ध हुनुहोला।\n📞 {phone1}\n— {company}' },
      { name: '🆕 New Stock Arrived', size: 'short', text: 'नमस्कार {name} जी 🙏\n{company} मा नयाँ stock आएको छ — cement, rod, plywood, sanitary, electrical तथा paint।\nउचित मूल्यका लागि सम्पर्क गर्नुहोस्।\n📞 {phone1}' }
    ]); },
    intro: [{ icon: '🧱', t: 'Cement, Rod & Building Material' }, { icon: '🪵', t: 'Plywood, MDF & Laminate' }, { icon: '🚿', t: 'Sanitary & Pipes' }, { icon: '💡', t: 'Electrical Items' }, { icon: '🎨', t: 'Paint & Chemicals' }, { icon: '🛠️', t: 'Tools & Hardware' }, { icon: '🚚', t: 'Site Delivery' }],
    modules: { projects: false, measurement: false, payables: true, stock: true, quotations: true, walkin: true, ai: true }
  },

  furniture: {
    id: 'furniture', icon: '🛋️', label: 'फर्निचर / सोरुम',
    hint: 'Sofa, Bed, Wardrobe, Dining, Office Furniture, Custom Order',
    aiDescription: 'a furniture showroom in Nepal',
    services: function () { return [
      { name: 'Living Room', subs: ['Sofa Set', 'Center Table', 'TV Unit', 'Recliner'] },
      { name: 'Bedroom', subs: ['Bed', 'Wardrobe', 'Dressing Table', 'Side Table', 'Mattress'] },
      { name: 'Dining', subs: ['Dining Set', 'Dining Chair', 'Crockery Unit'] },
      { name: 'Office Furniture', subs: ['Office Table', 'Office Chair', 'File Cabinet', 'Workstation'] },
      { name: 'Custom / Modular', subs: ['Modular Kitchen', 'Custom Wardrobe', 'Wall Panel', 'Repair / Polish'] }
    ]; },
    rates: function () { return {
      'Living Room': [{ name: 'Sofa Set (3+1+1)', rate: 65000, unit: 'set' }, { name: 'Center Table', rate: 12000, unit: 'piece' }, { name: 'TV Unit', rate: 18000, unit: 'piece' }],
      'Bedroom': [{ name: 'Double Bed (with storage)', rate: 48000, unit: 'piece' }, { name: 'Wardrobe (3 door)', rate: 42000, unit: 'piece' }, { name: 'Mattress (6x5)', rate: 22000, unit: 'piece' }],
      'Dining': [{ name: 'Dining Set (6 seater)', rate: 55000, unit: 'set' }, { name: 'Dining Chair', rate: 6500, unit: 'piece' }],
      'Office Furniture': [{ name: 'Office Table', rate: 15000, unit: 'piece' }, { name: 'Office Chair', rate: 9500, unit: 'piece' }],
      'Custom / Modular': [{ name: 'Modular Kitchen', rate: 3200, unit: 'sqft' }, { name: 'Custom Wardrobe', rate: 2000, unit: 'sqft' }]
    }; },
    templates: function () { return _tpl([
      { name: '🛋️ Showroom Visit', size: 'short', text: 'नमस्कार {name} जी 🙏\n{company} showroom मा नयाँ design का sofa, bed, wardrobe र dining set आएका छन्।\nहेर्न आउनुहोला।\n📍 {company_address}\n📞 {phone1}' },
      { name: '📦 Order Ready', size: 'short', text: 'नमस्कार {name} जी 🙏\nतपाईंको फर्निचर तयार भएको छ। Delivery मिति मिलाउन सम्पर्क गर्नुहोस्।\n📞 {phone1} / {phone2}\n— {company}' }
    ]); },
    intro: [{ icon: '🛋️', t: 'Sofa & Living Room' }, { icon: '🛏️', t: 'Bed, Wardrobe & Bedroom' }, { icon: '🍽️', t: 'Dining Set' }, { icon: '🪑', t: 'Office Furniture' }, { icon: '🔨', t: 'Custom / Modular Order' }, { icon: '🚚', t: 'Home Delivery & Fitting' }],
    modules: { projects: false, measurement: true, payables: true, stock: true, quotations: true, walkin: true, ai: true }
  },

  retail: {
    id: 'retail', icon: '🏪', label: 'होलसेल / रिटेल पसल',
    hint: 'Grocery, Electronics, Clothing, Stationery, General Store',
    aiDescription: 'a wholesale and retail shop in Nepal',
    services: function () { return [
      { name: 'Retail Sale', subs: ['Counter Sale', 'Home Delivery', 'Phone Order'] },
      { name: 'Wholesale', subs: ['Bulk Order', 'Dealer Supply', 'Credit Sale'] },
      { name: 'After Sale', subs: ['Return / Exchange', 'Warranty', 'Repair'] }
    ]; },
    rates: function () { return {
      'Retail Items': [{ name: 'Item A', rate: 100, unit: 'piece' }, { name: 'Item B', rate: 250, unit: 'kg' }],
      'Wholesale Items': [{ name: 'Carton / Box', rate: 2400, unit: 'carton' }]
    }; },
    templates: function () { return _tpl([
      { name: '🛒 Order Ready', size: 'short', text: 'नमस्कार {name} जी 🙏\nतपाईंको अर्डर तयार छ। पसलबाट लैजान वा delivery का लागि सम्पर्क गर्नुहोस्।\n📞 {phone1}\n— {company}' },
      { name: '🆕 New Arrival', size: 'short', text: 'नमस्कार {name} जी 🙏\n{company} मा नयाँ सामान आएको छ। आज नै हेर्न आउनुहोला।\n📍 {company_address}\n📞 {phone1}' }
    ]); },
    intro: [{ icon: '🛒', t: 'Retail Sale' }, { icon: '📦', t: 'Wholesale Supply' }, { icon: '🚚', t: 'Home Delivery' }, { icon: '💳', t: 'eSewa / Fonepay / Bank Payment' }],
    modules: { projects: false, measurement: false, payables: true, stock: true, quotations: false, walkin: true, ai: true }
  },

  service: {
    id: 'service', icon: '🛠️', label: 'सेवा व्यवसाय (Service Business)',
    hint: 'Repair, Cleaning, Consulting, Salon, Travel, Education',
    aiDescription: 'a service business in Nepal',
    services: function () { return [
      { name: 'Main Service', subs: ['Consultation', 'Standard Service', 'Premium Service'] },
      { name: 'Repair / Maintenance', subs: ['On-site Visit', 'Repair', 'Annual Maintenance (AMC)'] },
      { name: 'Package', subs: ['Monthly Package', 'Yearly Package'] }
    ]; },
    rates: function () { return {
      'Services': [{ name: 'Consultation', rate: 1000, unit: 'visit' }, { name: 'Standard Service', rate: 2500, unit: 'job' }, { name: 'Premium Service', rate: 5000, unit: 'job' }],
      'Packages': [{ name: 'Monthly Package', rate: 8000, unit: 'month' }, { name: 'Annual Maintenance (AMC)', rate: 25000, unit: 'year' }]
    }; },
    templates: function () { return _tpl([
      { name: '📅 Appointment Confirmed', size: 'short', text: 'नमस्कार {name} जी 🙏\nतपाईंको {service} को appointment पक्का भएको छ। समय परिवर्तन गर्नुपरे सम्पर्क गर्नुहोस्।\n📞 {phone1}\n— {company}' },
      { name: '🔔 Service Due', size: 'short', text: 'नमस्कार {name} जी 🙏\nतपाईंको अर्को {service} को समय नजिकिएको छ। मिति मिलाउन सम्पर्क गर्नुहोला।\n📞 {phone1}\n— {company}' }
    ]); },
    intro: [{ icon: '🛠️', t: 'Professional Service' }, { icon: '📅', t: 'Appointment / Site Visit' }, { icon: '🔧', t: 'Repair & Maintenance' }, { icon: '📦', t: 'Monthly / Yearly Package' }],
    modules: { projects: true, measurement: false, payables: true, stock: false, quotations: true, walkin: true, ai: true }
  }
};

var BusinessProfiles = {
  ORDER: ['construction', 'hardware', 'furniture', 'retail', 'service'],
  list: function () { return this.ORDER.map(function (k) { return BUSINESS_PROFILES[k]; }); },
  /** Profile for a type id; unknown/empty → construction (the original v6.9 behaviour). */
  get: function (id) { return BUSINESS_PROFILES[id] || BUSINESS_PROFILES.construction; },
  current: function () { var t = ''; try { t = Company.businessType(); } catch (e) {} return this.get(t); },
  _copy: function (x) { return JSON.parse(JSON.stringify(x)); },
  services: function (id) { return this._copy(this.get(id).services()); },
  rates: function (id) { return this._copy(this.get(id).rates()); },
  templates: function (id) { return this._copy(this.get(id).templates()); },
  intro: function (id) { return this._copy(this.get(id).intro); },
  modules: function (id) { return this._copy(this.get(id).modules); }
};

// Legacy global used across modules: always the templates of the current business type.
try {
  Object.defineProperty(window, 'DEFAULT_TEMPLATES', { configurable: true, get: function () { return BusinessProfiles.templates(Company.businessType()); } });
} catch (e) {}
