// The HUD: wanted stars, money, the objective line, speed, hints, toasts,
// the pause and completion screens, and a 2D top-down minimap of the city.

import { ROADS, LAYOUT } from './city.js';

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'),
    stars: $('stars'),
    money: $('money'),
    objective: $('objective'),
    speed: $('speed'),
    hint: $('hint'),
    toastEl: $('toast'),
    minimap: $('minimap'),
    startScreen: $('startScreen'),
    pauseScreen: $('pauseScreen'),
    doneScreen: $('doneScreen'),
    doneText: $('doneText'),
    startBtn: $('startBtn'),
    continueBtn: $('continueBtn'),
    resumeBtn: $('resumeBtn'),
    againBtn: $('againBtn'),
    toastTimer: null,
    setObjective(text) {
      hud.objective.textContent = text;
    },
    toast(text) {
      hud.toastEl.textContent = text;
      hud.toastEl.style.opacity = '1';
      clearTimeout(hud.toastTimer);
      hud.toastTimer = setTimeout(() => { hud.toastEl.style.opacity = '0'; }, 2600);
    },
    showDone(money) {
      hud.doneText.textContent = `Dana banked $${money} across three jobs and slipped out of Coral Bay before sunrise. The last boat is waiting — and this time, nobody is following.`;
      hud.doneScreen.classList.remove('hidden');
    },
  };
  world.hud = hud;
  return hud;
}

function drawMinimap(world) {
  const c = world.hud.minimap;
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const span = LAYOUT.max - LAYOUT.min;
  const toMap = (x, z) => [
    ((x - LAYOUT.min) / span) * W,
    ((z - LAYOUT.min) / span) * H,
  ];
  // Sea and sand along the bottom edge, harbor yard on the right.
  g.fillStyle = '#12344a';
  g.fillRect(0, 0, W, H);
  const [bx] = toMap(LAYOUT.min, 0);
  const [, by] = toMap(0, LAYOUT.beachZ);
  g.fillStyle = '#e8d29a';
  g.fillRect(0, by, W, H - by);
  g.fillStyle = '#1e7fa8';
  g.fillRect(0, by + 16, W, H - by - 16);
  g.fillStyle = '#8a8f94';
  const [hx] = toMap(LAYOUT.harborX, 0);
  g.fillRect(hx, 0, W - hx, H);
  // Roads.
  g.strokeStyle = '#5a6068';
  g.lineWidth = 5;
  for (const r of ROADS) {
    const [x] = toMap(r, 0);
    const [, z] = toMap(0, r);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    g.beginPath(); g.moveTo(0, z); g.lineTo(W, z); g.stroke();
  }
  // Mission marker.
  const m = world.missions;
  if (m && !m.done && m.marker.visible) {
    const [mx, my] = toMap(m.marker.position.x, m.marker.position.z);
    g.fillStyle = '#ffc93c';
    g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffc93c';
    g.beginPath(); g.arc(mx, my, 10, 0, Math.PI * 2); g.stroke();
  }
  if (m && m.index === 1 && m.checkpoints.length > 0 && m.checkpoint < m.checkpoints.length) {
    const ring = m.checkpoints[m.checkpoint];
    if (ring) {
      const [rx, ry] = toMap(ring.position.x, ring.position.z);
      g.fillStyle = '#ff7a3c';
      g.beginPath(); g.arc(rx, ry, 5, 0, Math.PI * 2); g.fill();
    }
  }
  // Traffic (grey), police (blue), player (white arrow).
  g.fillStyle = '#c8c8c8';
  for (const car of world.traffic) {
    const [x, y] = toMap(car.pos.x, car.pos.z);
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  g.fillStyle = '#3a7bff';
  for (const cop of world.cops) {
    const [x, y] = toMap(cop.pos.x, cop.pos.z);
    g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
  }
  const p = world.player.car ? world.player.car.pos : world.player.pos;
  const [px, py] = toMap(p.x, p.z);
  const heading = world.player.car ? world.player.car.heading : world.player.heading;
  g.fillStyle = '#ffffff';
  g.save();
  g.translate(px, py);
  g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * 0 + heading);
  g.beginPath();
  g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
  g.fill();
  g.restore();
}

export function updateHud(world) {
  const hud = world.hud;
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += `<span class="${i < world.wanted ? '' : 'off'}">★</span>`;
  }
  hud.stars.innerHTML = stars;
  hud.money.textContent = `$${world.money}`;
  hud.speed.innerHTML = `${Math.round(world.speedKmh || 0)} <small>km/h</small>`;
  const near = world.player.car ? null : nearestCarHint(world);
  hud.hint.textContent = world.player.car
    ? 'W/S drive · A/D steer · E get out · P pause'
    : near ? 'Press E to get in the car' : 'WASD walk · Shift run · E enter car · F punch · P pause';
  drawMinimap(world);
}

function nearestCarHint(world) {
  for (const car of world.cars) {
    if (car.driver) continue;
    const d = Math.hypot(car.pos.x - world.player.pos.x, car.pos.z - world.player.pos.z);
    if (d < 4.2) return car;
  }
  return null;
}
