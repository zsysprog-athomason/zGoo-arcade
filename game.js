const bC = document.getElementById('bCanvas'), bCtx = bC.getContext('2d');
const cC = document.getElementById('cCanvas'), cCtx = cC.getContext('2d');
const liq = document.getElementById('liquid');
let w = bC.width = cC.width = innerWidth, h = bC.height = cC.height = innerHeight;
onresize = () => { w = bC.width = cC.width = innerWidth; h = bC.height = cC.height = innerHeight; };

let audioCtx = null, muted = false;
function playTone(freq, type, dur, vol = 0.12, slide = 0) {
  if (muted) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, audioCtx.currentTime + dur);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}

const sfx = {
  pop: () => playTone(260 + Math.random() * 140, 'sine', 0.08, 0.05, 520),
  coin: (combo) => playTone(580 + combo * 90, 'triangle', 0.22, 0.18, 980 + combo * 110),
  clock: () => playTone(740, 'sine', 0.35, 0.2, 1480),
  bomb: () => playTone(140, 'sawtooth', 0.35, 0.2, 45),
  hitRival: () => playTone(320, 'square', 0.12, 0.15, 180),
  killRival: () => playTone(440, 'triangle', 0.4, 0.22, 1200),
  steal: () => playTone(220, 'sawtooth', 0.2, 0.12, 110)
};

const cfg = { whit: 0.3, spd: 1.0, push: 0.8, blur: 6 };
const panel = document.getElementById('panel');
panel.onmousedown = e => e.stopPropagation();
panel.ontouchstart = e => e.stopPropagation();
document.getElementById('startScreen').ontouchstart = e => e.stopPropagation();
document.getElementById('gameOver').ontouchstart = e => e.stopPropagation();

document.getElementById('toggle').onclick = e => {
  panel.classList.toggle('min');
  e.target.textContent = panel.classList.contains('min') ? 'Show' : 'Hide';
};
if (innerWidth <= 768) {
  panel.classList.add('min');
  document.getElementById('toggle').textContent = 'Show';
}
document.getElementById('muteBtn').onclick = e => {
  muted = !muted;
  e.target.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
};

const bind = (id, key, lbl, fn) => {
  document.getElementById(id).oninput = e => {
    cfg[key] = parseFloat(e.target.value);
    document.getElementById(lbl).textContent = cfg[key];
    if (fn) fn();
  };
};
bind('sWhit', 'whit', 'vWhit');
bind('sSpd', 'spd', 'vSpd');
bind('sPush', 'push', 'vPush');
bind('sBlur', 'blur', 'vBlur', () => liq.style.filter = `blur(${cfg.blur}px) contrast(32)`);

document.getElementById('sWhit').value = cfg.whit;
document.getElementById('vWhit').textContent = cfg.whit;
document.getElementById('sBlur').value = cfg.blur;
document.getElementById('vBlur').textContent = cfg.blur;
liq.style.filter = `blur(${cfg.blur}px) contrast(32)`;

let score = 0, best = parseInt(localStorage.getItem('gooBest') || '0');
let escaped = 0, timeLeft = 90, active = false, hue = 0, mx = -1000, my = -1000;
let combo = 1, lastCatchTime = 0, popCooldown = 0;
document.getElementById('bestVal').textContent = best;

const blobs = [], coins = [], bombs = [], rivals = [], popups = [];
const TIERS = [
  { label: '100', color: '#e07a3c', ring: '#ffd1b3', r: 16, baseSpeed: 1.6, pts: 100, time: 0 },
  { label: '250', color: '#cfd8dc', ring: '#ffffff', r: 14, baseSpeed: 2.5, pts: 250, time: 0 },
  { label: '500', color: '#ffd700', ring: '#fff59d', r: 12, baseSpeed: 3.5, pts: 500, time: 0 },
  { label: '+10s', color: '#00e5ff', ring: '#b2ebf2', r: 15, baseSpeed: 3.0, pts: 150, time: 10 }
];

function addPopup(x, y, text, color, life = 55) {
  popups.push({ x, y, text, color, life, maxLife: life });
}

