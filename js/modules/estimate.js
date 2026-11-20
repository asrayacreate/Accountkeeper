// ─── ESTIMATE (PRO) MODULE ────────────────────────────────────
var Estimate = {
  _rows: [],
  init: function(){
    this._rows=[]; this.renderRows(); this.calc();
    var next='EST-'+String(STORE.get('pk3_estimates',[]).length+1).padStart(3,'0');
    setVal('est-no',next);
    // Default tax to 13% VAT
    var taxEl=document.getElementById('est-tax'); if(taxEl && !taxEl.value) taxEl.value='13';
    var custs=Customers.getData(); var dl=document.getElementById('est-cust-datalist'); if(dl) dl.innerHTML=custs.map(function(c){return '<option value="'+esc(c.name)+'">';}).join('');
    // When customer name matches, auto-fill phone/address/title from their record
    var nameInp=document.getElementById('est-cust-name');
    if(nameInp && !nameInp._autoBound){
      nameInp._autoBound = true;
      nameInp.addEventListener('change', function(){
        var c=Customers.getData().find(function(x){return x.name===nameInp.value;});
        if(c){
          if(!getVal('est-cust-phone')) setVal('est-cust-phone', c.phone||'');
          if(!getVal('est-cust-address')) setVal('est-cust-address', c.address||'');
          if(!getVal('est-title')){
            Customers.pickService(c, function(svc){
              if(svc && svc.work && !getVal('est-title')) setVal('est-title', svc.work);
            });
          }
        }
      });
    }
  },
  addRow: function(){ this._rows.push({name:'',qty:1,unit:'sqft',rate:0,amount:0}); this.renderRows(); },
  renderRows: function(){
    var tb=document.getElementById('est-rows'); if(!tb)return;
    tb.innerHTML=this._rows.map(function(r,i){
      return '<tr><td style="text-align:center;">'+(i+1)+'</td>'+
      '<td><input type="text" value="'+(r.name||'')+'" oninput="Estimate._rows['+i+'].name=this.value" placeholder="Description" style="width:100%;min-width:100px;"></td>'+
      '<td><input type="number" value="'+(r.qty||1)+'" oninput="Estimate._rows['+i+'].qty=parseFloat(this.value)||0;Estimate.calc();" style="width:60px;text-align:right;"></td>'+
      '<td><input type="text" value="'+(r.unit||'sqft')+'" oninput="Estimate._rows['+i+'].unit=this.value" style="width:55px;text-align:center;"></td>'+
      '<td><input type="number" value="'+(r.rate||0)+'" oninput="Estimate._rows['+i+'].rate=parseFloat(this.value)||0;Estimate.calc();" style="width:85px;text-align:right;"></td>'+
      '<td style="text-align:right;font-weight:700;" id="est-amt-'+i+'">'+fmtRs((r.qty||0)*(r.rate||0))+'</td>'+
      '<td><button onclick="Estimate._rows.splice('+i+',1);Estimate.renderRows();Estimate.calc();" class="btn btn-icon btn-sm btn-danger">✕</button></td></tr>';
    }).join('');
  },
  calc: function(){
    var sub=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0);
    var disc=parseFloat(getVal('est-disc'))||0, tax=parseFloat(getVal('est-tax'))||0, adv=parseFloat(getVal('est-advance'))||0;
    var afterDisc = sub - disc;
    var taxAmt = afterDisc * (tax/100);
    var total = afterDisc + taxAmt;
    // Update each row's amount cell live (रकम)
    this._rows.forEach(function(r,i){ var el=document.getElementById('est-amt-'+i); if(el) el.textContent=fmtRs((r.qty||0)*(r.rate||0)); });
    setText('est-sub',fmtRs(sub));
    // Show discount as % of subtotal
    var discPct=document.getElementById('est-disc-pct');
    if(discPct) discPct.textContent = (sub>0 && disc>0) ? '('+((disc/sub)*100).toFixed(1).replace(/\.0$/,'')+'%)' : '';
    // Show tax amount in rupees next to the total area
    var taxLabel=document.getElementById('est-tax-amt'); if(taxLabel) taxLabel.textContent='('+fmtRs(taxAmt)+')';
    setText('est-total',fmtRs(total));
    setText('est-balance',fmtRs(total-adv));
  },
  loadFromRateList: function(){ RateList._pickTarget='estimate'; RateList._pickedItems=[]; RateList.renderPickModal(''); document.getElementById('rate-pick-modal').classList.add('open'); },
  save: function(){
    var name=getVal('est-cust-name'); if(!name){App.toast('Customer name चाहिन्छ!','error');return;}
    var sub=this._rows.reduce(function(s,r){return s+(r.qty||0)*(r.rate||0);},0);
    var disc=parseFloat(getVal('est-disc'))||0, tax=parseFloat(getVal('est-tax'))||0, adv=parseFloat(getVal('est-advance'))||0;
    var afterDisc=sub-disc; var taxAmt=afterDisc*(tax/100); var total=afterDisc+taxAmt;
    var rec={id:uid(),custName:name,phone:getVal('est-cust-phone'),addr:getVal('est-cust-address'),title:getVal('est-title'),estNo:getVal('est-no'),date:getVal('est-date')||todayISO(),dateBs:getVal('est-date-bs')||todayBs(),validity:getVal('est-validity')||'15 days',items:this._rows,disc:disc,tax:tax,taxAmt:taxAmt,advance:adv,total:total,terms:getVal('est-terms'),status:'Draft',type:'professional'};
    var list=STORE.get('pk3_estimates',[]); list.unshift(rec); STORE.set('pk3_estimates',list);
    try{ Audit.log('ESTIMATE','Created: '+name+' Rs.'+total); }catch(e){}
    App.toast('✅ Estimate saved!','success'); App.navigate('estimates-list');
  },
  preview: function(){ Bakauta._rows=this._rows; Bakauta.preview(); },
  clear: function(){ this._rows=[]; this.renderRows(); this.calc(); setVal('est-cust-name',''); setVal('est-cust-phone',''); setVal('est-cust-address',''); setVal('est-title',''); setVal('est-disc','0'); setVal('est-tax','13'); setVal('est-advance','0'); setVal('est-terms',''); this.calc(); },
  toQuotation: function(){ Bakauta._rows=this._rows; Bakauta.toQuotation(); }
};

