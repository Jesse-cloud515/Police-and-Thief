// =============================================================
// SCENE: the 3D street, lighting (day / "NEPA took light" night),
// camera, character views and effects.
// World mapping: sim (x, y)  ->  three.js (x, 0, y)
// =============================================================
import * as THREE from 'three';
import { W, H, OB, PRISON, PC, GATES, EXITS, HIDES, ROADS, PITCH, LAMPS, CFG, MAP } from './world.js';
import { makeCharacter, toon } from './chars.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildStreet, syncStreet, idleStreet } from './details.js';
// shared materials for the static street, so it can be merged into few draw calls
const tmCache = new Map();
function tm(color, opts={}){
  const k = new THREE.Color(color).getHexString() + '|' + (opts.map ? opts.map.uuid : '') + '|' + (opts.side||0) + '|' + (opts.transparent?opts.opacity:'');
  if (!tmCache.has(k)) tmCache.set(k, toon(color, opts));
  return tmCache.get(k);
}

export let renderer, scene, camera;
const world = new THREE.Group();
let hemi, sun, playerLight;
const dyn = { trees:[], exits:[], gateRings:[], campRing:null, siren:null, lampGlows:[], windows:[] };
let quality = 1;

export function initScene(canvas){
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.5, 140);
  hemi = new THREE.HemisphereLight(0xcfe8ff, 0xc08050, 1.25); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d0, 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
  const sc = sun.shadow.camera; sc.left=-16; sc.right=16; sc.top=16; sc.bottom=-16; sc.near=1; sc.far=60;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  playerLight = new THREE.PointLight(0xffc98a, 0, 9, 1.6); scene.add(playerLight);
  scene.add(world);
  buildWorld();
  resize();
  Object.assign(window, { renderer, scene });
  return renderer;
}
export function resize(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  const hf = 28*Math.PI/180;                 // aim for ~15 units of street across the screen
  let vf = 2*Math.atan(Math.tan(hf/2)/camera.aspect)*180/Math.PI;
  camera.fov = Math.max(38, Math.min(62, vf));
  camera.updateProjectionMatrix();
}
export function setQuality(q){
  quality = q;
  renderer.setPixelRatio(q>=1 ? Math.min(devicePixelRatio||1,1.5) : 1);
  renderer.shadowMap.enabled = q>=1; scene.traverse(o => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
  resize();
}

// ------------------------------------------------------------- ground texture
function paintGround(){
  const s = 28, c = document.createElement('canvas'); c.width = W*s; c.height = H*s;
  const g = c.getContext('2d'); let seed = 7;
  const rnd = () => { seed = (seed*16807)%2147483647; return seed/2147483647; };
  g.fillStyle=MAP.ground||'#c98450'; g.fillRect(0,0,c.width,c.height);
  for (let i=0;i<5000;i++){ g.fillStyle = rnd()<.5?'rgba(120,60,25,.16)':'rgba(245,195,140,.14)'; g.beginPath(); g.arc(rnd()*c.width, rnd()*c.height, 1+rnd()*5, 0, 7); g.fill(); }
  for (let i=0;i<40;i++){ g.fillStyle='rgba(90,140,60,.25)'; g.beginPath(); g.ellipse(rnd()*c.width, rnd()*c.height, 10+rnd()*30, 6+rnd()*14, rnd()*3, 0, 7); g.fill(); }
  for (const r of ROADS){
    g.fillStyle='#4a3e33'; g.fillRect((r.x-.25)*s, r.y*s, (r.w+.5)*s, r.h*s);
    g.fillStyle='#38383e'; g.fillRect(r.x*s, r.y*s, r.w*s, r.h*s);
    for (let i=0;i<r.w*r.h/3;i++){ g.fillStyle='rgba(0,0,0,.22)'; g.beginPath(); g.ellipse((r.x+rnd()*r.w)*s,(r.y+rnd()*r.h)*s, 4+rnd()*9, 2+rnd()*5, rnd()*3,0,7); g.fill(); }
    g.fillStyle='#e8c33a';
    if (r.h>r.w) for (let y=r.y+1;y<r.y+r.h;y+=2.4) g.fillRect((r.x+r.w/2-.06)*s, y*s, .12*s, 1.2*s);
    else for (let x=r.x+1;x<r.x+r.w;x+=2.4) g.fillRect(x*s, (r.y+r.h/2-.06)*s, 1.2*s, .12*s);
  }
  // football field
  if (PITCH.w){
  g.fillStyle='#5f9a3a'; g.fillRect(PITCH.x*s, PITCH.y*s, PITCH.w*s, PITCH.h*s);
  for (let i=0;i<80;i++){ g.fillStyle='rgba(201,132,80,.55)'; g.beginPath(); g.arc((PITCH.x+rnd()*PITCH.w)*s,(PITCH.y+rnd()*PITCH.h)*s, 3+rnd()*12,0,7); g.fill(); }
  g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=.08*s; g.strokeRect((PITCH.x+.5)*s,(PITCH.y+.5)*s,(PITCH.w-1)*s,(PITCH.h-1)*s);
  g.beginPath(); g.moveTo((PITCH.x+.5)*s,(PITCH.y+PITCH.h/2)*s); g.lineTo((PITCH.x+PITCH.w-.5)*s,(PITCH.y+PITCH.h/2)*s); g.stroke();
  g.beginPath(); g.arc((PITCH.x+PITCH.w/2)*s,(PITCH.y+PITCH.h/2)*s,1.3*s,0,7); g.stroke();
  }
  // police post yard
  g.fillStyle='#a9a39a'; g.fillRect(PRISON.x*s, PRISON.y*s, PRISON.w*s, PRISON.h*s);
  g.strokeStyle='rgba(0,0,0,.15)'; g.lineWidth=2;
  for (let x=PRISON.x;x<=PRISON.x+PRISON.w;x++){ g.beginPath(); g.moveTo(x*s,PRISON.y*s); g.lineTo(x*s,(PRISON.y+PRISON.h)*s); g.stroke(); }
  for (let y=PRISON.y;y<=PRISON.y+PRISON.h;y++){ g.beginPath(); g.moveTo(PRISON.x*s,y*s); g.lineTo((PRISON.x+PRISON.w)*s,y*s); g.stroke(); }
  // exit pads
  for (const x of EXITS){ g.fillStyle='#857a6c'; g.fillRect(x.x*s,x.y*s,x.w*s,x.h*s); g.strokeStyle='#f4f4f4'; g.setLineDash([10,8]); g.lineWidth=3; g.strokeRect((x.x+.2)*s,(x.y+.2)*s,(x.w-.4)*s,(x.h-.4)*s); g.setLineDash([]); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function signTex(text, bg, fg='#fff', w=512, h=128){
  const c = document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.fillStyle=bg; g.fillRect(0,0,w,h); g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=10; g.strokeRect(5,5,w-10,h-10);
  g.fillStyle=fg; let fs = h*.5; g.font=`900 ${fs}px Nunito, Arial Black, sans-serif`;
  while (g.measureText(text).width > w*.88 && fs>12){ fs-=2; g.font=`900 ${fs}px Nunito, Arial Black, sans-serif`; }
  g.textAlign='center'; g.textBaseline='middle'; g.fillText(text, w/2, h/2+2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function facadeTex(col, label, hgt, wid){
  const ppu = 64, c = document.createElement('canvas'); c.width = Math.round(wid*ppu); c.height = Math.round(hgt*ppu);
  const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0,0,c.width,c.height);
  g.fillStyle='rgba(0,0,0,.08)'; for (let i=0;i<30;i++) g.fillRect(Math.random()*c.width, Math.random()*c.height, 20+Math.random()*60, 6);
  g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,c.height-10,c.width,10);
  // door + windows
  const dw = .8*ppu, dh = 1.4*ppu;
  g.fillStyle='#5a3a22'; g.fillRect(c.width/2-dw/2, c.height-dh, dw, dh);
  g.fillStyle='#2b2b2b'; g.fillRect(c.width/2-dw/2+6, c.height-dh+6, dw-12, 8);
  g.fillStyle='#9fd0e6';
  for (let x=.5*ppu; x < c.width-.9*ppu; x += 1.4*ppu){ if (Math.abs(x+.3*ppu - c.width/2) < dw) continue; g.fillRect(x, c.height-1.35*ppu, .6*ppu, .5*ppu); g.fillStyle='rgba(255,255,255,.4)'; g.fillRect(x, c.height-1.35*ppu, .6*ppu, 6); g.fillStyle='#9fd0e6'; }
  // sign board
  if (label){
    const sh = .55*ppu, sw = Math.min(c.width-.4*ppu, label.length*.32*ppu+.8*ppu);
    g.fillStyle='#fdf6e3'; g.fillRect(c.width/2-sw/2, .18*ppu, sw, sh);
    g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=4; g.strokeRect(c.width/2-sw/2, .18*ppu, sw, sh);
    let fs = sh*.62; g.font = `900 ${fs}px Nunito, Arial Black, sans-serif`;
    while (g.measureText(label).width > sw-12 && fs>10){ fs-=1; g.font = `900 ${fs}px Nunito, Arial Black, sans-serif`; }
    g.fillStyle = col; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label, c.width/2, .18*ppu+sh/2+2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function zincTex(){
  const c = document.createElement('canvas'); c.width=128; c.height=128; const g=c.getContext('2d');
  g.fillStyle='#9aa5ad'; g.fillRect(0,0,128,128);
  for (let x=0;x<128;x+=8){ g.fillStyle='rgba(50,60,70,.35)'; g.fillRect(x,0,3,128); }
  for (let i=0;i<8;i++){ g.fillStyle='rgba(150,72,30,.35)'; g.fillRect(Math.random()*110, Math.random()*110, 10+Math.random()*30, 8+Math.random()*16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
function glowTex(){
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c);
}
const GLOW = glowTex();

function add(geo, mat, x, y, z, parent=world, shadow=true){
  const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}

// switch location: throw the old street away and build the new one
export function rebuildWorld(){
  clearViews();
  if (show.group.parent) show.group.parent.remove(show.group);
  world.traverse(o => { if (o.material && o.material.userData && o.material.userData.own){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  for (const c of [...world.children]) world.remove(c);
  Object.assign(dyn, { trees:[], exits:[], gateRings:[], campRing:null, siren:null, lampGlows:[], windows:[] });
  buildWorld();
  world.add(show.group);
  setNight(isNight);
}
function buildWorld(){
  const gm = new THREE.MeshLambertMaterial({ map: paintGround() }); gm.userData.own = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), gm);
  ground.rotation.x = -Math.PI/2; ground.position.set(W/2, 0, H/2); ground.receiveShadow = true; world.add(ground);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(W+80, H+80), new THREE.MeshLambertMaterial({ color: 0x6b8a3a }));
  outside.rotation.x = -Math.PI/2; outside.position.set(W/2, -0.02, H/2); outside.receiveShadow = true; world.add(outside);
  // perimeter wall (painted block fence, very Naija)
  const wallMat = tm(0xe8dcc0), capMat = tm(0x8a5a3a);
  for (const [x,z,w,d] of [[W/2,-.25,W+1,.5],[W/2,H+.25,W+1,.5],[-.25,H/2,.5,H],[W+.25,H/2,.5,H]]){
    add(new THREE.BoxGeometry(w,1.1,d), wallMat, x,.55,z, world, false);
    add(new THREE.BoxGeometry(w+.1,.12,d+.1), capMat, x,1.16,z, world, false);
  }
  const zinc = zincTex();
  for (const o of OB){
    const cx = o.x+o.w/2, cz = o.y+o.h/2;
    if (o.k==='bld'){
      const h = 2.2 + ((o.w*o.h)%3)*.35;
      const col = new THREE.Color(o.col).lerp(new THREE.Color('#f3e6cf'), .35);
      const wall = tm(col);
      add(new THREE.BoxGeometry(o.w, h, o.h), wall, cx, h/2, cz);
      const fm = new THREE.MeshLambertMaterial({ map: facadeTex('#'+col.getHexString(), o.label, h, o.w) }); fm.userData.own = true;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(o.w, h), fm);
      front.position.set(cx, h/2, o.y+o.h+.01); world.add(front);
      const roof = add(new THREE.BoxGeometry(o.w+.4, .18, o.h+.4), tm(0xffffff,{map:zinc}), cx, h+.09, cz);
      roof.rotation.x = -.05;
      if (o.label==='GEN HOUSE'){ add(new THREE.CylinderGeometry(.08,.08,1.2), tm(0x333333), cx+.8, h+.7, cz); }
      if (o.label==='VIEWING CENTRE'){ const d = add(new THREE.SphereGeometry(.5,12,8,0,Math.PI*2,0,Math.PI/2), tm(0xdddddd), cx, h+.2, cz); d.rotation.x = -.9; }
      dyn.windows.push({ x:cx, z:o.y+o.h+.05, y:h*.45, w:o.w });
    } else if (o.k==='bus') busMesh(o);
    else if (o.k==='keke') kekeMesh(o);
    else if (o.k==='stall') stallMesh(o);
    else if (o.k==='tank'){
      for (const [dx,dz] of [[-.9,-.9],[.9,-.9],[-.9,.9],[.9,.9]]) add(new THREE.BoxGeometry(.15,1.2,.15), tm(0x5b4a3a), cx+dx,.6,cz+dz);
      add(new THREE.BoxGeometry(o.w,.15,o.h), tm(0x5b4a3a), cx,1.2,cz);
      add(new THREE.CylinderGeometry(1.15,1.15,1.6,20), tm(0x1a1a1a), cx,2.05,cz);
      add(new THREE.CylinderGeometry(.35,.35,.15,12), tm(0x333333), cx,2.9,cz);
    } else if (o.k==='bore'){
      add(new THREE.BoxGeometry(o.w,.25,o.h), tm(0x8c9aa5), cx,.12,cz);
      add(new THREE.CylinderGeometry(.12,.12,1.1,8), tm(0x4a6b8a), cx,.75,cz);
      add(new THREE.BoxGeometry(.5,.1,.1), tm(0x4a6b8a), cx+.25,1.25,cz);
      add(new THREE.BoxGeometry(.6,.25,.3), tm(0x2e86de), cx+.6,.4,cz+.6);
    }
  }
  buildPrison(); buildExits(); buildHides(); buildLamps(); buildProps(); if (MAP.id==='street') buildExtras();
  buildStreet(world, { add, tm, fx });
  mergeStatic();
}
function busMesh(o){
  const cx=o.x+o.w/2, cz=o.y+o.h/2, g=new THREE.Group(); g.position.set(cx,0,cz); world.add(g);
  const c=document.createElement('canvas'); c.width=256; c.height=96; const x=c.getContext('2d');
  x.fillStyle='#f2c200'; x.fillRect(0,0,256,96); x.fillStyle='#111'; x.fillRect(0,22,256,8); x.fillRect(0,70,256,8);
  x.fillStyle='#2c3e57'; for (let i=10;i<240;i+=40) x.fillRect(i,34,30,26);
  x.fillStyle='#111'; x.font='900 18px Arial'; x.fillText('DANFO • OSHODI-OBALENDE',8,16);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.BoxGeometry(o.w,1.5,o.h), [tm(0xffffff,{map:t}),tm(0xffffff,{map:t}),tm(0xf2c200),tm(0xf2c200),tm(0xffffff,{map:t}),tm(0xffffff,{map:t})], 0,1.0,0, g);
  add(new THREE.BoxGeometry(o.w*.9,.12,o.h*.7), tm(0x3a3a3a), 0,1.82,0, g);
  for (const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const w=add(new THREE.CylinderGeometry(.35,.35,.25,12), tm(0x111111), dx*o.w/2, .35, dz*o.h*.32, g); w.rotation.z=Math.PI/2; }
}
function kekeMesh(o){
  const cx=o.x+o.w/2, cz=o.y+o.h/2, g=new THREE.Group(); g.position.set(cx,0,cz); world.add(g);
  add(new THREE.BoxGeometry(o.w*.9,.7,o.h*.8), tm(new THREE.Color(o.col)), 0,.65,0, g);
  add(new THREE.BoxGeometry(o.w,.08,o.h*.85), tm(0x111111), 0,1.55,0, g);
  for (const [dx,dz] of [[-.5,-.6],[.5,-.6],[.5,.6],[-.5,.6]]) add(new THREE.BoxGeometry(.06,.9,.06), tm(0x111111), dx*o.w*.9,1.1,dz*o.h*.8, g);
  for (const [dx,dz] of [[-1,.35],[1,.35],[0,-.45]]){ const w=add(new THREE.CylinderGeometry(.25,.25,.15,10), tm(0x111111), dx*o.w*.42,.25,dz*o.h, g); w.rotation.z=Math.PI/2; }
}
const stallMats = {};
function stallMesh(o){
  const cx=o.x+o.w/2, cz=o.y+o.h/2;
  add(new THREE.BoxGeometry(o.w,.8,o.h), tm(0x7a4e25), cx,.4,cz);
  const fruit = [0xe74c3c,0xf39c12,0x27ae60,0xf1c40f];
  for (let i=0;i<6;i++) add(new THREE.SphereGeometry(.16,8,6), tm(fruit[i%4]), cx-.6+(i%3)*.6, .9, cz-.4+Math.floor(i/3)*.8, world, false);
  let um = stallMats[o.col];
  if (!um){
    const c=document.createElement('canvas'); c.width=128; c.height=16; const x=c.getContext('2d');
    for (let i=0;i<8;i++){ x.fillStyle=i%2?o.col:'#f5efe0'; x.fillRect(i*16,0,16,16); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
    um = stallMats[o.col] = toon(0xffffff,{map:t, side:THREE.DoubleSide});
  }
  add(new THREE.ConeGeometry(1.7,.6,8,1,true), um, cx,2.1,cz);
  add(new THREE.CylinderGeometry(.04,.04,1.8), tm(0x555555), cx,1.1,cz);
}
function buildPrison(){
  const P = PRISON, posts=[], bars=[];
  const gapN = GATES[0].x, gapS = GATES[1].x;
  for (let x=P.x; x<=P.x+P.w+.01; x+=.35){
    if (Math.abs(x-gapN) > .7) bars.push([x, P.y]);
    if (Math.abs(x-gapS) > .7) bars.push([x, P.y+P.h]);
  }
  for (let z=P.y+.35; z<P.y+P.h; z+=.35){ bars.push([P.x, z]); bars.push([P.x+P.w, z]); }
  const barMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04,.04,1.5,6), tm(0x2b2b30), bars.length);
  const m = new THREE.Matrix4(); bars.forEach(([x,z],i)=>{ m.makeTranslation(x,.75,z); barMesh.setMatrixAt(i,m); });
  barMesh.castShadow = true; world.add(barMesh);
  const rail = tm(0x2b2b30);
  add(new THREE.BoxGeometry(P.w,.08,.08), rail, P.x+P.w/2,1.5,P.y); add(new THREE.BoxGeometry(P.w,.08,.08), rail, P.x+P.w/2,1.5,P.y+P.h);
  add(new THREE.BoxGeometry(.08,.08,P.h), rail, P.x,1.5,P.y+P.h/2); add(new THREE.BoxGeometry(.08,.08,P.h), rail, P.x+P.w,1.5,P.y+P.h/2);
  for (const [x,z] of [[P.x,P.y],[P.x+P.w,P.y],[P.x,P.y+P.h],[P.x+P.w,P.y+P.h]]) add(new THREE.BoxGeometry(.25,1.7,.25), tm(0x1d3a7a), x,.85,z);
  // gate frames
  for (const g of GATES){
    const gz = g.y < PC.y ? P.y : P.y+P.h;
    add(new THREE.BoxGeometry(.15,2,.15), tm(0xf2c53d), g.x-.75,1,gz); add(new THREE.BoxGeometry(.15,2,.15), tm(0xf2c53d), g.x+.75,1,gz);
    add(new THREE.BoxGeometry(1.65,.15,.15), tm(0xf2c53d), g.x,2,gz);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.8,1.0,32), new THREE.MeshBasicMaterial({ color:0xffd84d, transparent:true, opacity:.8, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; ring.position.set(g.x,.04,g.y); ring.userData.dyn = true; world.add(ring); dyn.gateRings.push(ring);
  }
  // sign + siren
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4,.8), new THREE.MeshBasicMaterial({ map: signTex('POLICE POST','#1d3a7a') }));
  sign.position.set(PC.x, 2.6, P.y-.2); world.add(sign);
  add(new THREE.BoxGeometry(.1,2.4,.1), tm(0x333333), PC.x-1.8,1.2,P.y-.25); add(new THREE.BoxGeometry(.1,2.4,.1), tm(0x333333), PC.x+1.8,1.2,P.y-.25);
  dyn.siren = add(new THREE.BoxGeometry(.5,.25,.25), new THREE.MeshBasicMaterial({ color:0x2255ff }), PC.x,3.15,P.y-.2); dyn.siren.userData.dyn = true;
  // no-camping ring
  const pts=[]; for (let i=0;i<=96;i++){ const a=i/96*Math.PI*2; pts.push(new THREE.Vector3(PC.x+Math.cos(a)*CFG.campRadius,.05,PC.y+Math.sin(a)*CFG.campRadius)); }
  const lg = new THREE.BufferGeometry().setFromPoints(pts);
  dyn.campRing = new THREE.Line(lg, new THREE.LineDashedMaterial({ color:0xff8a2b, dashSize:.5, gapSize:.35, transparent:true, opacity:.75 }));
  dyn.campRing.computeLineDistances(); world.add(dyn.campRing);
}
function buildExits(){
  for (const x of EXITS){
    const g = new THREE.Group(); g.position.set(x.cx, 0, x.cy); g.userData.dyn = true; world.add(g);
    const signT = signTex(x.name, '#0b8a3e');
    const sx = x.cx < W/2 ? 1 : -1;
    add(new THREE.BoxGeometry(.3,1.2,.3), tm(0x444444), sx*1.8,.6,0, g);
    const arm = new THREE.Group(); arm.position.set(sx*1.8,1.1,0); g.add(arm);
    const c=document.createElement('canvas'); c.width=128; c.height=16; const cx=c.getContext('2d');
    for (let i=0;i<8;i++){ cx.fillStyle=i%2?'#d22':'#fff'; cx.fillRect(i*16,0,16,16); }
    const bt=new THREE.CanvasTexture(c); bt.colorSpace=THREE.SRGBColorSpace;
    const bar = add(new THREE.BoxGeometry(3.6,.14,.14), tm(0xffffff,{map:bt}), -sx*1.8,0,0, arm);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4,.75), new THREE.MeshBasicMaterial({ map: signT }));
    board.position.set(0, 2.9, 0); g.add(board);
    add(new THREE.BoxGeometry(.12,2.6,.12), tm(0x333333), -1.6,1.3,-.05, g); add(new THREE.BoxGeometry(.12,2.6,.12), tm(0x333333), 1.6,1.3,-.05, g);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(x.w,x.h), new THREE.MeshBasicMaterial({ color:0xff3333, transparent:true, opacity:.35, depthWrite:false }));
    pad.rotation.x=-Math.PI/2; pad.position.y=.03; g.add(pad);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,6,20,1,true), new THREE.MeshBasicMaterial({ color:0x5dff8a, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }));
    beam.position.y = 3; g.add(beam);
    dyn.exits.push({ arm, pad, beam, sx });
  }
}
function buildHides(){
  for (const h of HIDES){
    const g = new THREE.Group(); g.position.set(h.x, 0, h.y); world.add(g);
    const mats = [];
    if (h.k==='canopy'){
      const c=document.createElement('canvas'); c.width=256; c.height=16; const x=c.getContext('2d');
      for (let i=0;i<16;i++){ x.fillStyle=i%2?'#d63a2f':'#f5efe0'; x.fillRect(i*16,0,16,16); }
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
      const m = toon(0xffffff,{map:t, side:THREE.DoubleSide}); mats.push(m);
      add(new THREE.ConeGeometry(h.r+.3,1,16,1,true), m, 0,2.4,0, g);
      add(new THREE.CylinderGeometry(.06,.06,2.4), tm(0x666666), 0,1.2,0, g);
      add(new THREE.BoxGeometry(1.2,.6,.6), tm(0x7a4e25), .5,.3,.4, g);
    } else if (h.k==='grass'){
      // tall elephant grass: you can stand inside it
      const cols=[0x6f9a2f,0x86ad3a,0x5c8427];
      for (let i=0;i<3;i++){ const m = toon(cols[i]); mats.push(m);
        for (let k=0;k<7;k++){ const a=(k*2.4+i*1.3), rr=h.r*(.25+((k*37+i*11)%10)/10*.7);
          const b = add(new THREE.ConeGeometry(.28,1.5+((k+i)%3)*.35,5), m, Math.cos(a)*rr, .8, Math.sin(a)*rr, g); b.rotation.z = Math.sin(a*3)*.18; } }
    } else {
      add(new THREE.CylinderGeometry(.18,.26,2,8), tm(0x6b4423), 0,1,0, g);
      const cols=[0x2f6b2a,0x3d8b37,0x4fa046];
      for (const [dx,dy,dz,r,ci] of [[0,2.5,0,1,0],[-.6,2.2,.2,.8,1],[.6,2.3,-.1,.75,1],[.1,3.1,.1,.7,2],[0,2.1,.6,.7,2]]){
        const m = toon(cols[ci]); mats.push(m);
        add(new THREE.IcosahedronGeometry(r*h.r*.75,1), m, dx*h.r*.6, dy, dz*h.r*.6, g);
      }
    }
    dyn.trees.push({ h, mats, a:1 });
  }
}
function buildLamps(){
  for (const [x,z] of LAMPS){
    add(new THREE.CylinderGeometry(.06,.08,3.2,6), tm(0x555555), x,1.6,z, world, false);
    add(new THREE.BoxGeometry(.6,.08,.15), tm(0x555555), x+.25,3.15,z, world, false);
    const bulb = add(new THREE.SphereGeometry(.14,8,6), new THREE.MeshBasicMaterial({ color:0xfff1c1 }), x+.5,3.05,z, world, false);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(6,6), new THREE.MeshBasicMaterial({ map:GLOW, color:0xffb35a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    glow.rotation.x=-Math.PI/2; glow.position.set(x+.5,.06,z); glow.userData.dyn = true; bulb.userData.dyn = true; world.add(glow);
    dyn.lampGlows.push({ glow, bulb });
  }
}
function buildProps(){
  // goal posts and a few kids' tyres / benches for life
  if (MAP.ball) for (const z of [PITCH.y+.6, PITCH.y+PITCH.h-.6]){
    const cx = PITCH.x+PITCH.w/2;
    add(new THREE.BoxGeometry(.08,1,.08), tm(0xffffff), cx-1,.5,z, world); add(new THREE.BoxGeometry(.08,1,.08), tm(0xffffff), cx+1,.5,z, world);
    add(new THREE.BoxGeometry(2.1,.08,.08), tm(0xffffff), cx,1,z, world);
  }
  if (MAP.id!=='street') return;
  for (const [x,z] of [[5,46],[33,44],[16,56]]){ const t=add(new THREE.TorusGeometry(.4,.15,8,14), tm(0x1a1a1a), x,.15,z); t.rotation.x=Math.PI/2; }
  for (const [x,z] of [[26,27],[14,40]]) add(new THREE.BoxGeometry(1.8,.45,.5), tm(0x8a5a3a), x,.25,z);
}

function buildExtras(){
  // bunting across the road: green-white flags
  const flagG = new THREE.ConeGeometry(.16,.36,3); flagG.rotateX(Math.PI);
  for (const z of [6, 18, 30, 50]){
    for (let i=0;i<9;i++){
      const x = 8.6 + i*.45, y = 3.4 - Math.sin(i/8*Math.PI)*.45;
      const f = add(flagG, tm(i%2 ? 0xffffff : 0x0b8a3e, {side:THREE.DoubleSide}), x, y, z, world, false);
      f.rotation.y = Math.PI/2;
    }
    add(new THREE.CylinderGeometry(.015,.015,4.2,4), tm(0x333333), 10.4, 3.55, z, world, false).rotation.z = Math.PI/2;
  }
  // parked cars
  const carCols = [0xc0392b, 0x2e86de, 0xeeeeee, 0x222222];
  [[11.2,23],[11.2,47],[30,39.3]].forEach(([x,z],i) => {
    const g = new THREE.Group(); g.position.set(x,0,z); if (i===2) g.rotation.y = Math.PI/2; world.add(g);
    add(new THREE.BoxGeometry(1.3,.55,2.6), tm(carCols[i%4]), 0,.5,0, g);
    add(new THREE.BoxGeometry(1.15,.45,1.4), tm(0x2c3e57), 0,.98,-.1, g);
    for (const [dx,dz] of [[-.62,-.85],[.62,-.85],[-.62,.85],[.62,.85]]){ const w=add(new THREE.CylinderGeometry(.24,.24,.18,10), tm(0x111111), dx,.24,dz, g); w.rotation.z=Math.PI/2; }
  });
  // plastic chairs and a pot outside Mama Put, a kiosk and a cooler
  for (let i=0;i<4;i++){ const c = i%2?0xe74c3c:0x2e86de; const g=new THREE.Group(); g.position.set(8.2+(i%2)*.8, 0, 4+Math.floor(i/2)*1.2); world.add(g); add(new THREE.BoxGeometry(.5,.08,.5), tm(c), 0,.45,0, g); add(new THREE.BoxGeometry(.5,.5,.08), tm(c), 0,.7,-.22, g); for (const [dx,dz] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]) add(new THREE.BoxGeometry(.05,.45,.05), tm(c), dx,.22,dz, g); }
  add(new THREE.CylinderGeometry(.35,.3,.45,12), tm(0x555555), 7.6,.25,7.5); add(new THREE.CylinderGeometry(.4,.4,.06,12), tm(0x333333), 7.6,.5,7.5);
  add(new THREE.BoxGeometry(1.1,.8,.7), tm(0xe0601f), 19.5,.4,49.3);
  add(new THREE.BoxGeometry(1.4,1.6,1), tm(0x2e86de), 4.5,.8,44); add(new THREE.BoxGeometry(1.6,.1,1.2), tm(0xffffff), 4.5,1.65,44);
  // overhead wires between lamp posts
  const wireM = new THREE.LineBasicMaterial({ color:0x222222, transparent:true, opacity:.6 });
  for (let i=0;i<LAMPS.length-1;i++){ const a=LAMPS[i], b=LAMPS[i+1]; if (Math.hypot(a[0]-b[0],a[1]-b[1])>14) continue; const pts=[]; for (let k=0;k<=10;k++){ const t=k/10; pts.push(new THREE.Vector3(a[0]+(b[0]-a[0])*t+.5, 3.1-Math.sin(t*Math.PI)*.5, a[1]+(b[1]-a[1])*t)); } world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM)); }
}
function mergeStatic(){
  world.updateMatrixWorld(true);
  const groups = new Map(), remove = [];
  world.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    for (let p=o; p && p!==world; p=p.parent) if (p.userData.dyn) return;
    const k = o.material.uuid + '|' + o.castShadow;
    if (!groups.has(k)) groups.set(k, { m:o.material, cs:o.castShadow, list:[] });
    groups.get(k).list.push(o);
  });
  for (const g of groups.values()){
    if (g.list.length < 2) continue;
    const geos = g.list.map(o => {
      const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(ge.attributes)) if (!['position','normal','uv'].includes(a)) ge.deleteAttribute(a);
      if (!ge.attributes.uv) ge.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(ge.attributes.position.count*2), 2));
      ge.applyMatrix4(o.matrixWorld); return ge;
    });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, g.m); mesh.castShadow = g.cs; mesh.receiveShadow = true; world.add(mesh);
    remove.push(...g.list);
  }
  for (const o of remove) o.parent.remove(o);
}

