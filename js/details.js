// =============================================================
// DETAILS: the things that make the street feel lived in.
// Open shop fronts with goods and shopkeepers, the market, the
// football and goal nets, ₦ notes, chickens, smoke, washing lines.
// Nothing here changes the rules; the rules live in sim.js.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHOPS, GOAL, BALL_HOME, PITCH, solidAt, MAP, OB, FLEE_PTS, herdAt, W, H as MAPH } from './world.js';
import { makeCharacter } from './chars.js';

let H = null;                       // helpers handed over by scene.js: { add, tm, fx }
const live = { keepers:[], rings:[], signs:[], glows:[], chickens:[], ball:null, ballPos:null, notes:new Map(), noteGroup:null, smokeT:0, group:null };

function canvasTex(w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const box = (w,h,d) => new THREE.BoxGeometry(w,h,d);
const cyl = (r1,r2,h,s=10) => new THREE.CylinderGeometry(r1,r2,h,s);
const ball = (r,s=8) => new THREE.SphereGeometry(r,s,6);

export function buildStreet(world, helpers){
  H = helpers;
  const { add, tm } = H;
  for (const k of ['keepers','rings','signs','glows','chickens','smokers','cows']) live[k] = [];
  live.notes.clear(); live.ball = null; live.herd = null; live.bell = null; live.gapRings = [];
  live.group = new THREE.Group(); live.group.userData.dyn = true; world.add(live.group);

  SHOPS.forEach((s, i) => {
    const o = s.o, cx = o.x+o.w/2, z0 = o.y+o.h;
    // striped awning over the shop front
    const stripe = canvasTex(128, 16, (g) => { for (let k=0;k<8;k++){ g.fillStyle = k%2 ? o.col : '#f7f1e3'; g.fillRect(k*16,0,16,16); } });
    const aw = add(box(o.w*.92, .06, .62), tm(0xffffff, { map: stripe }), cx, 2.12, z0+.28); aw.rotation.x = .3;
    for (const dx of [-o.w*.42, o.w*.42]) add(cyl(.035,.035,1.9,6), tm(0x6b6b6b), cx+dx, 1.0, z0+.58);
    // counter beside the door
    const kx = cx + Math.min(1.15, o.w/2-.85);
    add(box(1.5,.8,.5), tm(0x8a5a3a), kx, .4, z0+.62);
    add(box(1.6,.06,.6), tm(0xd9b98a), kx, .83, z0+.62);
    stock(s.goods, kx, z0, cx, o);
    if (s.goods==='suya') live.smokers.push([kx, z0+.62, 0xb9b0a6, 1]); else if (s.goods==='pots') live.smokers.push([kx-.2, z0+.62, 0xf2f2f2, .5]);
    // shopkeeper in the doorway
    const k = makeCharacter('T', KEEPERS[['pots','store','suya','chemist','cooler','chops'].indexOf(s.goods)] || KEEPERS[i%6]);
    k.root.position.set(cx - Math.min(1, o.w/2-1), 0, z0+.7); k.root.rotation.y = .25;
    live.group.add(k.root); live.keepers.push(k);
    // price board, counter ring and a lantern glow for night games
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: priceTex(s), depthWrite:false }));
    sign.scale.set(2.5, .62, 1); sign.position.set(s.x, 3.05, z0+.2); live.group.add(sign); live.signs.push(sign);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62,.8,28), new THREE.MeshBasicMaterial({ color:0x35e0a1, transparent:true, opacity:.75, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; ring.position.set(s.x, .045, s.y); live.group.add(ring); live.rings.push(ring);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.5,4), new THREE.MeshBasicMaterial({ map: glowTex(), color:0xffb65c, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI/2; glow.position.set(cx, .05, z0+1.2); live.group.add(glow); live.glows.push(glow);
    add(ball(.09), new THREE.MeshBasicMaterial({ color:0xffe6a8 }), cx, 1.9, z0+.6, live.group, false);   // hanging bulb
  });
  if (MAP.id==='street'){ market(); washing(); poles(); }
  if (MAP.ball){ pitch(world); makeBall(); }
  if (MAP.id==='market') marketPeople();
  if (MAP.bell) schoolBits();
  if (MAP.gaps) churchBits();
  if (MAP.herd) makeHerd();
  makeChickens();
  live.noteGroup = new THREE.Group(); live.group.add(live.noteGroup);
}

