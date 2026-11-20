// =============================================================
// TUTORIAL: a short guided practice on Naija Street, about a minute.
// Part 1 as a thief: move, sprint, pick up ₦, buy, what each power-up
// does, zobo, Dash, hide, free a friend, escape.
// Part 2 as police: the Whistle, then catch a thief.
// A step with `info` is a card the player reads and closes with "Got it".
// The other characters stand still (or walk slowly) so the player can
// learn without being chased. Nothing here changes the normal rules.
// =============================================================
import { HIDES, GATES, EXITS, SHOPS, PRISON, freePt, solidAt, dist, W, H, CFG } from './world.js';
import { G, newMatch } from './sim.js';
import * as S from './scene.js';
import { ctl, vibrate } from './controls.js';

export function createTutorial(api){
  const $ = id => document.getElementById(id);
  const T = { active: false, part: 0, i: 0, okT: 0, d: {}, list: [], target: null };
  const me = () => G.ents[api.meId()];
  const nearest = (list, p) => list.reduce((b, x) => (!b || dist(x, p) < dist(b, p)) ? x : b, null);
  const hl = id => { document.querySelectorAll('.tut-hl').forEach(e => e.classList.remove('tut-hl')); if (id) $(id).classList.add('tut-hl'); };
  const touch = () => matchMedia('(pointer:coarse)').matches;

  // a free spot about `r` units from the player, away from walls
  function spotNear(p, r){
    for (let k = 0; k < 40; k++){
      const a = Math.random()*Math.PI*2, x = p.x + Math.cos(a)*r, y = p.y + Math.sin(a)*r;
      if (x > 2 && y > 2 && x < W-2 && y < H-2 && !solidAt(x, y, .9) && !(x > PRISON.x-2 && x < PRISON.x+PRISON.w+2 && y > PRISON.y-2 && y < PRISON.y+PRISON.h+2)) return { x, y };
    }
    const [x, y] = freePt(p.x+3, p.y); return { x, y };
  }

  function setup(team){
    api.useMap('street');
    newMatch({ slots: [{ team, ctrl: 'local', name: api.name() }], map: 'street', night: false, diff: 0 });
    G.tutorial = true; G.phase = 'play'; G.countT = 0;
    G.herd.t = 1e9; G.notes.length = 0; G.noteT = 1e9; G.pickups.length = 0; G.pickT = 1e9;
    const m = G.ents.find(e => e.ctrl === 'local');
    for (const e of G.ents) if (e !== m) e.ctrl = 'idle';
    return m;
  }

  const THIEF = [
    { text: () => `Put your thumb on the ${ctl().hand === 'left' ? 'right' : 'left'} side of the screen and drag to run` + (touch() ? '' : ' (or use WASD / arrow keys)'),
      setup(){ T.d.start = { x: me().x, y: me().y }; }, done: () => dist(me(), T.d.start) > 4 },
    { text: () => ({ auto: 'Push the stick all the way out to sprint', hold: 'Hold ⚡ SPRINT while you move. Sprinting uses energy (the bar at the bottom); walking gets it back', tap: 'Tap ⚡ SPRINT, then move. Sprinting uses energy (the bar at the bottom); walking gets it back' })[ctl().sprint] + (touch() ? '' : ' (or hold Shift)'),
      setup(){ T.d.spr = 0; if (ctl().sprint !== 'auto') hl('bRun'); }, tick(dt){ if (me().sprinting) T.d.spr += dt; }, done: () => T.d.spr > 1.2 },
    { text: () => 'Money lies on the street. Pick up the green ₦ note',
      setup(){ const p = spotNear(me(), 6); G.notes.push({ id: ++G.noteId, x: p.x, y: p.y }); T.target = p; }, done: () => me().wallet >= 10 },
    { text: () => `Shops sell food that helps you run. Stand in the green ring at ${T.d.shop.b.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())} and tap BUY`,
      setup(){ const m = me(); T.d.shop = nearest(SHOPS.filter(s => s.price <= 20), m) || nearest(SHOPS, m); m.wallet = Math.max(m.wallet, T.d.shop.price); T.target = T.d.shop; hl('bAct'); },
      done: () => me().stats.buys >= 1 },
    { info: true, text: () => 'POWER-UPS: what each one does',
      list: () => [
        ['🍛', 'Jollof, rice and stew, small chops, moi moi, pepper soup', `Belle full: energy goes to full and you don't tire for ${CFG.fullTime} seconds`],
        ['💧', 'Pure water, kunu, zobo drink', 'Energy back up by 60'],
        ['🍢', 'Suya', `Run ${Math.round((CFG.zoboBoost-1)*100)}% faster for ${CFG.suyaTime} seconds`],
        ['⚡', 'Glucose, chin-chin, mint sweet', 'Your Dash (or Whistle) is ready again straight away'],
        ['🍞', 'Agege bread on the street (free)', 'Energy straight back to full'],
        ['🧃', 'Zobo bottle on the street (free)', `Run faster for ${CFG.zoboTime} seconds`],
        ['💨', 'Dash (thieves)', `A quick burst. Use it when a policeman grabs you. Ready again after ${CFG.dashCd} seconds`],
        ['📯', 'Whistle (police)', `Slows every thief near you and pulls them out of hiding. Ready again after ${CFG.whistleCd} seconds`],
      ] },
    { text: () => 'Free power-ups turn up on the street. Grab the zobo bottle to run faster',
      setup(){ const p = spotNear(me(), 6); G.pickups.push({ id: ++G.pickId, k: 'zobo', x: p.x, y: p.y }); T.target = p; T.d.zobo = G.pickId; },
      done: () => !G.pickups.some(p => p.id === T.d.zobo) },
    { text: () => 'Your special move is Dash 💨. Tap it while running to burst forward' + (touch() ? '' : ' (or press Q)'),
      setup(){ me().abCd = 0; hl('bAbil'); }, done: () => me().stats.abil >= 1 },
    { text: () => "Police can't see you under trees. Walk under the tree (don't sprint)",
      setup(){ T.d.hid = 0; T.target = nearest(HIDES, me()); }, tick(dt){ if (me().hidden) T.d.hid += dt; }, done: () => T.d.hid > 1 },
    { text: () => `${T.d.friend.name} is locked in the Police Post. Stand at the gate and HOLD the big button`,
      setup(){ T.target = nearest(GATES, me()); hl('bAct'); }, done: () => me().stats.rescues >= 1 },
    { text: () => 'The exits are open. Run into a green corner and HOLD ESCAPE',
      setup(){ G.exitsOpen = true; api.announce('EXITS OPEN!', '#5dff8a', 1.6); T.target = nearest(EXITS.map(x => ({ x: x.cx, y: x.cy })), me()); hl('bAct'); },
      done: () => me().state === 'escaped' },
  ];
  const POLICE = [
    { text: () => "Now you're the police. Your special move is the Whistle 📯. Get near the thief and blow it to slow him down" + (touch() ? '' : ' (or press Q)'),
      setup(){ me().abCd = 0; hl('bAbil'); }, tick(){ const t = T.d.runner; T.target = { x: t.x, y: t.y }; }, done: () => me().stats.abil >= 1 },
    { text: () => "Now catch him. Run at the thief: you grab him automatically when you get close",
      setup(){ }, tick(){ const t = T.d.runner; T.target = { x: t.x, y: t.y }; }, done: () => me().stats.caps >= 1 },
  ];

  function startPart(n){
    T.part = n; T.i = 0;
    if (n === 1){
      const m = setup('T');
      // one friend locked in the Post; everyone else out of the way
      const others = G.ents.filter(e => e !== m);
      for (const e of others) e.state = 'escaped';
      const f = G.ents.find(e => e.team === 'T' && e !== m);
      f.state = 'jailed'; f.x = PRISON.x + PRISON.w/2; f.y = PRISON.y + PRISON.h/2; T.d.friend = f;
      T.list = THIEF;
      api.begin(m);
    } else {
      const m = setup('P');
      for (const e of G.ents) if (e !== m) e.state = 'escaped';
      const r = G.ents.find(e => e.team === 'T'); r.state = 'free';
      const p = spotNear(m, 7); r.x = p.x; r.y = p.y; T.d.runner = r;
      T.list = POLICE;
      api.begin(m);
    }
    enter();
  }
  function enter(){
    const s = T.list[T.i]; T.target = null; hl(null); T.okT = 0;
    $('tut').classList.remove('ok');
    const total = THIEF.length + POLICE.length, n = (T.part === 1 ? 0 : THIEF.length) + T.i + 1;
    $('tutStep').textContent = `${T.part === 1 ? '🏃 THIEF' : '🚓 POLICE'} · STEP ${n} OF ${total}`;
    s.setup && s.setup();
    $('tutText').textContent = s.text();
    const info = $('tutInfo'); info.innerHTML = '';
    $('tut').classList.toggle('info', !!s.info);
    if (s.info){
      for (const [icon, name, what] of s.list()){
        const r = document.createElement('div'); r.className = 'pu';
        const i = document.createElement('span'); i.textContent = icon;
        const t = document.createElement('div'); const b = document.createElement('b'); b.textContent = name; t.appendChild(b); t.appendChild(document.createTextNode(what));
        r.appendChild(i); r.appendChild(t); info.appendChild(r);
      }
      T.d.infoOk = false;
    }
  }
  function passed(){
    $('tut').classList.remove('info'); $('tutInfo').innerHTML = '';
    $('tut').classList.add('ok'); $('tutText').textContent = '✔ ' + ['Nice!', 'Correct!', 'Sharp guy!', 'Na so!'][T.i % 4];
    api.sfx('chime'); vibrate(40); hl(null); T.target = null;
    T.okT = .9;
  }
  function next(){
    T.i++;
    if (T.i < T.list.length){ enter(); return; }
    if (T.part === 1){ startPart(2); return; }
    finish();
  }
  function finish(){
    T.active = false; S.setGuide(null); hl(null);
    $('tut').classList.add('hidden'); $('tutArrow').classList.add('hidden');
    const first = !api.save().tutDone;
    api.save().tutDone = true; if (first) api.save().coins += 100; api.persist();
    $('tutEndText').textContent = first ? "That's everything. Here's ₦100 to spend in the Wardrobe." : "That's everything. Go and play.";
    api.pause(true);
    $('tutEnd').classList.remove('hidden');
  }

  return {
    get active(){ return T.active; },
    infoOk(){ T.d.infoOk = true; },
    start(){
      T.active = true; T.d = {};
      document.body.classList.add('tutorial');
      $('tut').classList.remove('hidden');
      startPart(1);
    },
    stop(){
      document.body.classList.remove('tutorial');
      if (!T.active && $('tut').classList.contains('hidden')) return;
      T.active = false; S.setGuide(null); hl(null);
      $('tut').classList.add('hidden'); $('tutArrow').classList.add('hidden'); document.body.classList.remove('tutorial');
    },
    // what the standing-still characters do: the runner in part 2 walks slowly away
    inputFor(e){
      if (T.part === 2 && e === T.d.runner && e.state === 'free'){
        const m = me(), dx = e.x - m.x, dy = e.y - m.y, d = Math.hypot(dx, dy) || 1;
        if (d < 6) return { mx: dx/d*.42, my: dy/d*.42 };
      }
      return { mx: 0, my: 0 };
    },
    update(dt){
      if (!T.active || !G || !G.tutorial) return;
      const s = T.list[T.i];
      if (T.okT > 0){ T.okT -= dt; if (T.okT <= 0) next(); }
      else if (s.info){ if (T.d.infoOk){ T.d.infoOk = false; T.okT = .01; $('tut').classList.remove('info'); $('tutInfo').innerHTML = ''; } }
      else { s.tick && s.tick(dt); if (s.done()) passed(); }
      // the yellow marker on the ground, and an arrow at the screen edge when it's off screen
      const g = T.target; S.setGuide(g ? g.x : null, g ? g.y : null);
      const a = $('tutArrow');
      if (!g){ a.classList.add('hidden'); return; }
      const [sx, sy, front] = S.project(g.x, g.y, 1);
      const pad = 34, off = !front || sx < pad || sy < 90 || sx > innerWidth - pad || sy > innerHeight - pad;
      if (!off){ a.classList.add('hidden'); return; }
      const cx = innerWidth/2, cy = innerHeight/2;
      let dx = sx - cx, dy = sy - cy; if (!front){ dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx), k = Math.min((cx - pad)/Math.abs(Math.cos(ang) || 1e-6), (cy - 90)/Math.abs(Math.sin(ang) || 1e-6));
      a.classList.remove('hidden');
      a.style.left = (cx + Math.cos(ang)*k - 18) + 'px'; a.style.top = (cy + Math.sin(ang)*k - 22) + 'px';
      a.style.transform = `rotate(${ang}rad)`;
    },
  };
}