// ------------------------------------------------------------- street snacks
const pickMeshes = new Map();
const breadG = new THREE.CapsuleGeometry(.18,.38,4,8); breadG.rotateZ(Math.PI/2);
const bottleG = new THREE.CylinderGeometry(.11,.13,.5,10);
export function syncPickups(list, t){
  const seen = new Set();
  for (const p of list){
    seen.add(p.id);
    let m = pickMeshes.get(p.id);
    if (!m){
      m = new THREE.Group();
      if (p.k==='bread'){ add(breadG, toon(0xd9a05b), 0,0,0, m); add(new THREE.BoxGeometry(.5,.05,.2), toon(0xf6d7a7), 0,.17,0, m); }
      else { add(bottleG, toon(0x8e1030), 0,0,0, m); add(new THREE.CylinderGeometry(.05,.05,.1,8), toon(0xffffff), 0,.3,0, m); }
      const ring = new THREE.Mesh(new THREE.RingGeometry(.35,.5,24), new THREE.MeshBasicMaterial({ color: p.k==='bread'?0xffc46b:0xff4f7a, transparent:true, opacity:.7, depthWrite:false }));
      ring.rotation.x = -Math.PI/2; ring.position.y = -.55; m.add(ring);
      m.position.set(p.x, .7, p.y); scene.add(m); pickMeshes.set(p.id, m);
    }
    m.rotation.y = t*2; m.position.y = .7 + Math.sin(t*3+p.id)*.12;
  }
  for (const [id,m] of pickMeshes) if (!seen.has(id)){ scene.remove(m); pickMeshes.delete(id); }
}

