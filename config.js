// Game settings you can change without touching the code.
window.PT_CONFIG = {
  // Online server. Leave '' when players open the game from the server's own address.
  // If the game is on a different website from the server (for example GitHub Pages), put the
  // server's address here, starting wss:// and ending /ws, e.g. 'wss://police-thief-naija.onrender.com/ws'
  // Without it, the GitHub Pages copy is single player only.
  server: '',
  // The server's address for payments and the leaderboard, when the game is on a different website,
  // e.g. 'https://police-thief-naija.onrender.com'. Leave '' otherwise.
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
