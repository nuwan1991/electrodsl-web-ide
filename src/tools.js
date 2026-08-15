// ─── ElectroDSL Interactive Tools v4 ─────────────────────────────────────────
window.ElectroTools = (function () {

  const PIN_SNAP = 18;
  const WIRE_HIT = 10;

  let _tool='select', _ast=null, _maxY=10, _svg=null, _root=null;
  let _onCodeChange=null, _getCode=null, _onToolChange=null, _onWireSelect=null;
  let _drag=null, _selectedId=null;
  let _wire=null, _wireSegEls=[], _wirePreview=null;
  let _hoveredPin=null, _highlightEls=[], _pinOverlayEls=[];
  let _wireHoverEl=null;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(svgEl, rootEl, getCodeFn, onCodeChangeFn, onToolChangeFn, onWireSelectFn) {
    _svg=svgEl; _root=rootEl; _getCode=getCodeFn;
    _onCodeChange=onCodeChangeFn; _onToolChange=onToolChangeFn;
    _onWireSelect=onWireSelectFn;
    _svg.addEventListener('mousedown',  onMouseDown);
    _svg.addEventListener('mousemove',  onMouseMove);
    _svg.addEventListener('mouseup',    onMouseUp);
    _svg.addEventListener('mouseleave', onMouseLeave);
    _svg.addEventListener('dblclick',   onDblClick);
    document.addEventListener('keydown', onKey);
  }

  function setAST(ast, maxY) { _ast=ast; _maxY=maxY; }
  function setTool(name) {
    _tool=name; cancelWire(); clearAllHighlights();
    ElectroGrid.hideSnapCursor(); updateCursor();
    if (_onToolChange) _onToolChange(name);
  }
  function getTool() { return _tool; }

  // ── Coordinate helpers ────────────────────────────────────────────────────
  function svgPoint(e) {
    const inner = document.getElementById('canvas-inner');
    const mat   = new DOMMatrix(window.getComputedStyle(inner).transform);
    const rect  = _svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - mat.e) / (mat.a || 1),
      y: (e.clientY - rect.top  - mat.f) / (mat.a || 1),
    };
  }

  function snapToGrid(sx, sy) { return ElectroGrid.snap(sx, sy); }

  function pinSVG(comp, pinName) {
    const off = ElectroSymbols.resolvePinOffset(comp.type, pinName, comp.rotate||0);
    return {
      x: ElectroGrid.PAD + comp.x * ElectroGrid.GRID + off.x,
      y: ElectroGrid.PAD + (_maxY - comp.y) * ElectroGrid.GRID + off.y,
    };
  }

  function svgToGrid(sx, sy) {
    return {
      x: (sx - ElectroGrid.PAD) / ElectroGrid.GRID,
      y: _maxY - (sy - ElectroGrid.PAD) / ElectroGrid.GRID,
    };
  }

  // ── Pin detection ─────────────────────────────────────────────────────────
  function findNearestPin(sx, sy, excludeCompId) {
    if (!_ast) return null;
    let best=null, bestDist=Infinity;
    Object.values(_ast.components).forEach(comp => {
      if (comp.id === excludeCompId) return;
      ElectroSymbols.getPins(comp.type).forEach(pin => {
        const p = pinSVG(comp, pin.name);
        const d = Math.hypot(p.x-sx, p.y-sy);
        if (d < PIN_SNAP && d < bestDist) { bestDist=d; best={compId:comp.id,pinName:pin.name,wx:p.x,wy:p.y}; }
      });
    });
    return best;
  }

  function allPins() {
    if (!_ast) return [];
    const r=[];
    Object.values(_ast.components).forEach(comp =>
      ElectroSymbols.getPins(comp.type).forEach(pin => {
        const p=pinSVG(comp,pin.name);
        r.push({compId:comp.id,pinName:pin.name,wx:p.x,wy:p.y});
      }));
    return r;
  }

  // ── Wire detection — checks ALL segments of a multi-point route ───────────
  function findNearestWire(sx, sy) {
    if (!_ast) return null;
    let best=null, bestDist=Infinity;
    _ast.wires.forEach((w, idx) => {
      const ca=_ast.components[w.from], cb=_ast.components[w.to];
      if (!ca||!cb) return;
      const A=pinSVG(ca, w.fromPin), B=pinSVG(cb, w.toPin);
      // Build the actual rendered points for this wire
      let pts;
      if (w.route && w.route.length>0) {
        pts = [A,
          ...w.route.map(p=>({x:ElectroGrid.PAD+p.x*ElectroGrid.GRID, y:ElectroGrid.PAD+(_maxY-p.y)*ElectroGrid.GRID})),
          B];
      } else {
        // Auto L-route knee point
        const knee={x:A.x, y:B.y};
        pts=[A, knee, B];
      }
      // Check every segment
      for (let i=0; i<pts.length-1; i++) {
        const {dist,px,py}=pointToSegment(sx,sy,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y);
        if (dist<WIRE_HIT && dist<bestDist) {
          bestDist=dist; best={wireIndex:idx, wire:w, px, py};
        }
      }
    });
    return best;
  }

  function pointToSegment(px,py,x1,y1,x2,y2) {
    const dx=x2-x1, dy=y2-y1, lenSq=dx*dx+dy*dy;
    if (lenSq===0) return {dist:Math.hypot(px-x1,py-y1),px:x1,py:y1};
    const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/lenSq));
    const nx=x1+t*dx, ny=y1+t*dy;
    return {dist:Math.hypot(px-nx,py-ny),px:nx,py:ny};
  }

  function findCompAt(e) {
    for (const el of document.elementsFromPoint(e.clientX,e.clientY)) {
      const g=el.closest('.component-group');
      if (g&&g.dataset.id) return g.dataset.id;
    }
    return null;
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (e.button!==0) return;
    const pt=svgPoint(e), compId=findCompAt(e);

    if (_tool==='select') {
      if (compId) { startDrag(e,compId); e.stopPropagation(); return; }
      // Click on wire → highlight DSL line
      const hit=findNearestWire(pt.x,pt.y);
      if (hit && _onWireSelect) _onWireSelect(hit.wire);
      return;
    }
    if (_tool==='rotate') { if (compId) rotateComponent(compId); return; }
    if (_tool==='delete') { if (compId) deleteComponent(compId); return; }

    if (_tool==='delete-wire') {
      const hit=findNearestWire(pt.x,pt.y);
      if (hit) deleteWire(hit.wireIndex);
      return;
    }

    if (_tool==='wire') {
      const pin=findNearestPin(pt.x,pt.y,null);
      if (!_wire) { if (pin) startWire(pin); return; }
      if (pin) {
        if (!(pin.compId===_wire.fromId && pin.pinName===_wire.fromPin)) finishWire(pin);
      } else {
        addWaypoint(pt);
      }
      return;
    }

    if (_tool==='join') {
      const hit=findNearestWire(pt.x,pt.y);
      if (hit) joinWireAt(hit);
      return;
    }
  }

  function onMouseMove(e) {
    const pt=svgPoint(e);
    if (_drag) { doDrag(e,pt); return; }

    if (_tool==='wire') {
      ElectroGrid.showSnapCursor(pt.x,pt.y);
      renderPinOverlay(pt);
      if (_wire) { updateWirePreview(pt); highlightHoverPin(findNearestPin(pt.x,pt.y,_wire.fromId),pt); }
      else        { highlightHoverPin(findNearestPin(pt.x,pt.y,null),pt); }
    } else {
      ElectroGrid.hideSnapCursor();
    }
    if (_tool==='delete-wire'||_tool==='join') highlightNearestWire(pt);
  }

  function onMouseUp(e) { if (_drag) endDrag(e); }
  function onMouseLeave() { if (_drag) endDrag(null); clearAllHighlights(); ElectroGrid.hideSnapCursor(); }

  function onDblClick(e) {
    if (_tool==='select') { const c=findCompAt(e); if (c) rotateComponent(c); }
    if (_tool==='wire' && _wire) cancelWire();
  }

  function onKey(e) {
    if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if (e.key==='Escape') { if (_wire) { cancelWire(); return; } setTool('select'); return; }
    if (e.key==='v'||e.key==='V') { setTool('select'); return; }
    if (e.key==='w'||e.key==='W') { setTool('wire'); return; }
    if (e.key==='r'||e.key==='R') {
      if (_tool==='select'&&_selectedId) { rotateComponent(_selectedId); return; }
      setTool('rotate'); return;
    }
    if (e.key==='e'||e.key==='E') { setTool('delete-wire'); return; }
    if (e.key==='j'||e.key==='J') { setTool('join'); return; }
    if (e.key==='d'||e.key==='D') { setTool('delete'); return; }
    if (e.key==='Delete'||e.key==='Backspace') {
      if (_tool==='select'&&_selectedId) { deleteComponent(_selectedId); return; }
      if (_tool==='wire'&&_wire) { cancelWire(); return; }
    }
  }

  // ── Drag/Move ─────────────────────────────────────────────────────────────
  function startDrag(e,compId) {
    if (!_ast?.components[compId]) return;
    const comp=_ast.components[compId], pt=svgPoint(e);
    _selectedId=compId;
    _drag={id:compId,origX:comp.x,origY:comp.y,startSvgX:pt.x,startSvgY:pt.y,moved:false,liveX:comp.x,liveY:comp.y};
    _root.querySelector(`[data-id="${compId}"]`)?.classList.add('dragging-comp');
    _svg.style.cursor='grabbing';
  }

  function doDrag(e,pt) {
    if (!_drag||!_ast) return;
    const G=ElectroGrid.GRID, P=ElectroGrid.PAD;
    const raw={x:pt.x-_drag.startSvgX+P+_drag.origX*G, y:pt.y-_drag.startSvgY+P+(_maxY-_drag.origY)*G};
    const snapped=snapToGrid(raw.x,raw.y);
    const newX=Math.max(0,Math.round((snapped.x-P)/G));
    const newY=Math.max(0,Math.round(_maxY-(snapped.y-P)/G));
    if (newX===_drag.liveX&&newY===_drag.liveY) return;
    _drag.liveX=newX; _drag.liveY=newY; _drag.moved=true;
    const el=_root.querySelector(`[data-id="${_drag.id}"]`);
    if (el) el.setAttribute('transform',`translate(${P+newX*G},${P+(_maxY-newY)*G})`);
    redrawWiresLive(_drag.id,newX,newY);
    e.stopPropagation();
  }

  function endDrag() {
    if (!_drag) return;
    _root.querySelector(`[data-id="${_drag.id}"]`)?.classList.remove('dragging-comp');
    if (_drag.moved) updateCompPosition(_drag.id,_drag.liveX,_drag.liveY);
    _drag=null; _svg.style.cursor=getCursorForTool(_tool);
  }

  function redrawWiresLive(movedId,nx,ny) {
    const layer=document.getElementById('wire-layer');
    if (!layer||!_ast) return;
    layer.innerHTML='';
    const tmp={..._ast.components,[movedId]:{..._ast.components[movedId],x:nx,y:ny}};
    _ast.wires.forEach(w=>{
      const ca=tmp[w.from],cb=tmp[w.to];
      if (!ca||!cb) return;
      const oA=ElectroSymbols.resolvePinOffset(ca.type,w.fromPin,ca.rotate||0);
      const oB=ElectroSymbols.resolvePinOffset(cb.type,w.toPin,cb.rotate||0);
      const G=ElectroGrid.GRID,P=ElectroGrid.PAD;
      const A={x:P+ca.x*G+oA.x,y:P+(_maxY-ca.y)*G+oA.y};
      const B={x:P+cb.x*G+oB.x,y:P+(_maxY-cb.y)*G+oB.y};
      const p=makeSVGPath();
      let d;
      if (w.route&&w.route.length>0) {
        d=multiSegPath([A,...w.route.map(r=>({x:P+r.x*G,y:P+(_maxY-r.y)*G})),B]);
      } else {
        d=orthoPath(A.x,A.y,B.x,B.y);
      }
      p.setAttribute('d',d); p.setAttribute('class','schematic-wire');
      layer.appendChild(p);
    });
  }

  // ── Wire draw ─────────────────────────────────────────────────────────────
  function startWire(pin) {
    clearAllHighlights();
    _wire={fromId:pin.compId,fromPin:pin.pinName,startX:pin.wx,startY:pin.wy,lastX:pin.wx,lastY:pin.wy,waypoints:[]};
    addHighlight(pin.wx,pin.wy,'pin-hl-start');
    _wirePreview=makeSVGPath();
    _wirePreview.setAttribute('class','wire-preview');
    _root.appendChild(_wirePreview);
  }

  // Each waypoint stores BOTH the click point AND the knee it creates,
  // so the route faithfully records every orthogonal segment
  function addWaypoint(pt) {
    if (!_wire) return;
    const snap=snapToGrid(pt.x,pt.y);
    const last=_wire.waypoints[_wire.waypoints.length-1];
    if (last&&Math.abs(last.snapX-snap.x)<3&&Math.abs(last.snapY-snap.y)<3) return;

    // The committed segment from lastX,lastY → snap is an ortho L-path.
    // Store the knee point EXPLICITLY so finishWire can save it.
    const lx=_wire.lastX, ly=_wire.lastY;
    const dx=Math.abs(snap.x-lx), dy=Math.abs(snap.y-ly);
    const hasKnee=dx>2&&dy>2;
    const kneeX=lx, kneeY=snap.y; // vertical-first knee

    // Draw committed segment visually
    const seg=makeSVGPath();
    seg.setAttribute('class','wire-preview committed');
    seg.setAttribute('d',orthoPath(lx,ly,snap.x,snap.y));
    _root.appendChild(seg); _wireSegEls.push(seg);
    addHighlight(snap.x,snap.y,'pin-hl-bend');

    // Push waypoint data: includes knee if needed
    _wire.waypoints.push({
      snapX:snap.x, snapY:snap.y,
      kneeX: hasKnee ? kneeX : null,
      kneeY: hasKnee ? kneeY : null,
    });
    _wire.lastX=snap.x; _wire.lastY=snap.y;
  }

  function updateWirePreview(pt) {
    if (!_wire||!_wirePreview) return;
    const nearPin=findNearestPin(pt.x,pt.y,_wire.fromId);
    const snap=ElectroGrid.snap(pt.x,pt.y);
    const endX=nearPin?nearPin.wx:snap.x, endY=nearPin?nearPin.wy:snap.y;

    // Full path: start → all waypoints (with their knees) → ortho to cursor
    let d=`M${f(_wire.startX)},${f(_wire.startY)}`;
    let cx=_wire.startX, cy=_wire.startY;
    _wire.waypoints.forEach(wp=>{
      if (wp.kneeX!==null) { d+=` L${f(wp.kneeX)},${f(wp.kneeY)}`; }
      d+=` L${f(wp.snapX)},${f(wp.snapY)}`;
      cx=wp.snapX; cy=wp.snapY;
    });
    // Final ortho segment to cursor
    const dx=Math.abs(endX-cx), dy2=Math.abs(endY-cy);
    if (dx<2||dy2<2) d+=` L${f(endX)},${f(endY)}`;
    else             d+=` L${f(cx)},${f(endY)} L${f(endX)},${f(endY)}`;

    _wirePreview.setAttribute('d',d);
  }

  function finishWire(targetPin) {
    if (!_wire) return;
    if (targetPin.compId===_wire.fromId&&targetPin.pinName===_wire.fromPin) { cancelWire(); return; }

    // Collect ALL intermediate points in order: knees + snap points + final knee
    const routePts=[];
    _wire.waypoints.forEach(wp=>{
      if (wp.kneeX!==null) routePts.push({x:wp.kneeX,y:wp.kneeY});
      routePts.push({x:wp.snapX,y:wp.snapY});
    });
    // Final knee from lastX,lastY → targetPin
    const lx=_wire.lastX,ly=_wire.lastY,tx=targetPin.wx,ty=targetPin.wy;
    if (Math.abs(tx-lx)>2&&Math.abs(ty-ly)>2) routePts.push({x:lx,y:ty});

    let wireLine=`wire ${_wire.fromId}.${_wire.fromPin} -> ${targetPin.compId}.${targetPin.pinName}`;
    if (routePts.length>0) {
      const rStr=routePts.map(p=>{
        const gx=((p.x-ElectroGrid.PAD)/ElectroGrid.GRID).toFixed(3);
        const gy=(_maxY-(p.y-ElectroGrid.PAD)/ElectroGrid.GRID).toFixed(3);
        return `${gx},${gy}`;
      }).join(';');
      wireLine+=` route="${rStr}"`;
    }
    cancelWire();
    _onCodeChange(appendWireLine(_getCode(),wireLine),true);
  }

  function cancelWire() {
    if (_wirePreview) { _wirePreview.remove(); _wirePreview=null; }
    _wireSegEls.forEach(s=>s.remove()); _wireSegEls=[];
    _wire=null; clearAllHighlights();
  }

  // ── Delete wire — flexible matching including route= attribute ────────────
  function deleteWire(wireIndex) {
    if (!_ast||wireIndex<0||wireIndex>=_ast.wires.length) return;
    const w=_ast.wires[wireIndex];
    const lines=_getCode().split('\n');
    let removed=false;
    const filtered=lines.filter(line=>{
      if (removed) return true;
      const t=line.trim();
      if (!t.startsWith('wire ')) return true;
      // Match by checking FROM and TO component IDs and pins in the line
      // Use regex so route= and other attributes don't break matching
      const m=t.match(/^wire\s+([\w]+)\.([\w+\-]+)\s*->\s*([\w]+)\.([\w+\-]+)/);
      if (!m) return true;
      const [,fId,fPin,tId,tPin]=m;
      const fwdMatch=(fId===w.from&&fPin===w.fromPin&&tId===w.to&&tPin===w.toPin);
      const revMatch=(fId===w.to&&fPin===w.toPin&&tId===w.from&&tPin===w.fromPin);
      if (fwdMatch||revMatch) { removed=true; return false; }
      return true;
    });
    _onCodeChange(filtered.join('\n'),true);
  }

  // ── Join wire — flexible matching ─────────────────────────────────────────
  function joinWireAt(hit) {
    if (!_ast) return;
    const w=hit.wire;
    const ca=_ast.components[w.from], cb=_ast.components[w.to];
    if (!ca||!cb) return;

    const gp=svgToGrid(hit.px,hit.py);
    const snapGx=Math.round(gp.x), snapGy=Math.round(gp.y);
    const code=_getCode();
    const nid=uniqueNodeId(code,'J');

    // Remove original wire line by matching FROM.pin -> TO.pin
    const lines=code.split('\n');
    let removed=false;
    const filtered=lines.filter(line=>{
      if (removed) return true;
      const t=line.trim();
      if (!t.startsWith('wire ')) return true;
      const m=t.match(/^wire\s+([\w]+)\.([\w+\-]+)\s*->\s*([\w]+)\.([\w+\-]+)/);
      if (!m) return true;
      const [,fId,fPin,tId,tPin]=m;
      if (fId===w.from&&fPin===w.fromPin&&tId===w.to&&tPin===w.toPin) { removed=true; return false; }
      return true;
    });

    let newCode=filtered.join('\n');
    const closeIdx=newCode.lastIndexOf('}');
    newCode=newCode.substring(0,closeIdx)+`\n  ${nid}: Node at (${snapGx}, ${snapGy}) label="${nid}"\n`+newCode.substring(closeIdx);
    newCode=appendWireLine(newCode,`wire ${w.from}.${w.fromPin} -> ${nid}.1`);
    newCode=appendWireLine(newCode,`wire ${nid}.1 -> ${w.to}.${w.toPin}`);
    _onCodeChange(newCode,true);
  }

  // ── Highlights ────────────────────────────────────────────────────────────
  let _pinOverlayEls2=[];
  function renderPinOverlay(mousePt) {
    _pinOverlayEls.forEach(e=>e.remove()); _pinOverlayEls=[];
    if (_tool!=='wire') return;
    allPins().forEach(p=>{
      if (_wire&&p.compId===_wire.fromId) return;
      const dist=Math.hypot(p.wx-mousePt.x,p.wy-mousePt.y);
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',p.wx); c.setAttribute('cy',p.wy);
      c.setAttribute('r',dist<PIN_SNAP?'8':'4');
      c.setAttribute('class',dist<PIN_SNAP?'pin-overlay-snap':'pin-overlay');
      c.style.pointerEvents='none';
      _root.appendChild(c); _pinOverlayEls.push(c);
    });
  }

  function highlightHoverPin(pin,mousePt) {
    _highlightEls=_highlightEls.filter(el=>{ if(el.dataset.hlType==='hover'){el.remove();return false;} return true; });
    if (!pin) return;
    const c=addHighlight(pin.wx,pin.wy,'pin-hl-hover'); c.dataset.hlType='hover';
  }

  function highlightNearestWire(pt) {
    if (_wireHoverEl) { _wireHoverEl.remove(); _wireHoverEl=null; }
    const hit=findNearestWire(pt.x,pt.y);
    if (!hit) return;
    const ca=_ast.components[hit.wire.from], cb=_ast.components[hit.wire.to];
    if (!ca||!cb) return;
    const A=pinSVG(ca,hit.wire.fromPin), B=pinSVG(cb,hit.wire.toPin);
    const p=makeSVGPath();
    let d;
    if (hit.wire.route&&hit.wire.route.length>0) {
      d=multiSegPath([A,...hit.wire.route.map(r=>({x:ElectroGrid.PAD+r.x*ElectroGrid.GRID,y:ElectroGrid.PAD+(_maxY-r.y)*ElectroGrid.GRID})),B]);
    } else {
      d=orthoPath(A.x,A.y,B.x,B.y);
    }
    p.setAttribute('d',d);
    p.setAttribute('class',_tool==='join'?'wire-hl-join':'wire-hl-delete');
    p.style.pointerEvents='none';
    _root.appendChild(p); _wireHoverEl=p;
  }

  function addHighlight(wx,wy,cls) {
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',wx); c.setAttribute('cy',wy); c.setAttribute('r','7');
    c.setAttribute('class','pin-highlight '+cls); c.style.pointerEvents='none';
    _root.appendChild(c); _highlightEls.push(c); return c;
  }

  function clearAllHighlights() {
    _highlightEls.forEach(e=>e.remove()); _highlightEls=[];
    _pinOverlayEls.forEach(e=>e.remove()); _pinOverlayEls=[];
    if (_wireHoverEl) { _wireHoverEl.remove(); _wireHoverEl=null; }
    _hoveredPin=null;
  }

  // ── DSL mutations ─────────────────────────────────────────────────────────
  function updateCompPosition(id,nx,ny) {
    const code=_getCode();
    const upd=code.replace(new RegExp(`(^\\s*${id}\\s*:[^\\n]+)at\\s*\\([^)]+\\)`,'m'),`$1at (${nx}, ${ny})`);
    if (upd!==code) _onCodeChange(upd,false);
  }

  function updateCompRotation(id,rot) {
    let code=_getCode();
    const line=code.split('\n').find(l=>l.trim().startsWith(id+':'))||'';
    if (/rotate\s*=\s*\d+/.test(line))
      code=code.replace(new RegExp(`(\\b${id}\\b[^\\n]+)rotate\\s*=\\s*\\d+`),`$1rotate=${rot}`);
    else
      code=code.replace(new RegExp(`(\\b${id}\\s*:[^\\n]+at\\s*\\([^)]+\\)[^\\n]*)(\\n)`),`$1 rotate=${rot}$2`);
    _onCodeChange(code,true);
  }

  function deleteCompFromDSL(id) {
    const lines=_getCode().split('\n').filter(line=>{
      const t=line.trim();
      if (t.match(new RegExp(`^${id}\\s*:`))) return false;
      if (t.startsWith('wire')&&(t.includes(`${id}.`)||new RegExp(`\\b${id}\\b`).test(t))) return false;
      return true;
    });
    _onCodeChange(lines.join('\n'),true);
  }

  function appendWireLine(code,wireLine) {
    const i=code.lastIndexOf('}');
    return i>-1 ? code.substring(0,i)+`  ${wireLine}\n`+code.substring(i) : code+`\n  ${wireLine}`;
  }

  function uniqueNodeId(code,prefix) {
    let n=1; while(code.includes(`${prefix}${n}:`)) n++; return `${prefix}${n}`;
  }

  function rotateComponent(id) {
    if (!_ast?.components[id]) return;
    updateCompRotation(id,(((_ast.components[id].rotate||0)+90)%360));
  }

  function deleteComponent(id) {
    if (!_ast?.components[id]) return;
    deleteCompFromDSL(id); _selectedId=null;
  }

  // ── SVG path helpers ──────────────────────────────────────────────────────
  function makeSVGPath() { return document.createElementNS('http://www.w3.org/2000/svg','path'); }

  function orthoPath(ax,ay,bx,by) {
    const dx=Math.abs(bx-ax), dy=Math.abs(by-ay);
    if (dx<2) return `M${f(ax)},${f(ay)} L${f(bx)},${f(by)}`;
    if (dy<2) return `M${f(ax)},${f(ay)} L${f(bx)},${f(by)}`;
    const R=Math.min(12,dx/2,dy/2);
    const sx=bx>ax?R:-R, sy=by>ay?R:-R;
    return `M${f(ax)},${f(ay)} L${f(ax)},${f(by-sy)} Q${f(ax)},${f(by)} ${f(ax+sx)},${f(by)} L${f(bx)},${f(by)}`;
  }

  function multiSegPath(points) {
    if (!points||points.length<2) return '';
    if (points.length===2) return `M${f(points[0].x)},${f(points[0].y)} L${f(points[1].x)},${f(points[1].y)}`;
    let d=`M${f(points[0].x)},${f(points[0].y)}`;
    for (let i=1;i<points.length;i++) d+=` L${f(points[i].x)},${f(points[i].y)}`;
    return d;
  }

  function f(n) { return Math.round(n*10)/10; }

  function getCursorForTool(t) {
    return {select:'default',wire:'crosshair',rotate:'alias',delete:'not-allowed','delete-wire':'not-allowed',join:'cell'}[t]||'default';
  }
  function updateCursor() { _svg.style.cursor=getCursorForTool(_tool); }

  return { init, setAST, setTool, getTool, rotateComponent, deleteComponent };
})();
