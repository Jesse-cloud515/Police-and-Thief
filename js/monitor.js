// =============================================================
// MONITOR: crash reports (Sentry) and player numbers (GoatCounter).
//
// This is a plain script, not a module, and it loads right after config.js
// so it can catch errors from everything that comes after it.
//
// Both are switched on in config.js:
//   sentry: { dsn: 'https://...ingest...sentry.io/...' }
//   goatcounter: 'policethief'   (your GoatCounter code)
// Leave either empty to switch it off.
//
// The game calls  PT_TRACK('event-name')  to count something (a game started,
// the tutorial finished...) and  PT_TAG('key', 'value')  to label crash reports
// (which location, solo or online). Both do nothing when switched off.
// =============================================================
(function(){
  var cfg = window.PT_CONFIG || {};
  var host = location.hostname;
  // nothing is sent from your own laptop or from the claude.ai preview
  var offline = host === 'localhost' || host === '127.0.0.1' || /claude/.test(host) || location.protocol === 'file:';

  window.PT_TRACK = function(){};
  window.PT_TAG = function(){};
  if (offline) return;

  // ---------------------------------------------------------- Sentry
  var s = cfg.sentry || {};
  if (s.dsn){
    var queue = [], tags = {}, ready = false;
    // catch errors straight away, before the Sentry code has downloaded
    var early = function(e){ if (!ready && queue.length < 10) queue.push(e && (e.error || e.reason) || e); };
    addEventListener('error', early);
    addEventListener('unhandledrejection', early);
    window.PT_TAG = function(k, v){ tags[k] = v; if (ready && window.Sentry) Sentry.setTag(k, v); };

    // download Sentry a few seconds after the game has loaded, so it doesn't slow the start
    var load = function(){
      var sc = document.createElement('script');
      sc.src = 'https://browser.sentry-cdn.com/' + (s.version || '11.7.0') + '/bundle.min.js';
      sc.crossOrigin = 'anonymous';
      sc.onload = function(){
        if (!window.Sentry) return;
        Sentry.init({
          dsn: s.dsn,
          release: 'police-thief@' + (cfg.version || 'dev'),
          environment: /onrender|github\.io/.test(host) ? 'test' : 'production',
          sampleRate: 1.0,
          // ignore errors that come from browser add-ons, not from the game
          denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i, /^safari-extension:/i],
          ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured'],
        });
        ready = true;
        removeEventListener('error', early);
        removeEventListener('unhandledrejection', early);
        for (var k in tags) Sentry.setTag(k, tags[k]);
        Sentry.setTag('screen', innerWidth + 'x' + innerHeight);
        for (var i = 0; i < queue.length; i++) Sentry.captureException(queue[i]);
        queue = [];
      };
      document.head.appendChild(sc);
    };
    if (document.readyState === 'complete') setTimeout(load, 3000);
    else addEventListener('load', function(){ setTimeout(load, 3000); });
  }

  // ---------------------------------------------------------- GoatCounter
  if (cfg.goatcounter){
    var code = String(cfg.goatcounter).replace(/[^a-z0-9-]/gi, '');
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://gc.zgo.at/count.js';
    g.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
    document.head.appendChild(g);
    var sent = {};
    window.PT_TRACK = function(name){
      // the same event is counted at most once a minute per player, so one person can't flood the numbers
      var now = Date.now();
      if (sent[name] && now - sent[name] < 60000) return;
      sent[name] = now;
      var tries = 0;
      var go = function(){ if (window.goatcounter && goatcounter.count) goatcounter.count({ path: name, title: name, event: true }); else if (++tries < 30) setTimeout(go, 1000); };
      go();
    };
  }
})();
