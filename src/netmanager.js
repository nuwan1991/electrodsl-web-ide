// ─── ElectroDSL Net Manager ──────────────────────────────────────────────────
// Assigns unique net names/numbers to every wire segment in the schematic.
// A "net" is a set of electrically-connected pins. Naming convention:
//   GND → net name "GND"
//   VCC → net name "VCC"
//   Named Node → net name = node label
//   Everything else → N001, N002, …

window.ElectroNetManager = (function () {

  // Build net list from AST using Union-Find (connected components)
  function buildNets(ast) {
    const comps = ast.components;
    const wires = ast.wires;

    // Each pin is identified as "COMP_ID.PIN_NAME"
    const parent = {};

    function key(compId, pin) { return `${compId}.${pin || '1'}`; }

    function find(k) {
      if (!parent[k]) parent[k] = k;
      if (parent[k] !== k) parent[k] = find(parent[k]);
      return parent[k];
    }

    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra === rb) return;
      // Prefer named nets (GND, VCC, node labels) as root
      if (isNamedNet(rb) && !isNamedNet(ra)) parent[ra] = rb;
      else parent[rb] = ra;
    }

    function isNamedNet(k) {
      const compId = k.split('.')[0];
      const c = comps[compId];
      if (!c) return false;
      if (c.type === 'Ground') return true;
      if (c.type === 'VCC') return true;
      if (c.type === 'Node' && c.label && c.label !== c.id) return true;
      return false;
    }

    // Initialise all component pins
    Object.values(comps).forEach(c => {
      const pins = ElectroSymbols.getPins(c.type);
      pins.forEach(p => { const k = key(c.id, p.name); parent[k] = k; });
    });

    // Union all wires
    wires.forEach(w => {
      const ak = key(w.from, w.fromPin === 'auto' ? '1' : w.fromPin);
      const bk = key(w.to,   w.toPin   === 'auto' ? '1' : w.toPin);
      union(ak, bk);
    });

    // Assign net names to each root
    const netNames = {};
    let counter = 1;

    function getNetName(root) {
      if (netNames[root]) return netNames[root];
      const compId = root.split('.')[0];
      const c = comps[compId];
      let name;
      if (c) {
        if (c.type === 'Ground') name = 'GND';
        else if (c.type === 'VCC') name = c.params ? `VCC_${c.params.replace(/[^a-zA-Z0-9]/g,'')}` : 'VCC';
        else if (c.type === 'Node' && c.label && c.label !== c.id) name = c.label.replace(/[^a-zA-Z0-9_]/g, '_');
        else name = `N${String(counter++).padStart(3, '0')}`;
      } else {
        name = `N${String(counter++).padStart(3, '0')}`;
      }
      netNames[root] = name;
      return name;
    }

    // Build pin→net map
    const pinNetMap = {};
    Object.keys(parent).forEach(k => {
      const root = find(k);
      pinNetMap[k] = getNetName(root);
    });

    // Build net→pins map
    const nets = {};
    Object.entries(pinNetMap).forEach(([pin, net]) => {
      if (!nets[net]) nets[net] = [];
      nets[net].push(pin);
    });

    // Wire net assignments (each wire segment belongs to one net)
    const wireNets = wires.map(w => {
      const ak = key(w.from, w.fromPin === 'auto' ? '1' : w.fromPin);
      return { ...w, net: pinNetMap[ak] || 'N000' };
    });

    return { nets, pinNetMap, wireNets };
  }

  // Generate net table HTML for display
  function renderNetTable(netResult) {
    const { nets } = netResult;
    const sorted = Object.keys(nets).sort((a, b) => {
      // GND and VCC first, then alphabetically
      if (a === 'GND') return -1; if (b === 'GND') return 1;
      if (a.startsWith('VCC')) return -1; if (b.startsWith('VCC')) return 1;
      return a.localeCompare(b);
    });

    return sorted.map(net => {
      const pins = nets[net];
      const isGnd = net === 'GND';
      const isVcc = net.startsWith('VCC');
      const cls = isGnd ? 'net-gnd' : isVcc ? 'net-vcc' : 'net-signal';
      return `<div class="net-row ${cls}">
        <span class="net-name">${net}</span>
        <span class="net-pins">${pins.map(p => `<code>${p}</code>`).join(' ')}</span>
      </div>`;
    }).join('');
  }

  return { buildNets, renderNetTable };
})();
