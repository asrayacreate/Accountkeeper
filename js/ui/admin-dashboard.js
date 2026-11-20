var AdminDash = {
  render: function() {
    if (!Auth.isAdmin()) { App.toast('\u26d4 Access denied', 'error'); App.navigate('dashboard'); return; }
    var rb = document.getElementById('sa-role-badge');
    if (rb) rb.textContent = (currentUser ? currentUser.name : '') + ' \u2014 ' + Auth.currentRole().toUpperCase();
    this.renderUsers();
    this.renderPermTable();
    this.renderTests();
    try { this.renderLicense(); } catch(e){ console.warn('License panel error', e); }
    try { this.renderBsStatus(); } catch(e){ console.warn('BS panel error', e); }
    try { QuickActions.render(); } catch(e){ console.warn('QuickActions error',e); }
  },

  // ═══════════ BS DATE REPAIR (v5.5) ═══════════
  // पुराना record मा साविकको गलत calendar table ले लेखेको BS मिति
  // AD मिति बाट फेरि गणना गरेर सच्याउने — एक पटक चलाए पुग्छ।
  // AD मिति नै असली स्रोत हो; BS केवल देखाउनको लागि हो।
  _BS_FIELDS: [
    { store: 'pk3_customers',  pairs: [['issueDate','issueDateBs'],['fuDate','fuDateBs'],['birthday','birthdayBs'],['anniv','annivBs']] },
    { store: 'pk3_quotations', pairs: [['date','dateBs']] },
    { store: 'pk3_invoices',   pairs: [['date','dateBs']] },
    { store: 'pk3_followups',  pairs: [['date','dateBs'],['nextDate','nextDateBs']] },
    { store: 'pk3_daybook',    pairs: [['date','dateBs']] },
    { store: 'pk3_estimates',  pairs: [['date','dateBs']] },
    { store: 'pk3_walkins',    pairs: [['date','dateBs']] },
    { store: 'pk3_ledger',     pairs: [['date','dateBs']] },
    { store: 'pk3_staff',      pairs: [['joinDate','joinDateBs']] }
  ],

  _bsFromAd: function (adStr) {
    if (!adStr) return null;
    var m = String(adStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    try {
      var b = adToBs(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      if (!b || !b.y) return null;
      return b.y + '-' + String(b.m).padStart(2, '0') + '-' + String(b.d).padStart(2, '0');
    } catch (e) { return null; }
  },

  // dryRun=true भए केवल गन्छ, केही बदल्दैन
  scanBsDates: function (dryRun) {
    var self = this, total = 0, wrong = 0, fixed = 0, details = [];
    this._BS_FIELDS.forEach(function (grp) {
      var list = STORE.get(grp.store, []) || [];
      if (!Array.isArray(list) || !list.length) return;
      var grpWrong = 0;
      list.forEach(function (rec) {
        if (!rec) return;
        grp.pairs.forEach(function (pr) {
          var ad = rec[pr[0]], bsOld = rec[pr[1]];
          if (!ad || !bsOld) return;
          total++;
          var bsNew = self._bsFromAd(ad);
          if (!bsNew || bsNew === bsOld) return;
          wrong++; grpWrong++;
          if (!dryRun) { rec[pr[1]] = bsNew; fixed++; }
        });
      });
      if (grpWrong) details.push({ store: grp.store, n: grpWrong });
      if (!dryRun && grpWrong) STORE.set(grp.store, list);
    });
    return { total: total, wrong: wrong, fixed: fixed, details: details };
  },

  repairBsDates: function () {
    if (!Auth.isAdmin || !Auth.isAdmin()) { App.toast('⛔ Admin मात्र', 'error'); return; }
    var scan = this.scanBsDates(true);

    if (!scan.total) { alert('ℹ️ जाँच्नुपर्ने कुनै BS मिति भेटिएन।'); return; }
    if (!scan.wrong) {
      alert('✅ सबै ठीक छ!\n\nजाँचिएका मिति: ' + scan.total + '\nसच्याउनुपर्ने: ० वटा');
      return;
    }

    var names = { pk3_customers: 'Customer', pk3_quotations: 'Quotation', pk3_invoices: 'Invoice',
                  pk3_followups: 'Follow-up', pk3_daybook: 'Day Book', pk3_estimates: 'Estimate',
                  pk3_walkins: 'Walk-in', pk3_ledger: 'Ledger', pk3_staff: 'Staff' };
    var lines = scan.details.map(function (d) { return '   • ' + (names[d.store] || d.store) + ': ' + d.n + ' वटा'; }).join('\n');

    if (!confirm('🗓️ BS मिति सच्याउने\n\n' +
        'जाँचिएका मिति: ' + scan.total + '\n' +
        'गलत भेटिएका: ' + scan.wrong + ' वटा\n\n' + lines + '\n\n' +
        '⚠️ अघि बढ्नु अघि Backup → Export गरिसक्नुभयो?\n' +
        'AD (अंग्रेजी) मिति बदलिँदैन — BS मात्र फेरि गणना हुन्छ।\n\n' +
        'सच्याउने?')) { App.toast('रद्द गरियो — केही बदलिएन', 'info'); return; }

    var res = this.scanBsDates(false);
    try { Audit.log('REPAIR', 'BS dates recalculated: ' + res.fixed + ' fields'); } catch (e) {}
    try { STORE.set('pk3_bsRepaired', new Date().toISOString()); } catch (e) {}
    alert('✅ सकियो!\n\n' + res.fixed + ' वटा BS मिति सच्याइयो।\n\nअब page reload हुन्छ।');
    setTimeout(function () { window.location.reload(); }, 600);
  },

  renderBsStatus: function () {
    var el = document.getElementById('sa-bs-status'); if (!el) return;
    var scan;
    try { scan = this.scanBsDates(true); } catch (e) { el.innerHTML = ''; return; }
    var done = STORE.get('pk3_bsRepaired', null);
    var ok = scan.wrong === 0;
    el.innerHTML =
      '<div style="background:var(--surface-2);border:1px solid ' + (ok ? 'var(--green)' : 'var(--red)') + ';border-radius:10px;padding:12px;font-size:0.8rem;">'
      + '<div style="font-weight:700;margin-bottom:4px;">' + (ok ? '✅ सबै BS मिति ठीक छन्' : '⚠️ ' + scan.wrong + ' वटा BS मिति गलत छन्') + '</div>'
      + '<div style="color:var(--text-muted);font-size:0.73rem;line-height:1.5;">जाँचिएका: ' + scan.total + ' मिति'
      + (done ? '<br>पछिल्लो पटक सच्याइएको: ' + new Date(done).toLocaleString('en-IN') : '')
      + (ok ? '' : '<br>तलको button थिचेर AD मिति बाट फेरि गणना गर्नुहोस्।') + '</div></div>';
  },

  // ═══════════ LICENSE & KEY GENERATOR (v5.3) ═══════════
  renderLicense: function () {
    // plan dropdown
    var sel = document.getElementById('kg-plan');
    if (sel && !sel.options.length) {
      License.PLANS.forEach(function (pl) {
        var o = document.createElement('option');
        o.value = pl.days; o.textContent = pl.label;
        if (pl.code === 'Y1') o.selected = true;
        sel.appendChild(o);
      });
    }

    // current license status
    var el = document.getElementById('sa-lic-status');
    if (el) {
      var s = License.status();
      if (!s.active && !s.company) {
        el.innerHTML = '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:0.8rem;color:var(--text-muted);">कुनै license save भएको छैन।</div>';
      } else {
        var planTxt = s.plan === 'MASTER' ? '👑 MASTER (Owner)' : (s.lifetime ? '♾️ Lifetime' : '📅 Time-limited');
        var expTxt = s.lifetime ? 'कहिल्यै expire हुँदैन'
          : (s.expiry ? s.expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' (' + s.daysLeft + ' दिन बाँकी)' : '—');
        var colr = s.lifetime ? 'var(--green)' : (s.daysLeft > 30 ? 'var(--green)' : (s.daysLeft > 7 ? '#f59e0b' : 'var(--red)'));
        el.innerHTML =
          '<div style="background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(249,115,22,0.06));border:1px solid ' + colr + ';border-radius:10px;padding:14px;">' +
          '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px;">सक्रिय License</div>' +
          '<div style="font-size:0.95rem;font-weight:800;margin-bottom:8px;">' + esc(s.company || '—') + '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:0.76rem;">' +
          '<div><span style="color:var(--text-muted);">Plan:</span> <b>' + planTxt + '</b></div>' +
          '<div><span style="color:var(--text-muted);">म्याद:</span> <b style="color:' + colr + ';">' + expTxt + '</b></div>' +
          '<div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Key:</span> <code style="font-size:0.72rem;">' + esc(s.key || '') + '</code></div>' +
          (s.activatedAt ? '<div style="grid-column:1/-1;color:var(--text-muted);font-size:0.7rem;">Activated: ' + new Date(s.activatedAt).toLocaleString('en-IN') + '</div>' : '') +
          '</div>' +
          (s.builtIn
            ? '<div style="margin-top:10px;padding-top:9px;border-top:1px dashed var(--border);font-size:0.72rem;color:#22c55e;line-height:1.55;">'
              + '\u2705 <b>BUILT-IN activation \u0905\u0928 \u091b</b> \u2014 \u092f\u094b file \u0915\u0939\u093f\u0932\u094d\u092f\u0948 key \u0938\u094b\u0927\u094d\u0926\u0948\u0928\u0964<br>'
              + '<span style="color:var(--text-muted);">\u092e\u094b\u092c\u093e\u0907\u0932/PC/\u0928\u092f\u093e\u0901 browser \u2014 \u091c\u0939\u093e\u0901 \u0916\u094b\u0932\u0947 \u092a\u0928\u093f \u0938\u093f\u0927\u0948 login \u0906\u0909\u091b\u0964</span>'
              + '<div style="margin-top:8px;"><button onclick="AdminDash.customerCopyGuide()" class="btn btn-xs btn-secondary">\ud83d\udcc4 \u0917\u094d\u0930\u093e\u0939\u0915 copy \u0915\u0938\u0930\u0940 \u092c\u0928\u093e\u0909\u0928\u0947?</button></div></div>'
            : '') +
          '</div>';
      }
    }
    // Generator \u2014 Super Admin \u0932\u093e\u0908 \u092e\u093e\u0924\u094d\u0930
    try {
      var isSA = (typeof Auth !== 'undefined' && Auth.isSuperAdmin && Auth.isSuperAdmin());
      var gen = document.getElementById('kg-company');
      if (gen && gen.parentNode && gen.parentNode.parentNode) {
        gen.parentNode.parentNode.style.display = isSA ? '' : 'none';
      }
    } catch (e) {}
    this.renderKeyLog();
  },

  customerCopyGuide: function () {
    alert('\ud83d\udcc4 \u0917\u094d\u0930\u093e\u0939\u0915\u0932\u093e\u0908 \u092c\u0947\u091a\u094d\u0928\u0947 copy \u092c\u0928\u093e\u0909\u0928\u0947 \u0924\u0930\u093f\u0915\u093e\n\n' +
      '1\ufe0f\u20e3  \u092f\u0938 HTML file \u0915\u094b \u090f\u0909\u091f\u093e copy \u092c\u0928\u093e\u0909\u0928\u0941\u0938\u094d\n' +
      '2\ufe0f\u20e3  Notepad \u092e\u093e \u0916\u094b\u0932\u0947\u0930  BUILT_IN  \u0916\u094b\u091c\u094d\u0928\u0941\u0938\u094d (Ctrl+F)\n' +
      '3\ufe0f\u20e3  \u0924\u094d\u092f\u094b line \u0932\u093e\u0908 \u092f\u0938\u094d\u0924\u094b \u092c\u0928\u093e\u0909\u0928\u0941\u0938\u094d \u2014\n\n' +
      "     BUILT_IN: { company: '', key: '' },\n\n" +
      '4\ufe0f\u20e3  Save \u0917\u0930\u0947\u0930 \u0917\u094d\u0930\u093e\u0939\u0915\u0932\u093e\u0908 \u092a\u0920\u093e\u0909\u0928\u0941\u0938\u094d\n' +
      '5\ufe0f\u20e3  \u092e\u093e\u0925\u093f\u0915\u094b Generator \u092c\u093e\u091f \u0909\u0938\u0915\u094b key \u092c\u0928\u093e\u090f\u0930 WhatsApp \u092e\u093e \u092a\u0920\u093e\u0909\u0928\u0941\u0938\u094d\n\n' +
      '\u26a0\ufe0f  \u092f\u094b step \u0928\u0917\u0930\u0947 \u0917\u094d\u0930\u093e\u0939\u0915\u0932\u093e\u0908 \u092b\u094d\u0930\u0940 \u092e\u093e \u091a\u0932\u094d\u091b \u2014 \u092a\u0915\u094d\u0915\u093e \u0917\u0930\u094d\u0928\u0941\u0938\u094d!');
  },

  genKey: function () {
    if (!Auth.isSuperAdmin || !Auth.isSuperAdmin()) { App.toast('⛔ Super Admin मात्र', 'error'); return; }
    var company = (document.getElementById('kg-company') || {}).value || '';
    var days = parseInt(((document.getElementById('kg-plan') || {}).value) || '0', 10) || 0;
    if (!company.trim()) { App.toast('❌ Company name हाल्नुस्', 'error'); return; }

    var g = License.generate(company, days);
    var expTxt = g.expiry ? g.expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Lifetime — कहिल्यै expire हुँदैन';

    var box = document.getElementById('kg-result');
    if (box) {
      box.style.display = 'block';
      box.innerHTML =
        '<div style="background:var(--surface);border:1.5px dashed var(--accent);border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">' + esc(g.company) + '</div>' +
        '<div id="kg-key-text" style="font-size:1.02rem;font-weight:900;letter-spacing:1.5px;color:var(--accent);word-break:break-all;margin-bottom:6px;">' + esc(g.key) + '</div>' +
        '<div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:12px;">⏳ म्याद: <b>' + esc(expTxt) + '</b></div>' +
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">' +
        '<button onclick="AdminDash.copyKey()" class="btn btn-xs btn-primary">📋 Copy</button>' +
        '<button onclick="AdminDash.shareKey()" class="btn btn-xs btn-success">💬 WhatsApp</button>' +
        '</div>' +
        '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:10px;line-height:1.5;">Customer ले Company Name ठ्याक्कै <b>' + esc(g.company) + '</b> नै टाइप गर्नुपर्छ।</div>' +
        '</div>';
    }

    // log it
    try {
      var log = STORE.get('pk3_keylog', []) || [];
      log.unshift({
        company: g.company, key: g.key,
        expiry: g.expiry ? g.expiry.toISOString() : null,
        days: days, issued: new Date().toISOString()
      });
      if (log.length > 200) log = log.slice(0, 200);
      STORE.set('pk3_keylog', log);
    } catch (e) {}

    this._lastKey = g;
    this.renderKeyLog();
    try { Audit.log('LICENSE', 'Key generated for ' + g.company + ' (' + (days ? days + ' days' : 'lifetime') + ')'); } catch (e) {}
    App.toast('✅ Key बन्यो', 'success');
  },

  copyKey: function (k) {
    var txt = k || (this._lastKey ? this._lastKey.key : '');
    if (!txt) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { App.toast('📋 Copy भयो', 'success'); });
      } else {
        var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        App.toast('📋 Copy भयो', 'success');
      }
    } catch (e) { App.toast('❌ Copy भएन', 'error'); }
  },

  shareKey: function (idx) {
    var g = this._lastKey;
    if (typeof idx === 'number') {
      var log = STORE.get('pk3_keylog', []) || [];
      var r = log[idx]; if (!r) return;
      g = { company: r.company, key: r.key, expiry: r.expiry ? new Date(r.expiry) : null };
    }
    if (!g) return;
    var expTxt = g.expiry ? g.expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Lifetime';
    var msg = '🔐 *Swagatik — License Key*\n\n' +
      '🏢 Company: *' + g.company + '*\n' +
      '🔑 Key: *' + g.key + '*\n' +
      '⏳ म्याद: *' + expTxt + '*\n\n' +
      'App खोल्दा Company Name ठ्याक्कै माथिको जस्तै टाइप गरी Key हाल्नुहोस्।\n' +
      'एक पटक हाले पछि फेरि सोध्दैन। ✅\n\n' +
      '— PRERAK MULTIPURPOSE PVT LTD 📞 9855069733';
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  },

  renderKeyLog: function () {
    var el = document.getElementById('sa-keylog'); if (!el) return;
    var log = STORE.get('pk3_keylog', []) || [];
    if (!log.length) {
      el.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);padding:8px;">अहिलेसम्म कुनै key जारी गरिएको छैन।</div>';
      return;
    }
    el.innerHTML = '';
    log.forEach(function (r, i) {
      var exp = r.expiry ? new Date(r.expiry) : null;
      var left = exp ? Math.ceil((exp - new Date()) / 86400000) : null;
      var badge = !exp ? '<span style="color:var(--green);">♾️ Lifetime</span>'
        : (left > 0 ? '<span style="color:' + (left > 30 ? 'var(--green)' : '#f59e0b') + ';">' + left + ' दिन बाँकी</span>'
                    : '<span style="color:var(--red);">⏰ Expired</span>');
      var row = document.createElement('div');
      row.style.cssText = 'background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;';
      row.innerHTML =
        '<div style="min-width:0;flex:1;">' +
        '<div style="font-size:0.8rem;font-weight:700;">' + esc(r.company) + '</div>' +
        '<div style="font-size:0.7rem;color:var(--text-muted);"><code>' + esc(r.key) + '</code> · ' + badge + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:5px;flex-shrink:0;">' +
        '<button class="btn btn-xs btn-secondary" onclick="AdminDash.copyKey(\'' + esc(r.key) + '\')">📋</button>' +
        '<button class="btn btn-xs btn-success" onclick="AdminDash.shareKey(' + i + ')">💬</button>' +
        '</div>';
      el.appendChild(row);
    });
  },

  clearKeyLog: function () {
    if (!confirm('जारी गरिएका key को record मेटाउने? (Customer का key हरू चलिरहन्छन्)')) return;
    STORE.set('pk3_keylog', []);
    this.renderKeyLog();
    App.toast('🗑 Key log खाली भयो', 'info');
  },

  renderUsers: function() {
    var el = document.getElementById('sa-users-list'); if (!el) return;
    el.innerHTML = '';
    var roleColors = {superadmin:'#a78bfa', admin:'var(--accent)', staff:'var(--green)'};
    var roleIcons  = {superadmin:'\ud83d\udee1\ufe0f', admin:'\ud83d\udc54', staff:'\ud83d\udc64'};
    USERS_CONFIG.forEach(function(u, i) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);gap:10px;flex-wrap:wrap;';
      var info = document.createElement('div');
      info.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;min-width:0;';
      var av = document.createElement('div');
      av.style.cssText = 'width:36px;height:36px;border-radius:50%;background:'+(roleColors[u.role]||'var(--accent)')+';display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;';
      av.textContent = roleIcons[u.role] || '\ud83d\udc64';
      var nd = document.createElement('div');
      nd.innerHTML = '<div style="font-weight:700;font-size:0.85rem;">'+esc(u.name)+'</div>'
        +'<div style="font-size:0.72rem;color:var(--text-muted);">@'+esc(u.user)+' \u00b7 <span style="color:'+(roleColors[u.role]||'inherit')+';">'+u.role.toUpperCase()+'</span></div>';
      info.appendChild(av); info.appendChild(nd);
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;';
      // Change role button (cycle through roles) — protect punya
      if (Auth.isSuperAdmin() && u.user !== 'punya') {
        var roles = ['staff','admin','superadmin'];
        var next = roles[(roles.indexOf(u.role)+1) % roles.length];
        var rb2 = document.createElement('button');
        rb2.className = 'btn btn-xs btn-secondary'; rb2.textContent = '\ud83d\udd04 ' + next;
        rb2.title = 'Change role to '+next;
        rb2.onclick = (function(idx,nr){ return function(){ AdminDash.changeRole(idx,nr); }; })(i, next);
        btns.appendChild(rb2);
      }
      // Edit username button
      if (Auth.isSuperAdmin() && u.user !== 'punya') {
        var eb = document.createElement('button');
        eb.className = 'btn btn-xs btn-secondary'; eb.textContent = '\u270f\ufe0f Username';
        eb.title = 'Edit username';
        eb.onclick = (function(idx){ return function(){ AdminDash.editUsername(idx); }; })(i);
        btns.appendChild(eb);
      }
      // Reset password button
      if (Auth.isSuperAdmin()) {
        var pb = document.createElement('button');
        pb.className = 'btn btn-xs btn-secondary'; pb.textContent = '\ud83d\udd11 Reset Pass';
        pb.title = 'Reset this user\'s password';
        pb.onclick = (function(idx){ return function(){ AdminDash.resetPass(idx); }; })(i);
        btns.appendChild(pb);
      }
      // Delete user button — protect punya and self
      if (Auth.isSuperAdmin() && u.user !== 'punya' && (!currentUser || u.user !== currentUser.user)) {
        var db = document.createElement('button');
        db.className = 'btn btn-xs btn-danger'; db.textContent = '\ud83d\uddd1\ufe0f';
        db.title = 'Delete user';
        db.style.background = 'var(--red)'; db.style.color = '#fff';
        db.onclick = (function(idx){ return function(){ AdminDash.deleteUser(idx); }; })(i);
        btns.appendChild(db);
      }
      row.appendChild(info); row.appendChild(btns); el.appendChild(row);
    });
  },

  renderPermTable: function() {
    var tbody = document.getElementById('sa-perm-table'); if (!tbody) return;
    var rows = [
      ['Manage Users & Roles',        true, false, false],
      ['Company Settings',             true, false, false],
      ['Rate Add / Edit / Reset',      true, false, false],
      ['Service / Sub-service Edit',   true, false, false],
      ['Template Add / Edit / Reset',  true, false, false],
      ['Backup & Restore',             true, true,  false],
      ['Clear All Data',               true, false, false],
      ['Delete Any Record',            true, false, false],
      ['Add / Edit Customer',          true, true,  true],
      ['Quotation / Invoice',          true, true,  false],
      ['Follow-up / DayBook',          true, true,  true],
      ['Walk-in Greeting / WA Msg',    true, true,  true],
      ['View Rate List',               true, true,  true],
      ['View Audit Log',               true, true,  false],
    ];
    tbody.innerHTML = rows.map(function(r){
      function c(v){ return '<td style="text-align:center;padding:7px 8px;border-bottom:1px solid var(--border);">'+(v?'<span style="color:var(--green);font-weight:700;">\u2713</span>':'<span style="color:var(--red);opacity:.5;">\u2717</span>')+'</td>'; }
      return '<tr><td style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:0.78rem;">'+esc(r[0])+'</td>'+c(r[1])+c(r[2])+c(r[3])+'</tr>';
    }).join('');
  },

  renderTests: function() {
    var el = document.getElementById('sa-tests'); if (!el) return;
    var tests = [
      {label:'Customer Data',  fn:function(){ var d=STORE.get('pk3_customers',[])||[]; return {ok:Array.isArray(d),msg:d.length+' records'}; }},
      {label:'Rate List',      fn:function(){ var d=STORE.get('pk3_rates',null); var ok=d&&Object.keys(d).length>0; return {ok:ok,msg:ok?Object.keys(d).length+' categories':'Empty'}; }},
      {label:'Templates',      fn:function(){ var d=STORE.get('pk3_templates',null); var ok=d&&d.length>0; return {ok:ok,msg:ok?d.length+' templates':'Using default'}; }},
      {label:'User Config',    fn:function(){ return {ok:USERS_CONFIG.length>0,msg:USERS_CONFIG.length+' users'}; }},
      {label:'Auth & Role',    fn:function(){ return {ok:!!currentUser,msg:currentUser?currentUser.name+' ('+currentUser.role+')':'Not logged in'}; }},
      {label:'BS Calendar',    fn:function(){ var t=todayBs(); return {ok:/^\d{4}-\d{2}-\d{2}$/.test(t),msg:'Today: '+t}; }},
      {label:'localStorage',   fn:function(){ try{localStorage.setItem('_t','1');localStorage.removeItem('_t');return {ok:true,msg:'Available'};}catch(e){return {ok:false,msg:'Blocked'};} }},
    ];
    el.innerHTML = '';
    tests.forEach(function(t){
      var res; try{ res=t.fn(); }catch(e){ res={ok:false,msg:'Error: '+e.message}; }
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);border-radius:8px;border-left:3px solid '+(res.ok?'var(--green)':'var(--red)')+';';
      row.innerHTML='<span style="font-size:1rem;">'+(res.ok?'\u2705':'\u274c')+'</span>'
        +'<div><div style="font-size:0.82rem;font-weight:600;">'+esc(t.label)+'</div>'
        +'<div style="font-size:0.72rem;color:var(--text-muted);">'+esc(res.msg)+'</div></div>';
      el.appendChild(row);
    });
  },

  runTests: function() { this.renderTests(); App.toast('\u2705 Tests complete','success'); },

  // ── Helper: re-confirm Super Admin password before any destructive action ──
  _dangerConfirm: function(actionName, callback){
    if (!Auth.isSuperAdmin()) { App.toast('\u26d4 Super Admin \u092e\u093e\u0924\u094d\u0930','error'); return; }
    var pw = prompt('🔒 '+actionName+'\n\nपुष्टि गर्न Super Admin password टाइप गर्नुस्:');
    if(pw === null) return; // user pressed Cancel
    var _ph = _pwHash(pw);
    var ok = USERS_CONFIG.some(function(u){ return u.role==='superadmin' && u.passHash===_ph; });
    if(!ok){
      App.toast('गलत Super Admin Password','error',3000);
      try { Audit.log('SECURITY','Failed danger-zone confirm: '+actionName+' by '+(currentUser?currentUser.user:'?')); } catch(e){}
      return;
    }
    try { Audit.log('SECURITY','Danger-zone confirmed: '+actionName+' by '+(currentUser?currentUser.user:'?')); } catch(e){}
    callback();
  },

  changeRole: function(idx, newRole) {
    if (!Auth.isSuperAdmin()) { App.toast('\u26d4 Super Admin \u092e\u093e\u0924\u094d\u0930','error'); return; }
    if(USERS_CONFIG[idx].user === 'punya'){ App.toast('🛡️ Master superadmin lock — role change disabled','warning'); return; }
    if (!confirm('Change role of @'+USERS_CONFIG[idx].user+' to '+newRole+'?')) return;
    USERS_CONFIG[idx].role = newRole;
    try { Audit.log('USERS','Role changed: '+USERS_CONFIG[idx].user+' → '+newRole); } catch(e){}
    App.toast('\u2705 Role updated: '+newRole,'success');
    this.renderUsers();
  },

  resetPass: function(idx) {
    if (!Auth.isSuperAdmin()) return;
    var p = prompt('🔒 New password for @'+USERS_CONFIG[idx].user+':');
    if (!p) return;
    if (p.length < 4) { App.toast('Password too short (min 4 chars)','error'); return; }
    USERS_CONFIG[idx].passHash = _pwHash(p);
    try { Audit.log('USERS','Password reset for: '+USERS_CONFIG[idx].user); } catch(e){}
    App.toast('\u2705 Password updated for @'+USERS_CONFIG[idx].user,'success');
  },

  editUsername: function(idx) {
    if (!Auth.isSuperAdmin()) return;
    var u = USERS_CONFIG[idx];
    if(u.user === 'punya'){ App.toast('🛡️ Master superadmin username locked','warning'); return; }
    var newUser = prompt('Edit username for "'+u.name+'":', u.user);
    if(!newUser || newUser.trim()==='') return;
    newUser = newUser.trim();
    if(newUser === u.user) return;
    if(USERS_CONFIG.some(function(x,i){ return i!==idx && x.user===newUser; })){
      App.toast('❌ Username already exists','error'); return;
    }
    var oldUser = u.user;
    u.user = newUser;
    // If renaming the currently logged-in user, sync session
    if(currentUser && currentUser.user === oldUser){ currentUser.user = newUser; }
    try { Audit.log('USERS','Username changed: '+oldUser+' → '+newUser); } catch(e){}
    App.toast('\u2705 Username updated: @'+newUser,'success');
    this.renderUsers();
  },

  deleteUser: function(idx) {
    if (!Auth.isSuperAdmin()) return;
    var u = USERS_CONFIG[idx];
    if(u.user === 'punya'){ App.toast('🛡️ Master superadmin cannot be deleted','error'); return; }
    if(currentUser && u.user === currentUser.user){ App.toast('⚠️ आफ्नै account मेटाउन सकिन्न','error'); return; }
    AdminDash._dangerConfirm('Delete user @'+u.user, function(){
      USERS_CONFIG.splice(idx, 1);
      try { Audit.log('USERS','Deleted user: '+u.user+' ('+u.name+')'); } catch(e){}
      App.toast('🗑️ User deleted: @'+u.user,'success');
      AdminDash.renderUsers();
    });
  },

  openAddUser: function() {
    if (!Auth.isSuperAdmin()) { App.toast('\u26d4 Super Admin \u092e\u093e\u0924\u094d\u0930 user add \u0917\u0930\u094d\u0928 \u0938\u0915\u094d\u091b\u0964','error'); return; }
    var un=prompt('Username:'); if(!un)return;
    un = un.trim();
    if(USERS_CONFIG.find(function(u){return u.user===un;})){App.toast('Username exists','error');return;}
    var pw=prompt('Password (min 4 chars):'); if(!pw||pw.length<4){App.toast('Password too short','error');return;}
    var nm=prompt('Display Name:'); if(!nm)return;
    var rl=prompt('Role (staff/admin/superadmin):','staff')||'staff';
    if(['staff','admin','superadmin'].indexOf(rl)<0) rl='staff';
    USERS_CONFIG.push({user:un,passHash:_pwHash(pw),name:nm,role:rl});
    try { Audit.log('USERS','Added user: '+un+' ('+rl+')'); } catch(e){}
    App.toast('\u2705 User added: '+nm,'success');
    this.renderUsers();
  },

  openServiceEditor: function() {
    if (!Auth.can('service_edit') && !Auth.isSuperAdmin()) { App.toast('\u26d4 Super Admin \u092e\u093e\u0924\u094d\u0930','error'); return; }
    App.navigate('settings'); App.toast('Settings \u092e\u093e service manage \u0917\u0930\u094d\u0928\u0941\u0939\u094b\u0938\u094d','info');
  },

  // ── Danger Zone — all wrapped with password re-confirm ──
  clearAudit: function() {
    AdminDash._dangerConfirm('Clear ALL Audit Logs', function(){
      STORE.set('pk3_audit',[]);
      App.toast('\ud83d\uddd1\ufe0f Audit cleared','success');
    });
  },

  resetTemplates: function() {
    AdminDash._dangerConfirm('Reset ALL Message Templates to default', function(){
      STORE.set('pk3_templates', DEFAULT_TEMPLATES);
      App.toast('\u2705 Templates reset to default','success');
    });
  },

  resetRates: function() {
    AdminDash._dangerConfirm('Reset Rate List to default', function(){
      RateList.resetDefaults(true);
      App.toast('\u2705 Rates reset to default','success');
    });
  },

  clearAllData: function() {
    AdminDash._dangerConfirm('CLEAR ALL BUSINESS DATA (cannot be undone!)', function(){
      var c = prompt('Type YES (uppercase) to confirm permanent data deletion:');
      if(c !== 'YES'){ App.toast('Cancelled — nothing was deleted','info'); return; }
      // Complete business-data key list (v6.0.6 — fixed drift; settings/license NOT touched here)
      ['pk3_customers','pk3_quotations','pk3_followups','pk3_daybook','pk3_invoices',
       'pk3_staff','pk3_stock','pk3_walkins','pk3_estimates','pk3_activity','pk3_audit',
       'pk3_sales','pk3_tracker','pk3_bulkFolders','pk3_ledger','pk3_notif','pk3_planner',
       'pk3_brochures','pk3_rates','pk3_stockHistory','pk3_templates','pk3_vcard','pk3_returns','pk3_projects'
      ].forEach(function(k){STORE.set(k,[]);});
      App.toast('\ud83d\udca5 All business data cleared','error',5000);
      App.navigate('dashboard');
    });
  },

  // Prepare a clean copy for a NEW paying customer (v6.0.6)
  //   Clears: all business data + company/settings + license storage.
  //   Keeps: Prerak publisher/footer/support branding (in file, not storage).
  prepareForCustomer: function() {
    AdminDash._dangerConfirm('PREPARE COPY FOR NEW CUSTOMER \u2014 wipes ALL data, settings & activation', function(){
      var c = prompt('This makes a BLANK copy for a new customer.\n\nType NEW (uppercase) to confirm \u2014 all current data, company settings and license will be erased:');
      if(c !== 'NEW'){ App.toast('Cancelled \u2014 nothing was erased','info'); return; }
      var dataKeys = ['pk3_customers','pk3_quotations','pk3_followups','pk3_daybook','pk3_invoices',
        'pk3_staff','pk3_stock','pk3_walkins','pk3_estimates','pk3_activity','pk3_audit',
        'pk3_sales','pk3_tracker','pk3_bulkFolders','pk3_ledger','pk3_notif','pk3_planner',
        'pk3_brochures','pk3_rates','pk3_stockHistory','pk3_templates','pk3_vcard','pk3_returns','pk3_projects','pk3_pay_qr','pk3_doc_terms'];
      dataKeys.forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
      ['pk3_settings','pk3_company','pk3_qa_order','pk3_showWelcome','pk3_skipWelcome','pk3_cashbook_opening','pk3_sample_seeded'].forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
      try { License._wipe(); } catch(e){}
      App.toast('\ud83c\udd95 Blank customer copy ready \u2014 reloading to license screen...','success',4000);
      setTimeout(function(){ window.location.reload(); }, 1200);
    });
  }
};

// Version check console message
console.log('%cSwagatik v'+APP_VERSION+' — LIVE', 'color:#f97316;font-weight:bold;font-size:16px');
console.log('Company: PRERAK MULTIPURPOSE PVT LTD, Hetauda-2, Makwanpur');
console.log('Build: 2083 BS | Role-based access | Offline single-file');
try { var _ls = License.status(); console.log('License:', _ls.active ? (_ls.company + ' — ' + (_ls.lifetime ? 'Lifetime' : _ls.daysLeft + ' days left')) : 'not activated'); } catch(e){}

