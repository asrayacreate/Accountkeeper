var SampleData = {

  // demo हटाएर साँचो record मात्र फर्काउने — dashboard/report ले count गर्न यही प्रयोग गर्छ
  real: function (arr) {
    if (!arr || !arr.length) return arr || [];
    return arr.filter(function (r) { return !r || !r._demo; });
  },

  // कुनै demo record छ?
  hasDemo: function () {
    var c = STORE.get('pk3_customers', []) || [];
    var q = STORE.get('pk3_quotations', []) || [];
    return c.some(function (r) { return r && r._demo; }) || q.some(function (r) { return r && r._demo; });
  },

  // कुनै साँचो (गैर-demo) data छ? — sample load block गर्न प्रयोग
  hasReal: function () {
    var keys = ['pk3_customers', 'pk3_quotations', 'pk3_invoices', 'pk3_estimates'];
    for (var i = 0; i < keys.length; i++) {
      var list = STORE.get(keys[i], []) || [];
      if (list.some(function (r) { return r && !r._demo; })) return true;
    }
    return false;
  },

  _sampleCustomers: function () {
    var t = (typeof todayISO === 'function') ? todayISO() : '';
    return [
      { id: 'demo_c1', _demo: true, name: 'राम बहादुर श्रेष्ठ', phone: '9812345678',
        address: 'हेटौडा-4, मकवानपुर', services: [{ work: 'UPVC', subwork: 'UPVC Windows' }],
        work: 'UPVC', subwork: 'UPVC Windows', notes: 'Sample customer — delete गर्न मिल्छ',
        advance: 5000, total: 45000, created: t, updated: t },
      { id: 'demo_c2', _demo: true, name: 'सीता देवी पौडेल', phone: '9843210987',
        address: 'हेटौडा-10, मकवानपुर', services: [{ work: 'Aluminium', subwork: 'Aluminium Partition' }],
        work: 'Aluminium', subwork: 'Aluminium Partition', notes: 'Sample customer',
        advance: 10000, total: 78000, created: t, updated: t },
      { id: 'demo_c3', _demo: true, name: 'हरि प्रसाद खनाल', phone: '9856789012',
        address: 'भरतपुर-5, चितवन', services: [{ work: 'Glass', subwork: 'Glass Railing' }],
        work: 'Glass', subwork: 'Glass Railing', notes: 'Sample customer',
        advance: 0, total: 32000, created: t, updated: t }
    ];
  },

  _sampleQuotations: function () {
    var t = (typeof todayISO === 'function') ? todayISO() : '';
    var tb = (typeof todayBs === 'function') ? todayBs() : '';
    return [
      { id: 'demo_q1', _demo: true, custId: 'demo_c1', custName: 'राम बहादुर श्रेष्ठ', custPhone: '9812345678',
        work: 'UPVC', subwork: 'UPVC Windows', status: 'Pending', details: 'Sample quotation',
        items: [{ name: 'UPVC Sliding Window', qty: 4, rate: 8500, amount: 34000 },
                { name: 'Installation', qty: 1, rate: 3000, amount: 3000 }],
        discount: 0, tax: 13, advance: 5000, amount: 41810, date: t, dateBs: tb },
      { id: 'demo_q2', _demo: true, custId: 'demo_c2', custName: 'सीता देवी पौडेल', custPhone: '9843210987',
        work: 'Aluminium', subwork: 'Aluminium Partition', status: 'Approved', details: 'Sample quotation',
        items: [{ name: 'Aluminium Partition (sq.ft)', qty: 120, rate: 550, amount: 66000 }],
        discount: 2000, tax: 13, advance: 10000, amount: 72320, date: t, dateBs: tb }
    ];
  },

  // Sample data load — साँचो data भए block
  load: function (silent) {
    if (this.hasReal()) {
      if (!silent) App.toast('⚠️ पहिले नै data छ — sample load गर्न मिल्दैन। खाली install मा मात्र।', 'error', 4000);
      return false;
    }
    if (this.hasDemo()) {
      if (!silent) App.toast('ℹ️ Sample data पहिल्यै छ।', 'info', 3000);
      return false;
    }
    try {
      var c = STORE.get('pk3_customers', []) || [];
      var q = STORE.get('pk3_quotations', []) || [];
      STORE.set('pk3_customers', this._sampleCustomers().concat(c));
      STORE.set('pk3_quotations', this._sampleQuotations().concat(q));
      try { Audit.log('SAMPLE', 'Sample data loaded'); } catch (e) {}
      if (!silent) {
        App.toast('✅ Sample data थपियो — DEMO badge भएका record delete गर्न मिल्छ', 'success', 4000);
        try { App.navigate('customers'); } catch (e) {}
      }
      return true;
    } catch (e) { console.error('sample load', e); return false; }
  },

  // एक-click हटाउने — केवल _demo record, साँचो data कहिल्यै छुँदैन
  remove: function (silent) {
    try {
      var keys = ['pk3_customers', 'pk3_quotations', 'pk3_invoices', 'pk3_estimates'];
      var removed = 0;
      keys.forEach(function (k) {
        var list = STORE.get(k, []) || [];
        var kept = list.filter(function (r) { return !r || !r._demo; });
        removed += (list.length - kept.length);
        STORE.set(k, kept);
      });
      try { Audit.log('SAMPLE', 'Sample data removed (' + removed + ' records)'); } catch (e) {}
      if (!silent) {
        App.toast(removed ? ('🗑️ ' + removed + ' sample record हटाइयो') : 'कुनै sample data थिएन', removed ? 'success' : 'info', 3000);
        try { App.navigate('dashboard'); } catch (e) {}
      }
      return removed;
    } catch (e) { console.error('sample remove', e); return 0; }
  },

  // पहिलो activation पछि एक पटक auto-seed (खाली install मा मात्र)
  maybeAutoSeed: function () {
    try {
      if (localStorage.getItem('pk3_sample_seeded') === '1') return;   // एक पटक मात्र
      if (this.hasReal() || this.hasDemo()) { localStorage.setItem('pk3_sample_seeded', '1'); return; }
      this.load(true);                          // silent seed
      localStorage.setItem('pk3_sample_seeded', '1');
    } catch (e) {}
  }
};