function updateHUD() {
  document.getElementById('scoreVal').textContent = score;
  document.getElementById('escVal').textContent = escaped;
  document.getElementById('comboVal').textContent = combo + 'x';
  if (score > best) {
    best = score;
    localStorage.setItem('gooBest', best);
    document.getElementById('bestVal').textContent = best;
  }
}
class Blob {
  constructor(x, y, r) {
    this.x = x; this.y = y;
    const a = Math.random() * 6.28, s = Math.random() * 1.2 + 0.3;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.r = r || 55 + Math.random() * 30;
    this.h = (hue + Math.random() * 45) % 360;
  }
  step() {
    const dx = this.x - mx, dy = this.y - my, d = Math.hypot(dx, dy);
    if (d < this.r + 45 && d > 0) {
      const f = (this.r + 45 - d) / (this.r + 45);
      this.vx += (dx / d) * f * cfg.push;
      this.vy += (dy / d) * f * cfg.push;
      this.r -= cfg.whit;
      if (popCooldown <= 0) { sfx.pop(); popCooldown = 6; }
    }
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.94; this.vy *= 0.94;
    if (this.x < this.r) { this.x = this.r; this.vx *= -0.8; }
    if (this.x > w - this.r) { this.x = w - this.r; this.vx *= -0.8; }
    if (this.y < this.r) { this.y = this.r; this.vy *= -0.8; }
    if (this.y > h - this.r) { this.y = h - this.r; this.vy *= -0.8; }
  }
  draw() {
    bCtx.beginPath(); bCtx.arc(this.x, this.y, Math.max(0, this.r), 0, 6.28);
    bCtx.fillStyle = `hsl(${this.h}, 95%, 52%)`; bCtx.fill();
  }
}

function getCover(x, y) {
  let cover = 0;
  for (let b of blobs) {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < b.r) cover += (b.r - d);
  }
  return cover;
}

class Coin {
  constructor(host, forcedTier) {
    const roll = Math.random();
    this.tier = forcedTier || (roll < 0.5 ? TIERS.at(0) : (roll < 0.85 ? TIERS.at(1) : TIERS.at(2)));
    this.host = host; this.x = host ? host.x : w / 2; this.y = host ? host.y : h / 2;
    this.vx = 0; this.vy = 0; this.free = !host; this.pulse = Math.random() * 6.28;
    if (this.free) this.launch();
  }
  launch() {
    this.free = true;
    const ang = Math.atan2(h / 2 - this.y, w / 2 - this.x) + (Math.random() * 2.4 - 1.2);
    const spd = this.tier.baseSpeed * cfg.spd;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
  }
  step() {
    this.pulse += 0.14;
    if (!this.free) {
      if (this.host && this.host.r > 8) { this.x = this.host.x; this.y = this.host.y; }
      if (getCover(this.x, this.y) < 22) this.launch();
    } else {
      const cur = Math.hypot(this.vx, this.vy) || 1, tgt = this.tier.baseSpeed * cfg.spd;
      this.vx = (this.vx / cur) * tgt; this.vy = (this.vy / cur) * tgt;
      this.x += this.vx; this.y += this.vy;
      for (let b of blobs) {
        const dx = this.x - b.x, dy = this.y - b.y, d = Math.hypot(dx, dy);
        if (d < b.r + this.tier.r && d > 0) {
          const nx = dx / d, ny = dy / d, dot = this.vx * nx + this.vy * ny;
          if (dot < 0) {
            this.vx -= 2 * dot * nx; this.vy -= 2 * dot * ny;
            b.r -= 8; b.vx -= nx * 2.5; b.vy -= ny * 2.5;
          }
        }
      }
    }
  }
  draw() {
    const r = this.tier.r + (this.free ? Math.sin(this.pulse) * 2 : 0);
    cCtx.save();
    if (!this.free) { cCtx.globalAlpha = 0.45; cCtx.setLineDash([4, 4]); }
    else { cCtx.shadowColor = this.tier.color; cCtx.shadowBlur = 14; }
    cCtx.beginPath(); cCtx.arc(this.x, this.y, r, 0, 6.28);
    cCtx.fillStyle = this.tier.color; cCtx.fill();
    cCtx.lineWidth = 2.5; cCtx.strokeStyle = this.tier.ring; cCtx.stroke();
    if (this.free) {
      cCtx.setLineDash([]); cCtx.fillStyle = '#111'; cCtx.font = 'bold 10px sans-serif';
      cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle';
      cCtx.fillText(this.tier.label, this.x, this.y + 1);
    }
    cCtx.restore();
  }
}

