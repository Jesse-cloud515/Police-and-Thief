// =============================================================
// WORLD: tuning values, the street map, collision and pathfinding.
// Coordinates: x = left/right (0..W), y = up/down the screen (0..H).
// The map is tall (portrait). In 3D, y becomes the ground's z axis.
// =============================================================

export const CFG = {
  matchTime: 240,        // 4 minutes: short enough for "one more game"
  headStart: 5,          // police count with eyes closed
  exitsOpenAt: 120,      // exits unlock after 2:00
  sightDay: 10, sightNight: 6.5,
  revealDay: 2.6, revealNight: 2.1,
  walkT: 5.9, walkP: 4.7,        // faster than the first prototype (+35%)
  sprintT: 8.7, sprintP: 7.0,
  drainT: 26, drainP: 25,        // stamina per second (max 100)
  regenT: 18, regenP: 10,        // thieves recover faster: police must work as a team
  regenDelay: 0.8,               // seconds after you stop sprinting before stamina starts coming back
  captureRange: 1.05, captureConfirm: 1.4, captureWindup: 0.4,
  captureCooldown: 1.3, arrestFreeze: 0.8, escortTime: 3.5,
  rescueTime: 1.5, rescueRange: 1.35,
  escapeTime: 1.0,
  immuneTime: 4.5,
  campRadius: 7, campFill: 3.5, campDrain: 3, reassignTime: 5,
  escapesToWin: 2,
  dashTime: 0.28, dashSpeed: 16, dashCd: 7,
  whistleCd: 14, whistleRange: 5, whistleSlow: 1.0,
  noteMax: 12, noteEvery: 4, noteValue: 10,      // ₦ notes lying on the street
  goalCash: 30, shopRange: 1.7, fullTime: 6, suyaTime: 6,
  autoCatch: true,        // police grab on their own when a thief is in reach
  herdSpeed: 1.6, herdEvery: 32, bellCd: 25, bellReveal: 5,
  pickupEvery: 12, pickupMax: 3, zoboTime: 3.5, zoboBoost: 1.25,
  // opposing-bot strength by difficulty (0 easy, 1 normal, 2 hard): speed, dodge chance, sight
  diff: [ { spd:.9, dodge:.35, sight:.8, react:1.4 }, { spd:1, dodge:.6, sight:1, react:1 }, { spd:1.05, dodge:.75, sight:1.1, react:.8 } ],
};
export const W = 40, H = 64, R = 0.42;

// ---- locations --------------------------------------------------------------
// Every location is 40 x 64 with the Police Post in the middle and an exit in each corner.
// Obstacles are [x, y, w, h, kind, label, colour]; shop fronts face down the screen (south).
// Shops are [building label, item, price, effect, icon, what is on the counter].
const tr = o => ({ ...o, x: o.y, y: o.x, w: o.h, h: o.w });
const streetRaw = [
  [6,3,7,4,'bld','MAMA PUT','#c94a3c'], [16,2,6,5,'bld','IYA BISI STORES','#2f6fc2'], [25,3,5,4,'bld','BARBER','#8a3fa6'],
  [35,2,10,6,'bld','UNITY PRIMARY SCHOOL','#d99a22'], [49,3,7,4,'bld','VIEWING CENTRE','#13907a'], [2,17,4,6,'bld','CHEMIST','#249a52'],
  [16,15,4,4,'bld','SUYA SPOT','#b5372a'], [45,17,4,4,'bld','GEN HOUSE','#6d777b'], [55,21,3,3,'tank','',''], [20,25,2,2,'bore','BOREHOLE',''],
  [10,12.5,4.4,1.8,'bus','',''], [44,12.5,4.4,1.8,'bus','',''], [41,26,3,1.4,'keke','','#2e86de'], [41,29,3,1.4,'keke','','#1f9d55'],
  [6,30,3,2,'stall','','#e67e22'],[10.5,30,3,2,'stall','','#16a085'],[15,30,3,2,'stall','','#c0392b'],
  [6,34,3,2,'stall','','#8e44ad'],[10.5,34,3,2,'stall','','#f1c40f'],[15,34,3,2,'stall','','#2980b9'],
  [46,31,8,5,'bld','OWAMBE HALL','#a8336a'],
].map(a => { const o = tr({ x:a[0], y:a[1], w:a[2], h:a[3] }); return [o.x, o.y, o.w, o.h, a[4], a[5], a[6]]; });
const stallCols = ['#e67e22','#16a085','#c0392b','#8e44ad','#f1c40f','#2980b9'];
const stallGrid = (ys) => ys.flatMap((y,r) => [8,12,16,22,26,30].map((x,i) => [x, y, 2, 3, 'stall', '', stallCols[(i+r)%6]]));

