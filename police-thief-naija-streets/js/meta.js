// =============================================================
// META: the reasons to come back. Profile, levels, naira, wardrobe,
// daily missions and a login streak. Saved on this device, and in the
// artifact's private per-person storage when that is available.
// =============================================================

export const SKINS = ['#3b2414','#553219','#6b4226','#8a5634','#a86f45','#c68e5e'];
export const SHOES = ['#222222','#f2f2f2','#c0392b','#f1c40f','#2980b9','#0b8a3e'];

// price in naira (₦), lvl = level needed
export const CATALOG = {
  P: {
    outfit: [
      { id:'p_navy',  name:'Force Navy',     col:'#1d3a7a', price:0 },
      { id:'p_black', name:'Black Ops',      col:'#1b1b22', price:150 },
      { id:'p_khaki', name:'Khaki Patrol',   col:'#a68a55', price:200, lvl:2 },
      { id:'p_white', name:'Traffic White',  col:'#e9e9e9', price:300, lvl:3 },
      { id:'p_camo',  name:'MOPOL Camo',     col:'camo',    price:450, lvl:5 },
      { id:'p_red',   name:'Parade Red',     col:'#9e1b24', price:700, lvl:7 },
      { id:'p_gold',  name:'Commissioner Gold', col:'#c79a1e', price:1500, lvl:10 },
      { id:'p_neon',  name:'Neon Patrol',    col:'#14d1c5', pass:10 },
    ],
    head: [
      { id:'cap',    name:'Peaked Cap', price:0 },
      { id:'beret',  name:'Beret',      price:150 },
      { id:'none',   name:'No Hat',     price:0 },
      { id:'helmet', name:'Riot Helmet',price:350, lvl:3 },
      { id:'bucket', name:'Bucket Hat', price:200, lvl:2 },
      { id:'goldcap', name:'Gold Cap', price:900, lvl:8 },
      { id:'halo',   name:'Siren Halo', pass:20 },
    ],
  },
  T: {
    outfit: [
      { id:'t_bw',     name:'Classic Stripes', a:'#151515', b:'#f2f2f2', price:0 },
      { id:'t_rw',     name:'Red Stripes',     a:'#c0392b', b:'#ffffff', price:100 },
      { id:'t_naija',  name:'Naija Green',     a:'#0b8a3e', b:'#ffffff', price:200, lvl:2 },
      { id:'t_purple', name:'Purple & Gold',   a:'#5b2a86', b:'#f4c430', price:250, lvl:3 },
      { id:'t_ankara', name:'Ankara Drip',     pattern:'ankara',         price:500, lvl:5 },
      { id:'t_jersey', name:'Super Eagles Kit', a:'#0b8a3e', b:'#0b8a3e', jersey:true, price:600, lvl:6 },
      { id:'t_aso',    name:'Aso-Oke Royal',   pattern:'aso',            price:1200, lvl:9 },
      { id:'t_gold',   name:'Gold Stripes',    a:'#c79a1e', b:'#151515', pass:15 },
    ],
    head: [
      { id:'bandana', name:'Bandana Mask', price:0 },
      { id:'none',    name:'No Hat',       price:0 },
      { id:'beanie',  name:'Beanie',       price:100 },
      { id:'bucket',  name:'Bucket Hat',   price:200, lvl:2 },
      { id:'afro',    name:'Big Afro',     price:250, lvl:2 },
      { id:'durag',   name:'Durag',        price:300, lvl:4 },
      { id:'fila',    name:'Fila Cap',     price:250, lvl:3 },
      { id:'crown',   name:'Street King Crown', price:1000, lvl:8 },
      { id:'halo',    name:'Siren Halo',   pass:20 },
    ],
  },
  eyes: [
    { id:'none',   name:'None',    price:0 },
    { id:'specs',  name:'Round Specs', price:100 },
    { id:'shades', name:'Shades',  price:150 },
    { id:'star',   name:'Star Shades', price:400, lvl:6 },
    { id:'visor',  name:'Neon Visor',  pass:25 },
  ],
  extra: [
    { id:'none',     name:'None',         price:0 },
    { id:'chain',    name:'Gold Chain',   price:200, lvl:2 },
    { id:'backpack', name:'Backpack',     price:150 },
    { id:'ggm',      name:'Ghana-Must-Go Bag', price:350, lvl:3 },
    { id:'scarf',    name:'Naija Scarf',  price:300, lvl:4 },
    { id:'phones',   name:'Headphones',   price:350, lvl:5 },
    { id:'cape',     name:'Agbada Cape',  pass:30 },
  ],
  dance: [
    { id:'cheer', name:'Hands Up',  price:0 },
    { id:'shaku', name:'Shaku Shaku', price:250, lvl:2 },
    { id:'zanku', name:'Zanku Legwork', price:400, lvl:4 },
    { id:'spin',  name:'Spin Move', price:300, lvl:3 },
    { id:'gwara', name:'Gwara Gwara', pass:5 },
  ],
};
export function rarity(it){
  if (it.pass) return ['Street Pass','#c86bff'];
  const p = it.price||0;
  return p===0 ? ['Starter','#9aa'] : p<=150 ? ['Common','#cfd8dc'] : p<=350 ? ['Rare','#4fc3ff'] : p<=700 ? ['Epic','#ff9f43'] : ['Legendary','#ffd84d'];
}
export const DEFAULT_LOOK = {
  P: { skin:2, outfit:'p_navy', head:'cap', eyes:'none', extra:'none', shoes:0, dance:'cheer' },
  T: { skin:3, outfit:'t_bw', head:'bandana', eyes:'none', extra:'none', shoes:0, dance:'cheer' },
};
export function catalogFor(team, cat){
  if (cat==='outfit' || cat==='head') return CATALOG[team][cat];
  if (cat==='dance') return CATALOG.dance;
  return CATALOG[cat];
}
export function randomLook(team){
  const pick = a => { a = a.filter(x => !x.pass); return a[Math.random()*a.length|0]; };
  return { skin: Math.random()*SKINS.length|0, outfit: pick(CATALOG[team].outfit).id, head: pick(CATALOG[team].head).id,
    eyes: Math.random()<.7?'none':pick(CATALOG.eyes).id, extra: Math.random()<.6?'none':pick(CATALOG.extra).id, shoes: Math.random()*SHOES.length|0, dance: pick(CATALOG.dance).id };
}

