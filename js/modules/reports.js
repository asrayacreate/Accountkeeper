var Reports = {
  _filter: 'today',
  init: function(){ this.render(); },
  setFilter: function(f){
    this._filter = f;
    ['today','week','month','all'].forEach(function(x){
      var b=document.getElementById('rpt-f-'+x);
      if(b) b.className='btn btn-sm btn-'+(x===f?'primary':'secondary');
    });
    this.render();
  },
  _range: function(){
    var now=new Date(); var start=null;
    if(this._filter==='today'){ start=new Date(now.getFullYear(),now.getMonth(),now.getDate()); }
    else if(this._filter==='week'){ start=new Date(now); start.setDate(start.getDate()-7); }
    else if(this._filter==='month'){ start=new Date(now); start.setMonth(start.getMonth()-1); }
    return start;
  },
  _inRange: function(iso){
    if(this._filter==='all') return true;
    if(!iso) return false;
    var d=new Date(iso); if(isNaN(d.getTime())) return false;
    var start=this._range();
    return !start || d>=start;
  },
  render: function(){
    try { CAExport.renderCard(); } catch(e) { console.warn('CAExport', e); }
    var self=this;
    var custs=STORE.get('pk3_customers',[])||[];
    var quots=STORE.get('pk3_quotations',[])||[];
    var invs =STORE.get('pk3_invoices',[])||[];
    var db   =STORE.get('pk3_daybook',[])||[];
    var fQuots=quots.filter(function(q){ return self._inRange(q.date||q.created); });
    var fInvs =invs.filter(function(i){ return self._inRange(i.date||i.created); });
    var fDb   =db.filter(function(d){ return self._inRange(d.date||d.dateAd); });
    var fCust =custs.filter(function(c){ return self._inRange(c.created||c.updated); });
    var income =fDb.filter(function(d){return d.type==='income';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
    var expense=fDb.filter(function(d){return d.type==='expense';}).reduce(function(s,d){return s+parseFloat(d.amount||0);},0);
    var quotVal=fQuots.reduce(function(s,q){return s+parseFloat(q.amount||q.total||0);},0);
    var returns=fDb.filter(function(d){return d.type==='return';}).reduce(function(s,d){return s+(parseFloat(d.amount)||0);},0);
    var net=income-expense-returns;
    // Stats grid
    var stats=document.getElementById('rpt-stats');
    if(stats){
      stats.innerHTML=[
        ['👥 New Customers',fCust.length,'var(--accent)'],
        ['📋 Quotations',fQuots.length,'var(--purple)'],
        ['💵 Quote Value',fmtRs(quotVal),'var(--secondary)'],
        ['🧾 Invoices',fInvs.length,'#f97316'],
        ['💰 Income',fmtRs(income),'var(--green)'],
        ['💸 Expense',fmtRs(expense),'var(--red)'],
        ['↩️ Returns',fmtRs(returns),'var(--red)'],
        ['📊 Net '+(net>=0?'Profit':'Loss'),fmtRs(Math.abs(net)),net>=0?'var(--green)':'var(--red)']
      ].map(function(s){
        return '<div class="stat-card"><div class="stat-label">'+s[0]+'</div><div class="stat-value" style="color:'+s[2]+';font-size:1.25rem;">'+s[1]+'</div></div>';
      }).join('');
    }
    // Staff/salesperson performance
    var staffEl=document.getElementById('rpt-staff');
    if(staffEl){
      var byStaff={};
      fCust.forEach(function(c){ var s=(c.sales||'').trim()||'—'; if(!byStaff[s])byStaff[s]={cust:0,adv:0}; byStaff[s].cust++; byStaff[s].adv+=parseFloat(c.advance||0); });
      var keys=Object.keys(byStaff).filter(function(k){return k!=='—';});
      if(keys.length){
        staffEl.innerHTML='<div class="card"><div class="card-head"><span>🧑‍💼 Salesperson Performance</span></div><div class="table-wrap"><table><thead><tr><th>Salesperson</th><th style="text-align:center;">Customers</th><th style="text-align:right;">Advance Collected</th></tr></thead><tbody>'
          + keys.map(function(k){ return '<tr><td style="font-weight:600;">'+esc(k)+'</td><td style="text-align:center;">'+byStaff[k].cust+'</td><td style="text-align:right;color:var(--green);">'+fmtRs(byStaff[k].adv)+'</td></tr>'; }).join('')
          + '</tbody></table></div></div>';
      } else { staffEl.innerHTML=''; }
    }
    // Daybook detail table
    var tbody=document.getElementById('rpt-table');
    var noRpt=document.getElementById('no-rpt');
    if(tbody){
      if(!fDb.length){
        tbody.innerHTML='';
        if(noRpt) noRpt.style.display='';
      } else {
        if(noRpt) noRpt.style.display='none';
        fDb.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
        tbody.innerHTML=fDb.map(function(d){
          return '<tr><td style="font-size:0.78rem;">'+(d.dateBs?bsStringToDisplay(d.dateBs):fmtDisplayDate(d.date))+'</td>'
            +'<td><span class="tag '+(d.type==='income'?'tag-green':'tag-red')+'">'+esc(d.type||'')+'</span></td>'
            +'<td style="font-size:0.82rem;">'+esc(d.desc||'')+'</td>'
            +'<td style="text-align:right;font-weight:700;color:'+(d.type==='income'?'var(--green)':'var(--red)')+';">'+fmtRs(d.amount||0)+'</td></tr>';
        }).join('');
      }
    }
    this._lastData={income:income,expense:expense,net:net,quotVal:quotVal,custCount:fCust.length,quotCount:fQuots.length,invCount:fInvs.length};
  },
  _filterLabel: function(){
    return {today:'आज',week:'७ दिन',month:'महिना',all:'सबै'}[this._filter]||this._filter;
  },
  print: function(){
    var co=STORE.get('pk3_settings',{})||{};
    var d=this._lastData||{};
    var w=window.open('','_blank','width=800,height=1000');
    if(!w){ App.toast('Popup blocked','error'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report</title>'
      +'<style>body{font-family:Arial,sans-serif;padding:24px;color:#222;}h1{color:#f97316;font-size:1.3rem;margin-bottom:2px;}.sub{color:#666;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}td,th{border:1px solid #ddd;padding:8px 10px;text-align:left;}th{background:#f5f5f5;}.r{text-align:right;}</style>'
      +'</head><body><h1>'+esc(Company.name(''))+'</h1>'
      +'<div class="sub">📊 Report ('+this._filterLabel()+')'+(co.address?' • '+esc(co.address):'')+'</div>'
      +'<table><tr><th>New Customers</th><td class="r">'+(d.custCount||0)+'</td></tr>'
      +'<tr><th>Quotations</th><td class="r">'+(d.quotCount||0)+' ('+fmtRs(d.quotVal||0)+')</td></tr>'
      +'<tr><th>Invoices</th><td class="r">'+(d.invCount||0)+'</td></tr>'
      +'<tr><th>Income</th><td class="r" style="color:green;">'+fmtRs(d.income||0)+'</td></tr>'
      +'<tr><th>Expense</th><td class="r" style="color:#d00;">'+fmtRs(d.expense||0)+'</td></tr>'
      +'<tr><th>Net '+((d.net||0)>=0?'Profit':'Loss')+'</th><td class="r" style="font-weight:700;">'+fmtRs(Math.abs(d.net||0))+'</td></tr></table>'
      +'<script>setTimeout(function(){window.print();},400);<\/script></body></html>');
    w.document.close();
  },
  shareWA: function(){
    var co=STORE.get('pk3_settings',{})||{};
    var d=this._lastData||{};
    var msg='*📊 '+Company.name()+' Report*\n('+this._filterLabel()+')\n\n'
      +'👥 New Customers: '+(d.custCount||0)+'\n'
      +'📋 Quotations: '+(d.quotCount||0)+' ('+fmtRs(d.quotVal||0)+')\n'
      +'🧾 Invoices: '+(d.invCount||0)+'\n'
      +'💰 Income: '+fmtRs(d.income||0)+'\n'
      +'💸 Expense: '+fmtRs(d.expense||0)+'\n'
      +'📊 Net '+((d.net||0)>=0?'Profit':'Loss')+': '+fmtRs(Math.abs(d.net||0));
    if(typeof Wa!=='undefined'&&Wa.send){ Wa.send('',msg); }
    else window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
  },
  exportPDF: function(){ this.print(); }
};

// (DailyReport module removed in v4.9 — replaced by the Reports module; had 0 references)

