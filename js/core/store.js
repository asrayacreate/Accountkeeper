// ─── STORE: localStorage wrapper ─────────────────────────────
var STORE = {
  get: function(k, def) {
    try { var v=localStorage.getItem(k); return v!==null?JSON.parse(v):def; } catch(e){ return def||null; }
  },
  set: function(k, v) {
    try { localStorage.setItem(k,JSON.stringify(v)); return true; } catch(e){ return false; }
  },
  del: function(k) { try { localStorage.removeItem(k); } catch(e){} }
};

// ─── HELPER FUNCTIONS ─────────────────────────────────────────
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function fmtRs(n) { n=parseFloat(n)||0; return 'Rs. '+n.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2}); }
// Amount in words — Indian/Nepali numbering (lakh, crore). Returns e.g. "One Lakh Twenty Three Thousand Rupees Only"
function numToWords(num){
  num = Math.round(parseFloat(num)||0);
  if(num===0) return 'Zero Rupees Only';
  if(num<0) return 'Minus '+numToWords(-num);
  var ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function twoDigit(n){
    if(n<20) return ones[n];
    return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
  }
  function threeDigit(n){
    var str='';
    if(n>99){ str += ones[Math.floor(n/100)] + ' Hundred'; n=n%100; if(n) str+=' '; }
    if(n) str += twoDigit(n);
    return str;
  }
  var out='';
  var crore=Math.floor(num/10000000); num=num%10000000;
  var lakh=Math.floor(num/100000); num=num%100000;
  var thousand=Math.floor(num/1000); num=num%1000;
  var hundred=num;
  if(crore){ out += threeDigit(crore)+' Crore'; }
  if(lakh){ out += (out?' ':'') + threeDigit(lakh)+' Lakh'; }
  if(thousand){ out += (out?' ':'') + threeDigit(thousand)+' Thousand'; }
  if(hundred){ out += (out?' ':'') + threeDigit(hundred); }
  return out.trim()+' Rupees Only';
}
function fmtDisplayDate(d) { if(!d)return '—'; try{ return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }catch(e){return d;} }
function autoFiscalYear() {
  var d=new Date(); var m=d.getMonth()+1;
  var bsY=adToBs(d.getFullYear(),m,d.getDate()).y;
  return bsY+'/'+(bsY+1).toString().slice(-3);
}
function setText(id,v) { var el=document.getElementById(id); if(el)el.textContent=(v===0||v==='0')?'0':(v||''); }
function getVal(id) { var el=document.getElementById(id); return el?el.value.trim():''; }
function setVal(id,v) { var el=document.getElementById(id); if(el)el.value=v||''; }
function show(id) { var el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id) { var el=document.getElementById(id); if(el)el.style.display='none'; }
function downloadFile(name,data) {
  var a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(data);
  a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─── SHORTHAND GLOBAL HELPERS ─────────────────────────────────
function getLS(k){ return STORE.get(k, null) || null; }
function setLS(k,v){ return STORE.set(k,v); }
function todayBS(){ return todayBs(); }
function esc(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmt(n){ n=parseFloat(n)||0; return n.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2}); }
function showToast(msg,type,dur){ if(window.Notif && Notif.toast) return Notif.toast(msg,type,dur); var tc=document.getElementById('toast-container'); if(!tc)return; var t=document.createElement('div'); t.className='alert alert-'+(type||'info')+' shadow py-2 px-3'; t.style.cssText='min-width:220px;animation:fadeIn .2s'; t.textContent=msg; tc.appendChild(t); setTimeout(function(){t.remove();},dur||2800); }
function addActivity(text){ var act=STORE.get('pk3_activity',[])||[]; act.push({text:text,time:new Date().toLocaleString('en-IN')}); if(act.length>200) act=act.slice(-200); STORE.set('pk3_activity',act); }

function downloadCSV(name,data) {
  if(String(data).charAt(0)!=='\uFEFF') data='\uFEFF'+data;   // v7.3.0: BOM → Excel shows नेपाली अक्षर correctly
  var a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(data);
  a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
// v7.3.0 audit: local calendar date (not UTC). toISOString() is UTC, so in Nepal (UTC+5:45) between
// 00:00 and 05:45 it returned *yesterday*, and a BS date converted with bsToAd() (local midnight) always
// came out one day early. isoLocal(d) keeps the date the user actually sees.
function isoLocal(d) { d = d || new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO() { return isoLocal(new Date()); }
function todayBs() {
  var d=new Date();
  var b=adToBs(d.getFullYear(),d.getMonth()+1,d.getDate());
  var result=b.y+'-'+String(b.m).padStart(2,'0')+'-'+String(b.d).padStart(2,'0');
  return result;
}
function bsToDisplay(bs) { if(!bs)return ''; var p=bs.split('-'); if(p.length<3)return bs; return p[2]+'/'+p[1]+'/'+p[0]; }
function compareBs(a,b) { if(!a&&!b)return 0; if(!a)return 1; if(!b)return -1; return a.localeCompare(b); }