// who is selling: skin, clothes and headgear for each shopkeeper
const KEEPERS = [
  { skin:1, civ:'#c2185b', civP:'#6a1b4d', head:'gele', gele:'#f4c430', eyes:'none', extra:'none', shoes:2 },   // Mama Put
  { skin:2, civ:'#1b7f5c', civP:'#0f4f39', head:'gele', gele:'#e0601f', eyes:'specs', extra:'none', shoes:0 },  // Iya Bisi
  { skin:0, civ:'#f2f2f2', civP:'#3a3a3a', head:'fila', eyes:'none', extra:'none', shoes:0 },                   // Mai Suya
  { skin:3, civ:'#ffffff', civP:'#2b3a55', head:'none', eyes:'specs', extra:'none', shoes:1 },                  // Chemist
  { skin:2, civ:'#0b8a3e', civP:'#222222', head:'beanie', eyes:'none', extra:'none', shoes:3 },                 // Viewing centre
  { skin:4, civ:'#5b2a86', civP:'#2a1240', head:'gele', gele:'#35c9d6', eyes:'none', extra:'chain', shoes:2 },  // Owambe
];

function priceTex(s){
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(16,10,6,.82)'; g.beginPath(); g.roundRect(4,4,w-8,h-8,28); g.fill();
    g.strokeStyle = '#35e0a1'; g.lineWidth = 6; g.stroke();
    g.font = '900 60px Nunito, Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(s.icon + ' ' + s.item, 26, h/2+3, 330);
    g.fillStyle = '#ffd84d'; g.textAlign = 'right'; g.fillText('₦' + s.price, w-26, h/2+3);
  });
}
let GT = null;
function glowTex(){ return GT || (GT = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,64,64); })); }

