// =============================================================
// NET: online rooms over the artifact's live "room" channel.
// The host runs the real match and broadcasts snapshots in its
// presence; guests move their own runner locally (feels instant) and
// send position + button presses in theirs. The host checks the rules
// (catches, rescues, escapes), so nobody can "catch" from across the map.
// Works for people who can open this page on claude.ai (your
// organisation, or people you invite). Public matchmaking needs a game
// server; that belongs in the Unity build.
// =============================================================
export const NET = { available:false, api:null, room:null, code:null, isHost:false, peers:[], my:null, host:null, onChange:null, gid:null };
const V = 2;

export async function initNet(){
  try{
    if (!window.claude || !window.claude.use) return false;
    const r = await window.claude.use('room');
    if (r){ NET.api = r; NET.available = true; }
  }catch(e){}
  return NET.available;
}
const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({length:4}, () => letters[Math.random()*letters.length|0]).join('');

export async function openRoom(code, asHost, me){
  await leaveRoom();
  NET.code = code.toUpperCase(); NET.isHost = asHost;
  NET.room = await NET.api.join('pt-' + NET.code.toLowerCase());
  NET.room.onPeers(ch => { NET.peers = ch.peers; recompute(); }, () => { NET.room = null; if (NET.onChange) NET.onChange('lost'); });
  await NET.room.presence({ v:V, n: me.name.slice(0,16), tm: me.side, lk: me.looks, host: asHost, st:'lobby', in:null, g:null, s:null });
  recompute();
}
function recompute(){
  const ps = NET.peers.filter(p => p.kind==='viewer');
  NET.my = ps.find(p => p.sameTab) || null;
  const hosts = ps.filter(p => p.presence && p.presence.host && p.presence.v===V).sort((a,b) => a.peer < b.peer ? -1 : 1);
  NET.host = hosts[0] || null;
  if (NET.isHost && NET.host && NET.my && NET.host.peer !== NET.my.peer){ NET.isHost = false; setPresence({ host:false }); }
  if (NET.onChange) NET.onChange('peers');
}
export function setPresence(patch){ if (NET.room) NET.room.presence(patch).catch(()=>{}); }
export function livePeers(){ return NET.room ? NET.room.peers().filter(p => p.kind==='viewer' && p.presence && p.presence.v===V) : []; }
export function peerPresence(peer){ const p = livePeers().find(x => x.peer===peer); return p ? p.presence : null; }
export function hostPresence(){ if (!NET.room) return null; const ps = livePeers(); const h = ps.filter(p=>p.presence.host).sort((a,b)=>a.peer<b.peer?-1:1)[0]; return h ? h : null; }
export async function leaveRoom(){
  if (NET.room){ try{ await NET.room.leave(); }catch(e){} }
  NET.room = null; NET.code = null; NET.isHost = false; NET.peers = []; NET.host = null; NET.my = null;
}

// ---- snapshot packing (host -> guests). Kept small: presence is capped at 4 KiB.
const ST = ['free','arrest','jailed','escaped'];
const r1 = v => Math.round(v*10)/10, r2 = v => Math.round(v*100)/100;
export function packState(G){
  return {
    t: r1(G.playT), ph: G.phase==='count'?0:1, cd: r1(G.countT), ex: G.exitsOpen?1:0, es: G.escaped,
    al: G.alarm ? [G.alarm.gate, G.alarm.by] : null, ni: G.night?1:0,
    ov: G.over ? [G.over.win, G.over.reason] : null,
    e: G.ents.map(e => [r1(e.x), r1(e.y), r2(e.fx), r2(e.fy), ST.indexOf(e.state),
      (e.hidden?1:0)|(e.sprinting?2:0)|(e.immune>0?4:0)|(e.reassigned>0?8:0)|(e.dashT>0?16:0)|(e.slowT>0?64:0)|(e.freeze>0?128:0)|(e.boostT>0?256:0)|(e.fullT>0?512:0),
      r1(e.speed||0), r2(e.rescueProg), r2(e.escProg), e.windup>0?e.wTarget:-1, r2(e.camp), e.wallet|0]),
    b: [r1(G.ball.x), r1(G.ball.y)], h: G.herd ? r1(G.herd.p) : -1, sh: [G.shown.P>0?1:0, G.shown.T>0?1:0], bc: Math.ceil(G.bellCd||0),
    n: G.notes.map(n => [n.id, r1(n.x), r1(n.y)]),
    ev: G.events.slice(-12).map(v => [v.id, v.type, v.a, v.b, v.c]),
    pk: G.pickups.map(p => [p.id, p.k==='bread'?0:1, r1(p.x), r1(p.y)]),
    st: G.over ? G.ents.map(e => [e.stats.caps, e.stats.rescues, e.stats.escaped, e.stats.caught, e.stats.dodges, e.stats.abil, e.stats.goals, e.stats.cash, e.stats.buys]) : null,
  };
}
export function rosterOf(G){ return G.ents.map(e => [e.id, e.team, e.name, e.look, e.peer]); }
// guests rebuild a read-only copy of the match from the host's snapshot
export function applySnapshot(M, s){
  M.playT = s.t; M.phase = s.ph ? 'play' : 'count'; M.countT = s.cd; M.exitsOpen = !!s.ex; M.escaped = s.es;
  M.alarm = s.al ? { gate:s.al[0], by:s.al[1] } : null; M.night = !!s.ni;
  M.over = s.ov ? { win:s.ov[0], reason:s.ov[1] } : null;
  M.pickups = (s.pk||[]).map(a => ({ id:a[0], k:a[1]?'zobo':'bread', x:a[2], y:a[3] }));
  if (s.b) M.ball = { x:s.b[0], y:s.b[1] };
  M.herd = { p: s.h ?? -1 }; M.shown = { P: s.sh ? s.sh[0] : 0, T: s.sh ? s.sh[1] : 0 }; M.bellCd = s.bc|0;
  M.notes = (s.n||[]).map(a => ({ id:a[0], x:a[1], y:a[2] }));
  s.e.forEach((a,i) => {
    const e = M.ents[i]; if (!e) return;
    e.x=a[0]; e.y=a[1]; e.fx=a[2]; e.fy=a[3]; e.state=ST[a[4]]||'free';
    e.hidden=!!(a[5]&1); e.sprinting=!!(a[5]&2); e.immune=(a[5]&4)?1:0; e.reassigned=(a[5]&8)?1:0; e.dashT=(a[5]&16)?.1:0; e.slowT=(a[5]&64)?1:0; e.freeze=(a[5]&128)?1:0; e.boostT=(a[5]&256)?1:0; e.fullT=(a[5]&512)?1:0;
    e.speed=a[6]; e.rescueProg=a[7]; e.escProg=a[8]; e.windup = a[9]>=0 ? .1 : 0; e.wTarget=a[9]; e.camp=a[10]; e.wallet=a[11]|0;
  });
  if (s.st) s.st.forEach((a,i) => { const e=M.ents[i]; if (e) e.stats = { caps:a[0], rescues:a[1], escaped:a[2], caught:a[3], dodges:a[4], abil:a[5], goals:a[6]|0, cash:a[7]|0, buys:a[8]|0 }; });
}

