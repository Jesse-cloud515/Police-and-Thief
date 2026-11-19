# Police & Thief: Naija Streets

The Nigerian playground game as a 3D web game: police chase, thieves hide, free your people, escape together. Portrait, built for phones, and it plays in any modern browser.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html`, `js/` | The game (three.js, no build step) |
| `config.js` | Settings you can change without touching code: server address, ads |
| `manifest.webmanifest`, `sw.js`, `icons/` | "Add to home screen" and offline support |
| `privacy.html` | Draft privacy policy. Fill in the brackets and have it checked |
| `server/` | The game server: serves the site **and** runs online matches |
| `Dockerfile` | One-command deploy to Fly.io, Railway, Render or any VPS |

## Run it on your laptop

You need Node.js 18 or newer.

```bash
cd server
npm install
npm start
```

Open http://localhost:8080 on your laptop. To test on your phone, connect it to the same Wi-Fi and open `http://YOUR-LAPTOP-IP:8080`. Open it in two browsers and press **Play Online → Quick Match** in both to play each other.

## Put it online

The server must stay running all the time (matches happen on it), so pick a host that keeps Node apps awake. Free tiers that "sleep" will break online play.

**Fly.io / Railway / Render (Docker):** create an app from this folder; it finds the `Dockerfile`. Give it a persistent volume mounted at `/data` so the leaderboard survives restarts. Point your domain at it.

**A small VPS (Hetzner, DigitalOcean, Contabo):** install Node 20, copy the folder, run `cd server && npm install && npm start` under `pm2` or `systemd`, and put Caddy or Nginx in front for HTTPS (WebSockets need `wss://` on an HTTPS site).

Health check: `GET /health`. Leaderboard: `GET /api/leaderboard`.

If you host the game files somewhere else (for example Cloudflare Pages) and only run the server on Fly.io, set `server: 'wss://your-server-domain/ws'` in `config.js`.

## Ads

Off by default. In `config.js`, set `ads.provider` to `poki` or `crazygames` when you publish on those portals (they load their own SDK), or `h5` with your Google AdSense client id for your own site. The game only shows a rewarded ad when the player taps "double your ₦", plus at most one short break between games every three minutes. Never during a match.

## Tuning

All balance numbers live in `js/world.js` (`CFG`). To check balance after a change, run bot-only matches headless:

```bash
node tools/balance.mjs 60
```

Current settings: bots-vs-bots, police win about 45–55% of games, rounds last about 2 minutes, and there are usually one or two rescues per game.

## Theme song and street details

- `audio/theme.mp3` is the theme instrumental. Rebuild or change it with `python3 tools/make_theme.py` (needs numpy, scipy, ffmpeg). Lyrics and chords are in `SONG.md`.
- `js/details.js` holds the shop fronts, shopkeepers, market goods, football, ₦ notes and chickens. The rules for football, street money and shops are in `js/sim.js`; prices and effects are the `SHOP_DEFS` list at the bottom of `js/world.js`.
- `node tools/balance.mjs 100` plays 100 bot-only games and prints the win split and round length.

## Locations, cattle and auto-catch

- Four locations live in the `MAPS` list in `js/world.js`: Naija Street, Market Day, School Yard, Behind the Church. Each entry lists its buildings, hiding places, shops and its one special thing (`herd`, `bell`, `gaps`, `pitch`). Copy an entry to add a fifth.
- The herdsman and his cattle walk the line given by `herd`; players have to go round them. Speed and how often they pass are `herdSpeed` and `herdEvery` in `CFG`.
- Police catch automatically (`autoCatch` in `CFG`). Set it to `false` to bring back the CATCH button.
- `node tools/balance.mjs 100 market` runs the bot check on one location (`street`, `market`, `school`, `church`).

## Controls, tutorial and file layout

- `css/style.css` holds every style; `index.html` is markup only.
- `js/controls.js` is the joystick (appears under your thumb, eFootball style), the on-screen buttons, keyboard keys, and the Controls tab in Settings (stick type and size, sprint style, hands, button size, see-through, vibration, drag-to-arrange layout, key binding).
- `js/tutorial.js` is the one-minute guided practice offered on first launch, and from More > Tutorial.

## Money

Ads and real-money purchases (Paystack) are in the code but switched off. `MONETIZATION.md` lists every line (search for `[AD]` and `[PAY]`), how to switch them on, and other ways to earn.
