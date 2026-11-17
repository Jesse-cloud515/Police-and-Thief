"""Renders the game's theme instrumental, "Catch Me If You Fit", to audio/theme.mp3.

Every note is written out by hand below (drums, log-drum bass, palm-muted guitar,
kalimba, and a whistle carrying the tune a singer would take). Small timing and
loudness differences are added to each hit so it does not sound like a machine grid.
Run:  python3 tools/make_theme.py     (needs numpy, scipy and ffmpeg)
"""
import numpy as np, subprocess, os, sys
from scipy.signal import fftconvolve, butter, sosfilt

SR, BPM, BARS = 44100, 104, 40
BEAT = 60 / BPM; S16 = BEAT / 4
N = int(BARS * 16 * S16 * SR); TAIL = int(1.4 * SR)
rng = np.random.default_rng(11)
dryL, dryR, wet = np.zeros(N + TAIL), np.zeros(N + TAIL), np.zeros(N + TAIL)

def midi(n): return 440 * 2 ** ((n - 69) / 12)
def env_ad(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t * d)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], btype='band', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, btype='high', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, btype='low', fs=SR, output='sos'), x)

def put(sig, t, gain=1.0, pan=0.0, send=0.12):
    i = int(max(0, t) * SR)
    if i >= N + TAIL: return
    sig = sig[: N + TAIL - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    dryL[i:i + len(sig)] += sig * l; dryR[i:i + len(sig)] += sig * r; wet[i:i + len(sig)] += sig * send

def when(bar, step, feel=1.0):
    """Clock time of a 16th-note step, with swing on the off 16ths and a human wobble."""
    sw = 0.13 * S16 if step % 2 else 0
    return (bar * 16 + step) * S16 + sw + rng.normal(0, 0.0045) * feel
def vel(v, spread=0.12): return v * (1 + rng.uniform(-spread, spread))

# ------------------------------------------------------------------ instruments
def kick():
    n = int(.34 * SR); t = np.arange(n) / SR
    f = 46 + 115 * np.exp(-t * 36); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(2.2 * np.sin(ph) * np.exp(-t * 9)) + hp(rng.normal(0, 1, n), 2000) * np.exp(-t * 300) * .25
def rim():
    n = int(.07 * SR); t = np.arange(n) / SR
    return (np.sin(2*np.pi*830*t) + .7*np.sin(2*np.pi*1740*t)) * np.exp(-t * 85) + bp(rng.normal(0, 1, n), 1500, 5000) * np.exp(-t * 120) * .4
def clap():
    n = int(.22 * SR); out = np.zeros(n); x = bp(rng.normal(0, 1, n), 900, 3200)
    for k, off in enumerate([0, .011, .023, .034]):
        i = int((off + rng.uniform(0, .003)) * SR); m = n - i
        out[i:] += x[:m] * np.exp(-np.arange(m) / SR * (55 if k == 3 else 160))
    return out
def shaker(length=.075):
    n = int(length * SR); return hp(rng.normal(0, 1, n), 6500) * env_ad(n, .006, 48)
def conga(f, slap=0.0):
    n = int(.26 * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f * (1 + .12 * np.exp(-t * 40))) / SR
    return np.sin(ph) * np.exp(-t * 17) + bp(rng.normal(0, 1, n), 2000, 6000) * np.exp(-t * 90) * (.15 + slap)
def talking(f0, f1, dur=.3):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 + (f1 - f0) * np.minimum(1, t / (dur * .55)); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + .3 * np.sin(2 * ph)) * env_ad(n, .004, 9)
def logdrum(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f * (1 + .7 * np.exp(-t * 34))) / SR
    x = np.tanh(3 * np.sin(ph) * np.exp(-t * 4.5)) + .35 * np.sin(2 * ph) * np.exp(-t * 7) + .12 * np.sin(3 * ph) * np.exp(-t * 10)
    x[-int(.02 * SR):] *= np.linspace(1, 0, int(.02 * SR)); return x
_ks = {}
def guitar(f, dur=.42, mute=10.0):
    key = (round(f, 2), dur)
    if key not in _ks:
        n = int(dur * SR); p = int(SR / f); buf = lp(rng.uniform(-1, 1, p), 4200); out = np.zeros(n)
        for i in range(n):
            out[i] = buf[i % p]; buf[i % p] = .996 * .5 * (buf[i % p] + buf[(i + 1) % p])
        _ks[key] = out
    x = _ks[key]; return x * np.exp(-np.arange(len(x)) / SR * mute)
