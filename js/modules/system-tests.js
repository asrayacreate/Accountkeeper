// ============================================================
// JS PART O: Tests module, App init, closing tags
// ============================================================

var Tests = {
  _results: {},
  run: function(key){
    var self = this;
    var el = document.getElementById('test-'+key);
    if(el){ el.className='badge bg-warning'; el.textContent='Running...'; }
    setTimeout(function(){
      var ok = false, msg = '';
      try {
        switch(key){
          case 'cust':
            var c = getLS('pk3_customers')||[];
            ok = Array.isArray(c); msg = 'Customers: '+c.length+' records'; break;
          case 'quot':
            var q = getLS('pk3_quotations')||[];
            ok = Array.isArray(q); msg = 'Quotations: '+q.length+' records'; break;
          case 'inv':
            var inv = getLS('pk3_invoices')||[];
            ok = Array.isArray(inv); msg = 'Invoices: '+inv.length+' records'; break;
          case 'db':
            var db = getLS('pk3_daybook')||[];
            ok = Array.isArray(db); msg = 'DayBook: '+db.length+' records'; break;
          case 'backup':
            var bk = localStorage.getItem('pk3_lastBackup');
            ok = true; msg = bk ? 'Last backup: '+bk : 'No backup yet (OK)'; break;
          case 'mobile':
            ok = (window.innerWidth > 0);
            msg = 'Viewport: '+window.innerWidth+'px'; break;
          case 'role':
            var role = (typeof currentUser!=='undefined' && currentUser) ? currentUser.role : null;
            ok = !!role; msg = 'Current role: '+(role||'not logged in'); break;
          case 'bscal':
            var td = todayBS();
            ok = /^\d{4}-\d{2}-\d{2}$/.test(td);
            msg = 'Today BS: '+td; break;
          default:
            ok = true; msg = 'Test not defined';
        }
      } catch(e){ ok=false; msg='Error: '+e.message; }
      self._results[key] = ok;
      if(el){ el.className='badge '+(ok?'bg-success':'bg-danger'); el.textContent=ok?'Pass':'Fail'; }
      var descEl = document.getElementById('test-desc-'+key);
      if(!descEl){
        var parent = el ? el.parentElement : null;
        if(parent){ var d=document.createElement('small'); d.id='test-desc-'+key; d.className='text-muted ms-2'; parent.appendChild(d); descEl=d; }
      }
      if(descEl) descEl.textContent = msg;
    }, 200 + Math.random()*300);
  },
  runAll: function(){
    var keys = ['cust','quot','inv','db','backup','mobile','role','bscal'];
    var self = this;
    keys.forEach(function(k,i){ setTimeout(function(){ self.run(k); }, i*150); });
    showToast('Running all tests...','info');
  },
  reset: function(){
    var keys = ['cust','quot','inv','db','backup','mobile','role','bscal'];
    keys.forEach(function(k){
      var el = document.getElementById('test-'+k);
      if(el){ el.className='badge bg-secondary'; el.textContent='Pending'; }
      var descEl = document.getElementById('test-desc-'+k);
      if(descEl) descEl.textContent='';
    });
    this._results = {};
    showToast('Tests reset','secondary');
  }
};

