// ─── ElectroDSL Parser ────────────────────────────────────────────────────────
// Converts DSL text → AST: { title, components: {}, wires: [], errors: [] }

window.ElectroParser = (function () {

  const COMPONENT_TYPES = new Set([
    'VSource','ISource','Resistor','Capacitor','Inductor',
    'Diode','LED','NPN','PNP','NMOS','PMOS','OpAmp',
    'Ground','VCC','Node','Transformer','Switch','Relay',
    'Zener','Schottky','JFET','Thyristor'
  ]);

  function parse(src) {
    const result = { title: 'Schematic', components: {}, wires: [], errors: [] };
    if (!src || !src.trim()) return result;

    const lines = src.split('\n');

    lines.forEach((rawLine, lineIdx) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) return;

      // CIRCUIT title
      const titleMatch = line.match(/^CIRCUIT\s+"([^"]+)"/);
      if (titleMatch) { result.title = titleMatch[1]; return; }

      // Opening/closing braces
      if (line === '{' || line === '}') return;

      // wire A.pin -> B.pin  OR  wire A -> B  [route="x1,y1;x2,y2"]
      const wireMatch = line.match(/^wire\s+([\w.+\-]+)\s*->\s*([\w.+\-]+)(.*)/);
      if (wireMatch) {
        const fromParts = wireMatch[1].split('.');
        const toParts   = wireMatch[2].split('.');
        const rest      = wireMatch[3] || '';
        // Parse optional route attribute: route="x1,y1;x2,y2;..."
        const routeM    = rest.match(/route\s*=\s*"([^"]*)"/);
        let   route     = null;
        if (routeM && routeM[1]) {
          route = routeM[1].split(';').map(pt => {
            const [rx, ry] = pt.trim().split(',').map(Number);
            return { x: rx, y: ry };
          }).filter(p => !isNaN(p.x) && !isNaN(p.y));
          if (!route.length) route = null;
        }
        result.wires.push({
          from:    fromParts[0],
          fromPin: resolvePin(fromParts[1] || 'auto'),
          to:      toParts[0],
          toPin:   resolvePin(toParts[1] || 'auto'),
          route,
          line:    lineIdx
        });
        return;
      }

      // connect A -> B -> C  (chained)
      const connectMatch = line.match(/^connect\s+(.+)/);
      if (connectMatch) {
        const parts = connectMatch[1].split(/\s*->\s*/);
        for (let i = 0; i < parts.length - 1; i++) {
          const fp = parts[i].trim().split('.');
          const tp = parts[i+1].trim().split('.');
          result.wires.push({
            from:    fp[0],
            fromPin: resolvePin(fp[1] || 'auto'),
            to:      tp[0],
            toPin:   resolvePin(tp[1] || 'auto'),
            line:    lineIdx
          });
        }
        return;
      }

      // Component: ID: Type(params) at (x, y) [label="..."] [value="..."] [rotate=N]
      const compMatch = line.match(
        /^(\w+)\s*:\s*(\w+)(?:\(([^)]*)\))?\s+at\s+\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)(.*)/
      );
      if (compMatch) {
        const [, id, type, params='', rawX, rawY, rest] = compMatch;

        if (!COMPONENT_TYPES.has(type)) {
          result.errors.push({ line: lineIdx, msg: `Unknown component type: "${type}"` });
          return;
        }

        // parse trailing attributes: label="..." value="..." rotate=90
        const labelM   = rest.match(/label\s*=\s*"([^"]*)"/);
        const valueM   = rest.match(/value\s*=\s*"([^"]*)"/);
        const rotateM  = rest.match(/rotate\s*=\s*([+-]?\d+)/);
        const colorM   = rest.match(/color\s*=\s*"([^"]*)"/);

        result.components[id] = {
          id,
          type,
          params: params.trim(),
          x: parseFloat(rawX),
          y: parseFloat(rawY),
          label:  labelM  ? labelM[1]  : id,
          value:  valueM  ? valueM[1]  : params.trim(),
          rotate: rotateM ? parseInt(rotateM[1]) : 0,
          color:  colorM  ? colorM[1]  : null,
          line:   lineIdx
        };
        return;
      }

      // Unknown non-empty line
      if (line && line !== '}' && line !== '{') {
        result.errors.push({ line: lineIdx, msg: `Syntax error: "${line.substring(0, 40)}"` });
      }
    });

    return result;
  }

  // Normalize legacy pin aliases → canonical names
  // e.g. .top → .p, .left → .1, .base → .B, etc.
  const PIN_ALIASES = {
    top:'p', bot:'n', bottom:'n', pos:'p', neg:'n',
    left:'1', right:'2', anode:'A', cathode:'K',
    base:'B', collector:'C', emitter:'E',
    gate:'G', drain:'D', source:'S',
    inp:'IN+', inn:'IN-', 'in+':'IN+', 'in-':'IN-', out:'OUT',
    vplus:'V+', vminus:'V-', 'v+':'V+', 'v-':'V-',
    p1:'P1', p2:'P2', s1:'S1', s2:'S2',
    center:'1', auto:'1',
  };

  function resolvePin(pinStr) {
    if (!pinStr) return 'auto';
    const lower = pinStr.toLowerCase();
    return PIN_ALIASES[lower] || pinStr;
  }

  // Generate a bounding box for the schematic
  function getBounds(ast) {
    const comps = Object.values(ast.components);
    if (!comps.length) return { minX: 0, minY: 0, maxX: 10, maxY: 8 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    comps.forEach(c => {
      minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
    });
    return { minX, minY, maxX, maxY };
  }

  function _registerType(typeId) {
    COMPONENT_TYPES.add(typeId);
  }

  return { parse, getBounds, _registerType };
})();
