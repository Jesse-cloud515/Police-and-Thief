// =============================================================
// MAIN: screens, controls, the game loop, HUD, sound and music.
// =============================================================
import { CFG, W, H, OB, PRISON, PC, EXITS, HIDES, GATES, collide, inHide, inExit, gateNear, dist, SHOPS, shopNear, BALL_HOME, MAP, MAPS, MAP_IDS, setMap, ROADS, pushFromHerd } from './world.js';
import { G, newMatch, step, CHAT, LINES, REASONS, nearestCapturable, countJailed } from './sim.js';
import * as M from './meta.js';
import * as S from './scene.js';
import { ADS } from './ads.js';
import { NET, initNet, newCode, openRoom, leaveRoom, setPresence, livePeers, peerPresence, hostPresence, packState, rosterOf, applySnapshot, SRV, connectServer, srvSend, serverUrl } from './net.js';

const $ = id => document.getElementById(id);
const show = (id, on=true) => $(id).classList.toggle('hidden', !on);
let mode = 'home';
let MC = null;               // current match context
let wardTeam = 'P', wardCat = 'outfit', spin = 0;
const T0 = performance.now();
const now = () => (performance.now()-T0)/1000;

// ------------------------------------------------------------------ boot
const SAVE = () => M.SAVE;
M.loadLocal();
try{ S.initScene($('c')); }
catch(e){ $('loading').textContent = 'This device could not start 3D graphics (WebGL). Try another browser.'; throw e; }
S.setNight(false);
S.showroom(SAVE().looks);
addEventListener('resize', () => { S.resize(); checkRotate(); });
initNet().then(ok => { if (mode==='online') renderOnline(); });
M.attachCloud().then(ok => { if (ok){ S.showroom(SAVE().looks); refreshHome(); } });
setTimeout(() => { $('loading').classList.add('hidden'); }, 300);
setTimeout(() => {   // after the whole module has loaded
  applyQuality(); ADS.init();
  if (MAPS[SAVE().map]) useMap(SAVE().map);
  goHome();
  if (!SAVE().seenHow){ show('how'); SAVE().seenHow = true; M.persist(); }
}, 0);

// ------------------------------------------------------------------ audio
let AC = null, master = null, musicGain = null, musicOn = SAVE().settings.music !== false;
function initAudio(){
  try{
    if (!AC){ AC = new (window.AudioContext||window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination); musicGain = AC.createGain(); musicGain.gain.value = .22; musicGain.connect(master); }
    if (AC.state==='suspended') AC.resume();
  }catch(e){}
}
function tone(f, dur, type='square', vol=.08, when=0, slide=0, dest){
  if (!AC || !SAVE().settings.sound) return;
  try{
    const t = AC.currentTime+when, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide), t+dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    o.connect(g).connect(dest||master); o.start(t); o.stop(t+dur+.02);
  }catch(e){}
}
function noise(dur, vol, when=0, hp=4000, dest){
  if (!AC || !SAVE().settings.sound) return;
  const t = AC.currentTime+when, b = AC.createBuffer(1, AC.sampleRate*dur, AC.sampleRate), d = b.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = b; f.type='highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.connect(f).connect(g).connect(dest||master); s.start(t);
}
function sfx(n){
  if (n==='whistle') for (let i=0;i<8;i++) tone(i%2?2500:2850,.055,'sine',.07,i*.05);
  else if (n==='bigwhistle') { for (let i=0;i<14;i++) tone(i%2?2600:3000,.05,'sine',.09,i*.045); }
  else if (n==='go') tone(2700,.6,'sine',.09);
  else if (n==='alarm') for (let i=0;i<4;i++) tone(i%2?660:880,.14,'square',.045,i*.15);
  else if (n==='chime') [523,659,784,1046].forEach((f,i)=>tone(f,.22,'triangle',.08,i*.08));
  else if (n==='tick') tone(1200,.05,'square',.04);
  else if (n==='radio') tone(320,.3,'sawtooth',.04,0,-140);
  else if (n==='miss') tone(220,.12,'triangle',.07,0,-90);
  else if (n==='warn') { tone(900,.07,'square',.05); tone(700,.07,'square',.05,.08); }
  else if (n==='swoosh') noise(.25,.25,0,1500);
  else if (n==='coin') { tone(988,.08,'square',.05); tone(1319,.18,'square',.05,.08); }
  else if (n==='lose') [392,330,262].forEach((f,i)=>tone(f,.25,'triangle',.08,i*.18));
  else if (n==='tap') tone(600,.04,'triangle',.05);
  else if (n==='moo'){ tone(150,.9,'sawtooth',.07,0,-45); tone(225,.9,'triangle',.05,0,-60); }
  else if (n==='bell'){ for (let i=0;i<5;i++){ tone(1568,.5,'sine',.09,i*.16); tone(3136,.3,'sine',.03,i*.16); } }
  else if (n==='kick'){ tone(160,.09,'sine',.25,0,-80); noise(.04,.12,0,900); }
  else if (n==='goal'){ noise(1.4,.16,0,700); [523,659,784,1046,1319].forEach((f,i)=>tone(f,.25,'triangle',.07,i*.07)); for (let i=0;i<6;i++) tone(i%2?2600:3000,.05,'sine',.06,.5+i*.045); }
}
// tiny Afrobeat-style loop: kick, clap, shaker, log-drum bass
let musicTimer = null, nextBeat = 0, beatN = 0;
const BPM = 108, SIX = 60/BPM/4;
const BASS = [55,0,0,55, 0,0,65,0, 73,0,0,65, 0,55,0,0];
// the theme song (audio/theme.mp3). If it can't be loaded, the small built-in loop below plays instead.
let themeBuf = null, themeSrc = null, themeTried = false;
async function loadTheme(){
  if (themeTried || !AC) return; themeTried = true;
  try{
    const r = await fetch('./audio/theme.mp3'); if (!r.ok) throw 0;
    themeBuf = await AC.decodeAudioData(await r.arrayBuffer());
    themeSrc = AC.createBufferSource(); themeSrc.buffer = themeBuf; themeSrc.loop = true;
    musicGain.gain.value = 0; themeSrc.connect(musicGain); themeSrc.start();
  }catch(e){ themeBuf = null; }
}
function musicTick(){
  if (themeBuf && AC){
    const want = (musicOn && SAVE().settings.sound) ? (mode==='match' ? .3 : .55) : 0;
    musicGain.gain.setTargetAtTime(want, AC.currentTime, .25); return;
  }
  if (!AC || !musicOn || !SAVE().settings.sound) return;
  while (nextBeat < AC.currentTime + .15){
    const w = nextBeat - AC.currentTime, i = beatN%16;
    if (i===0 || i===6 || i===10) tone(110,.18,'sine',.5,w,-70,musicGain);
    if (i===4 || i===12) noise(.12,.35,w,1200,musicGain);
    noise(.03, i%2?.08:.14, w, 7000, musicGain);
    if (BASS[i]) tone(BASS[i]*2,.2,'triangle',.35,w,-20,musicGain);
    if (beatN%32===14 || beatN%32===30) tone(784,.1,'triangle',.12,w,0,musicGain), tone(988,.1,'triangle',.1,w+SIX,0,musicGain);
    nextBeat += SIX; beatN++;
  }
}
function startMusic(){ if (!AC) return; loadTheme(); nextBeat = Math.max(nextBeat, AC.currentTime+.05); clearInterval(musicTimer); musicTimer = setInterval(musicTick, 50); }
document.addEventListener('pointerdown', () => { const was = !AC; initAudio(); if (was) startMusic(); }, { capture:true });
const buzz = ms => { try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} };

// ------------------------------------------------------------------ toast / announce / feed
let toastT = 0;
function toast(t){ $('toast').textContent = t; $('toast').style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(()=>$('toast').style.opacity=0, 1800); }
let annT = 0;
function announce(text, col='#fff', dur=1.6){ const a=$('ann'); a.textContent=text; a.style.color=col; a.style.opacity=1; a.style.transform='scale(1)'; clearTimeout(annT); annT=setTimeout(()=>{ a.style.opacity=0; a.style.transform='scale(.9)'; }, dur*1000); }
function feed(text, col='#fff'){
  const li=document.createElement('li'); li.textContent=text; li.style.color=col; $('feed').prepend(li);
  while ($('feed').children.length>3) $('feed').lastChild.remove();
  setTimeout(()=>{ li.style.opacity=0; setTimeout(()=>li.remove(),700); }, 5000);
}

