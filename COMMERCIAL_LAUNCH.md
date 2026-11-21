# Swagatik v7 — Commercial Launch गाइड

यो गाइडले Swagatik लाई नेपालका जुनसुकै व्यवसायलाई बेच्न मिल्ने गरी **Private Repo + Cloudflare Pages +
Custom Domain + Supabase License** मा सार्ने चरणहरू बताउँछ। App मा अझै कुनै build step छैन —
फाइलहरू जस्ताको तस्तै host हुन्छन्।

> ⚠️ **क्रम महत्त्वपूर्ण छ (v7.3.1 देखि):** app एक मिनेट पनि बन्द नहोस् र कुनै device को data नहराओस् भनेर:
> **(A)** Cloudflare Pages मा चलाउने (GitHub Pages चलिरहन्छ) → **(B)** हरेक device को data नयाँ ठेगानामा
> सार्ने → **(C)** repo Private (free plan मा यसले GitHub Pages बन्द गर्छ) → **(D)** नयाँ Master Key + Super Admin password।
> पुराना secret हरू public git history मा छन्, त्यसैले private भएपछि बदल्नैपर्छ।

### Data सार्ने (पुरानो ठेगाना → नयाँ ठेगाना)

1. Cloudflare को ठेगाना `js/core/deploy.js` को `primaryOrigin` मा राखेर `npm run release` → merge।
2. हरेक device मा पुरानो (github.io) app खोल्नुहोस् → Dashboard मा **📦 डाटा नयाँ ठेगानामा सार्नुहोस्** →
   नयाँ tab मा Restore को OK → नयाँ ठेगानामा License Key + login। पुरानो ठेगानाको data मेटिँदैन।
3. License, login session, Dropbox / Google Drive token र AI key सर्दैनन् — नयाँ ठेगानामा फेरि जोड्नुहोस्
   (Google Drive को OAuth मा नयाँ ठेगाना पनि थप्नुहोस्)।
4. नयाँ ठेगानाले `legacyOrigins` मा लेखिएका ठेगानाबाट मात्र data लिन्छ।
5. सुरक्षा जाल: पुरानो hosting बन्द भएपछि पनि (404) पहिल्यै खोलिएको app service worker cache बाट खुल्छ,
   त्यसैले छुटेको device बाट पछि पनि सार्न सकिन्छ (internet चाहिन्छ)।

---

## 0. v7 मा के बदलियो (छोटकरीमा)

| कुरा | कहाँ |
|---|---|
| App code टुक्रिएर सफा फाइलमा | `index.html` (HTML मात्र), `css/`, `js/core/`, `js/modules/`, `js/ui/`, `js/vendor/` |
| कम्पनीको विवरण (नाम, फोन, ठेगाना…) | Settings → Company Information → `Company` (`js/core/company.js`) |
| Software vendor (License renew/support फोन) | `SWAGATIK_VENDOR` (`js/core/company.js`) — **बेच्नुअघि आफ्नो support नम्बर राख्नुहोस्** |
| व्यवसायको प्रकार + सुरुवाती Rate/Template | `js/core/business-profiles.js`, Setup Wizard (`js/ui/setup-wizard.js`) |
| Modules On/Off | `js/core/modules.js`, Settings → 🎛️ Modules |
| पुराना (v6.9) device को data migration | `js/core/migrations.js` (एक पटक, केही मेटिँदैन) |
| Cloud sync adapter | `js/core/sync.js` (Dropbox, Google Drive, Swagatik Cloud) |
| License server hook | `js/core/license-cloud.js` + `supabase/license_schema.sql` |

---

## 1. Repo लाई Private बनाउने

1. GitHub → `asrayacreate/Accountkeeper` → **Settings → General → Danger Zone → Change visibility → Private**।
2. Free GitHub plan मा private repo बाट GitHub Pages चल्दैन — त्यसैले hosting Cloudflare Pages मा सार्नुहोस् (चरण ३)।
3. Repo private भएपछि मात्र अर्को चरण (नयाँ secret) गर्नुहोस्।

## 2. नयाँ Master Key र Super Admin password

```bash
npm install
npm run hash-secret -- master   "NEW-LONG-MASTER-KEY-2083"     # १२+ अक्षर
npm run hash-secret -- password "NewStrongPassword!"
```

- master hash → `js/core/license.js` को `MASTER_HASH`
- password hash → `js/core/security.js` को `_RAW_USERS` मा `punya` को line
- `npm test` चलाउनुहोस् (test ले आफ्नै test-secret प्रयोग गर्छ — असली secret repo मा कहिल्यै नराख्नुहोस्)।
- पहिल्यै activate भएका आफ्ना device हरूमा नयाँ key एक पटक हाल्नुपर्छ।

## 3. Cloudflare Pages + Custom Domain

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git** → GitHub account जोडेर `Accountkeeper` repo छान्नुहोस्।
2. Build settings:
   - Framework preset: **None**
   - Build command: **`node scripts/build-pages.mjs`** (app का फाइल मात्र `dist/` मा — docs, tests, SQL website मा जाँदैनन्)
   - Build output directory: **`dist`**
   - Production branch: `main`
3. **Save and Deploy**। `https://<project>.pages.dev` मा app खुल्छ।
4. Custom domain: Pages project → **Custom domains → Set up a domain** → जस्तै `app.swagatik.com.np`।
   Domain Cloudflare मै भए DNS आफैं बन्छ; बाहिर भए दिइएको `CNAME` record domain provider मा राख्नुहोस्।
