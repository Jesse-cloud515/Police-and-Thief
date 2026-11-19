// =============================================================
// STORE: real-money purchases [PAY] and the free-₦ ad [AD].
//
// How a purchase works:
//   1. The player taps a price. Paystack's own payment window opens
//      (card, bank transfer, USSD, all handled by Paystack).
//   2. Paystack tells the game the payment went through and gives a
//      reference.
//   3. The game asks OUR server (/api/verify) to check that reference
//      with Paystack using the secret key. Only the server holds that key.
//   4. If the server says yes, the game gives the item. A reference is
//      only ever used once.
// If the network drops between 2 and 4, the reference is kept and checked
// again the next time the game opens, so nobody loses what they paid for.
//
// Switch it on in config.js:  payments: { provider:'paystack', publicKey:'pk_live_...' }
// and on the server:          PAYSTACK_SECRET=sk_live_...  (see MONETIZATION.md)
// =============================================================
import { PRODUCTS, productById } from './products.js';
import * as M from './meta.js';
import { ADS } from './ads.js';

const $ = id => document.getElementById(id);
const cfg = () => ((window.PT_CONFIG || {}).payments) || { provider: 'none' };
const apiBase = () => ((window.PT_CONFIG || {}).api || '').replace(/\/$/, '');
let hooks = { toast: () => {}, sfx: () => {}, refresh: () => {} };
const fmtN = n => n.toLocaleString('en-NG');

export function paymentsOn(){ const c = cfg(); return c.provider === 'paystack' && /^pk_(test|live)_/.test(c.publicKey || ''); }

// [PAY] load Paystack's checkout script only when someone opens a payment
let psLoading = null;
function loadPaystack(){
  if (window.PaystackPop) return Promise.resolve(true);
  if (psLoading) return psLoading;
  psLoading = new Promise(res => {
    const s = document.createElement('script'); s.src = 'https://js.paystack.co/v2/inline.js'; s.async = true;
    s.onload = () => res(!!window.PaystackPop); s.onerror = () => { psLoading = null; res(false); };
    document.head.appendChild(s); setTimeout(() => res(!!window.PaystackPop), 10000);
  });
  return psLoading;
}

// [PAY] ask our server to confirm the payment with Paystack
async function verify(ref, productId){
  const r = await fetch(apiBase() + '/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref, product: productId }) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.ok === true, reason: j.reason || ('HTTP ' + r.status), retry: r.status >= 500 || r.status === 0 };
}
function pending(){ const s = M.SAVE; s.pendingPay = s.pendingPay || []; return s.pendingPay; }
async function settle(ref, productId){
  const p = productById(productId); if (!p) return;
  try{
    const v = await verify(ref, productId);
    if (v.ok){
      M.SAVE.pendingPay = pending().filter(x => x.ref !== ref);
      if (M.grantProduct(p, ref)){ hooks.sfx('coin'); hooks.toast(`✅ ${p.name} added. Thank you!`); }
      M.persist(); hooks.refresh(); renderStore(); return;
    }
    if (!v.retry){ M.SAVE.pendingPay = pending().filter(x => x.ref !== ref); M.persist(); hooks.toast(`Payment not confirmed (${v.reason}). If you were charged, contact support with reference ${ref}`); }
    else hooks.toast('Payment received. We will add it as soon as the connection is back.');
  }catch(e){ hooks.toast('Payment received. We will add it as soon as the connection is back.'); }
  renderStore();
}
// called when the game opens: finish any payment the network interrupted
export function retryPending(){ for (const x of pending().slice()) settle(x.ref, x.product); }

async function buy(p){
  const c = cfg();
  if (!paymentsOn()){ hooks.toast('Payments are not switched on yet (see MONETIZATION.md)'); return; }
  const email = ($('stEmail').value || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ hooks.toast('Enter your email first. Paystack sends the receipt there'); $('stEmail').focus(); return; }
  M.SAVE.payEmail = email; M.persist();
  const ok = await loadPaystack();
  if (!ok){ hooks.toast("Couldn't open Paystack. Check your connection and try again"); return; }
  const ref = 'pt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  try{
    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: c.publicKey, email, amount: p.price * 100, currency: 'NGN', reference: ref,
      metadata: { product: p.id, player: M.SAVE.name },
      onSuccess: (tx) => { const r = (tx && tx.reference) || ref; pending().push({ ref: r, product: p.id }); M.persist(); settle(r, p.id); },
      onCancel: () => hooks.toast('Payment cancelled'),
      onError: () => hooks.toast('Paystack could not start the payment. Try again'),
    });
  }catch(e){ hooks.toast('Paystack could not start the payment. Try again'); }
}

// [AD] watch an ad for free ₦, a few times a day
async function watchForCash(btn){
  btn.disabled = true;
  const ok = await ADS.rewarded('store-free-cash');
  if (ok){ M.giveAdCash(); hooks.sfx('coin'); hooks.toast(`+₦${M.AD_CASH} game cash`); hooks.refresh(); }
  else hooks.toast('No ad right now. Try again later');
  renderStore();
}

function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
export function renderStore(){
  const L = $('stList'); if (!L) return;
  L.innerHTML = '';
  $('stCoins').textContent = fmtN(M.SAVE.coins);
  if (!$('stEmail').value && M.SAVE.payEmail) $('stEmail').value = M.SAVE.payEmail;
  const on = paymentsOn();
  $('stNote').textContent = on ? 'Secure payment by Paystack: card, bank transfer or USSD. Prices in naira.'
    : 'Real-money buying switches on when the game is on its own website with a Paystack key. Prices below are what players will see.';
  // free ₦ for an ad
  if (ADS.rewardedAvailable()){
    const left = M.adCashLeft();
    const r = el('div', 'prod free'); r.appendChild(el('i', null, '📺'));
    const t = el('div'); t.appendChild(el('b', null, `Free ₦${M.AD_CASH}`)); t.appendChild(el('small', null, left > 0 ? `Watch a short ad · ${left} left today` : 'Come back tomorrow for more')); r.appendChild(t);
    const b = el('button', 'pbtn', 'WATCH'); b.disabled = left <= 0; b.onclick = () => watchForCash(b); r.appendChild(b);
    L.appendChild(r);
  }
  for (const p of PRODUCTS){
    const owned = (p.kind === 'noads' && M.SAVE.noAds) || (p.kind === 'pack' && p.items.every(id => M.SAVE.owned.includes(id)));
    const r = el('div', 'prod' + (p.tag ? ' hot' : '')); r.appendChild(el('i', null, p.icon));
    const t = el('div');
    const nm = el('b', null, p.kind === 'cash' ? `₦${fmtN(p.cash)} game cash` : p.name);
    if (p.tag){ const tg = el('em', null, p.tag); nm.appendChild(tg); }
    t.appendChild(nm);
    t.appendChild(el('small', null, p.kind === 'cash' ? p.name : p.blurb));
    r.appendChild(t);
    const b = el('button', 'pbtn', owned ? 'OWNED' : `NGN ${fmtN(p.price)}`);
    b.disabled = owned || !on; b.onclick = () => buy(p); r.appendChild(b);
    L.appendChild(r);
  }
  const n = pending().length;
  $('stPending').textContent = n ? `${n} payment${n > 1 ? 's' : ''} waiting for confirmation…` : '';
}
export function openStore(){ renderStore(); $('storeDlg').classList.remove('hidden'); }
export function initStore(h){
  hooks = { ...hooks, ...h };
  $('stClose').onclick = () => $('storeDlg').classList.add('hidden');
  setTimeout(retryPending, 1500);
}
