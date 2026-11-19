// Game settings you can change without touching the code.
window.PT_CONFIG = {
  // Online server. Leave '' when the game is served by server/server.mjs (same website).
  // If the game is on a different host than the server, put e.g. 'wss://play.yourdomain.com/ws'
  server: '',
  // Address of the server's /api/... if it is not the same website as the game. Usually leave ''.
  api: '',
  // [AD] Ads: 'none' | 'poki' | 'crazygames' | 'h5'   (see js/ads.js and MONETIZATION.md)
  //   h5 = Google ads on your own website: client is your AdSense publisher id 'ca-pub-...',
  //   bannerSlot is the id of a display ad unit you create in AdSense (optional).
  //   Set test:false only when Google has approved your site.
  ads: { provider: 'none', client: '', bannerSlot: '', test: true },
  // [PAY] Real-money purchases: 'none' | 'paystack'   (see js/store.js and MONETIZATION.md)
  //   publicKey comes from Paystack dashboard > Settings > API Keys & Webhooks.
  //   Use the pk_test_ key until everything works, then the pk_live_ key.
  //   The SECRET key never goes here; it goes on the server as PAYSTACK_SECRET.
  payments: { provider: 'none', publicKey: '' },
};