5. `_headers` (cache नियम) र `_redirects` फाइल Cloudflare ले आफैं पढ्छ।
6. सबै device सरेपछि मात्र पुरानो GitHub Pages बन्द गर्नुहोस् (repo Private गर्दा आफैं बन्द हुन्छ)। (`CNAME` फाइल GitHub Pages को लागि मात्र हो — Cloudflare मा चाहिँदैन।)
7. पुराना प्रयोगकर्ताको data browser मा **domain अनुसार** बस्छ। नयाँ domain मा सार्दा: पुरानो URL मा
   Settings → Backup → **Download Backup (.json)** → नयाँ URL मा **Restore from File** (वा Dropbox / Google Drive बाट Restore)।

### नयाँ version release

```bash
npm test                     # सबै pass हुनुपर्छ
npm run release              # 7.0.0 → 7.0.1 (index.html ?v=, sw.js cache + file list, package.json)
git commit -am "Release v7.0.1" && git push   # Cloudflare ले आफैं deploy गर्छ
```

नयाँ `js/` वा `css/` फाइल थपे: `index.html` मा `<script src="js/…?v=7.0.0">` थप्नुहोस्, त्यसपछि
`npm run release -- --assets` (sw.js को offline file list मिलाउँछ)। `npm test` ले नमिलेमा समात्छ।

---

## 4. Supabase License API (वार्षिक / आजीवन key, म्याद, device limit)

1. <https://supabase.com> → New project (Region: Singapore/Mumbai — नेपालबाट नजिक)।
2. **SQL Editor** → `supabase/license_schema.sql` पूरै paste → **Run**।
3. **Project Settings → API** बाट `Project URL` र `anon public` key लिनुहोस्।
4. `js/core/license-cloud.js` मा:
   ```js
   var LICENSE_CLOUD = { enabled: true, url: 'https://xxxx.supabase.co', anonKey: 'eyJ…', GRACE_DAYS: 15, CHECK_EVERY_H: 24 };
   ```
   (anon key public हो — table हरू RLS ले बन्द छन्; app ले दुई RPC function मात्र बोलाउन सक्छ।)
5. `npm run release` → push।

### Key बेच्ने (seller)

Supabase SQL Editor मा:

```sql
select public.new_license('Ram Traders', 'PRO', interval '1 year', 2);    -- 1 वर्ष, 2 device
select public.new_license('Sita Furniture', 'LIFETIME', null, 3);         -- आजीवन, 3 device
```

फर्किएको `SWG-XXXX-XXXX-XXXX` key ग्राहकलाई दिनुहोस्। ग्राहकले app खोल्दा Company Name + Key हाल्छ:

- Offline Master Key (तपाईंको आफ्नै) — पहिलेजस्तै server बिना चल्छ।
- अरू key → server को `activate_license` ले जाँच्छ (म्याद, revoke, device limit)।
- हरेक २४ घण्टामा `check_license` ले renew/revoke मिलाउँछ; internet नभए 15 दिनसम्म चल्छ।

| काम | SQL |
|---|---|
| Renew (१ वर्ष थप) | `update licenses set expires_at = greatest(coalesce(expires_at, now()), now()) + interval '1 year' where license_key = 'SWG-…';` |
| Device हटाउने (seat खाली) | `update license_devices set active = false where device_id = 'dev_…';` |
| रद्द गर्ने | `update licenses set status = 'revoked' where license_key = 'SWG-…';` |
| Company नाम मिलाउनैपर्ने | `update licenses set company_match = true where license_key = 'SWG-…';` |
| को-को ले activate गरे | `select * from license_events order by at desc limit 50;` |

---

## 5. Google Drive Sync (हरेक ग्राहकको आफ्नै Google account)

App ले data Google Drive को लुकेको **appDataFolder** मा मात्र राख्छ (scope `drive.appdata`)।
एक पटक तपाईं (vendor) ले वा ग्राहक आफैंले Client ID बनाउनुपर्छ:

1. <https://console.cloud.google.com> → New project → **APIs & Services → Library → Google Drive API → Enable**।
2. **OAuth consent screen** → External → App name "Swagatik", support email → Scope: `.../auth/drive.appdata` → Publish।
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://app.swagatik.com.np`
   - Authorized redirect URIs: `https://app.swagatik.com.np/` (Settings को Google Drive card मा देखिएको ठ्याक्कै URL)
4. Client ID (र Web client भएकाले Client Secret) app को **Settings → 🟢 Google Drive Sync** मा राखेर **Connect**।
   Client Secret त्यो device मा मात्र बस्छ, sync/backup मा जाँदैन।

Dropbox Sync पहिलेजस्तै चल्छ। दुवै एकैचोटि चलाउन मिल्छ।

## 6. Swagatik Cloud (Supabase sync) — पछि

`js/modules/sync-supabase.js` मा adapter तयार छ (`SUPABASE_CLOUD.enabled = false`)। चालु गर्न:
`sync_snapshots` table (license_schema.sql मै छ) → Supabase Auth (magic link) login UI थप्ने →
`enabled: true`। Row Level Security ले हरेक व्यवसायले आफ्नो data मात्र देख्छ।

---

## 7. बेच्नुअघि checklist

- [ ] Repo private, नयाँ Master Key + Super Admin password
- [ ] `SWAGATIK_VENDOR.supportPhone` मा आफ्नो support नम्बर
- [ ] Cloudflare Pages + custom domain + HTTPS
- [ ] Supabase license (`enabled: true`) र एउटा test key बाट activate जाँच
- [ ] नयाँ browser मा: License → Setup Wizard → व्यवसाय छान्ने → Quotation/Invoice print मा आफ्नै कम्पनी देखिन्छ
- [ ] `npm test` सबै pass
