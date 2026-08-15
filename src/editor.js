// ─── ElectroDSL Code Editor v5 ───────────────────────────────────────────────
// Architecture: single <textarea> that IS the editor (always editable, visible text)
// A sibling <div id="code-highlight"> is overlaid for syntax colour using
// the "dual-layer" trick — but we make it work by keeping textarea text VISIBLE
// (not transparent) and positioning the highlight div BEHIND it at opacity only
// for colour chips shown in the gutter area (wire fold/expand).
//
// Actually the simplest correct approach:
//   • <textarea> shows PLAIN text (visible, editable, dark theme colour)
//   • A separate read-only <div> below the editor shows the highlighted view
//     toggled by a "Preview" button
//   • Wire groups collapse in a separate sidebar/gutter widget, not inside the textarea
//
// This guarantees editability. Syntax preview shown in a toggleable panel.

window.ElectroEditor = (function () {

  const DEBOUNCE = 380;
  const LINE_H   = 20; // px per line (matches CSS line-height)

  // Token colours
  const T = {
    keyword  : '#60A5FA',
    type     : '#34D399',
    string   : '#FBBF24',
    number   : '#F87171',
    pin      : '#C084FC',
    attr     : '#FB923C',
    comment  : '#556070',
    id       : '#CBD5E1',
    punct    : '#64748B',
    arrow    : '#818CF8',
    wireFrom : '#67E8F9',
    wireTo   : '#6EE7B7',
    bg       : '#0D1117',
    textMain : '#CBD5E1',
  };

  const COMP_TYPES = new Set([
    'VSource','ISource','Resistor','Capacitor','Inductor','Diode','LED','Zener',
    'Schottky','NPN','PNP','NMOS','PMOS','OpAmp','JFET','Thyristor',
    'Ground','VCC','Node','Switch','Transformer','Relay',
  ]);

  // ── State ──────────────────────────────────────────────────────────────────
  let _pane, _textarea, _gutter, _preview, _onChange, _onChangeDeb;
  let _ast            = null;
  let _foldedGroups   = new Set();  // set of group IDs that are folded
  let _lineGroups     = [];         // [{groupId, lineIdx, isMember}] per DSL line
  let _previewVisible = false;
  let _lastCode       = '';

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(paneEl, textareaEl, gutterEl, changeCb) {
    _pane        = paneEl;
    _textarea    = textareaEl;
    _gutter      = gutterEl;
    _onChange    = changeCb;
    _onChangeDeb = debounce(changeCb, DEBOUNCE);

    // Build preview panel
    _preview = document.createElement('div');
    _preview.id = 'code-preview-panel';
    _preview.className = 'hidden';
    _pane.appendChild(_preview);

    // Wire the textarea
    _textarea.addEventListener('input',   onInput);
    _textarea.addEventListener('keydown', onKeydown);
    _textarea.addEventListener('scroll',  onScroll);
    _textarea.addEventListener('click',   updateCursorInfo);
    _textarea.addEventListener('keyup',   updateCursorInfo);

    // Gutter click (fold/unfold)
    _gutter.addEventListener('click', onGutterClick);

    renderGutter();
  }

  // ── Public ─────────────────────────────────────────────────────────────────
  function getValue()  { return _textarea ? _textarea.value : ''; }

  function setValue(code) {
    if (!_textarea) return;
    _textarea.value  = code;
    _lastCode        = code;
    _foldedGroups.clear();
    renderGutter();
    if (_previewVisible) renderPreview();
    updateCursorInfo();
  }

  function setAST(ast) {
    _ast = ast;
    if (_previewVisible) renderPreview();
  }

  function highlightComponentLine(id, ast) {
    if (!ast?.components[id]) return;
    const lineIdx = ast.components[id].line;
    if (lineIdx === undefined) return;
    scrollToLine(lineIdx);
  }

  function format() {
    const lines = getValue().split('\n');
    const out   = [];
    lines.forEach(line => {
      const t = line.trim();
      if (!t) { out.push(''); return; }
      if (t.startsWith('CIRCUIT') || t === '{' || t === '}') { out.push(t); return; }
      out.push('  ' + t);
    });
    setValue(out.join('\n'));
    _onChangeDeb();
  }

  function togglePreview() {
    _previewVisible = !_previewVisible;
    if (_previewVisible) { renderPreview(); _preview.classList.remove('hidden'); }
    else                   _preview.classList.add('hidden');
    return _previewVisible;
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function onInput() {
    const code = _textarea.value;
    if (code !== _lastCode) {
      _lastCode = code;
      renderGutter();
      if (_previewVisible) renderPreview();
      _onChangeDeb();
    }
  }

  function onKeydown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Tab') {
      e.preventDefault();
      insertAt('  ');
      return;
    }
    if (ctrl && e.key === '/') { e.preventDefault(); toggleLineComment(); return; }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); if (_onChange) _onChange(); return; }
    // Auto-close pairs
    if (e.key === '(')  { e.preventDefault(); insertPair('(', ')'); }
    if (e.key === '"')  { e.preventDefault(); insertPair('"', '"'); }
  }

  function onScroll() {
    if (_gutter) _gutter.scrollTop = _textarea.scrollTop;
  }

  // ── Gutter (line numbers + fold controls) ──────────────────────────────────
  function renderGutter() {
    if (!_gutter || !_textarea) return;
    const lines  = (_textarea.value || '').split('\n');
    _lineGroups  = buildLineGroups(lines);
    const rows   = [];
    const seen   = new Set();

    lines.forEach((_, i) => {
      const lg = _lineGroups[i];
      if (lg && lg.groupId !== null) {
        const gid    = lg.groupId;
        const folded = _foldedGroups.has(gid);
        if (!seen.has(gid)) {
          seen.add(gid);
          rows.push(
            `<div class="gutter-row" data-line="${i}" style="height:${LINE_H}px">` +
            `<span class="gutter-num">${i+1}</span>` +
            `<span class="gutter-fold${folded?' folded':''}" data-gid="${gid}">${folded?'▶':'▼'}</span>` +
            `</div>`
          );
        } else if (!folded) {
          // Show sub-line numbers for expanded group members
          rows.push(
            `<div class="gutter-row sub" data-line="${i}" style="height:${LINE_H}px">` +
            `<span class="gutter-num dim">${i+1}</span>` +
            `<span class="gutter-sub-dot">·</span>` +
            `</div>`
          );
        }
        // If folded, skip subsequent member rows (they're hidden in textarea via CSS trick)
      } else {
        rows.push(
          `<div class="gutter-row" data-line="${i}" style="height:${LINE_H}px">` +
          `<span class="gutter-num">${i+1}</span>` +
          `<span class="gutter-space"></span>` +
          `</div>`
        );
      }
    });

    _gutter.innerHTML = rows.join('');
    _gutter.scrollTop = _textarea.scrollTop;
  }

  // Build mapping: which lines belong to which wire group
  function buildLineGroups(lines) {
    const result  = lines.map(() => ({ groupId: null, isFirst: false }));
    let   groupId = 0, inGroup = false, start = -1;

    for (let i = 0; i <= lines.length; i++) {
      const isWire = i < lines.length && /^\s*wire\s/.test(lines[i]);
      if (isWire && !inGroup)  { inGroup = true; start = i; groupId++; }
      if (!isWire && inGroup) {
        if (i - start >= 2) {
          for (let k = start; k < i; k++) {
            result[k] = { groupId, isFirst: k === start };
          }
        }
        inGroup = false;
      }
    }
    return result;
  }

  function onGutterClick(e) {
    const gid = e.target.dataset.gid;
    if (!gid) return;
    const id = parseInt(gid);
    if (_foldedGroups.has(id)) _foldedGroups.delete(id);
    else _foldedGroups.add(id);
    renderGutter();
    applyFoldToTextarea();
    if (_previewVisible) renderPreview();
  }

  // Apply folding visually by adjusting textarea line heights via a CSS trick
  // We can't hide lines inside a textarea — instead we use a read-only overlay
  // for the folded view and show a badge in the gutter.
  // Simplest working approach: just mark folded groups in gutter; the textarea
  // always shows all text (user can still edit). The gutter fold is cosmetic/nav.
  function applyFoldToTextarea() {
    // For now, folding is visual in gutter only. Full textarea line-hiding
    // requires replacing textarea with contenteditable which breaks other things.
    // Gutter accurately shows which groups exist and their fold state.
  }

  // ── Syntax preview panel ───────────────────────────────────────────────────
  function renderPreview() {
    if (!_preview) return;
    const lines = (_textarea?.value || '').split('\n');
    const groups = buildLineGroups(lines);
    const html   = [];
    let i = 0;

    while (i < lines.length) {
      const lg = groups[i];

      if (lg.groupId !== null && lg.isFirst) {
        const gid    = lg.groupId;
        const folded = _foldedGroups.has(gid);

        // Collect group lines
        const gLines = [];
        let j = i;
        while (j < lines.length && groups[j].groupId === gid) {
          gLines.push(lines[j]); j++;
        }

        if (folded) {
          // Collapsed: single summary row
          html.push(`<div class="pv-wire-group folded" data-gid="${gid}">`);
          html.push(`<div class="pv-group-header" data-gid="${gid}">`);
          html.push(`<span class="pv-fold-btn" data-gid="${gid}">▶</span>`);
          html.push(`<span class="pv-group-label" style="color:${T.keyword}">wire </span>`);
          html.push(`<span style="color:${T.comment}">[ ${gLines.length} connections — click to expand ]</span>`);
          html.push(`</div></div>`);
        } else {
          // Expanded: group header + each wire line with chips
          html.push(`<div class="pv-wire-group" data-gid="${gid}">`);
          html.push(`<div class="pv-group-header" data-gid="${gid}">`);
          html.push(`<span class="pv-fold-btn" data-gid="${gid}">▼</span>`);
          html.push(`<span class="pv-group-label">Wires </span>`);
          html.push(`<span class="pv-group-count">${gLines.length}</span>`);
          html.push(`</div>`);

          gLines.forEach(wline => {
            html.push(`<div class="pv-line pv-wire-line">`);
            html.push(hlLine(wline));
            html.push(buildChips(wline.trim()));
            html.push(`</div>`);
          });
          html.push(`</div>`);
        }
        i = j;
        continue;
      }

      // Non-wire line
      html.push(`<div class="pv-line">${hlLine(lines[i])}</div>`);
      i++;
    }

    _preview.innerHTML = html.join('');

    // Bind fold buttons inside preview
    _preview.querySelectorAll('[data-gid]').forEach(el => {
      el.addEventListener('click', ev => {
        const gid = parseInt(ev.currentTarget.dataset.gid);
        if (isNaN(gid)) return;
        if (_foldedGroups.has(gid)) _foldedGroups.delete(gid);
        else _foldedGroups.add(gid);
        renderGutter();
        renderPreview();
        ev.stopPropagation();
      });
    });
  }

  // Build node-property chips for a wire line
  function buildChips(trim) {
    if (!_ast || !trim.startsWith('wire ')) return '';
    const m = trim.match(/^wire\s+([\w]+)\.([\w+\-]+)\s*->\s*([\w]+)\.([\w+\-]+)/);
    if (!m) return '';
    const [, fId, fPin, tId, tPin] = m;
    const fc = _ast.components[fId];
    const tc = _ast.components[tId];
    if (!fc && !tc) return '';
    let h = `<span class="pv-chips">`;
    if (fc) h += `<span class="pv-chip from">${esc(fId)}<span class="pv-pin">.${esc(fPin)}</span><span class="pv-type">${esc(fc.type)}</span></span>`;
    h += `<span class="pv-arrow">→</span>`;
    if (tc) h += `<span class="pv-chip to">${esc(tId)}<span class="pv-pin">.${esc(tPin)}</span><span class="pv-type">${esc(tc.type)}</span></span>`;
    h += `</span>`;
    return h;
  }

  // ── Tokeniser / colouring ──────────────────────────────────────────────────
  function hlLine(raw) {
    if (!raw.trim()) return '&nbsp;';
    const trim = raw.trim();

    if (trim.startsWith('//') || trim.startsWith('#')) {
      return `<span style="color:${T.comment}">${esc(raw)}</span>`;
    }
    if (trim.startsWith('CIRCUIT')) {
      return raw.replace(/(CIRCUIT)(\s+)("([^"]*)")/,
        `<span style="color:${T.keyword}">$1</span>$2<span style="color:${T.string}">"$4"</span>`);
    }
    if (trim.startsWith('wire '))    return hlWire(raw);
    if (trim.startsWith('connect ')) return hlConnect(raw);
    if (trim === '{' || trim === '}') return `<span style="color:${T.punct}">${esc(raw)}</span>`;

    const cm = trim.match(/^(\w+)\s*:\s*(\w+)/);
    if (cm) return hlComp(raw, cm[1], cm[2]);

    return esc(raw);
  }

  function hlWire(raw) {
    return raw.replace(
      /^(\s*)(wire)(\s+)([\w]+)(\.[\w+\-]+)?(\s*)(->)(\s*)([\w]+)(\.[\w+\-]+)?(.*)$/,
      (_, ind, kw, s1, fId, fPin, s2, arr, s3, tId, tPin, rest) =>
        `${esc(ind)}<span style="color:${T.keyword}">${kw}</span>${s1}`
        + `<span style="color:${T.wireFrom}">${esc(fId)}</span>`
        + (fPin ? `<span style="color:${T.pin}">${esc(fPin)}</span>` : '')
        + `${s2}<span style="color:${T.arrow}">${arr}</span>${s3}`
        + `<span style="color:${T.wireTo}">${esc(tId)}</span>`
        + (tPin ? `<span style="color:${T.pin}">${esc(tPin)}</span>` : '')
        + (rest ? `<span style="color:${T.comment}">${esc(rest)}</span>` : '')
    );
  }

  function hlConnect(raw) {
    return raw
      .replace(/\bconnect\b/, `<span style="color:${T.keyword}">connect</span>`)
      .replace(/->/g, `<span style="color:${T.arrow}">-></span>`)
      .replace(/\b([\w]+)(\.[\w+\-]+)/g,
        `<span style="color:${T.wireFrom}">$1</span><span style="color:${T.pin}">$2</span>`);
  }

  function hlComp(raw, id, type) {
    let h = esc(raw);

    // ID:
    h = h.replace(new RegExp(`^(\\s*)(${esc(id)})(\\s*:)`),
      `$1<span style="color:${T.id};font-weight:600">$2</span><span style="color:${T.punct}">$3</span>`);

    // Type
    if (COMP_TYPES.has(type))
      h = h.replace(new RegExp(`\\b(${type})\\b`),
        `<span style="color:${T.type};font-weight:500">$1</span>`);

    // params (value)
    h = h.replace(/(\()([^)]*)(\))/,
      `<span style="color:${T.punct}">$1</span><span style="color:${T.number}">$2</span><span style="color:${T.punct}">$3</span>`);

    // at keyword + coords
    h = h.replace(/\bat\b/,
      `<span style="color:${T.keyword}">at</span>`);
    h = h.replace(/(\()(\s*[\d.]+\s*,\s*[\d.]+\s*)(\))/,
      `<span style="color:${T.punct}">$1</span><span style="color:${T.number}">$2</span><span style="color:${T.punct}">$3</span>`);

    // attributes
    h = h.replace(/\b(label|value|rotate|color)\b(\s*=)/g,
      `<span style="color:${T.attr}">$1</span><span style="color:${T.punct}">$2</span>`);

    // strings
    h = h.replace(/"([^"]*)"/g,
      `<span style="color:${T.string}">"$1"</span>`);

    // comment
    h = h.replace(/(\/\/.*)$/, `<span style="color:${T.comment}">$1</span>`);

    return h;
  }

  // ── Editing helpers ────────────────────────────────────────────────────────
  function insertAt(txt) {
    const s = _textarea.selectionStart;
    const e = _textarea.selectionEnd;
    const v = _textarea.value;
    _textarea.value = v.slice(0,s) + txt + v.slice(e);
    _textarea.selectionStart = _textarea.selectionEnd = s + txt.length;
    onInput();
  }

  function insertPair(open, close) {
    const s   = _textarea.selectionStart;
    const e   = _textarea.selectionEnd;
    const v   = _textarea.value;
    const sel = v.slice(s, e);
    _textarea.value = v.slice(0,s) + open + sel + close + v.slice(e);
    _textarea.selectionStart = s + 1;
    _textarea.selectionEnd   = s + 1 + sel.length;
    onInput();
  }

  function toggleLineComment() {
    const s  = _textarea.selectionStart;
    const v  = _textarea.value;
    const ls = v.lastIndexOf('\n', s-1) + 1;
    const le = v.indexOf('\n', s);
    const line = v.slice(ls, le === -1 ? undefined : le);
    const nl   = line.trim().startsWith('//')
      ? line.replace(/^(\s*)\/\/\s?/, '$1')
      : line.replace(/^(\s*)/, '$1// ');
    _textarea.value = v.slice(0,ls) + nl + (le===-1 ? '' : v.slice(le));
    _textarea.selectionStart = _textarea.selectionEnd = s + nl.length - line.length;
    onInput();
  }

  // ── Scroll / cursor ────────────────────────────────────────────────────────
  function scrollToLine(idx) {
    const lines = _textarea.value.split('\n');
    let pos = 0;
    for (let i = 0; i < idx && i < lines.length; i++) pos += lines[i].length + 1;
    _textarea.focus();
    _textarea.setSelectionRange(pos, pos + (lines[idx]||'').length);
    _textarea.scrollTop = Math.max(0, idx * LINE_H - _textarea.clientHeight / 2);
    if (_gutter) _gutter.scrollTop = _textarea.scrollTop;
  }

  function updateCursorInfo() {
    const pos  = _textarea.selectionStart;
    const bef  = _textarea.value.substring(0, pos);
    const lns  = bef.split('\n');
    const el   = document.getElementById('cursor-pos');
    if (el) el.textContent = `Ln ${lns.length}, Col ${lns[lns.length-1].length+1}`;
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  return {
    init, getValue, setValue, setAST,
    togglePreview,
    highlightComponentLine, scrollToLine, format,
    updateLineNumbers: renderGutter,
  };
})();
