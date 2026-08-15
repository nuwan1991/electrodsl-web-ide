// ─── ElectroDSL App Controller v3 ────────────────────────────────────────────
// Features: unique net names on every wire, symbol library import/create,
//           drag component → auto-insert DSL, bidirectional canvas↔editor sync
(function () {

  // ── Circuit examples ────────────────────────────────────────────────────────
  const EXAMPLES = {
    rc:`CIRCUIT "RC Low-Pass Filter" {
  V1:   VSource(5V,AC)   at (1, 5) label="Vin"
  R1:   Resistor(10k)    at (4, 5) label="R1"  value="10kΩ"
  C1:   Capacitor(100nF) at (7, 5) label="C1"  value="100nF"
  GND1: Ground           at (1, 3)
  GND2: Ground           at (7, 3)
  VOUT: Node             at (7, 5) label="Vout"
  wire V1.p   -> R1.1
  wire R1.2   -> C1.p
  wire C1.p   -> VOUT.1
  wire V1.n   -> GND1.1
  wire C1.n   -> GND2.1
}`,
    divider:`CIRCUIT "Voltage Divider" {
  V1:   VSource(12V,DC) at (1, 6) label="12V"
  R1:   Resistor(10k)   at (4, 7) label="R1"  value="10kΩ"
  R2:   Resistor(10k)   at (4, 5) label="R2"  value="10kΩ"
  VMID: Node            at (6, 6) label="Vout_6V"
  GND1: Ground          at (1, 4)
  GND2: Ground          at (7, 4)
  wire V1.p  -> R1.1
  wire R1.2  -> R2.1
  wire R1.2  -> VMID.1
  wire R2.2  -> GND2.1
  wire V1.n  -> GND1.1
}`,
    bridge:`CIRCUIT "Full-Wave Bridge Rectifier" {
  V1:  VSource(12V,AC)   at (1, 5) label="12VAC"
  D1:  Diode             at (3, 7) label="D1" value="1N4007"
  D2:  Diode             at (3, 3) label="D2" value="1N4007"
  D3:  Diode             at (7, 7) label="D3" value="1N4007"
  D4:  Diode             at (7, 3) label="D4" value="1N4007"
  C1:  Capacitor(1000uF) at (10,5) label="C1" value="1000µF"
  RL:  Resistor(1k)      at (12,5) label="RL" value="1kΩ"
  GND1: Ground           at (1, 3)
  GND2: Ground           at (12,3)
  VPOS: Node             at (10,7) label="Vdc_pos"
  wire V1.p  -> D1.A
  wire D1.K  -> VPOS.1
  wire D3.K  -> VPOS.1
  wire V1.n  -> GND1.1
  wire RL.2  -> GND2.1
  wire C1.p  -> VPOS.1
  wire C1.n  -> GND2.1
}`,
    amplifier:`CIRCUIT "NPN Common-Emitter Amplifier" {
  VCC1: VCC(12V)        at (7, 10) label="VCC"
  Vin:  VSource(1V,AC)  at (1,  5) label="Vin"
  RB1:  Resistor(100k)  at (4,  8) label="RB1" value="100kΩ"
  RB2:  Resistor(22k)   at (4,  5) label="RB2" value="22kΩ"
  RC1:  Resistor(4.7k)  at (7,  8) label="RC"  value="4.7kΩ"
  RE1:  Resistor(1k)    at (7,  2) label="RE"  value="1kΩ"
  Cin:  Capacitor(10uF) at (3,  5) label="Cin" value="10µF"
  Cout: Capacitor(10uF) at (10, 6) label="Cout"value="10µF"
  Q1:   NPN(2N2222)     at (7,  5) label="Q1"  value="2N2222"
  GND1: Ground          at (1,  3)
  GND2: Ground          at (7,  0)
  VOUT: Node            at (11, 6) label="Vout"
  wire Vin.p  -> Cin.p
  wire Cin.n  -> RB1.1
  wire Cin.n  -> RB2.1
  wire RB1.2  -> VCC1.1
  wire RB2.2  -> GND2.1
  wire Q1.C   -> RC1.1
  wire RC1.2  -> VCC1.1
  wire Q1.E   -> RE1.1
  wire RE1.2  -> GND2.1
  wire Q1.C   -> Cout.p
  wire Cout.n -> VOUT.1
  wire Vin.n  -> GND1.1
}`,
    opamp:`CIRCUIT "Inverting Op-Amp (Gain=-10)" {
  Vin:  VSource(1V,AC) at (1, 5) label="Vin"
  Rin:  Resistor(10k)  at (4, 5) label="Rin" value="10kΩ"
  Rf:   Resistor(100k) at (6, 7) label="Rf"  value="100kΩ"
  U1:   OpAmp(LM741)   at (8, 5) label="U1"  value="LM741"
  VCC1: VCC(15V)       at (8, 9) label="+15V"
  VGND: Ground         at (8, 3)
  GND1: Ground         at (1, 3)
  VOUT: Node           at (11,5) label="Vout"
  wire Vin.p  -> Rin.1
  wire Rin.2  -> U1.IN-
  wire U1.OUT -> VOUT.1
  wire U1.OUT -> Rf.2
  wire Rf.1   -> U1.IN-
  wire U1.IN+ -> VGND.1
  wire VCC1.1 -> U1.V+
  wire Vin.n  -> GND1.1
}`,
    '555timer':`CIRCUIT "555 Astable Oscillator" {
  VCC1: VCC(9V)          at (6, 9) label="+9V"
  RA:   Resistor(4.7k)   at (4, 8) label="RA"   value="4.7kΩ"
  RB:   Resistor(47k)    at (4, 6) label="RB"   value="47kΩ"
  CT:   Capacitor(10nF)  at (2, 5) label="Ct"   value="10nF"
  CC:   Capacitor(10nF)  at (8, 5) label="Cc"   value="10nF"
  RLED: Resistor(470)    at (10,8) label="Rled" value="470Ω"
  LED1: LED(red)         at (10,6) label="LED"  value="red"
  GND1: Ground           at (2, 3)
  GND2: Ground           at (8, 3)
  GND3: Ground           at (10,4)
  OUT:  Node             at (9, 7) label="Freq_Out"
  wire VCC1.1 -> RA.1
  wire RA.2   -> RB.1
  wire RB.2   -> CT.p
  wire CT.n   -> GND1.1
  wire VCC1.1 -> RLED.1
  wire RLED.2 -> LED1.A
  wire LED1.K -> OUT.1
  wire CC.n   -> GND2.1
}`,
    pwm:`CIRCUIT "MOSFET PWM Switch" {
  VCC1:  VCC(12V)       at (9, 9) label="+12V"
  Vg:    VSource(5V,DC) at (1, 4) label="Gate"
  Rg:    Resistor(100)  at (4, 4) label="Rg"   value="100Ω"
  M1:    NMOS(IRF540)   at (7, 4) label="M1"   value="IRF540"
  Rload: Resistor(10)   at (9, 7) label="Load" value="10Ω"
  Dfr:   Diode          at (11,5) label="Dfr"  value="Freewheeling"
  GND1:  Ground         at (1, 2)
  GND2:  Ground         at (7, 2)
  GND3:  Ground         at (11,3)
  VDRN:  Node           at (7, 7) label="Drain_Node"
  wire Vg.p    -> Rg.1
  wire Rg.2    -> M1.G
  wire M1.D    -> Rload.1
  wire Rload.2 -> VCC1.1
  wire M1.D    -> VDRN.1
  wire M1.S    -> GND2.1
  wire Vg.n    -> GND1.1
  wire Dfr.K   -> VCC1.1
  wire Dfr.A   -> GND3.1
}`,
    lc:`CIRCUIT "LC Tank Resonator" {
  V1:    VSource(5V,AC)  at (1, 5) label="RF_In"
  L1:    Inductor(100uH) at (4, 7) label="L1"    value="100µH"
  C1:    Capacitor(100pF)at (4, 3) label="C1"    value="100pF"
  Rload: Resistor(50)    at (9, 5) label="Rload" value="50Ω"
  GND1:  Ground          at (1, 3)
  GND2:  Ground          at (4, 1)
  GND3:  Ground          at (9, 3)
  VOUT:  Node            at (9, 7) label="RF_Out"
  wire V1.p    -> L1.1
  wire L1.2    -> C1.p
  wire C1.n    -> GND2.1
  wire L1.2    -> VOUT.1
  wire VOUT.1  -> Rload.1
  wire Rload.2 -> GND3.1
  wire V1.n    -> GND1.1
}`,
  };

  // ── State ───────────────────────────────────────────────────────────────────
  let _ast = null;
  let _netResult = null;
  let _pinNumbersVisible = true;
  let _gridVisible = true;
  let _schemBgColor = '#0D1117';
  let _dragSymbol = null;   // symbol being dragged from palette

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    ElectroLibrary.bootCustomSymbols();

    const svg        = document.getElementById('schematic-svg');
    const root       = document.getElementById('schematic-root');
    const editorPane = document.getElementById('editor-pane');
    const editor     = document.getElementById('code-editor');
    const gutter     = document.getElementById('code-gutter');

    // ── File Manager init ──
    ElectroFileManager.init(
      () => ElectroEditor.getValue(),
      (code) => { ElectroEditor.setValue(code); renderCurrent(); },
      (isDirty, filename) => updateFileUI(isDirty, filename)
    );
    updateFileUI(false, null);

    // Phase 4: canvas → editor
    ElectroRenderer.init(svg, root, (id, comp) => {
      if (id && _ast) {
        ElectroEditor.highlightComponentLine(id, _ast);
        const info = comp ? `${id}: ${comp.type}(${comp.params||''}) rot=${comp.rotate||0}°` : '';
        setStatus(info ? `Selected: ${info}` : '');
        document.getElementById('selected-info').textContent = comp ? `${id} · ${comp.type}` : '';
      }
    });

    // ── Tools init ──
    ElectroTools.init(
      svg, root,
      () => ElectroEditor.getValue(),
      (newCode, fullRender) => {
        ElectroEditor.setValue(newCode);
        ElectroFileManager.markDirty();
        if (fullRender !== false) renderCurrent();
        else {
          const ast  = ElectroParser.parse(newCode);
          const laid = ElectroAutoLayout.layout(ast);
          _ast       = laid;
          _netResult = ElectroNetManager.buildNets(laid);
          ElectroEditor.setAST(laid);
          ElectroTools.setAST(laid, ElectroParser.getBounds(laid).maxY + 1);
          ElectroRenderer.render(laid, _netResult);
        }
      },
      (toolName) => updateToolUI(toolName),
      // Bug fix: wire selection → highlight matching DSL line
      (wire) => {
        if (!wire) return;
        highlightWireDSLLine(wire);
      }
    );

    // Tool palette buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ElectroTools.setTool(btn.dataset.tool);
      });
    });

    // Phase 4: editor → canvas (live) + mark dirty
    ElectroEditor.init(editorPane, editor, gutter, () => {
      ElectroFileManager.markDirty();
      renderCurrent();
    });

    // Preview toggle
    document.getElementById('btn-preview-toggle').addEventListener('click', function() {
      const on = ElectroEditor.togglePreview();
      this.classList.toggle('active', on);
    });

    svg.addEventListener('click', e => {
      if (e.target === svg || e.target.id === 'grid-bg') {
        ElectroRenderer.clearSelection();
        document.getElementById('selected-info').textContent = '';
      }
    });

    // ── File buttons ──
    document.getElementById('btn-new').addEventListener('click', () => {
      if (ElectroFileManager.newFile()) { renderCurrent(); setStatus('New circuit'); }
    });
    document.getElementById('btn-open').addEventListener('click', () => {
      ElectroFileManager.openFile(result => {
        if (result.error) { setStatus('✗ ' + result.error); return; }
        renderCurrent();
        setStatus(`✓ Opened: ${result.filename}`);
      });
    });
    document.getElementById('btn-save').addEventListener('click', () => {
      const r = ElectroFileManager.saveFile();
      if (r.ok) { setStatus(`✓ Saved: ${r.filename}`); showAutosaveToast('Saved!'); }
      else setStatus('✗ ' + r.error);
    });
    document.getElementById('btn-save-as').addEventListener('click', () => {
      const r = ElectroFileManager.saveFileAs();
      if (r && r.ok) { setStatus(`✓ Saved as: ${r.filename}`); showAutosaveToast('Saved!'); }
    });
    document.getElementById('btn-recent').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRecentDropdown();
    });
    document.getElementById('btn-clear-recent').addEventListener('click', () => {
      ElectroFileManager.clearRecent();
      renderRecentDropdown();
    });

    // Close recent dropdown when clicking elsewhere
    document.addEventListener('click', () => closeRecentDropdown());

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 's' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-save').click(); }
      if (e.key === 's' &&  e.shiftKey) { e.preventDefault(); document.getElementById('btn-save-as').click(); }
      if (e.key === 'o') { e.preventDefault(); document.getElementById('btn-open').click(); }
      if (e.key === 'n') { e.preventDefault(); document.getElementById('btn-new').click(); }
    });

    // ── Other toolbar ──
    document.getElementById('btn-render').addEventListener('click', renderCurrent);
    document.getElementById('btn-export-svg').addEventListener('click', exportSVG);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-export-spice').addEventListener('click', showSpice);
    document.getElementById('btn-show-nets').addEventListener('click', showNets);
    document.getElementById('btn-format').addEventListener('click', () => { ElectroEditor.format(); setStatus('Formatted'); });
    document.getElementById('btn-copy-code').addEventListener('click', copyCode);
    document.getElementById('btn-zoom-in').addEventListener('click', () => ElectroRenderer.setZoom(ElectroRenderer.getZoom() * 1.25));
    document.getElementById('btn-zoom-out').addEventListener('click', () => ElectroRenderer.setZoom(ElectroRenderer.getZoom() / 1.25));
    document.getElementById('btn-zoom-fit').addEventListener('click', () => ElectroRenderer.fitToView());
    document.getElementById('btn-pin-toggle').addEventListener('click', function() {
      _pinNumbersVisible = !_pinNumbersVisible;
      this.classList.toggle('active', _pinNumbersVisible);
      ElectroRenderer.togglePinNumbers(_pinNumbersVisible);
      setStatus(`Pin numbers ${_pinNumbersVisible ? 'shown' : 'hidden'}`);
    });
    document.getElementById('btn-grid-toggle').addEventListener('click', toggleGrid);

    // ── Grid scale and subdivision controls ──
    document.getElementById('grid-scale-select').addEventListener('change', function () {
      ElectroGrid.setGrid(parseInt(this.value));
    });
    document.getElementById('grid-sub-select').addEventListener('change', function () {
      ElectroGrid.setSub(parseInt(this.value));
    });

    // When grid changes: update SVG patterns and re-render
    ElectroGrid.onChange((grid, sub) => {
      ElectroGrid.updateSVGPatterns();
      if (_ast) {
        ElectroRenderer.render(_ast, _netResult);
        const bounds = ElectroParser.getBounds(_ast);
        ElectroTools.setAST(_ast, bounds.maxY + 1);
        setTimeout(() => ElectroRenderer.fitToView(), 30);
      }
    });

    // Init grid patterns on startup
    ElectroGrid.updateSVGPatterns();

    // ── Background colour picker ──
    const bgPicker = document.getElementById('schematic-bg-color');
    if (bgPicker) {
      bgPicker.addEventListener('input', function () {
        applySchematicBg(this.value);
      });
      // Set initial bg
      applySchematicBg(bgPicker.value);
    }

    // Overlay panel
    document.getElementById('btn-copy-overlay').addEventListener('click', copyOverlay);
    document.getElementById('btn-close-overlay').addEventListener('click', () =>
      document.getElementById('overlay-panel').classList.add('hidden'));
    document.querySelectorAll('.otab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.otab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.otab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('otab-' + tab.dataset.otab).classList.add('active');
      });
    });

    // ── Palette tabs ──
    document.querySelectorAll('.ptab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ptab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Palette search
    document.getElementById('palette-search').addEventListener('input', function() {
      buildBuiltinPalette(this.value.toLowerCase());
    });

    // ── Library panel ──
    document.getElementById('btn-import-sym').addEventListener('click', openImportModal);
    document.getElementById('btn-add-sym').addEventListener('click', openCreateModal);
    document.getElementById('btn-export-lib').addEventListener('click', exportLibrary);

    // ── AI ──
    document.getElementById('ai-generate-btn').addEventListener('click', runAI);
    document.getElementById('ai-input').addEventListener('keydown', e => { if (e.key === 'Enter') runAI(); });

    // ── Examples ──
    document.querySelectorAll('.example-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.example;
        if (EXAMPLES[key]) { ElectroEditor.setValue(EXAMPLES[key]); renderCurrent(); setStatus('Loaded: ' + btn.textContent); }
      });
    });

    // ── Canvas drop zone for palette drag ──
    setupDropZone();

    // ── Modal ──
    setupModal();

    // Build palettes
    buildBuiltinPalette('');
    buildLibraryList();

    // Load default
    ElectroEditor.setValue(EXAMPLES.rc);
    renderCurrent();
  }

  // ── Tool UI ─────────────────────────────────────────────────────────────────
  const TOOL_HINTS = {
    select:         'Click to select · Drag to move · Double-click to rotate',
    wire:           'Click pin to start · Click empty space to add bend · Click target pin to finish · Esc to cancel',
    join:           'Click on any wire to insert a junction node and split it',
    rotate:         'Click component to rotate 90° · V to return to Select',
    'delete-wire':  'Click a wire segment to delete it · V to return to Select',
    delete:         'Click component to delete it and its wires · V to return to Select',
  };
  function updateToolUI(toolName) {
    document.querySelectorAll('.tool-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tool === toolName));
    const hint = document.getElementById('tool-hint');
    if (hint) hint.textContent = TOOL_HINTS[toolName] || '';
    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
      wrapper.className = wrapper.className.replace(/\btool-\w+\b/g,'').trim();
      wrapper.classList.add('tool-' + toolName);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function renderCurrent() {
    const code = ElectroEditor.getValue();
    if (!code.trim()) { setStatus('Editor empty'); return; }

    const ast = ElectroParser.parse(code);

    // Errors
    const errPanel = document.getElementById('error-panel');
    const errMsg   = document.getElementById('error-msg');
    if (ast.errors.length) {
      errPanel.classList.remove('hidden');
      errMsg.textContent = ast.errors.map(e => `L${e.line+1}: ${e.msg}`).join(' │ ');
    } else {
      errPanel.classList.add('hidden');
    }

    const laid = ElectroAutoLayout.layout(ast);
    _ast = laid;

    // Build nets
    _netResult = ElectroNetManager.buildNets(laid);

    const nc = Object.keys(laid.components).length;
    const nw = laid.wires.length;
    const nn = Object.keys(_netResult.nets).length;

    ElectroRenderer.render(laid, _netResult);

    // Notify tools and editor of new AST
    const bounds = ElectroParser.getBounds(laid);
    ElectroEditor.setAST(laid);
    ElectroTools.setAST(laid, bounds.maxY + 1);

    setTimeout(() => ElectroRenderer.fitToView(), 60);

    document.getElementById('component-count').textContent = `${nc} comps · ${nw} wires`;
    document.getElementById('net-summary').textContent = `${nn} nets`;
    setStatus(`✓ "${laid.title}" · ${nc} components · ${nw} wires · ${nn} nets`);

    // Refresh overlay if open
    refreshOverlayIfOpen();
  }

  // ── Net list panel ──────────────────────────────────────────────────────────
  function showNets() {
    if (!_ast) { setStatus('Render first'); return; }
    const panel = document.getElementById('overlay-panel');
    if (!panel.classList.contains('hidden') &&
        document.getElementById('otab-nets').classList.contains('active')) {
      panel.classList.add('hidden'); return;
    }
    switchOverlayTab('nets');
    refreshNetList();
    panel.classList.remove('hidden');
  }

  function showSpice() {
    if (!_ast) { setStatus('Render first'); return; }
    const panel = document.getElementById('overlay-panel');
    if (!panel.classList.contains('hidden') &&
        document.getElementById('otab-spice').classList.contains('active')) {
      panel.classList.add('hidden'); return;
    }
    switchOverlayTab('spice');
    document.getElementById('spice-output').textContent = ElectroSPICE.toSPICE(_ast);
    panel.classList.remove('hidden');
  }

  function switchOverlayTab(name) {
    document.querySelectorAll('.otab').forEach(t => t.classList.toggle('active', t.dataset.otab === name));
    document.querySelectorAll('.otab-content').forEach(t => t.classList.toggle('active', t.id === 'otab-' + name));
  }

  function refreshNetList() {
    if (!_netResult) return;
    document.getElementById('net-list-content').innerHTML = ElectroNetManager.renderNetTable(_netResult);
  }

  function refreshOverlayIfOpen() {
    const panel = document.getElementById('overlay-panel');
    if (panel.classList.contains('hidden')) return;
    if (document.getElementById('otab-nets').classList.contains('active')) refreshNetList();
    else document.getElementById('spice-output').textContent = _ast ? ElectroSPICE.toSPICE(_ast) : '';
  }

  function copyOverlay() {
    const isNets = document.getElementById('otab-nets').classList.contains('active');
    let text;
    if (isNets && _netResult) {
      const { nets } = _netResult;
      text = Object.entries(nets).map(([n, pins]) => `${n}: ${pins.join(', ')}`).join('\n');
    } else {
      text = document.getElementById('spice-output').textContent;
    }
    navigator.clipboard.writeText(text).then(() => setStatus('Copied'));
  }

  // ── Drag-and-drop from palette → canvas ─────────────────────────────────────
  function setupDropZone() {
    const wrapper = document.getElementById('canvas-wrapper');
    const overlay = document.getElementById('drop-overlay');

    wrapper.addEventListener('dragover', e => {
      if (!_dragSymbol) return;
      e.preventDefault();
      wrapper.classList.add('drag-over');
      overlay.classList.remove('hidden');
    });

    wrapper.addEventListener('dragleave', e => {
      wrapper.classList.remove('drag-over');
      overlay.classList.add('hidden');
    });

    wrapper.addEventListener('drop', e => {
      e.preventDefault();
      wrapper.classList.remove('drag-over');
      overlay.classList.add('hidden');

      if (!_dragSymbol) return;

      // Convert drop position to DSL grid coordinates
      const rect = wrapper.getBoundingClientRect();
      const zoom = ElectroRenderer.getZoom();
      const panX = ElectroRenderer.getPanX();
      const panY = ElectroRenderer.getPanY();

      const canvasX = (e.clientX - rect.left - panX) / zoom;
      const canvasY = (e.clientY - rect.top  - panY) / zoom;

      const GRID = 80, PAD = 70;
      let gridX = Math.round((canvasX - PAD) / GRID);
      let gridY = Math.round((canvasY - PAD) / GRID);

      // Flip Y (DSL y increases upward, canvas y increases downward)
      // We need the maxY from current AST bounds
      const bounds = _ast ? ElectroParser.getBounds(_ast) : { maxY: 8 };
      const maxY   = bounds.maxY + 1;
      let dslY     = maxY - gridY;

      // Clamp to reasonable range
      gridX = Math.max(0, Math.min(14, gridX));
      dslY  = Math.max(0, Math.min(12, dslY));

      insertSymbolAt(_dragSymbol, gridX, dslY);
      _dragSymbol = null;
    });
  }

  // Auto-generate a unique component ID not already in the DSL
  function uniqueId(typeId) {
    const code = ElectroEditor.getValue();
    const prefix = typeId.substring(0, 2).toUpperCase();
    let n = 1;
    while (code.includes(`${prefix}${n}:`)) n++;
    return `${prefix}${n}`;
  }

  // Insert a symbol snippet into the DSL at given grid coords and re-render
  function insertSymbolAt(sym, x, y) {
    const id = uniqueId(sym.id);
    const snippet = ElectroLibrary.toDSLSnippet(sym, id, x, y);

    const val = ElectroEditor.getValue();
    const insertAt = val.lastIndexOf('}');
    const newCode = insertAt > -1
      ? val.substring(0, insertAt) + '\n  ' + snippet + '\n' + val.substring(insertAt)
      : val + '\n  ' + snippet;

    ElectroEditor.setValue(newCode);
    renderCurrent();
    setStatus(`Inserted: ${id} (${sym.name}) at (${x}, ${y})`);
  }

  // ── Palette builder ──────────────────────────────────────────────────────────
  function buildBuiltinPalette(filter) {
    const container = document.getElementById('palette-built-in');
    container.innerHTML = '';

    const cats = ElectroLibrary.getCategories();
    Object.entries(cats).forEach(([cat, syms]) => {
      const filtered = filter
        ? syms.filter(s => s.name.toLowerCase().includes(filter) || s.id.toLowerCase().includes(filter))
        : syms;
      if (!filtered.length) return;

      const sec = document.createElement('div');
      sec.className = 'palette-section';

      const title = document.createElement('div');
      title.className = 'palette-title';
      title.textContent = cat;
      sec.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'palette-grid';

      filtered.forEach(sym => {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.draggable = true;
        item.title = `${sym.name} — double-click or drag to schematic`;

        // Small SVG preview
        const svgStr = ElectroSymbols.getSymbol(sym.id, sym.defaultParams || '');
        item.innerHTML = `
          <svg width="36" height="36" viewBox="-30 -30 60 60" overflow="visible">
            ${svgStr}
          </svg>
          <span>${sym.name}</span>`;

        // Drag start
        item.addEventListener('dragstart', e => {
          _dragSymbol = sym;
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', sym.id);
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
        });

        // Double-click: insert at next available position
        item.addEventListener('dblclick', () => {
          const bounds = _ast ? ElectroParser.getBounds(_ast) : { maxX: 1, maxY: 4 };
          insertSymbolAt(sym, Math.min(14, bounds.maxX + 2), Math.max(1, Math.round((bounds.maxY + (bounds.minY||1)) / 2)));
        });

        grid.appendChild(item);
      });

      sec.appendChild(grid);
      container.appendChild(sec);
    });
  }

  function buildLibraryList() {
    const container = document.getElementById('lib-symbol-list');
    container.innerHTML = '';

    const cats = ElectroLibrary.getCategories();
    Object.entries(cats).forEach(([cat, syms]) => {
      const hdr = document.createElement('div');
      hdr.className = 'lib-category-header';
      hdr.textContent = cat;
      container.appendChild(hdr);

      syms.forEach(sym => {
        const item = document.createElement('div');
        item.className = 'lib-item';
        item.draggable = true;
        const isCustom = ElectroLibrary.isCustom(sym.id);
        const color = sym.color || '#60A5FA';

        item.innerHTML = `
          <div class="lib-item-icon">
            <svg width="28" height="28" viewBox="-28 -28 56 56" overflow="visible">
              ${ElectroSymbols.getSymbol(sym.id, sym.defaultParams || '')}
            </svg>
          </div>
          <div class="lib-item-info">
            <div class="lib-item-name">${sym.name}${isCustom ? '<span class="lib-custom-badge">custom</span>' : ''}</div>
            <div class="lib-item-desc">${sym.description || ''} ${sym.manufacturer ? '· ' + sym.manufacturer : ''}</div>
          </div>
          ${isCustom ? `<button class="lib-item-del" data-id="${sym.id}" title="Delete">✕</button>` : ''}
        `;

        // Drag
        item.addEventListener('dragstart', e => {
          _dragSymbol = sym;
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', sym.id);
        });

        // Double-click insert
        item.addEventListener('dblclick', () => {
          const bounds = _ast ? ElectroParser.getBounds(_ast) : { maxX: 1, maxY: 4 };
          insertSymbolAt(sym, Math.min(14, bounds.maxX + 2), Math.max(1, Math.round((bounds.maxY + (bounds.minY||1)) / 2)));
        });

        // Delete custom
        const del = item.querySelector('.lib-item-del');
        if (del) {
          del.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Delete custom symbol "${sym.name}"?`)) {
              ElectroLibrary.deleteCustomSymbol(sym.id);
              buildBuiltinPalette(document.getElementById('palette-search').value.toLowerCase());
              buildLibraryList();
              setStatus(`Deleted symbol: ${sym.id}`);
            }
          });
        }

        container.appendChild(item);
      });
    });
  }

  // ── Modal (import / create symbol) ──────────────────────────────────────────
  function setupModal() {
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });

    // Modal tabs
    document.querySelectorAll('.mtab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.mtab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('mtab-' + tab.dataset.mtab).classList.add('active');
      });
    });

    // Import button
    document.getElementById('btn-do-import').addEventListener('click', doImport);

    // Browse JSON file button inside modal
    document.getElementById('btn-browse-json').addEventListener('click', () => {
      document.getElementById('modal-file-input').click();
    });
    document.getElementById('modal-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('browse-filename').textContent = file.name;
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('import-json-text').value = ev.target.result;
        hideModalError('import');
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // File drag onto textarea
    const ta = document.getElementById('import-json-text');
    ta.addEventListener('dragover', e => e.preventDefault());
    ta.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      document.getElementById('browse-filename').textContent = file.name;
      const reader = new FileReader();
      reader.onload = ev => { ta.value = ev.target.result; };
      reader.readAsText(file);
    });

    // Create button
    document.getElementById('btn-do-create').addEventListener('click', doCreate);
  }

  function openImportModal() {
    document.getElementById('modal-title').textContent = 'Import Symbol';
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelector('.mtab[data-mtab="import"]').click();
    hideModalError('import');
    document.getElementById('browse-filename').textContent = '';
    document.getElementById('import-json-text').value = '';
  }

  function openCreateModal() {
    document.getElementById('modal-title').textContent = 'Create New Symbol';
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelector('.mtab[data-mtab="create"]').click();
    hideModalError('create');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  function showModalError(tab, msg) {
    const el = document.getElementById(`${tab}-error`);
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideModalError(tab) {
    document.getElementById(`${tab}-error`).classList.add('hidden');
  }

  function doImport() {
    hideModalError('import');
    const text = document.getElementById('import-json-text').value.trim();
    if (!text) { showModalError('import', 'Paste JSON first'); return; }
    const result = ElectroLibrary.importFromJSON(text);
    if (result.errors.length) {
      showModalError('import', result.errors.join('\n'));
      return;
    }
    // Update COMPONENT_TYPES in parser
    result.added.forEach(sym => {
      if (window.ElectroParser && ElectroParser._registerType) {
        ElectroParser._registerType(sym.id);
      }
    });
    buildBuiltinPalette(document.getElementById('palette-search').value.toLowerCase());
    buildLibraryList();
    closeModal();
    setStatus(`✓ Imported ${result.added.length} symbol(s): ${result.added.map(s => s.id).join(', ')}`);
  }

  function doCreate() {
    hideModalError('create');
    const id   = document.getElementById('cf-id').value.trim();
    const name = document.getElementById('cf-name').value.trim();
    const cat  = document.getElementById('cf-cat').value.trim() || 'Custom';
    const mfr  = document.getElementById('cf-mfr').value.trim();
    const params = document.getElementById('cf-params').value.trim();
    const color  = document.getElementById('cf-color').value;
    const pinsRaw= document.getElementById('cf-pins').value.trim();
    const svgBody= document.getElementById('cf-svg').value.trim();

    if (!id || !name) { showModalError('create', 'ID and Name are required'); return; }
    if (!/^\w+$/.test(id)) { showModalError('create', 'ID must be letters/numbers/underscore only'); return; }

    // Parse pins
    const pins = [];
    if (pinsRaw) {
      for (const line of pinsRaw.split('\n')) {
        const parts = line.trim().split(',');
        if (parts.length < 2) continue;
        const num = parseInt(parts[0]);
        const pinName = parts[1].trim();
        const x = parseFloat(parts[2]) || (pins.length % 2 === 0 ? -30 : 30);
        const y = parseFloat(parts[3]) || (-15 + pins.length * 10);
        if (!isNaN(num) && pinName) pins.push({ num, name: pinName, x, y });
      }
    }
    if (!pins.length) { showModalError('create', 'Add at least one pin (format: num,name,x,y)'); return; }

    const sym = {
      id, name, category: cat, description: name, manufacturer: mfr || 'Custom',
      defaultParams: params, defaultValue: params,
      color, pins,
      svgBody: svgBody || '',
    };

    ElectroLibrary.addCustomSymbol(sym);
    buildBuiltinPalette(document.getElementById('palette-search').value.toLowerCase());
    buildLibraryList();
    closeModal();
    setStatus(`✓ Created symbol: ${id}`);
  }

  function exportLibrary() {
    const customs = ElectroLibrary.loadCustom ? ElectroLibrary.getAll().filter(s => ElectroLibrary.isCustom(s.id)) : [];
    if (!customs.length) { setStatus('No custom symbols to export'); return; }
    const blob = new Blob([JSON.stringify(customs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'electrodsl_symbols.json'; a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${customs.length} custom symbol(s)`);
  }

  // ── AI ──────────────────────────────────────────────────────────────────────
  async function runAI() {
    const prompt = document.getElementById('ai-input').value.trim();
    if (!prompt) { setStatus('Enter a description'); document.getElementById('ai-input').focus(); return; }
    const btn = document.getElementById('ai-generate-btn');
    btn.disabled = true; btn.textContent = '⟳ Generating…';
    const result = await ElectroAI.generate(prompt, msg => {
      document.getElementById('ai-status').textContent = msg;
      setStatus(msg);
    });
    btn.disabled = false; btn.textContent = 'Generate with AI ↗';
    document.getElementById('ai-status').textContent = '';
    if (result.ok) { ElectroEditor.setValue(result.code); renderCurrent(); setStatus('✓ AI circuit generated'); }
    else setStatus('✗ AI error: ' + result.error);
  }

  // ── File UI helpers ─────────────────────────────────────────────────────────
  function updateFileUI(isDirty, filename) {
    const nameEl = document.getElementById('file-title-name');
    const dotEl  = document.getElementById('dirty-dot');
    const saveBtn= document.getElementById('btn-save');
    if (nameEl) nameEl.textContent = filename || 'untitled';
    if (dotEl)  dotEl.classList.toggle('hidden', !isDirty);
    if (saveBtn) {
      saveBtn.classList.toggle('dirty', isDirty);
      saveBtn.classList.toggle('clean', !isDirty && !!filename);
    }
    // Update browser tab title
    document.title = (isDirty ? '● ' : '') + (filename || 'untitled') + ' — ElectroDSL';
  }

  function showAutosaveToast(msg) {
    const toast = document.getElementById('autosave-toast');
    if (!toast) return;
    toast.querySelector('div') && (toast.lastChild.textContent = msg || 'Auto-saved');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // ── Recent dropdown ─────────────────────────────────────────────────────────
  let _recentOpen = false;

  function toggleRecentDropdown() {
    _recentOpen ? closeRecentDropdown() : openRecentDropdown();
  }

  function openRecentDropdown() {
    renderRecentDropdown();
    document.getElementById('recent-dropdown').classList.remove('hidden');
    _recentOpen = true;
  }

  function closeRecentDropdown() {
    document.getElementById('recent-dropdown').classList.add('hidden');
    _recentOpen = false;
  }

  function renderRecentDropdown() {
    const list    = ElectroFileManager.loadRecent();
    const listEl  = document.getElementById('recent-list');
    const emptyEl = document.getElementById('recent-empty');
    listEl.innerHTML = '';

    if (!list.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    list.forEach(project => {
      const item = document.createElement('div');
      item.className = 'recent-item';

      const age = formatAge(project.ts);
      const preview = (project.code || '').split('\n').find(l => l.trim().startsWith('CIRCUIT')) || '';

      item.innerHTML = `
        <button class="recent-item-btn" data-name="${project.name}">
          <div class="recent-item-name">${escHtml(project.name)}.edsl</div>
          <div class="recent-item-meta">
            <span>${age}</span>
            <span>${escHtml(preview.trim().substring(0, 40))}</span>
          </div>
        </button>
        <button class="recent-item-del" data-name="${project.name}" title="Remove from recent">✕</button>
      `;

      item.querySelector('.recent-item-btn').addEventListener('click', () => {
        closeRecentDropdown();
        ElectroFileManager.openRecent(project.name, result => {
          if (result.error) { setStatus('✗ ' + result.error); return; }
          renderCurrent();
          setStatus(`✓ Opened: ${project.name}`);
        });
      });

      item.querySelector('.recent-item-del').addEventListener('click', e => {
        e.stopPropagation();
        ElectroFileManager.deleteRecent(project.name);
        renderRecentDropdown();
      });

      listEl.appendChild(item);
    });
  }

  function formatAge(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── New circuit (now delegates to file manager) ─────────────────────────────
  function newCircuit() {
    if (ElectroFileManager.newFile()) {
      document.getElementById('schematic-root').innerHTML = '';
      _ast = null; _netResult = null;
      document.getElementById('net-summary').textContent = '';
      renderCurrent();
      setStatus('New circuit');
    }
  }
  function exportSVG() {
    if (!_ast) { setStatus('Render first'); return; }
    const blob = new Blob([ElectroRenderer.getSVGString(_schemBgColor)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = (_ast.title || 'schematic').replace(/\s+/g, '_') + '.svg'; a.click();
    URL.revokeObjectURL(url); setStatus('SVG exported');
  }

  function exportPDF() {
    if (!_ast) { setStatus('Render first'); return; }

    const svgStr   = ElectroRenderer.getSVGString(_schemBgColor);
    const title    = _ast.title || 'Schematic';
    const filename = title.replace(/\s+/g,'_') + '.pdf';

    // Build a self-contained print page with the SVG centred on A4
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escHtmlBasic(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; margin:0; padding:0; }
  body {
    background:#0D1117; color:#E6EDF3;
    font-family:'JetBrains Mono','Courier New',monospace;
    width:100%; height:100%;
  }
  .page {
    display:flex; flex-direction:column;
    width:100%; min-height:100vh;
    padding:0;
  }
  .sheet-header {
    display:flex; justify-content:space-between; align-items:center;
    padding:6mm 8mm 4mm;
    border-bottom:1px solid #30363D;
  }
  .sheet-title  { font-size:16pt; font-weight:700; color:#E6EDF3; }
  .sheet-meta   { font-size:8pt;  color:#8B949E; text-align:right; line-height:1.7; }
  .sheet-meta b { color:#60A5FA; }
  .svg-area {
    flex:1; display:flex; align-items:center; justify-content:center;
    padding:6mm;
    background:#0D1117;
  }
  .svg-area svg {
    max-width:100%; max-height:180mm;
    width:auto; height:auto;
    display:block;
  }
  .sheet-footer {
    display:flex; justify-content:space-between;
    padding:3mm 8mm;
    border-top:1px solid #30363D;
    font-size:7pt; color:#4B5563;
  }
  .net-table {
    padding:4mm 8mm 2mm;
    page-break-before:always;
  }
  .net-table h2 { font-size:11pt; color:#60A5FA; margin-bottom:3mm; }
  .net-grid {
    display:flex; flex-wrap:wrap; gap:4mm;
  }
  .net-entry {
    font-size:7.5pt; color:#8B949E;
    background:#161B22; border:1px solid #30363D; border-radius:3px;
    padding:2mm 4mm; min-width:40mm;
  }
  .net-name { color:#34D399; font-weight:700; margin-bottom:1mm; }
  .net-pins { color:#656D76; font-size:7pt; }
  @media print {
    body { background:#0D1117 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="sheet-header">
    <div class="sheet-title">${escHtmlBasic(title)}</div>
    <div class="sheet-meta">
      <b>ElectroDSL</b> Schematic<br>
      Generated: ${new Date().toLocaleString()}<br>
      Components: ${Object.keys(_ast.components).length} &nbsp;|&nbsp; Nets: ${_netResult ? Object.keys(_netResult.nets).length : '—'}
    </div>
  </div>
  <div class="svg-area">${svgStr}</div>
  <div class="sheet-footer">
    <span>${escHtmlBasic(filename)}</span>
    <span>ElectroDSL v2.0</span>
    <span>Page 1</span>
  </div>
  ${buildNetTableHTML()}
</div>
</body>
</html>`;

    // Open in hidden iframe and trigger print
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch(e) {
          // Fallback: open new tab
          const w = window.open('', '_blank');
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print(), 600);
        }
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 400);
    };

    iframe.srcdoc = html;
    setStatus('PDF print dialog opened — choose "Save as PDF"');
  }

  function buildNetTableHTML() {
    if (!_netResult) return '';
    const { nets } = _netResult;
    const entries = Object.entries(nets).map(([name, pins]) => {
      const cls = name === 'GND' ? '#94A3B8' : name.startsWith('VCC') ? '#FCD34D' : '#34D399';
      return `<div class="net-entry">
        <div class="net-name" style="color:${cls}">${escHtmlBasic(name)}</div>
        <div class="net-pins">${pins.map(p=>escHtmlBasic(p)).join(' · ')}</div>
      </div>`;
    }).join('');
    return `<div class="net-table"><h2>Net List</h2><div class="net-grid">${entries}</div></div>`;
  }

  function escHtmlBasic(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function applySchematicBg(hex) {
    // Apply to canvas wrapper and SVG background rect
    const wrapper = document.getElementById('canvas-wrapper');
    const gridBg  = document.getElementById('grid-bg');
    const subBg   = document.getElementById('subgrid-bg');
    const svg     = document.getElementById('schematic-svg');
    if (wrapper) wrapper.style.background = hex;
    if (svg)     svg.style.background     = hex;
    // Store for export
    _schemBgColor = hex;
    // Update CSS variable so other elements (like editor) can read it if needed
    document.documentElement.style.setProperty('--schematic-bg', hex);
  }

  // ── Wire DSL line highlight (click wire → scroll editor to matching line) ──
  function highlightWireDSLLine(wire) {
    const code  = ElectroEditor.getValue();
    const lines = code.split('\n');
    // Find the line index that matches this wire's from/to
    let lineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t.startsWith('wire ')) continue;
      const m = t.match(/^wire\s+([\w]+)\.([\w+\-]+)\s*->\s*([\w]+)\.([\w+\-]+)/);
      if (!m) continue;
      const [, fId, fPin, tId, tPin] = m;
      if (fId === wire.from && fPin === wire.fromPin && tId === wire.to && tPin === wire.toPin) {
        lineIdx = i; break;
      }
      // Also match reverse
      if (fId === wire.to && fPin === wire.toPin && tId === wire.from && tPin === wire.fromPin) {
        lineIdx = i; break;
      }
    }
    if (lineIdx >= 0) {
      ElectroEditor.scrollToLine(lineIdx);
      setStatus(`Wire: ${wire.from}.${wire.fromPin} → ${wire.to}.${wire.toPin}  (Line ${lineIdx + 1})`);
      document.getElementById('selected-info').textContent = `wire L${lineIdx + 1}`;
    }
  }

  function toggleGrid() {
    _gridVisible = !_gridVisible;
    const gb = document.getElementById('grid-bg');
    if (gb) gb.setAttribute('fill', _gridVisible ? 'url(#grid-pattern)' : 'transparent');
    document.getElementById('btn-grid-toggle').classList.toggle('active', _gridVisible);
  }

  function copyCode() {
    navigator.clipboard.writeText(ElectroEditor.getValue()).then(() => setStatus('DSL copied'));
  }

  function setStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