export const MAPS = {
  street: {
    name:'Naija Street', short:'Street', icon:'🛣️', blurb:'Football field, six shops, and cattle crossing the road',
    ob: streetRaw,
    hides: [[8.5,25.5,2.2,'canopy'],[13,22,1.8,'canopy'],[23.5,13.6,1.8,'tree'],[4,13.5,1.8,'tree'],[53,13,2,'tree'],[58.5,32,2,'tree'],
            [37,24.5,1.6,'tree'],[20.5,37.6,1.6,'tree'],[43.5,37.6,1.7,'tree'],[58,15.5,1.6,'tree']].map(([x,y,r,k]) => [y,x,r,k]),
    spawnT: [[27,3],[38.4,14],[12,61],[27,60]],
    roads: [ {x:9.05, y:0, w:2.8, h:H}, {x:11.6, y:37.5, w:W-11.6, h:2.75} ],
    pitch: { x:29, y:22, w:8, h:12 },
    lamps: [[8.4,8],[12.5,20],[8.4,44],[12.5,56],[20,37],[30,41],[36,37],[16,25],[27,16]],
    exits: ['MOTOR PARK','EXPRESSWAY','OKADA PARK','MARKET ROAD'],
    shops: [['MAMA PUT','Jollof rice',30,'full','🍛','pots'], ['IYA BISI STORES','Pure water',10,'water','💧','store'], ['SUYA SPOT','Suya',40,'boost','🍢','suya'],
            ['CHEMIST','Glucose',20,'ready','⚡','chemist'], ['VIEWING CENTRE','Cold kunu',10,'water','🥛','cooler'], ['OWAMBE HALL','Small chops',30,'full','🍗','chops']],
    // parked cars, a kiosk and a cooler: solid like the danfos. Written the normal way round: [x, y, w, h, kind, label, colour]
    props: [[11.2,21.7,1.3,2.6,'car','','#c0392b'], [11.2,45.7,1.3,2.6,'car','','#2e86de'], [28.7,38.65,2.6,1.3,'car','','#eeeeee'],
            [3.8,45.8,1.4,1,'kiosk','','#2e86de'], [18.95,48.95,1.1,.7,'cooler','','#e0601f']],
    ground:'#c98450', show:[33,28], herd:{ x0:10.45, y0:-5, x1:10.45, y1:69 },
  },
  market: {
    name:'Market Day', short:'Market', icon:'🧺', blurb:'A maze of stalls. Everything is cheaper, more ₦ on the ground, cattle on the road',
    ob: [[14,3.6,6,4,'bld','IYA BASIRA BUKA','#c94a3c'], [26,3.6,6,4,'bld','COLD ROOM','#2f6fc2'], [2,22,5,5,'bld','ALHAJI PROVISIONS','#249a52'],
         [33,22,5,5,'bld','SUYA SPOT','#b5372a'], [2,40,5,5,'bld','GRINDING MILL','#6d777b'], [33,40,5,5,'bld','TAILOR','#8a3fa6'],
         [14,56,6,4,'bld','KUNU JOINT','#13907a'], [26,54,6,4,'bld','PEPPER SOUP','#a8336a'],
         ...stallGrid([13,19]), ...stallGrid([41,47]), [1,30,1.8,4.4,'bus','',''], [35,33,3,1.4,'keke','','#2e86de'], [9,54,3,1.4,'keke','','#1f9d55']],
    hides: [[5,15,1.8,'tree'],[35,15,1.8,'tree'],[10,34,2,'canopy'],[30,30,2,'canopy'],[5,53,1.8,'tree'],[36,51,1.8,'tree'],[20,16,1.5,'canopy'],[20,46,1.5,'canopy'],[36,37,1.6,'tree'],[20,24.5,1.5,'canopy']],
    spawnT: [[36,10],[4,10],[4,58],[36,58]],
    roads: [ {x:0, y:8.7, w:W, h:2.8} ],
    pitch: null,
    lamps: [[7,12],[33,12],[20,39],[7,38],[33,38],[20,53]],
    exits: ['LORRY PARK','BACK GATE','ABATTOIR ROAD','MAIN GATE'],
    shops: [['IYA BASIRA BUKA','Jollof rice',20,'full','🍛','pots'], ['COLD ROOM','Pure water',10,'water','💧','cooler'], ['ALHAJI PROVISIONS','Glucose',10,'ready','⚡','store'],
            ['SUYA SPOT','Suya',30,'boost','🍢','suya'], ['KUNU JOINT','Cold kunu',10,'water','🥛','cooler'], ['PEPPER SOUP','Pepper soup',20,'full','🍲','pots']],
    ground:'#b98a5a', show:[20,25.5], herd:{ x0:-5, y0:10.1, x1:45, y1:10.1 }, noteMax:18,
  },
  school: {
    name:'School Yard', short:'School', icon:'🏫', blurb:'Ring the school bell to show the other team on your map. Football field too',
    ob: [[4.8,5,13,4,'bld','PRIMARY 1 - 3','#d99a22'], [22,5,12,4,'bld','PRIMARY 4 - 6','#d99a22'], [2,14,4,9,'bld','STAFF ROOM','#c97b22'],
         [33,41,5,8,'bld','LIBRARY','#8a6d3b'], [3,43,7,4,'bld','TUCK SHOP','#2f6fc2'], [14,54,8,4,'bld','SCHOOL HALL','#a8336a'],
         [3,52,5,3,'bld','MAMA NKECHI','#c94a3c'], [35,12,3,3,'tank','',''], [30,50,2,2,'bore','BOREHOLE',''], [26,57,4.4,1.8,'bus','','']],
    hides: [[20,11,1.6,'tree'],[10,35,2,'tree'],[31,33,1.8,'tree'],[6,38,1.7,'tree'],[36,29,1.7,'tree'],[20,44,1.8,'tree'],[27,45,1.6,'tree'],[36,56,1.6,'tree'],[9,12,1.5,'tree'],[12,61,1.5,'tree']],
    spawnT: [[37,8],[2,30],[10,60],[37,52]],
    roads: [ {x:18.6, y:36, w:2.8, h:18} ],
    pitch: { x:24, y:13.5, w:9, h:12 },
    lamps: [[19,10],[8,27],[32,28],[12,48],[30,55]],
    exits: ['SCHOOL GATE','BROKEN FENCE','FARM PATH','BACK GATE'],
    shops: [['TUCK SHOP','Pure water',10,'water','💧','store'], ['MAMA NKECHI','Rice and stew',30,'full','🍛','pots'], ['SCHOOL HALL','Chin-chin',20,'ready','🥨','chops']],
    ground:'#c9955f', show:[28.5,19.5], bell:{ x:11, y:24.5 },
  },
  church: {
    name:'Behind the Church', short:'Church', icon:'⛪', blurb:'Tall grass to hide in, and a hole in the fence that takes you across the compound',
    ob: [[10,3,20,9,'bld','CHAPEL','#d8cfb8'], [2,18,6,5,'bld','PARISH HALL','#b08d57'], [32,18,6,5,'bld','SUNDAY SCHOOL','#5f93c7'],
         [3,42,6,4,'bld','CANTEEN','#c94a3c'], [31,44,6,4,'bld','GATEMAN HOUSE','#6d777b'], [16,54,8,4,'bld','BOOKSHOP','#8a3fa6'],
         [25,39.4,4.4,1.8,'bus','',''], [9,37,3,1.4,'keke','','#2e86de'], [34,29,3,3,'tank','',''], [5,30,2,2,'bore','BOREHOLE','']],
    hides: [[5,13,2.4,'grass'],[35,13,2.4,'grass'],[4,36,2.5,'grass'],[36,38,2.5,'grass'],[12,50,2.4,'grass'],[30,53,2.4,'grass'],[20,46,2,'grass'],
            [12,26,1.7,'tree'],[28,26,1.7,'tree'],[20,18,1.8,'tree'],[36,60,1.6,'grass']],
    spawnT: [[37,7],[3,9],[4,56],[37,57]],
    roads: [ {x:26, y:41.2, w:2.8, h:23} ],
    pitch: null,
    lamps: [[9,14],[31,14],[14,40],[26,36],[20,52]],
    exits: ['MAIN GATE','BUSH PATH','BACK FENCE','CAR PARK'],
    shops: [['PARISH HALL','Zobo',10,'water','🥤','cooler'], ['CANTEEN','Moi moi',30,'full','🍲','pots'], ['BOOKSHOP','Mint sweet',20,'ready','🍬','store']],
    ground:'#b7905e', show:[20,15.5], gaps: [[.95,27,1],[39.05,35,-1]],
  },
};
export const MAP_IDS = Object.keys(MAPS);
// the location in play; everything below is refilled by setMap()
export const MAP = { id:'' };
export const OB = [], SOLIDS = [], SIGHT = [], HIDES = [], SPAWN_T = [], ROADS = [], LAMPS = [], EXITS = [], SHOPS = [], FLEE_PTS = [];
export const PITCH = { x:0, y:0, w:0, h:0 }, GOAL = { cx:0, n:0, s:0, half:1 }, BALL_HOME = { x:0, y:0 };
export const PRISON = { x:17, y:29, w:6, h:6 };
export const PC = { x: 20, y: 32 };
export const GATES = [
  { x: 20, y: 28.2, ox: 0, oy: -1, name: 'NORTH GATE' },
  { x: 20, y: 35.8, ox: 0, oy: 1, name: 'SOUTH GATE' },
];
export const SPAWN_P = [[15,27],[15,37],[25,27],[25,37]];
const EXIT_RECTS = [ {x:35.4, y:0.6, w:4, h:4}, {x:0.6, y:59.4, w:4, h:4}, {x:0.6, y:0.6, w:3.4, h:4}, {x:35.4, y:59.4, w:4, h:4} ];

