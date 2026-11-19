# Making money from Police & Thief: Naija Streets

Two things are built in: ads and real-money purchases. Both are switched off until you add your own keys in `config.js`. Every line involved is tagged in the code, so search the project for `[AD]` or `[PAY]` to find them all.

## 1. Ads

### Where the ad code is

| What the player sees | File and line | What it calls |
|---|---|---|
| Ads start when the game opens | `js/main.js` line 34 | `ADS.init()` |
| "Watch an ad to double your ₦" after a match | `js/main.js` line 704 | `ADS.rewarded()` |
| "Free ₦50" in the Store, 5 a day | `js/store.js` line 89 | `ADS.rewarded('store-free-cash')` |
| Short break before "Play again", at most every 3 minutes | `js/main.js` line 720 | `ADS.breakBetweenGames()` |
| Banner under the match results (Google only) | `js/main.js` line 703 | `ADS.showBanner()` |
| The ad networks themselves | `js/ads.js` | Poki, CrazyGames and Google adapters |
| Your settings | `config.js` line 8 | `ads: { ... }` |

No ad ever plays during a match. Players who buy "No ad breaks" skip the break and the banner; the ads they choose to watch for ₦ still work.

### Turning ads on: pick one

**A. Publish on a game portal (easiest, no ad account needed).** Poki and CrazyGames host the game, bring players, sell the ads and split the money with you.
1. Apply as a developer on poki.com/developers or developers.crazygames.com.
2. In `config.js` set `ads: { provider: 'poki' }` or `ads: { provider: 'crazygames' }`.
3. Upload the game files (everything except the `server` folder) as they ask. Online play still needs your own server; set `server:` in `config.js` to its address.

**B. Your own website with Google ads.**
1. Get the game on your own domain (see LAUNCH.md).
2. Apply for Google AdSense at adsense.google.com, then ask to join H5 Games Ads (the program for ads inside web games).
3. In `config.js` set `ads: { provider: 'h5', client: 'ca-pub-YOUR-ID', bannerSlot: '', test: true }`.
4. For the banner, create a "Display ad" unit in AdSense and paste its slot number into `bannerSlot`.
5. When Google approves the site, change `test: true` to `test: false`.

## 2. Real-money purchases (Paystack)

### What is for sale (change prices in `js/products.js`)

| Item | Price | Player gets |
|---|---|---|
| Small bag of ₦ | NGN 300 | ₦1,000 game cash |
| Big bag of ₦ | NGN 900 | ₦3,500 game cash |
| Ghana-Must-Go of ₦ | NGN 1,800 | ₦8,000 game cash |
| Owambe Pack | NGN 1,200 | Agbada and Gold Gele (thief), Ceremonial Green (police); Store-only |
| Area Boss Pack | NGN 1,500 | Area Boss stripes (thief), Rapid Response (police), plus ₦1,000 |
| No ad breaks | NGN 1,000 | No breaks between games and no banner, on that device |

Nothing for sale makes anyone faster or better at catching. It's all looks and game cash, and game cash only buys looks and street food that every player can also earn by playing.

### Where the payment code is

| Part | File | |
|---|---|---|
| Product list and prices | `js/products.js` | read by both the game and the server, so the server rejects a wrong amount |
| Store screen and Paystack checkout | `js/store.js` | opens Paystack's own payment window |
| Payment check | `server/server.mjs`, the `payments [PAY]` block | asks Paystack whether the payment really happened |
| Giving the item | `js/meta.js`, `grantProduct()` | only after the server says yes; each payment counts once |
| Your settings | `config.js` line 13 | `payments: { ... }` |

### Turning payments on
1. Open a Paystack account at paystack.com (business registration with CAC is needed for live payments).
2. In the Paystack dashboard, open Settings > API Keys & Webhooks. You'll see a public key (`pk_...`) and a secret key (`sk_...`).
3. In `config.js` set `payments: { provider: 'paystack', publicKey: 'pk_test_...' }`.
4. Where the server runs, set the environment variable `PAYSTACK_SECRET=sk_test_...`. Never put the secret key in `config.js`: anyone can read that file.
5. Test with Paystack's test cards until purchases arrive in the game, then swap both keys for the `pk_live_` / `sk_live_` ones.

Payments only work when the game is on your own website with the server running. Inside the claude.ai preview the Store shows prices, but the Buy buttons stay off.

### Limits to know about
- Purchases are saved on the player's phone. If they clear their browser or change phones, they lose them. Player accounts (sign in with phone number or Google) fix this, and they're the next thing to build once money is coming in.
- Paystack takes a fee on each payment (check their current pricing page).
- Every payment the server accepts is listed in `server/data/payments.json`, so you can answer "I paid but didn't get it" messages.

## 3. More ways to make money

These are ideas, not built yet. Rough order: cheapest and fastest first.

1. **Brand sponsorship inside the game.** The street already has shop signs, a Danfo, a viewing centre board and billboards. Sell those spots to real Nigerian brands (a drinks company on the Iya Bisi sign, a betting-free sports channel on the viewing centre board, a telco on the Danfo). One sponsor deal can pay more than months of ads. Be careful with alcohol and betting brands if young people play.
2. **Season pass with a paid track.** The free Street Pass exists. Add a paid "Gold" lane (NGN 1,500 a season, every 6 to 8 weeks) with extra outfits and dances. This is the main income for most competitive mobile games.
3. **Creator and influencer codes.** Give Nigerian TikTok and YouTube creators a code that gives their fans a free outfit. Pay them a share of purchases made with their code. It brings players and money together.
4. **Private rooms for events.** Charge schools, churches, youth camps and companies a small fee for a branded private tournament room with their own leaderboard and a custom outfit colour.
5. **Tournaments with prizes paid by sponsors.** A weekly cup with data-bundle or airtime prizes from a telco sponsor. Keep entry free, so it doesn't count as gambling.
6. **Merch.** The thief's striped top and the police cap are recognisable. Print-on-demand T-shirts, caps and phone cases, sold through Instagram or a Selar or Paystack storefront, with no stock to hold.
7. **Licensing the game to schools and NGOs.** A version with safety or civic lessons in the tutorial (road safety, staying with the group) for school programmes.
8. **Sell the music.** Put "Catch Me If You Fit" on Audiomack, Boomplay and Spotify once it's recorded with a singer.
9. **Diaspora pricing.** Add Stripe or Paystack's USD/GBP support and show dollar or pound prices to players abroad. The same pack earns about 3 to 5 times more in those currencies.

What to avoid: loot boxes and random paid prizes (they're treated as gambling in many places and app stores restrict them), paying to win, and ads during matches.