// ------------------------------------------------------------- night / day
export let isNight = false;
export function setNight(n){
  isNight = n;
  if (n){
    hemi.color.set(0x5a6fa8); hemi.groundColor.set(0x1a1208); hemi.intensity = .55;
    sun.color.set(0x9fb6ff); sun.intensity = .8;
    scene.background = new THREE.Color(0x0b1020); scene.fog = new THREE.Fog(0x0b1020, 22, 50);
    playerLight.intensity = 6;
  } else {
    hemi.color.set(0xcfe8ff); hemi.groundColor.set(0xc08050); hemi.intensity = 1.25;
    sun.color.set(0xfff0d0); sun.intensity = 2.3;
    scene.background = new THREE.Color(0x9fd4f5); scene.fog = new THREE.Fog(0x9fd4f5, 40, 90);
    playerLight.intensity = 0;
  }
  for (const l of dyn.lampGlows){ l.glow.material.opacity = n ? .55 : 0; l.bulb.material.color.set(n?0xffe39a:0xd8d8d8); }
}

// ------------------------------------------------------------- views of entities
const views = new Map();
const lookKey = (e) => e.team + JSON.stringify(e.look);
export function clearViews(){ for (const v of views.values()){ world.remove(v.ch.root); v.ch.dispose(); if (v.cone) world.remove(v.cone); } views.clear(); syncPickups([], 0); }
function viewFor(e){
  let v = views.get(e.id);
  const key = lookKey(e);
  if (v && v.key !== key){ world.remove(v.ch.root); v.ch.dispose(); v = null; }
  if (!v){
    const ch = makeCharacter(e.team, e.look);
    world.add(ch.root);
    let cone = null;
    if (e.team==='P'){
      cone = new THREE.Mesh(new THREE.ConeGeometry(2.6,7,16,1,true), new THREE.MeshBasicMaterial({ color:0xfff3b0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide }));
      cone.geometry.translate(0,-3.5,0); cone.geometry.rotateX(-Math.PI/2);
      ch.root.add(cone); cone.position.set(0,1.1,.3);
    }
    v = { ch, key, x:e.x, y:e.y, rot:Math.atan2(e.fx,e.fy), cone };
    views.set(e.id, v);
  }
  return v;
}
// viewerTeam: which team the local player is on (hiding rules), meId: their entity id
export function syncEntities(ents, dt, t, meId, viewerTeam, smooth, winTeam, alpha=1){
  for (const e of ents){
    const v = viewFor(e);
    const vis = e.state !== 'escaped';
    v.ch.root.visible = vis;
    if (!vis) continue;
    if (smooth && e.id!==meId){ const k=1-Math.exp(-dt*14); v.x += (e.x-v.x)*k; v.y += (e.y-v.y)*k; }
    else if (e.px !== undefined && Math.hypot(e.x-e.px, e.y-e.py) < 2){
      // draw between the last two game ticks, so movement is smooth at any screen refresh rate
      v.x = e.px + (e.x-e.px)*alpha; v.y = e.py + (e.y-e.py)*alpha;
    } else { v.x = e.x; v.y = e.y; }
    v.ch.root.position.set(v.x, 0, v.y);
    const tr = Math.atan2(e.fx||0, e.fy||1);
    let d = tr - v.rot; while (d>Math.PI) d-=Math.PI*2; while (d<-Math.PI) d+=Math.PI*2;
    v.rot += d*(1-Math.exp(-dt*15)); v.ch.root.rotation.y = v.rot;
    let mode = 'run';
    if (e.state==='arrest') mode='arrest'; else if (e.state==='jailed') mode='jailed';
    else if (e.windup>0) mode='grab'; else if (e.rescueProg>0 || e.escProg>0) mode='work';
    if (winTeam && e.team===winTeam && e.state!=='jailed') mode='cheer';
    v.ch.update(dt, { speed: e.speed||0, mode, sprint: e.sprinting, dash: e.dashT>0, t });
    // hiding: invisible to police unless close; see-through for your own team
    let a = 1;
    if (e.team==='T' && e.hidden && e.state==='free'){
      if (viewerTeam==='P'){ const me = ents[meId]; a = (me && Math.hypot(me.x-e.x,me.y-e.y) < (isNight?CFG.revealNight:CFG.revealDay)) ? 1 : 0; }
      else a = .45;
    }
    if (e.immune>0) a = Math.min(a, .6+.4*Math.sin(t*20));
    v.ch.setOpacity(a); v.ch.root.visible = a>0.02;
    v.vis = a>0.02;
    if (v.cone) v.cone.material.opacity = (isNight && e.state==='free') ? .1 : 0;
    if (e.id===meId) playerLight.position.set(v.x, 2.5, v.y);
  }
}
export function viewPos(id){ const v=views.get(id); return v ? { x:v.x, y:v.y, vis:v.vis!==false } : null; }