// what is on each counter
function stock(goods, kx, z0, cx, o){
  const i = ['pots','store','suya','chemist','cooler','chops'].indexOf(goods);
  const { add, tm } = H, y = .86, z = z0+.62;
  if (i===0){            // Mama Put: pots of jollof and stew, plates, a cooler of drinks
    for (const [dx,top] of [[-.4,0xe8742a],[.15,0x9b2a14]]){ add(cyl(.24,.2,.3,12), tm(0x2a2a2a), kx+dx, y+.15, z); add(cyl(.21,.21,.03,12), tm(top), kx+dx, y+.3, z); }
    for (let k=0;k<4;k++) add(cyl(.13,.13,.02,10), tm(0xffffff), kx+.58, y+.02+k*.03, z+.05);
    add(box(.7,.5,.5), tm(0x2e86de), kx+1.25, .25, z+.1); add(box(.74,.06,.54), tm(0xffffff), kx+1.25, .53, z+.1);
    add(cyl(.3,.34,.22,10), tm(0x444444), cx-1.4, .11, z0+1.3);             // charcoal stove
  } else if (i===1){     // Iya Bisi: bread, tinned milk, crates of minerals, sachets on a string
    for (let k=0;k<3;k++) add(box(.34,.15,.17), tm(0xd9a05b), kx-.45+k*.02, y+.08+k*.16, z);
    for (let k=0;k<4;k++) add(cyl(.06,.06,.13,8), tm(k%2?0xc0392b:0x1f6fc2), kx+.02+k*.15, y+.07, z-.08);
    add(box(.3,.22,.2), tm(0xbfe6ff, { transparent:true, opacity:.75 }), kx+.5, y+.11, z+.08);                 // bag of pure water
    for (let k=0;k<3;k++) add(box(.5,.3,.36), tm([0xc0392b,0xf1c40f,0x0b8a3e][k]), kx+1.2, .15+k*.31, z+.05);  // crates
    for (let k=0;k<9;k++) add(box(.1,.16,.01), tm([0xe74c3c,0xf1c40f,0x2e86de,0x27ae60][k%4]), cx-o.w*.36+k*.2, 1.72, z0+.6);
    add(box(o.w*.74,.015,.015), tm(0x333333), cx, 1.81, z0+.6);
  } else if (i===2){     // Suya spot: grill, skewers, onions and tomatoes, old newspaper to wrap
    add(box(.95,.12,.45), tm(0x2b2b2b), kx, y+.2, z);
    for (const dx of [-.4,.4]) add(box(.05,.2,.05), tm(0x2b2b2b), kx+dx, y+.08, z);
    add(box(.85,.02,.36), new THREE.MeshBasicMaterial({ color:0xff5a1f }), kx, y+.27, z, undefined, false);
    for (let k=0;k<5;k++){ const st = add(cyl(.012,.012,.42,5), tm(0xc9a26b), kx-.32+k*.16, y+.31, z); st.rotation.x = Math.PI/2; add(box(.07,.05,.24), tm(0x6e2b12), kx-.32+k*.16, y+.33, z); }
    for (let k=0;k<4;k++) add(ball(.07), tm(k%2?0xd63a2f:0xe8d7f0), kx+1.05+(k%2)*.16, .88, z-.05+(k>1?.15:0));
    add(box(.3,.02,.5), tm(0x9a6b3d), kx+1.12, .84, z); add(box(.34,.06,.26), tm(0xe8e2d2), kx+1.12, .86, z+.42);
  } else if (i===3){     // Chemist: green cross, tidy boxes
    const gm = new THREE.MeshBasicMaterial({ color:0x19d36b });
    add(box(.5,.16,.05), gm, cx, 2.55, z0+.05, undefined, false); add(box(.16,.5,.05), gm, cx, 2.55, z0+.05, undefined, false);
    for (let k=0;k<6;k++) add(box(.16,.12+(k%3)*.05,.12), tm([0xffffff,0x7ec8ff,0xff8f8f][k%3]), kx-.55+k*.2, y+.08, z);
    add(box(.5,.35,.3), tm(0xf4f4f4), kx+1.2, .18, z); add(box(.2,.06,.02), tm(0xd63a2f), kx+1.2, .25, z+.16);
  } else if (i===4){     // Viewing centre: today's match on a board, kunu in a cooler, a bench
    const bt = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0,0,w,h); g.fillStyle = '#ffd84d'; g.font = '900 34px Arial'; g.textAlign = 'center';
      ['TODAY 4PM','LIVE MATCH'].forEach((t,k) => g.fillText(t, w/2, 50+k*42)); g.fillStyle = '#fff'; g.font = '900 26px Arial'; ['RED STARS','vs','GREEN LIONS'].forEach((t,k) => g.fillText(t, w/2, 150+k*34)); g.fillStyle = '#ff6b6b'; g.fillText('GATE ₦200', w/2, 270); g.fillText('NO CREDIT', w/2, 302); });
    if (o.label==='VIEWING CENTRE'){ const bd = add(box(.8,1,.04), tm(0xffffff, { map: bt }), cx-1.55, .55, z0+.5); bd.rotation.x = -.2; }
    add(box(.6,.45,.45), tm(0xe0601f), kx, y+.22, z); for (let k=0;k<3;k++) add(cyl(.05,.06,.2,8), tm(0xf1ead8), kx+.5+k*.14-.1, y+.1, z+.12);
    add(box(1.7,.08,.35), tm(0x7a4e25), cx, .42, z0+1.6); for (const dx of [-.7,.7]) add(box(.08,.42,.3), tm(0x7a4e25), cx+dx, .21, z0+1.6);
  } else {               // Owambe hall: small chops, coolers, balloons, plastic chairs
    add(box(.7,.04,.4), tm(0xd0d0d0), kx-.25, y+.02, z); for (let k=0;k<10;k++) add(ball(.065), tm(k%3?0xc9862f:0xe0a84a), kx-.5+(k%5)*.12, y+.08+(k>4?.07:0), z-.06+(k%2)*.1);
    add(box(.4,.34,.34), tm(0xc0392b), kx+.42, y+.17, z);
    for (const sx of [-1,1]) for (let k=0;k<3;k++){ add(ball(.16,10), tm([0xf4c430,0x5b2a86,0xffffff][k]), cx+sx*(o.w*.44)+(k-1)*.14, 2.5+k%2*.2, z0+.25); }
    for (let k=0;k<3;k++){ const g = new THREE.Group(); g.position.set(cx-1.9+k*.75, 0, z0+2.1); live.group.parent.add(g); add(box(.42,.06,.42), tm(0xffffff), 0,.42,0, g); add(box(.42,.42,.05), tm(0xffffff), 0,.66,.2, g); for (const [ax,az] of [[-.17,-.17],[.17,-.17],[-.17,.17],[.17,.17]]) add(box(.04,.42,.04), tm(0xffffff), ax,.21,az, g); }
    add(box(.6,.9,.5), tm(0x1b1b1b), cx+o.w*.38, .45, z0+1.4); add(cyl(.18,.18,.03,12), tm(0x555555), cx+o.w*.38, .55, z0+1.66).rotation.x = Math.PI/2;   // speaker
  }
}

