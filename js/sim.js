// =============================================================
// SIM: the rules of Prison Break, plus the bots.
// Runs from inputs only and reports what happened as events, so the
// same code runs single player, or on the host in an online match.
// =============================================================
import { CFG, W, H, R, PRISON, PC, GATES, EXITS, HIDES, SPAWN_P, SPAWN_T, FLEE_PTS,
  clamp, dist, solidAt, clearPath, sightClear, collide, inHide, inExit, gateNear, freePt, astar,
  GOAL, BALL_HOME, SHOPS, shopNear, MAP, MAPS, setMap, herdLen, pushFromHerd } from './world.js';

export let G = null;
// the server runs many matches: point the rules at one match before stepping it
export function useMatch(g){ G = g; if (g && g.map && g.map !== MAP.id) setMap(g.map); }
export const LINES = {
  caught: ['Dem don catch me o!','Ah! Leave me!','Wahala!','I no do anything!'],
  copCatch: ['Oya, station!','You don enter!','Gotcha!'],
  rescue: ['Hold on, I dey come!','I go free una!'],
  freed: ['Free at last! Scatter!','Run run run!'],
  exits: ['Exits don open! Make we go!'],
  alarm: ['Rescue for gate! Move!'],
  escape: ['I don comot!','Bye bye police!'],
};
export const CHAT = { P:['Guard the Post!','I see one!','Chase am!'], T:['Help me!','I dey go free them!','Police dey come!'] };

const P_POOL = ['Sgt. Tunde','Cpl. Amaka','Insp. Musa','Cpl. Efe','Sgt. Ngozi','Insp. Bayo','Cpl. Danjuma','Sgt. Ifeoma'];
const T_POOL = ['Chidi','Bisola','Kunle','Zainab','Emeka','Halima','Tobi','Uche','Sade','Femi','Kemi','Obinna'];
const shuffle = a => { a=a.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };

function mkEnt(id,team,name,sp){
  return {id,team,name,ctrl:'bot',peer:null,look:null,x:sp[0],y:sp[1],vx:0,vy:0,rvx:0,rvy:0,fx:0,fy:-1,
    stam:100,stDelay:0,tired:false,state:'free',freeze:0,arrestT:0,arrestBy:-1,immune:0,capCd:0,windup:0,wTarget:-1,
    camp:0,reassigned:0,rescueProg:0,rescueGate:-1,escProg:0,hidden:false,sprinting:false,seen:false,
    abCd:2,dashT:0,slowT:0,boostT:0,fullT:0,buyCd:0,wallet:0,speed:0,mul:1,
    stats:{caps:0,rescues:0,escaped:0,caught:0,dodges:0,abil:0,goals:0,cash:0,buys:0},
    ai:{think:Math.random()*.2,mode:'lurk',prevMode:'',path:null,pathI:0,pathAge:9,pathT:null,lurk:null,lurkWait:0,
        escapeAt:CFG.exitsOpenAt+Math.random()*8,fdx:0,fdy:-1,fleeT:null,fleeTimer:0,role:'search',target:-1,
        orbitA:Math.random()*6.28,search:null,searchT:0,stuckT:0,lx:sp[0],ly:sp[1],jitter:0,jx:0,jy:0,gate:-1,exit:-1,
        dodge:false,jail:null,chatCd:0}};
}

// slots: [{team, ctrl:'local'|'remote', name, look, peer}]
export function newMatch(opts={}){
  setMap(MAPS[opts.map] ? opts.map : 'street');
  const night = opts.night ?? (Math.random() < .3);
  G = {t:0, playT:0, phase:'count', countT:CFG.headStart, ents:[], alarm:null, escaped:0, over:null,
       lastSeen:{}, exitsOpen:false, planT:0, sightT:0, rescuerId:-1, events:[], evId:0,
       night, sight: night?CFG.sightNight:CFG.sightDay, reveal: night?CFG.revealNight:CFG.revealDay,
       lastCount:CFG.headStart+1, inputs:{}, pickups:[], pickT:6, pickId:0, notes:[], noteT:0, noteId:0,
       ball:{x:BALL_HOME.x, y:BALL_HOME.y, vx:0, vy:0, last:-1, lastT:-9}, diff: opts.diff ?? 1, oppTeam:null,
       map: MAP.id, herd:{ p:-1, t:14 }, bellCd:0, shown:{ P:0, T:0 }};
  const pn = shuffle(P_POOL), tn = shuffle(T_POOL);
  for (let i=0;i<4;i++) G.ents.push(mkEnt(i,'P',pn[i],SPAWN_P[i]));
  for (let i=0;i<4;i++) G.ents.push(mkEnt(4+i,'T',tn[i],SPAWN_T[i]));
  const used = new Set();
  for (const s of (opts.slots||[])){
    let team = s.team==='R' ? (Math.random()<.5?'P':'T') : s.team;
    let e = G.ents.find(x => x.team===team && !used.has(x.id));
    if (!e){ team = team==='P'?'T':'P'; e = G.ents.find(x => x.team===team && !used.has(x.id)); }
    if (!e) continue;
    used.add(e.id); e.ctrl=s.ctrl; e.name=s.name||'You'; e.look=s.look||null; e.peer=s.peer||null;
  }
  for (let i=0;i<(MAP.noteMax||CFG.noteMax)-4;i++) spawnNote();
  // in single player the bots on the other side get the difficulty settings
  const humans = G.ents.filter(e => e.ctrl!=='bot');
  if (humans.length===1){ G.oppTeam = humans[0].team==='P' ? 'T' : 'P'; }
  const D = CFG.diff[G.diff] || CFG.diff[1];
  for (const e of G.ents) if (e.ctrl==='bot' && e.team===G.oppTeam) e.mul = D.spd;
  if (G.oppTeam==='P') G.sight *= D.sight;
  return G;
}