export const RANKS = {
  P: ['Recruit','Constable','Corporal','Sergeant','Inspector','ASP','DSP','Commissioner','IGP'],
  T: ['Small Pikin','Corner Runner','Street Smart','Slippery','Shadow','Ghost','Area Legend','Lagos Phantom','Uncatchable'],
};
export const xpForLevel = l => 120 + l*60;
export const rankName = (team, lvl) => RANKS[team][Math.min(RANKS[team].length-1, Math.floor((lvl-1)/2))];

const MISSIONS = [
  { k:'caps',    team:'P', goal:3, text:'Catch 3 thieves', reward:120 },
  { k:'caps',    team:'P', goal:6, text:'Catch 6 thieves', reward:220 },
  { k:'winP',    team:'P', goal:2, text:'Win 2 games as Police', reward:180 },
  { k:'whistle', team:'P', goal:4, text:'Blow the whistle 4 times', reward:100 },
  { k:'frees',   team:'T', goal:2, text:'Free 2 teammates', reward:150 },
  { k:'escapes', team:'T', goal:1, text:'Escape the street once', reward:150 },
  { k:'escapes', team:'T', goal:3, text:'Escape 3 times', reward:260 },
  { k:'dodges',  team:'T', goal:3, text:'Dodge 3 grabs', reward:120 },
  { k:'winT',    team:'T', goal:2, text:'Win 2 games as Thief', reward:180 },
  { k:'dash',    team:'T', goal:5, text:'Use Dash 5 times', reward:100 },
  { k:'goals',   team:null, goal:2, text:'Score 2 goals on the football field', reward:140 },
  { k:'buys',    team:null, goal:3, text:'Buy 3 things from the shops', reward:110 },
  { k:'games',   team:null, goal:3, text:'Play 3 games', reward:100 },
  { k:'games',   team:null, goal:5, text:'Play 5 games', reward:180 },
];

const KEY = 'pt-naija-save-v1';
const today = () => new Date().toISOString().slice(0,10);
export let SAVE = null;
let dbRef = null, dbDoc = null, saveTimer = null;

