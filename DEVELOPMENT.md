# Swagatik — Development / Release गाइड

App आफैं अझै एउटै `index.html` हो (build चाहिँदैन)। `package.json`, `tests/` र `scripts/`
development का लागि मात्र हुन् — GitHub Pages मा भएपनि app लाई केही असर गर्दैनन्।

## पहिलो पटक (एक पटक मात्र)

```bash
npm install
npx playwright install chromium
```

## Test चलाउने

```bash
npm test
```

सबै feature (License/Login, BS पात्रो, Smart Reminders, AI WhatsApp, Dropbox Sync,
Walk-in, Rate List, Ledger, Quotation→Invoice, Print/QR, Projects, Backup Gemini key,
मोबाइल layout) वास्तविक Chromium browser मा जाँचिन्छ। सबै pass भएपछि मात्र upload गर्नुहोस्।

## नयाँ Version release गर्ने

```bash
npm run release            # 6.9.0 → 6.9.1
npm run release -- minor   # 6.9.0 → 6.10.0
npm run release -- 7.0.0   # ठ्याक्कै यो version
```

यसले `index.html` को `APP_VERSION` र देखिने version label, `sw.js` को version र
cache नाम (`swagatik-cache-vN`), र `package.json` — सबै एकैचोटि बदल्छ।
त्यसपछि `index.html` र `sw.js` दुवै GitHub मा upload/commit गर्नुहोस्।

Service worker ले app page लाई **network-first** ल्याउँछ, त्यसैले internet भएको
मोबाइल/ट्याब्लेटले सधैं नयाँ version पाउँछ; internet नभए cache को copy खुल्छ।

## Master key वा Super Admin password बदल्ने

Source मा अब असली key/password लेखिँदैन — hash मात्र।

```bash
npm run hash-secret -- master   "NEW-LONG-MASTER-KEY"
npm run hash-secret -- password "NewStrongPassword"
```

आएको hash `index.html` मा राख्नुहोस्:
- master → `License.MASTER_HASH`
- password → `_RAW_USERS` को `punya` line

⚠️ छोटो key/password (जस्तै ४ अंक) hash बाट पनि केही सेकेन्डमै अनुमान गर्न सकिन्छ।
कम्तिमा १२+ अक्षरको प्रयोग गर्नुहोस्। पुराना devices मा पहिल्यै activate भएको license
key बदलेपछि फेरि key माग्छ — त्यसैले key बदल्दा ती devices मा नयाँ key हाल्नुपर्छ।

Test ले असली secrets प्रयोग गर्दैन; चाहे भने आफ्नो computer मा मात्र:
`SWG_REAL_MASTER=... SWG_REAL_PASS=... npm test`
