// PWA manifest link: real ./manifest.json over http(s); inline data-URL when opened as file://
(function(){
  // Build the manifest in JS so the whole app stays in one .html file.
  window.manifest = {
    name: 'Swagatik — Smart Business CRM',
    short_name: 'Swagatik',
    description: 'Swagatik — smart offline business CRM',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    orientation: 'any',
    background_color: '#07070f',
    theme_color: '#f97316',
    lang: 'ne',
    icons: [
      // Inline orange-house SVG icon (no external image needed)
      { src: "data:image/svg+xml;utf8," + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">'
          +'<rect width="192" height="192" rx="32" fill="#f97316"/>'
          +'<path d="M48 96l48-48 48 48v48a8 8 0 01-8 8H56a8 8 0 01-8-8z" fill="#fff"/>'
          +'<polyline points="80,152 80,108 112,108 112,152" fill="none" stroke="#f97316" stroke-width="6"/>'
          +'</svg>'),
        sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' }
    ]
  };
  var blob = 'data:application/manifest+json;charset=utf-8,' +
             encodeURIComponent(JSON.stringify(window.manifest));
  if (location.protocol==='http:'||location.protocol==='https:') { document.getElementById('pk-manifest').setAttribute('href','./manifest.json'); }
  else { document.getElementById('pk-manifest').setAttribute('href', blob); }
})();
