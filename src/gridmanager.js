// ─── ElectroDSL Grid Manager ──────────────────────────────────────────────────
// Owns grid cell size (GRID) and subdivision count.
// All other modules read from this — they must NOT cache GRID locally.
// Call ElectroGrid.GRID and ElectroGrid.SUB throughout.

window.ElectroGrid = (function () {

  let _grid   = 80;   // pixels per DSL unit (cell size)
  let _sub    = 1;    // subdivisions per cell (1 = no sub-grid)
  let _pad    = 70;   // canvas padding (constant)
  const _listeners = [];

  function getGRID()  { return _grid; }
  function getSUB()   { return _sub; }
  function getPAD()   { return _pad; }
  function getStep()  { return _grid / _sub; }  // snap step in pixels

  function setGrid(px) {
    _grid = parseInt(px) || 80;
    _notify();
  }

  function setSub(n) {
    _sub = parseInt(n) || 1;
    _notify();
  }

  function onChange(fn) { _listeners.push(fn); }

  function _notify() {
    _listeners.forEach(fn => fn(_grid, _sub));
  }

  // ── Snap a canvas-space point to nearest sub-grid point ────────────────────
  function snap(sx, sy) {
    const step = _grid / _sub;
    return {
      x: Math.round((sx - _pad) / step) * step + _pad,
      y: Math.round((sy - _pad) / step) * step + _pad,
    };
  }

  // ── Convert canvas-space → DSL grid coords ─────────────────────────────────
  function toGrid(sx, sy, maxY) {
    return {
      x: (sx - _pad) / _grid,
      y: maxY - (sy - _pad) / _grid,
    };
  }

  // ── Convert DSL grid coords → canvas-space ─────────────────────────────────
  function toCanvas(gx, gy, maxY) {
    return {
      x: _pad + gx * _grid,
      y: _pad + (maxY - gy) * _grid,
    };
  }

  // ── Update SVG grid patterns to reflect current GRID and SUB ──────────────
  function updateSVGPatterns() {
    const G = _grid;
    const step = G / _sub;

    // Main grid pattern
    const mainPat = document.getElementById('grid-pattern');
    if (mainPat) {
      mainPat.setAttribute('width',  G);
      mainPat.setAttribute('height', G);
      const mainPath = mainPat.querySelector('path');
      if (mainPath) mainPath.setAttribute('d', `M ${G} 0 L 0 0 0 ${G}`);
    }

    // Sub-grid pattern (only shown when _sub > 1)
    const subPat  = document.getElementById('subgrid-pattern');
    const subPath = document.getElementById('subgrid-path');
    if (subPat && subPath) {
      subPat.setAttribute('width',  G);
      subPat.setAttribute('height', G);

      if (_sub > 1) {
        // Draw sub-division lines inside each main cell
        let d = '';
        for (let i = 1; i < _sub; i++) {
          const pos = i * step;
          d += `M ${pos} 0 L ${pos} ${G} `;   // vertical sub-lines
          d += `M 0 ${pos} L ${G} ${pos} `;    // horizontal sub-lines
        }
        subPath.setAttribute('d', d.trim());
        document.getElementById('subgrid-bg').style.display = '';
      } else {
        subPath.setAttribute('d', '');
        document.getElementById('subgrid-bg').style.display = 'none';
      }
    }

    // Update grid-bg and subgrid-bg sizes
    ['grid-bg','subgrid-bg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.setAttribute('width',  4000);
        el.setAttribute('height', 3000);
      }
    });
  }

  // ── Snap cursor (crosshair shown at snap point during wire draw) ────────────
  function showSnapCursor(sx, sy) {
    const cur    = document.getElementById('snap-cursor');
    const dot    = document.getElementById('snap-dot');
    const hline  = document.getElementById('snap-hline');
    const vline  = document.getElementById('snap-vline');
    if (!cur) return;

    const snapped = snap(sx, sy);
    cur.style.display = '';
    cur.setAttribute('transform', `translate(${snapped.x},${snapped.y})`);

    // Crosshair arms extend to half the step size
    const arm = Math.max(8, step() / 2);
    if (hline) { hline.setAttribute('x1', -arm); hline.setAttribute('x2', arm); }
    if (vline) { vline.setAttribute('y1', -arm); vline.setAttribute('y2', arm); }
    if (dot) {
      // Pulse size based on proximity to main grid point
      const mx = Math.round((sx - _pad) / _grid) * _grid + _pad;
      const my = Math.round((sy - _pad) / _grid) * _grid + _pad;
      const onMain = Math.hypot(sx - mx, sy - my) < step * 0.3;
      dot.setAttribute('r', onMain ? '6' : '4');
      dot.setAttribute('stroke', onMain ? '#34D399' : '#60A5FA');
    }
  }

  function step() { return _grid / _sub; }

  function hideSnapCursor() {
    const cur = document.getElementById('snap-cursor');
    if (cur) cur.style.display = 'none';
  }

  return {
    get GRID()  { return _grid; },
    get SUB()   { return _sub;  },
    get PAD()   { return _pad;  },
    get STEP()  { return _grid / _sub; },
    getGRID, getSUB, getPAD, getStep,
    setGrid, setSub, onChange,
    snap, toGrid, toCanvas,
    updateSVGPatterns,
    showSnapCursor, hideSnapCursor,
  };
})();
