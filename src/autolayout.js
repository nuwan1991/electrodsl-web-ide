// ─── ElectroDSL Auto-Layout Engine ───────────────────────────────────────────
// When AI generates code without coordinates, this assigns them intelligently

window.ElectroAutoLayout = (function () {

  // Assign grid positions to components based on connectivity graph
  function layout(ast) {
    const comps = Object.values(ast.components);
    const needsLayout = comps.every(c => c.x === 0 && c.y === 0) || comps.length === 0;
    if (!needsLayout) return ast; // already has positions

    // Build adjacency from wires
    const adj = {};
    comps.forEach(c => { adj[c.id] = []; });
    ast.wires.forEach(w => {
      if (adj[w.from]) adj[w.from].push(w.to);
      if (adj[w.to])   adj[w.to].push(w.from);
    });

    // Topological sort with BFS from sources
    const sources = comps.filter(c => ['VSource','ISource','VCC'].includes(c.type)).map(c => c.id);
    const grounds  = comps.filter(c => c.type === 'Ground').map(c => c.id);
    const start = sources.length ? sources : [comps[0]?.id].filter(Boolean);

    const positions = {};
    const visited = new Set();
    let col = 0, row = 0;

    function bfs(startId, startCol, startRow) {
      const queue = [{ id: startId, col: startCol, row: startRow }];
      while (queue.length) {
        const { id, col: c, row: r } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        // Avoid collisions
        let fc = c, fr = r;
        while (Object.values(positions).some(p => p.x === fc && p.y === fr)) fr++;
        positions[id] = { x: fc, y: fr };

        const neighbors = (adj[id] || []).filter(n => !visited.has(n));
        neighbors.forEach((n, i) => {
          const comp = ast.components[n];
          if (!comp) return;
          if (comp.type === 'Ground') {
            queue.push({ id: n, col: fc, row: fr - 2 });
          } else {
            queue.push({ id: n, col: fc + 2, row: fr + (i % 2 === 0 ? 0 : 2) });
          }
        });
      }
    }

    start.forEach((id, i) => bfs(id, 0, i * 3));

    // Assign any unvisited components
    comps.forEach(c => {
      if (!positions[c.id]) {
        while (Object.values(positions).some(p => p.x === col && p.y === row)) col += 2;
        positions[c.id] = { x: col, y: row };
        col += 2;
      }
    });

    // Normalize so minimum is at (1,1)
    const xs = Object.values(positions).map(p => p.x);
    const ys = Object.values(positions).map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    // Apply positions to AST clone
    const newAst = JSON.parse(JSON.stringify(ast));
    comps.forEach(c => {
      const p = positions[c.id];
      if (p) {
        newAst.components[c.id].x = p.x - minX + 1;
        newAst.components[c.id].y = p.y - minY + 1;
      }
    });

    return newAst;
  }

  // Inject coordinates into DSL source text
  function injectCoordinates(src, ast) {
    const lines = src.split('\n');
    const result = [];
    for (const line of lines) {
      const m = line.match(/^(\s*)(\w+)\s*:\s*(\w+)(?:\([^)]*\))?\s+at\s+\(0\s*,\s*0\)/);
      if (m) {
        const id = m[2];
        const comp = ast.components[id];
        if (comp) {
          result.push(line.replace(/at\s*\(\s*0\s*,\s*0\s*\)/, `at (${comp.x}, ${comp.y})`));
          continue;
        }
      }
      result.push(line);
    }
    return result.join('\n');
  }

  return { layout, injectCoordinates };
})();