// ------------------------------------------------------------- per-frame world state
export function syncWorld(Gs, me, t){
  for (let i=0;i<EXITS.length;i++){
    const d = dyn.exits[i], open = Gs.exitsOpen;
    const target = open ? -d.sx*1.35 : 0;
    d.arm.rotation.z += (target - d.arm.rotation.z)*.08;
    d.pad.material.color.set(open?0x3ddc84:0xff3333); d.pad.material.opacity = open ? .35+.15*Math.sin(t*5) : .3;
    d.beam.material.opacity = open ? .12+.06*Math.sin(t*4+i) : 0;
  }
  dyn.gateRings.forEach((r,i) => {
    const al = Gs.alarm && Gs.alarm.gate===i;
    r.material.color.set(al ? 0xff3030 : 0xffd84d);
    const s = al ? 1+.15*Math.sin(t*16) : 1+.05*Math.sin(t*3); r.scale.set(s,s,s);
    r.visible = Gs.jailedCount>0 || al;
  });
  dyn.siren.material.color.set(Gs.alarm ? ((t*6|0)%2 ? 0xff2222 : 0x2255ff) : 0x2255ff);
  if (me && me.team==='P') dyn.campRing.material.color.set(me.camp>0 ? (Math.sin(t*14)>0?0xff3b1f:0xffaa33) : 0xff8a2b);
  // trees fade when you stand under them
  for (const tr of dyn.trees){
    const inside = me && me.state==='free' && Math.hypot(me.x-tr.h.x, me.y-tr.h.y) < tr.h.r+.4;
    const ta = inside ? .35 : 1;
    if (Math.abs(ta-tr.a)>.01){ tr.a += (ta-tr.a)*.2; for (const m of tr.mats){ m.transparent = tr.a<.99; m.opacity = tr.a; m.depthWrite = tr.a>.9; } }
  }
}