// =============================================================
// Public game server (WebSocket). Used when the game is hosted on its
// own website with server/server.mjs. Inside the claude.ai page the
// browser blocks outside connections, so it falls back to rooms/bots.
// =============================================================
export const SRV = { ws:null, status:'off', url:null, lobby:null, game:null, lastS:null, lb:null, err:null, onChange:null, onChat:null };
const PROTO = 1;
const STATIC_HOSTS = /(\.github\.io|\.netlify\.app|\.vercel\.app|\.pages\.dev)$/i;
export function serverUrl(){
  const cfg = (window.PT_CONFIG||{});
  if (cfg.server) return cfg.server;
  // these websites only hold files and can't run the game server, so there's nothing to connect to
  // unless config.js says where the server is
  if (STATIC_HOSTS.test(location.hostname)) return null;
  if (/^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) && location.hostname!=='') return (location.protocol==='https:'?'wss://':'ws://') + location.host + '/ws';
  return null;
}
export function connectServer(me){
  const url = serverUrl();
  if (!url) return Promise.resolve(false);
  if (SRV.status==='on') return Promise.resolve(true);
  return new Promise(res => {
    let done = false; const finish = v => { if (!done){ done = true; res(v); } };
    try{
      SRV.status = 'connecting'; SRV.url = url;
      const ws = new WebSocket(url); SRV.ws = ws;
      const to = setTimeout(() => { if (SRV.status!=='on'){ try{ ws.close(); }catch(e){} SRV.status='off'; finish(false); } }, 8000);
      ws.onopen = () => { ws.send(JSON.stringify({ t:'hello', v:PROTO, pid: me.pid, name: me.name, looks: me.looks })); };
      ws.onmessage = (ev) => {
        let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
        if (m.t==='welcome'){ SRV.status='on'; clearTimeout(to); finish(true); }
        else if (m.t==='lobby'){ SRV.lobby = m; }
        else if (m.t==='start'){ SRV.game = m; SRV.lastS = null; }
        else if (m.t==='s'){ SRV.lastS = m.s; }
        else if (m.t==='chat'){ if (SRV.onChat) SRV.onChat(m.id, m.i); }
        else if (m.t==='ended'){ SRV.lobby = null; }
        else if (m.t==='lb'){ SRV.lb = m.rows; }
        else if (m.t==='err'){ SRV.err = m.msg; }
        if (SRV.onChange) SRV.onChange(m.t);
      };
      ws.onclose = () => { SRV.status='off'; SRV.lobby=null; SRV.ws=null; finish(false); if (SRV.onChange) SRV.onChange('closed'); };
      ws.onerror = () => {};
    }catch(e){ SRV.status='off'; finish(false); }
  });
}
let lastIn = 0;
export function srvSend(m){
  if (!SRV.ws || SRV.ws.readyState!==1) return;
  if (m.t==='in'){ const n = performance.now(); if (n-lastIn < 30) return; lastIn = n; }
  SRV.ws.send(JSON.stringify(m));
}
