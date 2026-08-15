// ─── ElectroDSL Renderer v2 ──────────────────────────────────────────────────
// - Wires connect to EXACT pin coordinates (not symbol centers)
// - Pin numbers shown on hover
// - Rotation correctly transforms pin positions
// - Orthogonal wire routing from pin to pin

window.ElectroRenderer = (function () {

  // Grid/PAD now from ElectroGrid — read dynamically each call
  function _G() { return ElectroGrid.GRID; }
  function _P() { return ElectroGrid.PAD; }

  let _svg, _root, _ast, _zoom = 1, _panX = 0, _panY = 0;
  let _selected = null;
  let _onSelect = null;
  let _isPanning = false, _panStart = { x:0, y:0 };
  let _showPinNumbers = true;

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  function wx(x) { return ElectroGrid.PAD + x * ElectroGrid.GRID; }
  function wy(y, maxY) { return ElectroGrid.PAD + (maxY - y) * ElectroGrid.GRID; }

  // Get the world pixel position of a specific pin on a component
  function getPinWorld(comp, pinName, maxY) {
    const cx = wx(comp.x);
    const cy = wy(comp.y, maxY);
    const off = ElectroSymbols.resolvePinOffset(comp.type, pinName, comp.rotate || 0);
    return { x: cx + off.x, y: cy + off.y };
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(svgEl, rootEl, onSelectCb) {
    _svg = svgEl;
    _root = rootEl;
    _onSelect = onSelectCb;

    // Pan only on background click (tools.js handles component clicks)
    svgEl.addEventListener('mousedown', e => {
      const onBg = e.target === svgEl || e.target.id === 'grid-bg';
      if (!onBg) return;
      // Only pan when select tool active (or no tool module)
      const tool = window.ElectroTools ? ElectroTools.getTool() : 'select';
      if (tool !== 'select') return;
      startPan(e);
    });
    svgEl.addEventListener('mousemove', doPan);
    svgEl.addEventListener('mouseup',   endPan);
    svgEl.addEventListener('mouseleave',endPan);
    svgEl.addEventListener('wheel', onWheel, { passive: false });
  }

  function startPan(e) {
    _isPanning = true;
    _panStart = { x: e.clientX - _panX, y: e.clientY - _panY };
    _svg.style.cursor = 'grabbing';
  }
  function doPan(e) {
    if (!_isPanning) return;
    _panX = e.clientX - _panStart.x;
    _panY = e.clientY - _panStart.y;
    applyTransform();
  }
  function endPan() { _isPanning = false; _svg.style.cursor = 'grab'; }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    _zoom = Math.max(0.15, Math.min(5, _zoom * factor));
    applyTransform();
    updateZoomDisplay();
  }

  function applyTransform() {
    const inner = document.getElementById('canvas-inner');
    if (inner) inner.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }

  function updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = Math.round(_zoom * 100) + '%';
  }

  function setZoom(z) { _zoom = Math.max(0.15, Math.min(5, z)); applyTransform(); updateZoomDisplay(); }
  function getZoom() { return _zoom; }

  function fitToView() {
    if (!_ast) return;
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    const { width: W, height: H } = wrapper.getBoundingClientRect();
    const svgW = parseInt(_svg.getAttribute('width') || 800);
    const svgH = parseInt(_svg.getAttribute('height') || 600);
    _zoom = Math.max(0.15, Math.min(2, Math.min((W - 40) / svgW, (H - 40) / svgH)));
    _panX = (W - svgW * _zoom) / 2;
    _panY = (H - svgH * _zoom) / 2;
    applyTransform();
    updateZoomDisplay();
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  function render(ast, netResult) {
    _ast = ast;
    _lastNetResult = netResult || null;
    _root.innerHTML = '';
    _selected = null;

    const comps = Object.values(ast.components);
    if (!comps.length) return;

    const bounds = ElectroParser.getBounds(ast);
    const svgW = Math.max(600, (bounds.maxX - bounds.minX + 4) * ElectroGrid.GRID + ElectroGrid.PAD * 2);
    const svgH = Math.max(500, (bounds.maxY - bounds.minY + 4) * ElectroGrid.GRID + ElectroGrid.PAD * 2);
    _svg.setAttribute('width', svgW);
    _svg.setAttribute('height', svgH);
    const gridBg = document.getElementById('grid-bg');
    if (gridBg) { gridBg.setAttribute('width', svgW); gridBg.setAttribute('height', svgH); }

    const maxY = bounds.maxY + 1;

    // Layer 1: wires (behind everything)
    const wireGroup = makeSVGEl('g');
    wireGroup.id = 'wire-layer';
    const wireNets = netResult ? netResult.wireNets : ast.wires.map(w => ({ ...w, net: '' }));
    wireNets.forEach(w => drawWire(wireGroup, w, ast.components, maxY));
    _root.appendChild(wireGroup);

    // Layer 2: components + pin overlays
    comps.forEach(c => drawComponent(c, maxY));

    // Layer 3: junction dots at multi-wire meeting points
    drawJunctions(ast, maxY);
  }

  // ── Wire drawing: uses stored route waypoints if present, else auto-routes ──
  function drawWire(group, wire, components, maxY) {
    const ca = components[wire.from];
    const cb = components[wire.to];
    if (!ca || !cb) return;

    const A = getPinWorld(ca, wire.fromPin, maxY);
    const B = getPinWorld(cb, wire.toPin,   maxY);

    const path = makeSVGEl('path');
    path.setAttribute('class', 'schematic-wire');
    path.dataset.from    = wire.from;
    path.dataset.fromPin = wire.fromPin || 'auto';
    path.dataset.to      = wire.to;
    path.dataset.toPin   = wire.toPin   || 'auto';
    if (wire.net) path.dataset.net = wire.net;

    // If user drew a custom route, honour it exactly; otherwise auto L-route
    let d;
    if (wire.route && wire.route.length > 0) {
      const pts = [
        A,
        ...wire.route.map(p => ({
          x: ElectroGrid.PAD + p.x * ElectroGrid.GRID,
          y: ElectroGrid.PAD + (maxY - p.y) * ElectroGrid.GRID,
        })),
        B,
      ];
      d = buildMultiSegPath(pts);
    } else {
      d = buildOrthogonalPath(A, B);
    }
    path.setAttribute('d', d);

    if (wire.net) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `Net: ${wire.net}`;
      path.appendChild(title);
    }
    group.appendChild(path);

    // Net label mid-wire
    if (wire.net && wire.net !== 'GND' && !wire.net.startsWith('VCC')) {
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      const lbl = makeSVGEl('text');
      lbl.setAttribute('x', f(mx));
      lbl.setAttribute('y', f(my - 5));
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'wire-net-label');
      lbl.textContent = wire.net;
      group.appendChild(lbl);
    }
  }

  function buildOrthogonalPath(A, B) {
    const dx = Math.abs(B.x - A.x);
    const dy = Math.abs(B.y - A.y);
    if (dx < 3) return `M${f(A.x)},${f(A.y)} L${f(B.x)},${f(B.y)}`;
    if (dy < 3) return `M${f(A.x)},${f(A.y)} L${f(B.x)},${f(B.y)}`;
    const R  = Math.min(14, dx / 2, dy / 2);
    const sy = B.y > A.y ?  R : -R;
    const sx = B.x > A.x ?  R : -R;
    return `M${f(A.x)},${f(A.y)} `
         + `L${f(A.x)},${f(B.y - sy)} `
         + `Q${f(A.x)},${f(B.y)} ${f(A.x + sx)},${f(B.y)} `
         + `L${f(B.x)},${f(B.y)}`;
  }

  // Multi-segment path through an array of {x,y} points with smooth corners
  function buildMultiSegPath(pts) {
    if (!pts || pts.length < 2) return '';
    if (pts.length === 2) return buildOrthogonalPath(pts[0], pts[1]);

    let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];
      if (!next) {
        d += ` L${f(curr.x)},${f(curr.y)}`;
        continue;
      }
      const R = Math.min(12,
        Math.hypot(curr.x - prev.x, curr.y - prev.y) / 3,
        Math.hypot(next.x - curr.x, next.y - curr.y) / 3
      );
      const d1l = Math.hypot(curr.x - prev.x, curr.y - prev.y) || 1;
      const d2l = Math.hypot(next.x - curr.x, next.y - curr.y) || 1;
      const cpx = curr.x - ((curr.x - prev.x) / d1l) * R;
      const cpy = curr.y - ((curr.y - prev.y) / d1l) * R;
      const epx = curr.x + ((next.x - curr.x) / d2l) * R;
      const epy = curr.y + ((next.y - curr.y) / d2l) * R;
      d += ` L${f(cpx)},${f(cpy)} Q${f(curr.x)},${f(curr.y)} ${f(epx)},${f(epy)}`;
    }
    return d;
  }

  function f(n) { return Math.round(n * 10) / 10; }

  // ── Junction dots ───────────────────────────────────────────────────────────
  function drawJunctions(ast, maxY) {
    // Count how many wires meet at each pin world position
    const pinCount = {};
    const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;

    ast.wires.forEach(w => {
      const ca = ast.components[w.from];
      const cb = ast.components[w.to];
      if (ca) {
        const p = getPinWorld(ca, w.fromPin, maxY);
        const k = key(p.x, p.y);
        pinCount[k] = (pinCount[k] || 0) + 1;
      }
      if (cb) {
        const p = getPinWorld(cb, w.toPin, maxY);
        const k = key(p.x, p.y);
        pinCount[k] = (pinCount[k] || 0) + 1;
      }
    });

    const jGroup = makeSVGEl('g');
    jGroup.id = 'junction-layer';
    Object.entries(pinCount).forEach(([k, count]) => {
      if (count < 2) return;
      const [x, y] = k.split(',').map(Number);
      const dot = makeSVGEl('circle');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#34D399');
      dot.setAttribute('class', 'junction-dot');
      jGroup.appendChild(dot);
    });
    _root.appendChild(jGroup);
  }

  // ── Component drawing ───────────────────────────────────────────────────────
  function drawComponent(comp, maxY) {
    const cx = wx(comp.x);
    const cy = wy(comp.y, maxY);
    const rot = comp.rotate || 0;
    const sym = ElectroSymbols.getSymbol(comp.type, comp.params);
    const color = comp.color || ElectroSymbols.getColor(comp.type);
    const pins = ElectroSymbols.getPins(comp.type);

    // Outer group: positioned at component center, NO rotation (keeps labels upright)
    const outer = makeSVGEl('g');
    outer.setAttribute('class', 'component-group');
    outer.dataset.id = comp.id;
    outer.setAttribute('transform', `translate(${cx},${cy})`);

    // Inner group: rotated symbol body
    const inner = makeSVGEl('g');
    inner.setAttribute('class', 'component-body');
    inner.setAttribute('transform', `rotate(${rot})`);
    inner.innerHTML = sym;
    outer.appendChild(inner);

    // ── Pin number labels (shown in rotated space so they align with leads) ──
    if (_showPinNumbers && comp.type !== 'Node' && comp.type !== 'Ground' && comp.type !== 'VCC') {
      const pinGroup = makeSVGEl('g');
      pinGroup.setAttribute('class', 'pin-numbers');
      pinGroup.setAttribute('transform', `rotate(${rot})`);

      pins.forEach(pin => {
        // Place number just inside the pin end (20% inward from tip)
        const insetFactor = 0.65;
        const px = pin.x * insetFactor;
        const py = pin.y * insetFactor;

        // Offset perpendicular to the pin lead for readability
        const len = Math.sqrt(pin.x * pin.x + pin.y * pin.y) || 1;
        const perpX = -pin.y / len * 8;
        const perpY =  pin.x / len * 8;

        const t = makeSVGEl('text');
        t.setAttribute('x', f(px + perpX));
        t.setAttribute('y', f(py + perpY + 3));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'pin-number-label');
        t.textContent = pin.num;

        // Tiny pin name (hover tooltip via <title>)
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `Pin ${pin.num}: ${pin.name}`;
        t.appendChild(title);
        pinGroup.appendChild(t);

        // Tiny dot AT the exact pin endpoint
        const dot = makeSVGEl('circle');
        dot.setAttribute('cx', pin.x);
        dot.setAttribute('cy', pin.y);
        dot.setAttribute('r', '2.5');
        dot.setAttribute('fill', color);
        dot.setAttribute('opacity', '0.6');
        dot.setAttribute('class', 'pin-dot');
        pinGroup.appendChild(dot);
      });

      outer.appendChild(pinGroup);
    }

    // ── Component label (unrotated, always readable) ─────────────────────────
    const labelOff = getLabelOffset(comp.type, rot);
    if (comp.type !== 'Node') {
      const lbl = makeSVGEl('text');
      lbl.setAttribute('x', labelOff.x);
      lbl.setAttribute('y', labelOff.y);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'component-label');
      lbl.textContent = comp.label || comp.id;
      outer.appendChild(lbl);
    }

    // Value sub-label
    const display = comp.value || comp.params;
    if (display && !['Node','Ground','VCC'].includes(comp.type)) {
      const valOff = getValueOffset(comp.type, rot);
      const sub = makeSVGEl('text');
      sub.setAttribute('x', valOff.x);
      sub.setAttribute('y', valOff.y);
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('class', 'component-sublabel');
      sub.textContent = display;
      outer.appendChild(sub);
    }

    // VCC label above the bar
    if (comp.type === 'VCC') {
      const vl = makeSVGEl('text');
      vl.setAttribute('x', '0'); vl.setAttribute('y', '-18');
      vl.setAttribute('text-anchor', 'middle');
      vl.setAttribute('class', 'vcc-label');
      vl.textContent = comp.params || 'VCC';
      outer.appendChild(vl);
    }

    // Node net label
    if (comp.type === 'Node' && comp.label && comp.label !== comp.id) {
      const nl = makeSVGEl('text');
      nl.setAttribute('x', '10'); nl.setAttribute('y', '-10');
      nl.setAttribute('class', 'node-label');
      nl.textContent = comp.label;
      outer.appendChild(nl);
    }

    // Hit area (unrotated, covers full component)
    const hit = makeSVGEl('rect');
    hit.setAttribute('x', '-34'); hit.setAttribute('y', '-34');
    hit.setAttribute('width', '68'); hit.setAttribute('height', '68');
    hit.setAttribute('fill', 'transparent');
    hit.setAttribute('class', 'component-hit');
    outer.appendChild(hit);

    outer.addEventListener('click', e => {
      e.stopPropagation();
      selectComponent(comp.id);
    });

    _root.appendChild(outer);
  }

  // ── Label positioning ───────────────────────────────────────────────────────
  // Labels stay UPRIGHT (not rotated) but shift to avoid the symbol
  function getLabelOffset(type, rot) {
    // Default: above the component
    // For vertical sources, shift to the right
    const isVertical = ['VSource','ISource','Ground','VCC'].includes(type);
    if (isVertical) return { x: 20, y: -6 };
    // Transistors / MOSFET: above
    const is3pin = ['NPN','PNP','NMOS','PMOS','JFET'].includes(type);
    if (is3pin) return { x: 0, y: -36 };
    // OpAmp: above
    if (type === 'OpAmp') return { x: 0, y: -30 };
    return { x: 0, y: -32 };
  }

  function getValueOffset(type, rot) {
    const isVertical = ['VSource','ISource'].includes(type);
    if (isVertical) return { x: 20, y: 6 };
    const is3pin = ['NPN','PNP','NMOS','PMOS','JFET'].includes(type);
    if (is3pin) return { x: 0, y: -24 };
    if (type === 'OpAmp') return { x: 0, y: -20 };
    return { x: 0, y: -20 };
  }

  // ── Selection ───────────────────────────────────────────────────────────────
  function selectComponent(id) {
    if (_selected) {
      const prev = _root.querySelector(`[data-id="${_selected}"]`);
      if (prev) prev.classList.remove('selected');
    }
    _selected = id;
    const el = _root.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('selected');
    if (_onSelect) _onSelect(id, _ast?.components[id]);
  }

  function clearSelection() {
    if (_selected) {
      const prev = _root.querySelector(`[data-id="${_selected}"]`);
      if (prev) prev.classList.remove('selected');
      _selected = null;
      if (_onSelect) _onSelect(null, null);
    }
  }

  function highlightComponentById(id) { selectComponent(id); }

  function togglePinNumbers(show) {
    _showPinNumbers = (show === undefined) ? !_showPinNumbers : show;
    if (_ast) render(_ast);
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function getSVGString(bgColor) {
    if (!_svg || !_ast) return '';
    bgColor = bgColor || '#0D1117';

    // Re-render into a fresh detached SVG so we can embed everything cleanly
    const bounds = ElectroParser.getBounds(_ast);
    const maxY   = bounds.maxY + 1;
    const svgW   = Math.max(600, (bounds.maxX - bounds.minX + 4) * ElectroGrid.GRID + ElectroGrid.PAD * 2);
    const svgH   = Math.max(500, (bounds.maxY - bounds.minY + 4) * ElectroGrid.GRID + ElectroGrid.PAD * 2);

    // All colours and styles embedded inline — no external CSS dependency
    const STYLES = `
      .schematic-wire { fill:none; stroke:#4A6080; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
      .junction-dot   { fill:#34D399; }
      .wire-net-label { font-family:monospace; font-size:9px; fill:#34D399; font-weight:600; }
      .component-label    { font-family:monospace; font-size:10px; fill:#8B949E; }
      .component-sublabel { font-family:monospace; font-size:9px;  fill:#656D76; }
      .node-label { font-family:monospace; font-size:10px; fill:#34D399; font-weight:600; }
      .vcc-label  { font-family:monospace; font-size:10px; fill:#FCD34D; font-weight:600; }
      .pin-number-label { font-family:monospace; font-size:8px; font-weight:700; fill:#F59E0B; }
      .component-outline { }
    `;

    // Build fresh export SVG
    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('width',  svgW);
    svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

    // Embed style
    const styleEl = document.createElementNS(ns, 'style');
    styleEl.textContent = STYLES;
    svg.appendChild(styleEl);

    // Dark background rect
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', svgW); bg.setAttribute('height', svgH);
    bg.setAttribute('fill', bgColor);
    svg.appendChild(bg);

    // Title
    const titleEl = document.createElementNS(ns, 'text');
    titleEl.setAttribute('x', '12'); titleEl.setAttribute('y', '20');
    titleEl.setAttribute('font-family', 'monospace');
    titleEl.setAttribute('font-size', '13');
    titleEl.setAttribute('font-weight', '600');
    titleEl.setAttribute('fill', '#E6EDF3');
    titleEl.textContent = _ast.title || 'Schematic';
    svg.appendChild(titleEl);

    const root = document.createElementNS(ns, 'g');
    svg.appendChild(root);

    const comps    = Object.values(_ast.components);
    const wireNets = _lastNetResult
      ? _lastNetResult.wireNets
      : _ast.wires.map(w => ({ ...w, net: '' }));

    // ── Draw wires with fully inlined stroke attributes ──
    const wireGroup = document.createElementNS(ns, 'g');
    wireNets.forEach(w => {
      const ca = _ast.components[w.from];
      const cb = _ast.components[w.to];
      if (!ca || !cb) return;

      const A = getPinWorld(ca, w.fromPin, maxY);
      const B = getPinWorld(cb, w.toPin,   maxY);

      const path = document.createElementNS(ns, 'path');
      // CRITICAL: set fill=none and stroke explicitly as attributes (not CSS class)
      // so they survive SVG serialization without external stylesheet
      path.setAttribute('fill',            'none');
      path.setAttribute('stroke',          '#4A6080');
      path.setAttribute('stroke-width',    '1.8');
      path.setAttribute('stroke-linecap',  'round');
      path.setAttribute('stroke-linejoin', 'round');
      // Use stored route if available, else auto-route
      let exportD;
      if (w.route && w.route.length > 0) {
        const pts = [
          A,
          ...w.route.map(p => ({ x: ElectroGrid.PAD + p.x * ElectroGrid.GRID, y: ElectroGrid.PAD + (maxY - p.y) * ElectroGrid.GRID })),
          B,
        ];
        exportD = buildMultiSegPath(pts);
      } else {
        exportD = buildOrthogonalPath(A, B);
      }
      path.setAttribute('d', exportD);
      wireGroup.appendChild(path);

      // Net label
      if (w.net && w.net !== 'GND' && !w.net.startsWith('VCC')) {
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', f((A.x + B.x) / 2));
        lbl.setAttribute('y', f((A.y + B.y) / 2 - 5));
        lbl.setAttribute('text-anchor',  'middle');
        lbl.setAttribute('font-family',  'monospace');
        lbl.setAttribute('font-size',    '9');
        lbl.setAttribute('font-weight',  '600');
        lbl.setAttribute('fill',         '#34D399');
        lbl.textContent = w.net;
        wireGroup.appendChild(lbl);
      }
    });
    root.appendChild(wireGroup);

    // ── Draw components ──
    comps.forEach(comp => drawComponentExport(root, comp, maxY, ns));

    // ── Draw junction dots ──
    const pinCount = {};
    const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
    _ast.wires.forEach(w => {
      const ca = _ast.components[w.from], cb = _ast.components[w.to];
      if (ca) { const p = getPinWorld(ca, w.fromPin, maxY); const k = key(p.x, p.y); pinCount[k] = (pinCount[k]||0)+1; }
      if (cb) { const p = getPinWorld(cb, w.toPin,   maxY); const k = key(p.x, p.y); pinCount[k] = (pinCount[k]||0)+1; }
    });
    Object.entries(pinCount).forEach(([k, count]) => {
      if (count < 2) return;
      const [x, y] = k.split(',').map(Number);
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#34D399');
      root.appendChild(dot);
    });

    return new XMLSerializer().serializeToString(svg);
  }

  // Draw a single component into the export SVG with fully inlined styles
  function drawComponentExport(root, comp, maxY, ns) {
    const cx  = wx(comp.x);
    const cy  = wy(comp.y, maxY);
    const rot = comp.rotate || 0;
    const color = comp.color || ElectroSymbols.getColor(comp.type);

    const outer = document.createElementNS(ns, 'g');
    outer.setAttribute('transform', `translate(${cx},${cy})`);

    // Symbol body (rotated)
    const inner = document.createElementNS(ns, 'g');
    inner.setAttribute('transform', `rotate(${rot})`);
    inner.innerHTML = ElectroSymbols.getSymbol(comp.type, comp.params);
    // Fix any CSS-class-only styling inside symbol to use explicit attributes
    inlineSymbolStyles(inner, color);
    outer.appendChild(inner);

    // Pin numbers
    if (comp.type !== 'Node' && comp.type !== 'Ground' && comp.type !== 'VCC') {
      const pins = ElectroSymbols.getPins(comp.type);
      const pinG = document.createElementNS(ns, 'g');
      pinG.setAttribute('transform', `rotate(${rot})`);
      pins.forEach(pin => {
        const inset = 0.65;
        const px = pin.x * inset, py = pin.y * inset;
        const len = Math.sqrt(pin.x*pin.x + pin.y*pin.y) || 1;
        const perpX = -pin.y / len * 8, perpY = pin.x / len * 8;
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', f(px + perpX)); t.setAttribute('y', f(py + perpY + 3));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '8');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', '#F59E0B');
        t.textContent = pin.num;
        pinG.appendChild(t);
      });
      outer.appendChild(pinG);
    }

    // Label
    if (comp.type !== 'Node' && (comp.label || comp.id)) {
      const isVert = ['VSource','ISource','Ground','VCC'].includes(comp.type);
      const is3pin = ['NPN','PNP','NMOS','PMOS','JFET'].includes(comp.type);
      const lx = isVert ? 22 : 0;
      const ly = is3pin ? -36 : -32;
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', lx); lbl.setAttribute('y', ly);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('font-family', 'monospace');
      lbl.setAttribute('font-size', '10');
      lbl.setAttribute('fill', '#8B949E');
      lbl.setAttribute('paint-order', 'stroke');
      lbl.setAttribute('stroke', '#0D1117');
      lbl.setAttribute('stroke-width', '2.5');
      lbl.textContent = comp.label || comp.id;
      outer.appendChild(lbl);
    }

    // Value
    const display = comp.value || comp.params;
    if (display && !['Node','Ground','VCC'].includes(comp.type)) {
      const isVert = ['VSource','ISource'].includes(comp.type);
      const is3pin = ['NPN','PNP','NMOS','PMOS','JFET'].includes(comp.type);
      const vx = isVert ? 22 : 0;
      const vy = is3pin ? -24 : -20;
      const sub = document.createElementNS(ns, 'text');
      sub.setAttribute('x', vx); sub.setAttribute('y', vy);
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('font-family', 'monospace');
      sub.setAttribute('font-size', '9');
      sub.setAttribute('fill', '#656D76');
      sub.textContent = display;
      outer.appendChild(sub);
    }

    // VCC/Node labels
    if (comp.type === 'VCC') {
      const vl = document.createElementNS(ns, 'text');
      vl.setAttribute('x','0'); vl.setAttribute('y','-18');
      vl.setAttribute('text-anchor','middle');
      vl.setAttribute('font-family','monospace');
      vl.setAttribute('font-size','10');
      vl.setAttribute('font-weight','600');
      vl.setAttribute('fill','#FCD34D');
      vl.textContent = comp.params || 'VCC';
      outer.appendChild(vl);
    }
    if (comp.type === 'Node' && comp.label && comp.label !== comp.id) {
      const nl = document.createElementNS(ns, 'text');
      nl.setAttribute('x','10'); nl.setAttribute('y','-10');
      nl.setAttribute('font-family','monospace');
      nl.setAttribute('font-size','10');
      nl.setAttribute('font-weight','600');
      nl.setAttribute('fill','#34D399');
      nl.textContent = comp.label;
      outer.appendChild(nl);
    }

    root.appendChild(outer);
  }

  // Walk symbol SVG elements and ensure stroke/fill are set as attributes not CSS
  function inlineSymbolStyles(el, defaultColor) {
    el.querySelectorAll('*').forEach(child => {
      // Remove class="component-outline" class (was CSS-only) — replace with attrs
      if (child.classList && child.classList.contains('component-outline')) {
        child.removeAttribute('class');
      }
      // If element has no fill attribute and is a shape, set fill=none explicitly
      const tag = child.tagName.toLowerCase();
      const isShape = ['rect','circle','ellipse','polygon','polyline','path'].includes(tag);
      if (isShape) {
        const hasFill   = child.hasAttribute('fill');
        const hasStroke = child.hasAttribute('stroke');
        // Shapes without explicit fill default to black in SVG — make fill explicit
        if (!hasFill && !hasStroke) {
          child.setAttribute('fill', 'none');
          child.setAttribute('stroke', defaultColor);
          child.setAttribute('stroke-width', '1.5');
        }
        // If fill is set but is "#0D1117" or "#061318" (body fill), keep it
        // If stroke is missing but fill is none, add stroke
        if (child.getAttribute('fill') === 'none' && !hasStroke) {
          child.setAttribute('stroke', defaultColor);
          child.setAttribute('stroke-width', '1.5');
        }
      }
    });
  }

  // Store last net result for export
  let _lastNetResult = null;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function makeSVGEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  function getPanX() { return _panX; }
  function getPanY() { return _panY; }

  return {
    init, render, fitToView,
    setZoom, getZoom,
    getPanX, getPanY,
    selectComponent, clearSelection, highlightComponentById,
    togglePinNumbers,
    getSVGString,
  };
})();
