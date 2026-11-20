// ═══════════════ DASHBOARD INSIGHT CHARTS (v7.1.0) ═══════════════
// पूर्ण offline, कुनै बाहिरी library बिना — आफ्नै SVG।
//   1) पछिल्लो ६ (बि.सं.) महिनाको बिक्री (Sales) vs खर्च (Expense) बार चार्ट + नाफा/घाटा
//   2) लिनुपर्ने (Receivables) vs तिर्नुपर्ने (Payables) सारांश कार्ड
//   3) सबैभन्दा बढी कमाइ भएका Top 5 Services / Items
//
// हिसाब कसरी (दोहोरो नगनियोस् भनेर):
//   बिक्री = Invoice को Grand Total (Cancelled/demo बाहेक, Sales Return घटाएर)
//          + Day Book 'income' entry जुन Advance होइन (Invoice बिनाको नगद बिक्री)
//   खर्च  = Day Book 'expense'/'payment' (Supplier/मिस्त्री भुक्तानीको auto entry बाहेक)
//          + Supplier/मिस्त्री बिल (Payables 'bill')  → बिल आएकै महिनामा खर्च
//   लिनुपर्ने = हरेक ग्राहकको बाँकी (SmartRem.dueFor: Invoice बाँकी + Ledger) जोड
//   तिर्नुपर्ने = हरेक Supplier/मिस्त्रीको बाँकी (Payables.balance) जोड
// Pure compute functions (DashCharts.monthly / dues / topItems) — tests ले सिधै जाँच्छन्।
var DashCharts = {
  MONTHS: 6,
  _topRange: 'months',   // 'months' (पछिल्लो ६ महिना) | 'all'

  _num: function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; },
  _real: function (arr) { return (arr || []).filter(function (r) { return r && !r._demo; }); },
  _isCancelled: function (inv) {
    if (!inv) return true;
    try { if (typeof Invoices !== 'undefined' && typeof Invoices.isCancelled === 'function' && Invoices.isCancelled(inv)) return true; } catch (e) {}
    if (inv.cancelled === true || inv._cancelled === true) return true;
    return String(inv.status || '').toLowerCase() === 'cancelled';
  },

  /** 'YYYY-MM' BS month key from a record. AD date first (most reliable), then dateBs. */
  monthKey: function (rec, adField, bsField) {
    var ad = String(rec[adField || 'date'] || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ad)) {
      try {
        var p = ad.split('-'), b = adToBs(+p[0], +p[1], +p[2]);
        if (b && b.y > 1990 && b.y < 2200) return b.y + '-' + String(b.m).padStart(2, '0');
      } catch (e) {}
    }
    var bs = String(rec[bsField || 'dateBs'] || '');
    if (/^\d{4}-\d{2}/.test(bs)) return bs.slice(0, 7);
    return '';
  },

  /** Last n BS month keys ending with the current month, oldest first. */
  lastMonths: function (n, todayBsStr) {
    var t = String(todayBsStr || todayBs()).split('-'), y = +t[0], m = +t[1], out = [];
    for (var i = 0; i < n; i++) {
      out.unshift(y + '-' + String(m).padStart(2, '0'));
      m--; if (m < 1) { m = 12; y--; }
    }
    return out;
  },

  /** [{key, label, sales, expense, net}] for the last n BS months. */
  monthly: function (n, todayBsStr) {
    var self = this, keys = this.lastMonths(n || this.MONTHS, todayBsStr), map = {};
    keys.forEach(function (k) { map[k] = { key: k, sales: 0, expense: 0 }; });
    function add(k, field, amt) { if (map[k]) map[k][field] += amt; }

    this._real(STORE.get('pk3_invoices', [])).forEach(function (i) {
      if (self._isCancelled(i)) return;
      var amt = self._num(i.amount != null && i.amount !== '' ? i.amount : i.total);
      if (i._returned) amt -= self._num(i._returnedAmt);
      add(self.monthKey(i), 'sales', amt);
    });
    this._real(STORE.get('pk3_daybook', [])).forEach(function (d) {
      var k = self.monthKey(d), a = self._num(d.amount);
      if (d.type === 'income' && d.cat !== 'Advance') add(k, 'sales', a);
      else if ((d.type === 'expense' || d.type === 'payment') && !d._payable) add(k, 'expense', a);
    });
    this._real(STORE.get('pk3_payable_txns', [])).forEach(function (t) {
      if (t.type === 'bill') add(self.monthKey(t), 'expense', self._num(t.amount));
    });
    return keys.map(function (k) {
      var r = map[k], mm = +k.slice(5, 7);
      r.sales = Math.round(r.sales * 100) / 100;
      r.expense = Math.round(r.expense * 100) / 100;
      r.net = Math.round((r.sales - r.expense) * 100) / 100;
      r.label = (typeof bsMonthName === 'function' ? bsMonthName(mm) : k).slice(0, 3);
      r.fullLabel = (typeof bsMonthName === 'function' ? bsMonthName(mm) : '') + ' ' + k.slice(0, 4);
      return r;
    });
  },

  /** {receivable, recvCount, advanceHeld, payable, payCount} */
  dues: function () {
    var out = { receivable: 0, recvCount: 0, advanceHeld: 0, payable: 0, payCount: 0 };
    try {
      this._real(STORE.get('pk3_customers', [])).forEach(function (c) {
        if (!c.id) return;
        var d = SmartRem.dueFor(c.id).total;
        if (d > 0.5) { out.receivable += d; out.recvCount++; }
        else if (d < -0.5) out.advanceHeld += -d;
      });
    } catch (e) {}
    try {
      Payables.parties().forEach(function (p) {
        var b = Payables.balance(p.id).due;
        if (b > 0.5) { out.payable += b; out.payCount++; }
      });
    } catch (e) {}
    ['receivable', 'advanceHeld', 'payable'].forEach(function (k) { out[k] = Math.round(out[k] * 100) / 100; });
    return out;
  },

  /** Top n items/services by earned amount. range: 'months' | 'all'. Falls back to approved quotations. */
  topItems: function (n, range, todayBsStr) {
    var self = this, keys = range === 'all' ? null : this.lastMonths(this.MONTHS, todayBsStr), agg = {}, source = 'invoice';
    function inRange(rec) { return !keys || keys.indexOf(self.monthKey(rec)) !== -1; }
    function addItems(list) {
      list.forEach(function (doc) {
        (doc.items || []).forEach(function (it) {
          var name = String(it.name || it.desc || it.description || '').trim();
          if (!name) return;
          var amt = self._num(it.amount != null ? it.amount : self._num(it.qty) * self._num(it.rate));
          if (amt <= 0) return;
          var k = name.toLowerCase();
          if (!agg[k]) agg[k] = { name: name, amount: 0, qty: 0, count: 0 };
          agg[k].amount += amt; agg[k].qty += self._num(it.qty); agg[k].count++;
        });
      });
    }
    addItems(this._real(STORE.get('pk3_invoices', [])).filter(function (i) { return !self._isCancelled(i) && inRange(i); }));
    if (!Object.keys(agg).length) {
      source = 'quotation';
      addItems(this._real(STORE.get('pk3_quotations', [])).filter(function (q) {
        var s = String(q.status || '').toLowerCase();
        return (s === 'approved' || s === 'completed') && inRange(q);
      }));
    }
    var list = Object.keys(agg).map(function (k) { agg[k].amount = Math.round(agg[k].amount * 100) / 100; return agg[k]; })
      .sort(function (a, b) { return b.amount - a.amount; }).slice(0, n || 5);
    return { items: list, source: list.length ? source : '' };
  },

  /** Short Nepali-style amount: 1.2K, 3.5L (लाख), 1.1Cr (करोड) */
  short: function (v) {
    var a = Math.abs(v), s = v < 0 ? '-' : '';
    function f(x) { return (Math.round(x * 10) / 10).toString(); }
    if (a >= 1e7) return s + f(a / 1e7) + 'Cr';
    if (a >= 1e5) return s + f(a / 1e5) + 'L';
    if (a >= 1e3) return s + f(a / 1e3) + 'K';
    return s + Math.round(a);
  },

  // ───────────────────────── RENDER ─────────────────────────
  render: function () {
    var box = document.getElementById('dash-insights');
    if (!box) return;
    try {
      box.innerHTML =
        '<div class="ins-grid">'
        + '<div class="card ins-card ins-wide"><div class="card-head"><span>📈 बिक्री vs खर्च (पछिल्लो ६ महिना)</span></div><div class="card-body" id="ins-cash"></div></div>'
        + '<div class="card ins-card"><div class="card-head"><span>⚖️ लिनुपर्ने vs तिर्नुपर्ने</span></div><div class="card-body" id="ins-dues"></div></div>'
        + '<div class="card ins-card"><div class="card-head"><span>🏆 Top 5 Services / Items</span>'
        + '<span class="ins-seg"><button type="button" data-r="months" onclick="DashCharts.setTopRange(\'months\')">६ महिना</button><button type="button" data-r="all" onclick="DashCharts.setTopRange(\'all\')">सबै</button></span>'
        + '</div><div class="card-body" id="ins-top"></div></div>'
        + '</div>';
      this.renderCash(); this.renderDues(); this.renderTop();
    } catch (e) { console.warn('DashCharts', e); }
  },

  renderCash: function () {
    var el = document.getElementById('ins-cash'); if (!el) return;
    var rows = this.monthly(this.MONTHS), self = this;
    var totS = 0, totE = 0; rows.forEach(function (r) { totS += r.sales; totE += r.expense; });
    var net = totS - totE;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.sales, r.expense); }).concat([1]));
    // "nice" axis max
    var mag = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / mag) * mag;
    if (nice / 2 >= max) nice = nice / 2;
    // viewBox follows the card width so labels stay readable on phones
    var W = Math.max(300, Math.min(900, el.clientWidth || 600)), H = 230, L = 46, R = 8, T = 10, B = 44, pw = W - L - R, ph = H - T - B;
    var gw = pw / rows.length, bw = Math.min(26, gw * 0.3), gap = 2;
    var svg = '<svg class="ins-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="६ महिनाको बिक्री र खर्च">';
    for (var g = 0; g <= 4; g++) {
      var gy = T + ph - ph * g / 4;
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" class="ins-grid-line"/>'
        + '<text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end" class="ins-axis">' + this.short(nice * g / 4) + '</text>';
    }
    function bar(x, v, cls) {
      var h = Math.max(v > 0 ? 2 : 0, ph * v / nice), y = T + ph - h, r = Math.min(4, h / 2, bw / 2);
      if (h <= 0) return '';
      // rounded top only, anchored to baseline
      return '<path class="' + cls + '" d="M' + x + ',' + (T + ph) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y
        + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) + 'V' + (T + ph) + 'Z"/>';
    }
    rows.forEach(function (r, i) {
      var cx = L + gw * i + gw / 2, x1 = cx - bw - gap / 2, x2 = cx + gap / 2;
      svg += '<g class="ins-col" data-i="' + i + '" onclick="DashCharts.showMonth(' + i + ')">'
        + '<rect x="' + (L + gw * i) + '" y="' + T + '" width="' + gw + '" height="' + (ph + B) + '" class="ins-hit"/>'
        + bar(x1, r.sales, 'ins-bar-s') + bar(x2, r.expense, 'ins-bar-e')
        + '<title>' + r.fullLabel + '\nबिक्री: ' + fmtRs(r.sales) + '\nखर्च: ' + fmtRs(r.expense) + '\n' + (r.net >= 0 ? 'नाफा: ' : 'घाटा: ') + fmtRs(Math.abs(r.net)) + '</title>'
        + '<text x="' + cx + '" y="' + (T + ph + 16) + '" text-anchor="middle" class="ins-axis ins-mlabel">' + esc(r.label) + '</text>'
        + '<text x="' + cx + '" y="' + (T + ph + 32) + '" text-anchor="middle" class="ins-net ' + (r.net >= 0 ? 'pos' : 'neg') + '">'
        + (r.sales || r.expense ? (r.net >= 0 ? '+' : '−') + self.short(Math.abs(r.net)) : '') + '</text>'
        + '</g>';
    });
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" class="ins-base"/></svg>';
    this._rows = rows;
    var empty = !totS && !totE;
    el.innerHTML = '<div class="ins-legend"><span><i class="sw s"></i>बिक्री (Sales)</span><span><i class="sw e"></i>खर्च (Expense)</span>'
      + '<span class="ins-muted">तलको अंक = नाफा/घाटा</span></div>'
      + svg
      + (empty ? '<div class="ins-empty">Invoice वा Day Book मा entry थपेपछि चार्ट देखिन्छ</div>' : '')
      + '<div class="ins-month" id="ins-month-detail"></div>'
      + '<div class="ins-tot">'
      + '<div><small>६ महिना बिक्री</small><b class="t-s">' + fmtRs(totS) + '</b></div>'
      + '<div><small>६ महिना खर्च</small><b class="t-e">' + fmtRs(totE) + '</b></div>'
      + '<div><small>' + (net >= 0 ? 'खुद नाफा' : 'खुद घाटा') + '</small><b class="' + (net >= 0 ? 't-s' : 't-e') + '">' + fmtRs(Math.abs(net)) + '</b></div>'
      + '</div>';
  },

  /** Tap on a month (mobile has no hover) → detail line */
  showMonth: function (i) {
    var r = (this._rows || [])[i], el = document.getElementById('ins-month-detail');
    if (!r || !el) return;
    document.querySelectorAll('#ins-cash .ins-col').forEach(function (g) { g.classList.toggle('on', +g.getAttribute('data-i') === i); });
    el.innerHTML = '<b>' + esc(r.fullLabel) + '</b> · बिक्री <span class="t-s">' + fmtRs(r.sales) + '</span> · खर्च <span class="t-e">' + fmtRs(r.expense) + '</span> · '
      + (r.net >= 0 ? 'नाफा <span class="t-s">' : 'घाटा <span class="t-e">') + fmtRs(Math.abs(r.net)) + '</span>';
  },

  renderDues: function () {
    var el = document.getElementById('ins-dues'); if (!el) return;
    var d = this.dues(), tot = d.receivable + d.payable, pr = tot > 0 ? Math.round(d.receivable / tot * 100) : 50;
    var net = d.receivable - d.payable;
    var payOn = true; try { payOn = Modules.isOn('payables'); } catch (e) {}
    el.innerHTML = '<div class="ins-dues">'
      + '<div class="ins-due r" onclick="App.navigate(\'ledger\')"><small>📥 लिनुपर्ने (Receivables)</small><b>' + fmtRs(d.receivable) + '</b><span>' + d.recvCount + ' ग्राहकबाट</span></div>'
      + '<div class="ins-due p"' + (payOn ? ' onclick="App.navigate(\'payables\')"' : '') + '><small>📤 तिर्नुपर्ने (Payables)</small><b>' + fmtRs(d.payable) + '</b><span>' + d.payCount + ' Supplier/मिस्त्रीलाई</span></div>'
      + '</div>'
      + (tot > 0 ? '<div class="ins-split" title="लिनुपर्ने ' + pr + '% · तिर्नुपर्ने ' + (100 - pr) + '%"><i class="r" style="width:' + pr + '%"></i><i class="p" style="width:' + (100 - pr) + '%"></i></div>' : '')
      + '<div class="ins-dnet">खुद स्थिति: <b class="' + (net >= 0 ? 't-s' : 't-e') + '">' + (net >= 0 ? '+' : '−') + fmtRs(Math.abs(net)) + '</b>'
      + ' <span class="ins-muted">(' + (net >= 0 ? 'बजारबाट बढी लिनु छ' : 'बढी तिर्नु छ') + ')</span></div>'
      + (d.advanceHeld > 0 ? '<div class="ins-muted" style="margin-top:4px;">💵 ग्राहकको अग्रिम (Advance) जम्मा: ' + fmtRs(d.advanceHeld) + '</div>' : '');
  },

  setTopRange: function (r) { this._topRange = r === 'all' ? 'all' : 'months'; this.renderTop(); },

  renderTop: function () {
    var el = document.getElementById('ins-top'); if (!el) return;
    var range = this._topRange, res = this.topItems(5, range);
    document.querySelectorAll('#dash-insights .ins-seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-r') === range); });
    if (!res.items.length) { el.innerHTML = '<div class="ins-empty">Invoice मा item थपेपछि यहाँ Top 5 देखिन्छ</div>'; return; }
    var max = res.items[0].amount || 1;
    el.innerHTML = res.items.map(function (it, i) {
      var pct = Math.max(2, Math.round(it.amount / max * 100));
      return '<div class="ins-top-row"><div class="ins-top-lbl"><span><b>' + (i + 1) + '.</b> ' + esc(it.name) + '</span><b>' + fmtRs(it.amount) + '</b></div>'
        + '<div class="ins-top-bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('')
      + (res.source === 'quotation' ? '<div class="ins-muted" style="margin-top:6px;">ℹ️ Invoice नभएकाले Approved Quotation बाट</div>' : '');
  }
};
