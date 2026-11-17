// =============================================================
// CHARS: stylised 3D people built from simple shapes, so they stay
// cheap on budget Android phones and every part can be dressed up.
// Local forward is +z. Height is about 1.75 units.
// =============================================================
import * as THREE from 'three';
import { SKINS, SHOES, CATALOG } from './meta.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let GRAD = null;
export function toonGrad(){
  if (GRAD) return GRAD;
  const d = new Uint8Array([90,90,90,255, 170,170,170,255, 255,255,255,255]);
  GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
export const toon = (color, extra={}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGrad(), ...extra });

const texCache = {};
function canvasTex(key, w, h, draw){
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2;
  return texCache[key] = t;
}
function stripeTex(a,b){ return canvasTex('s'+a+b, 64, 64, (g,w,h)=>{ g.fillStyle=b; g.fillRect(0,0,w,h); g.fillStyle=a; for (let y=0;y<h;y+=16) g.fillRect(0,y,w,8); }); }
function camoTex(){ return canvasTex('camo',128,128,(g,w,h)=>{ g.fillStyle='#5d6b3a'; g.fillRect(0,0,w,h); const cs=['#3b4a25','#8a8457','#2c3220']; for(let i=0;i<60;i++){ g.fillStyle=cs[i%3]; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,6+Math.random()*14,4+Math.random()*9,Math.random()*3,0,7); g.fill(); } }); }
function ankaraTex(){ return canvasTex('ankara',128,128,(g,w,h)=>{ g.fillStyle='#e8762b'; g.fillRect(0,0,w,h);
  for (let y=0;y<h;y+=32) for (let x=0;x<w;x+=32){ g.fillStyle='#1b4f9c'; g.beginPath(); g.arc(x+16,y+16,12,0,7); g.fill(); g.fillStyle='#f6c625'; g.beginPath(); g.arc(x+16,y+16,6,0,7); g.fill(); g.fillStyle='#0f7a4a'; g.beginPath(); g.moveTo(x,y); g.lineTo(x+8,y); g.lineTo(x,y+8); g.fill(); g.fillStyle='#7a1e3a'; g.fillRect(x+28,y+28,4,4); } }); }
function asoTex(){ return canvasTex('aso',128,128,(g,w,h)=>{ g.fillStyle='#4a1d6e'; g.fillRect(0,0,w,h); for (let y=0;y<h;y+=12){ g.fillStyle = (y/12)%2 ? '#d4a017' : '#7a3fa0'; g.fillRect(0,y,w,4); } g.fillStyle='rgba(255,255,255,.18)'; for (let x=0;x<w;x+=6) g.fillRect(x,0,1,h); }); }
function jerseyTex(){ return canvasTex('jersey',128,128,(g,w,h)=>{ g.fillStyle='#0b8a3e'; g.fillRect(0,0,w,h); g.fillStyle='#ffffff'; g.fillRect(0,40,w,10); g.fillStyle='#0a6e31'; for (let x=0;x<w;x+=16) g.fillRect(x,0,8,40); g.fillStyle='#fff'; g.font='900 44px Arial'; g.textAlign='center'; g.fillText('9',w/2,100); }); }
function plaidTex(){ return canvasTex('ggm',64,64,(g,w,h)=>{ g.fillStyle='#f3f3f3'; g.fillRect(0,0,w,h); g.globalAlpha=.75; g.fillStyle='#c0392b'; for(let i=0;i<w;i+=16){ g.fillRect(i,0,6,h); g.fillRect(0,i,w,6);} g.fillStyle='#2457a6'; for(let i=8;i<w;i+=16){ g.fillRect(i,0,4,h); g.fillRect(0,i,w,4);} g.globalAlpha=1; }); }

const geo = {};
const G = (k, f) => geo[k] || (geo[k] = f());

function outfitMat(team, id){
  const list = CATALOG[team].outfit, o = list.find(x=>x.id===id) || list[0];
  if (team==='P'){
    if (o.col==='camo') return { shirt: toon(0xffffff,{map:camoTex()}), pants: toon(0x3b4a25) };
    const c = new THREE.Color(o.col);
    return { shirt: toon(c), pants: toon(c.clone().multiplyScalar(.75)) };
  }
  if (o.pattern==='ankara') return { shirt: toon(0xffffff,{map:ankaraTex()}), pants: toon(0x1f2a44) };
  if (o.pattern==='aso') return { shirt: toon(0xffffff,{map:asoTex()}), pants: toon(0x2a1240) };
  if (o.jersey) return { shirt: toon(0xffffff,{map:jerseyTex()}), pants: toon(0xffffff) };
  const t = stripeTex(o.a,o.b);
  return { shirt: toon(0xffffff,{map:t}), pants: toon(0x23272f) };
}

