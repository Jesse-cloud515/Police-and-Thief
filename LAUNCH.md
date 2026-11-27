# Launch plan: Police & Thief: Naija Streets

Updated 27 November 2026. Repo: https://github.com/Jesse-cloud515/Police-and-Thief · Server: https://police-thief-naija.onrender.com · Pages: https://jesse-cloud515.github.io/Police-and-Thief/ Work through the stages in order. Each task is marked:

- **[YOU]**: only you can do it (accounts, money, legal, real phones, real people)
- **[ME]**: Claude does it once you send what's listed
- **[BOTH]**: you decide or supply something, then Claude builds it

Tick the boxes as you go.

---

## Already done

- [x] The full game: 4v4, four locations, shops and power-ups, night games, wardrobe, levels, missions, Street Pass
- [x] Controls: joystick, SPRINT button, layout editor, upright or sideways
- [x] Tutorial with the power-ups card
- [x] Online play: Quick Match and Play with Friends (room codes and WhatsApp invite links)
- [x] Game server, with leaderboard, name filter, Paystack payment check and Restore purchases
- [x] Hosting files (`Dockerfile`, `render.yaml`)
- [x] Shop pins and minimap badges
- [x] Posters (A3, story, square), trailer, and Play with Friends clip
- [x] `README.md`, `CODE_GUIDE.md`, `MONETIZATION.md`

---

## Stage 1: Get online play live (this week)

### 1.1 [YOU] Put the project on GitHub

You already have a GitHub account (jesse-cloud515).

1. Install **GitHub Desktop** (desktop.github.com) and sign in. It's easier than uploading through the website, which struggles with many files.
2. **File → Add local repository**, choose the `police-thief-naija-streets` folder. When it says the folder isn't a repository yet, click **create a repository**.
3. Name it `police-thief-naija-streets`. Leave it **Public** if you want free GitHub Pages.
4. Check the list of files on the left. `node_modules` should NOT be there (`.gitignore` skips it). The `media` videos can stay out too: they're big and the game doesn't need them. To skip them, add a line `media/` to `.gitignore`.
5. Type a short summary like "First upload", click **Commit to main**, then **Publish repository**.

### 1.2 [YOU] Turn on GitHub Pages (optional)

This gives you a second link that works even when the server is asleep (single player only until step 1.5).

1. On github.com, open the repo → **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute or two, the page shows your address: `https://jesse-cloud515.github.io/police-thief-naija-streets/`.

### 1.3 [YOU] Start the server on Render

1. Go to render.com → **Get Started** → sign up with GitHub. If it asks for a card and your card fails, stop and tell Claude; there are other hosts.
2. **New + → Blueprint**. Allow Render to see the `police-thief-naija-streets` repo, pick it, then click **Apply**.
3. Wait for the status to turn **Live**. The first build takes 3–8 minutes.
4. Copy the address at the top of the page (something like `https://police-thief-naija.onrender.com`).
5. Open it on two phones. On one: **PLAY ONLINE → PLAY WITH FRIENDS → CREATE ROOM → INVITE**. Send the link to the other phone and tap it. Start a match.

If the build fails, open **Logs** and send Claude a screenshot of the red lines.

### 1.4 [YOU] Send Claude these

- [x] The GitHub repo link
- [x] The GitHub Pages link (if you did 1.2)
- [x] The Render address
- [ ] What happened in the two-phone test

### 1.5 [ME] Connect everything

- [x] Put the Render address into `config.js` so the GitHub Pages copy gets online play
- [ ] Put your link and a real QR code on the three posters
- [ ] Tell you what to type in Render's **Environment** tab for `ALLOWED_ORIGINS`, so only your sites can use the server

You then commit and push the changes in GitHub Desktop. Render rebuilds by itself.

### 1.6 [YOU] Keep the free server awake (optional)

The free server sleeps after 15 quiet minutes, and the next player waits about a minute.

1. Sign up at uptimerobot.com (free).
2. **Add New Monitor** → type **HTTP(s)** → URL: your Render address followed by `/health` → interval **5 minutes** → save.

This also emails you if the server goes down. Render's free plan gives enough hours for one server to run all month, but Render could change that rule. The real fix is the paid plan in Stage 5.

---

## Stage 2: Legal pages (before strangers play)

### 2.1 [YOU] Decide and send Claude

- [ ] **Contact email for players.** Your personal Gmail works, but a separate one (for example `policethief.game@gmail.com`) keeps support away from your inbox. Create it first if you want one.
- [ ] **Age group.** Recommended: **13 and over**.
- [ ] **How long to keep leaderboard names.** Recommended: deleted after **12 months** without play, or sooner on request.

### 2.2 [ME] Write

- [ ] Finish `privacy.html`: date, contact email, age section, and the Nigeria Data Protection Act 2023 section
- [ ] A short `terms.html`: fair play, no cheating, rude names get changed, and progress is saved on the phone only
- [ ] Links to both pages from the game's More menu

### 2.3 [YOU] Get them checked

- [ ] Ask a lawyer to read both pages. A law-graduate friend or a short paid consultation is enough for now. It matters most before you take payments.

---

## Stage 3: Crash reports and player numbers (before the closed test)

### 3.1 [YOU] Sentry, for crash reports

1. Sign up at sentry.io (free plan).
2. Create a project and pick **Browser JavaScript** as the platform.
3. Copy the **DSN**. It looks like `https://abc123@o456.ingest.sentry.io/789`. It's safe to share; it only lets the game send error reports.
- [x] Send Claude the DSN.

