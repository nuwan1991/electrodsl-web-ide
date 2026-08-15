// ─── ElectroDSL AI Module v2 ──────────────────────────────────────────────────
window.ElectroAI = (function () {

  const SYSTEM_PROMPT = `You are ElectroDSL, an expert electrical schematic DSL code generator.
Output ONLY valid ElectroDSL — no markdown, no backticks, no explanation, no preamble.

═══ SYNTAX ═══
CIRCUIT "Title" {
  ID: Type(params) at (x, y) label="Name" [value="val"] [rotate=0|90|180|270]
  wire FROM_ID.pinName -> TO_ID.pinName
}

═══ COMPONENT TYPES & THEIR EXACT PIN NAMES ═══

Two-pin (horizontal by default):
  Resistor(value)         pins: .1  .2
  Capacitor(value)        pins: .p (positive)  .n (negative)
  Inductor(value)         pins: .1  .2
  Diode(model)            pins: .A (anode, left)  .K (cathode, right)
  LED(color)              pins: .A  .K
  Zener(model)            pins: .A  .K
  Schottky(model)         pins: .A  .K
  Switch                  pins: .1  .2

Two-pin (vertical by default):
  VSource(voltage,AC|DC)  pins: .p (positive, top)  .n (negative, bottom)
  ISource(current)        pins: .p (top)  .n (bottom)

Single-pin:
  Ground                  pin:  .1  (top — wire TO this pin)
  VCC(voltage)            pin:  .1  (bottom — wire TO this pin)
  Node                    pin:  .1  (center junction)

Three-pin:
  NPN(model)              pins: .B (base, left)  .C (collector, upper-right)  .E (emitter, lower-right)
  PNP(model)              pins: .B  .C  .E
  NMOS(model)             pins: .G (gate, left)  .D (drain, upper-right)  .S (source, lower-right)
  PMOS(model)             pins: .G  .D  .S
  JFET(model)             pins: .G  .D  .S

Five-pin:
  OpAmp(model)            pins: .IN+ (non-inv, upper-left)  .IN- (inv, lower-left)  .OUT (right)  .V+ (top)  .V- (bottom)

Four-pin:
  Transformer             pins: .P1 .P2 (primary)  .S1 .S2 (secondary)

Three-pin:
  Thyristor(model)        pins: .A (anode, left)  .K (cathode, right)  .G (gate, bottom)

═══ COORDINATE RULES ═══
x: 1 to 14, y: 1 to 10 (higher y = higher on canvas)
Space components minimum 2 units apart
VSource/ISource: place at x=1, vertical
Ground: place 2 below the component it connects to
VCC: place 2 above the component it connects to
Transistors: allow x-spacing of 3 for collector/emitter leads

═══ ROTATION ═══
rotate=0    default orientation
rotate=90   rotates symbol 90° clockwise
rotate=180  flips horizontally
rotate=270  rotates 270° clockwise
Pin positions rotate with the symbol.

═══ RULES ═══
- ALWAYS wire to the exact pin name shown above
- Every Ground and VCC needs a wire connecting it
- Include all power supply connections
- Output raw DSL starting with CIRCUIT, nothing else

═══ EXAMPLE ═══
CIRCUIT "RC Filter" {
  V1: VSource(5V,AC) at (1, 5) label="Vin"
  R1: Resistor(10k)  at (4, 5) label="R1" value="10kΩ"
  C1: Capacitor(100nF) at (7, 5) label="C1" value="100nF"
  GND1: Ground at (1, 3)
  GND2: Ground at (7, 3)
  VOUT: Node   at (7, 5) label="Vout"
  wire V1.p   -> R1.1
  wire R1.2   -> C1.p
  wire C1.p   -> VOUT.1
  wire V1.n   -> GND1.1
  wire C1.n   -> GND2.1
}`;

  async function generate(prompt, onStatus) {
    onStatus('Connecting to Claude AI…');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      onStatus('Parsing response…');
      const data = await res.json();
      const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const clean = text.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim();

      if (!clean.startsWith('CIRCUIT')) {
        throw new Error('Unexpected AI response — try rephrasing');
      }
      onStatus('Done!');
      return { ok: true, code: clean };
    } catch (e) {
      onStatus('Error: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  async function modify(currentCode, instruction, onStatus) {
    const prompt = `Current circuit:\n\n${currentCode}\n\nModify: ${instruction}\n\nReturn complete updated DSL only.`;
    return generate(prompt, onStatus);
  }

  return { generate, modify };
})();