export function makeCharacter(team, look){
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mats = [];
  const M = m => { if (m.transparent){ m.userData.t=true; m.userData.o=m.opacity; } mats.push(m); return m; };
  const mesh = (g, m, x=0,y=0,z=0, parent=body) => { const o=new THREE.Mesh(g,m); o.position.set(x,y,z); o.castShadow=true; parent.add(o); return o; };
  // shopkeepers and other townspeople wear plain clothes (look.civ)
  const o = look.civ ? { shirt: toon(look.civ), pants: toon(look.civP || '#3a3a3a') } : outfitMat(team, look.outfit); M(o.shirt); M(o.pants);
  if (look.civ && (look.head==='gele' || look.long)) mesh(G('wrap',()=>new THREE.CylinderGeometry(.3,.36,.5,12)), o.pants, 0,.42,0, body);
  const skin = M(toon(SKINS[look.skin] || SKINS[2]));
  const shoe = M(toon(SHOES[look.shoes] || SHOES[0]));
  const dark = M(toon(0x151515)), white = M(toon(0xffffff)), gold = M(toon(0xf2c53d, {emissive:0x332200}));

  // legs (pivot at the hip)
  const legs = [-1,1].map(s => {
    const hip = new THREE.Group(); hip.position.set(.13*s, .62, 0); body.add(hip);
    mesh(G('leg',()=>new THREE.CapsuleGeometry(.11,.3,4,8)), o.pants, 0,-.26,0, hip);
    mesh(G('shoe',()=>new THREE.BoxGeometry(.18,.11,.3)), shoe, 0,-.55,.04, hip);
    return hip;
  });
  const torso = new THREE.Group(); torso.position.y = .62; body.add(torso);
  mesh(G('torso',()=>new THREE.CapsuleGeometry(.27,.28,6,12)), o.shirt, 0,.32,0, torso);
  const arms = [-1,1].map(s => {
    const sh = new THREE.Group(); sh.position.set(.36*s, .58, 0); torso.add(sh);
    mesh(G('arm',()=>new THREE.CapsuleGeometry(.085,.28,4,8)), o.shirt, 0,-.2,0, sh);
    mesh(G('hand',()=>new THREE.SphereGeometry(.09,10,8)), skin, 0,-.42,0, sh);
    return sh;
  });
  const head = new THREE.Group(); head.position.y = .98; torso.add(head);
  mesh(G('head',()=>new THREE.SphereGeometry(.31,18,14)), skin, 0,0,0, head);
  // eyes
  for (const s of [-1,1]){
    mesh(G('eyeW',()=>new THREE.SphereGeometry(.07,10,8)), white, .11*s,.04,.26, head);
    mesh(G('eyeP',()=>new THREE.SphereGeometry(.04,8,6)), dark, .11*s,.04,.32, head);
  }
  // face: brows, smile, cheeks
  for (const s of [-1,1]){
    const br = mesh(G('brow',()=>new THREE.BoxGeometry(.11,.025,.03)), dark, .11*s,.14,.28, head); br.rotation.z = -.15*s;
  }
  const smile = mesh(G('smile',()=>new THREE.TorusGeometry(.07,.016,6,12,Math.PI)), dark, 0,-.1,.285, head); smile.rotation.z = Math.PI;
  const cheekM = M(toon(0xd9776b,{transparent:true,opacity:.45}));
  for (const s of [-1,1]) mesh(G('cheek',()=>new THREE.SphereGeometry(.045,8,6)), cheekM, .19*s,-.05,.24, head).scale.set(1,.6,.4);
  if (team==='P'){
    mesh(G('belt',()=>new THREE.CylinderGeometry(.285,.285,.07,16)), dark, 0,.1,0, torso);
    mesh(G('badge',()=>new THREE.BoxGeometry(.09,.1,.03)), gold, -.12,.45,.26, torso);
  }
  // headwear
  const hw = look.head;
  const capCol = team==='P' ? (look.outfit==='p_white'?0xf2f2f2:0x0e1f45) : 0x111111;
  if (hw==='cap' || hw==='goldcap'){
    const c = M(toon(hw==='goldcap' ? 0xc79a1e : capCol));
    mesh(G('capTop',()=>new THREE.CylinderGeometry(.34,.3,.14,18)), c, 0,.27,0, head);
    const brim = mesh(G('brim',()=>new THREE.CylinderGeometry(.2,.2,.03,16,1,false,0,Math.PI)), dark, 0,.2,.2, head); brim.rotation.y = -Math.PI/2;
    mesh(G('capBadge',()=>new THREE.BoxGeometry(.08,.07,.02)), gold, 0,.28,.32, head);
  } else if (hw==='beret'){
    const b = mesh(G('beret',()=>new THREE.SphereGeometry(.33,14,8)), M(toon(0x8a1c2b)), .04,.24,-.02, head); b.scale.set(1,.35,1); b.rotation.z=-.25;
  } else if (hw==='helmet'){
    mesh(G('helm',()=>new THREE.SphereGeometry(.35,18,10,0,Math.PI*2,0,Math.PI/2)), M(toon(0x23262e)), 0,.04,0, head);
    mesh(G('visor',()=>new THREE.BoxGeometry(.5,.16,.04)), M(toon(0x9fd3ff,{transparent:true,opacity:.55})), 0,.04,.31, head);
  } else if (hw==='bucket'){
    const c = M(toon(team==='P'?0x2d3b2a:0xd9b36a));
    mesh(G('bTop',()=>new THREE.CylinderGeometry(.28,.33,.2,16)), c, 0,.28,0, head);
    mesh(G('bBrim',()=>new THREE.CylinderGeometry(.46,.46,.03,18)), c, 0,.18,0, head);
  } else if (hw==='bandana'){
    mesh(G('mask',()=>new THREE.CylinderGeometry(.318,.318,.12,20,1,true)), M(toon(0x111111,{side:THREE.DoubleSide})), 0,.05,0, head);
    const knot = mesh(G('knot',()=>new THREE.BoxGeometry(.08,.16,.06)), dark, 0,.03,-.33, head); knot.rotation.z=.6;
  } else if (hw==='beanie'){
    mesh(G('bean',()=>new THREE.SphereGeometry(.33,16,10,0,Math.PI*2,0,Math.PI/2)), M(toon(0xc0392b)), 0,.08,0, head);
    mesh(G('beanR',()=>new THREE.TorusGeometry(.31,.05,6,18)), M(toon(0x922b21)), 0,.1,0, head).rotation.x=Math.PI/2;
    mesh(G('pom',()=>new THREE.SphereGeometry(.08,8,6)), white, 0,.42,0, head);
  } else if (hw==='afro'){
    const a = mesh(G('afro',()=>new THREE.IcosahedronGeometry(.44,1)), M(toon(0x1a1210)), 0,.2,-.06, head); a.scale.set(1,.85,1);
  } else if (hw==='durag'){
    mesh(G('dur',()=>new THREE.SphereGeometry(.325,16,10,0,Math.PI*2,0,Math.PI/1.9)), M(toon(0x2b2f8f)), 0,.02,0, head);
    mesh(G('durT',()=>new THREE.BoxGeometry(.12,.28,.03)), M(toon(0x2b2f8f)), 0,-.12,-.32, head);
  } else if (hw==='gele'){
    const gm = M(toon(look.gele || '#f4c430'));
    const g1 = mesh(G('gele1',()=>new THREE.SphereGeometry(.36,14,8)), gm, 0,.22,-.02, head); g1.scale.set(1.25,.5,1.05);
    const g2 = mesh(G('gele2',()=>new THREE.ConeGeometry(.3,.42,10)), gm, .08,.42,-.05, head); g2.rotation.z = -.5; g2.scale.set(1.3,1,.6);
  } else if (hw==='straw'){
    const sm = M(toon(0xd9b36a));
    mesh(G('straw1',()=>new THREE.ConeGeometry(.56,.3,16)), sm, 0,.33,0, head);
    mesh(G('straw2',()=>new THREE.SphereGeometry(.07,8,6)), sm, 0,.5,0, head);
  } else if (hw==='fila'){
    const f = mesh(G('fila',()=>new THREE.CylinderGeometry(.27,.33,.3,14)), M(toon(0xffffff,{map:asoTex()})), .05,.3,0, head); f.rotation.z = -.35;
  } else if (hw==='crown'){
    mesh(G('crownB',()=>new THREE.CylinderGeometry(.27,.27,.14,12,1,true)), M(toon(0xf2c53d,{side:THREE.DoubleSide, emissive:0x3a2a00})), 0,.33,0, head);
    for (let i=0;i<6;i++){ const a=i/6*Math.PI*2; mesh(G('spike',()=>new THREE.ConeGeometry(.05,.14,5)), gold, Math.cos(a)*.26,.46,Math.sin(a)*.26, head); }
    mesh(G('hair',()=>new THREE.SphereGeometry(.318,16,8,0,Math.PI*2,0,Math.PI/2.6)), M(toon(0x1a1210)), 0,.03,-.01, head);
  } else if (hw==='halo'){
    mesh(G('hair',()=>new THREE.SphereGeometry(.318,16,8,0,Math.PI*2,0,Math.PI/2.6)), M(toon(0x1a1210)), 0,.03,-.01, head);
    const h = mesh(G('halo',()=>new THREE.TorusGeometry(.26,.035,8,24)), M(new THREE.MeshBasicMaterial({ color:0xff3355 })), 0,.52,0, head); h.rotation.x = Math.PI/2; h.userData.halo = true;
  } else {
    mesh(G('hair',()=>new THREE.SphereGeometry(.318,16,8,0,Math.PI*2,0,Math.PI/2.6)), M(toon(0x1a1210)), 0,.03,-.01, head);
  }
  if (look.eyes==='shades'){ mesh(G('shades',()=>new THREE.BoxGeometry(.42,.09,.05)), dark, 0,.05,.3, head); }
  else if (look.eyes==='star'){ mesh(G('shades',()=>new THREE.BoxGeometry(.42,.09,.05)), M(toon(0xffd400)), 0,.05,.3, head); }
  else if (look.eyes==='visor'){ mesh(G('visorE',()=>new THREE.BoxGeometry(.5,.1,.06)), M(new THREE.MeshBasicMaterial({ color:0x2ff3ff })), 0,.05,.3, head); }
  else if (look.eyes==='specs'){ for (const s of [-1,1]) mesh(G('lens',()=>new THREE.TorusGeometry(.075,.015,6,14)), M(toon(0xd4af37)), .11*s,.05,.31, head); }
  if (look.extra==='chain') mesh(G('chain',()=>new THREE.TorusGeometry(.2,.03,6,16)), gold, 0,.68,.08, torso).rotation.x = Math.PI/2.3;
  else if (look.extra==='backpack') mesh(G('pack',()=>new THREE.BoxGeometry(.4,.45,.2)), M(toon(0x2e86de)), 0,.38,-.32, torso);
  else if (look.extra==='scarf'){ const sc = M(toon(0x0b8a3e)); mesh(G('scarf',()=>new THREE.TorusGeometry(.22,.07,8,16)), sc, 0,.66,0, torso).rotation.x=Math.PI/2; mesh(G('scarfT',()=>new THREE.BoxGeometry(.12,.35,.04)), M(toon(0xffffff)), .12,.45,.24, torso); }
  else if (look.extra==='phones'){ const pm = M(toon(0x222222)); const band = mesh(G('band',()=>new THREE.TorusGeometry(.33,.03,6,16,Math.PI)), pm, 0,.02,0, head); band.rotation.y=Math.PI/2; for (const s of [-1,1]) mesh(G('cup',()=>new THREE.CylinderGeometry(.1,.1,.08,12)), M(toon(0xe0601f)), .32*s,0,0, head).rotation.z=Math.PI/2; }
  else if (look.extra==='cape'){ const cp = mesh(G('cape',()=>new THREE.PlaneGeometry(.75,.9)), M(toon(0x5b2a86,{side:THREE.DoubleSide, map:asoTex()})), 0,.25,-.3, torso); cp.rotation.x = .15; }
  else if (look.extra==='ggm'){ mesh(G('ggm',()=>new THREE.BoxGeometry(.55,.4,.3)), M(toon(0xffffff,{map:plaidTex()})), 0,.42,-.36, torso); }

  // fewer draw calls: inside each moving part, merge pieces that share a material
  for (const grp of [body, torso, head, ...legs, ...arms]) mergeChildren(grp);
  const ch = { root, body, torso, head, legs, arms, mats, phase:Math.random()*6, opacity:1, team, dance: look.dance||'cheer' };
  ch.update = (dt, st) => animate(ch, dt, st);
  ch.setOpacity = (a) => {
    if (Math.abs(a-ch.opacity)<.01) return; ch.opacity=a;
    for (const m of mats){ m.transparent = a<1 || !!m.userData.t; m.opacity = a*(m.userData.o||1); m.depthWrite = a>.6; m.needsUpdate = true; }
  };
  ch.dispose = () => { for (const m of mats) m.dispose(); };
  return ch;
}

