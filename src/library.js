// ─── ElectroDSL Symbol Library Manager ───────────────────────────────────────
// Manages built-in + user-imported custom symbols.
// Custom symbols are stored in localStorage as JSON.
// Each symbol definition:
// {
//   id: "MyIC",           // unique type name used in DSL
//   name: "My IC",        // display name
//   category: "ICs",      // palette category
//   description: "...",
//   manufacturer: "...",
//   datasheet: "...",
//   pins: [{ num, name, x, y, side }],  // side: left|right|top|bottom
//   defaultParams: "...",  // default params string
//   defaultValue: "...",
//   svgBody: "...",        // raw SVG inner markup (centered at 0,0)
//   color: "#60A5FA",
//   boundingBox: { w, h }, // half-widths from center
// }

window.ElectroLibrary = (function () {

  const STORAGE_KEY = 'electrodsl_custom_symbols';

  // ── Built-in symbol catalogue (metadata only — drawings come from symbols.js)
  const BUILTIN = [
    // Sources
    { id:'VSource',  name:'Voltage Source', category:'Sources', description:'Ideal voltage source (DC or AC)', manufacturer:'Generic', defaultParams:'5V,DC', defaultValue:'5V', pins:[{num:1,name:'p'},{num:2,name:'n'}] },
    { id:'ISource',  name:'Current Source', category:'Sources', description:'Ideal current source', manufacturer:'Generic', defaultParams:'1mA', defaultValue:'1mA', pins:[{num:1,name:'p'},{num:2,name:'n'}] },
    // Passives
    { id:'Resistor', name:'Resistor', category:'Passives', description:'Fixed resistor (IEC/ANSI)', manufacturer:'Generic', defaultParams:'10k', defaultValue:'10kΩ', pins:[{num:1,name:'1'},{num:2,name:'2'}] },
    { id:'Capacitor',name:'Capacitor', category:'Passives', description:'Capacitor (polarised or non-polarised)', manufacturer:'Generic', defaultParams:'100nF', defaultValue:'100nF', pins:[{num:1,name:'p'},{num:2,name:'n'}] },
    { id:'Inductor', name:'Inductor', category:'Passives', description:'Inductor / coil', manufacturer:'Generic', defaultParams:'10mH', defaultValue:'10mH', pins:[{num:1,name:'1'},{num:2,name:'2'}] },
    // Semiconductors
    { id:'Diode',    name:'Diode', category:'Semiconductors', description:'Rectifier diode', manufacturer:'Generic', defaultParams:'1N4148', defaultValue:'1N4148', pins:[{num:1,name:'A'},{num:2,name:'K'}] },
    { id:'LED',      name:'LED', category:'Semiconductors', description:'Light-emitting diode', manufacturer:'Generic', defaultParams:'red', defaultValue:'red', pins:[{num:1,name:'A'},{num:2,name:'K'}] },
    { id:'Zener',    name:'Zener Diode', category:'Semiconductors', description:'Zener / voltage reference', manufacturer:'Generic', defaultParams:'5.1V', defaultValue:'5.1V', pins:[{num:1,name:'A'},{num:2,name:'K'}] },
    { id:'Schottky', name:'Schottky Diode', category:'Semiconductors', description:'Schottky barrier diode', manufacturer:'Generic', defaultParams:'1N5819', defaultValue:'1N5819', pins:[{num:1,name:'A'},{num:2,name:'K'}] },
    { id:'NPN',      name:'NPN Transistor', category:'Semiconductors', description:'NPN BJT transistor', manufacturer:'Generic', defaultParams:'2N2222', defaultValue:'2N2222', pins:[{num:1,name:'B'},{num:2,name:'C'},{num:3,name:'E'}] },
    { id:'PNP',      name:'PNP Transistor', category:'Semiconductors', description:'PNP BJT transistor', manufacturer:'Generic', defaultParams:'2N3906', defaultValue:'2N3906', pins:[{num:1,name:'B'},{num:2,name:'C'},{num:3,name:'E'}] },
    { id:'NMOS',     name:'N-Channel MOSFET', category:'Semiconductors', description:'Enhancement mode NMOS', manufacturer:'Generic', defaultParams:'2N7000', defaultValue:'2N7000', pins:[{num:1,name:'G'},{num:2,name:'D'},{num:3,name:'S'}] },
    { id:'PMOS',     name:'P-Channel MOSFET', category:'Semiconductors', description:'Enhancement mode PMOS', manufacturer:'Generic', defaultParams:'IRF9540', defaultValue:'IRF9540', pins:[{num:1,name:'G'},{num:2,name:'D'},{num:3,name:'S'}] },
    { id:'OpAmp',    name:'Op-Amp', category:'Semiconductors', description:'Operational amplifier', manufacturer:'Generic', defaultParams:'LM741', defaultValue:'LM741', pins:[{num:1,name:'IN+'},{num:2,name:'IN-'},{num:3,name:'OUT'},{num:4,name:'V+'},{num:5,name:'V-'}] },
    { id:'JFET',     name:'JFET', category:'Semiconductors', description:'Junction field-effect transistor', manufacturer:'Generic', defaultParams:'J201', defaultValue:'J201', pins:[{num:1,name:'G'},{num:2,name:'D'},{num:3,name:'S'}] },
    { id:'Thyristor',name:'Thyristor / SCR', category:'Semiconductors', description:'Silicon controlled rectifier', manufacturer:'Generic', defaultParams:'TYN612', defaultValue:'TYN612', pins:[{num:1,name:'A'},{num:2,name:'K'},{num:3,name:'G'}] },
    // Connections
    { id:'Ground',   name:'Ground', category:'Connections', description:'Ground reference (0V)', manufacturer:'Generic', defaultParams:'', defaultValue:'', pins:[{num:1,name:'1'}] },
    { id:'VCC',      name:'VCC Power Rail', category:'Connections', description:'Positive power supply rail', manufacturer:'Generic', defaultParams:'5V', defaultValue:'5V', pins:[{num:1,name:'1'}] },
    { id:'Node',     name:'Net Label / Junction', category:'Connections', description:'Named net junction', manufacturer:'Generic', defaultParams:'', defaultValue:'', pins:[{num:1,name:'1'}] },
    // Misc
    { id:'Switch',      name:'Switch', category:'Misc', description:'Single-pole switch', manufacturer:'Generic', defaultParams:'', defaultValue:'', pins:[{num:1,name:'1'},{num:2,name:'2'}] },
    { id:'Transformer', name:'Transformer', category:'Misc', description:'Coupled inductors', manufacturer:'Generic', defaultParams:'', defaultValue:'', pins:[{num:1,name:'P1'},{num:2,name:'P2'},{num:3,name:'S1'},{num:4,name:'S2'}] },
  ];

  // ── Custom symbol storage ──────────────────────────────────────────────────

  function loadCustom() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  function saveCustom(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function addCustomSymbol(sym) {
    const list = loadCustom();
    const existing = list.findIndex(s => s.id === sym.id);
    if (existing >= 0) list[existing] = sym;
    else list.push(sym);
    saveCustom(list);
    // Register in symbols.js runtime
    registerCustomInRuntime(sym);
    return sym;
  }

  function deleteCustomSymbol(id) {
    const list = loadCustom().filter(s => s.id !== id);
    saveCustom(list);
  }

  function getAll() {
    return [...BUILTIN, ...loadCustom()];
  }

  function getById(id) {
    return getAll().find(s => s.id === id) || null;
  }

  function getCategories() {
    const cats = {};
    getAll().forEach(sym => {
      if (!cats[sym.category]) cats[sym.category] = [];
      cats[sym.category].push(sym);
    });
    return cats;
  }

  function isCustom(id) {
    return loadCustom().some(s => s.id === id);
  }

  // ── Register custom symbol into ElectroSymbols at runtime ─────────────────
  function registerCustomInRuntime(sym) {
    if (!window.ElectroSymbols) return;
    // Patch getSymbol and getPins to include custom symbol
    // We store custom registrations on the module itself
    if (!ElectroSymbols._custom) ElectroSymbols._custom = {};
    ElectroSymbols._custom[sym.id] = sym;
  }

  // Boot: register all saved customs
  function bootCustomSymbols() {
    loadCustom().forEach(registerCustomInRuntime);
  }

  // ── Import from JSON file ──────────────────────────────────────────────────
  function importFromJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const symbols = Array.isArray(data) ? data : [data];
      const errors = [];
      const added = [];

      symbols.forEach(sym => {
        // Validate required fields
        if (!sym.id || !sym.name || !sym.pins || !Array.isArray(sym.pins)) {
          errors.push(`Invalid symbol: missing id, name, or pins`);
          return;
        }
        if (!sym.category) sym.category = 'Custom';
        if (!sym.defaultParams) sym.defaultParams = '';
        if (!sym.defaultValue) sym.defaultValue = '';
        if (!sym.color) sym.color = '#60A5FA';
        if (!sym.svgBody) sym.svgBody = generateDefaultSVG(sym);
        added.push(addCustomSymbol(sym));
      });

      return { added, errors };
    } catch (e) {
      return { added: [], errors: [`JSON parse error: ${e.message}`] };
    }
  }

  // Generate a default rectangular IC-style SVG body for custom symbols
  function generateDefaultSVG(sym) {
    const c = sym.color || '#60A5FA';
    const pins = sym.pins || [];
    const w = 28, h = Math.max(28, pins.length * 10);
    let svg = `<rect x="${-w}" y="${-h}" width="${w*2}" height="${h*2}" rx="3" fill="#061318" stroke="${c}" stroke-width="1.5" class="component-outline"/>`;
    svg += `<text y="4" text-anchor="middle" font-size="8" fill="${c}" font-family="monospace" font-weight="600">${sym.id.substring(0,6)}</text>`;
    // Draw lead stubs for each pin
    pins.forEach((pin, i) => {
      const px = pin.x || (i % 2 === 0 ? -w-10 : w+10);
      const py = pin.y || (-h + 10 + i * 12);
      const lx = pin.x || (i % 2 === 0 ? -w : w);
      svg += `<line x1="${px}" y1="${py}" x2="${lx}" y2="${py}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`;
    });
    return svg;
  }

  // ── DSL snippet generator ──────────────────────────────────────────────────
  // Generates the DSL line for inserting a symbol into the schematic
  function toDSLSnippet(sym, id, x, y) {
    const params = sym.defaultParams || '';
    const label = id;
    const value = sym.defaultValue || sym.defaultParams || '';
    const paramStr = params ? `(${params})` : '';
    let line = `${id}: ${sym.id}${paramStr} at (${x}, ${y}) label="${label}"`;
    if (value) line += ` value="${value}"`;
    return line;
  }

  return {
    getAll, getById, getCategories, isCustom,
    loadCustom,
    addCustomSymbol, deleteCustomSymbol,
    importFromJSON,
    toDSLSnippet,
    bootCustomSymbols,
    BUILTIN,
  };
})();