// ------------------------------------------------------------- camera
const camState = { x: W/2, y: H/2, shake: 0, mode: 'follow', orbit: 0 };
export function addShake(v){ camState.shake = Math.min(1, camState.shake + v); }
let camDist = 1;
export function setCamDist(v){ camDist = v; }
export function updateCamera(dt, tx, ty, opts={}){
  // look a little ahead of where you're running, and ease into it
  if (camState.px === undefined || Math.hypot(tx-camState.px, ty-camState.py) > 3){ camState.px = tx; camState.py = ty; camState.ax = 0; camState.ay = 0; }
  const vx = dt > 0 ? (tx-camState.px)/dt : 0, vy = dt > 0 ? (ty-camState.py)/dt : 0; camState.px = tx; camState.py = ty;
  const ka = 1-Math.exp(-dt*2.5);
  camState.ax += (Math.max(-2.2, Math.min(2.2, vx*.3)) - camState.ax)*ka; camState.ay += (Math.max(-2.2, Math.min(2.2, vy*.3)) - camState.ay)*ka;
  const k = 1-Math.exp(-dt*8);
  camState.x += (tx + camState.ax - camState.x)*k; camState.y += (ty + camState.ay - camState.y)*k;
  camState.shake = Math.max(0, camState.shake - dt*2.2);
  const sh = (opts.shakeOn===false?0:1) * camState.shake*camState.shake * .6;
  const ox = (Math.random()-.5)*sh, oz = (Math.random()-.5)*sh;
  const lx = Math.max(3.5, Math.min(W-3.5, camState.x)), lz = Math.max(7.5, Math.min(H-3, camState.y - 2));
  camera.position.set(lx + ox, 19*camDist, lz + 12*camDist + oz);
  camera.lookAt(lx, 0, lz);
  sun.position.set(lx+8, 22, lz+6); sun.target.position.set(lx, 0, lz); sun.target.updateMatrixWorld();
}
export function snapCamera(x,y){ camState.x=x; camState.y=y; camState.px=undefined; }
// showroom: orbit around a point close up
export function showroomCamera(dt, x, z, dist=4.2, height=1.6, angle=0){
  camera.position.set(x + Math.sin(angle)*dist, height+1.1, z + Math.cos(angle)*dist);
  camera.lookAt(x, height*.55, z);
  sun.position.set(x+6, 14, z+8); sun.target.position.set(x,0,z); sun.target.updateMatrixWorld();
}

