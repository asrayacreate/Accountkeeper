// ─── ACCOUNT SUMMARY MODULE ───────────────────────────────────
var AccountSummary = {
  _filter: 'month',
  setFilter: function(f){ this._filter=f; ['month','year','all'].forEach(function(x){var b=document.getElementById('acf-'+x);if(b)b.className='btn btn-sm btn-'+(x===f?'primary':'secondary');}); this.render(); },
  render: function(){
    var db=STORE.get('pk3_daybook',[]), today=todayISO();
    var entries=db;
    if(this._filter==='month') entries=db.filter(function(e){return e.date&&e.date.slice(0,7)===today.slice(0,7);});
    else if(this._filter==='year') entries=db.filter(function(e){return e.date&&e.date.slice(0,4)===today.slice(0,4);});
    var inc=entries.filter(function(e){return e.type==='income';}).reduce(function(s,e){return s+e.amount;},0);
    var exp=entries.filter(function(e){return e.type==='expense';}).reduce(function(s,e){return s+e.amount;},0);
    setText('acs-total-inc',fmtRs(inc)); setText('acs-total-exp',fmtRs(exp));
    var netEl=document.getElementById('acs-net'); if(netEl){netEl.textContent=fmtRs(inc-exp);netEl.style.color=(inc-exp)>=0?'var(--green)':'var(--red)';}
    setText('acs-total-cust',SampleData.real(Customers.getData()).length);
    // Total Sales (Invoiced): sum invoice amounts, excluding demo + returned records
    try {
      var _invs = STORE.get('pk3_invoices', []) || [];
      var _totalSales = _invs.reduce(function(sum, iv){
        if(!iv || iv._demo || iv._returned || iv.status==='Cancelled' || iv.cancelled) return sum;
        return sum + (parseFloat(iv.amount)||0);
      }, 0);
      setText('acs-total-sales', fmtRs(_totalSales));
    } catch(e){ setText('acs-total-sales','Rs.0'); }
    // Charts (simple bar)
    var self=this;
    ['acc-chart1-wrap','acc-chart2-wrap','acc-chart3-wrap','acc-chart4-wrap'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);">(chart)</div>';});
    // Income chart simple
    var c1=document.getElementById('acc-chart1-wrap'); if(c1){c1.innerHTML='<div style="display:flex;gap:12px;align-items:flex-end;height:120px;padding:10px;"><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:100%;background:var(--green);border-radius:4px 4px 0 0;" style="height:'+(inc>0?Math.min(100,100)+'px':'10px')+'"></div><div style="font-size:0.7rem;color:var(--text-muted);">Income</div><div style="font-size:0.8rem;font-weight:700;color:var(--green);">'+fmtRs(inc)+'</div></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:100%;background:var(--red);border-radius:4px 4px 0 0;"></div><div style="font-size:0.7rem;color:var(--text-muted);">Expense</div><div style="font-size:0.8rem;font-weight:700;color:var(--red);">'+fmtRs(exp)+'</div></div></div>';}
    // Detail table
    var dt=document.getElementById('acc-detail-table'); if(dt){
      var recent=entries.slice(0,50);
      dt.innerHTML=recent.length?'<table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead><tbody>'+recent.map(function(e){return '<tr><td style="font-size:0.78rem;">'+(e.dateBs?bsStringToDisplay(e.dateBs):fmtDisplayDate(e.date))+'</td><td><span class="tag '+(e.type==='income'?'tag-green':'tag-red')+'">'+e.type+'</span></td><td style="font-size:0.82rem;">'+e.desc+'</td><td style="text-align:right;font-weight:700;color:'+(e.type==='income'?'var(--green)':'var(--red)')+';">'+fmtRs(e.amount)+'</td></tr>';}).join('')+'</tbody></table>':'<div class="empty-state" style="padding:30px;">No entries found</div>';
    }
  },
  print: function(){ window.print(); }
};

