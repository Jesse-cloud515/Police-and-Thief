// =============================================================
// CONTROLS: touch joystick, on-screen buttons, keyboard, and the
// player's own control settings (layout, sizes, sprint style, keys).
//
// The joystick works like eFootball's: it is hidden until you touch
// the move side of the screen, appears under your thumb, and follows
// your thumb if you drag past its edge. "Fixed" mode keeps it in one
// place instead.
// =============================================================

export const DEFAULT_CTL = {
  joy: 'float',          // 'float' (appears where you touch) | 'fixed'
  joySize: 1,            // 0.8 | 1 | 1.25
  sprint: 'auto',        // 'auto' (push the stick to the edge) | 'hold' | 'tap'
  hand: 'right',         // 'right' = move with the left thumb | 'left' = mirrored
  btnSize: 1,            // 0.8 | 1 | 1.2
  opacity: 0.85,         // buttons and stick, 0.4 to 1
  vibrate: true,
  layout: null,          // { id: [fx, fy] } centres as fractions of the screen, set in the layout editor
  keys: { action: 'Space', ability: 'KeyQ', sprint: 'ShiftLeft' },
};
const BASE = 120, KNOB = 52;                    // joystick sizes in px at joySize 1
const SIZES = { bAct: 96, bAbil: 62, bRun: 62 };
const DEAD = 0.12, FULL = 0.85, SPRINT_AT = 0.96;

let cfgGet = () => DEFAULT_CTL, save = () => {}, isPlaying = () => false;
const $ = id => document.getElementById(id);
export const CTL = { editing: false, lastMag: 0, usedStick: false, onEditClose: null };

// settings, always complete even if the save is from an older version
export function ctl(){
  const c = cfgGet();
  for (const k in DEFAULT_CTL) if (c[k] === undefined) c[k] = JSON.parse(JSON.stringify(DEFAULT_CTL[k]));
  for (const k in DEFAULT_CTL.keys) if (!c.keys[k]) c.keys[k] = DEFAULT_CTL.keys[k];
  return c;
}

// ------------------------------------------------------------ state
const keys = {};
const st = { held: false, press: false, ab: false, runTap: false, runHeld: false };
const J = { on: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, raw: 0, sx: 0, sy: 0 };