class Bomb {
  constructor(host) { this.host = host; this.x = host.x; this.y = host.y; this.r = 14; }
  step() {
    if (this.host && this.host.r > 8) { this.x = this.host.x; this.y = this.host.y; }
    if (getCover(this.x, this.y) < 18) {
      sfx.bomb(); score = Math.max(0, score - 200); combo = 1; updateHUD();
      addPopup(this.x, this.y, 'GOO BOMB! -200', '#ffea00', 110);
      for (let i = 0; i < 6; i++) blobs.push(new Blob(this.x, this.y, 50));
      return true;
    }
    return false;
  }
  draw() {
    cCtx.save(); cCtx.globalAlpha = 0.55; cCtx.beginPath(); cCtx.arc(this.x, this.y, this.r, 0, 6.28);
    cCtx.fillStyle = '#ff1744'; cCtx.fill(); cCtx.lineWidth = 2; cCtx.strokeStyle = '#ff8a80'; cCtx.stroke();
    cCtx.fillStyle = '#fff'; cCtx.font = 'bold 12px sans-serif';
    cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle'; cCtx.fillText('!', this.x, this.y);
    cCtx.restore();
  }
}

class Rival {
  constructor(host) {
    this.host = host; this.x = host.x; this.y = host.y;
    this.vx = 0; this.vy = 0; this.r = 18; this.free = false; this.hp = 3; this.stun = 0; this.loot = [];
  }
  step() {
    if (!this.free) {
      if (this.host && this.host.r > 8) { this.x = this.host.x; this.y = this.host.y; }
      if (getCover(this.x, this.y) < 20) {
        this.free = true;
        addPopup(this.x, this.y, 'Baylee Free!', '#76ff03', 110);
      }
      return;
    }
    if (this.stun > 0) { this.stun--; return; }
    let target = null, minDist = 9999;
    for (let c of coins) {
      if (c.free) { const d = Math.hypot(c.x - this.x, c.y - this.y); if (d < minDist) { minDist = d; target = c; } }
    }
    const tx = target ? target.x : w / 2, ty = target ? target.y : h / 2;
    const ang = Math.atan2(ty - this.y, tx - this.x), spd = 2.4 * cfg.spd;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
    this.x += this.vx; this.y += this.vy;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.free && Math.hypot(c.x - this.x, c.y - this.y) < this.r + c.tier.r) {
        sfx.steal(); this.loot.push(c.tier); this.r += 2; escaped++; updateHUD();
        addPopup(this.x, this.y, 'GATHERED!', '#76ff03', 100); coins.splice(i, 1);
      }
    }
  }
  draw() {
    cCtx.save(); cCtx.globalAlpha = this.free ? 1.0 : 0.5;
    if (this.free) { cCtx.shadowColor = '#d500f9'; cCtx.shadowBlur = 16; }
    cCtx.beginPath(); cCtx.arc(this.x, this.y, this.r, 0, 6.28);
    cCtx.fillStyle = this.stun > 0 ? '#7c4dff' : '#aa00ff'; cCtx.fill();
    cCtx.lineWidth = 3; cCtx.strokeStyle = '#ea80fc'; cCtx.stroke();
    if (this.free) {
      cCtx.fillStyle = '#fff'; cCtx.font = 'bold 11px sans-serif';
      cCtx.textAlign = 'center'; cCtx.textBaseline = 'middle'; cCtx.fillText(`BAY:${this.hp}`, this.x, this.y);
    }
    cCtx.restore();
  }
}
function spawnWave() {
  hue = (hue + 75) % 360; const waveBlobs = [];
  const marginX = Math.min(140, w * 0.18), marginY = Math.min(140, h * 0.18);
  for (let i = 0; i < 14; i++) {
    const bx = marginX + Math.random() * (w - marginX * 2), by = marginY + Math.random() * (h - marginY * 2);
    const b = new Blob(bx, by, 52 + Math.random() * 28); blobs.push(b); waveBlobs.push(b);
  }
  coins.push(new Coin(waveBlobs.at(0), TIERS.at(3)));
  for (let i = 1; i < 6; i++) coins.push(new Coin(waveBlobs.at(i)));
  bombs.push(new Bomb(waveBlobs.at(6)));
  if (rivals.length === 0) {
    rivals.push(new Rival(waveBlobs.at(7)));
  }
}

function showStartScreen() {
  active = false;
  mx = -1000; my = -1000;
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
}

function resetGame() {
  score = 0; escaped = 0; timeLeft = 90; combo = 1; active = true;
  blobs.length = 0; coins.length = 0; bombs.length = 0; rivals.length = 0; popups.length = 0;
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('timeVal').textContent = timeLeft;
  updateHUD(); spawnWave();
}

