var Ledger = {
  _selectedCustId: '',
  getData: function(){
    // v6.9.0: older versions sometimes stored date as a {y,m,d} object — normalise to 'YYYY-MM-DD'
    return (STORE.get('pk3_ledger', []) || []).map(function(t){
      if(t && t.date && typeof t.date==='object' && t.date.y){ t.date = t.date.y+'-'+String(t.date.m).padStart(2,'0')+'-'+String(t.date.d).padStart(2,'0'); }
      else if(t && t.date!=null && typeof t.date!=='string'){ t.date = String(t.date); }
      return t;
    });
  },
  setData: function(list){ STORE.set('pk3_ledger', list); },

  render: function(){
    // Populate customer dropdown
    var sel = document.getElementById('ledger-cust-select');
    if(sel){
      var custs = STORE.get('pk3_customers', []) || [];
      var cur = sel.value;
      sel.innerHTML = '<option value="">-- Customer छान्नुस् --</option>'
        + custs.map(function(c){ return '<option value="'+c.id+'">'+esc(c.name)+(c.phone?' ('+esc(c.phone)+')':'')+'</option>'; }).join('');
      if(cur) sel.value = cur;
      else if(this._selectedCustId) sel.value = this._selectedCustId;
    }
    this._renderContent();
  },

  select: function(custId){
    this._selectedCustId = custId;
    this._renderContent();
  },

  _renderContent: function(){
    var cont = document.getElementById('ledger-content');
    if(!cont) return;
    var custId = this._selectedCustId || getVal('ledger-cust-select');
    var all = this.getData();
    if(!custId){
      // Show summary of all customers with balances
      var custs = STORE.get('pk3_customers', []) || [];
      if(!all.length){
        cont.innerHTML = '<div class="empty-state"><div class="icon">📒</div><div class="title">कुनै ledger entry छैन</div><div class="subtitle">माथिबाट customer छान्नुस् र "+ Transaction" थिच्नुस्</div></div>';
        return;
      }
      // Group by customer
      var byCust = {};
      all.forEach(function(t){
        var k = t.customerId || 'general';
        if(!byCust[k]) byCust[k] = {name: t.custName||'General', debit:0, credit:0, count:0};
        byCust[k].debit  += parseFloat(t.debit||0);
        byCust[k].credit += parseFloat(t.credit||0);
        byCust[k].count++;
      });
      var rows = Object.keys(byCust).map(function(k){
        var c = byCust[k];
        var bal = c.debit - c.credit;
        return '<tr style="cursor:pointer;" onclick="Ledger.select(\''+k+'\');var s=document.getElementById(\'ledger-cust-select\');if(s)s.value=\''+k+'\';">'
          + '<td style="font-weight:600;">'+esc(c.name)+'</td>'
          + '<td style="text-align:center;color:var(--text-muted);">'+c.count+'</td>'
          + '<td style="text-align:right;color:var(--red);">'+fmtRs(c.debit)+'</td>'
          + '<td style="text-align:right;color:var(--green);">'+fmtRs(c.credit)+'</td>'
          + '<td style="text-align:right;font-weight:700;color:'+(bal>=0?'var(--red)':'var(--green)')+';">'+fmtRs(Math.abs(bal))+' '+(bal>=0?'Dr':'Cr')+'</td>'
          + '</tr>';
      }).join('');
      cont.innerHTML = '<div class="card card-body"><div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px;">📊 All Customers Summary (click row to view detail)</div>'
        + '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr><th>Customer</th><th style="text-align:center;">Entries</th><th style="text-align:right;">Total Debit</th><th style="text-align:right;">Total Credit</th><th style="text-align:right;">Balance</th></tr></thead><tbody>'
        + rows + '</tbody></table></div></div>';
      return;
    }
    // Single customer ledger
    var rows = all.filter(function(t){ return (t.customerId||'general') == custId; });
    var custs = STORE.get('pk3_customers', []) || [];
    var cust = custs.find(function(c){ return c.id == custId; });
    var custName = cust ? cust.name : (rows[0] ? rows[0].custName : 'General');
    // Sort by date
    rows.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    var bal = 0;
    var bodyRows = rows.map(function(t){
      var dr = parseFloat(t.debit||0), cr = parseFloat(t.credit||0);
      bal += dr - cr;
      return '<tr><td style="font-size:0.8rem;">'+esc(t.date||'')+'</td>'
        + '<td>'+esc(t.narration||t.desc||'')+'</td>'
        + '<td style="text-align:right;color:var(--red);">'+(dr?fmtRs(dr):'—')+'</td>'
        + '<td style="text-align:right;color:var(--green);">'+(cr?fmtRs(cr):'—')+'</td>'
        + '<td style="text-align:right;font-weight:600;color:'+(bal>=0?'var(--red)':'var(--green)')+';">'+fmtRs(Math.abs(bal))+'</td>'
        + '<td><button onclick="Ledger.delTx(\''+t.id+'\')" class="btn btn-xs btn-danger" title="Delete">🗑</button></td></tr>';
    }).join('');
    var totalDr = rows.reduce(function(s,t){ return s+parseFloat(t.debit||0); },0);
    var totalCr = rows.reduce(function(s,t){ return s+parseFloat(t.credit||0); },0);
    cont.innerHTML = '<div class="card card-body">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">'
        + '<div style="font-size:1.05rem;font-weight:700;">📒 '+esc(custName)+(cust&&cust.phone?' <span style="font-size:0.78rem;color:var(--text-muted);">'+esc(cust.phone)+'</span>':'')+'</div>'
        + '<div style="font-size:0.92rem;font-weight:800;color:'+(bal>=0?'var(--red)':'var(--green)')+';">Balance: '+fmtRs(Math.abs(bal))+' '+(bal>=0?'(Dr)':'(Cr)')+'</div>'
      + '</div>'
      + (rows.length
          ? '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr><th>Date</th><th>Narration</th><th style="text-align:right;">Debit</th><th style="text-align:right;">Credit</th><th style="text-align:right;">Balance</th><th></th></tr></thead><tbody>'
            + bodyRows
            + '<tr style="border-top:2px solid var(--border);font-weight:700;"><td colspan="2" style="text-align:right;">TOTAL</td><td style="text-align:right;color:var(--red);">'+fmtRs(totalDr)+'</td><td style="text-align:right;color:var(--green);">'+fmtRs(totalCr)+'</td><td colspan="2"></td></tr>'
            + '</tbody></table></div>'
          : '<div class="empty-state" style="padding:30px;"><div class="icon">📝</div><div class="title">यो customer को कुनै transaction छैन</div><button onclick="Ledger.addTransaction()" class="btn btn-primary">+ Add Transaction</button></div>')
      + '</div>';
  },

  addTransaction: function(){
    var custId = this._selectedCustId || getVal('ledger-cust-select');
    if(!custId){ App.toast('पहिले customer छान्नुस्!','error'); return; }
    setVal('ltx-type','debit');
    setVal('ltx-amount','');
    setVal('ltx-desc','');
    var d = document.getElementById('ltx-date');
    if(d) d.value = todayISO();
    document.getElementById('ledger-tx-modal').classList.add('open');
  },

  saveTx: function(){
    var custId = this._selectedCustId || getVal('ledger-cust-select');
    if(!custId){ App.toast('Customer छान्नुस्!','error'); return; }
    var type = getVal('ltx-type');
    var amount = parseFloat(getVal('ltx-amount')||0);
    var desc = getVal('ltx-desc');
    var dateAd = getVal('ltx-date');
    if(!amount || amount<=0){ App.toast('Amount राख्नुस्!','error'); return; }
    var custs = STORE.get('pk3_customers', []) || [];
    var cust = custs.find(function(c){ return c.id == custId; });
    var dateBs = '';
    try { if(dateAd && typeof adToBs==='function'){ var _p=dateAd.split('-'); var _b=adToBs(parseInt(_p[0],10),parseInt(_p[1],10),parseInt(_p[2],10)); dateBs = _b.y+'-'+String(_b.m).padStart(2,'0')+'-'+String(_b.d).padStart(2,'0'); } } catch(e){}
    var rec = {
      id: 'lx_'+Date.now().toString(36),
      customerId: custId,
      custName: cust ? cust.name : 'General',
      date: dateBs || dateAd || todayBs(),
      dateAd: dateAd,
      narration: desc,
      desc: desc,
      debit:  type==='debit'  ? amount : 0,
      credit: type==='credit' ? amount : 0,
      created: new Date().toISOString()
    };
    var list = this.getData();
    list.push(rec);
    this.setData(list);
    try { Audit.log('LEDGER', (type==='debit'?'Debit':'Credit')+' Rs '+amount+' — '+rec.custName); } catch(e){}
    document.getElementById('ledger-tx-modal').classList.remove('open');
    App.toast('✅ Transaction saved','success');
    this._renderContent();
  },

  delTx: function(id){
    if(!confirm('Delete this transaction?')) return;
    var list = this.getData().filter(function(t){ return t.id !== id; });
    this.setData(list);
    try { Audit.log('LEDGER','Transaction deleted'); } catch(e){}
    App.toast('🗑 Deleted','info');
    this._renderContent();
  },

  print: function(){
    var custId = this._selectedCustId || getVal('ledger-cust-select');
    var all = this.getData();
    var rows = custId ? all.filter(function(t){ return (t.customerId||'general')==custId; }) : all;
    if(!rows.length){ App.toast('Print गर्न कुनै entry छैन','warning'); return; }
    var co = STORE.get('pk3_settings', {}) || {};
    var custs = STORE.get('pk3_customers', []) || [];
    var cust = custId ? custs.find(function(c){ return c.id==custId; }) : null;
    var custName = cust ? cust.name : 'All Customers';
    rows.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    var bal = 0;
    var bodyRows = rows.map(function(t){
      var dr=parseFloat(t.debit||0), cr=parseFloat(t.credit||0);
      bal += dr-cr;
      return '<tr><td>'+esc(t.date||'')+'</td><td>'+esc(t.custName||'')+'</td><td>'+esc(t.narration||t.desc||'')+'</td><td class="r">'+(dr?fmtRs(dr):'')+'</td><td class="r">'+(cr?fmtRs(cr):'')+'</td><td class="r b">'+fmtRs(Math.abs(bal))+(bal>=0?' Dr':' Cr')+'</td></tr>';
    }).join('');
    var w = window.open('', '_blank', 'width=800,height=1000');
    if(!w){ App.toast('Popup blocked','error'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ledger — '+esc(custName)+'</title>'
      + '<style>body{font-family:Arial,sans-serif;padding:24px;color:#222;}h1{font-size:1.3rem;margin-bottom:4px;}.sub{color:#666;font-size:0.85rem;margin-bottom:16px;}table{width:100%;border-collapse:collapse;font-size:0.85rem;}th,td{border:1px solid #ccc;padding:7px 9px;text-align:left;}th{background:#f0f0f0;}.r{text-align:right;}.b{font-weight:700;}</style>'
      + '</head><body><h1>'+esc(Company.name(''))+'</h1>'
      + '<div class="sub">📒 Customer Ledger — '+esc(custName)+(co.address?' · '+esc(co.address):'')+'</div>'
      + '<table><thead><tr><th>Date</th><th>Customer</th><th>Narration</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead><tbody>'
      + bodyRows + '</tbody></table>'
      + '<script>setTimeout(function(){window.print();},400);<\/script></body></html>');
    w.document.close();
  },

  exportCSV: function(){
    var rows = [['Date','Customer','Narration','Debit','Credit']];
    this.getData().forEach(function(r){ rows.push([r.date,r.custName,(r.narration||r.desc||''),r.debit||0,r.credit||0]); });
    CAExport.download('ledger-export.csv', rows);   // v7.3.0: UTF-8 BOM + safe quoting (नेपाली narration Excel मा नबिग्रने)
  }
};

