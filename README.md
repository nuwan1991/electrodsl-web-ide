# ⚡ ElectroDSL

**A browser-based, AI-powered electrical schematic editor that works like LaTeX — you write code, it draws the circuit.**

> **Beta Release v2.0** · Open Source · MIT License · No installation required

---

## 🌐 What is ElectroDSL?

ElectroDSL is a **text-based electrical schematic drawing tool** that runs entirely in your web browser — no server, no cloud, no account needed. You describe a circuit using a simple domain-specific language (DSL), and ElectroDSL renders it as a professional schematic diagram in real time.

Think of it as **LaTeX for electrical drawings**: your schematic is a plain text file that you can version-control with Git, share as a snippet, generate with AI, or edit with any text editor. The visual rendering is just one view of the underlying text.

```dsl
CIRCUIT "LED Indicator" {
  V1:   VSource(5V,DC)  at (0, 3) label="5V"
  R1:   Resistor(470)   at (3, 3) label="R1"  value="470Ω"
  LED1: LED(red)        at (6, 3) label="LED" value="red"
  GND1: Ground          at (0, 1)
  GND2: Ground          at (6, 1)
  wire V1.p   -> R1.1
  wire R1.2   -> LED1.A
  wire LED1.K -> GND2.1
  wire V1.n   -> GND1.1
}
```

The above produces a fully rendered, exportable schematic diagram — instantly.

---

## ✨ Key Features

### 🤖 AI-Powered Generation
Describe a circuit in plain English and Claude AI or ChatGPT generates the DSL code automatically. The AI prompt system is documented so you can use any LLM.

> *"Design an NPN common-emitter amplifier with 12V supply and LED output indicator"*

### ✏️ Dual Editing Modes
- **DSL Code Editor** — syntax-highlighted text editor with wire block folding, line numbers, and live preview
- **Interactive Canvas** — drag components, draw wires by clicking, rotate symbols, delete connections

### 🔧 Interactive Schematic Tools
| Tool | Key | Function |
|------|-----|----------|
| Select | `V` | Click to select, drag to move, double-click to rotate |
| Wire | `W` | Click pin → click bends → click target pin |
| Join | `J` | Click wire to insert junction node |
| Rotate | `R` | Click component to rotate 90° |
| Del Wire | `E` | Click a wire segment to delete it |
| Delete | `D` | Click component to delete with all wires |

### 📐 Smart Grid System
- Adjustable **grid scale** (×0.5 to ×2)
- **Subdivision grid** (1, 2, 4, 8 sub-divisions per cell)
- Snap cursor crosshair showing exact snap point while drawing
- Wires snap to subdivision grid points

### 📚 Symbol Libraries
**62 built-in symbols** covering all standard electronic components:
- Sources, Passives, Semiconductors, Connections

**41 building electrical symbols** (importable JSON):
- Socket Outlets, Switches, Lighting, Distribution Boards, Fire & Safety, Data/AV, Security, Heating Controls, EV Chargers, Solar/Battery

### 🔌 Custom Symbol Import
Import your own symbols as JSON with pin positions, SVG body, and metadata. Share symbol libraries as `.json` files. Full AI prompt guidelines included for generating new symbols.

### 💾 File Management
- Save / Save As `.edsl` files (plain text)
- Open `.edsl`, `.dsl`, `.txt` files
- Recent projects (last 12, stored locally)
- Auto-save to browser localStorage every 30 seconds
- Unsaved-changes warning on tab close

### 📊 Net-Aware
- Automatic net naming (GND, VCC, N001, N002…)
- Net list panel showing all connections
- Net labels displayed on wire segments
- Junction dots at multi-wire meeting points

### 📤 Export
| Format | Details |
|--------|---------|
| **SVG** | Self-contained, dark-themed, all styles inlined |
| **PDF** | A4 landscape with title, net list, dark theme preserved |
| **SPICE** | LTspice / ngspice compatible netlist |

### 🎨 Customisation
- Adjustable schematic background colour
- Toggle pin number display
- Toggle grid visibility
- Pan and zoom canvas

