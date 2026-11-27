# Code guide: Police & Thief, Naija Streets

This guide explains the code so you can change things yourself. Line numbers match the files as they are on 20 November 2026. They move when you add or delete lines, so if a number looks wrong, search for the name instead (Ctrl+F in VS Code, or Ctrl+Shift+F to search every file).

How it's laid out:

1. How the files fit together
2. How to test a change
3. Quick changes: what to edit for the common things
4. The settings files, line by line
5. Every file, function by function
6. Names you will see everywhere
7. JavaScript you need to read this code
8. Where you'll want to make corrections, and my suggestions
9. Online play, sprint, screen direction, power-ups, solid props, and other things worth knowing

---

## 1. How the files fit together

```
index.html          the page: every screen, button and pop-up, as HTML
css/style.css       how all of it looks (colours, sizes, positions)
config.js           switches you set without touching code (server, ads, payments)
js/main.js          the boss file: starts everything, runs every frame, handles screens and sounds
js/world.js         the numbers that tune the game, the four locations, collision, pathfinding
js/sim.js           the rules of a match, and the bots' brains
js/meta.js          the player's save: level, ₦, wardrobe, missions, Street Pass, trophies
js/controls.js      joystick, buttons, keyboard, and the Controls settings page
js/tutorial.js      the one-minute guided tutorial
js/chars.js         builds the 3D people (police, thieves, shopkeepers)
js/scene.js         builds the 3D world, lights, camera and effects
js/details.js       shop fronts, market goods, the football, ₦ notes, chickens, the herd, bell, fence gaps
js/net.js           online play: packs and unpacks match snapshots, talks to the server
js/store.js         the Store pop-up and Paystack payments (switched off until you add keys)
js/products.js      the list of things sold for real money
js/ads.js           ad networks (switched off until you choose one in config.js)
server/server.mjs   the Node.js game server: serves the files, runs online matches, checks payments
sw.js               lets the game load offline and install like an app
tools/balance.mjs   plays bot-only games and prints who wins, for checking balance
tools/make_theme.py rebuilds the theme music file
```

The important split: `sim.js` decides **what happens** (who moved, who got caught, who won). `scene.js`, `chars.js` and `details.js` only **draw** what happened. `main.js` sits in the middle: every frame it reads your controls, asks `sim.js` to move the game forward, then asks the drawing files to show the result. That's why changing a speed or a rule never needs a change to the 3D code, and changing a colour never touches the rules.

The same `sim.js` runs on the server for online matches, so a rule change there applies online too after you restart the server.

---

## 2. How to test a change

The game uses JavaScript modules, which browsers refuse to load from a plain file. Double-clicking `index.html` won't work. Run the server instead:

1. Install Node.js 18 or newer from nodejs.org (once).
2. Open a terminal in the project folder, then:
   ```
   cd server
   npm install      (only the first time)
   npm start
   ```
3. Open http://localhost:8080 in Chrome.
4. To test on your phone, connect it to the same Wi-Fi and open `http://YOUR-LAPTOP-IP:8080` (find the IP with `ipconfig`).

After each edit:

- **Refresh the page.** If the old version keeps showing, press Ctrl+Shift+R. The offline cache in `sw.js` can hold on to old files; when you change files, also change the version text on line 2 of `sw.js` (for example `'pt-v8-1'` to `'pt-v8-2'`) so phones pick up the new files.
- **Restart the server** (Ctrl+C, then `npm start`) if you changed `sim.js`, `world.js` or `server.mjs`, because the server keeps the old rules in memory.
- **Open the console (F12 → Console)** if the screen goes black or a button stops working. A red error there names the file and line that broke.
- **Check a file for typos** without opening the game: `node --check js/world.js` prints nothing when the file is fine, or the line with the mistake.
- **Check balance** after changing speeds or timings: from the project folder run `node tools/balance.mjs 60`. It plays 60 bot-only games and prints how often police win and how long rounds last. Around 45–60% police wins and 1½–2½ minute rounds is where the game currently sits. Add a location name to test one map: `node tools/balance.mjs 60 market`.

Keep a copy of a file before a big edit. The `_previous_version` folder already holds your edits from before the last update.

---

## 3. Quick changes

| I want to… | Go to | Change |
|---|---|---|
| Make everyone faster or slower | `js/world.js` lines 13–14 | `walkT`, `walkP`, `sprintT`, `sprintP` |
| Make matches longer or shorter | `js/world.js` line 8 | `matchTime` (seconds) |
| Open the exits earlier or later | `js/world.js` line 10 | `exitsOpenAt` (seconds into the match) |
| Make catching easier or harder | `js/world.js` line 18 | `captureRange`, `captureWindup` |
| Turn the CATCH button back on | `js/world.js` line 29 | `autoCatch: false` |
| Change how many escapes win | `js/world.js` line 24 | `escapesToWin` |
| Change a shop's item or price | `js/world.js` lines 65–66 (street), 84–85, 99, 114 | the `shops:` list of that location |
| Rename a building | `js/world.js`, the `ob:` list of that location | the text in capitals. If it's a shop, change the same name in that location's `shops:` list too, or the shop disappears |
| Add or change an outfit or hat | `js/meta.js` lines 11–86 | add a line like the others; see section 4.3 |
| Change starting ₦ | `js/meta.js` line 144 | `coins:150` |
| Change XP needed per level | `js/meta.js` line 118 | `120 + l*60` |
| Change match rewards | `js/meta.js` lines 236–249 | the two numbers in each `add(...)`: XP, then ₦ |
| Change daily missions | `js/meta.js` lines 121–136 | `goal`, `text`, `reward` |
| Change rank names | `js/meta.js` lines 114–117 | the two lists |
| Change what bots shout | `js/sim.js` lines 13–21 | the text in quotes |
| Change quick-chat buttons | `js/sim.js` line 22 | three per side |
| Change bot names | `js/sim.js` lines 24–25 | the two lists |
| Change tutorial wording | `js/tutorial.js` lines 43–80 | the text after `text: () =>` |
| Change default control settings | `js/controls.js` lines 11–21 | see section 4.5 |
| Change a sound effect | `js/main.js` lines 69–88 | see section 5.13 |
| Change colours, sizes, fonts of menus | `css/style.css` | see section 5.15 |
| Change the "How to play" text | `index.html`, search `howDlg` | the paragraphs |
| Change police uniform details | `js/chars.js` lines 52–77 and 137–147 | see section 5.8 |
| Change prices of real-money items | `js/products.js` lines 10–20 | `price` in naira |
| Turn on ads or payments | `config.js` | see section 4.1 and `MONETIZATION.md` |
| Hide the SPRINT button / sprint with the stick | `js/controls.js` line 14 | `sprint: 'auto'`; see section 9.2 |
| Make energy last longer | `js/world.js` lines 15–17 | lower `drainT`/`drainP`, raise `regenT`/`regenP`, lower `regenDelay` |
| Change what a power-up does in the tutorial card | `js/tutorial.js` lines 52–61 | the `list:` rows; see section 9.4 |
| Shop pins (the floating icons) | `js/details.js`, `pinTex` and the `pin` lines in `buildStreet` | colours, size (`pin.scale`), height (`4.3`) |
| Shop badges on the minimap | `js/main.js`, `drawMini` | the `arc(..., 9, ...)` sizes |
| Start the game sideways by default | `js/meta.js` line 148 | `orient:'landscape'`; see section 9.3 |
| Add a parked car or other solid prop | `js/world.js` line 68 | the `props:` list; see section 9.5 |
| Change how often matches are at night | `js/sim.js` line 43 | `.3` means 30% |
| Set up online play | `server/`, `config.js` | see section 9.1. `config.js` now points at https://police-thief-naija.onrender.com |
| Restore purchases (packs and No-ads, by email) | `js/store.js` `restore`, `server/server.mjs` `restorePurchases` | which kinds can be restored: `RESTORABLE` in the server |

---

## 4. The settings files, line by line

### 4.1 `config.js`

```
1   // comment: what this file is
2   window.PT_CONFIG = {                    opens the settings object every other file reads
4-5   server: '',                           address of the online server. Leave '' when the game is opened from
                                            the same server (normal). Set e.g. 'wss://play.yoursite.com/ws' only if
                                            the game files and the server live on different websites
6-7   api: '',                              same idea for payment checks. Usually ''
8-12  ads: { provider:'none', client:'', bannerSlot:'', test:true },
                                            provider: 'none', 'poki', 'crazygames' or 'h5' (Google ads on your own site)
                                            client: your AdSense id 'ca-pub-...' (h5 only)
                                            bannerSlot: an AdSense ad unit id for the banner under results (optional)
                                            test: true shows test ads. Set false only after Google approves your site
13-17 payments: { provider:'none', publicKey:'' },
                                            provider: 'none' or 'paystack'
                                            publicKey: the pk_test_... or pk_live_... key from your Paystack dashboard.
                                            The SECRET key never goes here; it goes on the server (see MONETIZATION.md)
18  };                                      closes the object
```

### 4.2 `js/world.js`: the tuning values (`CFG`, lines 7–34)