function fresh(){
  return { v:1, pid: Array.from({length:16},()=>'abcdefghijkmnpqrstuvwxyz23456789'[Math.random()*32|0]).join(''), name:'Player'+(100+Math.random()*900|0), xp:0, level:1, coins:150,
    owned:['p_navy','cap','none','t_bw','bandana','cheer'], looks: JSON.parse(JSON.stringify(DEFAULT_LOOK)),
    missions:{ date:'', list:[] }, streak:{ last:'', count:0, claimedToday:false },
    stats:{ games:0, wins:0, caps:0, frees:0, escapes:0, best:0, dodges:0, nightGames:0, nightWins:0, online:0, winStreak:0, loseStreak:0 },
    side:'R', map:'street', settings:{ shake:true, sound:true, music:true, quality:'auto' },
    pass:{ xp:0, claimed:[] }, ach:{ claimed:[] }, firstWinDate:'' };
}
function migrate(s){
  const f = fresh();
  if (!s || typeof s!=='object') return f;
  const out = { ...f, ...s, looks:{ P:{...f.looks.P, ...(s.looks&&s.looks.P)}, T:{...f.looks.T, ...(s.looks&&s.looks.T)} },
    stats:{...f.stats, ...(s.stats||{})}, settings:{...f.settings, ...(s.settings||{})}, streak:{...f.streak, ...(s.streak||{})},
    pass:{...f.pass, ...(s.pass||{})}, ach:{...f.ach, ...(s.ach||{})} };
  for (const t of ['P','T']) if (!out.looks[t].dance) out.looks[t].dance='cheer';
  if (!Array.isArray(out.owned)) out.owned = f.owned;
  if (!out.pid) out.pid = f.pid;
  for (const id of f.owned) if (!out.owned.includes(id)) out.owned.push(id);
  return out;
}
export function loadLocal(){
  let s=null; try{ s = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
  SAVE = migrate(s); refreshDaily(); return SAVE;
}
// optional: artifact private per-person storage, so progress follows the account
export async function attachCloud(){
  try{
    if (!window.claude || !window.claude.use) return false;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return false;
    const id = await user.id(); if (!id) return false;
    dbRef = db; dbDoc = db.doc('data/users/'+id+'/profile');
    const snap = await Promise.race([dbDoc.get(), new Promise((_,r)=>setTimeout(()=>r('timeout'),8000))]);
    const remote = snap && snap.exists ? snap.data() : null;
    if (remote && remote.json){
      const r = migrate(JSON.parse(remote.json));
      // keep whichever save has gone further
      if ((r.level*10000 + r.xp) > (SAVE.level*10000 + SAVE.xp)) { SAVE = r; refreshDaily(); }
    }
    persist();
    return true;
  }catch(e){ dbDoc = null; return false; }
}
let writing = false, again = false;
async function cloudWrite(){
  if (!dbDoc) return;
  if (writing){ again = true; return; }      // one write at a time per document
  writing = true;
  try{ await dbDoc.set({ json: JSON.stringify(SAVE), at: Date.now() }); }
  catch(e){ dbDoc = null; }                   // e.g. a view-only visitor: keep the device save
  writing = false;
  if (again){ again = false; cloudWrite(); }
}
export function persist(){
  try{ localStorage.setItem(KEY, JSON.stringify(SAVE)); }catch(e){}
  if (dbDoc){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(cloudWrite, 600);
  }
}
export function refreshDaily(){
  const d = today();
  if (SAVE.missions.date !== d){
    const pool = MISSIONS.slice().sort(()=>Math.random()-.5);
    const list=[], keys=new Set();
    for (const m of pool){ if (list.length>=3) break; if (keys.has(m.k)) continue; keys.add(m.k); list.push({ ...m, prog:0, done:false, claimed:false }); }
    SAVE.missions = { date:d, list };
  }
  if (SAVE.streak.last !== d){
    const y = new Date(Date.now()-864e5).toISOString().slice(0,10);
    SAVE.streak.count = SAVE.streak.last===y ? SAVE.streak.count+1 : 1;
    SAVE.streak.last = d; SAVE.streak.claimedToday = false;
  }
  persist();
}
export const streakReward = () => 50 + Math.min(SAVE.streak.count,7)*25;
export function claimStreak(){
  if (SAVE.streak.claimedToday) return 0;
  const r = streakReward(); SAVE.coins += r; SAVE.streak.claimedToday = true; persist(); return r;
}
export function claimMission(i){
  const m = SAVE.missions.list[i]; if (!m || !m.done || m.claimed) return 0;
  m.claimed = true; SAVE.coins += m.reward; persist(); return m.reward;
}

// called once per finished match with what the local player did
export function awardMatch({ team, won, stats, night=false, online=false }){
  const lines = [];
  let xp = 0, coins = 0;
  const add = (label, x, c=0) => { if (x||c){ lines.push([label, x, c]); xp+=x; coins+=c; } };
  const st = SAVE.stats;
  add(won ? 'Victory' : 'Game played', won?110:45, won?60:20);
  if (team==='P') add(`Catches ×${stats.caps}`, stats.caps*25, stats.caps*10);
  if (team==='T'){
    add(`Teammates freed ×${stats.rescues}`, stats.rescues*30, stats.rescues*12);
    if (stats.escaped) add('Escaped!', 60, 25);
    add(`Dodges ×${stats.dodges}`, stats.dodges*10, stats.dodges*3);
  }
  if (stats.goals) add(`Goals scored ×${stats.goals}`, stats.goals*20, 0);
  if (stats.cash) add('Street money kept', 0, stats.cash);
  st.goals = (st.goals||0) + (stats.goals||0);
  if (won){ st.winStreak++; st.loseStreak=0; } else { st.loseStreak++; st.winStreak=0; }
  if (won && st.winStreak>=2) add(`Win streak ×${st.winStreak}`, Math.min(5,st.winStreak)*15, Math.min(5,st.winStreak)*8);
  if (won && SAVE.firstWinDate !== today()){ SAVE.firstWinDate = today(); add('First win of the day', 100, 50); }
  if (night) add('Night game', 15, 5);
  const before = { level: SAVE.level, xp: SAVE.xp, pass: passTier() };
  SAVE.xp += xp; SAVE.coins += coins; SAVE.pass.xp += xp;
  let levelUps = 0;
  while (SAVE.xp >= xpForLevel(SAVE.level)){ SAVE.xp -= xpForLevel(SAVE.level); SAVE.level++; levelUps++; SAVE.coins += 100; }
  st.games++; if (won) st.wins++; st.caps += stats.caps; st.frees += stats.rescues; st.escapes += stats.escaped; st.dodges += stats.dodges;
  if (night){ st.nightGames++; if (won) st.nightWins++; }
  if (online) st.online++;
  // missions
  const done = [];
  for (const m of SAVE.missions.list){
    if (m.done) continue;
    if (m.team && m.team!==team) continue;
    let inc = 0;
    if (m.k==='caps') inc = stats.caps; else if (m.k==='frees') inc = stats.rescues; else if (m.k==='escapes') inc = stats.escaped;
    else if (m.k==='dodges') inc = stats.dodges; else if (m.k==='games') inc = 1;
    else if (m.k==='winP' || m.k==='winT') inc = won?1:0;
    else if (m.k==='whistle' || m.k==='dash') inc = stats.abil;
    else if (m.k==='goals') inc = stats.goals||0; else if (m.k==='buys') inc = stats.buys||0;
    m.prog = Math.min(m.goal, m.prog+inc);
    if (m.prog>=m.goal){ m.done=true; done.push(m); }
  }
  const newAch = ACHIEVEMENTS.filter(a => !SAVE.ach.claimed.includes(a.id) && !a.seen && a.test(SAVE));
  persist();
  return { xp, coins, lines, before, levelUps, done, passUps: passTier()-before.pass, newAch };
}
// bots you face get tougher when you're winning and ease off when you're losing
export function soloDifficulty(){
  const st = SAVE.stats; let d = SAVE.level < 3 ? 0 : 1;
  if (st.loseStreak >= 2) d -= 1; if (st.winStreak >= 3) d += 1;
  return Math.max(0, Math.min(2, d));
}

// ---------------------------------------------------------------- Street Pass (season 1)
export const PASS_XP = 160, PASS_TIERS = 30;
export const PASS_SEASON = 'Season 1 · Lagos Rush';
export const PASS = Array.from({ length: PASS_TIERS }, (_, i) => {
  const tier = i+1;
  const item = [...CATALOG.P.outfit, ...CATALOG.P.head, ...CATALOG.T.outfit, ...CATALOG.T.head, ...CATALOG.eyes, ...CATALOG.extra, ...CATALOG.dance].find(x => x.pass===tier);
  return item ? { tier, item } : { tier, coins: tier%3===0 ? 150 : 60 };
});
export const passTier = () => Math.min(PASS_TIERS, Math.floor(SAVE.pass.xp / PASS_XP));
export function claimPass(tier){
  const r = PASS[tier-1]; if (!r || tier > passTier() || SAVE.pass.claimed.includes(tier)) return null;
  SAVE.pass.claimed.push(tier);
  if (r.item){ if (!SAVE.owned.includes(r.item.id)) SAVE.owned.push(r.item.id); }
  else SAVE.coins += r.coins;
  persist(); return r;
}

// ---------------------------------------------------------------- trophies
export const ACHIEVEMENTS = [
  { id:'cap1',  name:'First Arrest',      text:'Catch your first thief',        reward:50,  test:s=>s.stats.caps>=1 },
  { id:'cap25', name:'Station Regular',   text:'Catch 25 thieves',              reward:200, test:s=>s.stats.caps>=25 },
  { id:'cap100',name:'Area Commander',    text:'Catch 100 thieves',             reward:600, test:s=>s.stats.caps>=100 },
  { id:'free1', name:'Jailbreak',         text:'Free a teammate',               reward:50,  test:s=>s.stats.frees>=1 },
  { id:'free25',name:'Freedom Fighter',   text:'Free 25 teammates',             reward:300, test:s=>s.stats.frees>=25 },
  { id:'esc1',  name:'Gone!',             text:'Escape the street',             reward:80,  test:s=>s.stats.escapes>=1 },
  { id:'esc15', name:'Escape Artist',     text:'Escape 15 times',               reward:350, test:s=>s.stats.escapes>=15 },
  { id:'dodge20',name:'Slippery',         text:'Dodge 20 grabs',                reward:200, test:s=>s.stats.dodges>=20 },
  { id:'win10', name:'Winner',            text:'Win 10 games',                  reward:150, test:s=>s.stats.wins>=10 },
  { id:'win50', name:'Street Champion',   text:'Win 50 games',                  reward:500, test:s=>s.stats.wins>=50 },
  { id:'goal1', name:'Up Eagles!',        text:'Score a goal mid-chase',        reward:60,  test:s=>(s.stats.goals||0)>=1 },
  { id:'goal20',name:'Street Striker',    text:'Score 20 goals',                reward:300, test:s=>(s.stats.goals||0)>=20 },
  { id:'night', name:'NEPA Took Light',   text:'Win a night game',              reward:100, test:s=>s.stats.nightWins>=1 },
  { id:'online',name:'Gather Your Squad', text:'Play an online match',          reward:100, test:s=>s.stats.online>=1 },
  { id:'streak7',name:'Every Day Na Day', text:'Reach a 7-day login streak',    reward:300, test:s=>s.streak.count>=7 },
  { id:'lvl5',  name:'Rising',            text:'Reach level 5',                 reward:150, test:s=>s.level>=5 },
  { id:'lvl10', name:'Big Man / Big Woman', text:'Reach level 10',              reward:400, test:s=>s.level>=10 },
  { id:'drip',  name:'Drip Lord',         text:'Own 20 wardrobe items',         reward:250, test:s=>s.owned.length>=20 },
];
export function claimAch(id){
  const a = ACHIEVEMENTS.find(x => x.id===id);
  if (!a || SAVE.ach.claimed.includes(id) || !a.test(SAVE)) return 0;
  SAVE.ach.claimed.push(id); SAVE.coins += a.reward; persist(); return a.reward;
}
export const achReady = () => ACHIEVEMENTS.filter(a => !SAVE.ach.claimed.includes(a.id) && a.test(SAVE)).length;
export function itemState(team, cat, item){
  if (cat==='skin' || cat==='shoes') return 'owned';
  if (SAVE.owned.includes(item.id)) return 'owned';
  if (item.pass) return 'pass';
  if (!item.price) return 'owned';
  if (item.lvl && SAVE.level < item.lvl) return 'locked';
  return SAVE.coins >= item.price ? 'buy' : 'poor';
}
export function buy(item){
  if (SAVE.owned.includes(item.id)) return true;
  if (item.pass) return false;
  if ((item.lvl && SAVE.level<item.lvl) || SAVE.coins < item.price) return false;
  SAVE.coins -= item.price; SAVE.owned.push(item.id); persist(); return true;
}
