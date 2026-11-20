// ─── PROFESSIONAL PRINT / PDF ────────────────────────────────────────
var DocPrint = {
  _co: function(){
    var co = STORE.get('pk3_settings',{}) || {};
    return {
      name: co.companyName || 'PRERAK MULTIPURPOSE PVT LTD', tagline: co.tagline || '',
      address: co.address || 'Hetauda-2, Makwanpur', phone: [co.phone1 || '9855069733', co.phone2].filter(Boolean).join(', '),
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

  // Open the A4 print window (choose "Save as PDF" in the print dialog for a PDF)
  print: function(d, title){
    var html = this.build(d);
    var w = window.open('', '_blank');
    if(!w){ App.toast('❌ Popup block भयो — browser मा popup allow गर्नुहोस्','error',4000); return null; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title || (d.kind+' '+(d.no||'')))+'</title>'
      + '<style>@page{size:A4;margin:10mm;}body{margin:0;background:#fff;}@media print{.swg-doc{max-width:none;padding:0;}}</style></head><body>'
      + html + '<script>window.onload=function(){setTimeout(function(){try{window.print();}catch(e){}},350);};<\/script></body></html>');
    w.document.close();
    return w;
  },

  // In-app preview inside #view-modal with action buttons
  preview: function(d, title, buttons){
    setText('view-modal-title', title || d.kind);
    var mb = document.getElementById('view-modal-body');
    mb.innerHTML = '<div style="overflow-x:auto;border-radius:10px;background:#fff;">'+this.build(d)+'</div>';
    var bd = document.createElement('div'); bd.className = 'btn-group'; bd.style.cssText = 'display:flex;gap:8px;padding:12px 0 0;flex-wrap:wrap;';
    var self = this;
    var pb = document.createElement('button'); pb.className = 'btn btn-primary btn-sm'; pb.textContent = '🖨️ Print / PDF'; pb.onclick = function(){ self.print(d, title); };
    bd.appendChild(pb);
    (buttons||[]).forEach(function(b){ var x = document.createElement('button'); x.className = 'btn btn-sm '+(b.cls||'btn-secondary'); x.textContent = b.label; if(b.id) x.id = b.id; x.onclick = b.onClick; bd.appendChild(x); });
    mb.appendChild(bd);
    document.getElementById('view-modal').classList.add('open');
  }
};