Distances are in map units. A location is 40 units wide and 64 tall. A player's body is 0.84 units across. Speeds are units per second. Times are seconds. `T` means thief, `P` means police.

```
8   matchTime: 240         length of a match. When it runs out, police win
9   headStart: 5           seconds the police stand still at the start ("counting")
10  exitsOpenAt: 120       seconds into play before the four corner exits open
11  sightDay: 10           how far police see a thief in the open, in the day
    sightNight: 6.5        same at night
12  revealDay: 2.6         a hiding thief is seen anyway if police come this close, day
    revealNight: 2.1       same at night
13  walkT: 5.9             thief walking speed
    walkP: 4.7             police walking speed
14  sprintT: 8.7           thief sprint speed
    sprintP: 7.0           police sprint speed
15  drainT: 26             stamina a thief uses per second of sprinting (stamina is out of 100).
                           It only drains while you are actually moving faster than a walk, so
                           holding SPRINT against a wall or standing still costs nothing
    drainP: 25             same for police
16  regenT: 18             stamina a thief gets back per second when not sprinting
    regenP: 10             same for police. Lower than thieves on purpose: one officer can't
                           simply outrun a thief, so police have to work together
17  regenDelay: 0.8        seconds after you stop sprinting before energy starts coming back.
                           0 = straight away. Bigger = sprint bursts cost more
18  captureRange: 1.05     how close police must be to start a grab
    captureConfirm: 1.4    how close they must still be when the grab lands. If the thief is
                           further than this by then, it's a dodge
    captureWindup: 0.4     seconds between starting a grab and it landing. This is the thief's
                           window to dodge. Bigger = easier for thieves
19  captureCooldown: 1.3   seconds before an officer can try again after a missed grab
    arrestFreeze: 0.8      seconds the caught thief stands still before going to the Post
    escortTime: 3.5        seconds the officer is busy "walking the thief in" after a catch
20  rescueTime: 1.5        seconds a thief must hold FREE at a gate to free everyone
    rescueRange: 1.35      how close to the gate they must stand
21  escapeTime: 1.0        seconds a thief must hold ESCAPE inside an exit
22  immuneTime: 4.5        seconds freed thieves can't be caught again
23  campRadius: 7          size of the orange no-camping ring around the Post
    campFill: 3.5          seconds an officer can stand inside it before being reassigned
    campDrain: 3           seconds outside the ring for the meter to empty again
    reassignTime: 5        seconds a reassigned officer is slow and can't arrest
24  escapesToWin: 2        how many thieves must escape for the thieves to win
25  dashTime: 0.28         how long a thief's Dash lasts
    dashSpeed: 16          speed during the Dash
    dashCd: 7              seconds before Dash can be used again
26  whistleCd: 14          seconds between police whistles
    whistleRange: 5        how far the whistle reaches
    whistleSlow: 1.0       seconds thieves are slowed by it
27  noteMax: 12            most ₦ notes lying on the ground at once
    noteEvery: 4           seconds between new notes appearing
    noteValue: 10          ₦ each note is worth
28  goalCash: 30           ₦ for scoring a goal
    shopRange: 1.7         how close to a counter you must be to BUY
    fullTime: 6            seconds of no tiring after jollof or other "full" food
    suyaTime: 6            seconds of extra speed after suya or other "boost" food
29  autoCatch: true        police grab automatically. false brings back the CATCH button
30  herdSpeed: 1.6         walking speed of the herdsman and cattle
    herdEvery: 32          seconds between cattle crossings
    bellCd: 25             seconds before the school bell can be rung again
    bellReveal: 5          seconds the other team shows on your map after ringing it
31  pickupEvery: 12        seconds between free Agege bread / zobo appearing
    pickupMax: 3           most of them on the ground at once
    zoboTime: 3.5          seconds of speed boost from zobo
    zoboBoost: 1.25        speed multiplier while boosted (suya and zobo both use it). 1.25 = 25% faster
33  diff: [easy, normal, hard]
                           how strong the OTHER team's bots are in single player.
                           spd: their speed multiplier. dodge: chance a thief bot dodges a grab (0 to 1).
                           sight: multiplier on how far police bots see. react: listed but not used yet.
                           The game picks easy/normal/hard by itself (meta.js line 276, `soloDifficulty`)
35  W = 40, H = 64         map width and height. Don't change: the maps are drawn for this size
    R = 0.42               body radius of every person
```

### 4.3 `js/world.js`: the four locations (`MAPS`, lines 54–117)

Each location is one block. Using `street` (lines 55–71) as the example:

```
55  name: 'Naija Street'      full name shown in the game
    short: 'Street'           short name on the location button
    icon: '🛣️'               emoji on the button
    blurb: '...'              one line describing it, shown when you pick it
57  ob: streetRaw             the obstacles (buildings, buses, stalls). For the street they're in
                              the list on lines 42–50; other locations write them right here
58-59 hides:                  hiding spots: [x, y, radius, kind]. kind is 'tree', 'canopy' or 'grass'
60  spawnT:                   where the 4 thieves start: [x, y] each
61  roads:                    tarred road strips: {x, y, w, h}. Only paint; they don't block anyone
62  pitch:                    the football field {x, y, w, h}, or null for no field
63  lamps:                    street lamps [x, y]. They glow at night
64  exits:                    names of the 4 corner exits, in this order: top-right, bottom-left,
                              top-left, bottom-right
65-66 shops:                  one entry per shop:
                              [building name, item, price, effect, icon, counter goods]
                              building name must match a building in ob exactly
                              effect: 'full' (stamina full + no tiring), 'water' (+60 stamina),
                                      'boost' (faster for a few seconds), 'ready' (Dash/Whistle ready now)
                              counter goods decides what's on the counter AND which shopkeeper stands
                              there: 'pots', 'store', 'suya', 'chemist', 'cooler', 'chops'
68-69 props:                  solid extras written the normal way round [x, y, w, h, kind, '', colour]:
                              parked cars ('car'), a kiosk ('kiosk'), a cooler ('cooler').
                              Players and bots bump into them. Any location can have a props list
70  ground: '#c98450'         colour of the ground
    show: [33, 28]            where your two characters stand on the start screen
    herd: {x0, y0, x1, y1}    the line the cattle walk along (start and end). Leave it out for no cattle
```

Other extras some locations have: `bell: {x, y}` (school bell, line 100), `gaps: [[x, y, direction], ...]` (holes in the fence, line 115), `noteMax: 18` (more ₦ on the ground, line 86), `props: [...]` (solid parked cars and the like, line 68).

An obstacle is `[x, y, width, height, kind, label, colour]`:

- **kind** is `'bld'` (building), `'stall'` (market stall with umbrella), `'bus'` (danfo), `'keke'`, `'tank'` (water tank), `'bore'` (borehole), or in a `props` list `'car'`, `'kiosk'`, `'cooler'`. A car is drawn lengthways along its longer side, so `w` bigger than `h` gives a car parked left–right.
- **label** is the sign text, for buildings only.
- **colour** is a hex colour like `'#c94a3c'`.
- **x, y** is the top-left corner. x runs left to right (0–40) and y top to bottom (0–64).

**Watch out on Naija Street only.** Its buildings (lines 43–49) and hiding spots (lines 58–59) were first drawn sideways. Line 50 and the end of line 59 turn them. In those two places, write positions as `[y, x, height, width]`. Every other location uses plain `[x, y, w, h]`.

**Keep these spots clear:**
- The Police Post is fixed at x 17–23, y 29–35 (line 123).
- The police start around it (line 129).
- The exits are the four corners (line 130).

Don't put buildings on any of those.

**To add a fifth location:**
1. Copy the whole `church: { ... },` block, paste it before line 117, and rename `church` to a new id like `estate`.
2. Change its contents.
3. It appears in the location picker automatically.
4. Test with `node tools/balance.mjs 40 estate`.

### 4.4 `js/meta.js`: wardrobe, levels, missions, rewards

**Lines 7–8:** the six skin tones and six shoe colours, as hex colours. Add more by adding to the list.

**Lines 11–86, the `CATALOG`:** every wardrobe item.

- `P` is police and `T` is thief.
- Inside each: `outfit` and `head`.
- `eyes`, `extra` and `dance` are shared by both sides.

Each item is one line:

```
{ id:'p_khaki', name:'Khaki Patrol', col:'#a68a55', price:200, lvl:2 }
  id     a unique code. Never change an id that players may already own, or they lose it
  name   what the wardrobe shows
  col    police outfits: the uniform colour. 'camo' gives the MOPOL camouflage
  a, b   thief outfits: the two stripe colours
  pattern  thief outfits: 'ankara', 'aso' or 'agbada' prints instead of stripes
  jersey   true = green football kit
  price  ₦ cost. 0 = free for everyone
  lvl    level needed before it can be bought
  pass   given at this Street Pass tier instead of being sold
  paid   only sold for real money, in this Store pack (see products.js)
```

A new outfit or hat only needs a new line here if it reuses a look the code already draws:
- a new police colour (`col`), or
- a new thief stripe pair (`a`, `b`).

