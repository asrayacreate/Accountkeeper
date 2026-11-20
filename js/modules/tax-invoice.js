// ═══════════════ 🧾 NEPALI TAX INVOICE + AMOUNT IN WORDS (v7.2.0) ═══════════════
// • बिक्री बिलको प्रकार: "tax" = Tax Invoice (कर बिजक) | "abbr" = Abbreviated Tax Invoice (संक्षिप्त कर बिजक)
//   पुराना बिल (billType नभएका) जस्ताको तस्तै देखिन्छन् — VAT भए TAX INVOICE, नभए INVOICE।
// • १३% VAT को स्पष्ट हिसाब: Taxable Amount (करयोग्य रकम) + VAT = जम्मा।
// • जम्मा रकम अंग्रेजी र नेपाली शब्दमा (पैसा सहित)।
// कम्पनीको नाम/PAN सधैं Company Settings बाट मात्र आउँछ — यहाँ कुनै कम्पनीको विवरण छैन।

/** Nepali (Devanagari) amount in words: 123456.5 → "एक लाख तेइस हजार चार सय छपन्न रुपैयाँ पचास पैसा मात्र" */
function numToWordsNe(num) {
  var W = ['', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ', 'दश',
    'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस', 'बीस',
    'एक्काइस', 'बाइस', 'तेइस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताइस', 'अठ्ठाइस', 'उनन्तीस', 'तीस',
    'एकतीस', 'बत्तीस', 'तेत्तीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अठतीस', 'उनन्चालीस', 'चालीस',
    'एकचालीस', 'बयालीस', 'त्रिचालीस', 'चवालीस', 'पैंतालीस', 'छयालीस', 'सतचालीस', 'अठचालीस', 'उनन्चास', 'पचास',
    'एकाउन्न', 'बाउन्न', 'त्रिपन्न', 'चउन्न', 'पचपन्न', 'छपन्न', 'सन्ताउन्न', 'अन्ठाउन्न', 'उनन्साठी', 'साठी',
    'एकसट्ठी', 'बयसट्ठी', 'त्रिसट्ठी', 'चौंसट्ठी', 'पैंसट्ठी', 'छयसट्ठी', 'सतसट्ठी', 'अठसट्ठी', 'उनन्सत्तरी', 'सत्तरी',
    'एकहत्तर', 'बहत्तर', 'त्रिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छयहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी', 'असी',
    'एकासी', 'बयासी', 'त्रियासी', 'चौरासी', 'पचासी', 'छयासी', 'सतासी', 'अठासी', 'उनान्नब्बे', 'नब्बे',
    'एकानब्बे', 'बयानब्बे', 'त्रियानब्बे', 'चौरानब्बे', 'पन्चानब्बे', 'छयानब्बे', 'सन्तानब्बे', 'अन्ठानब्बे', 'उनान्सय'];
  var n = Math.round((parseFloat(num) || 0) * 100);
  if (n < 0) return 'ऋण ' + numToWordsNe(-n / 100);
  var rs = Math.floor(n / 100), ps = n % 100;
  function part(x) {   // 0 … 99,99,99,99,999 (Nepali grouping: सय, हजार, लाख, करोड, अर्ब, खर्ब)
    var out = [], units = [[1e11, 'खर्ब'], [1e9, 'अर्ब'], [1e7, 'करोड'], [1e5, 'लाख'], [1e3, 'हजार'], [100, 'सय']];
    units.forEach(function (u) {
      var q = Math.floor(x / u[0]);
      if (q) { out.push((q > 99 ? part(q) : W[q]) + ' ' + u[1]); x = x % u[0]; }
    });
    if (x) out.push(W[x]);
    return out.join(' ');
  }
  var s = rs ? part(rs) + ' रुपैयाँ' : '';
  if (ps) s += (s ? ' ' : '') + W[ps] + ' पैसा';
  return (s || 'शून्य रुपैयाँ') + ' मात्र';
}

/** English amount in words with paisa: 1130.5 → "One Thousand One Hundred Thirty Rupees and Fifty Paisa Only" */
function numToWordsEn(num) {
  var n = Math.round((parseFloat(num) || 0) * 100), neg = n < 0; if (neg) n = -n;
  var rs = Math.floor(n / 100), ps = n % 100;
  var w = numToWords(rs);                       // "… Rupees Only" (existing helper, untouched)
  if (ps) w = w.replace(/ Only$/, '') + ' and ' + numToWords(ps).replace(/ Rupees Only$/, '') + ' Paisa Only';
  return (neg ? 'Minus ' : '') + w;
}

