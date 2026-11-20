# Swagatik — Development / Release गाइड

v7 देखि app सफा फाइलहरूमा छ — तर अझै **build चाहिँदैन** (साधारण `<script src>`, file:// मा पनि चल्छ):

```
index.html          HTML मात्र + script/style tag (क्रम महत्त्वपूर्ण)
css/                app.css, extra.css, v7.css
js/core/            STORE, BS पात्रो, License, Auth, Company, Modules, Migrations, Sync engine, init
js/modules/         Customers, Quotations, Invoices, Payables, CA Export, Projects, Dropbox/Drive sync …
js/ui/              Dashboard, Brand, Setup Wizard, Admin dashboard …
js/vendor/          qrcode.min.js
```

`package.json`, `tests/` र `scripts/` development का लागि मात्र हुन्। Commercial launch (Private repo,
Cloudflare Pages, Supabase license, Google Drive) : `COMMERCIAL_LAUNCH.md`।

**नियम:** कुनै कम्पनीको नाम/फोन/ठेगाना code मा नलेख्ने — `Company.get()` / `Company.name()` /
template मा `{company}` `{phone1}` `{company_address}` प्रयोग गर्ने। (test `09-v7-foundation` ले समात्छ)

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

यसले `index.html` को `APP_VERSION`, देखिने version label र हरेक `?v=`, `sw.js` को version,
cache नाम (`swagatik-cache-vN`) र offline file list, र `package.json` — सबै एकैचोटि बदल्छ।
त्यसपछि `index.html`, `sw.js`, `js/`, `css/` सबै commit गर्नुहोस्।

नयाँ js/css फाइल थपेपछि (version नबदली) : `npm run release -- --assets`

Service worker ले app page लाई **network-first** ल्याउँछ, त्यसैले internet भएको
मोबाइल/ट्याब्लेटले सधैं नयाँ version पाउँछ; internet नभए cache को copy खुल्छ।

## Master key वा Super Admin password बदल्ने

Source मा अब असली key/password लेखिँदैन — hash मात्र।

```bash
npm run hash-secret -- master   "NEW-LONG-MASTER-KEY"
npm run hash-secret -- password "NewStrongPassword"
```

आएको hash `index.html` मा राख्नुहोस्:
- master → `js/core/license.js` को `License.MASTER_HASH`
- password → `js/core/security.js` को `_RAW_USERS` मा `punya` line

⚠️ छोटो key/password (जस्तै ४ अंक) hash बाट पनि केही सेकेन्डमै अनुमान गर्न सकिन्छ।
कम्तिमा १२+ अक्षरको प्रयोग गर्नुहोस्। पुराना devices मा पहिल्यै activate भएको license
key बदलेपछि फेरि key माग्छ — त्यसैले key बदल्दा ती devices मा नयाँ key हाल्नुपर्छ।

Test ले असली secrets प्रयोग गर्दैन; चाहे भने आफ्नो computer मा मात्र:
`SWG_REAL_MASTER=... SWG_REAL_PASS=... npm test`