// ------------------------------------------------------------ layout
function defaultLayout(hand){
  const w = innerWidth, h = innerHeight, m = v => hand === 'left' ? 1 - v : v;
  // centres in px from the right/bottom edges, turned into fractions of the screen
  const at = (fromRight, fromBottom) => [m(1 - fromRight / w), 1 - fromBottom / h];
  return { bAct: at(66, 80), bAbil: at(160, 132), bRun: at(156, 56), chat: at(70, 236), joy: [m(.26), .8] };
}
function layout(){
  const c = ctl(), d = defaultLayout(c.hand);
  return { ...d, ...(c.layout || {}) };
}
export function applyControls(){
  const c = ctl(), L = layout();
  const root = $('ctrl'); if (!root) return;
  root.style.setProperty('--ctl-op', String(c.opacity));
  for (const id of ['bAct', 'bAbil', 'bRun']){
    const b = $(id), s = Math.round(SIZES[id] * c.btnSize);
    b.style.width = b.style.height = s + 'px';
    b.style.left = (L[id][0] * 100) + '%'; b.style.top = (L[id][1] * 100) + '%';
    b.style.right = b.style.bottom = 'auto';
    b.style.fontSize = Math.round((id === 'bAct' ? 15 : 11) * c.btnSize) + 'px';
  }
  const chat = $('chat'); chat.style.left = (L.chat[0] * 100) + '%'; chat.style.top = (L.chat[1] * 100) + '%'; chat.style.right = chat.style.bottom = 'auto';
  chat.style.alignItems = L.chat[0] < .5 ? 'flex-start' : 'flex-end';
  // the move zone is the side of the screen opposite the buttons
  const z = $('joyZone');
  z.style.left = c.hand === 'left' ? '42%' : '0'; z.style.right = c.hand === 'left' ? '0' : '42%';
  z.style.width = 'auto';
  const base = $('joyBase'), size = Math.round(BASE * c.joySize), k = Math.round(KNOB * c.joySize);
  base.style.width = base.style.height = size + 'px';
  $('joyKnob').style.width = $('joyKnob').style.height = k + 'px';
  $('bRun').classList.toggle('hidden', c.sprint === 'auto');
  if (c.joy === 'fixed'){ const [fx, fy] = L.joy; placeBase(fx * innerWidth, fy * innerHeight); base.classList.add('idle'); }
  else if (!J.on) base.classList.remove('idle', 'show');
  $('joyHint').classList.toggle('hidden', c.joy === 'fixed');
  $('joyHint').style.left = (c.hand === 'left' ? 74 : 26) + '%';
}
function placeBase(x, y){ const b = $('joyBase'); b.style.left = x + 'px'; b.style.top = y + 'px'; }
function placeKnob(dx, dy){ $('joyKnob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }

// ------------------------------------------------------------ joystick
function radius(){ return BASE * ctl().joySize / 2; }
function joyDown(e){
  if (CTL.editing) return;
  e.preventDefault(); if (J.on) return;
  const c = ctl(), r = radius();
  J.on = true; J.id = e.pointerId;
  if (c.joy === 'fixed'){ const [fx, fy] = layout().joy; J.ox = fx * innerWidth; J.oy = fy * innerHeight; }
  else {
    // keep the whole stick on screen
    J.ox = Math.min(innerWidth - r - 6, Math.max(r + 6, e.clientX));
    J.oy = Math.min(innerHeight - r - 6, Math.max(r + 6, e.clientY));
  }
  placeBase(J.ox, J.oy); $('joyBase').classList.add('show'); $('joyHint').classList.add('gone');
  joyMove(e);
  try{ $('joyZone').setPointerCapture(e.pointerId); }catch(_){}
}
function joyMove(e){
  if (!J.on || e.pointerId !== J.id) return;
  const c = ctl(), r = radius();
  let dx = e.clientX - J.ox, dy = e.clientY - J.oy, d = Math.hypot(dx, dy);
  // past the edge: the stick follows your thumb (floating mode only)
  if (d > r && c.joy === 'float'){ const over = d - r; J.ox += dx / d * over; J.oy += dy / d * over; placeBase(J.ox, J.oy); dx = e.clientX - J.ox; dy = e.clientY - J.oy; d = r; }
  if (d > r){ dx = dx / d * r; dy = dy / d * r; d = r; }
  placeKnob(dx, dy);
  J.raw = d / r;
  const m = J.raw < DEAD ? 0 : Math.min(1, (J.raw - DEAD) / (FULL - DEAD));
  J.dx = d ? dx / d * m : 0; J.dy = d ? dy / d * m : 0;
  $('joyBase').classList.toggle('sprint', c.sprint === 'auto' && J.raw >= SPRINT_AT);
}
function joyUp(e){
  if (e.pointerId !== J.id) return;
  J.on = false; J.dx = J.dy = 0; J.raw = 0; placeKnob(0, 0);
  const b = $('joyBase'); b.classList.remove('show', 'sprint');
  if (ctl().joy === 'fixed'){ const [fx, fy] = layout().joy; placeBase(fx * innerWidth, fy * innerHeight); }
}

// ------------------------------------------------------------ buttons
function btn(id, down, up){
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (CTL.editing) return; down(); try{ b.setPointerCapture(e.pointerId); }catch(_){} b.classList.add('down'); });
  const end = () => { b.classList.remove('down'); if (up) up(); };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
}