// ------------------------------------------------------------------ screens
function setMode(m){
  mode = m;
  for (const id of ['home','ward','online','hud','res']) show(id, false);
  show('ctrl', m==='match'); show('stamBar', m==='match'); show('hint', false);
  if (m==='home'){ show('home'); refreshHome(); }
  if (m==='ward'){ show('ward'); renderWard(); }
  if (m==='online'){ show('online'); renderOnline(); }
  if (m==='match'){ show('hud'); }
  if (m==='res') show('res');
  if (m!=='match'){ $('tags').innerHTML=''; tagEls.clear(); }
  checkRotate();
}
function goHome(){
  S.clearViews(); S.setNight(false); S.showroom(SAVE().looks); MC = null; setMode('home');
}
function refreshHome(){
  const s = SAVE(); buildMapSeg();
  $('hName').textContent = s.name; $('hAv').firstChild.nodeValue = s.name[0].toUpperCase(); $('hLv').textContent = s.level;
  $('hRank').textContent = `${M.rankName('P',s.level)} · ${M.rankName('T',s.level)}`;
  $('hXp').style.width = Math.round(s.xp/M.xpForLevel(s.level)*100)+'%';
  $('hCoins').textContent = s.coins; $('wCoins').textContent = s.coins;
  document.querySelectorAll('#sideSeg button').forEach(b => b.classList.toggle('on', b.dataset.side===s.side));
  const st = $('streak'); st.innerHTML='';
  const label = document.createElement('span'); label.textContent = `🔥 Day ${s.streak.count} streak`; st.appendChild(label);
  if (!s.streak.claimedToday){ const b=document.createElement('button'); b.className='btn gold'; b.style.cssText='padding:6px 10px;font-size:12px;margin-left:auto'; b.textContent=`Claim ₦${M.streakReward()}`; b.onclick=()=>{ const r=M.claimStreak(); sfx('coin'); toast(`+₦${r} streak bonus!`); refreshHome(); }; st.appendChild(b); }
  else { const d=document.createElement('span'); d.className='tag'; d.style.marginLeft='auto'; d.textContent='Come back tomorrow for more ₦'; st.appendChild(d); }
  const ready = M.achReady(); $('achDot').textContent = ready ? String(ready) : '';
  // one line on the home screen; the full list opens when tapped
  { const ml = $('misLine'), list = s.missions.list, claim = list.filter(m => m.done && !m.claimed).length, left = list.find(m => !m.done);
    ml.innerHTML = ''; ml.appendChild(el('span', null, claim ? `🎁 ${claim} mission reward${claim>1?'s':''} to claim` : left ? `📋 ${left.text} (${left.prog}/${left.goal})` : '📋 All missions done for today'));
    ml.appendChild(el('b', null, claim ? 'CLAIM ›' : 'MISSIONS ›')); }
  const mis = $('missions'); mis.innerHTML = '<div class="bung" style="font-size:13px;color:#ffd84d;margin-bottom:4px">DAILY MISSIONS</div>';
  s.missions.list.forEach((m,i) => {
    const r = document.createElement('div'); r.className='mis';
    const left = document.createElement('div'); left.style.flex='1';
    left.innerHTML = `<div></div><div class="bar"><i style="width:${Math.round(m.prog/m.goal*100)}%"></i></div>`;
    left.firstChild.textContent = `${m.team==='P'?'🚓 ':m.team==='T'?'🏃 ':''}${m.text}  (${m.prog}/${m.goal})`;
    r.appendChild(left);
    if (m.done && !m.claimed){ const b=document.createElement('button'); b.textContent=`₦${m.reward}`; b.onclick=()=>{ M.claimMission(i); sfx('coin'); toast(`+₦${m.reward}`); refreshHome(); }; r.appendChild(b); }
    else { const w=document.createElement('span'); w.className='rw'; w.textContent = m.claimed ? '✔' : `₦${m.reward}`; r.appendChild(w); }
    mis.appendChild(r);
  });
}
document.querySelectorAll('#sideSeg button').forEach(b => b.onclick = () => { SAVE().side = b.dataset.side; M.persist(); refreshHome(); sfx('tap'); });
$('bPlay').onclick = () => startSolo(SAVE().side);
$('bWard').onclick = () => { wardTeam='P'; setMode('ward'); };
$('bOnline').onclick = () => setMode('online');
$('bHow').onclick = () => show('how');
$('misLine').onclick = () => show('misDlg');
$('misOk').onclick = () => show('misDlg', false);
$('bPass').onclick = () => { renderPass(); show('passDlg'); };
$('bAch').onclick = () => { renderAch(); show('achDlg'); };
$('bSet').onclick = () => { syncSettings(); show('setDlg'); };
function renderPass(){
  const tier = M.passTier(), into = SAVE().pass.xp - tier*M.PASS_XP;
  $('passHead').textContent = `${M.PASS_SEASON} · Tier ${tier}/${M.PASS_TIERS}` + (tier<M.PASS_TIERS ? ` · ${M.PASS_XP-into} XP to next` : ' · Complete!');
  const L = $('passList'); L.innerHTML='';
  for (const r of M.PASS){
    const got = SAVE().pass.claimed.includes(r.tier), open = r.tier<=tier;
    const row = el('div','pass'+(got?' got':'')); row.appendChild(el('div','tn',String(r.tier)));
    const label = r.item ? `${r.item.name} (exclusive)` : `₦${r.coins}`;
    const sp = el('span',null,label); if (r.item) sp.style.color = '#e2b6ff'; row.appendChild(sp);
    if (got) row.appendChild(el('span','tag','✔ Claimed')).style.marginLeft='auto';
    else if (open){ const b=el('button',null,'CLAIM'); b.onclick=()=>{ const g=M.claimPass(r.tier); if (g){ sfx('coin'); toast(g.item ? `Unlocked ${g.item.name}! Equip it in the Wardrobe` : `+₦${g.coins}`); renderPass(); refreshHome(); } }; row.appendChild(b); }
    else row.appendChild(el('span','tag','🔒')).style.marginLeft='auto';
    L.appendChild(row);
  }
}
function renderAch(){
  const L = $('achList'); L.innerHTML='';
  for (const a of M.ACHIEVEMENTS){
    const done = SAVE().ach.claimed.includes(a.id), ok = a.test(SAVE());
    const row = el('div','ach'+(!ok && !done ? ' locked':''));
    const t = el('div'); t.style.flex='1'; t.appendChild(el('div',null,(done?'🏆 ':ok?'⭐ ':'🔒 ')+a.name)); const sub=el('div',null,`${a.text} · ₦${a.reward}`); sub.style.cssText='font-size:11px;opacity:.7'; t.appendChild(sub); row.appendChild(t);
    if (ok && !done){ const b=el('button',null,'CLAIM'); b.onclick=()=>{ const r=M.claimAch(a.id); if (r){ sfx('coin'); toast(`+₦${r}`); renderAch(); refreshHome(); } }; row.appendChild(b); }
    L.appendChild(row);
  }
}
function syncSettings(){
  const st = SAVE().settings;
  $('sQual').textContent = 'Graphics: ' + ({auto:'AUTO', high:'HIGH', low:'LOW (faster)'}[st.quality]||'AUTO');
  $('sSound').textContent = 'Sound: ' + (st.sound?'ON':'OFF'); $('sMusic').textContent = 'Music: ' + (st.music?'ON':'OFF'); $('sShake').textContent = 'Screen shake: ' + (st.shake?'ON':'OFF');
}
$('sQual').onclick = () => { const st=SAVE().settings; st.quality = st.quality==='auto' ? 'high' : st.quality==='high' ? 'low' : 'auto'; M.persist(); applyQuality(); syncSettings(); };
$('sSound').onclick = () => { SAVE().settings.sound = !SAVE().settings.sound; M.persist(); syncSettings(); syncPauseBtns(); };
$('sMusic').onclick = () => { SAVE().settings.music = !SAVE().settings.music; musicOn = SAVE().settings.music; M.persist(); syncSettings(); syncPauseBtns(); };
$('sShake').onclick = () => { SAVE().settings.shake = !SAVE().settings.shake; M.persist(); syncSettings(); syncPauseBtns(); };
function applyQuality(){ const q = SAVE().settings.quality; S.setQuality(q==='low' ? 0 : 1); qualityDropped = q!=='auto'; }
$('bHowOk').onclick = () => show('how', false);
$('bRename').onclick = () => { $('nameIn').value = SAVE().name; show('nameDlg'); $('nameIn').focus(); };
$('nameCancel').onclick = () => show('nameDlg', false);
$('nameOk').onclick = () => { const v = $('nameIn').value.replace(/[^\w .'-]/g,'').trim().slice(0,14); if (v){ SAVE().name = v; M.persist(); } show('nameDlg', false); refreshHome(); };

// ------------------------------------------------------------------ wardrobe
const CATS = [['outfit','Outfit'],['head','Headwear'],['dance','Victory Dance'],['skin','Skin'],['eyes','Eyes'],['extra','Extras'],['shoes','Shoes']];
function renderWard(){
  const s = SAVE(); $('wCoins').textContent = s.coins;
  document.querySelectorAll('#wTeam button').forEach(b => b.classList.toggle('on', b.dataset.team===wardTeam));
  S.showroom(s.looks, wardTeam);
  const cats = $('wCats'); cats.innerHTML='';
  for (const [k,label] of CATS){ const b=document.createElement('button'); b.textContent=label; b.classList.toggle('on', k===wardCat); b.onclick=()=>{ wardCat=k; renderWard(); sfx('tap'); }; cats.appendChild(b); }
  const grid = $('wGrid'); grid.innerHTML='';
  const look = s.looks[wardTeam];
  let items;
  if (wardCat==='skin') items = M.SKINS.map((c,i) => ({ id:i, name:'', sw:c }));
  else if (wardCat==='shoes') items = M.SHOES.map((c,i) => ({ id:i, name:'', sw:c }));
  else items = M.catalogFor(wardTeam, wardCat);
  for (const it of items){
    const st = M.itemState(wardTeam, wardCat, it);
    const eq = look[wardCat] === it.id;
    const b = document.createElement('button'); b.className = 'item' + (eq?' eq':'') + (st==='locked'?' locked':'') + (st==='poor'?' poor':'');
    if (it.sw){ const sw=document.createElement('div'); sw.className='sw'; sw.style.background=it.sw; b.appendChild(sw); }
    else if (it.col || it.a || it.pattern){ const sw=document.createElement('div'); sw.className='sw'; sw.style.background = it.pattern ? 'repeating-linear-gradient(45deg,#e8762b 0 6px,#1b4f9c 6px 12px,#f6c625 12px 16px)' : it.col==='camo' ? 'repeating-linear-gradient(45deg,#5d6b3a 0 6px,#3b4a25 6px 12px)' : it.a ? `repeating-linear-gradient(0deg,${it.a} 0 5px,${it.b} 5px 10px)` : it.col; b.appendChild(sw); }
    else if (wardCat==='dance'){ const sw=document.createElement('div'); sw.textContent='💃'; sw.style.fontSize='22px'; b.appendChild(sw); }
    if (it.name){ const n=document.createElement('div'); n.textContent=it.name; b.appendChild(n); }
    if (it.name && wardCat!=='skin' && wardCat!=='shoes'){ const [rn, rc] = M.rarity(it); const r=document.createElement('div'); r.className='rar'; r.textContent=rn; r.style.color=rc; b.appendChild(r); if (!eq) b.style.borderColor = rc+'55'; }
    const p = document.createElement('div'); p.className='pr';
    p.textContent = eq ? 'EQUIPPED' : st==='owned' ? '' : st==='locked' ? `🔒 Level ${it.lvl}` : st==='pass' ? `🎟 Pass tier ${it.pass}` : `₦${it.price}`;
    b.appendChild(p);
    b.onclick = () => {
      if (st==='pass'){ toast(`Unlock it at Street Pass tier ${it.pass}`); return; }
      if (st==='locked'){ toast(`Reach level ${it.lvl} to unlock`); return; }
      if (st==='poor'){ toast(`You need ₦${it.price-s.coins} more. Win games and finish missions!`); return; }
      if (st==='buy'){ if (!M.buy(it)) return; sfx('coin'); toast(`Bought ${it.name}!`); }
      look[wardCat] = it.id; M.persist(); sfx('tap'); renderWard();
    };
    grid.appendChild(b);
  }
}
document.querySelectorAll('#wTeam button').forEach(b => b.onclick = () => { wardTeam = b.dataset.team; renderWard(); });
$('wBack').onclick = () => { S.showroom(SAVE().looks); setMode('home'); };
{ let dragX=null; const z=$('wSpin'); z.style.pointerEvents='auto';
  z.addEventListener('pointerdown', e => { dragX=e.clientX; z.setPointerCapture(e.pointerId); });
  z.addEventListener('pointermove', e => { if (dragX!==null){ spin += (e.clientX-dragX)*.012; dragX=e.clientX; } });
  z.addEventListener('pointerup', () => dragX=null); }

// ------------------------------------------------------------------ online lobby
function el(tag, cls, text){ const e=document.createElement(tag); if (cls) e.className=cls; if (text!=null) e.textContent=text; return e; }
let showBoard = false, srvTried = false;
let onlineKey = '';
function renderOnline(){
  const p = $('onPanel');
  // redraw only when what's on screen really changed, so taps never land on a button that was just replaced
  const L = SRV.lobby;
  const key = [SRV.status, showBoard, !!NET.room, NET.available, L ? JSON.stringify({ ...L, startsIn:null }) : '', SRV.lb ? SRV.lb.length : -1, SAVE().side].join('|');
  if (key === onlineKey && p.childNodes.length){
    if (L && L.quick){ const c = p.querySelector('.code'); if (c) c.textContent = L.startsIn!=null ? `0:${String(L.startsIn).padStart(2,'0')}` : '…'; }
    return;
  }
  onlineKey = key;
  p.innerHTML='';
  const back = el('button','btn ghost','← Back'); back.style.cssText='padding:8px 12px;font-size:12px;margin-bottom:10px';
  back.onclick = async () => { if (SRV.lobby){ srvSend({ t:'leave' }); SRV.lobby=null; } await leaveRoom(); showBoard=false; setMode('home'); }; p.appendChild(back);
  p.appendChild(el('h2',null,'PLAY ONLINE'));
  // 1) public game server (when the game runs on its own website)
  if (serverUrl()){
    if (SRV.status!=='on'){
      p.appendChild(el('p',null, SRV.status==='connecting' ? 'Connecting to the game server…' : "Can't reach the game server right now."));
      if (SRV.status==='off'){
        const r = el('button','btn blue','TRY AGAIN'); r.style.width='100%'; r.onclick=()=>{ srvTried=false; tryServer(); }; p.appendChild(r);
        if (!srvTried) tryServer();
      }
      return;
    }
    if (showBoard) return renderBoard(p);
    if (SRV.lobby) return renderSrvLobby(p);
    p.appendChild(el('p',null,`Playing as ${SAVE().name}. Quick Match puts you with players from anywhere; bots fill empty places.`));
    p.appendChild(sideSeg(k => {}));
    const q = el('button','btn green','⚡ QUICK MATCH'); q.style.cssText='width:100%;font-size:20px'; q.onclick=()=>{ srvSend({ t:'quick', side: SAVE().side }); }; p.appendChild(q);
    const row = el('div','row');
    const mk = el('button','btn orange','CREATE ROOM'); mk.onclick=()=>srvSend({ t:'create', side: SAVE().side, map: SAVE().map||'random' }); row.appendChild(mk);
    const lb = el('button','btn ghost','🏆 TOP 20'); lb.onclick=()=>{ showBoard=true; srvSend({ t:'lb' }); renderOnline(); }; row.appendChild(lb);
    p.appendChild(row);
    const inp = el('input','txt'); inp.maxLength=4; inp.placeholder='FRIEND\'S CODE'; inp.style.marginTop='12px'; p.appendChild(inp);
    const jn = el('button','btn blue','JOIN ROOM'); jn.style.cssText='width:100%;margin-top:8px';
    jn.onclick = () => { const c = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if (c.length!==4){ toast('Codes have 4 letters'); return; } srvSend({ t:'join', code:c, side: SAVE().side }); };
    p.appendChild(jn);
    return;
  }
  // 2) claude.ai rooms (when played inside claude.ai)
  if (!NET.available){
    p.appendChild(el('p',null,"Online play needs the game's own website (with its game server), or claude.ai rooms. Neither is available here, so single player with bots is ready to go instead."));
    return;
  }
  renderClaudeRooms(p);
}
function sideSeg(cb){
  const seg = el('div','seg');
  for (const [k,l] of [['P','🚓 Police'],['R','🎲 Any'],['T','🏃 Thief']]){ const b=el('button',null,l); b.dataset.side=k; b.classList.toggle('on', SAVE().side===k); b.onclick=()=>{ SAVE().side=k; M.persist(); cb(k); renderOnline(); }; seg.appendChild(b); }
  return seg;
}
function renderSrvLobby(p){
  const L = SRV.lobby;
  if (L.quick){ p.appendChild(el('p',null,'⚡ Quick Match')); p.appendChild(el('div','code', L.startsIn!=null ? `0:${String(L.startsIn).padStart(2,'0')}` : '…')); p.appendChild(el('p',null,'Starting soon. Bots fill any empty places.')).style.textAlign='center'; }
  else { p.appendChild(el('p',null,'Room code — tell your friends:')); p.appendChild(el('div','code', L.code)); }
  p.appendChild(sideSeg(k => srvSend({ t:'team', side:k })));
  const list = el('div','plist');
  for (const pl of L.players){ const r=el('div','pl'); r.appendChild(el('span',null,(pl.host&&!L.quick?'👑 ':'')+pl.name)); r.appendChild(el('span','t t'+pl.tm, pl.tm==='P'?'POLICE':pl.tm==='T'?'THIEF':'ANY')); list.appendChild(r); }
  for (let i=L.players.length;i<8;i++){ const r=el('div','pl'); r.style.opacity=.4; r.appendChild(el('span',null,'🤖 Bot')); list.appendChild(r); }
  p.appendChild(list);
  if (!L.quick && L.you==='host'){ const go=el('button','btn green','START MATCH'); go.style.width='100%'; go.onclick=()=>srvSend({ t:'start' }); p.appendChild(go); }
  else if (!L.quick) p.appendChild(el('p',null,'Waiting for the host to start…')).style.textAlign='center';
  const lv = el('button','btn ghost','LEAVE'); lv.style.cssText='width:100%;margin-top:8px'; lv.onclick=()=>{ srvSend({ t:'leave' }); SRV.lobby=null; renderOnline(); }; p.appendChild(lv);
}
function renderBoard(p){
  p.appendChild(el('p',null,'🏆 Top players (3 points a win, 1 a game, plus catches, rescues and escapes)'));
  const t = el('table'); const hr=el('tr'); for (const h of ['#','Name','Pts','Wins']) hr.appendChild(el('th',null,h)); t.appendChild(hr);
  (SRV.lb||[]).forEach((r,i) => { const tr=el('tr', r.name===SAVE().name?'me':''); for (const v of [i+1, r.name, r.pts, r.wins]) tr.appendChild(el('td',null,String(v))); t.appendChild(tr); });
  if (!SRV.lb) p.appendChild(el('p',null,'Loading…')); else if (!SRV.lb.length) p.appendChild(el('p',null,'No games recorded yet. Be the first!'));
  p.appendChild(t);
  const b = el('button','btn ghost','← Back to online'); b.style.cssText='width:100%;margin-top:10px'; b.onclick=()=>{ showBoard=false; renderOnline(); }; p.appendChild(b);
}
async function tryServer(){
  srvTried = true;
  const pr = connectServer({ pid: SAVE().pid, name: SAVE().name, looks: SAVE().looks });
  if (mode==='online') renderOnline();
  await pr; if (mode==='online') renderOnline();
}
SRV.onChange = (why) => {
  if (why==='err' && SRV.err){ toast(SRV.err); SRV.err=null; }
  if (why==='closed' && MC && MC.kind==='guest' && MC.src===srvSrc) return;
  if (mode==='online' && why!=='s') renderOnline();
};
function renderClaudeRooms(p){
  onlineKey = '';   // claude.ai room lobby has its own change check
  if (!NET.room){
    p.appendChild(el('p',null,`You'll play as ${SAVE().name}. Make a room and send the code to friends, or type their code to join. Empty places are filled with bots.`));
    const mk = el('button','btn green','CREATE ROOM'); mk.style.width='100%';
    mk.onclick = async () => { mk.disabled=true; try{ await openRoom(newCode(), true, lobbyMe()); }catch(e){ toast("Couldn't open a room right now"); } renderOnline(); };
    p.appendChild(mk);
    p.appendChild(el('p',null,'— or —')).style.textAlign='center';
    const inp = el('input','txt'); inp.maxLength=4; inp.placeholder='CODE'; p.appendChild(inp);
    const jn = el('button','btn blue','JOIN ROOM'); jn.style.cssText='width:100%;margin-top:8px';
    jn.onclick = async () => { const c = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if (c.length!==4){ toast('Codes have 4 letters'); return; } jn.disabled=true; try{ await openRoom(c, false, lobbyMe()); }catch(e){ toast("Couldn't join that room"); } renderOnline(); };
    p.appendChild(jn);
    return;
  }
  p.appendChild(el('p',null,'Room code — tell your friends:'));
  p.appendChild(el('div','code',NET.code));
  const myPres = NET.my && NET.my.presence || {};
  const seg = el('div','seg');
  for (const [k,l] of [['P','🚓 Police'],['R','🎲 Any'],['T','🏃 Thief']]){ const b=el('button',null,l); b.dataset.side=k; b.classList.toggle('on', (myPres.tm||'R')===k); b.onclick=()=>{ setPresence({ tm:k }); SAVE().side=k; M.persist(); setTimeout(renderOnline,120); }; seg.appendChild(b); }
  p.appendChild(seg);
  const list = el('div','plist');
  const ps = livePeers();
  for (const pr of ps){
    const r = el('div','pl'); r.appendChild(el('span',null,(pr.presence.host?'👑 ':'')+String(pr.presence.n||'Player').slice(0,16)+(pr.sameTab?' (you)':'')));
    const tm = pr.presence.tm||'R'; r.appendChild(el('span','t t'+tm, tm==='P'?'POLICE':tm==='T'?'THIEF':'ANY'));
    list.appendChild(r);
  }
  for (let i=ps.length;i<8;i++){ const r=el('div','pl'); r.style.opacity=.4; r.appendChild(el('span',null,'🤖 Bot')); list.appendChild(r); }
  p.appendChild(list);
  if (NET.isHost){
    const go = el('button','btn green','START MATCH'); go.style.width='100%'; go.onclick = startHost; p.appendChild(go);
  } else p.appendChild(el('p',null,'Waiting for the host to start…')).style.textAlign='center';
}
const lobbyMe = () => ({ name: SAVE().name, side: SAVE().side, looks: SAVE().looks });
let lobbyKey = '';
NET.onChange = (why) => {
  if (why==='lost'){ toast('Lost the room connection'); lobbyKey=''; }
  if (mode!=='online') return;
  // only redraw the lobby when who's in it actually changed (keeps buttons and typing stable)
  const k = (NET.room?NET.code:'-') + '|' + NET.isHost + '|' + livePeers().map(p => p.peer+p.presence.n+p.presence.tm+(p.presence.host?1:0)).join(',');
  if (k !== lobbyKey){ lobbyKey = k; renderOnline(); }
};

// ------------------------------------------------------------------ input
const keys = {}, ctl = { held:false, press:false, ab:false, run:false };
const J = { on:false, id:null, ox:0, oy:0, dx:0, dy:0 };
addEventListener('keydown', e => {
  if (e.code==='Escape' && mode==='match'){ togglePause(); return; }
  if (mode!=='match') return;
  if ((e.code==='Space'||e.code==='KeyE') && !e.repeat) ctl.press = true;
  if (e.code==='KeyQ' && !e.repeat) ctl.ab = true;
  if (['Digit1','Digit2','Digit3'].includes(e.code)) quickChat(+e.code.slice(-1)-1);
  keys[e.code] = true; if (e.code.startsWith('Arrow')||e.code==='Space') e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k]=false; ctl.held=false; J.on=false; });
const jz = $('joyZone');
jz.addEventListener('pointerdown', e => { e.preventDefault(); if (J.on) return; J.on=true; J.id=e.pointerId; J.ox=e.clientX; J.oy=e.clientY; J.dx=J.dy=0; jz.setPointerCapture(e.pointerId); });
jz.addEventListener('pointermove', e => { if (!J.on || e.pointerId!==J.id) return; let dx=(e.clientX-J.ox)/50, dy=(e.clientY-J.oy)/50; const m=Math.hypot(dx,dy); if (m>1){ J.ox += (dx/m)*(m-1)*50; J.oy += (dy/m)*(m-1)*50; dx/=m; dy/=m; } J.dx=dx; J.dy=dy; });
const jEnd = e => { if (e.pointerId===J.id){ J.on=false; J.dx=J.dy=0; } };
jz.addEventListener('pointerup', jEnd); jz.addEventListener('pointercancel', jEnd);
const ba = $('bAct');
ba.addEventListener('pointerdown', e => { e.preventDefault(); ctl.held=true; ctl.press=true; try{ ba.setPointerCapture(e.pointerId); }catch(_){} });
ba.addEventListener('pointerup', () => ctl.held=false); ba.addEventListener('pointercancel', () => ctl.held=false);
$('bAbil').addEventListener('pointerdown', e => { e.preventDefault(); ctl.ab = true; });
$('bRun').addEventListener('pointerdown', e => { e.preventDefault(); ctl.run = !ctl.run; $('bRun').classList.toggle('on', ctl.run); });
function readInput(){
  let mx=0, my=0;
  if (keys.KeyW||keys.ArrowUp) my-=1; if (keys.KeyS||keys.ArrowDown) my+=1;
  if (keys.KeyA||keys.ArrowLeft) mx-=1; if (keys.KeyD||keys.ArrowRight) mx+=1;
  if (J.on){ mx=J.dx; my=J.dy; }
  const inp = { mx, my, sprint: !!(keys.ShiftLeft||keys.ShiftRight||ctl.run), action: !!(keys.Space||keys.KeyE||ctl.held), press: ctl.press, ability: ctl.ab };
  ctl.press = false; ctl.ab = false;
  return inp;
}
let chatSeq = 0;
function quickChat(i){
  if (!MC) return;
  const me = MC.ents()[MC.meId]; const t = CHAT[me.team][i];
  bubble(me.id, t); feed(`You: ${t}`, '#ddd');
  if (MC.kind==='host'){ chatSeq++; setPresence({ cm:[chatSeq, i] }); }
  else if (MC.kind==='guest') MC.src.chat(i);
}
function buildChat(team){
  const c=$('chat'); c.innerHTML='';
  CHAT[team].forEach((t,i) => { const b=el('button',null,t); b.addEventListener('pointerdown', ev => { ev.preventDefault(); quickChat(i); }); c.appendChild(b); });
}

// ------------------------------------------------------------------ match setup
function prepViews(ents){
  for (const e of ents) if (!e.look) e.look = M.randomLook(e.team);
}
// ---- locations
function useMap(id){ if (!MAPS[id]) id = 'street'; if (MAP.id !== id){ setMap(id); S.rebuildWorld(); } }
function pickMap(){ const m = SAVE().map; return MAPS[m] ? m : MAP_IDS[Math.random()*MAP_IDS.length|0]; }
function buildMapSeg(){
  const seg = $('mapSeg'); seg.innerHTML = '';
  for (const id of [...MAP_IDS, 'random']){
    const b = el('button', null, id==='random' ? '🎲 Any' : `${MAPS[id].icon} ${MAPS[id].short || MAPS[id].name}`); b.title = id==='random' ? 'Random' : MAPS[id].name;
    b.classList.toggle('on', (SAVE().map||'street')===id);
    b.onclick = () => { SAVE().map = id; M.persist(); sfx('tap'); if (MAPS[id]){ useMap(id); S.showroom(SAVE().looks); } buildMapSeg(); };
    seg.appendChild(b);
  }
  const m = MAPS[SAVE().map];
  $('mapInfo').textContent = m ? `${m.name}: ${m.blurb}` : 'Random: a different location every game';
}
function startSolo(side, night){
  initAudio();
  const map = pickMap(); useMap(map);
  newMatch({ slots:[{ team:side, ctrl:'local', name:SAVE().name }], night, diff: M.soloDifficulty(), map });
  const me = G.ents.find(e => e.ctrl==='local');
  me.look = SAVE().looks[me.team];
  prepViews(G.ents);
  beginMatch({ kind:'solo', meId: me.id, side, ents: () => G.ents, state: () => G });
}
function beginMatch(ctx){
  MC = { ...ctx, lastEv: 0, acc: 0, overAt: 0, bubbles: new Map(), awarded: false, dustT: 0 };
  const st = MC.state(); const me = MC.ents()[MC.meId];
  S.hideShowroom(); S.clearViews(); S.setNight(!!st.night);
  S.snapCamera(me.x, me.y);
  ctl.run = false; $('bRun').classList.remove('on'); $('feed').innerHTML='';
  $('abIcon').textContent = me.team==='P' ? '📯' : '💨'; $('abName').textContent = me.team==='P' ? 'WHISTLE' : 'DASH';
  buildChat(me.team);
  setMode('match');
  announce(me.team==='P' ? 'YOU ARE POLICE — COUNT!' : 'YOU ARE A THIEF — HIDE!', me.team==='P'?'#7db8ff':'#ffb347', 2.2);
  if (st.night) setTimeout(() => announce('🌙 NEPA TOOK LIGHT!', '#ffd84d', 1.8), 2300);
  feed(`📍 ${MAP.name}`, '#fff');
  $('ctrl').classList.toggle('cop', me.team==='P');
  ADS.gameplay(true);
}

// host: everyone in the room becomes a player; bots fill the rest
function startHost(){
  const ps = livePeers().slice(0,8);
  const slots = ps.map(p => ({ team: p.presence.tm||'R', ctrl: p.sameTab?'local':'remote', name: String(p.presence.n||'Player').slice(0,16), peer: p.peer, lk: p.presence.lk }));
  // balance: if one side is over-subscribed, newMatch moves people across
  const map = pickMap(); useMap(map);
  newMatch({ slots, map });
  for (const e of G.ents){ if (e.ctrl!=='bot'){ const s = slots.find(x => x.peer===e.peer); e.look = s && s.lk && s.lk[e.team] ? sanitizeLook(s.lk[e.team]) : M.randomLook(e.team); } }
  prepViews(G.ents);
  const me = G.ents.find(e => e.ctrl==='local');
  const gid = Math.random().toString(36).slice(2,8);
  MC_hostRemote = {};
  setPresence({ st:'game', g:{ gid, r: rosterOf(G), map: G.map }, s: packState(G) });
  beginMatch({ kind:'host', meId: me.id, gid, ents: () => G.ents, state: () => G });
}
let MC_hostRemote = {};
function sanitizeLook(l){
  const o = {}; for (const k of ['skin','outfit','head','eyes','extra','shoes']) o[k] = (typeof l[k]==='string' || typeof l[k]==='number') ? l[k] : 0; return o;
}
function remoteInput(e){
  const pres = peerPresence(e.peer);
  const R = MC_hostRemote[e.id] || (MC_hostRemote[e.id] = { ps:0, ab:0, cm:0, lost:0 });
  if (!pres || !pres.in){
    R.lost += 1/60; if (R.lost > 4){ e.ctrl = 'bot'; feed(`${e.name} left — a bot takes over`, '#aaa'); }
    return { mx:0, my:0 };
  }
  R.lost = 0;
  const i = pres.in;
  const out = { pos: Array.isArray(i.p) ? [+i.p[0]||e.x, +i.p[1]||e.y] : null, vel: i.v, face: i.f, sprint: !!i.sp, action: !!i.act,
    press: (i.ps|0) > R.ps, ability: (i.ab|0) > R.ab, mx:0, my:0 };
  R.ps = Math.max(R.ps, i.ps|0); R.ab = Math.max(R.ab, i.ab|0);
  if (pres.cm && pres.cm[0] > R.cm){ R.cm = pres.cm[0]; const t = CHAT[e.team][pres.cm[1]|0]; if (t) bubble(e.id, t); }
  return out;
}

// guest: mirror a match run somewhere else (a friend's page, or the game server)
let guest = null;
function startMirror(roster, gid, isMine, snap, src, map){
  useMap(map);
  const ents = roster.map(([id,team,name,look,peer]) => ({ id, team, name:String(name).slice(0,16), look: look ? sanitizeLook(look) : M.randomLook(team), peer,
    x:0,y:0,fx:0,fy:1,state:'free',speed:0,wallet:0,stats:{caps:0,rescues:0,escaped:0,caught:0,dodges:0,abil:0,goals:0,cash:0,buys:0} }));
  const meE = typeof isMine==='number' ? ents[isMine] : ents.find(isMine);
  if (!meE) return false;
  const Mst = { ents, events:[], pickups:[], notes:[], ball:{ x:BALL_HOME.x, y:BALL_HOME.y }, herd:{ p:-1 }, shown:{ P:0, T:0 }, bellCd:0, map:MAP.id, playT:0, phase:'count', countT:CFG.headStart, exitsOpen:false, escaped:0, alarm:null, night:false, over:null };
  if (snap) applySnapshot(Mst, snap);
  guest = { M: Mst, me: { x:meE.x, y:meE.y, vx:0, vy:0, fx:0, fy:-1, stam:100, tired:false, stDelay:0, abCd:0, dashT:0, ps:0, ab:0, prevState:'free' }, lastS: null, hostGone: 0 };
  beginMatch({ kind:'guest', meId: meE.id, gid, src, ents: () => guest.M.ents, state: () => guest.M });
  return true;
}
// a friend hosting through the claude.ai room
const roomSrc = {
  name:'room',
  live(){ const h = hostPresence(); return h && h.presence.st==='game' && h.presence.g && MC && h.presence.g.gid===MC.gid ? h.presence : null; },
  snapshot(){ const p = this.live(); return p ? p.s : null; },
  sendInput(o){ setPresence({ in:o }); },
  chat(i){ chatSeq++; setPresence({ cm:[chatSeq, i] }); },
};
function guestWatch(){
  if (!NET.room || NET.isHost) return;
  const h = hostPresence(); if (!h) return;
  const hp = h.presence;
  if (hp.st==='game' && hp.g && hp.g.r && (!MC || MC.gid!==hp.g.gid) && mode!=='res'){
    const myPeer = NET.my && NET.my.peer;
    startMirror(hp.g.r, hp.g.gid, e => e.peer===myPeer, hp.s, roomSrc, hp.g.map);
  }
}
// the public game server
const srvSrc = {
  name:'srv',
  live(){ return SRV.status==='on' && SRV.game && MC && SRV.game.gid===MC.gid; },
  snapshot(){ return SRV.lastS; },
  sendInput(o){ srvSend({ t:'in', ...o }); },
  chat(i){ srvSend({ t:'chat', i }); },
};
SRV.onChat = (id, i) => { if (MC && MC.kind==='guest' && MC.src===srvSrc){ const e = MC.ents()[id]; if (e && e.id!==MC.meId){ const t = CHAT[e.team][i]; if (t) bubble(e.id, t); } } };
function serverWatch(){
  if (SRV.status!=='on' || !SRV.game) return;
  if ((!MC || MC.gid!==SRV.game.gid) && mode!=='res' && SRV.game.me>=0){
    startMirror(SRV.game.roster, SRV.game.gid, SRV.game.me, SRV.lastS, srvSrc, SRV.game.map);
  }
}
function guestPredict(dt, inp){
  const g = guest, me = g.me, e = g.M.ents[MC.meId];
  if (e.hx === undefined) return;     // wait for the first snapshot so we know where we are
  const hostState = e.state;
  if (hostState !== 'free'){ me.x = e.x; me.y = e.y; me.prevState = hostState; return; }
  const hx = e.hx ?? e.x, hy = e.hy ?? e.y;
  if (me.prevState !== 'free' || Math.hypot(me.x-hx, me.y-hy) > 3.2){ me.x = hx; me.y = hy; }
  me.prevState = 'free';
  me.abCd = Math.max(0, me.abCd-dt); me.dashT = Math.max(0, me.dashT-dt);
  const frozen = (g.M.phase==='count' && e.team==='P') || e.freeze;
  let mx = frozen?0:inp.mx, my = frozen?0:inp.my, mag = Math.hypot(mx,my); if (mag>1){ mx/=mag; my/=mag; mag=1; }
  if (inp.ability && me.abCd<=0 && g.M.phase==='play'){ me.ab++; me.abCd = e.team==='T' ? CFG.dashCd : CFG.whistleCd; if (e.team==='T') me.dashT = CFG.dashTime; }
  let spd = (e.team==='P'?CFG.walkP:CFG.walkT)*mag, sprinting=false;
  if (me.stam<=1) me.tired=true; else if (me.stam>=30) me.tired=false;
  if (inp.sprint && mag>.2 && me.stam>0 && !me.tired){ spd=(e.team==='P'?CFG.sprintP:CFG.sprintT)*Math.max(mag,.85); me.stam=Math.max(0,me.stam-(e.team==='P'?CFG.drainP:CFG.drainT)*dt); me.stDelay=.8; sprinting=true; }
  else { me.stDelay-=dt; if (me.stDelay<=0) me.stam=Math.min(100, me.stam+(e.team==='P'?CFG.regenP:CFG.regenT)*dt); }
  if (e.reassigned) spd*=.55; if (e.slowT) spd*=.6; if (e.immune) spd*=1.1; if (e.boostT) spd*=CFG.zoboBoost;
  if (e.fullT) me.stam = Math.max(me.stam, 100);
  let tx=mx*spd, ty=my*spd;
  if (me.dashT>0){ const fl=Math.hypot(me.fx,me.fy)||1; tx=me.fx/fl*CFG.dashSpeed; ty=me.fy/fl*CFG.dashSpeed; }
  const k=Math.min(1,dt*16); me.vx += (tx-me.vx)*k; me.vy += (ty-me.vy)*k; if (me.dashT>0){ me.vx=tx; me.vy=ty; }
  const ox=me.x, oy=me.y; me.x += me.vx*dt; me.y += me.vy*dt; collide(me);
  if (g.M.herd && g.M.herd.p >= 0) pushFromHerd(me, g.M.herd.p);
  const rvx=(me.x-ox)/dt, rvy=(me.y-oy)/dt;
  if (mag>.1 && me.dashT<=0){ me.fx=mx/mag; me.fy=my/mag; }
  if (inp.press) me.ps++;
  e.x=me.x; e.y=me.y; e.fx=me.fx; e.fy=me.fy; e.speed=Math.hypot(rvx,rvy); e.sprinting=sprinting; e.stam=me.stam; e.abCd=me.abCd; e.dashT=me.dashT;
  e.hidden = e.team==='T' && !sprinting && me.dashT<=0 && inHide(me.x,me.y);
  MC.src.sendInput({ p:[+me.x.toFixed(2), +me.y.toFixed(2)], v:[+rvx.toFixed(1), +rvy.toFixed(1)], f:[+me.fx.toFixed(2), +me.fy.toFixed(2)], sp:sprinting?1:0, act:inp.action?1:0, ps:me.ps, ab:me.ab });
}

// ------------------------------------------------------------------ events -> feedback
const nm = id => { const e = MC.ents()[id]; return e ? (e.id===MC.meId ? 'You' : e.name) : '?'; };
function handleEvent(v){
  const me = MC.ents()[MC.meId], ents = MC.ents();
  const isMe = id => id===MC.meId;
  const shakeOn = SAVE().settings.shake;
  switch (v.type){
    case 'tick': sfx('tick'); if (me.team==='P') announce(`COUNTING… ${v.a}`, '#7db8ff', .8); else announce(`HIDE! ${v.a}`, '#ffb347', .8); break;
    case 'go': sfx('go'); announce(me.team==='P' ? 'GO! CATCH THEM!' : 'THEY\'RE COMING!', '#ffd84d', 1.4); break;
    case 'exits': sfx('chime'); announce('EXITS OPEN!', '#5dff8a', 2); feed('All four corner exits are open', '#5dff8a'); break;
    case 'grab': if (isMe(v.b)) sfx('warn'); break;
    case 'whiff': if (isMe(v.a)) sfx('miss'); break;
    case 'noarrest': if (isMe(v.a)) toast("Reassigned: you can't arrest yet"); break;
    case 'dodge': { const t=ents[v.b]; if (isMe(v.b)) announce('DODGED!', '#5dff8a', .9); if (isMe(v.a)) announce('MISSED!', '#ff9f43', .8); if (isMe(v.a)||isMe(v.b)) sfx('miss'); break; }
    case 'catch': {
      const t = ents[v.b]; sfx('whistle'); S.fx('stars', t.x, t.y);
      feed(`${nm(v.a)} caught ${nm(v.b)}!`, '#7db8ff');
      if (isMe(v.b)){ announce('CAUGHT! WAIT FOR RESCUE', '#ff6b6b', 2); if (shakeOn) S.addShake(.7); buzz(200); }
      if (isMe(v.a)){ announce('GOT ONE! +25 XP', '#7db8ff', 1.3); if (shakeOn) S.addShake(.35); buzz(60); }
      break; }
    case 'escorted': if (isMe(v.a)){ const e=ents[v.a]; S.snapCamera(e.x, e.y); } break;
    case 'alarm': sfx('alarm'); feed(`ALARM! ${nm(v.a)} is at the ${GATES[v.b].name}`, '#ff6b6b'); if (me.team==='P') announce('🚨 RESCUE AT THE POST!', '#ff6b6b', 1.4); break;
    case 'free': {
      const g = GATES[v.c]; sfx('chime'); S.fx('burst', g.x, g.y);
      feed(`${nm(v.a)} freed ${v.b} from the Post!`, '#ffd84d');
      if (isMe(v.a)) announce(`FREED ${v.b}! +${v.b*30} XP`, '#ffd84d', 1.4);
      else if (me.team==='T' && MC.wasJailed) announce("YOU'RE FREE — RUN!", '#5dff8a', 1.6);
      if (me.team==='P') { if (shakeOn) S.addShake(.2); }
      break; }
    case 'escape': { const e=ents[v.a]; sfx('chime'); S.fx('burst', e.x, e.y, 0x5dff8a); feed(`${nm(v.a)} escaped through ${EXITS[v.b].name}!`, '#5dff8a'); if (isMe(v.a)) announce('YOU ESCAPED! 🏁', '#5dff8a', 2); break; }
    case 'reassign': sfx('radio'); feed(`${nm(v.a)} camped the Post — reassigned`, '#ff9f43'); if (isMe(v.a)) announce('REASSIGNED! NO CAMPING', '#ff9f43', 1.6); break;
    case 'whistle': { const e=ents[v.a]; sfx('bigwhistle'); S.fx('whistle', e.x, e.y); if (isMe(v.a)) toast(v.b ? `Whistle slowed ${v.b} thief${v.b>1?'s':''}!` : 'Whistle! Nobody close enough'); else if (me.team==='T' && dist(me,e) < CFG.whistleRange) announce('📯 WHISTLE! SLOWED', '#9fd8ff', .9); break; }
    case 'dash': { const e=ents[v.a]; sfx('swoosh'); S.fx('dash', e.x, e.y); break; }
    case 'say': { const L = LINES[v.b]; if (L && L[v.c]) bubble(v.a, L[v.c]); break; }
    case 'note': if (isMe(v.a)){ sfx('coin'); } break;
    case 'herd': sfx('moo'); feed('🐄 Cattle crossing! The herdsman has right of way', '#ffd84d'); announce('🐄 CATTLE CROSSING!', '#ffd84d', 1.5); break;
    case 'bell': { sfx('bell'); const mine = ents[v.a].team===me.team; feed(`🔔 ${nm(v.a)} rang the school bell`, '#ffd84d'); announce(mine ? '🔔 BELL! THEY ARE ON YOUR MAP' : '🔔 BELL! THEY CAN SEE YOU', mine ? '#5dff8a' : '#ff6b6b', 1.6); break; }
    case 'bellwait': if (isMe(v.a)) toast('The bell was just rung. Give it a moment'); break;
    case 'gap': { const e=ents[v.a]; sfx('swoosh'); S.fx('dash', e.x, e.y); if (isMe(v.a)){ S.snapCamera(e.x, e.y); announce('🕳 THROUGH THE FENCE!', '#7db8ff', 1); } break; }
    case 'broke': if (isMe(v.a)){ const s=SHOPS[v.b]; sfx('miss'); toast(`${s.item} is ₦${s.price}. Pick up the green ₦ notes on the street`); } break;
    case 'buy': {
      const e=ents[v.a], s=SHOPS[v.b]; S.fx('burst', s.x, s.y, 0x35e0a1);
      if (isMe(v.a)){
        sfx('coin'); buzz(30);
        const what = { full:'BELLE FULL: NO TIRING', water:'STAMINA UP', boost:'SPEED UP!', ready:(me.team==='P'?'WHISTLE':'DASH')+' READY' }[s.fx];
        announce(`${s.icon} ${s.item.toUpperCase()}: ${what}`, '#35e0a1', 1.3);
        if (MC.kind==='guest' && guest){ if (s.fx==='full') guest.me.stam=100; else if (s.fx==='water') guest.me.stam=Math.min(100,guest.me.stam+60); else if (s.fx==='ready') guest.me.abCd=0; guest.me.tired=false; }
      } else bubble(v.a, ['Thank you ma!','Keep the change','Na so!'][v.id%3]);
      break; }
    case 'kick': if (isMe(v.a) || dist(me, MC.state().ball||me) < 9) sfx('kick'); break;
    case 'goal': {
      const gz = v.b ? 33.4 : 22.6; S.fx('goal', 33, gz); sfx('goal');
      if (v.a>=0){ feed(`⚽ GOAL! ${nm(v.a)} scores (+₦${CFG.goalCash})`, '#ffd84d'); if (isMe(v.a)){ announce('⚽ GOOOAL! +₦'+CFG.goalCash, '#ffd84d', 1.8); buzz(120); if (SAVE().settings.shake) S.addShake(.3); } else if (dist(me,{x:33,y:gz})<14) announce('⚽ GOAL!', '#ffd84d', 1); }
      break; }
    case 'pickup': { const e=ents[v.a]; S.fx('burst', e.x, e.y, v.b ? 0xff4f7a : 0xffc46b); if (isMe(v.a)){ sfx('coin'); announce(v.b ? '🥤 ZOBO BOOST!' : '🍞 AGEGE BREAD: FULL STAMINA', v.b?'#ff6f91':'#ffc46b', 1.1); } break; }
  }
}
function bubble(id, text){ MC.bubbles.set(id, { text, t: 2.6 }); }

// ------------------------------------------------------------------ results
function finishMatch(){
  ADS.gameplay(false);
  const st = MC.state(), me = MC.ents()[MC.meId];
  const won = st.over.win === me.team;
  const award = M.awardMatch({ team: me.team, won, stats: me.stats, night: !!st.night, online: MC.kind!=='solo' });
  MC.award = award;
  $('resSub').textContent = won ? 'Your team won' : 'Your team lost';
  $('resTitle').textContent = st.over.win==='P' ? '🚓 POLICE WIN' : '🏃 THIEVES WIN';
  $('resTitle').style.color = st.over.win==='P' ? '#7db8ff' : '#ffb347';
  $('resReason').textContent = `${REASONS[st.over.reason]} · ${fmt(st.playT)} played`;
  const lines = $('resLines'); lines.innerHTML='';
  award.lines.forEach((l,i) => { const r=el('div','rl'); r.appendChild(el('span',null,l[0])); r.appendChild(el('span',null,`+${l[1]} XP${l[2]?`  +₦${l[2]}`:''}`)); lines.appendChild(r); setTimeout(()=>{ r.classList.add('in'); sfx('tap'); }, 300+i*250); });
  const s = SAVE();
  const lv = $('resLv'); lv.innerHTML='';
  if (award.levelUps){ lv.appendChild(el('div','lvup',`LEVEL UP! ${s.level}  (+₦${award.levelUps*100})`)); setTimeout(()=>sfx('chime'), 400+award.lines.length*250); }
  const bar = el('div','xpbar'); bar.style.width='100%'; const fill=el('i'); fill.style.width='0'; bar.appendChild(fill); lv.appendChild(bar);
  lv.appendChild(el('div','rank',`Level ${s.level} · ${M.rankName(me.team,s.level)} · ₦${s.coins}`));
  setTimeout(()=> fill.style.width = Math.round(s.xp/M.xpForLevel(s.level)*100)+'%', 200+award.lines.length*250);
  const mis = $('resMis'); mis.innerHTML='';
  for (const m of award.done){ mis.appendChild(el('div','rl in',`✅ Mission done: ${m.text} — claim ₦${m.reward} on the home screen`)); }
  if (award.passUps>0) mis.appendChild(el('div','rl in',`🎟 Street Pass: +${award.passUps} tier${award.passUps>1?'s':''} — claim your rewards`));
  for (const a of award.newAch){ a.seen = true; mis.appendChild(el('div','rl in',`🏆 Trophy unlocked: ${a.name} — claim ₦${a.reward}`)); }
  if (ADS.rewardedAvailable() && award.coins>0){
    const db = el('button','btn gold',`▶ Watch an ad: double ₦${award.coins}`); db.style.cssText='width:100%;margin-top:8px;font-size:13px';
    db.onclick = async () => { db.disabled=true; const ok = await ADS.rewarded(); if (ok){ SAVE().coins += award.coins; M.persist(); sfx('coin'); toast(`+₦${award.coins}!`); db.remove(); } else { db.disabled=false; toast('No ad right now, try again later'); } };
    mis.appendChild(db);
  }
  const next = s.missions.list.find(m => !m.done);
  if (next) mis.appendChild(el('p',null,`Next mission: ${next.text} (${next.prog}/${next.goal})`));
  const tb = $('resTable'); tb.innerHTML='';
  const hr = el('tr'); for (const h of ['Player','Side','Catch','Freed','Caught','Out']) hr.appendChild(el('th',null,h)); tb.appendChild(hr);
  for (const e of MC.ents()){ const r=el('tr', e.id===MC.meId?'me':''); for (const v of [e.id===MC.meId?'You':e.name, e.team==='P'?'Police':'Thief', e.team==='P'?e.stats.caps:'–', e.team==='T'?e.stats.rescues:'–', e.team==='T'?e.stats.caught:'–', e.team==='T'?(e.stats.escaped?'✔':''):'–']) r.appendChild(el('td',null,String(v))); tb.appendChild(r); }
  $('bAgain').textContent = MC.kind==='solo' ? 'PLAY AGAIN' : 'BACK TO ROOM';
  sfx(won ? 'chime' : 'lose');
  setMode('res');
}
$('bAgain').onclick = async () => {
  if (MC && MC.kind==='solo'){ await ADS.breakBetweenGames(); startSolo(SAVE().side); return; }
  if (NET.isHost) setPresence({ st:'lobby', g:null, s:null, in:null });
  S.clearViews(); S.showroom(SAVE().looks); MC = null; setMode('online');
};
$('bHome').onclick = async () => { if (MC && MC.kind!=='solo'){ if (NET.isHost) setPresence({ st:'lobby', g:null, s:null }); } goHome(); };

// ------------------------------------------------------------------ pause
function togglePause(){ if (mode!=='match') return; const on = $('pause').classList.contains('hidden'); show('pause', on); if (MC) MC.paused = on && MC.kind==='solo'; syncPauseBtns(); }
function syncPauseBtns(){ $('bShake').textContent = 'Screen shake: '+(SAVE().settings.shake?'ON':'OFF'); $('bMusic').textContent = 'Music: '+(musicOn?'ON':'OFF'); $('bMute').textContent = SAVE().settings.sound?'🔊':'🔇'; }
$('bPause').onclick = togglePause; $('bResume').onclick = togglePause;
$('bShake').onclick = () => { SAVE().settings.shake = !SAVE().settings.shake; M.persist(); syncPauseBtns(); };
$('bMusic').onclick = () => { musicOn = !musicOn; SAVE().settings.music = musicOn; M.persist(); syncPauseBtns(); };
$('bMute').onclick = () => { SAVE().settings.sound = !SAVE().settings.sound; M.persist(); syncPauseBtns(); };
$('bQuit').onclick = () => { show('pause', false); if (MC && MC.kind==='host') setPresence({ st:'lobby', g:null, s:null }); if (MC && MC.kind!=='solo'){ S.clearViews(); MC=null; setMode('online'); } else goHome(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode==='match' && MC && MC.kind==='solo' && !MC.paused) togglePause(); });

// ------------------------------------------------------------------ HUD
const fmt = s => { s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const tagEls = new Map();
function updateHUD(dt, t){
  const st = MC.state(), ents = MC.ents(), me = ents[MC.meId];
  $('tTime').textContent = st.phase==='count' ? fmt(CFG.matchTime) : fmt(CFG.matchTime - st.playT);
  $('tTime').style.color = (CFG.matchTime-st.playT)<30 && st.phase!=='count' ? '#ff6b6b' : '#fff';
  $('tSub').textContent = st.phase==='count' ? `POLICE COUNTING ${Math.ceil(st.countT)}` : st.exitsOpen ? `EXITS OPEN · ${st.escaped}/${CFG.escapesToWin} OUT` : `EXITS OPEN IN ${fmt(CFG.exitsOpenAt - st.playT)}`;
  const pips = $('pips'); if (pips.children.length!==4){ pips.innerHTML=''; for (let i=0;i<4;i++) pips.appendChild(document.createElement('i')); }
  ents.filter(e=>e.team==='T').forEach((e,i) => { const p=pips.children[i]; const c = e.state==='escaped'?'#ffd84d':e.state==='free'?'#3ddc84':'#555'; p.style.background=c; p.textContent = e.state==='escaped'?'🏁':(e.state==='jailed'||e.state==='arrest')?'⛓':''; p.style.outline = e.id===MC.meId?'2px solid #fff':''; });
  // action button
  let lab='ACTION', sub='', on=false;
  if (me.team==='P'){ lab='CATCH'; sub='automatic'; on = me.state==='free' && !me.reassigned && !(me.capCd>0) && !!nearestFor(me); if (me.reassigned) sub='reassigned'; }
  else if (me.state==='jailed'||me.state==='arrest'){ lab='WAIT'; sub='for rescue'; }
  else if (me.state==='escaped') lab='SAFE';
  else if (gateNear(me)>=0 && ents.some(e=>e.team==='T'&&e.state==='jailed')){ lab='FREE'; sub='hold'; on=true; }
  else if (st.exitsOpen && inExit(me)>=0){ lab='ESCAPE'; sub='hold'; on=true; }
  if (MAP.bell && me.state==='free' && Math.hypot(me.x-MAP.bell.x, me.y-MAP.bell.y) < 1.7 && !(me.team==='P' && on)){ const cd = Math.ceil(st.bellCd||0); lab='RING'; sub = cd ? `wait ${cd}s` : 'school bell'; on = !cd; }
  const si = me.state==='free' && lab!=='RING' ? shopNear(me) : -1;
  if (si>=0 && lab!=='FREE' && lab!=='ESCAPE' && !(me.team==='P' && on)){ const s=SHOPS[si]; lab='BUY'; sub=`${s.item} ₦${s.price}`; on = (me.wallet|0) >= s.price; }
  if (MC.wal !== (me.wallet|0)){ MC.wal = me.wallet|0; $('wallet').textContent = '₦'+MC.wal; $('wallet').classList.remove('pop'); void $('wallet').offsetWidth; $('wallet').classList.add('pop'); }
  const key = lab+sub+on;
  if (MC.actKey !== key){ MC.actKey = key; $('bAct').innerHTML = lab + (sub?`<small>${sub}</small>`:''); $('bAct').classList.toggle('on', on); $('bAct').classList.toggle('cop', me.team==='P'); }
  const cdMax = me.team==='T' ? CFG.dashCd : CFG.whistleCd;
  $('bAbil').querySelector('.cd').style.setProperty('--p', Math.round((me.abCd||0)/cdMax*100)+'%');
  $('stamBar').firstChild.style.width = Math.round(me.stam??100)+'%';
  $('stamBar').firstChild.style.background = me.tired ? '#ff9f43' : '#3ddc84';
  const hint = $('hint');
  if (me.team==='T' && me.hidden && me.state==='free'){ hint.textContent='🌿 HIDDEN — walk, don\'t sprint'; show('hint'); }
  else if (me.state==='jailed'){ hint.textContent='⛓ In the Post. Quick-chat "Help me!"'; show('hint'); }
  else if (me.team==='P' && me.camp>.3){ hint.textContent='⚠ Leave the orange ring or Oga will reassign you'; show('hint'); }
  else show('hint', false);
  if (me.state==='jailed') MC.wasJailed = true; else if (me.state==='free' && MC.wasJailed && !MC.freeShown) MC.wasJailed = false;
  drawMini(st, ents, me);
  // name tags, bubbles, progress rings
  for (const [id,b] of MC.bubbles){ b.t -= dt; if (b.t<=0) MC.bubbles.delete(id); }
  for (const e of ents){
    let elT = tagEls.get(e.id);
    if (!elT){ elT = el('div','nt '+e.team+(e.id===MC.meId?' me':'')); elT.innerHTML='<div class="ex"></div><div class="ring"></div><span class="bub"></span><span class="n"></span>'; elT.querySelector('.n').textContent = e.id===MC.meId ? 'YOU' : e.name; $('tags').appendChild(elT); tagEls.set(e.id, elT); }
    const vp = S.viewPos(e.id);
    if (!vp || !vp.vis || e.state==='escaped'){ elT.style.display='none'; continue; }
    const [sx, sy, front] = S.project(vp.x, vp.y, 2.15);
    if (!front || sx<-40 || sy<-40 || sx>innerWidth+40 || sy>innerHeight+40){ elT.style.display='none'; continue; }
    elT.style.display=''; elT.style.left=sx+'px'; elT.style.top=sy+'px';
    const b = MC.bubbles.get(e.id), bub = elT.querySelector('.bub');
    if (b){ bub.style.display=''; bub.textContent=b.text; } else bub.style.display='none';
    const ring = elT.querySelector('.ring');
    if (e.rescueProg>0){ ring.style.display=''; ring.style.setProperty('--p', Math.round(e.rescueProg/CFG.rescueTime*100)+'%'); ring.style.setProperty('--c','#ffd84d'); }
    else if (e.escProg>0){ ring.style.display=''; ring.style.setProperty('--p', Math.round(e.escProg/CFG.escapeTime*100)+'%'); ring.style.setProperty('--c','#5dff8a'); }
    else ring.style.display='none';
    const grabbed = ents.some(c => c.team==='P' && c.windup>0 && c.wTarget===e.id);
    elT.querySelector('.ex').textContent = grabbed ? '!' : '';
  }
}
function nearestFor(me){
  let best=null, bd=CFG.captureRange;
  for (const t of MC.ents()) if (t.team==='T' && t.state==='free' && !(t.immune>0) && dist(me,t)<=bd){ bd=dist(me,t); best=t; }
  return best;
}
const mini = $('mini'), mg = mini.getContext('2d');
import { herdAt as herdDots0 } from './world.js';
const herdDots = p => herdDots0(p) || [];
function drawMini(st, ents, me){
  const s = mini.width/W;
  mg.clearRect(0,0,mini.width,mini.height);
  mg.fillStyle='rgba(140,90,52,.85)'; mg.fillRect(0,0,mini.width,mini.height);
  mg.fillStyle='#3a3a3f'; for (const r of ROADS) mg.fillRect(r.x*s, r.y*s, r.w*s, r.h*s);
  mg.fillStyle='#e6ddd0'; for (const o of OB) mg.fillRect(o.x*s,o.y*s,o.w*s,o.h*s);
  mg.fillStyle='#2f6b2a'; for (const h of HIDES){ mg.beginPath(); mg.arc(h.x*s,h.y*s,h.r*s,0,7); mg.fill(); }
  mg.fillStyle='#1d3a7a'; mg.fillRect(PRISON.x*s,PRISON.y*s,PRISON.w*s,PRISON.h*s);
  for (const x of EXITS){ mg.fillStyle = st.exitsOpen ? '#3ddc84' : '#d33'; mg.fillRect(x.x*s,x.y*s,x.w*s,x.h*s); }
  mg.fillStyle='#35e0a1'; for (const sh of SHOPS) mg.fillRect(sh.x*s-3, sh.y*s-3, 6, 6);
  if (MAP.bell){ mg.fillStyle='#ffd84d'; mg.fillRect(MAP.bell.x*s-4, MAP.bell.y*s-4, 8, 8); }
  if (MAP.gaps){ mg.fillStyle='#7db8ff'; for (const gp of MAP.gaps) mg.fillRect(gp[0]*s-4, gp[1]*s-5, 8, 10); }
  if (st.herd && st.herd.p>=0){ const hs = herdDots(st.herd.p); mg.fillStyle='#fff'; for (const c of hs) mg.fillRect(c.x*s-3, c.y*s-3, 6, 6); }
  const shown = st.shown && st.shown[me.team] > 0;
  if (MAP.ball && st.ball){ mg.fillStyle='#fff'; mg.beginPath(); mg.arc(st.ball.x*s, st.ball.y*s, 3, 0, 7); mg.fill(); }
  for (const e of ents){
    if (e.state==='escaped') continue;
    let showE = true;
    if (e.team !== me.team && !shown){
      if (me.team==='P') showE = e.state!=='free' || !e.hidden && dist(e,me) < 16;
      else showE = e.state==='free' && dist(e,me) < 14;
    }
    if (!showE) continue;
    mg.fillStyle = e.team==='P' ? '#7db8ff' : '#ffb347';
    mg.beginPath(); mg.arc(e.x*s, e.y*s, e.id===MC.meId?6:4.5, 0, 7); mg.fill();
    if (e.id===MC.meId){ mg.strokeStyle='#fff'; mg.lineWidth=2.5; mg.stroke(); }
  }
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), frames = 0, slowT = 0, qualityDropped = false, hostSendT = 0;
function loop(){
  const tNow = performance.now(), dt = Math.min(.1, (tNow-last)/1000); last = tNow;
  const t = now();
  musicTick();
  if (NET.room && !NET.isHost) guestWatch();
  serverWatch();
  if ((mode==='match' || mode==='res') && MC){
    const st = MC.state();
    if (mode==='res'){ /* match is over: keep the street on screen behind the results */ }
    else if (MC.kind==='solo' || MC.kind==='host'){
      if (!MC.paused && !G.over){
        MC.acc += dt;
        let n = 0;
        while (MC.acc >= 1/60 && n++ < 6){
          const inp = readInput();
          step(1/60, e => e.ctrl==='local' ? inp : remoteInput(e));
          MC.acc -= 1/60;
        }
      }
      if (MC.kind==='host'){ hostSendT -= dt; if (hostSendT<=0){ hostSendT = 1/15; setPresence({ s: packState(G) }); } }
    } else {
      if (!MC.src.live()){
        guest.hostGone += dt;
        if (guest.hostGone > 3 && !st.over){ toast(MC.src.name==='srv' ? 'Lost connection to the match' : 'The host ended the match'); S.clearViews(); MC=null; setMode('online'); }
      } else {
        guest.hostGone = 0;
        const snap = MC.src.snapshot();
        if (snap && snap !== guest.lastS){
          const savedMe = { ...guest.M.ents[MC.meId] };
          applySnapshot(guest.M, snap); guest.lastS = snap;
          guest.M.events = (snap.ev||[]).map(a => ({ id:a[0], type:a[1], a:a[2], b:a[3], c:a[4] }));
          const e = guest.M.ents[MC.meId];
          e.hx = e.x; e.hy = e.y;   // where the host/server says we are
          if (e.state==='free' && savedMe.state==='free'){ e.x=savedMe.x; e.y=savedMe.y; }   // keep our own smooth movement
        }
        // other players' quick chat in claude.ai rooms
        if (MC.src===roomSrc) for (const p of livePeers()){ if (p.sameTab || !p.presence.cm) continue; const ent = guest.M.ents.find(x=>x.peer===p.peer); if (!ent) continue; const k='cm'+p.peer; if ((guest[k]||0) < p.presence.cm[0]){ guest[k]=p.presence.cm[0]; const tx=CHAT[ent.team][p.presence.cm[1]|0]; if (tx) bubble(ent.id, tx); } }
        if (!MC.paused) guestPredict(dt, readInput());
      }
    }
    if (!MC) { requestAnimationFrame(loop); return; }
    // events
    for (const v of MC.state().events){ if (v.id > MC.lastEv){ MC.lastEv = v.id; handleEvent(v); } }
    const ents = MC.ents(), me = ents[MC.meId];
    S.syncEntities(ents, dt, t, MC.meId, me.team, MC.kind==='guest', MC.state().over ? MC.state().over.win : null);
    S.syncPickups(MC.state().pickups||[], t);
    S.syncStreetLive(MC.state(), ents, me, dt, t);
    S.syncWorld({ exitsOpen: MC.state().exitsOpen, alarm: MC.state().alarm, jailedCount: ents.filter(e=>e.team==='T'&&e.state==='jailed').length }, me, t);
    // camera: follow you, or a free teammate once you're out
    let fx = me;
    if (me.state==='escaped'){ fx = ents.find(e => e.team===me.team && e.state==='free') || me; }
    const vp = S.viewPos(fx.id) || fx;
    S.updateCamera(dt, vp.x, vp.y, { shakeOn: SAVE().settings.shake });
    // juice
    MC.dustT -= dt;
    if (MC.dustT<=0){ MC.dustT = .07; for (const e of ents) if (e.state==='free' && e.sprinting && e.speed>3 && (!e.hidden || e.team===me.team)) S.fx('dust', e.x, e.y); if (MC.state().exitsOpen) for (const x of EXITS) S.fx('sparkle', x.cx, x.cy); }
    if (mode==='match') updateHUD(dt, t);
    if (MC.state().over){
      MC.overAt += dt;
      if (!MC.confetti){ MC.confetti = true; S.fx('confetti', me.x, me.y); if (MC.kind==='host') setPresence({ s: packState(G) }); }
      if (MC.overAt > 2.4 && !MC.awarded){ MC.awarded = true; finishMatch(); }
    }
  } else {
    // menu showroom
    S.idleStreetLive(dt, t);
    const p = S.updateShowroom(dt, t, spin + (mode==='ward' ? 0 : 0));
    if (mode==='ward') S.showroomCamera(dt, p.x, p.z, 3.4, 1.5, 0);
    else S.showroomCamera(dt, p.x, p.z, 4.6, 1.5, Math.sin(t*.25)*.5);
    if (mode!=='ward') spin += dt*.0;
  }
  S.updateFx(dt);
  S.render();
  // adaptive quality for budget phones
  frames++; if (dt > .034) slowT += dt;
  if (frames % 180 === 0){ if (!qualityDropped && slowT > 2.2){ qualityDropped = true; S.setQuality(0); } slowT = 0; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function checkRotate(){
  const touch = matchMedia('(pointer:coarse)').matches;
  show('rotate', touch && innerWidth > innerHeight*1.15);
}
checkRotate();
window.PTG = { get G(){ return G; }, get MC(){ return MC; }, startSolo, step, SAVE, SRV };
