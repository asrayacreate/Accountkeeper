// ─── PROFESSIONAL PRINT / PDF ────────────────────────────────────────
var DocPrint = {
  _co: function(){
    var co = STORE.get('pk3_settings',{}) || {};
    return {
      name: Company.name(''), tagline: co.tagline || '',
      address: co.address || '', phone: [co.phone1, co.phone2].filter(Boolean).join(', '),
      email: co.email || '', pan: co.pan || co.vat || '', logo: co.logo || '',
      bank: co.bankName || '', acc: co.bankAcc || '', esewa: co.esewa || '', khalti: co.khalti || ''
    };
  },
  // Normalise a quotation / invoice / estimate into one document shape
  fromQuotation: function(q){
    var items = (q.items||[]).map(function(r){ return { name:r.name||'', qty:parseFloat(r.qty)||0, unit:r.unit||'', rate:parseFloat(r.rate)||0 }; });
    var sub = items.reduce(function(s,r){ return s + r.qty*r.rate; }, 0);
    var disc = parseFloat(q.discount)||0, taxP = parseFloat(q.tax)||0, taxAmt = (sub-disc)*taxP/100;
    var total = q.amount!=null ? parseFloat(q.amount)||0 : sub-disc+taxAmt;
    var adv = parseFloat(q.advance)||0;
    return { kind:'QUOTATION', kindNe:'कोटेसन', no: q.quoteNo || ('QT-'+String(q.id||'').slice(-6).toUpperCase()), dateAd: q.date || todayISO(), dateBs: q.dateBs || _bsFromAd(q.date),
      cust:{ name:q.custName||'', phone:q.custPhone||'', address:(Customers.getData().find(function(c){ return c.id===q.custId; })||{}).address||'' },
      subject: [q.work, q.subwork].filter(Boolean).join(' — '), items: items, sub: sub, disc: disc, taxP: taxP, taxAmt: taxAmt, total: total,
      paidLabel:'Advance / अग्रिम', paid: adv, balance: total-adv, notes: q.details||'', terms: '', status: q.status||'Pending' };
  },
  fromInvoice: function(inv){
    var items = Array.isArray(inv.items) && inv.items.length ? inv.items : [{ name:inv.desc||'Amount', qty:1, unit:'', rate:parseFloat(inv.amount)||0 }];
    items = items.map(function(r){ return { name:r.name||'', qty:parseFloat(r.qty)||0, unit:r.unit||'', rate:parseFloat(r.rate)||0 }; });
    var sub = inv.subtotal!=null ? parseFloat(inv.subtotal)||0 : items.reduce(function(s,r){ return s + r.qty*r.rate; }, 0);
    var total = parseFloat(inv.amount)||sub, paid = parseFloat(inv.paid)||0;
    var bal = inv.balance!=null ? parseFloat(inv.balance)||0 : total-paid;
    var cust = Customers.getData().find(function(c){ return c.id===inv.custId; }) || {};
    return { kind: (parseFloat(inv.taxP)||0) > 0 ? 'TAX INVOICE' : 'INVOICE', kindNe:'बिल', no: inv.invNum||'', dateAd: inv.date || todayISO(), dateBs: inv.dateBs || _bsFromAd(inv.date),
      dueDate: inv.dueDate || '', cust:{ name:inv.custName||'', phone:inv.custPhone||'', address:cust.address||'' },
      items: items, sub: sub, disc: parseFloat(inv.discAmt)||0, discP: parseFloat(inv.discP)||0, taxP: parseFloat(inv.taxP)||0, taxAmt: parseFloat(inv.taxAmt)||0,
      total: total, paidLabel:'Paid / भुक्तानी', paid: paid, balance: bal, terms: inv.terms||'', status: inv.status||'Pending',
      ref: inv.fromQuote ? (inv.fromQuote.type==='estimate' ? 'Estimate ' : 'Quotation ') + (inv.fromQuote.no||'') : '' };
  },
  fromEstimate: function(e){
    var items = (e.items||[]).map(function(r){ return { name:r.name||'', qty:parseFloat(r.qty)||0, unit:r.unit||'', rate:parseFloat(r.rate)||0 }; });
    var sub = items.reduce(function(s,r){ return s + r.qty*r.rate; }, 0);
    var disc = parseFloat(e.disc)||0, taxP = parseFloat(e.tax)||0;
    var taxAmt = e.taxAmt!=null ? parseFloat(e.taxAmt)||0 : (sub-disc)*taxP/100;
    var total = e.total!=null ? parseFloat(e.total)||0 : sub-disc+taxAmt, adv = parseFloat(e.advance)||0;
    return { kind:'ESTIMATE', kindNe:'लागत अनुमान', no: e.estNo||'', dateAd: e.date || todayISO(), dateBs: e.dateBs || _bsFromAd(e.date),
      cust:{ name:e.custName||'', phone:e.phone||'', address:e.addr||'' }, subject: e.title||'', validity: e.validity||'',
      items: items, sub: sub, disc: disc, taxP: taxP, taxAmt: taxAmt, total: total, paidLabel:'Advance / अग्रिम', paid: adv, balance: total-adv,
      notes: e.remarks || '', terms: e.terms || '', status: e.status||'Draft' };
  },

  build: function(d){
    var co = this._co(), qr = PayQR.get();
    var terms = (d.terms && String(d.terms).trim()) ? d.terms : PayQR.terms();
    var adStr = d.dateAd ? String(d.dateAd).slice(0,10) : '';
    var bsStr = d.dateBs ? bsStringToDisplay(d.dateBs) + ' (' + d.dateBs + ')' : '';
    var rows = d.items.map(function(r, i){
      return '<tr><td class="c">'+(i+1)+'</td><td>'+esc(r.name)+'</td><td class="c">'+(r.qty||0)+'</td><td class="c">'+esc(r.unit||'')+'</td>'
        +'<td class="r">'+fmtRs(r.rate)+'</td><td class="r b">'+fmtRs((r.qty||0)*(r.rate||0))+'</td></tr>';
    }).join('');
    var pay = [];
    if(co.bank) pay.push('🏦 '+esc(co.bank)+(co.acc?' — A/C '+esc(co.acc):''));
    if(co.esewa) pay.push('📱 eSewa: '+esc(co.esewa));
    if(co.khalti) pay.push('💜 Khalti: '+esc(co.khalti));
    var css = '.swg-doc{font-family:"Segoe UI","Noto Sans Devanagari",Arial,sans-serif;color:#1f2937;background:#fff;max-width:760px;margin:0 auto;padding:22px 24px;box-sizing:border-box;font-size:13px;line-height:1.45;}'
      + '.swg-doc *{box-sizing:border-box;}'
      + '.swg-doc .hd{display:flex;gap:14px;align-items:center;border-bottom:3px solid #f97316;padding-bottom:12px;margin-bottom:14px;}'
      + '.swg-doc .hd img{width:66px;height:66px;object-fit:contain;}'
      + '.swg-doc .co{flex:1;min-width:0;}.swg-doc .co .n{font-size:20px;font-weight:900;color:#c2410c;letter-spacing:-.3px;}'
      + '.swg-doc .co .s{font-size:11.5px;color:#4b5563;}'
      + '.swg-doc .tt{text-align:right;}.swg-doc .tt .k{font-size:20px;font-weight:900;color:#111827;letter-spacing:1px;}.swg-doc .tt .kn{font-size:11px;color:#6b7280;}'
      + '.swg-doc .meta{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px;}'
      + '.swg-doc .box{border:1px solid #e5e7eb;border-radius:8px;padding:9px 11px;flex:1;min-width:220px;}'
      + '.swg-doc .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;margin-bottom:2px;}'
      + '.swg-doc table.it{width:100%;border-collapse:collapse;margin-bottom:12px;}'
      + '.swg-doc table.it th{background:#fff7ed;color:#9a3412;border-bottom:2px solid #fdba74;padding:7px 8px;font-size:11.5px;text-align:left;}'
      + '.swg-doc table.it td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;}'
      + '.swg-doc .c{text-align:center;}.swg-doc .r{text-align:right;white-space:nowrap;}.swg-doc .b{font-weight:700;}'
      + '.swg-doc .tot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;}'
      + '.swg-doc .words{flex:1;min-width:220px;font-size:11.5px;font-style:italic;color:#4b5563;padding-top:4px;}'
      + '.swg-doc table.sum{min-width:260px;border-collapse:collapse;}.swg-doc table.sum td{padding:4px 8px;}'
      + '.swg-doc table.sum tr.g td{border-top:2px solid #f97316;font-size:15px;font-weight:900;color:#c2410c;padding-top:7px;}'
      + '.swg-doc table.sum tr.bal td{background:#fef2f2;color:#b91c1c;font-weight:700;}'
      + '.swg-doc .terms{margin-top:14px;padding:10px 12px;background:#f9fafb;border-left:3px solid #f97316;border-radius:4px;font-size:11.5px;color:#374151;white-space:pre-wrap;}'
      + '.swg-doc .foot{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:16px;}'
      + '.swg-doc .pay{display:flex;gap:12px;align-items:center;border:1px dashed #fdba74;border-radius:10px;padding:10px;}'
      + '.swg-doc .pay img{width:132px;height:132px;object-fit:contain;background:#fff;}'
      + '.swg-doc .sig{min-width:170px;text-align:center;font-size:11.5px;color:#4b5563;}.swg-doc .sig .ln{border-top:1px solid #9ca3af;margin-top:46px;padding-top:4px;}'
      + '.swg-doc .thx{margin-top:16px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #eee;padding-top:8px;}'
      + '@media(max-width:560px){.swg-doc{padding:12px 10px;font-size:12px;}.swg-doc .hd{flex-wrap:wrap;}.swg-doc .tt{text-align:left;width:100%;}'
      + '.swg-doc table.it th:nth-child(4),.swg-doc table.it td:nth-child(4){display:none;}.swg-doc table.it{table-layout:auto;font-size:11px;}.swg-doc table.it th,.swg-doc table.it td{padding:6px 3px;width:auto!important;}.swg-doc table.it td:nth-child(2){word-break:break-word;}.swg-doc table.it .r{white-space:normal;}.swg-doc table.sum{min-width:0;width:100%;}.swg-doc .pay img{width:110px;height:110px;}}';
    var h = '<style>'+css+'</style><div class="swg-doc" data-doc-kind="'+esc(d.kind)+'">'
      + '<div class="hd">' + (co.logo ? '<img src="'+co.logo+'" alt="">' : '')
        + '<div class="co"><div class="n">'+esc(co.name)+'</div>'
          + (co.tagline ? '<div class="s">'+esc(co.tagline)+'</div>' : '')
          + '<div class="s">📍 '+esc(co.address)+' &nbsp;•&nbsp; 📞 '+esc(co.phone)+'</div>'
          + (co.email ? '<div class="s">✉️ '+esc(co.email)+'</div>' : '')
          + (co.pan ? '<div class="s"><b>PAN / VAT No:</b> '+esc(co.pan)+'</div>' : '')
        + '</div>'
        + '<div class="tt"><div class="k">'+esc(d.kind)+'</div><div class="kn">'+esc(d.kindNe||'')+'</div></div>'
      + '</div>'
      + '<div class="meta">'
        + '<div class="box"><div class="lbl">'+(d.kind==='QUOTATION'||d.kind==='ESTIMATE' ? 'To / ग्राहक' : 'Bill To / ग्राहक')+'</div>'
          + '<div style="font-weight:800;font-size:14px;">'+esc(d.cust.name)+'</div>'
          + (d.cust.phone ? '<div>📞 '+esc(d.cust.phone)+'</div>' : '') + (d.cust.address ? '<div>📍 '+esc(d.cust.address)+'</div>' : '')
          + (d.subject ? '<div style="margin-top:3px;"><b>Subject / काम:</b> '+esc(d.subject)+'</div>' : '')
        + '</div>'
        + '<div class="box" style="max-width:300px;"><div><span class="lbl">No.</span> <b>'+esc(d.no||'—')+'</b></div>'
          + '<div><span class="lbl">मिति (BS)</span> <b>'+esc(bsStr||'—')+'</b></div>'
          + '<div><span class="lbl">Date (AD)</span> <b>'+esc(adStr||'—')+'</b></div>'
          + (d.dueDate ? '<div><span class="lbl">Due</span> <b style="color:#b91c1c;">'+esc(d.dueDate)+'</b></div>' : '')
          + (d.validity ? '<div><span class="lbl">Valid</span> '+esc(d.validity)+'</div>' : '')
          + (d.ref ? '<div><span class="lbl">Ref</span> '+esc(d.ref)+'</div>' : '')
        + '</div>'
      + '</div>'
      + '<table class="it"><thead><tr><th class="c" style="width:34px;">#</th><th>Particulars / विवरण</th><th class="c" style="width:56px;">Qty</th><th class="c" style="width:56px;">Unit</th><th class="r" style="width:92px;">Rate</th><th class="r" style="width:108px;">Amount</th></tr></thead>'
      + '<tbody>'+(rows || '<tr><td colspan="6" class="c" style="color:#9ca3af;">—</td></tr>')+'</tbody></table>'
      + '<div class="tot"><div class="words">In words: <b>'+((typeof numToWords==='function') ? esc(numToWords(d.total)) : '')+'</b></div>'
        + '<table class="sum">'
          + '<tr><td>Subtotal</td><td class="r">'+fmtRs(d.sub)+'</td></tr>'
          + (d.disc ? '<tr><td>Discount'+(d.discP ? ' ('+(Math.round(d.discP*100)/100)+'%)' : '')+'</td><td class="r" style="color:#b91c1c;">- '+fmtRs(d.disc)+'</td></tr>' : '')
          + (d.taxAmt ? '<tr><td>VAT ('+d.taxP+'%)</td><td class="r">+ '+fmtRs(d.taxAmt)+'</td></tr>' : '')
          + '<tr class="g"><td>Grand Total</td><td class="r">'+fmtRs(d.total)+'</td></tr>'
          + (d.paid ? '<tr><td style="color:#15803d;">'+esc(d.paidLabel)+'</td><td class="r" style="color:#15803d;">'+fmtRs(d.paid)+'</td></tr>' : '')
          + (d.paid || d.kind.indexOf('INVOICE')>=0 ? '<tr class="bal"><td>Balance / बाँकी</td><td class="r">'+fmtRs(d.balance)+'</td></tr>' : '')
        + '</table></div>'
      + (d.notes ? '<div class="terms" style="border-left-color:#0ea5e9;"><b>Details / विवरण</b>\n'+esc(d.notes)+'</div>' : '')
      + (terms ? '<div class="terms"><b>Terms &amp; Conditions / शर्तहरू</b>\n'+esc(terms)+'</div>' : '')
      + '<div class="foot">'
        + ((qr || pay.length) ? '<div class="pay">'+(qr ? '<img src="'+qr+'" alt="Payment QR" data-pay-qr>' : '')
            + '<div><div style="font-weight:800;color:#c2410c;margin-bottom:4px;">💳 Scan to Pay / भुक्तानी</div>'+pay.map(function(p){ return '<div>'+p+'</div>'; }).join('')+'</div></div>' : '<div></div>')
        + '<div class="sig"><div class="ln">Authorised Signature<br>'+esc(co.name)+'</div></div>'
      + '</div>'
      + '<div class="thx">धन्यवाद! — '+esc(co.name)+' &nbsp;•&nbsp; Generated by Swagatik</div>'
      + '</div>';
    return h;
  },

  // v7.1.0: bill size from Settings → Print Settings (A4 / A5 / 80mm / 58mm thermal).
  // Open the print window (choose "Save as PDF" in the print dialog for a PDF).
  print: function(d, title, size){
    size = PrintFmt.valid(size) ? size : PrintFmt.get();
    var thermal = PrintFmt.isThermal(size), mm = PrintFmt.SIZES[size].mm;
    var html = thermal ? this.buildReceipt(d, mm) : this.build(d);
    var page = thermal ? '@page{size:'+mm+'mm auto;margin:0;}body{margin:0;background:#fff;}'
      : size === 'A5' ? '@page{size:A5;margin:7mm;}body{margin:0;background:#fff;}@media print{.swg-doc{max-width:none;padding:0;font-size:11px;}}'
      : '@page{size:A4;margin:10mm;}body{margin:0;background:#fff;}@media print{.swg-doc{max-width:none;padding:0;}}';
    var w = window.open('', '_blank');
    if(!w){ App.toast('❌ Popup block भयो — browser मा popup allow गर्नुहोस्','error',4000); return null; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title || (d.kind+' '+(d.no||'')))+'</title>'
      + '<style>'+page+'</style></head><body data-print-size="'+size+'">'
      + html + '<script>window.onload=function(){setTimeout(function(){try{window.print();}catch(e){}},350);};<\/script></body></html>');
    w.document.close();
    return w;
  },

  // v7.1.0: short receipt for 58mm / 80mm thermal POS printers (black only, one column)
  buildReceipt: function(d, mm){
    mm = mm === 58 ? 58 : 80;
    var co = this._co(), qr = PayQR.get();
    var bs = d.dateBs ? bsStringToDisplay(d.dateBs) : '', ad = d.dateAd ? String(d.dateAd).slice(0,10) : '';
    var fs = mm === 58 ? 10.5 : 12;
    var css = '.swg-rcpt{font-family:"Segoe UI","Noto Sans Devanagari",Arial,sans-serif;color:#000;background:#fff;width:'+(mm-4)+'mm;max-width:100%;margin:0 auto;padding:2mm 1mm;box-sizing:border-box;font-size:'+fs+'px;line-height:1.35;word-break:break-word;}'
      + '.swg-rcpt *{box-sizing:border-box;}.swg-rcpt .c{text-align:center;}.swg-rcpt .n{font-size:1.3em;font-weight:900;}.swg-rcpt .s{font-size:.9em;}'
      + '.swg-rcpt .k{font-weight:900;letter-spacing:1px;margin:2px 0;}.swg-rcpt .hr{border-top:1px dashed #000;margin:4px 0;}'
      + '.swg-rcpt .row{display:flex;justify-content:space-between;gap:6px;}.swg-rcpt .row>:last-child{text-align:right;white-space:nowrap;}'
      + '.swg-rcpt .it{margin-bottom:3px;}.swg-rcpt .g{font-size:1.25em;font-weight:900;border-top:1px solid #000;border-bottom:1px solid #000;padding:2px 0;margin:2px 0;}'
      + '.swg-rcpt img.logo{max-width:40%;max-height:16mm;display:block;margin:0 auto 2px;}.swg-rcpt img.qr{width:'+(mm===58?'32':'40')+'mm;height:auto;display:block;margin:4px auto 0;}'
      + '.swg-rcpt .t{font-size:.85em;white-space:pre-wrap;}';
    var row = function(a, b, cls){ return '<div class="row'+(cls?' '+cls:'')+'"><span>'+a+'</span><span>'+b+'</span></div>'; };
    var items = d.items.map(function(r, i){
      return '<div class="it"><div>'+(i+1)+'. '+esc(r.name)+'</div>'
        + row(esc((r.qty||0)+(r.unit?' '+r.unit:''))+' × '+fmtRs(r.rate), '<b>'+fmtRs((r.qty||0)*(r.rate||0))+'</b>') + '</div>';
    }).join('');
    var pay = [];
    if(co.esewa) pay.push('eSewa: '+esc(co.esewa));
    if(co.khalti) pay.push('Khalti: '+esc(co.khalti));
    if(co.bank) pay.push(esc(co.bank)+(co.acc?' '+esc(co.acc):''));
    return '<style>'+css+'</style><div class="swg-rcpt" data-doc-kind="'+esc(d.kind)+'" data-receipt="'+mm+'">'
      + (co.logo ? '<img class="logo" src="'+co.logo+'" alt="">' : '')
      + '<div class="c n">'+esc(co.name)+'</div>'
      + (co.address ? '<div class="c s">'+esc(co.address)+'</div>' : '')
      + (co.phone ? '<div class="c s">'+esc(co.phone)+'</div>' : '')
      + (co.pan ? '<div class="c s">PAN/VAT: '+esc(co.pan)+'</div>' : '')
      + '<div class="hr"></div><div class="c k">'+esc(d.kind)+'</div>'
      + row('No: <b>'+esc(d.no||'—')+'</b>', esc(bs || ad))
      + (bs && ad ? row('', esc(ad)) : '')
      + (d.cust.name ? '<div>ग्राहक: <b>'+esc(d.cust.name)+'</b>'+(d.cust.phone ? ' '+esc(d.cust.phone) : '')+'</div>' : '')
      + '<div class="hr"></div>' + (items || '<div class="c">—</div>') + '<div class="hr"></div>'
      + row('Subtotal', fmtRs(d.sub))
      + (d.disc ? row('Discount', '- '+fmtRs(d.disc)) : '')
      + (d.taxAmt ? row('VAT ('+d.taxP+'%)', '+ '+fmtRs(d.taxAmt)) : '')
      + row('TOTAL', fmtRs(d.total), 'g')
      + (d.paid ? row(esc(d.paidLabel), fmtRs(d.paid)) : '')
      + (d.paid || d.kind.indexOf('INVOICE')>=0 ? row('<b>Balance / बाँकी</b>', '<b>'+fmtRs(d.balance)+'</b>') : '')
      + (qr ? '<img class="qr" src="'+qr+'" alt="Payment QR" data-pay-qr>' : '')
      + (pay.length ? '<div class="c s">'+pay.join('<br>')+'</div>' : '')
      + (mm === 80 && (d.terms || PayQR.terms()) ? '<div class="hr"></div><div class="t">'+esc(d.terms || PayQR.terms())+'</div>' : '')
      + '<div class="hr"></div><div class="c s">धन्यवाद! — '+esc(co.name)+'</div>'
      + '</div>';
  },

  // In-app preview inside #view-modal with action buttons
  preview: function(d, title, buttons){
    setText('view-modal-title', title || d.kind);
    var mb = document.getElementById('view-modal-body');
    mb.innerHTML = '<div style="overflow-x:auto;border-radius:10px;background:#fff;">'+this.build(d)+'</div>';
    var bd = document.createElement('div'); bd.className = 'btn-group'; bd.style.cssText = 'display:flex;gap:8px;padding:12px 0 0;flex-wrap:wrap;align-items:center;';
    var self = this;
    // v7.1.0: paper size for this print (defaults to Settings → Print Settings)
    var sel = document.createElement('select'); sel.id = 'doc-print-size'; sel.title = 'बिल साइज'; sel.className = 'btn btn-sm btn-secondary'; sel.style.cssText = 'width:auto;flex:0 0 auto;font-size:0.78rem;padding:6px 8px;min-height:0;height:auto;';
    Object.keys(PrintFmt.SIZES).forEach(function(k){ var o = document.createElement('option'); o.value = k; o.textContent = PrintFmt.SIZES[k].short; sel.appendChild(o); });
    sel.value = PrintFmt.get();
    bd.appendChild(sel);
    var pb = document.createElement('button'); pb.className = 'btn btn-primary btn-sm'; pb.textContent = '🖨️ Print / PDF'; pb.onclick = function(){ self.print(d, title, sel.value); };
    bd.appendChild(pb);
    // v7.1.0: 1-click PNG photo → Web Share (WhatsApp) or download. Rendered ahead so the
    // share sheet opens straight from the tap (mobile browsers need the tap to be "fresh").
    DocShare.prepare(d);
    var sb = document.createElement('button'); sb.className = 'btn btn-sm btn-wa'; sb.id = 'doc-share-png'; sb.textContent = '📲 फोटो (PNG) डाउनलोड / शेयर'; sb.style.cssText = 'white-space:normal;line-height:1.25;'; sb.onclick = function(){ DocShare.share(d); };
    bd.appendChild(sb);
    (buttons||[]).forEach(function(b){ var x = document.createElement('button'); x.className = 'btn btn-sm '+(b.cls||'btn-secondary'); x.textContent = b.label; if(b.id) x.id = b.id; x.onclick = b.onClick; bd.appendChild(x); });
    mb.appendChild(bd);
    document.getElementById('view-modal').classList.add('open');
  }
};