export const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
export const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
function circRect(x,y,r,o){
  const cx = clamp(x,o.x,o.x+o.w), cy = clamp(y,o.y,o.y+o.h);
  const dx = x-cx, dy = y-cy; return dx*dx+dy*dy < r*r;
}
export function solidAt(x,y,r){
  if (x < r || y < r || x > W-r || y > H-r) return true;
  for (const o of SOLIDS) if (circRect(x,y,r,o)) return true;
  return false;
}
export function clearPath(ax,ay,bx,by,r=0.44){
  const d = Math.hypot(bx-ax,by-ay), n = Math.max(1, Math.ceil(d/0.3));
  for (let i=1;i<=n;i++){ const t=i/n; if (solidAt(ax+(bx-ax)*t, ay+(by-ay)*t, r)) return false; }
  return true;
}
export function sightClear(ax,ay,bx,by){
  const d = Math.hypot(bx-ax,by-ay), n = Math.ceil(d/0.4);
  for (let i=1;i<n;i++){
    const t=i/n, x=ax+(bx-ax)*t, y=ay+(by-ay)*t;
    for (const o of SIGHT) if (x>o.x && x<o.x+o.w && y>o.y && y<o.y+o.h) return false;
  }
  return true;
}
export function collide(e){
  for (let it=0; it<2; it++) for (const o of SOLIDS){
    const cx = clamp(e.x,o.x,o.x+o.w), cy = clamp(e.y,o.y,o.y+o.h);
    const dx = e.x-cx, dy = e.y-cy, d2 = dx*dx+dy*dy;
    if (d2 >= R*R) continue;
    if (d2 > 1e-9){ const d=Math.sqrt(d2); e.x = cx+dx/d*R; e.y = cy+dy/d*R; }
    else {
      const l=e.x-o.x, r=o.x+o.w-e.x, t=e.y-o.y, b=o.y+o.h-e.y, m=Math.min(l,r,t,b);
      if (m===l) e.x=o.x-R; else if (m===r) e.x=o.x+o.w+R; else if (m===t) e.y=o.y-R; else e.y=o.y+o.h+R;
    }
  }
  e.x = clamp(e.x,R,W-R); e.y = clamp(e.y,R,H-R);
}
export const inHide = (x,y) => HIDES.some(h => Math.hypot(x-h.x,y-h.y) < h.r);
export const inExit = e => EXITS.findIndex(x => e.x>x.x && e.x<x.x+x.w && e.y>x.y && e.y<x.y+x.h);
export const gateNear = e => GATES.findIndex(g => Math.hypot(e.x-g.x,e.y-g.y) < CFG.rescueRange);