export const byId = id => G.ents[id];
export const thieves = () => G.ents.filter(e => e.team==='T');
export const countJailed = () => G.ents.filter(e => e.team==='T' && e.state==='jailed').length;
export function nearestCapturable(cop, range){
  let best=null, bd=range;
  for (const t of G.ents){
    if (t.team!=='T' || t.state!=='free' || t.immune>0) continue;
    const d = dist(cop,t); if (d<=bd){ bd=d; best=t; }
  }
  return best;
}
function ev(type, a=-1, b=-1, c=null){ G.events.push({id:++G.evId, type, a, b, c, t:G.t}); if (G.events.length>40) G.events.shift(); }
function say(e, cat){ if (e.ctrl!=='bot') return; const L=LINES[cat]; ev('say', e.id, cat, Math.random()*L.length|0); }

// input getter: (entity) => {mx,my,sprint,action,press,ability}
export function step(dt, getInput){
  if (G.over){ return; }
  G.t += dt;
  if (G.phase==='count'){
    G.countT -= dt;
    const c = Math.ceil(G.countT);
    if (c < G.lastCount && c > 0){ G.lastCount = c; ev('tick', c); }
    if (G.countT <= 0){ G.phase='play'; ev('go'); }
  } else G.playT += dt;

  if (!G.exitsOpen && G.playT >= CFG.exitsOpenAt){
    G.exitsOpen = true; ev('exits');
    const t = thieves().find(e => e.state==='free' && e.ctrl==='bot'); if (t) say(t,'exits');
  }
  G.sightT -= dt; if (G.sightT <= 0){ G.sightT = 0.1; updateSight(); }
  if (G.phase==='play') updatePickups(dt);
  G.planT -= dt;  if (G.planT <= 0){ G.planT = 0.3; planPolice(); planThieves(); }

  const hadAlarm = !!G.alarm;
  for (const e of G.ents){
    const inp = e.ctrl==='bot' ? botInput(e,dt) : (getInput(e) || {mx:0,my:0});
    if (e.ctrl==='remote' && inp.pos && e.state==='free') applyRemote(e,inp,dt);
    else applyEnt(e,inp,dt);
  }
  const fr = G.ents.filter(e => e.state==='free');
  for (let i=0;i<fr.length;i++) for (let j=i+1;j<fr.length;j++){
    const a=fr[i], b=fr[j], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
    if (d>0 && d<2*R){ const p=(2*R-d)/2;
      if (a.ctrl!=='remote'){ a.x-=dx/d*p; a.y-=dy/d*p; collide(a); }
      if (b.ctrl!=='remote'){ b.x+=dx/d*p; b.y+=dy/d*p; collide(b); } }
  }
  updateNotes(dt); updateBall(dt); updatePlace(dt);
  if (G.alarm && !G.ents.some(e => e.rescueProg>0)) G.alarm = null;
  if (G.alarm && !hadAlarm){
    ev('alarm', G.alarm.by, G.alarm.gate); G.planT = 0;
    const cop = G.ents.find(c => c.team==='P' && c.ctrl==='bot' && c.state==='free');
    if (cop && cop.ai.chatCd<=0){ say(cop,'alarm'); cop.ai.chatCd=6; }
  }
  checkWin();
}