// ─── v7.1.0 PRINT SETTINGS: bill paper size ──────────────────────────
// Stored in pk3_print_fmt ({size}) — a business setting, so it syncs and is backed up.
var PrintFmt = {
  KEY: 'pk3_print_fmt',
  SIZES: {
    A4:  { label: 'A4 (Standard) — पूरा पेज', short: '📄 A4', mm: 210 },
    A5:  { label: 'A5 (Half Page) — आधा पेज', short: '📄 A5', mm: 148 },
    T80: { label: '80mm Thermal POS Receipt', short: '🧾 80mm', mm: 80 },
    T58: { label: '58mm Thermal POS Receipt', short: '🧾 58mm', mm: 58 }
  },
  valid: function(v){ return !!(v && Object.prototype.hasOwnProperty.call(this.SIZES, v)); },
  isThermal: function(v){ return v === 'T80' || v === 'T58'; },
  get: function(){ var v = (STORE.get(this.KEY, {}) || {}).size; return this.valid(v) ? v : 'A4'; },
  set: function(v){
    if(!this.valid(v)) v = 'A4';
    var o = STORE.get(this.KEY, {}) || {}; o.size = v; STORE.set(this.KEY, o);
    try { Audit.log('SETTINGS', 'Print size: '+v); } catch(e){}
    try { App.toast('🖨️ बिल साइज: '+this.SIZES[v].label, 'success', 1800); } catch(e){}
    this.render();
  },
  render: function(){
    var el = document.getElementById('set-print-size');
    if(el){
      if(!el.options.length){ var self = this; Object.keys(this.SIZES).forEach(function(k){ var o = document.createElement('option'); o.value = k; o.textContent = self.SIZES[k].label; el.appendChild(o); }); }
      el.value = this.get();
    }
  }
};