### 3.2 [YOU] GoatCounter, for player numbers

1. Sign up at goatcounter.com (free for small sites, no cookie banner needed).
2. Choose a code, for example `policethief`. Your stats page becomes `https://policethief.goatcounter.com`.
- [ ] Send Claude the code.

(Google Analytics gives more detail but needs a cookie banner for players in the UK and EU. Start with GoatCounter.)

### 3.3 [ME] Wire them in

- [x] Errors from players' phones go to Sentry, with the screen size, solo or online, and the map that was being played
- [ ] GoatCounter counts visits, games started, online versus solo games, and tutorial finishes
- [ ] Show you which numbers to check each week: players per day, and who comes back after 1 day and after 7 days

---

## Stage 4: Closed test (1–2 weeks)

### 4.1 [YOU] Run the test

1. Make a WhatsApp group of 30–50 friends and classmates. Get at least three people with cheap Android phones (2–3 GB of memory) in it.
2. Post the link, the trailer (`media/police-thief-trailer.mp4`) and the friends clip.
3. Ask everyone for three things:
   - anything that felt unfair;
   - anywhere they got confused or stuck;
   - the phone model, if the game lagged.
4. Play at least 20 online games with real people yourself. Note how often each side wins.
5. Screenshot the feedback as it comes in.

### 4.2 [BOTH] Fix in batches

- [ ] You send the feedback (screenshots are fine) every few days
- [ ] Claude fixes bugs, rebalances, and checks the bots after each change

---

## Stage 5: Public launch

### 5.1 [YOU] Name check

1. Search "Police & Thief" and "Police and Thief" on the Nigerian trademarks search (iponigeria.com, the Trademarks, Patents and Designs Registry).
2. Search the name on Google, the Play Store and TikTok for games with the same name.
- [ ] Tell Claude what you find. If there's a clash, Claude can suggest names.

### 5.2 [YOU] Domain (optional but worth it)

1. Pick one: `policeandthief.ng`, `.com.ng` or `.com`. Check whether it's free on Whogohost (Nigerian, takes naira) or Namecheap.
2. Buy it for one year.
- [ ] Tell Claude the domain. Claude will give you the exact settings to type into Render and your domain's DNS page.

### 5.3 [YOU] Upgrade the server for launch day

1. In Render, open the service → **Settings → Instance Type** → **Starter** (about $7 a month).
2. **Disks → Add Disk**, mount path `/data`, 1 GB. The leaderboard then survives restarts.

### 5.4 [BOTH] Ads

You decide the route, then Claude switches it on.

- **CrazyGames (recommended to start).** They host the game, bring players and share the ad money. No ad approval needed.
  1. Sign up at developer.crazygames.com.
  2. Tell Claude. Claude prepares the upload package with their ads switched on.
  3. You submit it in their portal and wait for review. Reviews can take a few weeks.
- **Poki.** Similar deal, but they're pickier and you apply through developers.poki.com.
- **AdSense on your own domain.** Apply at adsense.google.com once the domain is live and has a little traffic. When approved, send Claude your `ca-pub-` ID.

### 5.5 [YOU] Marketing

- [ ] Make TikTok, Instagram and X accounts with the same name
- [ ] Post the trailer on TikTok, Instagram Reels and YouTube Shorts, with the link in your bio
- [ ] Post the friends clip on WhatsApp status the same day you share your first room code
- [ ] Put the A3 poster up around campus (the QR code goes on it in 1.5)
- [ ] Run a weekly "Best escape" clip contest with airtime prizes
- [ ] Message Nigerian gaming creators and campus esports clubs

---

## Stage 6: Money (after launch, once people play regularly)

### 6.1 [YOU] Register the business

1. Register a business name with the CAC on its online portal (search "CAC business name registration"). Check the current fee there.
2. Open a business bank account in that name once you have the certificate.

### 6.2 [ME] Accounts and cloud saves, BEFORE taking payments

Right now progress lives only in the phone's browser, so a player who clears it or changes phones loses what they bought.

- [ ] [YOU] Create a free Supabase account (supabase.com) and a project, then send Claude the **Project URL** and the **anon public key**
- [ ] [ME] Add sign-in (Google or phone number) and save progress to Supabase

### 6.3 [YOU] Paystack

1. Sign up at paystack.com with your business details.
2. **Settings → API Keys & Webhooks**: copy the **Test Public Key** (`pk_test_...`) and send it to Claude.
3. Copy the **Test Secret Key** (`sk_test_...`) and paste it into Render: your service → **Environment** → `PAYSTACK_SECRET`. **Never send the secret key to anyone, Claude included, and never put it in the code.**
4. Test a purchase with Paystack's test cards. When it all works, repeat steps 2–3 with the **live** keys.

### 6.4 [ME] Switch on purchases

- [ ] Put the public key in `config.js`, test the full purchase with you, then switch to live

---

## Stage 7: After launch (ongoing)

- [ ] [YOU] Check Sentry and GoatCounter once a week
- [ ] [BOTH] Rebalance from real numbers; Claude runs `node tools/balance.mjs` before each update
- [ ] [ME] First update: Street Challenges (solo missions with stars and rewards)
- [ ] [BOTH] Plan v2 from the numbers after 2–4 weeks: story mode or crews first, share-a-clip, new locations, seasonal events
- [ ] [YOU] Later: a real 3D artist for the characters, and a singer to record the theme song

---

## Never put these in the code, a chat or GitHub

- Paystack **secret** keys (`sk_...`)
- Bank details, passwords, BVN or NIN
- Anything from Render's Environment tab except the names of the settings