A brand-new hat shape also needs drawing code in `js/chars.js`, in the headwear section (from line 149). Copy one of the `else if (hw==='...')` blocks and give it your new id.

**Line 87, `rarity`:** the coloured label under each item, worked out from its price:
- 0 is Starter
- up to 150 is Common
- up to 350 is Rare
- up to 700 is Epic
- above that is Legendary

**Lines 93–96, `DEFAULT_LOOK`:** what a brand-new player wears.

**Lines 102–112:** how bots are dressed.
- `randomLook` picks anything.
- `botLook` keeps police bots mostly in NPF Black (70%), sometimes camo (15%) or white (8%).

**Lines 114–119, ranks:** nine rank names per side. You go up one rank every 2 levels (that's the `/2` on line 119).

**Line 118:** XP needed for the next level is `120 + level × 60`. Level 1 needs 180, level 10 needs 720.

**Lines 121–136, `MISSIONS`:** each day the game picks 3 from this list, never two with the same `k`.
- `k` is what counts:
  - `caps` catches
  - `frees` rescues
  - `escapes`
  - `dodges`
  - `games`
  - `winP` / `winT` wins as police or thief
  - `whistle` / `dash` special-move uses
  - `goals`
  - `buys` shop purchases
- `team` is `'P'`, `'T'` or `null` for either side.
- `goal` is how many.
- `reward` is ₦.

**Line 138, `KEY`:** the name the save is stored under in the browser. Changing it wipes everyone's progress.

**Lines 143–150, `fresh()`:** a new player's save.
- Starting ₦ is `coins:150` (line 144).
- Items owned from the start are the `owned:` list (line 145).
- Default settings are on line 148.

**Lines 151–164, `migrate()`:** repairs saves from older versions so nothing breaks. Leave it alone unless you add a new part to the save; then give it a default here.

**Line 220, daily streak reward:** `50 + day × 25`, capped at day 7. That's ₦75 on day 1 and ₦225 from day 7.

**Lines 231–274, `awardMatch()`:** what you earn after a match. Each `add('label', XP, ₦)` is one line on the results screen:

```
236 win: 110 XP, ₦60.  lose: 45 XP, ₦20
237 police: 25 XP and ₦10 per catch
239 thief: 30 XP and ₦12 per teammate freed
240 thief: 60 XP and ₦25 for escaping
241 thief: 10 XP and ₦3 per dodge
243 20 XP per goal
244 street money still in your pocket is kept as ₦
247 win streak bonus from 2 wins in a row
248 first win of the day: 100 XP, ₦50
249 night game: 15 XP, ₦5
253 every level up also gives ₦100
```

**Lines 276–280, `soloDifficulty()`:** easy below level 3, normal after. One step easier after 2 losses in a row, one step harder after 3 wins in a row.

**Lines 283–290, Street Pass:**
- `PASS_XP = 160` is the XP per tier and `PASS_TIERS = 30` is the number of tiers.
- `PASS_SEASON` is the season name.
- Tiers that have an item with that `pass:` number give the item; the rest give ₦60, or ₦150 on every third tier.

**Lines 300–319, trophies:** `reward` is ₦, and `test` is the condition.

**Line 355:** free ₦ for watching an ad in the Store: ₦50 each, 5 times a day.

### 4.5 `js/controls.js`: control defaults (lines 11–24)

```
12  joy: 'float'        'float' = stick appears under your thumb. 'fixed' = always in one place
13  joySize: 1          0.8 small, 1 medium, 1.25 large
14  sprint: 'hold'      'hold' = sprint while holding the ⚡ SPRINT button (the default)
                        'tap'  = SPRINT switches sprinting on and off
                        'auto' = no button; push the stick to the edge to sprint
                        See section 9.2 before changing this
15  hand: 'right'       'right' = move with the left thumb.  'left' = everything mirrored
16  btnSize: 1          0.8, 1 or 1.2
17  opacity: 0.85       how solid the stick and buttons look, 0.4 to 1
18  vibrate: true
19  layout: null        custom button positions, filled in by the layout editor
20  keys:               keyboard keys for Action, Dash/Whistle and Sprint (browser key codes)
22  BASE = 120          joystick ring size in pixels at medium size
    KNOB = 52           the knob in the middle
23  SIZES               button sizes in pixels at medium: ACTION 96, Dash/Whistle 62, SPRINT 62
24  DEAD = 0.12         how far the stick must move before anything happens (stops drift)
    FULL = 0.85         stick past this counts as full speed
    SPRINT_AT = 0.96    in 'auto' sprint mode, the stick past this starts a sprint
```

These are only defaults. Each player changes their own in Settings → Controls, and their choice is saved.

The option buttons shown on that page are in `OPT` (lines 212–218). The help lines under them are in `HELP` (lines 219–222).

### 4.6 `js/sim.js`: words and names (lines 13–25)

- **Lines 13–21, `LINES`:** what bots say in speech bubbles, grouped by moment:
  - caught
  - a police catch
  - starting a rescue
  - being freed
  - exits opening
  - alarm
  - escaping

  Add a line inside any list.
- **Line 22, `CHAT`:** the three quick-chat buttons for each side. Keep exactly three each; the keyboard keys 1–3 use them.
- **Lines 24–25:** names given to police and thief bots.

### 4.7 `js/products.js`: things sold for real money (lines 10–20)

```
id      code used by the game and the server. Don't change once people have bought it
kind    'cash' (bag of ₦), 'pack' (items, maybe plus ₦) or 'noads' (removes ad breaks)
name    shown in the Store
price   in naira. Paystack charges this
cash    in-game ₦ given
items   wardrobe ids given. Those items must have paid:'<this id>' in meta.js
tag     small badge like 'BEST VALUE'
blurb   one line under the name
```

The server reads this same file and refuses a payment whose amount doesn't match. A price change here therefore needs the server restarted too.

---

## 5. Every file, function by function

How to read the tables: the **line** is where the function starts, and **what it does** is in plain words. Functions not listed are tiny helpers whose name says what they do.

### 5.1 `js/world.js`: the map and how things bump into each other

| Line | Name | What it does |
|---|---|---|
| 7 | `CFG` | All tuning values (section 4.2) |
| 53 | `MAPS` | The four locations (section 4.3) |
| 116–126 | `MAP`, `OB`, `HIDES`… | The current location's pieces. They're filled in by `setMap` when a location is chosen. `PRISON`, `PC` (centre of the Post), `GATES` and `SPAWN_P` are the same on every map |
| 128 | `clamp` | Keeps a number between a minimum and maximum |
| 129 | `dist` | Distance between two things |
| 134 | `solidAt` | "Is this point inside a wall, building or the map edge?" Used for everything that moves |
| 139 | `clearPath` | "Can someone walk in a straight line from A to B without hitting anything?" |
| 144 | `sightClear` | "Can police see from A to B?" Buildings, buses and tanks block sight; stalls don't |
| 152 | `collide` | Pushes a person out of any wall they've run into. This is what makes walls solid |
| 165 | `inHide` | "Is this point under a tree, canopy or tall grass?" |
| 166–167 | `inExit`, `gateNear` | Which exit someone is standing in, which Post gate they're next to |
| 170 | `BLK` | A grid of the map, one cell per unit: 1 = blocked, 0 = free. Bots plan routes on it |
| 172–181 | `nearFree`, `freePt` | Find the nearest free spot to a point (so bots never aim inside a wall) |
| 184 | `astar` | Route-finding (the A* method). Gives bots a path round buildings to where they want to go |
| 212 | `setMap(id)` | Loads a location: fills `OB`, `HIDES`, `SHOPS` and so on from `MAPS[id]`, and rebuilds the grid |
| 238–257 | `herdLen`, `herdAt`, `pushFromHerd` | Where the cattle are along their line, and pushing people out of the way so nobody walks through a cow |

### 5.2 `js/sim.js`: the rules and the bots

Everything about a match lives in one object called `G` (the game state). Every person is an entity `e` inside `G.ents`:
- ids 0–3 are police
- ids 4–7 are thieves

| Line | Name | What it does |
|---|---|---|
| 12 | `useMatch` | Points the rules at a match (used online so the server's match is the one shown) |
| 28 | `mkEnt` | Creates one person with all their values. See section 6 for what each value means |
| 41 | `newMatch` | Starts a match: loads the location, picks day or night (30% chance of night), creates 4 police and 4 thieves, puts human players into slots, scatters ₦ notes, sets bot difficulty |
| 74 | `nearestCapturable` | The closest thief an officer could grab right now (free, not immune, in range) |
| 82 | `ev` | Records something that happened (a catch, a goal, a purchase). `main.js` reads these to play sounds, show messages and effects |
| 83 | `say` | Makes a bot say one of the `LINES` |
| 86 | `step(dt, getInput)` | **The heart of the game.** Runs 60 times a second and moves the match forward by `dt` seconds. In order: count down the head start, open exits on time, update who police can see, let bots plan, move every person, update snacks, ₦ notes, cattle, bell and ball, keep bodies from overlapping, sound the alarm, check if someone won |
| 129 | `updatePickups` | Spawns free Agege bread and zobo, and gives them to whoever touches one |
| 149–166 | `spawnNote`, `updateNotes` | Drops ₦ notes on free ground; anyone who runs over one gets `noteValue` in their pocket. Bots sometimes buy when passing a shop |
| 169 | `updatePlace` | The location's special thing: walks the cattle along their line, counts down the bell, lets bots use the fence gaps and bell |
| 194 | `tryUse` | Rings the school bell or goes through a fence gap, if you're standing at one |
| 202 | `tryBuy` | Buys from the shop you're standing at: takes the ₦ and applies the effect (full, water, boost, ready) |
| 216 | `updateBall` | The football: anyone who runs into it kicks it, it rolls and slows down, bounces off walls, and scores if it crosses a goal line between the posts |
| 246 | `updateSight` | Decides which thieves the police can see. Hidden thieves are only seen up close |
| 260 | `tickTimers` | Counts down every timer on a person (cooldowns, boosts, immunity, and so on) |
| 268 | `applyRemote` | For online guests: accepts the position their phone sends, with a check that stops impossible jumps |
| 286 | `applyEnt` | Moves one person from their input. Handles walking, sprinting and stamina, tiredness, boosts, slows, Dash, the jail yard and hiding. Then calls the police or thief actions below |
| 332 | `useAbility` | Dash for thieves; Whistle for police (slows and reveals nearby thieves) |
| 345 | `policeActions` | Starts grabs (by itself when `autoCatch` is on), fills the no-camping meter and reassigns campers |
| 362 | `resolveCapture` | When a grab lands: arrest if the thief is still close, otherwise it's a dodge |
| 367 | `arrest` | Marks the thief as caught, freezes the officer for `escortTime` and counts the stats |
| 375 | `jail` | Moves the caught thief into the Post and the officer to the gate |
| 387 | `thiefActions` | Holding the button at a gate (rescue) or inside an open exit (escape); also buying and using |
| 400 | `doRescue` | Frees every jailed thief at the gate, with a few seconds of immunity |
| 410 | `doEscape` | Takes the thief off the street and counts the escape |
| 414 | `checkWin` | Thieves win at `escapesToWin` escapes. Police win if every thief left is jailed, or time runs out |
| 420 | `REASONS` | The three win messages shown on the results screen |
| 424 | `follow` | Bot movement towards a target: straight if the way is clear, along a route from `astar` if not |
| 440 | `botInput` | Turns a bot's decision into the same kind of input a human gives (direction, sprint, button). Also unsticks bots that get caught on a corner |
| 459 | `planPolice` | Every 0.3 seconds, gives each police bot a job: chase a thief, defend a gate during a rescue, guard the Post, or search |
| 480 | `pickSearch` | Where a searching officer looks next (hiding spots, last places thieves were seen, exits) |
| 491 | `policeAI` | Carries out the job: chases with a little lead on a running thief, uses the whistle, steps out of the camping ring |
| 534 | `planThieves` | Picks which thief bot goes to free the jailed ones |
| 545–591 | `fleeDir`, `fleePlan` | How a thief bot runs away: picks a far spot that the police aren't blocking, preferring open exits |
| 592 | `pickLurk` | A hiding spot away from the police, for a thief bot with nothing urgent to do |
| 602 | `thiefAI` | The thief bot's choice each moment: flee, rescue, escape or hide |

### 5.3 `js/meta.js`: the save and progress

Covered in section 4.4. The functions not covered there:

| Line | Name | What it does |
|---|---|---|
| 165 | `loadLocal` | Loads the save from this browser |
| 170 | `attachCloud` | Also loads and saves through claude.ai when the game runs there (so progress follows the account). Does nothing on your own website |
| 198 | `persist` | Saves. Called after anything that changes the save |
| 205 | `refreshDaily` | Once a day: picks 3 new missions and updates the login streak |
| 221–230 | `claimStreak`, `claimMission` | Pay out the streak bonus and finished missions |
| 291 | `claimPass` | Pays out a Street Pass tier |
| 320 | `claimAch` | Pays out a trophy |
| 326 | `itemState` | For the wardrobe: is this item owned, buyable, too expensive, locked by level, a pass reward or a Store item? |
| 335 | `buy` | Buys a wardrobe item with ₦ |
| 345 | `grantProduct` | Gives what a real-money purchase bought, once per payment reference |

### 5.4 `js/net.js`: online play

There are two ways to play online:
- **Your own server** (`SRV`, lines 87–133): Quick Match and room codes. This is the one for a real launch.
- **claude.ai rooms** (`NET`, lines 11–48): only works while the game is opened on claude.ai.

| Line | Name | What it does |
|---|---|---|
| 14–48 | `initNet`, `openRoom`, `leaveRoom`… | Join and leave claude.ai rooms, see who's in them |
| 53 | `packState` | Squeezes the whole match into a small message (positions rounded to 0.1, states as numbers) to send to other players about 15 times a second |
| 70 | `applySnapshot` | The reverse: rebuilds the match on a guest's phone from that message |
| 94 | `serverUrl` | Works out the server's address (from `config.js`, or the same website) |
| 100 | `connectServer` | Opens the connection to your server and handles its messages: lobby, match start, snapshots, leaderboard. Reconnects if it drops |
| 129 | `srvSend` | Sends a message to the server |

### 5.5 `js/controls.js`: joystick, buttons, keyboard

| Line | Name | What it does |
|---|---|---|
| 31 | `ctl()` | The player's control settings, with any missing values filled from the defaults |
| 46–55 | `defaultLayout`, `layout` | Where each button sits: the default spots (mirrored for left-handed play) or the player's own |
| 56 | `applyControls` | Puts buttons in place at the chosen size and see-through level, sizes the joystick area, hides SPRINT when sprint is 'auto' (line 76) |
| 87 | `joyDown` | Thumb touches the move side: the stick appears under it (floating) or stays put (fixed) |
| 102 | `joyMove` | Thumb moves: works out direction and how far. If you drag past the edge, the stick follows your thumb |
| 115 | `joyUp` | Thumb lifts: stick hides, movement stops |
| 123 | `btn` | Wires a button for touch and mouse (press and release) |
| 131 | `readInput` | Called every game step. Combines keyboard and joystick into one input: direction, sprint, action held, action just pressed, ability. Smooths the stick a little so a shaky thumb doesn't jitter |
| 152 | `resetMatch` | Clears controls at the start of a match |
| 159 | `vibrate` | Phone buzz, if the player allows it |
| 162 | `keyName` | Turns a key code like 'KeyQ' into 'Q' for the settings page |
| 171–211 | `openLayoutEditor`, `closeEditor`, `makeDraggable` | The "Edit button layout" screen: drag buttons and the fixed stick, then Save or Reset |
| 223 | `renderControlSettings` | Builds the Controls page in Settings from `OPT` and `HELP`: the option rows, the see-through slider, vibration, the layout editor button, keyboard keys, reset |
| 272 | `initControls` | Sets all of this up once when the game starts, and catches the next key press when you're changing a keyboard key |

### 5.6 `js/tutorial.js`: the guided tutorial

There's one function, `createTutorial` (line 15). Inside it:

- **`setup`:** sets up a calm practice match on Naija Street. Police stand still or walk slowly. A friend is put in the Post and a ₦ note is placed near you.
- **The step list (lines 43–80):** each step has:
  - `text`: what the box at the top says
  - a check that runs every frame and moves on when you've done the thing, for example "moved far enough", "sprinted", "picked up the note", "bought something", "stood under a tree", "freed the friend", "escaped", "caught the thief"
  - sometimes `target`: where the yellow arrow and ring point
- **The first 10 steps** are as a thief: move, sprint, pick up ₦, buy food, the power-ups card, the free zobo, Dash, hide, free a friend, escape. **The last 2** are as police: the Whistle, then a catch.
- **The power-ups card (lines 52–61)** is a step with `info: true`. It doesn't wait for you to do anything; it shows a list and a "Got it" button. See section 9.4.
- **`Skip`** ends it at any time.
- **When you finish,** the `tutEnd` pop-up in `index.html` (line 211) shows.

To reword a step, change the text in quotes after `text: () =>`. The `${...}` parts insert names (the shop, your friend); keep them. Changing what a step checks for needs a little JavaScript, so copy how a neighbouring step does it.

### 5.7 `js/store.js` and `js/ads.js`: money (both off by default)

**`store.js`:**

| Line | Name | What it does |
|---|---|---|
| 29 | `paymentsOn` | True only when `config.js` has Paystack and a public key |
| 33 | `loadPaystack` | Loads Paystack's payment window |
| 45–66 | `verify`, `settle`, `retryPending` | After paying, asks your server to confirm the payment with Paystack, then gives the item. If the internet drops, it tries again next time the game opens |
| 68 | `buy` | Opens Paystack for one product |
| 90 | `watchForCash` | The free-₦ ad button |
| 99 | `renderStore` | Builds the Store pop-up |

**`ads.js`:**
- `ADS` (line 29) is the one object the game calls: `ADS.init()`, `ADS.rewarded()` (watch-for-reward) and `ADS.breakBetweenGames()`.
- It passes those to Poki, CrazyGames or Google depending on `config.js`.
- No ad ever plays during a match.

`MONETIZATION.md` lists every line involved.

### 5.8 `js/chars.js`: the 3D people

Every person is built from simple shapes (capsules, spheres, boxes) so cheap phones can draw them.

| Line | Name | What it does |
|---|---|---|
| 11–18 | `toonGrad`, `toon` | The cartoon look: 3-step shading instead of smooth. `toon('#hex')` makes a coloured surface |
| 21–43 | `canvasTex` and the `...Tex` functions | Paint small pictures used as fabric: stripes, camo, Ankara, Aso-oke, agbada, the Super Eagles kit, Ghana-Must-Go plaid |
| 44–45 | `backTex`, `tagTex` | "POLICE" for the shirt back, "OFFICER" for the name tag. Change the words inside `fillText('...')` |
| 47 | `starShape` | The five-point badge shape (a generic star, not the real crest) |
| 52 | `uniformGeo` | All police uniform details, each placed by x (left/right), y (up/down) and z (front/back): pockets and flaps (58–59), flap buttons (60), collar (61), epaulettes (62–63), front buttons (65), belt and buckle (66–67), name tag (68), radio (69–70), sleeve chevrons (72–74) |
| 79 | `outfitMat` | Picks shirt and trouser colours or prints from the outfit id |
| 94 | `makeCharacter(team, look)` | **Builds one person:** legs (each turns at the hip), body, arms (turn at the shoulder), head, eyes, eyebrows, smile, cheeks. Then the police uniform (136–147), headwear (149 onward: cap, beret, helmet, bandana, afro, gele and so on), glasses and extras |
| 223 | `mergeChildren` | Joins parts that share a colour into one piece so the phone draws them faster |
| 235 | `animate` | Moves the body each frame: legs and arms swing with speed, leaning when sprinting, hands up when arrested, reaching during a grab, the dances when you win |

To move a uniform detail, change its numbers. In `at(B(w,h,d), x, y, z)` the first three are width, height and depth, and the next three are left/right, up/down and front/back. On the torso, y 0.1 is the belt line and y 0.66 the shoulders; z 0.27 is the chest surface.

### 5.9 `js/details.js`: the lived-in street

| Line | Name | What it does |
|---|---|---|
| 23 | `buildStreet` | For each shop: awning, counter, goods, shopkeeper, price board, green ring, night lantern. Then the market, football pitch, washing line, power lines, ball, chickens, herd and the location's special objects |
| 66 | `KEEPERS` | What each kind of shopkeeper looks like (skin, clothes, gele, glasses) |
| 75 | `priceTex` | Paints the price board above each shop |
| 88 | `stock` | What sits on each kind of counter (pots of jollof, bread and tins, suya grill, chemist boxes, cooler, small chops) |
| 131 | `market` | Yams, garri, tomatoes, plantain, oranges, eggs and two market women |
| 151 | `pitch` | Goal nets and corner flags |
| 167–186 | `washing`, `poles` | Washing line and the electric poles with sagging wires |
| 187–221 | `makeBall`, `makeChickens`, `noteMesh` | The football, the chickens, the ₦ note |
| 222 | `syncStreet` | Every frame: rolls the ball, spins the ₦ notes, pulses the shop rings, makes shopkeepers wave, puffs smoke, makes chickens peck and scatter, walks the herd |
| 294 | `idleStreet` | Same, quieter, for the menus |
| 302 | `makeHerd` | The herdsman (straw hat, staff) and his white long-horned cattle |
| 336–370 | `schoolBits`, `churchBits` | The school bell and flagpole; the church fence gaps and grass |

### 5.10 `js/scene.js`: the 3D world, light and camera

| Line | Name | What it does |
|---|---|---|
| 25 | `initScene` | Sets up 3D drawing, the sky and sun light, shadows, the camera |
| 46 | `resize` | Fits the picture when the screen size changes |
| 55 | `setQuality` | Graphics LOW or HIGH (sharpness and shadows) |
| 63 | `paintGround` | Paints the ground picture: earth, roads with yellow lines, the football field, the Post yard, exit pads |
| 97–140 | `signTex`, `facadeTex`, `zincTex`, `glowTex` | Paint signs, shop fronts with doors and windows, zinc roofs, the lamp glow |
| 146 | `rebuildWorld` | Clears and rebuilds everything when the location changes |
| 156 | `buildWorld` | Builds the location: ground, fence wall, every obstacle in `OB`, then the parts below |
| 203–236 | `busMesh`, `kekeMesh`, `stallMesh` | Danfo, keke and market stall models |
| 237 | `buildPrison` | The Police Post: bars, gates, sign, siren and the orange no-camping ring |
| 271 | `buildExits` | Exit signs, barrier arms that lift when exits open, green light beams |
| 292 | `buildHides` | Trees, canopies and tall grass |
| 321 | `buildLamps` | Street lamps |
| 371 | `mergeStatic` | Joins everything that never moves into a few pieces so phones draw it fast |
| 400 | `syncPickups` | Shows the free bread and zobo |
| 420 | `setNight` | Day or night: light colours, darker sky, lamps and torches on |
| 440 | `viewFor` | Makes the 3D person for an entity (and the torch cone for police at night) |
| 459 | `syncEntities` | Every frame: places each person, turns them smoothly, picks their animation, fades hidden thieves (invisible to police unless close, see-through for teammates) |
| 495 | `syncWorld` | Every frame: barrier arms, gate rings, the siren flashing during an alarm, trees going see-through when you stand under them |
| 524 | `updateCamera` | Follows your player from above and behind, leads a little in the direction you're running, shakes on big moments |
| 523 | `setCamDist` | Camera distance from Settings (Close, Normal, Far) |
| 562 | `fx` | Effects: dust, stars when someone's caught, bursts, confetti, the whistle ring, dash streaks, smoke, goal celebration |
| 589 | `showroom` | The two characters on the start screen and in the wardrobe |
| 610 | `project` | Turns a 3D spot into a screen position (for name tags and speech bubbles) |
| 617 | `setGuide` | The tutorial's yellow target ring |

To change the camera height or distance, see line 536: in `camera.position.set(lx + ox, 19*camDist, lz + 12*camDist + oz)`, 19 is how high the camera sits and 12 how far behind.

### 5.11 `js/main.js`: the boss file

`main.js` is the longest file. It connects everything.

| Lines | Section | What it does |
|---|---|---|
| 22–41 | Boot | Loads the save, starts the 3D scene, ads, online and controls, shows the start screen |
| 42–120 | Audio | `tone` and `noise` make sounds from scratch. `sfx(name)` (67) has every sound effect. `loadTheme` and `musicTick` play the theme song, or a small built-in beat if the song file can't load |
| 121–131 | Messages | `toast` (small note at the top), `announce` (big centre text), `feed` (lines down the left during a match) |
| 133 | `setMode` | Switches screens: home, wardrobe, online, match, results |
| 145 | `goHome` | Back to the start screen |
| 149 | `refreshHome` | Fills the start screen: name, level bar, ₦, daily bonus chip, missions, the red dot on More |
| 200–250 | Settings | The Game tab (graphics, camera, sound, music, shake) and the Street Pass and trophy pop-ups |
| 251–294 | Wardrobe | `renderWard` builds the item grid; tap to buy or wear |
| 295–424 | Online lobby | Quick Match, room codes, the player list, the leaderboard |
| 425–445 | Quick chat | Sends and shows the three chat lines |
| 446–490 | Starting a match | `useMap` loads a location; `buildPickers` makes the side and location pickers; `startTutorial`; `startSolo` starts single player |
| 491 | `beginMatch` | Common start for every match: camera, controls, night, intro message |
| 510–620 | Online matches | `startHost` and `remoteInput` (hosting a claude.ai room), `startMirror`, `guestWatch` and `serverWatch` (following a match run elsewhere), `guestPredict` (moves your own player straight away so it feels instant online, while the server checks the rules) |
| 623 | `handleEvent` | **Turns events from the rules into feedback.** One `case` per event: `catch` plays the whistle and shows stars, `goal` plays the crowd, `buy` shows what you bought. Change messages and sounds for any moment here |
| 678 | `bubble` | A speech bubble over someone's head |
| 681 | `finishMatch` | The results screen: rewards counting up, level-ups, missions done, the stats table, the "watch an ad to double" offer |
| 727–736 | Pause | Pause pop-up and its buttons |
| 740 | `updateHUD` | Every frame during a match: timer, thief icons, what the big button says (CATCH, FREE, ESCAPE, BUY, RING, USE), the ability cooldown, stamina bar, hints, name tags, bubbles, progress rings |
| 799 | `drawMini` | The minimap in the top-right corner |
| 830 | `loop` | **Runs every frame.** Steps the rules 60 times a second, sends or receives online updates, plays events, draws people, world, ball and effects, moves the camera, updates the HUD. It also lowers graphics by itself if the phone is struggling |
| 914 | `checkRotate` | Shows "Turn your phone upright" in landscape |

### 5.12 `server/server.mjs`: the game server

| Line | Name | What it does |
|---|---|---|
| 22 | `PORT` | 8080 unless the host sets another |
| 27–63 | Payments | `verifyPayment` checks a Paystack payment with your secret key and makes sure each payment is only used once |
| 64–83 | Static files | Sends the game files to browsers, and only files that belong to the game |
| 84–99 | Leaderboard | Top players, kept in `server/data` |
| 104–142 | Players and rooms | Room codes, joining, leaving, Quick Match. `clean` strips odd characters from names |
| 144 | `startMatch` | Starts a match with the same `sim.js`, filling empty places with bots |
| 162 | `inputFor` | Reads each player's latest controls |
| 169 | `tickRoom` | Runs the match 30 times a second and sends snapshots to everyone in the room |
| 201 | WebSocket | The live connection to every phone |

### 5.13 Changing a sound

In `main.js`, `sfx` (lines 67–86) holds every sound. The sound for each moment is `tone(frequency, seconds, wave, volume, delay)`:

- **frequency:** higher numbers are higher notes. 440 is the A above middle C.
- **seconds:** how long the note lasts.
- **wave:**
  - `'sine'`: soft
  - `'triangle'`: flute-like
  - `'square'`: buzzy
  - `'sawtooth'`: harsh
- **volume:** 0.05 is quiet and 0.25 is loud.
- **delay:** seconds to wait before playing.

Example: the police whistle on line 68 is 8 short notes swapping between 2500 and 2850.

### 5.14 `index.html`: the page

Every screen is a `div` with an `id`. A class of `hidden` hides it; `main.js` shows and hides them. Change words freely. Don't change or delete `id="..."` values, because the code finds elements by id.

| Lines | What |
|---|---|
| 1–24 | Page title, phone settings, link to the stylesheet, where the 3D library comes from |
| 25–26 | The 3D drawing area and the loading text |
| 29–50 | Start screen: name and ₦ bar, logo, side and location pickers, PLAY, Wardrobe, Online, More |
| 53–64 | Wardrobe |
| 67–69 | Online lobby (filled in by `main.js`) |
| 72–95 | Match screen: pause, sound, wallet, timer, minimap, joystick, buttons, chat, tutorial box, stamina bar, hints, name tags, big messages |
| 98–111 | Results screen |
| 112–207 | Pop-ups: missions, pause, how to play (121–132), name, Street Pass, trophies, settings (149–166), side and location picker, More menu (174–186), Store, first-time welcome, tutorial finished |
| 208–209 | Small notes at the top; "turn your phone" screen |
| 211–216 | Loads `config.js`, then `main.js` (which loads everything else) |

### 5.15 `css/style.css`: how it looks

Each rule is `selector{property:value;...}`:
- `#name` targets the element with that id.
- `.name` targets elements with that class.

The file is in sections:

| Lines | Section |
|---|---|
| 1–16 | Basics: fonts, button colours (`.btn.green`, `.btn.orange`…), cards |
| 17–57 | Start screen (old layout rules, partly replaced by 139–157) |
| 58–68 | Wardrobe |
| 69–78 | Online lobby |
| 79–119 | Match screen: timer, minimap, feed, ACTION, Dash and SPRINT buttons, stamina bar, name tags |
| 120–136 | Results, rotate screen, toast, loading |
| 139–157 | **Start screen as it is now** |
| 158–173 | Bottom sheets (the pickers and More menu) |
| 174–191 | **Joystick and buttons**: `#joyBase` is the ring, `#joyKnob` the knob, `#joyHint` the "Touch here to move" hint |
| 192–200 | Layout editor |
| 201–215 | Settings |
| 216–229 | Tutorial box and arrow |
| 230–248 | Store |

Colours are hex codes such as `#0fa04b` (the green). `rgba(0,0,0,.55)` is black at 55% see-through. `px` is pixels. `env(safe-area-inset-...)` keeps things clear of phone notches. `@media (max-height:700px){...}` means "only on screens shorter than 700 pixels".

### 5.16 `sw.js` and `manifest.webmanifest`

- **`sw.js`:** keeps a copy of the game on the phone so it opens offline and loads fast.
  - Line 2 is the version: change it whenever you change files.
  - Lines 3–5 list the files to keep. Add any new file you create here.
- **`manifest.webmanifest`:** the name, icon and colour used when someone adds the game to their home screen.

---

## 6. Names you will see everywhere

| Name | Means |
|---|---|
| `G` | The match state in `sim.js` (`G.ents` people, `G.playT` seconds played, `G.over` result) |
| `MC` | The match as `main.js` sees it (which player is you, solo or online) |
| `e` | One person (entity). `e.team` is `'P'` or `'T'` |
| `e.x`, `e.y` | Position on the map |
| `e.vx`, `e.vy` | Speed in each direction |
| `e.fx`, `e.fy` | The direction they're facing |
| `e.state` | `'free'`, `'arrest'` (just caught), `'jailed'` or `'escaped'` |
| `e.ctrl` | Who controls them: `'local'` (you), `'remote'` (online player) or `'bot'` |
| `e.stam` | Stamina, 0–100. `e.tired` is true after running out, until it's back to 30 |
| `e.wallet` | Street ₦ picked up in this match |
| `e.windup` | Seconds left on a grab in progress |
| `e.immune`, `e.boostT`, `e.slowT`, `e.dashT`, `e.fullT` | Seconds left on each effect |
| `e.abCd` | Seconds before Dash or Whistle can be used again |
| `e.ai` | The bot's memory (its job, route, target) |
| `dt` | Seconds since the last step (1/60 during play) |
| `inp` | One step's controls: `mx`, `my` direction, `sprint`, `action` (held), `press` (just pressed), `ability` |
| `SAVE` | The player's saved progress (from `meta.js`) |
| `CFG` | The tuning values (from `world.js`) |
| `S.` | Anything from `scene.js` (`main.js` imports it as `S`) |
| `M.` | Anything from `meta.js` |
| `$('id')` | Finds the page element with that id |
| `ev('type', a, b, c)` | Records an event; `handleEvent` in `main.js` reacts to it |

---

## 7. JavaScript you need to read this code

You don't need much. These cover almost every line:

```js
const speed = 5;               // a value that won't be reassigned
let count = 0;                 // a value that will change
count += 1;                    // add 1 to count

const list = [1, 2, 3];        // a list (array). list[0] is 1
const obj = { a: 1, b: 'hi' }; // an object: named values. obj.a is 1

function add(x, y){ return x + y; }   // a function
const add2 = (x, y) => x + y;         // the same thing, shorter ("arrow function")

if (a > b){ ... } else { ... }        // choose
const v = a > b ? 'big' : 'small';    // the same choice in one line
for (const e of G.ents){ ... }        // do something for every person

a && b    // both true          a || b    // either true          !a    // not a
===       // equal              !==       // not equal
Math.hypot(dx, dy)   // distance       Math.random()   // a random number 0 to 1
Math.min / Math.max  // smaller / bigger of two numbers

export const X = ...   // this file shares X
import { X } from './world.js'   // this file uses X from world.js
`Hello ${name}`        // text with a value inserted (note the backticks)
// comment              /* also a comment */   the computer ignores these
```

Rules that save hours:

- **Every `{` needs its `}`,** every `(` its `)` and every `[` its `]`. VS Code highlights the matching one when you click next to it.
- **Lists and objects separate items with commas.** A missing comma between two lines is the most common break.
- **Text goes in quotes.** If your text has an apostrophe (`don't`), use double quotes: `"don't"`.
- **Names are case-sensitive.** `walkT` and `WalkT` are different things.
- **After an edit,** run `node --check js/thefile.js` and refresh the game with the console open (F12).

---

## 8. Where you'll want to make corrections, and my suggestions

### 8.1 Things that must be changed together

Most broken edits come from changing one place and forgetting its partner. Each row below is a pair (or group) of places that have to agree.

| If you change… | Also change… | Or this happens |
|---|---|---|
| `exitsOpenAt` (`world.js` line 10) | "exits open at 2:00" in How to Play (`index.html` line 124), and the comment on line 10 | Players are told the wrong time |
| `matchTime` (`world.js` line 8) | `4:00` in `index.html` line 75 (shown for a moment before the match starts) | The clock flashes the old time |
| A building's name in a location's `ob:` list | The same name in that location's `shops:` list | The shop silently disappears |
| An item's `id` in `meta.js` | Nothing. **Don't rename ids** | Players who owned it lose it |
| A `paid:` item in `meta.js` | Its pack's `items:` in `products.js` | Someone pays and doesn't get the item |
| A price in `products.js` | Restart the server | The server refuses the payment (amount mismatch) |
| Anything in `sim.js` or `world.js` | Restart the server, and change the version on `sw.js` line 2 | Online matches run the old rules, or phones keep old files and play by different rules from the server |
| Adding a new `.js` file | Add it to the list on `sw.js` lines 3–5 | The game breaks when opened offline |
| Wording in a quick-chat line (`sim.js` line 22) | Keep exactly three per side | Keys 1–3 and the chat buttons go wrong |
| Naija Street's buildings or trees | Check the tutorial still works (More → Tutorial) | It runs on Naija Street and needs a shop, a tree and the Post gates. Remove all shops or trees and the buy or hide steps can't be finished |
| `KEY` in `meta.js` line 138 | Nothing. **Leave it** | Every player's progress resets |

### 8.2 Where you'll most likely want to tune

These are the values players will have opinions about once real people play. Change one at a time, play a few games, then run `node tools/balance.mjs 60`.

- **Catching feels unfair (or too easy).**
  - `captureWindup` (0.4): the dodge window. Lower favours police.
  - `captureRange` (1.05): how close police must get. Higher favours police.

  These two matter more than speed.
- **Police feel stuck after every catch.** `escortTime` (3.5). It stops one officer catching everybody in a row. Below 2.5, police start to dominate.
- **Rounds end before the exits open.** Bot rounds average about 1 minute 50 seconds and the exits open at 2:00, so in many games the exits never matter. If human games feel the same, try `exitsOpenAt: 75` or `90`, and update the help text.
- **Rescues are too easy.** `rescueTime` (1.5 seconds holding at the gate) and `immuneTime` (4.5 seconds untouchable after being freed).
- **Too much or too little street money.** `noteValue`, `noteEvery` and the shop prices. In bot games a player ends with about ₦135 unspent, so prices could go up a little.
- **Bots too hard for beginners.** The `diff` list (`world.js` line 33). Easy bots run at 0.9 speed; try 0.85.
- **Rewards and levelling.** `meta.js` lines 236–253 and the level formula on line 118. Players shouldn't be able to buy everything in the first week, or there's nothing to come back for.

### 8.3 My suggestions, most useful first

1. **Use Git before you edit anything.** You already have GitHub (jesse-cloud515).
   1. In the project folder run `git init`.
   2. Then run `git add .` and `git commit -m "before my edits"`.
   3. After each change that works, commit again.

   If an edit breaks the game, `git diff` shows exactly what you changed and `git checkout -- js/world.js` undoes it. This is worth more than everything else in this list.
2. **Test with real people before tuning much.** Bots play differently from humans: they never panic, and they always know where the gates are. Watch five friends play two games each and write down where they get confused or annoyed. That tells you which numbers in 8.2 to touch first.
3. **Move the night chance into `CFG`.** It's written into `sim.js` line 43 as `Math.random() < .3` (30% of games). Add `nightChance: 0.3,` to `CFG` in `world.js`, then change line 43 to `Math.random() < CFG.nightChance`. This is a good first edit: small, and it teaches you how `CFG` values flow into the rules.
4. **Remove or use the unused `react` value** in `CFG.diff` (`world.js` line 33). Nothing reads it, so changing it does nothing, which is confusing.
5. **Turn Naija Street's coordinates the right way round.** It's the only location written sideways (`world.js` lines 43–50 and 58–59), which makes it easy to put a building in the wrong place. Do it once:
   1. Swap x with y and w with h in each entry.
   2. Delete the `.map(...)` at the end of line 50 and line 59.
   3. Check the street looks the same.
6. **Clean up old CSS.** `style.css` lines 17–57 are the old start-screen rules, and lines 139–157 override most of them. Once you're comfortable, delete the old rules one at a time, checking the start screen after each.
7. **Split `main.js`.** At 951 lines it's the hardest file to find your way in. The audio part (lines 44–122) can move to a new `js/audio.js` with `export` in front of `sfx`, `initAudio` and `startMusic`, and an `import` at the top of `main.js`. Add the new file to `sw.js`.
8. **Replace the made-up sound effects with recorded ones.** The whistle, kick, moo and bell are built from tones in `sfx()`. Free sound sites such as freesound.org (check each licence) have real police whistles and crowd cheers. Load them the way `loadTheme()` loads the song, and keep the same names so `handleEvent` still works.
9. **Grow the name filter as you go.** `BAD_WORDS` in `server.mjs` is a starting list. When testers find a rude name that gets through, add the word in lower case.
10. **Add more voice.** More pidgin lines in `LINES` (`sim.js` 13–21), more bot names, more missions. These are pure text edits with no risk, and they're where the Nigerian character of the game shows most.
11. **Try it on a cheap Android phone** (2–3 GB of memory). Check that the minimap is readable, buttons don't sit under your thumb's natural rest spot, and Graphics LOW is smooth. If it stutters, the first things to cut are the chickens and shopkeepers (`details.js`), which already switch off on LOW.
12. **Keep the uniform generic.** The badge is a plain star and the back says POLICE, on purpose. Adding the real Nigeria Police Force crest or flag-style insignia could cause trouble with the force or app stores, so leave those out.

---

## 9. Online play, sprint, screen direction, power-ups, solid props, and other things worth knowing

### 9.1 How to turn on multiplayer

Single player works anywhere. Online play needs the game server (`server/server.mjs`) running somewhere players can reach. The server does three jobs at once: it hands out the game files, it runs every online match with the same `sim.js` your phone uses, and it checks Paystack payments.

**Try it on your own laptop first**

1. In a terminal, from the project folder:
   ```
   cd server
   npm install      (first time only)
   npm start
   ```
2. Open http://localhost:8080 in two browser windows (or one window plus your phone on the same Wi-Fi at `http://YOUR-LAPTOP-IP:8080`).
3. In both, tap **PLAY ONLINE → QUICK MATCH**. You'll land in the same lobby. The match starts 15 seconds after the first player joins, or 3 seconds after all 8 places fill. Bots take any empty place.

For a private game, one player taps **CREATE ROOM** and reads out the code; the others tap **JOIN ROOM** and type it.

**The two online modes**

PLAY ONLINE opens on two big buttons, like eFootball or Mini Militia:

- **⚡ Quick Match** puts you in the next public game with whoever else is waiting. Nobody picks a side: the server splits real players evenly between police and thieves. The match starts 15 seconds after the first player arrives, or 3 seconds after all 8 places fill. Bots take the empty places.
- **👥 Play with Friends** opens a page with **CREATE ROOM** and a box for a friend's code.
  - The room gets a 4-letter code made up by the server. Letters that are easy to mix up (I, L, O, 0, 1) are left out.
  - **📤 INVITE** opens the phone's share menu (WhatsApp, Telegram and so on) with the code and a link. On computers it opens WhatsApp Web.
  - **📋 COPY CODE** copies the code. Tapping the big code does the same.
  - Whoever taps the link lands straight in the room, with no typing.
  - Only the host (👑) sees the **Location** buttons and **START MATCH**. Everyone picks their own side: Police, Thief or Any. "Any" players are put on whichever side has fewer people.
  - After a match, a friends' room goes back to its lobby, so you can play again without new codes.

Where it lives:

| What | Where |
|---|---|
| The two mode buttons | `main.js`, `renderOnline` (search `QUICK MATCH`) and `modeTile` |
| Create / join page | `main.js`, `renderFriends` |
| Room lobby, invite, copy, location | `main.js`, `renderSrvLobby` and `shareInvite` |
| The invite message text | `shareInvite`: `Join my Police & Thief game! Room code: …` |
| Opening an invite link | `main.js`, search `pendingRoom` |
| How "Any" players are split | `sim.js`, `newMatch` (search `humansOn`) |
| Codes, room size (8), quick-match timers | `server.mjs`: `LETTERS`, `joinRoom`, `quickRoom` |
| Host-only location choice | `server.mjs`, `case 'map'` |
| Looks of the mode buttons | `style.css`, `.modeTile` |

Want 6-digit number codes like Mini Militia instead? In `server.mjs` change `LETTERS` to `'0123456789'` and `{length:4}` in `newCode` to `{length:6}`. Then in `main.js` change the `4`s in `renderFriends` (`maxLength=4` and `c.length!==4`) and the `.slice(0,4)` on the `pendingRoom` line to 6.

**Put it on the internet (Render, free to start)**

GitHub Pages only hands out files. It can't run the server, so a GitHub Pages link on its own is single player only. The PLAY ONLINE screen says so. The fix is to run the server on Render and tell the GitHub Pages copy where it is.

1. Make sure your GitHub repo has the whole project folder, including `server/`, `Dockerfile` and `render.yaml`.
2. Sign up at render.com with your GitHub account. Click **New + → Blueprint**, pick the repo, then **Apply**. Render reads `render.yaml` and builds the server from the `Dockerfile`. It takes a few minutes the first time.
3. When it says **Live**, open the address it gives you (something like `https://police-thief-naija.onrender.com`). That address is the full game with online play working. You can share it as it is.
4. To make your GitHub Pages copy online too, open `config.js` and set:
   ```
   server: 'wss://police-thief-naija.onrender.com/ws',
   api: 'https://police-thief-naija.onrender.com',
   ```
   (use your real Render address), push it to GitHub, and bump `sw.js` line 2.
5. Optional, but do it before a public launch: in Render, open the service → **Environment**, add `ALLOWED_ORIGINS` = `https://jesse-cloud515.github.io` (your Pages address, no path, no slash at the end). Then only your own sites can connect. Leave it empty while testing.

**The free plan sleeps.** After 15 minutes with nobody connected, Render puts the server to sleep. The next player wakes it, which takes about a minute. The game handles this: it shows "Waking the game server up…" and keeps trying for 75 seconds (`SRV_WAKE` in `main.js`). Leaderboard and payment records are also wiped whenever the free server restarts, because the free plan has no disk. For the real launch, switch to the paid Starter plan (about $7 a month, stays awake) and add a disk mounted at `/data`.

**Other hosts.** Fly.io, Railway or a small VPS also work with the same `Dockerfile`. Give them a disk at `/data` and use HTTPS. Phones block plain `ws://` from an `https://` page, so the address in `config.js` must start with `wss://`.

**What to restart after edits.** The server keeps `sim.js` and `world.js` in memory. After changing either, restart it, and bump the version in `sw.js` line 2, or phones with the old files will play by different rules from the server.

**The other online mode.** When the game is opened on claude.ai, the PLAY ONLINE screen can also use claude.ai's own rooms (`NET` in `net.js` lines 11–48). That only works on claude.ai and isn't something you can launch with. Your own server is the real one.

**Things the server doesn't do yet, and you may want before launch**

- A stronger name filter. There's a basic one now (`BAD_WORDS` in `server.mjs`): a rude name becomes "Player" plus a number. Add words to the list as you see them. Words in `WHOLE_ONLY` only count as a whole word, so names like Dickson and Nazir still work.
- A limit on how many rooms one person can open.
- Accounts. Progress is saved on each phone (`localStorage`), so a player who changes phones starts again.

### 9.2 How to show, hide or change the SPRINT button

There are three sprint styles. Each player picks one in **Settings → Controls → Sprint**, and their choice is saved on their phone. What you set in the code is the default for new players.

| Style | What the player does | SPRINT button |
|---|---|---|
| `'hold'` (default) | Holds ⚡ SPRINT while moving | Shown |
| `'tap'` | Taps SPRINT once to switch sprinting on, again to switch it off | Shown |
| `'auto'` | Pushes the joystick all the way to the edge | Hidden |

**To change the default:** `js/controls.js` line 14, `sprint: 'hold'`. Change it to `'tap'` or `'auto'`.

**To hide the button for everyone:** set line 14 to `'auto'`, then look at line 36:
```
if (!c.v2){ c.v2 = true; if (c.sprint === 'auto') c.sprint = 'hold'; }
```
This line runs once per player. It moves anyone still on the old stick-edge setting over to the button, because the old default made people sprint (and run out of energy) without meaning to. If you want `'auto'` to stick, delete line 36, or the players who had `'auto'` before this update get moved to `'hold'` anyway.

**To stop players choosing a style,** remove the row from the Controls page: in `renderControlSettings` (line 241), delete `row('Sprint', 'sprint');`. Everyone then gets whatever line 14 says.

**Other places sprint lives**

- The button itself: `index.html` line 87, `<button class="cb" id="bRun">`. Its label is `<span>⚡</span>SPRINT`.
- Its look: `css/style.css`, search `#bRun`.
- The line that hides it: `controls.js` line 76.
- How sensitive stick-edge sprint is: `SPRINT_AT = 0.96` on line 24. Lower means you don't have to push as far.
- The keyboard key: `keys: { ... sprint: 'ShiftLeft' }` on line 20. Players can change it in Settings → Controls.
- The wording of the choices: `OPT` (line 212) and `HELP` (line 219).

**How energy works** (so you know what to tune)

- Energy is out of 100. It goes down by `drainT` (thieves) or `drainP` (police) per second while you sprint. That's `world.js` line 15.
- It only goes down while you're really moving faster than a walk. Holding SPRINT against a wall, or while standing still, costs nothing. That check is `e.sprinting = ...` in `sim.js`; search `wantSprint`.
- After you stop sprinting, it waits `regenDelay` seconds (line 17), then comes back at `regenT` or `regenP` per second (line 16).
- At 0 you can't sprint until it refills a little.
- The rule itself is `staminaStep` in `sim.js`. Search for it. The bots use the same function, so changing it changes them too.

If players still say they tire too fast, lower `drainT` a few points first. Thieves recovering faster than police (`regenT` 18 against `regenP` 10) is on purpose, so leave that gap.

### 9.3 Upright or sideways (portrait and landscape)

The first time someone opens the game on a phone, a pop-up asks **Upright** or **Sideways**. Their answer is saved as `settings.orient` and they can change it later in **Settings → Game**.

| What | Where |
|---|---|
| The first-time pop-up | `index.html` line 197, `id="orientDlg"` |
| The default for new players | `js/meta.js` line 148, `orient:'portrait'` |
| Whether the pop-up shows | `main.js`, search `orientAsked`. It's skipped on computers |
| Locking the screen direction | `main.js`, `tryLock`. It asks the phone to hold the chosen way when a match starts |
| The "Turn your phone" screen | `main.js`, `checkRotate`, and `index.html` line 218 |
| The sideways layout | `css/style.css`, search `orientation:landscape`. Shrinks the logo, PLAY button, minimap and tutorial box on short screens |
| Installed app | `manifest.webmanifest`, `"orientation": "any"`. Leave it on `any` or the sideways choice can't work |

Phones don't all behave the same here:
- Android Chrome only allows locking the direction in full screen, so `tryLock` goes full screen first.
- iPhones don't allow locking at all. There the game shows the "Turn your phone" screen with a **Play this way instead** button.

To remove the choice and keep the game upright only, delete the pop-up check in `main.js` (search `orientAsked`) and set `"orientation": "portrait"` in the manifest.

### 9.4 The power-ups card in the tutorial

After the BUY step, the tutorial stops on a card that lists every power-up and what it does. It's the step with `info: true` in `js/tutorial.js` (lines 52–61). Each row of `list:` is:

```
['🍛', 'Jollof, rice and stew, small chops, moi moi, pepper soup', `Belle full: energy goes to full and you don't tire for ${CFG.fullTime} seconds`]
 icon   name                                                         what it does
```

The wording is plain text, so change it freely. Two things to keep in line with the rules:

- **The numbers.** The card reads some of them from `CFG` (for example `${CFG.fullTime}`), so they stay right when you change `world.js`. If you type a number in by hand, remember to change it when you change the setting.
- **New foods.** A shop's effect is one of `'full'`, `'water'`, `'boost'` or `'ready'` (section 4.3). A new food with one of those effects is already covered by its row; just add its name to the list. A new kind of effect needs code in `sim.js` and a new row here.

The two steps right after the card let the player try things for real: one drops a zobo bottle beside them, the next asks them to Dash. The police part now has a Whistle step before the catch.

### 9.5 Solid props: parked cars, kiosk, cooler

The parked cars on Naija Street used to be decoration only, so people ran straight through them. They're now in a `props:` list (`world.js` line 68) and block movement like the danfos do. `setMap` adds them to the obstacles (search `m.props`), `scene.js` draws them (search `'car'` in `buildWorld`), and bots path around them.

To add a car anywhere, add a row to that location's `props:` (create the list if it hasn't got one):
```
[x, y, w, h, 'car', '', '#c0392b']
```
A car is about 1.3 by 2.6. Make `w` the longer side for a car parked left–right.

**Check after you add one.** A prop on top of a building, or one that seals off a corner, breaks things quietly. So:
- Play the location and walk round it.
- Run `node tools/balance.mjs 40 street` (use the location's name). If police win far more than before, a prop is probably blocking a route.

**The gap filler** (`world.js` line 243, `GAP_FILL = 1.8`). Where a bus, keke or car leaves a gap narrower than 1.8 units against a wall or building, the game fills it with tyres and jerrycans. Players can't squeeze through a gap that small anyway, and this stops them getting stuck in it. Make the number smaller if it fills gaps you want open.

### 9.6 Other things worth knowing before you edit

- **Every time you change files, bump `sw.js` line 2** (now `'pt-v8-1'`). Phones that installed the game keep the old files until this changes.
- **Night games are 30% of matches.** It's hard-coded in `sim.js` line 43 as `Math.random() < .3`. Section 8.3, point 3 shows how to move it into `CFG`.
- **The tutorial always runs on Naija Street.** If you move its shops, the tree near the start, or the Post gates, play the tutorial again (More → Tutorial) to check every step can still be finished.
- **The orientation pop-up and the tutorial pop-up chain together.** On a phone the first launch shows the orientation pop-up, then the "first time?" pop-up. If you remove one, check the other still shows.
- **Saves are versioned.** New settings (like `orient`) get added to old saves by `migrate()` in `meta.js`. If you add a setting, give it a default in `fresh()` (line 143; settings are on line 148) so old players get it too.
- **Bots and players share the rules.** Anything you change in `sim.js` changes the bots as well, so run the balance check after rule edits.
