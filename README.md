# Police & Thief: Naija Streets

The game we played as kids, now on your phone. Police chase, thieves hide, and anyone caught gets locked in the Police Post until a friend runs in to free them. Thieves win if they escape through the exits after the 2:00 mark. Police win if everyone is locked up when time runs out.

It's a 3D web game. It runs in the phone's browser with nothing to download, and players can add it to their home screen like an app.

## What's in the game

- **4 police against 4 thieves.** Bots fill any empty places, so a match always has eight players.
- **Four locations, each with something of its own:**
  - Naija Street has a football field you can score on mid-chase.
  - Market Day is a maze of stalls with more ₦ on the ground.
  - School Yard has a bell that shows the other team on your map.
  - Behind the Church has tall grass and a hole in the fence.
  - A herdsman and his cattle cross some of the roads.
- **Street money and shops.** Pick up ₦ notes and buy jollof, pure water, suya, zobo and more. Every food does something different. Floating icons show where the shops are, and they also appear on the minimap.
- **Night games.** About one game in three is at night, with shorter sight and lanterns at the shops.
- **Online play, two ways:**
  - **Quick Match**: play anyone. The server picks the teams.
  - **Play with Friends**: make a room, send the 4-letter code or the invite link on WhatsApp, choose sides and the location.
- **Your own character.** A wardrobe for both police and thief, levels, daily missions, a Street Pass, trophies and play streaks.
- **Made for phones.** A joystick that appears under your thumb, a SPRINT button, and controls you can rearrange. Players choose upright or sideways the first time they open it. It works on slow networks and keeps working offline once loaded.
- **A one-minute tutorial** covering both teams, including a card that explains every power-up.

## Run it on your laptop

You need Node.js 18 or newer.

```bash
cd server
npm install      # first time only
npm start
```

Open http://localhost:8080. To try it on your phone, connect to the same Wi-Fi and open `http://YOUR-LAPTOP-IP:8080`. For an online game against yourself, open it in two windows and tap **PLAY ONLINE** in both.

## Put it online

The game has two parts:

- **The game files** (`index.html`, `js/`, `css/` and so on). Any website can host these, GitHub Pages included. On their own they give you single player only.
- **The game server** (`server/`). It runs the online matches, the leaderboard and payments. It needs a host that runs Node.js all day.

The easy way is to put the whole folder on Render and let the server host the files too:

1. Push this folder to GitHub.
2. On render.com, choose **New + → Blueprint**, pick the repo and click **Apply**. `render.yaml` and the `Dockerfile` do the rest.
3. Share the address Render gives you. Online play works there straight away.

To keep your GitHub Pages copy as well, put the Render address in `config.js` (`server` and `api`) and push again.

The free Render plan sleeps after 15 quiet minutes and takes about a minute to wake up. The game shows "Waking the game server up…" while it waits. The free plan also loses the leaderboard on every restart. For the real launch, use a paid plan with a disk mounted at `/data`. Fly.io, Railway or a small VPS work the same way with the `Dockerfile`. Use HTTPS, so online play connects over `wss://`.

Useful addresses on the server: `GET /health` shows whether it's running and how many rooms and players it has. `GET /api/leaderboard` returns the leaderboard.

## The folder

| Path | What it is |
|---|---|
| `index.html`, `css/style.css` | Page layout and every style |
| `js/` | The game: rules (`sim.js`), locations and tuning (`world.js`), 3D drawing (`scene.js`, `details.js`, `chars.js`), controls, tutorial, saves, online play, shop and ads |
| `config.js` | Settings you change without touching code: server address, ads, payments |
| `server/` | The game server |
| `render.yaml`, `Dockerfile` | Hosting setup |
| `manifest.webmanifest`, `sw.js`, `icons/` | Home-screen install and offline play |
| `audio/theme.mp3`, `SONG.md` | The theme music, with its lyrics and chords |
| `tools/balance.mjs` | Plays bot-only games and prints the results |
| `privacy.html` | Draft privacy policy. Fill in the brackets and have it checked |

## Changing things

**`CODE_GUIDE.md` is the manual.** It explains every file and lists where to make common changes. Section 9 covers online play, the sprint button, screen direction, the power-ups card and solid props.

A few things you'll want often:

- **Speeds, energy, catch distance, match length:** the `CFG` list at the top of `js/world.js`.
- **Shops, prices and what each food does:** the `shops:` line of each location in `MAPS`, also in `js/world.js`.
- **After any change to the rules:** run `node tools/balance.mjs 60` to check the bots are still fair. Add a location name at the end (`street`, `market`, `school` or `church`) to test just that one. Right now police win roughly 45–65% of bot games depending on the location, and rounds last about two minutes.
- **After any change at all:** bump the version on line 2 of `sw.js`. Otherwise phones that installed the game keep the old files.

## Ads and payments

Both are built in and switched off. `MONETIZATION.md` explains how to switch them on and lists every line involved (search the code for `[AD]` and `[PAY]`). The game never shows ads during a match. Paystack's secret key goes on the server only, never in `config.js`.

## Other documents

- `LAUNCH.md`: everything needed before a public launch
- `MONETIZATION.md`: ways to make money from the game
- `SONG.md`: the theme song
