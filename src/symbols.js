// ─── ElectroDSL Symbol Library v2 ────────────────────────────────────────────
// Each symbol:
//   - draws itself centered at (0,0)
//   - declares named pins with EXACT pixel coordinates (relative to center)
//   - pin coords are the wire connection points (tips of lead lines)
//   - pins are numbered and labeled for display
//   - rotation is applied EXTERNALLY in renderer via SVG transform

window.ElectroSymbols = (function () {

  const C = {
    vsource:'#60A5FA', isource:'#A78BFA',
    resistor:'#F87171', capacitor:'#34D399', inductor:'#FBBF24',
    diode:'#FB923C', led:'#F472B6', zener:'#FF6B6B', schottky:'#FFA07A',
    npn:'#C084FC', pnp:'#C084FC', nmos:'#818CF8', pmos:'#818CF8',
    opamp:'#38BDF8', jfet:'#7DD3FC',
    ground:'#64748B', vcc:'#FCD34D', node:'#34D399',
    transformer:'#E879F9', sw:'#94A3B8',
    thyristor:'#F59E0B', default:'#60A5FA'
  };

  // ── PIN DEFINITIONS ─────────────────────────────────────────────────────────
  // Each entry: { num, name, x, y }
  // x,y = pixel offset from symbol center (0,0), before rotation
  // These are the EXACT wire attachment points

  const PINS = {
    VSource: [
      { num:1, name:'p', x:0,  y:-28 },   // positive terminal (top)
      { num:2, name:'n', x:0,  y: 28 },   // negative terminal (bottom)
    ],
    ISource: [
      { num:1, name:'p', x:0,  y:-28 },
      { num:2, name:'n', x:0,  y: 28 },
    ],
    Resistor: [
      { num:1, name:'1', x:-28, y:0 },
      { num:2, name:'2', x: 28, y:0 },
    ],
    Capacitor: [
      { num:1, name:'p', x:-28, y:0 },
      { num:2, name:'n', x: 28, y:0 },
    ],
    Inductor: [
      { num:1, name:'1', x:-28, y:0 },
      { num:2, name:'2', x: 28, y:0 },
    ],
    Diode: [
      { num:1, name:'A', x:-28, y:0 },    // anode
      { num:2, name:'K', x: 28, y:0 },    // cathode
    ],
    LED: [
      { num:1, name:'A', x:-28, y:0 },
      { num:2, name:'K', x: 28, y:0 },
    ],
    Zener: [
      { num:1, name:'A', x:-28, y:0 },
      { num:2, name:'K', x: 28, y:0 },
    ],
    Schottky: [
      { num:1, name:'A', x:-28, y:0 },
      { num:2, name:'K', x: 28, y:0 },
    ],
    NPN: [
      { num:1, name:'B',  x:-28, y:  0 },   // base
      { num:2, name:'C',  x: 22, y:-28 },   // collector
      { num:3, name:'E',  x: 22, y: 28 },   // emitter
    ],
    PNP: [
      { num:1, name:'B',  x:-28, y:  0 },
      { num:2, name:'C',  x: 22, y:-28 },
      { num:3, name:'E',  x: 22, y: 28 },
    ],
    NMOS: [
      { num:1, name:'G',  x:-28, y:  0 },   // gate
      { num:2, name:'D',  x: 18, y:-28 },   // drain
      { num:3, name:'S',  x: 18, y: 28 },   // source
    ],
    PMOS: [
      { num:1, name:'G',  x:-28, y:  0 },
      { num:2, name:'D',  x: 18, y:-28 },
      { num:3, name:'S',  x: 18, y: 28 },
    ],
    OpAmp: [
      { num:1, name:'IN+', x:-28, y:-12 },
      { num:2, name:'IN-', x:-28, y: 12 },
      { num:3, name:'OUT', x: 28, y:  0 },
      { num:4, name:'V+',  x:  0, y:-22 },
      { num:5, name:'V-',  x:  0, y: 22 },
    ],
    Ground: [
      { num:1, name:'1', x:0, y:-14 },   // single connection point (top)
    ],
    VCC: [
      { num:1, name:'1', x:0, y: 14 },   // single connection point (bottom)
    ],
    Node: [
      { num:1, name:'1', x:0, y:0 },
    ],
    Switch: [
      { num:1, name:'1', x:-28, y:0 },
      { num:2, name:'2', x: 28, y:0 },
    ],
    Transformer: [
      { num:1, name:'P1', x:-26, y:-10 },
      { num:2, name:'P2', x:-26, y: 10 },
      { num:3, name:'S1', x: 26, y:-10 },
      { num:4, name:'S2', x: 26, y: 10 },
    ],
    JFET: [
      { num:1, name:'G', x:-28, y:  0 },
      { num:2, name:'D', x: 18, y:-28 },
      { num:3, name:'S', x: 18, y: 28 },
    ],
    Thyristor: [
      { num:1, name:'A',  x:-28, y:  0 },
      { num:2, name:'K',  x: 28, y:  0 },
      { num:3, name:'G',  x:  0, y: 28 },
    ],
  };

  // ── SYMBOL DRAWINGS ─────────────────────────────────────────────────────────
  // IMPORTANT: lead lines extend exactly to the pin coordinates defined above

  const symbols = {

    VSource(params) {
      const c = C.vsource;
      const isAC = params.toUpperCase().includes('AC');
      const inner = isAC
        ? `<path d="M-7 0 Q-3.5-8 0 0 Q3.5 8 7 0" fill="none" stroke="${c}" stroke-width="1.5"/>`
        : `<text y="-2" text-anchor="middle" font-size="9" fill="${c}" font-family="monospace" font-weight="700">+</text>
           <text y="9" text-anchor="middle" font-size="11" fill="${c}" font-family="monospace" font-weight="700">−</text>`;
      return `
        <line x1="0" y1="-28" x2="0" y2="-14" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <circle r="14" fill="#0D1117" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        ${inner}
        <line x1="0" y1="14" x2="0" y2="28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    ISource(params) {
      const c = C.isource;
      return `
        <line x1="0" y1="-28" x2="0" y2="-14" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <circle r="14" fill="#0D1117" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="0" y1="8" x2="0" y2="-8" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-4,-4 4,-4 0,-11" fill="${c}"/>
        <line x1="0" y1="14" x2="0" y2="28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    Resistor(params) {
      const c = C.resistor;
      return `
        <line x1="-28" y1="0" x2="-16" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <rect x="-16" y="-8" width="32" height="16" rx="2" fill="#1A0A0A" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="16" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    Capacitor(params) {
      const c = C.capacitor;
      return `
        <line x1="-28" y1="0" x2="-4" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-4" y1="-14" x2="-4" y2="14" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1=" 4" y1="-14" x2=" 4" y2="14" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="4" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    Inductor(params) {
      const c = C.inductor;
      return `
        <line x1="-28" y1="0" x2="-18" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M-18 0 Q-15-9-12 0 Q-9-9-6 0 Q-3-9 0 0 Q3-9 6 0 Q9-9 12 0 Q15-9 18 0" fill="none" stroke="${c}" stroke-width="1.5"/>
        <line x1="18" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    Diode(params) {
      const c = C.diode;
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-12,-11 12,0 -12,11" fill="#1A0800" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="12" y1="-12" x2="12" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="12" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    LED(params) {
      const c = C.led;
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-12,-11 12,0 -12,11" fill="#1A0010" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="12" y1="-12" x2="12" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="12" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="5" y1="-9" x2="12" y2="-18" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>
        <polygon points="12,-18 9,-14 15,-14" fill="${c}"/>
        <line x1="10" y1="-9" x2="17" y2="-18" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>
        <polygon points="17,-18 14,-14 20,-14" fill="${c}"/>
      `;
    },

    Zener(params) {
      const c = C.zener;
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-12,-11 12,0 -12,11" fill="#1A0000" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="9" y1="-13" x2="16" y2="-13" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="9" y1="-13" x2="9" y2="13" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="9" y1="13" x2="16" y2="13" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    Schottky(params) {
      const c = C.schottky;
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-12,-11 12,0 -12,11" fill="#1A0500" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="12" y1="-12" x2="12" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M9,-12 Q12,-12 12,-9" fill="none" stroke="${c}" stroke-width="1.5"/>
        <path d="M15,12 Q12,12 12,9"  fill="none" stroke="${c}" stroke-width="1.5"/>
        <line x1="12" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    NPN(params) {
      const c = C.npn;
      // Pins: B=(-28,0), C=(22,-28), E=(22,28)
      return `
        <line x1="-28" y1="0" x2="-2" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-2" y1="-20" x2="-2" y2="20" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-2" y1="-12" x2="22" y2="-28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-2" y1="12"  x2="22" y2="28"  stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="12,24 22,28 17,20" fill="${c}"/>
      `;
    },

    PNP(params) {
      const c = C.pnp;
      return `
        <line x1="-28" y1="0" x2="-2" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-2" y1="-20" x2="-2" y2="20" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-2" y1="-12" x2="22" y2="-28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-2" y1="12"  x2="22" y2="28"  stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-2,-9 5,-13 5,-5" fill="${c}"/>
      `;
    },

    NMOS(params) {
      const c = C.nmos;
      // Pins: G=(-28,0), D=(18,-28), S=(18,28)
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-12" y1="-18" x2="-12" y2="18" stroke="${c}" stroke-width="1.5"/>
        <line x1="-8" y1="-16" x2="-8" y2="-4"  stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-8" y1="-1"  x2="-8" y2="5"   stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-8" y1="8"   x2="-8" y2="16"  stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-8" y1="-10" x2="18" y2="-28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-8" y1=" 10" x2="18" y2=" 28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="8,24 18,28 13,20" fill="${c}"/>
        <line x1="-8" y1="0" x2="4" y2="0" stroke="${c}" stroke-width="1" stroke-dasharray="2,2"/>
      `;
    },

    PMOS(params) {
      const c = C.pmos;
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-12" y1="-18" x2="-12" y2="18" stroke="${c}" stroke-width="1.5"/>
        <line x1="-8" y1="-16" x2="-8" y2="-4"  stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-8" y1="-1"  x2="-8" y2="5"   stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-8" y1="8"   x2="-8" y2="16"  stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <line x1="-8" y1="-10" x2="18" y2="-28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-8" y1=" 10" x2="18" y2=" 28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-3,-8 -8,-10 -3,-4" fill="${c}"/>
        <line x1="-8" y1="0" x2="4" y2="0" stroke="${c}" stroke-width="1" stroke-dasharray="2,2"/>
      `;
    },

    OpAmp(params) {
      const c = C.opamp;
      // Pins: IN+=(-28,-12), IN-=(-28,12), OUT=(28,0), V+=(0,-22), V-=(0,22)
      return `
        <polygon points="-20,-22 -20,22 20,0" fill="#061318" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="-28" y1="-12" x2="-20" y2="-12" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-28" y1=" 12" x2="-20" y2=" 12" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1=" 20" y1="  0" x2=" 28" y2="  0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <text x="-15" y="-8"  font-size="8" fill="${c}" font-family="monospace" font-weight="700">+</text>
        <text x="-15" y="16"  font-size="9" fill="${c}" font-family="monospace" font-weight="700">−</text>
      `;
    },

    Ground(params) {
      const c = C.ground;
      return `
        <line x1="0" y1="-14" x2="0" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-18" y1="0" x2="18" y2="0" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-11" y1="7" x2="11" y2="7" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="-5"  y1="14" x2="5" y2="14" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>
      `;
    },

    VCC(params) {
      const c = C.vcc;
      return `
        <line x1="0" y1="14" x2="0" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-16" y1="0" x2="16" y2="0" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
      `;
    },

    Node(params) {
      return `<circle r="5" fill="${C.node}" stroke="${C.node}" stroke-width="1"/>`;
    },

    Switch(params) {
      const c = C.sw;
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="-12" cy="0" r="3" fill="${c}"/>
        <line x1="-12" y1="0" x2="10" y2="-12" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="12" cy="0" r="3" fill="${c}"/>
        <line x1="12" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    Transformer(params) {
      const c = C.transformer;
      return `
        <path d="M-16,-12 Q-10,-22-4,-12 Q2,-22 8,-12" fill="none" stroke="${c}" stroke-width="1.5"/>
        <path d="M-16,2 Q-10,-8-4,2 Q2,-8 8,2" fill="none" stroke="${c}" stroke-width="1.5"/>
        <line x1="10" y1="-20" x2="10" y2="20" stroke="${c}" stroke-width="1.5"/>
        <line x1="-26" y1="-10" x2="-16" y2="-10" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-26" y1=" 10" x2="-16" y2=" 10" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M14,-12 Q20,-22 26,-12 Q32,-22 38,-12" fill="none" stroke="${c}" stroke-width="1.5"/>
        <path d="M14,2 Q20,-8 26,2 Q32,-8 38,2" fill="none" stroke="${c}" stroke-width="1.5"/>
        <line x1="12" y1="-20" x2="12" y2="20" stroke="${c}" stroke-width="1.5"/>
        <line x1="38" y1="-10" x2="26" y2="-10" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="38" y1=" 10" x2="26" y2=" 10" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },

    JFET(params) {
      const c = C.jfet;
      return `
        <line x1="-28" y1="0" x2="-6" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-6" y1="-20" x2="-6" y2="20" stroke="${c}" stroke-width="2"/>
        <line x1="-6" y1="-10" x2="18" y2="-28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-6" y1=" 10" x2="18" y2=" 28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="6,24 18,28 12,20" fill="${c}"/>
      `;
    },

    Thyristor(params) {
      const c = C.thyristor;
      // Pins: A=(-28,0), K=(28,0), G=(0,28)
      return `
        <line x1="-28" y1="0" x2="-12" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="-12,-12 12,0 -12,12" fill="#1A0500" stroke="${c}" stroke-width="1.5" class="component-outline"/>
        <line x1="12" y1="-12" x2="12" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="12" y1="0"  x2="28" y2="0"  stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="0"  y1="12" x2="0"  y2="28" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    },
  };

  symbols._default = function(type, params) {
    const c = C.default;
    return `
      <line x1="-28" y1="0" x2="-18" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="-18" y="-14" width="36" height="28" rx="3" fill="#061318" stroke="${c}" stroke-width="1.5" class="component-outline"/>
      <text y="4" text-anchor="middle" font-size="8" fill="${c}" font-family="monospace">${type.substring(0,5)}</text>
      <line x1="18" y1="0" x2="28" y2="0" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
    `;
  };

  // ── Public API ──────────────────────────────────────────────────────────────

  function getSymbol(type, params='') {
    // Check custom symbol registry first
    if (ElectroSymbols._custom && ElectroSymbols._custom[type]) {
      const sym = ElectroSymbols._custom[type];
      if (sym.svgBody) return sym.svgBody;
      // Auto-generate rectangle body with lead stubs from pin positions
      return _generateCustomSVG(sym);
    }
    const fn = symbols[type] || symbols._default.bind(null, type);
    return fn(params);
  }

  function _generateCustomSVG(sym) {
    const c = sym.color || C.default;
    const pins = sym.pins || [];
    // Find bounding box of all pin coords
    const xs = pins.map(p => Math.abs(p.x || 0));
    const ys = pins.map(p => Math.abs(p.y || 0));
    const hw = Math.max(20, ...xs) - 10; // half-width of body
    const hh = Math.max(20, ...ys) - 10; // half-height of body
    let svg = `<rect x="${-hw}" y="${-hh}" width="${hw*2}" height="${hh*2}" rx="3" fill="#061318" stroke="${c}" stroke-width="1.5" class="component-outline"/>`;
    svg += `<text y="4" text-anchor="middle" font-size="8" fill="${c}" font-family="monospace" font-weight="600">${sym.id.substring(0,6)}</text>`;
    pins.forEach(pin => {
      // Draw stub from body edge to pin tip
      const px = pin.x || 0, py = pin.y || 0;
      const edgeX = px > 0 ? hw : px < 0 ? -hw : 0;
      const edgeY = py > 0 ? hh : py < 0 ? -hh : 0;
      svg += `<line x1="${edgeX}" y1="${edgeY}" x2="${px}" y2="${py}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`;
    });
    return svg;
  }

  function getColor(type) {
    if (ElectroSymbols._custom && ElectroSymbols._custom[type]) {
      return ElectroSymbols._custom[type].color || C.default;
    }
    const t = type.toLowerCase();
    for (const k of Object.keys(C)) { if (t.includes(k)) return C[k]; }
    return C.default;
  }

  // Get pin definitions for a type
  function getPins(type) {
    if (ElectroSymbols._custom && ElectroSymbols._custom[type]) {
      return ElectroSymbols._custom[type].pins || [{ num:1, name:'1', x:-28, y:0 }, { num:2, name:'2', x:28, y:0 }];
    }
    return PINS[type] || [
      { num:1, name:'1', x:-28, y:0 },
      { num:2, name:'2', x: 28, y:0 },
    ];
  }

  // Resolve a named pin to its pixel offset, respecting rotation
  // pinName can be: pin name (e.g. 'B'), pin number as string (e.g. '1'), or 'auto' (first pin)
  // rotation is degrees (0, 90, 180, 270)
  function resolvePinOffset(type, pinName, rotation) {
    const pins = getPins(type);
    let pin;
    if (!pinName || pinName === 'auto') {
      pin = pins[0];
    } else {
      pin = pins.find(p => p.name.toLowerCase() === pinName.toLowerCase())
         || pins.find(p => String(p.num) === String(pinName))
         || pins[0];
    }
    if (!pin) return { x:0, y:0 };

    // Apply rotation
    const rad = ((rotation || 0) * Math.PI) / 180;
    const cos = Math.round(Math.cos(rad));
    const sin = Math.round(Math.sin(rad));
    return {
      x: cos * pin.x - sin * pin.y,
      y: sin * pin.x + cos * pin.y,
    };
  }

  // Get all pins with their rotated world offsets
  function getRotatedPins(type, rotation) {
    return getPins(type).map(pin => {
      const off = resolvePinOffset(type, pin.name, rotation);
      return { ...pin, ...off };
    });
  }

  return { getSymbol, getColor, getPins, resolvePinOffset, getRotatedPins };
})();
