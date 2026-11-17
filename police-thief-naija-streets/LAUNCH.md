# Launch checklist: Police & Thief: Naija Streets (web)

Costs are rough estimates, not quotes. Check current prices before you pay for anything.

## 1. Before anyone outside your circle plays (2–4 weeks)

- [ ] **Play it on real phones.** Use at least one cheap Android phone (2–3 GB RAM). If it stutters, switch Graphics to LOW in Settings and note which phone it was.
- [ ] **Play 20+ real games against people.** The bots are balanced against each other (about 50/50, ~2-minute rounds), not against humans. Write down what feels unfair.
- [ ] **Get one real artist for a week or two.** Replace the shape-built characters and shop fronts with proper low-poly models. This is the biggest visual jump left.
- [ ] **Get the theme song produced.** Use it in the menu and in trailers.
- [ ] **Run a name check.** Search the name with the Nigerian Trademarks Registry and do a web search for clashes. Keep using generic police uniforms: no real Nigeria Police Force badges, crests or logos.

## 2. Hosting (about $5–25 a month to start)

- [ ] **Domain:** for example `policeandthief.ng` or `.com` (about $10–40 a year).
- [ ] **Server:** a host that keeps Node.js running all the time (Fly.io, Railway, Render paid plan, or a small VPS). Deploy with the `Dockerfile` and give it a persistent `/data` volume for the leaderboard. See `README.md`.
- [ ] **HTTPS:** your host's built-in certificate, or Caddy on a VPS. Online play needs `wss://`.
- [ ] **Uptime monitor:** something free like UptimeRobot pinging `/health`.
- [ ] **Location:** a server in Europe (London or Amsterdam) gives Nigerian players lower lag than the US.

## 3. Money

- [ ] **Pick one ad route to start:**
  - Publish on **CrazyGames** and/or **Poki**. They bring players and share ad revenue; check their current terms and exclusivity rules.
  - Or run **Google H5 Games Ads** on your own site. This needs an AdSense account approved for H5 games.

  Switch it on in `config.js`. The game already handles "watch an ad to double your ₦" and one break between games.
- [ ] **Paid items (later, once people are playing):** ₦ packs or a premium Street Pass through **Paystack** (needs CAC business registration). This needs purchase checks on the server, which is the next piece of work to build. Don't take payments until it exists.
- [ ] **Bank account and tax:** register the business, and keep ad and payment income separate from personal money.

## 4. Legal and trust

- [ ] **Finish `privacy.html`:** your name, contact email and date, plus the age and NDPA 2023 sections. Have a lawyer read it.
- [ ] **Terms of use:** a short page with fair-play rules, no cheating, and what happens to accounts that abuse chat or names.
- [ ] **Name filter:** street names are cleaned of symbols, but add a bad-word filter for names before public launch.
- [ ] **Ad consent:** if you show ads to players in the UK or EU, use your ad partner's consent tools.

## 5. Launch plan

- [ ] **Closed test (1–2 weeks):** 30–50 friends and classmates through a WhatsApp group. Watch the `/health` player count and collect feedback.
- [ ] **Soft launch:** post on TikTok, Instagram Reels and X with 15-second clips. Use the song's chorus, funny catches and escapes, and night games.
- [ ] **Run a "Best escape of the week" clip contest,** with ₦ airtime prizes.
- [ ] **Submit to CrazyGames / Poki** once retention looks healthy (people coming back day 2 and day 7).
- [ ] **Reach Nigerian gaming communities:** gaming creators, campus esports clubs, and the Maliyo / Nigerian games community.

## 6. After launch (every week or two)

- [ ] **Watch the numbers:** players per day, games per player, day-1 and day-7 return rate, and how often each side wins.
- [ ] **Rebalance in `js/world.js`** and test with `node tools/balance.mjs` before every update.
- [ ] **Add content:** a new outfit or dance each fortnight, a new Street Pass season every 6–8 weeks, then a second map (market, campus or estate).
- [ ] **Event weekends:** for example "NEPA weekend" (night games only, double ₦).

## What's built vs. what's still needed

| Built | Still needed |
|---|---|
| 3D portrait game, bots, 3 difficulty levels that adapt | Proper art and the produced song |
| Public quick match, private rooms, leaderboard (game server) | Hosting, domain, monitoring |
| Wardrobe, Street Pass, trophies, missions, streaks | A bad-word filter and terms page |
| Ad hooks for Poki / CrazyGames / Google H5 Ads (off) | An ad account and switching one on |
| Install to home screen, works on bad networks | Paystack purchases with server checks |
| Draft privacy page | Legal review |

## 6. Added in this version

- [ ] **Record the theme song.** `audio/theme.mp3` is the instrumental and `SONG.md` has the lyrics, chords and tune. Book a singer for an hour to put the chorus and two verses over it, or hand both files to a producer to replay with live guitar and shekere.
- [ ] **Playtest the new street.** Football (kick the ball, score for ₦30), six shops that sell jollof, pure water, suya, glucose, kunu and small chops for ₦ notes picked up in the match, and the daily missions tied to them. Watch whether new players find the shops without being told.
- [ ] **Check the busy street on a cheap phone.** Shopkeepers, chickens and smoke switch off when Graphics is LOW.
