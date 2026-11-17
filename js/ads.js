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
let ready = false, lastBreak = 0;

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
  rewardedAvailable(){ return ready; },
  // resolves true only when the player watched the whole ad
  async rewarded(){
    if (!ready) return false;
    const c = cfg();
    try{
      if (c.provider==='poki') return !!(await withTimeout(window.PokiSDK.rewardedBreak(), 60000, false));
      if (c.provider==='crazygames') return await withTimeout(new Promise(res => window.CrazyGames.SDK.ad.requestAd('rewarded', { adFinished:()=>res(true), adError:()=>res(false) })), 60000, false);
      if (c.provider==='h5') return await withTimeout(new Promise(res => { let got=false; window.adBreak({ type:'reward', name:'double-naira', beforeReward:(show)=>show(), adViewed:()=>{ got=true; }, adDismissed:()=>{}, adBreakDone:()=>res(got) }); }), 60000, false);
    }catch(e){}
    return false;
  },
  // a short break between games, no more than once every 3 minutes
  async breakBetweenGames(){
    if (!ready || Date.now()-lastBreak < 180000) return;
    lastBreak = Date.now();
    const c = cfg();
    try{
      if (c.provider==='poki') await withTimeout(window.PokiSDK.commercialBreak(), 30000);
      else if (c.provider==='crazygames') await withTimeout(new Promise(res => window.CrazyGames.SDK.ad.requestAd('midgame', { adFinished:res, adError:res })), 30000);
      else if (c.provider==='h5') await withTimeout(new Promise(res => window.adBreak({ type:'next', name:'between-games', adBreakDone:res })), 30000);
    }catch(e){}
  },
  gameplay(on){
    try{
      const c = cfg();
      if (c.provider==='poki' && ready) on ? window.PokiSDK.gameplayStart() : window.PokiSDK.gameplayStop();
      if (c.provider==='crazygames' && ready) on ? window.CrazyGames.SDK.game.gameplayStart() : window.CrazyGames.SDK.game.gameplayStop();
    }catch(e){}
  },
};