// ------------------------------------------------------------- effects
const fxPool = [];
const fxGroup = new THREE.Group();
const starTex = (() => { const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.fillStyle='#fff'; g.beginPath(); for (let i=0;i<10;i++){ const r=i%2?12:30, a=i/10*Math.PI*2-Math.PI/2; g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r); } g.fill(); return new THREE.CanvasTexture(c); })();
function spawn(tex, color, x,y,z, vx,vy,vz, life, size, grav=0, blend=THREE.NormalBlending){
  let p = fxPool.find(p => !p.alive);
  if (!p){
    if (fxPool.length > 220) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false }));
    p = { s, alive:false }; fxPool.push(p); fxGroup.add(s);
  }
  p.alive = true; p.s.visible = true; p.s.material.map = tex; p.s.material.color.set(color); p.s.material.blending = blend; p.s.material.needsUpdate = true;
  p.s.position.set(x,y,z); p.v=[vx,vy,vz]; p.life=life; p.max=life; p.size=size; p.grav=grav;
}
export function fx(kind, x, y, extra){
  if (!fxGroup.parent) scene.add(fxGroup);
  if (kind==='dust'){ spawn(GLOW, 0xd9a877, x+(Math.random()-.5)*.3, .15, y+(Math.random()-.5)*.3, (Math.random()-.5)*.6, .5, (Math.random()-.5)*.6, .5, .55); }
  else if (kind==='stars'){ for (let i=0;i<14;i++){ const a=Math.random()*6.28; spawn(starTex, 0xffd84d, x, 1.6, y, Math.cos(a)*3, 3+Math.random()*2, Math.sin(a)*3, .8, .45, 9); } }
  else if (kind==='burst'){ for (let i=0;i<24;i++){ const a=i/24*6.28; spawn(GLOW, extra||0xffe066, x, .6, y, Math.cos(a)*6, 1.5, Math.sin(a)*6, .6, .7, 0, THREE.AdditiveBlending); } }
  else if (kind==='confetti'){ const cols=[0xff5a5a,0x5dff8a,0x5ab4ff,0xffd84d,0xff8ae2]; for (let i=0;i<60;i++) spawn(starTex, cols[i%5], x+(Math.random()-.5)*6, 5+Math.random()*3, y+(Math.random()-.5)*6, (Math.random()-.5)*3, Math.random()*2, (Math.random()-.5)*3, 2.2, .35, 4); }
  else if (kind==='whistle'){ for (let i=0;i<36;i++){ const a=i/36*6.28; spawn(GLOW, 0x9fd8ff, x+Math.cos(a)*.5, .5, y+Math.sin(a)*.5, Math.cos(a)*CFG.whistleRange*1.8, .3, Math.sin(a)*CFG.whistleRange*1.8, .55, .8, 0, THREE.AdditiveBlending); } }
  else if (kind==='dash'){ for (let i=0;i<8;i++) spawn(GLOW, 0xffffff, x+(Math.random()-.5)*.4, .5+Math.random()*.8, y+(Math.random()-.5)*.4, 0, .2, 0, .35, .6, 0, THREE.AdditiveBlending); }
  else if (kind==='smoke'){ spawn(GLOW, extra||0xaaaaaa, x, 1.25, y, (Math.random()-.5)*.35, .9+Math.random()*.5, (Math.random()-.5)*.35, 1.7, .75); }
  else if (kind==='goal'){ const cols=[0xffffff,0x0b8a3e,0xffd84d]; for (let i=0;i<40;i++){ const a=Math.random()*6.28; spawn(starTex, cols[i%3], x, .8, y, Math.cos(a)*4, 4+Math.random()*3, Math.sin(a)*4, 1.4, .4, 8); } }
  else if (kind==='sparkle'){ spawn(GLOW, 0x7dffa6, x+(Math.random()-.5)*3.5, .2, y+(Math.random()-.5)*3.5, 0, 2.2, 0, .9, .35, 0, THREE.AdditiveBlending); }
}
export function syncStreetLive(st, ents, me, dt, t){ syncStreet(st, ents, me, dt, t, isNight, quality < 1); }
export function idleStreetLive(dt, t){ idleStreet(dt, t); }
export function updateFx(dt){
  for (const p of fxPool){
    if (!p.alive) continue;
    p.life -= dt; if (p.life<=0){ p.alive=false; p.s.visible=false; continue; }
    p.v[1] -= p.grav*dt;
    p.s.position.x += p.v[0]*dt; p.s.position.y += p.v[1]*dt; p.s.position.z += p.v[2]*dt;
    if (p.s.position.y < .05){ p.s.position.y=.05; p.v[1]=0; p.v[0]*=.9; p.v[2]*=.9; }
    const f = p.life/p.max; p.s.material.opacity = Math.min(1, f*1.5); const sz = p.size*(.6+.4*f); p.s.scale.set(sz,sz,sz);
  }
}