---

## 🚀 Quick Start

### Option 1 — Download and Open (Recommended for Beta)
1. Download `electrodsl.zip`
2. Extract to any folder
3. Open `index.html` in Chrome, Firefox, or Edge
4. Done — no server needed

### Option 2 — Serve Locally (for AI features)
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# Then open: http://localhost:8080
```

> **Note:** The AI generation feature requires an internet connection to reach the Anthropic API. All other features work fully offline.

### Option 3 — Deploy to Web
Drop the folder contents into any static hosting service:
- **GitHub Pages** — push to repo, enable Pages
- **Netlify** — drag folder onto netlify.com
- **Vercel** — `vercel --prod`
- **Cloudflare Pages** — connect repo
- Any web server serving static files

---

## 📁 File Structure

```
electrodsl/
├── index.html              Main application shell
└── src/
    ├── style.css           All styling (dark theme)
    ├── gridmanager.js      Grid scale & subdivision system
    ├── symbols.js          Built-in SVG symbol library (21 symbols)
    ├── library.js          Symbol import/export/storage manager
    ├── parser.js           DSL tokeniser and AST builder
    ├── netmanager.js       Net naming and connection graph
    ├── renderer.js         SVG schematic renderer + export
    ├── tools.js            Interactive canvas tools (wire, move, rotate…)
    ├── autolayout.js       Automatic component placement
    ├── spice.js            SPICE netlist exporter
    ├── ai.js               Claude API integration
    ├── editor.js           Code editor with syntax highlighting
    ├── filemanager.js      Save/open/recent file system
    └── app.js              Main application controller

building_electrical_symbols.json    41 importable building symbols
ElectroDSL_AI_Guidelines.pdf        AI prompt reference (this document)
```

---

## 📝 DSL Language Reference

### Component Syntax
```dsl
ID: TypeName(params) at (x, y) label="Name" value="Value" rotate=90
```

### Wire Syntax
```dsl
wire FROM_ID.pinName -> TO_ID.pinName
wire FROM_ID.pinName -> TO_ID.pinName route="3.5,4.0;5.0,4.0"
connect A.pin -> B.pin -> C.pin -> D.pin
```

### Built-in Symbol Pin Names
```
VSource/ISource      .p  .n
Resistor/Inductor    .1  .2
Capacitor            .p  .n
Diode/LED/Zener      .A  .K
NPN/PNP              .B  .C  .E
NMOS/PMOS/JFET       .G  .D  .S
OpAmp                .IN+  .IN-  .OUT  .V+  .V-
Ground/VCC/Node      .1
```

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open file |
| `Ctrl+N` | New circuit |
| `Ctrl+Enter` | Render now |
| `Ctrl+/` | Toggle comment |
| `V` | Select tool |
| `W` | Wire tool |
| `R` | Rotate tool |
| `E` | Delete wire tool |
| `D` | Delete component |
| `J` | Join wire |
| `Esc` | Cancel / select tool |
| `Del` | Delete selected component |

---

## 🤖 AI Integration

ElectroDSL uses the **Anthropic Claude API** (`claude-sonnet-4-6`) for circuit generation. The integration is in `src/ai.js` and is straightforward to adapt for other LLMs.

### Using with Claude or ChatGPT (no API key needed)
1. Open the AI Guidelines PDF included in this release
2. Copy the **Master AI Prompt** (Section 5)
3. Paste into claude.ai or chatgpt.com
4. Describe your circuit
5. Paste the generated DSL into ElectroDSL

### Using the built-in AI button
The AI Generate button in the app calls the Anthropic API directly. This requires:
- Internet connection
- The API request goes to `api.anthropic.com/v1/messages`
- No API key is needed in the browser (handled by the platform)

---

## 🏗️ Architecture

ElectroDSL is built with **zero dependencies** — pure HTML, CSS, and vanilla JavaScript. No build step, no npm, no bundler.

```
User types DSL
      ↓
parser.js → AST (components + wires + net info)
      ↓