// goods laid out on the ground around the market stalls
function market(){
  const { add, tm } = H;
  const mat = (x,z,c) => add(box(1.3,.03,1), tm(c), x, .02, z, undefined, false);
  // yams
  mat(33, 9.7, 0x8c6b3f); for (let k=0;k<7;k++){ const y = add(new THREE.CapsuleGeometry(.09,.42,3,6), tm(0x6b4a2a), 32.6+(k%4)*.26, .12+(k>3?.16:0), 9.6+(k>3?.05:0)); y.rotation.z = Math.PI/2; y.rotation.y = .3*k; }
  // garri in a basin, with the measuring tin
  add(cyl(.42,.3,.2,14), tm(0x2e86de), 33, .1, 14.3); add(new THREE.ConeGeometry(.36,.3,14), tm(0xf5efd6), 33, .33, 14.3); add(cyl(.07,.07,.12,8), tm(0xb0b0b0), 33.1, .52, 14.25);
  // tomatoes and pepper, sold in little heaps
  mat(33, 5.2, 0x3d7a3a); for (let h=0;h<3;h++) for (let k=0;k<5;k++) add(ball(.075), tm(h===2?0xe67e22:0xd63a2f), 32.6+h*.4+(k%2)*.1-(k===4?.05:0), .09+(k===4?.11:0), 5.1+(k>1&&k<4?.12:0));
  // plantain bunches
  mat(33.1, 17.6, 0x8c6b3f); for (let k=0;k<8;k++){ const p = add(new THREE.CapsuleGeometry(.05,.34,3,6), tm(k%3?0xe2c22b:0x8fae2f), 32.8+(k%4)*.14, .1+(k>3?.07:0), 17.5+(k>3?.25:0)); p.rotation.x = Math.PI/2; p.rotation.z = (k%4-1.5)*.18; }
  // basket of oranges, a stack of trays of eggs
  add(cyl(.3,.24,.26,12), tm(0xb58b4c), 29.4, .13, 9.6); for (let k=0;k<6;k++) add(ball(.08), tm(0x7fbf3a), 29.25+(k%3)*.15, .32+(k>2?.08:0), 9.55+(k%2)*.1);
  for (let k=0;k<4;k++) add(box(.4,.05,.4), tm(0xcab59a), 29.4, .04+k*.06, 14.3);
  // two market women minding the stalls
  for (const [x,z,look,ry] of [[32.9,12.3,{ skin:1, civ:'#e0601f', civP:'#1b4f9c', head:'gele', gele:'#1b4f9c', eyes:'none', extra:'none', shoes:0 },-.6],[29.5,11.6,{ skin:3, civ:'#f4c430', civP:'#0f7a4a', head:'gele', gele:'#c0392b', eyes:'none', extra:'none', shoes:2 },.8]]){
    const k = makeCharacter('T', look); k.root.position.set(x,0,z); k.root.rotation.y = ry; live.group.add(k.root); live.keepers.push(k);
  }
}

function pitch(world){
  const { add, tm } = H;
  const net = canvasTex(64, 64, (g) => { g.clearRect(0,0,64,64); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; for (let k=0;k<=64;k+=8){ g.beginPath(); g.moveTo(k,0); g.lineTo(k,64); g.moveTo(0,k); g.lineTo(64,k); g.stroke(); } });
  net.wrapS = net.wrapT = THREE.RepeatWrapping;
  const nm = new THREE.MeshBasicMaterial({ map: net, transparent:true, side:THREE.DoubleSide, depthWrite:false });
  for (const [z,dir] of [[GOAL.n,-1],[GOAL.s,1]]){
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2,1), nm); back.position.set(GOAL.cx, .5, z+dir*.6); live.group.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(2,.6), nm); top.rotation.x = Math.PI/2; top.position.set(GOAL.cx, 1, z+dir*.3); live.group.add(top);
    for (const sx of [-1,1]){ const side = new THREE.Mesh(new THREE.PlaneGeometry(.6,1), nm); side.rotation.y = Math.PI/2; side.position.set(GOAL.cx+sx, .5, z+dir*.3); live.group.add(side); }
  }
  // corner flags, a water bucket and the boys' slippers used as a second goal marker
  for (const [x,z] of [[PITCH.x+.5,PITCH.y+.5],[PITCH.x+PITCH.w-.5,PITCH.y+.5],[PITCH.x+.5,PITCH.y+PITCH.h-.5],[PITCH.x+PITCH.w-.5,PITCH.y+PITCH.h-.5]]){ add(cyl(.02,.02,.9,5), tm(0xffffff), x,.45,z); add(box(.24,.16,.01), tm(0xd63a2f), x+.12,.82,z); }
  add(cyl(.2,.16,.3,10), tm(0x2e86de), PITCH.x-.5, .15, PITCH.y+6);
  for (const dx of [0,.22]) add(box(.12,.03,.28), tm(0xe0601f), PITCH.x-.6+dx, .02, PITCH.y+7);
}

function washing(){
  const { add, tm } = H;
  const x0 = 13.2, x1 = 16.6, z = 46.2;
  for (const x of [x0,x1]) add(cyl(.04,.04,2.1,6), tm(0x7a5a3a), x, 1.05, z);
  add(box(x1-x0,.015,.015), tm(0x333333), (x0+x1)/2, 2.02, z);
  const cols = [0xf2f2f2,0xd63a2f,0x1b4f9c,0xf4c430,0x0b8a3e,0xff8ae2];
  cols.forEach((c,k) => add(box(.42,.5+(k%2)*.15,.02), tm(c), x0+.35+k*.5, 1.74-(k%2)*.07, z));
  add(cyl(.35,.28,.25,12), tm(0xc0392b), x0+.6, .13, z+.7);   // washing basin
}
function poles(){
  const { add, tm } = H;
  const pm = tm(0x4a3b2c), pts = [];
  for (let z=3; z<62; z+=11.5){ add(cyl(.07,.09,4.4,6), pm, 8.55, 2.2, z); add(box(1,.06,.06), pm, 8.55, 4.1, z); pts.push(z); }
  const wm = new THREE.LineBasicMaterial({ color:0x1a1a1a, transparent:true, opacity:.7 });
  for (const dx of [-.42,.42]) for (let i=0;i<pts.length-1;i++){
    const p = []; for (let k=0;k<=8;k++){ const t = k/8; p.push(new THREE.Vector3(8.55+dx, 4.1-Math.sin(t*Math.PI)*.45, pts[i]+(pts[i+1]-pts[i])*t)); }
    live.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), wm));
  }
}

