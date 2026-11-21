// ─── EXPENSES MODULE (v6.3) — expense-type view over pk3_daybook ───
var Expenses = {
  _filter: 'month',
  getData: function(){ return (STORE.get('pk3_daybook', []) || []).filter(function(e){ return e && e.type==='expense'; }); },
  setFilter: function(f){
    this._filter=f;
    ['today','week','month','all'].forEach(function(k){
      var b=document.getElementById('ex-f-'+k);
      if(b){ b.className='btn btn-sm '+(k===f?'btn-primary':'btn-secondary'); }
    });
    this.render();
  },
  openAdd: function(){
    setVal('db-edit-id','');
    setVal('db-type','expense');           // fixed to expense
    setVal('db-amount',''); setVal('db-desc',''); setVal('db-cat','');
    setVal('db-vendor',''); setVal('db-bill',''); setVal('db-pay','Cash');
    setVal('db-notes','');
    // show vendor/bill/pay fields for expenses
    ['db-vendor-grp','db-bill-grp','db-pay-grp'].forEach(function(g){var el=document.getElementById(g);if(el)el.style.display='';});
    setVal('db-date-inp',''); setText('db-date-inp-text','📅 मिति...');
    setText('db-modal-title','📤 नयाँ Expense');
    try { Projects.fillSelect(''); } catch(e){}
    var tsel=document.getElementById('db-type'); if(tsel && tsel.parentElement) tsel.parentElement.style.display='none';
    document.getElementById('db-modal').classList.add('open');
    setTimeout(function(){var a=document.getElementById('db-amount');if(a)a.focus();},200);
    Expenses._reopenOnSave=true;
  },
  render: function(){
    var all=this.getData();
    var catF=getVal('ex-cat-filter');
    var list = catF ? all.filter(function(e){return (e.cat||'')===catF;}) : all.slice();
    var today=todayISO();
    var week=new Date(); week.setDate(week.getDate()-7); var weekStr=isoLocal(week);
    function inRange(e){
      if(Expenses._filter==='today') return e.date===today;
      if(Expenses._filter==='week') return e.date>=weekStr;
      if(Expenses._filter==='month') return e.date&&e.date.slice(0,7)===today.slice(0,7);
      return true;
    }
    list = list.filter(inRange);
    var total=list.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    setText('ex-total',fmtRs(total));
    setText('ex-count',String(list.length));

    // Category breakdown (कुन category मा कति) — from the same filtered list
    var byCat={};
    list.forEach(function(e){ var c=e.cat||'Other'; byCat[c]=(byCat[c]||0)+(parseFloat(e.amount)||0); });
    var cats=Object.keys(byCat).sort(function(a,b){return byCat[b]-byCat[a];});
    var bd=document.getElementById('ex-breakdown');
    if(bd){
      if(!cats.length){ bd.innerHTML=''; }
      else {
        bd.innerHTML='<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">Category अनुसार खर्च</div>'
          + cats.map(function(c){
              var amt=byCat[c]; var pct=total>0?Math.round(amt/total*100):0;
              return '<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:2px;"><span>'+esc(c)+'</span><span style="font-weight:700;">'+fmtRs(amt)+' <span style="color:var(--text-muted);font-weight:400;">('+pct+'%)</span></span></div>'
                +'<div style="height:6px;background:var(--surface-2);border-radius:4px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:var(--red);"></div></div></div>';
            }).join('');
      }
    }

    var tb=document.getElementById('expenses-body');
    var ne=document.getElementById('expenses-empty');
    if(!tb) return;
    if(!list.length){ tb.innerHTML=''; if(ne) ne.style.display=''; return; }
    if(ne) ne.style.display='none';
    tb.innerHTML=list.map(function(e){
      var sub=[];
      if(e.voucherNo) sub.push('\ud83e\uddfe '+esc(e.voucherNo));
      if(e.vendor) sub.push('\ud83c\udfea '+esc(e.vendor));
      if(e.bill) sub.push('\ud83e\uddfe '+esc(e.bill));
      if(e.pay) sub.push('\ud83d\udcb3 '+esc(e.pay));
      var subLine = sub.length? '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">'+sub.join(' &nbsp;•&nbsp; ')+'</div>' : '';
      return '<tr><td style="font-size:0.78rem;">'+(e.dateBs?bsStringToDisplay(e.dateBs):(e.date||'\u2014'))+'</td>'
        +'<td style="font-weight:600;">'+esc(e.desc||'\u2014')+subLine+'</td>'
        +'<td style="font-size:0.76rem;color:var(--text-muted);">'+esc(e.cat||'\u2014')+'</td>'
        +'<td style="text-align:right;font-weight:700;color:var(--red);">'+fmtRs(e.amount)+'</td>'
        +'<td><div class="btn-group"><button onclick="DayBook.printVoucher(\''+e.id+'\')" class="btn btn-xs btn-primary" title="Print Voucher">\ud83d\udda8\ufe0f</button><button onclick="DayBook.edit(\''+e.id+'\')" class="btn btn-xs btn-secondary" title="Edit">\u270f\ufe0f</button><button onclick="DayBook.del(\''+e.id+'\')" class="btn btn-xs btn-danger" title="Delete">\ud83d\uddd1</button></div></td></tr>';
    }).join('');
  }
};



