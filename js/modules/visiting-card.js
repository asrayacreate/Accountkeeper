// ─── VISITING CARD MODULE ─────────────────────────────────────
var VCard = {
  _colors: [{c1:'#f97316',c2:'#ea580c'},{c1:'#8b5cf6',c2:'#7c3aed'},{c1:'#06b6d4',c2:'#0891b2'},{c1:'#22c55e',c2:'#16a34a'},{c1:'#f43f5e',c2:'#e11d48'},{c1:'#eab308',c2:'#ca8a04'}],
  _curColor: 0, _dir: '135deg',
  render: function(){
    var vc=STORE.get('pk3_vcard',{})||{};
    setVal('vc-name',vc.name||''); setVal('vc-title',vc.title||''); setVal('vc-company',vc.company||'PRERAK MULTIPURPOSE PVT LTD'); setVal('vc-phone1',vc.phone1||'9855069733'); setVal('vc-phone2',vc.phone2||''); setVal('vc-email',vc.email||''); setVal('vc-web',vc.web||''); setVal('vc-addr',vc.addr||'Hetauda-2, Makwanpur');
    // Color presets
    var colorsDiv=document.getElementById('vc-colors'); if(colorsDiv) colorsDiv.innerHTML=this._colors.map(function(c,i){return '<div onclick="VCard.setPresetColor('+i+')" class="vc-preset" style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,'+c.c1+','+c.c2+');cursor:pointer;border:2px solid '+(i===VCard._curColor?'#fff':'transparent')+'"></div>';}).join('');
    this.update();
  },
  update: function(){
    var vc={name:getVal('vc-name'),title:getVal('vc-title'),company:getVal('vc-company'),phone1:getVal('vc-phone1'),phone2:getVal('vc-phone2'),email:getVal('vc-email'),web:getVal('vc-web'),addr:getVal('vc-addr')};
    var c=this._colors[this._curColor]||this._colors[0];
    var preview=document.getElementById('vc-preview'); if(!preview)return;
    var co=STORE.get('pk3_settings',{})||{};
    var logo=co.logo||'';
    // Professional visiting card — real business-card proportions (3.5" x 2")
    preview.innerHTML='<div id="vc-card-render" style="width:350px;height:200px;border-radius:16px;background:linear-gradient('+this._dir+','+c.c1+','+c.c2+');padding:0;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,0.45);position:relative;overflow:hidden;font-family:sans-serif;">'
      // decorative circles
      +'<div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.12);pointer-events:none;"></div>'
      +'<div style="position:absolute;bottom:-50px;left:-30px;width:120px;height:120px;border-radius:50%;background:rgba(0,0,0,0.08);pointer-events:none;"></div>'
      // top band: logo + company
      +'<div style="display:flex;align-items:center;gap:10px;padding:16px 20px 0;">'
        +(logo?'<div style="width:42px;height:42px;border-radius:9px;background:#fff;padding:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><img src="'+logo+'" style="max-width:100%;max-height:100%;object-fit:contain;"></div>':'<div style="width:42px;height:42px;border-radius:9px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">🏢</div>')
        +'<div style="min-width:0;flex:1;"><div style="font-size:0.62rem;letter-spacing:2px;opacity:0.85;text-transform:uppercase;font-weight:700;line-height:1.2;">'+esc(vc.company||'COMPANY NAME')+'</div></div>'
      +'</div>'
      // name + designation
      +'<div style="padding:12px 20px 0;position:relative;z-index:1;">'
        +'<div style="font-size:1.5rem;font-weight:900;line-height:1.1;letter-spacing:0.3px;">'+esc(vc.name||'Your Name')+'</div>'
        +'<div style="font-size:0.76rem;opacity:0.9;margin-top:2px;font-weight:500;">'+esc(vc.title||'Designation')+'</div>'
      +'</div>'
      // contact footer
      +'<div style="position:absolute;bottom:0;left:0;right:0;padding:10px 20px 14px;background:rgba(0,0,0,0.15);font-size:0.68rem;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;z-index:1;">'
        +(vc.phone1?'<div style="display:flex;align-items:center;gap:4px;">📞 '+esc(vc.phone1)+'</div>':'')
        +(vc.phone2?'<div style="display:flex;align-items:center;gap:4px;">📱 '+esc(vc.phone2)+'</div>':'')
        +(vc.email?'<div style="display:flex;align-items:center;gap:4px;grid-column:1/-1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">✉️ '+esc(vc.email)+'</div>':'')
        +(vc.web?'<div style="display:flex;align-items:center;gap:4px;">🌐 '+esc(vc.web)+'</div>':'')
        +(vc.addr?'<div style="display:flex;align-items:center;gap:4px;'+(vc.web?'':'grid-column:1/-1;')+'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 '+esc(vc.addr)+'</div>':'')
      +'</div>'
    +'</div>';
  },
  setPresetColor: function(i){ this._curColor=i; this.render(); },
  setCustomColor: function(n,v){ var c=this._colors[this._curColor]; if(n===1)c.c1=v;else c.c2=v; this.update(); },
  setDirection: function(d){ this._dir=d; this.update(); },
  save: function(){ STORE.set('pk3_vcard',{name:getVal('vc-name'),title:getVal('vc-title'),company:getVal('vc-company'),phone1:getVal('vc-phone1'),phone2:getVal('vc-phone2'),email:getVal('vc-email'),web:getVal('vc-web'),addr:getVal('vc-addr')}); App.toast('✅ Saved!','success'); },
  print: function(){ window.print(); },
  shareWA: function(){
    // Pre-fill the WA modal instead of using a bare prompt
    var name=getVal('vc-name'), title=getVal('vc-title'), company=getVal('vc-company'), phone1=getVal('vc-phone1'), email=getVal('vc-email'), web=getVal('vc-web');
    var msg = '*'+(name||'')+'*'+(title?'\n'+title:'')+(company?'\n'+company:'')
      + (phone1?'\n📞 '+phone1:'') + (email?'\n✉️ '+email:'') + (web?'\n🌐 '+web:'');
    var ph = document.getElementById('vc-wa-phone'); if(ph) ph.value = '';
    var mg = document.getElementById('vc-wa-msg'); if(mg) mg.value = msg;
    var m = document.getElementById('vc-wa-modal'); if(m) m.classList.add('open');
  },
  // ═══ CANVAS CARD RENDERER (v4.2) — draws the exact card design as an image ═══
  // No html2canvas needed. Used for WhatsApp image share + PNG download.
  _drawCard: function(cb){
    var vc={name:getVal('vc-name'),title:getVal('vc-title'),company:getVal('vc-company'),phone1:getVal('vc-phone1'),phone2:getVal('vc-phone2'),email:getVal('vc-email'),web:getVal('vc-web'),addr:getVal('vc-addr')};
    var col=this._colors[this._curColor]||this._colors[0];
    var co=STORE.get('pk3_settings',{})||{};
    var W=350,H=200,S=3; // 3x scale → sharp 1050×600 image
    var canvas=document.createElement('canvas'); canvas.width=W*S; canvas.height=H*S;
    var ctx=canvas.getContext('2d'); ctx.scale(S,S);
    function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
    // Card body (rounded, clipped)
    rr(0,0,W,H,16); ctx.save(); ctx.clip();
    // Gradient from _dir angle (CSS convention: 0deg=up, clockwise)
    var ang=(parseFloat(this._dir)||135)*Math.PI/180;
    var dx=Math.sin(ang), dy=-Math.cos(ang);
    var L=Math.abs(W*dx)+Math.abs(H*dy);
    var cx0=W/2-dx*L/2, cy0=H/2-dy*L/2, cx1=W/2+dx*L/2, cy1=H/2+dy*L/2;
    var g=ctx.createLinearGradient(cx0,cy0,cx1,cy1);
    g.addColorStop(0,col.c1); g.addColorStop(1,col.c2);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // Decorative circles
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(320,30,70,0,7); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.arc(30,190,60,0,7); ctx.fill();
    // ── Footer contact band ──
    var rows=[];
    if(vc.phone1||vc.phone2) rows.push([vc.phone1?'📞 '+vc.phone1:'', vc.phone2?'📱 '+vc.phone2:'']);
    if(vc.email) rows.push(['✉️ '+vc.email, null]); // full-width
    if(vc.web||vc.addr){ if(vc.web&&vc.addr) rows.push(['🌐 '+vc.web,'📍 '+vc.addr]); else rows.push([(vc.web?'🌐 '+vc.web:'📍 '+vc.addr), null]); }
    var bandH=rows.length?(rows.length*16+22):0;
    if(bandH){ ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(0,H-bandH,W,bandH); }
    function fitText(t,maxW){ if(ctx.measureText(t).width<=maxW) return t; while(t.length>1&&ctx.measureText(t+'…').width>maxW) t=t.slice(0,-1); return t+'…'; }
    ctx.fillStyle='#fff'; ctx.font='11px sans-serif'; ctx.textBaseline='middle';
    rows.forEach(function(r,i){
      var y=H-bandH+14+i*16;
      if(r[1]===null){ ctx.fillText(fitText(r[0],W-40),20,y); }
      else { if(r[0]) ctx.fillText(fitText(r[0],150),20,y); if(r[1]) ctx.fillText(fitText(r[1],150),185,y); }
    });
    // ── Company name (top, next to logo) ──
    var compX=72, compMaxW=W-compX-18;
    ctx.font='bold 10px sans-serif';
    try{ ctx.letterSpacing='2px'; }catch(e){}
    ctx.fillStyle='rgba(255,255,255,0.92)';
    var comp=(vc.company||'COMPANY NAME').toUpperCase();
    // wrap into max 2 lines
    var words=comp.split(' '), lines=[''],li=0;
    words.forEach(function(w){ var test=(lines[li]?lines[li]+' ':'')+w; if(ctx.measureText(test).width>compMaxW&&lines[li]){ if(li<1){li++;lines.push(w);} else {lines[li]=fitText(lines[li]+' '+w,compMaxW);} } else lines[li]=test; });
    var compY=lines.length>1?26:36;
    lines.slice(0,2).forEach(function(l,i){ ctx.fillText(l,compX,compY+i*13); });
    try{ ctx.letterSpacing='0px'; }catch(e){}
    // ── Name + designation ──
    ctx.fillStyle='#fff'; ctx.textBaseline='alphabetic';
    var nm=vc.name||'Your Name'; var fs=24;
    ctx.font='900 '+fs+'px sans-serif';
    while(ctx.measureText(nm).width>W-40&&fs>14){ fs--; ctx.font='900 '+fs+'px sans-serif'; }
    ctx.fillText(nm,20,96);
    ctx.font='500 12px sans-serif'; ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillText(fitText(vc.title||'Designation',W-40),20,114);
    ctx.restore();
    // ── Logo box (drawn over everything, top-left) ──
    function drawLogoBox(img){
      ctx.save(); rr(20,14,42,42,9); ctx.clip();
      if(img){ ctx.fillStyle='#fff'; ctx.fillRect(20,14,42,42);
        var iw=img.width,ih=img.height,ratio=Math.min(36/iw,36/ih);
        var w2=iw*ratio,h2=ih*ratio;
        ctx.drawImage(img,20+(42-w2)/2,14+(42-h2)/2,w2,h2);
      } else { ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(20,14,42,42);
        ctx.font='20px sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='center';
        ctx.fillStyle='#fff'; ctx.fillText('🏢',41,36); ctx.textAlign='left';
      }
      ctx.restore();
      cb(canvas);
    }
    if(co.logo){ var im=new Image(); im.onload=function(){drawLogoBox(im);}; im.onerror=function(){drawLogoBox(null);}; im.src=co.logo; }
    else drawLogoBox(null);
  },
  confirmWA: function(){
    var phone = getVal('vc-wa-phone');
    var msg = getVal('vc-wa-msg')||'';
    var m = document.getElementById('vc-wa-modal');
    App.toast('🖼️ Card image बन्दैछ...','info',1500);
    VCard._drawCard(function(canvas){
      canvas.toBlob(function(blob){
        if(!blob){ if(Wa.send(phone,msg)&&m) m.classList.remove('open'); return; }
        var file=null;
        try{ file=new File([blob],'prerak-visiting-card.png',{type:'image/png'}); }catch(e){}
        // MOBILE: native share sheet → WhatsApp मा image सिधै जान्छ
        if(file && navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({files:[file], text:msg}).then(function(){
            App.toast('✅ Card image share भयो!','success');
            if(m) m.classList.remove('open');
          }).catch(function(){ VCard._fallbackImgShare(blob, phone, msg, m); });
        } else {
          // DESKTOP: image auto-download + WhatsApp chat खुल्छ
          VCard._fallbackImgShare(blob, phone, msg, m);
        }
      },'image/png');
    });
  },
  _fallbackImgShare: function(blob, phone, msg, m){
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='prerak-visiting-card.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },3000);
    App.toast('🖼️ Card image download भयो — WhatsApp मा 📎 photo attach गरेर पठाउनुस्','success',6000);
    if(phone) Wa.send(phone, msg, {quiet:true});
    if(m) m.classList.remove('open');
  },
  shareImage: function(){
    VCard._drawCard(function(canvas){
      canvas.toBlob(function(blob){
        var file=null;
        try{ file=new File([blob],'prerak-visiting-card.png',{type:'image/png'}); }catch(e){}
        if(file && navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({files:[file]}).catch(function(){});
        } else {
          var a=document.createElement('a'); a.download='prerak-card.png'; a.href=canvas.toDataURL('image/png'); a.click();
          App.toast('🖼️ Card PNG downloaded','success');
        }
      },'image/png');
    });
  },
  downloadImage: function(){
    VCard._drawCard(function(canvas){
      var a=document.createElement('a'); a.download='prerak-card.png'; a.href=canvas.toDataURL('image/png'); a.click();
      App.toast('⬇️ Card PNG saved','success');
    });
  },
  sendWA: function(){ this.shareWA(); },
  copyText: function(){ var t=getVal('vc-name')+'\n'+getVal('vc-title')+'\n'+getVal('vc-company')+'\n📞 '+getVal('vc-phone1'); if(navigator.clipboard)navigator.clipboard.writeText(t); App.toast('📋 Copied!','success'); }
};