var TaxInvoice = {
  TYPES: {
    tax:  { en: 'TAX INVOICE', ne: 'कर बिजक', label: '🧾 Tax Invoice (कर बिजक)' },
    abbr: { en: 'ABBREVIATED TAX INVOICE', ne: 'संक्षिप्त कर बिजक', label: '🧾 Abbreviated Tax Invoice (संक्षिप्त)' }
  },
  ABBR_HINT_LIMIT: 10000,     // soft hint only — abbreviated invoices are normally used for small retail sales
  r2: function (v) { return Math.round((parseFloat(v) || 0) * 100) / 100; },

  /** Default bill type for a new invoice: last type the user picked on this device (synced setting), else Tax Invoice */
  defaultType: function () {
    var s = STORE.get('pk3_settings', {}) || {};
    return this.TYPES[s.invBillType] ? s.invBillType : 'tax';
  },
  rememberType: function (t) {
    if (!this.TYPES[t]) return;
    var s = STORE.get('pk3_settings', {}) || {};
    if (s.invBillType !== t) { s.invBillType = t; STORE.set('pk3_settings', s); }
  },

  /** Heading for a stored invoice. Legacy (no billType) keeps the v7.1 behaviour. */
  kindOf: function (inv) {
    var t = this.TYPES[inv && inv.billType];
    if (t) return { en: t.en, ne: t.ne, type: inv.billType };
    return (parseFloat(inv && inv.taxP) || 0) > 0 ? { en: 'TAX INVOICE', ne: 'बिल', type: '' } : { en: 'INVOICE', ne: 'बिल', type: '' };
  },

  /** VAT breakdown of an invoice: {total, nonTaxable, taxable, vat, rate} — cancelled → zeros */
  breakdown: function (inv) {
    var r2 = this.r2;
    if (!inv || inv.status === 'Cancelled' || inv.cancelled) return { total: 0, nonTaxable: 0, taxable: 0, vat: 0, rate: r2(inv && inv.taxP) };
    var sub = parseFloat(inv.subtotal != null ? inv.subtotal : inv.amount) || 0, disc = parseFloat(inv.discAmt) || 0;
    var vat = parseFloat(inv.taxAmt) || 0, rate = parseFloat(inv.taxP) || 0;
    var net = r2(sub - disc), total = r2(parseFloat(inv.amount) || 0);
    return vat > 0 ? { total: total, nonTaxable: 0, taxable: net, vat: r2(vat), rate: rate } : { total: total, nonTaxable: net, taxable: 0, vat: 0, rate: rate };
  },

  // ── invoice form helpers (used by Invoices._openForm / calc / saveNew) ──
  formHtml: function (inv) {
    var t = inv ? (inv.billType || ((parseFloat(inv.taxP) || 0) > 0 ? 'tax' : 'abbr')) : this.defaultType(), self = this;
    var pan = inv ? (inv.custPan || '') : '';
    return '<div class="inv-fld-group"><label class="inv-mlbl">Bill Type / बिलको प्रकार</label><select id="inv-billtype" class="inv-fld" onchange="Invoices.calc()">'
      + Object.keys(this.TYPES).map(function (k) { return '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + self.TYPES[k].label + '</option>'; }).join('')
      + '</select><span id="inv-abbr-hint" style="display:none;font-size:0.64rem;color:#b45309;margin-top:2px;"></span></div>'
      + '<div class="inv-fld-group"><label class="inv-mlbl">ग्राहकको PAN / VAT No.</label><input type="text" id="inv-cust-pan" class="inv-fld" inputmode="numeric" maxlength="15" value="' + esc(pan) + '" placeholder="Tax Invoice मा देखिन्छ"></div>';
  },
  /** When a customer is picked, fill the buyer PAN from the customer record (if blank) */
  onCustomer: function () {
    var id = getVal('inv-cust-sel'), el = document.getElementById('inv-cust-pan');
    if (!el || el.value) return;
    try { var c = Customers.getData().find(function (x) { return x.id === id; }); if (c && (c.pan || c.vat)) el.value = c.pan || c.vat; } catch (e) {}
  },
  /** Called from Invoices.calc(): shows Taxable amount, Nepali words and the abbreviated-invoice hint */
  onCalc: function (t) {
    var taxable = t.sub - t.discAmt;
    setText('inv-sum-taxable', fmtRs(taxable));
    var tr = document.getElementById('inv-sum-taxable-row'); if (tr) tr.style.display = t.taxAmt > 0 ? 'flex' : 'none';
    var we = document.getElementById('inv-sum-words'); if (we) we.textContent = numToWordsEn(t.grand);
    var wn = document.getElementById('inv-sum-words-ne'); if (wn) wn.textContent = numToWordsNe(t.grand);
    var h = document.getElementById('inv-abbr-hint'), type = getVal('inv-billtype');
    if (h) {
      var big = type === 'abbr' && t.grand > this.ABBR_HINT_LIMIT;
      h.style.display = big ? '' : 'none';
      h.textContent = big ? '⚠️ Rs. ' + this.ABBR_HINT_LIMIT.toLocaleString('en-IN') + ' भन्दा बढीको बिक्रीमा सामान्यतया पूरा Tax Invoice दिइन्छ' : '';
    }
  },
  /** Fields saved on the invoice record */
  formValues: function (custId) {
    var type = getVal('inv-billtype'), pan = getVal('inv-cust-pan').replace(/\s+/g, '');
    if (!this.TYPES[type]) return {};
    this.rememberType(type);
    // remember the PAN on the customer for next time (never overwrite one that exists)
    if (pan && custId) {
      try {
        var list = Customers.getData(), c = list.find(function (x) { return x.id === custId; });
        if (c && !c.pan) { c.pan = pan; STORE.set('pk3_customers', list); }
      } catch (e) {}
    }
    return { billType: type, custPan: pan };
  }
};
