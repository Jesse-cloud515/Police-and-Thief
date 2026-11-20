// =============================================================
// Police & Thief: Naija Streets — game server
// One Node.js process serves the web game AND runs online matches.
//   node server.mjs            (PORT env var, default 8080)
// Matches are authoritative: the server runs the same rules file the
// browser uses (../js/sim.js), so catches, rescues and escapes are
// decided here, not on players' phones.
// =============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { newMatch, step, useMatch } from '../js/sim.js';
import { packState, rosterOf } from '../js/net.js';
import { MAPS } from '../js/world.js';
import { CFG } from '../js/world.js';
import { productById } from '../js/products.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const PORT = +process.env.PORT || 8080;
const DATA = process.env.DATA_DIR || path.join(__dir, 'data');
const PROTO = 1;
fs.mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------------- payments [PAY]
// Set PAYSTACK_SECRET=sk_live_... (or sk_test_... while testing) where the server runs.
// Never put the secret key in config.js or anywhere players can see it.
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || '';
const PAYSTACK_API = process.env.PAYSTACK_API || 'https://api.paystack.co';   // only changed for testing
const PAY_FILE = path.join(DATA, 'payments.json');
let paid = {};      // reference -> { product, amount, email, at }
try { paid = JSON.parse(fs.readFileSync(PAY_FILE, 'utf8')); } catch {}
const savePaid = () => fs.writeFile(PAY_FILE + '.tmp', JSON.stringify(paid), () => fs.rename(PAY_FILE + '.tmp', PAY_FILE, () => {}));
const json = (res, code, obj) => { res.writeHead(code, { 'content-type':'application/json', 'cache-control':'no-store' }); res.end(JSON.stringify(obj)); };
function readBody(req, max = 2048){
  return new Promise((ok, bad) => { let b = ''; req.on('data', c => { b += c; if (b.length > max){ bad(new Error('too big')); req.destroy(); } }); req.on('end', () => ok(b)); req.on('error', bad); });
}
async function verifyPayment(req, res){
  if (req.method !== 'POST') return json(res, 405, { ok:false, reason:'POST only' });
  if (!PAYSTACK_SECRET) return json(res, 503, { ok:false, reason:'payments not set up on the server' });
  let body; try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok:false, reason:'bad request' }); }
  const ref = String(body.ref || ''), product = productById(String(body.product || ''));
  if (!/^[\w.-]{6,100}$/.test(ref) || !product) return json(res, 400, { ok:false, reason:'unknown product or reference' });
  // the same reference asked again for the same product (e.g. the phone retried): say yes, the game ignores repeats
  if (paid[ref]) return paid[ref].product === product.id ? json(res, 200, { ok:true, product: product.id, repeat:true }) : json(res, 409, { ok:false, reason:'reference already used' });
  let r;
  try {
    const resp = await fetch(PAYSTACK_API + '/transaction/verify/' + encodeURIComponent(ref), { headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET } });
    r = await resp.json();
  } catch { return json(res, 502, { ok:false, reason:'could not reach Paystack' }); }
  const d = r && r.data;
  if (!r || r.status !== true || !d || d.status !== 'success') return json(res, 402, { ok:false, reason:'payment not successful' });
  if (d.currency !== 'NGN' || d.amount !== product.price * 100) return json(res, 402, { ok:false, reason:'amount does not match' });
  if (d.reference !== ref) return json(res, 402, { ok:false, reason:'reference mismatch' });
  paid[ref] = { product: product.id, amount: d.amount, email: d.customer && d.customer.email || '', at: Date.now() };
  savePaid();
  console.log('payment ok', ref, product.id, d.amount / 100, 'NGN');
  return json(res, 200, { ok:true, product: product.id });
}