// ---- navigation grid + A* ----
export const BLK = new Uint8Array(W*H);
export const cellOf = (x,y) => clamp(Math.floor(x),0,W-1) + clamp(Math.floor(y),0,H-1)*W;
export function nearFree(i){
  if (!BLK[i]) return i;
  const cx=i%W, cy=(i/W)|0;
  for (let r=1;r<6;r++) for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++){
    const nx=cx+dx, ny=cy+dy; if (nx<0||ny<0||nx>=W||ny>=H) continue;
    if (!BLK[nx+ny*W]) return nx+ny*W;
  }
  return -1;
}
export function freePt(x,y){ const i=cellOf(x,y); if (!BLK[i]) return [x,y]; const j=nearFree(i); return j<0?[x,y]:[j%W+.5,((j/W)|0)+.5]; }
const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
const N=W*H, gA=new Float32Array(N), fromA=new Int32Array(N), closedA=new Uint8Array(N);
export function astar(sx,sy,tx,ty){
  const s = nearFree(cellOf(sx,sy)), t = nearFree(cellOf(tx,ty));
  if (s<0 || t<0) return null;
  gA.fill(1e9); fromA.fill(-1); closedA.fill(0);
  const hi=[], hf=[], tcx=t%W, tcy=(t/W)|0;
  const hh = i => { const dx=Math.abs(i%W-tcx), dy=Math.abs(((i/W)|0)-tcy); return dx+dy-0.586*Math.min(dx,dy); };
  const push=(i,f)=>{ hi.push(i); hf.push(f); let k=hi.length-1; while(k>0){ const p=(k-1)>>1; if (hf[p]<=hf[k]) break; [hi[p],hi[k]]=[hi[k],hi[p]]; [hf[p],hf[k]]=[hf[k],hf[p]]; k=p; } };
  const pop=()=>{ const top=hi[0], li=hi.pop(), lf=hf.pop(); if (hi.length){ hi[0]=li; hf[0]=lf; let k=0; for(;;){ const l=2*k+1, r=l+1; let m=k; if (l<hi.length && hf[l]<hf[m]) m=l; if (r<hi.length && hf[r]<hf[m]) m=r; if (m===k) break; [hi[m],hi[k]]=[hi[k],hi[m]]; [hf[m],hf[k]]=[hf[k],hf[m]]; k=m; } } return top; };
  gA[s]=0; push(s,hh(s));
  while (hi.length){
    const cur=pop(); if (cur===t) break; if (closedA[cur]) continue; closedA[cur]=1;
    const cx=cur%W, cy=(cur/W)|0;
    for (const [dx,dy,c] of NB){
      const nx=cx+dx, ny=cy+dy; if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni=nx+ny*W; if (BLK[ni]||closedA[ni]) continue;
      if (dx && dy && (BLK[cx+dx+cy*W] || BLK[cx+(cy+dy)*W])) continue;
      const ng=gA[cur]+c; if (ng<gA[ni]){ gA[ni]=ng; fromA[ni]=cur; push(ni, ng+hh(ni)); }
    }
  }
  if (t!==s && fromA[t]<0) return null;
  const path=[]; for (let i=t; i!==s && i>=0; i=fromA[i]) path.push({x:i%W+.5, y:((i/W)|0)+.5});
  path.reverse();
  if (path.length && !solidAt(tx,ty,0.44)) path[path.length-1] = {x:tx, y:ty};
  if (!path.length) path.push({x:tx,y:ty});
  return path;
}
// ---- switch location ---------------------------------------------------------
const fill = (arr, src) => { arr.length = 0; for (const v of src) arr.push(v); };
export function setMap(id){
  const m = MAPS[id] || MAPS.street; if (!MAPS[id]) id = 'street';
  if (MAP.id === id) return;
  for (const k of Object.keys(MAP)) delete MAP[k];
  Object.assign(MAP, { id, name:m.name, icon:m.icon, ground:m.ground, show:m.show, herd:m.herd||null, bell:m.bell||null, gaps:m.gaps||null, noteMax:m.noteMax||0, ball:!!m.pitch });
  fill(OB, m.ob.concat(m.props || []).map(a => ({ x:a[0], y:a[1], w:a[2], h:a[3], k:a[4], label:a[5], col:a[6] })));
  OB.push(...vehicleGapFillers(OB));
  fill(SOLIDS, OB.concat([{ ...PRISON, k:'prison' }]));
  fill(SIGHT, OB.filter(o => o.k === 'bld' || o.k === 'tank' || o.k === 'bus'));
  fill(HIDES, m.hides.map(([x,y,r,k]) => ({ x, y, r, k })));
  fill(ROADS, m.roads); fill(LAMPS, m.lamps);
  fill(EXITS, EXIT_RECTS.map((e,i) => ({ ...e, name:m.exits[i], cx:e.x+e.w/2, cy:e.y+e.h/2 })));
  Object.assign(PITCH, m.pitch || { x:0, y:0, w:0, h:0 });
  Object.assign(GOAL, { cx: PITCH.x+PITCH.w/2, n: PITCH.y+.6, s: PITCH.y+PITCH.h-.6, half: 1 });
  Object.assign(BALL_HOME, { x: PITCH.x+PITCH.w/2, y: PITCH.y+PITCH.h/2 });
  for (let cy=0; cy<H; cy++) for (let cx=0; cx<W; cx++) BLK[cx+cy*W] = solidAt(cx+.5, cy+.5, 0.45) ? 1 : 0;
  FLEE_PTS.length = 0;
  for (let y=2; y<H; y+=4) for (let x=2; x<W; x+=4){ if (!BLK[cellOf(x,y)]) FLEE_PTS.push([x,y]); }
  fill(SPAWN_T, m.spawnT.map(([x,y]) => freePt(x,y)));
  fill(SHOPS, m.shops.map(([b,item,price,fx,icon,goods]) => {
    const o = OB.find(o => o.label===b); const [x,y] = freePt(o.x+o.w/2, o.y+o.h+1.35);
    return { b, item, price, fx, icon, goods, x, y, o };
  }));
}
// A gap beside a parked danfo or keke that is too narrow to look open (but wide enough to
// squeeze a body through) gets a pile of tyres and jerrycans, so vehicles really block the way.
// Works for any location, including ones you add yourself. GAP_FILL is the widest gap it closes.
const GAP_FILL = 1.8;
function vehicleGapFillers(obs){
  const out = [], others = obs.concat([{ ...PRISON }]);
  const add = (x, y, w, h) => { if (w > .05 && h > .05) out.push({ x, y, w, h, k:'clutter', label:'', col:'' }); };
  for (const v of obs){
    if (v.k !== 'bus' && v.k !== 'keke' && v.k !== 'car') continue;
    for (const o of others){
      if (o === v || (o.k === 'bus' || o.k === 'keke' || o.k === 'car') && obs.indexOf(o) < obs.indexOf(v)) continue;   // each vehicle pair once
      const y0 = Math.max(v.y, o.y), y1 = Math.min(v.y+v.h, o.y+o.h), x0 = Math.max(v.x, o.x), x1 = Math.min(v.x+v.w, o.x+o.w);
      if (y1 - y0 > .3){                                   // side by side
        if (o.x >= v.x+v.w && o.x - (v.x+v.w) < GAP_FILL) add(v.x+v.w, y0, o.x-(v.x+v.w), y1-y0);
        else if (v.x >= o.x+o.w && v.x - (o.x+o.w) < GAP_FILL) add(o.x+o.w, y0, v.x-(o.x+o.w), y1-y0);
      } else if (x1 - x0 > .3){                            // one behind the other
        if (o.y >= v.y+v.h && o.y - (v.y+v.h) < GAP_FILL) add(x0, v.y+v.h, x1-x0, o.y-(v.y+v.h));
        else if (v.y >= o.y+o.h && v.y - (o.y+o.h) < GAP_FILL) add(x0, o.y+o.h, x1-x0, v.y-(o.y+o.h));
      }
    }
    if (v.x < GAP_FILL) add(0, v.y, v.x, v.h);
    if (W - (v.x+v.w) < GAP_FILL) add(v.x+v.w, v.y, W-(v.x+v.w), v.h);
    if (v.y < GAP_FILL) add(v.x, 0, v.w, v.y);
    if (H - (v.y+v.h) < GAP_FILL) add(v.x, v.y+v.h, v.w, H-(v.y+v.h));
  }
  return out;
}
export const shopNear = e => SHOPS.findIndex(s => Math.hypot(e.x-s.x, e.y-s.y) < CFG.shopRange);