function makeBall(){
  const tex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#f6f6f6'; g.fillRect(0,0,w,h); g.fillStyle = '#1a1a1a';
    for (const [x,y] of [[16,16],[48,44],[80,14],[112,46],[64,32],[0,48],[128,48],[32,60],[96,2]]){ g.beginPath(); for (let k=0;k<5;k++){ const a = k/5*Math.PI*2-.3; g.lineTo(x+Math.cos(a)*9, y+Math.sin(a)*9); } g.fill(); } });
  const m = new THREE.Mesh(new THREE.SphereGeometry(.25,16,12), new THREE.MeshLambertMaterial({ map: tex }));
  m.castShadow = true; m.position.set(BALL_HOME.x, .25, BALL_HOME.y); live.group.add(m);
  live.ball = m; live.ballPos = { x: BALL_HOME.x, y: BALL_HOME.y };
}

function makeChickens(){
  const body = new THREE.SphereGeometry(.17,8,6); body.scale(1,.85,1.25);
  const head = new THREE.SphereGeometry(.09,8,6); head.translate(0,.17,.18);
  const tail = new THREE.ConeGeometry(.08,.2,5); tail.rotateX(-.9); tail.translate(0,.1,-.22);
  const g1 = mergeGeometries([body, head, tail].map(g => g.toNonIndexed()));
  const comb = new THREE.BoxGeometry(.03,.07,.09); comb.translate(0,.28,.18);
  const beak = new THREE.ConeGeometry(.03,.09,4); beak.rotateX(Math.PI/2); beak.translate(0,.16,.3);
  const g2 = mergeGeometries([comb, beak].map(g => g.toNonIndexed()));
  const cols = [0xf4efe6,0x8a5a2b,0x2b2b2b,0xf4efe6,0xb5651d,0xf4efe6,0x8a5a2b];
  const homes = [3,22,41,60,79,98,117].map(i => FLEE_PTS[i % FLEE_PTS.length]);
  const red = new THREE.MeshLambertMaterial({ color:0xd63a2f });
  homes.forEach(([x,y],i) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(g1, new THREE.MeshLambertMaterial({ color: cols[i] })); b.castShadow = true; g.add(b); g.add(new THREE.Mesh(g2, red));
    g.position.set(x, .2, y); live.group.add(g);
    live.chickens.push({ g, x, y, hx:x, hy:y, a:Math.random()*6.28, t:Math.random()*3, run:0, peck:0 });
  });
}