// ---------------------------------------------------------------- static files
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.mp3':'audio/mpeg' };
const ALLOWED = /^\/(index\.html|config\.js|sw\.js|manifest\.webmanifest|privacy\.html|js\/[\w-]+\.js|css\/[\w-]+\.css|icons\/[\w.-]+|audio\/[\w.-]+\.mp3)$/;
// ---------------------------------------------------------------- other websites
// When the game files live on a different website from this server (for example GitHub Pages),
// browsers need permission to call /api/... from there. Set ALLOWED_ORIGINS to a comma-separated
// list such as  https://jesse-cloud515.github.io,https://policeandthief.ng
// to allow only those. Left empty, any website may use the API and connect to matches.
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
// the server's own address is always allowed, as are the ones in ALLOWED_ORIGINS
const originOk = (o, host) => { if (!ORIGINS.length || !o || ORIGINS.includes(o)) return true; try { return new URL(o).host === host; } catch { return false; } };
function cors(req, res){
  const o = req.headers.origin;
  if (o && originOk(o, req.headers.host)){
    res.setHeader('access-control-allow-origin', ORIGINS.length ? o : '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('vary', 'origin');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/') || url.pathname === '/health'){
    cors(req, res);
    if (req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }
  }
  if (url.pathname === '/health'){ res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({ ok:true, rooms: rooms.size, players: clients.size })); return; }
  if (url.pathname === '/api/verify'){ verifyPayment(req, res).catch(() => json(res, 500, { ok:false, reason:'server error' })); return; }
  if (url.pathname === '/api/leaderboard'){ res.writeHead(200, {'content-type':'application/json','cache-control':'max-age=30'}); res.end(JSON.stringify(topBoard())); return; }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!ALLOWED.test(p)){ res.writeHead(404); res.end('Not found'); return; }
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, buf) => {
    if (err){ res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': p.endsWith('.html') || p==='/sw.js' ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff' });
    res.end(buf);
  });
});

// ---------------------------------------------------------------- leaderboard
const BOARD_FILE = path.join(DATA, 'leaderboard.json');
let board = {};
try { board = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8')); } catch {}
let boardDirty = false;
setInterval(() => { if (boardDirty){ boardDirty = false; fs.writeFile(BOARD_FILE+'.tmp', JSON.stringify(board), () => fs.rename(BOARD_FILE+'.tmp', BOARD_FILE, () => {})); } }, 30000);
function topBoard(){
  return Object.values(board).sort((a,b) => b.pts - a.pts).slice(0, 50).map(r => ({ name:r.name, pts:r.pts, wins:r.wins, games:r.games }));
}
function recordResult(c, e, won){
  const r = board[c.pid] || (board[c.pid] = { name:c.name, pts:0, wins:0, games:0 });
  r.name = c.name; r.games++; if (won) r.wins++;
  r.pts += (won?3:1) + e.stats.caps + e.stats.rescues + e.stats.escaped*2;
  boardDirty = true;
}

// ---------------------------------------------------------------- players and rooms
const clients = new Map();     // ws -> client
const rooms = new Map();       // code -> room
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({length:4}, () => LETTERS[Math.random()*LETTERS.length|0]).join(''); } while (rooms.has(c)); return c; };
// Words that can't be used in player names. Matching ignores case, spaces, dots and simple
// letter swaps (0 for o, 1 for i, 3 for e, 4 or @ for a, 5 or $ for s), and finds the word
// inside longer names too. Add words in lower case. A rude name becomes 'Player' plus a number.
const BAD_WORDS = ['fuck','shit','bitch','cunt','dick','pussy','nigga','nigger','whore','slut','bastard',
  'asshole','penis','vagina','porn','sex','rape','ashawo','olosho','ode','werey','oloshi','mumu','idiot',
  'yeye','dickhead','motherf','fuk','fck','kill','nazi','hitler','boko'];