// ---- street snacks: Agege bread refills stamina, zobo gives a short speed boost
export const PICKUP_KINDS = ['bread','zobo'];
function updatePickups(dt){
  G.pickT -= dt;
  if (G.pickT<=0 && G.pickups.length < CFG.pickupMax){
    G.pickT = CFG.pickupEvery;
    for (let tries=0; tries<20; tries++){
      const p = FLEE_PTS[Math.random()*FLEE_PTS.length|0];
      if (Math.hypot(p[0]-PC.x,p[1]-PC.y) < CFG.campRadius+2) continue;
      if (G.pickups.some(q => Math.hypot(q.x-p[0],q.y-p[1])<6)) continue;
      G.pickups.push({ id:++G.pickId, k: PICKUP_KINDS[Math.random()<.55?0:1], x:p[0], y:p[1] }); break;
    }
  }
  for (const p of G.pickups.slice()){
    const e = G.ents.find(e => e.state==='free' && Math.hypot(e.x-p.x,e.y-p.y) < .95);
    if (!e) continue;
    G.pickups.splice(G.pickups.indexOf(p),1);
    if (p.k==='bread'){ e.stam=100; e.tired=false; } else e.boostT = CFG.zoboTime;
    ev('pickup', e.id, PICKUP_KINDS.indexOf(p.k));
  }
}
// ---- ₦ notes on the street, spent at the shops
function spawnNote(){
  for (let k=0;k<20;k++){
    const p = FLEE_PTS[Math.random()*FLEE_PTS.length|0], x = p[0]+(Math.random()-.5)*3, y = p[1]+(Math.random()-.5)*3;
    if (solidAt(x,y,.6) || Math.hypot(x-PC.x,y-PC.y) < CFG.campRadius) continue;
    G.notes.push({ id:++G.noteId, x, y }); return;
  }
}
function updateNotes(dt){
  G.noteT -= dt;
  if (G.noteT<=0){ G.noteT = CFG.noteEvery; if (G.notes.length < (MAP.noteMax||CFG.noteMax)) spawnNote(); }
  for (let i=G.notes.length-1;i>=0;i--){
    const n = G.notes[i];
    const e = G.ents.find(e => e.state==='free' && Math.hypot(e.x-n.x,e.y-n.y) < .9);
    if (!e) continue;
    G.notes.splice(i,1); e.wallet += CFG.noteValue; ev('note', e.id);
  }
  // bots buy when they happen to pass a counter with money in hand
  for (const e of G.ents) if (e.ctrl==='bot' && e.state==='free' && e.wallet>=10 && Math.random()<.02) tryBuy(e);
}
// ---- things that belong to one location: the cattle, the school bell, the hole in the fence
function updatePlace(dt){
  if (MAP.herd){
    const h = G.herd;
    if (h.p < 0){ if (G.phase==='play'){ h.t -= dt; if (h.t <= 0){ h.p = 0; ev('herd'); } } }
    else {
      h.p += CFG.herdSpeed*dt;
      if (h.p > herdLen()){ h.p = -1; h.t = CFG.herdEvery; }
      else for (const e of G.ents) if (e.state==='free') pushFromHerd(e, h.p);
    }
  }
  G.bellCd = Math.max(0, G.bellCd-dt); G.shown.P = Math.max(0, G.shown.P-dt); G.shown.T = Math.max(0, G.shown.T-dt);
  if (MAP.bell && G.bellCd<=0) for (const e of G.ents) if (e.ctrl==='bot' && e.team==='P' && e.state==='free' && Math.random()<.05) tryUse(e);
  if (MAP.gaps) for (const e of G.ents){
    e.gapCd = Math.max(0, (e.gapCd||0)-dt); e.tpHold = Math.max(0, (e.tpHold||0)-dt);
    if (e.state!=='free' || e.gapCd>0) continue;
    for (let k=0;k<2;k++){
      const a = MAP.gaps[k], b = MAP.gaps[1-k];
      if (Math.hypot(e.x-a[0], e.y-a[1]) < .95){
        e.x = b[0]+b[2]*1.4; e.y = b[1]; e.vx = e.vy = 0; e.gapCd = 3; e.tpHold = .7; e.fx = b[2]; e.fy = 0;
        e.ai.path = null; e.ai.fleeT = null; ev('gap', e.id, 1-k); break;
      }
    }
  }
}
// the school bell: whoever rings it sees the whole other team on the map for a few seconds
export function tryUse(e){
  const b = MAP.bell;
  if (!b || e.state!=='free' || G.phase!=='play' || Math.hypot(e.x-b.x, e.y-b.y) > 1.7) return false;
  if (G.bellCd > 0){ ev('bellwait', e.id); return true; }
  G.bellCd = CFG.bellCd; G.shown[e.team] = CFG.bellReveal; ev('bell', e.id);
  if (e.team==='P') for (const t of G.ents) if (t.team==='T' && t.state==='free') G.lastSeen[t.id] = { x:t.x, y:t.y, t:G.t };
  return true;
}
export function tryBuy(e){
  if (e.buyCd>0 || e.state!=='free' || G.phase!=='play') return false;
  const si = shopNear(e); if (si<0) return false;
  const s = SHOPS[si];
  if (e.wallet < s.price){ e.buyCd=.6; ev('broke', e.id, si); return true; }
  e.wallet -= s.price; e.buyCd = 1; e.stats.buys++;
  if (s.fx==='full'){ e.stam=100; e.tired=false; e.fullT=CFG.fullTime; }
  else if (s.fx==='water'){ e.stam=Math.min(100,e.stam+60); e.tired=false; }
  else if (s.fx==='boost') e.boostT=CFG.suyaTime;
  else if (s.fx==='ready') e.abCd=0;
  ev('buy', e.id, si);
  return true;
}
// ---- the football: run into it to kick it, put it between the posts to score
function updateBall(dt){
  if (!MAP.ball) return;
  const b = G.ball;
  for (const e of G.ents){
    if (e.state!=='free') continue;
    const dx=b.x-e.x, dy=b.y-e.y, d=Math.hypot(dx,dy);
    if (d < R+.34 && d > 1e-4){
      const nx=dx/d, ny=dy/d, sp=Math.max(4.5, (e.speed||0)*1.55);
      b.vx = nx*sp + (e.rvx||0)*.25; b.vy = ny*sp + (e.rvy||0)*.25;
      b.x = e.x+nx*(R+.35); b.y = e.y+ny*(R+.35);
      if (G.t-b.lastT > .4) ev('kick', e.id);
      b.last = e.id; b.lastT = G.t;
    }
  }
  const py = b.y;
  b.x += b.vx*dt; b.y += b.vy*dt;
  if (Math.abs(b.x-GOAL.cx) < GOAL.half && ((py > GOAL.n && b.y <= GOAL.n) || (py < GOAL.s && b.y >= GOAL.s))){
    const sc = G.ents[b.last];
    if (sc){ sc.stats.goals++; sc.wallet += CFG.goalCash; }
    ev('goal', b.last, b.y <= GOAL.n ? 0 : 1);
    b.x=BALL_HOME.x; b.y=BALL_HOME.y; b.vx=b.vy=0; b.last=-1; return;
  }
  const ox=b.x, oy=b.y; collide(b);
  if (Math.abs(b.x-ox) > 1e-6) b.vx *= -.55;
  if (Math.abs(b.y-oy) > 1e-6) b.vy *= -.55;
  const f = Math.exp(-1.15*dt); b.vx*=f; b.vy*=f;
  if (Math.hypot(b.vx,b.vy) < .08){ b.vx=b.vy=0; }
}
function nearPickup(e, r){ let best=null, bd=r; for (const p of G.pickups){ const d=Math.hypot(p.x-e.x,p.y-e.y); if (d<bd){ bd=d; best=p; } } return best; }

function updateSight(){
  const cops = G.ents.filter(c => c.team==='P' && c.state==='free');
  for (const t of G.ents){
    if (t.team!=='T' || t.state!=='free'){ t.seen=false; continue; }
    let seen=false;
    for (const c of cops){
      const d = dist(c,t);
      if (d < G.reveal || (!t.hidden && d < G.sight && sightClear(c.x,c.y,t.x,t.y))){ seen=true; break; }
    }
    t.seen = seen;
    if (seen) G.lastSeen[t.id] = {x:t.x, y:t.y, t:G.t};
  }
}

