// ═══════════════ HOSTING ADDRESS (v7.3.1) — deployment setting, not business data ═══════════════
// App एउटा web ठेगाना (origin) बाट अर्कोमा सर्दा (जस्तै GitHub Pages → Cloudflare Pages)
// browser को डाटा आफैं सर्दैन, किनकि localStorage ठेगाना अनुसार छुट्टै हुन्छ।
// यहाँ नयाँ ठेगाना राखेपछि पुरानो ठेगानामा "📦 डाटा नयाँ ठेगानामा सार्नुहोस्" ब्यानर देखिन्छ
// (js/modules/move-origin.js)। पुरानो ठेगानाको डाटा कहिल्यै मेटिँदैन।
var SWAGATIK_DEPLOY = {
  // नयाँ मुख्य ठेगाना (Cloudflare Pages). खाली = ब्यानर बन्द
  primaryOrigin: 'https://accountkeeper.pages.dev',
  // नयाँ ठेगानाले डाटा स्वीकार गर्ने पुराना ठेगानाहरू मात्र (अरू कुनै site बाट आएको डाटा लिइँदैन)
  legacyOrigins: ['https://asrayacreate.github.io']
};
