// =============================================================
// ADS: one small adapter for web-game ad networks. Off by default.
// Turn one on in config.js:
//   ads: { provider: 'poki' }         -> when published on Poki (they load their SDK)
//   ads: { provider: 'crazygames' }   -> when published on CrazyGames
//   ads: { provider: 'h5', client: 'ca-pub-XXXX', test: true }  -> Google H5 Games Ads on your own site
// Rules we follow: only rewarded ads the player chooses, and at most one
// short break between games. Never during a match.
// =============================================================
const cfg = () => ((window.PT_CONFIG||{}).ads) || { provider:'none' };
let ready = false, lastBreak = 0, noAds = false;
// Where each ad shows (search the code for "[AD]"):
//   1. Results screen: "Watch an ad to double your ₦" button        js/main.js  (ADS.rewarded)
//   2. Store: "Free ₦50" button, 5 a day                            js/store.js (ADS.rewarded)
//   3. A short break before "Play again", max once every 3 minutes  js/main.js  (ADS.breakBetweenGames)
//   4. A banner under the results (Google AdSense only)             js/main.js  (ADS.showBanner)
// Ads 3 and 4 are skipped for players who bought "No ad breaks".

function loadScript(src, attrs={}){
  return new Promise((res) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    for (const k in attrs) s.setAttribute(k, attrs[k]);
    s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
    setTimeout(() => res(false), 8000);
  });
}
const withTimeout = (p, ms, v) => Promise.race([p, new Promise(r => setTimeout(() => r(v), ms))]);

export const ADS = {
  async init(){
    const c = cfg();
    try{
      if (c.provider==='poki'){
        if (!window.PokiSDK) await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        if (window.PokiSDK){ await window.PokiSDK.init(); window.PokiSDK.gameLoadingFinished && window.PokiSDK.gameLoadingFinished(); ready = true; }
      } else if (c.provider==='crazygames'){
        if (!window.CrazyGames) await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
        if (window.CrazyGames && window.CrazyGames.SDK){ await window.CrazyGames.SDK.init(); ready = true; }
      } else if (c.provider==='h5' && c.client){
        window.adsbygoogle = window.adsbygoogle || [];
        window.adBreak = window.adConfig = function(o){ window.adsbygoogle.push(o); };
        const ok = await loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(c.client),
          { 'data-ad-frequency-hint':'120s', 'crossorigin':'anonymous', ...(c.test ? { 'data-adbreak-test':'on' } : {}) });
        if (ok){ window.adConfig({ preloadAdBreaks:'on', sound:'on' }); ready = true; }
      }
    }catch(e){ ready = false; }
  },
  setNoAds(v){ noAds = !!v; },
  rewardedAvailable(){ return ready; },
  // resolves true only when the player watched the whole ad
  async rewarded(name='double-naira'){
    if (!ready) return false;
    const c = cfg();
    try{
      if (c.provider==='poki') return !!(await withTimeout(window.PokiSDK.rewardedBreak(), 60000, false));
      if (c.provider==='crazygames') return await withTimeout(new Promise(res => window.CrazyGames.SDK.ad.requestAd('rewarded', { adFinished:()=>res(true), adError:()=>res(false) })), 60000, false);
      if (c.provider==='h5') return await withTimeout(new Promise(res => { let got=false; window.adBreak({ type:'reward', name, beforeReward:(show)=>show(), adViewed:()=>{ got=true; }, adDismissed:()=>{}, adBreakDone:()=>res(got) }); }), 60000, false);
    }catch(e){}
    return false;
  },
  // a short break between games, no more than once every 3 minutes
  async breakBetweenGames(){
    if (!ready || noAds || Date.now()-lastBreak < 180000) return;
    lastBreak = Date.now();
    const c = cfg();
    try{
      if (c.provider==='poki') await withTimeout(window.PokiSDK.commercialBreak(), 30000);
      else if (c.provider==='crazygames') await withTimeout(new Promise(res => window.CrazyGames.SDK.ad.requestAd('midgame', { adFinished:res, adError:res })), 30000);
      else if (c.provider==='h5') await withTimeout(new Promise(res => window.adBreak({ type:'next', name:'between-games', adBreakDone:res })), 30000);
    }catch(e){}
  },
  // [AD] banner (Google AdSense display unit). Needs ads.bannerSlot in config.js.
  // Portals (Poki, CrazyGames) manage their own banners, so this only runs for 'h5'.
  showBanner(box){
    const c = cfg();
    if (!box || noAds || c.provider!=='h5' || !c.client || !c.bannerSlot) return;
    box.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle'; ins.style.display = 'block';
    ins.setAttribute('data-ad-client', c.client); ins.setAttribute('data-ad-slot', c.bannerSlot);
    ins.setAttribute('data-ad-format', 'horizontal'); ins.setAttribute('data-full-width-responsive', 'true');
    if (c.test) ins.setAttribute('data-adtest', 'on');
    box.appendChild(ins);
    try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
  },
  hideBanner(box){ if (box) box.innerHTML = ''; },
  gameplay(on){
    try{
      const c = cfg();
      if (c.provider==='poki' && ready) on ? window.PokiSDK.gameplayStart() : window.PokiSDK.gameplayStop();
      if (c.provider==='crazygames' && ready) on ? window.CrazyGames.SDK.game.gameplayStart() : window.CrazyGames.SDK.game.gameplayStop();
    }catch(e){}
  },
};