// one place for the stamina rules, used here and by online guests' own prediction
export function staminaStep(team, stam, draining, wantSprint, s, dt){
  if (draining){ s.stDelay = CFG.regenDelay; return Math.max(0, stam - (team==='P'?CFG.drainP:CFG.drainT)*dt); }
  if (!wantSprint || stam <= 0) s.stDelay -= dt;
  return s.stDelay <= 0 ? Math.min(100, stam + (team==='P'?CFG.regenP:CFG.regenT)*dt) : stam;
}
function tickTimers(e,dt){
  e.capCd = Math.max(0,e.capCd-dt); e.immune = Math.max(0,e.immune-dt);
  e.reassigned = Math.max(0,e.reassigned-dt); e.freeze = Math.max(0,e.freeze-dt);
  e.abCd = Math.max(0,e.abCd-dt); e.slowT = Math.max(0,e.slowT-dt); e.dashT = Math.max(0,e.dashT-dt); e.boostT = Math.max(0,e.boostT-dt); e.fullT = Math.max(0,e.fullT-dt); e.buyCd = Math.max(0,e.buyCd-dt);
  e.ai.chatCd -= dt;
}

// online guest: the guest's own device moves them; the host checks the rules
function applyRemote(e,inp,dt){
  tickTimers(e,dt);
  const frozen = e.freeze>0 || (G.phase==='count' && e.team==='P');
  if (!frozen && !(e.tpHold>0)){
    const [px,py] = inp.pos, d = Math.hypot(px-e.x, py-e.y);
    const max = CFG.dashSpeed*Math.max(dt,1/60)*2.5 + .6;   // anti-teleport: nobody moves faster than a dash
    if (d < max){ e.x=px; e.y=py; } else { e.x += (px-e.x)/d*max; e.y += (py-e.y)/d*max; }
    collide(e);
    e.rvx = inp.vel ? inp.vel[0] : 0; e.rvy = inp.vel ? inp.vel[1] : 0;
    if (inp.face) { e.fx=inp.face[0]; e.fy=inp.face[1]; }
    e.sprinting = !!inp.sprint; e.speed=Math.hypot(e.rvx,e.rvy);
  }
  e.hidden = e.team==='T' && !e.sprinting && inHide(e.x,e.y);
  if (frozen && G.phase==='count') return;
  if (inp.ability) useAbility(e);
  if (e.team==='P') policeActions(e,inp,dt); else thiefActions(e,inp,dt);
}

function applyEnt(e,inp,dt){
  tickTimers(e,dt);
  if (e.state==='escaped') return;
  if (e.state==='arrest'){ e.arrestT -= dt; if (e.arrestT<=0) jail(e); return; }
  let mx=inp.mx||0, my=inp.my||0, mag=Math.hypot(mx,my);
  if (mag>1){ mx/=mag; my/=mag; mag=1; }
  if (e.state==='jailed'){
    e.x = clamp(e.x+mx*2*dt, PRISON.x+.6, PRISON.x+PRISON.w-.6);
    e.y = clamp(e.y+my*2*dt, PRISON.y+.6, PRISON.y+PRISON.h-.6);
    if (mag>.1){ e.fx=mx/mag; e.fy=my/mag; } e.speed = mag*2;
    e.stam = Math.min(100, e.stam+CFG.regenT*dt);
    return;
  }
  const frozen = e.freeze>0 || (G.phase==='count' && e.team==='P');
  if (frozen){ mx=my=0; mag=0; }
  if (!frozen && inp.ability) useAbility(e);
  let spd = (e.team==='P'?CFG.walkP:CFG.walkT)*mag; e.sprinting=false;
  if (e.stam<=1) e.tired=true; else if (e.stam>=30) e.tired=false;
  const wantSprint = inp.sprint && mag>.2 && e.stam>0 && !e.tired;
  if (wantSprint) spd = (e.team==='P'?CFG.sprintP:CFG.sprintT)*Math.max(mag,.85);
  if (e.reassigned>0) spd *= .55;
  if (e.windup>0) spd *= .5;
  if (e.slowT>0) spd *= .6;
  if (e.immune>0) spd *= 1.1;
  if (e.boostT>0) spd *= CFG.zoboBoost;
  spd *= e.mul;
  let tx = mx*spd, ty = my*spd;
  if (e.dashT>0){ const fl=Math.hypot(e.fx,e.fy)||1; tx=e.fx/fl*CFG.dashSpeed; ty=e.fy/fl*CFG.dashSpeed; }
  // speed up a touch gently, stop quickly: feels responsive without being twitchy
  const stopping = tx*tx+ty*ty < e.vx*e.vx+e.vy*e.vy;
  const k = 1-Math.exp(-dt*(stopping ? 20 : 14));
  e.vx += (tx-e.vx)*k; e.vy += (ty-e.vy)*k;
  if (e.dashT>0){ e.vx=tx; e.vy=ty; }
  const ox=e.x, oy=e.y;
  e.x += e.vx*dt; e.y += e.vy*dt; collide(e);
  if (dt>0){ e.rvx=(e.x-ox)/dt; e.rvy=(e.y-oy)/dt; }
  e.speed = Math.hypot(e.rvx,e.rvy);
  // stamina: only spent while actually running faster than a walk (not when pressed against a wall,
  // frozen or stuck), and it starts coming back shortly after you stop
  e.sprinting = wantSprint && e.speed > (e.team==='P'?CFG.walkP:CFG.walkT)*e.mul*.9;
  e.stam = staminaStep(e.team, e.stam, e.sprinting && !(e.fullT>0), wantSprint, e, dt);
  if (mag>.1 && e.dashT<=0){ e.fx=mx/mag; e.fy=my/mag; }
  e.hidden = e.team==='T' && !e.sprinting && e.dashT<=0 && inHide(e.x,e.y);
  if (frozen && G.phase==='count') return;
  if (e.team==='P') policeActions(e,inp,dt); else thiefActions(e,inp,dt);
}

export function useAbility(e){
  if (e.abCd>0 || e.state!=='free' || e.freeze>0 || G.phase!=='play') return;
  if (e.team==='T'){
    e.dashT = CFG.dashTime; e.abCd = CFG.dashCd; e.stats.abil++; ev('dash', e.id);
  } else {
    if (e.reassigned>0) return;
    e.abCd = CFG.whistleCd; e.stats.abil++;
    let n=0;
    for (const t of G.ents) if (t.team==='T' && t.state==='free' && dist(t,e)<CFG.whistleRange){ t.slowT=CFG.whistleSlow; t.hidden=false; G.lastSeen[t.id]={x:t.x,y:t.y,t:G.t}; n++; }
    ev('whistle', e.id, n);
  }
}