// ---- the herdsman and his cattle: they walk a fixed line and everybody has to go round
export function herdLen(){ const h = MAP.herd; return h ? Math.hypot(h.x1-h.x0, h.y1-h.y0) + 8 : 0; }
export function herdAt(p){
  const h = MAP.herd; if (!h || p < 0) return null;
  const L = Math.hypot(h.x1-h.x0, h.y1-h.y0), ux = (h.x1-h.x0)/L, uy = (h.y1-h.y0)/L;
  const at = (d, off) => ({ x: h.x0+ux*d-uy*off, y: h.y0+uy*d+ux*off, ux, uy });
  const out = [{ ...at(p, 0), man:true }];
  for (let k=0;k<6;k++) out.push(at(p-1.9-Math.floor(k/2)*1.75, k%2 ? .68 : -.68));
  return out;
}
export function pushFromHerd(e, p){
  const hs = herdAt(p); if (!hs) return false;
  let hit = false;
  for (const c of hs){
    const r = (c.man ? .4 : .66) + R*.8, dx = e.x-c.x, dy = e.y-c.y, d = Math.hypot(dx,dy);
    if (d < r && d > 1e-4){ e.x = c.x+dx/d*r; e.y = c.y+dy/d*r; hit = true; }
  }
  if (hit) collide(e);
  return hit;
}
setMap('street');