// ------------------------------------------------------------ input for one game step
export function readInput(){
  const c = ctl(), K = c.keys;
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  const km = Math.hypot(mx, my); if (km > 1){ mx /= km; my /= km; }
  if (J.on){ mx = J.dx; my = J.dy; }
  // light smoothing: takes the jitter out of a thumb on glass without adding lag you can feel
  const a = (mx || my) ? .55 : 1;
  J.sx += (mx - J.sx) * a; J.sy += (my - J.sy) * a;
  if (!(mx || my)){ J.sx = J.sy = 0; }
  const keySprint = !!(keys[K.sprint] || (K.sprint === 'ShiftLeft' && keys.ShiftRight));
  let sprint = keySprint;
  if (c.sprint === 'auto') sprint = sprint || (J.on && J.raw >= SPRINT_AT);
  else if (c.sprint === 'hold') sprint = sprint || st.runHeld;
  else sprint = sprint || st.runTap;
  CTL.lastMag = Math.hypot(J.sx, J.sy); if (CTL.lastMag > .2) CTL.usedStick = true;
  const inp = { mx: J.sx, my: J.sy, sprint, action: !!(keys[K.action] || keys.KeyE || st.held), press: st.press, ability: st.ab };
  st.press = false; st.ab = false;
  return inp;
}
export function resetMatch(){
  st.held = st.press = st.ab = st.runTap = st.runHeld = false;
  J.on = false; J.dx = J.dy = J.sx = J.sy = 0;
  $('bRun').classList.remove('on'); $('joyBase').classList.remove('show', 'sprint');
  $('joyHint').classList.remove('gone');
  applyControls();
}
export function vibrate(ms){ if (!ctl().vibrate) return; try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

// ------------------------------------------------------------ key names
export function keyName(code){
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { Space:'Space', ShiftLeft:'Shift', ShiftRight:'R-Shift', ControlLeft:'Ctrl', AltLeft:'Alt', Enter:'Enter', Tab:'Tab', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→' }[code] || code;
}
let capturing = null;

// ------------------------------------------------------------ layout editor
export function openLayoutEditor(onClose){
  CTL.editing = true; CTL.onEditClose = onClose || null; document.body.classList.add('editing');
  $('ctrl').classList.remove('hidden'); $('ctrl').classList.add('editing');
  $('ctlEdit').classList.remove('hidden');
  const c = ctl(); const [fx, fy] = layout().joy;
  placeBase(fx * innerWidth, fy * innerHeight); $('joyBase').classList.add('show');
  $('joyBase').dataset.label = c.joy === 'fixed' ? 'STICK' : 'STICK (when Fixed)';
  applyControls(); $('bRun').classList.remove('hidden');
  if ($('chat').children.length === 0){ for (const t of ['Quick chat', 'Quick chat']){ const b = document.createElement('button'); b.textContent = t; $('chat').appendChild(b); } $('chat').dataset.temp = '1'; }
}
function closeEditor(){
  CTL.editing = false; document.body.classList.remove('editing');
  $('ctrl').classList.remove('editing'); $('ctlEdit').classList.add('hidden');
  if ($('chat').dataset.temp){ $('chat').innerHTML = ''; delete $('chat').dataset.temp; }
  $('joyBase').classList.remove('show');
  if (!isPlaying()) $('ctrl').classList.add('hidden');
  applyControls();
  if (CTL.onEditClose) CTL.onEditClose();
}
function makeDraggable(id, key){
  const elx = $(id); let drag = null;
  elx.addEventListener('pointerdown', e => {
    if (!CTL.editing) return;
    e.preventDefault(); e.stopPropagation();
    const r = elx.getBoundingClientRect();
    drag = { id: e.pointerId, ox: e.clientX - (r.left + r.width / 2), oy: e.clientY - (r.top + r.height / 2) };
    try{ elx.setPointerCapture(e.pointerId); }catch(_){}
    elx.classList.add('dragging');
  }, true);
  elx.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const c = ctl(); const L = layout();
    const x = Math.min(innerWidth - 24, Math.max(24, e.clientX - drag.ox)), y = Math.min(innerHeight - 24, Math.max(70, e.clientY - drag.oy));
    c.layout = { ...L, [key]: [x / innerWidth, y / innerHeight] };
    if (key === 'joy') placeBase(x, y); else applyControls();
  });
  const end = () => { if (drag){ drag = null; elx.classList.remove('dragging'); save(); } };
  elx.addEventListener('pointerup', end); elx.addEventListener('pointercancel', end);
}