function policeActions(e,inp,dt){
  if (e.windup>0){
    e.windup -= dt; if (e.windup<=0) resolveCapture(e);
  } else if ((inp.press || CFG.autoCatch) && e.capCd<=0 && e.freeze<=0){
    // the grab starts by itself when a thief is in reach; the button is only for shops and the bell
    const t = nearestCapturable(e, CFG.captureRange);
    if (e.reassigned>0){ if (inp.press && t){ e.capCd=.3; ev('noarrest', e.id); } else if (inp.press && !tryUse(e)) tryBuy(e); }
    else {
      if (t){ e.windup=CFG.captureWindup; e.wTarget=t.id; t.ai.dodge = Math.random() < (t.team===G.oppTeam ? (CFG.diff[G.diff]||CFG.diff[1]).dodge : .6); ev('grab', e.id, t.id); }
      else if (inp.press && !tryUse(e) && !tryBuy(e) && !CFG.autoCatch){ e.capCd=.35; ev('whiff', e.id); }
    }
  }
  const dc = Math.hypot(e.x-PC.x, e.y-PC.y);
  if (dc<CFG.campRadius && !G.alarm && e.reassigned<=0 && G.phase==='play') e.camp += dt/CFG.campFill;
  else e.camp = Math.max(0, e.camp-dt/CFG.campDrain);
  if (e.camp>=1){ e.camp=0; e.reassigned=CFG.reassignTime; ev('reassign', e.id); }
}
function resolveCapture(e){
  const t = byId(e.wTarget); e.wTarget=-1;
  if (t && t.state==='free' && t.immune<=0 && dist(e,t)<=CFG.captureConfirm && e.reassigned<=0) arrest(e,t);
  else { e.capCd = CFG.captureCooldown; if (t){ t.stats.dodges++; ev('dodge', e.id, t.id); } }
}
function arrest(cop,t){
  t.state='arrest'; t.arrestT=CFG.arrestFreeze; t.arrestBy=cop.id; t.vx=t.vy=0; t.rescueProg=0; t.escProg=0; t.hidden=false;
  cop.freeze=CFG.escortTime; cop.capCd=CFG.escortTime+.4;
  cop.stats.caps++; t.stats.caught++;
  ev('catch', cop.id, t.id);
  say(t,'caught');
  if (cop.ctrl==='bot' && cop.ai.chatCd<=0){ say(cop,'copCatch'); cop.ai.chatCd=4; }
}
function jail(t){
  t.state='jailed';
  const cop = byId(t.arrestBy);
  if (cop && cop.state==='free'){
    const g = GATES[cop.y < PC.y ? 0 : 1];
    cop.x = g.x + (Math.random()-.5)*2; cop.y = g.y + g.oy*1.6; cop.vx=cop.vy=0; collide(cop);
    cop.ai.path=null; cop.camp=0;
    ev('escorted', cop.id);
  }
  t.x = PRISON.x+.9+Math.random()*(PRISON.w-1.8); t.y = PRISON.y+.9+Math.random()*(PRISON.h-1.8);
  t.vx=t.vy=0;
}
function thiefActions(e,inp,dt){
  if (inp.press && !tryUse(e)) tryBuy(e);
  const gi = gateNear(e), jailedN = countJailed();
  if (inp.action && gi>=0 && jailedN>0 && G.phase==='play'){
    if (e.rescueGate!==gi){ e.rescueProg=0; e.rescueGate=gi; }
    if (e.rescueProg===0 && e.ai.chatCd<=0){ say(e,'rescue'); e.ai.chatCd=5; }
    e.rescueProg += dt; G.alarm = G.alarm || {gate:gi, by:e.id};
    if (e.rescueProg >= CFG.rescueTime) doRescue(e,gi);
  } else { e.rescueProg=0; e.rescueGate=-1; }
  const ex = inExit(e);
  if (inp.action && G.exitsOpen && ex>=0){ e.escProg += dt; if (e.escProg>=CFG.escapeTime) doEscape(e,ex); }
  else e.escProg=0;
}
function doRescue(e,gi){
  const g = GATES[gi], freed = G.ents.filter(t => t.team==='T' && t.state==='jailed');
  freed.forEach((t,k) => {
    t.state='free'; t.immune=CFG.immuneTime;
    t.x = g.x+(k-(freed.length-1)/2)*.95; t.y = g.y+g.oy*1.0; collide(t);
  });
  e.stats.rescues += freed.length; e.rescueProg=0; G.alarm=null;
  ev('free', e.id, freed.length, gi);
  const t = freed.find(x => x.ctrl==='bot'); if (t) say(t,'freed');
}
function doEscape(e,ex){
  e.state='escaped'; e.stats.escaped=1; G.escaped++; e.hidden=false;
  ev('escape', e.id, ex); say(e,'escape');
}
function checkWin(){
  if (G.over || G.tutorial) return;
  if (G.escaped >= CFG.escapesToWin) return endMatch('T', 0);
  if (thieves().every(t => t.state==='jailed' || t.state==='escaped')) return endMatch('P', 1);
  if (G.playT >= CFG.matchTime) return endMatch('P', 2);
}
export const REASONS = ['Two thieves escaped the street','Every thief left on the street is in the Police Post',"Time up: the thieves didn't get out"];
function endMatch(win,reason){ for (const e of G.ents) e.stats.cash = e.wallet; G.over = {win, reason}; ev('over', win==='P'?0:1, reason); }

