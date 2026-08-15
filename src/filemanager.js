// ─── ElectroDSL File Manager ─────────────────────────────────────────────────
// Handles: Save DSL (.edsl), Open DSL, Recent Projects (localStorage),
//          Auto-save (every 30s + on change), Unsaved-changes warning

window.ElectroFileManager = (function () {

  const RECENT_KEY   = 'electrodsl_recent_projects';
  const AUTOSAVE_KEY = 'electrodsl_autosave';
  const MAX_RECENT   = 12;
  const FILE_EXT     = '.edsl';

  let _currentFilename = null;   // base name without extension
  let _isDirty         = false;  // unsaved changes flag
  let _autoSaveTimer   = null;
  let _onDirtyChange   = null;   // callback(isDirty, filename)
  let _getCode         = null;   // function that returns current editor code
  let _setCode         = null;   // function that sets editor code

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(getCodeFn, setCodeFn, onDirtyChangeFn) {
    _getCode       = getCodeFn;
    _setCode       = setCodeFn;
    _onDirtyChange = onDirtyChangeFn;

    // Restore auto-saved work on startup
    restoreAutosave();

    // Auto-save every 30 seconds
    _autoSaveTimer = setInterval(autoSave, 30000);

    // Warn before closing tab with unsaved changes
    window.addEventListener('beforeunload', e => {
      if (_isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in ElectroDSL.';
      }
    });
  }

  // ── Dirty state ───────────────────────────────────────────────────────────
  function markDirty() {
    if (!_isDirty) {
      _isDirty = true;
      if (_onDirtyChange) _onDirtyChange(true, _currentFilename);
    }
    autoSave(); // save to localStorage immediately
  }

  function markClean(filename) {
    _isDirty = false;
    if (filename !== undefined) _currentFilename = filename;
    if (_onDirtyChange) _onDirtyChange(false, _currentFilename);
  }

  // ── Auto-save to localStorage ─────────────────────────────────────────────
  function autoSave() {
    if (!_getCode) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        code:     _getCode(),
        filename: _currentFilename,
        ts:       Date.now(),
      }));
    } catch(e) { /* quota exceeded – ignore */ }
  }

  function restoreAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const { code, filename, ts } = JSON.parse(raw);
      if (!code) return false;
      // Only restore if it's less than 7 days old
      if (Date.now() - ts > 7 * 24 * 3600 * 1000) return false;
      if (_setCode) _setCode(code);
      _currentFilename = filename || null;
      return true;
    } catch(e) { return false; }
  }

  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  // ── Save DSL to file ──────────────────────────────────────────────────────
  function saveFile(suggestedName) {
    const code = _getCode ? _getCode() : '';
    if (!code.trim()) return { ok: false, error: 'Nothing to save' };

    // Extract circuit title for filename suggestion
    const titleMatch = code.match(/^CIRCUIT\s+"([^"]+)"/m);
    const base = suggestedName
      || _currentFilename
      || (titleMatch ? titleMatch[1].replace(/[^a-zA-Z0-9_\- ]/g, '').trim() : 'untitled');

    const filename = base.endsWith(FILE_EXT) ? base : base + FILE_EXT;

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Update state
    _currentFilename = base;
    markClean(base);
    addToRecent({ name: base, filename, code, ts: Date.now() });
    autoSave();

    return { ok: true, filename };
  }

  // Save As — always prompts (uses browser download with new name)
  function saveFileAs() {
    const code = _getCode ? _getCode() : '';
    const titleMatch = code.match(/^CIRCUIT\s+"([^"]+)"/m);
    const suggested  = titleMatch ? titleMatch[1].replace(/[^a-zA-Z0-9_\- ]/g, '').trim() : 'untitled';
    const name = prompt('Save as:', (_currentFilename || suggested));
    if (name === null) return { ok: false, cancelled: true };
    return saveFile(name.trim() || suggested);
  }

  // ── Open DSL from file ────────────────────────────────────────────────────
  function openFile(onLoad) {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.edsl,.dsl,.txt';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) { document.body.removeChild(input); return; }

      const reader = new FileReader();
      reader.onload = ev => {
        document.body.removeChild(input);
        const code = ev.target.result;
        const base = file.name.replace(/\.(edsl|dsl|txt)$/i, '');

        if (_setCode) _setCode(code);
        _currentFilename = base;
        markClean(base);
        addToRecent({ name: base, filename: file.name, code, ts: Date.now() });
        autoSave();

        if (onLoad) onLoad({ code, filename: file.name, base });
      };
      reader.onerror = () => {
        document.body.removeChild(input);
        if (onLoad) onLoad({ error: 'Failed to read file' });
      };
      reader.readAsText(file);
    });

    input.click();
  }

  // ── Recent projects ───────────────────────────────────────────────────────
  function loadRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  }

  function saveRecent(list) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  }

  function addToRecent(project) {
    let list = loadRecent();
    // Remove existing entry with same name
    list = list.filter(p => p.name !== project.name);
    // Add to front
    list.unshift(project);
    // Cap
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    saveRecent(list);
  }

  function openRecent(name, onLoad) {
    const list = loadRecent();
    const project = list.find(p => p.name === name);
    if (!project || !project.code) {
      if (onLoad) onLoad({ error: 'Project not found in recent list' });
      return;
    }
    if (_setCode) _setCode(project.code);
    _currentFilename = project.name;
    markClean(project.name);
    // Bubble to top
    addToRecent({ ...project, ts: Date.now() });
    if (onLoad) onLoad({ code: project.code, filename: project.filename, base: project.name });
  }

  function deleteRecent(name) {
    const list = loadRecent().filter(p => p.name !== name);
    saveRecent(list);
  }

  function clearRecent() {
    saveRecent([]);
  }

  // ── New file ──────────────────────────────────────────────────────────────
  function newFile(template) {
    if (_isDirty) {
      const ok = confirm('You have unsaved changes. Discard and create new circuit?');
      if (!ok) return false;
    }
    if (_setCode) _setCode(template || DEFAULT_TEMPLATE);
    _currentFilename = null;
    markClean(null);
    clearAutosave();
    return true;
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  function getCurrentFilename() { return _currentFilename; }
  function isDirty()             { return _isDirty; }

  const DEFAULT_TEMPLATE = `CIRCUIT "My Circuit" {
  // Drag components from the palette or type DSL below
  // Pin names: VSource(.p .n)  Resistor(.1 .2)  Capacitor(.p .n)
  //            Diode(.A .K)    NPN(.B .C .E)     NMOS(.G .D .S)
  //            OpAmp(.IN+ .IN- .OUT .V+ .V-)     Ground/VCC/Node(.1)
}`;

  return {
    init,
    markDirty, markClean,
    saveFile, saveFileAs,
    openFile,
    loadRecent, openRecent, deleteRecent, clearRecent,
    newFile,
    autoSave,
    getCurrentFilename,
    isDirty,
    DEFAULT_TEMPLATE,
  };
})();