// words matched only as a whole part of the name, so real names like Dickson, Nazir or
// Odenike, and words like Skill or Grape, still pass
const WHOLE_ONLY = ['ode','dick','sex','rape','nazi','kill','boko'];
const squash = s => s.toLowerCase().replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/[4@]/g,'a').replace(/[5$]/g,'s').replace(/[^a-z ]/g,'');
function rude(name){
  const parts = squash(name).split(/\s+/), joined = parts.join('');
  return BAD_WORDS.some(w => WHOLE_ONLY.includes(w) ? parts.includes(w) : joined.includes(w));
}
const clean = (s, n=14) => {
  const t = String(s||'').replace(/[^\w .'-]/g,'').trim().slice(0,n);
  if (!t) return 'Player';
  return rude(t) ? 'Player' + (100 + Math.random()*900 | 0) : t;
};
function cleanLook(l){ const o={}; if (!l || typeof l!=='object') return null; for (const k of ['skin','outfit','head','eyes','extra','shoes','dance']){ const v=l[k]; o[k] = (typeof v==='number' && v>=0 && v<50) ? v|0 : (typeof v==='string' ? v.replace(/[^\w]/g,'').slice(0,20) : 0); } return o; }
const send = (c, msg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };

function makeRoom(isPublic){
  const r = { code: newCode(), isPublic, players: [], hostPid: null, state: 'lobby', startAt: 0, G: null, gid: null, tick: 0, overAt: 0, timer: null };
  rooms.set(r.code, r); return r;
}
function lobbyMsg(r){
  return { t:'lobby', code: r.code, quick: r.isPublic, startsIn: r.startAt ? Math.max(0, Math.ceil((r.startAt-Date.now())/1000)) : null,
    map: r.map || 'random', players: r.players.map(c => ({ name:c.name, tm:c.side, host: c.pid===r.hostPid })) };
}
function broadcastLobby(r){ for (const c of r.players) send(c, { ...lobbyMsg(r), you: c.pid===r.hostPid ? 'host' : 'guest' }); }
function joinRoom(c, r){
  leaveRoom(c);
  if (r.players.length >= 8 || r.state !== 'lobby') return send(c, { t:'err', msg: r.state!=='lobby' ? 'That match has already started' : 'That room is full' });
  r.players.push(c); c.room = r;
  if (!r.hostPid) r.hostPid = c.pid;
  if (r.isPublic){
    // quick match: start 15 s after the first player, or 3 s after the room fills up
    if (!r.startAt) r.startAt = Date.now() + 15000;
    if (r.players.length >= 8) r.startAt = Math.min(r.startAt, Date.now() + 3000);
  }
  broadcastLobby(r);
}
function leaveRoom(c){
  const r = c.room; if (!r) return;
  r.players = r.players.filter(x => x !== c); c.room = null;
  if (r.G){ const e = r.G.ents.find(e => e.peer === c.pid); if (e){ e.ctrl = 'bot'; } }
  if (!r.players.length){ clearInterval(r.timer); rooms.delete(r.code); return; }
  if (r.hostPid === c.pid) r.hostPid = r.players[0].pid;
  if (r.state==='lobby') broadcastLobby(r);
}
function quickRoom(){
  for (const r of rooms.values()) if (r.isPublic && r.state==='lobby' && r.players.length < 8) return r;
  return makeRoom(true);
}

// ---------------------------------------------------------------- matches
function startMatch(r){
  const slots = r.players.map(c => ({ team: c.side, ctrl:'remote', name: c.name, peer: c.pid }));
  const ids = Object.keys(MAPS);
  r.G = newMatch({ slots, diff: 1, map: MAPS[r.map] ? r.map : ids[Math.random()*ids.length|0] });
  for (const e of r.G.ents){
    const c = r.players.find(x => x.pid === e.peer);
    e.look = c && c.looks && c.looks[e.team] ? c.looks[e.team] : null;
    e.input = null; e.lastPs = 0; e.lastAb = 0;
  }
  r.state = 'game'; r.gid = Math.random().toString(36).slice(2,8); r.tick = 0; r.overAt = 0;
  const roster = rosterOf(r.G);
  for (const c of r.players){
    const me = r.G.ents.find(e => e.peer === c.pid);
    send(c, { t:'start', gid: r.gid, me: me ? me.id : -1, roster, night: r.G.night, map: r.G.map });
  }
  clearInterval(r.timer);
  r.timer = setInterval(() => tickRoom(r), 1000/30);
}
function inputFor(e){
  const i = e.input;
  if (!i) return { mx:0, my:0 };
  const out = { pos: i.p, vel: i.v, face: i.f, sprint: !!i.sp, action: !!i.act, press: i.ps > e.lastPs, ability: i.ab > e.lastAb, mx:0, my:0 };
  e.lastPs = Math.max(e.lastPs, i.ps|0); e.lastAb = Math.max(e.lastAb, i.ab|0);
  return out;
}
function tickRoom(r){
  if (!r.G) return;
  useMatch(r.G);
  for (let i=0; i<2; i++) step(1/60, inputFor);
  r.tick++;
  if (r.tick % 2 === 0){
    const s = packState(r.G);
    const msg = JSON.stringify({ t:'s', s });
    for (const c of r.players) if (c.ws.readyState === 1) c.ws.send(msg);
  }
  if (r.G.over){
    if (!r.overAt){
      r.overAt = Date.now();
      for (const c of r.players){ const e = r.G.ents.find(e => e.peer === c.pid); if (e) recordResult(c, e, r.G.over.win === e.team); }
    }
    if (Date.now() - r.overAt > 4000){
      clearInterval(r.timer); r.G = null; r.state = 'lobby';
      if (r.isPublic){ for (const c of r.players.slice()){ c.room = null; send(c, { t:'ended' }); } rooms.delete(r.code); }
      else { r.startAt = 0; broadcastLobby(r); }
    }
  }
}
// quick-match countdowns
setInterval(() => {
  for (const r of rooms.values()){
    if (r.state==='lobby' && r.isPublic && r.startAt){
      if (Date.now() >= r.startAt) startMatch(r); else broadcastLobby(r);
    }
  }
}, 1000);

// ---------------------------------------------------------------- websocket
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, verifyClient: info => originOk(info.origin, info.req.headers.host) });
wss.on('connection', (ws) => {
  const c = { ws, pid: null, name: 'Player', side: 'R', looks: null, room: null, msgs: 0, win: Date.now() };
  clients.set(ws, c);
  ws.on('message', (data) => {
    // simple flood guard: 90 messages a second is plenty for 30 Hz input
    const now = Date.now(); if (now - c.win > 1000){ c.win = now; c.msgs = 0; }
    if (++c.msgs > 90) return;
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t){
      case 'hello':
        if (m.v !== PROTO) return send(c, { t:'err', msg:'Please refresh: the game was updated' });
        c.pid = String(m.pid||'').replace(/[^\w-]/g,'').slice(0,40) || Math.random().toString(36).slice(2);
        c.name = clean(m.name); c.looks = m.looks ? { P: cleanLook(m.looks.P), T: cleanLook(m.looks.T) } : null;
        send(c, { t:'welcome' }); break;
      // quick match always auto-assigns: the server balances the two sides
      case 'quick': c.side = 'R'; joinRoom(c, quickRoom()); break;
      case 'create': { c.side = ['P','T','R'].includes(m.side) ? m.side : 'R'; const r = makeRoom(false); r.map = typeof m.map==='string' ? m.map : 'random'; r.hostPid = c.pid; joinRoom(c, r); break; }
      case 'join': { const r = rooms.get(String(m.code||'').toUpperCase()); if (!r || r.isPublic) return send(c, { t:'err', msg:'No room with that code' }); c.side = ['P','T','R'].includes(m.side) ? m.side : 'R'; joinRoom(c, r); break; }
      // the host of a friends' room picks the location ('random' or a map id from world.js)
      case 'map': if (c.room && !c.room.isPublic && c.room.state==='lobby' && c.room.hostPid===c.pid){ c.room.map = MAPS[m.map] ? m.map : 'random'; broadcastLobby(c.room); } break;
      case 'team': if (c.room && !c.room.isPublic && c.room.state==='lobby'){ c.side = ['P','T','R'].includes(m.side) ? m.side : 'R'; broadcastLobby(c.room); } break;
      case 'start': if (c.room && c.room.state==='lobby' && c.room.hostPid===c.pid) startMatch(c.room); break;
      case 'leave': leaveRoom(c); break;
      case 'in': {
        const r = c.room; if (!r || !r.G) return;
        const e = r.G.ents.find(e => e.peer === c.pid); if (!e) return;
        const p = Array.isArray(m.p) ? [+m.p[0], +m.p[1]] : null;
        if (!p || !isFinite(p[0]) || !isFinite(p[1])) return;
        e.input = { p, v: Array.isArray(m.v) ? [+m.v[0]||0, +m.v[1]||0] : [0,0], f: Array.isArray(m.f) ? [+m.f[0]||0, +m.f[1]||1] : null, sp: m.sp?1:0, act: m.act?1:0, ps: m.ps|0, ab: m.ab|0 };
        break; }
      case 'chat': {
        const r = c.room; if (!r || !r.G) return;
        const e = r.G.ents.find(e => e.peer === c.pid); if (!e) return;
        const msg = { t:'chat', id: e.id, i: Math.max(0, Math.min(2, m.i|0)) };
        for (const o of r.players) send(o, msg);
        break; }
      case 'lb': send(c, { t:'lb', rows: topBoard().slice(0, 20) }); break;
    }
  });
  ws.on('close', () => { leaveRoom(c); clients.delete(ws); });
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log(`Police & Thief server on http://localhost:${PORT}  (matches last up to ${CFG.matchTime}s)`));