autolayout.js → positions components if no coords given
      ↓
netmanager.js → assigns net names to all wire segments
      ↓
renderer.js → draws SVG to canvas
      ↓
tools.js → handles mouse interaction → updates DSL text
      ↓
editor.js → syntax highlight + wire block folding
      ↓
filemanager.js → save/open/autosave
```

---

## 🔧 Suggested Improvements & Roadmap

We welcome contributions! Here are areas where the community can help:

### High Priority
- [ ] **Wire routing improvements** — smarter orthogonal routing that avoids component bodies
- [ ] **Undo/Redo** — full history stack (Ctrl+Z / Ctrl+Y)
- [ ] **Component snap to grid** — snap during drag, not just on release
- [ ] **Wire labels** — click a wire to add/edit a net label directly
- [ ] **Multi-select** — rubber-band selection, move/delete groups of components

### Medium Priority
- [ ] **More symbol libraries** — automotive, RF, power electronics, IEC vs ANSI toggle
- [ ] **Hierarchical sheets** — sub-circuits and symbol references
- [ ] **Bill of Materials export** — CSV/Excel with component list
- [ ] **Dark/light theme toggle** for the editor
- [ ] **Print layout** — title block, revision table, border
- [ ] **Component properties panel** — click component to edit params in a sidebar
- [ ] **Simulation integration** — link to online SPICE simulators

### Architecture
- [ ] **Monaco Editor integration** — full VS Code editor experience
- [ ] **PWA / offline mode** — service worker for full offline AI
- [ ] **Collaborative editing** — WebSocket-based multi-user
- [ ] **Plugin API** — hook into parser, renderer, and tools
- [ ] **DSL v2** — formal grammar with PEG.js for better error recovery

### Symbol Library
- [ ] **IEC 60617** standard symbols
- [ ] **IEEE/ANSI** standard symbols
- [ ] **PCB footprint linking** — attach KiCad footprints to symbols
- [ ] **Symbol editor UI** — draw symbols visually inside ElectroDSL

---

## 📜 License

```
MIT License

Copyright (c) 2025 ElectroDSL Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🤝 Contributing

ElectroDSL is open to all contributions — code, symbols, documentation, bug reports, or ideas.

### How to Contribute
1. **Fork** the repository
2. **Create a branch** (`git checkout -b feature/my-improvement`)
3. **Make changes** — all code is in `src/` as plain JS files
4. **Test** by opening `index.html` in a browser
5. **Submit a Pull Request** with a description of what you changed and why

### Contribution Areas
- **Symbol designers** — create new `.json` symbol libraries for specific industries
- **Electrical engineers** — validate symbols against IEC/IEEE standards, suggest pin conventions
- **Frontend developers** — improve the editor, tools, and UI
- **AI/ML developers** — improve the AI prompt system, add support for other models
- **Documentation writers** — improve tutorials, examples, and guides
- **Translators** — translate the UI and documentation

### Reporting Bugs
Please include:
- Browser and version
- Steps to reproduce
- DSL code that causes the issue (if applicable)
- Screenshot of the problem

### Suggesting Features
Open an issue with the tag `enhancement`. Describe:
- What you want to do
- Why it would be useful
- Any relevant examples or references

---

## 🙏 Acknowledgements

ElectroDSL was designed and built as an open-source tool for the electrical engineering and maker community. It draws inspiration from:

- **LaTeX** — the idea that text should be the source of truth for complex documents
- **KiCad** — open-source EDA and the concept of shareable symbol libraries
- **Schemdraw** — Python-based schematic drawing as code
- **Graphviz** — the power of declarative graph description languages
- **VS Code** — for showing that a text editor can be both powerful and accessible

---

## 📬 Contact & Community

- **GitHub Issues** — bug reports and feature requests
- **GitHub Discussions** — questions, ideas, show & tell
- **Pull Requests** — welcome at any time

---

*ElectroDSL Beta v2.0 — Built for engineers, makers, students, and anyone who thinks in circuits.*

*"Write the circuit. See the schematic."*