function mergeChildren(grp){
  const byMat = new Map();
  for (const c of grp.children) if (c.isMesh && !c.userData.halo){ if (!byMat.has(c.material)) byMat.set(c.material, []); byMat.get(c.material).push(c); }
  for (const [mat, list] of byMat){
    if (list.length < 2) continue;
    const geos = list.map(c => { c.updateMatrix(); const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position','normal','uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2)); g.applyMatrix4(c.matrix); return g; });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.castShadow = true; grp.add(m);
    for (const c of list){ grp.remove(c); }
  }
}
// st: {speed, mode:'run'|'arrest'|'jailed'|'grab'|'work'|'cheer'|'idle', sprint, dash, t}
function animate(ch, dt, st){
  const sp = st.speed||0, k = Math.min(1, sp/5.5);
  ch.phase += dt * (3 + sp*1.7);
  const s = Math.sin(ch.phase);
  let legA = s*.95*k, armA = -s*.8*k, lean = (st.sprint?.28:.08)*k, bob = Math.abs(Math.cos(ch.phase))*.07*k;
  let armUp = 0, armFwd = 0, jump = 0;
  const t = st.t||0;
  if (st.mode==='arrest'){ armUp = 1; legA=0; lean=0; bob=0; }
  else if (st.mode==='jailed' && sp<.2){ armA = Math.sin(t*2)*.15; legA=0; }
  else if (st.mode==='grab'){ armFwd = 1; }
  else if (st.mode==='work'){ armFwd = .8; armA = Math.sin(t*18)*.25; legA*=.3; }
  else if (st.mode==='cheer'){
    const d = ch.dance;
    if (d==='shaku'){ armFwd = .6+Math.sin(t*9)*.4; legA = Math.sin(t*9)*.4; jump = Math.abs(Math.sin(t*9))*.08; ch.body.rotation.y = Math.sin(t*4.5)*.3; }
    else if (d==='zanku'){ legA = Math.sin(t*12)*.9; armA = Math.cos(t*12)*.6; jump = Math.abs(Math.sin(t*12))*.12; }
    else if (d==='spin'){ armUp = .5; ch.body.rotation.y += dt*12; jump = .08; legA = 0; }
    else if (d==='gwara'){ armUp = .4+Math.sin(t*6)*.4; armA = Math.sin(t*6)*.9; legA = Math.sin(t*3)*.3; ch.torso.rotation.z = Math.sin(t*6)*.15; }
    else { armUp = .9+Math.sin(t*10)*.1; jump = Math.abs(Math.sin(t*5))*.35; legA=0; }
  }
  else if (sp<.2){ armA = Math.sin(t*1.8+ch.phase)*.05; bob = Math.sin(t*2.2)*.015; }
  if (st.dash){ lean = .7; legA = .9; armA = -1.2; }
  ch.legs[0].rotation.x = legA; ch.legs[1].rotation.x = -legA;
  const ax = -armFwd*1.45 - armUp*2.9;
  ch.arms[0].rotation.x = ax + armA; ch.arms[1].rotation.x = ax - armA;
  ch.arms[0].rotation.z = -.1 - armUp*.25; ch.arms[1].rotation.z = .1 + armUp*.25;
  ch.torso.rotation.x += (lean - ch.torso.rotation.x)*Math.min(1,dt*10);
  ch.body.position.y = bob + jump;
  ch.head.rotation.y = st.mode==='jailed' ? Math.sin(t*.9)*.5 : 0;
  if (st.mode!=='cheer'){ ch.body.rotation.y = 0; ch.torso.rotation.z = 0; }
}

export function lookCatalogTeams(){ return CATALOG; }
