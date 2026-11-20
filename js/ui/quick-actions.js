// ─── ADMIN DASHBOARD MODULE ───────────────────────────────────────────────
// ─── QUICK ACTIONS (drag-reorderable dashboard cards) ─────────────
var QuickActions = {
  DEFAULT: [
    {id:'settings', icon:'⚙️', title:'Company Settings', sub:'Name, phone, address', act:"App.navigate('settings')"},
    {id:'ratelist', icon:'💰', title:'Rate List', sub:'Add/edit/reset rates', act:"App.navigate('ratelist')"},
    {id:'service',  icon:'🔧', title:'Service Control', sub:'Edit service/sub-service', act:"AdminDash.openServiceEditor()"},
    {id:'templates',icon:'📝', title:'Templates', sub:'Manage message templates', act:"App.navigate('settings')"},
    {id:'backup',   icon:'💾', title:'Backup / Restore', sub:'Export & import data', act:"App.navigate('backup')"},
    {id:'audit',    icon:'📜', title:'Audit Log', sub:'User activity trail', act:"App.navigate('audit')"}
  ],
  _dragId: null,
  _order: function(){
    var saved = STORE.get('pk3_qa_order', null);
    if(!saved || !Array.isArray(saved)) return this.DEFAULT.slice();
    // Rebuild from saved id order, appending any new defaults not in saved
    var byId = {}; this.DEFAULT.forEach(function(c){ byId[c.id]=c; });
    var ordered = [];
    saved.forEach(function(id){ if(byId[id]){ ordered.push(byId[id]); delete byId[id]; } });
    Object.keys(byId).forEach(function(id){ ordered.push(byId[id]); });
    return ordered;
  },
  render: function(){
    var grid = document.getElementById('qa-grid');
    if(!grid) return;
    var cards = this._order();
    grid.innerHTML = cards.map(function(c){
      return '<div class="card card-body qa-card" draggable="true" data-qa-id="'+c.id+'" '
        +'style="cursor:pointer;text-align:center;position:relative;transition:all 0.15s;" '
        +'onclick="QuickActions._click(event,\''+c.id+'\')" '
        +'ondragstart="QuickActions._dragStart(event,\''+c.id+'\')" '
        +'ondragover="QuickActions._dragOver(event)" '
        +'ondrop="QuickActions._drop(event,\''+c.id+'\')" '
        +'ondragend="QuickActions._dragEnd(event)" '
        +'ontouchstart="QuickActions._touchStart(event,\''+c.id+'\')" '
        +'ontouchmove="QuickActions._touchMove(event)" '
        +'ontouchend="QuickActions._touchEnd(event)">'
        +'<div style="position:absolute;top:6px;right:8px;color:var(--text-dim);font-size:0.9rem;cursor:grab;" title="Drag to reorder">⣿</div>'
        +'<div style="font-size:1.8rem;margin-bottom:6px;">'+c.icon+'</div>'
        +'<div style="font-weight:700;font-size:0.85rem;">'+esc(c.title)+'</div>'
        +'<div style="font-size:0.72rem;color:var(--text-muted);">'+esc(c.sub)+'</div>'
      +'</div>';
    }).join('');
  },
  _click: function(ev, id){
    // Ignore click if we just finished dragging
    if(this._justDragged){ this._justDragged=false; return; }
    var c = this.DEFAULT.find(function(x){return x.id===id;});
    if(c && c.act){ try { eval(c.act); } catch(e){ console.warn(e); } }
  },
  _dragStart: function(ev, id){
    this._dragId = id;
    ev.dataTransfer.effectAllowed = 'move';
    var card = ev.target.closest('.qa-card'); if(card) card.style.opacity='0.4';
  },
  _dragOver: function(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='move';
    var card = ev.target.closest('.qa-card');
    if(card) card.style.outline='2px dashed var(--accent)';
  },
  _drop: function(ev, targetId){
    ev.preventDefault();
    var card = ev.target.closest('.qa-card'); if(card) card.style.outline='';
    if(!this._dragId || this._dragId===targetId) return;
    var order = this._order().map(function(c){return c.id;});
    var from = order.indexOf(this._dragId);
    var to = order.indexOf(targetId);
    if(from<0||to<0) return;
    order.splice(to, 0, order.splice(from,1)[0]);
    STORE.set('pk3_qa_order', order);
    this._justDragged = true;
    this.render();
  },
  _dragEnd: function(ev){
    document.querySelectorAll('.qa-card').forEach(function(c){ c.style.opacity=''; c.style.outline=''; });
    this._dragId = null;
  },
  // ── TOUCH support (मोबाइल/tablet मा drag गर्न) ──
  _touchId: null, _touchMoved: false, _touchStartY: 0, _touchStartX: 0,
  _touchStart: function(ev, id){
    this._touchId = id;
    this._touchMoved = false;
    var tt = ev.touches && ev.touches[0];
    if(tt){ this._touchStartX = tt.clientX; this._touchStartY = tt.clientY; }
    var card = ev.target.closest('.qa-card');
    this._touchCard = card;
    // long-ish press feel: highlight source after a tiny delay
    if(card){ card.style.opacity='0.55'; card.style.transform='scale(1.03)'; }
  },
  _touchMove: function(ev){
    if(!this._touchId) return;
    var tt = ev.touches && ev.touches[0]; if(!tt) return;
    var dx = Math.abs(tt.clientX - this._touchStartX);
    var dy = Math.abs(tt.clientY - this._touchStartY);
    // treat as drag only after finger moves enough — else let it be a tap
    if(dx < 8 && dy < 8) return;
    this._touchMoved = true;
    ev.preventDefault();   // stop page scroll while dragging a card
    // find the card under the finger
    var el = document.elementFromPoint(tt.clientX, tt.clientY);
    var over = el && el.closest ? el.closest('.qa-card') : null;
    document.querySelectorAll('.qa-card').forEach(function(c){ if(c!==over) c.style.outline=''; });
    if(over && over!==this._touchCard){ over.style.outline='2px dashed var(--accent)'; }
  },
  _touchEnd: function(ev){
    var srcId = this._touchId;
    if(this._touchCard){ this._touchCard.style.opacity=''; this._touchCard.style.transform=''; }
    document.querySelectorAll('.qa-card').forEach(function(c){ c.style.outline=''; });
    if(srcId && this._touchMoved){
      var tt = (ev.changedTouches && ev.changedTouches[0]);
      if(tt){
        var el = document.elementFromPoint(tt.clientX, tt.clientY);
        var over = el && el.closest ? el.closest('.qa-card') : null;
        var targetId = over ? over.getAttribute('data-qa-id') : null;
        if(targetId && targetId!==srcId){
          var order = this._order().map(function(c){return c.id;});
          var from = order.indexOf(srcId), to = order.indexOf(targetId);
          if(from>=0 && to>=0){
            order.splice(to, 0, order.splice(from,1)[0]);
            STORE.set('pk3_qa_order', order);
            this._justDragged = true;
            this.render();
            App.toast('✅ क्रम मिलाइयो','success',1200);
          }
        }
      }
    }
    this._touchId = null; this._touchCard = null; this._touchMoved = false;
  },
  reset: function(){
    STORE.set('pk3_qa_order', null);
    this.render();
    App.toast('↺ Quick Actions क्रम reset भयो','success',1500);
  }
};