// ------------------------------------------------------------ settings panel (Controls tab)
const OPT = {
  joy: [['float', 'Floating'], ['fixed', 'Fixed']],
  joySize: [[0.8, 'Small'], [1, 'Medium'], [1.25, 'Large']],
  sprint: [['auto', 'Stick edge'], ['hold', 'Hold RUN'], ['tap', 'Tap RUN']],
  hand: [['right', 'Move left'], ['left', 'Move right']],
  btnSize: [[0.8, 'Small'], [1, 'Medium'], [1.2, 'Large']],
};
const HELP = {
  joy: { float: 'Appears wherever you put your thumb, and follows it.', fixed: 'Stays in one spot. Drag it in Edit layout.' },
  sprint: { auto: 'Push the stick all the way out to sprint. No RUN button.', hold: 'Sprint while you hold RUN.', tap: 'Tap RUN to switch sprint on and off.' },
};
export function renderControlSettings(box){
  const c = ctl(); box.innerHTML = '';
  const row = (label, key) => {
    const r = document.createElement('div'); r.className = 'srow';
    const l = document.createElement('div'); l.className = 'slab'; l.textContent = label; r.appendChild(l);
    const seg = document.createElement('div'); seg.className = 'seg sseg';
    for (const [v, t] of OPT[key]){
      const b = document.createElement('button'); b.textContent = t; b.classList.toggle('on', c[key] === v);
      b.onclick = () => {
        if (key === 'hand' && c.hand !== v && c.layout){ const m = {}; for (const k in c.layout) m[k] = [1 - c.layout[k][0], c.layout[k][1]]; c.layout = m; }
        c[key] = v; save(); applyControls(); renderControlSettings(box);
      };
      seg.appendChild(b);
    }
    r.appendChild(seg);
    if (HELP[key]){ const h = document.createElement('div'); h.className = 'shelp'; h.textContent = HELP[key][c[key]]; r.appendChild(h); }
    box.appendChild(r);
  };
  row('Joystick', 'joy'); row('Joystick size', 'joySize'); row('Sprint', 'sprint'); row('Hands', 'hand'); row('Button size', 'btnSize');
  // see-through
  { const r = document.createElement('div'); r.className = 'srow';
    const l = document.createElement('div'); l.className = 'slab'; l.textContent = `See-through: ${Math.round(c.opacity * 100)}%`; r.appendChild(l);
    const s = document.createElement('input'); s.type = 'range'; s.min = 40; s.max = 100; s.step = 5; s.value = Math.round(c.opacity * 100); s.className = 'srange';
    s.oninput = () => { c.opacity = s.value / 100; l.textContent = `See-through: ${s.value}%`; applyControls(); };
    s.onchange = () => save(); r.appendChild(s); box.appendChild(r); }
  // vibration
  { const b = document.createElement('button'); b.className = 'btn ghost sbtn'; b.textContent = 'Vibration: ' + (c.vibrate ? 'ON' : 'OFF');
    b.onclick = () => { c.vibrate = !c.vibrate; save(); renderControlSettings(box); if (c.vibrate) vibrate(40); }; box.appendChild(b); }
  // layout editor
  { const b = document.createElement('button'); b.className = 'btn orange sbtn'; b.textContent = '✋ Edit button layout';
    b.onclick = () => { $('setDlg').classList.add('hidden'); openLayoutEditor(() => { $('setDlg').classList.remove('hidden'); renderControlSettings(box); }); }; box.appendChild(b); }
  // keyboard
  { const r = document.createElement('div'); r.className = 'srow';
    const l = document.createElement('div'); l.className = 'slab'; l.textContent = 'Keyboard (move with WASD or arrows)'; r.appendChild(l);
    const g = document.createElement('div'); g.className = 'skeys';
    for (const [k, t] of [['action', 'Action'], ['ability', 'Dash / Whistle'], ['sprint', 'Sprint']]){
      const b = document.createElement('button'); b.className = 'skey';
      b.innerHTML = `<span></span><b></b>`; b.firstChild.textContent = t; b.lastChild.textContent = capturing === k ? 'Press a key…' : keyName(c.keys[k]);
      b.onclick = () => { capturing = k; renderControlSettings(box); };
      g.appendChild(b);
    }
    r.appendChild(g); box.appendChild(r); }
  { const b = document.createElement('button'); b.className = 'btn ghost sbtn'; b.textContent = 'Reset controls';
    b.onclick = () => { const v = c.vibrate; Object.assign(c, JSON.parse(JSON.stringify(DEFAULT_CTL)), { vibrate: v }); save(); applyControls(); renderControlSettings(box); };
    box.appendChild(b); }
  CTL._box = box;
}

// ------------------------------------------------------------ setup
export function initControls(opts){
  cfgGet = opts.get; save = opts.save; isPlaying = opts.isPlaying;
  const z = $('joyZone');
  z.addEventListener('pointerdown', joyDown); z.addEventListener('pointermove', joyMove);
  z.addEventListener('pointerup', joyUp); z.addEventListener('pointercancel', joyUp);
  btn('bAct', () => { st.held = true; st.press = true; }, () => { st.held = false; });
  btn('bAbil', () => { st.ab = true; });
  btn('bRun', () => { const c = ctl(); if (c.sprint === 'tap'){ st.runTap = !st.runTap; $('bRun').classList.toggle('on', st.runTap); } else { st.runHeld = true; $('bRun').classList.add('on'); } },
              () => { if (ctl().sprint !== 'tap'){ st.runHeld = false; $('bRun').classList.remove('on'); } });
  makeDraggable('bAct', 'bAct'); makeDraggable('bAbil', 'bAbil'); makeDraggable('bRun', 'bRun'); makeDraggable('chat', 'chat'); makeDraggable('joyBase', 'joy');
  $('ctlDone').onclick = closeEditor;
  $('ctlReset').onclick = () => { ctl().layout = null; save(); applyControls(); const [fx, fy] = layout().joy; placeBase(fx * innerWidth, fy * innerHeight); };
  addEventListener('keydown', e => {
    if (capturing){
      e.preventDefault();
      if (e.code !== 'Escape'){ const c = ctl(); for (const k in c.keys) if (c.keys[k] === e.code) c.keys[k] = c.keys[capturing]; c.keys[capturing] = e.code; save(); }
      capturing = null; if (CTL._box) renderControlSettings(CTL._box); return;
    }
    if (!isPlaying()) return;
    const K = ctl().keys;
    if ((e.code === K.action || e.code === 'KeyE') && !e.repeat) st.press = true;
    if (e.code === K.ability && !e.repeat) st.ab = true;
    keys[e.code] = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; st.held = false; st.runHeld = false; J.on = false; J.dx = J.dy = 0; });
  addEventListener('resize', () => applyControls());
  applyControls();
}
