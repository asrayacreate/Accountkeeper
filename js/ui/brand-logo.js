// ═══════════════ BRAND LOGO EVERYWHERE (v4.3) ═══════════════
// Shows the uploaded company logo in sidebar, topbar & login screen.
// Falls back to the default gradient icon when no logo is set.
var _defaultBrandSvg = {};
function applyBrandLogo(dataUrl){
  if(dataUrl === undefined){
    var s = STORE.get('pk3_settings',{}) || {};
    dataUrl = s.logo || '';
  }
  // Product (Swagatik) logos stay fixed — company logo no longer overrides app chrome.
  [].forEach(function(pair){
    var id = pair[0];
    var el = document.getElementById(id);
    if(!el) return;
    // Remember the original inner content once, so delete can restore it
    if(_defaultBrandSvg[id] === undefined) _defaultBrandSvg[id] = el.innerHTML;
    if(dataUrl){
      el.innerHTML = '<img src="'+dataUrl+'" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;background:#fff;padding:2px;box-sizing:border-box;">';
    } else {
      el.innerHTML = _defaultBrandSvg[id];
    }
  });
}