// ============================== BOTS =================================
function follow(e,tx,ty){
  const ai=e.ai, dx=tx-e.x, dy=ty-e.y, d=Math.hypot(dx,dy);
  if (d<.15) return [0,0];
  if (d<12 && clearPath(e.x,e.y,tx,ty)){ ai.path=null; return [dx/d,dy/d]; }
  if (!ai.path || ai.pathAge>.8 || !ai.pathT || Math.hypot(ai.pathT.x-tx,ai.pathT.y-ty)>1.5){
    ai.path = astar(e.x,e.y,tx,ty); ai.pathI=0; ai.pathAge=0; ai.pathT={x:tx,y:ty};
  }
  if (!ai.path) return [dx/d,dy/d];
  let n=0;
  while (ai.pathI < ai.path.length-1 && n++<4){
    const p=ai.path[ai.pathI], q=ai.path[ai.pathI+1];
    if (Math.hypot(e.x-p.x,e.y-p.y)<.5 || clearPath(e.x,e.y,q.x,q.y)) ai.pathI++; else break;
  }
  const p=ai.path[ai.pathI], px=p.x-e.x, py=p.y-e.y, pd=Math.hypot(px,py)||1;
  return [px/pd, py/pd];
}
function botInput(e,dt){
  const ai=e.ai, inp={mx:0,my:0,sprint:false,action:false,press:false,ability:false};
  ai.pathAge += dt;
  if (e.state==='jailed'){
    if (!ai.jail || Math.hypot(e.x-ai.jail[0],e.y-ai.jail[1])<.3) ai.jail=[PRISON.x+1+Math.random()*4, PRISON.y+1+Math.random()*4];
    const dx=ai.jail[0]-e.x, dy=ai.jail[1]-e.y, d=Math.hypot(dx,dy)||1; inp.mx=dx/d*.4; inp.my=dy/d*.4;
    return inp;
  }
  if (e.state!=='free' || e.freeze>0) return inp;
  if (e.team==='P'){ if (G.phase==='play') policeAI(e,inp,dt); } else thiefAI(e,inp,dt);
  ai.stuckT += dt;
  if (ai.stuckT>.7){
    const moved = Math.hypot(e.x-ai.lx, e.y-ai.ly);
    if (moved<.3 && Math.hypot(inp.mx,inp.my)>.5 && !inp.action){ ai.jitter=.3; const a=Math.random()*6.283; ai.jx=Math.cos(a); ai.jy=Math.sin(a); ai.pathAge=9; }
    ai.stuckT=0; ai.lx=e.x; ai.ly=e.y;
  }
  if (ai.jitter>0){ ai.jitter-=dt; inp.mx=ai.jx; inp.my=ai.jy; }
  return inp;
}
function planPolice(){
  const cops = G.ents.filter(e => e.team==='P' && e.state==='free' && e.ctrl==='bot');
  for (const c of cops){ c.ai.role = c.reassigned>0 ? 'retreat' : 'search'; c.ai.target=-1; }
  let pool = cops.filter(c => c.reassigned<=0);
  const known = thieves().filter(t => t.state==='free' && G.lastSeen[t.id] && G.t-G.lastSeen[t.id].t < 4);
  if (G.alarm){
    const g = GATES[G.alarm.gate];
    pool.sort((a,b) => dist(a,g)-dist(b,g));
    for (const c of pool.splice(0,2)) c.ai.role='defend';
  }
  const held = thieves().filter(t => t.state==='jailed' || t.state==='arrest').length;
  if (held>0 && pool.length>=2){ pool.sort((a,b) => dist(a,PC)-dist(b,PC)); pool.shift().ai.role='warden'; }
  const pairs=[];
  for (const c of pool) for (const t of known){ const ls=G.lastSeen[t.id]; pairs.push([Math.hypot(c.x-ls.x,c.y-ls.y),c,t]); }
  pairs.sort((a,b) => a[0]-b[0]);
  const cnt={}, used=new Set();
  for (const cap of [1,2]) for (const [d,c,t] of pairs){
    if (used.has(c.id) || (cnt[t.id]||0)>=cap || d>(cap===1?16:9)) continue;
    used.add(c.id); cnt[t.id]=(cnt[t.id]||0)+1; c.ai.role='chase'; c.ai.target=t.id;
  }
}
function pickSearch(e){
  const c=[];
  for (const h of HIDES) c.push([h.x,h.y,.6]);
  for (let i=0;i<8;i++){ const p=FLEE_PTS[Math.random()*FLEE_PTS.length|0]; c.push([p[0],p[1],1]); }
  if (G.exitsOpen) for (const x of EXITS) c.push([x.cx+(x.cx<W/2?3:-3),x.cy+(x.cy<H/2?3:-3),1.5]);
  for (const t of thieves()){ const ls=G.lastSeen[t.id]; if (t.state==='free' && ls && G.t-ls.t<25) c.push([ls.x,ls.y,4]); }
  let tot=0; for (const p of c){ p[2] /= (1+Math.hypot(p[0]-e.x,p[1]-e.y)/25); tot+=p[2]; }
  let r=Math.random()*tot;
  for (const p of c){ r-=p[2]; if (r<=0) return freePt(p[0],p[1]); }
  return freePt(c[0][0],c[0][1]);
}
function policeAI(e,inp,dt){
  const ai=e.ai; let tx=e.x, ty=e.y, sprint=false, stop=false;
  if (e.reassigned<=0 && e.capCd<=0 && e.windup<=0 && nearestCapturable(e, CFG.captureRange*.92)) inp.press=true;
  if (e.camp>.55 && !G.alarm && ai.role!=='chase') ai.role='retreat';
  const role=ai.role;
  if (role==='retreat'){
    const a=Math.atan2(e.y-PC.y,e.x-PC.x); [tx,ty]=freePt(PC.x+Math.cos(a)*(CFG.campRadius+2.5), PC.y+Math.sin(a)*(CFG.campRadius+2.5));
  } else if (role==='defend' && G.alarm){
    const r=byId(G.alarm.by);
    if (r && r.state==='free'){ tx=r.x; ty=r.y; if (dist(e,r)<5 && e.abCd<=0) inp.ability=true; }
    else { tx=GATES[G.alarm.gate].x; ty=GATES[G.alarm.gate].y; }
    sprint = e.stam>5;
  } else if (role==='warden'){
    let thr=null, bd=8.5;
    for (const t of thieves()) if (t.state==='free' && t.seen && dist(t,PC)<bd && dist(t,e)<6){ bd=dist(t,PC); thr=t; }
    if (thr){ tx=thr.x; ty=thr.y; sprint = dist(e,thr)<5 && e.stam>20; }
    else {
      let ang=null, kd=99;
      for (const t of thieves()){ const ls=G.lastSeen[t.id]; if (t.state==='free' && ls && G.t-ls.t<4){ const d=Math.hypot(ls.x-PC.x,ls.y-PC.y); if (d<kd){ kd=d; ang=Math.atan2(ls.y-PC.y,ls.x-PC.x); } } }
      if (ang===null){ ai.orbitA += dt*.35; ang=ai.orbitA; }
      [tx,ty]=freePt(PC.x+Math.cos(ang)*(CFG.campRadius+1.2), PC.y+Math.sin(ang)*(CFG.campRadius+1.2));
      if (Math.hypot(tx-e.x,ty-e.y)<.5) stop=true;
    }
  } else if (role==='chase'){
    const t=byId(ai.target), ls=G.lastSeen[ai.target];
    if (t && ls && t.state==='free'){
      const fresh = G.t-ls.t < .25, d=Math.hypot(e.x-ls.x,e.y-ls.y), lead=Math.min(d/9,.5);
      tx = fresh ? t.x+t.rvx*lead : ls.x; ty = fresh ? t.y+t.rvy*lead : ls.y;
      sprint = e.stam>12 && (d<5.5 || (t.sprinting && d<8));
      if (fresh && d<4.5 && t.sprinting && e.abCd<=0) inp.ability=true;
      if (!fresh && d<.8) ai.role='search';
    }
  }
  if (ai.role==='search' || (role==='defend' && !G.alarm)){
    const pk = (e.stam<70 || Math.random()<.5) ? nearPickup(e, 7) : null;
    if (pk){ const d=follow(e,pk.x,pk.y); inp.mx=d[0]; inp.my=d[1]; inp.sprint=false; return; }
    ai.searchT -= dt;
    if (!ai.search || ai.searchT<=0 || Math.hypot(e.x-ai.search[0],e.y-ai.search[1])<1){ ai.search=pickSearch(e); ai.searchT=5+Math.random()*3; }
    [tx,ty]=ai.search;
  }
  if (!stop){ const d=follow(e,tx,ty); inp.mx=d[0]; inp.my=d[1]; }
  inp.sprint=sprint;
}
function planThieves(){
  const jailedN=countJailed(); const prev=G.rescuerId; G.rescuerId=-1;
  if (!jailedN) return;
  let best=null, bd=1e9;
  for (const t of thieves()){
    if (t.state!=='free' || t.ctrl!=='bot') continue;
    const d = dist(t,PC) - (t.id===prev?4:0);
    if (d<bd){ bd=d; best=t; }
  }
  if (best) G.rescuerId=best.id;
}
function fleeDir(e,cops){
  let best=null, bs=-1e9;
  for (let k=0;k<16;k++){
    const a=k/16*Math.PI*2, dx=Math.cos(a), dy=Math.sin(a);
    let c=0; for (let s=.5; s<=4; s+=.5){ if (solidAt(e.x+dx*s,e.y+dy*s,.45)) break; c=s; }
    if (c<.5) continue;
    let c2=0; if (c>=4) for (let s=4.5; s<=9; s+=.5){ if (solidAt(e.x+dx*s,e.y+dy*s,.45)) break; c2=s-4; }
    const px=e.x+dx*c, py=e.y+dy*c;
    let sc = c*.6 + c2*.5;
    const edge = Math.min(px, py, W-px, H-py); sc -= Math.max(0, 3-edge)*1.0;
    for (const o of cops){
      const d=Math.hypot(px-o.c.x,py-o.c.y), w=o.w*8/(o.dd+2);
      sc += Math.min(d,10)*w;
      const tx=o.c.x-e.x, ty=o.c.y-e.y, td=Math.hypot(tx,ty)||1;
      sc -= Math.max(0,(dx*tx+dy*ty)/td)*4*w;
    }
    sc += (dx*e.ai.fdx+dy*e.ai.fdy)*1.2;
    if (inHide(px,py)) sc += 1.2;
    if (Math.hypot(px-PC.x,py-PC.y) < CFG.campRadius) sc -= 2;
    if (sc>bs){ bs=sc; best=[dx,dy]; }
  }
  return best || [0,0];
}
function fleePlan(e,cops){
  let best=null, bs=-1e9;
  const pts = G.exitsOpen ? FLEE_PTS.concat(EXITS.map(x=>[x.cx,x.cy,1])) : FLEE_PTS;
  for (const [px,py,isExit] of pts){
    const de=Math.hypot(px-e.x,py-e.y); if (de<5 || de>26) continue;
    let md=99, block=0;
    const ux=(px-e.x)/de, uy=(py-e.y)/de;
    for (const o of cops){
      if (o.w<.5) continue;
      md=Math.min(md, Math.hypot(px-o.c.x,py-o.c.y));
      const tx=o.c.x-e.x, ty=o.c.y-e.y, td=Math.hypot(tx,ty)||1;
      const dot=(ux*tx+uy*ty)/td; if (dot>.35) block += dot*(10/(td+1));
      const proj=clamp(ux*tx+uy*ty,0,de), sx=e.x+ux*proj-o.c.x, sy=e.y+uy*proj-o.c.y;
      const seg=Math.hypot(sx,sy); if (seg<3.5) block += (3.5-seg)*1.5;
    }
    const edge=Math.min(px,py,W-px,H-py);
    let sc = (md-de)*1.2 + Math.min(de,14)*.3 - block*3 - Math.max(0,4-edge)*1.5 + Math.random()*1.5;
    if (inHide(px,py)) sc += 1;
    if (isExit) sc += 7 + Math.max(0,4-edge)*1.5;
    if (Math.hypot(px-PC.x,py-PC.y) < CFG.campRadius+1) sc -= 4;
    if (sc>bs){ bs=sc; best=[px,py]; }
  }
  e.ai.fleeT = best; e.ai.fleeTimer = 1.1+Math.random()*.4;
}
function pickLurk(e){
  let best=null, bs=-1e9;
  for (const h of HIDES){
    let md=99; for (const c of G.ents) if (c.team==='P' && c.state==='free') md=Math.min(md,Math.hypot(c.x-h.x,c.y-h.y));
    const sc = Math.min(md,14) + Math.random()*6 - Math.hypot(e.x-h.x,e.y-h.y)*.12;
    if (sc>bs){ bs=sc; best=h; }
  }
  e.ai.lurk = freePt(best.x+(Math.random()-.5)*.8, best.y+(Math.random()-.5)*.8);
  e.ai.lurkWait = 3+Math.random()*5;
}
function thiefAI(e,inp,dt){
  const ai=e.ai; ai.think-=dt;
  const cops=[]; let nd=99;
  for (const c of G.ents){
    if (c.team!=='P' || c.state!=='free') continue;
    const dd=dist(c,e);
    if (dd<4 || (dd<11 && sightClear(e.x,e.y,c.x,c.y))){
      const w=(c.reassigned>0?.3:1)*(G.phase==='count'?.15:1);
      cops.push({c,dd,w}); if (w>.5 && dd<nd) nd=dd;
    }
  }
  const grabber = G.ents.find(c => c.team==='P' && c.windup>0 && c.wTarget===e.id);
  if (grabber && (ai.dodge || e.abCd<=0)){
    const ax=e.x-grabber.x, ay=e.y-grabber.y, L=Math.hypot(ax,ay)||1;
    inp.mx=ax/L-ay/L*.6; inp.my=ay/L+ax/L*.6; inp.sprint=true;
    if (e.abCd<=0){ e.fx=inp.mx; e.fy=inp.my; inp.ability=true; }
    return;
  }
  if (ai.think<=0){
    ai.think=.15+Math.random()*.1;
    const jailedN=countJailed(), timeLeft=CFG.matchTime-G.playT;
    const fleeR = ai.mode==='flee' ? 8
      : ai.mode==='rescue' ? (e.rescueProg>0 ? 2.4 : 4.5)
      : ai.mode==='escape' ? (inExit(e)>=0 ? 2.5 : 5) : 7;
    const nearlyFreed = e.rescueProg > CFG.rescueTime-.6 && nd>1.6;
    if (nd<fleeR && !nearlyFreed) ai.mode='flee';
    else if (G.rescuerId===e.id && jailedN>0 && !(G.exitsOpen && timeLeft<40)) ai.mode='rescue';
    else if (G.exitsOpen && G.playT>=ai.escapeAt) ai.mode='escape';
    else ai.mode='lurk';
    if (ai.mode==='flee'){ const f=fleeDir(e,cops); ai.fdx=f[0]; ai.fdy=f[1]; if (!ai.fleeT || ai.prevMode!=='flee') fleePlan(e,cops); }
    ai.prevMode=ai.mode;
  }
  let tx=e.x, ty=e.y, stop=false;
  if (ai.mode==='flee'){
    inp.sprint = nd<6 && e.stam>4;
    if (G.exitsOpen && inExit(e)>=0 && nd>1.3){ inp.action=true; return; }
    if (nd<1.4 || !ai.fleeT){ inp.mx=ai.fdx; inp.my=ai.fdy; if (nd<1.6 && e.stam<20 && e.abCd<=0) inp.ability=true; return; }
    ai.fleeTimer -= dt;
    if (ai.fleeTimer<=0 || Math.hypot(e.x-ai.fleeT[0],e.y-ai.fleeT[1])<1.5) fleePlan(e,cops);
    if (ai.fleeT){ const d=follow(e,ai.fleeT[0],ai.fleeT[1]); inp.mx=d[0]; inp.my=d[1]; }
    return;
  }
  if (ai.mode==='rescue'){
    if (e.rescueProg<=0){
      let bi=0, bs=1e9;
      GATES.forEach((g,i) => { let s=Math.hypot(e.x-g.x,e.y-g.y)*.3 - (i===ai.gate?1:0); for (const o of cops) s += Math.max(0,9-Math.hypot(o.c.x-g.x,o.c.y-g.y))*o.w; if (s<bs){ bs=s; bi=i; } });
      ai.gate=bi;
    }
    const g=GATES[ai.gate], dg=Math.hypot(e.x-g.x,e.y-g.y);
    if (dg < CFG.rescueRange*.75){ inp.action=true; return; }
    tx=g.x; ty=g.y; inp.sprint = e.stam>40 && dg<12;
  } else if (ai.mode==='escape'){
    if (ai.exit<0 || ai.think<=.02){
      let bi=0, bs=1e9;
      EXITS.forEach((x,i) => { let s=Math.hypot(e.x-x.cx,e.y-x.cy)*.25 - (i===ai.exit?2:0); for (const c of G.ents) if (c.team==='P' && c.state==='free') s += Math.max(0,10-Math.hypot(c.x-x.cx,c.y-x.cy))*.8; if (s<bs){ bs=s; bi=i; } });
      ai.exit=bi;
    }
    const x=EXITS[ai.exit];
    if (inExit(e)===ai.exit){ inp.action=true; return; }
    tx=x.cx; ty=x.cy; inp.sprint = nd<7 && e.stam>10;
  } else {
    const pk = nearPickup(e, 9);
    if (pk && nd>8){ const d=follow(e,pk.x,pk.y); inp.mx=d[0]; inp.my=d[1]; return; }
    if (!ai.lurk) pickLurk(e);
    const dl=Math.hypot(e.x-ai.lurk[0], e.y-ai.lurk[1]);
    if (dl<.7){ stop=true; ai.lurkWait-=dt; if (ai.lurkWait<=0) pickLurk(e); }
    [tx,ty]=ai.lurk;
  }
  if (!stop){ const d=follow(e,tx,ty); inp.mx=d[0]; inp.my=d[1]; }
}