// ------------------------------------------------------------- showroom characters
const show = { group:new THREE.Group(), chars:[] };
export function showroom(looks, focus){
  if (!show.group.parent) world.add(show.group);
  for (const c of show.chars){ show.group.remove(c.root); c.dispose(); }
  show.chars = [];
  const teams = focus ? [focus] : ['P','T'];
  teams.forEach((tm, i) => {
    const c = makeCharacter(tm, looks[tm]);
    c.root.position.set(focus ? 0 : (i ? .75 : -.75), 0, 0);
    c.root.rotation.y = focus ? 0 : (i ? -.25 : .25);
    show.group.add(c.root); show.chars.push(c);
  });
  show.group.position.set(MAP.show[0], 0, MAP.show[1]);
  show.group.visible = true;
}
export function hideShowroom(){ show.group.visible = false; }
export function updateShowroom(dt, t, spin){
  show.chars.forEach((c,i) => { c.update(dt, { speed:0, mode: (Math.sin(t*.5+i*2)>.85)?'cheer':'idle', t:t+i }); });
  if (show.chars.length===1) show.chars[0].root.rotation.y = spin;
  return show.group.position;
}
export function render(){ renderer.render(scene, camera); }
export function project(x, y, h){
  const v = new THREE.Vector3(x, h, y).project(camera);
  return [ (v.x*.5+.5)*innerWidth, (-v.y*.5+.5)*innerHeight, v.z < 1 ];
}

// ------------------------------------------------------------- tutorial target marker
let guide = null;
export function setGuide(x, y){
  if (!guide){
    guide = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(.75,1.0,32), new THREE.MeshBasicMaterial({ color:0xffd84d, transparent:true, opacity:.9, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; ring.position.y = .06; guide.add(ring);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.35,.7,4), new THREE.MeshBasicMaterial({ color:0xffd84d }));
    cone.rotation.x = Math.PI; cone.position.y = 2.6; guide.add(cone); guide.userData = { ring, cone };
    scene.add(guide);
  }
  if (x === null || x === undefined){ guide.visible = false; return; }
  guide.visible = true; guide.position.set(x, 0, y);
}
export function updateGuide(t){
  if (!guide || !guide.visible) return;
  const s = 1 + .12*Math.sin(t*6); guide.userData.ring.scale.set(s,s,s);
  guide.userData.cone.position.y = 2.5 + Math.abs(Math.sin(t*4))*.5; guide.userData.cone.rotation.y = t*2;
}
export function guidePos(){ return guide && guide.visible ? { x: guide.position.x, y: guide.position.z } : null; }