// ─── v7.1.0 BILL PHOTO (PNG) + WEB SHARE ─────────────────────────────
// Draws the document straight onto a <canvas> (no library, no server, works offline),
// then shares the PNG with the Web Share API (WhatsApp, Viber …) or downloads it.
var DocShare = {
  W: 1080,
  FONT: '"Segoe UI","Noto Sans Devanagari","Nirmala UI","Mangal",Arial,sans-serif',
  _ready: null,   // { d, blob } of the last prepared document

  _img: function(src){
    return new Promise(function(res){ if(!src) return res(null); var i = new Image(); i.onload = function(){ res(i); }; i.onerror = function(){ res(null); }; i.src = src; });
  },
  fileName: function(d){
    var k = String(d.kind||'Document').toLowerCase().replace(/(^|\s)\S/g, function(c){ return c.toUpperCase(); }).replace(/\s+/g, '-');
    var raw = [k, d.no, d.cust && d.cust.name].filter(Boolean).join('-');
    return raw.replace(/[^A-Za-z0-9\u0900-\u097F_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.png';
  },
  // → Promise<HTMLCanvasElement>
  render: function(d){
    var self = this, co = DocPrint._co();
    return Promise.all([this._img(co.logo), this._img(PayQR.get())]).then(function(im){
      var probe = document.createElement('canvas'); probe.width = probe.height = 1;
      var h = Math.ceil(self._draw(probe.getContext('2d'), d, co, im[0], im[1]));
      var c = document.createElement('canvas'); c.width = self.W; c.height = h;
      var x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      self._draw(x, d, co, im[0], im[1]);
      return c;
    });
  },
  toBlob: function(d){
    return this.render(d).then(function(c){
      return new Promise(function(res, rej){
        if(c.toBlob) return c.toBlob(function(b){ b ? res(b) : rej(new Error('toBlob')); }, 'image/png');
        var bin = atob(c.toDataURL('image/png').split(',')[1]), a = new Uint8Array(bin.length);
        for(var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        res(new Blob([a], { type: 'image/png' }));
      });
    });
  },
  prepare: function(d){
    var self = this, slot = { d: d, blob: null };
    this._ready = slot;
    slot.p = this.toBlob(d).then(function(b){ slot.blob = b; return b; }, function(){ return null; });
    return slot.p;
  },
  // → Promise<'shared'|'downloaded'|'cancelled'|'error'>
  share: function(d){
    var self = this, name = this.fileName(d);
    var slot = this._ready && this._ready.d === d ? this._ready : null;
    var go = function(blob){
      if(!blob) throw new Error('no image');
      var file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch(e){}
      var text = (d.kind||'') + ' ' + (d.no||'') + ' — ' + Company.name('');
      if(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
        return navigator.share({ files: [file], title: name, text: text }).then(function(){ return 'shared'; }, function(err){
          if(err && err.name === 'AbortError') return 'cancelled';
          self.download(blob, name); return 'downloaded';
        });
      }
      self.download(blob, name);
      return 'downloaded';
    };
    var run;
    if(slot && slot.blob){ try { run = Promise.resolve(go(slot.blob)); } catch(e){ run = Promise.reject(e); } }   // same tap → share sheet allowed
    else {
      try { App.toast('⏳ फोटो बन्दैछ…', 'info', 1200); } catch(e){}
      run = (slot ? slot.p : this.toBlob(d)).then(go);
    }
    return run.catch(function(){ try { App.toast('❌ फोटो बनाउन सकिएन', 'error'); } catch(e){} return 'error'; });
  },
  download: function(blob, name){
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ try { URL.revokeObjectURL(url); a.remove(); } catch(e){} }, 4000);
    try { App.toast('📥 '+name+' डाउनलोड भयो — WhatsApp मा attach गरी पठाउनुहोस्', 'success', 3500); } catch(e){}
  },

  // Draws the bill; returns the height used. Called once to measure, once to paint.
  _draw: function(ctx, d, co, logo, qr){
    var W = this.W, P = 56, F = this.FONT, y = P;
    var font = function(sz, wt, it){ ctx.font = (it ? 'italic ' : '') + (wt||400) + ' ' + sz + 'px ' + F; };
    var text = function(s, x, yy, sz, wt, col, al, it){ font(sz, wt, it); ctx.fillStyle = col || '#1f2937'; ctx.textAlign = al || 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(s), x, yy); };
    var wrap = function(s, maxW, sz, wt, it){
      font(sz, wt, it); var out = [];
      String(s == null ? '' : s).split('\n').forEach(function(par){
        var line = '';
        par.split(/\s+/).forEach(function(w){
          var t = line ? line + ' ' + w : w;
          if(ctx.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t;
          while(ctx.measureText(line).width > maxW && line.length > 1){   // one very long word
            var n = line.length; while(n > 1 && ctx.measureText(line.slice(0, n)).width > maxW) n--;
            out.push(line.slice(0, n)); line = line.slice(n);
          }
        });
        out.push(line);
      });
      return out;
    };
    var para = function(s, x, yy, maxW, sz, wt, col, lh, al, it){
      var L = wrap(s, maxW, sz, wt, it); L.forEach(function(l, i){ text(l, x, yy + i*lh, sz, wt, col, al, it); }); return L.length * lh;
    };
    var rect = function(x, yy, w, h, fill){ ctx.fillStyle = fill; ctx.fillRect(x, yy, w, h); };
    var rr = function(x, yy, w, h, r, stroke, dash){
      ctx.save(); ctx.beginPath(); ctx.moveTo(x+r, yy); ctx.arcTo(x+w, yy, x+w, yy+h, r); ctx.arcTo(x+w, yy+h, x, yy+h, r); ctx.arcTo(x, yy+h, x, yy, r); ctx.arcTo(x, yy, x+w, yy, r); ctx.closePath();
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; if(dash) ctx.setLineDash([10, 7]); ctx.stroke(); ctx.restore();
    };
    var ORANGE = '#f97316', DARK_OR = '#c2410c', GREY = '#4b5563', MUTED = '#9ca3af';

    // ── Header: logo + company | document title
    var lx = P, top = y;
    if(logo){ var ls = 120, r = Math.min(ls/logo.width, ls/logo.height); ctx.drawImage(logo, P, y, logo.width*r, logo.height*r); lx = P + ls + 22; }
    var titleW = 320;
    text(d.kind, W-P, y, 42, 900, '#111827', 'right');
    if(d.kindNe) text(d.kindNe, W-P, y+52, 24, 400, '#6b7280', 'right');
    var cw = W - P - titleW - lx - 16;
    y += para(co.name, lx, y, cw, 40, 900, DARK_OR, 48);
    if(co.tagline) y += para(co.tagline, lx, y + 2, cw, 22, 400, GREY, 30);
    var contact = [co.address ? '📍 ' + co.address : '', co.phone ? '📞 ' + co.phone : ''].filter(Boolean).join('  •  ');
    if(contact) y += para(contact, lx, y + 4, cw, 22, 400, GREY, 30);
    if(co.email) y += para('✉️ ' + co.email, lx, y + 4, cw, 22, 400, GREY, 30);
    if(co.pan) y += para('PAN / VAT No: ' + co.pan, lx, y + 4, cw, 22, 700, GREY, 30);
    y = Math.max(y + 8, top + (logo ? 128 : 0), top + 90);
    rect(P, y + 6, W - 2*P, 6, ORANGE); y += 36;

    // ── Customer box | number & dates box
    var gap = 24, rw = 380, lw = W - 2*P - rw - gap, bt = y, pad = 18;
    var ly = bt + pad;
    text(d.kind === 'QUOTATION' || d.kind === 'ESTIMATE' ? 'TO / ग्राहक' : 'BILL TO / ग्राहक', P + pad, ly, 19, 700, MUTED); ly += 30;
    ly += para(d.cust.name || '—', P + pad, ly, lw - 2*pad, 30, 800, '#111827', 38);
    if(d.cust.phone) ly += para('📞 ' + d.cust.phone, P + pad, ly, lw - 2*pad, 23, 400, '#1f2937', 32);
    if(d.cust.address) ly += para('📍 ' + d.cust.address, P + pad, ly, lw - 2*pad, 23, 400, '#1f2937', 32);
    if(d.subject) ly += para('काम: ' + d.subject, P + pad, ly + 4, lw - 2*pad, 23, 600, '#1f2937', 32) + 4;
    var rx = P + lw + gap, ry = bt + pad;
    var bs = d.dateBs ? bsStringToDisplay(d.dateBs) : '';
    [['No.', d.no || '—', '#111827'], ['मिति (BS)', bs ? bs + ' (' + d.dateBs + ')' : '—', '#111827'], ['Date (AD)', d.dateAd ? String(d.dateAd).slice(0,10) : '—', '#111827'],
     d.dueDate ? ['Due', d.dueDate, '#b91c1c'] : null, d.validity ? ['Valid', d.validity, '#111827'] : null, d.ref ? ['Ref', d.ref, '#111827'] : null]
      .filter(Boolean).forEach(function(m){ text(m[0], rx + pad, ry, 19, 700, MUTED); ry += 26; ry += para(m[1], rx + pad, ry, rw - 2*pad, 24, 800, m[2], 32) + 4; });
    var bh = Math.max(ly, ry) - bt + pad - 4;
    rr(P, bt, lw, bh, 12, '#e5e7eb'); rr(rx, bt, rw, bh, 12, '#e5e7eb');
    y = bt + bh + 28;

    // ── Items table
    var cols = [{ k:'#', w:60, al:'center' }, { k:'Particulars / विवरण', w:0, al:'left' }, { k:'Qty', w:130, al:'center' }, { k:'Rate', w:170, al:'right' }, { k:'Amount', w:190, al:'right' }];
    var fixed = cols.reduce(function(s, c){ return s + c.w; }, 0); cols[1].w = W - 2*P - fixed;
    var cx = P; cols.forEach(function(c){ c.x = cx; cx += c.w; });
    var at = function(c){ return c.al === 'center' ? c.x + c.w/2 : c.al === 'right' ? c.x + c.w - 12 : c.x + 12; };
    rect(P, y, W - 2*P, 54, '#fff7ed'); rect(P, y + 51, W - 2*P, 3, '#fdba74');
    cols.forEach(function(c){ text(c.k, at(c), y + 15, 21, 800, '#9a3412', c.al); });
    y += 54;
    var items = d.items.length ? d.items : [{ name:'—', qty:0, unit:'', rate:0 }];
    items.forEach(function(r, i){
      var L = wrap(r.name, cols[1].w - 24, 24, 400), qtyL = wrap(((r.qty||0) + (r.unit ? ' ' + r.unit : '')), cols[2].w - 12, 22, 400);
      var rh = Math.max(L.length, qtyL.length) * 32 + 22;
      text(i + 1, at(cols[0]), y + 12, 22, 400, GREY, 'center');
      L.forEach(function(l, j){ text(l, at(cols[1]), y + 11 + j*32, 24, 400, '#1f2937'); });
      qtyL.forEach(function(l, j){ text(l, at(cols[2]), y + 12 + j*32, 22, 400, '#1f2937', 'center'); });
      text(fmtRs(r.rate), at(cols[3]), y + 12, 22, 400, '#1f2937', 'right');
      text(fmtRs((r.qty||0)*(r.rate||0)), at(cols[4]), y + 12, 23, 800, '#111827', 'right');
      rect(P, y + rh - 2, W - 2*P, 2, '#f1f5f9');
      y += rh;
    });
    y += 18;

    // ── Totals (right) + amount in words (left)
    var tw = 470, tx = W - P - tw, ty = y;
    var sumRow = function(label, val, o){
      o = o || {};
      if(o.bg) rect(tx, ty, tw, o.h || 44, o.bg);
      if(o.line) rect(tx, ty, tw, 3, ORANGE);
      text(label, tx + 14, ty + (o.line ? 12 : 9), o.sz || 23, o.wt || 400, o.col || '#1f2937');
      text(val, tx + tw - 14, ty + (o.line ? 12 : 9), o.sz || 23, o.wt || 600, o.col || '#1f2937', 'right');
      ty += (o.h || 44);
    };
    sumRow('Subtotal', fmtRs(d.sub));
    if(d.disc) sumRow('Discount' + (d.discP ? ' (' + (Math.round(d.discP*100)/100) + '%)' : ''), '- ' + fmtRs(d.disc), { col:'#b91c1c' });
    if(d.taxAmt) sumRow('VAT (' + d.taxP + '%)', '+ ' + fmtRs(d.taxAmt));
    sumRow('Grand Total', fmtRs(d.total), { line:true, sz:32, wt:900, col:DARK_OR, h:60 });
    if(d.paid) sumRow(d.paidLabel, fmtRs(d.paid), { col:'#15803d' });
    if(d.paid || d.kind.indexOf('INVOICE') >= 0) sumRow('Balance / बाँकी', fmtRs(d.balance), { bg:'#fef2f2', col:'#b91c1c', wt:800 });
    var words = (typeof numToWords === 'function') ? numToWords(d.total) : '';
    var wy = y + 8;
    if(words){ text('In words:', P, wy, 21, 400, GREY, 'left', true); wy += 30; wy += para(words, P, wy, tx - P - 28, 22, 700, '#374151', 30, 'left', true); }
    y = Math.max(ty, wy) + 22;

    // ── Details / Terms
    var terms = (d.terms && String(d.terms).trim()) ? d.terms : PayQR.terms();
    var note = function(title, body, bar){
      var L = wrap(body, W - 2*P - 44, 22, 400), h = 24 + 34 + L.length*30 + 16;
      rect(P, y, W - 2*P, h, '#f9fafb'); rect(P, y, 6, h, bar);
      text(title, P + 24, y + 16, 22, 800, '#111827');
      L.forEach(function(l, i){ text(l, P + 24, y + 52 + i*30, 22, 400, '#374151'); });
      y += h + 16;
    };
    if(d.notes) note('Details / विवरण', d.notes, '#0ea5e9');
    if(terms) note('Terms & Conditions / शर्तहरू', terms, ORANGE);

    // ── Payment QR + signature
    var pay = [];
    if(co.bank) pay.push('🏦 ' + co.bank + (co.acc ? ' — A/C ' + co.acc : ''));
    if(co.esewa) pay.push('📱 eSewa: ' + co.esewa);
    if(co.khalti) pay.push('💜 Khalti: ' + co.khalti);
    y += 8;
    var fy = y, sigW = 300;
    if(qr || pay.length){
      var qs = qr ? 230 : 0, bx = P, pw = W - 2*P - sigW - 30, px = bx + 18 + (qs ? qs + 22 : 0), py = fy + 22;
      if(qr) ctx.drawImage(qr, bx + 18, fy + 18, qs, qs);
      text('💳 Scan to Pay / भुक्तानी', px, py, 24, 800, DARK_OR); py += 40;
      pay.forEach(function(p){ py += para(p, px, py, pw - (px - bx) - 18, 22, 400, '#1f2937', 32); });
      var ph = Math.max(qs + 36, py - fy + 16);
      rr(bx, fy, pw, ph, 14, '#fdba74', true);
      fy += ph;
    }
    var sy = Math.max(fy, y + 120);
    rect(W - P - sigW, sy - 44, sigW, 2, MUTED);
    text('Authorised Signature', W - P - sigW/2, sy - 34, 20, 400, GREY, 'center');
    para(co.name, W - P - sigW/2, sy - 6, sigW, 20, 700, GREY, 26, 'center');
    y = sy + 40;

    // ── Thank-you footer
    rect(P, y, W - 2*P, 2, '#eeeeee'); y += 16;
    y += para('धन्यवाद! — ' + co.name + '  •  Generated by Swagatik', W/2, y, W - 2*P, 20, 400, MUTED, 28, 'center');
    return y + P - 10;
  }
};