def kalimba(f, dur=.7):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2*np.pi*f*t) + .28*np.sin(2*np.pi*f*2.98*t)*np.exp(-t*14) + .1*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*30)) * env_ad(n, .003, 5.5)
def whistle(f, dur, scoop=True):
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + .006 * np.sin(2 * np.pi * 5.6 * t + rng.uniform(0, 6)) * np.minimum(1, t / .18)
    bend = 1 - (.035 * np.exp(-t * 40) if scoop else 0)
    ph = 2 * np.pi * np.cumsum(f * vib * bend) / SR
    e = np.minimum(1, t / .035) * np.minimum(1, (dur - t) / .06)
    breath = bp(rng.normal(0, 1, n), max(300, f * .7), f * 1.6) * .05
    return (np.sin(ph) + .07 * np.sin(2 * ph) + breath) * e

# ------------------------------------------------------------------ the song
# Am | F | C | G all the way through. Bars: 0-3 intro, 4-11 chorus, 12-19 verse,
# 20-27 chorus, 28-31 chant break, 32-39 last chorus.
CH = [(57, 'm'), (53, 'M'), (48, 'M'), (55, 'M')]            # A3 F3 C3 G3 as guitar roots
BASS = [33, 41, 36, 43]                                      # A1 F2 C2 G2
def tones(bar):
    r, q = CH[bar % 4]; third = 3 if q == 'm' else 4
    return [r, r + third, r + 7, r + 12, r + 12 + third]
sec = lambda b: 'intro' if b < 4 else 'ch' if b < 12 else 'verse' if b < 20 else 'ch' if b < 28 else 'break' if b < 32 else 'ch'

K, RM, CL = kick(), rim(), clap()
for b in range(BARS):
    s = sec(b); last = b == BARS - 1
    # --- drums
    if s != 'intro':
        for st, v in ([(0, 1), (4, .8), (8, 1), (12, .8)] if s == 'break' else [(0, 1), (6, .55), (8, .95), (11, .4), (14, .6)]):
            put(K, when(b, st, .5), vel(.9 * v, .06), 0, .03)
    for st in ([3, 6, 10, 12] if s != 'break' else [2, 6, 10, 14]):
        if s == 'intro' and b < 2: continue
        put(RM, when(b, st), vel(.3), -.25, .2)
    if s in ('ch', 'break'):
        for st in (4, 12): put(CL, when(b, st, .6), vel(.34), .1, .28)
    for st in range(16):
        acc = 1.0 if st % 4 == 2 else .62 if st % 2 == 0 else .4
        if s == 'verse' and st % 2: acc *= .7
        put(shaker(), when(b, st), vel(.13 * acc, .25), .35, .08)
    if s in ('ch', 'verse'):
        for st, f, sl in [(7, 196, 0), (9, 147, 0), (15, 196, .2)] + ([(13, 220, .1)] if b % 2 else []):
            put(conga(f, sl), when(b, st), vel(.3), -.45, .2)
    if b % 4 == 3 and s != 'intro' or last:                                   # fills into the next line
        for k, st in enumerate([12, 13, 14, 15]): put(conga([147, 175, 196, 233][k], .15), when(b, st), vel(.36 + k * .04), .4 - k * .25, .25)
    # --- log-drum bass
    if s != 'intro':
        f = midi(BASS[b % 4]); nxt = midi(BASS[(b + 1) % 4])
        pat = [(0, 0, 3, 1), (8, 0, 2, .8)] if s == 'break' else [(0, 0, 2.6, 1), (3, 0, 1.6, .7), (6, 7, 1.8, .75), (10, 0, 2.4, .9), (13, 12, 1, .5)]
        for st, semi, ln, v in pat: put(logdrum(f * 2 ** (semi / 12), ln * S16 * 1.1), when(b, st, .6), vel(.5 * v, .08), 0, .04)
        if s != 'break': put(logdrum((f + nxt) / 2, S16), when(b, 15, .6), .25, 0, .04)   # slide into the next chord
    # --- guitar: palm-muted highlife picking, opens up in the chorus
    if s != 'break':
        tn = tones(b); mute = 7 if s == 'ch' else 12
        for st, d in [(0, 0), (2, 2), (3, 1), (5, 2), (6, 3), (8, 2), (10, 1), (11, 2), (13, 3), (14, 2)]:
            if s == 'verse' and st in (5, 13): continue
            v = .3 if st in (0, 6, 10) else .2
            put(guitar(midi(tn[d]), .42, mute), when(b, st), vel(v, .2), -.55, .14)
            if s == 'ch' and st in (0, 6, 10): put(guitar(midi(tn[min(4, d + 1)]), .42, mute), when(b, st) + .012, vel(.17), -.4, .14)
    # --- kalimba: answers in the intro and verse, doubles the tune low in later choruses
    if s in ('intro', 'verse'):
        ph = [[(8, 76), (10, 79), (11, 81), (13, 79), (14, 76)], [(8, 72), (10, 76), (12, 72), (14, 69)],
              [(8, 76), (9, 79), (11, 76), (12, 74), (14, 72)], [(8, 74), (10, 71), (12, 74), (14, 76)]][b % 4]
        for st, n in ph: put(kalimba(midi(n)), when(b, st), vel(.26, .2), .5, .3)