function noteMesh(){
  const tex = noteMesh.t || (noteMesh.t = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#1f9d55'; g.fillRect(0,0,w,h); g.strokeStyle = '#d7ffe4'; g.lineWidth = 5; g.strokeRect(6,6,w-12,h-12); g.fillStyle = '#eafff1'; g.font = '900 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₦', w/2, h/2+3); }));
  const geo = noteMesh.g || (noteMesh.g = new THREE.BoxGeometry(.6,.34,.03));
  const mat = noteMesh.m || (noteMesh.m = new THREE.MeshBasicMaterial({ map: tex }));
  return new THREE.Mesh(geo, mat);
}

// called every frame during a match
export function syncStreet(st, ents, me, dt, t, night, lowQuality){
  // ball: follow the rules' position, and roll
  if (st.ball && live.ball){
    const p = live.ballPos, k = Math.min(1, dt*18);
    const nx = p.x + (st.ball.x-p.x)*k, ny = p.y + (st.ball.y-p.y)*k;
    const dx = nx-p.x, dy = ny-p.y, d = Math.hypot(dx,dy);
    if (d > 4){ p.x = st.ball.x; p.y = st.ball.y; }           // reset after a goal
    else { if (d > 1e-4) live.ball.rotateOnWorldAxis(new THREE.Vector3(dy/d,0,-dx/d), d/.25); p.x = nx; p.y = ny; }
    live.ball.position.set(p.x, .25, p.y);
  }
  // the herdsman and his cattle
  if (live.herd){
    const hs = st.herd && st.herd.p >= 0 ? herdAt(st.herd.p) : null;
    live.herd.visible = !!hs;
    if (hs){
      const rot = Math.atan2(hs[0].ux, hs[0].uy);
      live.man.root.position.set(hs[0].x, 0, hs[0].y); live.man.root.rotation.y = rot;
      live.man.update(dt, { speed: 1.6, mode:'run', t });
      live.cows.forEach((c,i) => { const p = hs[i+1]; c.position.set(p.x, Math.abs(Math.sin(t*5+i*1.7))*.04, p.y); c.rotation.y = rot + Math.sin(t*1.3+i)*.08; c.rotation.z = Math.sin(t*5+i*1.7)*.03; });
      if (Math.random() < .25){ const p = hs[1+(Math.random()*6|0)]; if (p.x>0 && p.x<W && p.y>0 && p.y<MAPH) H.fx('dust', p.x, p.y); }
    }
  }
  if (live.bell){ const rung = (st.bellCd||0) > 22; live.bell.rotation.z = rung ? Math.sin(t*22)*.5 : 0; }
  for (const r of live.gapRings){ const sc = 1+.12*Math.sin(t*5); r.scale.set(sc,sc,sc); }
  // ₦ notes
  const seen = new Set();
  for (const n of (st.notes||[])){
    seen.add(n.id);
    let m = live.notes.get(n.id);
    if (!m){ m = noteMesh(); m.position.set(n.x, .6, n.y); live.noteGroup.add(m); live.notes.set(n.id, m); }
    m.rotation.y = t*2.4 + n.id; m.position.y = .6 + Math.sin(t*3+n.id)*.1;
  }
  for (const [id,m] of live.notes) if (!seen.has(id)){ live.noteGroup.remove(m); live.notes.delete(id); }
  // shop rings pulse when you are at the counter; lanterns at night
  SHOPS.forEach((s,i) => {
    const near = me && me.state==='free' && Math.hypot(me.x-s.x, me.y-s.y) < 1.7;
    const sc = near ? 1.15+.1*Math.sin(t*10) : 1+.04*Math.sin(t*3+i);
    live.rings[i].scale.set(sc,sc,sc); live.rings[i].material.color.set(near ? 0xffd84d : 0x35e0a1);
    live.glows[i].material.opacity = night ? .55 : 0;
  });
  // shopkeepers wave when someone is close
  live.keepers.forEach((k,i) => {
    k.root.visible = !lowQuality;
    if (lowQuality) return;
    const p = k.root.position; let close = false;
    for (const e of ents) if (e.state==='free' && Math.hypot(e.x-p.x, e.y-p.z) < 3){ close = true; break; }
    k.update(dt, { speed:0, mode: close && Math.sin(t*2+i) > 0 ? 'cheer' : 'idle', t: t+i });
  });
  // smoke from the suya grill and the pots, exhaust from the generator
  live.smokeT -= dt;
  if (live.smokeT <= 0 && !lowQuality){
    live.smokeT = .22;
    for (const [x,z,c,p] of live.smokers) if (Math.random() < p) H.fx('smoke', x+(Math.random()-.5)*.6, z, c);
  }
  // chickens: peck about, and scatter when anybody runs close
  for (const c of live.chickens){
    c.g.visible = !lowQuality; if (lowQuality) continue;
    let fx = 0, fy = 0, scared = false;
    for (const e of ents){ if (e.state!=='free') continue; const dx = c.x-e.x, dy = c.y-e.y, d = Math.hypot(dx,dy); if (d < 2.3 && (e.speed||0) > 1){ fx += dx/(d+.01); fy += dy/(d+.01); scared = true; } }
    if (MAP.ball && st.ball){ const dx = c.x-st.ball.x, dy = c.y-st.ball.y, d = Math.hypot(dx,dy); if (d < 1.2){ fx += dx/(d+.01); fy += dy/(d+.01); scared = true; } }
    if (scared){ c.a = Math.atan2(fx, fy); c.run = .7; }
    c.t -= dt;
    let sp = 0;
    if (c.run > 0){ c.run -= dt; sp = 5.5; }
    else if (c.t <= 0){ c.t = 1+Math.random()*3; c.peck = Math.random() < .5 ? 1 : 0; if (!c.peck){ const hd = Math.hypot(c.hx-c.x, c.hy-c.y); c.a = hd > 5 ? Math.atan2(c.hx-c.x, c.hy-c.y) : Math.random()*6.28; } }
    else if (!c.peck) sp = .9;
    if (sp){ const nx = c.x+Math.sin(c.a)*sp*dt, ny = c.y+Math.cos(c.a)*sp*dt; if (!solidAt(nx, ny, .3)){ c.x = nx; c.y = ny; } else c.a += 2; }
    c.g.position.set(c.x, .2 + (c.run>0 ? Math.abs(Math.sin(t*22))*.25 : 0), c.y);
    c.g.rotation.y = c.a; c.g.rotation.x = (c.peck && c.run<=0) ? .5+Math.sin(t*9)*.3 : 0;
  }
}
// menus: no match running, so park the moving things
export function idleStreet(dt, t){
  for (const [id,m] of live.notes){ live.noteGroup.remove(m); } live.notes.clear();
  if (live.herd) live.herd.visible = false;
  if (live.ball){ live.ballPos.x = BALL_HOME.x+1.6; live.ballPos.y = BALL_HOME.y+1.2; live.ball.position.set(live.ballPos.x, .25, live.ballPos.y); }
  live.keepers.forEach((k,i) => k.update(dt, { speed:0, mode:'idle', t:t+i }));
}

// ---- the herdsman and his cattle (white long-horned cows, the kind you meet on any Nigerian road)
function makeHerd(){
  const parts = [], dark = [];
  const P = (g, x, y, z, into=parts) => { g.translate(x,y,z); into.push(g.toNonIndexed()); };
  P(new THREE.BoxGeometry(.56,.6,1.25), 0,.92,0); { const hump = new THREE.SphereGeometry(.2,8,6); hump.scale(1,.8,1.1); P(hump, 0,1.26,.32); }
  P(new THREE.BoxGeometry(.3,.34,.46), 0,1.06,.82); P(new THREE.BoxGeometry(.2,.5,.2), 0,.86,.58);
  for (const [x,z] of [[-.19,.45],[.19,.45],[-.19,-.45],[.19,-.45]]) P(new THREE.BoxGeometry(.13,.64,.13), x,.32,z);
  for (const sx of [-1,1]){ const horn = new THREE.ConeGeometry(.045,.62,6); horn.rotateZ(-sx*.75); P(horn, sx*.33,1.42,.8); const ear = new THREE.BoxGeometry(.2,.06,.1); P(ear, sx*.24,1.12,.72); }
  P(new THREE.BoxGeometry(.2,.14,.12), 0,.98,1.08, dark); P(new THREE.BoxGeometry(.05,.55,.05), 0,.82,-.66, dark);
  for (const [x,z] of [[-.19,.45],[.19,.45],[-.19,-.45],[.19,-.45]]) P(new THREE.BoxGeometry(.14,.09,.14), x,.045,z, dark);
  const g1 = mergeGeometries(parts), g2 = mergeGeometries(dark), dm = new THREE.MeshLambertMaterial({ color:0x2b2622 });
  live.herd = new THREE.Group(); live.herd.visible = false; live.group.add(live.herd);
  [0xf4f0e6,0xe9dcc0,0xf4f0e6,0xb98a5e,0xf4f0e6,0xd9d4cc].forEach(c => {
    const cow = new THREE.Group(); const b = new THREE.Mesh(g1, new THREE.MeshLambertMaterial({ color:c })); b.castShadow = true;
    cow.add(b); cow.add(new THREE.Mesh(g2, dm)); live.herd.add(cow); live.cows.push(cow);
  });
  const man = makeCharacter('T', { skin:1, civ:'#a9c7e8', civP:'#a9c7e8', long:true, head:'straw', eyes:'none', extra:'none', shoes:0 });
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.7,6), new THREE.MeshLambertMaterial({ color:0x6b4a2a }));
  staff.rotation.z = Math.PI/2; staff.position.set(0,.72,-.14); man.torso.add(staff);
  live.herd.add(man.root); live.man = man;
}
function marketPeople(){
  const looks = [{ skin:1, civ:'#e0601f', civP:'#1b4f9c', head:'gele', gele:'#1b4f9c' }, { skin:3, civ:'#f4c430', civP:'#0f7a4a', head:'gele', gele:'#c0392b' }, { skin:2, civ:'#35c9d6', civP:'#5b2a86', head:'gele', gele:'#f4c430' }, { skin:0, civ:'#f2f2f2', civP:'#3a3a3a', head:'fila' }];
  [[11,17.4,.4],[25,23.2,-.5],[15,45.2,.6],[29,51.2,-.3]].forEach(([x,z,ry],i) => {
    const k = makeCharacter('T', { eyes:'none', extra:'none', shoes:0, ...looks[i] }); k.root.position.set(x,0,z); k.root.rotation.y = ry; live.group.add(k.root); live.keepers.push(k);
  });
}
function ringAt(x, z, col){
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62,.8,28), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.8, depthWrite:false }));
  ring.rotation.x = -Math.PI/2; ring.position.set(x, .045, z); live.group.add(ring); return ring;
}
function labelAt(text, x, y, z, col){
  const t = canvasTex(512, 128, (g, w, h) => { g.fillStyle = 'rgba(16,10,6,.82)'; g.beginPath(); g.roundRect(4,4,w-8,h-8,28); g.fill(); g.strokeStyle = col; g.lineWidth = 6; g.stroke(); g.font = '900 56px Nunito, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text, w/2, h/2+3, w-40); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthWrite:false })); s.scale.set(2.4,.6,1); s.position.set(x,y,z); live.group.add(s);
}
function schoolBits(){
  const { add, tm } = H, b = MAP.bell, bx = b.x, bz = b.y - 1.1;
  // the bell hangs from a frame; assembly ground with the flag beside it
  for (const dx of [-.5,.5]) add(cyl(.05,.05,2.1,6), tm(0x5b4a3a), bx+dx, 1.05, bz);
  add(box(1.2,.08,.08), tm(0x5b4a3a), bx, 2.1, bz);
  const bell = new THREE.Group(); bell.position.set(bx, 2.05, bz); live.group.add(bell);
  add(cyl(.1,.26,.36,12), new THREE.MeshLambertMaterial({ color:0xd4a017 }), 0, -.3, 0, bell); add(ball(.06), tm(0x333333), 0, -.52, 0, bell);
  live.bell = bell;
  ringAt(b.x, b.y, 0xffd84d); labelAt('🔔 School bell', b.x, 3, bz, '#ffd84d');
  add(cyl(.05,.06,4.6,6), tm(0xdddddd), 13, 2.3, 16.5);
  [0x0b8a3e,0xffffff,0x0b8a3e].forEach((c,k) => add(box(.36,.62,.02), tm(c), 13.24+k*.36, 4.2, 16.5, undefined, false));
  for (let r=0;r<3;r++) for (let k=0;k<6;k++) add(box(.5,.02,.12), tm(0xf2f2f2), 9+k*1.4, .02, 18+r*1.6, undefined, false);   // assembly lines painted on the ground
  // hopscotch and a skipping rope left on the ground
  for (let k=0;k<6;k++) add(box(.55,.015,.55), tm(k%2?0xffd84d:0xff8ae2), 30+(k%3===2?.3:0)-(k%3===1?.3:0), .02, 36+k*.6, undefined, false);
  add(box(1.4,.03,.04), tm(0xd63a2f), 14, .03, 40, undefined, false);
  // desks carried outside
  for (let k=0;k<3;k++){ add(box(.9,.06,.45), tm(0x8a5a3a), 8+k*1.3, .62, 11); add(box(.9,.05,.25), tm(0x8a5a3a), 8+k*1.3, .38, 11.5); for (const dx of [-.4,.4]) add(box(.05,.62,.05), tm(0x3a3a3a), 8+k*1.3+dx, .31, 11.2); }
}
function churchBits(){
  const { add, tm } = H, ch = OB.find(o => o.label==='CHAPEL');
  if (ch){ const cx = ch.x+ch.w/2, z = ch.y+ch.h-1;
    add(box(2.4,2.2,2.4), tm(0xd8cfb8), cx, 3.3, z-1); add(new THREE.ConeGeometry(1.9,1.6,4), tm(0x8a4b3a), cx, 5.2, z-1).rotation.y = Math.PI/4;
    add(box(.14,1.3,.14), tm(0xf4f4f4), cx, 6.6, z-1); add(box(.7,.14,.14), tm(0xf4f4f4), cx, 6.85, z-1);
    for (const dx of [-6,-3,3,6]) add(box(.9,1.3,.06), new THREE.MeshBasicMaterial({ color:0x7fc4ff }), cx+dx, 1.25, ch.y+ch.h+.03, undefined, false);   // windows
    // benches set outside for the overflow, and the drums by the back door
    for (let r=0;r<2;r++) for (const dx of [-3.2,3.2]){ add(box(2.6,.08,.4), tm(0x7a4e25), cx+dx, .42, ch.y+ch.h+2.4+r*1.3); for (const e of [-1.1,1.1]) add(box(.08,.42,.36), tm(0x7a4e25), cx+dx+e, .21, ch.y+ch.h+2.4+r*1.3); }
    for (let k=0;k<3;k++) add(cyl(.22,.17,.5,10), tm([0x8a5a3a,0xc0392b,0x8a5a3a][k]), cx-8.6+k*.55, .25, ch.y+ch.h+.6);
  }
  MAP.gaps.forEach(([x,y,dir], i) => {
    const wx = dir > 0 ? -.24 : W+.24;
    add(box(.56,1.3,1.5), new THREE.MeshBasicMaterial({ color:0x120c08 }), wx, .65, y, live.group, false);          // the hole
    for (const dz of [-.95,.95]) add(box(.5,.35,.4), tm(0xcbbf9f), wx+dir*.5, .17, y+dz, live.group, false);  // broken blocks
    live.gapRings.push(ringAt(x+dir*.2, y, 0x7db8ff)); labelAt('🕳 Shortcut', x+dir*1.3, 2.4, y, '#7db8ff');
  });
}