function handleTap(x, y) {
  if (!active) return;
  for (let i = rivals.length - 1; i >= 0; i--) {
    const r = rivals.at(i);
    if (r.free && Math.hypot(x - r.x, y - r.y) <= r.r + 22) {
      r.hp--; r.stun = 25;
      if (r.hp <= 0) {
        sfx.killRival(); score += 1000;
        addPopup(r.x, r.y, 'REDELIVERY! +1000', '#00e5ff', 120);
        for (let tier of r.loot) {
          const d = new Coin(null, tier); d.x = r.x; d.y = r.y; d.launch(); coins.push(d);
          escaped = Math.max(0, escaped - 1);
        }
        updateHUD(); rivals.splice(i, 1);
      } else {
        sfx.hitRival();
        addPopup(r.x, r.y, `TAP! (${r.hp} left)`, '#76ff03', 90);
      }
      return;
    }
  }
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins.at(i);
    if (c.free && Math.hypot(x - c.x, y - c.y) <= c.tier.r + 24) {
      const now = performance.now();
      combo = (now - lastCatchTime < 1800) ? Math.min(8, combo + 1) : 1;
      lastCatchTime = now;
      const earned = c.tier.pts * combo; score += earned;
      if (c.tier.time > 0) {
        sfx.clock(); timeLeft += c.tier.time;
        document.getElementById('timeVal').textContent = timeLeft;
      } else { sfx.coin(combo); }
      updateHUD();
      const label = c.tier.time > 0 ? `+${c.tier.time}s & +${earned}` : `+${earned}` + (combo > 1 ? ` (${combo}x)` : '');
      addPopup(c.x, c.y, label, c.tier.color);
      coins.splice(i, 1); break;
    }
  }
}

document.getElementById('startBtn').onclick = resetGame;
document.getElementById('resetBtn').onclick = showStartScreen;
document.getElementById('playAgainBtn').onclick = showStartScreen;

// Desktop Mouse Events
onmousemove = e => { if (active) { mx = e.clientX; my = e.clientY; } };
onmousedown = e => handleTap(e.clientX, e.clientY);

// Mobile Touch Events
ontouchstart = e => {
  if (!active) return;
  const t = e.touches.item(0);
  mx = t.clientX; my = t.clientY;
  handleTap(t.clientX, t.clientY);
};
ontouchmove = e => {
  if (!active) return;
  const t = e.touches.item(0);
  mx = t.clientX; my = t.clientY;
};
ontouchend = () => { mx = -1000; my = -1000; };

setInterval(() => {
  if (!active) return;
  timeLeft--; document.getElementById('timeVal').textContent = timeLeft;
  if (timeLeft <= 0) {
    active = false;
    mx = -1000; my = -1000;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalBest').textContent = best;
    document.getElementById('gameOver').classList.remove('hidden');
  }
}, 1000);

showStartScreen();
(function loop() {
  if (popCooldown > 0) popCooldown--;
  bCtx.clearRect(0, 0, w, h); cCtx.clearRect(0, 0, w, h);
  if (active && coins.length === 0) spawnWave();
  for (let i = blobs.length - 1; i >= 0; i--) {
    blobs.at(i).step(); blobs.at(i).draw(); if (blobs.at(i).r <= 6) blobs.splice(i, 1);
  }
  for (let i = bombs.length - 1; i >= 0; i--) { if (bombs.at(i).step()) bombs.splice(i, 1); else bombs.at(i).draw(); }
  for (let i = rivals.length - 1; i >= 0; i--) { rivals.at(i).step(); rivals.at(i).draw(); }
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins.at(i); c.step(); c.draw();
    if (c.free && (c.x < -15 || c.x > w + 15 || c.y < -15 || c.y > h + 15)) {
      escaped++; combo = 1; updateHUD(); coins.splice(i, 1);
    }
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups.at(i);
    cCtx.save();
    cCtx.font = 'bold 18px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
    cCtx.lineWidth = 4;
    cCtx.strokeStyle = 'rgba(11, 11, 18, 0.9)';
    cCtx.strokeText(p.text, p.x, p.y);
    cCtx.fillStyle = p.color;
    cCtx.fillText(p.text, p.x, p.y);
    cCtx.restore();
    p.y -= 0.7; p.life--;
    if (p.life <= 0) popups.splice(i, 1);
  }
  requestAnimationFrame(loop);
})();