# the tune (whistle): 8 bars, sung as "Catch me if you fit..." in the choruses
TUNE = [[(0, 76, 2), (2, 76, 1), (3, 74, 1), (4, 72, 2), (6, 69, 3), (10, 72, 1), (11, 74, 1), (12, 76, 3)],
        [(0, 72, 2), (2, 72, 1), (3, 69, 1), (4, 67, 2), (6, 69, 4), (12, 72, 2), (14, 74, 2)],
        [(0, 76, 2), (2, 79, 2), (4, 76, 2), (6, 74, 2), (8, 72, 3), (12, 74, 2), (14, 72, 2)],
        [(0, 74, 3), (3, 71, 1), (4, 74, 2), (6, 76, 2), (8, 74, 6)],
        [(0, 76, 2), (2, 76, 1), (3, 74, 1), (4, 72, 2), (6, 69, 3), (10, 72, 1), (11, 74, 1), (12, 76, 3)],
        [(0, 72, 2), (2, 72, 1), (3, 69, 1), (4, 67, 2), (6, 69, 4), (12, 72, 2), (14, 74, 2)],
        [(0, 76, 2), (2, 79, 2), (4, 81, 3), (8, 79, 2), (10, 76, 2), (12, 74, 2), (14, 72, 2)],
        [(0, 72, 2), (2, 71, 2), (4, 69, 9)]]
for start, low in [(4, False), (20, True), (32, True)]:
    for i, bar in enumerate(TUNE):
        for st, n, ln in bar:
            t = when(start + i, st, 1.4) + .01
            put(whistle(midi(n + 12), ln * S16 * .96), t, vel(.15, .1), .1, .35)
            if low: put(kalimba(midi(n), ln * S16 + .3), t, vel(.2, .15), .5, .3)
# pick-up into the first chorus, and the whistle "prrr!" that starts every round in the game
for k, n in enumerate([81, 84, 86]): put(whistle(midi(n + 12), S16 * .9, False), when(3, 13 + k), .16, .1, .35)
# chant break: talking drum asks, the drums answer ("Who dey run? Thief!  Who dey chase? Police!")
for b in range(28, 32):
    for st, a, z in [(0, 150, 220), (2, 220, 180), (3, 180, 250)]: put(talking(a, z), when(b, st), vel(.5), -.3, .3)
    for st in (8, 10): put(talking(260, 190, .22), when(b, st), vel(.45), .35, .3)

# ------------------------------------------------------------------ mix
ir_t = np.arange(int(1.1 * SR)) / SR
ir = lp(rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t * 5.5), 5000); ir[: int(.012 * SR)] = 0
rev = fftconvolve(wet, ir)[: N + TAIL]; rev = rev / (np.abs(rev).max() + 1e-9) * .5
L, R = dryL + rev * .9, dryR + np.roll(rev, 331) * .9
for ch in (L, R): ch[:TAIL] += ch[N:N + TAIL]                  # wrap the tail round so the loop has no gap
out = np.stack([L[:N], R[:N]], 1); out = hp(out.T, 35).T
out = np.tanh(out * 1.25 / np.abs(out).max() * 1.6); out = out / np.abs(out).max() * .84

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root, 'audio'), exist_ok=True)
dst = os.path.join(root, 'audio', 'theme.mp3')
p = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', '128k', dst],
                   input=(out * 32767).astype('<i2').tobytes())
print('wrote', dst, round(N / SR, 1), 'seconds', os.path.getsize(dst) // 1024, 'KB') if p.returncode == 0 else sys.exit('ffmpeg failed')
